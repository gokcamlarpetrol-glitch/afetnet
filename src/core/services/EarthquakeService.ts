/**
 * EARTHQUAKE SERVICE - Clean Implementation
 * Fetches earthquake data from AFAD/USGS and updates store
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useEarthquakeStore, Earthquake } from '../stores/earthquakeStore';

const CACHE_KEY = 'afetnet_earthquakes_cache';
const LAST_FETCH_KEY = 'afetnet_earthquakes_last_fetch';
const POLL_INTERVAL = 60000; // 60 seconds

class EarthquakeService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[EarthquakeService] Starting...');
    
    // Initial fetch
    await this.fetchEarthquakes();
    
    // Start polling
    this.intervalId = setInterval(() => {
      this.fetchEarthquakes();
    }, POLL_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[EarthquakeService] Stopped');
  }

  async fetchEarthquakes() {
    const store = useEarthquakeStore.getState();
    store.setLoading(true);

    try {
      // Check network
      const netInfo = await NetInfo.fetch();
      
      if (!netInfo.isConnected) {
        // Load from cache
        const cached = await this.loadFromCache();
        if (cached) {
          store.setItems(cached);
          store.setError('Çevrimdışı - önbellek kullanılıyor');
        } else {
          store.setError('İnternet bağlantısı yok');
        }
        return;
      }

      // Fetch from AFAD
      const earthquakes = await this.fetchFromAFAD();
      
      if (earthquakes.length > 0) {
        store.setItems(earthquakes);
        await this.saveToCache(earthquakes);
      } else {
        // Fallback to USGS
        const usgsData = await this.fetchFromUSGS();
        store.setItems(usgsData);
        await this.saveToCache(usgsData);
      }
      
    } catch (error) {
      console.error('[EarthquakeService] Error:', error);
      
      // Try to load from cache on error
      const cached = await this.loadFromCache();
      if (cached) {
        store.setItems(cached);
        store.setError('Veri alınamadı - önbellek kullanılıyor');
      } else {
        store.setError('Deprem verileri yüklenemedi');
      }
    } finally {
      store.setLoading(false);
    }
  }

  private async fetchFromAFAD(): Promise<Earthquake[]> {
    try {
      const response = await fetch(
        'https://deprem.afad.gov.tr/EventService/GetEventsByFilter',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            StartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            EndDate: new Date().toISOString(),
          }),
        }
      );

      if (!response.ok) throw new Error('AFAD request failed');

      const data = await response.json();
      
      return (data || []).map((item: any) => ({
        id: `afad-${item.eventID || item.eventId || Date.now()}`,
        magnitude: parseFloat(item.magnitude || item.mag || 0),
        location: item.location || item.yer || 'Bilinmiyor',
        depth: parseFloat(item.depth || item.derinlik || 0),
        time: new Date(item.date || item.tarih || Date.now()).getTime(),
        latitude: parseFloat(item.latitude || item.lat || 0),
        longitude: parseFloat(item.longitude || item.lng || 0),
        source: 'AFAD' as const,
      })).filter((eq: Earthquake) => eq.magnitude > 0);
      
    } catch (error) {
      console.error('[EarthquakeService] AFAD fetch error:', error);
      return [];
    }
  }

  private async fetchFromUSGS(): Promise<Earthquake[]> {
    try {
      const response = await fetch(
        'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=100'
      );

      if (!response.ok) throw new Error('USGS request failed');

      const data = await response.json();
      
      return (data.features || []).map((feature: any) => ({
        id: `usgs-${feature.id}`,
        magnitude: feature.properties.mag || 0,
        location: feature.properties.place || 'Unknown',
        depth: feature.geometry.coordinates[2] || 0,
        time: feature.properties.time || Date.now(),
        latitude: feature.geometry.coordinates[1] || 0,
        longitude: feature.geometry.coordinates[0] || 0,
        source: 'USGS' as const,
      })).filter((eq: Earthquake) => eq.magnitude > 0);
      
    } catch (error) {
      console.error('[EarthquakeService] USGS fetch error:', error);
      return [];
    }
  }

  private async saveToCache(earthquakes: Earthquake[]) {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(earthquakes));
    } catch (error) {
      console.error('[EarthquakeService] Cache save error:', error);
    }
  }

  private async loadFromCache(): Promise<Earthquake[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('[EarthquakeService] Cache load error:', error);
      return null;
    }
  }
}

export const earthquakeService = new EarthquakeService();

