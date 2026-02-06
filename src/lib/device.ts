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
const LEGACY_SECURE_DEVICE_ID_KEY = 'afetnet_device_id';
const LEGACY_ASYNC_DEVICE_ID_KEY = '@afetnet:device_id';

// Cache device ID in memory
let cachedDeviceId: string | null = null;

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

/**
 * Generate AfetNet device ID format: AFN-XXXXXXXX (12 chars)
 * ELITE SECURITY: Matches AuthService QR ID format
 * CRITICAL: Must use AFN- (uppercase) to match core/utils/device.ts
 */
async function generateDeviceId(): Promise<string> {
  try {
    const randomBytes = await Crypto.getRandomBytesAsync(4); // 4 bytes = 32 bits = 8 hex chars
    const hex = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `AFN-${hex}`.toUpperCase();
  } catch (error) {
    // Fallback: use timestamp + random math
    const timestamp = Date.now().toString(16).slice(-4);
    const random = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
    return `AFN-${timestamp}${random}`.toUpperCase();
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
        const normalizedSecureId = normalizeDeviceId(secureId);
        await SecureStore.setItemAsync(DEVICE_ID_KEY, normalizedSecureId);
        await SecureStore.setItemAsync(LEGACY_SECURE_DEVICE_ID_KEY, normalizedSecureId);
        await AsyncStorage.setItem(LEGACY_ASYNC_DEVICE_ID_KEY, normalizedSecureId);
        cachedDeviceId = normalizedSecureId;
        return cachedDeviceId;
      }
    } catch (e) {
      logger.warn('SecureStore access failed, falling back to legacy check', e);
    }

    // 2. Migration: Check Legacy AsyncStorage
    const legacyId = await AsyncStorage.getItem(LEGACY_ASYNC_DEVICE_ID_KEY);
    if (legacyId && isValidDeviceId(legacyId)) {
      const normalizedLegacyId = normalizeDeviceId(legacyId);
      // We found a legacy ID. We should probably keep it to avoid data loss, 
      // OR migrate it to SecureStore. Let's list it as "legacy" but secure it.
      // For "Maximum Security", we might prefer generating a NEW one, 
      // but that breaks existing users. 
      // Strategy: Keep legacy ID, but save it to SecureStore for future.
      await SecureStore.setItemAsync(DEVICE_ID_KEY, normalizedLegacyId);
      await SecureStore.setItemAsync(LEGACY_SECURE_DEVICE_ID_KEY, normalizedLegacyId);
      await AsyncStorage.setItem(LEGACY_ASYNC_DEVICE_ID_KEY, normalizedLegacyId);
      cachedDeviceId = normalizedLegacyId;
      return normalizedLegacyId;
    }

    // 3. Generate NEW High-Entropy ID
    const newId = await generateDeviceId();

    // Save to Vault
    await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
    await SecureStore.setItemAsync(LEGACY_SECURE_DEVICE_ID_KEY, newId);
    // Also save to legacy storage for backward compat if needed (optional)
    await AsyncStorage.setItem(LEGACY_ASYNC_DEVICE_ID_KEY, newId);

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
 * Format: AFN-XXXXXXXX (12 characters total)
 * CRITICAL: Accepts both AFN- (new) and afn- (legacy) for backward compat
 */
export function isValidDeviceId(deviceId: string | null | undefined): boolean {
  if (!deviceId || typeof deviceId !== 'string') return false;
  // Accept both AFN- (uppercase, new) and afn- (lowercase, legacy)
  return /^[Aa][Ff][Nn]-[a-zA-Z0-9]{8,}$/.test(deviceId);
}

/**
 * Force device ID update and keep in-memory cache consistent.
 */
export async function setDeviceId(deviceId: string): Promise<void> {
  if (!isValidDeviceId(deviceId)) {
    logger.warn('Invalid device ID format, update skipped');
    return;
  }

  const normalized = normalizeDeviceId(deviceId);

  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, normalized);
    await SecureStore.setItemAsync(LEGACY_SECURE_DEVICE_ID_KEY, normalized);
    await AsyncStorage.setItem(LEGACY_ASYNC_DEVICE_ID_KEY, normalized);
    cachedDeviceId = normalized;
  } catch (error) {
    logger.error('Failed to set device ID:', error);
  }
}

/**
 * Clear persistent device identity and cache.
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
    await SecureStore.deleteItemAsync(LEGACY_SECURE_DEVICE_ID_KEY);
    await AsyncStorage.removeItem(LEGACY_ASYNC_DEVICE_ID_KEY);
  } catch (error) {
    logger.error('Failed to clear device ID:', error);
  } finally {
    cachedDeviceId = null;
  }
}

/**
 * Clear only in-memory cache (used for auth/session transitions).
 */
export function resetCachedDeviceId(): void {
  cachedDeviceId = null;
}

export default {
  getDeviceId,
  getDeviceInfo,
  isPhysicalDevice,
  getDeviceType,
  isValidDeviceId,
  setDeviceId,
  clearDeviceId,
  resetCachedDeviceId,
};
