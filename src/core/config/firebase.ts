/**
 * FIREBASE CONFIGURATION
 * Firebase config for push notifications and analytics
 * 
 * GÜVENLIK: API key'ler .env dosyasından okunur
 * ASLA hardcoded key kullanma!
 */

import { ENV } from './env';

export const FIREBASE_CONFIG = {
  ios: {
    apiKey: ENV.FIREBASE_API_KEY,
    projectId: ENV.FIREBASE_PROJECT_ID,
    messagingSenderId: '702394557087',
    appId: '1:702394557087:ios:c73ce04083a4e97a0578aa',
    storageBucket: `${ENV.FIREBASE_PROJECT_ID}.firebasestorage.app`,
  },
  android: {
    apiKey: ENV.FIREBASE_API_KEY,
    projectId: ENV.FIREBASE_PROJECT_ID,
    messagingSenderId: '702394557087',
    appId: '1:702394557087:android:YOUR_ANDROID_APP_ID',
    storageBucket: `${ENV.FIREBASE_PROJECT_ID}.firebasestorage.app`,
  },
};

export const BUNDLE_ID = ENV.BUNDLE_ID;

