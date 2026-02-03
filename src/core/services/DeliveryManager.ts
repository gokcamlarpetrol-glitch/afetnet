/**
 * DELIVERY MANAGER - ELITE EDITION
 * Centralized delivery tracking for guaranteed message delivery
 * 
 * Features:
 * - ACK tracking with timeout
 * - Automatic retry mechanism
 * - Delivery status callbacks
 * - Failed message queue management
 * - Analytics and metrics
 */

import { createLogger } from '../utils/logger';
import { useMeshStore, MeshMessage } from './mesh/MeshStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const logger = createLogger('DeliveryManager');

// Storage key
const DELIVERY_TRACKING_KEY = '@afetnet:delivery_tracking';

// ELITE: Delivery status
export type DeliveryStatus = 'pending' | 'sent' | 'ack_waiting' | 'delivered' | 'read' | 'failed';

// ELITE: Delivery record
export interface DeliveryRecord {
    messageId: string;
    recipientId: string;
    status: DeliveryStatus;
    sentAt: number;
    ackReceivedAt?: number;
    deliveredAt?: number;
    readAt?: number;
    retryCount: number;
    lastRetryAt?: number;
    failedReason?: string;
}

// ELITE: Delivery callback type
export type DeliveryCallback = (messageId: string, status: DeliveryStatus) => void;

// ELITE: Retry configuration
const RETRY_CONFIG = {
    maxRetries: 5,
    ackTimeout: 10000, // 10 seconds to wait for ACK
    retryDelays: [1000, 2000, 4000, 8000, 16000], // Exponential backoff
};

class DeliveryManager {
    private deliveryRecords: Map<string, DeliveryRecord> = new Map();
    private deliveryCallbacks: Map<string, DeliveryCallback[]> = new Map();
    private ackTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private isInitialized = false;

    /**
     * Initialize delivery manager
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        await this.loadRecords();
        this.startAckMonitor();
        this.isInitialized = true;

        logger.info('🚀 DeliveryManager initialized');
    }

    /**
     * Track a message for delivery
     */
    trackMessage(messageId: string, recipientId: string): void {
        const record: DeliveryRecord = {
            messageId,
            recipientId,
            status: 'pending',
            sentAt: Date.now(),
            retryCount: 0,
        };

        this.deliveryRecords.set(messageId, record);
        this.saveRecords();

        // Start ACK timeout
        this.startAckTimeout(messageId);

        logger.debug(`Tracking message: ${messageId}`);
    }

    /**
     * Handle ACK received
     */
    onAckReceived(messageId: string): void {
        const record = this.deliveryRecords.get(messageId);
        if (!record) return;

        // Clear ACK timeout
        this.clearAckTimeout(messageId);

        // Update record
        record.status = 'delivered';
        record.ackReceivedAt = Date.now();
        record.deliveredAt = Date.now();

        this.deliveryRecords.set(messageId, record);
        this.saveRecords();

        // Update MeshStore
        useMeshStore.getState().markAsDelivered(messageId, record.recipientId);

        // Notify callbacks
        this.notifyCallbacks(messageId, 'delivered');

        logger.debug(`ACK received for: ${messageId}`);
    }

    /**
     * Mark message as read
     */
    onReadConfirmed(messageId: string): void {
        const record = this.deliveryRecords.get(messageId);
        if (!record) return;

        record.status = 'read';
        record.readAt = Date.now();

        this.deliveryRecords.set(messageId, record);
        this.saveRecords();

        // Update MeshStore
        useMeshStore.getState().markAsRead(messageId);

        // Notify callbacks
        this.notifyCallbacks(messageId, 'read');

        logger.debug(`Read confirmed for: ${messageId}`);
    }

    /**
     * Get pending deliveries
     */
    getPendingDeliveries(): DeliveryRecord[] {
        return Array.from(this.deliveryRecords.values()).filter(
            r => r.status === 'pending' || r.status === 'ack_waiting'
        );
    }

    /**
     * Get failed deliveries
     */
    getFailedDeliveries(): DeliveryRecord[] {
        return Array.from(this.deliveryRecords.values()).filter(
            r => r.status === 'failed'
        );
    }

    /**
     * Get delivery status for a message
     */
    getDeliveryStatus(messageId: string): DeliveryStatus {
        const record = this.deliveryRecords.get(messageId);
        return record?.status || 'pending';
    }

    /**
     * Retry a failed message
     */
    async retryFailed(messageId: string): Promise<boolean> {
        const record = this.deliveryRecords.get(messageId);
        if (!record || record.status !== 'failed') return false;

        if (record.retryCount >= RETRY_CONFIG.maxRetries) {
            logger.warn(`Max retries exceeded for: ${messageId}`);
            return false;
        }

        record.retryCount++;
        record.lastRetryAt = Date.now();
        record.status = 'pending';
        record.failedReason = undefined;

        this.deliveryRecords.set(messageId, record);
        this.saveRecords();

        // Restart ACK timeout
        this.startAckTimeout(messageId);

        // Trigger resend via MeshStore
        useMeshStore.getState().retryMessage(messageId);

        logger.info(`Retrying message: ${messageId}, attempt ${record.retryCount}`);
        return true;
    }

    /**
     * Retry all failed messages
     */
    async retryAllFailed(): Promise<number> {
        const failedRecords = this.getFailedDeliveries();
        let retriedCount = 0;

        for (const record of failedRecords) {
            const success = await this.retryFailed(record.messageId);
            if (success) retriedCount++;
        }

        logger.info(`Retried ${retriedCount} of ${failedRecords.length} failed messages`);
        return retriedCount;
    }

    /**
     * Register delivery callback
     */
    onDeliveryUpdate(messageId: string, callback: DeliveryCallback): () => void {
        if (!this.deliveryCallbacks.has(messageId)) {
            this.deliveryCallbacks.set(messageId, []);
        }
        this.deliveryCallbacks.get(messageId)!.push(callback);

        return () => {
            const callbacks = this.deliveryCallbacks.get(messageId);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index >= 0) callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Get delivery metrics
     */
    getMetrics(): {
        total: number;
        pending: number;
        delivered: number;
        failed: number;
        avgDeliveryTime: number;
    } {
        const records = Array.from(this.deliveryRecords.values());
        const delivered = records.filter(r => r.status === 'delivered' || r.status === 'read');

        let totalDeliveryTime = 0;
        delivered.forEach(r => {
            if (r.deliveredAt && r.sentAt) {
                totalDeliveryTime += r.deliveredAt - r.sentAt;
            }
        });

        return {
            total: records.length,
            pending: records.filter(r => r.status === 'pending' || r.status === 'ack_waiting').length,
            delivered: delivered.length,
            failed: records.filter(r => r.status === 'failed').length,
            avgDeliveryTime: delivered.length > 0 ? totalDeliveryTime / delivered.length : 0,
        };
    }

    // PRIVATE METHODS

    private startAckTimeout(messageId: string) {
        this.clearAckTimeout(messageId);

        const record = this.deliveryRecords.get(messageId);
        if (!record) return;

        const timeout = setTimeout(() => {
            this.handleAckTimeout(messageId);
        }, RETRY_CONFIG.ackTimeout);

        this.ackTimeouts.set(messageId, timeout);

        // Update status
        record.status = 'ack_waiting';
        this.deliveryRecords.set(messageId, record);
        this.saveRecords();
    }

    private clearAckTimeout(messageId: string) {
        const timeout = this.ackTimeouts.get(messageId);
        if (timeout) {
            clearTimeout(timeout);
            this.ackTimeouts.delete(messageId);
        }
    }

    private handleAckTimeout(messageId: string) {
        const record = this.deliveryRecords.get(messageId);
        if (!record) return;

        // Check if we should retry
        if (record.retryCount < RETRY_CONFIG.maxRetries) {
            // Schedule retry with backoff
            const delay = RETRY_CONFIG.retryDelays[record.retryCount] || RETRY_CONFIG.retryDelays[RETRY_CONFIG.retryDelays.length - 1];

            logger.debug(`ACK timeout for ${messageId}, scheduling retry in ${delay}ms`);

            setTimeout(() => {
                this.retryFailed(messageId);
            }, delay);
        } else {
            // Mark as failed
            record.status = 'failed';
            record.failedReason = 'ACK timeout - max retries exceeded';

            this.deliveryRecords.set(messageId, record);
            this.saveRecords();

            // Update MeshStore
            useMeshStore.getState().markAsFailed(messageId);

            // Notify callbacks
            this.notifyCallbacks(messageId, 'failed');

            logger.warn(`Message permanently failed: ${messageId}`);
        }
    }

    private startAckMonitor() {
        // Check for stale pending messages every minute
        setInterval(() => {
            const now = Date.now();

            for (const record of this.deliveryRecords.values()) {
                if (record.status === 'ack_waiting' && !this.ackTimeouts.has(record.messageId)) {
                    // Restart timeout for stale messages
                    this.startAckTimeout(record.messageId);
                }
            }
        }, 60000);
    }

    private notifyCallbacks(messageId: string, status: DeliveryStatus) {
        const callbacks = this.deliveryCallbacks.get(messageId);
        if (callbacks) {
            callbacks.forEach(cb => cb(messageId, status));
        }
    }

    private async loadRecords() {
        try {
            const data = await AsyncStorage.getItem(DELIVERY_TRACKING_KEY);
            if (data) {
                const records: DeliveryRecord[] = JSON.parse(data);
                records.forEach(r => this.deliveryRecords.set(r.messageId, r));
            }
        } catch (error) {
            logger.error('Failed to load delivery records:', error);
        }
    }

    private async saveRecords() {
        try {
            const records = Array.from(this.deliveryRecords.values());
            await AsyncStorage.setItem(DELIVERY_TRACKING_KEY, JSON.stringify(records));
        } catch (error) {
            logger.error('Failed to save delivery records:', error);
        }
    }

    /**
     * Clear old records (cleanup)
     */
    async clearOldRecords(maxAgeDays: number = 7): Promise<number> {
        const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        let cleared = 0;

        for (const [messageId, record] of this.deliveryRecords) {
            if (record.sentAt < cutoff && (record.status === 'delivered' || record.status === 'read')) {
                this.deliveryRecords.delete(messageId);
                cleared++;
            }
        }

        if (cleared > 0) {
            await this.saveRecords();
            logger.info(`Cleared ${cleared} old delivery records`);
        }

        return cleared;
    }
}

export const deliveryManager = new DeliveryManager();
