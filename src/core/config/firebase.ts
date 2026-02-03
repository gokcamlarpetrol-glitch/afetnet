/**
 * FIREBASE CONFIGURATION - ELITE PRODUCTION CONFIG
 * Firebase config for push notifications and analytics
 * SECURITY: API keys loaded from EAS secrets (via app.config.ts extra)
 * CRITICAL: Lazy imports to prevent module loading errors
 * PRODUCTION-READY: Zero-error initialization with graceful degradation
 * VALIDATED: Firebase API key is validated and logged for debugging
 */

import { getErrorMessage } from './../utils/errorUtils';
import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';

// ============================================================================
// API KEY MANAGEMENT - ELITE SECURITY
// ============================================================================
let firebaseApiKeyCache: string | null = null;
let firebaseKeyValidated = false;

/**
 * ELITE: Get Firebase API key from EAS secrets with comprehensive validation
 * Priority: EAS Secrets (Constants.extra) > process.env > hardcoded fallback (for development only)
 * PRODUCTION: API key MUST be set in EAS secrets before deployment
 */
function getFirebaseApiKey(): string {
  if (firebaseApiKeyCache !== null && firebaseKeyValidated) {
    return firebaseApiKeyCache; // Already validated, safe to return
  }

  try {
    // CRITICAL: Dynamic import to prevent module loading errors
    const Constants = require('expo-constants');

    // ELITE: Priority order for Firebase API key
    // 1. EAS Secrets (via app.config.ts extra) - PRODUCTION
    // 2. process.env - BUILD TIME
    // 3. Hardcoded fallback - DEVELOPMENT ONLY
    firebaseApiKeyCache =
      Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_API_KEY ||
      Constants.expoConfig?.extra?.FIREBASE_API_KEY ||
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
      process.env.FIREBASE_API_KEY ||
      ''; // ELITE SECURITY: No hardcoded fallback

    // ELITE: Validate API key format (Firebase keys start with AIzaSy)
    if (firebaseApiKeyCache && firebaseApiKeyCache.startsWith('AIzaSy') && firebaseApiKeyCache.length > 30) {
      firebaseKeyValidated = true;
      if (__DEV__) {
        const logger = createLogger('FirebaseConfig');
        logger.info(`✅ [FirebaseConfig] Firebase API key loaded successfully (${firebaseApiKeyCache.substring(0, 10)}...)`);
      }
    } else if (!firebaseApiKeyCache || firebaseApiKeyCache.trim().length === 0) {
      // ELITE: Critical warning - Firebase API key is missing
      if (__DEV__) {
        const logger = createLogger('FirebaseConfig');
        logger.error('❌ [FirebaseConfig] CRITICAL: Firebase API key is missing!');
        logger.warn('💡 Add to EAS secrets: eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value YOUR_KEY');
      }
      firebaseKeyValidated = false;
    } else {
      // ELITE: Warning - API key format is invalid
      if (__DEV__) {
        const logger = createLogger('FirebaseConfig');
        logger.warn(`⚠️ [FirebaseConfig] Firebase API key format may be invalid (expected AIzaSy... prefix)`);
      }
      firebaseKeyValidated = false;
    }

    return firebaseApiKeyCache ?? ''; // ELITE: Ensure non-null return
  } catch (error: unknown) {
    // CRITICAL: Graceful degradation - return development key if Constants fails to load
    if (__DEV__) {
      const logger = createLogger('FirebaseConfig');
      logger.warn('[FirebaseConfig] Failed to load Constants, using development fallback:', getErrorMessage(error));
    }
    firebaseApiKeyCache = ''; // ELITE SECURITY: No hardcoded fallback
    firebaseKeyValidated = false;
    return firebaseApiKeyCache;
  }
}

// ============================================================================
// CONFIG CACHE
// ============================================================================
let firebaseConfigCache: {
  ios: {
    apiKey: string;
    projectId: string;
    messagingSenderId: string;
    appId: string;
    storageBucket: string;
  };
  android: {
    apiKey: string;
    projectId: string;
    messagingSenderId: string;
    appId: string;
    storageBucket: string;
  };
} | null = null;

function getFirebaseConfig() {
  if (firebaseConfigCache) {
    return firebaseConfigCache;
  }

  const apiKey = getFirebaseApiKey();
  firebaseConfigCache = {
    ios: {
      apiKey,
      projectId: 'afetnet-4a6b6',
      messagingSenderId: '702394557087',
      appId: '1:702394557087:ios:c73ce04083a4e97a0578aa',
      storageBucket: 'afetnet-4a6b6.firebasestorage.app',
    },
    android: {
      apiKey,
      projectId: 'afetnet-4a6b6',
      messagingSenderId: '702394557087',
      appId: '1:702394557087:android:9ed05aa80fa2afda0578aa',
      storageBucket: 'afetnet-4a6b6.firebasestorage.app',
    },
  };

  return firebaseConfigCache;
}

// ============================================================================
// PROXY EXPORT - LAZY LOADING
// ============================================================================
// CRITICAL: Export as Proxy to prevent module loading errors
// Use a Proxy to lazily load config when properties are accessed
export const FIREBASE_CONFIG = new Proxy({} as ReturnType<typeof getFirebaseConfig>, {
  get(_target, prop: string) {
    try {
      const config = getFirebaseConfig();
      if (config && typeof config === 'object') {
        const value = (config as any)[prop];
        // Return undefined if property doesn't exist (instead of throwing)
        // This prevents "Cannot read property 'default' of undefined" errors
        return value !== undefined ? value : undefined;
      }
      return undefined;
    } catch (error) {
      // CRITICAL: Graceful degradation - return undefined instead of throwing
      if (__DEV__) {
        const logger = createLogger('FirebaseConfig');
        logger.warn('[FirebaseConfig] Error accessing config property:', prop, error);
      }
      return undefined;
    }
  },
  // CRITICAL: Prevent setting properties
  set() {
    if (__DEV__) {
      const logger = createLogger('FirebaseConfig');
      logger.warn('[FirebaseConfig] Attempted to set config property - config is read-only');
    }
    return false;
  },
});

export const BUNDLE_ID = 'com.gokhancamci.afetnetapp';

export async function getFirebaseAppAsync() {
  try {
    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const apps = getApps();
    if (apps.length > 0) {
      return getApp();
    }
    const config = getFirebaseConfig();
    return initializeApp(config.ios); // Default to iOS config for now, or detect platform
  } catch (error) {
    const logger = createLogger('FirebaseConfig');
    logger.error('Failed to initialize Firebase app:', error);
    return null;
  }
}
