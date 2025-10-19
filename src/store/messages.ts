import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface Contact {
  id: string;
  name: string;
  afnId?: string;
  status: 'online' | 'offline' | 'emergency';
  lastSeen: number;
  distance?: number;
  rssi?: number;
  lat?: number;
  lon?: number;
}

export interface Message {
  id: string;
  contactId: string;
  contactName: string;
  content: string;
  preview: string;
  timestamp: number;
  unread: boolean;
  type: 'normal' | 'sos' | 'group';
  isEncrypted: boolean;
  isSent: boolean;
  isDelivered: boolean;
  lat?: number;
  lon?: number;
}

export interface Conversation {
  contactId: string;
  contactName: string;
  messages: Message[];
  lastMessage?: Message;
  unreadCount: number;
  type: 'normal' | 'sos' | 'group';
}

interface MessagesState {
  contacts: Contact[];
  conversations: Map<string, Conversation>;
  activeContactId: string | null;
  
  // Contact actions
  addContact: (contact: Contact) => void;
  updateContact: (contactId: string, updates: Partial<Contact>) => void;
  removeContact: (contactId: string) => void;
  getContact: (contactId: string) => Contact | undefined;
  getNearbyContacts: () => Contact[];
  getOnlineContacts: () => Contact[];
  
  // Message actions
  sendMessage: (contactId: string, content: string, type?: Message['type'], lat?: number, lon?: number) => Message;
  receiveMessage: (message: Omit<Message, 'id' | 'timestamp' | 'unread'>) => void;
  markAsRead: (contactId: string, messageId?: string) => void;
  deleteMessage: (contactId: string, messageId: string) => void;
  deleteConversation: (contactId: string) => void;
  
  // Conversation actions
  getConversation: (contactId: string) => Conversation | undefined;
  getAllConversations: () => Conversation[];
  getUnreadCount: () => number;
  
  // Active conversation
  setActiveContact: (contactId: string | null) => void;
}

export const useMessages = create<MessagesState>()(
  persist(
    (set, get) => ({
      contacts: [],
      conversations: new Map(),
      activeContactId: null,

      // Contact actions
      addContact: (contact: Contact) => {
        set((state) => {
          const exists = state.contacts.find(c => c.id === contact.id);
          if (exists) return state;
          
          return {
            contacts: [...state.contacts, contact],
          };
        });
      },

      updateContact: (contactId: string, updates: Partial<Contact>) => {
        set((state) => ({
          contacts: state.contacts.map(c =>
            c.id === contactId ? { ...c, ...updates, lastSeen: Date.now() } : c
          ),
        }));
      },

      removeContact: (contactId: string) => {
        set((state) => ({
          contacts: state.contacts.filter(c => c.id !== contactId),
        }));
      },

      getContact: (contactId: string) => {
        return get().contacts.find(c => c.id === contactId);
      },

      getNearbyContacts: () => {
        return get().contacts.filter(c => c.distance && c.distance < 1000);
      },

      getOnlineContacts: () => {
        return get().contacts.filter(c => c.status === 'online');
      },

      // Message actions
      sendMessage: (contactId: string, content: string, type: Message['type'] = 'normal', lat?: number, lon?: number) => {
        const message: Message = {
          id: Crypto.randomUUID(),
          contactId,
          contactName: get().getContact(contactId)?.name || 'Unknown',
          content,
          preview: content.slice(0, 50),
          timestamp: Date.now(),
          unread: false,
          type,
          isEncrypted: true,
          isSent: true,
          isDelivered: false,
          lat,
          lon,
        };

        set((state) => {
          const newConversations = new Map(state.conversations);
          const conversation = newConversations.get(contactId) || {
            contactId,
            contactName: message.contactName,
            messages: [],
            unreadCount: 0,
            type,
          };

          conversation.messages.push(message);
          conversation.lastMessage = message;
          newConversations.set(contactId, conversation);

          return { conversations: newConversations };
        });

        return message;
      },

      receiveMessage: (messageData: Omit<Message, 'id' | 'timestamp' | 'unread'>) => {
        const message: Message = {
          ...messageData,
          id: Crypto.randomUUID(),
          timestamp: Date.now(),
          unread: get().activeContactId !== messageData.contactId,
        };

        set((state) => {
          const newConversations = new Map(state.conversations);
          const conversation = newConversations.get(message.contactId) || {
            contactId: message.contactId,
            contactName: message.contactName,
            messages: [],
            unreadCount: 0,
            type: message.type,
          };

          conversation.messages.push(message);
          conversation.lastMessage = message;
          if (message.unread) {
            conversation.unreadCount++;
          }
          newConversations.set(message.contactId, conversation);

          return { conversations: newConversations };
        });
      },

      markAsRead: (contactId: string, messageId?: string) => {
        set((state) => {
          const newConversations = new Map(state.conversations);
          const conversation = newConversations.get(contactId);
          
          if (conversation) {
            if (messageId) {
              // Mark specific message as read
              conversation.messages = conversation.messages.map(m =>
                m.id === messageId ? { ...m, unread: false } : m
              );
            } else {
              // Mark all messages as read
              conversation.messages = conversation.messages.map(m => ({ ...m, unread: false }));
              conversation.unreadCount = 0;
            }
            newConversations.set(contactId, conversation);
          }

          return { conversations: newConversations };
        });
      },

      deleteMessage: (contactId: string, messageId: string) => {
        set((state) => {
          const newConversations = new Map(state.conversations);
          const conversation = newConversations.get(contactId);
          
          if (conversation) {
            conversation.messages = conversation.messages.filter(m => m.id !== messageId);
            if (conversation.messages.length > 0) {
              conversation.lastMessage = conversation.messages[conversation.messages.length - 1];
            } else {
              newConversations.delete(contactId);
            }
          }

          return { conversations: newConversations };
        });
      },

      deleteConversation: (contactId: string) => {
        set((state) => {
          const newConversations = new Map(state.conversations);
          newConversations.delete(contactId);
          return { conversations: newConversations };
        });
      },

      // Conversation actions
      getConversation: (contactId: string) => {
        return get().conversations.get(contactId);
      },

      getAllConversations: () => {
        return Array.from(get().conversations.values()).sort((a, b) => {
          const aTime = a.lastMessage?.timestamp || 0;
          const bTime = b.lastMessage?.timestamp || 0;
          return bTime - aTime;
        });
      },

      getUnreadCount: () => {
        return Array.from(get().conversations.values()).reduce(
          (sum, conv) => sum + conv.unreadCount,
          0
        );
      },

      // Active conversation
      setActiveContact: (contactId: string | null) => {
        if (contactId) {
          get().markAsRead(contactId);
        }
        set({ activeContactId: contactId });
      },
    }),
    {
      name: 'afetnet-messages',
      storage: createJSONStorage(() => AsyncStorage),
      // Map seri/deseri için custom storage
      partialize: (state) => ({
        contacts: state.contacts,
        conversations: Array.from(state.conversations.entries()),
        activeContactId: state.activeContactId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.conversations)) {
          // @ts-ignore
          state.conversations = new Map(state.conversations);
        }
      },
    }
  )
);









