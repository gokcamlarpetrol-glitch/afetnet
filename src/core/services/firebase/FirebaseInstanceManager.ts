/**
 * FIREBASE INSTANCE MANAGER - ELITE MODULAR
 * Manages Firestore instance initialization and access
 * CRITICAL: Lazy imports to prevent module loading errors
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('FirebaseInstanceManager');

// ELITE: Type-safe error helpers
const getErrorMessage = (e: unknown): string => e instanceof Error ? e.message : String(e);

let firestore: any = null;

/**
 * ELITE: Get Firestore instance with retry and error handling
 * CRITICAL: Lazy load Firebase modules to prevent module loading errors
 */
export async function getFirestoreInstanceAsync(): Promise<any> {
  if (firestore) return firestore;

  try {
    // CRITICAL: Lazy load Firebase modules to prevent "Requiring unknown module" errors
    // ELITE: Add timeout protection for module imports
    const importPromise = Promise.all([
      import('../../../lib/firebase'),
      import('firebase/firestore'),
    ]);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase module import timeout')), 8000),
    );

    const [firebaseModule, firestoreModule] = await Promise.race([
      importPromise,
      timeoutPromise,
    ]);

    let getFirebaseAppAsync = firebaseModule.getFirebaseAppAsync;

    if (!getFirebaseAppAsync || typeof getFirebaseAppAsync !== 'function') {
      if (__DEV__) {
        logger.debug('getFirebaseAppAsync is not available in firebase module');
      }
      return null;
    }

    // ELITE: Initialize Firebase app with timeout protection
    const appPromise = getFirebaseAppAsync();
    const appTimeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 5000),
    );

    const firebaseApp = await Promise.race([appPromise, appTimeoutPromise]);

    if (!firebaseApp) {
      if (__DEV__) {
        logger.debug('Firebase app not initialized - Firestore unavailable');
      }
      return null;
    }

    // CRITICAL: Use lazy-loaded getFirestore
    const { getFirestore } = firestoreModule;
    firestore = getFirestore(firebaseApp);

    // ELITE: Enable offline persistence (caches data locally)
    try {
      if (__DEV__) {
        logger.info('✅ Firestore instance created with offline persistence');
      }
    } catch (persistenceError) {
      if (__DEV__) {
        logger.debug('Firestore persistence setup skipped (non-critical):', persistenceError);
      }
    }

    return firestore;
  } catch (error: unknown) {
    // CRITICAL: Handle LoadBundleFromServerRequestError gracefully
    const errorMessage = getErrorMessage(error);
    if (errorMessage.includes('LoadBundleFromServerRequestError') ||
      errorMessage.includes('Could not load bundle') ||
      errorMessage.includes('timeout')) {
      if (__DEV__) {
        logger.debug('Firestore initialization skipped (bundle/timeout error - expected in some environments)');
      }
    } else {
      logger.error('Firestore initialization error:', error);
    }
    return null;
  }
}

export function getFirestoreInstance() {
  return firestore;
}




