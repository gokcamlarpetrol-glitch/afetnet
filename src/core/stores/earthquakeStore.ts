/**
 * EARTHQUAKE STORE - Simple, No Selectors, No Persist
 * Direct getState/setState pattern only
 */

import { create } from 'zustand';

export interface Earthquake {
  id: string;
  magnitude: number;
  location: string;
  depth: number;
  time: number;
  latitude: number;
  longitude: number;
  source: 'AFAD' | 'USGS' | 'KANDILLI';
}

interface EarthquakeState {
  items: Earthquake[];
  loading: boolean;
  error: string | null;
  lastUpdate: number | null;
}

interface EarthquakeActions {
  setItems: (items: Earthquake[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

const initialState: EarthquakeState = {
  items: [],
  loading: false,
  error: null,
  lastUpdate: null,
};

export const useEarthquakeStore = create<EarthquakeState & EarthquakeActions>((set) => ({
  ...initialState,
  
  setItems: (items) => set({ items, lastUpdate: Date.now(), error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  clear: () => set(initialState),
}));

