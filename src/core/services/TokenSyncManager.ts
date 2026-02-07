/**
 * TOKEN SYNC MANAGER - ELITE RELIABILITY
 * Ensures push tokens are always up-to-date in Firestore.
 * Self-healing mechanism: Checks on every launch, updates only if needed.
 */

import { createLogger } from '../utils/logger';
import { getDeviceId } from '../../lib/device';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { firebaseService } from './FirebaseService';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { getAuth } from 'firebase/auth';
import { initializeFirebase } from '../../lib/firebase';

const logger = createLogger('TokenSyncManager');

class TokenSyncManager {
  private isSyncing = false;

  /**
     * ELITE: Synchronize token with Firestore
     * Call this on app launch. It's safe to call repeatedly (idempotent).
     */
  async syncToken(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      // 1. Get current valid push token
      // We assume FirebaseService has already initialized and fetched the token
      const currentPushToken = firebaseService.getPushToken();

      if (!currentPushToken) {
        logger.debug('No push token available to sync yet.');
        return;
      }

      // 2. Get stable Device ID (The Vault)
      const deviceId = await getDeviceId();
      if (!deviceId) {
        logger.error('Failed to get Device ID for token sync');
        return;
      }

      // 2.1 Auth context is mandatory for owner-bound device documents
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
      const ownerUid = currentUser.uid;

      // 3. Check Firestore record
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const deviceRef = doc(db, 'devices', deviceId);
      const deviceSnap = await getDoc(deviceRef);

      const now = new Date().toISOString();
      const metadata = {
        lastTokenSync: now,
        platform: Platform.OS,
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        buildVersion: Application.nativeBuildVersion || '1',
      };

      if (!deviceSnap.exists()) {
        // Case A: New Device -> Create Record
        logger.info(`🆕 Creating new device record for ${deviceId}`);
        await setDoc(deviceRef, {
          token: currentPushToken, // Legacy field
          pushToken: currentPushToken,
          deviceId: deviceId,
          ownerUid,
          createdAt: now,
          updatedAt: now,
          ...metadata,
        });
      } else {
        // Case B: Existing Device -> Check if token changed
        const data = deviceSnap.data();
        const storedToken = data.pushToken || data.token; // Check both new and old fields

        if (storedToken !== currentPushToken) {
          // Token outdated! Update it.
          logger.info(`🔄 Updating outdated push token for ${deviceId}`);
          await updateDoc(deviceRef, {
            token: currentPushToken,
            pushToken: currentPushToken,
            ownerUid,
            updatedAt: now,
            ...metadata,
          });
        } else {
          // Token matches. Just heartbeat timestamp occasionally (e.g., once a week)
          // For now, we update 'lastTokenSync' to prove aliveness
          logger.debug(`✅ Token is up-to-date for ${deviceId}`);
          await updateDoc(deviceRef, {
            ownerUid,
            lastTokenSync: now,
            // Optional: Update versions if changed
            appVersion: metadata.appVersion,
          });
        }
      }

    } catch (error) {
      logger.error('Token sync failed:', error);
      // Silent fail - will retry next launch
    } finally {
      this.isSyncing = false;
    }
  }
}

export const tokenSyncManager = new TokenSyncManager();
