/**
 * FIREBASE STATUS OPERATIONS - ELITE MODULAR
 * Handles status update Firestore operations
 */

import { doc, setDoc } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import type { StatusUpdateData } from '../../types/firebase';

const logger = createLogger('FirebaseStatusOperations');
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
 * Save status update to Firestore
 */
export async function saveStatusUpdate(
  userDeviceId: string,
  statusData: StatusUpdateData,
  isInitialized: boolean
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping saveStatusUpdate');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    await withTimeout(
      () => setDoc(doc(db, 'devices', userDeviceId, 'status', 'current'), {
        ...statusData,
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'Status update save'
    );

    if (__DEV__) {
      logger.info('Status update saved to Firestore');
    }
    return true;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    const errorMessage = errorObj?.message || String(error);
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      if (__DEV__) {
        logger.debug('Status update timed out (expected in poor network conditions)');
      }
      return false;
    }
    
    if (errorObj?.code === 'permission-denied' || errorMessage.includes('permission')) {
      if (__DEV__) {
        logger.debug('Status update skipped (permission denied - this is OK)');
      }
    } else {
      logger.warn('Failed to save status update:', error);
    }
    return false;
  }
}

