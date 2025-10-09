import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LogEvent {
  ts: number;
  tag: string;
  data?: any;
}

interface DevLogState {
  events: LogEvent[];
  maxEvents: number;
}

interface DevLogActions {
  log: (tag: string, data?: any) => void;
  getEvents: (filter?: string) => LogEvent[];
  clear: () => void;
  exportEvents: () => LogEvent[];
}

const defaultState: DevLogState = {
  events: [],
  maxEvents: 1000
};

export const useDevLog = create<DevLogState & DevLogActions>()(
  persist(
    (set, get) => ({
      ...defaultState,

      log: (tag: string, data?: any) => {
        const event: LogEvent = {
          ts: Date.now(),
          tag,
          data
        };

        set((state) => {
          const newEvents = [...state.events, event];
          // Keep only the last maxEvents
          if (newEvents.length > state.maxEvents) {
            newEvents.splice(0, newEvents.length - state.maxEvents);
          }
          return { events: newEvents };
        });
      },

      getEvents: (filter?: string) => {
        const { events } = get();
        if (!filter) return events;
        
        return events.filter(event => event.tag.includes(filter));
      },

      clear: () => {
        set({ events: [] });
      },

      exportEvents: () => {
        const { events } = get();
        return [...events];
      }
    }),
    {
      name: 'afn/devlog/v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        return { ...defaultState, ...persistedState };
      }
    }
  )
);

// Convenience function for global logging
export function logEvent(tag: string, data?: any) {
  useDevLog.getState().log(tag, data);
}