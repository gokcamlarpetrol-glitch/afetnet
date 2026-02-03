/**
 * CRYPTO UTILITIES
 * Secure encryption utilities using industry-standard algorithms
 * SECURITY: Uses libsodium for cryptographic operations
 */

import * as Crypto from 'expo-crypto';
import { createLogger } from './logger';

const logger = createLogger('CryptoUtils');

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
    data,
  );
}

/**
 * Generate random bytes
 */
export async function randomBytes(length: number): Promise<Uint8Array> {
  return await Crypto.getRandomBytesAsync(length);
}

/**
 * ELITE: Secure encryption using libsodium (secretbox - XSalsa20-Poly1305)
 * This replaces the insecure XOR encryption
 * @param data - Data to encrypt
 * @param key - 32-byte encryption key (will be derived if shorter)
 * @returns Encrypted data with nonce prepended
 */
export async function secureEncrypt(data: Uint8Array, key: string): Promise<Uint8Array> {
  try {
    // Dynamic import to prevent bundling issues
    const sodium = await import('libsodium-wrappers');
    await sodium.ready;

    // Derive proper key from input (32 bytes for secretbox)
    const keyBytes = new TextEncoder().encode(key);
    const derivedKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      key,
    );
    const keyArray = new Uint8Array(
      derivedKey.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [],
    );

    // Generate nonce (24 bytes for secretbox)
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

    // Encrypt
    const ciphertext = sodium.crypto_secretbox_easy(data, nonce, keyArray);

    // Prepend nonce to ciphertext
    const result = new Uint8Array(nonce.length + ciphertext.length);
    result.set(nonce);
    result.set(ciphertext, nonce.length);

    return result;
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * ELITE: Secure decryption using libsodium (secretbox - XSalsa20-Poly1305)
 * @param encryptedData - Encrypted data with nonce prepended
 * @param key - 32-byte encryption key (will be derived if shorter)
 * @returns Decrypted data
 */
export async function secureDecrypt(encryptedData: Uint8Array, key: string): Promise<Uint8Array> {
  try {
    const sodium = await import('libsodium-wrappers');
    await sodium.ready;

    // Derive proper key from input
    const derivedKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      key,
    );
    const keyArray = new Uint8Array(
      derivedKey.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [],
    );

    // Extract nonce and ciphertext
    const nonceLength = sodium.crypto_secretbox_NONCEBYTES;
    const nonce = encryptedData.slice(0, nonceLength);
    const ciphertext = encryptedData.slice(nonceLength);

    // Decrypt
    const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, keyArray);

    if (!plaintext) {
      throw new Error('Decryption failed - invalid ciphertext or key');
    }

    return plaintext;
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Decryption failed');
  }
}

/**
 * DEPRECATED: XOR encryption - kept for backward compatibility only
 * DO NOT USE FOR NEW CODE - use secureEncrypt instead
 * @deprecated Use secureEncrypt for new implementations
 */
export function xorEncrypt(data: Uint8Array, key: string): Uint8Array {
  logger.warn('xorEncrypt is deprecated - use secureEncrypt for production');
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key.charCodeAt(i % key.length);
  }
  return result;
}

/**
 * DEPRECATED: XOR decryption - kept for backward compatibility only
 * @deprecated Use secureDecrypt for new implementations
 */
export function xorDecrypt(data: Uint8Array, key: string): Uint8Array {
  logger.warn('xorDecrypt is deprecated - use secureDecrypt for production');
  return xorEncrypt(data, key);
}

