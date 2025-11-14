/**
 * FIREBASE MESSAGE OPERATIONS - ELITE MODULAR
 * Handles message and conversation Firestore operations
 */

import { doc, setDoc, getDocs, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';

const logger = createLogger('FirebaseMessageOperations');
const TIMEOUT_MS = 10000; // 10 seconds

/**
 * Execute Firestore operation with timeout protection
 */
async function withTimeout<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operationName} timeout`)), TIMEOUT_MS)
  );
  
  return Promise.race([operation(), timeoutPromise]);
}

/**
 * Handle Firestore errors gracefully
 */
function handleFirestoreError(error: any, operationName: string): boolean {
  const errorMessage = error?.message || String(error);
  
  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    if (__DEV__) {
      logger.debug(`${operationName} timed out (expected in poor network conditions)`);
    }
    return false;
  }
  
  if (error?.code === 'permission-denied' || errorMessage.includes('permission') || errorMessage.includes('Missing or insufficient permissions')) {
    if (__DEV__) {
      logger.debug(`${operationName} skipped (permission denied - app continues with local storage)`);
    }
    return false;
  }
  
  logger.error(`Failed ${operationName}:`, error);
  return false;
}

/**
 * Save message to Firestore
 */
export async function saveMessage(
  userDeviceId: string,
  message: any,
  isInitialized: boolean
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping saveMessage');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    const messageRef = doc(db, 'devices', userDeviceId, 'messages', message.id);
    
    await withTimeout(
      () => setDoc(messageRef, {
        ...message,
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'Message save'
    );

    if (__DEV__) {
      logger.info(`Message ${message.id} saved to Firestore`);
    }
    return true;
  } catch (error: any) {
    return handleFirestoreError(error, 'saveMessage');
  }
}

/**
 * Load messages from Firestore
 */
export async function loadMessages(
  userDeviceId: string,
  isInitialized: boolean
): Promise<any[]> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot load messages');
    return [];
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return [];
    }

    const messagesRef = collection(db, 'devices', userDeviceId, 'messages');
    
    const snapshot = await withTimeout(
      () => getDocs(messagesRef),
      'Messages load'
    );
    
    const messages: any[] = [];
    snapshot.forEach((doc) => {
      messages.push(doc.data());
    });

    if (__DEV__) {
      logger.info(`Loaded ${messages.length} messages from Firestore`);
    }
    return messages;
  } catch (error: any) {
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
  isInitialized: boolean = false
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
      }
    );

    if (__DEV__) {
      logger.info(`✅ Subscribed to real-time messages for device: ${userDeviceId}`);
    }

    return unsubscribe;
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Missing or insufficient permissions')) {
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
  isInitialized: boolean
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
      'Conversation save'
    );

    if (__DEV__) {
      logger.info(`✅ Conversation ${conversation.userId} saved to Firestore`);
    }
    return true;
  } catch (error: any) {
    return handleFirestoreError(error, 'saveConversation');
  }
}

/**
 * Load conversations from Firestore
 */
export async function loadConversations(
  userDeviceId: string,
  isInitialized: boolean
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
      'Conversations load'
    );
    
    const conversations: any[] = [];
    snapshot.forEach((doc) => {
      conversations.push(doc.data());
    });

    if (__DEV__) {
      logger.info(`Loaded ${conversations.length} conversations from Firestore`);
    }
    return conversations;
  } catch (error: any) {
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
  isInitialized: boolean
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
      'Conversation delete'
    );

    if (__DEV__) {
      logger.info(`Conversation ${userId} deleted from Firestore`);
    }
    return true;
  } catch (error: any) {
    return handleFirestoreError(error, 'deleteConversation');
  }
}









