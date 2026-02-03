/**
 * SECURE KEY MANAGER - ELITE EDITION
 * Centralized secure storage for API keys and sensitive data
 * 
 * Uses expo-secure-store for encrypted storage with fallback to memory.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';

const logger = createLogger('SecureKeyManager');

// Key identifiers
export const SecureKeys = {
  FIREBASE_API_KEY: 'afetnet_firebase_api_key',
  OPENAI_API_KEY: 'afetnet_openai_api_key',
  GOOGLE_CLIENT_ID: 'afetnet_google_client_id',
  FCM_TOKEN: 'afetnet_fcm_token',
  AUTH_TOKEN: 'afetnet_auth_token',
  REFRESH_TOKEN: 'afetnet_refresh_token',
  USER_ID: 'afetnet_user_id',
} as const;

export type SecureKeyName = keyof typeof SecureKeys;

// In-memory fallback cache (for when SecureStore unavailable)
const memoryCache = new Map<string, string>();

// SecureStore availability flag
let secureStoreAvailable: boolean | null = null;

/**
 * ELITE: Check if SecureStore is available
 */
async function checkSecureStoreAvailable(): Promise<boolean> {
  if (secureStoreAvailable !== null) {
    return secureStoreAvailable;
  }

  try {
    // Test write and read
    const testKey = '_afetnet_test_key_';
    const testValue = Date.now().toString();

    await SecureStore.setItemAsync(testKey, testValue);
    const readValue = await SecureStore.getItemAsync(testKey);
    await SecureStore.deleteItemAsync(testKey);

    secureStoreAvailable = readValue === testValue;

    if (__DEV__) {
      logger.debug(`SecureStore available: ${secureStoreAvailable}`);
    }

    return secureStoreAvailable;
  } catch (error) {
    secureStoreAvailable = false;
    logger.warn('SecureStore not available, using memory fallback');
    return false;
  }
}

/**
 * ELITE: Get SecureStore options based on platform
 */
function getStoreOptions(): SecureStore.SecureStoreOptions {
  const options: SecureStore.SecureStoreOptions = {};

  if (Platform.OS === 'ios') {
    // Use keychain with app-level security
    options.keychainAccessible = SecureStore.WHEN_UNLOCKED;
  }

  return options;
}

/**
 * ELITE: Store a secure value
 */
export async function setSecureValue(
  keyName: SecureKeyName,
  value: string,
): Promise<boolean> {
  const key = SecureKeys[keyName];

  try {
    const available = await checkSecureStoreAvailable();

    if (available) {
      await SecureStore.setItemAsync(key, value, getStoreOptions());
    } else {
      // Fallback to memory (not persisted, but still works for session)
      memoryCache.set(key, value);
    }

    return true;
  } catch (error) {
    logger.error(`Failed to store ${keyName}:`, error);

    // Try memory fallback
    memoryCache.set(key, value);
    return false;
  }
}

/**
 * ELITE: Get a secure value
 */
export async function getSecureValue(
  keyName: SecureKeyName,
): Promise<string | null> {
  const key = SecureKeys[keyName];

  try {
    const available = await checkSecureStoreAvailable();

    if (available) {
      const value = await SecureStore.getItemAsync(key, getStoreOptions());

      // If not in SecureStore, check memory cache
      if (!value) {
        return memoryCache.get(key) || null;
      }

      return value;
    } else {
      // Use memory cache
      return memoryCache.get(key) || null;
    }
  } catch (error) {
    logger.error(`Failed to get ${keyName}:`, error);

    // Try memory fallback
    return memoryCache.get(key) || null;
  }
}

/**
 * ELITE: Delete a secure value
 */
export async function deleteSecureValue(
  keyName: SecureKeyName,
): Promise<boolean> {
  const key = SecureKeys[keyName];

  try {
    const available = await checkSecureStoreAvailable();

    if (available) {
      await SecureStore.deleteItemAsync(key, getStoreOptions());
    }

    // Also clear from memory cache
    memoryCache.delete(key);

    return true;
  } catch (error) {
    logger.error(`Failed to delete ${keyName}:`, error);

    // Clear from memory anyway
    memoryCache.delete(key);
    return false;
  }
}

/**
 * ELITE: Clear all secure values (for logout)
 */
export async function clearAllSecureValues(): Promise<void> {
  const allKeys = Object.values(SecureKeys);

  for (const key of allKeys) {
    try {
      const available = await checkSecureStoreAvailable();

      if (available) {
        await SecureStore.deleteItemAsync(key, getStoreOptions());
      }
    } catch (error) {
      // Continue clearing other keys
      logger.debug(`Failed to clear ${key}:`, error);
    }
  }

  // Clear memory cache
  memoryCache.clear();

  logger.info('🔐 All secure values cleared');
}

/**
 * ELITE: Check if a key exists
 */
export async function hasSecureValue(
  keyName: SecureKeyName,
): Promise<boolean> {
  const value = await getSecureValue(keyName);
  return value !== null && value.length > 0;
}

/**
 * ELITE: Store auth tokens securely
 */
export async function storeAuthTokens(
  accessToken: string,
  refreshToken?: string,
): Promise<void> {
  await setSecureValue('AUTH_TOKEN', accessToken);

  if (refreshToken) {
    await setSecureValue('REFRESH_TOKEN', refreshToken);
  }
}

/**
 * ELITE: Get auth tokens
 */
export async function getAuthTokens(): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    getSecureValue('AUTH_TOKEN'),
    getSecureValue('REFRESH_TOKEN'),
  ]);

  return { accessToken, refreshToken };
}

/**
 * ELITE: Clear auth tokens (for logout)
 */
export async function clearAuthTokens(): Promise<void> {
  await Promise.all([
    deleteSecureValue('AUTH_TOKEN'),
    deleteSecureValue('REFRESH_TOKEN'),
    deleteSecureValue('USER_ID'),
  ]);
}
