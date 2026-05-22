/**
 * STORAGE MODULE — MMKV primary, AsyncStorage-backed fallback.
 *
 * STRATEGY:
 * 1. Try MMKV (fast, synchronous via JSI) — works on 99.9% of real devices
 * 2. If MMKV fails → AsyncStorageCache (persistent, slightly slower startup)
 * 3. MemoryStorage NEVER used — no data loss scenario exists
 *
 * WHY THIS MATTERS:
 * Previous builds used MemoryStorage as fallback → ALL data lost on restart
 * → user logged out, onboarding/EULA re-shown. AsyncStorageCache fixes this
 * by loading all keys from AsyncStorage into a Map on startup (synchronous
 * reads after first load) and writing through to AsyncStorage on every set.
 */

import { MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from './logger';

const logger = createLogger('Storage');
type StorageReadyListener = () => void;
type StorageBackend = 'mmkv' | 'async-storage-cache';

const storageReadyListeners = new Set<StorageReadyListener>();
let storageReady = false;
let resolveStorageReady: (() => void) | null = null;
const storageReadyPromise = new Promise<void>((resolve) => {
  resolveStorageReady = resolve;
});

const markStorageReady = () => {
  if (storageReady) return;
  storageReady = true;
  resolveStorageReady?.();
  resolveStorageReady = null;
  for (const listener of storageReadyListeners) {
    try {
      listener();
    } catch (error) {
      logger.error('Storage ready listener failed:', error);
    }
  }
  storageReadyListeners.clear();
};

/**
 * AsyncStorage-backed synchronous cache.
 * Loads all keys into memory on construction, then serves reads from cache.
 * Writes go to both cache AND AsyncStorage (fire-and-forget for speed).
 * This gives synchronous read performance with AsyncStorage persistence.
 */
class AsyncStorageCache {
  private cache = new Map<string, string>();
  private isLoaded = false;
  private mutatedDuringHydration = new Set<string>();

  constructor() {
    // Load all existing data from AsyncStorage synchronously-ish
    // The cache starts empty but hydrates as soon as possible
    this._hydrate();
  }

  private async _hydrate() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      if (keys.length > 0) {
        const pairs = await AsyncStorage.multiGet(keys);
        for (const [key, value] of pairs) {
          if (value !== null && !this.mutatedDuringHydration.has(key)) {
            this.cache.set(key, value);
          }
        }
      }
      this.isLoaded = true;
      this.mutatedDuringHydration.clear();
      // M1-M3: __DEV__ guard — production noise lives in Sentry breadcrumbs,
      // not stdout (perf overhead + log retention cost).
      if (__DEV__) {
        console.log(`[AsyncStorageCache] Hydrated ${this.cache.size} keys from AsyncStorage`);
      }
      markStorageReady();
    } catch (e) {
      // Errors stay unconditional — GlobalErrorHandler routes to Sentry.
      console.error('[AsyncStorageCache] Hydration failed:', e);
      this.isLoaded = true; // Mark as loaded anyway to prevent hanging
      this.mutatedDuringHydration.clear();
      markStorageReady();
    }
  }

  set(key: string, value: boolean | string | number) {
    const strVal = String(value);
    this.cache.set(key, strVal);
    if (!this.isLoaded) this.mutatedDuringHydration.add(key);
    AsyncStorage.setItem(key, strVal).catch(e =>
      console.error(`[AsyncStorageCache] setItem failed: ${key}`, e)
    );
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
    if (!this.isLoaded) this.mutatedDuringHydration.add(key);
    AsyncStorage.removeItem(key).catch(() => {});
  }

  clearAll() {
    const keys = Array.from(this.cache.keys());
    this.cache.clear();
    AsyncStorage.multiRemove(keys).catch(() => {});
  }

  contains(key: string) {
    return this.cache.has(key);
  }

  getAllKeys() {
    return Array.from(this.cache.keys());
  }
}

// ---------------------------------------------------------------------------
// Storage initialization — MMKV primary, AsyncStorageCache fallback
// ---------------------------------------------------------------------------

let storageInstance: MMKV | AsyncStorageCache;
let usingMMKV = false;
let storageBackend: StorageBackend = 'async-storage-cache';

try {
  storageInstance = new MMKV({ id: 'afetnet-storage-v2' });
  usingMMKV = true;
  storageBackend = 'mmkv';
  markStorageReady();
  // M1-M3: __DEV__ guard.
  if (__DEV__) {
    console.log('[Storage] MMKV initialized (fast, persistent)');
  }
} catch (error: any) {
  // MMKV failed — use AsyncStorage-backed cache instead of volatile MemoryStorage.
  // Error stays unconditional — needs to reach Sentry.
  console.error('[Storage] MMKV failed, using AsyncStorageCache fallback (still persistent):', error);
  storageInstance = new AsyncStorageCache();
}

export const storage = storageInstance;
export { storageBackend };

export const isStorageReady = (): boolean => storageReady;

export const waitForStorageReady = (): Promise<void> => (
  storageReady ? Promise.resolve() : storageReadyPromise
);

export const onStorageReady = (listener: StorageReadyListener): (() => void) => {
  if (storageReady) {
    listener();
    return () => {};
  }
  storageReadyListeners.add(listener);
  return () => {
    storageReadyListeners.delete(listener);
  };
};

export const isUsingMMKV = (): boolean => usingMMKV;

/**
 * Flag indicating storage is persistent. NOW ALWAYS TRUE because
 * AsyncStorageCache is persistent (unlike old MemoryStorage fallback).
 */
export const isMMKVPersistent = true;

/**
 * Key Reference — points to main storage instance for backward compatibility.
 */
export const keyRefMMKV = usingMMKV ? (storageInstance as MMKV) : null;

/**
 * Zustand persist middleware adapter.
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
 * Direct Synchronous Access.
 */
export const DirectStorage = {
  getString: (key: string) => storage.getString(key),
  setString: (key: string, value: string) => {
    try { storage.set(key, value); } catch (e) { logger.error(`DirectStorage.setString(${key}) failed:`, e); }
  },
  getNumber: (key: string) => storage.getNumber(key),
  setNumber: (key: string, value: number) => {
    try { storage.set(key, value); } catch (e) { logger.error(`DirectStorage.setNumber(${key}) failed:`, e); }
  },
  getBoolean: (key: string) => storage.getBoolean(key),
  setBoolean: (key: string, value: boolean) => {
    try { storage.set(key, value); } catch (e) { logger.error(`DirectStorage.setBoolean(${key}) failed:`, e); }
  },
  delete: (key: string) => {
    try { storage.delete(key); } catch (e) { logger.error(`DirectStorage.delete(${key}) failed:`, e); }
  },
  contains: (key: string) => storage.contains(key),
  getAllKeys: () => storage.getAllKeys(),
  clearAll: () => {
    try { storage.clearAll(); } catch (e) { logger.error('DirectStorage.clearAll() failed:', e); }
  },
};
