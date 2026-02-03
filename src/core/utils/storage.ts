import { MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';
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

// ELITE: Typed storage instance - either MMKV or MemoryStorage fallback
let storageInstance: MMKV | MemoryStorage;

try {
  storageInstance = new MMKV({
    id: 'afetnet-elite-storage',
    encryptionKey: 'afetnet-elite-secure-key', // ELITE: Encrypted storage
  });
  logger.info('✅ MMKV initialized successfully');
} catch (error) {
  logger.info('ℹ️ MMKV initialization failed (expected in Debug/Simulator), falling back to MemoryStorage.');
  storageInstance = new MemoryStorage();
}

export const storage = storageInstance;

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
  clearAll: () => storage.clearAll(),
};
