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

interface MessageActions {
  addMessage: (message: Omit<Message, 'id'>) => void;
  markAsDelivered: (messageId: string) => void;
  markAsRead: (messageId: string) => void;
  markConversationRead: (userId: string) => void;
  getConversationMessages: (userId: string) => Message[];
  updateConversations: () => void;
  clear: () => void;
}

const initialState: MessageState = {
  messages: [],
  conversations: [],
};

export const useMessageStore = create<MessageState & MessageActions>((set, get) => ({
  ...initialState,
  
  addMessage: (message) => {
    const { messages } = get();
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    set({ messages: [...messages, newMessage] });
    get().updateConversations();
  },
  
  markAsDelivered: (messageId) => {
    const { messages } = get();
    set({
      messages: messages.map(m => m.id === messageId ? { ...m, delivered: true } : m)
    });
  },
  
  markAsRead: (messageId) => {
    const { messages } = get();
    set({
      messages: messages.map(m => m.id === messageId ? { ...m, read: true } : m)
    });
    get().updateConversations();
  },
  
  markConversationRead: (userId) => {
    const { messages } = get();
    set({
      messages: messages.map(m => 
        (m.from === userId || m.to === userId) ? { ...m, read: true } : m
      )
    });
    get().updateConversations();
  },
  
  getConversationMessages: (userId) => {
    const { messages } = get();
    return messages
      .filter(m => m.from === userId || m.to === userId)
      .sort((a, b) => a.timestamp - b.timestamp);
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
          userName: otherUserId, // Will be updated from family/peer data
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
  
  clear: () => set(initialState),
}));

