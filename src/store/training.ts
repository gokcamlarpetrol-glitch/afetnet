import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TrainingScenario = 'single' | 'multi' | 'triangulate';

export interface TrainingState {
  enabled: boolean;
  scenario: TrainingScenario;
  count: number;
  activeIncidents: string[];
}

interface TrainingActions {
  setEnabled: (enabled: boolean) => void;
  setScenario: (scenario: TrainingScenario) => void;
  setCount: (count: number) => void;
  addActiveIncident: (id: string) => void;
  removeActiveIncident: (id: string) => void;
  clearActiveIncidents: () => void;
  reset: () => void;
}

const defaultState: TrainingState = {
  enabled: false,
  scenario: 'single',
  count: 3,
  activeIncidents: [],
};

export const useTraining = create<TrainingState & TrainingActions>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setEnabled: (enabled: boolean) => {
        set({ enabled });
        if (!enabled) {
          // Clear active incidents when training is disabled
          get().clearActiveIncidents();
        }
      },

      setScenario: (scenario: TrainingScenario) => {
        set({ scenario });
      },

      setCount: (count: number) => {
        set({ count: Math.max(1, Math.min(10, count)) });
      },

      addActiveIncident: (id: string) => {
        set((state) => ({
          activeIncidents: [...state.activeIncidents, id],
        }));
      },

      removeActiveIncident: (id: string) => {
        set((state) => ({
          activeIncidents: state.activeIncidents.filter(incidentId => incidentId !== id),
        }));
      },

      clearActiveIncidents: () => {
        set({ activeIncidents: [] });
      },

      reset: () => {
        set(defaultState);
      },
    }),
    {
      name: 'afn/training/v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        return { ...defaultState, ...persistedState };
      },
    },
  ),
);
