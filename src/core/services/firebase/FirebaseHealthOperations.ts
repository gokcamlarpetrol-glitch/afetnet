/**
 * FIREBASE HEALTH OPERATIONS - ELITE MODULAR
 * Handles health profile and ICE data Firestore operations
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import type { HealthProfileData, ICEData } from '../../types/firebase';

const logger = createLogger('FirebaseHealthOperations');
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
 * Save health profile to Firestore
 */
export async function saveHealthProfile(
  userDeviceId: string,
  profile: HealthProfileData,
  isInitialized: boolean,
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping saveHealthProfile');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    await withTimeout(
      () => setDoc(doc(db, 'devices', userDeviceId, 'healthProfile', 'current'), {
        ...profile,
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'Health profile save',
    );

    if (__DEV__) {
      logger.info('Health profile saved to Firestore');
    }
    return true;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    const errorMessage = errorObj?.message || String(error);
    
    // ELITE: Handle permission errors gracefully
    if (errorObj?.code === 'permission-denied' || errorMessage.includes('permission') || errorMessage.includes('Missing or insufficient permissions')) {
      if (__DEV__) {
        logger.debug('Health profile save skipped (permission denied - this is OK)');
      }
      return false;
    }
    
    logger.error('Failed to save health profile:', error);
    return false;
  }
}

/**
 * Load health profile from Firestore
 */
export async function loadHealthProfile(
  userDeviceId: string,
  isInitialized: boolean,
): Promise<HealthProfileData | null> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot load health profile');
    return null;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return null;
    }

    const profileRef = doc(db, 'devices', userDeviceId, 'healthProfile', 'current');
    
    const snapshot = await withTimeout(
      () => getDoc(profileRef),
      'Health profile load',
    );
    
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    // ELITE: Type-safe data mapping - add userId if missing
    return {
      ...data,
      userId: userDeviceId,
    } as HealthProfileData;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permission') || errorObj?.message?.includes('Missing or insufficient permissions')) {
      if (__DEV__) {
        logger.debug('Health profile load skipped (permission denied - this is OK)');
      }
    } else {
      logger.warn('Failed to load health profile:', error);
    }
    return null;
  }
}

/**
 * Save ICE (In Case of Emergency) data to Firestore
 */
export async function saveICE(
  userDeviceId: string,
  iceData: ICEData,
  isInitialized: boolean,
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping saveICE');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    await withTimeout(
      () => setDoc(doc(db, 'devices', userDeviceId, 'ice', 'current'), {
        ...iceData,
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'ICE data save',
    );

    if (__DEV__) {
      logger.info('ICE data saved to Firestore');
    }
    return true;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    const errorMessage = errorObj?.message || String(error);
    
    // ELITE: Handle permission errors gracefully
    if (errorObj?.code === 'permission-denied' || errorMessage.includes('permission') || errorMessage.includes('Missing or insufficient permissions')) {
      if (__DEV__) {
        logger.debug('ICE data save skipped (permission denied - this is OK)');
      }
      return false;
    }
    
    logger.error('Failed to save ICE data:', error);
    return false;
  }
}

/**
 * Load ICE (In Case of Emergency) data from Firestore
 */
export async function loadICE(
  userDeviceId: string,
  isInitialized: boolean,
): Promise<ICEData | null> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot load ICE');
    return null;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return null;
    }

    const iceRef = doc(db, 'devices', userDeviceId, 'ice', 'current');
    
    const snapshot = await withTimeout(
      () => getDoc(iceRef),
      'ICE data load',
    );
    
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    // ELITE: Type-safe data mapping - ensure required fields
    return {
      ...data,
      userId: userDeviceId,
      contacts: data.contacts || [],
    } as ICEData;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permission') || errorObj?.message?.includes('Missing or insufficient permissions')) {
      if (__DEV__) {
        logger.debug('ICE data load skipped (permission denied - this is OK)');
      }
    } else {
      logger.warn('Failed to load ICE data:', error);
    }
    return null;
  }
}

