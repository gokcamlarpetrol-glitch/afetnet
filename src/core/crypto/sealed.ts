import { box, randomBytes } from 'tweetnacl';

export interface SealedBox {
  encryptedData: Uint8Array;
  nonce: Uint8Array;
}

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export class SealedBoxManager {
  private static instance: SealedBoxManager;
  private localKeyPair: KeyPair | null = null;

  private constructor() {}

  static getInstance(): SealedBoxManager {
    if (!SealedBoxManager.instance) {
      SealedBoxManager.instance = new SealedBoxManager();
    }
    return SealedBoxManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Generate or load local key pair
      this.localKeyPair = await this.generateKeyPair();
      console.log('SealedBoxManager initialized');
    } catch (error) {
      console.error('Failed to initialize SealedBoxManager:', error);
    }
  }

  private async generateKeyPair(): Promise<KeyPair> {
    // In a real implementation, you'd generate or load from secure storage
    const keyPair = box.keyPair();
    return {
      publicKey: keyPair.publicKey,
      secretKey: keyPair.secretKey,
    };
  }

  async encryptNote(note: string, recipientPublicKey?: Uint8Array): Promise<SealedBox | null> {
    try {
      if (!this.localKeyPair) {
        throw new Error('SealedBoxManager not initialized');
      }

      const messageBytes = new TextEncoder().encode(note);
      const nonce = randomBytes(24);

      let encryptedData: Uint8Array;

      if (recipientPublicKey) {
        // Encrypt for specific recipient
        encryptedData = box(messageBytes, nonce, recipientPublicKey, this.localKeyPair.secretKey);
      } else {
        // Self-encrypt (can be decrypted with local secret key)
        encryptedData = box(messageBytes, nonce, this.localKeyPair.publicKey, this.localKeyPair.secretKey);
      }

      return {
        encryptedData,
        nonce,
      };
    } catch (error) {
      console.error('Failed to encrypt note:', error);
      return null;
    }
  }

  async decryptNote(sealedBox: SealedBox, senderPublicKey?: Uint8Array): Promise<string | null> {
    try {
      if (!this.localKeyPair) {
        throw new Error('SealedBoxManager not initialized');
      }

      const publicKey = senderPublicKey || this.localKeyPair.publicKey;
      const decryptedBytes = box.open(
        sealedBox.encryptedData,
        sealedBox.nonce,
        publicKey,
        this.localKeyPair.secretKey
      );

      if (!decryptedBytes) {
        throw new Error('Decryption failed');
      }

      return new TextDecoder().decode(decryptedBytes);
    } catch (error) {
      console.error('Failed to decrypt note:', error);
      return null;
    }
  }

  async encryptPersonalData(data: Record<string, any>): Promise<SealedBox | null> {
    try {
      const jsonString = JSON.stringify(data);
      return this.encryptNote(jsonString);
    } catch (error) {
      console.error('Failed to encrypt personal data:', error);
      return null;
    }
  }

  async decryptPersonalData(sealedBox: SealedBox): Promise<Record<string, any> | null> {
    try {
      const decryptedString = await this.decryptNote(sealedBox);
      if (!decryptedString) {
        return null;
      }

      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('Failed to decrypt personal data:', error);
      return null;
    }
  }

  getPublicKey(): Uint8Array | null {
    return this.localKeyPair?.publicKey || null;
  }

  async exportKeyPair(): Promise<KeyPair | null> {
    return this.localKeyPair ? { ...this.localKeyPair } : null;
  }

  async importKeyPair(keyPair: KeyPair): Promise<boolean> {
    try {
      // Validate key pair
      if (!this.validateKeyPair(keyPair)) {
        return false;
      }

      this.localKeyPair = keyPair;
      return true;
    } catch (error) {
      console.error('Failed to import key pair:', error);
      return false;
    }
  }

  private validateKeyPair(keyPair: KeyPair): boolean {
    try {
      // Test encryption/decryption to validate key pair
      const testMessage = 'test';
      const testBytes = new TextEncoder().encode(testMessage);
      const nonce = randomBytes(24);

      const encrypted = box(testBytes, nonce, keyPair.publicKey, keyPair.secretKey);
      const decrypted = box.open(encrypted, nonce, keyPair.publicKey, keyPair.secretKey);

      return decrypted !== null && new TextDecoder().decode(decrypted) === testMessage;
    } catch (error) {
      return false;
    }
  }

  async createSecureNote(plaintext: string): Promise<{
    sealedBox: SealedBox;
    encrypted: boolean;
  }> {
    try {
      const sealedBox = await this.encryptNote(plaintext);
      
      if (sealedBox) {
        return {
          sealedBox,
          encrypted: true,
        };
      } else {
        // Fallback to plaintext if encryption fails
        return {
          sealedBox: {
            encryptedData: new TextEncoder().encode(plaintext),
            nonce: new Uint8Array(24),
          },
          encrypted: false,
        };
      }
    } catch (error) {
      console.error('Failed to create secure note:', error);
      return {
        sealedBox: {
          encryptedData: new TextEncoder().encode(plaintext),
          nonce: new Uint8Array(24),
        },
        encrypted: false,
      };
    }
  }

  async readSecureNote(sealedBox: SealedBox, isEncrypted: boolean): Promise<string | null> {
    try {
      if (!isEncrypted) {
        return new TextDecoder().decode(sealedBox.encryptedData);
      }

      return await this.decryptNote(sealedBox);
    } catch (error) {
      console.error('Failed to read secure note:', error);
      return null;
    }
  }

  // Utility methods for working with encrypted data
  sealedBoxToBase64(sealedBox: SealedBox): string {
    const combined = new Uint8Array(sealedBox.encryptedData.length + sealedBox.nonce.length);
    combined.set(sealedBox.nonce, 0);
    combined.set(sealedBox.encryptedData, sealedBox.nonce.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  base64ToSealedBox(base64String: string): SealedBox | null {
    try {
      const combined = Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
      const nonce = combined.slice(0, 24);
      const encryptedData = combined.slice(24);
      
      return { encryptedData, nonce };
    } catch (error) {
      console.error('Failed to parse base64 sealed box:', error);
      return null;
    }
  }

  async cleanup(): Promise<void> {
    // Clear sensitive data from memory
    if (this.localKeyPair) {
      this.localKeyPair.secretKey.fill(0);
      this.localKeyPair = null;
    }
    console.log('SealedBoxManager cleaned up');
  }
}
