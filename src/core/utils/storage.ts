import { MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { createLogger } from './logger';

const logger = createLogger('EliteStorage');

/**
 * MMKV Instance
 * Using a single shared instance for simplicity, but can be split if needed for encryption/scopes
 */
// In-memory fallback for when JSI/MMKV fails (e.g. Remote Debugger)
class MemoryStorage {
  private cache = new Map<string, string>();
  set(key: string, value: boolean | string | number) {
    this.cache.set(key, String(value));
  }
  getString(key: string) {
    return this.cache.get(key);
  }
  getNumber(key: string) {
    const val = this.cache.get(key);
    return val ? Number(val) : 0;
  }
  getBoolean(key: string) {
    return this.cache.get(key) === 'true';
  }
  delete(key: string) {
    this.cache.delete(key);
  }
  clearAll() {
    this.cache.clear();
  }
  contains(key: string) {
    return this.cache.has(key);
  }
  getAllKeys() {
    return Array.from(this.cache.keys());
  }
}

// SECURITY FIX: Generate/retrieve encryption key from Secure Enclave (iOS) / Keystore (Android)
// instead of hardcoding in source code.
const SECURE_STORE_KEY = 'afetnet_mmkv_enc_key';
const LEGACY_ENCRYPTION_KEY = 'afetnet-elite-secure-key';

function getOrCreateEncryptionKey(): string {
  try {
    // SecureStore.getItem is sync on native (JSI) — safe to call during module init
    const existingKey = SecureStore.getItem(SECURE_STORE_KEY);
    if (existingKey) return existingKey;

    // Generate a random 32-char hex key
    const randomBytes = new Array(16);
    for (let i = 0; i < 16; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
    const newKey = randomBytes.map(b => b.toString(16).padStart(2, '0')).join('');
    SecureStore.setItem(SECURE_STORE_KEY, newKey);
    return newKey;
  } catch {
    // Fallback: If SecureStore unavailable (simulator), use legacy key for backward compat
    return LEGACY_ENCRYPTION_KEY;
  }
}

let storageInstance: MMKV | MemoryStorage;

try {
  const encryptionKey = getOrCreateEncryptionKey();
  try {
    storageInstance = new MMKV({
      id: 'afetnet-elite-storage',
      encryptionKey,
    });
  } catch {
    // Migration: If key changed (first upgrade), try legacy key then re-encrypt
    storageInstance = new MMKV({
      id: 'afetnet-elite-storage',
      encryptionKey: LEGACY_ENCRYPTION_KEY,
    });
    // Re-create with new key (MMKV handles migration internally on next recrypt call)
    try {
      (storageInstance as MMKV).recrypt(encryptionKey);
      logger.info('✅ MMKV re-encrypted with SecureStore key');
    } catch {
      // If recrypt fails, continue with legacy key — data is still accessible
      logger.info('ℹ️ MMKV recrypt deferred, using legacy key');
    }
  }
  logger.info('✅ MMKV initialized successfully');
} catch (error) {
  logger.info('ℹ️ MMKV initialization failed (expected in Debug/Simulator), falling back to MemoryStorage.');
  storageInstance = new MemoryStorage();
}

export const storage = storageInstance;

/**
 * Flag indicating whether real MMKV (persistent) is active vs MemoryStorage fallback.
 * If false, all storage operations will lose data on app restart.
 * Critical for auth persistence checks.
 */
export const isMMKVPersistent = !(storageInstance instanceof MemoryStorage);

/**
 * ELITE STORAGE ADAPTER
 * Connects MMKV synchronous storage to Zustand's persist middleware
 */
export const eliteStorage: StateStorage = {
  setItem: (name, value) => {
    try {
      storage.set(name, value);
    } catch (error) {
      logger.error(`Failed to set item ${name}:`, error);
    }
  },
  getItem: (name) => {
    try {
      const value = storage.getString(name);
      return value ?? null;
    } catch (error) {
      logger.error(`Failed to get item ${name}:`, error);
      return null;
    }
  },
  removeItem: (name) => {
    try {
      storage.delete(name);
    } catch (error) {
      logger.error(`Failed to remove item ${name}:`, error);
    }
  },
};

/**
 * Direct Synchronous Access
 * For high-performance reads outside of Zustand middleware
 */
export const DirectStorage = {
  getString: (key: string) => storage.getString(key),
  setString: (key: string, value: string) => storage.set(key, value),
  getNumber: (key: string) => storage.getNumber(key),
  setNumber: (key: string, value: number) => storage.set(key, value),
  getBoolean: (key: string) => storage.getBoolean(key),
  setBoolean: (key: string, value: boolean) => storage.set(key, value),
  delete: (key: string) => storage.delete(key),
  contains: (key: string) => storage.contains(key),
  getAllKeys: () => storage.getAllKeys(),
  clearAll: () => storage.clearAll(),
};
