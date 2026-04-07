/**
 * ACCOUNT DELETION SERVICE - ELITE PRODUCTION
 * Comprehensive account deletion with Firebase data cleanup
 * GDPR compliant - complete data removal
 */

import { createLogger } from '../utils/logger';
import { firebaseDataService } from './FirebaseDataService';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import { deleteDoc, collection, query, where, getDocs, doc, updateDoc, arrayRemove, writeBatch, limit } from 'firebase/firestore';
import { deleteUser, signOut } from 'firebase/auth';
import { DirectStorage } from '../utils/storage';
import * as SecureStore from 'expo-secure-store';
import { getFirebaseAuth } from '../../lib/firebase';
import { useFamilyStore } from '../stores/familyStore';
import { useHealthProfileStore } from '../stores/healthProfileStore';
import { useSettingsStore } from '../stores/settingsStore';
import { usePremiumStore } from '../stores/premiumStore';
import { useMessageStore } from '../stores/messageStore';
import { useContactStore } from '../stores/contactStore';
import { useUserStatusStore } from '../stores/userStatusStore';
import { useEarthquakeStore } from '../stores/earthquakeStore';
import { useEEWHistoryStore } from '../stores/eewHistoryStore';
import { useMeshStore } from './mesh/MeshStore';

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

/** Thrown when Firebase Auth requires recent login to delete the account. */
export class ReauthRequiredError extends Error {
  constructor() {
    super('auth/requires-recent-login');
    this.name = 'ReauthRequiredError';
  }
}

class AccountDeletionService {
  /**
   * Delete all user account data
   * CRITICAL: GDPR compliant - complete data removal
   */
  async deleteAccount(
    deviceId: string,
    onProgress?: (progress: DeletionProgress) => void,
  ): Promise<{ success: boolean; errors: string[]; reauthRequired?: boolean }> {
    const errors: string[] = [];
    let progress = 0;
    const totalSteps = 19;
    // CRITICAL: Capture UID NOW, before auth deletion nullifies it
    const capturedUid = getFirebaseAuth()?.currentUser?.uid || '';

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

      // Step 14: V3 — Remove user from conversations & clean up orphans
      progress++;
      onProgress?.({
        step: 'V3 konuşmalar temizleniyor...',
        progress,
        total: totalSteps,
      });
      await this.deleteV3Conversations().catch((error) => {
        errors.push(`V3 conversations: ${error.message}`);
        logger.error('Failed to delete V3 conversations:', error);
      });

      // Step 15: Delete user profile
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

      // Step 16: Delete Firebase Storage user files (media, voice, images)
      progress++;
      onProgress?.({
        step: 'Medya dosyaları siliniyor...',
        progress,
        total: totalSteps,
      });
      try {
        const { getStorage, ref, listAll, deleteObject } = await import('firebase/storage');
        const storage = getStorage();
        const uid = capturedUid;

        if (uid) {
          // Delete files from common user upload paths
          const userPaths = [
            `users/${uid}/`,
            `chat/${uid}/`,
            `voice/${uid}/`,
            `profile/${uid}/`,
            `sos/${uid}/`,
          ];

          for (const path of userPaths) {
            try {
              const folderRef = ref(storage, path);
              const result = await listAll(folderRef);
              const deletePromises = result.items.map(item => deleteObject(item).catch(() => {}));
              await Promise.all(deletePromises);
              // Also handle nested prefixes (subdirectories)
              for (const prefix of result.prefixes) {
                const subResult = await listAll(prefix);
                await Promise.all(subResult.items.map(item => deleteObject(item).catch(() => {})));
              }
            } catch (e) {
              // Folder may not exist, continue
              if (__DEV__) console.debug(`Storage cleanup for ${path} skipped:`, e);
            }
          }
          logger.info('Firebase Storage user files deleted');
        }
      } catch (storageError) {
        // Storage cleanup failure should NOT block account deletion
        if (__DEV__) console.debug('Storage cleanup failed (non-blocking):', storageError);
      }

      // Step 17: Delete Firebase Auth account
      progress++;
      onProgress?.({
        step: 'Kimlik hesabı siliniyor...',
        progress,
        total: totalSteps,
      });
      let reauthRequired = false;
      try {
        await this.deleteFirebaseAuthAccount();
      } catch (error: unknown) {
        if (error instanceof ReauthRequiredError) {
          // Don't sign out, don't clear local storage yet.
          // Return early so UI can prompt re-auth, then call retryDeleteAuthAccount().
          logger.warn('Auth deletion requires re-authentication — returning to UI for re-auth prompt');
          reauthRequired = true;
        } else {
          const errMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Auth account: ${errMsg}`);
          logger.error('Failed to delete auth account:', error);
        }
      }

      // If re-auth is needed, skip local cleanup (steps 18-19) so the user
      // stays logged in and can re-authenticate. After successful re-auth + retry,
      // the caller should invoke clearLocalDataAfterDeletion() to finish cleanup.
      if (reauthRequired) {
        return {
          success: false,
          errors: ['auth/requires-recent-login'],
          reauthRequired: true,
        };
      }

      // Step 18: Clear local storage
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

      // Step 19: Clear secure storage
      progress++;
      onProgress?.({
        step: 'Güvenli depolama temizleniyor...',
        progress,
        total: totalSteps,
      });
      await this.clearSecureStorage(capturedUid).catch((error) => {
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

    const auth = getFirebaseAuth();
    if (!auth) {
      logger.warn('Firebase auth not available, skipping user profile deletion');
      return;
    }

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
   * If requires-recent-login is encountered, throws ReauthRequiredError
   * so the caller (SettingsScreen) can prompt re-authentication and retry
   * via retryDeleteAuthAccount().
   *
   * IMPORTANT: Does NOT sign the user out on failure — that would leave
   * an orphaned auth shell that the user can never delete.
   */
  private async deleteFirebaseAuthAccount(): Promise<void> {
    const auth = getFirebaseAuth();
    if (!auth) {
      logger.warn('Firebase auth not available, skipping auth deletion');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      logger.warn('No authenticated user, skipping auth deletion');
      return;
    }

    try {
      await deleteUser(user);
      await signOut(auth).catch(e => { if (__DEV__) logger.debug('Sign-out after delete failed:', e); });
      logger.info('Firebase auth account deleted');
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code === 'auth/requires-recent-login') {
        logger.warn('requires-recent-login — caller must re-authenticate and call retryDeleteAuthAccount()');
        // Do NOT sign out here. The user stays logged in so re-auth + retry is possible.
        throw new ReauthRequiredError();
      } else {
        throw error;
      }
    }
  }

  /**
   * PUBLIC: Retry auth account deletion after the user has re-authenticated.
   * Called by UI after successful re-auth (Google/Apple/Email).
   * At this point all Firestore data is already gone (Steps 1-15 ran previously).
   */
  async retryDeleteAuthAccount(): Promise<void> {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase auth not available');

    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const uid = user.uid;
    await deleteUser(user);
    await signOut(auth).catch(e => { if (__DEV__) logger.debug('Sign-out after delete failed:', e); });
    logger.info('Firebase auth account deleted (after re-auth retry)');

    // Now finish local cleanup (was deferred when reauthRequired was returned)
    await this.clearLocalDataAfterDeletion(uid);
  }

  /**
   * PUBLIC: Clear local data after auth account is successfully deleted.
   * Called after retryDeleteAuthAccount() succeeds, or can be called
   * standalone if the user gives up on re-auth and wants to sign out.
   */
  async clearLocalDataAfterDeletion(uid?: string): Promise<void> {
    const resolvedUid = uid || getFirebaseAuth()?.currentUser?.uid || '';
    try {
      await this.clearLocalStorage();
    } catch (error) {
      logger.error('Failed to clear local storage during post-deletion cleanup:', error);
    }
    try {
      await this.clearSecureStorage(resolvedUid);
    } catch (error) {
      logger.error('Failed to clear secure storage during post-deletion cleanup:', error);
    }
    logger.info('Local data cleared after account deletion');
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
      await Promise.allSettled(deletePromises);
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
      await Promise.allSettled(deletePromises);
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
      await Promise.allSettled(deletePromises);
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
      await Promise.allSettled(deletePromises);
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
      await Promise.allSettled(deletePromises);
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
      await Promise.allSettled(deletePromises);
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
      await Promise.allSettled(deletePromises);
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

    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!uid) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const threadsRef = collection(db, 'user_inbox', uid, 'threads');
      const snapshot = await getDocs(threadsRef);

      const deletePromises = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.allSettled(deletePromises);

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

    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!uid) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      // Delete V3 push tokens
      const pushTokensRef = collection(db, 'push_tokens', uid, 'devices');
      const pushSnapshot = await getDocs(pushTokensRef);
      await Promise.allSettled(pushSnapshot.docs.map((d) => deleteDoc(d.ref)));

      // Delete legacy FCM token (flat doc, not subcollection)
      await deleteDoc(doc(db, 'fcm_tokens', uid)).catch(() => {});

      logger.info(`V3: Deleted ${pushSnapshot.docs.length} push tokens + legacy FCM token`);
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

    const uid = getFirebaseAuth()?.currentUser?.uid;
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
          await Promise.allSettled(snap.docs.map((d) => deleteDoc(d.ref)));
          return snap.docs.length;
        } catch { return 0; }
      };

      const userPath = `users/${uid}`;

      // Delete all users/{uid} subcollections
      const subcollections = [
        'contacts', 'blocked', 'reactions', 'contactRequests',
        'notifications', 'familyMembers', 'familyIds',
        'health', 'ice', 'status', 'status_updates', 'settings',
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
        await Promise.allSettled(sosSnap.docs.map((d) => deleteDoc(d.ref)));
        totalDeleted += sosSnap.docs.length;
      } catch { /* sos_signals cleanup is best-effort */ }

      // Delete SOS broadcasts created by this user
      try {
        const sosBroadcastsRef = collection(db, 'sos_broadcasts');
        const sbQuery = query(sosBroadcastsRef, where('senderUid', '==', uid), limit(500));
        const sbSnapshot = await getDocs(sbQuery);
        if (sbSnapshot.size > 0) {
          const sbBatch = writeBatch(db);
          sbSnapshot.docs.forEach(d => sbBatch.delete(d.ref));
          await sbBatch.commit();
          totalDeleted += sbSnapshot.size;
        }
      } catch { /* sos_broadcasts cleanup is best-effort */ }

      logger.info(`V3: Comprehensive cleanup — ${totalDeleted} documents deleted for uid=${uid}`);
    } catch (error: unknown) {
      const fbError = error as FirebaseError;
      if (fbError?.code !== 'permission-denied') throw error;
    }
  }

  /**
   * V3: Remove user from all conversations and delete orphaned ones.
   * - For DM conversations (2 participants): delete the entire conversation + messages
   * - For group conversations (3+ participants): remove user from participants array
   * This prevents orphaned conversations and phantom chat issues for other users.
   */
  private async deleteV3Conversations(): Promise<void> {
    if (!firebaseDataService.isInitialized) return;

    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!uid) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      // Find ALL conversations where user is a participant
      const convsRef = collection(db, 'conversations');
      const q = query(convsRef, where('participants', 'array-contains', uid));
      const snapshot = await getDocs(q);

      let deleted = 0;
      let removed = 0;

      for (const convDoc of snapshot.docs) {
        const data = convDoc.data();
        const participants: string[] = data?.participants || [];

        try {
          if (participants.length <= 2) {
            // DM or 1-on-1: Delete conversation messages subcollection first
            const msgsRef = collection(db, 'conversations', convDoc.id, 'messages');
            const msgsSnap = await getDocs(msgsRef);
            await Promise.allSettled(msgsSnap.docs.map(m => deleteDoc(m.ref)));
            // Then delete conversation document
            await deleteDoc(convDoc.ref);
            deleted++;
          } else {
            // Group: Remove user from participants array (don't delete for other members)
            await updateDoc(convDoc.ref, {
              participants: arrayRemove(uid),
            });
            removed++;
          }
        } catch (convError) {
          logger.warn(`Failed to clean conversation ${convDoc.id}:`, convError);
        }
      }

      logger.info(`V3: Conversations cleanup — ${deleted} deleted, ${removed} user removed from groups`);
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
  private async clearSecureStorage(uid: string): Promise<void> {
    try {
      // AUTHORITATIVE: Purge ALL security keys via single cleanup function
      const { purgeUserSecurityKeys } = await import('./security/SecurityKeyCleanup');
      await purgeUserSecurityKeys(uid);

      // Additional legacy device/identity keys (not user-scoped, but account-related)
      const legacyKeys = [
        'afn_deviceId',
        'afetnet_device_id',
        'afetnet_trial_start',
        'afn:own_keypair',
        'afn:peers',
        'afn:ik_sk',
        'afn:ik_pk',
        'afn:pre_sk',
        'afn:pre_pk',
      ];

      for (const key of legacyKeys) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {
          // Ignore errors for non-existent keys
        }
      }

      // Clear ALL user-scoped stores (GDPR/KVKK compliance)
      await useFamilyStore.getState().clear();
      await useHealthProfileStore.getState().clearProfile();
      useSettingsStore.getState().resetToDefaults();
      usePremiumStore.getState().clear();
      await useMessageStore.getState().clear();
      await useContactStore.getState().clearLocalCache();
      useUserStatusStore.getState().reset();
      useEarthquakeStore.getState().clear();
      useEEWHistoryStore.getState().clearHistory();
      useMeshStore.getState().clearMessages();

      logger.info('Secure storage cleared');
    } catch (error) {
      logger.error('Failed to clear secure storage:', error);
      throw error;
    }
  }
}

export const accountDeletionService = new AccountDeletionService();
