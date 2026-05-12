/**
 * MESH STORE & FORWARD SERVICE - ELITE V2
 * Manages offline message storage and delivery for mesh network.
 *
 * Features:
 * - Per-peer mailbox for offline delivery
 * - ACK tracking and retry logic
 * - Priority-based queue management
 * - Persistent storage with MMKV (DirectStorage)
 * - Message expiration handling
 * - User-scoped storage keys (prevents cross-account data leak)
 * - SOS/CRITICAL message eviction protection
 */

import { DirectStorage } from '../../utils/storage';
import { Buffer } from 'buffer';
import { createLogger } from '../../utils/logger';
import { MeshProtocol, MeshMessageType, MeshPriority, MeshPacket } from './MeshProtocol';
import { useMeshStore, MeshMessage } from './MeshStore';
import { cryptoService } from '../CryptoService';

const logger = createLogger('MeshStoreForward');

// Storage base keys (will be scoped per user at runtime)
const STORAGE_KEY_MAILBOX = '@mesh_mailbox';
const STORAGE_KEY_PENDING_ACKS = '@mesh_pending_acks';
const STORAGE_KEY_DELIVERED = '@mesh_delivered_ids';

// Configuration
const MAX_MAILBOX_SIZE = 100; // Max messages per peer
const MAX_PENDING_ACKS = 500; // Max ACK tracking entries
const MESSAGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// BLE mesh multi-hop networks: a message may take 2-3 minutes to propagate
// through multiple hops and for the ACK to return. 60s was too aggressive.
const ACK_TIMEOUT_MS = 180 * 1000; // 3 minutes for ACK response
// In disaster scenarios, network is extremely unreliable. 5 retries was
// not enough — messages got dropped before they could be delivered.
const MAX_RETRIES = 15;
const DELIVERED_IDS_CAP = 5000; // Max delivered IDs to persist

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
    originalStringId?: string; // Original UUID string ID for MeshStore status updates
    targetPeerId: string;
    sentAt: number;
    retryCount: number;
    priority: MeshPriority;
    originalPayload: string; // For retry
}

export interface Mailbox {
    [peerId: string]: StoredMessage[];
}

// Delivered ID entry with timestamp for time-based cleanup
interface DeliveredEntry {
    id: string;
    at: number; // timestamp when marked delivered
}

class MeshStoreForwardService {
    private mailbox: Mailbox = {};
    private pendingACKs: Map<number, PendingACK> = new Map();
    private deliveredIds: Set<string> = new Set();
    private deliveredTimestamps: Map<string, number> = new Map(); // id → deliveredAt timestamp
    private isInitialized = false;
    private myDeviceId: string = '';
    private currentUid = ''; // User-scoped storage keys to prevent cross-account data leak

    // Listeners
    private messageDeliveredCallbacks: ((msgId: string, peerId: string) => void)[] = [];
    private ackReceivedCallbacks: ((msgId: number) => void)[] = [];

    // ===========================================================================
    // INITIALIZATION
    // ===========================================================================

    async initialize(deviceId: string): Promise<void> {
        if (this.isInitialized) return;

        this.myDeviceId = deviceId;

        // Resolve UID for user-scoped storage keys.
        // Without this, account switch causes cross-account data leak.
        try {
            const { identityService } = require('../IdentityService');
            this.currentUid = identityService.getUid() || '';
            if (!this.currentUid) {
                const { getFirebaseAuth } = require('../../../lib/firebase');
                this.currentUid = getFirebaseAuth()?.currentUser?.uid || '';
            }
        } catch { /* fallback to empty = unscoped */ }

        try {
            await Promise.all([
                this.loadMailbox(),
                this.loadPendingACKs(),
                this.loadDeliveredIds(),
            ]);

            // Cleanup expired messages and old delivered IDs
            await this.cleanupExpiredMessages();

            this.isInitialized = true;
            logger.info('Store & Forward Service initialized', {
                uid: this.currentUid ? this.currentUid.substring(0, 8) + '...' : 'unscoped',
            });
        } catch (error) {
            logger.error('Failed to initialize Store & Forward', error);
        }
    }

    // ===========================================================================
    // USER-SCOPED STORAGE KEY
    // ===========================================================================

    /**
     * Returns a user-scoped storage key to prevent cross-account data leak.
     * Falls back to base key if no UID is available.
     */
    private getScopedKey(baseKey: string): string {
        return this.currentUid ? `${baseKey}_${this.currentUid}` : baseKey;
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
     * Get pending messages for a specific peer.
     *
     * CRITICAL FIX: Peer IDs from BLE discovery are hex hashes of the original
     * device/UID string (from MeshProtocol.deserialize: sourceIdHash.toString(16)).
     * But storeForPeer() stores under raw Firebase UIDs. We must match by hashing
     * each mailbox key and comparing with the incoming peerId.
     */
    getMessagesForPeer(peerId: string): StoredMessage[] {
        const now = Date.now();
        const collected: StoredMessage[] = [];

        // 1. Direct key match (exact peerId in mailbox)
        if (this.mailbox[peerId]) {
            collected.push(...this.mailbox[peerId]);
        }

        // 2. Hash-based match: peerId might be hashString(originalKey).toString(16)
        //    e.g., mailbox key = "firebase-uid-abc", peerId = "a1b2c3d4" (hex hash)
        const peerIdLower = peerId.toLowerCase();
        for (const key of Object.keys(this.mailbox)) {
            if (key === peerId || key === 'broadcast') continue;
            try {
                const keyHash = MeshProtocol.hashString(key).toString(16);
                if (keyHash === peerIdLower) {
                    collected.push(...this.mailbox[key]);
                }
            } catch { /* hashString failure — skip */ }
        }

        // 3. Always include broadcast messages
        if (this.mailbox['broadcast']) {
            collected.push(...this.mailbox['broadcast']);
        }

        // Deduplicate (same message could appear if direct + hash match overlap)
        const seen = new Set<string>();
        const unique = collected.filter(msg => {
            if (seen.has(msg.id)) return false;
            seen.add(msg.id);
            return true;
        });

        return unique
            .filter(msg => msg.expiresAt > now)
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
    async trackForACK(messageId: number, targetPeerId: string, payload: Buffer, priority: MeshPriority, originalStringId?: string): Promise<void> {
        const pendingAck: PendingACK = {
            messageId,
            originalStringId,
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
            const idStr = originalMessageId.toString();
            this.deliveredIds.add(idStr);
            this.deliveredTimestamps.set(idStr, Date.now());
            await this.saveDeliveredIds();

            // Notify listeners
            this.ackReceivedCallbacks.forEach(cb => cb(originalMessageId));

            // CRITICAL FIX: Use originalStringId (UUID) for MeshStore update, not UInt32 hash.
            // MeshStore messages have UUID-format IDs (e.g., "a1b2c3d4-..."), but
            // originalMessageId is a UInt32 hash from toMessageIdUInt32(). Using the hash
            // as a string ID would never match any MeshStore message, so delivery status
            // would never be updated in the UI.
            const storeId = pending.originalStringId || originalMessageId.toString();
            useMeshStore.getState().updateMessageStatus(
                storeId,
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
                logger.warn(`Message ${messageId} exceeded max retries (${MAX_RETRIES}), removing`);
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
     * Mark message as delivered and remove from mailbox.
     *
     * CRITICAL FIX: Search ALL mailbox keys for the messageId, not just targetPeerId.
     * The targetPeerId from BLE discovery is a hex hash (e.g., "a1b2c3d4") but the
     * mailbox key may be a Firebase UID (e.g., "abc123..."). Also checks 'broadcast'.
     */
    async markDelivered(messageId: string, targetPeerId: string): Promise<void> {
        let removed = false;

        // Search ALL mailbox keys for this messageId
        for (const key of Object.keys(this.mailbox)) {
            const before = this.mailbox[key].length;
            this.mailbox[key] = this.mailbox[key].filter(msg => msg.id !== messageId);
            if (this.mailbox[key].length < before) {
                removed = true;
                // Clean up empty mailbox entries
                if (this.mailbox[key].length === 0) {
                    delete this.mailbox[key];
                }
            }
        }

        if (removed) {
            await this.saveMailbox();
        }

        // Track delivery with timestamp
        this.deliveredIds.add(messageId);
        this.deliveredTimestamps.set(messageId, Date.now());
        await this.saveDeliveredIds();

        // Notify listeners
        this.messageDeliveredCallbacks.forEach(cb => cb(messageId, targetPeerId));

        logger.debug(`Message ${messageId} delivered to ${targetPeerId}${removed ? '' : ' (not found in mailbox)'}`);
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
            const key = this.getScopedKey(STORAGE_KEY_MAILBOX);
            DirectStorage.setString(key, JSON.stringify(this.mailbox));
        } catch (error) {
            logger.error('Failed to save mailbox', error);
        }
    }

    private async loadMailbox(): Promise<void> {
        try {
            const key = this.getScopedKey(STORAGE_KEY_MAILBOX);
            const data = DirectStorage.getString(key) ?? null;
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
            const key = this.getScopedKey(STORAGE_KEY_PENDING_ACKS);
            const arr = Array.from(this.pendingACKs.entries());
            DirectStorage.setString(key, JSON.stringify(arr));
        } catch (error) {
            logger.error('Failed to save pending ACKs', error);
        }
    }

    private async loadPendingACKs(): Promise<void> {
        try {
            const key = this.getScopedKey(STORAGE_KEY_PENDING_ACKS);
            const data = DirectStorage.getString(key) ?? null;
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
            const key = this.getScopedKey(STORAGE_KEY_DELIVERED);
            // Save as entries with timestamps for time-based cleanup
            const entries: DeliveredEntry[] = Array.from(this.deliveredIds).map(id => ({
                id,
                at: this.deliveredTimestamps.get(id) || Date.now(),
            }));
            // Cap at DELIVERED_IDS_CAP to prevent unbounded growth
            const capped = entries.slice(-DELIVERED_IDS_CAP);
            DirectStorage.setString(key, JSON.stringify(capped));
        } catch (error) {
            logger.error('Failed to save delivered IDs', error);
        }
    }

    private async loadDeliveredIds(): Promise<void> {
        try {
            const key = this.getScopedKey(STORAGE_KEY_DELIVERED);
            const data = DirectStorage.getString(key) ?? null;
            if (data) {
                const parsed = JSON.parse(data);
                // Handle both old format (string[]) and new format (DeliveredEntry[])
                if (Array.isArray(parsed) && parsed.length > 0) {
                    if (typeof parsed[0] === 'string') {
                        // Legacy format: string array — migrate to new format
                        this.deliveredIds = new Set(parsed);
                        const now = Date.now();
                        this.deliveredTimestamps = new Map(parsed.map((id: string) => [id, now]));
                    } else {
                        // New format: DeliveredEntry[]
                        const entries = parsed as DeliveredEntry[];
                        this.deliveredIds = new Set(entries.map(e => e.id));
                        this.deliveredTimestamps = new Map(entries.map(e => [e.id, e.at]));
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to load delivered IDs', error);
            this.deliveredIds = new Set();
            this.deliveredTimestamps = new Map();
        }
    }

    // ===========================================================================
    // CLEANUP
    // ===========================================================================

    private async cleanupExpiredMessages(): Promise<void> {
        const now = Date.now();
        let cleaned = 0;

        for (const peerId of Object.keys(this.mailbox)) {
            const before = this.mailbox[peerId].length;
            this.mailbox[peerId] = this.mailbox[peerId].filter(msg => msg.expiresAt > now);
            cleaned += before - this.mailbox[peerId].length;
        }

        if (cleaned > 0) {
            logger.info(`Cleaned ${cleaned} expired messages`);
            await this.saveMailbox();
        }

        // Also cleanup old delivered IDs
        await this.cleanupDeliveredIds();
    }

    /**
     * Remove delivered IDs older than MESSAGE_EXPIRY_MS (7 days).
     * Prevents unbounded growth while keeping enough history to prevent duplicate delivery.
     */
    private async cleanupDeliveredIds(): Promise<void> {
        const cutoff = Date.now() - MESSAGE_EXPIRY_MS;
        let removed = 0;

        // FIX: Collect IDs to delete first, then delete after iteration.
        // Deleting from Map during for...of is spec-compliant in V8 but fragile
        // in Hermes engine (React Native). Separate collection prevents issues.
        const toDelete: string[] = [];
        for (const [id, timestamp] of this.deliveredTimestamps) {
            if (timestamp < cutoff) {
                toDelete.push(id);
            }
        }
        for (const id of toDelete) {
            this.deliveredIds.delete(id);
            this.deliveredTimestamps.delete(id);
            removed++;
        }

        if (removed > 0) {
            logger.info(`Cleaned ${removed} old delivered IDs`);
            await this.saveDeliveredIds();
        }
    }

    /**
     * Evict low-priority messages from a peer's mailbox when it exceeds MAX_MAILBOX_SIZE.
     * CRITICAL (SOS) messages are NEVER evicted — they are protected.
     *
     * Sort order: LOW priority first (higher number = lower priority), then oldest first.
     * slice(0, -removeCount) removes from the tail = lowest priority + oldest messages.
     */
    private evictFromMailbox(peerId: string): void {
        const messages = this.mailbox[peerId];
        if (!messages || messages.length === 0) return;

        // Separate CRITICAL (SOS) messages — they must NEVER be evicted
        const criticalMessages = messages.filter(m => m.priority === MeshPriority.CRITICAL);
        const evictableMessages = messages.filter(m => m.priority !== MeshPriority.CRITICAL);

        if (evictableMessages.length === 0) {
            // All messages are critical — cannot evict anything
            logger.warn(`Cannot evict from mailbox for ${peerId}: all ${messages.length} messages are CRITICAL`);
            return;
        }

        // Sort ascending by priority: CRITICAL (0) first, NORMAL (2) last.
        // Within same priority, sort NEWEST first so slice(0, -N) removes OLDEST from tail.
        evictableMessages.sort((a, b) =>
            (a.priority - b.priority) || (b.createdAt - a.createdAt)
        );

        // Remove last 10% of evictable messages
        const removeCount = Math.max(1, Math.floor(evictableMessages.length * 0.1));
        const keptEvictable = evictableMessages.slice(0, -removeCount);

        // Recombine: critical (always kept) + surviving evictable
        this.mailbox[peerId] = [...criticalMessages, ...keptEvictable];

        logger.debug(`Evicted ${removeCount} messages from mailbox for ${peerId} (${criticalMessages.length} critical protected)`);
    }

    // ===========================================================================
    // DESTROY / CLEANUP
    // ===========================================================================

    /**
     * Save all state, clear in-memory data, and mark as uninitialized.
     * Must be called on logout / shutdown to prevent stale data.
     */
    async destroy(): Promise<void> {
        if (!this.isInitialized) return;

        try {
            // Persist current state before clearing
            await Promise.all([
                this.saveMailbox(),
                this.savePendingACKs(),
                this.saveDeliveredIds(),
            ]);
        } catch (error) {
            logger.error('Failed to save state during destroy', error);
        }

        // Clear in-memory data
        this.mailbox = {};
        this.pendingACKs.clear();
        this.deliveredIds.clear();
        this.deliveredTimestamps.clear();
        this.messageDeliveredCallbacks = [];
        this.ackReceivedCallbacks = [];
        this.myDeviceId = '';
        this.currentUid = '';
        this.isInitialized = false;

        logger.info('Store & Forward Service destroyed');
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
        this.deliveredTimestamps.clear();

        await Promise.all([
            DirectStorage.delete(this.getScopedKey(STORAGE_KEY_MAILBOX)),
            DirectStorage.delete(this.getScopedKey(STORAGE_KEY_PENDING_ACKS)),
            DirectStorage.delete(this.getScopedKey(STORAGE_KEY_DELIVERED)),
        ]);

        logger.info('Store & Forward data cleared');
    }
}

export const meshStoreForwardService = new MeshStoreForwardService();
export default meshStoreForwardService;
