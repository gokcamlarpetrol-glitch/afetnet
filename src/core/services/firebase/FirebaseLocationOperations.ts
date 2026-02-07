/**
 * FIREBASE LOCATION OPERATIONS - ELITE MODULAR
 * Handles location update Firestore operations
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import type { LocationUpdateData } from '../../types/firebase';

const logger = createLogger('FirebaseLocationOperations');
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
 * Save location update to Firestore
 */
export async function saveLocationUpdate(
  userDeviceId: string,
  location: LocationUpdateData,
  isInitialized: boolean,
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping saveLocationUpdate');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    const timestamp = Date.now();
    const historyRef = doc(db, 'devices', userDeviceId, 'locations', timestamp.toString());
    const deviceRef = doc(db, 'devices', userDeviceId);

    await withTimeout(
      async () => {
        // ELITE: Auto-provision device document if it doesn't exist yet.
        // Without this, Firestore rule `isDeviceOwner(deviceId)` fails because
        // it checks exists() + ownerUid on the device document.
        const deviceSnap = await getDoc(deviceRef);
        if (!deviceSnap.exists()) {
          const currentUser = getAuth().currentUser;
          if (!currentUser) {
            logger.warn('Cannot auto-provision device doc: no authenticated user');
            return;
          }
          logger.info('Auto-provisioning device document for:', userDeviceId);
          await setDoc(deviceRef, {
            ownerUid: currentUser.uid,
            createdAt: new Date().toISOString(),
          });
        }

        // Parallel writes: ONE for history, ONE for real-time status
        await Promise.all([
          setDoc(historyRef, {
            ...location,
            timestamp: new Date().toISOString(),
          }, { merge: true }),

          setDoc(deviceRef, {
            location: {
              ...location,
              timestamp: timestamp, // Store as number for easy comparison
            },
            lastSeen: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, { merge: true }),
        ]);
      },
      'Location update save',
    );

    if (__DEV__) {
      logger.info('Location update saved to Firestore');
    }
    return true;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permission')) {
      if (__DEV__) {
        logger.debug('Location update skipped (permission denied - this is OK)');
      }
    } else {
      logger.warn('Failed to save location update:', error);
    }
    return false;
  }
}

