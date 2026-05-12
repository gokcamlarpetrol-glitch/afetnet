/**
 * AUTHORITATIVE SECURITY KEY CLEANUP
 *
 * Single source of truth for ALL user-scoped security keys in AfetNet.
 * Called by: shutdownApp(), AccountDeletionService, AuthService.signOut()
 *
 * INVENTORY OF USER-SCOPED SECURITY KEYS:
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ CryptoService (SecureStore OR DirectStorage, depends on device)    │
 * │   afetnet_crypto_private_key_{uid}    Curve25519 ECDH private key │
 * │   afetnet_crypto_public_key_{uid}     Curve25519 ECDH public key  │
 * │   afetnet_crypto_sign_private_key_{uid}  Ed25519 signing priv key │
 * │   afetnet_crypto_sign_public_key_{uid}   Ed25519 signing pub key  │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ CryptoService (DirectStorage only)                                 │
 * │   @afetnet:crypto_known_keys_v2:{uid}  Known public keys map      │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ MeshCryptoService (SecureStore)                                    │
 * │   @mesh_crypto_private_key_{uid}    Mesh Curve25519 private key   │
 * │   @mesh_crypto_public_key_{uid}     Mesh Curve25519 public key    │
 * │   @mesh_crypto_peer_keys_{uid}      Mesh peer shared secrets      │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ BiometricAuthService (SecureStore)                                 │
 * │   @afetnet:biometric_enabled:{uid}       Biometric on/off         │
 * │   @afetnet:biometric_failed_attempts:{uid}  Failed attempt counter│
 * │   @afetnet:last_biometric_auth:{uid}     Last auth timestamp      │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ SessionSecurityService (SecureStore)                               │
 * │   @afetnet:session_state:{uid}      Session state JSON            │
 * │   @afetnet:session_config:{uid}     Session config JSON           │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ SecureKeyManager (SecureStore, NOT user-scoped but auth-related)   │
 * │   afetnet_auth_token                Auth token                    │
 * │   afetnet_refresh_token             Refresh token                 │
 * │   afetnet_user_id                   User ID                       │
 * │   afetnet_fcm_token                 FCM push token                │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * LEGACY (unscoped "default" keys from pre-scoping era):
 *   afetnet_crypto_private_key_default
 *   afetnet_crypto_public_key_default
 *   afetnet_crypto_sign_private_key_default
 *   afetnet_crypto_sign_public_key_default
 *   @mesh_crypto_private_key_default
 *   @mesh_crypto_public_key_default
 *   @mesh_crypto_peer_keys_default
 *
 * @version 1.0.0
 */

import * as SecureStore from 'expo-secure-store';
import { DirectStorage } from '../../utils/storage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SecurityKeyCleanup');

/**
 * Returns the complete list of security keys to delete for a given user.
 * Both SecureStore and DirectStorage keys are included.
 */
export function getSecurityKeyList(uid: string): {
  secureStore: string[];
  directStorage: string[];
} {
  const secureStore: string[] = [];
  const directStorage: string[] = [];

  // ── CryptoService keys (SecureStore OR DirectStorage — delete from both) ──
  if (uid) {
    secureStore.push(
      `afetnet_crypto_private_key_${uid}`,
      `afetnet_crypto_public_key_${uid}`,
      `afetnet_crypto_sign_private_key_${uid}`,
      `afetnet_crypto_sign_public_key_${uid}`,
    );
    // CryptoService may fall back to DirectStorage when SecureStore is unavailable
    directStorage.push(
      `afetnet_crypto_private_key_${uid}`,
      `afetnet_crypto_public_key_${uid}`,
      `afetnet_crypto_sign_private_key_${uid}`,
      `afetnet_crypto_sign_public_key_${uid}`,
    );
  }

  // ── CryptoService known keys (DirectStorage only) ──
  if (uid) {
    directStorage.push(`@afetnet:crypto_known_keys_v2:${uid}`);
  }

  // ── MeshCryptoService keys (SecureStore) ──
  if (uid) {
    secureStore.push(
      `@mesh_crypto_private_key_${uid}`,
      `@mesh_crypto_public_key_${uid}`,
      `@mesh_crypto_peer_keys_${uid}`,
    );
  }

  // ── BiometricAuthService keys (SecureStore) ──
  if (uid) {
    secureStore.push(
      `@afetnet:biometric_enabled:${uid}`,
      `@afetnet:biometric_failed_attempts:${uid}`,
      `@afetnet:last_biometric_auth:${uid}`,
    );
  }

  // ── SessionSecurityService keys (SecureStore) ──
  if (uid) {
    secureStore.push(
      `@afetnet:session_state:${uid}`,
      `@afetnet:session_config:${uid}`,
    );
  }

  // ── SecureKeyManager auth-related keys (SecureStore, NOT user-scoped) ──
  secureStore.push(
    'afetnet_auth_token',
    'afetnet_refresh_token',
    'afetnet_user_id',
    'afetnet_fcm_token',
  );

  // ── Legacy unscoped "default" keys (SecureStore) ──
  secureStore.push(
    'afetnet_crypto_private_key_default',
    'afetnet_crypto_public_key_default',
    'afetnet_crypto_sign_private_key_default',
    'afetnet_crypto_sign_public_key_default',
    '@mesh_crypto_private_key_default',
    '@mesh_crypto_public_key_default',
    '@mesh_crypto_peer_keys_default',
  );

  // ── Legacy unscoped "default" keys (DirectStorage fallback) ──
  directStorage.push(
    'afetnet_crypto_private_key_default',
    'afetnet_crypto_public_key_default',
    'afetnet_crypto_sign_private_key_default',
    'afetnet_crypto_sign_public_key_default',
  );

  // ── Legacy unscoped biometric/session keys (DirectStorage) ──
  // These were stored before user-scoping was added
  directStorage.push(
    '@afetnet:biometric_enabled',
    '@afetnet:biometric_failed_attempts',
    '@afetnet:last_biometric_auth',
    '@afetnet:session_state',
    '@afetnet:session_config',
  );

  return { secureStore, directStorage };
}

/**
 * Purge ALL user-scoped security material from the device.
 * Safe to call multiple times (idempotent, best-effort).
 *
 * This is the SINGLE authoritative cleanup function.
 * Called by: shutdownApp(), AccountDeletionService.clearSecureStorage(), AuthService.signOut()
 */
export async function purgeUserSecurityKeys(uid: string): Promise<void> {
  const { secureStore, directStorage } = getSecurityKeyList(uid);

  logger.info(`Purging security keys for uid=${uid ? uid.substring(0, 8) + '...' : '(none)'}: ${secureStore.length} SecureStore + ${directStorage.length} DirectStorage`);

  // Delete SecureStore keys (async, must await each)
  for (const key of secureStore) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Best effort — key may not exist or SecureStore may be unavailable
    }
  }

  // Delete DirectStorage keys (sync)
  for (const key of directStorage) {
    try {
      DirectStorage.delete(key);
    } catch {
      // Best effort
    }
  }

  logger.info('Security key purge complete');
}
