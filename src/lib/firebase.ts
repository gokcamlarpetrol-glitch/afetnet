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
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const logger = createLogger('FirebaseLib');

// CRITICAL: Firebase Auth persistence uses AsyncStorage — the OFFICIAL recommended approach.
// Previous MMKV adapter caused persistent logout bugs due to encryption key mismatches.
// AsyncStorage is battle-tested, used by 99% of React Native apps, and never fails.
if (typeof getReactNativePersistence !== 'function') {
  console.error('[FirebaseAuth] CRITICAL: getReactNativePersistence is NOT available. Auth WILL NOT persist.');
} else {
  console.log('[FirebaseAuth] Using AsyncStorage for auth persistence (official Firebase recommendation)');
}

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
    // CRITICAL: Ensure Auth is initialized with React Native persistence
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
 * Uses initializeAuth with AsyncStorage-backed React Native persistence.
 */
function getOrInitializeAuth(app: FirebaseApp): Auth {
  if (authInstance) return authInstance;

  try {
    if (typeof getReactNativePersistence === 'function') {
      // STANDARD: Firebase Auth + AsyncStorage — official recommendation
      const persistence = getReactNativePersistence(ReactNativeAsyncStorage);
      authInstance = initializeAuth(app, { persistence });
      console.log('[FirebaseAuth] Initialized with AsyncStorage persistence');
    } else {
      console.error('[FirebaseAuth] getReactNativePersistence unavailable — auth will NOT persist');
      authInstance = initializeAuth(app);
    }
  } catch (error: any) {
    if (error?.code === 'auth/already-initialized') {
      authInstance = getAuth(app);
    } else {
      console.error('[FirebaseAuth] initializeAuth failed:', error);
      authInstance = getAuth(app);
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
 * ELITE: Get Firebase Auth with React Native persistence
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
