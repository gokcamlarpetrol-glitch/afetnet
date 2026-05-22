/**
 * MESH STORE - ELITE EDITION V2
 * Centralized state for offline mesh network.
 * Supports real-time UI updates, persistence, and store-and-forward.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { eliteStorage } from '../../utils/storage';

// O(1) dedup lookup — hydrated from persisted seenMessageIds array
const seenSet = new Set<string>();

// görev #23: Persist yazımını kısıtla — her setState'de MMKV'ye yazmak yerine
// 500ms coalesce (debounce). Mesaj/seenId listesi persist'ten DÜŞÜRÜLMEDİ.
function createThrottledStorage(base: { getItem: (k: string) => string | null | Promise<string | null>; setItem: (k: string, v: string) => void | Promise<void>; removeItem: (k: string) => void | Promise<void> }) {
  const pendingWrites = new Map<string, string>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const DEBOUNCE_MS = 500;
  return {
    getItem: (key: string) => base.getItem(key),
    setItem: (key: string, value: string) => {
      pendingWrites.set(key, value);
      const existing = debounceTimers.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        const latest = pendingWrites.get(key);
        if (latest !== undefined) {
          base.setItem(key, latest);
          pendingWrites.delete(key);
        }
        debounceTimers.delete(key);
      }, DEBOUNCE_MS);
      debounceTimers.set(key, timer);
    },
    removeItem: (key: string) => {
      pendingWrites.delete(key);
      const existing = debounceTimers.get(key);
      if (existing) { clearTimeout(existing); debounceTimers.delete(key); }
      base.removeItem(key);
    },
  };
}
const throttledEliteStorage = createThrottledStorage(eliteStorage as Parameters<typeof createThrottledStorage>[0]);
const MAX_MESSAGES = 2000;
const MAX_SEEN_IDS = 5000;
const MAX_OUTGOING_QUEUE = 500;
const MAX_FAILED_QUEUE = 200;

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

  // K3: Mesh availability state — UI surfaces this to users when BLE is off
  // or permissions are denied. null = mesh is healthy / running normally.
  meshUnavailableReason: 'no-permission' | 'bluetooth-off' | 'unsupported' | null;

  // Actions
  setConnected: (connected: boolean) => void;
  setScanning: (scanning: boolean) => void;
  setAdvertising: (advertising: boolean) => void;
  setMyDeviceId: (id: string) => void;
  setSimulationMode: (enabled: boolean) => void;
  setMeshUnavailable: (reason: 'no-permission' | 'bluetooth-off' | 'unsupported' | null) => void;
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
      isSimulationMode: false, // ELITE: Default to real BLE — simulation must be toggled explicitly
      meshUnavailableReason: null, // K3: null = mesh healthy
      stats: { totalPeers: 0, totalMessages: 0, sosAlerts: 0 },

      // Setters
      setConnected: (connected) => set({ isConnected: connected }),
      setScanning: (scanning) => set({ isScanning: scanning }),
      setAdvertising: (advertising) => set({ isAdvertising: advertising }),
      setMyDeviceId: (id) => set({ myDeviceId: id }),
      setSimulationMode: (enabled) => {
        // Never allow simulation mode in production builds.
        if (!__DEV__ && enabled) {
          return;
        }
        set({ isSimulationMode: enabled });
      },
      setMeshUnavailable: (reason) => set({ meshUnavailableReason: reason }),
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
        // O(1) dedup check
        if (seenSet.has(msg.id)) {
          // Status advancement: if same ID arrives with higher status, update existing
          // FIX: 'failed' is terminal in addMessage — retryMessage handles resurrection.
          // Without this guard, a duplicate arriving as 'pending' would resurrect a failed message.
          // Uses shared state machine guard for consistency.
          const { isStatusTransitionAllowed } = require('../messaging/constants');
          const existing = state.messages.find(m => m.id === msg.id);
          if (existing && isStatusTransitionAllowed(existing.status, msg.status) && msg.status !== existing.status) {
            return {
              messages: state.messages.map(m => m.id === msg.id ? { ...m, status: msg.status } : m),
            };
          }
          return state;
        }
        seenSet.add(msg.id);

        // Trim seenSet if over capacity
        const newSeen = [...state.seenMessageIds, msg.id];
        if (newSeen.length > MAX_SEEN_IDS) {
          const removed = newSeen.splice(0, newSeen.length - MAX_SEEN_IDS);
          removed.forEach(id => seenSet.delete(id));
        }

        // Cap messages to prevent unbounded growth
        const newMessages = [...state.messages, msg];
        if (newMessages.length > MAX_MESSAGES) {
          newMessages.splice(0, newMessages.length - MAX_MESSAGES);
        }

        return {
          messages: newMessages,
          seenMessageIds: newSeen,
          stats: { ...state.stats, totalMessages: state.stats.totalMessages + 1 },
        };
      }),

      // FIX: Status regression guard — don't downgrade 'read' to 'delivered'
      markAsDelivered: (msgId, peerId) => set((state) => ({
        messages: state.messages.map(m => {
          if (m.id === msgId) {
            const newAcks = m.acks.includes(peerId) ? m.acks : [...m.acks, peerId];
            // Don't regress from 'read' to 'delivered'
            const newStatus = m.status === 'read' ? 'read' : 'delivered';
            return { ...m, status: newStatus, acks: newAcks, delivered: true };
          }
          return m;
        }),
      })),

      // ELITE: Update any message field
      // FIX: Status regression guard — prevent higher status from being downgraded
      // (e.g., read → delivered). Without this, ConversationScreen effects can
      // regress status when markAsDelivered fires after markAsRead for the same message.
      updateMessage: (msgId, data) => set((state) => ({
        messages: state.messages.map(m => {
          if (m.id !== msgId) return m;
          if (data.status && m.status) {
            const { isStatusTransitionAllowed } = require('../messaging/constants');
            if (!isStatusTransitionAllowed(m.status, data.status)) {
              // Don't regress status — apply other fields but keep current status
              const { status: _ignored, ...rest } = data;
              return Object.keys(rest).length > 0 ? { ...m, ...rest } : m;
            }
          }
          return { ...m, ...data };
        }),
      })),

      // ELITE: Quick status update for ACK system
      // FIX: Status regression guard — prevent higher status from being downgraded
      updateMessageStatus: (msgId, status) => set((state) => ({
        messages: state.messages.map(m => {
          if (m.id !== msgId) return m;
          const { isStatusTransitionAllowed, MESSAGE_STATUS_PRIORITY } = require('../messaging/constants');
          if (!isStatusTransitionAllowed(m.status, status)) return m;
          const newRank = MESSAGE_STATUS_PRIORITY[status] ?? 0;
          return { ...m, status, delivered: m.delivered || newRank >= 3 };
        }),
      })),

      markAsRead: (msgId) => set((state) => ({
        messages: state.messages.map(m => m.id === msgId ? { ...m, status: 'read' as const, delivered: true } : m),
      })),

      // ELITE: Mark as permanently failed
      markAsFailed: (msgId) => set((state) => ({
        messages: state.messages.map(m => m.id === msgId ? { ...m, status: 'failed' as const } : m),
      })),

      clearMessages: () => {
        seenSet.clear(); // CRITICAL: Clear dedup set on logout to prevent stale dedup after re-login
        set({ messages: [], outgoingQueue: [], failedQueue: [], seenMessageIds: [] });
        // Also clear persisted mesh store to prevent rehydration of old user data on account switch
        try {
          eliteStorage.removeItem('mesh-storage-v2');
        } catch { /* best-effort */ }
      },

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

      addToQueue: (msg) => set((state) => {
        const newQueue = [...state.outgoingQueue, msg];
        // Cap outgoing queue — drop oldest non-critical messages if over limit
        if (newQueue.length > MAX_OUTGOING_QUEUE) {
          // Keep critical/high priority, drop oldest low/normal first
          const excess = newQueue.length - MAX_OUTGOING_QUEUE;
          let dropped = 0;
          for (let i = 0; i < newQueue.length && dropped < excess; i++) {
            if (newQueue[i].priority === 'low' || newQueue[i].priority === 'normal') {
              newQueue.splice(i, 1);
              dropped++;
              i--; // Adjust index after splice
            }
          }
          // If still over limit, drop oldest regardless of priority
          if (newQueue.length > MAX_OUTGOING_QUEUE) {
            newQueue.splice(0, newQueue.length - MAX_OUTGOING_QUEUE);
          }
        }
        return { outgoingQueue: newQueue };
      }),

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

      // ELITE: Move to failed queue (capped)
      moveToFailed: (msgId) => set((state) => {
        const msg = state.outgoingQueue.find(m => m.id === msgId);
        if (!msg) return state;
        const newFailed = [...state.failedQueue, { ...msg, status: 'failed' as const }];
        // Cap failed queue — drop oldest if over limit
        if (newFailed.length > MAX_FAILED_QUEUE) {
          newFailed.splice(0, newFailed.length - MAX_FAILED_QUEUE);
        }
        return {
          outgoingQueue: state.outgoingQueue.filter(m => m.id !== msgId),
          failedQueue: newFailed,
        };
      }),

      // ELITE: Connection Quality
      setConnectionQuality: (quality) => set({ connectionQuality: quality }),

      recordSeenMessage: (msgId) => {
        if (seenSet.has(msgId)) return false;
        seenSet.add(msgId);

        set(s => {
          const newSeen = [...s.seenMessageIds, msgId];
          if (newSeen.length > MAX_SEEN_IDS) {
            const removed = newSeen.splice(0, newSeen.length - MAX_SEEN_IDS);
            removed.forEach(id => seenSet.delete(id));
          }
          return { seenMessageIds: newSeen };
        });
        return true;
      },
    }),
    {
      name: 'mesh-storage-v2',
      // görev #23: Throttled storage — 500ms debounce, tüm persist alanları korunur.
      storage: createJSONStorage(() => throttledEliteStorage),
      partialize: (state) => ({
        messages: state.messages,
        outgoingQueue: state.outgoingQueue,
        failedQueue: state.failedQueue, // FIX: Persist failed messages so retry survives app restart
        stats: state.stats,
        myDeviceId: state.myDeviceId,
        seenMessageIds: state.seenMessageIds,
      }),
      onRehydrateStorage: () => (state) => {
        // FIX: Clear seenSet before repopulating. Without this, on account switch
        // where clearMessages() was skipped (e.g., app kill), the module-level seenSet
        // retains old user's message IDs — new user's messages with colliding IDs are dropped.
        seenSet.clear();
        // Hydrate seenSet from persisted seenMessageIds (includes pruned message IDs)
        if (state?.seenMessageIds) {
          state.seenMessageIds.forEach(id => seenSet.add(id));
        }
        // Also add any message IDs not already in seenSet
        if (state?.messages) {
          state.messages.forEach(m => seenSet.add(m.id));
        }
      },
    },
  ),
);
