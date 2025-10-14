import * as Notifications from 'expo-notifications';
import { ORG_SECRET, WORKER_URL } from '../config/worker';
import { logger } from '../utils/productionLogger';

export async function getFcmToken(): Promise<string | undefined> {
  try {
    const { data, type } = await Notifications.getDevicePushTokenAsync();
    
    if (type === 'fcm' && data) {
      return data as string;
    }
    
    logger.debug('FCM token not available, type:', type);
    return undefined;
  } catch (error) {
    logger.error('Failed to get FCM token:', error);
    return undefined;
  }
}

export async function registerTokenWithWorker(token: string, provinces: string[]): Promise<boolean> {
  try {
    if (!WORKER_URL || WORKER_URL === 'https://YOUR-WORKER-URL') {
      logger.warn('Worker URL not configured');
      return false;
    }

    const response = await fetch(`${WORKER_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-secret': ORG_SECRET,
      },
      body: JSON.stringify({
        token,
        provinces
      })
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
    if (!WORKER_URL || WORKER_URL === 'https://YOUR-WORKER-URL') {
      logger.warn('Worker URL not configured');
      return false;
    }

    const response = await fetch(`${WORKER_URL}/unregister`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-secret': ORG_SECRET,
      },
      body: JSON.stringify({
        token
      })
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
    if (!WORKER_URL || WORKER_URL === 'https://YOUR-WORKER-URL') {
      logger.warn('Worker URL not configured');
      return false;
    }

    const response = await fetch(`${WORKER_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
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
    if (!WORKER_URL || WORKER_URL === 'https://YOUR-WORKER-URL') {
      logger.warn('Worker URL not configured');
      return false;
    }

    const response = await fetch(`${WORKER_URL}/tick`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
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
