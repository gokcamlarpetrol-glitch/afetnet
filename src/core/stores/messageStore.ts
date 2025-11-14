/**
 * MESSAGE STORE - Offline Messaging
 * Messages sent via BLE mesh network
 * Persistent storage with AsyncStorage + Firebase Firestore sync
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId } from '../../lib/device';
import { createLogger } from '../utils/logger';

const logger = createLogger('MessageStore');

// ELITE: Lazy import to break circular dependency
let firebaseDataService: any = null;
const getFirebaseDataService = () => {
  if (!firebaseDataService) {
    firebaseDataService = require('../services/FirebaseDataService').firebaseDataService;
  }
  return firebaseDataService;
};

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  delivered: boolean;
  read: boolean;
}

export interface Conversation {
  userId: string;
  userName: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
}

interface MessageState {
  messages: Message[];
  conversations: Conversation[];
  // ELITE: Store Firebase unsubscribe function for cleanup
  firebaseUnsubscribe: (() => void) | null;
}

export interface MessageActions {
  initialize: () => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  addConversation: (conversation: Conversation) => Promise<void>;
  markAsDelivered: (messageId: string) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  markConversationRead: (userId: string) => Promise<void>;
  getConversationMessages: (userId: string) => Message[];
  updateConversations: () => void;
  deleteConversation: (userId: string) => Promise<void>;
  clear: () => Promise<void>;
}

const STORAGE_KEY_MESSAGES = '@afetnet:messages';
const STORAGE_KEY_CONVERSATIONS = '@afetnet:conversations';

const initialState: MessageState = {
  messages: [],
  conversations: [],
  firebaseUnsubscribe: null,
};

// ELITE: Load messages from AsyncStorage
const loadMessages = async (): Promise<Message[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY_MESSAGES);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Failed to load messages:', error);
  }
  return [];
};

// ELITE: Save messages to AsyncStorage
const saveMessages = async (messages: Message[]) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  } catch (error) {
    logger.error('Failed to save messages:', error);
  }
};

// ELITE: Load conversations from AsyncStorage
const loadConversations = async (): Promise<Conversation[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY_CONVERSATIONS);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Failed to load conversations:', error);
  }
  return [];
};

// ELITE: Save conversations to AsyncStorage
const saveConversations = async (conversations: Conversation[]) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(conversations));
  } catch (error) {
    logger.error('Failed to save conversations:', error);
  }
};

export const useMessageStore = create<MessageState & MessageActions>((set, get) => ({
  ...initialState,
  
  // ELITE: Initialize by loading from storage and Firebase
  initialize: async () => {
    // ELITE: Cleanup existing Firebase subscription before re-initializing
    const { firebaseUnsubscribe } = get();
    if (firebaseUnsubscribe && typeof firebaseUnsubscribe === 'function') {
      try {
        firebaseUnsubscribe();
      } catch (error) {
        if (__DEV__) {
          logger.debug('Error unsubscribing from old Firebase message subscription:', error);
        }
      }
      set({ firebaseUnsubscribe: null });
    }

    // First load from AsyncStorage (fast)
    const localMessages = await loadMessages();
    const localConversations = await loadConversations();
    set({ messages: localMessages, conversations: localConversations });

    // Then try to sync from Firebase (lazy load to avoid circular dependency)
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        const firebaseService = getFirebaseDataService();
        if (firebaseService?.isInitialized) {
          // Load messages from Firebase
          const cloudMessages = await firebaseService.loadMessages?.(deviceId);
          const cloudConversations = await firebaseService.loadConversations?.(deviceId);
          
          // Merge: Firebase takes precedence if both exist
          if (cloudMessages && cloudMessages.length > 0) {
            set({ messages: cloudMessages });
            await saveMessages(cloudMessages);
          }
          if (cloudConversations && cloudConversations.length > 0) {
            set({ conversations: cloudConversations });
            await saveConversations(cloudConversations);
          }

          // ELITE: Subscribe to real-time message updates (CRITICAL - instant delivery)
          // Gracefully handle permission errors - app continues with BLE mesh
          const unsubscribe = await firebaseService.subscribeToMessages?.(
            deviceId,
            async (firebaseMessages) => {
              try {
                // ELITE: Merge Firebase messages with local state
                const currentMessages = get().messages;
                const messageMap = new Map(currentMessages.map(m => [m.id, m]));
                
                // Update or add Firebase messages
                firebaseMessages.forEach((msg: any) => {
                  if (msg && msg.id) {
                    messageMap.set(msg.id, msg);
                  }
                });
                
                const mergedMessages = Array.from(messageMap.values());
                set({ messages: mergedMessages });
                await saveMessages(mergedMessages);
                
                // ELITE: Send instant notification for new messages
                const newMessages = firebaseMessages.filter((fm: any) => 
                  !currentMessages.some(m => m.id === fm.id)
                );
                
                for (const newMsg of newMessages) {
                  if (newMsg && newMsg.from && newMsg.from !== 'me' && newMsg.content) {
                    try {
                      const { notificationService } = await import('../services/NotificationService');
                      await notificationService.showMessageNotification(
                        newMsg.from || 'Bilinmeyen',
                        newMsg.content,
                        newMsg.id,
                        newMsg.from,
                        newMsg.priority || 'normal'
                      );
                    } catch (notifError) {
                      logger.error('Failed to send Firebase message notification:', notifError);
                    }
                  }
                }
                
                // Update conversations
                get().updateConversations();
              } catch (error) {
                logger.error('Error processing real-time messages:', error);
              }
            },
            (error: unknown) => {
              // ELITE: Don't log permission errors as errors - they're expected in offline-first apps
              const errorObj = error as { code?: string; message?: string };
              if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permission') || errorObj?.message?.includes('Missing or insufficient permissions')) {
                if (__DEV__) {
                  logger.debug('Firebase message subscription permission denied (app continues with BLE mesh)');
                }
                return; // Silent fail - app continues with offline messaging
              }
              logger.error('Firebase message subscription error:', error);
            }
          );
          
          // ELITE: Store unsubscribe function for cleanup
          if (unsubscribe && typeof unsubscribe === 'function') {
            set({ firebaseUnsubscribe: unsubscribe });
          }
        }
      }
    } catch (error) {
      logger.error('Firebase sync failed, using local data:', error);
    }
  },
  
  addMessage: async (message: Message) => {
    set((state) => ({ messages: [...state.messages, message] }));
    get().updateConversations();
    
    // ELITE: Save to AsyncStorage
    const { messages } = get();
    await saveMessages(messages);
    
    // CRITICAL: Save to Firebase in real-time
    // ELITE: This ensures messages are synced to Firebase instantly for emergency communication
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        const firebaseService = getFirebaseDataService();
        if (firebaseService?.isInitialized) {
          // ELITE: Save message to Firebase (fire and forget - don't block UI)
          firebaseService.saveMessage(deviceId, {
            id: message.id,
            text: message.content || message.from || '',
            userId: message.from,
            timestamp: message.timestamp,
            type: 'text',
            read: message.read || false,
          }).catch((error) => {
            // ELITE: Message save failures are logged but don't block app
            logger.error('Failed to save message to Firebase:', error);
          });
        }
      }
    } catch (error) {
      // ELITE: Firebase save is optional - app continues without it
      logger.error('Failed to save message to Firebase:', error);
    }

    // CRITICAL: Send to backend for rescue coordination
    // ELITE: This ensures rescue teams can access emergency messages
    try {
      const { backendEmergencyService } = await import('../services/BackendEmergencyService');
      if (backendEmergencyService.initialized) {
        const isEmergency = message.content.toLowerCase().includes('sos') ||
                          message.content.toLowerCase().includes('acil') ||
                          message.content.toLowerCase().includes('yardım') ||
                          message.content.toLowerCase().includes('kurtar');
        
        await backendEmergencyService.sendEmergencyMessage({
          messageId: message.id,
          content: message.content,
          timestamp: message.timestamp,
          type: 'text',
          priority: isEmergency ? 'critical' : 'normal',
          recipientDeviceId: message.to !== 'me' ? message.to : undefined,
        }).catch((error) => {
          // ELITE: Backend save failures are logged but don't block app
          logger.error('Failed to send message to backend:', error);
        });
      }
    } catch (error) {
      // ELITE: Backend save is optional - app continues without it
      logger.error('Failed to send message to backend:', error);
    }
  },
  addConversation: async (conversation: Conversation) => {
    set((state) => {
      const exists = state.conversations.find(c => c.userId === conversation.userId);
      if (exists) {
        return state; // Don't add duplicate
      }
      // Ensure lastMessageTime is set
      const conv: Conversation = {
        ...conversation,
        lastMessageTime: conversation.lastMessageTime || Date.now(),
      };
      return { 
        conversations: [...state.conversations, conv]
      };
    });
    
    // ELITE: Save to AsyncStorage
    const { conversations } = get();
    await saveConversations(conversations);
    
    // ELITE: Save to Firebase
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        const firebaseService = getFirebaseDataService();
        if (firebaseService?.isInitialized) {
          await firebaseService.saveConversation?.(deviceId, conversation).catch((error) => {
            logger.error('Failed to save conversation to Firebase:', error);
          });
        }
      }
    } catch (error) {
      logger.error('Failed to save conversation:', error);
    }
  },
  markAsDelivered: async (messageId: string) => {
    set((state) => ({
      messages: state.messages.map(m => m.id === messageId ? { ...m, delivered: true } : m)
    }));
    
    // ELITE: Save to AsyncStorage
    const { messages } = get();
    await saveMessages(messages);
  },
  markAsRead: async (messageId: string) => {
    set((state) => ({
      messages: state.messages.map(m => m.id === messageId ? { ...m, read: true } : m)
    }));
    get().updateConversations();
    
    // ELITE: Save to AsyncStorage
    const { messages } = get();
    await saveMessages(messages);
  },
  markConversationRead: async (userId: string) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.from === userId ? { ...m, read: true } : m
      ),
    }));
    get().updateConversations();
    
    // ELITE: Save to AsyncStorage
    const { messages } = get();
    await saveMessages(messages);
  },
  getConversationMessages: (userId: string) => {
    return get().messages.filter(
      (m) => (m.from === userId && m.to === 'me') || (m.from === 'me' && m.to === userId)
    );
  },
  updateConversations: () => {
    const { messages } = get();
    const conversationMap = new Map<string, Conversation>();
    messages.forEach(msg => {
      const otherUserId = msg.from === 'me' ? msg.to : msg.from;
      const existing = conversationMap.get(otherUserId);
      if (!existing || msg.timestamp > existing.lastMessageTime) {
        const unreadCount = messages.filter(
          m => m.from === otherUserId && !m.read
        ).length;
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: otherUserId,
          lastMessage: msg.content.substring(0, 100), // ELITE: Limit preview length
          lastMessageTime: msg.timestamp,
          unreadCount,
        });
      }
    });
    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    set({ conversations });
    
    // ELITE: Save conversations to AsyncStorage (fire and forget, but log errors)
    saveConversations(conversations).catch((error) => {
      logger.error('Failed to save conversations:', error);
    });
  },
  deleteConversation: async (userId: string) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.userId !== userId),
      messages: state.messages.filter((m) => m.from !== userId && m.to !== userId),
    }));
    
    // ELITE: Save to AsyncStorage
    const { messages, conversations } = get();
    await saveMessages(messages);
    await saveConversations(conversations);
    
    // ELITE: Delete from Firebase
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        const firebaseService = getFirebaseDataService();
        if (firebaseService?.isInitialized) {
          await firebaseService.deleteConversation?.(deviceId, userId).catch((error) => {
            logger.error('Failed to delete conversation from Firebase:', error);
          });
        }
      }
    } catch (error) {
      logger.error('Failed to delete conversation:', error);
    }
  },
  clear: async () => {
    // ELITE: Cleanup Firebase subscription before clearing
    const { firebaseUnsubscribe } = get();
    if (firebaseUnsubscribe && typeof firebaseUnsubscribe === 'function') {
      try {
        firebaseUnsubscribe();
      } catch (error) {
        logger.error('Error unsubscribing from Firebase messages:', error);
      }
    }
    
    set({ ...initialState, firebaseUnsubscribe: null });
    await saveMessages([]);
    await saveConversations([]);
  },
}));

