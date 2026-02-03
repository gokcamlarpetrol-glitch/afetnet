/**
 * FIREBASE MESSAGE OPERATIONS - ELITE MODULAR
 * Handles message and conversation Firestore operations
 * ELITE: Includes retry mechanism, timeout protection, and Turkish localization
 */

import { doc, setDoc, getDocs, deleteDoc, collection, onSnapshot, FirestoreError } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { retryWithBackoff } from '../../utils/retry';
import { MessageData, ConversationData } from '../../types/firebase';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';

const logger = createLogger('FirebaseMessageOperations');
const TIMEOUT_MS = 10000; // 10 seconds
const RETRY_CONFIG = { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 5000 };

// ELITE: Type-safe error helpers
const getErrorMessage = (e: unknown): string => e instanceof Error ? e.message : String(e);
const getErrorCode = (e: unknown): string | undefined =>
  e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : undefined;

/** Message with update timestamp */
interface MessageWithTimestamp extends MessageData {
  updatedAt?: string;
}

/** Conversation with update timestamp */
interface ConversationWithTimestamp {
  userId: string;
  lastMessage?: MessageData;
  lastMessageTime?: number;
  unreadCount?: number;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
}

/**
 * Execute Firestore operation with timeout protection
 */
async function withTimeout<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operationName} zaman aşımı`)), TIMEOUT_MS),
  );

  return Promise.race([operation(), timeoutPromise]);
}

/**
 * Handle Firestore errors gracefully
 */
function handleFirestoreError(error: unknown, operationName: string): boolean {
  const firestoreError = error as FirestoreError & { message?: string };
  const errorMessage = firestoreError?.message || String(error);

  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout') || errorMessage.includes('zaman aşımı')) {
    if (__DEV__) {
      logger.debug(`${operationName} zaman aşımı (zayıf ağ koşullarında beklenir)`);
    }
    return false;
  }

  if (firestoreError?.code === 'permission-denied' || errorMessage.includes('permission') || errorMessage.includes('Missing or insufficient permissions')) {
    if (__DEV__) {
      logger.debug(`${operationName} atlandı (izin reddedildi - BLE mesh ile devam)`);
    }
    return false;
  }

  logger.error(`${operationName} başarısız:`, error);
  return false;
}

/**
 * Save message to Firestore with retry
 */
export async function saveMessage(
  userDeviceId: string,
  message: MessageData,
  isInitialized: boolean,
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('Firebase başlatılmadı, mesaj kaydetme atlanıyor');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore kullanılamıyor');
      return false;
    }

    const messageRef = doc(db, 'devices', userDeviceId, 'messages', message.id);

    await retryWithBackoff(
      () => withTimeout(
        () => setDoc(messageRef, {
          ...message,
          updatedAt: new Date().toISOString(),
        } as MessageWithTimestamp, { merge: true }),
        'Mesaj kaydetme',
      ),
      RETRY_CONFIG,
    );

    if (__DEV__) {
      logger.info(`Mesaj ${message.id} Firestore'a kaydedildi`);
    }
    return true;
  } catch (error: unknown) {
    return handleFirestoreError(error, 'saveMessage');
  }
}

/**
 * Load messages from Firestore with retry
 */
export async function loadMessages(
  userDeviceId: string,
  isInitialized: boolean,
): Promise<MessageData[]> {
  if (!isInitialized) {
    logger.warn('Firebase başlatılmadı, mesajlar yüklenemiyor');
    return [];
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore kullanılamıyor');
      return [];
    }

    const messagesRef = collection(db, 'devices', userDeviceId, 'messages');

    const snapshot = await retryWithBackoff(
      () => withTimeout(
        () => getDocs(messagesRef),
        'Mesajları yükleme',
      ),
      RETRY_CONFIG,
    );

    const messages: MessageData[] = [];
    snapshot.forEach((doc) => {
      messages.push(doc.data() as MessageData);
    });

    if (__DEV__) {
      logger.info(`Firestore'dan ${messages.length} mesaj yüklendi`);
    }
    return messages;
  } catch (error: unknown) {
    handleFirestoreError(error, 'loadMessages');
    return [];
  }
}

/**
 * Subscribe to real-time message updates
 */
export async function subscribeToMessages(
  userDeviceId: string,
  callback: (messages: any[]) => void,
  onError?: (error: any) => void,
  isInitialized: boolean = false,
): Promise<(() => void) | null> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot subscribe to messages');
    return null;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available for message subscription');
      return null;
    }

    const messagesRef = collection(db, 'devices', userDeviceId, 'messages');

    const unsubscribe = onSnapshot(
      messagesRef,
      (snapshot) => {
        try {
          const messages: any[] = [];
          snapshot.forEach((doc) => {
            messages.push(doc.data());
          });

          if (__DEV__) {
            logger.info(`Real-time message update: ${messages.length} messages`);
          }

          callback(messages);
        } catch (error) {
          logger.error('Error processing message snapshot:', error);
          if (onError) {
            onError(error);
          }
        }
      },
      (error: any) => {
        if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Missing or insufficient permissions')) {
          if (__DEV__) {
            logger.debug('Message subscription skipped (permission denied - Firebase rules may restrict access, app continues with BLE mesh)');
          }
          return;
        }
        logger.error('Message subscription error:', error);
        if (onError) {
          onError(error);
        }
      },
    );

    if (__DEV__) {
      logger.info(`✅ Subscribed to real-time messages for device: ${userDeviceId}`);
    }

    return unsubscribe;
  } catch (error: unknown) {
    const errCode = getErrorCode(error);
    const errMsg = getErrorMessage(error);
    if (errCode === 'permission-denied' || errMsg.includes('permission') || errMsg.includes('Missing or insufficient permissions')) {
      if (__DEV__) {
        logger.debug('Message subscription setup skipped (permission denied - app continues with BLE mesh)');
      }
      return null;
    }
    logger.error('Failed to subscribe to messages:', error);
    if (onError) {
      onError(error);
    }
    return null;
  }
}

/**
 * Save conversation to Firestore
 */
export async function saveConversation(
  userDeviceId: string,
  conversation: any,
  isInitialized: boolean,
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping saveConversation');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    const conversationRef = doc(db, 'devices', userDeviceId, 'conversations', conversation.userId);

    await withTimeout(
      () => setDoc(conversationRef, {
        ...conversation,
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'Conversation save',
    );

    if (__DEV__) {
      logger.info(`✅ Conversation ${conversation.userId} saved to Firestore`);
    }
    return true;
  } catch (error: unknown) {
    return handleFirestoreError(error, 'saveConversation');
  }
}

/**
 * Load conversations from Firestore
 */
export async function loadConversations(
  userDeviceId: string,
  isInitialized: boolean,
): Promise<any[]> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot load conversations');
    return [];
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return [];
    }

    const conversationsRef = collection(db, 'devices', userDeviceId, 'conversations');

    const snapshot = await withTimeout(
      () => getDocs(conversationsRef),
      'Conversations load',
    );

    const conversations: any[] = [];
    snapshot.forEach((doc) => {
      conversations.push(doc.data());
    });

    if (__DEV__) {
      logger.info(`Loaded ${conversations.length} conversations from Firestore`);
    }
    return conversations;
  } catch (error: unknown) {
    handleFirestoreError(error, 'loadConversations');
    return [];
  }
}

/**
 * Delete conversation from Firestore
 */
export async function deleteConversation(
  userDeviceId: string,
  userId: string,
  isInitialized: boolean,
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping deleteConversation');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    const conversationRef = doc(db, 'devices', userDeviceId, 'conversations', userId);

    await withTimeout(
      () => deleteDoc(conversationRef),
      'Conversation delete',
    );

    if (__DEV__) {
      logger.info(`Conversation ${userId} deleted from Firestore`);
    }
    return true;
  } catch (error: unknown) {
    return handleFirestoreError(error, 'deleteConversation');
  }
}









