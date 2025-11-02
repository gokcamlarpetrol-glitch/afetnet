/**
 * FAMILY STORE - Family Member Tracking
 * Simple state for family members and their status
 */

import { create } from 'zustand';

export interface FamilyMember {
  id: string;
  name: string;
  status: 'safe' | 'need-help' | 'unknown' | 'critical';
  lastSeen: number;
  latitude: number;
  longitude: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  deviceId?: string; // BLE mesh device ID
}

interface FamilyState {
  members: FamilyMember[];
}

interface FamilyActions {
  addMember: (member: Omit<FamilyMember, 'id'>) => void;
  updateMember: (id: string, updates: Partial<FamilyMember>) => void;
  removeMember: (id: string) => void;
  updateMemberLocation: (id: string, latitude: number, longitude: number) => void;
  updateMemberStatus: (id: string, status: FamilyMember['status']) => void;
  clear: () => void;
}

const initialState: FamilyState = {
  members: [],
};

export const useFamilyStore = create<FamilyState & FamilyActions>((set, get) => ({
  ...initialState,
  
  addMember: (member) => {
    const { members } = get();
    const newMember: FamilyMember = {
      ...member,
      id: `family-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    set({ members: [...members, newMember] });
  },
  
  updateMember: (id, updates) => {
    const { members } = get();
    set({
      members: members.map(m => m.id === id ? { ...m, ...updates, lastSeen: Date.now() } : m)
    });
  },
  
  removeMember: (id) => {
    const { members } = get();
    set({ members: members.filter(m => m.id !== id) });
  },
  
  updateMemberLocation: (id, latitude, longitude) => {
    const { members } = get();
    set({
      members: members.map(m => 
        m.id === id 
          ? { ...m, location: { latitude, longitude, timestamp: Date.now() }, lastSeen: Date.now() }
          : m
      )
    });
  },
  
  updateMemberStatus: (id, status) => {
    const { members } = get();
    set({
      members: members.map(m => m.id === id ? { ...m, status, lastSeen: Date.now() } : m)
    });
  },
  
  clear: () => set(initialState),
}));

