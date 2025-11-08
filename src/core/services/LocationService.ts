/**
 * LOCATION SERVICE - GPS and Background Location
 */

import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';

const logger = createLogger('LocationService');

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
  
  // ELITE: Public getter for permission status (for PermissionGuard integration)
  get permissionGranted(): boolean {
    return this.hasPermission;
  }

  /**
   * ELITE: Recheck permission status (useful after PermissionGuard grants permission)
   */
  async recheckPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      this.hasPermission = status === 'granted';
      if (__DEV__ && this.hasPermission) {
        logger.info('Location permission rechecked - granted');
      }
      return this.hasPermission;
    } catch (error) {
      logger.error('Permission recheck failed:', error);
      return false;
    }
  }

  async initialize() {
    if (this.isInitialized) return;

    if (__DEV__) logger.info('[LocationService] Initializing...');

    try {
      // Check existing permission first (may have been granted by PermissionGuard)
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingStatus === 'granted') {
        this.hasPermission = true;
        if (__DEV__) logger.info('Location permission already granted');
      } else {
        // Request foreground permission (only if not already granted)
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        
        if (foregroundStatus !== 'granted') {
          if (__DEV__) logger.warn('Foreground permission not granted - will retry later');
          // Don't return - continue initialization, permission may be granted later
          return;
        }

        this.hasPermission = true;
      }

      // Request background permission (optional)
      if (Platform.OS === 'ios') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          if (__DEV__) logger.warn('Background permission not granted');
        }
      }

      // Get initial location (non-blocking - don't wait for GPS if it takes too long)
      // Elite: Use Promise.race to prevent blocking initialization if GPS is slow
      // CRITICAL: Only try to update location if we have permission
      if (this.hasPermission) {
        Promise.race([
          this.updateLocation(),
          new Promise((resolve) => setTimeout(resolve, 10000)), // 10 second timeout for GPS
        ]).catch((error) => {
          logger.warn('Initial location update timeout or failed, continuing initialization:', error);
        });
      } else {
        if (__DEV__) logger.info('Skipping initial location update - permission not granted yet');
      }

      this.isInitialized = true;
      if (__DEV__) logger.info('Initialized successfully');

    } catch (error) {
      logger.error('Initialization error:', error);
    }
  }

  async updateLocation(): Promise<LocationCoords | null> {
    // CRITICAL: Recheck permission if not granted (PermissionGuard may have granted it)
    if (!this.hasPermission) {
      const hasPermission = await this.recheckPermission();
      if (!hasPermission) {
        // Silent return - permission may be granted later
        return null;
      }
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

      // Save to Firebase (for critical location updates) - non-blocking
      // Elite: Don't block location update if Firebase save fails or is slow
      Promise.resolve().then(async () => {
        try {
          const { getDeviceId } = await import('../../lib/device');
          const deviceId = await getDeviceId();
          if (deviceId) {
            const { firebaseDataService } = await import('./FirebaseDataService');
            if (firebaseDataService.isInitialized) {
              await firebaseDataService.saveLocationUpdate(deviceId, {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy,
                timestamp: location.timestamp,
              });
            }
          }
        } catch (error) {
          logger.error('Failed to save location to Firebase:', error);
        }
      }).catch((error) => {
        logger.warn('Firebase location save error (non-critical):', error);
      });

      if (__DEV__) logger.info('Location updated:', this.currentLocation);
      return this.currentLocation;

    } catch (error) {
      logger.error('Update location error:', error);
      return null;
    }
  }

  getCurrentLocation(): LocationCoords | null {
    return this.currentLocation;
  }

  async startWatchingLocation(callback: (location: LocationCoords) => void) {
    // CRITICAL: Recheck permission if not granted (PermissionGuard may have granted it)
    if (!this.hasPermission) {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Silent return - permission may be granted later
        return null;
      }
      this.hasPermission = true;
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
      logger.error('Watch location error:', error);
      return null;
    }
  }
}

export const locationService = new LocationService();

