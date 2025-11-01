/**
 * CRYPTO UTILITIES
 * Basic encryption utilities for secure communication
 */

import * as Crypto from 'expo-crypto';

/**
 * Generate random UUID
 */
export async function generateUUID(): Promise<string> {
  return await Crypto.randomUUID();
}

/**
 * Hash data using SHA256
 */
export async function sha256(data: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    data
  );
}

/**
 * Generate random bytes
 */
export async function randomBytes(length: number): Promise<Uint8Array> {
  return await Crypto.getRandomBytesAsync(length);
}

/**
 * Simple XOR encryption for BLE mesh (basic obfuscation)
 * For production, use proper encryption from src/crypto/
 */
export function xorEncrypt(data: Uint8Array, key: string): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key.charCodeAt(i % key.length);
  }
  return result;
}

/**
 * XOR decryption (same as encryption)
 */
export function xorDecrypt(data: Uint8Array, key: string): Uint8Array {
  return xorEncrypt(data, key);
}

