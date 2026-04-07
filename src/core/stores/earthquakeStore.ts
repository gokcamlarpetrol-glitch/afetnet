/**
 * EARTHQUAKE STORE - Simple, No Selectors, No Persist
 * Direct getState/setState pattern only
 *
 * CRITICAL FIX: Synchronous MMKV cache read at module load time.
 * Without this, the store starts with items=[] and the earthquake screen
 * shows an empty list until EarthquakeService.start() (init.ts Phase D)
 * loads the cache asynchronously. By reading MMKV synchronously here,
 * earthquake data is available from the very first render.
 */

import { create } from 'zustand';
import { DirectStorage } from '../utils/storage';
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

// CRITICAL FIX: Read earthquake cache SYNCHRONOUSLY from MMKV at module load time.
// This ensures earthquake data is available from the very first render,
// without waiting for EarthquakeService.start() in init.ts Phase D.
const getInitialEarthquakes = (): { items: Earthquake[]; lastUpdate: number | null } => {
  try {
    // Try atomic cache first (consistent data + timestamp)
    const atomicRaw = DirectStorage.getString('afetnet_earthquakes_atomic_cache');
    if (atomicRaw) {
      const parsed = JSON.parse(atomicRaw);
      if (parsed?.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
        // Check cache age — only use if less than 24 hours old
        const cacheAge = Date.now() - (parsed.fetchedAt || 0);
        if (cacheAge < 24 * 60 * 60 * 1000) {
          // CRITICAL FIX: Sort by time descending so newest earthquakes appear first.
          // Without sorting, cached data may show old earthquakes at the top of the list
          // until fresh data arrives (~30s later).
          const sorted = [...parsed.data].sort((a: Earthquake, b: Earthquake) => (b.time || 0) - (a.time || 0));
          return { items: sorted, lastUpdate: parsed.fetchedAt || Date.now() };
        }
      }
    }
    // Fallback to legacy key
    const cached = DirectStorage.getString('afetnet_earthquakes_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const lastFetchStr = DirectStorage.getString('afetnet_earthquakes_last_fetch');
        const lastFetch = lastFetchStr ? parseInt(lastFetchStr, 10) : Date.now();
        const cacheAge = Date.now() - lastFetch;
        if (cacheAge < 24 * 60 * 60 * 1000) {
          // CRITICAL FIX: Sort legacy cache too
          const sorted = [...parsed].sort((a: Earthquake, b: Earthquake) => (b.time || 0) - (a.time || 0));
          return { items: sorted, lastUpdate: lastFetch };
        }
      }
    }
  } catch {
    // MMKV read failed — start empty, EarthquakeService will load later
  }
  return { items: [], lastUpdate: null };
};

const cachedData = getInitialEarthquakes();

const initialState: EarthquakeState = {
  items: cachedData.items,
  loading: false,
  error: null,
  lastUpdate: cachedData.lastUpdate,
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
  clear: () => set({ items: [], loading: false, error: null, lastUpdate: null }),
}));

