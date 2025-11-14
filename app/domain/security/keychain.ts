// @afetnet: Secure Keychain Management with automatic rotation
// Military-grade key management for disaster communication

import { logger } from '../../core/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { kyberService } from './pqc/kyber/kyber';
import { dilithiumService } from './pqc/dilithium/dilithium';
import { pfsService } from './pfs';

export interface KeychainKey {
  id: string;
  type: 'encryption' | 'signing' | 'authentication' | 'master';
  algorithm: string;
  keyData: string;
  createdAt: number;
  expiresAt: number;
  isActive: boolean;
  usageCount: number;
  lastUsed?: number;
  metadata: Record<string, any>;
}

export interface KeyRotationPolicy {
  rotationInterval: number; // milliseconds
  maxUsageCount: number;
  emergencyRotation: boolean;
  backupCount: number;
}

export class SecureKeychainManager {
  private encryptionKeys: Map<string, KeychainKey> = new Map();
  private signingKeys: Map<string, KeychainKey> = new Map();
  private masterKey: KeychainKey | null = null;
  private rotationTimer: NodeJS.Timeout | null = null;
  private rotationPolicy: KeyRotationPolicy;
  private keyUsageHistory: Map<string, number[]> = new Map(); // keyId -> usage timestamps

  constructor() {
    this.rotationPolicy = {
      rotationInterval: 3600000, // 1 hour
      maxUsageCount: 1000,
      emergencyRotation: true,
      backupCount: 3,
    };
  }

  async initialize(): Promise<void> {
    logger.debug('🔑 Initializing secure keychain manager...');

    try {
      // Load existing keys
      await this.loadKeysFromStorage();

      // Generate master key if not exists
      if (!this.masterKey) {
        await this.generateMasterKey();
      }

      // Setup automatic key rotation
      this.setupKeyRotation();

      // Initialize key usage tracking
      this.initializeUsageTracking();

      logger.debug('✅ Secure keychain manager initialized');
    } catch (error) {
      logger.error('Failed to initialize keychain manager:', error);
      throw error;
    }
  }

  private async loadKeysFromStorage(): Promise<void> {
    try {
      const keysData = await AsyncStorage.getItem('secure_keychain');
      if (keysData) {
        const keys = JSON.parse(keysData);

        if (keys.master) {
          this.masterKey = keys.master;
        }

        if (keys.encryption) {
          this.encryptionKeys = new Map(Object.entries(keys.encryption));
        }

        if (keys.signing) {
          this.signingKeys = new Map(Object.entries(keys.signing));
        }

        logger.debug(`Loaded ${this.encryptionKeys.size} encryption keys and ${this.signingKeys.size} signing keys`);
      }
    } catch (error) {
      logger.error('Failed to load keys from storage:', error);
    }
  }

  private async generateMasterKey(): Promise<void> {
    try {
      logger.debug('🔑 Generating master key...');

      const masterKeypair = await kyberService.generateKeypair();

      this.masterKey = {
        id: `master_${Date.now()}`,
        type: 'master',
        algorithm: 'Kyber1024',
        keyData: masterKeypair.secretKey,
        createdAt: Date.now(),
        expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
        isActive: true,
        usageCount: 0,
        metadata: {
          version: '1.0',
          securityLevel: 'military',
        },
      };

      await this.saveKeysToStorage();
      logger.debug('✅ Master key generated');
    } catch (error) {
      logger.error('Failed to generate master key:', error);
      throw error;
    }
  }

  private setupKeyRotation(): void {
    logger.debug(`🔄 Setting up key rotation every ${this.rotationPolicy.rotationInterval}ms`);

    this.rotationTimer = setInterval(async () => {
      await this.performKeyRotation();
    }, this.rotationPolicy.rotationInterval);
  }

  private async performKeyRotation(): Promise<void> {
    try {
      logger.debug('🔄 Performing automatic key rotation...');

      let rotatedCount = 0;

      // Rotate encryption keys
      for (const [keyId, key] of this.encryptionKeys) {
        if (this.shouldRotateKey(key)) {
          await this.rotateEncryptionKey(keyId);
          rotatedCount++;
        }
      }

      // Rotate signing keys
      for (const [keyId, key] of this.signingKeys) {
        if (this.shouldRotateKey(key)) {
          await this.rotateSigningKey(keyId);
          rotatedCount++;
        }
      }

      if (rotatedCount > 0) {
        await this.saveKeysToStorage();
        logger.debug(`✅ Rotated ${rotatedCount} keys`);
      }
    } catch (error) {
      logger.error('Failed to perform key rotation:', error);
    }
  }

  private shouldRotateKey(key: KeychainKey): boolean {
    // Check expiration
    if (Date.now() > key.expiresAt) return true;

    // Check usage count
    if (key.usageCount >= this.rotationPolicy.maxUsageCount) return true;

    // Check time-based rotation
    const age = Date.now() - key.createdAt;
    if (age >= this.rotationPolicy.rotationInterval) return true;

    return false;
  }

  private async rotateEncryptionKey(keyId: string): Promise<void> {
    const oldKey = this.encryptionKeys.get(keyId);
    if (!oldKey) return;

    try {
      // Generate new key
      const newKeypair = await kyberService.generateKeypair();

      const newKey: KeychainKey = {
        id: `enc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'encryption',
        algorithm: 'Kyber1024',
        keyData: newKeypair.secretKey,
        createdAt: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        isActive: true,
        usageCount: 0,
        metadata: {
          rotatedFrom: keyId,
          rotationReason: 'automatic',
        },
      };

      // Mark old key as inactive but keep for backup
      oldKey.isActive = false;
      oldKey.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours grace period

      // Add new key
      this.encryptionKeys.set(newKey.id, newKey);

      logger.debug(`🔄 Encryption key rotated: ${keyId} -> ${newKey.id}`);
    } catch (error) {
      logger.error('Failed to rotate encryption key:', error);
    }
  }

  private async rotateSigningKey(keyId: string): Promise<void> {
    const oldKey = this.signingKeys.get(keyId);
    if (!oldKey) return;

    try {
      // Generate new key
      const newKeypair = await dilithiumService.generateKeypair();

      const newKey: KeychainKey = {
        id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'signing',
        algorithm: 'Dilithium5',
        keyData: newKeypair.secretKey,
        createdAt: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        isActive: true,
        usageCount: 0,
        metadata: {
          rotatedFrom: keyId,
          rotationReason: 'automatic',
        },
      };

      // Mark old key as inactive
      oldKey.isActive = false;
      oldKey.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours grace period

      // Add new key
      this.signingKeys.set(newKey.id, newKey);

      logger.debug(`🔄 Signing key rotated: ${keyId} -> ${newKey.id}`);
    } catch (error) {
      logger.error('Failed to rotate signing key:', error);
    }
  }

  // @afetnet: Get active encryption key
  getActiveEncryptionKey(): KeychainKey | null {
    for (const key of this.encryptionKeys.values()) {
      if (key.isActive && key.type === 'encryption') {
        return key;
      }
    }
    return null;
  }

  // @afetnet: Get active signing key
  getActiveSigningKey(): KeychainKey | null {
    for (const key of this.signingKeys.values()) {
      if (key.isActive && key.type === 'signing') {
        return key;
      }
    }
    return null;
  }

  // @afetnet: Record key usage
  recordKeyUsage(keyId: string): void {
    const key = this.encryptionKeys.get(keyId) || this.signingKeys.get(keyId);
    if (key) {
      key.usageCount++;
      key.lastUsed = Date.now();

      // Track usage history
      const history = this.keyUsageHistory.get(keyId) || [];
      history.push(Date.now());

      // Keep only last 1000 usage records
      if (history.length > 1000) {
        history.shift();
      }

      this.keyUsageHistory.set(keyId, history);
    }
  }

  // @afetnet: Emergency key rotation
  async emergencyKeyRotation(): Promise<void> {
    logger.debug('🚨 Performing emergency key rotation...');

    try {
      // Rotate all active keys immediately
      const allKeys = [
        ...Array.from(this.encryptionKeys.values()),
        ...Array.from(this.signingKeys.values()),
      ].filter(key => key.isActive);

      for (const key of allKeys) {
        if (key.type === 'encryption') {
          await this.rotateEncryptionKey(key.id);
        } else if (key.type === 'signing') {
          await this.rotateSigningKey(key.id);
        }
      }

      // Clear usage history for security
      this.keyUsageHistory.clear();

      await this.saveKeysToStorage();

      logger.debug('✅ Emergency key rotation completed');
    } catch (error) {
      logger.error('Failed to perform emergency key rotation:', error);
    }
  }

  // @afetnet: Get keychain statistics
  getKeychainStats(): {
    totalEncryptionKeys: number;
    activeEncryptionKeys: number;
    totalSigningKeys: number;
    activeSigningKeys: number;
    averageKeyAge: number;
    emergencyRotations: number;
    securityScore: number;
  } {
    const allEncryptionKeys = Array.from(this.encryptionKeys.values());
    const activeEncryptionKeys = allEncryptionKeys.filter(k => k.isActive);

    const allSigningKeys = Array.from(this.signingKeys.values());
    const activeSigningKeys = allSigningKeys.filter(k => k.isActive);

    const now = Date.now();
    const totalKeys = [...allEncryptionKeys, ...allSigningKeys];
    const averageKeyAge = totalKeys.length > 0
      ? totalKeys.reduce((sum, key) => sum + (now - key.createdAt), 0) / totalKeys.length
      : 0;

    // Calculate security score
    let securityScore = 100;
    securityScore -= (this.keyUsageHistory.size * 2); // Usage tracking impact
    securityScore = Math.max(0, Math.min(100, securityScore));

    return {
      totalEncryptionKeys: allEncryptionKeys.length,
      activeEncryptionKeys: activeEncryptionKeys.length,
      totalSigningKeys: allSigningKeys.length,
      activeSigningKeys: activeSigningKeys.length,
      averageKeyAge,
      emergencyRotations: 0, // Would track in real implementation
      securityScore,
    };
  }

  private async saveKeysToStorage(): Promise<void> {
    try {
      const keysData = {
        master: this.masterKey,
        encryption: Object.fromEntries(this.encryptionKeys),
        signing: Object.fromEntries(this.signingKeys),
        lastBackup: Date.now(),
      };

      await AsyncStorage.setItem('secure_keychain', JSON.stringify(keysData));
    } catch (error) {
      logger.error('Failed to save keys to storage:', error);
    }
  }

  private initializeUsageTracking(): void {
    logger.debug('📊 Initializing key usage tracking...');

    // Track usage patterns for security analysis
    setInterval(() => {
      this.analyzeUsagePatterns();
    }, 60000); // Every minute
  }

  private analyzeUsagePatterns(): void {
    // Analyze key usage patterns for anomaly detection
    for (const [keyId, usageHistory] of this.keyUsageHistory) {
      if (usageHistory.length < 10) continue;

      // Calculate usage rate
      const recentUsage = usageHistory.slice(-10);
      const timeSpan = recentUsage[recentUsage.length - 1] - recentUsage[0];
      const usageRate = recentUsage.length / (timeSpan / 60000); // usages per minute

      // Detect unusual patterns
      if (usageRate > 10) { // More than 10 usages per minute
        logger.warn(`Unusual key usage detected: ${keyId} (${usageRate.toFixed(2)} usages/min)`);
      }
    }
  }

  // @afetnet: Force key rotation for specific key
  async forceKeyRotation(keyId: string): Promise<boolean> {
    try {
      const key = this.encryptionKeys.get(keyId) || this.signingKeys.get(keyId);
      if (!key) return false;

      if (key.type === 'encryption') {
        await this.rotateEncryptionKey(keyId);
      } else if (key.type === 'signing') {
        await this.rotateSigningKey(keyId);
      }

      await this.saveKeysToStorage();
      return true;
    } catch (error) {
      logger.error('Failed to force key rotation:', error);
      return false;
    }
  }

  // @afetnet: Get all keys for backup/export
  getAllKeys(): {
    master: KeychainKey | null;
    encryption: KeychainKey[];
    signing: KeychainKey[];
  } {
    return {
      master: this.masterKey,
      encryption: Array.from(this.encryptionKeys.values()),
      signing: Array.from(this.signingKeys.values()),
    };
  }

  // @afetnet: Clean up expired keys
  cleanupExpiredKeys(): void {
    let cleanedCount = 0;

    // Clean encryption keys
    for (const [keyId, key] of this.encryptionKeys) {
      if (Date.now() > key.expiresAt && !key.isActive) {
        this.encryptionKeys.delete(keyId);
        cleanedCount++;
      }
    }

    // Clean signing keys
    for (const [keyId, key] of this.signingKeys) {
      if (Date.now() > key.expiresAt && !key.isActive) {
        this.signingKeys.delete(keyId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 Cleaned up ${cleanedCount} expired keys`);
    }
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping secure keychain manager...');

    // Stop rotation timer
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }

    // Save final state
    await this.saveKeysToStorage();

    logger.debug('✅ Secure keychain manager stopped');
  }
}

// @afetnet: Export singleton instance
export const secureKeychainManager = new SecureKeychainManager();






































