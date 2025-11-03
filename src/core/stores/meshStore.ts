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

export interface MeshMessage {
  id: string;
  from: string;
  to?: string; // undefined = broadcast
  content: string;
  type: 'text' | 'sos' | 'location' | 'status';
  timestamp: number;
  ttl: number;
  hops: number;
  delivered: boolean;
}

interface MeshState {
  peers: Record<string, MeshPeer>;
  messages: MeshMessage[];
  isConnected: boolean;
  isScanning: boolean;
  isAdvertising: boolean;
  myDeviceId: string | null;
  stats: {
    messagesSent: number;
    messagesReceived: number;
    peersDiscovered: number;
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
  clearOldMessages: (olderThan: number) => void;
  sendMessage: (content: string, type?: MeshMessage['type'], to?: string) => Promise<void>;
  broadcastMessage: (content: string, type?: MeshMessage['type']) => Promise<void>;
  
  setScanning: (isScanning: boolean) => void;
  setAdvertising: (isAdvertising: boolean) => void;
  setMyDeviceId: (id: string) => void;
  
  incrementStat: (stat: 'messagesSent' | 'messagesReceived' | 'peersDiscovered') => void;
  clear: () => void;
}

const initialState: MeshState = {
  peers: {},
  messages: [],
  isConnected: false,
  isScanning: false,
  isAdvertising: false,
  myDeviceId: null,
  stats: {
    messagesSent: 0,
    messagesReceived: 0,
    peersDiscovered: 0,
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
        peers: { ...peers, [peerId]: { ...peers[peerId], ...updates } }
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
      messages: messages.map(m => m.id === messageId ? { ...m, delivered: true } : m)
    });
  },
  
  clearOldMessages: (olderThan) => {
    const { messages } = get();
    set({
      messages: messages.filter(m => m.timestamp > olderThan)
    });
  },
  
  sendMessage: async (content, type = 'text', to) => {
    const { myDeviceId } = get();
    if (!myDeviceId) {
      throw new Error('Device ID not set');
    }
    
    // This will be handled by BLEMeshService
    // Store method just creates the message structure
    const message: MeshMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      from: myDeviceId,
      to,
      content,
      type,
      timestamp: Date.now(),
      ttl: 60, // 60 seconds
      hops: 0,
      delivered: false,
    };
    
    get().addMessage(message);
    get().incrementStat('messagesSent');
  },
  
  broadcastMessage: async (content, type = 'text') => {
    await get().sendMessage(content, type);
  },
  
  setScanning: (isScanning) => set({ isScanning }),
  setAdvertising: (isAdvertising) => set({ isAdvertising }),
  setMyDeviceId: (id) => set({ myDeviceId: id }),
  
  incrementStat: (stat) => {
    const { stats } = get();
    set({ stats: { ...stats, [stat]: stats[stat] + 1 } });
  },
  
  clear: () => set(initialState),
}));

