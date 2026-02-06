/**
 * ENVIRONMENT CONFIGURATION - ELITE SECURITY
 * Centralized environment variable access with validation
 * PRODUCTION-READY: Secure key management with comprehensive fallbacks
 */

import Constants from 'expo-constants';
import { createLogger } from '../utils/logger';

const logger = createLogger('EnvConfig');

// ELITE: Track which keys are missing for better debugging
const missingKeys = new Set<string>();
const warnedKeys = new Set<string>();

/**
 * ELITE: Get environment variable from multiple sources with validation
 * Priority: EAS Secrets (Constants.expoConfig.extra) > process.env > default
 */
function getEnvVar(key: string, defaultValue: string = ''): string {
  // ELITE: Try Constants.expoConfig.extra first (EAS secrets are here)
  const fromExtra = Constants.expoConfig?.extra?.[key];
  if (fromExtra && String(fromExtra).trim().length > 0) {
    // ELITE: Mark key as found if it was missing before
    if (missingKeys.has(key)) {
      missingKeys.delete(key);
      if (__DEV__ && !warnedKeys.has(key)) {
        logger.info(`✅ [ENV] ${key} found in EAS secrets`);
        warnedKeys.add(key);
      }
    }
    return String(fromExtra).trim();
  }

  // ELITE: Try process.env
  const fromProcess = (process.env as any)[key];
  if (fromProcess && String(fromProcess).trim().length > 0) {
    if (missingKeys.has(key)) {
      missingKeys.delete(key);
      if (__DEV__ && !warnedKeys.has(key)) {
        logger.info(`✅ [ENV] ${key} found in process.env`);
        warnedKeys.add(key);
      }
    }
    return String(fromProcess).trim();
  }

  // ELITE: Track missing critical keys
  if (defaultValue === '' && !missingKeys.has(key) && !warnedKeys.has(key)) {
    missingKeys.add(key);
    if (__DEV__) {
      // Only warn for critical keys (API keys, secrets) - exclude deprecated ones
      const isCritical = (key.includes('KEY') || key.includes('SECRET') || key.includes('API'))
        && !key.includes('API_BASE_URL'); // API_BASE_URL is deprecated - Firebase used instead
      if (isCritical) {
        logger.warn(`⚠️ [ENV] ${key} not found - using default value. Add to EAS secrets for production.`);
      }
      warnedKeys.add(key);
    }
  }

  // Return default
  return defaultValue;
}

/**
 * ELITE: Validate API key format
 */
function validateApiKey(key: string, keyName: string, expectedPrefix?: string): boolean {
  if (!key || key.trim().length === 0) {
    if (__DEV__) {
      logger.warn(`⚠️ [ENV] ${keyName} is empty`);
    }
    return false;
  }

  if (expectedPrefix && !key.startsWith(expectedPrefix)) {
    if (__DEV__) {
      logger.warn(`⚠️ [ENV] ${keyName} does not start with expected prefix: ${expectedPrefix}`);
    }
    return false;
  }

  return true;
}

export const ENV = {
  // Firebase - ELITE SECURITY
  // PRODUCTION: Set via EAS secrets (EXPO_PUBLIC_FIREBASE_API_KEY)
  // DEVELOPMENT: Fallback key provided for local testing
  FIREBASE_API_KEY: getEnvVar('EXPO_PUBLIC_FIREBASE_API_KEY') ||
    getEnvVar('FIREBASE_API_KEY', ''),
  FIREBASE_PROJECT_ID: getEnvVar('FIREBASE_PROJECT_ID', 'afetnet-4a6b6'),

  // OpenAI - ELITE SECURITY
  // PRODUCTION: Set via EAS secrets (EXPO_PUBLIC_OPENAI_API_KEY)
  // DEVELOPMENT: Set in .env file
  OPENAI_API_KEY: getEnvVar('EXPO_PUBLIC_OPENAI_API_KEY', ''),

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
  PRIVACY_POLICY_URL: getEnvVar('PRIVACY_POLICY_URL', 'https://raw.githubusercontent.com/gokcamlarpetrol-glitch/afetnet/main/docs/privacy-policy.html'),
  TERMS_OF_SERVICE_URL: getEnvVar('TERMS_OF_SERVICE_URL', 'https://raw.githubusercontent.com/gokcamlarpetrol-glitch/afetnet/main/docs/terms-of-service.html'),
  SUPPORT_EMAIL: getEnvVar('SUPPORT_EMAIL', 'support@afetnet.app'),

  // Backend API - DEPRECATED: Using Firebase instead
  // Render backend was suspended, Firebase handles all backend needs
  API_BASE_URL: getEnvVar('API_BASE_URL', ''),

  // EEW WebSocket URLs
  EEW_WS_TR_PRIMARY: getEnvVar('EEW_WS_TR_PRIMARY', 'wss://eew.afad.gov.tr/ws'),
  EEW_WS_TR_FALLBACK: getEnvVar('EEW_WS_TR_FALLBACK', 'wss://eew.kandilli.org/ws'),
  EEW_WS_GLOBAL_PRIMARY: getEnvVar('EEW_WS_GLOBAL_PRIMARY', 'wss://earthquake.usgs.gov/ws/eew'),
  EEW_PROXY_WS: getEnvVar('EEW_PROXY_WS', ''), // DEPRECATED: Using polling mode

  // Map Tiles
  MAP_TILE_URL: getEnvVar('MAP_TILE_URL', 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
};
