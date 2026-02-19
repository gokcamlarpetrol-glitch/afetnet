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

import { getAuth, onAuthStateChanged, type Unsubscribe as AuthUnsubscribe } from 'firebase/auth';
import { createLogger } from '../utils/logger';
import { validateMessage, sanitizeMessage } from '../utils/messageSanitizer';
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
    subscribeToMyGroupConversations,
    type GroupConversation,
    type GroupMessage,
} from './firebase/FirebaseGroupOperations';

const logger = createLogger('GroupChatService');

// Re-export types for consumers
export type { GroupConversation, GroupMessage };

class GroupChatService {
    private activeSubscriptions = new Map<string, () => void>();
    private groupListSubscription: (() => void) | null = null;
    private authUnsubscribe: AuthUnsubscribe | null = null;
    private groups: GroupConversation[] = [];
    private groupUnreadCounts = new Map<string, number>();
    private onGroupsChangedCallbacks: Array<(groups: GroupConversation[]) => void> = [];
    private subscriptionRetryCount = 0;
    private subscriptionRetryTimer: NodeJS.Timeout | null = null;
    private static readonly MAX_SUBSCRIPTION_RETRIES = 6;

    private getCurrentUserSafe() {
        try {
            return getAuth().currentUser;
        } catch (error) {
            logger.warn('Firebase auth unavailable in GroupChatService', error);
            return null;
        }
    }

    private loadGroups(): void {
        try {
            const { DirectStorage } = require('../utils/storage');
            const data = DirectStorage.getString('@afetnet:groups');
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    this.groups = parsed;
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
            DirectStorage.setString('@afetnet:groups', JSON.stringify(this.groups));
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

        // ELITE: Load from local storage immediately for offline support
        this.loadGroups();
        if (this.groups.length > 0) {
            this.onGroupsChangedCallbacks.forEach((cb) => cb(this.groups));
        }

        const user = this.getCurrentUserSafe();
        if (user?.uid) {
            this.startSubscription();
        } else {
            // CRITICAL FIX: Auth not ready yet — wait for it
            logger.warn('GroupChatService: auth not ready, installing onAuthStateChanged listener...');
            try {
                this.authUnsubscribe = onAuthStateChanged(getAuth(), (authUser) => {
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
        if (this.groupListSubscription) return;

        this.groupListSubscription = subscribeToMyGroupConversations(
            (groups) => {
                // Subscription alive — reset retry counter
                this.subscriptionRetryCount = 0;
                this.groups = groups;
                this.saveGroups(); // ELITE: Persist updates
                this.onGroupsChangedCallbacks.forEach((cb) => cb(groups));
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
        this.saveGroups(); // ELITE: Final save
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

        // Always include creator
        const allParticipants = Array.from(new Set([myUid, ...memberUids]));

        // Generate a stable group ID
        const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        let myDeviceId = memberDeviceIds[myUid] || '';
        if (!myDeviceId) {
            try {
                const { identityService } = require('./IdentityService');
                myDeviceId =
                    identityService.getMeshDeviceId?.() ||
                    identityService.getMyId?.() ||
                    myUid;
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
        await this.sendSystemMessage(groupId, 'Bir üye gruptan ayrıldı').catch(() => {
            // Non-critical: message may fail if already removed
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
            deviceId =
                normalizeIdentity(identityService.getMeshDeviceId?.()) ||
                normalizeIdentity(identityService.getDeviceId?.()) ||
                normalizeIdentity(identityService.getMyId?.()) ||
                normalizeIdentity(identityService.getUid?.());
            senderPublicCode = normalizeIdentity(identityService.getMyId?.());
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

        const message: GroupMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
        try {
            cloudSuccess = await firebaseSendGroupMessage(groupId, message);
            if (!cloudSuccess) {
                logger.warn('Group message cloud write failed, trying mesh fallback');
            }
        } catch (error) {
            logger.warn('Group message cloud write threw error, trying mesh fallback:', error);
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
            logger.error('Failed to send group message on both cloud and mesh channels');
            return null;
        }

        return message;
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

        await firebaseSendGroupMessage(groupId, sysMsg).catch(() => { });
    }

    /**
     * Mark all unread messages in a group as read by current user.
     */
    async markAllRead(groupId: string, messageIds: string[]): Promise<void> {
        const promises = messageIds.map((id) => markGroupMessageRead(groupId, id));
        await Promise.all(promises).catch((error) => {
            logger.debug('Batch markAllRead partial failure:', error);
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
            this.onGroupsChangedCallbacks.forEach((cb) => cb(this.groups));
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

        const MAX_RETRIES = 5;

        const handleMessages = (messages: GroupMessage[]) => {
            // Reset retry count on successful update
            retryCount = 0;

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
                    }, 'GroupChatService').catch(() => { /* best-effort */ });
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
                retryTimer = null;
                if (!isDisposed) {
                    if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } }
                    currentUnsub = subscribeToGroupMessages(groupId, handleMessages, handleError);
                }
            }, delay);
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
        return this.groups;
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
