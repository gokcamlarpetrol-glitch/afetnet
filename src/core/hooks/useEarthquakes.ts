/**
 * EARTHQUAKES HOOK
 * Access earthquake data
 */

import { useEarthquakeStore } from '../stores/earthquakeStore';
import { earthquakeService } from '../services/EarthquakeService';

export function useEarthquakes() {
  const items = useEarthquakeStore(state => state.items);
  const loading = useEarthquakeStore(state => state.loading);
  const error = useEarthquakeStore(state => state.error);
  const lastUpdate = useEarthquakeStore(state => state.lastUpdate); // CRITICAL: Get lastUpdate from store

  const refresh = async () => {
    await earthquakeService.fetchEarthquakes();
  };

  return {
    earthquakes: items,
    loading,
    error,
    lastUpdate, // CRITICAL: Return lastUpdate timestamp
    refresh,
  };
}

