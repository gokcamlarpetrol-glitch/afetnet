/**
 * FIREBASE DEVICE OPERATIONS - ELITE MODULAR
 * Handles device-related Firestore operations
 */

import { doc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // ELITE: For Owner Binding
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';

const logger = createLogger('FirebaseDeviceOperations');
const TIMEOUT_MS = 10000; // 10 seconds

/**
 * Execute Firestore operation with timeout protection
 */
async function withTimeout<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operationName} timeout`)), TIMEOUT_MS),
  );

  return Promise.race([operation(), timeoutPromise]);
}

/**
 * Save device ID to Firestore
 */
export async function saveDeviceId(deviceId: string, isInitialized: boolean): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping saveDeviceId');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    // ELITE SECURITY: Owner Binding (The Vault)
    const auth = getAuth();
    const currentUser = auth.currentUser;
    const ownerUid = currentUser ? currentUser.uid : null;

    const deviceData: any = {
      deviceId,
      updatedAt: new Date().toISOString(),
    };

    // Only set createdAt if new (merge will handle this, but for clarity)
    // We used to set createdAt every time, which is wrong, but merge protects it partially.
    // Better relies on merge logic.

    // CRITICAL: Always attach ownerUid if available. 
    // This allows the "First Write Wins" policy in Security Rules.
    if (ownerUid) {
      deviceData.ownerUid = ownerUid;
    }

    await withTimeout(
      () => setDoc(doc(db, 'devices', deviceId), deviceData, { merge: true }),
      'Device ID save',
    );

    if (__DEV__) {
      logger.info(`Device ID saved to Firestore: ${deviceId}`);
    }
    return true;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    const errorMessage = errorObj?.message || String(error);

    // ELITE: Handle permission errors gracefully
    if (errorObj?.code === 'permission-denied' || errorMessage.includes('permission') || errorMessage.includes('Missing or insufficient permissions')) {
      if (__DEV__) {
        logger.debug('Device ID save skipped (permission denied - this is OK)');
      }
      return false;
    }

    logger.error('Failed to save device ID:', error);
    return false;
  }
}


/**
 * Subscribe to device location updates (real-time)
 * ELITE: Streams changes directly from the device document for minimal latency.
 */
export async function subscribeToDeviceLocation(
  deviceId: string,
  callback: (location: any) => void,
  isInitialized: boolean,
): Promise<() => void> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot subscribe to device location');
    return () => { };
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return () => { };
    }

    const { doc, onSnapshot } = await import('firebase/firestore');
    const deviceRef = doc(db, 'devices', deviceId);

    const unsubscribe = onSnapshot(
      deviceRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Extract location data if available
          if (data?.location) {
            callback(data.location);
          }
        }
      },
      (error: any) => {
        // Silent fail permissible for permissions/network
        if (__DEV__) {
          logger.debug(`Device location subscription error for ${deviceId}:`, error);
        }
      },
    );

    return unsubscribe;
  } catch (error) {
    logger.error('Failed to subscribe to device location:', error);
    return () => { };
  }
}
