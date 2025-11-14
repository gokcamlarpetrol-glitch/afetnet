/**
 * FIREBASE LOCATION OPERATIONS - ELITE MODULAR
 * Handles location update Firestore operations
 */

import { doc, setDoc } from 'firebase/firestore';
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
  operationName: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operationName} timeout`)), TIMEOUT_MS)
  );
  
  return Promise.race([operation(), timeoutPromise]);
}

/**
 * Save location update to Firestore
 */
export async function saveLocationUpdate(
  userDeviceId: string,
  location: LocationUpdateData,
  isInitialized: boolean
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

    await withTimeout(
      () => setDoc(doc(db, 'devices', userDeviceId, 'locations', Date.now().toString()), {
        ...location,
        timestamp: new Date().toISOString(),
      }, { merge: true }),
      'Location update save'
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

