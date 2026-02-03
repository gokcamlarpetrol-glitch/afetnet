/**
 * MESH STORE - BLE Mesh Network State
 * Simple state management for offline peer-to-peer communication
 */

import { create } from 'zustand';

export interface MeshPeer {
  id: string;
  name: string;
  rssi: number;
  lastSeen: number;
}

export type MeshPriority = 'critical' | 'high' | 'normal';

export interface MeshMessage {
  id: string;
  from: string;
  to?: string; // undefined = broadcast/multicast
  content: string;
  type: 'text' | 'sos' | 'location' | 'status' | 'broadcast' | 'SOS_BEACON' | 'family_group' | 'ack' | 'heartbeat';
  timestamp: number;
  ttl: number;
  hops: number;
  priority: MeshPriority;
  sequence: number; // source-scoped incrementing sequence id
  route?: string[]; // node ids traversed (for telemetry)
  ackRequired: boolean;
  attempts: number;
  delivered: boolean;
  signature?: string; // optional cryptographic signature
  iv?: string; // optional initialization vector for encrypted payloads
  nextAttempt?: number; // timestamp for next retry (offline queue)
  lastError?: string; // last error message (diagnostics)
}

interface MeshState {
  peers: Record<string, MeshPeer>;
  messages: MeshMessage[];
  isConnected: boolean;
  isScanning: boolean;
  isAdvertising: boolean;
  myDeviceId: string | null;
  sequenceCounter: number;
  deliveredSequences: Record<string, number>; // highest seq per source acked
  receiptLog: Record<string, number>; // source|seq => timestamp (duplicate filter)
  routingTable: Record<string, string[]>; // destination -> path (future use)
  pendingAcks: Record<string, MeshMessage>; // message id -> message awaiting ack
  stats: {
    messagesSent: number;
    messagesReceived: number;
    peersDiscovered: number;
    hopsForwarded: number;
    retries: number;
    dropped: number;
  };
  networkHealth: {
    lastUpdated: number;
    nodeCount: number;
    avgRssi: number;
    avgHopCount: number;
    deliveryRatio: number;
    meshDensity: number;
  };
}

interface MeshActions {
  setPeers: (peers: Record<string, MeshPeer>) => void;
  addPeer: (peer: MeshPeer) => void;
  removePeer: (peerId: string) => void;
  updatePeer: (peerId: string, updates: Partial<MeshPeer>) => void;
  setConnected: (isConnected: boolean) => void;

  addMessage: (message: MeshMessage) => void;
  markMessageDelivered: (messageId: string) => void;
  markSequenceDelivered: (sourceId: string, sequence: number) => void;
  registerReceipt: (sourceId: string, sequence: number) => boolean;
  clearOldMessages: (olderThan: number) => void;
  sendMessage: (content: string, options?: {
    type?: MeshMessage['type'];
    to?: string;
    priority?: MeshPriority;
    ackRequired?: boolean;
    skipTransport?: boolean;
  }) => Promise<MeshMessage>;
  broadcastMessage: (content: string, type?: MeshMessage['type']) => Promise<void>;

  setScanning: (isScanning: boolean) => void;
  setAdvertising: (isAdvertising: boolean) => void;
  setMyDeviceId: (id: string) => void;
  nextSequence: () => number;

  incrementStat: (stat: 'messagesSent' | 'messagesReceived' | 'peersDiscovered') => void;
  recordRetry: () => void;
  recordDrop: () => void;
  recordHopForwarded: () => void;
  updateNetworkHealth: (update: Partial<MeshState['networkHealth']>) => void;
  trackPendingAck: (message: MeshMessage) => void;
  resolvePendingAck: (messageId: string) => void;
  clear: () => void;
}

const initialState: MeshState = {
  peers: {},
  messages: [],
  isConnected: false,
  isScanning: false,
  isAdvertising: false,
  myDeviceId: null,
  sequenceCounter: 0,
  deliveredSequences: {},
  receiptLog: {},
  routingTable: {},
  pendingAcks: {},
  stats: {
    messagesSent: 0,
    messagesReceived: 0,
    peersDiscovered: 0,
    hopsForwarded: 0,
    retries: 0,
    dropped: 0,
  },
  networkHealth: {
    lastUpdated: 0,
    nodeCount: 0,
    avgRssi: -100,
    avgHopCount: 0,
    deliveryRatio: 1,
    meshDensity: 0,
  },
};

export const useMeshStore = create<MeshState & MeshActions>((set, get) => ({
  ...initialState,

  setPeers: (peers) => set({ peers }),

  addPeer: (peer) => {
    const { peers } = get();
    if (!peers[peer.id]) {
      set({ peers: { ...peers, [peer.id]: peer } });
      get().incrementStat('peersDiscovered');
    } else {
      get().updatePeer(peer.id, peer);
    }
  },

  removePeer: (peerId) => {
    const { peers } = get();
    const newPeers = { ...peers };
    delete newPeers[peerId];
    set({ peers: newPeers });
  },

  updatePeer: (peerId, updates) => {
    const { peers } = get();
    if (peers[peerId]) {
      set({
        peers: { ...peers, [peerId]: { ...peers[peerId], ...updates } },
      });
    }
  },

  setConnected: (isConnected) => set({ isConnected }),

  addMessage: (message) => {
    const { messages } = get();
    // Prevent duplicates
    if (messages.find(m => m.id === message.id)) {
      return;
    }
    set({ messages: [...messages, message] });
  },

  markMessageDelivered: (messageId) => {
    const { messages } = get();
    set({
      messages: messages.map(m => m.id === messageId ? { ...m, delivered: true } : m),
    });
  },

  markSequenceDelivered: (sourceId, sequence) => {
    const { deliveredSequences } = get();
    const current = deliveredSequences[sourceId] ?? -1;
    if (sequence > current) {
      set({ deliveredSequences: { ...deliveredSequences, [sourceId]: sequence } });
    }
  },

  registerReceipt: (sourceId, sequence) => {
    const key = `${sourceId}|${sequence}`;
    const { receiptLog } = get();
    if (receiptLog[key]) {
      return false; // already seen
    }
    set({ receiptLog: { ...receiptLog, [key]: Date.now() } });
    return true;
  },

  clearOldMessages: (olderThan) => {
    const { messages } = get();
    set({
      messages: messages.filter(m => m.timestamp > olderThan),
    });
  },

  nextSequence: () => {
    const next = get().sequenceCounter + 1;
    set({ sequenceCounter: next });
    return next;
  },

  sendMessage: async (content, options = {}) => {
    const { myDeviceId } = get();
    if (!myDeviceId) {
      throw new Error('Device ID not set');
    }

    const {
      type = 'text',
      to,
      priority = 'normal',
      ackRequired = false,
      skipTransport = false,
    } = options as {
      type?: MeshMessage['type'];
      to?: string;
      priority?: MeshPriority;
      ackRequired?: boolean;
      skipTransport?: boolean;
    };

    const sequence = get().nextSequence();
    const message: MeshMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      from: myDeviceId,
      to,
      content,
      type,
      timestamp: Date.now(),
      ttl: priority === 'critical' ? 12 : priority === 'high' ? 8 : 5,
      hops: 0,
      priority,
      sequence,
      route: [myDeviceId],
      ackRequired,
      attempts: 0,
      delivered: false,
    };

    // CRITICAL: Add to store for tracking
    get().addMessage(message);

    if (!skipTransport) {
      try {
        const { bleMeshService } = await import('../services/BLEMeshService');
        await bleMeshService.sendMessage(content, to ?? '*'); // ELITE: Default to broadcast if no target
      } catch (error) {
        const logger = require('../utils/logger').createLogger('MeshStore');
        logger.error('Failed to send message via BLE Mesh Service:', error);
      }
    }

    return message;
  },

  broadcastMessage: async (content, type = 'text') => {
    // CRITICAL: Send via BLE Mesh Service for actual broadcast
    try {
      const { bleMeshService } = await import('../services/BLEMeshService');
      await bleMeshService.broadcastMessage({
        content,
        type,
        ttl: 3,
        priority: 'normal',
      });
    } catch (error) {
      // CRITICAL: Log error but don't throw - still add to store
      const logger = require('../utils/logger').createLogger('MeshStore');
      logger.error('Failed to broadcast message via BLE Mesh Service:', error);
    }

    // CRITICAL: Also add to store for tracking
    await get().sendMessage(content, { type, skipTransport: true });
  },

  setScanning: (isScanning) => set({ isScanning }),
  setAdvertising: (isAdvertising) => set({ isAdvertising }),
  setMyDeviceId: (id) => set({ myDeviceId: id }),

  incrementStat: (stat) => {
    const { stats } = get();
    set({ stats: { ...stats, [stat]: stats[stat] + 1 } });
  },

  recordRetry: () => {
    const { stats } = get();
    set({ stats: { ...stats, retries: stats.retries + 1 } });
  },

  recordDrop: () => {
    const { stats } = get();
    set({ stats: { ...stats, dropped: stats.dropped + 1 } });
  },

  recordHopForwarded: () => {
    const { stats } = get();
    set({ stats: { ...stats, hopsForwarded: stats.hopsForwarded + 1 } });
  },

  updateNetworkHealth: (update) => {
    const { networkHealth, peers, stats } = get();
    const nodeCount = Object.keys(peers).length + 1; // include self
    const avgRssi = nodeCount > 1
      ? Object.values(peers).reduce((sum, peer) => sum + peer.rssi, 0) / Object.keys(peers).length
      : networkHealth.avgRssi;

    const updated: MeshState['networkHealth'] = {
      ...networkHealth,
      ...update,
      nodeCount,
      avgRssi,
      deliveryRatio: stats.messagesSent > 0
        ? Math.max(0, 1 - stats.dropped / stats.messagesSent)
        : networkHealth.deliveryRatio,
      meshDensity: Math.min(1, nodeCount / 10),
      lastUpdated: Date.now(),
    };

    set({ networkHealth: updated });
  },

  trackPendingAck: (message) => {
    const { pendingAcks } = get();
    set({ pendingAcks: { ...pendingAcks, [message.id]: message } });
  },

  resolvePendingAck: (messageId) => {
    const { pendingAcks } = get();
    if (!pendingAcks[messageId]) return;
    const updated = { ...pendingAcks };
    delete updated[messageId];
    set({ pendingAcks: updated });
  },

  clear: () => set(initialState),
}));
