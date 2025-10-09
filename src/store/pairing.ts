import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { deriveSharedKey } from '../lib/cryptoGroup';

export interface PairedContact {
  id: string;
  name: string;
  pubKeyB64: string;
  lastSeen: number;
  sharedKey?: Uint8Array; // precomputed shared secret
}

export interface Group {
  id: string;
  name: string;
  memberPubKeysB64: string[];
  sharedKeyB64?: string;
  created: number;
  updated: number;
}

interface PairingState {
  pairedContacts: PairedContact[];
  groups: Group[];
  myPublicKey?: string;
  mySecretKey?: Uint8Array;
}

interface PairingActions {
  addContact: (contact: Omit<PairedContact, 'lastSeen'>) => void;
  updateContactLastSeen: (id: string) => void;
  removeContact: (id: string) => void;
  addGroup: (group: Omit<Group, 'created' | 'updated'>) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  setGroupSharedKey: (groupId: string, sharedKeyB64: string) => void;
  getSharedFor: (pubKey: string) => Uint8Array | null;
  setMyKeys: (publicKey: string, secretKey: Uint8Array) => void;
  clearAll: () => void;
}

const defaultState: PairingState = {
  pairedContacts: [],
  groups: [],
  myPublicKey: undefined,
  mySecretKey: undefined
};

export const usePairing = create<PairingState & PairingActions>()(
  persist(
    (set, get) => ({
      ...defaultState,

      addContact: (contact) => {
        const { mySecretKey } = get();
        if (!mySecretKey) {
          console.warn('Cannot add contact: no secret key available');
          return;
        }

        const sharedKey: any = deriveSharedKey(contact.pubKeyB64 as any, mySecretKey);
        const newContact: PairedContact = {
          ...contact,
          lastSeen: Date.now(),
          sharedKey: sharedKey as any
        };

        set((state) => ({
          pairedContacts: [
            ...state.pairedContacts.filter(c => c.id !== contact.id),
            newContact
          ]
        }));
      },

      updateContactLastSeen: (id) => {
        set((state) => ({
          pairedContacts: state.pairedContacts.map(contact =>
            contact.id === id ? { ...contact, lastSeen: Date.now() } : contact
          )
        }));
      },

      removeContact: (id) => {
        set((state) => ({
          pairedContacts: state.pairedContacts.filter(c => c.id !== id)
        }));
      },

      addGroup: (group) => {
        const newGroup: Group = {
          ...group,
          created: Date.now(),
          updated: Date.now()
        };

        set((state) => ({
          groups: [...state.groups, newGroup]
        }));
      },

      updateGroup: (id, updates) => {
        set((state) => ({
          groups: state.groups.map(group =>
            group.id === id ? { ...group, ...updates, updated: Date.now() } : group
          )
        }));
      },

      setGroupSharedKey: (groupId, sharedKeyB64) => {
        set((state) => ({
          groups: state.groups.map(group =>
            group.id === groupId ? { ...group, sharedKeyB64, updated: Date.now() } : group
          )
        }));
      },

      getSharedFor: (pubKey) => {
        const { pairedContacts, mySecretKey } = get();
        if (!mySecretKey) return null;

        const contact = pairedContacts.find(c => c.pubKeyB64 === pubKey);
        if (contact?.sharedKey) {
          return contact.sharedKey as any;
        }

        // Compute and cache shared key
        const sharedKey: any = deriveSharedKey(pubKey as any, mySecretKey);
        set((state) => ({
          pairedContacts: state.pairedContacts.map(c =>
            c.pubKeyB64 === pubKey ? { ...c, sharedKey: sharedKey as any } : c
          ) as any
        }));

        return sharedKey;
      },

      setMyKeys: (publicKey, secretKey) => {
        set({ myPublicKey: publicKey, mySecretKey: secretKey });
      },

      clearAll: () => {
        set(defaultState);
      }
    }),
    {
      name: 'afn/pairing/v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Handle migrations if needed
        return { ...defaultState, ...persistedState };
      }
    }
  )
);
