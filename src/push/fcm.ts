/**
 * FCM PUSH - Firebase Cloud Messaging Integration
 * Token registration and management with backend
 */

import { createLogger } from '../core/utils/logger';

const logger = createLogger('FCMPush');

const BACKEND_URL = process.env.API_BASE_URL || 'https://afetnet-backend.onrender.com';

interface TokenRegistrationResponse {
    success: boolean;
    message?: string;
}

/**
 * Register FCM token with backend worker
 */
export async function registerTokenWithWorker(
  token: string,
  provinces: string[] = ['Türkiye'],
): Promise<boolean> {
  if (!token || typeof token !== 'string' || token.length < 10) {
    if (__DEV__) {
      logger.warn('Invalid FCM token provided');
    }
    return false;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        provinces,
        platform: require('react-native').Platform.OS,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      if (__DEV__) {
        logger.warn('Token registration failed:', response.status);
      }
      return false;
    }

    const data: TokenRegistrationResponse = await response.json();
    return data.success === true;
  } catch (error) {
    if (__DEV__) {
      logger.debug('Token registration error:', error);
    }
    return false;
  }
}

/**
 * Unregister FCM token from backend
 */
export async function unregisterToken(token: string): Promise<boolean> {
  if (!token) return false;

  try {
    const response = await fetch(`${BACKEND_URL}/api/push/unregister`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    return response.ok;
  } catch (error) {
    logger.error('Token unregistration error:', error);
    return false;
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  token: string,
  preferences: {
        earthquakeAlerts?: boolean;
        sosAlerts?: boolean;
        newsUpdates?: boolean;
        minMagnitude?: number;
    },
): Promise<boolean> {
  if (!token) return false;

  try {
    const response = await fetch(`${BACKEND_URL}/api/push/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        preferences,
      }),
    });

    return response.ok;
  } catch (error) {
    logger.error('Preferences update error:', error);
    return false;
  }
}

export default {
  registerTokenWithWorker,
  unregisterToken,
  updateNotificationPreferences,
};
