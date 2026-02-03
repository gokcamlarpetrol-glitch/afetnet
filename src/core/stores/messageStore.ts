/**
 * MESSAGE STORE - Offline Messaging
 * Messages sent via BLE mesh network
 * Persistent storage with AsyncStorage + Firebase Firestore sync
 */

import { create } from 'zustand';
import { DirectStorage } from '../utils/storage';
import { getDeviceId } from '../utils/device';
import { createLogger } from '../utils/logger';
import { safeLowerCase, safeIncludes } from '../utils/safeString';

const logger = createLogger('MessageStore');

// ELITE: Type definition for lazy imported FirebaseDataService
interface FirebaseDataServiceType {
  isInitialized: boolean;
  loadMessages?: (deviceId: string) => Promise<Message[]>;
  loadConversations?: (deviceId: string) => Promise<Conversation[]>;
  subscribeToMessages?: (
    deviceId: string,
    callback: (messages: Message[]) => void,
    onError?: (error: Error) => void
  ) => Promise<(() => void) | null>;
  saveMessage: (deviceId: string, message: Record<string, unknown>) => Promise<boolean>;
  saveConversation?: (deviceId: string, conversation: Conversation) => Promise<boolean>;
  deleteConversation?: (deviceId: string, userId: string) => Promise<boolean>;
}

// ELITE: Lazy import to break circular dependency
let firebaseDataService: FirebaseDataServiceType | null = null;
const getFirebaseDataService = (): FirebaseDataServiceType | null => {
  if (!firebaseDataService) {
    try {
      firebaseDataService = require('../services/FirebaseDataService').firebaseDataService;
    } catch {
      return null;
    }
  }
  return firebaseDataService;
};

export interface Message {
  id: string;
  localId?: string; // ELITE: Client-side ID for optimistic UI
  from: string;
  fromName?: string; // ELITE: Display name
  to: string;
  content: string;
  timestamp: number;
  delivered: boolean;
  read: boolean;
  type?: 'CHAT' | 'SOS' | 'STATUS' | 'LOCATION' | 'VOICE';
  priority?: 'critical' | 'high' | 'normal';
  // ELITE: Enhanced delivery tracking
  status?: 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  retryCount?: number;
  lastRetryAt?: number;
  // ELITE: Threading
  replyTo?: string;
  replyPreview?: string;
  // ELITE: Message editing
  isEdited?: boolean;
  editedAt?: number;
  originalContent?: string;
  editHistory?: { content: string; editedAt: number }[];
  // ELITE: Message deletion
  isDeleted?: boolean;
  deletedAt?: number;
}

export interface Conversation {
  userId: string;
  userName: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  // ELITE: Enhanced conversation metadata
  isTyping?: boolean;
  lastSeen?: number;
  isPinned?: boolean;
  isMuted?: boolean;
  status?: 'online' | 'offline' | 'mesh'; // Connection status
}

// ELITE: Typing indicator state
export interface TypingIndicator {
  userId: string;
  userName?: string;
  conversationId: string;
  timestamp: number;
}

interface MessageState {
  messages: Message[];
  conversations: Conversation[];
  // ELITE: Pending messages queue for retry
  sendingQueue: Message[];
  // ELITE: Typing indicators by conversation
  typingUsers: Record<string, TypingIndicator>;
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
  // ELITE: Enhanced actions
  updateMessageStatus: (messageId: string, status: Message['status']) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  setTyping: (conversationId: string, userId: string, userName?: string) => void;
  clearTyping: (conversationId: string) => void;
  getUnreadCount: () => number;
  pinConversation: (userId: string, isPinned: boolean) => Promise<void>;
  muteConversation: (userId: string, isMuted: boolean) => Promise<void>;
  // ELITE: Message edit/delete/forward
  editMessage: (messageId: string, newContent: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  forwardMessage: (messageId: string, toUserId: string) => Promise<Message | null>;
  getMessage: (messageId: string) => Message | undefined;
}

const STORAGE_KEY_MESSAGES = '@afetnet:messages';
const STORAGE_KEY_CONVERSATIONS = '@afetnet:conversations';

const initialState: MessageState = {
  messages: [],
  conversations: [],
  sendingQueue: [],
  typingUsers: {},
  firebaseUnsubscribe: null,
};

// ELITE: Load messages from MMKV (Sync & Fast)
const loadMessages = (): Message[] => {
  try {
    const data = DirectStorage.getString(STORAGE_KEY_MESSAGES);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Failed to load messages:', error);
  }
  return [];
};

// ELITE: Save messages to MMKV (Sync & Fast)
const saveMessages = (messages: Message[]) => {
  try {
    DirectStorage.setString(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  } catch (error) {
    logger.error('Failed to save messages:', error);
  }
};

// ELITE: Load conversations from MMKV
const loadConversations = (): Conversation[] => {
  try {
    const data = DirectStorage.getString(STORAGE_KEY_CONVERSATIONS);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Failed to load conversations:', error);
  }
  return [];
};

// ELITE: Save conversations to MMKV
const saveConversations = (conversations: Conversation[]) => {
  try {
    DirectStorage.setString(STORAGE_KEY_CONVERSATIONS, JSON.stringify(conversations));
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

    // First load from MMKV (Instant)
    const localMessages = loadMessages();
    const localConversations = loadConversations();
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
            saveMessages(cloudMessages);
          }
          if (cloudConversations && cloudConversations.length > 0) {
            set({ conversations: cloudConversations });
            saveConversations(cloudConversations);
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
                firebaseMessages.forEach((msg: Message) => {
                  if (msg && msg.id) {
                    messageMap.set(msg.id, msg);
                  }
                });

                const mergedMessages = Array.from(messageMap.values());
                set({ messages: mergedMessages });
                saveMessages(mergedMessages);

                // ELITE: Send instant notification for new messages
                const newMessages = firebaseMessages.filter((fm: Message) =>
                  !currentMessages.some(m => m.id === fm.id),
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
                        newMsg.priority || 'normal',
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
            },
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
    // ELITE: Compliance - Blocked User Check
    const { blockedUsers } = require('./settingsStore').useSettingsStore.getState();
    if (blockedUsers.includes(message.from)) {
      if (__DEV__) logger.debug('Message blocked from:', message.from);
      return;
    }

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
        const content = message.content || '';
        const isEmergency = safeIncludes(content, 'sos') ||
          safeIncludes(content, 'acil') ||
          safeIncludes(content, 'yardım') ||
          safeIncludes(content, 'kurtar');

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
        conversations: [...state.conversations, conv],
      };
    });

    // ELITE: Save to MMKV
    const { conversations } = get();
    saveConversations(conversations);

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
      messages: state.messages.map(m => m.id === messageId ? { ...m, delivered: true } : m),
    }));

    // ELITE: Save to AsyncStorage
    const { messages } = get();
    await saveMessages(messages);
  },
  markAsRead: async (messageId: string) => {
    set((state) => ({
      messages: state.messages.map(m => m.id === messageId ? { ...m, read: true } : m),
    }));
    get().updateConversations();

    // ELITE: Save to AsyncStorage
    const { messages } = get();
    await saveMessages(messages);
  },
  markConversationRead: async (userId: string) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.from === userId ? { ...m, read: true } : m,
      ),
    }));
    get().updateConversations();

    // ELITE: Save to AsyncStorage
    const { messages } = get();
    await saveMessages(messages);
  },
  getConversationMessages: (userId: string) => {
    return get().messages.filter(
      (m) => (m.from === userId && m.to === 'me') || (m.from === 'me' && m.to === userId),
    );
  },
  updateConversations: () => {
    const { messages } = get();
    // ELITE: Compliance - Filter blocked users
    const { blockedUsers } = require('./settingsStore').useSettingsStore.getState();

    const conversationMap = new Map<string, Conversation>();
    messages.forEach(msg => {
      // Skip blocked users
      if (blockedUsers.includes(msg.from) || blockedUsers.includes(msg.to)) {
        return;
      }

      const otherUserId = msg.from === 'me' ? msg.to : msg.from;
      const existing = conversationMap.get(otherUserId);
      if (!existing || msg.timestamp > existing.lastMessageTime) {
        const unreadCount = messages.filter(
          m => m.from === otherUserId && !m.read,
        ).length;
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: otherUserId,
          lastMessage: (msg.content || '').substring(0, 100), // ELITE: Limit preview length
          lastMessageTime: msg.timestamp,
          unreadCount,
        });
      }
    });
    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    set({ conversations });

    // ELITE: Save conversations to MMKV
    saveConversations(conversations);
  },
  deleteConversation: async (userId: string) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.userId !== userId),
      messages: state.messages.filter((m) => m.from !== userId && m.to !== userId),
    }));

    // ELITE: Save to MMKV
    const { messages, conversations } = get();
    saveMessages(messages);
    saveConversations(conversations);

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
    saveMessages([]);
    saveConversations([]);
  },

  // ELITE: Update message status
  updateMessageStatus: async (messageId: string, status: Message['status']) => {
    set((state) => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, status, delivered: status === 'delivered' || status === 'read' } : m
      ),
    }));
    const { messages } = get();
    saveMessages(messages);
  },

  // ELITE: Retry failed message
  retryMessage: async (messageId: string) => {
    const { messages, sendingQueue } = get();
    const failedMsg = messages.find(m => m.id === messageId && m.status === 'failed');

    if (failedMsg) {
      // Update status to pending and add to sending queue
      const updatedMsg = {
        ...failedMsg,
        status: 'pending' as const,
        retryCount: (failedMsg.retryCount || 0) + 1,
        lastRetryAt: Date.now(),
      };

      set((state) => ({
        messages: state.messages.map(m => m.id === messageId ? updatedMsg : m),
        sendingQueue: [...state.sendingQueue, updatedMsg],
      }));

      saveMessages(get().messages);
      logger.info(`Retrying message ${messageId}, attempt ${updatedMsg.retryCount}`);
    }
  },

  // ELITE: Set typing indicator
  setTyping: (conversationId: string, userId: string, userName?: string) => {
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: { userId, userName, conversationId, timestamp: Date.now() },
      },
    }));

    // Auto-clear typing after 5 seconds
    setTimeout(() => {
      const { typingUsers } = get();
      if (typingUsers[conversationId]?.timestamp && Date.now() - typingUsers[conversationId].timestamp >= 5000) {
        get().clearTyping(conversationId);
      }
    }, 5000);
  },

  // ELITE: Clear typing indicator
  clearTyping: (conversationId: string) => {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.typingUsers;
      return { typingUsers: rest };
    });
  },

  // ELITE: Get total unread count across all conversations
  getUnreadCount: () => {
    const { conversations } = get();
    return conversations.reduce((total, conv) => total + conv.unreadCount, 0);
  },

  // ELITE: Pin/Unpin conversation
  pinConversation: async (userId: string, isPinned: boolean) => {
    set((state) => ({
      conversations: state.conversations.map(c =>
        c.userId === userId ? { ...c, isPinned } : c
      ).sort((a, b) => {
        // Pinned conversations first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.lastMessageTime - a.lastMessageTime;
      }),
    }));
    saveConversations(get().conversations);
  },

  // ELITE: Mute/Unmute conversation
  muteConversation: async (userId: string, isMuted: boolean) => {
    set((state) => ({
      conversations: state.conversations.map(c =>
        c.userId === userId ? { ...c, isMuted } : c
      ),
    }));
    saveConversations(get().conversations);
  },

  // ELITE: Edit message
  editMessage: async (messageId: string, newContent: string) => {
    const { messages } = get();
    const message = messages.find(m => m.id === messageId);

    if (!message) {
      logger.warn(`Message ${messageId} not found for editing`);
      return false;
    }

    // Only allow editing own messages
    if (message.from !== 'me') {
      logger.warn('Cannot edit messages from other users');
      return false;
    }

    // Don't edit deleted messages
    if (message.isDeleted) {
      logger.warn('Cannot edit deleted messages');
      return false;
    }

    const now = Date.now();
    const editEntry = { content: message.content, editedAt: now };

    set((state) => ({
      messages: state.messages.map(m =>
        m.id === messageId
          ? {
            ...m,
            content: newContent,
            isEdited: true,
            editedAt: now,
            originalContent: m.originalContent || m.content,
            editHistory: [...(m.editHistory || []), editEntry],
          }
          : m
      ),
    }));

    saveMessages(get().messages);
    get().updateConversations();

    logger.info(`Edited message ${messageId}`);
    return true;
  },

  // ELITE: Delete message (soft delete)
  deleteMessage: async (messageId: string) => {
    const { messages } = get();
    const message = messages.find(m => m.id === messageId);

    if (!message) {
      logger.warn(`Message ${messageId} not found for deletion`);
      return false;
    }

    // Only allow deleting own messages
    if (message.from !== 'me') {
      logger.warn('Cannot delete messages from other users');
      return false;
    }

    const now = Date.now();

    set((state) => ({
      messages: state.messages.map(m =>
        m.id === messageId
          ? {
            ...m,
            isDeleted: true,
            deletedAt: now,
            content: 'Bu mesaj silindi', // Replace content for privacy
          }
          : m
      ),
    }));

    saveMessages(get().messages);
    get().updateConversations();

    logger.info(`Deleted message ${messageId}`);
    return true;
  },

  // ELITE: Forward message to another user
  forwardMessage: async (messageId: string, toUserId: string) => {
    const { messages } = get();
    const originalMessage = messages.find(m => m.id === messageId);

    if (!originalMessage) {
      logger.warn(`Message ${messageId} not found for forwarding`);
      return null;
    }

    if (originalMessage.isDeleted) {
      logger.warn('Cannot forward deleted messages');
      return null;
    }

    // Create forwarded message
    const forwardedMessage: Message = {
      id: `fwd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      localId: `local-${Date.now()}`,
      from: 'me',
      to: toUserId,
      content: originalMessage.content,
      timestamp: Date.now(),
      delivered: false,
      read: false,
      type: originalMessage.type || 'CHAT',
      status: 'pending',
      // Note: We could add a 'forwarded' flag here if needed
    };

    await get().addMessage(forwardedMessage);

    logger.info(`Forwarded message ${messageId} to ${toUserId}`);
    return forwardedMessage;
  },

  // ELITE: Get single message by ID
  getMessage: (messageId: string) => {
    return get().messages.find(m => m.id === messageId);
  },
}));

