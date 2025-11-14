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

  async initialize() {
    if (this.isInitialized) return;

    if (__DEV__) logger.info('[LocationService] Initializing...');

    try {
      // Request foreground permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        if (__DEV__) logger.warn('Foreground permission not granted');
        return;
      }

      this.hasPermission = true;

      // Request background permission (optional)
      if (Platform.OS === 'ios') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          if (__DEV__) logger.warn('Background permission not granted');
        }
      }

      // Get initial location
      await this.updateLocation();

      this.isInitialized = true;
      if (__DEV__) logger.info('Initialized successfully');

    } catch (error) {
      logger.error('Initialization error:', error);
    }
  }

  get permissionGranted(): boolean {
    return this.hasPermission;
  }

  async recheckPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.hasPermission = status === 'granted';
      return this.hasPermission;
    } catch (error) {
      logger.error('Permission recheck error:', error);
      return false;
    }
  }

  async updateLocation(): Promise<LocationCoords | null> {
    if (!this.hasPermission) {
      if (__DEV__) logger.warn('No permission');
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

      // CRITICAL: Save location update to Firebase in real-time
      // ELITE: This ensures location is synced to Firebase for emergency services
      try {
        const { firebaseDataService } = await import('./FirebaseDataService');
        const { getDeviceId } = await import('../../lib/device');
        
        if (firebaseDataService?.isInitialized) {
          const deviceId = await getDeviceId();
          if (deviceId) {
            // ELITE: Save location update to Firebase (fire and forget - don't block return)
            firebaseDataService.saveLocationUpdate(deviceId, {
              latitude: this.currentLocation.latitude,
              longitude: this.currentLocation.longitude,
              accuracy: this.currentLocation.accuracy,
              timestamp: this.currentLocation.timestamp,
            }).catch((error) => {
              // ELITE: Location save failures are non-critical - app continues
              if (__DEV__) {
                logger.debug('Location update save to Firebase failed (non-critical):', error);
              }
            });

            // CRITICAL: Send location update to backend for rescue coordination
            // ELITE: This ensures rescue teams can track user location during disasters
            try {
              const { backendEmergencyService } = await import('./BackendEmergencyService');
              if (backendEmergencyService.initialized) {
                await backendEmergencyService.sendEmergencyMessage({
                  messageId: `loc_${this.currentLocation.timestamp}`,
                  content: 'Location update',
                  timestamp: this.currentLocation.timestamp,
                  type: 'location',
                  priority: 'normal',
                  location: {
                    latitude: this.currentLocation.latitude,
                    longitude: this.currentLocation.longitude,
                    accuracy: this.currentLocation.accuracy || undefined,
                  },
                }).catch((error) => {
                  // ELITE: Backend save failures are non-critical - app continues
                  if (__DEV__) {
                    logger.debug('Location update save to backend failed (non-critical):', error);
                  }
                });
              }
            } catch (backendError) {
              // ELITE: Backend save is optional - app continues without it
              if (__DEV__) {
                logger.debug('Backend location save skipped:', backendError);
              }
            }
          }
        }
      } catch (firebaseError) {
        // ELITE: Firebase save is optional - app continues without it
        if (__DEV__) {
          logger.debug('Firebase location save skipped:', firebaseError);
        }
      }

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

  async getCurrentPosition(): Promise<LocationCoords | null> {
    return await this.updateLocation();
  }

  async startWatchingLocation(callback: (location: LocationCoords) => void) {
    if (!this.hasPermission) {
      if (__DEV__) logger.warn('No permission');
      return null;
    }

    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // 10 seconds
          distanceInterval: 50, // 50 meters
        },
        async (location) => {
          try {
            // ELITE: Validate location data before processing
            if (!location || !location.coords) {
              logger.warn('Invalid location data received');
              return;
            }

            const coords: LocationCoords = {
              latitude: location.coords.latitude ?? 0,
              longitude: location.coords.longitude ?? 0,
              accuracy: location.coords.accuracy ?? null,
              timestamp: location.timestamp ?? Date.now(),
            };

            // ELITE: Validate coordinates are valid numbers
            if (isNaN(coords.latitude) || isNaN(coords.longitude)) {
              logger.warn('Invalid coordinates received');
              return;
            }

            this.currentLocation = coords;
            callback(coords);
            
            // CRITICAL: Save location update to Firebase in real-time
            // ELITE: This ensures location is synced to Firebase for emergency services
            try {
              const { firebaseDataService } = await import('./FirebaseDataService');
              const { getDeviceId } = await import('../../lib/device');
              
              if (firebaseDataService?.isInitialized) {
                const deviceId = await getDeviceId();
                if (deviceId) {
                  // ELITE: Save location update to Firebase (fire and forget - don't block callback)
                  firebaseDataService.saveLocationUpdate(deviceId, {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    accuracy: coords.accuracy,
                    timestamp: coords.timestamp,
                  }).catch((error) => {
                    // ELITE: Location save failures are non-critical - app continues
                    if (__DEV__) {
                      logger.debug('Location update save to Firebase failed (non-critical):', error);
                    }
                  });

                  // CRITICAL: Send location update to backend for rescue coordination
                  // ELITE: This ensures rescue teams can track user location during disasters
                  try {
                    const { backendEmergencyService } = await import('./BackendEmergencyService');
                    if (backendEmergencyService.initialized) {
                      await backendEmergencyService.sendEmergencyMessage({
                        messageId: `loc_${coords.timestamp}`,
                        content: 'Location update',
                        timestamp: coords.timestamp,
                        type: 'location',
                        priority: 'normal',
                        location: {
                          latitude: coords.latitude,
                          longitude: coords.longitude,
                          accuracy: coords.accuracy || undefined,
                        },
                      }).catch((error) => {
                        // ELITE: Backend save failures are non-critical - app continues
                        if (__DEV__) {
                          logger.debug('Location update save to backend failed (non-critical):', error);
                        }
                      });
                    }
                  } catch (backendError) {
                    // ELITE: Backend save is optional - app continues without it
                    if (__DEV__) {
                      logger.debug('Backend location save skipped:', backendError);
                    }
                  }
                }
              }
            } catch (firebaseError) {
              // ELITE: Firebase save is optional - app continues without it
              if (__DEV__) {
                logger.debug('Firebase location save skipped:', firebaseError);
              }
            }
          } catch (error) {
            logger.error('Error processing location update:', error);
          }
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

