/**
 * MESH MESSAGE BRIDGE - ELITE V4
 * Bridges mesh messages with online messageStore
 * 
 * FEATURES:
 * - Bidirectional sync (mesh <-> cloud)
 * - Message source tracking
 * - Deduplication
 * - Automatic channel selection
 * - Unified message history
 */

import { createLogger } from '../../utils/logger';
import { useMeshStore, MeshMessage } from './MeshStore';
import { useMessageStore, Message } from '../../stores/messageStore';
import { LRUSet } from '../../utils/LRUCache';
// NOTE: NetInfo import removed — now using ConnectionManager.isOnline for consistency
import { DirectStorage } from '../../utils/storage';
import { getDeviceId } from '../../utils/device';
import { identityService } from '../IdentityService';

const logger = createLogger('MeshMessageBridge');

// ============================================================================
// TYPES
// ============================================================================

export type MessageSource = 'CLOUD' | 'MESH' | 'HYBRID';

export interface BridgedMessage {
    id: string;
    localId?: string;
    cloudId?: string;
    meshId?: string;
    source: MessageSource;
    content: string;
    senderId: string;
    senderName?: string;
    recipientId?: string;
    timestamp: number;
    syncedToCloud: boolean;
    syncedToMesh: boolean;
    deliveryConfirmed: boolean;
    type: 'text' | 'sos' | 'status' | 'location' | 'image' | 'voice';
    // Media fields — populated from mesh/cloud messages
    mediaUrl?: string;
    mediaType?: 'image' | 'voice' | 'location';
    mediaDuration?: number;
    location?: { lat: number; lng: number; address?: string };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const BRIDGE_CONFIG = {
    STORAGE_KEY_PREFIX: '@mesh_bridge_seen_ids', // User-scoped at runtime
    PENDING_SYNC_KEY_PREFIX: '@mesh_bridge_pending_sync', // User-scoped at runtime
    MAX_SEEN_IDS: 5000,
    SYNC_DEBOUNCE_MS: 1000,
    RETRY_DELAY_MS: 5000,
    MAX_RETRIES: 15,
    RETRY_BASE_DELAY_MS: 2000,
};

// ============================================================================
// MESH MESSAGE BRIDGE CLASS
// ============================================================================

class MeshMessageBridge {
    private isInitialized = false;
    private myDeviceId = '';
    private currentUid = ''; // CRITICAL FIX: User-scoped storage to prevent cross-account data leak
    private seenMessageIds: LRUSet<string>;
    private pendingCloudSync: Map<string, BridgedMessage> = new Map();
    private pendingMeshSync: Map<string, BridgedMessage> = new Map();
    private syncTimer: NodeJS.Timeout | null = null;
    private meshUnsubscribe: (() => void) | null = null;
    private isSyncing = false;
    private syncRetryCount: Map<string, number> = new Map();

    constructor() {
        this.seenMessageIds = new LRUSet<string>(BRIDGE_CONFIG.MAX_SEEN_IDS);
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            this.myDeviceId = await getDeviceId();

            // Retry once if device ID is empty
            if (!this.myDeviceId) {
                logger.warn('Device ID empty on first attempt, retrying...');
                await new Promise(r => setTimeout(r, 500));
                this.myDeviceId = await getDeviceId();
            }

            if (!this.myDeviceId) {
                logger.warn('Device ID could not be resolved - own-message deduplication will be unreliable');
            }

            // CRITICAL FIX: Resolve UID for user-scoped storage keys.
            // Without this, account switch causes cross-account data leak (seen IDs + pending sync).
            try {
                const { identityService } = require('../IdentityService');
                this.currentUid = identityService.getUid() || '';
                if (!this.currentUid) {
                    const { getFirebaseAuth } = require('../../../lib/firebase');
                    this.currentUid = getFirebaseAuth()?.currentUser?.uid || '';
                }
            } catch { /* fallback to empty = unscoped */ }

            await this.loadSeenIds();
            await this.loadPendingSyncQueues();

            // Subscribe to mesh messages
            this.subscribeToMesh();

            // Subscribe to cloud messages
            this.subscribeToCloud();

            // Start sync loop
            this.startSyncLoop();

            this.isInitialized = true;
            logger.info(`Mesh Message Bridge initialized (deviceId=${this.myDeviceId ? 'OK' : 'EMPTY'})`);
        } catch (error) {
            logger.error('Failed to initialize bridge:', error);
        }
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.isInitialized = false;

        if (this.meshUnsubscribe) {
            this.meshUnsubscribe();
            this.meshUnsubscribe = null;
        }

        if (this.cloudUnsubscribe) {
            this.cloudUnsubscribe();
            this.cloudUnsubscribe = null;
        }

        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }

        // Save pending queues before clearing so they survive restart
        this.savePendingSyncQueues();
        this.pendingCloudSync.clear();
        this.pendingMeshSync.clear();
        this.syncRetryCount.clear();
        // CRITICAL FIX: Clear dedup set on logout to prevent cross-account message drops.
        // Without this, a different user's incoming mesh messages with the same IDs
        // as messages seen by the previous account would be silently dropped.
        this.seenMessageIds.clear();
    }

    // ============================================================================
    // MESH SUBSCRIPTION
    // ============================================================================

    private subscribeToMesh(): void {
        const { meshNetworkService } = require('./index');

        this.meshUnsubscribe = meshNetworkService.onMessage((message: MeshMessage) => {
            this.handleMeshMessage(message);
        });
    }

    private async handleMeshMessage(message: MeshMessage): Promise<void> {
        // Deduplication - checkAndAdd returns true if ID was NEW (added), false if duplicate
        // We should skip if it's a duplicate (returns false means it already existed)
        if (!this.seenMessageIds.checkAndAdd(message.id)) {
            return;
        }

        // Skip own messages — check all identity variants since myDeviceId may be
        // AFN-xxx (pre-auth) while mesh senderId is the Firebase UID
        // CRITICAL FIX: Check UID FIRST (most common case in authenticated sessions)
        // before falling back to hardware deviceId check.
        try {
            const { identityService } = require('../IdentityService');
            const uid = identityService.getUid();
            if (uid && message.senderId === uid) return;
        } catch { /* IdentityService not yet available */ }
        if (message.senderId === 'ME' || message.senderId === this.myDeviceId) {
            return;
        }

        // Create bridged message
        // FIX: Set recipientId to local user UID so syncToCloud creates
        // the correct DM conversation (sender ↔ local user), not 'mesh_broadcast'.
        let localUid: string | undefined;
        try {
            const { identityService: idSvc } = require('../IdentityService');
            localUid = idSvc.getUid() || undefined;
        } catch { /* not yet available */ }

        const bridged: BridgedMessage = {
            id: `bridge_${message.id}`,
            meshId: message.id,
            source: 'MESH',
            content: message.content,
            senderId: message.senderId,
            senderName: message.senderName,
            recipientId: localUid || this.myDeviceId, // CRITICAL: local user is the recipient
            timestamp: message.timestamp,
            syncedToCloud: false,
            syncedToMesh: true,
            deliveryConfirmed: message.status === 'delivered',
            type: this.mapMessageType(message.type),
            // FIX: Carry media fields from mesh message so messageStore copy includes them.
            // Without this, images/voice received via BLE mesh show as empty text in messageStore.
            ...(message.mediaUrl ? { mediaUrl: message.mediaUrl } : {}),
            ...(message.mediaType ? { mediaType: message.mediaType as 'image' | 'voice' | 'location' } : {}),
            ...(typeof message.mediaDuration === 'number' ? { mediaDuration: message.mediaDuration } : {}),
            ...(message.location ? { location: message.location } : {}),
        };

        // Add to cloud message store for unified display
        this.addToCloudStore(bridged);

        // Always queue for cloud sync — processPendingSync will handle online/offline.
        // Without this, mesh messages received while offline are never synced to cloud
        // and would be lost on app reinstall or invisible on other devices.
        this.pendingCloudSync.set(bridged.id, bridged);
        this.savePendingSyncQueues();

        logger.debug(`Bridged mesh message: ${message.id}`);
    }

    private cloudUnsubscribe: (() => void) | null = null;

    // ============================================================================
    // CLOUD SUBSCRIPTION
    // ============================================================================

    private subscribeToCloud(): void {
        // Subscribe to messageStore changes and keep unsubscribe reference
        this.cloudUnsubscribe = useMessageStore.subscribe((state, prevState) => {
            // Skip if messages array reference hasn't changed (optimization)
            if (state.messages === prevState.messages) return;

            // Check for new messages using Set for O(n+m) instead of O(n*m)
            const prevIds = new Set(prevState.messages.map(m => m.id));
            const newMessages = state.messages.filter(msg => !prevIds.has(msg.id));

            newMessages.forEach(msg => {
                this.handleCloudMessage(msg);
            });
        });
    }

    private async handleCloudMessage(message: Message): Promise<void> {
        // Deduplication - checkAndAdd returns true if ID was NEW (added), false if duplicate
        // Skip if duplicate (returns false means it already existed)
        if (!this.seenMessageIds.checkAndAdd(message.id)) {
            return;
        }

        // Skip all own outgoing messages regardless of status — messageStore normalizes from to 'me' for self
        // Previously only checked status === 'sending', but sent/delivered messages also echo back
        const myUid = identityService.getUid();
        if (message.from === 'me' || message.from === this.myDeviceId || (myUid && message.from === myUid)) {
            return;
        }

        // FIX: Map cloud message type to bridge type instead of hardcoding 'text'.
        // Without this, SOS messages relayed from cloud to mesh lose their type and
        // are broadcast as TEXT instead of SOS — bypassing SOS handlers on mesh receivers.
        const bridgedType = this.mapMessageType(message.type || 'CHAT');

        // Create bridged message
        const bridged: BridgedMessage = {
            id: `bridge_${message.id}`,
            cloudId: message.id,
            source: 'CLOUD',
            content: message.content,
            senderId: message.from,
            recipientId: message.to,
            timestamp: message.timestamp,
            syncedToCloud: true,
            syncedToMesh: false,
            deliveryConfirmed: message.status === 'delivered',
            type: bridgedType,
        };

        // Queue for mesh broadcast if it's a broadcast message
        if (message.to === 'broadcast' || message.to === 'emergency_broadcast') {
            this.pendingMeshSync.set(bridged.id, bridged);
        }

        logger.debug(`Bridged cloud message: ${message.id}`);
    }

    // ============================================================================
    // SYNC OPERATIONS
    // ============================================================================

    private startSyncLoop(): void {
        this.syncTimer = setInterval(() => {
            this.processPendingSync();
        }, BRIDGE_CONFIG.SYNC_DEBOUNCE_MS);
    }

    private async processPendingSync(): Promise<void> {
        // Concurrency guard: prevent overlapping sync cycles
        if (this.isSyncing) return;
        this.isSyncing = true;

        // Track whether any actual sync work was done to avoid unnecessary MMKV writes.
        // Without this flag, saveSeenIds() + savePendingSyncQueues() fire every 1 second
        // even when both queues are empty — continuous MMKV I/O with no benefit.
        let didWork = false;

        try {
            // Sync mesh messages to cloud
            if (this.pendingCloudSync.size > 0 && await this.isOnline()) {
                const toSync = Array.from(this.pendingCloudSync.values());

                for (const msg of toSync) {
                    if (!this.isInitialized) break; // Stop if destroyed mid-sync
                    if (!this.isOnline()) break; // Re-check connectivity per message to avoid wasting retries

                    // EXPONENTIAL BACKOFF: Skip this message if not enough time has passed
                    const retries = this.syncRetryCount.get(msg.id) || 0;
                    if (retries > 0) {
                        const backoffMs = Math.min(
                            BRIDGE_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, retries - 1),
                            60_000 // Max 60s backoff
                        );
                        const lastAttempt = (msg as any)._lastAttemptAt || 0;
                        if (Date.now() - lastAttempt < backoffMs) continue; // Not yet time to retry
                    }

                    try {
                        await this.syncToCloud(msg);
                        this.pendingCloudSync.delete(msg.id);
                        this.syncRetryCount.delete(msg.id);
                        didWork = true;
                    } catch (error) {
                        const newRetries = retries + 1;
                        this.syncRetryCount.set(msg.id, newRetries);
                        (msg as any)._lastAttemptAt = Date.now();
                        didWork = true;
                        if (newRetries >= BRIDGE_CONFIG.MAX_RETRIES) {
                            logger.warn(`Cloud sync exhausted ${BRIDGE_CONFIG.MAX_RETRIES} retries, dropping: ${msg.id}`);
                            this.pendingCloudSync.delete(msg.id);
                            this.syncRetryCount.delete(msg.id);
                        } else {
                            logger.debug(`Failed to sync to cloud (attempt ${newRetries}/${BRIDGE_CONFIG.MAX_RETRIES}): ${msg.id}`);
                        }
                    }
                }
            }

            // Sync cloud messages to mesh
            if (this.pendingMeshSync.size > 0) {
                const toSync = Array.from(this.pendingMeshSync.values());

                for (const msg of toSync) {
                    if (!this.isInitialized) break;

                    // EXPONENTIAL BACKOFF: Skip this message if not enough time has passed
                    const retries = this.syncRetryCount.get(msg.id) || 0;
                    if (retries > 0) {
                        const backoffMs = Math.min(
                            BRIDGE_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, retries - 1),
                            60_000
                        );
                        const lastAttempt = (msg as any)._lastAttemptAt || 0;
                        if (Date.now() - lastAttempt < backoffMs) continue;
                    }

                    try {
                        await this.syncToMesh(msg);
                        this.pendingMeshSync.delete(msg.id);
                        this.syncRetryCount.delete(msg.id);
                        didWork = true;
                    } catch (error) {
                        const newRetries = retries + 1;
                        this.syncRetryCount.set(msg.id, newRetries);
                        (msg as any)._lastAttemptAt = Date.now();
                        didWork = true;
                        if (newRetries >= BRIDGE_CONFIG.MAX_RETRIES) {
                            logger.warn(`Mesh sync exhausted ${BRIDGE_CONFIG.MAX_RETRIES} retries, dropping: ${msg.id}`);
                            this.pendingMeshSync.delete(msg.id);
                            this.syncRetryCount.delete(msg.id);
                        } else {
                            logger.debug(`Failed to sync to mesh (attempt ${newRetries}/${BRIDGE_CONFIG.MAX_RETRIES}): ${msg.id}`);
                        }
                    }
                }
            }

            // Prune orphaned retry counts (prevents unbounded Map growth)
            for (const key of this.syncRetryCount.keys()) {
                if (!this.pendingCloudSync.has(key) && !this.pendingMeshSync.has(key)) {
                    this.syncRetryCount.delete(key);
                }
            }

            // Only persist when actual work was done — avoids continuous MMKV writes every 1s
            if (didWork) {
                await this.saveSeenIds();
                this.savePendingSyncQueues();
            }
        } finally {
            this.isSyncing = false;
        }
    }

    private async syncToCloud(message: BridgedMessage): Promise<void> {
        try {
            const { firebaseDataService } = await import('../FirebaseDataService');
            const { identityService } = await import('../IdentityService');

            try {
                await firebaseDataService.initialize();
            } catch { /* best effort */ }

            // FIX: For mesh-received DMs, the local user is the recipient.
            // toDeviceId must be the local user's UID so the facade creates
            // a correct DM conversation (sender ↔ localUser), not 'mesh_broadcast'
            // which would fall to a dead-end legacy Firestore path.
            const uid = identityService.getUid() || this.myDeviceId;

            // For messages WE received via mesh, recipient = us
            // For messages WE sent to mesh (source=CLOUD), recipient = message.recipientId
            const isIncoming = message.source === 'MESH';
            const effectiveRecipient = isIncoming ? uid : (message.recipientId || uid);

            await firebaseDataService.saveMessage(uid, {
                id: message.meshId || message.id,
                senderUid: message.senderId,
                senderName: message.senderName || '',
                toDeviceId: effectiveRecipient,
                content: message.content,
                timestamp: message.timestamp,
                // FIX: Preserve actual message type instead of collapsing to 'text'.
                // Without this, image/voice/location messages synced from mesh→cloud
                // lose their type and render as empty text messages.
                type: message.type === 'sos' ? 'sos' : message.type === 'voice' ? 'voice' : message.type === 'image' ? 'image' : message.type === 'location' ? 'location' : 'text',
                schemaVersion: 3,
                metadata: {
                    source: 'mesh_bridge',
                    senderName: message.senderName || '',
                },
                // FIX: Include media fields so cloud copy has full message data.
                // Without this, images/voice received via BLE mesh are synced to
                // Firestore as empty text — invisible on other devices.
                ...(message.mediaUrl ? { mediaUrl: message.mediaUrl } : {}),
                ...(message.mediaType ? { mediaType: message.mediaType } : {}),
                ...(typeof message.mediaDuration === 'number' ? { mediaDuration: message.mediaDuration } : {}),
                ...(message.location ? { location: message.location } : {}),
            });

            message.syncedToCloud = true;
            logger.debug(`Synced to cloud: ${message.id}`);
        } catch (error) {
            throw error;
        }
    }

    private async syncToMesh(message: BridgedMessage): Promise<void> {
        try {
            const { meshNetworkService } = await import('./index');
            const { MeshMessageType } = await import('./MeshProtocol');

            // FIX: Map all bridge types to MeshMessageType, not just SOS vs TEXT.
            // Without this, location/voice messages relayed cloud→mesh lose their type.
            const meshType = message.type === 'sos' ? MeshMessageType.SOS
                : message.type === 'location' ? MeshMessageType.LOCATION
                : MeshMessageType.TEXT; // text/image/voice all use TEXT envelope (media in payload)
            await meshNetworkService.broadcastMessage(message.content, meshType);

            message.syncedToMesh = true;
            logger.debug(`Synced to mesh: ${message.id}`);
        } catch (error) {
            throw error;
        }
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    private addToCloudStore(message: BridgedMessage): void {
        // FIX: Use recipientId (local user UID) for 'to' field so the message
        // appears in the correct DM conversation, not under 'broadcast'.
        const msgId = message.meshId || message.id;

        // FIX: Prevent status regression — use shared state machine guard
        const { isStatusTransitionAllowed } = require('../messaging/constants');
        const existingMsg = useMessageStore.getState().messages.find(m => m.id === msgId);
        const currentStatus = existingMsg?.status;
        const newStatus = message.deliveryConfirmed ? 'delivered' : 'sent';
        const finalStatus = currentStatus && !isStatusTransitionAllowed(currentStatus, newStatus)
            ? currentStatus
            : newStatus;

        const cloudMessage: Partial<Message> = {
            id: msgId,
            from: message.senderId,
            fromName: message.senderName,
            to: message.recipientId || this.currentUid || 'broadcast',
            content: message.content,
            timestamp: message.timestamp,
            type: this.mapMeshTypeToCloudType(message.type),
            status: finalStatus as Message['status'],
            delivered: finalStatus === 'delivered' || finalStatus === 'read',
            read: finalStatus === 'read',
            // FIX: Include media fields so messageStore has full message data for rendering
            ...(message.mediaUrl ? { mediaUrl: message.mediaUrl } : {}),
            ...(message.mediaType ? { mediaType: message.mediaType } : {}),
            ...(typeof message.mediaDuration === 'number' ? { mediaDuration: message.mediaDuration } : {}),
            ...(message.location ? { location: message.location } : {}),
        };

        // Add to message store
        useMessageStore.getState().addMessage(cloudMessage as Message);
    }

    private mapMeshTypeToCloudType(type: BridgedMessage['type']): Message['type'] {
        switch (type) {
            case 'sos':
                return 'SOS';
            case 'status':
                return 'STATUS';
            case 'location':
                return 'LOCATION';
            case 'voice':
                return 'VOICE';
            case 'image':
                return 'CHAT'; // Images use type=CHAT + mediaType=image for rendering
            default:
                return 'CHAT';
        }
    }

    private mapMessageType(meshType: string): BridgedMessage['type'] {
        switch (meshType.toUpperCase()) {
            case 'SOS':
                return 'sos';
            case 'STATUS':
                return 'status';
            case 'LOCATION':
                return 'location';
            case 'IMAGE':
                return 'image';
            case 'VOICE':
                return 'voice';
            default:
                return 'text';
        }
    }

    private isOnline(): boolean {
        // CRITICAL FIX: Use ConnectionManager for consistency.
        // Previous code used raw NetInfo.fetch() which only checked isConnected,
        // missing isInternetReachable. WiFi connected but no internet → false "online"
        // → mesh messages routed incorrectly to cloud (which fails silently).
        try {
            const { connectionManager } = require('../ConnectionManager');
            return connectionManager.isOnline;
        } catch {
            return false;
        }
    }

    private getScopedKey(prefix: string): string {
        return this.currentUid ? `${prefix}_${this.currentUid}` : prefix;
    }

    private async loadSeenIds(): Promise<void> {
        try {
            const key = this.getScopedKey(BRIDGE_CONFIG.STORAGE_KEY_PREFIX);
            const data = DirectStorage.getString(key);
            if (data) {
                this.seenMessageIds.fromArray(JSON.parse(data));
            }
        } catch (error) {
            logger.debug('Failed to load seen IDs:', error);
        }
    }

    private async saveSeenIds(): Promise<void> {
        try {
            const key = this.getScopedKey(BRIDGE_CONFIG.STORAGE_KEY_PREFIX);
            DirectStorage.setString(key, JSON.stringify(this.seenMessageIds.toArray()));
        } catch (error) {
            logger.debug('Failed to save seen IDs:', error);
        }
    }

    // CRITICAL FIX: Persist pending sync queues to MMKV so mesh-received messages
    // survive app crash/kill and sync to cloud on next launch.
    // Without this, messages received via BLE mesh are only in local messageStore
    // but NEVER reach Firestore → invisible on other devices.
    private async loadPendingSyncQueues(): Promise<void> {
        try {
            const key = this.getScopedKey(BRIDGE_CONFIG.PENDING_SYNC_KEY_PREFIX);
            const data = DirectStorage.getString(key);
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.cloud && Array.isArray(parsed.cloud)) {
                    for (const msg of parsed.cloud) {
                        this.pendingCloudSync.set(msg.id, msg);
                    }
                }
                if (parsed.mesh && Array.isArray(parsed.mesh)) {
                    for (const msg of parsed.mesh) {
                        this.pendingMeshSync.set(msg.id, msg);
                    }
                }
                logger.info(`Loaded pending sync: ${this.pendingCloudSync.size} cloud, ${this.pendingMeshSync.size} mesh`);
            }
        } catch (error) {
            logger.debug('Failed to load pending sync queues:', error);
        }
    }

    private savePendingSyncQueues(): void {
        try {
            const key = this.getScopedKey(BRIDGE_CONFIG.PENDING_SYNC_KEY_PREFIX);
            const data = JSON.stringify({
                cloud: Array.from(this.pendingCloudSync.values()),
                mesh: Array.from(this.pendingMeshSync.values()),
            });
            DirectStorage.setString(key, data);
        } catch (error) {
            logger.debug('Failed to save pending sync queues:', error);
        }
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    /**
     * Send a message through the best available channel
     */
    async sendMessage(
        content: string,
        recipientId?: string,
        options: {
            type?: BridgedMessage['type'];
            priority?: 'critical' | 'high' | 'normal';
        } = {}
    ): Promise<string> {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const isOnline = this.isOnline();

        const bridged: BridgedMessage = {
            id: messageId,
            source: isOnline ? 'HYBRID' : 'MESH',
            content,
            senderId: this.myDeviceId,
            recipientId,
            timestamp: Date.now(),
            syncedToCloud: false,
            syncedToMesh: false,
            deliveryConfirmed: false,
            type: options.type || 'text',
        };

        // Always send via mesh for guaranteed delivery
        try {
            await this.syncToMesh(bridged);
        } catch (error) {
            logger.warn('Mesh send failed:', error);
        }

        // Send via cloud if online
        if (isOnline) {
            try {
                await this.syncToCloud(bridged);
            } catch (error) {
                logger.warn('Cloud send failed:', error);
            }
        } else {
            // Queue for later cloud sync
            this.pendingCloudSync.set(messageId, bridged);
        }

        this.seenMessageIds.checkAndAdd(messageId);

        return messageId;
    }

    /**
     * Get connection status
     */
    async getConnectionStatus(): Promise<'online' | 'mesh' | 'offline'> {
        const isOnline = this.isOnline();
        if (isOnline) return 'online';

        const meshPeers = useMeshStore.getState().peers.length;
        if (meshPeers > 0) return 'mesh';

        return 'offline';
    }

    /**
     * Get pending sync count
     */
    getPendingSyncCount(): { cloud: number; mesh: number } {
        return {
            cloud: this.pendingCloudSync.size,
            mesh: this.pendingMeshSync.size,
        };
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const meshMessageBridge = new MeshMessageBridge();
export default meshMessageBridge;
