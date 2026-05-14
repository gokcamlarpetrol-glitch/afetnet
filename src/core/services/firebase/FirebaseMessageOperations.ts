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

import { doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, onSnapshot, query, orderBy, limit, where, serverTimestamp, deleteField } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import type { MessageData, ConversationData, UserInboxThread } from '../../types/firebase';
import { getFirebaseAuth } from '../../../lib/firebase';
import type { MessageSendOutcome } from '../messaging/types';

const logger = createLogger('FirebaseMessageOps');
const TIMEOUT_MS = 10000;
// CRITICAL FIX: maxRetries 2→5, delays increased.
// Mobile networks have transient blips lasting 10-30 seconds.
// With only 2 retries (5.5s total), messages get stuck "pending" forever.
// 5 retries with 1-15s backoff = ~45s total coverage.
const RETRY_CONFIG = { maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 15000 };
const MAX_MESSAGE_PREVIEW_LENGTH = 100;

// ─── HELPERS ──────────────────────────────────────

function toMessagePreview(message: Pick<MessageData, 'content' | 'type' | 'mediaType'>): string {
  const content = typeof message.content === 'string' ? message.content.trim() : '';
  if (content) return content.substring(0, MAX_MESSAGE_PREVIEW_LENGTH);

  const mediaType = message.mediaType || message.type;
  if (mediaType === 'image') return 'Fotoğraf';
  if (mediaType === 'voice') return 'Sesli mesaj';
  if (mediaType === 'video') return 'Video';
  if (mediaType === 'location') return 'Konum paylaşıldı';
  if (message.type === 'sos' || message.type === 'emergency') return 'Acil durum mesajı';

  return 'Mesaj';
}

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

function getCurrentReceiptUid(): string | null {
  try {
    const uid = getFirebaseAuth()?.currentUser?.uid?.trim() ?? '';
    return uid || null;
  } catch {
    return null;
  }
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

/**
 * Deterministic DM conversation ID for race-free creation.
 * This prevents concurrent creates from generating split threads.
 */
function getDeterministicDmConversationId(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
}

// ─── CONVERSATION OPERATIONS ──────────────────────

/**
 * Find or create a DM conversation between two users.
 * Uses pairKey for indexed lookup — never creates duplicate DMs.
 * Falls back to deterministic DM ID creation to avoid race-condition duplicates.
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
    // CRITICAL FIX: To prevent duplicate group creation (Conversation Duplication Bug),
    // we bypass the composite index which requires a strict firestore.indexes.json deployment.
    // Instead, we use a single-field index query on 'pairKey' which Firestore handles automatically.
    const conversationsRef = collection(db, 'conversations');
    let existingConversation: ConversationData | null = null;

    let strictLookupCompleted = false;
    let fallbackLookupCompleted = false;

    try {
      // CRITICAL FIX: Do NOT use limit(1). If duplicate conversations exist
      // (from prior race conditions or bugs), limit(1) returns an arbitrary
      // document — which may be DIFFERENT on each device. Device A writes
      // to conversation X, Device B subscribes to conversation Y → messages
      // never appear. Instead, fetch ALL matches and deterministically pick
      // the one with the lowest document ID (Firestore default sort order).
      const q = query(
        conversationsRef,
        where('pairKey', '==', pairKey),
      );

      const snapshot = await withTimeout(() => getDocs(q), 'DM conversation lookup');
      strictLookupCompleted = true;

      if (!snapshot.empty) {
        // Deterministic: pick the conversation with the earliest createdAt,
        // falling back to lowest document ID for consistent cross-device results.
        let bestDoc = snapshot.docs[0];
        for (let i = 1; i < snapshot.docs.length; i++) {
          const candidateData = snapshot.docs[i].data();
          const bestData = bestDoc.data();
          const candidateTime = candidateData?.createdAt ?? Number.MAX_SAFE_INTEGER;
          const bestTime = bestData?.createdAt ?? Number.MAX_SAFE_INTEGER;
          if (candidateTime < bestTime || (candidateTime === bestTime && snapshot.docs[i].id < bestDoc.id)) {
            bestDoc = snapshot.docs[i];
          }
        }
        if (snapshot.docs.length > 1) {
          logger.warn(`⚠️ Found ${snapshot.docs.length} duplicate conversations for pairKey=${pairKey} — using earliest: ${bestDoc.id}`);
        }
        const data = bestDoc.data() as ConversationData;
        logger.info(`✅ Existing DM found (indexed cleanly): ${bestDoc.id}`);
        existingConversation = { ...data, id: bestDoc.id };
      }
    } catch (lookupError) {
      logger.error('🚨 Strict DM lookup by pairKey FAILED:', lookupError);

      // DEEP FALLBACK: Just in case even pairKey index is missing (rare),
      // we query by participants and manually find the pairKey in JS.
      try {
        const fallbackQ = query(
          conversationsRef,
          where('participants', 'array-contains', myUid),
          limit(500),
        );
        const fallbackSnap = await withTimeout(() => getDocs(fallbackQ), 'DM conversation deep fallback');
        fallbackLookupCompleted = true;
        fallbackSnap.forEach((docSnap) => {
          if (existingConversation) return;
          const data = docSnap.data();
          if (data.pairKey === pairKey) {
            logger.info(`✅ Existing DM found (deep fallback): ${docSnap.id}`);
            existingConversation = { ...data, id: docSnap.id } as ConversationData;
          }
        });
      } catch (fallbackError) {
        logger.error('🚨 Deep Fallback DM lookup also FAILED:', fallbackError);
      }
    }

    if (existingConversation) {
      return existingConversation;
    }

    // SAFETY: if both lookups failed due transient/network/index errors,
    // avoid creating a brand-new duplicate thread. Let caller retry.
    if (!strictLookupCompleted && !fallbackLookupCompleted) {
      logger.warn(`⚠️ DM lookup failed completely for pairKey=${pairKey}; skipping create to prevent duplicate conversation`);
      return null;
    }

    // 2. Create new DM conversation
    // Deterministic ID eliminates concurrent double-creates for the same pair.
    const convId = getDeterministicDmConversationId(myUid, otherUid);
    const convRef = doc(db, 'conversations', convId);

    const existingDeterministic = await withTimeout(
      () => getDoc(convRef),
      'DM deterministic conversation lookup',
    );
    if (existingDeterministic.exists()) {
      const data = existingDeterministic.data() as ConversationData;
      logger.info(`✅ Existing deterministic DM found: ${convId}`);
      return { ...data, id: convId };
    }

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
      () => setDoc(convRef, conversationData, { merge: true }),
      'DM conversation create',
    );

    // 3. Create inbox entries for both users
    // CRITICAL: Use allSettled instead of all — if the recipient's inbox write
    // fails (e.g., due to security rules), we still return the conversation.
    // The message can still be saved to the conversation, and the recipient
    // will discover it via direct conversation subscription.
    const inboxData = {
      conversationId: convId,
      conversationType: 'dm',
      isGroup: false,
      participants: [myUid, otherUid],
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
): Promise<MessageSendOutcome> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn(`saveMessage FAILED: Firestore unavailable`);
      return { status: 'retryable_failure', messagePersisted: false, inboxDelivered: false, error: 'Firestore unavailable' };
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

    // ── Message document persisted successfully ──

    // Update conversation lastMessage metadata (best-effort)
    try {
      const convRef = doc(db, 'conversations', conversationId);
      await setDoc(convRef, {
        lastMessage: toMessagePreview(message),
        lastMessageSenderName: message.senderName || '',
        lastMessageAt: message.timestamp,
        updatedAt: Date.now(),
      }, { merge: true });
    } catch (metadataError) {
      logger.warn('Conversation metadata update failed (non-critical):', metadataError);
      // Don't fail the entire saveMessage — the message itself is already saved
    }

    // Update each participant's inbox
    // CRITICAL: The recipient's inbox entry MUST be written for message delivery.
    // If this fails, the recipient's inbox subscription never fires and they
    // never receive the message in real-time.
    // HOWEVER: The Cloud Function onNewConversationMessageV3 → syncConversationInboxV3
    // provides a server-side backup. When the message document is written to Firestore,
    // the CF's onCreate trigger fires and writes inbox entries for ALL participants.
    // This means client-side inbox failure is recoverable (partial_success, not failure).
    //
    // CRITICAL FIX: Do NOT increment unreadCount from the client.
    // The Cloud Function onNewConversationMessageV3 → syncConversationInboxV3
    // already uses FieldValue.increment(1) server-side. If we also increment
    // here, the recipient's unreadCount is doubled (incremented by 2 instead of 1).
    // Client-side inbox write should only update metadata (preview, timestamp).
    const inboxUpdates = participantUids.map(async (uid) => {
      const isSender = uid === message.senderUid;
      const threadRef = doc(db, 'user_inbox', uid, 'threads', conversationId);
      const inboxData = {
        conversationId,
        lastMessagePreview: toMessagePreview(message),
        lastMessageSenderName: message.senderName || '',
        lastMessageAt: message.timestamp,
      };
      try {
        // Recipient inbox uses full retryWithBackoff (critical for delivery)
        // Sender inbox uses single attempt (non-critical)
        if (!isSender) {
          await retryWithBackoff(
            () => setDoc(threadRef, inboxData, { merge: true }),
            RETRY_CONFIG,
          );
        } else {
          await setDoc(threadRef, inboxData, { merge: true });
        }
        logger.debug(`Inbox updated for ${isSender ? 'sender' : 'recipient'} ${uid}`);
      } catch (inboxError) {
        logger.error(`INBOX UPDATE FAILED for ${isSender ? 'sender' : 'recipient'} ${uid}:`, inboxError);
        // Re-throw so Promise.allSettled sees this as rejected (not silently swallowed)
        throw inboxError;
      }
    });

    const inboxResults = await Promise.allSettled(inboxUpdates);

    // Check if at least one recipient inbox update succeeded.
    const recipientResults = inboxResults
      .filter((_, i) => participantUids[i] !== message.senderUid);
    const recipientInboxAllFailed = recipientResults.length > 0 &&
      recipientResults.every(r => r.status === 'rejected');
    const recipientInboxAllSucceeded = recipientResults.length === 0 ||
      recipientResults.every(r => r.status === 'fulfilled');

    if (recipientInboxAllFailed) {
      // Message IS in Firestore, but NO recipient inbox was written.
      // The CF onNewConversationMessageV3 → syncConversationInboxV3 will handle
      // inbox delivery server-side as a backup (it runs on every message onCreate).
      // Return partial_success so the caller knows the message is persisted.
      logger.error(`🚨 ALL recipient inbox writes FAILED for conversations/${conversationId}/messages/${message.id} — CF will handle inbox delivery server-side`);
      return {
        status: 'partial_success',
        messagePersisted: true,
        inboxDelivered: false,
        conversationId,
        error: 'All recipient inbox writes failed; CF backup will deliver',
      };
    }

    if (!recipientInboxAllSucceeded) {
      // Some but not all recipient inbox writes failed — partial success
      logger.warn(`⚠️ Some recipient inbox writes failed for conversations/${conversationId}/messages/${message.id}`);
      return {
        status: 'partial_success',
        messagePersisted: true,
        inboxDelivered: false,
        conversationId,
      };
    }

    logger.info(`💾 Message saved: conversations/${conversationId}/messages/${message.id}`);
    return {
      status: 'full_success',
      messagePersisted: true,
      inboxDelivered: true,
      conversationId,
    };
  } catch (error: unknown) {
    logger.error(`💾 Message save FAILED: conversations/${conversationId}/messages/${message.id}`);
    const code = getErrorCode(error);
    // Permission denied is permanent — no point retrying
    if (code === 'permission-denied') {
      return {
        status: 'permanent_failure',
        messagePersisted: false,
        inboxDelivered: false,
        error: getErrorMessage(error),
      };
    }
    handleFirestoreError(error, 'saveMessage');
    return {
      status: 'retryable_failure',
      messagePersisted: false,
      inboxDelivered: false,
      error: getErrorMessage(error),
    };
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
  // CRITICAL FIX: Was 5 — subscription died permanently after 5 errors (network blips,
  // auth token refresh). Now 20 with longer backoff so even sustained outages recover.
  const MAX_RETRIES = 20;

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
            // CRITICAL FIX: Use docChanges() instead of iterating ALL docs.
            // Previously, every snapshot fire (including when _processed flag was set
            // by Cloud Function, or when delivery receipt fields were updated) sent
            // ALL messages (up to 100) to processCloudMessage. Each message ran through
            // dedup/receipt checks — O(N) waste per change. With docChanges(), we only
            // process actual additions and modifications, reducing processing from O(N)
            // to O(1) per message change. The initial snapshot still sends all docs
            // as type='added', ensuring no messages are missed on subscription setup.
            const changes = snapshot.docChanges();
            const messages: MessageData[] = [];
            for (const change of changes) {
              if (change.type === 'added' || change.type === 'modified') {
                messages.push({ ...change.doc.data(), id: change.doc.id } as MessageData);
              }
            }
            if (messages.length > 0) {
              callback(messages);
            }
          } catch (error) {
            logger.error('Error processing message snapshot:', error);
            onError?.(error);
          }
        },
        (error: any) => {
          if (isDisposed) return;
          if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
            logger.warn(`⚠️ Message subscription PERMISSION DENIED for conversation ${conversationId}. Will retry!`);
            // CRITICAL FIX: Do NOT return here. Continue to the retry block below.
          }
          logger.error('Message subscription error:', error);

          // Retry with exponential backoff
          if (retryCount >= MAX_RETRIES) {
            logger.error(`Message subscription exhausted retries for ${conversationId} — will recover on foreground resume`);
            onError?.(error);
            return;
          }
          retryCount++;
          const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 60000);
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

/**
 * Subscribe to legacy messages routed directly to devices/{deviceId}/messages.
 * This ensures backwards compatibility and offline (Mesh) fallback delivery.
 */
export async function subscribeToLegacyDeviceMessages(
  deviceId: string,
  callback: (messages: MessageData[]) => void,
  onError?: (error: any) => void,
  messageLimit: number = 100,
): Promise<(() => void) | null> {
  let isDisposed = false;
  let currentUnsub: (() => void) | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const MAX_RETRIES = 20;

  const cleanup = () => {
    isDisposed = true;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } currentUnsub = null; }
  };

  const startSnapshot = async (): Promise<boolean> => {
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db || isDisposed) return false;

      const messagesRef = collection(db, 'devices', deviceId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(messageLimit));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (isDisposed) return;
          retryCount = 0; // Reset on successful snapshot
          try {
            // CRITICAL FIX: Use docChanges() instead of iterating ALL docs.
            // Same optimization as subscribeToMessages — only process actual
            // additions and modifications, not the entire query result.
            const changes = snapshot.docChanges();
            const messages: MessageData[] = [];
            for (const change of changes) {
              if (change.type === 'added' || change.type === 'modified') {
                messages.push({ ...change.doc.data(), id: change.doc.id } as MessageData);
              }
            }
            if (messages.length > 0) {
              callback(messages);
            }
          } catch (error) {
            logger.error('Error processing legacy device message snapshot:', error);
            onError?.(error);
          }
        },
        (error: any) => {
          if (isDisposed) return;
          currentUnsub = null;
          const code = error?.code || '';
          if (code === 'permission-denied' || code === 'unauthenticated') {
            logger.error(`subscribeToLegacyDeviceMessages: permanent error (${code}) for ${deviceId}. Will retry!`);
            // CRITICAL FIX: Do NOT return here. Let the retry logic handle it.
          }
          logger.warn('subscribeToLegacyDeviceMessages: transient error, scheduling retry', error);
          onError?.(error);
          scheduleRetry();
        },
      );

      if (isDisposed) {
        try { unsubscribe(); } catch { /* no-op */ }
        return false;
      }

      if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } }
      currentUnsub = unsubscribe;
      logger.info(`✅ Subscribed to legacy device messages for: ${deviceId}`);
      return true;
    } catch (error: unknown) {
      if (isDisposed) return false;
      const code = getErrorCode(error);
      if (code === 'permission-denied') {
        logger.debug('Legacy device message subscription skipped (permission denied)');
        return false;
      }
      logger.warn('subscribeToLegacyDeviceMessages startSnapshot error:', error);
      onError?.(error);
      return false;
    }
  };

  const scheduleRetry = () => {
    if (isDisposed || retryCount >= MAX_RETRIES) {
      return;
    }
    retryCount++;
    const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 60000);
    logger.info(`Legacy message subscription retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      if (!isDisposed) {
        await startSnapshot();
      }
    }, delay);
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
    const q = query(threadsRef, orderBy('lastMessageAt', 'desc'), limit(100));

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
 * Uses retry-with-backoff for transient errors (network, unavailable).
 * Permanent errors (permission-denied, unauthenticated) abort immediately.
 */
export async function subscribeToInbox(
  uid: string,
  callback: (threads: UserInboxThread[]) => void,
  onError?: (error: any) => void,
): Promise<(() => void) | null> {
  let isDisposed = false;
  let currentUnsub: (() => void) | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const MAX_RETRIES = 20;

  const cleanup = () => {
    isDisposed = true;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } currentUnsub = null; }
  };

  const startSnapshot = async (): Promise<boolean> => {
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db || isDisposed) return false;

      const threadsRef = collection(db, 'user_inbox', uid, 'threads');
      const q = query(threadsRef, orderBy('lastMessageAt', 'desc'), limit(100));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (isDisposed) return;
          retryCount = 0; // Reset on successful snapshot
          try {
            const threads: UserInboxThread[] = [];
            snapshot.forEach((doc) => {
              threads.push({ ...doc.data(), conversationId: doc.id } as UserInboxThread);
            });
            callback(threads);
          } catch (error) {
            logger.error('Error processing inbox snapshot:', error);
            onError?.(error);
          }
        },
        (error: any) => {
          if (isDisposed) return;
          currentUnsub = null;
          const code = error?.code || '';
          if (code === 'permission-denied' || code === 'unauthenticated') {
            // FIX: Do NOT return — let retry logic handle it. On cold start,
            // Firebase Auth token may not be resolved yet → permission-denied.
            // Without retry, the inbox subscription dies permanently and conversation
            // list / unread counts never update from server.
            logger.error(`subscribeToInbox: auth error (${code}) for ${uid} — will retry`);
          } else {
            logger.warn('subscribeToInbox: transient error, scheduling retry', error);
          }
          onError?.(error);
          scheduleRetry();
        },
      );

      if (isDisposed) {
        try { unsubscribe(); } catch { /* no-op */ }
        return false;
      }

      if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } }
      currentUnsub = unsubscribe;
      logger.info(`✅ Subscribed to inbox: user_inbox/${uid}`);
      return true;
    } catch (error: unknown) {
      if (isDisposed) return false;
      const code = getErrorCode(error);
      if (code === 'permission-denied') {
        logger.debug('Inbox subscription skipped (permission denied)');
        return false;
      }
      logger.warn('subscribeToInbox startSnapshot error:', error);
      onError?.(error);
      return false;
    }
  };

  const scheduleRetry = () => {
    if (isDisposed || retryCount >= MAX_RETRIES) {
      if (retryCount >= MAX_RETRIES) {
        logger.error(`subscribeToInbox: exhausted ${MAX_RETRIES} retries for ${uid} — will recover on foreground resume`);
      }
      return;
    }
    retryCount++;
    const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 60000);
    logger.info(`subscribeToInbox: retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      if (!isDisposed) {
        await startSnapshot();
      }
    }, delay);
  };

  const success = await startSnapshot();
  if (!success && !isDisposed) {
    scheduleRetry();
  }

  return cleanup;
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
      // FIX: Use setDoc with merge instead of updateDoc. updateDoc throws NOT_FOUND
      // on conversations that don't exist yet (first message). setDoc with merge
      // creates the document if needed, matching WhatsApp behavior where typing
      // indicators work even before the first message is sent.
      await setDoc(convRef, { typing: { [uid]: serverTimestamp() } }, { merge: true });
    } else {
      // For clearing, updateDoc is safe — if the doc doesn't exist, there's
      // nothing to clear. Swallow NOT_FOUND silently.
      await updateDoc(convRef, { [`typing.${uid}`]: deleteField() }).catch(() => {});
    }
  } catch {
    // Non-critical — best effort
  }
}

/**
 * Subscribe to typing indicators for a conversation.
 * Returns unsubscribe function.
 * Callback receives map of uid -> timestamp (ms) of currently typing users.
 * Uses disposed flag to prevent race condition between async init and cleanup.
 */
export function subscribeToTyping(
  conversationId: string,
  myUid: string,
  callback: (typingUsers: Map<string, number>) => void,
): () => void {
  let disposed = false;
  let unsubscribe: (() => void) | null = null;

  (async () => {
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db || disposed) return;
      const convRef = doc(db, 'conversations', conversationId);
      const unsub = onSnapshot(convRef, (snap) => {
        if (disposed) return;
        const data = snap.data();
        const typing = data?.typing;
        const result = new Map<string, number>();
        if (typing && typeof typing === 'object') {
          const now = Date.now();
          for (const [uid, ts] of Object.entries(typing)) {
            if (uid === myUid) continue; // Skip self
            // Firestore Timestamp -> milliseconds
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

      if (disposed) {
        unsub();
        return;
      }
      unsubscribe = unsub;
    } catch {
      // Non-critical
    }
  })();

  return () => {
    disposed = true;
    unsubscribe?.();
  };
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
 * Uses disposed flag to prevent race condition between async init and cleanup.
 */
export function subscribeToLastSeen(
  uid: string,
  callback: (lastSeen: number | null) => void,
): () => void {
  let disposed = false;
  let unsubscribe: (() => void) | null = null;

  (async () => {
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db || disposed) return;
      const userRef = doc(db, 'users', uid);
      const unsub = onSnapshot(userRef, (snap) => {
        if (disposed) return;
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
        if (!disposed) callback(null);
      });

      if (disposed) {
        unsub();
        return;
      }
      unsubscribe = unsub;
    } catch {
      if (!disposed) callback(null);
    }
  })();

  return () => {
    disposed = true;
    unsubscribe?.();
  };
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

// ═══════════════════════════════════════════════════════════════
// MESSAGE EDITING — Firestore cloud edit for "edit for everyone"
// ═══════════════════════════════════════════════════════════════

/**
 * Update a message's content for everyone in a conversation.
 * Updates the message doc: content=newContent, isEdited=true, editedAt=serverTimestamp()
 */
export async function updateMessageContent(
  conversationId: string,
  messageId: string,
  newContent: string,
): Promise<boolean> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return false;
    const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(msgRef, {
      content: newContent,
      isEdited: true,
      editedAt: serverTimestamp(),
    });
    logger.info(`Message ${messageId} edited in ${conversationId}`);
    return true;
  } catch (error) {
    logger.warn('updateMessageContent failed:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE STATUS UPDATES — Delivery & Read Receipts (Double-tick)
// ═══════════════════════════════════════════════════════════════

/**
 * Mark a message as delivered.
 * Updates the message doc: status='delivered', delivered=true
 */
export async function markMessageAsDelivered(
  conversationId: string,
  messageId: string,
): Promise<boolean> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return false;
    const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    const receiptUid = getCurrentReceiptUid();

    // IDEMPOTENCY FIX: Only update if not already delivered/read.
    // Without this, every snapshot fire triggers a redundant Firestore write,
    // which wastes quota and triggers cascading snapshot events.
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) {
      // CRITICAL FIX: Document doesn't exist yet (replication lag or wrong conversationId).
      // updateDoc would throw NOT_FOUND. Return false so the retry-with-backoff caller
      // can try again later when the document is available.
      logger.debug(`markMessageAsDelivered: message ${messageId} not found in ${conversationId} — will retry`);
      return false;
    }

    const data = msgSnap.data() || {};
    const currentStatus = data.status;
    const deliveredTo = data.deliveredTo && typeof data.deliveredTo === 'object'
      ? data.deliveredTo as Record<string, unknown>
      : null;
    // FIX: Never regress read→delivered. If status is already 'read',
    // only proceed to add this user to deliveredTo (don't overwrite status).
    if (currentStatus === 'read') {
      // Status is already read — only add deliveredTo entry if missing
      if (!receiptUid || !!deliveredTo?.[receiptUid]) return true;
      // Add deliveredTo entry without changing status
      if (receiptUid) {
        await updateDoc(msgRef, { [`deliveredTo.${receiptUid}`]: serverTimestamp() });
      }
      return true;
    }
    if (
      currentStatus === 'delivered'
      && (!receiptUid || !!deliveredTo?.[receiptUid])
    ) {
      return true; // Already delivered with this user's receipt
    }

    const payload: Record<string, unknown> = {
      status: 'delivered',
      delivered: true,
      deliveredAt: serverTimestamp(),
    };
    if (receiptUid) {
      payload[`deliveredTo.${receiptUid}`] = serverTimestamp();
    }

    await updateDoc(msgRef, payload);
    logger.debug(`✓✓ Message ${messageId} marked as DELIVERED in ${conversationId}`);
    return true;
  } catch (error) {
    logger.warn('markMessageAsDelivered failed:', error);
    return false;
  }
}

/**
 * Mark a message as read.
 * Updates the message doc: status='read', read=true
 */
export async function markMessageAsRead(
  conversationId: string,
  messageId: string,
): Promise<boolean> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return false;
    const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    const receiptUid = getCurrentReceiptUid();

    // FIX: For group conversations, only update per-user readBy/deliveredTo fields.
    // Setting global `status: 'read'` in groups means ALL users see 'read' even if
    // they haven't opened the message yet. For DMs, global status is fine (2 participants).
    const isGroup = conversationId.startsWith('grp_');
    const payload: Record<string, unknown> = {};

    if (!isGroup) {
      // DM: safe to set global status
      payload.status = 'read';
      payload.read = true;
      payload.delivered = true;
      payload.readAt = serverTimestamp();
    }

    if (receiptUid) {
      payload[`readBy.${receiptUid}`] = serverTimestamp();
      payload[`deliveredTo.${receiptUid}`] = serverTimestamp();
    }

    if (Object.keys(payload).length === 0) return true; // nothing to write

    await updateDoc(msgRef, payload);
    logger.debug(`✓✓🔵 Message ${messageId} marked as READ in ${conversationId}`);
    return true;
  } catch (error) {
    logger.warn('markMessageAsRead failed:', error);
    return false;
  }
}
