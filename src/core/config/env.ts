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
  // RevenueCat
  RC_IOS_KEY: getEnvVar('RC_IOS_KEY', 'appl_vsaRFDWlxPWReNAOydDuZCGEPUS'),
  RC_ANDROID_KEY: getEnvVar('RC_ANDROID_KEY', 'appl_vsaRFDWlxPWReNAOydDuZCGEPUS'),
  
  // Firebase
  FIREBASE_API_KEY: getEnvVar('FIREBASE_API_KEY', 'AIzaSyBD23B2SEcxs7b3W0iyEISWhquRSbXtotQ'),
  FIREBASE_PROJECT_ID: getEnvVar('FIREBASE_PROJECT_ID', 'afetnet-4a6b6'),
  
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
};

