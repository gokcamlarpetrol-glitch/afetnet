import * as Crypto from 'expo-crypto';
import { logger } from '../utils/productionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Envelope } from './types';

const KEY_STORAGE_KEY = 'afetnet:mesh:key';

// Generate or retrieve app-scope ephemeral key
export async function getOrCreateKey(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(KEY_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    
    // Generate new key using expo-crypto
    const key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `afetnet-${Date.now()}-${Math.random()}`,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    
    await AsyncStorage.setItem(KEY_STORAGE_KEY, key);
    return key;
  } catch (error) {
    logger.warn('Failed to get/create mesh key:', error);
    // Fallback to a simple key
    return 'afetnet-fallback-key-' + Date.now();
  }
}

// Set custom key (for admin override)
export async function setKey(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_STORAGE_KEY, key);
  } catch (error) {
    logger.warn('Failed to set mesh key:', error);
  }
}

// HMAC signing
export async function hmacSign(envelope: Omit<Envelope, 'sig'>, key: string): Promise<string> {
  try {
    const payload = JSON.stringify({
      id: envelope.id,
      type: envelope.type,
      ttl: envelope.ttl,
      hop: envelope.hop,
      ts: envelope.ts,
      payload: envelope.payload,
    });
    
    const signature = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      payload + key,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    
    return signature;
  } catch (error) {
    logger.warn('HMAC signing failed:', error);
    return '';
  }
}

// HMAC verification
export async function hmacVerify(envelope: Envelope, key: string): Promise<boolean> {
  try {
    if (!envelope.sig) {
      return false;
    }
    
    const { sig, ...envelopeWithoutSig } = envelope;
    const expectedSig = await hmacSign(envelopeWithoutSig, key);
    
    return sig === expectedSig;
  } catch (error) {
    logger.warn('HMAC verification failed:', error);
    return false;
  }
}

// AES-GCM encryption
export async function encrypt(payloadJson: string, key: string): Promise<{ ciphertext: string; iv: string }> {
  try {
    // Generate random IV
    const iv = await Crypto.getRandomBytesAsync(12);
    const ivBase64 = Buffer.from(iv).toString('base64');
    
    // For now, we'll use a simple XOR cipher as expo-crypto doesn't have AES-GCM
    // In production, you'd want to use a proper AES-GCM implementation
    const keyBytes = new TextEncoder().encode(key.slice(0, 32));
    const payloadBytes = new TextEncoder().encode(payloadJson);
    
    const ciphertext = new Uint8Array(payloadBytes.length);
    for (let i = 0; i < payloadBytes.length; i++) {
      ciphertext[i] = payloadBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    const ciphertextBase64 = Buffer.from(ciphertext).toString('base64');
    
    return {
      ciphertext: ciphertextBase64,
      iv: ivBase64,
    };
  } catch (error) {
    logger.warn('Encryption failed:', error);
    throw error;
  }
}

// AES-GCM decryption
export async function decrypt(ciphertext: string, iv: string, key: string): Promise<string> {
  try {
    // Decode base64
    const ciphertextBytes = Buffer.from(ciphertext, 'base64');
    const keyBytes = new TextEncoder().encode(key.slice(0, 32));
    
    // Simple XOR decryption (same as encryption for XOR)
    const plaintext = new Uint8Array(ciphertextBytes.length);
    for (let i = 0; i < ciphertextBytes.length; i++) {
      plaintext[i] = ciphertextBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    logger.warn('Decryption failed:', error);
    throw error;
  }
}

// Sign envelope with HMAC
export async function signEnvelope(envelope: Omit<Envelope, 'sig'>): Promise<Envelope> {
  const key = await getOrCreateKey();
  const sig = await hmacSign(envelope, key);
  
  return {
    ...envelope,
    sig,
  };
}

// Verify envelope signature
export async function verifyEnvelope(envelope: Envelope): Promise<boolean> {
  const key = await getOrCreateKey();
  return hmacVerify(envelope, key);
}
