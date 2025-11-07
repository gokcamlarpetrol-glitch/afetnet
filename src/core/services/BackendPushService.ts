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
  private registrationAttempts = 0;
  private readonly MAX_ATTEMPTS = 3;
  private baseUrl: string | null = null;
  // Elite Security: Rate limiting storage
  private rateLimitStore: Map<string, number> = new Map();

  /**
   * Initialize and register push token with backend
   */
  async initialize(pushToken: string | null) {
    if (!pushToken) {
      logger.warn('No push token available, skipping backend registration');
      return;
    }

    if (this.isRegistered) {
      logger.info('Already registered with backend');
      return;
    }

    try {
      // Get backend URL from environment or use default
      // Elite: Try multiple sources for backend URL
      const Constants = require('expo-constants');
      this.baseUrl = 
        process.env.BACKEND_URL || 
        Constants?.expoConfig?.extra?.backendUrl ||
        'https://afetnet-backend.onrender.com';
      
      if (__DEV__) {
        logger.info(`Backend URL: ${this.baseUrl}`);
      }
      
      await this.registerPushToken(pushToken);
    } catch (error) {
      logger.error('Failed to initialize backend push service:', error);
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

      const result = await response.json();
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
        // Silent retry - don't log every attempt (reduces spam)
        // Only log in dev mode and only first attempt
        if (__DEV__ && this.registrationAttempts === 1) {
          logger.debug(`Backend registration attempt ${this.registrationAttempts} failed (will retry silently)`);
        }
        
        // Retry with exponential backoff
        const delay = Math.pow(2, this.registrationAttempts) * 1000; // 2s, 4s, 8s
        setTimeout(() => {
          this.registerPushToken(pushToken);
        }, delay);
      } else {
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
   */
  private startLocationUpdates(deviceId: string, pushToken: string, deviceType: string) {
    // Update location every 5 minutes
    setInterval(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        await fetch(`${this.baseUrl}/push/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: deviceId,
            pushToken,
            deviceType,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }),
        });
      } catch (error) {
        logger.warn('Failed to update location with backend:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
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
      const deviceId = await getDeviceId();
      if (!deviceId || !this.baseUrl) return;

      await fetch(`${this.baseUrl}/push/unregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: deviceId,
        }),
      });

      this.isRegistered = false;
      logger.info('Unregistered from backend');
    } catch (error) {
      logger.error('Failed to unregister:', error);
    }
  }
}

export const backendPushService = new BackendPushService();

