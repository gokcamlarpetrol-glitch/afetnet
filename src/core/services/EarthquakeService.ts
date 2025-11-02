/**
 * EARTHQUAKE SERVICE - Clean Implementation
 * Fetches earthquake data from AFAD/USGS/Kandilli and updates store
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useEarthquakeStore, Earthquake } from '../stores/earthquakeStore';
import { createLogger } from '../utils/logger';
import { autoCheckinService } from './AutoCheckinService';

const logger = createLogger('EarthquakeService');

const CACHE_KEY = 'afetnet_earthquakes_cache';
const LAST_FETCH_KEY = 'afetnet_earthquakes_last_fetch';
const POLL_INTERVAL = 30000; // 30 seconds - Real-time AFAD updates

class EarthquakeService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
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
  }

  async fetchEarthquakes() {
    const store = useEarthquakeStore.getState();
    store.setLoading(true);
    store.setError(null); // Clear previous errors

    try {
      let earthquakes: Earthquake[] = [];

      // 1. AFAD (Turkey - Primary source)
      const afadData = await this.fetchFromAFAD();
      if (afadData.length > 0) {
        earthquakes.push(...afadData);
      }

      // 2. USGS - DISABLED for Turkey-only mode
      // Will be re-enabled for global earthquake view
      
      // 3. Kandilli - DISABLED (HTTP endpoint doesn't work in React Native)
      // Will be re-enabled when we have a proper API or proxy

      // Deduplicate based on similar location and time (within 5 minutes and 10km)
      const uniqueEarthquakes = this.deduplicateEarthquakes(earthquakes);

      // Sort by time (newest first)
      uniqueEarthquakes.sort((a, b) => b.time - a.time);

      if (uniqueEarthquakes.length > 0) {
        const latestEq = uniqueEarthquakes[0];
        const lastCheckedEq = await AsyncStorage.getItem('last_checked_earthquake');
        
        console.log('🔝 EN SON DEPREM:', {
          location: latestEq.location,
          magnitude: latestEq.magnitude,
          time: new Date(latestEq.time).toLocaleString('tr-TR'),
          zamanFarki: Math.round((Date.now() - latestEq.time) / 60000) + ' dakika önce'
        });
        
        // Trigger auto check-in for new significant earthquakes (magnitude >= 4.0)
        if (latestEq.magnitude >= 4.0 && latestEq.id !== lastCheckedEq) {
          await AsyncStorage.setItem('last_checked_earthquake', latestEq.id);
          logger.info(`Triggering AutoCheckin for magnitude ${latestEq.magnitude} earthquake`);
          autoCheckinService.startCheckIn(latestEq.magnitude);
        }
        
        store.setItems(uniqueEarthquakes);
        console.log(`✅ Store güncellendi: ${uniqueEarthquakes.length} deprem`);
        await this.saveToCache(uniqueEarthquakes);
      } else {
        // Try cache if no new data
        const cached = await this.loadFromCache();
        if (cached && cached.length > 0) {
          store.setItems(cached);
        } else {
          store.setError('Deprem verisi alınamadı. İnternet bağlantınızı kontrol edin.');
        }
      }
    } catch (error) {
      // Try cache on error
      const cached = await this.loadFromCache();
      if (cached && cached.length > 0) {
        store.setItems(cached);
      } else {
        store.setError('Deprem verisi alınamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      store.setLoading(false);
    }
  }

  private deduplicateEarthquakes(earthquakes: Earthquake[]): Earthquake[] {
    const unique: Earthquake[] = [];
    const seen = new Set<string>();

    for (const eq of earthquakes) {
      // Create a key based on rounded location and time
      const timeKey = Math.floor(eq.time / (5 * 60 * 1000)); // 5 minute buckets
      const latKey = Math.round(eq.latitude * 100); // ~1km precision
      const lonKey = Math.round(eq.longitude * 100);
      const key = `${timeKey}-${latKey}-${lonKey}-${Math.round(eq.magnitude * 10)}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(eq);
      }
    }

    return unique;
  }

  private async fetchFromAFAD(): Promise<Earthquake[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      // AFAD API v2 - Son 24 saat (GERÇEK ZAMANLI)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const startDate = oneDayAgo.toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];
      
      const url = `https://deprem.afad.gov.tr/apiv2/event/filter?start=${startDate}&end=${endDate}&minmag=1`;
      
      console.log('📡 AFAD API çağrılıyor:', url);
      console.log('📅 Tarih aralığı:', startDate, 'dan', endDate, 'a kadar');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      
      // AFAD apiv2 returns array directly
      const events = Array.isArray(data) ? data : [];
      
      console.log(`✅ AFAD'dan ${events.length} deprem verisi alındı`);
      
      if (events.length === 0) {
        console.warn('⚠️ AFAD API boş veri döndü!');
        return [];
      }
      
      // İlk 3 depremi logla
      console.log('📊 İlk 3 deprem:');
      events.slice(0, 3).forEach((eq: any, i: number) => {
        console.log(`  ${i + 1}. ${eq.location} - Büyüklük: ${eq.mag} - Tarih: ${eq.eventDate}`);
      });
      
      const earthquakes = events.map((item: any) => {
        // AFAD apiv2 format
        const eventDate = item.eventDate || item.date || item.originTime;
        const magnitude = parseFloat(item.mag || item.magnitude || item.ml || '0');
        
        // Location parsing
        const locationParts = [
          item.location,
          item.ilce,
          item.sehir,
          item.title,
          item.place
        ].filter(Boolean);
        
        const location = locationParts.length > 0 
          ? locationParts.join(', ') 
          : 'Türkiye';
        
        return {
          id: `afad-${item.eventID || item.eventId || item.id || Date.now()}-${Math.random()}`,
          magnitude,
          location,
          depth: parseFloat(item.depth || item.derinlik || '10'),
          time: eventDate ? new Date(eventDate).getTime() : Date.now(),
          latitude: parseFloat(item.geojson?.coordinates?.[1] || item.latitude || item.lat || '0'),
          longitude: parseFloat(item.geojson?.coordinates?.[0] || item.longitude || item.lng || '0'),
          source: 'AFAD' as const,
        };
      })
      .filter((eq: Earthquake) => 
        eq.latitude !== 0 && 
        eq.longitude !== 0 &&
        eq.magnitude >= 1.0 // Minimum 1.0 magnitude
      )
      .sort((a, b) => b.time - a.time) // Newest first
      .slice(0, 100); // Max 100

      return earthquakes;
      
    } catch (error) {
      // Silent fail - return empty array, cache will be used
      return [];
    }
  }

  private async fetchFromUSGS(): Promise<Earthquake[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const startTime = new Date(oneDayAgo).toISOString();
      
      const response = await fetch(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&minmagnitude=3.0&orderby=time&limit=500`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AfetNet/1.0',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
      }

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
      })).filter((eq: Earthquake) => eq.magnitude >= 3.0);
      
    } catch (error) {
      return [];
    }
  }

  private async fetchFromKandilli(): Promise<Earthquake[]> {
    // DISABLED: Kandilli HTTP endpoint doesn't work in React Native
    return [];
  }

  private async saveToCache(earthquakes: Earthquake[]) {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(earthquakes));
      await AsyncStorage.setItem(LAST_FETCH_KEY, String(Date.now()));
    } catch (error) {
      logger.error('Cache save error:', error);
    }
  }

  private async loadFromCache(): Promise<Earthquake[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Cache load error:', error);
      return null;
    }
  }

  /**
   * Fetch detailed earthquake data from AFAD API
   * Real-time data for Apple compliance
   */
  async fetchEarthquakeDetail(eventID: string): Promise<Earthquake | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Try AFAD API v2 event detail endpoint
      const url = `https://deprem.afad.gov.tr/apiv2/event/${eventID}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // If detail endpoint fails, try to find it in the list
        return await this.findEarthquakeInList(eventID);
      }

      const data = await response.json();

      if (!data) {
        return null;
      }

      // Parse AFAD detail response
      const earthquake: Earthquake = {
        id: `afad-${data.eventID || data.eventId || eventID}`,
        magnitude: parseFloat(data.mag || data.magnitude || data.ml || '0'),
        location: data.location || data.title || data.place || 'Türkiye',
        depth: parseFloat(data.depth || data.derinlik || '10'),
        time: data.eventDate ? new Date(data.eventDate).getTime() : Date.now(),
        latitude: parseFloat(data.geojson?.coordinates?.[1] || data.latitude || data.lat || '0'),
        longitude: parseFloat(data.geojson?.coordinates?.[0] || data.longitude || data.lng || '0'),
        source: 'AFAD' as const,
      };

      return earthquake;
    } catch (error) {
      logger.error('Earthquake detail fetch error:', error);
      // Fallback: Try to find in cached list
      return await this.findEarthquakeInList(eventID);
    }
  }

  /**
   * Find earthquake in cached list by eventID
   */
  private async findEarthquakeInList(eventID: string): Promise<Earthquake | null> {
    try {
      const cached = await this.loadFromCache();
      if (!cached) return null;

      // Find earthquake with matching eventID
      const earthquake = cached.find(eq => eq.id.includes(eventID));
      return earthquake || null;
    } catch (error) {
      return null;
    }
  }
}

export const earthquakeService = new EarthquakeService();

