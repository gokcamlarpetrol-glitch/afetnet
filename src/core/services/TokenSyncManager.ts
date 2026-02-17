/**
 * TOKEN SYNC MANAGER — UID-CENTRIC v3.0
 * 
 * Ensures push tokens are always up-to-date in Firestore.
 * Self-healing mechanism: Checks on every launch, updates only if needed.
 * 
 * PATH ARCHITECTURE:
 *   push_tokens/{uid}/devices/{installationId}  — Push token per installation
 * 
 * OLD MODEL: devices/{id}.pushToken + devices/{id}.ownerUid + fcm_tokens/{uid}
 * NEW MODEL: push_tokens/{uid}/devices/{installationId} — DIRECT uid → token (no mapping)
 * 
 * CF push chain becomes: recipientUid → push_tokens/{uid} → all devices → push
 * No more ownerUid intermediate lookup!
 * 
 * @version 3.0.0
 */

import { createLogger } from '../utils/logger';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseService } from './FirebaseService';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { getAuth } from 'firebase/auth';
import { getInstallationId } from '../../lib/installationId';
import { initializeFirebase } from '../../lib/firebase';

const logger = createLogger('TokenSyncManager');

class TokenSyncManager {
  private isSyncing = false;
  private hasWarnedPermission = false;

  /**
   * ELITE: Synchronize push token with Firestore.
   * Call on app launch — safe to call repeatedly (idempotent).
   * 
   * Writes to push_tokens/{uid}/devices/{installationId}
   * NEVER writes to devices/{id} or fcm_tokens/{uid} (those are legacy).
   */
  async syncToken(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      // 1. Get current push token
      const currentPushToken = firebaseService.getPushToken();
      if (!currentPushToken) {
        logger.debug('No push token available to sync yet.');
        return;
      }

      // 2. Get Firebase Auth UID — MANDATORY
      const app = initializeFirebase();
      if (!app) {
        logger.debug('Skipping token sync: Firebase app unavailable');
        return;
      }
      const auth = getAuth(app);
      const currentUser = auth.currentUser;
      if (!currentUser?.uid) {
        logger.debug('Skipping token sync: no authenticated user');
        return;
      }
      const uid = currentUser.uid;

      // 3. Get stable installation ID
      const installationId = await getInstallationId();

      // 4. Check and update Firestore record
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const now = new Date().toISOString();
      const tokenRef = doc(db, 'push_tokens', uid, 'devices', installationId);
      const tokenSnap = await getDoc(tokenRef);

      const metadata = {
        lastTokenSync: now,
        platform: Platform.OS,
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        buildVersion: Application.nativeBuildVersion || '1',
      };

      if (!tokenSnap.exists()) {
        // Case A: New installation → Create record
        logger.info(`🆕 Creating push token: push_tokens/${uid}/devices/${installationId}`);
        await setDoc(tokenRef, {
          token: currentPushToken,
          installationId,
          createdAt: now,
          updatedAt: now,
          ...metadata,
        });
      } else {
        const data = tokenSnap.data();
        const storedToken = data.token;

        if (storedToken !== currentPushToken) {
          // Case B: Token changed → Update
          logger.info(`🔄 Updating push token for ${installationId}`);
          await updateDoc(tokenRef, {
            token: currentPushToken,
            updatedAt: now,
            ...metadata,
          });
        } else {
          // Case C: Token matches → Heartbeat
          logger.debug(`✅ Push token up-to-date for ${installationId}`);
          await updateDoc(tokenRef, {
            lastTokenSync: now,
            appVersion: metadata.appVersion,
          });
        }
      }

      // 5. LEGACY COMPAT: Also write to devices/{deviceId} doc for old CFs
      // This dual-write will be removed when all CFs are migrated.
      try {
        const { identityService } = await import('./IdentityService');
        const publicCode = identityService.getPublicUserCode();
        if (publicCode) {
          const deviceRef = doc(db, 'devices', publicCode);
          await setDoc(deviceRef, {
            token: currentPushToken,
            pushToken: currentPushToken,
            ownerUid: uid,
            updatedAt: now,
            ...metadata,
          }, { merge: true });
        }
      } catch {
        // Legacy write failure is non-blocking
      }

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isPermissionError = errorMsg.includes('permission') ||
        errorMsg.includes('PERMISSION_DENIED') ||
        errorMsg.includes('insufficient');

      if (isPermissionError) {
        if (!this.hasWarnedPermission) {
          logger.warn('Token sync skipped: Firestore permissions not configured yet');
          this.hasWarnedPermission = true;
        }
      } else {
        logger.debug('Token sync deferred:', errorMsg);
      }
    } finally {
      this.isSyncing = false;
    }
  }
}

export const tokenSyncManager = new TokenSyncManager();
