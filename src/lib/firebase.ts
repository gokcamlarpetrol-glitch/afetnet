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
  // @ts-expect-error - getReactNativePersistence is available in firebase/auth but not in typings
  getReactNativePersistence
} from 'firebase/auth'; // ELITE: Auth imports with persistence
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../core/utils/logger';

const logger = createLogger('FirebaseLib');

// Firebase configuration from environment
// CRITICAL FIX: Expo runtime only exposes EXPO_PUBLIC_ prefixed env vars
// SECURITY: API key loaded from EAS secrets — expo-constants is the reliable source
const getFirebaseConfig = () => {
  let apiKey = '';

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

  if (!apiKey) {
    // PRODUCTION SAFETY: Log error but don't crash
    const errorMsg = 'Firebase API key missing! Set EXPO_PUBLIC_FIREBASE_API_KEY in EAS secrets.';
    if (__DEV__) {
      logger.error('❌ ' + errorMsg);
    } else {
      console.warn('[FirebaseLib] ' + errorMsg);
    }
  }

  return {
    apiKey,
    projectId: 'afetnet-4a6b6',
    messagingSenderId: '702394557087',
    appId: '1:702394557087:ios:c73ce04083a4e97a0578aa',
    storageBucket: 'afetnet-4a6b6.firebasestorage.app',
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
    // CRITICAL: Ensure Auth is initialized with AsyncStorage persistence
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
 * Uses initializeAuth with AsyncStorage for proper session persistence
 */
function getOrInitializeAuth(app: FirebaseApp): Auth {
  if (authInstance) return authInstance;

  try {
    // ELITE: Initialize auth with AsyncStorage persistence
    // This prevents the "Auth state will default to memory persistence" warning
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error: any) {
    // If auth is already initialized (hot reload, etc.), get existing instance
    if (error?.code === 'auth/already-initialized') {
      authInstance = getAuth(app);
    } else {
      // Fallback to getAuth if initializeAuth fails
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
 * ELITE: Get Firebase Auth with AsyncStorage persistence
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
