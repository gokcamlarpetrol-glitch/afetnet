/**
 * FIREBASE EARTHQUAKE OPERATIONS - ELITE MODULAR
 * Handles earthquake-related Firestore operations
 */

import { doc, setDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import type { EarthquakeFirebaseData, FeltEarthquakeReportData } from '../../types/firebase';

const logger = createLogger('FirebaseEarthquakeOperations');
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
 * Save earthquake to Firestore
 */
export async function saveEarthquake(
  earthquake: EarthquakeFirebaseData,
  isInitialized: boolean,
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping saveEarthquake');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    const earthquakeId = earthquake.id || `${earthquake.timestamp}_${earthquake.magnitude}`;
    
    await withTimeout(
      () => setDoc(doc(db, 'earthquakes', earthquakeId), {
        ...earthquake,
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'Earthquake save',
    );

    if (__DEV__) {
      logger.info('Earthquake saved to Firestore:', earthquakeId);
    }
    return true;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    const errorMessage = errorObj?.message || String(error);
    
    // ELITE: Handle permission errors gracefully
    if (errorObj?.code === 'permission-denied' || errorMessage.includes('permission') || errorMessage.includes('Missing or insufficient permissions')) {
      if (__DEV__) {
        logger.debug('Earthquake save skipped (permission denied - this is OK)');
      }
      return false;
    }
    
    logger.error('Failed to save earthquake:', error);
    return false;
  }
}

/**
 * Save felt earthquake report to Firestore
 */
export async function saveFeltEarthquakeReport(
  report: FeltEarthquakeReportData,
  isInitialized: boolean,
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping saveFeltEarthquakeReport');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    // ELITE: Generate unique report ID (FeltEarthquakeReportData doesn't have id field)
    const reportId = `${report.earthquakeId}_${report.userId}_${Date.now()}`;
    
    await withTimeout(
      () => setDoc(doc(db, 'feltEarthquakes', reportId), {
        ...report,
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'Felt earthquake report save',
    );

    if (__DEV__) {
      logger.info('Felt earthquake report saved to Firestore:', reportId);
    }
    return true;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    const errorMessage = errorObj?.message || String(error);
    
    // ELITE: Handle permission errors gracefully
    if (errorObj?.code === 'permission-denied' || errorMessage.includes('permission') || errorMessage.includes('Missing or insufficient permissions')) {
      if (__DEV__) {
        logger.debug('Felt earthquake report save skipped (permission denied - this is OK)');
      }
      return false;
    }
    
    logger.error('Failed to save felt earthquake report:', error);
    return false;
  }
}

/**
 * Get intensity data from Firestore
 */
export async function getIntensityData(
  earthquakeId: string,
  isInitialized: boolean,
): Promise<Record<string, unknown>[] | null> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot get intensity data');
    return null;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return null;
    }

    const q = query(collection(db, 'feltEarthquakes'), where('earthquakeId', '==', earthquakeId));
    
    const snapshot = await withTimeout(
      () => getDocs(q),
      'Intensity data load',
    );
    
    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs.map(doc => doc.data());
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    const errorMessage = errorObj?.message || String(error);
    
    // ELITE: Handle permission errors gracefully
    if (errorObj?.code === 'permission-denied' || errorMessage.includes('permission') || errorMessage.includes('Missing or insufficient permissions')) {
      if (__DEV__) {
        logger.debug('Intensity data load skipped (permission denied - this is OK)');
      }
      return null;
    }
    
    logger.error('Failed to get intensity data:', error);
    return null;
  }
}

