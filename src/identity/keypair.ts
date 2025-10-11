import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/productionLogger';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

const STORAGE_KEY = 'afn/keys/v1';

export interface KeyPair {
  pubKeyB64: string;
  secKeyB64: string;
}

let cachedKeyPair: KeyPair | null = null;

export async function getOrCreateKeyPair(): Promise<KeyPair> {
  if (cachedKeyPair) {
    return cachedKeyPair;
  }

  try {
    // Try to load existing keypair
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const keyPair = JSON.parse(stored) as KeyPair;
      cachedKeyPair = keyPair;
      return keyPair;
    }
  } catch (error) {
    logger.warn('Failed to load existing keypair:', error);
  }

  // Generate new keypair
  try {
    const naclKeyPair = nacl.box.keyPair();
    const keyPair: KeyPair = {
      pubKeyB64: encodeBase64(naclKeyPair.publicKey),
      secKeyB64: encodeBase64(naclKeyPair.secretKey)
    };

    // Store the new keypair
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keyPair));
    cachedKeyPair = keyPair;
    
    return keyPair;
  } catch (error) {
    logger.error('Failed to generate keypair:', error);
    throw new Error('Keypair generation failed');
  }
}

export async function getPublicKey(): Promise<string> {
  const keyPair = await getOrCreateKeyPair();
  return keyPair.pubKeyB64;
}

export async function getSecretKey(): Promise<string> {
  const keyPair = await getOrCreateKeyPair();
  return keyPair.secKeyB64;
}

export async function clearKeyPair(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    cachedKeyPair = null;
  } catch (error) {
    logger.error('Failed to clear keypair:', error);
  }
}

export function getCachedPublicKey(): string | null {
  return cachedKeyPair?.pubKeyB64 || null;
}
