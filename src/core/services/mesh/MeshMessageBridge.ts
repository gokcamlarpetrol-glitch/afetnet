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
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId } from '../../utils/device';

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
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const BRIDGE_CONFIG = {
    STORAGE_KEY: '@mesh_bridge_seen_ids',
    MAX_SEEN_IDS: 5000,
    SYNC_DEBOUNCE_MS: 1000,
    RETRY_DELAY_MS: 5000,
    MAX_RETRIES: 3,
};

// ============================================================================
// MESH MESSAGE BRIDGE CLASS
// ============================================================================

class MeshMessageBridge {
    private isInitialized = false;
    private myDeviceId = '';
    private seenMessageIds: LRUSet<string>;
    private pendingCloudSync: Map<string, BridgedMessage> = new Map();
    private pendingMeshSync: Map<string, BridgedMessage> = new Map();
    private syncTimer: NodeJS.Timeout | null = null;
    private meshUnsubscribe: (() => void) | null = null;

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
            await this.loadSeenIds();

            // Subscribe to mesh messages
            this.subscribeToMesh();

            // Subscribe to cloud messages
            this.subscribeToCloud();

            // Start sync loop
            this.startSyncLoop();

            this.isInitialized = true;
            logger.info('Mesh Message Bridge initialized');
        } catch (error) {
            logger.error('Failed to initialize bridge:', error);
        }
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.meshUnsubscribe) {
            this.meshUnsubscribe();
            this.meshUnsubscribe = null;
        }

        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }

        this.isInitialized = false;
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

        // Skip own messages
        if (message.senderId === 'ME' || message.senderId === this.myDeviceId) {
            return;
        }

        // Create bridged message
        const bridged: BridgedMessage = {
            id: `bridge_${message.id}`,
            meshId: message.id,
            source: 'MESH',
            content: message.content,
            senderId: message.senderId,
            senderName: message.senderName,
            timestamp: message.timestamp,
            syncedToCloud: false,
            syncedToMesh: true,
            deliveryConfirmed: message.status === 'delivered',
            type: this.mapMessageType(message.type),
        };

        // Add to cloud message store for unified display
        this.addToCloudStore(bridged);

        // Queue for cloud sync if online
        if (await this.isOnline()) {
            this.pendingCloudSync.set(bridged.id, bridged);
        }

        logger.debug(`Bridged mesh message: ${message.id}`);
    }

    // ============================================================================
    // CLOUD SUBSCRIPTION
    // ============================================================================

    private subscribeToCloud(): void {
        // Subscribe to messageStore changes
        useMessageStore.subscribe((state, prevState) => {
            // Check for new messages
            const newMessages = state.messages.filter(
                msg => !prevState.messages.find(p => p.id === msg.id)
            );

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

        // Skip own outgoing messages
        if (message.from === this.myDeviceId && message.status === 'sending') {
            return;
        }

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
            type: 'text',
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
        // Sync mesh messages to cloud
        if (this.pendingCloudSync.size > 0 && await this.isOnline()) {
            const toSync = Array.from(this.pendingCloudSync.values());

            for (const msg of toSync) {
                try {
                    await this.syncToCloud(msg);
                    this.pendingCloudSync.delete(msg.id);
                } catch (error) {
                    logger.debug(`Failed to sync to cloud: ${msg.id}`);
                }
            }
        }

        // Sync cloud messages to mesh
        if (this.pendingMeshSync.size > 0) {
            const toSync = Array.from(this.pendingMeshSync.values());

            for (const msg of toSync) {
                try {
                    await this.syncToMesh(msg);
                    this.pendingMeshSync.delete(msg.id);
                } catch (error) {
                    logger.debug(`Failed to sync to mesh: ${msg.id}`);
                }
            }
        }

        // ELITE: Persist seen IDs after sync to maintain deduplication state
        await this.saveSeenIds();
    }

    private async syncToCloud(message: BridgedMessage): Promise<void> {
        try {
            const { firebaseDataService } = await import('../FirebaseDataService');

            if (!firebaseDataService.isInitialized) {
                return;
            }

            await firebaseDataService.saveMessage(this.myDeviceId, {
                id: message.meshId || message.id,
                fromDeviceId: message.senderId,
                toDeviceId: message.recipientId || 'mesh_broadcast',
                content: message.content,
                timestamp: message.timestamp,
                type: message.type === 'sos' ? 'sos' : 'text',
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

            await meshNetworkService.broadcastMessage(
                message.content,
                message.type === 'sos' ? MeshMessageType.SOS : MeshMessageType.TEXT
            );

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
        const cloudMessage: Partial<Message> = {
            id: message.meshId || message.id,
            from: message.senderId,
            fromName: message.senderName,
            to: message.recipientId || 'broadcast',
            content: message.content,
            timestamp: message.timestamp,
            type: this.mapMeshTypeToCloudType(message.type),
            status: message.deliveryConfirmed ? 'delivered' : 'sent',
            delivered: message.deliveryConfirmed,
            read: false,
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

    private async isOnline(): Promise<boolean> {
        try {
            const netInfo = await NetInfo.fetch();
            return netInfo.isConnected === true;
        } catch {
            return false;
        }
    }

    private async loadSeenIds(): Promise<void> {
        try {
            const data = await AsyncStorage.getItem(BRIDGE_CONFIG.STORAGE_KEY);
            if (data) {
                this.seenMessageIds.fromArray(JSON.parse(data));
            }
        } catch (error) {
            logger.debug('Failed to load seen IDs:', error);
        }
    }

    private async saveSeenIds(): Promise<void> {
        try {
            await AsyncStorage.setItem(
                BRIDGE_CONFIG.STORAGE_KEY,
                JSON.stringify(this.seenMessageIds.toArray())
            );
        } catch (error) {
            logger.debug('Failed to save seen IDs:', error);
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
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const isOnline = await this.isOnline();

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
        const isOnline = await this.isOnline();
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
