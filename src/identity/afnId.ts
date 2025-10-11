import CryptoJS from 'crypto-js';
import { logger } from '../utils/productionLogger';
import { decodeBase64 } from 'tweetnacl-util';

// Base32 alphabet for AFN-ID
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes: Uint8Array): string {
  let result = '';
  let bits = 0;
  let value = 0;

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return result;
}

function crc32(data: Uint8Array): number {
  const crcTable = new Uint32Array(256);
  
  // Initialize CRC table
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function pubKeyToAfnId(pubKeyB64: string): string {
  try {
    // Step 1: decode base64 → bytes
    const pubKeyBytes = decodeBase64(pubKeyB64);
    
    // Step 2: take sha256 → first 10 bytes payload
    const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(pubKeyBytes));
    const hashBytes = new Uint8Array(hash.sigBytes);
    for (let i = 0; i < hash.sigBytes; i++) {
      hashBytes[i] = (hash.words[Math.floor(i / 4)] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    const payload = hashBytes.slice(0, 10);
    
    // Step 3: compute crc32 of payload → 2 bytes checksum
    const checksum = crc32(payload);
    const checksumBytes = new Uint8Array(2);
    checksumBytes[0] = (checksum >>> 8) & 0xff;
    checksumBytes[1] = checksum & 0xff;
    
    // Step 4: concat → Base32 (no padding), grouped AFN-XXXX-XXXX-XXXX
    const combined = new Uint8Array(12);
    combined.set(payload, 0);
    combined.set(checksumBytes, 10);
    
    const base32 = base32Encode(combined);
    
    // Format as AFN-XXXX-XXXX-XXXX
    const formatted = `AFN-${base32.slice(0, 4)}-${base32.slice(4, 8)}-${base32.slice(8, 12)}`;
    
    return formatted;
  } catch (error) {
    logger.error('Failed to generate AFN-ID:', error);
    throw new Error('AFN-ID generation failed');
  }
}

export function validateAfnId(id: string): { ok: boolean; payload?: Uint8Array } {
  try {
    // Remove AFN- prefix and dashes
    const clean = id.replace(/^AFN-/, '').replace(/-/g, '');
    
    // Check format: should be 12 Base32 characters
    if (!/^[A-Z2-7]{12}$/.test(clean)) {
      return { ok: false };
    }
    
    // Decode Base32
    const decoded = base32Decode(clean);
    if (decoded.length !== 12) {
      return { ok: false };
    }
    
    // Split payload (first 10 bytes) and checksum (last 2 bytes)
    const payload = decoded.slice(0, 10);
    const receivedChecksum = (decoded[10] << 8) | decoded[11];
    
    // Verify checksum
    const expectedChecksum = crc32(payload);
    
    if (receivedChecksum !== expectedChecksum) {
      return { ok: false };
    }
    
    return { ok: true, payload };
  } catch (error) {
    logger.error('AFN-ID validation failed:', error);
    return { ok: false };
  }
}

function base32Decode(base32: string): Uint8Array {
  const result: number[] = [];
  let bits = 0;
  let value = 0;
  
  for (let i = 0; i < base32.length; i++) {
    const char = base32[i];
    const index = BASE32_ALPHABET.indexOf(char);
    
    if (index === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    
    value = (value << 5) | index;
    bits += 5;
    
    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  
  return new Uint8Array(result);
}

export function formatAfnIdForDisplay(afnId: string): string {
  // Show first 4 and last 4 characters, mask the middle
  if (afnId.length < 12) return afnId;
  
  const start = afnId.slice(0, 4);
  const end = afnId.slice(-4);
  const middle = '*'.repeat(afnId.length - 8);
  
  return `${start}${middle}${end}`;
}
