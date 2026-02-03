/**
 * FIREBASE LIB - Elite Firebase Integration
 * Centralized Firebase exports for type-safe imports
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { getAuth, signInAnonymously, Auth, User } from 'firebase/auth'; // ELITE: Auth imports
import { createLogger } from '../core/utils/logger';

const logger = createLogger('FirebaseLib');

// Firebase configuration from environment
const getFirebaseConfig = () => ({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID || 'afetnet-4a6b6',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '702394557087',
  appId: process.env.FIREBASE_APP_ID_IOS,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'afetnet-4a6b6.firebasestorage.app',
});

// Singleton Firebase instances
let firebaseApp: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;
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
    return firebaseApp;
  } catch (error) {
    logger.error('Firebase initialization error:', error);
    return null;
  }
}

/**
 * ELITE: Anonymous Authentication
 * Enables writing to shared collections (news summaries) without user signup
 */
export async function signInAnonymouslyAsync(): Promise<User | null> {
  try {
    const app = initializeFirebase();
    if (!app) return null;

    if (!authInstance) {
      authInstance = getAuth(app);
    }

    const userCredential = await signInAnonymously(authInstance);
    if (__DEV__) {
      logger.info('✅ Signed in anonymously:', userCredential.user.uid);
    }
    return userCredential.user;
  } catch (error) {
    logger.error('Anonymous sign-in failed:', error);
    return null;
  }
}

/**
 * Get FCM token for push notifications
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const app = initializeFirebase();
    if (!app) return null;

    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }

    // FCM requires service worker in web, native implementation differs
    const token = await getToken(messagingInstance, {
      vapidKey: process.env.FIREBASE_VAPID_KEY,
    });

    return token || null;
  } catch (error) {
    if (__DEV__) {
      logger.debug('FCM token not available:', error);
    }
    return null;
  }
}

/**
 * Subscribe to foreground messages
 */
export async function onForegroundMessage(
  callback: (payload: any) => void,
): Promise<(() => void) | null> {
  try {
    const app = initializeFirebase();
    if (!app) return null;

    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }

    const unsubscribe = onMessage(messagingInstance, callback);
    return unsubscribe;
  } catch (error) {
    logger.error('Foreground message subscription error:', error);
    return null;
  }
}

/**
 * Get Firebase app instance
 */
export function getFirebaseApp(): FirebaseApp | null {
  return firebaseApp || initializeFirebase();
}

/**
 * Get Firebase app instance (async version for compatibility)
 */
export async function getFirebaseAppAsync(): Promise<FirebaseApp | null> {
  return getFirebaseApp();
}

export default {
  initializeFirebase,
  getFCMToken,
  onForegroundMessage,
  getFirebaseApp,
  getFirebaseAppAsync,
  signInAnonymously: signInAnonymouslyAsync, // ELITE: Export alias
};
