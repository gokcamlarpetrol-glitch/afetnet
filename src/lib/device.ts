/**
 * DEVICE LIB - Elite Device Information
 * Centralized device ID and info management
 */

import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../core/utils/logger';

const logger = createLogger('DeviceLib');

const DEVICE_ID_KEY = 'afetnet_secure_device_id'; // ELITE: New key for new storage

// Cache device ID in memory
let cachedDeviceId: string | null = null;

/**
 * Generate AfetNet device ID format: afn-XXXXXXXXXXXXXXXX (32 chars)
 * ELITE SECURITY: 128-bit entropy
 */
async function generateDeviceId(): Promise<string> {
  try {
    const randomBytes = await Crypto.getRandomBytesAsync(16); // 16 bytes = 128 bits
    const hex = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `afn-${hex}`;
  } catch (error) {
    // Fallback: use timestamp + random math (should rarely happen)
    const timestamp = Date.now().toString(16);
    const random = Math.floor(Math.random() * 1000000000).toString(16);
    return `afn-${timestamp}${random}`.padEnd(36, '0').slice(0, 36);
  }
}

/**
 * Get or create persistent device ID
 */
export async function getDeviceId(): Promise<string> {
  // Return cached value if available
  if (cachedDeviceId) return cachedDeviceId;

  try {
    // 1. Try SecureStore (The Vault)
    try {
      const secureId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (secureId && isValidDeviceId(secureId)) {
        cachedDeviceId = secureId;
        return cachedDeviceId;
      }
    } catch (e) {
      logger.warn('SecureStore access failed, falling back to legacy check', e);
    }

    // 2. Migration: Check Legacy AsyncStorage
    const legacyId = await AsyncStorage.getItem('@afetnet:device_id');
    if (legacyId && legacyId.startsWith('afn-')) {
      // We found a legacy ID. We should probably keep it to avoid data loss, 
      // OR migrate it to SecureStore. Let's list it as "legacy" but secure it.
      // For "Maximum Security", we might prefer generating a NEW one, 
      // but that breaks existing users. 
      // Strategy: Keep legacy ID, but save it to SecureStore for future.
      await SecureStore.setItemAsync(DEVICE_ID_KEY, legacyId);
      cachedDeviceId = legacyId;
      return legacyId;
    }

    // 3. Generate NEW High-Entropy ID
    const newId = await generateDeviceId();

    // Save to Vault
    await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
    // Also save to legacy storage for backward compat if needed (optional)
    await AsyncStorage.setItem('@afetnet:device_id', newId);

    cachedDeviceId = newId;

    if (__DEV__) {
      logger.info('Generated new device ID:', newId);
    }

    return cachedDeviceId;
  } catch (error) {
    logger.error('Device ID error:', error);
    // Fallback: generate temporary ID
    const tempId = await generateDeviceId();
    cachedDeviceId = tempId;
    return tempId;
  }
}

/**
 * Get device information
 */
export function getDeviceInfo() {
  return {
    brand: Device.brand,
    manufacturer: Device.manufacturer,
    modelName: Device.modelName,
    modelId: Device.modelId,
    designName: Device.designName,
    productName: Device.productName,
    deviceYearClass: Device.deviceYearClass,
    totalMemory: Device.totalMemory,
    supportedCpuArchitectures: Device.supportedCpuArchitectures,
    osName: Device.osName,
    osVersion: Device.osVersion,
    osBuildId: Device.osBuildId,
    osInternalBuildId: Device.osInternalBuildId,
    platformApiLevel: Device.platformApiLevel,
    deviceName: Device.deviceName,
    isDevice: Device.isDevice,
  };
}

/**
 * Check if running on physical device
 */
export function isPhysicalDevice(): boolean {
  return Device.isDevice;
}

/**
 * Get device type
 */
export async function getDeviceType(): Promise<Device.DeviceType> {
  return await Device.getDeviceTypeAsync();
}

/**
 * Validate AfetNet device ID format
 * Format: afn-XXXXXXXX (12 characters total)
 */
export function isValidDeviceId(deviceId: string | null | undefined): boolean {
  if (!deviceId || typeof deviceId !== 'string') return false;
  // Allow both Legacy (12 chars) and Elite (36 chars: prefix + 32 hex)
  return /^afn-[a-zA-Z0-9]{8,}$/.test(deviceId);
}

export default {
  getDeviceId,
  getDeviceInfo,
  isPhysicalDevice,
  getDeviceType,
  isValidDeviceId,
};
