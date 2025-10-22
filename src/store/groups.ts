import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import 'react-native-get-random-values';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { generateGroupSeed, gidFromSeed, validateGid } from '../identity/groupId';

export type GroupMember = {
  afnId: string;
  pubKeyB64?: string;
  verified: boolean;
  joinedAt: number;
  name?: string;
};

export type Group = {
  id: string; // internal UUID
  gid: string; // AFN-GID
  name: string;
  seed?: Uint8Array; // Only present for creator
  sharedKeyB64?: string;
  members: GroupMember[];
  createdAt: number;
  lastActivity: number;
  isCreator: boolean;
};

export type GroupsState = {
  items: Group[];
  groups: Group[]; // Alias for items
   
  createLocal: (name: string) => Group;
   
  joinWithCode: (gid: string, name: string) => { ok: boolean; group?: Group; error?: string };
   
  addMember: (groupId: string, member: GroupMember) => void;
   
  removeMember: (groupId: string, afnId: string) => void;
   
  setVerified: (groupId: string, afnId: string, verified: boolean) => void;
   
  setSharedKey: (groupId: string, keyB64: string) => void;
   
  getSharedKey: (groupId: string) => string | undefined;
   
  updateLastActivity: (groupId: string) => void;
   
  getByGid: (gid: string) => Group | undefined;
   
  getById: (id: string) => Group | undefined;
   
  remove: (id: string) => void;
};

export const useGroups = create<GroupsState>()(
  persist(
    (set, get) => ({
      items: [],
      get groups() { return get().items; },

      createLocal: (name: string) => {
        const seed = generateGroupSeed();
        const gid = gidFromSeed(seed);
        const newGroup: Group = {
          id: Crypto.randomUUID(),
          gid,
          name,
          seed,
          members: [],
          createdAt: Date.now(),
          lastActivity: Date.now(),
          isCreator: true,
        };
        
        set((state) => ({
          items: [...state.items, newGroup],
        }));
        
        return newGroup;
      },

      joinWithCode: (gid: string, name: string) => {
        const validation = validateGid(gid);
        if (!validation.ok) {
          return { ok: false, error: 'Geçersiz AFN-GID formatı' };
        }

        const existing = get().items.find(g => g.gid === gid);
        if (existing) {
          return { ok: false, error: 'Bu gruba zaten katılmışsınız' };
        }

        const newGroup: Group = {
          id: Crypto.randomUUID(),
          gid,
          name,
          members: [],
          createdAt: Date.now(),
          lastActivity: Date.now(),
          isCreator: false,
        };

        set((state) => ({
          items: [...state.items, newGroup],
        }));

        return { ok: true, group: newGroup };
      },

      addMember: (groupId: string, member: GroupMember) => {
        set((state) => ({
          items: state.items.map((group) =>
            group.id === groupId
              ? {
                ...group,
                members: [
                  ...group.members.filter(m => m.afnId !== member.afnId),
                  member,
                ],
                lastActivity: Date.now(),
              }
              : group,
          ),
        }));
      },

      removeMember: (groupId: string, afnId: string) => {
        set((state) => ({
          items: state.items.map((group) =>
            group.id === groupId
              ? {
                ...group,
                members: group.members.filter(m => m.afnId !== afnId),
                lastActivity: Date.now(),
              }
              : group,
          ),
        }));
      },

      setVerified: (groupId: string, afnId: string, verified: boolean) => {
        set((state) => ({
          items: state.items.map((group) =>
            group.id === groupId
              ? {
                ...group,
                members: group.members.map((member) =>
                  member.afnId === afnId ? { ...member, verified } : member,
                ),
                lastActivity: Date.now(),
              }
              : group,
          ),
        }));
      },

      setSharedKey: (groupId: string, keyB64: string) => {
        set((state) => ({
          items: state.items.map((group) =>
            group.id === groupId ? { ...group, sharedKeyB64: keyB64 } : group,
          ),
        }));
      },

      updateLastActivity: (groupId: string) => {
        set((state) => ({
          items: state.items.map((group) =>
            group.id === groupId ? { ...group, lastActivity: Date.now() } : group,
          ),
        }));
      },

      getByGid: (gid: string) => {
        return get().items.find((group) => group.gid === gid);
      },

      getById: (id: string) => {
        return get().items.find((group) => group.id === id);
      },

      getSharedKey: (groupId: string) => {
        const group = get().items.find((g) => g.id === groupId);
        return group?.sharedKeyB64;
      },

      remove: (id: string) => {
        set((state) => ({
          items: state.items.filter((group) => group.id !== id),
        }));
      },
    }),
    {
      name: 'afn/groups/v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
