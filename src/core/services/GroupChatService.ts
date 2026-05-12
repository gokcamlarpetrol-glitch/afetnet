/**
 * GROUP CHAT SERVICE — ELITE PROFESSIONAL
 * Business logic layer for group conversations.
 * Coordinates between UI, Firestore, messageStore, and mesh network.
 *
 * Architecture:
 * - Groups stored in Firestore conversations/{id}
 * - Messages stored in conversations/{id}/messages/{id}
 * - Real-time sync via onSnapshot subscriptions
 * - Local state managed via Zustand (messageStore)
 * - Mesh broadcast for offline group members
 */

import NetInfo from '@react-native-community/netinfo';
import { onAuthStateChanged, type Unsubscribe as AuthUnsubscribe } from 'firebase/auth';
import { getFirebaseAuth } from '../../lib/firebase';
import { createLogger } from '../utils/logger';
import { validateMessage, sanitizeMessage } from '../utils/messageSanitizer';
import { isLikelyFirebaseUid } from '../utils/messaging/identityUtils';
import meshNetworkService from './mesh/MeshNetworkService';
import { MeshMessageType } from './mesh/MeshProtocol';

import {
    createGroupConversation,
    getGroupConversation,
    updateGroupConversation,
    addGroupMember,
    removeGroupMember,
    sendGroupMessage as firebaseSendGroupMessage,
    loadGroupMessages,
    subscribeToGroupMessages,
    markGroupMessageRead,
    markGroupMessagesReadBatch,
    subscribeToMyGroupConversations,
    type GroupConversation,
    type GroupMessage,
} from './firebase/FirebaseGroupOperations';
import type { MeshMessage } from './mesh/MeshStore';

const logger = createLogger('GroupChatService');

// Re-export types for consumers
export type { GroupConversation, GroupMessage };

/** Pending group message for durable retry across app restarts */
interface PendingGroupMessage {
    groupId: string;
    message: GroupMessage;
    attempt: number;
    nextRetryAt: number;
}

class GroupChatService {
    private activeSubscriptions = new Map<string, () => void>();
    private groupListSubscription: (() => void) | null = null;
    private authUnsubscribe: AuthUnsubscribe | null = null;
    private groups: GroupConversation[] = [];
    private groupUnreadCounts = new Map<string, number>();
    private onGroupsChangedCallbacks: Array<(groups: GroupConversation[]) => void> = [];
    private subscriptionRetryCount = 0;
    private subscriptionRetryTimer: NodeJS.Timeout | null = null;
    private retryTimers: Set<NodeJS.Timeout> = new Set();
    private isDestroyed = false;
    private static readonly MAX_SUBSCRIPTION_RETRIES = 15;
    // DURABLE GROUP OUTBOX: Persisted to MMKV so messages survive app kill during retry
    private pendingGroupMessages: PendingGroupMessage[] = [];

    private toMeshMessage(groupId: string, message: GroupMessage): MeshMessage | null {
        if (!message || message.type === 'SYSTEM') return null;

        const senderId = (message.senderUid || message.from || '').trim();
        if (!senderId) return null;

        const typeMap: Record<GroupMessage['type'], MeshMessage['type']> = {
            CHAT: 'CHAT',
            SOS: 'SOS',
            LOCATION: 'LOCATION',
            VOICE: 'VOICE',
            IMAGE: 'IMAGE',
            SYSTEM: 'STATUS',
        };

        const meshType = typeMap[message.type] || 'CHAT';
        const status: MeshMessage['status'] =
            message.status === 'read' ? 'read' :
                message.status === 'delivered' ? 'delivered' : 'sent';
        const ackIds = message.readBy ? Object.keys(message.readBy) : [];

        return {
            id: message.id,
            senderId,
            senderName: message.fromName,
            to: `group:${groupId}`,
            type: meshType,
            content: message.content || '',
            timestamp: message.timestamp || Date.now(),
            ttl: 8,
            priority: message.type === 'SOS' ? 'critical' : 'normal',
            status,
            acks: ackIds,
            retryCount: 0,
            hops: 0,
            delivered: status === 'delivered' || status === 'read',
            ...(message.mediaUrl ? { mediaUrl: message.mediaUrl } : {}),
            ...(message.mediaType ? { mediaType: message.mediaType } : {}),
            ...(typeof message.mediaDuration === 'number' ? { mediaDuration: message.mediaDuration } : {}),
            ...(message.mediaThumbnail ? { mediaThumbnail: message.mediaThumbnail } : {}),
            ...(message.location ? { location: message.location } : {}),
            ...(message.replyTo ? { replyTo: message.replyTo } : {}),
            ...(message.replyPreview ? { replyPreview: message.replyPreview } : {}),
        };
    }

    private syncMessagesToMeshStore(groupId: string, messages: GroupMessage[]): void {
        if (!Array.isArray(messages) || messages.length === 0) return;
        try {
            const { useMeshStore } = require('./mesh/MeshStore');
            const meshState = useMeshStore.getState();
            if (!meshState || typeof meshState.addMessage !== 'function') return;

            for (const message of messages) {
                const meshMessage = this.toMeshMessage(groupId, message);
                if (!meshMessage) continue;

                meshState.addMessage(meshMessage);

                if (typeof meshState.updateMessage === 'function') {
                    meshState.updateMessage(meshMessage.id, {
                        status: meshMessage.status,
                        delivered: meshMessage.delivered,
                        acks: meshMessage.acks,
                    });
                }
            }
        } catch (error) {
            logger.debug('GroupChatService MeshStore sync skipped:', error);
        }
    }

    private isRenderableGroup(group: Partial<GroupConversation> | null | undefined): group is GroupConversation {
        if (!group || typeof group !== 'object') return false;
        const participants = Array.isArray(group.participants) ? group.participants : [];
        if (participants.length < 2) return false;
        const type = group.type === 'group';
        const id = typeof group.id === 'string' ? group.id : '';
        return type || id.startsWith('grp_');
    }

    private getCurrentUserSafe() {
        try {
            return getFirebaseAuth()?.currentUser ?? null;
        } catch (error) {
            logger.warn('Firebase auth unavailable in GroupChatService', error);
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────
    // Durable Group Outbox (MMKV persistence)
    // ─────────────────────────────────────────────────────────

    private getPendingMessagesStorageKey(): string {
        const uid = this.getCurrentUserSafe()?.uid;
        return uid ? `@afetnet:group_pending_msgs:${uid}` : '@afetnet:group_pending_msgs';
    }

    private loadPendingGroupMessages(): void {
        try {
            const { DirectStorage } = require('../utils/storage');
            const data = DirectStorage.getString(this.getPendingMessagesStorageKey());
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    this.pendingGroupMessages = parsed;
                    if (this.pendingGroupMessages.length > 0) {
                        logger.info(`Loaded ${this.pendingGroupMessages.length} pending group messages from outbox`);
                    }
                }
            }
        } catch (error) {
            logger.warn('Failed to load pending group messages:', error);
        }
    }

    private savePendingGroupMessages(): void {
        try {
            const { DirectStorage } = require('../utils/storage');
            DirectStorage.setString(
                this.getPendingMessagesStorageKey(),
                JSON.stringify(this.pendingGroupMessages),
            );
        } catch (error) {
            logger.error('Failed to save pending group messages:', error);
        }
    }

    /**
     * Process any pending group messages from the persisted outbox.
     * Called on initialize and on connectivity restoration.
     */
    private async processPendingGroupMessages(): Promise<void> {
        if (this.isDestroyed || this.pendingGroupMessages.length === 0) return;

        const now = Date.now();
        const stillPending: PendingGroupMessage[] = [];

        for (const entry of this.pendingGroupMessages) {
            if (this.isDestroyed) break;
            if (now < entry.nextRetryAt) {
                stillPending.push(entry);
                continue;
            }

            try {
                const netState = await NetInfo.fetch();
                if (!netState.isConnected || netState.isInternetReachable === false) {
                    // Offline — reschedule with backoff but don't count against retry limit
                    entry.nextRetryAt = now + Math.min(2000 * Math.pow(2, entry.attempt), 60000);
                    stillPending.push(entry);
                    continue;
                }

                const ok = await firebaseSendGroupMessage(entry.groupId, entry.message).catch(() => false);
                if (ok) {
                    logger.info(`Pending group message ${entry.message.id} retry succeeded`);
                    try {
                        const { useMeshStore } = require('./mesh/MeshStore');
                        useMeshStore.getState().updateMessage?.(entry.message.id, { status: 'sent' });
                    } catch { /* best-effort */ }
                } else {
                    entry.attempt++;
                    if (entry.attempt > 10) {
                        logger.error(`Group message ${entry.message.id} failed after 10 retries — dropped`);
                        try {
                            const { useMeshStore } = require('./mesh/MeshStore');
                            useMeshStore.getState().updateMessage?.(entry.message.id, { status: 'failed' });
                        } catch { /* best-effort */ }
                    } else {
                        entry.nextRetryAt = now + Math.min(2000 * Math.pow(2, entry.attempt - 1), 30000);
                        stillPending.push(entry);
                    }
                }
            } catch (error) {
                entry.attempt++;
                entry.nextRetryAt = now + Math.min(2000 * Math.pow(2, entry.attempt - 1), 30000);
                stillPending.push(entry);
            }
        }

        this.pendingGroupMessages = stillPending;
        this.savePendingGroupMessages();
    }

    private getGroupsStorageKey(): string {
        const uid = this.getCurrentUserSafe()?.uid;
        return uid ? `@afetnet:groups:${uid}` : '@afetnet:groups';
    }

    private loadGroups(): void {
        try {
            const { DirectStorage } = require('../utils/storage');
            const data = DirectStorage.getString(this.getGroupsStorageKey());
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    this.groups = parsed.filter((group) => this.isRenderableGroup(group));
                    logger.info(`Loaded ${this.groups.length} groups from local storage`);
                }
            }
        } catch (error) {
            logger.warn('Failed to load groups from local storage:', error);
        }
    }

    private saveGroups(): void {
        try {
            const { DirectStorage } = require('../utils/storage');
            DirectStorage.setString(this.getGroupsStorageKey(), JSON.stringify(this.groups));
        } catch (error) {
            logger.error('Failed to save groups locally:', error);
        }
    }

    // ─────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────

    /**
     * Initialize: subscribe to user's group conversations.
     * CRITICAL FIX: If auth is not ready yet, install an onAuthStateChanged
     * listener that will start the subscription once auth becomes available.
     */
    initialize(): void {
        if (this.groupListSubscription) return;

        // CRITICAL FIX: Reset isDestroyed on re-init (singleton reuse after destroy)
        this.isDestroyed = false;

        // Cache auth check — getCurrentUserSafe() must be called once to avoid
        // consuming mock values and getting inconsistent auth state
        const user = this.getCurrentUserSafe();

        // ELITE: Load from local storage immediately for offline support
        this.loadGroups();
        // DURABLE: Load pending group messages from MMKV outbox and retry them
        this.loadPendingGroupMessages();
        if (this.pendingGroupMessages.length > 0) {
            this.processPendingGroupMessages().catch(e => {
                logger.warn('Failed to process pending group messages on init:', e);
            });
        }
        if (this.groups.length > 0) {
            [...this.onGroupsChangedCallbacks].forEach((cb) => cb(this.groups));
        }
        if (user?.uid) {
            this.startSubscription();
        } else {
            // CRITICAL FIX: Auth not ready yet — wait for it
            logger.warn('GroupChatService: auth not ready, installing onAuthStateChanged listener...');
            try {
                const auth = getFirebaseAuth();
                if (!auth) {
                    logger.error('GroupChatService: cannot install auth listener — getFirebaseAuth() returned null');
                    return;
                }
                this.authUnsubscribe = onAuthStateChanged(auth, (authUser) => {
                    if (authUser?.uid && !this.groupListSubscription) {
                        logger.info(`✅ GroupChatService: auth ready (uid=${authUser.uid}), starting subscription`);
                        this.startSubscription();
                        // Clean up auth listener — we only need it once
                        if (this.authUnsubscribe) {
                            this.authUnsubscribe();
                            this.authUnsubscribe = null;
                        }
                    }
                });
            } catch (error) {
                logger.error('GroupChatService: failed to install auth listener:', error);
            }
        }
    }

    /**
     * Internal: Start the Firestore group subscription.
     * CRITICAL FIX: Retry with exponential backoff when subscription dies.
     */
    private startSubscription(): void {
        if (this.groupListSubscription || this.isDestroyed) return;

        this.groupListSubscription = subscribeToMyGroupConversations(
            (groups) => {
                // Subscription alive — reset retry counter
                this.subscriptionRetryCount = 0;
                this.groups = groups.filter((group) => this.isRenderableGroup(group));
                this.saveGroups(); // ELITE: Persist updates
                [...this.onGroupsChangedCallbacks].forEach((cb) => cb(this.groups));
            },
            (error) => {
                logger.error('Group list subscription error:', error);
                // Reset ref so startSubscription() can re-run
                this.groupListSubscription = null;
                // Schedule retry with exponential backoff
                this.scheduleSubscriptionRetry('subscription error');
            },
        );

        logger.info('✅ GroupChatService initialized with Firestore subscription');
    }

    /**
     * Schedule a subscription retry with exponential backoff.
     */
    private scheduleSubscriptionRetry(reason: string): void {
        if (this.isDestroyed) return;
        if (this.subscriptionRetryCount >= GroupChatService.MAX_SUBSCRIPTION_RETRIES) {
            logger.error(`GroupChatService: exhausted ${GroupChatService.MAX_SUBSCRIPTION_RETRIES} retries (${reason})`);
            return;
        }
        if (this.subscriptionRetryTimer) {
            clearTimeout(this.subscriptionRetryTimer);
        }
        this.subscriptionRetryCount++;
        const delay = Math.min(2000 * Math.pow(2, this.subscriptionRetryCount - 1), 30000);
        logger.info(`GroupChatService: retry ${this.subscriptionRetryCount}/${GroupChatService.MAX_SUBSCRIPTION_RETRIES} in ${delay}ms (${reason})`);
        this.subscriptionRetryTimer = setTimeout(() => {
            this.subscriptionRetryTimer = null;
            if (!this.groupListSubscription) {
                this.startSubscription();
            }
        }, delay);
    }

    /**
     * Cleanup all subscriptions.
     */
    destroy(): void {
        this.isDestroyed = true;
        if (this.subscriptionRetryTimer) {
            clearTimeout(this.subscriptionRetryTimer);
            this.subscriptionRetryTimer = null;
        }

        if (this.authUnsubscribe) {
            this.authUnsubscribe();
            this.authUnsubscribe = null;
        }

        if (this.groupListSubscription) {
            this.groupListSubscription();
            this.groupListSubscription = null;
        }

        for (const [key, unsub] of this.activeSubscriptions) {
            unsub();
        }
        this.activeSubscriptions.clear();
        this.onGroupsChangedCallbacks = [];
        // Clean up retry timers
        for (const timer of this.retryTimers) {
            clearTimeout(timer);
        }
        this.retryTimers.clear();
        this.saveGroups(); // ELITE: Final save
        this.savePendingGroupMessages(); // DURABLE: Persist pending messages before shutdown
        this.groups = [];

        logger.info('GroupChatService destroyed');
    }

    // ─────────────────────────────────────────────────────────
    // Group Management
    // ─────────────────────────────────────────────────────────

    /**
     * Create a new group. Caller provides name and initial member UIDs.
     */
    async createGroup(
        name: string,
        memberUids: string[],
        memberNames: Record<string, string>,
        memberDeviceIds: Record<string, string>,
    ): Promise<string | null> {
        const myUid = this.getCurrentUserSafe()?.uid;
        if (!myUid) {
            logger.error('Cannot create group: not authenticated');
            return null;
        }

        const sanitizedName = sanitizeMessage(name.trim());
        if (!sanitizedName || sanitizedName.length < 1) {
            logger.error('Invalid group name');
            return null;
        }

        // Normalize recipients: only valid UIDs, never include self in member list.
        const normalizedMemberUids = Array.from(
            new Set(
                memberUids
                    .map((uid) => (typeof uid === 'string' ? uid.trim() : ''))
                    .filter((uid) => uid.length > 0 && uid !== myUid && isLikelyFirebaseUid(uid)),
            ),
        );

        // Prevent self-only/invalid groups (creator + at least one peer).
        if (normalizedMemberUids.length === 0) {
            logger.warn('Group creation aborted: at least one valid peer UID is required');
            return null;
        }

        // Always include creator
        const allParticipants = Array.from(new Set([myUid, ...normalizedMemberUids]));

        // Generate a stable group ID
        const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        let myDeviceId = memberDeviceIds[myUid] || '';
        if (!myDeviceId) {
            try {
                const { identityService } = require('./IdentityService');
                myDeviceId = identityService.getUid?.() || myUid;
            } catch {
                myDeviceId = myUid;
            }
        }

        const data: Omit<GroupConversation, 'createdAt' | 'updatedAt'> = {
            id: groupId,
            type: 'group',
            name: sanitizedName,
            participants: allParticipants,
            participantNames: {
                ...memberNames,
                [myUid]: memberNames[myUid] || 'Ben',
            },
            participantDeviceIds: {
                ...memberDeviceIds,
                [myUid]: memberDeviceIds[myUid] || myDeviceId,
            },
            createdBy: myUid,
        };

        const success = await createGroupConversation(data);
        if (!success) {
            logger.error('Failed to create group in Firestore');
            return null;
        }

        // Send system message announcing group creation
        await this.sendSystemMessage(groupId, `${data.participantNames[myUid]} grubu oluşturdu`);

        logger.info(`✅ Group created: ${sanitizedName} (${allParticipants.length} members)`);
        return groupId;
    }

    /**
     * Rename a group.
     */
    async renameGroup(groupId: string, newName: string): Promise<boolean> {
        const sanitized = sanitizeMessage(newName.trim());
        if (!sanitized) return false;

        const success = await updateGroupConversation(groupId, { name: sanitized });
        if (success) {
            await this.sendSystemMessage(groupId, `Grup adı "${sanitized}" olarak değiştirildi`);
        }
        return success;
    }

    /**
     * Add a member to a group.
     */
    async addMemberToGroup(
        groupId: string,
        memberUid: string,
        memberName: string,
        memberDeviceId: string,
    ): Promise<boolean> {
        const success = await addGroupMember(groupId, memberUid, memberName, memberDeviceId);
        if (success) {
            await this.sendSystemMessage(groupId, `${memberName} gruba eklendi`);
        }
        return success;
    }

    /**
     * Remove a member from a group.
     */
    async removeMemberFromGroup(
        groupId: string,
        memberUid: string,
        memberName: string,
    ): Promise<boolean> {
        const success = await removeGroupMember(groupId, memberUid);
        if (success) {
            await this.sendSystemMessage(groupId, `${memberName} gruptan çıkarıldı`);
        }
        return success;
    }

    /**
     * Leave a group.
     */
    async leaveGroup(groupId: string): Promise<boolean> {
        const myUid = this.getCurrentUserSafe()?.uid;
        if (!myUid) return false;

        // Send system message BEFORE removal — Firestore rules require participant membership
        await this.sendSystemMessage(groupId, 'Bir üye gruptan ayrıldı').catch(e => {
            if (__DEV__) logger.debug('GroupChat: leave system message failed:', e);
        });

        const success = await removeGroupMember(groupId, myUid);
        if (success) {
            // Unsubscribe from messages
            const unsub = this.activeSubscriptions.get(groupId);
            if (unsub) {
                unsub();
                this.activeSubscriptions.delete(groupId);
            }
        }
        return success;
    }

    // ─────────────────────────────────────────────────────────
    // Messaging
    // ─────────────────────────────────────────────────────────

    /**
     * Send a text message to a group.
     */
    async sendMessage(
        groupId: string,
        content: string,
        options: {
            type?: GroupMessage['type'];
            replyTo?: string;
            replyPreview?: string;
            location?: { lat: number; lng: number; address?: string };
            mediaUrl?: string;
            mediaType?: 'image' | 'voice' | 'location';
            mediaDuration?: number;
            mediaThumbnail?: string;
        } = {},
    ): Promise<GroupMessage | null> {
        const user = this.getCurrentUserSafe();
        // CRITICAL FIX: getAuth().currentUser can be null during cold start / token refresh
        // even though the user IS authenticated. Use identityService.getUid() as fallback
        // since it reads from MMKV cache which survives auth state transitions.
        let uid = user?.uid || '';
        if (!uid) {
            try {
                const { identityService } = require('./IdentityService');
                uid = typeof identityService.getUid === 'function' ? (identityService.getUid() || '') : '';
            } catch { /* identity service unavailable */ }
        }
        if (!uid) {
            logger.error('Cannot send group message: not authenticated (both getAuth().currentUser and identityService.getUid() returned null)');
            return null;
        }

        // Validate content for non-media messages
        if (!options.mediaUrl && !options.location) {
            const validation = validateMessage(content);
            if (!validation.valid) {
                logger.error('Invalid message content:', validation.error);
                return null;
            }
            content = validation.sanitized;
        }

        // Get device ID from identity
        let deviceId = '';
        let senderPublicCode = '';
        const normalizeIdentity = (value: unknown): string => {
            if (typeof value !== 'string') return '';
            const normalized = value.trim();
            if (!normalized || normalized === 'unknown') return '';
            return normalized;
        };
        try {
            const { identityService } = require('./IdentityService');
            deviceId = normalizeIdentity(identityService.getUid?.());
            senderPublicCode = normalizeIdentity(identityService.getUid?.());
        } catch {
            // Identity service unavailable
        }
        if (!deviceId) {
            deviceId = uid;
        }

        // Get display name
        let displayName = user?.displayName || '';
        if (!displayName) {
            // Lookup from group metadata
            const group = this.groups.find((g) => g.id === groupId);
            displayName = group?.participantNames[uid] || 'Kullanıcı';
        }

        // CRITICAL FIX: Use higher entropy ID to prevent collisions when two
        // messages are sent in the same millisecond (Date.now() + 6-char random was too weak).
        const message: GroupMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 6)}`,
            from: uid,
            senderUid: uid,
            fromName: displayName,
            fromDeviceId: deviceId,
            content,
            timestamp: Date.now(),
            type: options.type || 'CHAT',
            status: 'sent',
            readBy: { [uid]: Date.now() }, // Sender has already "read" it
            ...(options.replyTo ? { replyTo: options.replyTo } : {}),
            ...(options.replyPreview ? { replyPreview: options.replyPreview } : {}),
            ...(options.location ? { location: options.location } : {}),
            ...(options.mediaUrl ? { mediaUrl: options.mediaUrl } : {}),
            ...(options.mediaType ? { mediaType: options.mediaType } : {}),
            ...(typeof options.mediaDuration === 'number' ? { mediaDuration: options.mediaDuration } : {}),
            ...(options.mediaThumbnail ? { mediaThumbnail: options.mediaThumbnail } : {}),
        };

        let cloudSuccess = false;
        // CRITICAL: Firestore on RN has NO persistent cache — offline writes evaporate on app kill.
        // Gate cloud attempt on actual network connectivity to avoid false 'sent' status.
        const netState = await NetInfo.fetch();
        const isOnline = netState.isConnected && netState.isInternetReachable !== false;
        if (isOnline) {
            try {
                const rawSuccess = await firebaseSendGroupMessage(groupId, message);
                cloudSuccess = rawSuccess && isOnline;
                if (!cloudSuccess) {
                    logger.warn('Group message cloud write failed, trying mesh fallback');
                }
            } catch (error) {
                logger.warn('Group message cloud write threw error, trying mesh fallback:', error);
            }
        } else {
            logger.info('Group message: offline, skipping cloud write — relying on mesh + retry');
        }

        let meshSuccess = false;
        // Always attempt mesh broadcast for offline/partial-connectivity members.
        try {
            const meshSenderId = message.fromDeviceId || uid;
            const meshPayload = JSON.stringify({
                id: message.id,
                from: meshSenderId,
                senderUid: uid,
                senderPublicCode,
                to: `group:${groupId}`,
                type: message.type,
                content: message.content,
                timestamp: message.timestamp,
                senderName: message.fromName,
                groupId,
                ...(message.mediaType ? { mediaType: message.mediaType } : {}),
                ...(message.mediaUrl ? { mediaUrl: message.mediaUrl } : {}),
                ...(typeof message.mediaDuration === 'number' ? { mediaDuration: message.mediaDuration } : {}),
                ...(message.mediaThumbnail ? { mediaThumbnail: message.mediaThumbnail } : {}),
                ...(message.location ? { location: message.location } : {}),
                ...(message.replyTo ? { replyTo: message.replyTo } : {}),
                ...(message.replyPreview ? { replyPreview: message.replyPreview } : {}),
            });
            if (meshNetworkService?.broadcastMessage) {
                await meshNetworkService.broadcastMessage(meshPayload, MeshMessageType.TEXT, {
                    to: `group:${groupId}`,
                    from: meshSenderId,
                    messageId: message.id,
                });
                meshSuccess = true;
            }
        } catch (error) {
            logger.warn('Group message mesh broadcast failed:', error);
        }

        if (!cloudSuccess && !meshSuccess) {
            logger.error('Failed to send group message on both cloud and mesh channels — scheduling retry');
            // FIX: Add message to MeshStore with 'pending' status so the UI shows it
            // immediately. Without this, the user sees nothing until retry succeeds.
            this.syncMessagesToMeshStore(groupId, [{ ...message, status: 'pending' as any }]);
            this.scheduleGroupMessageRetry(groupId, message, 1);
            return null;
        }

        // Keep MeshStore aligned with group flow for unified message rendering.
        this.syncMessagesToMeshStore(groupId, [message]);

        return message;
    }

    /**
     * Schedule a retry for a failed group message.
     * DURABLE: Message is persisted to MMKV outbox so it survives app kill.
     * In-memory timer triggers the immediate retry; persistence handles app restart.
     */
    private scheduleGroupMessageRetry(groupId: string, message: GroupMessage, attempt: number): void {
        if (this.isDestroyed) return;
        const MAX_RETRIES = 10;
        if (attempt > MAX_RETRIES) {
            logger.error(`Group message ${message.id} failed after ${MAX_RETRIES} retries — dropped`);
            // Remove from persisted outbox
            this.pendingGroupMessages = this.pendingGroupMessages.filter(
                (entry) => entry.message.id !== message.id,
            );
            this.savePendingGroupMessages();
            try {
                const { useMeshStore } = require('./mesh/MeshStore');
                useMeshStore.getState().updateMessage?.(message.id, { status: 'failed' });
            } catch { /* best-effort */ }
            return;
        }
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
        const nextRetryAt = Date.now() + delay;

        // Persist to outbox so the message survives app kill
        const existingIdx = this.pendingGroupMessages.findIndex(
            (entry) => entry.message.id === message.id,
        );
        if (existingIdx >= 0) {
            this.pendingGroupMessages[existingIdx].attempt = attempt;
            this.pendingGroupMessages[existingIdx].nextRetryAt = nextRetryAt;
        } else {
            this.pendingGroupMessages.push({ groupId, message, attempt, nextRetryAt });
        }
        this.savePendingGroupMessages();

        // Schedule in-memory timer for immediate retry attempt
        const timer = setTimeout(async () => {
            this.retryTimers.delete(timer);
            if (this.isDestroyed) return;
            try {
                const retryNet = await NetInfo.fetch();
                if (!retryNet.isConnected || retryNet.isInternetReachable === false) {
                    // Offline: reschedule but don't count against MAX_RETRIES
                    const offlineDelay = Math.min(2000 * Math.pow(2, attempt), 60000);
                    const offlineTimer = setTimeout(() => {
                        this.retryTimers.delete(offlineTimer);
                        if (!this.isDestroyed) {
                            this.scheduleGroupMessageRetry(groupId, message, attempt);
                        }
                    }, offlineDelay);
                    this.retryTimers.add(offlineTimer);
                    return;
                }
                const { sendGroupMessage: fSend } = await import('./firebase/FirebaseGroupOperations');
                const ok = await fSend(groupId, message).catch(() => false);
                if (ok) {
                    logger.info(`Group message ${message.id} retry ${attempt} succeeded`);
                    // Remove from persisted outbox
                    this.pendingGroupMessages = this.pendingGroupMessages.filter(
                        (entry) => entry.message.id !== message.id,
                    );
                    this.savePendingGroupMessages();
                    try {
                        const { useMeshStore } = require('./mesh/MeshStore');
                        useMeshStore.getState().updateMessage?.(message.id, { status: 'sent' });
                    } catch { /* best effort */ }
                } else {
                    this.scheduleGroupMessageRetry(groupId, message, attempt + 1);
                }
            } catch {
                this.scheduleGroupMessageRetry(groupId, message, attempt + 1);
            }
        }, delay);
        this.retryTimers.add(timer);
    }

    /**
     * Send a system message (e.g., "User joined the group").
     */
    private async sendSystemMessage(groupId: string, content: string): Promise<void> {
        const user = this.getCurrentUserSafe();
        if (!user) return;

        const sysMsg: GroupMessage = {
            id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            from: user.uid,
            senderUid: user.uid,
            fromName: 'Sistem',
            fromDeviceId: '',
            content,
            timestamp: Date.now(),
            type: 'SYSTEM',
            status: 'sent',
            readBy: {},
        };

        await firebaseSendGroupMessage(groupId, sysMsg).catch(e => { if (__DEV__) logger.debug('GroupChat: system message send failed:', e); });
    }

    /**
     * Mark all unread messages in a group as read by current user.
     */
    async markAllRead(groupId: string, messageIds: string[]): Promise<void> {
        // FIX: Use writeBatch instead of N parallel individual writes.
        // Opening a group with 50 unread messages previously fired 50 parallel Firestore writes.
        await markGroupMessagesReadBatch(groupId, messageIds).catch((error) => {
            logger.debug('Batch markAllRead failure:', error);
        });
        // Reset unread count for this group
        this.groupUnreadCounts.set(groupId, 0);
        this.updateGroupUnreadAndNotify(groupId, 0);
    }

    /**
     * Update a group's unreadCount and notify listeners.
     */
    private updateGroupUnreadAndNotify(groupId: string, unreadCount: number): void {
        const idx = this.groups.findIndex(g => g.id === groupId);
        if (idx !== -1) {
            this.groups[idx] = { ...this.groups[idx], unreadCount };
            [...this.onGroupsChangedCallbacks].forEach((cb) => cb(this.groups));
        }
    }

    // ─────────────────────────────────────────────────────────
    // Subscriptions
    // ─────────────────────────────────────────────────────────

    /**
     * Subscribe to messages in a specific group.
     * Returns unsubscribe function.
     */
    subscribeToMessages(
        groupId: string,
        callback: (messages: GroupMessage[]) => void,
    ): () => void {
        // Unsubscribe from existing subscription for this group
        const existing = this.activeSubscriptions.get(groupId);
        if (existing) existing();

        const myUid = this.getCurrentUserSafe()?.uid;
        // Track seen message IDs to only notify on truly new messages
        const seenMessageIds = new Set<string>();
        let isInitialLoad = true;
        let isDisposed = false;
        let retryCount = 0;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let currentUnsub: (() => void) | null = null;

        // CRITICAL FIX: 5 retries = ~60s. If offline >1 min, group subscription dies permanently
        // until app restart. DM subscriptions use 15 retries — groups should match for consistency.
        const MAX_RETRIES = 15;

        const handleMessages = (messages: GroupMessage[]) => {
            // Reset retry count on successful update
            retryCount = 0;

            // Feed unified MeshStore path so screens using MeshStore render in sync.
            this.syncMessagesToMeshStore(groupId, messages);

            // Forward messages to the original callback
            callback(messages);

            // Track unread count: messages not read by current user (and not sent by self)
            if (myUid) {
                const unreadCount = messages.filter(m =>
                    m.senderUid !== myUid && m.from !== myUid && !m.readBy?.[myUid]
                ).length;
                const prevCount = this.groupUnreadCounts.get(groupId) ?? 0;
                this.groupUnreadCounts.set(groupId, unreadCount);
                if (unreadCount !== prevCount) {
                    this.updateGroupUnreadAndNotify(groupId, unreadCount);
                }
            }

            // Trigger notifications for new incoming group messages (non-self)
            if (isInitialLoad) {
                // Mark all initial messages as seen without notifying
                messages.forEach(m => seenMessageIds.add(m.id));
                isInitialLoad = false;
                return;
            }

            const newMessages = messages.filter(m => !seenMessageIds.has(m.id));
            newMessages.forEach(m => seenMessageIds.add(m.id));

            for (const msg of newMessages) {
                if (msg.senderUid === myUid) continue; // Skip own messages
                if (msg.type === 'SYSTEM') continue; // Skip system messages

                try {
                    const { notificationCenter } = require('./notifications/NotificationCenter');
                    const group = this.groups.find(g => g.id === groupId);
                    const groupName = group?.name || 'Grup';
                    notificationCenter.notify('message', {
                        from: msg.senderUid,
                        senderName: `${msg.fromName} (${groupName})`,
                        message: msg.content || '',
                        messageId: msg.id,
                        senderId: msg.senderUid,
                        senderUid: msg.senderUid,
                        conversationId: groupId,
                        isGroup: true,
                    }, 'GroupChatService').catch(e => { if (__DEV__) logger.debug('GroupChat: notification display failed:', e); });
                } catch { /* NotificationCenter not available */ }
            }
        };

        const handleError = (error: Error) => {
            const code = (error as any)?.code || '';
            if (code === 'permission-denied' || error.message?.includes('permission')) {
                logger.warn(`Group message subscription permission denied for ${groupId} — not retrying`);
                return;
            }

            logger.error(`Message subscription error for group ${groupId}:`, error);

            // Retry with exponential backoff (non-permission errors)
            if (isDisposed || retryCount >= MAX_RETRIES) {
                if (retryCount >= MAX_RETRIES) {
                    logger.error(`Group message subscription exhausted retries for ${groupId}`);
                }
                return;
            }

            retryCount++;
            const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 30000);
            logger.info(`Group message subscription retry ${retryCount}/${MAX_RETRIES} in ${delay}ms for ${groupId}`);

            retryTimer = setTimeout(() => {
                this.retryTimers.delete(retryTimer!);
                retryTimer = null;
                if (!isDisposed) {
                    if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } }
                    currentUnsub = subscribeToGroupMessages(groupId, handleMessages, handleError);
                }
            }, delay);
            this.retryTimers.add(retryTimer);
        };

        currentUnsub = subscribeToGroupMessages(groupId, handleMessages, handleError);

        const cleanupFn = () => {
            isDisposed = true;
            if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
            if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } currentUnsub = null; }
            this.activeSubscriptions.delete(groupId);
        };

        this.activeSubscriptions.set(groupId, cleanupFn);
        return cleanupFn;
    }

    /**
     * Listen for changes to the user's group list.
     */
    onGroupsChanged(callback: (groups: GroupConversation[]) => void): () => void {
        this.onGroupsChangedCallbacks.push(callback);
        // Fire immediately with current state
        if (this.groups.length > 0) {
            callback(this.groups);
        }
        return () => {
            this.onGroupsChangedCallbacks = this.onGroupsChangedCallbacks.filter((cb) => cb !== callback);
        };
    }

    /**
     * Get the current group list synchronously.
     */
    getGroups(): GroupConversation[] {
        return this.groups.filter((group) => this.isRenderableGroup(group));
    }

    /**
     * Get a single group by ID.
     */
    getGroup(groupId: string): GroupConversation | undefined {
        return this.groups.find((g) => g.id === groupId);
    }

    /**
     * Load historical messages for a group (one-time fetch).
     */
    async loadMessages(groupId: string, limit: number = 50): Promise<GroupMessage[]> {
        return loadGroupMessages(groupId, limit);
    }
}

// Singleton
export const groupChatService = new GroupChatService();
