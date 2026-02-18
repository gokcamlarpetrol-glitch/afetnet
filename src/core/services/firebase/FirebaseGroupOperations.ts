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
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';

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
    lastMessage?: {
        content: string;
        from: string;
        fromName: string;
        timestamp: number;
    };
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

function getMyUid(): string | null {
    try {
        return getAuth().currentUser?.uid || null;
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

        const ref = doc(db, 'conversations', data.id);
        await withTimeout(
            () => setDoc(ref, {
                ...data,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            }),
            'createGroupConversation',
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
        const messageForWrite: GroupMessage = {
            ...message,
            senderUid: message.senderUid || message.from,
        };

        // Write message + update conversation lastMessage in parallel
        await withTimeout(
            () => Promise.all([
                setDoc(msgRef, messageForWrite),
                updateDoc(convRef, {
                    lastMessage: {
                        content: messageForWrite.content.substring(0, 100),
                        from: messageForWrite.from,
                        fromName: messageForWrite.fromName,
                        timestamp: messageForWrite.timestamp,
                    },
                    updatedAt: Date.now(),
                }),
            ]),
            'sendGroupMessage',
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

    (async () => {
        try {
            if (isDisposed) return;
            const db = await getFirestoreInstanceAsync();
            if (!db) return;
            if (isDisposed) return;

            const msgsRef = collection(db, 'conversations', conversationId, 'messages');
            const q = query(msgsRef, orderBy('timestamp', 'asc'));

            const snapshotUnsubscribe = onSnapshot(
                q,
                (snap) => {
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
            logger.error('subscribeToGroupMessages setup failed:', error);
            onError?.(error as Error);
        }
    })();

    // Return cleanup function
    return () => {
        isDisposed = true;
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
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
                return;
            }

            const db = await getFirestoreInstanceAsync();
            if (!db) return;
            if (isDisposed) return;

            // Firestore requires the array-contains query for participant filtering
            const convsRef = collection(db, 'conversations');
            const q = query(convsRef, where('participants', 'array-contains', uid));

            const snapshotUnsubscribe = onSnapshot(
                q,
                (snap) => {
                    const conversations: GroupConversation[] = [];
                    snap.forEach((d) => conversations.push({ id: d.id, ...d.data() } as GroupConversation));
                    // Sort by last message time (most recent first)
                    conversations.sort((a, b) =>
                        (b.lastMessage?.timestamp || b.updatedAt) - (a.lastMessage?.timestamp || a.updatedAt),
                    );
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
