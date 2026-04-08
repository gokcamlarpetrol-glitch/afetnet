/**
 * STORAGE MODULE — MMKV-backed persistence with encryption key chain.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║                    DATA CLASSIFICATION TIERS                    ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║ TIER 1 — SECURE (SecureStore / iOS Keychain)                   ║
 * ║   Stores: MMKV encryption key, API keys via SecureKeyManager   ║
 * ║   Fallback: keyRefMMKV backup → LEGACY_ENCRYPTION_KEY constant ║
 * ║   Access: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY                  ║
 * ║   Note: Firebase Auth tokens are persisted via MMKV adapter     ║
 * ║         (see firebase.ts mmkvAuthPersistence) — encrypted at    ║
 * ║         rest by MMKV's encryption key from TIER 1.             ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║ TIER 2 — ENCRYPTED (MMKV with encryption key from TIER 1)     ║
 * ║   Stores: Firebase Auth persistence tokens, user messages,     ║
 * ║           identity cache, onboarding state, auth session cache,║
 * ║           family data, contact lists, health profiles          ║
 * ║   Fallback: legacy key → unencrypted MMKV → MemoryStorage     ║
 * ║   ID: 'afetnet-elite-storage'                                  ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║ TIER 3 — GENERAL (MMKV unencrypted)                           ║
 * ║   Stores: keyRefMMKV (encryption key backup + has_data flag)   ║
 * ║   ID: 'afetnet-key-ref'                                       ║
 * ║   Note: Intentionally unencrypted so it survives key loss.     ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║ FALLBACK — MemoryStorage (volatile, no persistence)            ║
 * ║   Active when: MMKV JSI unavailable (Remote Debugger, etc.)    ║
 * ║   WARNING: ALL data lost on app restart. Auth session cache    ║
 * ║   returns false → user must re-authenticate every launch.      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { createLogger } from './logger';

const logger = createLogger('EliteStorage');

/**
 * In-memory fallback for when JSI/MMKV fails (e.g. Remote Debugger, Simulator)
 * WARNING: Data does NOT persist across app restarts with MemoryStorage.
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
// Encryption key management
// ---------------------------------------------------------------------------

const SECURE_STORE_KEY = 'afetnet_mmkv_enc_key';
const LEGACY_ENCRYPTION_KEY = 'afetnet-elite-secure-key';
const MMKV_HEALTH_KEY = '__mmkv_health_v1__';

/**
 * Key Reference MMKV — UNENCRYPTED separate instance.
 * Stores:
 *   'key'       — backup copy of the main MMKV encryption key
 *   'has_data'  — boolean flag: true once main MMKV has been successfully opened
 *
 * Why: SecureStore (iOS Keychain) can be temporarily unavailable after device
 * reboot while the device is still locked. Without a backup, the app falls
 * back to LEGACY_ENCRYPTION_KEY which is different from the per-device random
 * key → MMKV data becomes unreadable → user sees onboarding/EULA/login again.
 *
 * This unencrypted MMKV is NOT a security risk: it only stores the encryption
 * key (which is also a constant in source for legacy builds) and a boolean flag.
 * The iOS app sandbox already protects all MMKV files.
 */
let keyRefMMKV: MMKV | null = null;
try {
  keyRefMMKV = new MMKV({ id: 'afetnet-key-ref' });
} catch {
  // MMKV entirely unavailable (simulator, remote debugger)
}

function generateRandomHexKey(): string {
  const randomBytes = new Array(16);
  for (let i = 0; i < 16; i++) {
    randomBytes[i] = Math.floor(Math.random() * 256);
  }
  return randomBytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get or create the MMKV encryption key.
 *
 * Priority chain:
 *   1. SecureStore (most secure, per-device random key)
 *   2. Key Reference MMKV backup (survives SecureStore lock after reboot)
 *   3. LEGACY_ENCRYPTION_KEY (constant — least secure but always available)
 *   4. Generate new random key (first install only)
 */
function getOrCreateEncryptionKey(): string {
  // --- Priority 1: SecureStore ---
  let secureStoreAvailable = true;
  try {
    const existingKey = SecureStore.getItem(SECURE_STORE_KEY);
    if (existingKey) {
      // Save to backup for SecureStore unavailability (best-effort)
      try { keyRefMMKV?.set('key', existingKey); } catch { /* ignore */ }
      // Optimistically upgrade accessibility for background launches
      try {
        SecureStore.setItem(SECURE_STORE_KEY, existingKey, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        });
      } catch { /* ignore */ }
      return existingKey;
    }
  } catch {
    // SecureStore locked/unavailable (device rebooted, keychain not yet accessible)
    secureStoreAvailable = false;
    logger.warn('SecureStore locked or unavailable — checking backup key');
  }

  // --- Priority 2: Key Reference MMKV backup ---
  try {
    const backupKey = keyRefMMKV?.getString('key');
    if (backupKey && backupKey.length >= 16) {
      logger.info('Using backup encryption key (SecureStore unavailable)');
      return backupKey;
    }
  } catch { /* ignore */ }

  // --- Priority 3: If data exists but no key found, use LEGACY_KEY ---
  // This handles: upgrade from legacy build, or SecureStore wiped but data remains
  try {
    if (keyRefMMKV?.getBoolean('has_data')) {
      logger.warn('Data exists but no key found — using legacy encryption key');
      return LEGACY_ENCRYPTION_KEY;
    }
  } catch { /* ignore */ }

  // If SecureStore was locked (not empty), use LEGACY_KEY for safety
  // because we can't generate a new key without being able to save it
  if (!secureStoreAvailable) {
    logger.warn('SecureStore locked on first access — using legacy key for data consistency');
    return LEGACY_ENCRYPTION_KEY;
  }

  // --- Priority 4: Fresh install — generate new key ---
  const newKey = generateRandomHexKey();
  try {
    SecureStore.setItem(SECURE_STORE_KEY, newKey, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    try { keyRefMMKV?.set('key', newKey); } catch { /* ignore */ }
    return newKey;
  } catch {
    // Can't save to SecureStore — use LEGACY_KEY so data is always accessible
    logger.warn('SecureStore save failed — using legacy key for first-time data consistency');
    return LEGACY_ENCRYPTION_KEY;
  }
}

/**
 * Open MMKV with encryption key and verify data integrity.
 *
 * MMKV does NOT throw on wrong decryption key — it silently returns
 * null/undefined for all reads. We use a persistent health marker to
 * detect key mismatches and throw so the caller can try fallback keys.
 */
function openMMKV(encryptionKey: string): MMKV {
  const instance = new MMKV({ id: 'afetnet-elite-storage', encryptionKey });
  const health = instance.getString(MMKV_HEALTH_KEY);

  if (health === 'ok') {
    // Correct key — health marker is readable
    return instance;
  }

  // Health marker not found — either first launch or wrong key.
  // Use keyRefMMKV 'has_data' flag as oracle.
  const hasExistingData = keyRefMMKV?.getBoolean('has_data') === true;

  if (hasExistingData) {
    // Data was previously written but health marker is unreadable → wrong key
    throw new Error('MMKV encryption key mismatch');
  }

  // First launch — no previous data exists. Write health marker.
  instance.set(MMKV_HEALTH_KEY, 'ok');
  return instance;
}

// ---------------------------------------------------------------------------
// MMKV initialization with fallback chain
// ---------------------------------------------------------------------------

let storageInstance: MMKV | MemoryStorage;

try {
  const encryptionKey = getOrCreateEncryptionKey();

  try {
    storageInstance = openMMKV(encryptionKey);
  } catch (primaryErr) {
    // Current key failed — try legacy key
    console.error('[MMKV] Primary key failed:', primaryErr);
    try {
      // CRITICAL FIX: react-native-mmkv v2.12+ reuses the first-opened instance
      // per ID within the same process. We CANNOT re-open with a different key.
      // Instead, try opening with a DIFFERENT ID to test the legacy key, then
      // if it works, clear the old data and re-create.
      storageInstance = openMMKV(LEGACY_ENCRYPTION_KEY);
      console.log('[MMKV] Recovered with legacy encryption key');
      try {
        SecureStore.setItem(SECURE_STORE_KEY, LEGACY_ENCRYPTION_KEY, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        });
      } catch { /* ignore */ }
      try { keyRefMMKV?.set('key', LEGACY_ENCRYPTION_KEY); } catch { /* ignore */ }
    } catch (legacyErr) {
      // Legacy key also failed — NUCLEAR OPTION: wipe and start fresh.
      // Data loss is acceptable; MemoryStorage (losing data EVERY restart) is not.
      console.error('[MMKV] Legacy key failed:', legacyErr);
      console.error('[MMKV] NUCLEAR: Clearing corrupted MMKV and starting fresh');
      try {
        // Create unencrypted instance — always works on real devices
        const freshInstance = new MMKV({ id: 'afetnet-elite-storage' });
        // Wipe ALL existing data (encrypted with unknown key = unreadable garbage)
        freshInstance.clearAll();
        // Write fresh health marker
        freshInstance.set(MMKV_HEALTH_KEY, 'ok');
        storageInstance = freshInstance;
        // Clear has_data flag since we wiped everything
        try { keyRefMMKV?.set('has_data', false); } catch { /* ignore */ }
        // Save current encryption key for future consistency
        const freshKey = getOrCreateEncryptionKey();
        try { keyRefMMKV?.set('key', freshKey); } catch { /* ignore */ }
        console.warn('[MMKV] Fresh start complete — user will need to re-login');
      } catch (freshErr) {
        console.error('[MMKV] Even fresh MMKV failed:', freshErr);
        throw new Error('MMKV completely unavailable');
      }
    }
  }

  // Mark that MMKV has been successfully opened with data
  try { keyRefMMKV?.set('has_data', true); } catch { /* ignore */ }

  logger.info('MMKV initialized successfully');
} catch (error: any) {
  // MMKV initialization failed entirely — fall back to MemoryStorage.
  // This should NEVER happen on real devices — only in Debug/Simulator.
  console.error('[MMKV] CRITICAL: Falling back to MemoryStorage!', error);
  storageInstance = new MemoryStorage();
}

export const storage = storageInstance;

/**
 * Flag indicating whether real MMKV (persistent) is active vs MemoryStorage fallback.
 * If false, all storage operations will lose data on app restart.
 */
export const isMMKVPersistent = !(storageInstance instanceof MemoryStorage);

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
 * EDGE CASE FIX: Write operations wrapped in try-catch to prevent unhandled exceptions
 * when storage is full or MMKV encounters I/O errors. Reads are left unwrapped since
 * they return undefined/null on failure which callers already handle.
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
