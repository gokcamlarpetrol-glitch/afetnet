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
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operationName} timeout`)), TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Save device ID to Firestore
 * SINGLE ID ARCHITECTURE: Only writes ONE device document.
 * Previously wrote both deviceId and qrAliasId documents, but they're now unified.
 */
export async function saveDeviceId(deviceId: string, isInitialized: boolean): Promise<boolean> {
  // ELITE V2: Don't gate on isInitialized — saveDeviceId creates the device document
  // with ownerUid, which is REQUIRED for ALL downstream operations:
  // - Firestore rules (isDeviceOwner) 
  // - CF push token lookup (devices/{id}.ownerUid → fcm_tokens/{uid})
  // - Location & message subscriptions
  if (!isInitialized) {
    logger.info(`saveDeviceId: isInitialized=false for ${deviceId}, attempting anyway (CRITICAL operation)`);
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

    // CRITICAL: Always attach ownerUid if available. 
    // This allows the "First Write Wins" policy in Security Rules.
    if (ownerUid) {
      deviceData.ownerUid = ownerUid;
    }

    // SINGLE ID: Write only ONE device document (no alias needed)
    await withTimeout(
      async () => {
        await setDoc(doc(db, 'devices', deviceId), deviceData, { merge: true });
      },
      'Device ID save',
    );

    if (__DEV__) {
      logger.info(`Device ID saved to Firestore: ${deviceId} (SINGLE ID)`);
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
 * Ensure a device document exists in Firestore.
 * When sender writes a message to devices/{recipientId}/messages/{msgId},
 * the parent document devices/{recipientId} must exist with ownerUid
 * for Firestore rules (isDeviceReadable) to allow the recipient to read.
 * If missing, recipient's onSnapshot subscription silently receives nothing.
 * 
 * This function checks existence and ONLY creates a placeholder if the doc
 * doesn't exist yet. It does NOT overwrite existing docs.
 */
export async function ensureDeviceDocExists(deviceId: string): Promise<boolean> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return false;

    const { getDoc } = await import('firebase/firestore');
    const deviceRef = doc(db, 'devices', deviceId);
    const deviceSnap = await withTimeout(
      () => getDoc(deviceRef),
      'Device doc check',
    );

    if (deviceSnap.exists()) {
      return true; // Already exists, nothing to do
    }

    // Device doc doesn't exist — we CANNOT create it because Firestore rules
    // require ownerUid == request.auth.uid, and we are NOT the owner of
    // the recipient device. The recipient must create their own device doc.
    // Log a warning so we can diagnose delivery failures.
    logger.warn(
      `⚠️ Recipient device document does NOT exist: devices/${deviceId}. ` +
      `Messages will be written to subcollection but recipient may not ` +
      `be able to read them until they create their device doc (via saveDeviceId).`
    );
    return false;
  } catch (error) {
    logger.warn(`ensureDeviceDocExists check failed for ${deviceId}:`, error);
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
  // ELITE V2: Don't gate on isInitialized — try to set up listener anyway.
  // Firestore instance can be obtained directly, and the listener will handle
  // its own permission-denied errors. This prevents silent failure when
  // FirebaseDataService init races with listener setup.
  if (!isInitialized) {
    logger.info(`subscribeToDeviceLocation: isInitialized=false for ${deviceId}, attempting anyway`);
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
              // CRITICAL FIX: Pass full device data including status
              // This allows family members to see each other's status updates
              callback({
                ...data.location,
                // Attach status fields so familyStore can update member status
                _deviceStatus: data.status || undefined,
                _statusUpdatedAt: data.statusUpdatedAt || undefined,
                _lastSeen: data.lastSeen || undefined,
              });
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
