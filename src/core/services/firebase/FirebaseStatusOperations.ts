/**
 * FIREBASE STATUS OPERATIONS — UID-CENTRIC v3.0
 * 
 * PATH ARCHITECTURE:
 *   users/{uid}/status/current        — Current status (safe/need_help/etc)
 *   users/{uid}/status_updates/{ts}   — Status history
 * 
 * Moved from devices/{id}/status to users/{uid}/status.
 * 
 * @version 3.0.0
 */

import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import type { StatusUpdateData } from '../../types/firebase';

const logger = createLogger('FirebaseStatusOps');
const TIMEOUT_MS = 10000;

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
 * Save status update to Firestore.
 * Path: users/{uid}/status/current
 * Also appends to users/{uid}/status_updates for history.
 */
export async function saveStatusUpdate(
  uid: string,
  statusData: StatusUpdateData,
): Promise<boolean> {
  if (!uid) {
    logger.warn('saveStatusUpdate: uid is empty');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    const statusPayload = {
      ...statusData,
      userId: uid,
      updatedAt: new Date().toISOString(),
    };

    await withTimeout(
      async () => {
        // Write current status
        await setDoc(
          doc(db, 'users', uid, 'status', 'current'),
          statusPayload,
          { merge: true }
        );

        // Append to history
        await addDoc(
          collection(db, 'users', uid, 'status_updates'),
          {
            ...statusPayload,
            timestamp: Date.now(),
          }
        );
      },
      'Status update save',
    );

    if (__DEV__) {
      logger.info(`✅ Status update saved: users/${uid}/status/current`);
    }
    return true;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    const errorMessage = errorObj?.message || String(error);

    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      if (__DEV__) {
        logger.debug('Status update timed out (expected in poor network)');
      }
      return false;
    }

    if (errorObj?.code === 'permission-denied' || errorMessage.includes('permission')) {
      if (__DEV__) {
        logger.debug('Status update skipped (permission denied)');
      }
    } else {
      logger.warn('Failed to save status update:', error);
    }
    return false;
  }
}
