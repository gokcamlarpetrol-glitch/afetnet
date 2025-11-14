// ELITE: Zero static dependencies - lazy load expo-notifications
// CRITICAL: Never import at module level to prevent bundling-time loading
import { Platform } from 'react-native';
import { ORG_SECRET, WORKER_URL } from '../config/worker';
import { logger } from '../utils/productionLogger';

let NotificationsModule: any = null;
let isNotificationsLoading = false;

async function getNotificationsAsync(): Promise<any> {
  if (NotificationsModule) return NotificationsModule;
  if (isNotificationsLoading) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return NotificationsModule;
  }
  
  isNotificationsLoading = true;
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // ELITE: Use eval to prevent static analysis
    const moduleName = 'expo-' + 'notifications';
    NotificationsModule = eval(`require('${moduleName}')`);
    return NotificationsModule;
  } catch (error) {
    return null;
  } finally {
    isNotificationsLoading = false;
  }
}

/**
 * Returns the native push token for the device.
 * - On Android with FCM: type === 'fcm' and data is the FCM token.
 * - On iOS: type is usually 'ios' (APNs device token). When Firebase is
 *   configured with APNs key, FCM will deliver via APNs using this token.
 */
export async function getFcmToken(): Promise<string | undefined> {
  try {
    const Notifications = await getNotificationsAsync();
    if (!Notifications) return undefined;
    const { data, type } = await Notifications.getDevicePushTokenAsync();
    if (typeof data === 'string' && data.length > 0) {
      logger.debug(`Push token received (type=${String(type)}): …${data.slice(-6)}`);
      return data as string;
    }
    logger.debug('Push token not available');
    return undefined;
  } catch (error) {
    logger.error('Failed to get push token:', error);
    return undefined;
  }
}

export type PushTokenInfo = { token?: string; type?: string };

export async function getPushTokenDetailed(): Promise<PushTokenInfo> {
  try {
    const Notifications = await getNotificationsAsync();
    if (!Notifications) return {};
    const { data, type } = await Notifications.getDevicePushTokenAsync();
    return { token: typeof data === 'string' ? data : undefined, type: String(type) };
  } catch (error) {
    logger.error('Failed to get push token (detailed):', error);
    return {};
  }
}

export async function registerTokenWithWorker(token: string, provinces: string[]): Promise<boolean> {
  try {
    // ELITE: Validate inputs
    if (!token || typeof token !== 'string' || token.length < 10 || token.length > 500) {
      logger.warn('Invalid token provided for registration');
      return false;
    }
    
    if (!Array.isArray(provinces) || provinces.length === 0) {
      logger.warn('Invalid provinces array provided');
      return false;
    }
    
    if (!WORKER_URL || !ORG_SECRET || !WORKER_URL.includes('render.com') || ORG_SECRET.length <= 20) {
      if (__DEV__) {
        logger.debug('Worker URL or secret not configured');
      }
      return false;
    }

    // ELITE: Make request with timeout protection
    const fetchPromise = (globalThis as any).fetch(`${WORKER_URL}/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-secret': ORG_SECRET,
      },
      body: JSON.stringify({
        token: token.substring(0, 500), // Max length
        // iOS currently provides APNs token via expo-notifications
        // Backend will determine routing by type
        type: Platform.OS === 'ios' ? 'ios' : 'fcm',
        provinces: provinces.slice(0, 100), // Max 100 provinces
      }),
    });
    
    const fetchTimeoutPromise = new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 15000) // 15 second timeout
    );
    
    const response = await Promise.race([fetchPromise, fetchTimeoutPromise]);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (__DEV__) {
        logger.debug('Registration failed:', { status: response.status, error: errorText });
      }
      return false;
    }

    if (__DEV__) {
      logger.debug(`Registered token ${token.substring(0, 6)}... for ${provinces.length} provinces`);
    }
    return true;

  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    
    // ELITE: Don't log timeout errors as errors (expected behavior)
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      if (__DEV__) {
        logger.debug('Registration request timed out (expected in poor network conditions)');
      }
    } else {
      logger.error('Registration error:', errorMessage);
    }
    return false;
  }
}

export async function unregisterToken(token: string): Promise<boolean> {
  try {
    // ELITE: Validate input
    if (!token || typeof token !== 'string' || token.length < 10 || token.length > 500) {
      if (__DEV__) {
        logger.debug('Invalid token provided for unregistration');
      }
      return false;
    }
    
    if (!WORKER_URL || !ORG_SECRET || !WORKER_URL.includes('render.com') || ORG_SECRET.length <= 20) {
      if (__DEV__) {
        logger.debug('Worker URL or secret not configured');
      }
      return false;
    }

    // ELITE: Make request with timeout protection
    const fetchPromise = (globalThis as any).fetch(`${WORKER_URL}/push/unregister`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-secret': ORG_SECRET,
      },
      body: JSON.stringify({
        token: token.substring(0, 500), // Max length
      }),
    });
    
    const fetchTimeoutPromise = new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 10000) // 10 second timeout
    );
    
    const response = await Promise.race([fetchPromise, fetchTimeoutPromise]);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (__DEV__) {
        logger.debug('Unregistration failed:', { status: response.status, error: errorText });
      }
      return false;
    }

    if (__DEV__) {
      logger.debug(`Unregistered token ${token.substring(0, 6)}...`);
    }
    return true;

  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    
    // ELITE: Don't log timeout errors as errors (expected behavior)
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      if (__DEV__) {
        logger.debug('Unregistration request timed out (non-critical)');
      }
    } else {
      logger.error('Unregistration error:', errorMessage);
    }
    return false;
  }
}

export async function testWorkerHealth(): Promise<boolean> {
  try {
    if (!WORKER_URL || !ORG_SECRET || !WORKER_URL.includes('render.com') || ORG_SECRET.length <= 20) {
      if (__DEV__) {
        logger.debug('Worker URL or secret not configured');
      }
      return false;
    }

    // ELITE: Make request with timeout protection
    const fetchPromise = (globalThis as any).fetch(`${WORKER_URL}/push/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const fetchTimeoutPromise = new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 10000) // 10 second timeout
    );
    
    const response = await Promise.race([fetchPromise, fetchTimeoutPromise]);

    if (!response.ok) {
      if (__DEV__) {
        logger.debug('Health check failed:', response.status);
      }
      return false;
    }

    // ELITE: Safe JSON parsing with error handling
    const data = await response.json().catch(() => ({ ok: false }));
    return data.ok === true;

  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    
    // ELITE: Don't log timeout errors as errors (expected behavior)
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      if (__DEV__) {
        logger.debug('Health check request timed out (expected in poor network conditions)');
      }
    } else {
      logger.error('Health check error:', errorMessage);
    }
    return false;
  }
}

export async function triggerWorkerTick(): Promise<boolean> {
  try {
    if (!WORKER_URL || !ORG_SECRET || !WORKER_URL.includes('render.com') || ORG_SECRET.length <= 20) {
      if (__DEV__) {
        logger.debug('Worker URL or secret not configured');
      }
      return false;
    }

    // ELITE: Make request with timeout protection
    const fetchPromise = (globalThis as any).fetch(`${WORKER_URL}/push/tick`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const fetchTimeoutPromise = new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 10000) // 10 second timeout
    );
    
    const response = await Promise.race([fetchPromise, fetchTimeoutPromise]);

    if (!response.ok) {
      if (__DEV__) {
        logger.debug('Tick failed:', response.status);
      }
      return false;
    }

    // ELITE: Safe JSON parsing with error handling
    const data = await response.json().catch(() => ({}));
    if (__DEV__) {
      logger.debug('Worker tick result:', data);
    }
    return true;

  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    
    // ELITE: Don't log timeout errors as errors (expected behavior)
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      if (__DEV__) {
        logger.debug('Tick request timed out (expected in poor network conditions)');
      }
    } else {
      logger.error('Tick error:', errorMessage);
    }
    return false;
  }
}
