/**
 * FIREBASE CONFIGURATION
 * Firebase config for push notifications and analytics
 * SECURITY: API keys loaded from environment variables only
 */

// SECURITY: Load API key from environment variable (REQUIRED - no hardcoded fallback)
const FIREBASE_API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';

if (!FIREBASE_API_KEY && __DEV__) {
  console.warn('⚠️ FIREBASE_API_KEY not found in environment variables. Firebase features may not work.');
}

export const FIREBASE_CONFIG = {
  ios: {
    apiKey: FIREBASE_API_KEY,
    projectId: 'afetnet-4a6b6',
    messagingSenderId: '702394557087',
    appId: '1:702394557087:ios:c73ce04083a4e97a0578aa',
    storageBucket: 'afetnet-4a6b6.firebasestorage.app',
  },
  android: {
    apiKey: FIREBASE_API_KEY,
    projectId: 'afetnet-4a6b6',
    messagingSenderId: '702394557087',
    appId: '1:702394557087:android:9ed05aa80fa2afda0578aa',
    storageBucket: 'afetnet-4a6b6.firebasestorage.app',
  },
};

export const BUNDLE_ID = 'com.gokhancamci.afetnetapp';

