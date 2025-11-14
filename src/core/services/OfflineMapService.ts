/**
 * OFFLINE MAP SERVICE - Critical Locations (No Internet Required)
 * Stores assembly points, hospitals, water distribution centers
 * Works completely offline using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { mapCacheService } from './MapCacheService';

export interface MapLocation {
  id: string;
  type: 'assembly' | 'hospital' | 'water' | 'shelter' | 'police' | 'fire' | 'home';
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  phone?: string;
  notes?: string;
  isSample?: boolean;
}

class OfflineMapService {
  private locations: MapLocation[] = [];
  private isLoaded: boolean = false;
  private readonly STORAGE_KEY = '@afetnet:offline_maps';
  private readonly UPDATE_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private usingSampleData = false;

  /**
   * Initialize service and load cached data
   */
  async initialize() {
    try {
      // CRITICAL: Load cache FIRST for instant offline access
      await this.loadFromCache();
      
      // CRITICAL: Try to update in background, but don't block if offline
      // App MUST work without internet - cache is sufficient
      const lastUpdate = await this.getLastUpdateTime();
      const now = Date.now();
      
      if (!lastUpdate || now - lastUpdate > this.UPDATE_INTERVAL) {
        // CRITICAL: Fetch in background - don't wait, don't fail if offline
        this.fetchAndCacheData().catch((error) => {
          // CRITICAL: If fetch fails (offline), continue with cached data
          logger.info('OfflineMapService: Fetch failed (offline mode) - using cached data');
          // Ensure we have at least sample data if cache is empty
          if (this.locations.length === 0) {
            this.loadSampleData();
          }
        });
      }
      
      // CRITICAL: Ensure we have data even if fetch fails
      if (this.locations.length === 0) {
        this.loadSampleData();
      }
      
      logger.info('OfflineMapService initialized');
    } catch (error) {
      logger.error('OfflineMapService init failed:', error);
      // CRITICAL: Fallback to sample data if initialization fails
      if (this.locations.length === 0) {
        this.loadSampleData();
      }
    }
  }
  
  /**
   * CRITICAL: Load sample data as fallback
   */
  private loadSampleData() {
    const sampleData: MapLocation[] = [
      {
        id: 'asm-1',
        type: 'assembly',
        name: 'Taksim Meydanı Toplanma Alanı',
        address: 'Taksim, Beyoğlu, İstanbul',
        latitude: 41.0369,
        longitude: 28.9850,
        capacity: 50000,
        isSample: true,
      },
      {
        id: 'asm-2',
        type: 'assembly',
        name: 'Maçka Parkı Toplanma Alanı',
        address: 'Maçka, Şişli, İstanbul',
        latitude: 41.0458,
        longitude: 28.9947,
        capacity: 30000,
        isSample: true,
      },
      {
        id: 'hosp-1',
        type: 'hospital',
        name: 'İstanbul Üniversitesi Tıp Fakültesi',
        address: 'Fatih, İstanbul',
        latitude: 41.0082,
        longitude: 28.9784,
        phone: '0212 414 20 00',
        isSample: true,
      },
      {
        id: 'hosp-2',
        type: 'hospital',
        name: 'Şişli Etfal Hastanesi',
        address: 'Şişli, İstanbul',
        latitude: 41.0605,
        longitude: 28.9875,
        phone: '0212 373 50 00',
        isSample: true,
      },
    ];
    
    this.locations = sampleData;
    this.usingSampleData = true;
    // CRITICAL: Save sample data to cache for offline use
    this.saveToCache().catch((error) => {
      logger.error('Failed to save sample data to cache:', error);
    });
  }

  /**
   * Fetch data from server and cache it
   */
  private async fetchAndCacheData() {
    try {
      // Try fetching from real APIs first
      const realData = await this.fetchFromRealAPIs();
      if (realData.length > 0) {
        const normalized = realData.map(loc => ({ ...loc, isSample: !!loc.isSample }));
        this.locations = normalized;
        this.usingSampleData = normalized.length > 0 && normalized.every(loc => loc.isSample);
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
          isSample: true,
        },
        {
          id: 'asm-2',
          type: 'assembly',
          name: 'Maçka Parkı Toplanma Alanı',
          address: 'Maçka, Şişli, İstanbul',
          latitude: 41.0458,
          longitude: 28.9947,
          capacity: 30000,
          isSample: true,
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
          isSample: true,
        },
        {
          id: 'hosp-2',
          type: 'hospital',
          name: 'Şişli Etfal Hastanesi',
          address: 'Şişli, İstanbul',
          latitude: 41.0605,
          longitude: 28.9875,
          phone: '0212 373 50 00',
          isSample: true,
        },
        // Water Distribution
        {
          id: 'water-1',
          type: 'water',
          name: 'Beşiktaş Su Dağıtım Noktası',
          address: 'Beşiktaş, İstanbul',
          latitude: 41.0422,
          longitude: 29.0079,
          isSample: true,
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
          isSample: true,
        },
      ];
      
      this.locations = sampleData;
      await this.saveToCache();
      await this.setLastUpdateTime(Date.now());
      
      this.usingSampleData = true;
      logger.info('OfflineMapService: Sample data cached (fallback)');
    } catch (error) {
      logger.error('OfflineMapService fetch failed:', error);
    }
  }

  /**
   * Fetch from real APIs (AFAD, Sağlık Bakanlığı)
   * ELITE: Enhanced with retry mechanism and better error handling
   */
  private async fetchFromRealAPIs(retries: number = 3): Promise<MapLocation[]> {
    const locations: MapLocation[] = [];

    // ELITE: Check cache first
    const cacheKey = 'offline_locations_api';
    const cached = await mapCacheService.get<MapLocation[]>(cacheKey);
    if (cached && cached.length > 0) {
      logger.info('Using cached offline locations');
      return cached.map(loc => ({ ...loc, isSample: !!loc.isSample }));
    }

    try {
      // AFAD Toplanma Alanları API - GeoJSON format
      // ELITE: Retry mechanism with exponential backoff
      let lastError: Error | null = null;
      let afadSuccess = false;
      
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const afadController = new AbortController();
          const timeout = 10000 * (attempt + 1); // Increase timeout with retries
          const afadTimeoutId = setTimeout(() => afadController.abort(), timeout);
      
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

          if (afadResponse && afadResponse.ok) {
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
                    isSample: false,
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
                    isSample: false,
                  });
                }
              }
            }
            
            clearTimeout(afadTimeoutId);
            afadSuccess = true;
            break; // Success, exit retry loop
          }
        } catch (error) {
          lastError = error as Error;
          if (attempt < retries - 1) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            logger.warn(`AFAD API attempt ${attempt + 1} failed, retrying...`);
          }
        }
      }
      
      if (!afadSuccess && lastError) {
        logger.warn('AFAD API failed after retries:', lastError);
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
                isSample: false,
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
                isSample: false,
              });
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Hospital API failed, continuing:', error);
    }

    // ELITE: Cache successful results
    if (locations.length > 0) {
      await mapCacheService.set('offline_locations_api', locations, 30 * 60 * 1000); // 30 minutes
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
        const parsed: MapLocation[] = JSON.parse(cached);
        this.locations = parsed;
        this.usingSampleData = parsed.length > 0 && parsed.every((loc) => loc.isSample);
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

  isUsingSampleData(): boolean {
    return this.usingSampleData;
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

  /**
   * ELITE: Add custom location (user's home, custom assembly point, etc.)
   */
  async addCustomLocation(location: Omit<MapLocation, 'id'>): Promise<boolean> {
    try {
      // ELITE: Validate location data
      if (!location.name || location.name.trim().length === 0) {
        logger.warn('Invalid location name');
        return false;
      }

      if (typeof location.latitude !== 'number' || isNaN(location.latitude) || 
          location.latitude < -90 || location.latitude > 90) {
        logger.warn('Invalid latitude:', location.latitude);
        return false;
      }

      if (typeof location.longitude !== 'number' || isNaN(location.longitude) || 
          location.longitude < -180 || location.longitude > 180) {
        logger.warn('Invalid longitude:', location.longitude);
        return false;
      }

      // ELITE: Generate unique ID
      const newLocation: MapLocation = {
        ...location,
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };

      // ELITE: Add to locations array
      this.locations.push(newLocation);
      
      // ELITE: Save to cache
      await this.saveToCache();
      
      logger.info('Custom location added:', newLocation.id);
      return true;
    } catch (error) {
      logger.error('Failed to add custom location:', error);
      return false;
    }
  }

  /**
   * ELITE: Remove custom location
   */
  async removeCustomLocation(locationId: string): Promise<boolean> {
    try {
      // ELITE: Only allow removal of custom locations (not official ones)
      if (!locationId.startsWith('custom-')) {
        logger.warn('Cannot remove official location:', locationId);
        return false;
      }

      const index = this.locations.findIndex(loc => loc.id === locationId);
      if (index === -1) {
        logger.warn('Location not found:', locationId);
        return false;
      }

      this.locations.splice(index, 1);
      await this.saveToCache();
      
      logger.info('Custom location removed:', locationId);
      return true;
    } catch (error) {
      logger.error('Failed to remove custom location:', error);
      return false;
    }
  }

  /**
   * ELITE: Update custom location
   */
  async updateCustomLocation(locationId: string, updates: Partial<MapLocation>): Promise<boolean> {
    try {
      // ELITE: Only allow update of custom locations
      if (!locationId.startsWith('custom-')) {
        logger.warn('Cannot update official location:', locationId);
        return false;
      }

      const index = this.locations.findIndex(loc => loc.id === locationId);
      if (index === -1) {
        logger.warn('Location not found:', locationId);
        return false;
      }

      // ELITE: Validate updates
      if (updates.latitude !== undefined) {
        if (typeof updates.latitude !== 'number' || isNaN(updates.latitude) || 
            updates.latitude < -90 || updates.latitude > 90) {
          logger.warn('Invalid latitude update:', updates.latitude);
          return false;
        }
      }

      if (updates.longitude !== undefined) {
        if (typeof updates.longitude !== 'number' || isNaN(updates.longitude) || 
            updates.longitude < -180 || updates.longitude > 180) {
          logger.warn('Invalid longitude update:', updates.longitude);
          return false;
        }
      }

      // ELITE: Update location
      this.locations[index] = {
        ...this.locations[index],
        ...updates,
        id: locationId, // Prevent ID change
      };

      await this.saveToCache();
      
      logger.info('Custom location updated:', locationId);
      return true;
    } catch (error) {
      logger.error('Failed to update custom location:', error);
      return false;
    }
  }

  /**
   * ELITE: Get custom locations (user-added)
   */
  getCustomLocations(): MapLocation[] {
    return this.locations.filter(loc => loc.id.startsWith('custom-'));
  }

  /**
   * ELITE: Get location by ID
   */
  getLocationById(locationId: string): MapLocation | null {
    return this.locations.find(loc => loc.id === locationId) || null;
  }
}

export const offlineMapService = new OfflineMapService();
