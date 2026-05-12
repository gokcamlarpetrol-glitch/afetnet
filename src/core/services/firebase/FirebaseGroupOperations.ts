/**
 * FIREBASE GROUP OPERATIONS — ELITE PROFESSIONAL
 * Handles all Firestore CRUD for group conversations.
 * Path: conversations/{conversationId}/messages/{messageId}
 * 
 * Design:
 * - Group metadata stored in conversations/{id} with participants array
 * - Messages stored in conversations/{id}/messages/{id}
 * - Real-time sync via onSnapshot
 * - Read tracking via readBy map on each message
 */

import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    arrayUnion,
    arrayRemove,
    deleteField,
    increment,
    writeBatch,
} from 'firebase/firestore';
import { getFirebaseAuth } from '../../../lib/firebase';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import { isLikelyFirebaseUid } from '../../utils/messaging/identityUtils';

const logger = createLogger('FirebaseGroupOps');
const TIMEOUT_MS = 10000;

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface GroupConversation {
    id: string;
    type: 'group' | 'direct';
    name: string;
    participants: string[];              // Firebase Auth UIDs
    participantNames: Record<string, string>; // uid → display name
    participantDeviceIds: Record<string, string>; // uid → device/qrId
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    // lastMessage: string (new format from sendGroupMessage) or object (legacy format).
    // Readers must handle both: typeof lastMessage === 'string' ? lastMessage : lastMessage?.content
    lastMessage?: string | {
        content: string;
        from: string;
        fromName: string;
        timestamp: number;
    };
    lastMessageAt?: number;
    lastMessageSenderName?: string;
    avatarUrl?: string;
    unreadCount?: number;
}

export interface GroupMessage {
    id: string;
    from: string;                        // Firebase Auth UID
    senderUid?: string;                  // V3 rules compatibility alias (must match auth.uid)
    fromName: string;
    fromDeviceId: string;                // Device/QR ID for mesh routing
    content: string;
    timestamp: number;
    type: 'CHAT' | 'SOS' | 'LOCATION' | 'VOICE' | 'IMAGE' | 'SYSTEM';
    status: 'sent' | 'delivered' | 'read';
    readBy: Record<string, number>;      // uid → readAt timestamp
    // Media
    mediaUrl?: string;
    mediaType?: 'image' | 'voice' | 'location';
    mediaDuration?: number;
    mediaThumbnail?: string;
    location?: { lat: number; lng: number; address?: string };
    // Threading
    replyTo?: string;
    replyPreview?: string;
    // Editing
    isEdited?: boolean;
    editedAt?: number;
    isDeleted?: boolean;
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

async function withTimeout<T>(
    operation: () => Promise<T>,
    name: string,
): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${name} timeout (${TIMEOUT_MS}ms)`)), TIMEOUT_MS);
    });
    try {
        return await Promise.race([operation(), timeout]);
    } finally {
        clearTimeout(timer!);
    }
}

async function upsertGroupInboxThreads(
    conversationId: string,
    participantUids: string[],
    senderUid: string,
    preview: string,
    senderName: string,
    timestamp: number,
    incrementUnread: boolean = true,
): Promise<void> {
    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return;

        const uniqueUids = Array.from(new Set(participantUids.filter((uid) => typeof uid === 'string' && uid.trim().length > 0)));
        if (uniqueUids.length === 0) return;

        const writes = uniqueUids.map(async (uid) => {
            const threadRef = doc(db, 'user_inbox', uid, 'threads', conversationId);
            const isSender = uid === senderUid;
            await setDoc(threadRef, {
                conversationId,
                conversationType: 'group',
                isGroup: true,
                lastMessagePreview: preview.substring(0, 100),
                lastMessageSenderName: senderName,
                lastMessageAt: timestamp,
                updatedAt: Date.now(),
                ...(!isSender && incrementUnread ? { unreadCount: increment(1) } : {}),
            }, { merge: true });
        });

        const results = await Promise.allSettled(writes);
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                logger.warn(`Group inbox write failed for ${uniqueUids[index]} in ${conversationId}:`, result.reason);
            }
        });
    } catch (error) {
        logger.warn(`Group inbox thread sync failed for ${conversationId}:`, error);
    }
}

function getMyUid(): string | null {
    try {
        const authUid = getFirebaseAuth()?.currentUser?.uid;
        if (authUid) return authUid;
        // CRITICAL FIX: Fallback to identityService when getAuth().currentUser is temporarily null
        // (cold start, token refresh). identityService reads UID from MMKV cache.
        const { identityService } = require('../IdentityService');
        const cachedUid = typeof identityService.getUid === 'function' ? identityService.getUid() : null;
        return cachedUid || null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────────────────
// Group CRUD
// ─────────────────────────────────────────────────────────

/**
 * Create a new group conversation in Firestore.
 */
export async function createGroupConversation(
    data: Omit<GroupConversation, 'createdAt' | 'updatedAt'>,
): Promise<boolean> {
    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return false;

        const normalizedParticipants = Array.from(
            new Set(
                (Array.isArray(data.participants) ? data.participants : [])
                    .map((uid) => (typeof uid === 'string' ? uid.trim() : ''))
                    .filter((uid) => uid.length > 0 && isLikelyFirebaseUid(uid)),
            ),
        );
        if (normalizedParticipants.length < 2) {
            logger.warn(`createGroupConversation skipped: invalid participant count (${normalizedParticipants.length}) for ${data.id}`);
            return false;
        }

        const ref = doc(db, 'conversations', data.id);
        await withTimeout(
            () => setDoc(ref, {
                ...data,
                participants: normalizedParticipants,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            }),
            'createGroupConversation',
        );

        // Keep group discoverable in inbox-based flows from first render.
        await upsertGroupInboxThreads(
            data.id,
            normalizedParticipants,
            data.createdBy,
            `${data.name} grubu oluşturuldu`,
            data.participantNames?.[data.createdBy] || 'Sistem',
            Date.now(),
            false,
        );

        logger.info(`✅ Group created: ${data.name} (${data.participants.length} members)`);
        return true;
    } catch (error) {
        logger.error('createGroupConversation failed:', error);
        return false;
    }
}

/**
 * Load a single group conversation metadata.
 */
export async function getGroupConversation(
    conversationId: string,
): Promise<GroupConversation | null> {
    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return null;

        const ref = doc(db, 'conversations', conversationId);
        const snap = await withTimeout(() => getDoc(ref), 'getGroupConversation');

        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as GroupConversation;
    } catch (error) {
        logger.error('getGroupConversation failed:', error);
        return null;
    }
}

/**
 * Update group metadata (name, avatar, etc.)
 */
export async function updateGroupConversation(
    conversationId: string,
    updates: Partial<Pick<GroupConversation, 'name' | 'avatarUrl'>>,
): Promise<boolean> {
    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return false;

        const ref = doc(db, 'conversations', conversationId);
        await withTimeout(
            () => updateDoc(ref, { ...updates, updatedAt: Date.now() }),
            'updateGroupConversation',
        );

        return true;
    } catch (error) {
        logger.error('updateGroupConversation failed:', error);
        return false;
    }
}

/**
 * Add a member to a group conversation.
 */
export async function addGroupMember(
    conversationId: string,
    memberUid: string,
    memberName: string,
    memberDeviceId: string,
): Promise<boolean> {
    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return false;

        const ref = doc(db, 'conversations', conversationId);
        await withTimeout(
            () => updateDoc(ref, {
                participants: arrayUnion(memberUid),
                [`participantNames.${memberUid}`]: memberName,
                [`participantDeviceIds.${memberUid}`]: memberDeviceId,
                updatedAt: Date.now(),
            }),
            'addGroupMember',
        );

        // Ensure newly added member immediately sees the group thread in inbox flows.
        try {
            const updatedSnap = await getDoc(ref);
            const rawLastMessage = updatedSnap.data()?.lastMessage;
            // CRITICAL FIX: lastMessage may be a string (new format) or object (old format).
            const preview = typeof rawLastMessage === 'string'
                ? rawLastMessage
                : (typeof rawLastMessage === 'object' && rawLastMessage !== null && typeof (rawLastMessage as any).content === 'string'
                    ? (rawLastMessage as any).content
                    : `${memberName} gruba eklendi`);
            const senderName = typeof rawLastMessage === 'object' && rawLastMessage !== null && typeof (rawLastMessage as any).fromName === 'string'
                ? (rawLastMessage as any).fromName
                : (updatedSnap.data()?.lastMessageSenderName || 'Sistem');
            const timestamp = typeof rawLastMessage === 'object' && rawLastMessage !== null && typeof (rawLastMessage as any).timestamp === 'number'
                ? (rawLastMessage as any).timestamp
                : (updatedSnap.data()?.lastMessageAt || Date.now());
            await upsertGroupInboxThreads(
                conversationId,
                [memberUid],
                getMyUid() || '',
                preview,
                senderName,
                timestamp,
                false,
            );
        } catch (inboxError) {
            logger.warn(`addGroupMember: inbox bootstrap failed for ${memberUid}`, inboxError);
        }

        logger.info(`Member ${memberName} added to group ${conversationId}`);
        return true;
    } catch (error) {
        logger.error('addGroupMember failed:', error);
        return false;
    }
}

/**
 * Remove a member from a group conversation.
 */
export async function removeGroupMember(
    conversationId: string,
    memberUid: string,
): Promise<boolean> {
    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return false;

        const ref = doc(db, 'conversations', conversationId);
        await withTimeout(
            () => updateDoc(ref, {
                participants: arrayRemove(memberUid),
                [`participantNames.${memberUid}`]: deleteField(),
                [`participantDeviceIds.${memberUid}`]: deleteField(),
                updatedAt: Date.now(),
            }),
            'removeGroupMember',
        );

        return true;
    } catch (error) {
        logger.error('removeGroupMember failed:', error);
        return false;
    }
}

// ─────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────

/**
 * Send a message to a group conversation.
 */
export async function sendGroupMessage(
    conversationId: string,
    message: GroupMessage,
): Promise<boolean> {
    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return false;

        const msgRef = doc(db, 'conversations', conversationId, 'messages', message.id);
        const convRef = doc(db, 'conversations', conversationId);

        // CRITICAL FIX: Fetch participants for inbox updates, but don't block message
        // write if the conversation doc is temporarily unavailable (replication lag,
        // index propagation delay). The message write itself only needs the conversation
        // ID, not the participants list. Inbox updates are best-effort (CF backup exists).
        let participants: string[] = [];
        try {
            const convSnap = await getDoc(convRef);
            if (convSnap.exists()) {
                const participantsRaw = convSnap.data()?.participants;
                participants = Array.isArray(participantsRaw) ? participantsRaw : [];
            } else {
                logger.warn(`sendGroupMessage: conversation ${conversationId} not found — writing message anyway, inbox sync deferred to CF`);
            }
        } catch (convFetchError) {
            logger.warn(`sendGroupMessage: failed to fetch conversation ${conversationId} — writing message anyway:`, convFetchError);
        }
        const messageForWrite = {
            ...message,
            senderUid: message.senderUid || message.from,
            schemaVersion: 3,
        };

        // Write message + update conversation lastMessage in parallel
        await withTimeout(
            () => Promise.all([
                setDoc(msgRef, messageForWrite),
                updateDoc(convRef, {
                    type: 'group',
                    // CRITICAL FIX: lastMessage must be a STRING, not an object.
                    // DM conversations (FirebaseMessageOperations.saveMessage) write
                    // lastMessage as a string. HybridMessageService, MessagesScreen,
                    // and GroupChatService all read data.lastMessage as a string.
                    // Writing an object here caused "[object Object]" to display
                    // in conversation previews for group messages.
                    lastMessage: messageForWrite.content.substring(0, 100),
                    lastMessageSenderName: messageForWrite.fromName || '',
                    lastMessageAt: messageForWrite.timestamp,
                    updatedAt: Date.now(),
                }),
            ]),
            'sendGroupMessage',
        );

        // CRITICAL: Do NOT increment unread here — Cloud Function onNewConversationMessageV3
        // already handles unread count via syncConversationInboxV3. Client + CF = double count.
        await upsertGroupInboxThreads(
            conversationId,
            participants,
            messageForWrite.senderUid || messageForWrite.from,
            messageForWrite.content || '',
            messageForWrite.fromName || 'Grup',
            messageForWrite.timestamp || Date.now(),
            false,
        );

        logger.debug(`Group message sent: ${message.id} → ${conversationId}`);
        return true;
    } catch (error: unknown) {
        const code = (error as any)?.code;
        const msg = error instanceof Error ? error.message : String(error);
        if (code === 'permission-denied' || msg.includes('permission') || msg.includes('Missing or insufficient permissions')) {
            logger.error(`🚨 sendGroupMessage PERMISSION DENIED for conversation ${conversationId} — check Firestore rules (user may not be in participants list)`);
        } else {
            logger.error(`sendGroupMessage failed [${code || 'unknown'}]:`, error);
        }
        return false;
    }
}

/**
 * Load group messages (paginated, latest first).
 */
export async function loadGroupMessages(
    conversationId: string,
    messageLimit: number = 50,
): Promise<GroupMessage[]> {
    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return [];

        const msgsRef = collection(db, 'conversations', conversationId, 'messages');
        const q = query(msgsRef, orderBy('timestamp', 'desc'), limit(messageLimit));
        const snap = await withTimeout(() => getDocs(q), 'loadGroupMessages');

        const messages: GroupMessage[] = [];
        snap.forEach((d) => {
            const data = d.data() as Partial<GroupMessage> & { senderUid?: string };
            const from = (typeof data.from === 'string' && data.from) || data.senderUid || '';
            messages.push({
                ...(data as GroupMessage),
                id: d.id,
                from,
                senderUid: data.senderUid || from,
            });
        });

        // Return in chronological order
        return messages.reverse();
    } catch (error) {
        logger.error('loadGroupMessages failed:', error);
        return [];
    }
}

/**
 * Subscribe to real-time group messages.
 */
export function subscribeToGroupMessages(
    conversationId: string,
    callback: (messages: GroupMessage[]) => void,
    onError?: (error: Error) => void,
): () => void {
    let unsubscribe: (() => void) | null = null;
    let isDisposed = false;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const MAX_RETRIES = 5;

    const clearActiveSubscription = () => {
        if (!unsubscribe) return;
        try {
            unsubscribe();
        } catch {
            // no-op
        }
        unsubscribe = null;
    };

    const scheduleRetry = (origin: string, rawError: unknown) => {
        const error = rawError as Error;
        const code = (rawError as any)?.code || '';
        const message = typeof error?.message === 'string' ? error.message : String(rawError || '');
        const permissionDenied = code === 'permission-denied' || message.includes('permission');

        if (permissionDenied) {
            logger.warn(`Group message subscription permission denied for ${conversationId} (${origin})`);
            onError?.(error);
            return;
        }

        if (isDisposed) return;
        if (retryCount >= MAX_RETRIES) {
            logger.error(`Group message subscription exhausted retries for ${conversationId} (${origin})`);
            onError?.(error);
            return;
        }

        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 15000);
        logger.warn(
            `Group message subscription retry ${retryCount}/${MAX_RETRIES} in ${delay}ms for ${conversationId} (${origin})`,
        );

        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
            retryTimer = null;
            if (isDisposed) return;
            setupSubscription().catch((setupError) => {
                logger.error(`Group message subscription setup retry failed for ${conversationId}:`, setupError);
                scheduleRetry('setup-retry', setupError);
            });
        }, delay);
    };

    const setupSubscription = async (): Promise<void> => {
        if (isDisposed) return;
        const db = await getFirestoreInstanceAsync();
        if (!db) {
            throw new Error('Firestore unavailable for group message subscription');
        }
        if (isDisposed) return;

        const msgsRef = collection(db, 'conversations', conversationId, 'messages');
        const q = query(msgsRef, orderBy('timestamp', 'asc'));

        clearActiveSubscription();

        const snapshotUnsubscribe = onSnapshot(
            q,
            (snap) => {
                // Stream is healthy again.
                retryCount = 0;

                const messages: GroupMessage[] = [];
                snap.forEach((d) => {
                    const data = d.data() as Partial<GroupMessage> & { senderUid?: string };
                    const from = (typeof data.from === 'string' && data.from) || data.senderUid || '';
                    messages.push({
                        ...(data as GroupMessage),
                        id: d.id,
                        from,
                        senderUid: data.senderUid || from,
                    });
                });
                callback(messages);
            },
            (error) => {
                logger.error(`Group message subscription error for ${conversationId}:`, error);
                scheduleRetry('snapshot', error);
            },
        );

        if (isDisposed) {
            try {
                snapshotUnsubscribe();
            } catch {
                // no-op
            }
            return;
        }

        unsubscribe = snapshotUnsubscribe;
    };

    setupSubscription().catch((error) => {
        logger.error(`subscribeToGroupMessages setup failed for ${conversationId}:`, error);
        scheduleRetry('setup', error);
    });

    // Return cleanup function
    return () => {
        isDisposed = true;
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        clearActiveSubscription();
    };
}

/**
 * Mark a message as read by the current user.
 */
export async function markGroupMessageRead(
    conversationId: string,
    messageId: string,
): Promise<boolean> {
    try {
        const uid = getMyUid();
        if (!uid) return false;

        const db = await getFirestoreInstanceAsync();
        if (!db) return false;

        const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
        await updateDoc(msgRef, {
            [`readBy.${uid}`]: Date.now(),
        });

        return true;
    } catch (error) {
        // Read receipts are best-effort
        logger.debug('markGroupMessageRead failed:', error);
        return false;
    }
}

/**
 * Mark multiple messages as read in a single batch write.
 * Uses writeBatch to avoid N+1 sequential Firestore writes.
 */
export async function markGroupMessagesReadBatch(
    conversationId: string,
    messageIds: string[],
): Promise<void> {
    if (messageIds.length === 0) return;
    try {
        const uid = getMyUid();
        if (!uid) return;

        const db = await getFirestoreInstanceAsync();
        if (!db) return;

        // Firestore batch limit is 500 operations
        const BATCH_LIMIT = 450;
        for (let i = 0; i < messageIds.length; i += BATCH_LIMIT) {
            const chunk = messageIds.slice(i, i + BATCH_LIMIT);
            const batch = writeBatch(db);
            for (const msgId of chunk) {
                const msgRef = doc(db, 'conversations', conversationId, 'messages', msgId);
                batch.update(msgRef, { [`readBy.${uid}`]: Date.now() });
            }
            await batch.commit();
        }
    } catch (error) {
        logger.debug('markGroupMessagesReadBatch failed:', error);
    }
}

/**
 * Subscribe to group conversations the current user is a participant of.
 * Uses auth UID to filter by participant membership.
 */
export function subscribeToMyGroupConversations(
    callback: (conversations: GroupConversation[]) => void,
    onError?: (error: Error) => void,
): () => void {
    let unsubscribe: (() => void) | null = null;
    let isDisposed = false;

    (async () => {
        try {
            if (isDisposed) return;
            const uid = getMyUid();
            if (!uid) {
                logger.warn('Cannot subscribe to groups: no auth UID');
                // CRITICAL FIX: Report failure so caller can retry
                onError?.(new Error('No auth UID available for group subscription'));
                return;
            }

            const db = await getFirestoreInstanceAsync();
            if (!db) {
                onError?.(new Error('Firestore unavailable for group subscription'));
                return;
            }
            if (isDisposed) return;

            // Firestore requires the array-contains query for participant filtering
            const convsRef = collection(db, 'conversations');
            const q = query(convsRef, where('participants', 'array-contains', uid));

            const snapshotUnsubscribe = onSnapshot(
                q,
                (snap) => {
                    const conversations: GroupConversation[] = [];
                    snap.forEach((d) => {
                        const data = d.data() as Partial<GroupConversation>;
                        const isGroup = data.type === 'group' || d.id.startsWith('grp_');
                        if (!isGroup) return;
                        const participants = Array.isArray(data.participants) ? data.participants : [];
                        if (participants.length < 2) return;
                        conversations.push({ id: d.id, ...data } as GroupConversation);
                    });
                    // Sort by last message time (most recent first)
                    // CRITICAL FIX: lastMessage may be a string (new format) — use lastMessageAt
                    // which is always set alongside lastMessage by sendGroupMessage.
                    conversations.sort((a, b) => {
                        const aTime = a.lastMessageAt
                            || (typeof a.lastMessage === 'object' && a.lastMessage !== null ? a.lastMessage.timestamp : 0)
                            || a.updatedAt;
                        const bTime = b.lastMessageAt
                            || (typeof b.lastMessage === 'object' && b.lastMessage !== null ? b.lastMessage.timestamp : 0)
                            || b.updatedAt;
                        return bTime - aTime;
                    });
                    callback(conversations);
                },
                (error) => {
                    logger.error('Group conversations subscription error:', error);
                    onError?.(error as Error);
                },
            );

            if (isDisposed) {
                try {
                    snapshotUnsubscribe();
                } catch {
                    // no-op
                }
                return;
            }

            unsubscribe = snapshotUnsubscribe;
        } catch (error) {
            logger.error('subscribeToMyGroupConversations setup failed:', error);
            onError?.(error as Error);
        }
    })();

    return () => {
        isDisposed = true;
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    };
}
