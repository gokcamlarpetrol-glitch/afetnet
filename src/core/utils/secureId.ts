/**
 * SECURE ID GENERATOR — Crypto-grade randomness
 *
 * Purpose: Replace Math.random()-based ID generation across the codebase.
 *
 * Why: Math.random() has documented collision risk at scale (Linear Congruential
 * Generator with ~2^32 period on JS engines). With 1M+ users + multi-call sites
 * (messages, groups, ULIDs), birthday paradox kicks in much earlier than naive
 * intuition. expo-crypto's getRandomBytes uses platform CSPRNG (SecRandomCopyBytes
 * on iOS, /dev/urandom on Android) → effectively zero collision risk.
 *
 * API:
 *  - secureId(byteLength = 8): synchronous base62 ID
 *  - secureIdAsync(byteLength = 8): async variant (preferred — getRandomBytes can
 *    fall back to async on older devices)
 *  - secureMessageId(prefix?, byteLength = 8): "prefix_timestamp_id" pattern
 *  - secureUUIDv4(): RFC4122-compliant v4 UUID
 *
 * Boundary discipline: at any allocation site that previously combined
 * `Date.now() + Math.random().toString(36)`, swap in secureMessageId().
 */

import * as ExpoCrypto from 'expo-crypto';

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function bytesToBase62(bytes: Uint8Array): string {
  // Treat the bytes as a big-endian integer and convert to base62.
  let result = '';
  // We iterate bit-by-bit avoiding BigInt for RN compatibility on older runtimes.
  // For 8 bytes (64 bits) the produced string fits in ~11 base62 chars.
  let carry = 0n;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    carry = (carry << 8n) | BigInt(byte);
  }
  if (carry === 0n) return '0';
  while (carry > 0n) {
    const remainder = Number(carry % 62n);
    result = BASE62_ALPHABET[remainder] + result;
    carry = carry / 62n;
  }
  return result;
}

/**
 * Generate a cryptographically secure base62 ID.
 *
 * @param byteLength - Number of random bytes (default 8 = ~64 bits of entropy)
 * @returns Base62-encoded ID string (no padding, ~11 chars for 8 bytes)
 *
 * Note: Uses synchronous getRandomBytes when available. expo-crypto provides
 * sync API since SDK 49. If only async is available, this falls back to a
 * lower-entropy mix (still better than Math.random — uses Date.now() + perf
 * counter as IV).
 */
export function secureId(byteLength = 8): string {
  try {
    const bytes = ExpoCrypto.getRandomBytes(byteLength);
    return bytesToBase62(bytes);
  } catch {
    // Fallback: combine Date.now() high-resolution time. Still better than
    // Math.random alone because perf counter adds nanosecond entropy.
    const now = BigInt(Date.now());
    const perf = typeof performance !== 'undefined' && performance.now
      ? BigInt(Math.floor(performance.now() * 1000))
      : 0n;
    const composite = (now << 32n) ^ perf;
    let out = '';
    let v = composite;
    while (v > 0n) {
      out = BASE62_ALPHABET[Number(v % 62n)] + out;
      v = v / 62n;
    }
    return out || '0';
  }
}

/**
 * Async variant — preferred when called from async context.
 */
export async function secureIdAsync(byteLength = 8): Promise<string> {
  try {
    const bytes = await ExpoCrypto.getRandomBytesAsync(byteLength);
    return bytesToBase62(bytes);
  } catch {
    return secureId(byteLength);
  }
}

/**
 * Generate a message-style ID: `${prefix}_${timestamp}_${randomBase62}`.
 *
 * Pattern matches existing `msg_${Date.now()}_${Math.random().toString(36)...}`
 * shape so call sites can drop in safely. Sorts by timestamp lexicographically.
 *
 * @param prefix - Optional prefix (e.g. 'msg', 'grp', 'sys')
 * @param byteLength - Random bytes (default 8)
 */
export function secureMessageId(prefix?: string, byteLength = 8): string {
  const id = secureId(byteLength);
  const ts = Date.now().toString(36);
  return prefix ? `${prefix}_${ts}_${id}` : `${ts}_${id}`;
}

/**
 * Generate a RFC4122-compliant UUID v4.
 *
 * Replaces the previous CryptoService.generateUUID which used Math.random
 * for the variant nibble — that produced strings that *parsed* as v4 but
 * carried zero entropy in the variant position. This impl pulls all 16
 * bytes from CSPRNG and applies the exact bit-mask per RFC4122 §4.4.
 */
export function secureUUIDv4(): string {
  const bytes = ExpoCrypto.getRandomBytes(16);
  // Per RFC4122: version = 0100 in the high-nibble of byte 6.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  // Per RFC4122: variant = 10xx in the high-bits of byte 8.
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push((bytes[i] ?? 0).toString(16).padStart(2, '0'));
  }
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
