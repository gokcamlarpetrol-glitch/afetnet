/**
 * LOCATION SERVICE - GPS and Background Location
 */

import * as Location from 'expo-location';
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
      // Do not trigger permission prompt during startup.
      // Feature screens request permission when user takes action.
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        if (__DEV__) logger.warn('Foreground permission not granted (startup check)');
        return;
      }

      this.hasPermission = true;

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
      const { status } = await Location.getForegroundPermissionsAsync();
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

      // -----------------------------------------------------------------------
      // ELITE HYBRID: Broadcast Location to Mesh Network (Offline Support)
      // -----------------------------------------------------------------------
      try {
        const { connectionManager } = await import('./ConnectionManager');
        const { meshNetworkService } = await import('./mesh/MeshNetworkService');

        // Strategy: Always broadcast to Mesh for nearby peers (even if online)
        // This ensures local situational awareness without round-trip to server
        const locationPayload = JSON.stringify({
          type: 'LOC',
          lat: this.currentLocation.latitude,
          lng: this.currentLocation.longitude,
          acc: Math.floor(this.currentLocation.accuracy || 0),
          t: this.currentLocation.timestamp,
        });

        // Use broadcastMessage with the new LOCATION type
        const { MeshMessageType } = await import('./mesh/MeshProtocol');
        meshNetworkService.broadcastMessage(locationPayload, MeshMessageType.LOCATION);
      } catch (meshError) {
        if (__DEV__) logger.warn('Mesh location broadcast failed:', meshError);
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

  /**
   * ELITE: Adaptive Location Tracking
   * Dynamically adjusts update frequency based on movement and status.
   */
  async startWatchingLocation(callback: (location: LocationCoords) => void) {
    if (!this.hasPermission) {
      if (__DEV__) logger.warn('No permission');
      return null;
    }

    try {
      // Adaptive Configuration
      let timeInterval = 10000; // Default: 10s
      let distanceInterval = 50; // Default: 50m

      // Check User Status (Emergency = Faster updates)
      const { useUserStatusStore } = await import('../stores/userStatusStore');
      const status = useUserStatusStore.getState().status;

      // ELITE: MATCHING STATUS VALUES FROM STORE (sos = critical, needs_help = need-help)
      if (status === 'sos' || status === 'needs_help') {
        timeInterval = 2000; // Emergency: 2s (High precision)
        distanceInterval = 5; // Emergency: 5m
      } else {
        // Check Battery (Low power = Slower updates)
        const Battery = await import('expo-battery');
        const batteryLevel = await Battery.getBatteryLevelAsync();
        if (batteryLevel < 0.2) {
          timeInterval = 30000; // Low Battery: 30s
          distanceInterval = 100; // Low Battery: 100m
        }
      }

      logger.info(`Starting Adaptive Tracking. Interval: ${timeInterval}ms, Dist: ${distanceInterval}m`);

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval,
          distanceInterval,
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

            // -----------------------------------------------------------------------
            // ELITE HYBRID: Broadcast Location to Mesh Network (Offline Support)
            // -----------------------------------------------------------------------
            try {
              const { connectionManager } = await import('./ConnectionManager');
              const { meshNetworkService } = await import('./mesh/MeshNetworkService');

              // Strategy: Always broadcast to Mesh for nearby peers (even if online)
              // This ensures local situational awareness without round-trip to server
              const locationPayload = JSON.stringify({
                type: 'LOC',
                lat: this.currentLocation.latitude,
                lng: this.currentLocation.longitude,
                acc: Math.floor(this.currentLocation.accuracy || 0),
                t: this.currentLocation.timestamp,
              });

              // Use broadcastMessage with the new LOCATION type
              const { MeshMessageType } = await import('./mesh/MeshProtocol');
              meshNetworkService.broadcastMessage(locationPayload, MeshMessageType.LOCATION);
            } catch (meshError) {
              if (__DEV__) logger.warn('Mesh location broadcast failed:', meshError);
            }

          } catch (error) {
            logger.error('Error processing location update:', error);
          }
        },
      );

      return subscription;
    } catch (error) {
      logger.error('Watch location error:', error);
      return null;
    }
  }
}

export const locationService = new LocationService();
