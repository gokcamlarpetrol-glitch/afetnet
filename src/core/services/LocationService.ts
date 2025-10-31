/**
 * LOCATION SERVICE - GPS and Background Location
 */

import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

class LocationService {
  private isInitialized = false;
  private hasPermission = false;
  private currentLocation: LocationCoords | null = null;

  async initialize() {
    if (this.isInitialized) return;

    console.log('[LocationService] Initializing...');

    try {
      // Request foreground permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.warn('[LocationService] Foreground permission not granted');
        return;
      }

      this.hasPermission = true;

      // Request background permission (optional)
      if (Platform.OS === 'ios') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.warn('[LocationService] Background permission not granted');
        }
      }

      // Get initial location
      await this.updateLocation();

      this.isInitialized = true;
      console.log('[LocationService] Initialized successfully');

    } catch (error) {
      console.error('[LocationService] Initialization error:', error);
    }
  }

  async updateLocation(): Promise<LocationCoords | null> {
    if (!this.hasPermission) {
      console.warn('[LocationService] No permission');
      return null;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      this.currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };

      console.log('[LocationService] Location updated:', this.currentLocation);
      return this.currentLocation;

    } catch (error) {
      console.error('[LocationService] Update location error:', error);
      return null;
    }
  }

  getCurrentLocation(): LocationCoords | null {
    return this.currentLocation;
  }

  async startWatchingLocation(callback: (location: LocationCoords) => void) {
    if (!this.hasPermission) {
      console.warn('[LocationService] No permission');
      return null;
    }

    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // 10 seconds
          distanceInterval: 50, // 50 meters
        },
        (location) => {
          const coords: LocationCoords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
          };

          this.currentLocation = coords;
          callback(coords);
        }
      );

      return subscription;
    } catch (error) {
      console.error('[LocationService] Watch location error:', error);
      return null;
    }
  }
}

export const locationService = new LocationService();

