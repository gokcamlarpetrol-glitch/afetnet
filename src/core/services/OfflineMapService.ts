/**
 * OFFLINE MAP SERVICE - Critical Locations (No Internet Required)
 * Stores assembly points, hospitals, water distribution centers
 * Works completely offline using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

export interface MapLocation {
  id: string;
  type: 'assembly' | 'hospital' | 'water' | 'shelter' | 'police' | 'fire';
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  phone?: string;
  notes?: string;
}

class OfflineMapService {
  private locations: MapLocation[] = [];
  private isLoaded: boolean = false;
  private readonly STORAGE_KEY = '@afetnet:offline_maps';
  private readonly UPDATE_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Initialize service and load cached data
   */
  async initialize() {
    try {
      await this.loadFromCache();
      
      // Check if update is needed
      const lastUpdate = await this.getLastUpdateTime();
      const now = Date.now();
      
      if (!lastUpdate || now - lastUpdate > this.UPDATE_INTERVAL) {
        await this.fetchAndCacheData();
      }
      
      logger.info('OfflineMapService initialized');
    } catch (error) {
      logger.error('OfflineMapService init failed:', error);
    }
  }

  /**
   * Fetch data from server and cache it
   */
  private async fetchAndCacheData() {
    try {
      // Try fetching from real APIs first
      const realData = await this.fetchFromRealAPIs();
      if (realData.length > 0) {
        this.locations = realData;
        await this.saveToCache();
        await this.setLastUpdateTime(Date.now());
        logger.info('OfflineMapService: Real data cached');
        return;
      }
      
      // Fallback to sample data for Istanbul
      const sampleData: MapLocation[] = [
        // Assembly Points
        {
          id: 'asm-1',
          type: 'assembly',
          name: 'Taksim Meydanı Toplanma Alanı',
          address: 'Taksim, Beyoğlu, İstanbul',
          latitude: 41.0369,
          longitude: 28.9850,
          capacity: 50000,
        },
        {
          id: 'asm-2',
          type: 'assembly',
          name: 'Maçka Parkı Toplanma Alanı',
          address: 'Maçka, Şişli, İstanbul',
          latitude: 41.0458,
          longitude: 28.9947,
          capacity: 30000,
        },
        // Hospitals
        {
          id: 'hosp-1',
          type: 'hospital',
          name: 'İstanbul Üniversitesi Tıp Fakültesi',
          address: 'Fatih, İstanbul',
          latitude: 41.0082,
          longitude: 28.9784,
          phone: '0212 414 20 00',
        },
        {
          id: 'hosp-2',
          type: 'hospital',
          name: 'Şişli Etfal Hastanesi',
          address: 'Şişli, İstanbul',
          latitude: 41.0605,
          longitude: 28.9875,
          phone: '0212 373 50 00',
        },
        // Water Distribution
        {
          id: 'water-1',
          type: 'water',
          name: 'Beşiktaş Su Dağıtım Noktası',
          address: 'Beşiktaş, İstanbul',
          latitude: 41.0422,
          longitude: 29.0079,
        },
        // Shelters
        {
          id: 'shelter-1',
          type: 'shelter',
          name: 'Kadıköy Acil Barınma Merkezi',
          address: 'Kadıköy, İstanbul',
          latitude: 40.9903,
          longitude: 29.0241,
          capacity: 5000,
        },
      ];
      
      this.locations = sampleData;
      await this.saveToCache();
      await this.setLastUpdateTime(Date.now());
      
      logger.info('OfflineMapService: Sample data cached (fallback)');
    } catch (error) {
      logger.error('OfflineMapService fetch failed:', error);
    }
  }

  /**
   * Fetch from real APIs (AFAD, Sağlık Bakanlığı)
   */
  private async fetchFromRealAPIs(): Promise<MapLocation[]> {
    const locations: MapLocation[] = [];

    try {
      // AFAD Toplanma Alanları API - GeoJSON format
      // Gerçek endpoint: AFAD'ın GeoJSON toplanma alanları servisi
      // Create AbortController for timeout (AbortSignal.timeout not available in React Native)
      const afadController = new AbortController();
      const afadTimeoutId = setTimeout(() => afadController.abort(), 10000); // 10s timeout
      
      const afadResponse = await fetch('https://deprem.afad.gov.tr/apiv2/assembly-points', {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0',
        },
        signal: afadController.signal,
      }).catch(() => {
        clearTimeout(afadTimeoutId);
        // Fallback: AFAD'ın alternatif endpoint'i (GeoJSON format)
        const fallbackController = new AbortController();
        const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 10000);
        
        return fetch('https://deprem.afad.gov.tr/apiv2/assembly-areas.geojson', {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AfetNet/1.0',
          },
          signal: fallbackController.signal,
        }).finally(() => {
          clearTimeout(fallbackTimeoutId);
        });
      }).finally(() => {
        clearTimeout(afadTimeoutId);
      });

      if (afadResponse.ok) {
        const afadData = await afadResponse.json();
        
        // Handle GeoJSON format
        if (afadData.type === 'FeatureCollection' && Array.isArray(afadData.features)) {
          for (const feature of afadData.features) {
            if (feature.geometry?.type === 'Point' && feature.properties) {
              const [lon, lat] = feature.geometry.coordinates;
              const props = feature.properties;
              
              locations.push({
                id: `afad-${props.id || feature.id || Math.random()}`,
                type: 'assembly',
                name: props.name || props.adi || props.title || 'Toplanma Alanı',
                address: props.address || props.adres || props.location || '',
                latitude: parseFloat(lat),
                longitude: parseFloat(lon),
                capacity: props.capacity || props.kapasite,
              });
            }
          }
        }
        // Handle array format
        else if (Array.isArray(afadData)) {
          for (const item of afadData) {
            if ((item.lat || item.latitude) && (item.lng || item.longitude)) {
              locations.push({
                id: `afad-${item.id || Math.random()}`,
                type: 'assembly',
                name: item.name || item.title || item.adi || 'Toplanma Alanı',
                address: item.address || item.adres || item.location || '',
                latitude: parseFloat(item.lat || item.latitude),
                longitude: parseFloat(item.lng || item.longitude),
                capacity: item.capacity || item.kapasite,
              });
            }
          }
        }
      }
    } catch (error) {
      logger.warn('AFAD API failed, continuing with other sources:', error);
    }

    try {
      // Sağlık Bakanlığı Hastane Bilgileri
      // Alternatif: OpenStreetMap Nominatim API ile hastane arama
      // Create AbortController for timeout (AbortSignal.timeout not available in React Native)
      const hospitalController = new AbortController();
      const hospitalTimeoutId = setTimeout(() => hospitalController.abort(), 10000);
      
      const hospitalResponse = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=hastane&countrycodes=tr&limit=100', {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0',
          'Referer': 'https://afetnet.app',
        },
        signal: hospitalController.signal,
      }).catch(() => {
        clearTimeout(hospitalTimeoutId);
        // Fallback: Overpass API ile hastane verisi
        const overpassQuery = `[out:json][timeout:10];
        (
          node["amenity"="hospital"]["country"="TR"];
          way["amenity"="hospital"]["country"="TR"];
          relation["amenity"="hospital"]["country"="TR"];
        );
        out center meta;`;
        
        const overpassController = new AbortController();
        const overpassTimeoutId = setTimeout(() => overpassController.abort(), 15000);
        
        return fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'User-Agent': 'AfetNet/1.0',
          },
          body: overpassQuery,
          signal: overpassController.signal,
        }).finally(() => {
          clearTimeout(overpassTimeoutId);
        });
      }).finally(() => {
        clearTimeout(hospitalTimeoutId);
      });

      if (hospitalResponse.ok) {
        const hospitalData = await hospitalResponse.json();
        
        // Handle OpenStreetMap Nominatim format
        if (Array.isArray(hospitalData) && hospitalData[0]?.lat) {
          for (const item of hospitalData) {
            if (item.lat && item.lon && item.display_name) {
              locations.push({
                id: `hospital-${item.osm_id || item.place_id || Math.random()}`,
                type: 'hospital',
                name: item.display_name.split(',')[0] || 'Hastane',
                address: item.display_name,
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                phone: item.phone || item.tags?.phone,
              });
            }
          }
        }
        // Handle Overpass API format
        else if (hospitalData.elements) {
          for (const element of hospitalData.elements) {
            const center = element.center || { lat: element.lat, lon: element.lon };
            if (center.lat && center.lon) {
              const tags = element.tags || {};
              locations.push({
                id: `hospital-${element.id || Math.random()}`,
                type: 'hospital',
                name: tags.name || tags['name:tr'] || 'Hastane',
                address: tags['addr:full'] || tags['addr:street'] || '',
                latitude: parseFloat(center.lat),
                longitude: parseFloat(center.lon),
                phone: tags.phone || tags['contact:phone'],
              });
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Hospital API failed, continuing:', error);
    }

    return locations;
  }

  /**
   * Load data from cache
   */
  private async loadFromCache() {
    try {
      const cached = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (cached) {
        this.locations = JSON.parse(cached);
        this.isLoaded = true;
        logger.info(`OfflineMapService: Loaded ${this.locations.length} locations`);
      }
    } catch (error) {
      logger.error('OfflineMapService load failed:', error);
    }
  }

  /**
   * Save data to cache
   */
  private async saveToCache() {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.locations));
    } catch (error) {
      logger.error('OfflineMapService save failed:', error);
    }
  }

  /**
   * Get last update time
   */
  private async getLastUpdateTime(): Promise<number | null> {
    try {
      const time = await AsyncStorage.getItem(`${this.STORAGE_KEY}:last_update`);
      return time ? parseInt(time, 10) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set last update time
   */
  private async setLastUpdateTime(time: number) {
    try {
      await AsyncStorage.setItem(`${this.STORAGE_KEY}:last_update`, time.toString());
    } catch (error) {
      logger.error('OfflineMapService set time failed:', error);
    }
  }

  /**
   * Get all locations
   */
  getAllLocations(): MapLocation[] {
    return this.locations;
  }

  /**
   * Get locations by type
   */
  getLocationsByType(type: MapLocation['type']): MapLocation[] {
    return this.locations.filter((loc) => loc.type === type);
  }

  /**
   * Get nearest location
   */
  getNearestLocation(
    latitude: number,
    longitude: number,
    type?: MapLocation['type']
  ): MapLocation | null {
    let filtered = this.locations;
    
    if (type) {
      filtered = filtered.filter((loc) => loc.type === type);
    }
    
    if (filtered.length === 0) return null;
    
    // Calculate distances and find nearest
    const withDistances = filtered.map((loc) => ({
      location: loc,
      distance: this.calculateDistance(latitude, longitude, loc.latitude, loc.longitude),
    }));
    
    withDistances.sort((a, b) => a.distance - b.distance);
    
    return withDistances[0].location;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Force refresh data
   */
  async refresh() {
    await this.fetchAndCacheData();
  }
}

export const offlineMapService = new OfflineMapService();

