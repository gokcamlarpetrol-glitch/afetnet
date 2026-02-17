/**
 * FIREBASE LOCATION OPERATIONS — UID-CENTRIC v3.0
 * 
 * PATH ARCHITECTURE:
 *   locations_current/{uid}                   — SINGLE doc with current location
 *   locations_history/{uid}/points/{tsId}     — Optional history trail
 * 
 * The old `devices/{id}/locations/{ts}` model is replaced by:
 *   - ONE document per user for current location (fast, cheap reads)
 *   - Optional subcollection for history (battery-adaptive writes)
 * 
 * @version 3.0.0 — UID-Centric Single Document Model
 */

import { doc, setDoc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import type { LocationUpdateData } from '../../types/firebase';

const logger = createLogger('FirebaseLocationOps');
const TIMEOUT_MS = 10000;

// Battery-adaptive history write interval (default: 5 minutes)
const HISTORY_WRITE_INTERVAL_MS = 5 * 60 * 1000;
let lastHistoryWriteTime = 0;

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
 * Save current location to Firestore.
 * 
 * Writes to locations_current/{uid} — a SINGLE document.
 * Optionally appends to locations_history/{uid}/points/{ts} at intervals.
 * 
 * @param uid Firebase Auth UID (NOT device ID)
 * @param location Location data
 * @param writeHistory Whether to also write history point
 */
export async function saveLocationUpdate(
  uid: string,
  location: LocationUpdateData,
  writeHistory: boolean = false,
): Promise<boolean> {
  if (!uid) {
    logger.warn('saveLocationUpdate: uid is empty, skipping');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    const now = Date.now();
    const currentRef = doc(db, 'locations_current', uid);

    const locationPayload = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || null,
      altitude: location.altitude || null,
      speed: location.speed || null,
      heading: location.heading || null,
      battery: location.battery || null,
      source: location.source || 'gps',
      updatedAt: now,
      timestamp: location.timestamp || now,
    };

    await withTimeout(
      async () => {
        // PRIMARY: Current location (always written)
        await setDoc(currentRef, locationPayload, { merge: true });

        // OPTIONAL: History point (battery-adaptive interval)
        const shouldWriteHistory = writeHistory ||
          (now - lastHistoryWriteTime > HISTORY_WRITE_INTERVAL_MS);

        if (shouldWriteHistory) {
          const historyRef = doc(
            db,
            'locations_history', uid,
            'points', now.toString()
          );
          await setDoc(historyRef, {
            ...locationPayload,
            writtenAt: new Date().toISOString(),
          });
          lastHistoryWriteTime = now;
        }
      },
      'Location update save',
    );

    if (__DEV__) {
      logger.info(`📍 Location saved: locations_current/${uid}`);
    }
    return true;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permission')) {
      if (__DEV__) {
        logger.debug('Location update skipped (permission denied — this is OK)');
      }
    } else {
      logger.warn('Failed to save location update:', error);
    }
    return false;
  }
}

/**
 * Read current location for a user.
 * Path: locations_current/{uid}
 */
export async function getCurrentLocation(
  uid: string,
): Promise<LocationUpdateData | null> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return null;

    const snap = await withTimeout(
      () => getDoc(doc(db, 'locations_current', uid)),
      'Location read',
    );

    if (!snap.exists()) return null;
    return snap.data() as LocationUpdateData;
  } catch (error) {
    logger.warn(`Failed to read location for ${uid}:`, error);
    return null;
  }
}

/**
 * Subscribe to real-time location updates for a user.
 * Path: locations_current/{uid}
 * 
 * Used by familyStore to track family member locations.
 */
export function subscribeToLocation(
  uid: string,
  callback: (location: LocationUpdateData | null) => void,
  onError?: (error: any) => void,
): Unsubscribe | null {
  try {
    const db = (globalThis as any).__firestoreInstance;
    if (!db) {
      logger.warn('Firestore not available for location subscription');
      return null;
    }

    const locationRef = doc(db, 'locations_current', uid);

    const unsubscribe = onSnapshot(
      locationRef,
      (snap) => {
        if (snap.exists()) {
          callback(snap.data() as LocationUpdateData);
        } else {
          callback(null);
        }
      },
      (error: any) => {
        if (error?.code === 'permission-denied') {
          logger.debug(`Location subscription for ${uid}: permission denied`);
          return;
        }
        logger.warn(`Location subscription error for ${uid}:`, error);
        onError?.(error);
      },
    );

    logger.info(`✅ Subscribed to location: locations_current/${uid}`);
    return unsubscribe;
  } catch (error) {
    logger.warn(`Failed to subscribe to location for ${uid}:`, error);
    return null;
  }
}

/**
 * Subscribe to location using async Firestore instance.
 * Preferred over subscribeToLocation when Firestore may not be ready yet.
 */
export async function subscribeToLocationAsync(
  uid: string,
  callback: (location: LocationUpdateData | null) => void,
  onError?: (error: any) => void,
): Promise<Unsubscribe | null> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available for location subscription');
      return null;
    }

    const locationRef = doc(db, 'locations_current', uid);

    const unsubscribe = onSnapshot(
      locationRef,
      (snap) => {
        if (snap.exists()) {
          callback(snap.data() as LocationUpdateData);
        } else {
          callback(null);
        }
      },
      (error: any) => {
        if (error?.code === 'permission-denied') {
          logger.debug(`Location subscription for ${uid}: permission denied`);
          return;
        }
        logger.warn(`Location subscription error for ${uid}:`, error);
        onError?.(error);
      },
    );

    logger.info(`✅ Subscribed to location (async): locations_current/${uid}`);
    return unsubscribe;
  } catch (error) {
    logger.warn(`Failed to subscribe to location for ${uid}:`, error);
    return null;
  }
}
