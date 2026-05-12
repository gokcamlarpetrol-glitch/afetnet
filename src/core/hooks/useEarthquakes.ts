/**
 * EARTHQUAKES HOOK
 * Access earthquake data
 */

import { useCallback } from 'react';
import { useEarthquakeStore } from '../stores/earthquakeStore';
import { earthquakeService } from '../services/EarthquakeService';

export function useEarthquakes() {
  const items = useEarthquakeStore(state => state.items);
  const loading = useEarthquakeStore(state => state.loading);
  const error = useEarthquakeStore(state => state.error);
  const lastUpdate = useEarthquakeStore(state => state.lastUpdate);

  // CRITICAL FIX: Wrap in useCallback to provide stable reference.
  // Without this, every consumer's useEffect/useMemo that depends on
  // `refresh` re-runs on every render (new function reference each time).
  const refresh = useCallback(async () => {
    await earthquakeService.fetchEarthquakes();
  }, []);

  return {
    earthquakes: items,
    loading,
    error,
    lastUpdate,
    refresh,
  };
}

