/**
 * DEVICE UTILITIES
 * Device ID generation and management
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { createLogger } from './logger';

const logger = createLogger('Device');

const DEVICE_ID_KEY = 'afetnet_device_id';

/**
 * Get or generate device ID
 * Stored securely and persists across app launches
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Try to get existing ID
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }

    // Generate new ID
    const uuid = await Crypto.randomUUID();
    const deviceId = `AFN-${uuid.slice(0, 8)}`;

    // Store securely
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);

    return deviceId;
  } catch (error) {
    logger.error('Error getting device ID:', error);
    // Fallback to random ID (not persisted)
    return `AFN-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Clear device ID (for testing)
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
  } catch (error) {
    logger.error('Error clearing device ID:', error);
  }
}

