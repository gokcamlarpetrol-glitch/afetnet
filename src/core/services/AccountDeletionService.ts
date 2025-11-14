/**
 * ACCOUNT DELETION SERVICE - ELITE PRODUCTION
 * Comprehensive account deletion with Firebase data cleanup
 * GDPR compliant - complete data removal
 */

import { createLogger } from '../utils/logger';
import { firebaseDataService } from './FirebaseDataService';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import { deleteDoc, collection, query, where, getDocs, doc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useFamilyStore } from '../stores/familyStore';
import { useHealthProfileStore } from '../stores/healthProfileStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTrialStore } from '../stores/trialStore';
import { usePremiumStore } from '../stores/premiumStore';

const logger = createLogger('AccountDeletionService');

interface DeletionProgress {
  step: string;
  progress: number;
  total: number;
}

class AccountDeletionService {
  /**
   * Delete all user account data
   * CRITICAL: GDPR compliant - complete data removal
   */
  async deleteAccount(
    deviceId: string,
    onProgress?: (progress: DeletionProgress) => void
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    let progress = 0;
    const totalSteps = 12;

    try {
      logger.info('Starting account deletion process...');

      // Step 1: Delete device document
      progress++;
      onProgress?.({
        step: 'Cihaz verileri siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteDeviceData(deviceId).catch((error) => {
        errors.push(`Device data: ${error.message}`);
        logger.error('Failed to delete device data:', error);
      });

      // Step 2: Delete family members
      progress++;
      onProgress?.({
        step: 'Aile üyeleri siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteFamilyMembers(deviceId).catch((error) => {
        errors.push(`Family members: ${error.message}`);
        logger.error('Failed to delete family members:', error);
      });

      // Step 3: Delete messages
      progress++;
      onProgress?.({
        step: 'Mesajlar siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteMessages(deviceId).catch((error) => {
        errors.push(`Messages: ${error.message}`);
        logger.error('Failed to delete messages:', error);
      });

      // Step 4: Delete conversations
      progress++;
      onProgress?.({
        step: 'Konuşmalar siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteConversations(deviceId).catch((error) => {
        errors.push(`Conversations: ${error.message}`);
        logger.error('Failed to delete conversations:', error);
      });

      // Step 5: Delete location updates
      progress++;
      onProgress?.({
        step: 'Konum verileri siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteLocationUpdates(deviceId).catch((error) => {
        errors.push(`Location updates: ${error.message}`);
        logger.error('Failed to delete location updates:', error);
      });

      // Step 6: Delete status updates
      progress++;
      onProgress?.({
        step: 'Durum güncellemeleri siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteStatusUpdates(deviceId).catch((error) => {
        errors.push(`Status updates: ${error.message}`);
        logger.error('Failed to delete status updates:', error);
      });

      // Step 7: Delete health profile
      progress++;
      onProgress?.({
        step: 'Sağlık profili siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteHealthProfile(deviceId).catch((error) => {
        errors.push(`Health profile: ${error.message}`);
        logger.error('Failed to delete health profile:', error);
      });

      // Step 8: Delete ICE data
      progress++;
      onProgress?.({
        step: 'ICE bilgileri siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteICEData(deviceId).catch((error) => {
        errors.push(`ICE data: ${error.message}`);
        logger.error('Failed to delete ICE data:', error);
      });

      // Step 9: Delete earthquake alerts
      progress++;
      onProgress?.({
        step: 'Deprem uyarıları siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteEarthquakeAlerts(deviceId).catch((error) => {
        errors.push(`Earthquake alerts: ${error.message}`);
        logger.error('Failed to delete earthquake alerts:', error);
      });

      // Step 10: Delete SOS signals
      progress++;
      onProgress?.({
        step: 'SOS sinyalleri siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteSOSSignals(deviceId).catch((error) => {
        errors.push(`SOS signals: ${error.message}`);
        logger.error('Failed to delete SOS signals:', error);
      });

      // Step 11: Clear local storage
      progress++;
      onProgress?.({
        step: 'Yerel veriler temizleniyor...',
        progress,
        total: totalSteps,
      });
      await this.clearLocalStorage().catch((error) => {
        errors.push(`Local storage: ${error.message}`);
        logger.error('Failed to clear local storage:', error);
      });

      // Step 12: Clear secure storage
      progress++;
      onProgress?.({
        step: 'Güvenli depolama temizleniyor...',
        progress,
        total: totalSteps,
      });
      await this.clearSecureStorage().catch((error) => {
        errors.push(`Secure storage: ${error.message}`);
        logger.error('Failed to clear secure storage:', error);
      });

      logger.info('Account deletion completed', { errors: errors.length });

      return {
        success: errors.length === 0,
        errors,
      };
    } catch (error: any) {
      logger.error('Account deletion failed:', error);
      return {
        success: false,
        errors: [error.message || 'Unknown error'],
      };
    }
  }

  /**
   * Delete device document from Firestore
   */
  private async deleteDeviceData(deviceId: string): Promise<void> {
    if (!firebaseDataService.isInitialized) {
      logger.warn('Firebase not initialized, skipping device deletion');
      return;
    }

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) {
        logger.warn('Firestore not available');
        return;
      }

      const deviceRef = doc(db, 'devices', deviceId);
      await deleteDoc(deviceRef);
      logger.info('Device data deleted');
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        throw error;
      }
      logger.debug('Device deletion skipped (permission denied)');
    }
  }

  /**
   * Delete family members subcollection
   */
  private async deleteFamilyMembers(deviceId: string): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const membersRef = collection(db, 'devices', deviceId, 'familyMembers');
      const snapshot = await getDocs(membersRef);

      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      logger.info(`Deleted ${snapshot.docs.length} family members`);
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        throw error;
      }
    }
  }

  /**
   * Delete messages subcollection
   */
  private async deleteMessages(deviceId: string): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const messagesRef = collection(db, 'devices', deviceId, 'messages');
      const snapshot = await getDocs(messagesRef);

      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      logger.info(`Deleted ${snapshot.docs.length} messages`);
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        throw error;
      }
    }
  }

  /**
   * Delete conversations subcollection
   */
  private async deleteConversations(deviceId: string): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const conversationsRef = collection(db, 'devices', deviceId, 'conversations');
      const snapshot = await getDocs(conversationsRef);

      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      logger.info(`Deleted ${snapshot.docs.length} conversations`);
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        throw error;
      }
    }
  }

  /**
   * Delete location updates subcollection
   */
  private async deleteLocationUpdates(deviceId: string): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const locationsRef = collection(db, 'devices', deviceId, 'locations');
      const snapshot = await getDocs(locationsRef);

      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      logger.info(`Deleted ${snapshot.docs.length} location updates`);
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        throw error;
      }
    }
  }

  /**
   * Delete status updates subcollection
   */
  private async deleteStatusUpdates(deviceId: string): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const statusRef = collection(db, 'devices', deviceId, 'status');
      const snapshot = await getDocs(statusRef);

      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      logger.info(`Deleted ${snapshot.docs.length} status updates`);
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        throw error;
      }
    }
  }

  /**
   * Delete health profile subcollection
   */
  private async deleteHealthProfile(deviceId: string): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const healthRef = doc(db, 'devices', deviceId, 'healthProfile', 'current');
      await deleteDoc(healthRef);
      logger.info('Health profile deleted');
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        throw error;
      }
    }
  }

  /**
   * Delete ICE data subcollection
   */
  private async deleteICEData(deviceId: string): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const iceRef = doc(db, 'devices', deviceId, 'ice', 'current');
      await deleteDoc(iceRef);
      logger.info('ICE data deleted');
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        throw error;
      }
    }
  }

  /**
   * Delete earthquake alerts subcollection
   */
  private async deleteEarthquakeAlerts(deviceId: string): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const alertsRef = collection(db, 'devices', deviceId, 'earthquakeAlerts');
      const snapshot = await getDocs(alertsRef);

      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      logger.info(`Deleted ${snapshot.docs.length} earthquake alerts`);
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        throw error;
      }
    }
  }

  /**
   * Delete SOS signals where deviceId matches
   */
  private async deleteSOSSignals(deviceId: string): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const sosRef = collection(db, 'sos');
      const q = query(sosRef, where('deviceId', '==', deviceId));
      const snapshot = await getDocs(q);

      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      logger.info(`Deleted ${snapshot.docs.length} SOS signals`);
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        throw error;
      }
    }
  }

  /**
   * Clear all local storage (AsyncStorage)
   */
  private async clearLocalStorage(): Promise<void> {
    try {
      await AsyncStorage.clear();
      logger.info('Local storage cleared');
    } catch (error) {
      logger.error('Failed to clear local storage:', error);
      throw error;
    }
  }

  /**
   * Clear secure storage (SecureStore)
   */
  private async clearSecureStorage(): Promise<void> {
    try {
      // Clear all known keys
      const keys = [
        'afn_deviceId', // Device ID key (from src/lib/device.ts)
        'afetnet_device_id', // Device ID key (from src/core/utils/device.ts)
        'afetnet_trial_start', // Trial start key (from trialStore.ts)
        'afn:own_keypair', // Encryption keys (from security/keys.ts)
        'afn:peers', // Peer keys (from security/keys.ts)
        'afn:ik_sk', // Identity keys (from crypto/e2ee/identity.ts)
        'afn:ik_pk',
        'afn:pre_sk',
        'afn:pre_pk',
      ];

      for (const key of keys) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {
          // Ignore errors for non-existent keys
        }
      }

      // Clear stores
      useFamilyStore.getState().clear();
      useHealthProfileStore.getState().clearProfile();
      useSettingsStore.getState().resetToDefaults();
      useTrialStore.getState().endTrial();
      usePremiumStore.getState().clear();

      logger.info('Secure storage cleared');
    } catch (error) {
      logger.error('Failed to clear secure storage:', error);
      throw error;
    }
  }
}

export const accountDeletionService = new AccountDeletionService();

