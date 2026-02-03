import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { createLogger } from './logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const logger = createLogger('Device');

const DEVICE_ID_KEY = 'afetnet_device_id';
const ASYNC_STORAGE_KEY = '@afetnet:device_id'; // Compatibility with Background Task

/**
 * Get or generate device ID
 * Stored securely and persists across app launches
 */
export async function getDeviceId(): Promise<string> {
  try {
    // 1. Try SecureStore (Primary)
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);

    // 2. Try AsyncStorage (Fallback/Background Compat)
    if (!deviceId) {
      deviceId = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
      // If found here but not in SecureStore, migrate it up
      if (deviceId) {
        await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      }
    }

    if (deviceId) {
      return deviceId;
    }

    // Generate new ID
    const uuid = await Crypto.randomUUID();
    deviceId = `AFN-${uuid.slice(0, 8)}`;

    // Store in both
    await setDeviceId(deviceId);

    return deviceId;
  } catch (error) {
    logger.error('Error getting device ID:', error);
    // Fallback to random ID (not persisted)
    return `AFN-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Manually set the Device ID (e.g. link to User Account)
 */
export async function setDeviceId(id: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    await AsyncStorage.setItem(ASYNC_STORAGE_KEY, id);
    logger.info(`Device ID updated to: ${id}`);
  } catch (error) {
    logger.error('Error setting device ID:', error);
  }
}

/**
 * Clear device ID (for testing)
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
    await AsyncStorage.removeItem(ASYNC_STORAGE_KEY);
  } catch (error) {
    logger.error('Error clearing device ID:', error);
  }
}

