/**
 * MESSAGE STORE - Offline Messaging
 * Messages sent via BLE mesh network
 */

import { create } from 'zustand';

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
}

export interface MessageActions {
  addMessage: (message: Message) => void;
  markAsDelivered: (messageId: string) => void;
  markAsRead: (messageId: string) => void;
  markConversationRead: (userId: string) => void;
  getConversationMessages: (userId: string) => Message[];
  updateConversations: () => void;
  deleteConversation: (userId: string) => void;
  clear: () => void;
}

const initialState: MessageState = {
  messages: [],
  conversations: [],
};

export const useMessageStore = create<MessageState & MessageActions>((set, get) => ({
  ...initialState,
  addMessage: (message: Message) => {
    set((state) => ({ messages: [...state.messages, message] }));
    get().updateConversations();
  },
  markAsDelivered: (messageId: string) => {
    set((state) => ({
      messages: state.messages.map(m => m.id === messageId ? { ...m, delivered: true } : m)
    }));
  },
  markAsRead: (messageId: string) => {
    set((state) => ({
      messages: state.messages.map(m => m.id === messageId ? { ...m, read: true } : m)
    }));
    get().updateConversations();
  },
  markConversationRead: (userId: string) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.from === userId ? { ...m, read: true } : m
      ),
    }));
    get().updateConversations();
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
          lastMessage: msg.content,
          lastMessageTime: msg.timestamp,
          unreadCount,
        });
      }
    });
    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    set({ conversations });
  },
  deleteConversation: (userId: string) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.userId !== userId),
      messages: state.messages.filter((m) => m.from !== userId && m.to !== userId),
    }));
  },
  clear: () => set(initialState),
}));

