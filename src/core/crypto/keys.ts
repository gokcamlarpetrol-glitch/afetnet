import { randomBytes } from 'crypto';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export function generateKeyPair(): KeyPair {
  // In a real implementation, this would use tweetnacl
  // For now, we'll generate random keys
  const publicKey = new Uint8Array(32);
  const secretKey = new Uint8Array(64);
  
  randomBytes(32).copy(publicKey);
  randomBytes(64).copy(secretKey);
  
  return { publicKey, secretKey };
}

export function generateEphemeralKey(): KeyPair {
  return generateKeyPair();
}

export function deriveSharedSecret(secretKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  // In a real implementation, this would use curve25519
  // For now, return a random 32-byte key
  const sharedSecret = new Uint8Array(32);
  randomBytes(32).copy(sharedSecret);
  return sharedSecret;
}