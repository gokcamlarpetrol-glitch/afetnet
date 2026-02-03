/**
 * BACKEND PUSH SERVICE
 * Registers push token with backend for REAL EARLY WARNING notifications
 * Backend sends warnings BEFORE earthquake happens (life-saving)
 */

import { createLogger } from '../utils/logger';
import { getDeviceId } from '../../lib/device';
import * as Location from 'expo-location';

const logger = createLogger('BackendPushService');

class BackendPushService {
  private isRegistered = false;
  private _isInitialized = false;
  private registrationAttempts = 0;
  private readonly MAX_ATTEMPTS = 3;
  private baseUrl: string | null = null;
  // Elite Security: Rate limiting storage
  private rateLimitStore: Map<string, number> = new Map();
  // ELITE: Location update interval tracking (for cleanup)
  private locationUpdateInterval: NodeJS.Timeout | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Initialize and register push token with backend
   */
  async initialize(pushToken: string | null) {
    if (!pushToken) {
      if (__DEV__) {
        logger.debug('No push token available, skipping backend registration');
      }
      return;
    }

    if (this.isRegistered) {
      if (__DEV__) {
        logger.debug('Already registered with backend');
      }
      return;
    }

    try {
      // ELITE: Get backend URL from ENV config (centralized)
      const { ENV } = await import('../config/env');
      this.baseUrl = ENV.API_BASE_URL || 'https://afetnet-backend.onrender.com';

      if (__DEV__) {
        logger.info(`Backend URL: ${this.baseUrl}`);
      }

      await this.registerPushToken(pushToken);
      this._isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize backend push service:', error);
      // ELITE: Don't throw - backend registration is optional
      this._isInitialized = false;
    }
  }

  /**
   * Register push token with backend
   */
  private async registerPushToken(pushToken: string) {
    if (this.registrationAttempts >= this.MAX_ATTEMPTS) {
      logger.warn('Max registration attempts reached, giving up');
      return;
    }

    this.registrationAttempts++;

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        logger.warn('No device ID available');
        return;
      }

      // Get current location
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        }
      } catch (error) {
        logger.warn('Failed to get location for registration:', error);
      }

      // Elite Security: Input validation
      if (!deviceId || deviceId.length < 10 || deviceId.length > 50) {
        throw new Error('Invalid device ID');
      }
      if (!pushToken || pushToken.length < 10 || pushToken.length > 500) {
        throw new Error('Invalid push token');
      }

      // Elite: Validate coordinates if provided
      if (latitude !== null && (latitude < -90 || latitude > 90)) {
        throw new Error('Invalid latitude');
      }
      if (longitude !== null && (longitude < -180 || longitude > 180)) {
        throw new Error('Invalid longitude');
      }

      // Determine device type
      const { Platform } = require('react-native');
      const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';

      // Elite Security: Rate limiting check (prevent abuse)
      const rateLimitKey = `backend_registration_${deviceId}`;
      const lastAttempt = await this.getLastAttemptTime(rateLimitKey);
      const now = Date.now();
      const RATE_LIMIT_MS = 60000; // 1 minute between attempts

      if (lastAttempt && (now - lastAttempt) < RATE_LIMIT_MS) {
        throw new Error('Rate limit exceeded. Please wait before retrying.');
      }
      await this.setLastAttemptTime(rateLimitKey, now);

      // Elite Security: Register with backend with input sanitization
      const sanitizedPayload = {
        userId: deviceId.substring(0, 50), // Max length
        pushToken: pushToken.substring(0, 500), // Max length
        deviceType,
        latitude: latitude !== null ? Math.round(latitude * 10000) / 10000 : null, // Round to 4 decimals
        longitude: longitude !== null ? Math.round(longitude * 10000) / 10000 : null,
        timestamp: now,
      };

      const response = await fetch(`${this.baseUrl}/push/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': `${deviceId}-${now}`, // Request tracking
        },
        body: JSON.stringify(sanitizedPayload),
      });

      if (!response.ok) {
        throw new Error(`Backend registration failed: ${response.statusText}`);
      }

      // ELITE: Safe JSON parsing with error handling
      const result = await response.json().catch(() => ({ ok: false, error: 'Failed to parse response' }));
      if (result.ok) {
        this.isRegistered = true;
        logger.info('✅ Successfully registered push token with backend');

        // Schedule periodic location updates
        this.startLocationUpdates(deviceId, pushToken, deviceType);
      } else {
        throw new Error(result.error || 'Registration failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Elite: Better error handling - don't spam logs for network errors
      if (this.registrationAttempts < this.MAX_ATTEMPTS) {
        // ELITE: Clear any existing retry timeout
        if (this.retryTimeout) {
          clearTimeout(this.retryTimeout);
          this.retryTimeout = null;
        }

        // Silent retry - don't log every attempt (reduces spam)
        // Only log in dev mode and only first attempt
        if (__DEV__ && this.registrationAttempts === 1) {
          logger.debug(`Backend registration attempt ${this.registrationAttempts} failed (will retry silently)`);
        }

        // Retry with exponential backoff
        const delay = Math.pow(2, this.registrationAttempts) * 1000; // 2s, 4s, 8s
        this.retryTimeout = setTimeout(() => {
          this.retryTimeout = null;
          this.registerPushToken(pushToken);
        }, delay);
      } else {
        // ELITE: Clear retry timeout on final failure
        if (this.retryTimeout) {
          clearTimeout(this.retryTimeout);
          this.retryTimeout = null;
        }

        // Only log final failure once (not every attempt)
        if (__DEV__) {
          logger.warn(`Backend registration failed after ${this.MAX_ATTEMPTS} attempts. Backend may be unavailable. App will continue without backend push notifications.`);
        }
        // Don't throw - app should continue working without backend
      }
    }
  }

  /**
   * Periodically update location with backend
   * ELITE: Proper cleanup to prevent memory leaks
   */
  private startLocationUpdates(deviceId: string, pushToken: string, deviceType: string) {
    // ELITE: Clear any existing interval to prevent duplicates
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
      this.locationUpdateInterval = null;
    }

    // ELITE: Update location every 5 minutes with proper error handling
    this.locationUpdateInterval = setInterval(async () => {
      try {
        // ELITE: Validate baseUrl before making request
        if (!this.baseUrl) {
          logger.warn('Backend URL not configured, stopping location updates');
          this.stopLocationUpdates();
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (__DEV__) {
            logger.debug('Location permission not granted, skipping location update');
          }
          return;
        }

        // ELITE: Get location with timeout protection
        const locationPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 10000), // 10 second timeout
        );

        const location = await Promise.race([locationPromise, timeoutPromise]);

        if (!location) {
          if (__DEV__) {
            logger.debug('Location request timed out or failed');
          }
          return;
        }

        // ELITE: Validate coordinates
        const latitude = location.coords.latitude;
        const longitude = location.coords.longitude;

        if (isNaN(latitude) || isNaN(longitude) ||
          latitude < -90 || latitude > 90 ||
          longitude < -180 || longitude > 180) {
          logger.warn('Invalid location coordinates received');
          return;
        }

        // ELITE: Make request with timeout
        const fetchPromise = fetch(`${this.baseUrl}/push/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: deviceId,
            pushToken,
            deviceType,
            latitude: Math.round(latitude * 10000) / 10000, // Round to 4 decimals
            longitude: Math.round(longitude * 10000) / 10000,
            timestamp: Date.now(),
          }),
        });

        const fetchTimeoutPromise = new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 15000), // 15 second timeout
        );

        const response = await Promise.race([fetchPromise, fetchTimeoutPromise]);

        if (!response.ok) {
          if (__DEV__) {
            logger.debug(`Location update failed: ${response.status} ${response.statusText}`);
          }
        } else {
          if (__DEV__) {
            logger.debug('Location updated successfully with backend');
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // ELITE: Don't log timeout errors as warnings (expected behavior)
        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
          if (__DEV__) {
            logger.debug('Location update request timed out (expected in poor network conditions)');
          }
        } else {
          logger.warn('Failed to update location with backend:', errorMessage);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * ELITE: Stop location updates (cleanup)
   */
  private stopLocationUpdates(): void {
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
      this.locationUpdateInterval = null;
    }
  }

  /**
   * Elite Security: Rate limiting helpers
   */
  private async getLastAttemptTime(key: string): Promise<number | null> {
    return this.rateLimitStore.get(key) || null;
  }

  private async setLastAttemptTime(key: string, time: number): Promise<void> {
    this.rateLimitStore.set(key, time);
    // Cleanup old entries (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [k, v] of this.rateLimitStore.entries()) {
      if (v < oneHourAgo) {
        this.rateLimitStore.delete(k);
      }
    }
  }

  /**
   * Unregister push token (when user logs out or app uninstalls)
   */
  async unregister() {
    try {
      // ELITE: Stop location updates first
      this.stopLocationUpdates();

      // ELITE: Clear retry timeout
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }

      const deviceId = await getDeviceId();
      if (!deviceId || !this.baseUrl) {
        this.isRegistered = false;
        return;
      }

      // ELITE: Make request with timeout
      const fetchPromise = fetch(`${this.baseUrl}/push/unregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: deviceId,
        }),
      });

      const fetchTimeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000), // 10 second timeout
      );

      await Promise.race([fetchPromise, fetchTimeoutPromise]);

      this.isRegistered = false;
      logger.info('Unregistered from backend');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // ELITE: Mark as unregistered even if request fails
      this.isRegistered = false;

      if (errorMessage.includes('timeout')) {
        if (__DEV__) {
          logger.debug('Unregister request timed out (non-critical)');
        }
      } else {
        logger.error('Failed to unregister:', errorMessage);
      }
    }
  }

  /**
   * ELITE: Send seismic detection to backend for early warning aggregation
   */
  async sendSeismicDetection(detection: {
    id: string;
    deviceId: string;
    timestamp: number;
    latitude: number;
    longitude: number;
    magnitude: number;
    depth: number;
    pWaveDetected: boolean;
    sWaveDetected: boolean;
    confidence: number;
    warningTime: number;
    source: string;
  }): Promise<void> {
    if (!this._isInitialized || !this.baseUrl) {
      if (__DEV__) {
        logger.debug('Backend not initialized, skipping seismic detection send');
      }
      return;
    }

    try {
      // ELITE: Validate input
      if (!detection.id || !detection.deviceId ||
        isNaN(detection.latitude) || isNaN(detection.longitude) ||
        detection.latitude < -90 || detection.latitude > 90 ||
        detection.longitude < -180 || detection.longitude > 180) {
        logger.warn('Invalid seismic detection data');
        return;
      }

      // ELITE: Rate limiting
      const rateLimitKey = `seismic_${detection.deviceId}`;
      const lastSent = this.rateLimitStore.get(rateLimitKey) || 0;
      const now = Date.now();
      if (now - lastSent < 5000) { // Max 1 per 5 seconds
        if (__DEV__) {
          logger.debug('Seismic detection rate limited');
        }
        return;
      }
      this.rateLimitStore.set(rateLimitKey, now);

      // ELITE: Send to backend with timeout
      const fetchPromise = fetch(`${this.baseUrl}/seismic/detection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...detection,
          timestamp: detection.timestamp,
        }),
      });

      const timeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000), // 10 second timeout
      );

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        if (__DEV__) {
          logger.debug(`Seismic detection send failed: ${response.status}`);
        }
      } else {
        if (__DEV__) {
          logger.info('Seismic detection sent to backend successfully');
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('timeout')) {
        if (__DEV__) {
          logger.debug('Seismic detection send timed out');
        }
      } else {
        logger.warn('Failed to send seismic detection to backend:', errorMessage);
      }
    }
  }

  /**
   * ELITE: Cleanup on shutdown
   */
  cleanup(): void {
    this.stopLocationUpdates();

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.isRegistered = false;
    this._isInitialized = false;
    this.registrationAttempts = 0;
  }
}

export const backendPushService = new BackendPushService();

