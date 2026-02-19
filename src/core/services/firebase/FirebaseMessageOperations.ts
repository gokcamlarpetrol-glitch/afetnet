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

import { doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, onSnapshot, query, orderBy, limit, where, increment, serverTimestamp, deleteField } from 'firebase/firestore';
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
    let existingConversation: ConversationData | null = null;

    // Strategy 1: Use 2-field composite index query (pairKey + participants).
    // This is the fast path that requires the composite index from firestore.indexes.json.
    try {
      const q = query(
        conversationsRef,
        where('pairKey', '==', pairKey),
        where('participants', 'array-contains', myUid),
        limit(1),
      );

      const snapshot = await withTimeout(() => getDocs(q), 'DM conversation lookup');

      if (!snapshot.empty) {
        const existingDoc = snapshot.docs[0];
        const data = existingDoc.data() as ConversationData;
        logger.info(`✅ Existing DM found (indexed): ${existingDoc.id}`);
        existingConversation = { ...data, id: existingDoc.id };
      }
    } catch (lookupError) {
      // Composite index query failed — this is the #1 cause of duplicate conversations.
      // Fall back to single-field query + client-side pairKey filter.
      logger.warn('🚨 Composite index query failed — using fallback (deploy firestore.indexes.json to fix permanently):', lookupError);

      // Strategy 2: FALLBACK — query by participants only (no composite index needed)
      // then filter by pairKey in client code.
      // Single-field array-contains queries use Firestore's automatic single-field index.
      try {
        const fallbackQ = query(
          conversationsRef,
          where('participants', 'array-contains', myUid),
        );
        const fallbackSnap = await withTimeout(() => getDocs(fallbackQ), 'DM conversation fallback lookup');
        fallbackSnap.forEach((docSnap) => {
          if (existingConversation) return; // Already found
          const data = docSnap.data();
          if (data.pairKey === pairKey) {
            logger.info(`✅ Existing DM found (fallback): ${docSnap.id}`);
            existingConversation = { ...data, id: docSnap.id } as ConversationData;
          }
        });
      } catch (fallbackError) {
        logger.error('🚨 Fallback DM lookup also FAILED:', fallbackError);
      }
    }

    if (existingConversation) {
      return existingConversation;
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
    // CRITICAL: Use allSettled instead of all — if the recipient's inbox write
    // fails (e.g., due to security rules), we still return the conversation.
    // The message can still be saved to the conversation, and the recipient
    // will discover it via direct conversation subscription.
    const inboxData: UserInboxThread = {
      conversationId: convId,
      unreadCount: 0,
      lastMessageAt: now,
    };

    const inboxResults = await Promise.allSettled([
      setDoc(doc(db, 'user_inbox', myUid, 'threads', convId), inboxData),
      setDoc(doc(db, 'user_inbox', otherUid, 'threads', convId), inboxData),
    ]);

    if (inboxResults[0].status === 'rejected') {
      logger.warn(`Inbox entry write failed for sender ${myUid}:`, inboxResults[0].reason);
    }
    if (inboxResults[1].status === 'rejected') {
      logger.warn(`Inbox entry write failed for recipient ${otherUid}:`, inboxResults[1].reason);
    }

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
    // CRITICAL: The recipient's inbox entry MUST be written for message delivery.
    // If this fails, the recipient's inbox subscription never fires and they
    // never receive the message in real-time.
    const inboxUpdates = participantUids.map(async (uid) => {
      const isSender = uid === message.senderUid;
      const threadRef = doc(db, 'user_inbox', uid, 'threads', conversationId);
      try {
        await setDoc(threadRef, {
          conversationId,
          lastMessagePreview: message.content.substring(0, 100),
          lastMessageSenderName: message.senderName || '',
          lastMessageAt: message.timestamp,
          ...(!isSender ? { unreadCount: increment(1) } : {}),
        }, { merge: true });
        logger.debug(`Inbox updated for ${isSender ? 'sender' : 'recipient'} ${uid}`);
      } catch (inboxError) {
        logger.error(`INBOX UPDATE FAILED for ${isSender ? 'sender' : 'recipient'} ${uid}:`, inboxError);
        // Re-throw only for recipient — sender inbox failure is non-critical
        if (!isSender) throw inboxError;
      }
    });

    const inboxResults = await Promise.allSettled(inboxUpdates);
    const recipientFailed = inboxResults.some((r, i) =>
      r.status === 'rejected' && participantUids[i] !== message.senderUid
    );
    if (recipientFailed) {
      logger.warn(`Recipient inbox update failed — message saved but may not be delivered in real-time`);
    }

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
  messageLimit: number = 200,
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
  let isDisposed = false;
  let currentUnsub: (() => void) | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const MAX_RETRIES = 5;

  const cleanup = () => {
    isDisposed = true;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } currentUnsub = null; }
  };

  const startSnapshot = async (): Promise<boolean> => {
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db || isDisposed) return false;

      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(messageLimit));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (isDisposed) return;
          retryCount = 0; // Reset on successful snapshot
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
          if (isDisposed) return;
          if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
            logger.warn(`⚠️ Message subscription PERMISSION DENIED for conversation ${conversationId}`);
            return;
          }
          logger.error('Message subscription error:', error);

          // Retry with exponential backoff for non-permission errors
          if (retryCount >= MAX_RETRIES) {
            logger.error(`Message subscription exhausted retries for ${conversationId}`);
            onError?.(error);
            return;
          }
          retryCount++;
          const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 30000);
          logger.info(`Message subscription retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
          retryTimer = setTimeout(() => {
            retryTimer = null;
            if (!isDisposed) startSnapshot();
          }, delay);
        },
      );

      if (isDisposed) {
        try { unsubscribe(); } catch { /* no-op */ }
        return false;
      }

      if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } }
      currentUnsub = unsubscribe;
      logger.info(`✅ Subscribed to messages: conversations/${conversationId}`);
      return true;
    } catch (error: unknown) {
      if (isDisposed) return false;
      const code = getErrorCode(error);
      if (code === 'permission-denied') {
        logger.debug('Message subscription skipped (permission denied)');
        return false;
      }
      logger.error('Failed to subscribe to messages:', error);
      onError?.(error);
      return false;
    }
  };

  const started = await startSnapshot();
  if (!started && isDisposed) return null;

  return cleanup;
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

// ═══════════════════════════════════════════════════════════════
// TYPING INDICATOR — Firestore-based for remote delivery
// ═══════════════════════════════════════════════════════════════

/**
 * Set typing state for a user in a conversation.
 * Writes: conversations/{convId}.typing.{uid} = serverTimestamp()
 */
export async function setTypingIndicator(
  conversationId: string,
  uid: string,
  isTyping: boolean,
): Promise<void> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return;
    const convRef = doc(db, 'conversations', conversationId);
    if (isTyping) {
      await updateDoc(convRef, { [`typing.${uid}`]: serverTimestamp() });
    } else {
      await updateDoc(convRef, { [`typing.${uid}`]: deleteField() });
    }
  } catch {
    // Non-critical — best effort
  }
}

/**
 * Subscribe to typing indicators for a conversation.
 * Returns unsubscribe function.
 * Callback receives map of uid → timestamp (ms) of currently typing users.
 */
export function subscribeToTyping(
  conversationId: string,
  myUid: string,
  callback: (typingUsers: Map<string, number>) => void,
): () => void {
  let unsubscribe: (() => void) | null = null;

  (async () => {
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;
      const convRef = doc(db, 'conversations', conversationId);
      unsubscribe = onSnapshot(convRef, (snap) => {
        const data = snap.data();
        const typing = data?.typing;
        const result = new Map<string, number>();
        if (typing && typeof typing === 'object') {
          const now = Date.now();
          for (const [uid, ts] of Object.entries(typing)) {
            if (uid === myUid) continue; // Skip self
            // Firestore Timestamp → milliseconds
            const msTime = ts && typeof ts === 'object' && 'toMillis' in ts
              ? (ts as any).toMillis()
              : typeof ts === 'number' ? ts : 0;
            // Only show typing if within last 6 seconds
            if (msTime > 0 && now - msTime < 6000) {
              result.set(uid, msTime);
            }
          }
        }
        callback(result);
      }, () => {
        // Ignore snapshot errors for typing
      });
    } catch {
      // Non-critical
    }
  })();

  return () => { unsubscribe?.(); };
}

// ═══════════════════════════════════════════════════════════════
// LAST SEEN — User presence tracking
// ═══════════════════════════════════════════════════════════════

/**
 * Update user's lastSeen timestamp in Firestore.
 * Writes: users/{uid}.lastSeen = serverTimestamp()
 */
export async function updateLastSeen(uid: string): Promise<void> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { lastSeen: serverTimestamp() }, { merge: true });
  } catch {
    // Non-critical — best effort
  }
}

/**
 * Subscribe to a user's lastSeen timestamp.
 * Callback receives the timestamp in milliseconds, or null if unknown.
 */
export function subscribeToLastSeen(
  uid: string,
  callback: (lastSeen: number | null) => void,
): () => void {
  let unsubscribe: (() => void) | null = null;

  (async () => {
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;
      const userRef = doc(db, 'users', uid);
      unsubscribe = onSnapshot(userRef, (snap) => {
        const data = snap.data();
        const ts = data?.lastSeen;
        if (ts && typeof ts === 'object' && 'toMillis' in ts) {
          callback((ts as any).toMillis());
        } else if (typeof ts === 'number') {
          callback(ts);
        } else {
          callback(null);
        }
      }, () => {
        callback(null);
      });
    } catch {
      callback(null);
    }
  })();

  return () => { unsubscribe?.(); };
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE DELETION — Firestore cloud delete for "delete for everyone"
// ═══════════════════════════════════════════════════════════════

/**
 * Delete a message for everyone in a conversation.
 * Updates the message doc: deleted=true, content='Bu mesaj silindi', deletedAt=serverTimestamp()
 */
export async function deleteMessageForEveryone(
  conversationId: string,
  messageId: string,
): Promise<boolean> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return false;
    const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(msgRef, {
      deleted: true,
      content: 'Bu mesaj silindi',
      deletedAt: serverTimestamp(),
    });
    logger.info(`Message ${messageId} deleted for everyone in ${conversationId}`);
    return true;
  } catch (error) {
    logger.warn('deleteMessageForEveryone failed:', error);
    return false;
  }
}
