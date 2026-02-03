/**
 * MESH STORE - ELITE EDITION V2
 * Centralized state for offline mesh network.
 * Supports real-time UI updates, persistence, and store-and-forward.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { eliteStorage } from '../../utils/storage';

export interface MeshNode {
  id: string;
  name: string;
  isSelf: boolean;
  rssi: number;
  lastSeen: number;
  battery?: number;
  status: 'safe' | 'danger' | 'unknown';
  connections: string[];
  location?: { lat: number; lng: number };
}

// ELITE: Message reaction types
export type MessageReaction = '❤️' | '👍' | '😊' | '🙏' | '🆘';

export interface MeshMessageReaction {
  emoji: MessageReaction;
  userId: string;
  timestamp: number;
}

export interface MeshMessage {
  id: string;
  localId?: string; // ELITE: Client-side ID for optimistic UI updates
  senderId: string;
  senderName?: string; // ELITE: Display name for UI
  to: string; // 'broadcast' or specific peer ID
  type: 'SOS' | 'STATUS' | 'CHAT' | 'LOCATION' | 'ACK' | 'TYPING' | 'REACTION' | 'IMAGE' | 'VOICE';
  content: string;
  timestamp: number;
  ttl: number; // Time-to-live (hops)
  priority: 'critical' | 'high' | 'normal' | 'low';

  // ELITE: Media attachments
  mediaUrl?: string; // Firebase Storage URL for image/voice
  mediaType?: 'image' | 'voice' | 'location';
  mediaDuration?: number; // For voice messages (seconds)
  mediaThumbnail?: string; // Base64 thumbnail for images
  location?: { lat: number; lng: number; address?: string };

  // Elite Delivery Tracking
  status: 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  acks: string[]; // List of peer IDs who acked this message
  retryCount: number;
  hops: number;
  lastRetryAt?: number; // ELITE: Timestamp of last retry attempt

  // ELITE: Threading & Replies
  replyTo?: string; // Message ID being replied to
  replyPreview?: string; // Preview text of replied message

  // ELITE: Reactions
  reactions?: MeshMessageReaction[];

  // ELITE: Encryption readiness
  encryptedContent?: string; // Base64 encrypted payload
  isEncrypted?: boolean;

  // ELITE: Backward compatibility
  delivered?: boolean; // Computed from status === 'delivered' or 'read'
}

export type Message = MeshMessage;

interface MeshStats {
  totalPeers: number;
  totalMessages: number;
  sosAlerts: number;
}

// ELITE: Typing indicator state
export interface TypingUser {
  userId: string;
  userName?: string;
  timestamp: number;
}

interface MeshState {
  // Connection State
  isConnected: boolean;
  isScanning: boolean;
  isEnabled: boolean;
  isAdvertising: boolean;
  myDeviceId: string | null;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'none'; // ELITE: Signal quality

  // Data
  peers: MeshNode[];
  messages: MeshMessage[];

  // ELITE: Typing Indicators
  typingUsers: Record<string, TypingUser>; // conversationId -> typing user

  // Store-and-Forward Queue
  outgoingQueue: MeshMessage[];
  failedQueue: MeshMessage[]; // ELITE: Permanently failed messages for retry

  // Deduplication
  seenMessageIds: string[]; // Array for persistence, use Set in memory if needed

  // Stats
  stats: MeshStats;

  // Simulation
  isSimulationMode: boolean;

  // Actions
  setConnected: (connected: boolean) => void;
  setScanning: (scanning: boolean) => void;
  setAdvertising: (advertising: boolean) => void;
  setMyDeviceId: (id: string) => void;
  setSimulationMode: (enabled: boolean) => void;
  toggleMesh: (enabled: boolean) => void;

  addPeer: (peer: MeshNode) => void;
  updatePeer: (id: string, data: Partial<MeshNode>) => void;
  removePeer: (id: string) => void;
  clearPeers: () => void;

  addMessage: (msg: MeshMessage) => void;
  updateMessage: (msgId: string, data: Partial<MeshMessage>) => void; // ELITE: Update message
  updateMessageStatus: (msgId: string, status: MeshMessage['status']) => void; // ELITE: Quick status update
  markAsDelivered: (msgId: string, peerId: string) => void; // ACK received
  markAsRead: (msgId: string) => void;
  markAsFailed: (msgId: string) => void; // ELITE: Mark as permanently failed
  clearMessages: () => void;

  // ELITE: Typing Indicators
  setTyping: (conversationId: string, userId: string, userName?: string) => void;
  clearTyping: (conversationId: string) => void;

  // ELITE: Reactions
  addReaction: (msgId: string, emoji: MessageReaction, userId: string) => void;
  removeReaction: (msgId: string, userId: string) => void;

  // Queue Management
  addToQueue: (msg: MeshMessage) => void;
  removeFromQueue: (msgId: string) => void;
  retryMessage: (msgId: string) => void; // ELITE: Retry failed message
  moveToFailed: (msgId: string) => void; // ELITE: Move to failed queue

  // ELITE: Connection Quality
  setConnectionQuality: (quality: 'excellent' | 'good' | 'fair' | 'poor' | 'none') => void;

  // Dedup
  recordSeenMessage: (msgId: string) => boolean; // Returns true if new
}

export const useMeshStore = create<MeshState>()(
  persist(
    (set, get) => ({
      // Initial State
      isConnected: false,
      isScanning: false,
      isEnabled: true,
      isAdvertising: false,
      myDeviceId: null,
      connectionQuality: 'none',
      peers: [],
      messages: [],
      typingUsers: {},
      outgoingQueue: [],
      failedQueue: [],
      seenMessageIds: [],
      isSimulationMode: __DEV__,
      stats: { totalPeers: 0, totalMessages: 0, sosAlerts: 0 },

      // Setters
      setConnected: (connected) => set({ isConnected: connected }),
      setScanning: (scanning) => set({ isScanning: scanning }),
      setAdvertising: (advertising) => set({ isAdvertising: advertising }),
      setMyDeviceId: (id) => set({ myDeviceId: id }),
      setSimulationMode: (enabled) => set({ isSimulationMode: enabled }),
      toggleMesh: (enabled) => set({ isConnected: enabled }), // Simplified toggle

      addPeer: (peer) => set((state) => {
        const exists = state.peers.some((p) => p.id === peer.id);
        if (exists) return state; // No change
        return {
          peers: [...state.peers, peer],
          stats: { ...state.stats, totalPeers: state.stats.totalPeers + 1 },
        };
      }),

      updatePeer: (id, data) => set((state) => ({
        peers: state.peers.map((p) => p.id === id ? { ...p, ...data } : p),
      })),

      removePeer: (id) => set((state) => ({
        peers: state.peers.filter((p) => p.id !== id),
      })),

      clearPeers: () => set({ peers: [] }),

      addMessage: (msg) => set((state) => {
        // Check dup
        if (state.seenMessageIds.includes(msg.id)) return state;

        const newSeen = [...state.seenMessageIds, msg.id].slice(-1000); // Keep last 1000 IDs
        return {
          messages: [...state.messages, msg],
          seenMessageIds: newSeen,
          stats: { ...state.stats, totalMessages: state.stats.totalMessages + 1 },
        };
      }),

      markAsDelivered: (msgId, peerId) => set((state) => ({
        messages: state.messages.map(m => {
          if (m.id === msgId) {
            const newAcks = m.acks.includes(peerId) ? m.acks : [...m.acks, peerId];
            return { ...m, status: 'delivered', acks: newAcks };
          }
          return m;
        }),
      })),

      // ELITE: Update any message field
      updateMessage: (msgId, data) => set((state) => ({
        messages: state.messages.map(m => m.id === msgId ? { ...m, ...data } : m),
      })),

      // ELITE: Quick status update for ACK system
      updateMessageStatus: (msgId, status) => set((state) => ({
        messages: state.messages.map(m => m.id === msgId ? { ...m, status } : m),
      })),

      markAsRead: (msgId) => set((state) => ({
        messages: state.messages.map(m => m.id === msgId ? { ...m, status: 'read' as const } : m),
      })),

      // ELITE: Mark as permanently failed
      markAsFailed: (msgId) => set((state) => ({
        messages: state.messages.map(m => m.id === msgId ? { ...m, status: 'failed' as const } : m),
      })),

      clearMessages: () => set({ messages: [], outgoingQueue: [], failedQueue: [] }),

      // ELITE: Typing Indicators
      setTyping: (conversationId, userId, userName) => set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: { userId, userName, timestamp: Date.now() },
        },
      })),

      clearTyping: (conversationId) => set((state) => {
        const { [conversationId]: _, ...rest } = state.typingUsers;
        return { typingUsers: rest };
      }),

      // ELITE: Reactions
      addReaction: (msgId, emoji, userId) => set((state) => ({
        messages: state.messages.map(m => {
          if (m.id !== msgId) return m;
          const existingReactions = m.reactions || [];
          // Remove existing reaction from this user
          const filtered = existingReactions.filter(r => r.userId !== userId);
          return {
            ...m,
            reactions: [...filtered, { emoji, userId, timestamp: Date.now() }],
          };
        }),
      })),

      removeReaction: (msgId, userId) => set((state) => ({
        messages: state.messages.map(m => {
          if (m.id !== msgId) return m;
          return {
            ...m,
            reactions: (m.reactions || []).filter(r => r.userId !== userId),
          };
        }),
      })),

      addToQueue: (msg) => set((state) => ({
        outgoingQueue: [...state.outgoingQueue, msg],
      })),

      removeFromQueue: (msgId) => set((state) => ({
        outgoingQueue: state.outgoingQueue.filter(m => m.id !== msgId),
      })),

      // ELITE: Retry failed message
      retryMessage: (msgId) => set((state) => {
        const msg = state.failedQueue.find(m => m.id === msgId);
        if (!msg) return state;
        return {
          failedQueue: state.failedQueue.filter(m => m.id !== msgId),
          outgoingQueue: [...state.outgoingQueue, { ...msg, status: 'pending' as const, retryCount: (msg.retryCount || 0) + 1, lastRetryAt: Date.now() }],
        };
      }),

      // ELITE: Move to failed queue
      moveToFailed: (msgId) => set((state) => {
        const msg = state.outgoingQueue.find(m => m.id === msgId);
        if (!msg) return state;
        return {
          outgoingQueue: state.outgoingQueue.filter(m => m.id !== msgId),
          failedQueue: [...state.failedQueue, { ...msg, status: 'failed' as const }],
        };
      }),

      // ELITE: Connection Quality
      setConnectionQuality: (quality) => set({ connectionQuality: quality }),

      recordSeenMessage: (msgId) => {
        const state = get();
        if (state.seenMessageIds.includes(msgId)) return false;

        set(s => ({
          seenMessageIds: [...s.seenMessageIds, msgId].slice(-1000),
        }));
        return true;
      },
    }),
    {
      name: 'mesh-storage-v2',
      storage: createJSONStorage(() => eliteStorage),
      partialize: (state) => ({
        messages: state.messages,
        outgoingQueue: state.outgoingQueue,
        stats: state.stats,
        // Do not persist peers for now to force fresh discovery, or persist if needed
        myDeviceId: state.myDeviceId,
      }),
    },
  ),
);
