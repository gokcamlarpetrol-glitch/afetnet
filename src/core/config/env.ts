/**
 * ENVIRONMENT CONFIGURATION
 * Centralized environment variable access
 */

import Constants from 'expo-constants';

// Helper to get env var from multiple sources
function getEnvVar(key: string, defaultValue: string = ''): string {
  // Try Constants.expoConfig.extra first
  const fromExtra = Constants.expoConfig?.extra?.[key];
  if (fromExtra) return String(fromExtra);
  
  // Try process.env
  const fromProcess = (process.env as any)[key];
  if (fromProcess) return String(fromProcess);
  
  // Return default
  return defaultValue;
}

export const ENV = {
  // OpenAI (GÜVENLIK: Asla default değer verme, sadece .env'den oku)
  OPENAI_API_KEY: getEnvVar('EXPO_PUBLIC_OPENAI_API_KEY', ''),
  
  // RevenueCat (GÜVENLIK: Asla default değer verme, sadece .env'den oku)
  RC_IOS_KEY: getEnvVar('RC_IOS_KEY', ''),
  RC_ANDROID_KEY: getEnvVar('RC_ANDROID_KEY', ''),
  
  // Firebase (GÜVENLIK: Asla default değer verme, sadece .env'den oku)
  FIREBASE_API_KEY: getEnvVar('FIREBASE_API_KEY', ''),
  FIREBASE_PROJECT_ID: getEnvVar('FIREBASE_PROJECT_ID', ''),
  
  // EAS
  EAS_PROJECT_ID: getEnvVar('EAS_PROJECT_ID', '072f1217-172a-40ce-af23-3fc0ad3f7f09'),
  
  // App
  APP_NAME: getEnvVar('APP_NAME', 'AfetNet'),
  APP_VERSION: getEnvVar('APP_VERSION', '1.0.2'),
  BUNDLE_ID: getEnvVar('BUNDLE_ID', 'com.gokhancamci.afetnetapp'),
  
  // Feature Flags
  EEW_ENABLED: getEnvVar('EEW_ENABLED', 'false') === 'true',
  EEW_NATIVE_ALARM: getEnvVar('EEW_NATIVE_ALARM', 'false') === 'true',
  
  // URLs
  PRIVACY_POLICY_URL: getEnvVar('PRIVACY_POLICY_URL', 'https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html'),
  TERMS_OF_SERVICE_URL: getEnvVar('TERMS_OF_SERVICE_URL', 'https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html'),
  SUPPORT_EMAIL: getEnvVar('SUPPORT_EMAIL', 'support@afetnet.app'),
  
  // Backend API
  API_BASE_URL: getEnvVar('API_BASE_URL', 'https://afetnet-backend.onrender.com'),
  
  // Backend Worker Secret (GÜVENLIK: Asla default değer verme, sadece .env'den oku)
  ORG_SECRET: getEnvVar('ORG_SECRET', ''),
  
  // EEW WebSocket URLs
  EEW_WS_TR_PRIMARY: getEnvVar('EEW_WS_TR_PRIMARY', 'wss://eew.afad.gov.tr/ws'),
  EEW_WS_TR_FALLBACK: getEnvVar('EEW_WS_TR_FALLBACK', 'wss://eew.kandilli.org/ws'),
  EEW_WS_GLOBAL_PRIMARY: getEnvVar('EEW_WS_GLOBAL_PRIMARY', 'wss://earthquake.usgs.gov/ws/eew'),
  EEW_PROXY_WS: getEnvVar('EEW_PROXY_WS', 'wss://afetnet-backend.onrender.com/eew'),
  
  // Map Tiles
  MAP_TILE_URL: getEnvVar('MAP_TILE_URL', 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
};

