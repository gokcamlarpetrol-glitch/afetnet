import nacl from 'tweetnacl';
import { encode as base64Encode, decode as base64Decode } from 'tweetnacl-util';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface EphemeralId {
  id: string;
  publicKey: Uint8Array;
  timestamp: number;
  expiresAt: number;
}

export class Curve25519Crypto {
  private static instance: Curve25519Crypto;
  private deviceKeyPair: KeyPair;
  private ephemeralId: EphemeralId | null = null;
  private readonly EPHEMERAL_ROTATION_INTERVAL = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.deviceKeyPair = this.generateKeyPair();
    this.rotateEphemeralId();
  }

  static getInstance(): Curve25519Crypto {
    if (!Curve25519Crypto.instance) {
      Curve25519Crypto.instance = new Curve25519Crypto();
    }
    return Curve25519Crypto.instance;
  }

  generateKeyPair(): KeyPair {
    const keyPair = nacl.sign.keyPair();
    return {
      publicKey: keyPair.publicKey,
      secretKey: keyPair.secretKey,
    };
  }

  sign(message: Uint8Array): Uint8Array {
    return nacl.sign.detached(message, this.deviceKeyPair.secretKey);
  }

  verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    return nacl.sign.detached.verify(message, signature, publicKey);
  }

  rotateEphemeralId(): EphemeralId {
    const now = Date.now();
    const keyPair = this.generateKeyPair();
    
    this.ephemeralId = {
      id: base64Encode(keyPair.publicKey).substring(0, 16), // Short ID
      publicKey: keyPair.publicKey,
      timestamp: now,
      expiresAt: now + this.EPHEMERAL_ROTATION_INTERVAL,
    };

    return this.ephemeralId;
  }

  getCurrentEphemeralId(): EphemeralId | null {
    if (!this.ephemeralId) {
      return this.rotateEphemeralId();
    }

    const now = Date.now();
    if (now >= this.ephemeralId.expiresAt) {
      return this.rotateEphemeralId();
    }

    return this.ephemeralId;
  }

  getDevicePublicKey(): Uint8Array {
    return this.deviceKeyPair.publicKey;
  }

  getDeviceSecretKey(): Uint8Array {
    return this.deviceKeyPair.secretKey;
  }

  // Utility functions for encoding/decoding
  encodeBase64(data: Uint8Array): string {
    return base64Encode(data);
  }

  decodeBase64(str: string): Uint8Array {
    return base64Decode(str);
  }

  // Generate a deterministic message ID from content
  generateMessageId(content: Uint8Array): string {
    // Simple hash function for message ID - in production, use crypto.subtle.digest
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
