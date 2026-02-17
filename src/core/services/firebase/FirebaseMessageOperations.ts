/**
 * FIREBASE MESSAGE OPERATIONS — UID-CENTRIC ARCHITECTURE v3.0
 * 
 * THE GOLDEN RULE: Conversations are top-level, keyed by UUID.
 * Messages live under conversations/{conversationId}/messages/{messageId}.
 * Each user's inbox metadata is at user_inbox/{uid}/threads/{conversationId}.
 * 
 * DM conversations use a pairKey (hash of sorted UIDs) for fast lookup.
 * Group conversations have no pairKey and use random UUID.
 * 
 * PATH ARCHITECTURE:
 *   conversations/{convId}                    — thread metadata
 *   conversations/{convId}/messages/{msgId}   — message documents
 *   user_inbox/{uid}/threads/{convId}         — per-user inbox metadata
 * 
 * @version 3.0.0 — UID-Centric Conversation Model
 */

import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, onSnapshot, query, orderBy, limit, where, increment } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import type { MessageData, ConversationData, UserInboxThread } from '../../types/firebase';

const logger = createLogger('FirebaseMessageOps');
const TIMEOUT_MS = 10000;
const RETRY_CONFIG = { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 5000 };

// ─── HELPERS ──────────────────────────────────────

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function getErrorCode(e: unknown): string | undefined {
  return (e as any)?.code;
}

async function withTimeout<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operationName} timeout`)), TIMEOUT_MS);
  });
  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function handleFirestoreError(error: unknown, operationName: string): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  if (code === 'permission-denied' || message.includes('permission') || message.includes('Missing or insufficient permissions')) {
    logger.warn(`⚠️ ${operationName}: permission denied`);
    return false;
  }
  if (message.includes('timeout') || message.includes('Timeout')) {
    logger.debug(`${operationName}: timed out (expected in poor network)`);
    return false;
  }
  logger.error(`${operationName} failed:`, error);
  return false;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: { maxRetries: number; baseDelayMs: number; maxDelayMs: number },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const code = getErrorCode(error);
      if (code === 'permission-denied') throw error; // Don't retry permission errors
      if (attempt < config.maxRetries) {
        const delay = Math.min(config.baseDelayMs * Math.pow(2, attempt), config.maxDelayMs);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Generate a deterministic pairKey for 1:1 DM conversations.
 * Format: hash of "minUid|maxUid" — ensures same key regardless of who initiates.
 * Used for indexed lookup, NOT as the conversationId itself.
 */
export function generatePairKey(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  return `${sorted[0]}|${sorted[1]}`;
}

/**
 * Generate a random conversation ID (UUID v4 format).
 */
async function generateConversationId(): Promise<string> {
  try {
    const { default: Crypto } = await import('expo-crypto');
    return Crypto.randomUUID();
  } catch {
    // Fallback: timestamp + random
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 10);
    return `${ts}-${rand}`;
  }
}

// ─── CONVERSATION OPERATIONS ──────────────────────

/**
 * Find or create a DM conversation between two users.
 * Uses pairKey for indexed lookup — never creates duplicate DMs.
 * conversationId is always a random UUID (NOT deterministic).
 */
export async function findOrCreateDMConversation(
  myUid: string,
  otherUid: string,
  myDisplayName?: string,
): Promise<ConversationData | null> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return null;
    }

    const pairKey = generatePairKey(myUid, otherUid);

    // 1. Look up existing DM by pairKey
    // CRITICAL FIX: Must include 'participants' array-contains constraint.
    // Firestore security rules require {uid in participants} for conversation reads.
    // Without this constraint in the query, Firestore rejects the query with
    // permission-denied — even if all matching docs actually satisfy the rule.
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('pairKey', '==', pairKey),
      where('type', '==', 'dm'),
      where('participants', 'array-contains', myUid),
      limit(1),
    );

    const snapshot = await withTimeout(() => getDocs(q), 'DM conversation lookup');

    if (!snapshot.empty) {
      const existingDoc = snapshot.docs[0];
      const data = existingDoc.data() as ConversationData;
      logger.info(`✅ Existing DM found: ${existingDoc.id}`);
      return { ...data, id: existingDoc.id };
    }

    // 2. Create new DM conversation
    const convId = await generateConversationId();
    const now = Date.now();

    const conversationData: ConversationData = {
      id: convId,
      type: 'dm',
      participants: [myUid, otherUid],
      pairKey,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 3,
    };

    await withTimeout(
      () => setDoc(doc(db, 'conversations', convId), conversationData),
      'DM conversation create',
    );

    // 3. Create inbox entries for both users
    const inboxData: UserInboxThread = {
      conversationId: convId,
      unreadCount: 0,
      lastMessageAt: now,
    };

    await Promise.all([
      setDoc(doc(db, 'user_inbox', myUid, 'threads', convId), inboxData),
      setDoc(doc(db, 'user_inbox', otherUid, 'threads', convId), inboxData),
    ]);

    logger.info(`✅ New DM created: ${convId} between ${myUid} and ${otherUid}`);
    return conversationData;
  } catch (error) {
    logger.error('findOrCreateDMConversation failed:', error);
    return null;
  }
}

/**
 * Save a message to a conversation.
 * Path: conversations/{conversationId}/messages/{messageId}
 * Also updates user_inbox for each participant.
 */
export async function saveMessage(
  conversationId: string,
  message: MessageData,
  participantUids: string[],
): Promise<boolean> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn(`saveMessage FAILED: Firestore unavailable`);
      return false;
    }

    // Ensure schema version is set
    const messageWithSchema = {
      ...message,
      schemaVersion: message.schemaVersion || 3,
      updatedAt: new Date().toISOString(),
    };

    const messageRef = doc(db, 'conversations', conversationId, 'messages', message.id);

    await retryWithBackoff(
      () => withTimeout(
        () => setDoc(messageRef, messageWithSchema, { merge: true }),
        'Mesaj kaydetme',
      ),
      RETRY_CONFIG,
    );

    // Update conversation lastMessage metadata
    const convRef = doc(db, 'conversations', conversationId);
    await setDoc(convRef, {
      lastMessage: message.content.substring(0, 100),
      lastMessageSenderName: message.senderName || '',
      lastMessageAt: message.timestamp,
      updatedAt: Date.now(),
    }, { merge: true });

    // Update each participant's inbox
    const inboxUpdates = participantUids.map(uid => {
      const isSender = uid === message.senderUid;
      const threadRef = doc(db, 'user_inbox', uid, 'threads', conversationId);
      return setDoc(threadRef, {
        conversationId,
        lastMessagePreview: message.content.substring(0, 100),
        lastMessageSenderName: message.senderName || '',
        lastMessageAt: message.timestamp,
        ...(!isSender ? { unreadCount: increment(1) } : {}),
      }, { merge: true });
    });

    await Promise.allSettled(inboxUpdates);

    logger.info(`💾 Message saved: conversations/${conversationId}/messages/${message.id}`);
    return true;
  } catch (error: unknown) {
    logger.error(`💾 Message save FAILED: conversations/${conversationId}/messages/${message.id}`);
    return handleFirestoreError(error, 'saveMessage');
  }
}

/**
 * Load messages from a conversation.
 * Path: conversations/{conversationId}/messages/
 */
export async function loadMessages(
  conversationId: string,
  messageLimit: number = 50,
): Promise<MessageData[]> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore kullanılamıyor');
      return [];
    }

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(messageLimit));

    const snapshot = await retryWithBackoff(
      () => withTimeout(() => getDocs(q), 'Mesajları yükleme'),
      RETRY_CONFIG,
    );

    const messages: MessageData[] = [];
    snapshot.forEach((doc) => {
      messages.push({ ...doc.data(), id: doc.id } as MessageData);
    });

    logger.debug(`Loaded ${messages.length} messages from conversations/${conversationId}`);
    return messages.reverse(); // Oldest first for display
  } catch (error: unknown) {
    handleFirestoreError(error, 'loadMessages');
    return [];
  }
}

/**
 * Subscribe to real-time message updates in a conversation.
 * Path: conversations/{conversationId}/messages/
 */
export async function subscribeToMessages(
  conversationId: string,
  callback: (messages: MessageData[]) => void,
  onError?: (error: any) => void,
  messageLimit: number = 100,
): Promise<(() => void) | null> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available for message subscription');
      return null;
    }

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(messageLimit));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const messages: MessageData[] = [];
          snapshot.forEach((doc) => {
            messages.push({ ...doc.data(), id: doc.id } as MessageData);
          });
          callback(messages.reverse());
        } catch (error) {
          logger.error('Error processing message snapshot:', error);
          onError?.(error);
        }
      },
      (error: any) => {
        if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
          logger.warn(`⚠️ Message subscription PERMISSION DENIED for conversation ${conversationId}`);
          return;
        }
        logger.error('Message subscription error:', error);
        onError?.(error);
      },
    );

    logger.info(`✅ Subscribed to messages: conversations/${conversationId}`);
    return unsubscribe;
  } catch (error: unknown) {
    const code = getErrorCode(error);
    if (code === 'permission-denied') {
      logger.debug('Message subscription skipped (permission denied)');
      return null;
    }
    logger.error('Failed to subscribe to messages:', error);
    onError?.(error);
    return null;
  }
}

// ─── USER INBOX OPERATIONS ──────────────────────────

/**
 * Load user's inbox threads (conversation list).
 * Path: user_inbox/{uid}/threads/
 */
export async function loadInboxThreads(
  uid: string,
): Promise<UserInboxThread[]> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return [];

    const threadsRef = collection(db, 'user_inbox', uid, 'threads');
    const q = query(threadsRef, orderBy('lastMessageAt', 'desc'));

    const snapshot = await withTimeout(() => getDocs(q), 'Inbox threads load');

    const threads: UserInboxThread[] = [];
    snapshot.forEach((doc) => {
      threads.push({ ...doc.data(), conversationId: doc.id } as UserInboxThread);
    });

    logger.debug(`Loaded ${threads.length} inbox threads for ${uid}`);
    return threads;
  } catch (error) {
    handleFirestoreError(error, 'loadInboxThreads');
    return [];
  }
}

/**
 * Subscribe to user's inbox for real-time conversation list.
 */
export async function subscribeToInbox(
  uid: string,
  callback: (threads: UserInboxThread[]) => void,
  onError?: (error: any) => void,
): Promise<(() => void) | null> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return null;

    const threadsRef = collection(db, 'user_inbox', uid, 'threads');
    const q = query(threadsRef, orderBy('lastMessageAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const threads: UserInboxThread[] = [];
        snapshot.forEach((doc) => {
          threads.push({ ...doc.data(), conversationId: doc.id } as UserInboxThread);
        });
        callback(threads);
      },
      (error: any) => {
        if (error?.code === 'permission-denied') {
          logger.warn(`⚠️ Inbox subscription PERMISSION DENIED for ${uid}`);
          return;
        }
        logger.error('Inbox subscription error:', error);
        onError?.(error);
      },
    );

    logger.info(`✅ Subscribed to inbox: user_inbox/${uid}`);
    return unsubscribe;
  } catch (error) {
    handleFirestoreError(error, 'subscribeToInbox');
    return null;
  }
}

/**
 * Mark a conversation as read for a specific user.
 */
export async function markConversationRead(
  uid: string,
  conversationId: string,
): Promise<void> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return;

    await setDoc(
      doc(db, 'user_inbox', uid, 'threads', conversationId),
      { lastReadAt: Date.now(), unreadCount: 0 },
      { merge: true }
    );
  } catch (error) {
    logger.warn('Failed to mark conversation read:', error);
  }
}

/**
 * Delete a conversation from user's inbox (soft delete — just removes from inbox).
 */
export async function deleteConversationFromInbox(
  uid: string,
  conversationId: string,
): Promise<boolean> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return false;

    await withTimeout(
      () => deleteDoc(doc(db, 'user_inbox', uid, 'threads', conversationId)),
      'Conversation inbox delete',
    );

    logger.info(`✅ Conversation ${conversationId} removed from inbox for ${uid}`);
    return true;
  } catch (error) {
    return handleFirestoreError(error, 'deleteConversationFromInbox');
  }
}

/**
 * Get a conversation by its ID.
 */
export async function getConversation(
  conversationId: string,
): Promise<ConversationData | null> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return null;

    const convDoc = await withTimeout(
      () => getDoc(doc(db, 'conversations', conversationId)),
      'Conversation get',
    );

    if (!convDoc.exists()) return null;
    return { ...convDoc.data(), id: convDoc.id } as ConversationData;
  } catch (error) {
    handleFirestoreError(error, 'getConversation');
    return null;
  }
}

// ─── LEGACY COMPAT ──────────────────────────────────

/**
 * @deprecated Legacy saveMessage that writes to devices/{id}/messages path.
 * Used during dual-write migration period. Set schemaVersion=3 messages
 * will NOT trigger old CFs (they check schemaVersion).
 */
export async function saveMessageLegacy(
  userDeviceId: string,
  message: MessageData,
): Promise<boolean> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return false;

    const messageRef = doc(db, 'devices', userDeviceId, 'messages', message.id);
    await retryWithBackoff(
      () => withTimeout(
        () => setDoc(messageRef, {
          ...message,
          schemaVersion: 3, // Prevents old CF from triggering push
          updatedAt: new Date().toISOString(),
        }, { merge: true }),
        'Legacy mesaj kaydetme',
      ),
      RETRY_CONFIG,
    );
    return true;
  } catch (error) {
    return handleFirestoreError(error, 'saveMessageLegacy');
  }
}
