/**
 * GLOBAL EARTHQUAKE FIREBASE OPERATIONS - ELITE MODULAR
 * Handles Firebase operations for global earthquakes
 */

import { GlobalEarthquakeEvent } from './USGSFetcher';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GlobalEarthquakeFirebaseOperations');

/**
 * Save global earthquake event to Firebase
 */
export async function saveToFirebase(event: GlobalEarthquakeEvent): Promise<void> {
  try {
    // CRITICAL: Lazy load Firebase modules to prevent module loading errors
    const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const firebaseModule = await import('../../../lib/firebase');
    
    // CRITICAL: Use async getter for Firebase app
    const getFirebaseAppAsync = firebaseModule.getFirebaseAppAsync;
    if (!getFirebaseAppAsync || typeof getFirebaseAppAsync !== 'function') {
      if (__DEV__) {
        logger.warn('getFirebaseAppAsync not available, skipping save');
      }
      return;
    }

    const app = await getFirebaseAppAsync();
    if (!app) {
      if (__DEV__) {
        logger.warn('Firebase app not initialized, skipping save');
      }
      return;
    }

    const db = getFirestore(app);
    if (!db) {
      if (__DEV__) {
        logger.warn('Firestore not available, skipping save');
      }
      return;
    }

    if (!event || !event.id || typeof event.latitude !== 'number' || typeof event.longitude !== 'number') {
      logger.warn('Invalid event data for Firebase save:', event);
      return;
    }

    const eventDoc = {
      id: event.id,
      latitude: event.latitude,
      longitude: event.longitude,
      magnitude: event.magnitude,
      depth: event.depth || 10,
      time: event.time,
      region: event.region || 'Unknown',
      source: event.source,
      distanceToTurkey: event.distanceToTurkey || null,
      etaToTurkey: event.etaToTurkey || null,
      willAffectTurkey: event.willAffectTurkey || false,
      confidence: event.confidence || null,
      priority: event.priority || false,
      alert: event.alert || null,
      tsunami: event.tsunami || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = doc(db, 'global_earthquakes', event.id);
    await setDoc(docRef, eventDoc, { merge: true });

    if (__DEV__) {
      logger.debug(`✅ Global earthquake saved to Firebase: ${event.id}`);
    }
  } catch (error) {
    if (__DEV__) {
      logger.warn('Firebase save error (non-critical):', error);
    }
  }
}




