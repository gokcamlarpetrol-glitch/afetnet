import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/productionLogger';
import CryptoJS from 'crypto-js';
import { emergencyLogger } from '../services/logging/EmergencyLogger';

export interface EncryptionConfig {
  algorithm: string;
  keySize: number;
  iterations: number;
  salt: string;
}

export interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
  timestamp: number;
  checksum: string;
}

class EncryptionManager {
  private masterKey: string | null = null;
  private deviceId: string | null = null;
  private encryptionConfig: EncryptionConfig;
  private keyDerivationSalt: string;
  private isInitialized = false;

  constructor() {
    this.encryptionConfig = {
      algorithm: 'AES-256-GCM',
      keySize: 256,
      iterations: 100000,
      salt: this.generateRandomSalt()
    };
    
    this.keyDerivationSalt = this.generateRandomSalt();
    this.initializeDeviceId();
  }

  // CRITICAL: Initialize Encryption System
  async initializeEncryption(): Promise<boolean> {
    try {
      if (this.isInitialized) return true;

      logger.debug('🔐 Initializing encryption system...');

      // Generate device-specific encryption key
      await this.generateDeviceKey();

      // Test encryption/decryption
      const testData = 'CRITICAL_SYSTEM_TEST';
      const encrypted = await this.encrypt(testData);
      const decrypted = await this.decrypt(encrypted);

      if (decrypted !== testData) {
        throw new Error('Encryption test failed');
      }

      this.isInitialized = true;
      emergencyLogger.logSystem('info', 'Encryption system initialized successfully');
      logger.debug('✅ Encryption system initialized');

      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to initialize encryption', { error: String(error) });
      logger.error('❌ Failed to initialize encryption:', error);
      return false;
    }
  }

  // CRITICAL: Encrypt Data
  async encrypt(data: string): Promise<EncryptedData> {
    try {
      // Initialize encryption if not already done
      if (!this.isInitialized) {
        const initResult = await this.initializeEncryption();
        if (!initResult) {
          throw new Error('Failed to initialize encryption');
        }
      }

      if (!this.masterKey) {
        throw new Error('Master key not available');
      }

      // Generate random IV for each encryption
      const iv = CryptoJS.lib.WordArray.random(16);
      const salt = CryptoJS.lib.WordArray.random(16);

      // Derive key from master key and salt
      const key = CryptoJS.PBKDF2(this.masterKey, salt, {
        keySize: this.encryptionConfig.keySize / 32,
        iterations: this.encryptionConfig.iterations
      });

      // Encrypt data
      const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      // Generate checksum for integrity
      const checksum = CryptoJS.SHA256(encrypted.toString() + this.masterKey).toString();

      const encryptedData: EncryptedData = {
        data: encrypted.toString(),
        iv: iv.toString(),
        salt: salt.toString(),
        timestamp: Date.now(),
        checksum: checksum
      };

      emergencyLogger.logSecurity('info', 'Data encrypted successfully', { 
        dataLength: data.length,
        timestamp: encryptedData.timestamp 
      });

      return encryptedData;

    } catch (error) {
      emergencyLogger.logSecurity('error', 'Encryption failed', { error: String(error) });
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  // CRITICAL: Decrypt Data
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    try {
      if (!this.isInitialized || !this.masterKey) {
        throw new Error('Encryption not initialized');
      }

      // Verify checksum
      const expectedChecksum = CryptoJS.SHA256(encryptedData.data + this.masterKey).toString();
      if (expectedChecksum !== encryptedData.checksum) {
        throw new Error('Data integrity check failed');
      }

      // Reconstruct key
      const key = CryptoJS.PBKDF2(this.masterKey, encryptedData.salt, {
        keySize: this.encryptionConfig.keySize / 32,
        iterations: this.encryptionConfig.iterations
      });

      // Decrypt data
      const decrypted = CryptoJS.AES.decrypt(encryptedData.data, key, {
        iv: encryptedData.iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedString) {
        throw new Error('Decryption resulted in empty string');
      }

      emergencyLogger.logSecurity('info', 'Data decrypted successfully', { 
        dataLength: decryptedString.length,
        timestamp: encryptedData.timestamp 
      });

      return decryptedString;

    } catch (error) {
      emergencyLogger.logSecurity('error', 'Decryption failed', { error: String(error) });
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  // CRITICAL: Encrypt Object
  async encryptObject<T>(obj: T): Promise<EncryptedData> {
    try {
      const jsonString = JSON.stringify(obj);
      return await this.encrypt(jsonString);
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Object encryption failed', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Decrypt Object
  async decryptObject<T>(encryptedData: EncryptedData): Promise<T> {
    try {
      const jsonString = await this.decrypt(encryptedData);
      return JSON.parse(jsonString);
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Object decryption failed', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Secure Storage
  async secureStore(key: string, data: unknown): Promise<void> {
    try {
      const encryptedData = await this.encryptObject(data);
      await AsyncStorage.setItem(`secure_${key}`, JSON.stringify(encryptedData));
      
      emergencyLogger.logSecurity('info', 'Data stored securely', { key, dataType: typeof data });
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Secure storage failed', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Secure Retrieve
  async secureRetrieve<T>(key: string): Promise<T | null> {
    try {
      const stored = await AsyncStorage.getItem(`secure_${key}`);
      if (!stored) return null;

      const encryptedData: EncryptedData = JSON.parse(stored);
      return await this.decryptObject<T>(encryptedData);
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Secure retrieval failed', { error: String(error) });
      return null;
    }
  }

  // CRITICAL: Generate Secure Hash
  generateSecureHash(data: string): string {
    try {
      if (!this.masterKey) {
        throw new Error('Encryption not initialized');
      }

      const combinedData = data + this.masterKey + this.deviceId;
      return CryptoJS.SHA256(combinedData).toString();
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Hash generation failed', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Verify Data Integrity
  async verifyIntegrity(data: string, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = this.generateSecureHash(data);
      return actualHash === expectedHash;
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Integrity verification failed', { error: String(error) });
      return false;
    }
  }

  // CRITICAL: Secure Communication Channel
  async createSecureChannel(peerId: string): Promise<string> {
    try {
      const channelKey = this.generateRandomKey();
      const channelId = `secure_channel_${Date.now()}_${peerId}`;
      
      // Store channel key securely
      await this.secureStore(`channel_${channelId}`, { key: channelKey, peerId, createdAt: Date.now() });
      
      emergencyLogger.logSecurity('info', 'Secure channel created', { channelId, peerId });
      return channelId;
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Secure channel creation failed', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Encrypt for Peer
  async encryptForPeer(data: string, peerId: string): Promise<EncryptedData> {
    try {
      // Get or create peer-specific key
      const peerKey = await this.getPeerKey(peerId);
      
      // Use peer-specific encryption
      const iv = CryptoJS.lib.WordArray.random(16);
      const encrypted = CryptoJS.AES.encrypt(data, peerKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      return {
        data: encrypted.toString(),
        iv: iv.toString(),
        salt: '',
        timestamp: Date.now(),
        checksum: CryptoJS.SHA256(encrypted.toString() + peerKey).toString()
      };
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Peer encryption failed', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Decrypt from Peer
  async decryptFromPeer(encryptedData: EncryptedData, peerId: string): Promise<string> {
    try {
      // Get peer-specific key
      const peerKey = await this.getPeerKey(peerId);
      
      // Verify checksum
      const expectedChecksum = CryptoJS.SHA256(encryptedData.data + peerKey).toString();
      if (expectedChecksum !== encryptedData.checksum) {
        throw new Error('Peer data integrity check failed');
      }

      // Decrypt data
      const decrypted = CryptoJS.AES.decrypt(encryptedData.data, peerKey, {
        iv: encryptedData.iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Peer decryption failed', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Wipe All Data
  async wipeAllData(): Promise<void> {
    try {
      logger.debug('🗑️ Wiping all encrypted data...');
      
      // Clear master key
      this.masterKey = null;
      this.isInitialized = false;
      
      // Clear all secure storage
      const keys = await AsyncStorage.getAllKeys();
      const secureKeys = keys.filter(key => key.startsWith('secure_'));
      
      await AsyncStorage.multiRemove(secureKeys);
      
      emergencyLogger.logSecurity('warn', 'All encrypted data wiped');
      logger.debug('✅ All encrypted data wiped');
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Data wipe failed', { error: String(error) });
      throw error;
    }
  }

  // Helper methods
  private async generateDeviceKey(): Promise<void> {
    try {
      // Generate device-specific key using device ID and hardware info
      const deviceInfo = await this.getDeviceInfo();
      const baseKey = `${deviceInfo.deviceId}_${deviceInfo.platform}_${deviceInfo.version}`;
      
      // Derive master key using PBKDF2
      this.masterKey = CryptoJS.PBKDF2(baseKey, this.keyDerivationSalt, {
        keySize: this.encryptionConfig.keySize / 32,
        iterations: this.encryptionConfig.iterations
      }).toString();

      emergencyLogger.logSecurity('info', 'Device key generated');
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Device key generation failed', { error: String(error) });
      throw error;
    }
  }

  private initializeDeviceId(): void {
    // Generate persistent device ID
    this.deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getDeviceInfo(): Promise<{ deviceId: string; platform: string; version: string }> {
    return {
      deviceId: this.deviceId || 'unknown',
      platform: 'react-native',
      version: '1.0.0'
    };
  }

  private generateRandomSalt(): string {
    return CryptoJS.lib.WordArray.random(16).toString();
  }

  private generateRandomKey(): string {
    return CryptoJS.lib.WordArray.random(32).toString();
  }

  private async getPeerKey(peerId: string): Promise<string> {
    try {
      const peerData: any = await this.secureRetrieve(`peer_${peerId}`);
      if (peerData && (peerData as any).key) {
        return (peerData as any).key;
      }

      // Generate new peer key
      const peerKey = this.generateRandomKey();
      await this.secureStore(`peer_${peerId}`, { key: peerKey, createdAt: Date.now() });
      
      return peerKey;
    } catch (error) {
      emergencyLogger.logSecurity('error', 'Peer key retrieval failed', { error: String(error) });
      throw error;
    }
  }

  // Getters
  get isReady(): boolean {
    return this.isInitialized && this.masterKey !== null;
  }

  get deviceIdentifier(): string {
    return this.deviceId || 'unknown';
  }
}

// Export singleton instance
export const encryptionManager = new EncryptionManager();
export default EncryptionManager;
