import crc32 from 'crc-32';
import CryptoJS from 'crypto-js';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';

// Simple Base32 encoding (RFC 4648 variant without padding, custom alphabet)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

function decodeBase32(str: string): Uint8Array {
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of str) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    
    value = (value << 5) | index;
    bits += 5;
    while (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

export function generateGroupSeed(): Uint8Array {
  const seed = new Uint8Array(16);
  crypto.getRandomValues(seed);
  return seed;
}

export function gidFromSeed(seed: Uint8Array): string {
  // 1. Take first 10 bytes as payload
  const payload = seed.subarray(0, 10);

  // 2. Compute CRC32 of payload (2 bytes checksum)
  const checksum = crc32.buf(payload);
  const checksumBytes = new Uint8Array(2);
  new DataView(checksumBytes.buffer).setUint16(0, checksum & 0xffff, false); // Big-endian

  // 3. Concat payload and checksum
  const fullBytes = new Uint8Array(payload.length + checksumBytes.length);
  fullBytes.set(payload, 0);
  fullBytes.set(checksumBytes, payload.length);

  // 4. Base32 encode and group
  const encoded = encodeBase32(fullBytes);
  return `AFN-GID-${encoded.slice(0, 4)}-${encoded.slice(4, 8)}`;
}

export function deriveGroupKey(seed: Uint8Array, memberPubKeysB64: string[]): string {
  // Sort public keys for deterministic output
  const sortedKeys = [...memberPubKeysB64].sort();
  
  // Create input: seed || sorted public keys
  const keyData = new Uint8Array(seed.length + sortedKeys.length * 44); // 44 chars for base64 encoded 32-byte key
  keyData.set(seed, 0);
  
  let offset = seed.length;
  for (const key of sortedKeys) {
    const keyBytes = new TextEncoder().encode(key);
    keyData.set(keyBytes, offset);
    offset += keyBytes.length;
  }

  // Use HKDF-like derivation (simplified for mobile)
  const keyDataB64 = encodeBase64(keyData);
  const hash = CryptoJS.SHA256(keyDataB64).toString();

  // Return first 32 bytes as base64
  const hashBytes = decodeBase64(hash);
  return encodeBase64(hashBytes.subarray(0, 32));
}

export function validateGid(gid: string): { ok: boolean; payload?: Uint8Array } {
  const cleanGid = gid.replace(/AFN-GID-|-/g, '');
  if (cleanGid.length !== 8) { // 6 payload bytes + 2 checksum bytes = 8 Base32 chars
    return { ok: false };
  }

  try {
    const decoded = decodeBase32(cleanGid);
    if (decoded.length !== 8) { // Should be 6 payload + 2 checksum bytes
      return { ok: false };
    }

    const payload = decoded.subarray(0, 6);
    const receivedChecksumBytes = decoded.subarray(6, 8);
    const receivedChecksum = new DataView(receivedChecksumBytes.buffer).getUint16(0, false);

    const actualChecksum = crc32.buf(payload);

    if ((actualChecksum & 0xffff) === receivedChecksum) {
      return { ok: true, payload };
    }
    return { ok: false };
  } catch (e) {
    console.error('GID validation error:', e);
    return { ok: false };
  }
}

export function formatGidForDisplay(gid: string): string {
  const cleanGid = gid.replace(/AFN-GID-|-/g, '');
  if (cleanGid.length !== 8) return gid; // Return as is if not a valid format
  return `AFN-GID-${cleanGid.slice(0, 4)}-${cleanGid.slice(4, 8)}`;
}
