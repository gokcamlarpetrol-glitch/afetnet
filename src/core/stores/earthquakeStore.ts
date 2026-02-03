/**
 * EARTHQUAKE STORE - Simple, No Selectors, No Persist
 * Direct getState/setState pattern only
 */

import { create } from 'zustand';
import { createLogger } from '../utils/logger';

const logger = createLogger('EarthquakeStore');

export interface Earthquake {
  id: string;
  magnitude: number;
  location: string;
  depth: number;
  time: number;
  latitude: number;
  longitude: number;
  source: 'AFAD' | 'USGS' | 'KANDILLI' | 'EMSC' | 'KOERI' | 'SEISMIC_SENSOR';
  date?: string; // ISO String
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

  // ELITE: Force update mechanism - always create new array reference
  // This ensures Zustand subscribers always detect changes, even if items are identical
  setItems: (items) => {
    // CRITICAL: Create shallow copy to ensure new reference
    // This guarantees Zustand's shallow equality check will detect the change
    const newItems = Array.isArray(items) ? [...items] : items;
    const updateTimestamp = Date.now(); // CRITICAL: Always use current timestamp for real-time updates
    set({
      items: newItems,
      lastUpdate: updateTimestamp, // CRITICAL: Always update timestamp when data changes - ensures UI shows real-time update time
      error: null,
    });

    // CRITICAL: Verify timestamp was set correctly
    if (__DEV__) {
      const updateTime = new Date(updateTimestamp).toLocaleTimeString('tr-TR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      // Only log if significant data change (avoid spam)
      if (newItems.length > 0) {
        logger.debug(`✅ Store lastUpdate set: ${updateTime} (${newItems.length} deprem)`);
      }
    }
  },
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  clear: () => set(initialState),
}));

