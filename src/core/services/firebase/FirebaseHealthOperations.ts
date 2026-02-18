/**
 * FIREBASE HEALTH OPERATIONS — UID-CENTRIC v3.0
 * 
 * PATH ARCHITECTURE:
 *   users/{uid}/health/current    — Health profile
 *   users/{uid}/ice/current       — ICE (In Case of Emergency) contacts
 * 
 * Moved from devices/{id}/health to users/{uid}/health for UID-centric model.
 * 
 * @version 3.0.0
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import type { HealthProfileData, ICEData } from '../../types/firebase';

const logger = createLogger('FirebaseHealthOps');
const TIMEOUT_MS = 10000;

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
 * Save health profile to Firestore.
 * Path: users/{uid}/health/current
 */
export async function saveHealthProfile(
  uid: string,
  profile: HealthProfileData,
): Promise<boolean> {
  if (!uid) {
    logger.warn('saveHealthProfile: uid is empty');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    await withTimeout(
      () => setDoc(doc(db, 'users', uid, 'health', 'current'), {
        ...profile,
        userId: uid,
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'Health profile save',
    );

    if (__DEV__) {
      logger.info(`✅ Health profile saved: users/${uid}/health/current`);
    }
    return true;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permission')) {
      if (__DEV__) {
        logger.debug('Health profile save skipped (permission denied)');
      }
      return false;
    }
    logger.error('Failed to save health profile:', error);
    return false;
  }
}

/**
 * Load health profile from Firestore.
 * Path: users/{uid}/health/current
 */
export async function loadHealthProfile(
  uid: string,
): Promise<HealthProfileData | null> {
  if (!uid) return null;

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return null;

    const profileRef = doc(db, 'users', uid, 'health', 'current');
    const snapshot = await withTimeout(() => getDoc(profileRef), 'Health profile load');

    if (!snapshot.exists()) return null;
    return { ...snapshot.data(), userId: uid } as HealthProfileData;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permission')) {
      if (__DEV__) {
        logger.debug('Health profile load skipped (permission denied)');
      }
    } else {
      logger.warn('Failed to load health profile:', error);
    }
    return null;
  }
}

/**
 * Save ICE (In Case of Emergency) data.
 * Path: users/{uid}/ice/current
 */
export async function saveICE(
  uid: string,
  iceData: ICEData,
): Promise<boolean> {
  if (!uid) {
    logger.warn('saveICE: uid is empty');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return false;

    await withTimeout(
      () => setDoc(doc(db, 'users', uid, 'ice', 'current'), {
        ...iceData,
        userId: uid,
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'ICE data save',
    );

    if (__DEV__) {
      logger.info(`✅ ICE data saved: users/${uid}/ice/current`);
    }
    return true;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permission')) {
      if (__DEV__) {
        logger.debug('ICE data save skipped (permission denied)');
      }
      return false;
    }
    logger.error('Failed to save ICE data:', error);
    return false;
  }
}

/**
 * Load ICE data.
 * Path: users/{uid}/ice/current
 */
export async function loadICE(
  uid: string,
): Promise<ICEData | null> {
  if (!uid) return null;

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return null;

    const iceRef = doc(db, 'users', uid, 'ice', 'current');
    const snapshot = await withTimeout(() => getDoc(iceRef), 'ICE data load');

    if (!snapshot.exists()) return null;
    return {
      ...snapshot.data(),
      userId: uid,
      contacts: snapshot.data().contacts || [],
    } as ICEData;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permission')) {
      if (__DEV__) {
        logger.debug('ICE data load skipped (permission denied)');
      }
    } else {
      logger.warn('Failed to load ICE data:', error);
    }
    return null;
  }
}
