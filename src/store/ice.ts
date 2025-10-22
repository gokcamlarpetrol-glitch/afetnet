import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type IceContact = { 
  id: string; 
  name: string; 
  phone: string; 
  relation?: string; 
  priority: number; 
};

export type SmsTemplate = { 
  id: string; 
  label: string; 
  text: string; 
}; // {Konum}, {Durum}, {KişiSayısı}

export type SmsQueueItem = { 
  id: string; 
  phone: string; 
  body: string; 
  created: number; 
  sent?: number; 
  attempts: number; 
};

export interface IceState {
  contacts: IceContact[];
  templates: SmsTemplate[];
  queue: SmsQueueItem[];
}

interface IceActions {
   
  addContact: (contact: IceContact) => void;
   
  removeContact: (id: string) => void;
   
  updateContact: (id: string, updates: Partial<IceContact>) => void;
   
  reorder: (ids: string[]) => void;
   
  addTemplate: (template: SmsTemplate) => void;
   
  updateTemplate: (template: SmsTemplate) => void;
   
  removeTemplate: (id: string) => void;
  enqueue: (to: string, body: string) => void;
  markSent: (id: string) => void;
  clearQueue: () => void;
  getNextQueued: () => SmsQueueItem | null;
}

const defaultTemplates: SmsTemplate[] = [
  {
    id: 'short_sos',
    label: 'Kısa SOS',
    text: 'AfetNet SOS: Yardım lazım. {Durum}. {KişiSayısı}. Son konumum: {Konum}',
  },
  {
    id: 'detailed_sos',
    label: 'Detaylı SOS',
    text: 'AfetNet: Enkazdayım. {Durum}. {KişiSayısı}. Yaklaşık konum: {Konum}. Lütfen koordinasyonu sağlayın.',
  },
];

const defaultState: IceState = {
  contacts: [],
  templates: defaultTemplates,
  queue: [],
};

export const useIce = create<IceState & IceActions>()(
  persist(
    (set, get) => ({
      ...defaultState,

      addContact: (contact: IceContact) => {
        set((state) => ({
          contacts: [...state.contacts, contact],
        }));
      },

      removeContact: (id: string) => {
        set((state) => ({
          contacts: state.contacts.filter(c => c.id !== id),
        }));
      },

      updateContact: (id: string, updates: Partial<IceContact>) => {
        set((state) => ({
          contacts: state.contacts.map(c =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        }));
      },

      reorder: (ids: string[]) => {
        set((state) => {
          const contactMap = new Map(state.contacts.map(c => [c.id, c]));
          const reorderedContacts = ids
            .map(id => contactMap.get(id))
            .filter((contact): contact is IceContact => contact !== undefined);
          
          return { contacts: reorderedContacts };
        });
      },

      addTemplate: (template: SmsTemplate) => {
        set((state) => ({
          templates: [...state.templates, template],
        }));
      },

      updateTemplate: (template: SmsTemplate) => {
        set((state) => ({
          templates: state.templates.map(t =>
            t.id === template.id ? template : t,
          ),
        }));
      },

      removeTemplate: (id: string) => {
        set((state) => ({
          templates: state.templates.filter(t => t.id !== id),
        }));
      },

      enqueue: (to: string, body: string) => {
        const queueItem: SmsQueueItem = {
          id: `queue_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          phone: to,
          body,
          created: Date.now(),
          attempts: 0,
        };

        set((state) => ({
          queue: [...state.queue, queueItem],
        }));
      },

      markSent: (id: string) => {
        set((state) => ({
          queue: state.queue.map(item =>
            item.id === id ? { ...item, sent: Date.now() } : item,
          ),
        }));
      },

      clearQueue: () => {
        set({ queue: [] });
      },

      getNextQueued: () => {
        const { queue } = get();
        return queue.find(item => !item.sent) || null;
      },
    }),
    {
      name: 'afn/ice/v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Ensure templates exist
        const state = { ...defaultState, ...persistedState };
        if (!state.templates || state.templates.length === 0) {
          state.templates = defaultTemplates;
        }
        return state;
      },
    },
  ),
);
