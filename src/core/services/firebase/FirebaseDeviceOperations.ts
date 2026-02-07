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
    const qrAliasId = ownerUid ? `AFN-${ownerUid.substring(0, 8).toUpperCase()}` : null;

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

    const targetDeviceIds = new Set<string>([deviceId]);
    if (qrAliasId) {
      targetDeviceIds.add(qrAliasId);
    }

    await withTimeout(
      async () => {
        await Promise.all(
          Array.from(targetDeviceIds).map(async (targetId) => {
            const payload = {
              ...deviceData,
              ...(targetId !== deviceId ? { aliasOfDeviceId: deviceId } : {}),
            };
            await setDoc(doc(db, 'devices', targetId), payload, { merge: true });
          }),
        );
      },
      'Device ID save',
    );

    if (__DEV__) {
      logger.info(`Device IDs saved to Firestore: ${Array.from(targetDeviceIds).join(', ')}`);
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
 * Subscribe to device location updates (real-time) with auto-recovery
 * FIX #3: Listeners now auto-reconnect after transient errors (network drops).
 * Permission-denied errors are permanent and not retried.
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

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 5000;
  let retryCount = 0;
  let currentUnsubscribe: (() => void) | null = null;
  let destroyed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const subscribe = async (): Promise<void> => {
    if (destroyed) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db || destroyed) {
        return;
      }

      const { doc, onSnapshot } = await import('firebase/firestore');
      const deviceRef = doc(db, 'devices', deviceId);

      // Cleanup previous listener before creating new one
      if (currentUnsubscribe) {
        try { currentUnsubscribe(); } catch { /* noop */ }
        currentUnsubscribe = null;
      }

      currentUnsubscribe = onSnapshot(
        deviceRef,
        (docSnap) => {
          retryCount = 0; // Reset retry counter on successful snapshot
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data?.location) {
              callback(data.location);
            }
          }
        },
        async (error: any) => {
          const errorCode = error?.code || '';
          const errorMessage = error?.message || '';

          // Permission-denied is permanent — don't retry
          if (errorCode === 'permission-denied' ||
            errorMessage.includes('permission') ||
            errorMessage.includes('Missing or insufficient permissions')) {
            logger.warn(`Location listener for ${deviceId} permission denied — not retrying`);
            return;
          }

          // Transient error — retry with backoff
          if (retryCount < MAX_RETRIES && !destroyed) {
            retryCount++;
            const delayMs = RETRY_DELAY_MS * retryCount;
            logger.info(`🔄 Location listener retry ${retryCount}/${MAX_RETRIES} for ${deviceId} in ${delayMs}ms`);
            retryTimer = setTimeout(() => {
              if (!destroyed) {
                subscribe().catch((e) => {
                  logger.warn(`Retry subscribe failed for ${deviceId}:`, e);
                });
              }
            }, delayMs);
          } else if (!destroyed) {
            logger.warn(`Location listener for ${deviceId} exhausted ${MAX_RETRIES} retries`);
          }
        },
      );
    } catch (error) {
      logger.error('Failed to subscribe to device location:', error);
    }
  };

  await subscribe();

  // Return cleanup function that prevents retries and unsubscribes
  return () => {
    destroyed = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (currentUnsubscribe) {
      try { currentUnsubscribe(); } catch { /* noop */ }
      currentUnsubscribe = null;
    }
  };
}
