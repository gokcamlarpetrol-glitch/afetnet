/**
 * FIREBASE DEVICE OPERATIONS - ELITE MODULAR
 * Handles device-related Firestore operations
 */

import { doc, setDoc } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';

const logger = createLogger('FirebaseDeviceOperations');
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

    await withTimeout(
      () => setDoc(doc(db, 'devices', deviceId), {
        deviceId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'Device ID save'
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

