/**
 * STORAGE MODULE — MMKV-backed persistence (NO ENCRYPTION).
 *
 * WHY NO ENCRYPTION:
 * - iOS app sandbox already protects all app data at filesystem level
 * - MMKV encryption caused persistent data loss bugs:
 *   1. SecureStore key changes on TestFlight reinstall → all data unreadable
 *   2. react-native-mmkv v2.12+ reuses first-opened instance per ID → key
 *      change fallback chain doesn't work
 *   3. Intermittent encrypted data loss after background/kill (GitHub #903)
 * - Every major React Native app (WhatsApp, Telegram, Signal) uses
 *   unencrypted local storage + iOS/Android sandbox protection
 * - Sensitive secrets (API keys) use SecureStore (iOS Keychain) separately
 *
 * STORAGE TIERS:
 * - TIER 1 (SecureStore): API keys, sensitive credentials only
 * - TIER 2 (MMKV unencrypted): Auth cache, messages, settings, all app data
 * - FALLBACK (MemoryStorage): Only if JSI unavailable (should NEVER happen in production)
 */

import { MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';
import { createLogger } from './logger';

const logger = createLogger('Storage');

/**
 * In-memory fallback for when JSI/MMKV fails (e.g. Remote Debugger)
 * WARNING: Data does NOT persist across app restarts.
 */
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

// ---------------------------------------------------------------------------
// MMKV initialization — simple, no encryption
// ---------------------------------------------------------------------------

let storageInstance: MMKV | MemoryStorage;

try {
  // Simple unencrypted MMKV — always works on real devices with JSI
  storageInstance = new MMKV({ id: 'afetnet-storage-v2' });

  // Migrate data from old encrypted instance if it exists
  // This handles upgrade from encrypted → unencrypted
  try {
    const oldInstance = new MMKV({ id: 'afetnet-elite-storage' });
    const oldKeys = oldInstance.getAllKeys();
    if (oldKeys.length > 0 && !storageInstance.contains('__migrated_from_encrypted__')) {
      // Old encrypted data may be unreadable (wrong key), but try anyway
      let migrated = 0;
      for (const key of oldKeys) {
        try {
          const val = oldInstance.getString(key);
          if (val !== undefined && !storageInstance.contains(key)) {
            storageInstance.set(key, val);
            migrated++;
          }
        } catch { /* skip unreadable keys */ }
      }
      storageInstance.set('__migrated_from_encrypted__', 'true');
      if (migrated > 0) {
        console.log(`[Storage] Migrated ${migrated} keys from old encrypted storage`);
      }
    }
  } catch { /* old instance doesn't exist or can't be opened — fine */ }

  console.log('[Storage] MMKV initialized successfully (unencrypted, persistent)');
} catch (error: any) {
  // MMKV initialization failed — JSI unavailable (Remote Debugger, etc.)
  console.error('[Storage] CRITICAL: MMKV failed, falling back to MemoryStorage!', error);
  storageInstance = new MemoryStorage();
}

export const storage = storageInstance;

/**
 * Flag indicating whether real MMKV (persistent) is active vs MemoryStorage fallback.
 * If false, all storage operations will lose data on app restart.
 */
export const isMMKVPersistent = !(storageInstance instanceof MemoryStorage);

/**
 * Key Reference MMKV — kept for backward compatibility with firebase.ts auth backup.
 * Now just points to the main storage instance.
 */
export const keyRefMMKV = storageInstance instanceof MemoryStorage ? null : storageInstance;

/**
 * Zustand persist middleware adapter — connects MMKV to Zustand stores.
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
 * Direct Synchronous Access — for high-performance reads outside Zustand middleware.
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
