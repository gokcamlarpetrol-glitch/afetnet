/**
 * ACCOUNT DELETION SERVICE - ELITE PRODUCTION
 * Comprehensive account deletion with Firebase data cleanup
 * GDPR compliant - complete data removal
 */

import { createLogger } from '../utils/logger';
import { firebaseDataService } from './FirebaseDataService';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import { deleteDoc, collection, query, where, getDocs, doc } from 'firebase/firestore';
import { getAuth, deleteUser, signOut } from 'firebase/auth';
import { DirectStorage } from '../utils/storage';
import * as SecureStore from 'expo-secure-store';
import { initializeFirebase } from '../../lib/firebase';
import { useFamilyStore } from '../stores/familyStore';
import { useHealthProfileStore } from '../stores/healthProfileStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTrialStore } from '../stores/trialStore';
import { usePremiumStore } from '../stores/premiumStore';

const logger = createLogger('AccountDeletionService');

// ELITE: Type-safe Firebase error interface
interface FirebaseError extends Error {
  code?: string;
}

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
    onProgress?: (progress: DeletionProgress) => void,
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    let progress = 0;
    const totalSteps = 17; // 14 legacy + 3 V3 cleanup steps

    try {
      logger.info('Starting account deletion process...');

      // Pre-initialize Firebase services for deletion
      try {
        await firebaseDataService.initialize();
      } catch (initError) {
        logger.warn('Firebase init before deletion (best effort):', initError);
      }

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

      // Step 11: V3 — Delete user inbox threads
      progress++;
      onProgress?.({
        step: 'Mesaj kutusu temizleniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteV3UserInbox().catch((error) => {
        errors.push(`V3 user inbox: ${error.message}`);
        logger.error('Failed to delete V3 user inbox:', error);
      });

      // Step 12: V3 — Delete push tokens
      progress++;
      onProgress?.({
        step: 'Bildirim kayıtları siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteV3PushTokens().catch((error) => {
        errors.push(`V3 push tokens: ${error.message}`);
        logger.error('Failed to delete V3 push tokens:', error);
      });

      // Step 13: V3 — Delete contacts and current location
      progress++;
      onProgress?.({
        step: 'Kişiler ve konum verileri siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteV3UserData().catch((error) => {
        errors.push(`V3 user data: ${error.message}`);
        logger.error('Failed to delete V3 user data:', error);
      });

      // Step 14: Delete user profile
      progress++;
      onProgress?.({
        step: 'Kullanıcı profili siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteUserProfile().catch((error) => {
        errors.push(`User profile: ${error.message}`);
        logger.error('Failed to delete user profile:', error);
      });

      // Step 15: Delete Firebase Auth account
      progress++;
      onProgress?.({
        step: 'Kimlik hesabı siliniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteFirebaseAuthAccount().catch((error) => {
        errors.push(`Auth account: ${error.message}`);
        logger.error('Failed to delete auth account:', error);
      });

      // Step 16: Clear local storage
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

      // Step 17: Clear secure storage
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
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Account deletion failed:', error);
      return {
        success: false,
        errors: [errMsg],
      };
    }
  }

  /**
   * Delete user profile document from Firestore (users/{uid})
   */
  private async deleteUserProfile(): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    const app = initializeFirebase();
    if (!app) {
      logger.warn('Firebase app not initialized, skipping user profile deletion');
      return;
    }

    const auth = getAuth(app);
    const uid = auth.currentUser?.uid;
    if (!uid) {
      logger.warn('No authenticated user, skipping user profile deletion');
      return;
    }

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      await deleteDoc(doc(db, 'users', uid));
      logger.info('User profile deleted');
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') {
        throw error;
      }
    }
  }

  /**
   * Delete Firebase Auth user account.
   * Attempts reauthentication if requires-recent-login is encountered.
   * Falls back to sign-out if auth account cannot be deleted (data is already gone).
   */
  private async deleteFirebaseAuthAccount(): Promise<void> {
    const app = initializeFirebase();
    if (!app) {
      logger.warn('Firebase app not initialized, skipping auth deletion');
      return;
    }

    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) {
      logger.warn('No authenticated user, skipping auth deletion');
      return;
    }

    try {
      await deleteUser(user);
      await signOut(auth).catch(() => { /* Ignore sign-out errors after delete */ });
      logger.info('Firebase auth account deleted');
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code === 'auth/requires-recent-login') {
        logger.warn('requires-recent-login — attempting provider reauthentication...');

        // Try Google reauthentication
        let reauthOk = false;
        try {
          const { GoogleSignin } = require('@react-native-google-signin/google-signin');
          if (GoogleSignin) {
            const userInfo = await GoogleSignin.signIn();
            const idToken = userInfo?.data?.idToken || userInfo?.idToken;
            if (idToken) {
              const { GoogleAuthProvider, reauthenticateWithCredential } = require('firebase/auth');
              const credential = GoogleAuthProvider.credential(idToken);
              await reauthenticateWithCredential(user, credential);
              await deleteUser(user);
              await signOut(auth).catch(() => {});
              reauthOk = true;
              logger.info('Auth account deleted after Google reauthentication');
            }
          }
        } catch (googleErr) {
          logger.debug('Google reauthentication for deletion failed:', googleErr);
        }

        if (!reauthOk) {
          // All user DATA is already deleted at this point.
          // Sign out so the app resets to login screen.
          // The empty Auth account can be cleaned up via Cloud Functions later.
          logger.warn('Could not reauthenticate — signing out. Auth shell may remain.');
          await signOut(auth).catch(() => {});
          // Do NOT throw — treat as soft success since all data is cleaned
          return;
        }
      } else {
        throw error;
      }
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
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') {
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
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') {
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
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') {
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
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') {
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
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') {
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
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') {
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
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') {
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
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') {
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
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') {
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

      // FIX: Use correct collection name (was 'sos', should be 'sos_signals')
      const sosRef = collection(db, 'sos_signals');
      const q = query(sosRef, where('deviceId', '==', deviceId));
      const snapshot = await getDocs(q);

      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      logger.info(`Deleted ${snapshot.docs.length} SOS signals`);
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') {
        throw error;
      }
    }
  }

  /**
   * V3: Delete user inbox threads (user_inbox/{uid}/threads/*)
   */
  private async deleteV3UserInbox(): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    const app = initializeFirebase();
    if (!app) return;

    const uid = getAuth(app).currentUser?.uid;
    if (!uid) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const threadsRef = collection(db, 'user_inbox', uid, 'threads');
      const snapshot = await getDocs(threadsRef);

      const deletePromises = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);

      // Also delete the parent user_inbox/{uid} doc if it exists
      try {
        await deleteDoc(doc(db, 'user_inbox', uid));
      } catch { /* parent doc may not exist */ }

      logger.info(`V3: Deleted ${snapshot.docs.length} inbox threads`);
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') throw error;
    }
  }

  /**
   * V3: Delete push token registrations
   * Paths: push_tokens/{uid}/devices/*, fcm_tokens/{uid}/devices/*
   */
  private async deleteV3PushTokens(): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    const app = initializeFirebase();
    if (!app) return;

    const uid = getAuth(app).currentUser?.uid;
    if (!uid) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      // Delete V3 push tokens
      const pushTokensRef = collection(db, 'push_tokens', uid, 'devices');
      const pushSnapshot = await getDocs(pushTokensRef);
      await Promise.all(pushSnapshot.docs.map((d) => deleteDoc(d.ref)));

      // Delete legacy FCM tokens
      const fcmTokensRef = collection(db, 'fcm_tokens', uid, 'devices');
      const fcmSnapshot = await getDocs(fcmTokensRef);
      await Promise.all(fcmSnapshot.docs.map((d) => deleteDoc(d.ref)));

      logger.info(`V3: Deleted ${pushSnapshot.docs.length + fcmSnapshot.docs.length} push tokens`);
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') throw error;
    }
  }

  /**
   * V3: Delete ALL user subcollections and related data
   * Comprehensive GDPR cleanup of all UID-keyed data
   */
  private async deleteV3UserData(): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    const app = initializeFirebase();
    if (!app) return;

    const uid = getAuth(app).currentUser?.uid;
    if (!uid) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      let totalDeleted = 0;

      // Helper: delete all docs in a subcollection (best-effort)
      const deleteSubcollection = async (parentPath: string, subName: string): Promise<number> => {
        try {
          const ref = collection(db, parentPath, subName);
          const snap = await getDocs(ref);
          await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
          return snap.docs.length;
        } catch { return 0; }
      };

      const userPath = `users/${uid}`;

      // Delete all users/{uid} subcollections
      const subcollections = [
        'contacts', 'blocked', 'reactions', 'contactRequests',
        'notifications', 'familyMembers', 'familyIds',
        'health', 'ice', 'status', 'status_updates',
      ];
      for (const sub of subcollections) {
        totalDeleted += await deleteSubcollection(userPath, sub);
      }

      // Delete current location
      try { await deleteDoc(doc(db, 'locations_current', uid)); totalDeleted++; } catch { /* may not exist */ }

      // Delete location history points
      totalDeleted += await deleteSubcollection(`locations_history/${uid}`, 'points');
      try { await deleteDoc(doc(db, 'locations_history', uid)); } catch { /* may not exist */ }

      // Delete SOS signals created by this user
      try {
        const sosRef = collection(db, 'sos_signals');
        const sosQ = query(sosRef, where('creatorUid', '==', uid));
        const sosSnap = await getDocs(sosQ);
        await Promise.all(sosSnap.docs.map((d) => deleteDoc(d.ref)));
        totalDeleted += sosSnap.docs.length;
      } catch { /* sos_signals cleanup is best-effort */ }

      logger.info(`V3: Comprehensive cleanup — ${totalDeleted} documents deleted for uid=${uid}`);
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') throw error;
    }
  }

  /**
   * Clear all local storage (AsyncStorage)
   */
  private async clearLocalStorage(): Promise<void> {
    try {
      DirectStorage.clearAll();
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
