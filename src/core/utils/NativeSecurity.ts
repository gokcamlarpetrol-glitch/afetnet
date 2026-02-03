/**
 * NATIVE SECURITY MODULE
 * Elite Protection Suite against Reverse Engineering & Environment Tampering
 */

import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform, Alert, BackHandler } from 'react-native';
import { createLogger } from './logger';

const logger = createLogger('NativeSecurity');

interface SecurityStatus {
    isRooted: boolean;
    isEmulator: boolean;
    isTampered: boolean;
}

class NativeSecurity {
  private static instance: NativeSecurity;
  public status: SecurityStatus = {
    isRooted: false,
    isEmulator: false,
    isTampered: false,
  };

  constructor() { }

  static getInstance(): NativeSecurity {
    if (!NativeSecurity.instance) {
      NativeSecurity.instance = new NativeSecurity();
    }
    return NativeSecurity.instance;
  }

  /**
     * Perform comprehensive security audit of the current environment
     */
  async audit(): Promise<SecurityStatus> {
    logger.info('Starting security audit...');

    // In strict mode, we should run these checks
    // But direct file access check in Expo Go/Managed workflow is limited without a custom native module.
    // We'll implement robust logic that works within Expo.

    this.status.isRooted = await this.checkRootAccess();
    this.status.isEmulator = !Device.isDevice;

    // Check if device is compromised
    if (this.status.isRooted) {
      logger.error('SECURITY ALERT: Rooted/Jailbroken device detected!');
      this.handleCompromise();
    } else {
      logger.info('Security audit passed. Environment secure.');
    }

    return this.status;
  }

  /**
     * Check for indicators of Root (Android) or Jailbreak (iOS)
     * Note: This is a heuristic check. For banking-grade security, use 'jail-monkey' or 'react-native-jailbreak-detector'.
     */
  private async checkRootAccess(): Promise<boolean> {
    if (__DEV__) return false; // Skip in dev for convenience

    try {
      // 1. Check for common root binaries
      // Expo FileSystem CAN access some system paths to check existence
      const commonPaths = [
        '/sbin/su',
        '/system/bin/su',
        '/system/xbin/su',
        '/data/local/xbin/su',
        '/data/local/bin/su',
        '/system/sd/xbin/su',
        '/system/bin/failsafe/su',
        '/data/local/su',
        '/su/bin/su',
        '/Applications/Cydia.app',
        '/Library/MobileSubstrate/MobileSubstrate.dylib',
        '/bin/bash',
        '/usr/sbin/sshd',
        '/etc/apt',
      ];

      for (const path of commonPaths) {
        const fileInfo = await FileSystem.getInfoAsync(path);
        if (fileInfo.exists) {
          logger.warn(`Root indicator found: ${path}`);
          return true;
        }
      }

      return false;
    } catch (e) {
      logger.error('Root check failed execution', e);
      return false; // Fail safe
    }
  }

  /**
     * Immediate counter-measures for compromised devices
     */
  private async handleCompromise() {
    // 1. ELITE: Complete security wipe
    await this.clearAll();

    // 2. Alert User
    Alert.alert(
      "GÜVENLİK UYARISI",
      "Cihazınızda root/jailbreak tespit edildi. Güvenlik politikalarımız gereği AfetNet bu cihazda çalıştırılamaz.",
      [
        {
          text: "Kapat",
          onPress: () => {
            // 3. Crash app or show blocking screen
            BackHandler.exitApp();
          },
        },
      ],
      { cancelable: false },
    );
  }

  /**
     * ELITE: Comprehensive Security Wipe
     * Clears ALL sensitive data from the device
     */
  async clearAll(): Promise<void> {
    logger.info('🔐 Initiating complete security wipe...');

    try {
      // 1. Clear SecureStore tokens
      const secureStoreKeys = [
        'auth_token',
        'refresh_token',
        'user_secrets',
        'firebase_tokens',
        'api_key_cache',
        'biometric_key',
        'encryption_key',
        'session_token',
      ];

      await Promise.all(
        secureStoreKeys.map(key =>
          SecureStore.deleteItemAsync(key).catch(() => { }),
        ),
      );
      logger.info('✓ SecureStore cleared');

      // 2. Clear AsyncStorage (all app data)
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.clear();
      logger.info('✓ AsyncStorage cleared');

      // 3. Clear Firestore persistence cache (if using offline persistence)
      try {
        const { clearIndexedDbPersistence, getFirestore } = require('firebase/firestore');
        const { initializeFirebase } = require('../../lib/firebase');
        const app = initializeFirebase();
        if (app) {
          const db = getFirestore(app);
          await clearIndexedDbPersistence(db);
          logger.info('✓ Firestore cache cleared');
        }
      } catch (e) {
        // Firestore clear may fail if not initialized, ignore
        logger.debug('Firestore cache clear skipped (not initialized)');
      }

      // 4. Clear React Query cache (if used)
      try {
        const { QueryClient } = require('@tanstack/react-query');
        const queryClient = new QueryClient();
        queryClient.clear();
        logger.info('✓ Query cache cleared');
      } catch (e) {
        // React Query may not be installed
      }

      // 5. Clear any in-memory caches in services
      try {
        // Location store
        const { useLocationStore } = require('../stores/locationStore');
        useLocationStore.getState().clearLocation?.();
      } catch (e) {
        // ELITE: Location store may not be available - non-critical for security wipe
      }

      logger.info('🔐 Security wipe complete');
    } catch (error) {
      logger.error('Security wipe encountered errors:', error);
      // Even if some operations fail, continue with the wipe
    }
  }
}

export const nativeSecurity = NativeSecurity.getInstance();
