import * as Notifications from 'expo-notifications';
import { WORKER_URL, ORG_SECRET } from '../config/worker';

export async function getFcmToken(): Promise<string | undefined> {
  try {
    const { data, type } = await Notifications.getDevicePushTokenAsync();
    
    if (type === 'fcm' && data) {
      return data as string;
    }
    
    console.log('FCM token not available, type:', type);
    return undefined;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return undefined;
  }
}

export async function registerTokenWithWorker(token: string, provinces: string[]): Promise<boolean> {
  try {
    if (!WORKER_URL || WORKER_URL === 'https://YOUR-WORKER-URL') {
      console.warn('Worker URL not configured');
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
      console.error('Registration failed:', response.status, errorText);
      return false;
    }

    console.log(`Registered token ${token.substring(0, 6)}... for ${provinces.length} provinces`);
    return true;

  } catch (error) {
    console.error('Registration error:', error);
    return false;
  }
}

export async function unregisterToken(token: string): Promise<boolean> {
  try {
    if (!WORKER_URL || WORKER_URL === 'https://YOUR-WORKER-URL') {
      console.warn('Worker URL not configured');
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
      console.error('Unregistration failed:', response.status, errorText);
      return false;
    }

    console.log(`Unregistered token ${token.substring(0, 6)}...`);
    return true;

  } catch (error) {
    console.error('Unregistration error:', error);
    return false;
  }
}

export async function testWorkerHealth(): Promise<boolean> {
  try {
    if (!WORKER_URL || WORKER_URL === 'https://YOUR-WORKER-URL') {
      console.warn('Worker URL not configured');
      return false;
    }

    const response = await fetch(`${WORKER_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('Health check failed:', response.status);
      return false;
    }

    const data = await response.json();
    return data.ok === true;

  } catch (error) {
    console.error('Health check error:', error);
    return false;
  }
}

export async function triggerWorkerTick(): Promise<boolean> {
  try {
    if (!WORKER_URL || WORKER_URL === 'https://YOUR-WORKER-URL') {
      console.warn('Worker URL not configured');
      return false;
    }

    const response = await fetch(`${WORKER_URL}/tick`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('Tick failed:', response.status);
      return false;
    }

    const data = await response.json();
    console.log('Worker tick result:', data);
    return true;

  } catch (error) {
    console.error('Tick error:', error);
    return false;
  }
}
