/**
 * SETTINGS SYNC SERVICE — Cloud Persistence for User Preferences
 *
 * Syncs cross-device-relevant settings to Firestore for preservation across devices.
 * Uses debounced writes to minimize Firestore operations.
 *
 * Firestore path: users/{uid}/settings/current
 *
 * Architecture:
 * - On init: Load from Firestore → apply to local store (new device scenario)
 * - On local change: 5s debounce → write to Firestore
 * - On background/logout: Immediate flush
 * - Write-back loop prevention: isLoadingFromCloud flag
 * - Hash-based dedup: Skip redundant writes
 *
 * @version 1.0.0
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import { initializeFirebase, getFirebaseAuth } from '../../lib/firebase';
import { useSettingsStore } from '../stores/settingsStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import { createLogger } from '../utils/logger';

const logger = createLogger('SettingsSyncService');

// Keys that are worth syncing (cross-device relevant, NOT device-specific)
const SYNCABLE_KEYS = [
  // Core preferences
  'language',
  'eulaAccepted',

  // Notification preferences
  'notificationsEnabled',
  'eewEnabled',
  'earthquakeMonitoringEnabled',
  'notificationMode',
  'notificationSoundType',
  'notificationSoundVolume',
  'notificationSoundRepeat',
  'notificationPush',
  'notificationFullScreen',
  'notificationSound',
  'notificationVibration',
  'notificationTTS',

  // Earthquake thresholds
  'minMagnitudeForNotification',
  'maxDistanceForNotification',
  'criticalMagnitudeThreshold',
  'criticalDistanceThreshold',
  'eewMinMagnitude',

  // Source selection
  'sourceAFAD',
  'sourceUSGS',
  'sourceEMSC',
  'sourceKOERI',
  'sourceCommunity',
  'selectedObservatory',

  // Quiet hours
  'quietHoursEnabled',
  'quietHoursStart',
  'quietHoursEnd',
  'quietHoursCriticalOnly',

  // Priority
  'priorityCritical',
  'priorityHigh',
  'priorityMedium',
  'priorityLow',

  // Accessibility
  'fontScale',
  'highContrastEnabled',

  // Notification display
  'magnitudeBasedSound',
  'magnitudeBasedVibration',
  'notificationShowOnLockScreen',
  'notificationShowPreview',
  'notificationGroupByMagnitude',

  // News & features
  'newsEnabled',
  'pdrEnabled',
  'proximityAlertsEnabled',
  'aiHazardEnabled',

  // Social
  'blockedUsers',
] as const;

class SettingsSyncService {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private storeUnsubscribe: (() => void) | null = null;
  private isLoadingFromCloud = false;
  private isInitialized = false;
  private lastSyncedHash = '';

  /**
   * Initialize: Load cloud settings, then subscribe to local changes.
   * Call AFTER auth is confirmed (init.ts Phase B).
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const auth = getFirebaseAuth();
    const uid = auth?.currentUser?.uid;
    if (!uid) {
      logger.debug('No authenticated user — settings sync skipped');
      return;
    }

    // Step 1: Load existing cloud settings (handles new device scenario)
    await this.loadFromCloud(uid);

    // Step 2: Subscribe to local store changes for debounced cloud write
    this.subscribeToLocalChanges(uid);

    this.isInitialized = true;
    logger.info('✅ Settings cloud sync initialized');
  }

  /**
   * Load settings from Firestore and apply to local store.
   */
  private async loadFromCloud(uid: string): Promise<void> {
    try {
      const app = initializeFirebase();
      if (!app) return;

      const db = await getFirestoreInstanceAsync();
      if (!db) return;
      const settingsRef = doc(db, 'users', uid, 'settings', 'current');
      const snapshot = await getDoc(settingsRef);

      if (!snapshot.exists()) {
        // First device or no cloud settings yet — upload current local settings as baseline
        if (__DEV__) logger.debug('No cloud settings found — uploading local as baseline');
        await this.writeToCloud(uid);
        return;
      }

      const cloudData = snapshot.data();

      this.isLoadingFromCloud = true;
      try {
        // Apply syncable settings to local store via setState (batch update)
        const settingsUpdate: Record<string, any> = {};
        const currentState = useSettingsStore.getState();

        for (const key of SYNCABLE_KEYS) {
          if (cloudData[key] !== undefined) {
            // CRITICAL GUARD: Never downgrade eulaAccepted from true→false via cloud sync.
            // Once EULA is accepted locally, cloud data must not un-accept it (could show
            // EULA modal mid-use if cloud document is stale/corrupt).
            if (key === 'eulaAccepted' && (currentState as any).eulaAccepted === true && cloudData[key] !== true) {
              continue;
            }
            // Only apply if value differs from current (avoid unnecessary renders)
            if (JSON.stringify(cloudData[key]) !== JSON.stringify((currentState as any)[key])) {
              settingsUpdate[key] = cloudData[key];
            }
          }
        }

        if (Object.keys(settingsUpdate).length > 0) {
          useSettingsStore.setState(settingsUpdate);
          logger.info(`☁️ Cloud settings applied (${Object.keys(settingsUpdate).length} keys)`);
        }

        // Handle onboarding state
        if (cloudData.onboardingCompleted === true) {
          const onboardingState = useOnboardingStore.getState();
          if (!onboardingState.completed) {
            onboardingState.setCompleted(true);
            logger.info('☁️ Onboarding marked complete from cloud');
          }
        }
      } finally {
        this.isLoadingFromCloud = false;
      }
    } catch (error) {
      logger.error('Failed to load cloud settings:', error);
    }
  }

  /**
   * Subscribe to local Zustand store changes with debounced cloud write.
   */
  private subscribeToLocalChanges(uid: string): void {
    this.storeUnsubscribe?.();

    this.storeUnsubscribe = useSettingsStore.subscribe((state, prevState) => {
      if (this.isLoadingFromCloud) return;

      // Check if any syncable key actually changed
      const hasChange = SYNCABLE_KEYS.some(
        key => JSON.stringify((state as any)[key]) !== JSON.stringify((prevState as any)[key])
      );
      if (!hasChange) return;

      this.scheduleDebouncedSync(uid);
    });
  }

  /**
   * Schedule a debounced write (5 seconds after last change).
   */
  private scheduleDebouncedSync(uid: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      this.writeToCloud(uid).catch(error => {
        logger.error('Debounced settings sync failed:', error);
      });
    }, 5000);
  }

  /**
   * Write current syncable settings to Firestore.
   */
  private async writeToCloud(uid: string): Promise<void> {
    try {
      const app = initializeFirebase();
      if (!app) return;

      const state = useSettingsStore.getState();
      const syncData: Record<string, any> = {};

      for (const key of SYNCABLE_KEYS) {
        syncData[key] = (state as any)[key];
      }

      // Include onboarding state
      syncData.onboardingCompleted = useOnboardingStore.getState().completed;
      syncData.updatedAt = new Date().toISOString();

      // Hash-based dedup — skip if nothing changed
      const hash = JSON.stringify(syncData);
      if (hash === this.lastSyncedHash) return;

      const db = await getFirestoreInstanceAsync();
      if (!db) return;
      const settingsRef = doc(db, 'users', uid, 'settings', 'current');
      await setDoc(settingsRef, syncData, { merge: true });

      this.lastSyncedHash = hash;
      if (__DEV__) logger.debug('☁️ Settings synced to cloud');
    } catch (error) {
      logger.error('Failed to write settings to cloud:', error);
    }
  }

  /**
   * Force immediate sync (call on app background or logout).
   */
  async flushSync(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const auth = getFirebaseAuth();
    const uid = auth?.currentUser?.uid;
    if (!uid) return;

    await this.writeToCloud(uid);
  }

  /**
   * Cleanup: unsubscribe and cancel pending timers.
   */
  cleanup(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.storeUnsubscribe?.();
    this.storeUnsubscribe = null;
    this.isInitialized = false;
    this.lastSyncedHash = '';
  }
}

export const settingsSyncService = new SettingsSyncService();
