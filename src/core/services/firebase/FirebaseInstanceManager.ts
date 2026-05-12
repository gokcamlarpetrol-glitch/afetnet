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
let _initPromise: Promise<any> | null = null;

/**
 * ELITE: Get Firestore instance with retry and error handling
 * CRITICAL: Lazy load Firebase modules to prevent module loading errors
 * Uses init promise dedup to prevent concurrent initialization races.
 */
export async function getFirestoreInstanceAsync(): Promise<any> {
  if (firestore) return firestore;
  if (_initPromise) return _initPromise;
  _initPromise = _initFirestoreImpl();
  try {
    return await _initPromise;
  } finally {
    _initPromise = null;
  }
}

async function _initFirestoreImpl(): Promise<any> {
  try {
    // CRITICAL: Lazy load Firebase modules to prevent "Requiring unknown module" errors
    // Add timeout protection for module imports with proper timer cleanup
    let importTimerId: ReturnType<typeof setTimeout> | null = null;
    const importPromise = Promise.all([
      import('../../../lib/firebase'),
      import('firebase/firestore'),
    ]);

    const timeoutPromise = new Promise<never>((_, reject) => {
      importTimerId = setTimeout(() => reject(new Error('Firebase module import timeout')), 8000);
    });

    let firebaseModule: any;
    let firestoreModule: any;
    try {
      [firebaseModule, firestoreModule] = await Promise.race([
        importPromise,
        timeoutPromise,
      ]);
    } finally {
      if (importTimerId) clearTimeout(importTimerId);
    }

    let getFirebaseAppAsync = firebaseModule.getFirebaseAppAsync;

    if (!getFirebaseAppAsync || typeof getFirebaseAppAsync !== 'function') {
      if (__DEV__) {
        logger.debug('getFirebaseAppAsync is not available in firebase module');
      }
      return null;
    }

    // Initialize Firebase app with timeout protection and proper timer cleanup
    let appTimerId: ReturnType<typeof setTimeout> | null = null;
    const appPromise = getFirebaseAppAsync();
    const appTimeoutPromise = new Promise<null>((resolve) => {
      appTimerId = setTimeout(() => resolve(null), 5000);
    });

    let firebaseApp: any;
    try {
      firebaseApp = await Promise.race([appPromise, appTimeoutPromise]);
    } finally {
      if (appTimerId) clearTimeout(appTimerId);
    }

    if (!firebaseApp) {
      if (__DEV__) {
        logger.debug('Firebase app not initialized - Firestore unavailable');
      }
      return null;
    }

    // CRITICAL: Use initializeFirestore for explicit cache & connection config.
    // Try persistent cache first (requires IndexedDB polyfill on RN).
    // Fall back to default getFirestore if already initialized (hot reload).
    try {
      const { initializeFirestore, persistentLocalCache, persistentSingleTabManager } = firestoreModule;
      if (initializeFirestore && persistentLocalCache) {
        // Set cache size to 50MB to prevent memory issues on low-end devices
        const cacheConfig: Record<string, any> = {
          cacheSizeBytes: 50 * 1024 * 1024, // 50MB limit
        };
        // persistentSingleTabManager with forceOwnership ensures single-tab mode on RN
        if (persistentSingleTabManager) {
          cacheConfig.tabManager = persistentSingleTabManager({ forceOwnership: true });
        }
        firestore = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache(cacheConfig),
        });
        logger.info('Firestore with persistent offline cache (50MB limit)');
      } else {
        throw new Error('persistentLocalCache not available');
      }
    } catch (persistError) {
      // persistentLocalCache unavailable (no IndexedDB on RN) or already initialized
      try {
        const { initializeFirestore } = firestoreModule;
        firestore = initializeFirestore(firebaseApp, {
          experimentalAutoDetectLongPolling: true,
        });
        logger.info('Firestore with auto-detect long polling');
      } catch {
        // Already initialized (hot reload / re-login) — get existing instance
        const { getFirestore } = firestoreModule;
        firestore = getFirestore(firebaseApp);
        logger.info('Firestore (existing instance)');
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




