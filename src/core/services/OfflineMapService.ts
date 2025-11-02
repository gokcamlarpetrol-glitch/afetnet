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
      // TODO: Fetch from real API
      // For now, use Istanbul sample data
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
      
      logger.info('OfflineMapService: Data cached');
    } catch (error) {
      logger.error('OfflineMapService fetch failed:', error);
    }
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

