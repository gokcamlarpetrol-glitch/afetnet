/**
 * SECURE STORE - ELITE SECURITY IMPLEMENTATION
 * Secure storage wrapper with proper error handling
 */

import * as SecureStore from 'expo-secure-store';
import { createLogger } from '../core/utils/logger';

const logger = createLogger('SecureStore');

/**
 * Save value to secure store
 * @param key Storage key
 * @param val Value to store
 * @returns Success status
 */
export async function save(key: string, val: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, val);
    return true;
  } catch (error) {
    // ELITE: Log secure store errors but don't crash the app
    logger.warn('SecureStore save failed:', error);
    return false;
  }
}

/**
 * Load value from secure store
 * @param key Storage key
 * @returns Stored value or null if not found/error
 */
export async function load(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    // ELITE: Log secure store errors but don't crash the app
    logger.warn('SecureStore load failed:', error);
    return null;
  }
}

export const KEYS = { api: 'afn:apiBase', secret: 'afn:secret' };



