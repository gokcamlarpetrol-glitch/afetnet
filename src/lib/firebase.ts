/**
 * FIREBASE LIB - Elite Firebase Integration
 * Centralized Firebase exports for type-safe imports
 * 
 * NOTE: firebase/messaging is a WEB-ONLY SDK and must NOT be imported here.
 * React Native uses expo-notifications for push notifications.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
// CRITICAL: firebase/messaging REMOVED — it's web-only and crashes React Native!
// React Native FCM is handled by expo-notifications + Cloud Functions
import {
  initializeAuth,
  getAuth,
  Auth,
  User,
} from 'firebase/auth'; // ELITE: Auth imports with persistence

// CRITICAL FIX: Import getReactNativePersistence with robust fallback.
// The firebase/auth ESM wrapper may not properly re-export getReactNativePersistence
// from @firebase/auth's React Native build (CJS→ESM interop issue in Metro).
// We try the standard import first, then fall back to direct @firebase/auth import.
let getReactNativePersistence: ((storage: any) => any) | undefined;
try {
  // Try standard import path (works when Metro properly resolves the RN build)
  const authModule = require('firebase/auth');
  if (typeof authModule.getReactNativePersistence === 'function') {
    getReactNativePersistence = authModule.getReactNativePersistence;
  }
} catch { /* ignore */ }
if (!getReactNativePersistence) {
  try {
    // Fallback: import directly from @firebase/auth which has a "react-native" field
    // in its package.json, guaranteeing Metro resolves to dist/rn/index.js
    const directAuthModule = require('@firebase/auth');
    if (typeof directAuthModule.getReactNativePersistence === 'function') {
      getReactNativePersistence = directAuthModule.getReactNativePersistence;
    }
  } catch { /* ignore */ }
}
import { createLogger } from '../core/utils/logger';
import { DirectStorage } from '../core/utils/storage';

const logger = createLogger('FirebaseLib');

// CRITICAL DIAGNOSTIC: Log whether persistence API is available at module load time.
// If this logs 'undefined', Firebase Auth WILL NOT persist across app restarts.
if (typeof getReactNativePersistence !== 'function') {
  console.error('[FirebaseAuth] CRITICAL STARTUP: getReactNativePersistence is NOT available. Auth persistence WILL FAIL. Users will be logged out on every app restart.');
} else if (__DEV__) {
  console.log('[FirebaseAuth] getReactNativePersistence loaded successfully');
}

// CRITICAL: MMKV adapter for Firebase Auth persistence.
// AsyncStorage does NOT reliably survive iOS background kill — MMKV (JSI-backed) does.
// Interface matches @react-native-async-storage/async-storage (getItem/setItem/removeItem).
const mmkvAuthPersistence = {
  getItem: (key: string): Promise<string | null> => {
    try {
      const value = DirectStorage.getString(key);
      if (value !== undefined) {
        return Promise.resolve(value);
      }
      // CRITICAL FIX: If primary MMKV returns undefined for a known auth key,
      // try recovery from keyRefMMKV (unencrypted backup store).
      // This handles the case where the encryption key changed after iOS reboot.
      try {
        const { keyRefMMKV } = require('../core/utils/storage');
        if (keyRefMMKV) {
          const backup = keyRefMMKV.getString(`auth_backup:${key}`);
          if (backup) {
            console.warn(`[FirebaseAuth] MMKV getItem recovered key=${key} from keyRefMMKV backup`);
            // Restore to primary storage for future reads
            try { DirectStorage.setString(key, backup); } catch { /* best effort */ }
            return Promise.resolve(backup);
          }
        }
      } catch { /* keyRefMMKV not available — non-critical */ }
      return Promise.resolve(null);
    } catch (e) {
      console.error(`[FirebaseAuth] MMKV getItem FAILED: key=${key}`, e);
      return Promise.resolve(null);
    }
  },
  setItem: (key: string, value: string): Promise<void> => {
    // CRITICAL FIX: Write-verify pattern with retry. Firebase Auth's persistence adapter
    // calls setItem to persist auth tokens. If the write silently fails, the next cold
    // start will have no tokens → onAuthStateChanged(null) → user logged out.
    // Firebase Auth does NOT handle setItem rejection (would crash), so we must always
    // resolve — but we retry up to 3 times and verify each write by reading back.
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        DirectStorage.setString(key, value);
        // Verify: read back and confirm the write persisted
        const readBack = DirectStorage.getString(key);
        if (readBack === value) {
          return Promise.resolve(); // Write verified
        }
        // Write succeeded but read-back mismatch — retry
        console.error(`[FirebaseAuth] MMKV setItem write-verify MISMATCH (attempt ${attempt}/${MAX_RETRIES}): key=${key}, wrote ${value.length} chars, read back ${readBack?.length ?? 'null'} chars`);
      } catch (e) {
        console.error(`[FirebaseAuth] MMKV setItem FAILED (attempt ${attempt}/${MAX_RETRIES}): key=${key}`, e);
      }
    }
    // All retries exhausted — log critical error for Crashlytics
    console.error(`[FirebaseAuth] CRITICAL: MMKV setItem FAILED after ${MAX_RETRIES} retries — auth will NOT persist across restart: key=${key}`);
    // Must resolve (not reject) — Firebase Auth doesn't handle rejection and would crash
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    try {
      DirectStorage.delete(key);
    } catch { /* non-critical */ }
    return Promise.resolve();
  },
};

// CRITICAL FIX: Expo runtime only exposes EXPO_PUBLIC_ prefixed env vars
// SECURITY: API key loaded from EAS secrets — expo-constants is the reliable source
const getFirebaseConfig = () => {
  let apiKey = '';
  let nativeOptions: Partial<{
    apiKey: string;
    projectId: string;
    messagingSenderId: string;
    appId: string;
    storageBucket: string;
  }> = {};

  // Priority 1: expo-constants (app.config.ts extra) — ALWAYS works in production
  if (!apiKey) {
    try {
      const Constants = require('expo-constants');
      apiKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_API_KEY ||
        Constants.expoConfig?.extra?.FIREBASE_API_KEY || '';
    } catch {
      // expo-constants not available
    }
  }

  // Priority 2: process.env (only works for EXPO_PUBLIC_ prefixed vars at runtime)
  if (!apiKey) {
    apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
  }

  // Priority 3: Native Firebase plist/json options (works even when env is missing)
  if (!apiKey) {
    try {
      const nativeFirebase = require('@react-native-firebase/app');
      const nativeApp =
        typeof nativeFirebase?.default?.app === 'function'
          ? nativeFirebase.default.app()
          : typeof nativeFirebase?.app === 'function'
            ? nativeFirebase.app()
            : null;
      const options = nativeApp?.options || {};
      if (typeof options.apiKey === 'string' && options.apiKey.trim().length > 0) {
        apiKey = options.apiKey.trim();
      }
      nativeOptions = {
        apiKey: typeof options.apiKey === 'string' ? options.apiKey : undefined,
        projectId: typeof options.projectId === 'string' ? options.projectId : undefined,
        messagingSenderId: typeof options.messagingSenderId === 'string' ? options.messagingSenderId : undefined,
        appId: typeof options.appId === 'string' ? options.appId : undefined,
        storageBucket: typeof options.storageBucket === 'string' ? options.storageBucket : undefined,
      };
      if (__DEV__ && apiKey) {
        logger.info('Firebase API key recovered from native Firebase options');
      }
    } catch {
      // native module unavailable
    }
  }

  if (!apiKey) {
    // PRODUCTION SAFETY: Log error but don't crash
    const errorMsg = 'Firebase API key missing! Set EXPO_PUBLIC_FIREBASE_API_KEY in EAS secrets.';
    if (__DEV__) {
      logger.error('❌ ' + errorMsg);
    } else {
      console.warn('[FirebaseLib] ' + errorMsg);
    }
  }

  const { Platform } = require('react-native');
  const defaultAppId = Platform.OS === 'android'
    ? '1:702394557087:android:9ed05aa80fa2afda0578aa'
    : '1:702394557087:ios:c73ce04083a4e97a0578aa';

  return {
    apiKey,
    projectId: nativeOptions.projectId || 'afetnet-4a6b6',
    messagingSenderId: nativeOptions.messagingSenderId || '702394557087',
    appId: nativeOptions.appId || defaultAppId,
    storageBucket: nativeOptions.storageBucket || 'afetnet-4a6b6.firebasestorage.app',
  };
};

// Singleton Firebase instances
let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;

/**
 * Initialize Firebase app (singleton)
 */
export function initializeFirebase(): FirebaseApp | null {
  if (firebaseApp) return firebaseApp;

  try {
    const apps = getApps();
    if (apps.length > 0) {
      firebaseApp = getApp();
    } else {
      const config = getFirebaseConfig();
      if (!config.apiKey) {
        if (__DEV__) {
          logger.warn('Firebase API key not configured');
        }
        return null;
      }
      firebaseApp = initializeApp(config);
    }
    // CRITICAL: Ensure Auth is initialized with MMKV persistence
    // before any module falls back to firebase/auth getAuth() directly.
    try {
      getOrInitializeAuth(firebaseApp);
    } catch {
      // best effort — Firebase app still usable even if auth init is deferred
    }

    return firebaseApp;
  } catch (error) {
    logger.error('Firebase initialization error:', error);
    return null;
  }
}

/**
 * ELITE: Get or initialize Auth instance with persistence
 * Uses initializeAuth with MMKV for crash-safe session persistence
 * MMKV survives iOS background kill — AsyncStorage does NOT reliably.
 */
function getOrInitializeAuth(app: FirebaseApp): Auth {
  if (authInstance) return authInstance;

  // CRITICAL: Verify getReactNativePersistence is available before using it.
  // If it's undefined (Metro CJS→ESM interop failure), calling it as a function
  // would throw TypeError, and the catch block would fall through to getAuth()
  // WITHOUT persistence — causing the "logged out on restart" bug.
  if (typeof getReactNativePersistence !== 'function') {
    console.error('[FirebaseAuth] CRITICAL: getReactNativePersistence is NOT available! Auth will NOT persist across restarts. This is likely a Metro bundler resolution issue with firebase/auth → @firebase/auth.');
    // Still try to get/create auth, but persistence will be in-memory only
    try {
      authInstance = initializeAuth(app);
    } catch {
      authInstance = getAuth(app);
    }
    return authInstance;
  }

  try {
    // ELITE: Initialize auth with MMKV persistence (survives iOS background kill, prevents auto-logout)
    const persistence = getReactNativePersistence(mmkvAuthPersistence);
    authInstance = initializeAuth(app, {
      persistence,
    });
  } catch (error: any) {
    // If auth is already initialized (hot reload, etc.), get existing instance
    if (error?.code === 'auth/already-initialized') {
      authInstance = getAuth(app);
    } else {
      // CRITICAL FIX: Do NOT fall back to getAuth() which creates auth WITHOUT persistence.
      // Instead, log the error and try getAuth() — but ONLY because if initializeAuth failed
      // for a non-already-initialized reason, the provider is NOT initialized, and getAuth()
      // will call initializeAuth() without persistence internally. This is a last-resort
      // fallback that at least lets the app function (with in-memory auth).
      console.error('[FirebaseAuth] initializeAuth with MMKV persistence failed — auth will NOT persist across restart:', error);
      // Try to recover by re-attempting with persistence
      try {
        authInstance = initializeAuth(app, {
          persistence: getReactNativePersistence!(mmkvAuthPersistence),
        });
      } catch {
        // Truly last resort — at least let the app work with in-memory auth
        console.error('[FirebaseAuth] All initializeAuth attempts failed — falling back to getAuth (NO persistence)');
        authInstance = getAuth(app);
      }
    }
  }

  return authInstance;
}

// NOTE: Anonymous auth removed - authentication is now mandatory
// All users must sign in with Google, Apple, or Email before using the app

// NOTE: getFCMToken and onForegroundMessage REMOVED
// firebase/messaging is a WEB-ONLY SDK — it requires service workers and crashes React Native
// Push notifications in React Native are handled by:
// 1. expo-notifications (client-side)
// 2. FCMTokenService (token registration via Cloud Functions)

/**
 * Get Firebase app instance
 */
export function getFirebaseApp(): FirebaseApp | null {
  return firebaseApp || initializeFirebase();
}

/**
 * ELITE: Get Firebase Auth with MMKV persistence
 * This is the ONLY way to get Auth — ensures persistence is always configured
 */
export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getOrInitializeAuth(app);
}

/**
 * Get Firebase app instance (async version for compatibility)
 */
export async function getFirebaseAppAsync(): Promise<FirebaseApp | null> {
  return getFirebaseApp();
}

export default {
  initializeFirebase,
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseAppAsync,
};
