import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MapStyle = 'standard' | 'satellite' | 'hybrid' | 'terrain' | 'dark';

export interface MapFilters {
    minMagnitude: number;
    timeRange: '1h' | '6h' | '24h' | '7d' | 'all';
    showFaultLines: boolean;
    showHeatmap: boolean;
    showCriticalInfrastructure: boolean;
}

interface MapState {
    // Visual Configuration
    mapStyle: MapStyle;
    is3DMode: boolean;

    // Filtering
    filters: MapFilters;

    // Interaction Modes
    mode: 'view' | 'report' | 'evacuation';

    // Actions
    setMapStyle: (style: MapStyle) => void;
    toggle3DMode: () => void;
    setFilters: (filters: Partial<MapFilters>) => void;
    setMode: (mode: 'view' | 'report' | 'evacuation') => void;
    resetFilters: () => void;
}

const defaultFilters: MapFilters = {
  minMagnitude: 0,
  timeRange: '7d',
  showFaultLines: true,
  showHeatmap: true,
  showCriticalInfrastructure: true,
};

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      mapStyle: 'standard',
      is3DMode: false,
      filters: defaultFilters,
      mode: 'view',

      setMapStyle: (style) => set({ mapStyle: style }),

      toggle3DMode: () => set((state) => ({ is3DMode: !state.is3DMode })),

      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      setMode: (mode) => set({ mode }),

      resetFilters: () => set({ filters: defaultFilters }),
    }),
    {
      name: 'map-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<MapState> | undefined;
        if (version === 0) {
          // if coming from version 0 (or undefined), ensure filters exists
          return {
            ...state,
            filters: {
              ...defaultFilters,
              ...(state?.filters || {}),
            },
          } as MapState;
        }
        return state as MapState;
      },
    },
  ),
);
