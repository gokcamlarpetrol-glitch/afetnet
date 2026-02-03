/**
 * MESH STORE & FORWARD SERVICE - ELITE V1
 * Manages offline message storage and delivery for mesh network.
 * 
 * Features:
 * - Per-peer mailbox for offline delivery
 * - ACK tracking and retry logic
 * - Priority-based queue management
 * - Persistent storage with AsyncStorage
 * - Message expiration handling
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { createLogger } from '../../utils/logger';
import { MeshProtocol, MeshMessageType, MeshPriority, MeshPacket } from './MeshProtocol';
import { useMeshStore, MeshMessage } from './MeshStore';
import { cryptoService } from '../CryptoService';

const logger = createLogger('MeshStoreForward');

// Storage keys
const STORAGE_KEY_MAILBOX = '@mesh_mailbox';
const STORAGE_KEY_PENDING_ACKS = '@mesh_pending_acks';
const STORAGE_KEY_DELIVERED = '@mesh_delivered_ids';

// Configuration
const MAX_MAILBOX_SIZE = 100; // Max messages per peer
const MAX_PENDING_ACKS = 500; // Max ACK tracking entries
const MESSAGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ACK_TIMEOUT_MS = 60 * 1000; // 1 minute for ACK response
const MAX_RETRIES = 5;

// Types
export interface StoredMessage {
    id: string;
    messageId: number;
    senderId: string;
    targetPeerId: string; // Empty string for broadcast
    type: MeshMessageType;
    payload: string; // Base64 encoded
    priority: MeshPriority;
    ttl: number;
    createdAt: number;
    expiresAt: number;
    retryCount: number;
    lastAttemptAt?: number;
}

export interface PendingACK {
    messageId: number;
    targetPeerId: string;
    sentAt: number;
    retryCount: number;
    priority: MeshPriority;
    originalPayload: string; // For retry
}

export interface Mailbox {
    [peerId: string]: StoredMessage[];
}

class MeshStoreForwardService {
    private mailbox: Mailbox = {};
    private pendingACKs: Map<number, PendingACK> = new Map();
    private deliveredIds: Set<string> = new Set();
    private isInitialized = false;
    private myDeviceId: string = '';

    // Listeners
    private messageDeliveredCallbacks: ((msgId: string, peerId: string) => void)[] = [];
    private ackReceivedCallbacks: ((msgId: number) => void)[] = [];

    // ===========================================================================
    // INITIALIZATION
    // ===========================================================================

    async initialize(deviceId: string): Promise<void> {
        if (this.isInitialized) return;

        this.myDeviceId = deviceId;

        try {
            await Promise.all([
                this.loadMailbox(),
                this.loadPendingACKs(),
                this.loadDeliveredIds(),
            ]);

            // Cleanup expired messages
            this.cleanupExpiredMessages();

            this.isInitialized = true;
            logger.info('Store & Forward Service initialized');
        } catch (error) {
            logger.error('Failed to initialize Store & Forward', error);
        }
    }

    // ===========================================================================
    // MESSAGE QUEUEING
    // ===========================================================================

    /**
     * Store a message for later delivery to a peer
     */
    async storeForPeer(
        targetPeerId: string,
        type: MeshMessageType,
        content: string | Buffer,
        options: {
            priority?: MeshPriority;
            ttl?: number;
            expiryMs?: number;
        } = {}
    ): Promise<string> {
        const messageId = Math.floor(Math.random() * 0xFFFFFFFF);
        const payload = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');

        const storedMsg: StoredMessage = {
            id: await cryptoService.generateUUID() || messageId.toString(16),
            messageId,
            senderId: this.myDeviceId,
            targetPeerId,
            type,
            payload: payload.toString('base64'),
            priority: options.priority ?? MeshProtocol.getPriorityForType(type),
            ttl: options.ttl ?? 3,
            createdAt: Date.now(),
            expiresAt: Date.now() + (options.expiryMs ?? MESSAGE_EXPIRY_MS),
            retryCount: 0,
        };

        // Add to mailbox
        if (!this.mailbox[targetPeerId]) {
            this.mailbox[targetPeerId] = [];
        }

        // Enforce max size (evict oldest low-priority first)
        if (this.mailbox[targetPeerId].length >= MAX_MAILBOX_SIZE) {
            this.evictFromMailbox(targetPeerId);
        }

        this.mailbox[targetPeerId].push(storedMsg);

        // Sort by priority
        this.mailbox[targetPeerId].sort((a, b) => a.priority - b.priority);

        await this.saveMailbox();

        logger.debug(`Stored message ${storedMsg.id} for peer ${targetPeerId}`);
        return storedMsg.id;
    }

    /**
     * Store a broadcast message for all known peers
     */
    async storeForBroadcast(
        type: MeshMessageType,
        content: string | Buffer,
        options: {
            priority?: MeshPriority;
            ttl?: number;
        } = {}
    ): Promise<string> {
        return this.storeForPeer('broadcast', type, content, options);
    }

    // ===========================================================================
    // MESSAGE RETRIEVAL
    // ===========================================================================

    /**
     * Get pending messages for a specific peer
     */
    getMessagesForPeer(peerId: string): StoredMessage[] {
        const peerMessages = this.mailbox[peerId] || [];
        const broadcastMessages = this.mailbox['broadcast'] || [];

        // Combine and sort by priority
        return [...peerMessages, ...broadcastMessages]
            .filter(msg => msg.expiresAt > Date.now())
            .sort((a, b) => a.priority - b.priority);
    }

    /**
     * Get all pending messages (for immediate broadcast when peers found)
     */
    getAllPendingMessages(): StoredMessage[] {
        const all: StoredMessage[] = [];

        for (const peerId of Object.keys(this.mailbox)) {
            all.push(...this.mailbox[peerId].filter(msg => msg.expiresAt > Date.now()));
        }

        return all.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Get critical messages only (for emergency relay)
     */
    getCriticalMessages(): StoredMessage[] {
        return this.getAllPendingMessages()
            .filter(msg => msg.priority === MeshPriority.CRITICAL);
    }

    // ===========================================================================
    // ACK HANDLING
    // ===========================================================================

    /**
     * Track a sent message waiting for ACK
     */
    async trackForACK(messageId: number, targetPeerId: string, payload: Buffer, priority: MeshPriority): Promise<void> {
        const pendingAck: PendingACK = {
            messageId,
            targetPeerId,
            sentAt: Date.now(),
            retryCount: 0,
            priority,
            originalPayload: payload.toString('base64'),
        };

        this.pendingACKs.set(messageId, pendingAck);

        // Enforce max size
        if (this.pendingACKs.size > MAX_PENDING_ACKS) {
            // Remove oldest low-priority entries
            const sorted = Array.from(this.pendingACKs.entries())
                .sort((a, b) => a[1].priority - b[1].priority || a[1].sentAt - b[1].sentAt);

            const toRemove = sorted.slice(MAX_PENDING_ACKS);
            toRemove.forEach(([id]) => this.pendingACKs.delete(id));
        }

        await this.savePendingACKs();
    }

    /**
     * Process received ACK
     */
    async processACK(originalMessageId: number, ackType: 'received' | 'delivered' | 'read', receiverIdHash: string): Promise<void> {
        const pending = this.pendingACKs.get(originalMessageId);

        if (pending) {
            logger.info(`ACK received for message ${originalMessageId} (${ackType})`);

            // Remove from pending
            this.pendingACKs.delete(originalMessageId);
            await this.savePendingACKs();

            // Track as delivered
            this.deliveredIds.add(originalMessageId.toString());
            await this.saveDeliveredIds();

            // Notify listeners
            this.ackReceivedCallbacks.forEach(cb => cb(originalMessageId));

            // Update store message status
            useMeshStore.getState().updateMessageStatus(
                originalMessageId.toString(),
                ackType === 'read' ? 'read' : 'delivered'
            );
        }
    }

    /**
     * Get messages needing retry (ACK timeout exceeded)
     */
    getMessagesNeedingRetry(): PendingACK[] {
        const now = Date.now();
        const needRetry: PendingACK[] = [];

        for (const [_, pending] of this.pendingACKs) {
            const elapsed = now - pending.sentAt;

            if (elapsed > ACK_TIMEOUT_MS && pending.retryCount < MAX_RETRIES) {
                needRetry.push(pending);
            }
        }

        return needRetry.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Increment retry count for a message
     */
    async incrementRetry(messageId: number): Promise<boolean> {
        const pending = this.pendingACKs.get(messageId);

        if (pending) {
            pending.retryCount++;
            pending.sentAt = Date.now();

            if (pending.retryCount >= MAX_RETRIES) {
                logger.warn(`Message ${messageId} exceeded max retries, removing`);
                this.pendingACKs.delete(messageId);
                await this.savePendingACKs();
                return false;
            }

            await this.savePendingACKs();
            return true;
        }

        return false;
    }

    /**
     * Check if message has been delivered
     */
    isDelivered(messageId: string | number): boolean {
        return this.deliveredIds.has(messageId.toString());
    }

    // ===========================================================================
    // MESSAGE DELIVERY
    // ===========================================================================

    /**
     * Mark message as delivered and remove from mailbox
     */
    async markDelivered(messageId: string, targetPeerId: string): Promise<void> {
        // Remove from mailbox
        if (this.mailbox[targetPeerId]) {
            this.mailbox[targetPeerId] = this.mailbox[targetPeerId]
                .filter(msg => msg.id !== messageId);
            await this.saveMailbox();
        }

        // Track delivery
        this.deliveredIds.add(messageId);
        await this.saveDeliveredIds();

        // Notify listeners
        this.messageDeliveredCallbacks.forEach(cb => cb(messageId, targetPeerId));

        logger.debug(`Message ${messageId} delivered to ${targetPeerId}`);
    }

    /**
     * Create ACK packet for a received message
     */
    createACKPacket(originalPacket: MeshPacket): Buffer {
        const ackPayload = MeshProtocol.createACKPayload(
            originalPacket.header.messageId,
            'received',
            this.myDeviceId
        );

        return MeshProtocol.serialize(
            MeshMessageType.ACK,
            this.myDeviceId,
            ackPayload,
            1, // ACK TTL = 1 (direct response)
            100
        );
    }

    // ===========================================================================
    // CALLBACKS
    // ===========================================================================

    onMessageDelivered(callback: (msgId: string, peerId: string) => void): () => void {
        this.messageDeliveredCallbacks.push(callback);
        return () => {
            this.messageDeliveredCallbacks = this.messageDeliveredCallbacks.filter(cb => cb !== callback);
        };
    }

    onACKReceived(callback: (msgId: number) => void): () => void {
        this.ackReceivedCallbacks.push(callback);
        return () => {
            this.ackReceivedCallbacks = this.ackReceivedCallbacks.filter(cb => cb !== callback);
        };
    }

    // ===========================================================================
    // PERSISTENCE
    // ===========================================================================

    private async saveMailbox(): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEY_MAILBOX, JSON.stringify(this.mailbox));
        } catch (error) {
            logger.error('Failed to save mailbox', error);
        }
    }

    private async loadMailbox(): Promise<void> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY_MAILBOX);
            if (data) {
                this.mailbox = JSON.parse(data);
            }
        } catch (error) {
            logger.error('Failed to load mailbox', error);
            this.mailbox = {};
        }
    }

    private async savePendingACKs(): Promise<void> {
        try {
            const arr = Array.from(this.pendingACKs.entries());
            await AsyncStorage.setItem(STORAGE_KEY_PENDING_ACKS, JSON.stringify(arr));
        } catch (error) {
            logger.error('Failed to save pending ACKs', error);
        }
    }

    private async loadPendingACKs(): Promise<void> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY_PENDING_ACKS);
            if (data) {
                const arr: [number, PendingACK][] = JSON.parse(data);
                this.pendingACKs = new Map(arr);
            }
        } catch (error) {
            logger.error('Failed to load pending ACKs', error);
            this.pendingACKs = new Map();
        }
    }

    private async saveDeliveredIds(): Promise<void> {
        try {
            // Only keep recent IDs (max 1000)
            const arr = Array.from(this.deliveredIds).slice(-1000);
            await AsyncStorage.setItem(STORAGE_KEY_DELIVERED, JSON.stringify(arr));
        } catch (error) {
            logger.error('Failed to save delivered IDs', error);
        }
    }

    private async loadDeliveredIds(): Promise<void> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY_DELIVERED);
            if (data) {
                this.deliveredIds = new Set(JSON.parse(data));
            }
        } catch (error) {
            logger.error('Failed to load delivered IDs', error);
            this.deliveredIds = new Set();
        }
    }

    // ===========================================================================
    // CLEANUP
    // ===========================================================================

    private cleanupExpiredMessages(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const peerId of Object.keys(this.mailbox)) {
            const before = this.mailbox[peerId].length;
            this.mailbox[peerId] = this.mailbox[peerId].filter(msg => msg.expiresAt > now);
            cleaned += before - this.mailbox[peerId].length;
        }

        if (cleaned > 0) {
            logger.info(`Cleaned ${cleaned} expired messages`);
            this.saveMailbox();
        }
    }

    private evictFromMailbox(peerId: string): void {
        const messages = this.mailbox[peerId];
        if (!messages || messages.length === 0) return;

        // Sort: low priority and oldest first
        messages.sort((a, b) =>
            (b.priority - a.priority) || (a.createdAt - b.createdAt)
        );

        // Remove last 10%
        const removeCount = Math.max(1, Math.floor(messages.length * 0.1));
        this.mailbox[peerId] = messages.slice(0, -removeCount);

        logger.debug(`Evicted ${removeCount} messages from mailbox for ${peerId}`);
    }

    // ===========================================================================
    // STATS
    // ===========================================================================

    getStats() {
        let totalMessages = 0;
        let peerCount = 0;

        for (const peerId of Object.keys(this.mailbox)) {
            totalMessages += this.mailbox[peerId].length;
            peerCount++;
        }

        return {
            totalMessages,
            peerCount,
            pendingACKs: this.pendingACKs.size,
            deliveredCount: this.deliveredIds.size,
        };
    }

    /**
     * Clear all stored data (use carefully!)
     */
    async clearAll(): Promise<void> {
        this.mailbox = {};
        this.pendingACKs.clear();
        this.deliveredIds.clear();

        await Promise.all([
            AsyncStorage.removeItem(STORAGE_KEY_MAILBOX),
            AsyncStorage.removeItem(STORAGE_KEY_PENDING_ACKS),
            AsyncStorage.removeItem(STORAGE_KEY_DELIVERED),
        ]);

        logger.info('Store & Forward data cleared');
    }
}

export const meshStoreForwardService = new MeshStoreForwardService();
export default meshStoreForwardService;
