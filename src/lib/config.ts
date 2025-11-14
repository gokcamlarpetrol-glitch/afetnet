/**
 * CONFIG - ELITE CONFIGURATION MANAGEMENT
 * Centralized configuration with validation
 * CRITICAL: Lazy imports to prevent module loading errors
 */

import { load, KEYS } from './secure';

const DEFAULT_API_BASE = 'https://afetnet-backend.onrender.com';

/**
 * Get API base URL with validation
 * @returns Validated API base URL
 */
export async function getApiBase(): Promise<string> {
  // ELITE: Try secure store first, then constants, then default
  const stored = await load(KEYS.api);
  if (stored && typeof stored === 'string' && stored.startsWith('http')) {
    return stored;
  }
  
  // CRITICAL: Lazy load Constants to prevent module loading errors
  try {
    const Constants = require('expo-constants');
    const fromConstants = (Constants.expoConfig?.extra as { apiBase?: string })?.apiBase;
    if (fromConstants && typeof fromConstants === 'string' && fromConstants.startsWith('http')) {
      return fromConstants;
    }
  } catch (error) {
    // CRITICAL: Graceful degradation - continue with default if Constants fails
    if (__DEV__) {
      console.warn('[Config] Failed to load Constants:', error);
    }
  }
  
  // ELITE: Validate default URL
  if (DEFAULT_API_BASE && DEFAULT_API_BASE.startsWith('http')) {
    return DEFAULT_API_BASE;
  }
  
  // ELITE: Fallback should never happen, but log if it does
  if (__DEV__) {
    console.warn('⚠️ No valid API base URL found, using default');
  }
  return DEFAULT_API_BASE;
}

/**
 * Get secret key with validation
 * @returns Secret key or undefined if not found
 */
export async function getSecret(): Promise<string | undefined> {
  const secret = await load(KEYS.secret);
  
  // ELITE: Validate secret is not empty
  if (secret && typeof secret === 'string' && secret.length > 0) {
    return secret;
  }
  
  // ELITE: Return undefined instead of empty string for security
  return undefined;
}
