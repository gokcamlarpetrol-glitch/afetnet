import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ORG_SECRET, WORKER_URL } from '../config/worker';
import { logger } from '../utils/productionLogger';

/**
 * Returns the native push token for the device.
 * - On Android with FCM: type === 'fcm' and data is the FCM token.
 * - On iOS: type is usually 'ios' (APNs device token). When Firebase is
 *   configured with APNs key, FCM will deliver via APNs using this token.
 */
export async function getFcmToken(): Promise<string | undefined> {
  try {
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
    const { data, type } = await Notifications.getDevicePushTokenAsync();
    return { token: typeof data === 'string' ? data : undefined, type: String(type) };
  } catch (error) {
    logger.error('Failed to get push token (detailed):', error);
    return {};
  }
}

export async function registerTokenWithWorker(token: string, provinces: string[]): Promise<boolean> {
  try {
    if (!WORKER_URL || !ORG_SECRET || !WORKER_URL.includes('render.com') || ORG_SECRET.length <= 20) {
      logger.warn('Worker URL or secret not configured');
      return false;
    }

    const response = await (globalThis as any).fetch(`${WORKER_URL}/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-secret': ORG_SECRET,
      },
      body: JSON.stringify({
        token,
        // iOS currently provides APNs token via expo-notifications
        // Backend will determine routing by type
        type: Platform.OS === 'ios' ? 'ios' : 'fcm',
        provinces,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Registration failed:', { status: response.status, error: errorText });
      return false;
    }

    logger.debug(`Registered token ${token.substring(0, 6)}... for ${provinces.length} provinces`);
    return true;

  } catch (error) {
    logger.error('Registration error:', error);
    return false;
  }
}

export async function unregisterToken(token: string): Promise<boolean> {
  try {
    if (!WORKER_URL || !ORG_SECRET || !WORKER_URL.includes('render.com') || ORG_SECRET.length <= 20) {
      logger.warn('Worker URL or secret not configured');
      return false;
    }

    const response = await (globalThis as any).fetch(`${WORKER_URL}/push/unregister`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-secret': ORG_SECRET,
      },
      body: JSON.stringify({
        token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Unregistration failed:', { status: response.status, error: errorText });
      return false;
    }

    logger.debug(`Unregistered token ${token.substring(0, 6)}...`);
    return true;

  } catch (error) {
    logger.error('Unregistration error:', error);
    return false;
  }
}

export async function testWorkerHealth(): Promise<boolean> {
  try {
    if (!WORKER_URL || !ORG_SECRET || !WORKER_URL.includes('render.com') || ORG_SECRET.length <= 20) {
      logger.warn('Worker URL or secret not configured');
      return false;
    }

    const response = await (globalThis as any).fetch(`${WORKER_URL}/push/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logger.error('Health check failed:', response.status);
      return false;
    }

    const data = await response.json();
    return data.ok === true;

  } catch (error) {
    logger.error('Health check error:', error);
    return false;
  }
}

export async function triggerWorkerTick(): Promise<boolean> {
  try {
    if (!WORKER_URL || !ORG_SECRET || !WORKER_URL.includes('render.com') || ORG_SECRET.length <= 20) {
      logger.warn('Worker URL or secret not configured');
      return false;
    }

    const response = await (globalThis as any).fetch(`${WORKER_URL}/push/tick`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logger.error('Tick failed:', response.status);
      return false;
    }

    const data = await response.json();
    logger.debug('Worker tick result:', data);
    return true;

  } catch (error) {
    logger.error('Tick error:', error);
    return false;
  }
}
