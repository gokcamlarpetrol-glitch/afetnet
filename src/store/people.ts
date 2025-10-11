import { create } from 'zustand';
import { logger } from '../utils/productionLogger';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pubKeyToAfnId } from '../identity/afnId';

export type Person = {
  id: string;              // internal UUID
  displayName: string;
  afnId?: string;          // from pubKey
  pubKeyB64?: string;      // known after pairing or if user provided
  phoneE164?: string;      // optional; never uploaded
  relation?: string;
  paired: boolean;         // E2E available if true
  lastSeen?: number;
};

export type PeopleState = {
  meAfnId: string;
  items: Person[];
  addOrUpdate: (p: Partial<Person> & { id?: string }) => string; // returns id
  remove: (id: string) => void;
  markPaired: (id: string, pubKeyB64: string, afnId: string) => void;
  findByAfnId: (afnId: string) => Person | undefined;
  findByPhone: (phoneE164: string) => Person | undefined;
  updateMyAfnId: (afnId: string) => void;
  getPairedCount: () => number;
  getTotalCount: () => number;
};

function generateId(): string {
  return `person_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export const usePeople = create<PeopleState>()(
  persist(
    (set, get) => ({
      meAfnId: '',
      items: [],

      addOrUpdate: (personData) => {
        const { id, ...data } = personData;
        const existingId = id || generateId();
        
        set((state) => {
          const existingIndex = state.items.findIndex(p => p.id === existingId);
          
          if (existingIndex >= 0) {
            // Update existing person
            const updatedItems = [...state.items];
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              ...data,
              id: existingId
            };
            return { items: updatedItems };
          } else {
            // Add new person
            const newPerson: Person = {
              id: existingId,
              displayName: data.displayName || 'İsimsiz Kişi',
              afnId: data.afnId,
              pubKeyB64: data.pubKeyB64,
              phoneE164: data.phoneE164,
              relation: data.relation,
              paired: data.paired || false,
              lastSeen: data.lastSeen
            };
            return { items: [...state.items, newPerson] };
          }
        });
        
        return existingId;
      },

      remove: (id) => {
        set((state) => ({
          items: state.items.filter(p => p.id !== id)
        }));
      },

      markPaired: (id, pubKeyB64, afnId) => {
        set((state) => ({
          items: state.items.map(p => 
            p.id === id 
              ? { 
                  ...p, 
                  pubKeyB64, 
                  afnId, 
                  paired: true,
                  lastSeen: Date.now()
                }
              : p
          )
        }));
      },

      findByAfnId: (afnId) => {
        const state = get();
        return state.items.find(p => p.afnId === afnId);
      },

      findByPhone: (phoneE164) => {
        const state = get();
        return state.items.find(p => p.phoneE164 === phoneE164);
      },

      updateMyAfnId: (afnId) => {
        set({ meAfnId: afnId });
      },

      getPairedCount: () => {
        const state = get();
        return state.items.filter(p => p.paired).length;
      },

      getTotalCount: () => {
        const state = get();
        return state.items.length;
      }
    }),
    {
      name: 'afn/people/v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Ensure meAfnId is set if not present
        const state = { meAfnId: '', items: [], ...persistedState };
        
        // If meAfnId is empty, we'll set it when the keypair is loaded
        if (!state.meAfnId) {
          logger.debug('People store: meAfnId not set, will be initialized on keypair load');
        }
        
        return state;
      }
    }
  )
);

// Initialize AFN-ID when keypair is available
export async function initializeMyAfnId(): Promise<void> {
  try {
    const { getPublicKey } = await import('../identity/keypair');
    const { pubKeyToAfnId } = await import('../identity/afnId');
    
    const pubKey = await getPublicKey();
    const afnId = pubKeyToAfnId(pubKey);
    
    usePeople.getState().updateMyAfnId(afnId);
  } catch (error) {
    logger.error('Failed to initialize AFN-ID:', error);
  }
}
