/**
 * Core Initialization
 * Phase-based service startup with dependency management.
 * Uses dynamic imports to prevent circular deps and improve startup time.
 */

import { createLogger, setLogLevel } from './utils/logger';
import { useAppStore } from './stores/appStore';
import { useSettingsStore } from './stores/settingsStore';
import { Platform } from 'react-native';

const logger = createLogger('Init');

// ---------------------------------------------------------------------------
// Module-level service references (needed by shutdownApp / settings listener)
// ---------------------------------------------------------------------------
let earthquakeService: any;
let bleMeshService: any;
let locationService: any;
let plumEEWService: any;
let multiSourceEEWService: any;
let realtimeEarthquakeMonitor: any;
let realTimeEEWConnection: any;
let onDeviceSeismicDetector: any;
let crowdsourcedSeismicNetwork: any;
let backgroundSeismicMonitor: any;
let multiSourceBleAutoUnsubscribe: (() => void) | null = null;
// CRITICAL FIX: Store HybridMessageService subscription unsubscribe to prevent listener leaks
let hybridMessageUnsubscribe: (() => void) | null = null;
// FIX: Store VoiceCallService listener unsubscriber to prevent leak on re-init
let voiceCallListenerUnsubscribe: (() => void) | null = null;

let isInitialized = false;
let isInitializing = false;
let seismicHealthCheckInterval: NodeJS.Timeout | null = null;
let settingsSubscription: (() => void) | null = null;
// CRITICAL FIX: Module-level so shutdownApp can clear it if called during init
let globalInitTimeoutId: ReturnType<typeof setTimeout> | null = null;
// CRITICAL FIX: Generation counter to detect concurrent shutdown during init.
// Without this, if globalInitTimeout fires → shutdown runs → init body finishes,
// the init body overwrites isInitialized=true after shutdown set it to false,
// permanently blocking future re-initialization.
let initEpoch = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyLogLevel(debug: boolean, verbose: boolean): void {
  if (verbose || debug) { setLogLevel('debug'); return; }
  setLogLevel(__DEV__ ? 'info' : 'warn');
}

function mapFontScale(s: number): 'small' | 'normal' | 'large' | 'extraLarge' {
  if (s <= 0.9) return 'small';
  if (s < 1.15) return 'normal';
  if (s < 1.4) return 'large';
  return 'extraLarge';
}

async function applyRuntimeSettings(): Promise<void> {
  const s = useSettingsStore.getState();
  applyLogLevel(s.debugModeEnabled, s.verboseLoggingEnabled);

  try {
    const { accessibilityServiceElite } = await import('./services/AccessibilityServiceElite');
    await accessibilityServiceElite.initialize();
    await accessibilityServiceElite.updateSettings({
      fontSize: mapFontScale(s.fontScale),
      highContrast: s.highContrastEnabled,
    });
  } catch { /* non-critical */ }

  try {
    const { voiceCommandService } = await import('./services/VoiceCommandService');
    if (s.voiceCommandEnabled) {
      await voiceCommandService.initialize();
      await voiceCommandService.startListening();
    } else {
      await voiceCommandService.stopListening();
    }
  } catch { /* non-critical */ }

  try {
    if (multiSourceEEWService) {
      multiSourceEEWService.setSourceEnabled('AFAD', s.sourceAFAD);
      multiSourceEEWService.setSourceEnabled('KANDILLI', s.sourceKOERI);
      multiSourceEEWService.setSourceEnabled('USGS', s.sourceUSGS);
      multiSourceEEWService.setSourceEnabled('EMSC', s.sourceEMSC);
    }
  } catch { /* non-critical */ }
}

// ---------------------------------------------------------------------------
// Resilient import helper
// ---------------------------------------------------------------------------

const safeImport = async <T>(fn: () => Promise<T>, name: string): Promise<T | null> => {
  try { return await fn(); }
  catch (e) { logger.error(`Failed to import ${name}:`, e); return null; }
};

/**
 * Wrap a promise with a timeout to prevent indefinite hangs.
 * Resolves to the fallback value if the promise doesn't settle in time.
 */
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  // Attach .catch to original promise to prevent unhandled rejection
  // when timeout wins the race but original promise later rejects
  promise.catch(() => {});
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId!));
};

// ===========================================================================
// initializeApp — Phase-based bootstrapper
// ===========================================================================

export async function initializeApp(options: { authenticated?: boolean } = {}) {
  if (isInitialized || isInitializing) return;
  isInitializing = true;
  const currentEpoch = ++initEpoch;
  const appStore = useAppStore.getState();

  // GLOBAL SAFETY TIMEOUT: If initialization takes too long (30s), force-complete it.
  // Apple rejects apps that take >20s to first interactive screen. The user sees
  // AuthLoadingScreen immediately (not blocked by this timeout), but if init hangs,
  // appStore.setReady never fires and the Main navigator is never shown.
  // 30s is well above normal init (~5-10s) but ensures we don't exceed Apple limits
  // even with worst-case network + all service timeouts combined.
  // CRITICAL FIX: Clear any stale timeout from a previous init call to prevent memory leak.
  if (globalInitTimeoutId) { clearTimeout(globalInitTimeoutId); globalInitTimeoutId = null; }
  globalInitTimeoutId = setTimeout(() => {
    if (!isInitialized && currentEpoch === initEpoch) {
      logger.error('GLOBAL INIT TIMEOUT (30s) — forcing app ready. Some services may not be initialized.');
      // Mark as initialized to unblock UI (Apple Review requires splash to dismiss)
      // but set a flag so the app knows init was forced
      isInitialized = true;
      isInitializing = false;
      globalInitTimeoutId = null;
      appStore.setReady(true);
      // Schedule a background retry for services that may not have started
      setTimeout(async () => {
        try {
          // Re-initialize critical services that may have timed out
          const { identityService } = await import('./services/IdentityService');
          if (!identityService.getUid()) {
            await identityService.initialize().catch(() => {});
          }
        } catch { /* best effort */ }
      }, 5000);
    }
  }, 30_000);

  try {
    logger.info('Starting initialization... (auth-gated=' + (options.authenticated === true) + ')');

    // -----------------------------------------------------------------------
    // CRITICAL DIAGNOSTIC: Check if MMKV is actually persistent.
    // If MemoryStorage fallback is active, auth/onboarding/settings will NOT
    // persist across restarts — the #1 cause of the "logs out on kill" bug.
    // -----------------------------------------------------------------------
    try {
      const { isMMKVPersistent } = await import('./utils/storage');
      if (!isMMKVPersistent) {
        logger.error('MMKV fell back to MemoryStorage — auth/onboarding will NOT persist across restarts');
      }
    } catch { /* non-blocking */ }

    // -----------------------------------------------------------------------
    // PRIVACY UX HARDENING: stop stale background location tasks from old builds.
    // These tasks can survive updates and keep iOS location indicator visible
    // even when the current build no longer uses background location.
    // -----------------------------------------------------------------------
    try {
      const { stopLegacyBackgroundLocationTasks } = await import('./services/BackgroundLocationGuard');
      await stopLegacyBackgroundLocationTasks('initializeApp');
    } catch (e: unknown) {
      logger.debug('Background location stale-task cleanup skipped:', e);
    }

    // -----------------------------------------------------------------------
    // LIFE-SAFETY PRIORITY: Set notification handler BEFORE everything else.
    // Expo silently drops ALL foreground notifications if no handler is set.
    // This ensures SOS/EEW notifications are never lost during init.
    // -----------------------------------------------------------------------
    try {
      const { getNotificationsAsync: getNotifEarly } = await import('./services/notifications/NotificationModuleLoader');
      const NotifEarly = await getNotifEarly();
      if (NotifEarly && typeof NotifEarly.setNotificationHandler === 'function') {
        NotifEarly.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        logger.info('✅ Early notification handler set (foreground SOS/EEW safe)');
      }
    } catch (e: unknown) {
      logger.warn('Early notification handler failed (non-blocking):', e);
    }

    // -----------------------------------------------------------------------
    // CRITICAL: NotificationCenter MUST initialize BEFORE Phase A imports.
    // On cold-start (user taps push notification to open app), Expo's
    // getLastNotificationResponseAsync() has a short window to return the tap.
    // If we wait until after Phase A + Phase B (10-15s), the response expires
    // and the user is NOT navigated to the conversation. This fix ensures
    // cold-start taps are captured within the first 1-2 seconds.
    // -----------------------------------------------------------------------
    try {
      const { notificationCenter } = await import('./services/notifications/NotificationCenter');
      await notificationCenter.initialize();
      logger.info('✅ NotificationCenter (early — cold-start safe)');
    } catch (e: unknown) { logger.error('NotificationCenter early init:', e); }

    // -----------------------------------------------------------------------
    // Crash diagnostics baseline (must start before feature modules)
    // -----------------------------------------------------------------------
    try {
      const { firebaseCrashlyticsService } = await import('./services/FirebaseCrashlyticsService');
      await firebaseCrashlyticsService.initialize();
      logger.info('✅ Crashlytics');
    } catch (e: unknown) {
      logger.warn('Crashlytics init failed (non-blocking):', e);
    }

    try {
      const { globalErrorHandlerService } = await import('./services/GlobalErrorHandler');
      await globalErrorHandlerService.initialize();
      logger.info('✅ GlobalErrorHandler');
    } catch (e: unknown) {
      logger.warn('GlobalErrorHandler init failed (non-blocking):', e);
    }

    // -----------------------------------------------------------------------
    // PHASE A: Parallel service loading (no auth required)
    // -----------------------------------------------------------------------
    const [
      esModule, bmsModule, lsModule, nsModule, fsModule,
      _psModule, btsModule, ssModule, omsModule,
      // EEW
      ftsModule, bewsModule, pewsModule, mlcModule,
      // Multi-source / Watch
      msewsModule, wbsModule,
      _todsModule, _tapsModule,
      _trsModule,
    ] = await Promise.all([
      safeImport(() => import('./services/EarthquakeService'), 'EarthquakeService'),
      safeImport(() => import('./services/BLEMeshService'), 'BLEMeshService'),
      safeImport(() => import('./services/LocationService'), 'LocationService'),
      safeImport(() => import('./services/NotificationService'), 'NotificationService'),
      safeImport(() => import('./services/FirebaseService'), 'FirebaseService'),
      safeImport(() => import('./services/PermissionService'), 'PermissionService'),
      safeImport(() => import('./services/BackgroundTaskService'), 'BackgroundTaskService'),
      safeImport(() => import('./services/OfflineSyncService'), 'OfflineSyncService'),
      safeImport(() => import('./services/OfflineMapService'), 'OfflineMapService'),
      safeImport(() => import('./services/FCMTokenService'), 'FCMTokenService'),
      safeImport(() => import('./services/BackgroundEEWService'), 'BackgroundEEWService'),
      safeImport(() => import('./services/PLUMEEWService'), 'PLUMEEWService'),
      safeImport(() => import('./services/MLPWaveClassifier'), 'MLPWaveClassifier'),
      safeImport(() => import('./services/MultiSourceEEWService'), 'MultiSourceEEWService'),
      safeImport(() => import('./services/WatchBridgeService'), 'WatchBridgeService'),
      safeImport(() => import('./services/TurkeyOfflineDataService'), 'TurkeyOfflineDataService'),
      safeImport(() => import('./services/TurkeyAssemblyPointsService'), 'TurkeyAssemblyPointsService'),
      safeImport(() => import('./services/TsunamiRiskService'), 'TsunamiRiskService'),
    ]);

    // Extract service singletons
    earthquakeService = esModule?.earthquakeService;
    bleMeshService = bmsModule?.bleMeshService;
    locationService = lsModule?.locationService;
    plumEEWService = pewsModule?.plumEEWService;
    multiSourceEEWService = msewsModule?.multiSourceEEWService;
    // Services used only during init (no module-level ref needed)
    const notificationService = nsModule?.notificationService;
    const firebaseService = fsModule?.firebaseService;
    const backgroundTaskService = btsModule?.backgroundTaskService;
    const syncService = ssModule?.offlineSyncService;
    const offlineMapService = omsModule?.offlineMapService;
    const fcmTokenService = ftsModule?.fcmTokenService;
    const backgroundEEWService = bewsModule?.backgroundEEWService;
    const mlPWaveClassifier = mlcModule?.mlPWaveClassifier;
    const watchBridgeService = wbsModule?.watchBridgeService;

    logger.info('✅ Services loaded');

    // -----------------------------------------------------------------------
    // Firebase (fire-and-forget)
    // -----------------------------------------------------------------------
    firebaseService?.initialize?.().catch((e: unknown) => logger.error('Firebase init:', e));

    // -----------------------------------------------------------------------
    // Auth check
    // -----------------------------------------------------------------------
    let isAuthed = options.authenticated === true;
    if (!isAuthed) {
      try {
        // CRITICAL FIX: Use getFirebaseAuth() which ensures MMKV persistence is configured.
        // Using raw getAuth(app) creates a NEW auth instance without persistence,
        // causing currentUser to be null even when the session exists.
        const fbMod = await import('../lib/firebase');
        const auth = fbMod.getFirebaseAuth();
        if (auth?.currentUser) {
          isAuthed = true;
        } else {
          // Fallback: check cached auth session from MMKV
          const { hasCachedAuthenticatedSession } = await import('./utils/authSessionCache');
          if (hasCachedAuthenticatedSession()) {
            isAuthed = true;
          }
        }
      } catch { /* Firebase not ready */ }
    }

    const settings = useSettingsStore.getState();
    await applyRuntimeSettings();

    // -----------------------------------------------------------------------
    // Settings listener
    // -----------------------------------------------------------------------
    if (settingsSubscription) { settingsSubscription(); settingsSubscription = null; }
    settingsSubscription = useSettingsStore.subscribe((state, prev) => {
      const bridgeChanged =
        state.fontScale !== prev.fontScale ||
        state.highContrastEnabled !== prev.highContrastEnabled ||
        state.debugModeEnabled !== prev.debugModeEnabled ||
        state.verboseLoggingEnabled !== prev.verboseLoggingEnabled ||
        state.voiceCommandEnabled !== prev.voiceCommandEnabled ||
        state.sourceAFAD !== prev.sourceAFAD ||
        state.sourceKOERI !== prev.sourceKOERI ||
        state.sourceUSGS !== prev.sourceUSGS ||
        state.sourceEMSC !== prev.sourceEMSC;
      if (bridgeChanged) void applyRuntimeSettings();

      if (state.earthquakeMonitoringEnabled !== prev.earthquakeMonitoringEnabled) {
        if (state.earthquakeMonitoringEnabled) {
          earthquakeService?.start?.().catch((e: unknown) => logger.error('EQ restart:', e));
        } else {
          earthquakeService?.stop?.();
        }
      }

      if (state.locationEnabled !== prev.locationEnabled) {
        if (state.locationEnabled) {
          locationService?.initialize?.().catch((e: unknown) => logger.error('Loc restart:', e));
        } else {
          import('./services/FamilyTrackingService').then(({ familyTrackingService }) =>
            familyTrackingService.stopTracking('settings-location-disabled'),
          ).catch(e => { if (__DEV__) logger.debug('Init: family tracking stop failed:', e); });
          // CRITICAL FIX: Also clear familyLocationSharingEnabled so tracking does not
          // auto-resume on next boot when the user has explicitly disabled location.
          state.familyLocationSharingEnabled && useSettingsStore.getState().setFamilyLocationSharing(false);
        }
      }

      if (state.sourceCommunity !== prev.sourceCommunity) {
        if (state.sourceCommunity) {
          crowdsourcedSeismicNetwork?.initialize?.().catch((e: unknown) => logger.error('CSN restart:', e));
        } else {
          crowdsourcedSeismicNetwork?.stop?.();
        }
      }
    });

    // -----------------------------------------------------------------------
    // PHASE B: Auth-gated services (Identity, Firebase Data, Messaging)
    // -----------------------------------------------------------------------
    // Re-initialize ConnectionManager (destroyed during previous shutdown)
    try {
      const { connectionManager } = await import('./services/ConnectionManager');
      connectionManager.reinitialize();
    } catch { /* non-critical */ }

    if (isAuthed) {
      // CRITICAL FIX: Wait for Firebase Auth to finish restoring the persisted session
      // before starting Phase B services. When cachedAuth is true, App.tsx calls
      // initializeApp immediately — but Firebase Auth's MMKV persistence is async
      // (Promise-based adapter), so currentUser may still be null. Without this wait,
      // ALL Phase B Firestore operations fail with permission-denied (null auth).
      try {
        const fbMod = await import('../lib/firebase');
        const auth = fbMod.getFirebaseAuth();
        if (auth && !auth.currentUser) {
          // Firebase v12+ has authStateReady() which resolves when persistence hydration is complete
          if (typeof (auth as any).authStateReady === 'function') {
            await withTimeout((auth as any).authStateReady(), 8_000, undefined);
            logger.info(`✅ Firebase Auth restored (authStateReady): uid=${auth.currentUser?.uid || 'null'}`);
          } else {
            // Fallback: wait for onAuthStateChanged to fire with a non-null user
            const { onAuthStateChanged } = await import('firebase/auth');
            // Track unsubscribe so we can clean up if timeout wins the race
            let authUnsub: (() => void) | null = null;
            await withTimeout(
              new Promise<void>((resolve) => {
                // Check again — might have been set while we were importing
                if (auth.currentUser) { resolve(); return; }
                authUnsub = onAuthStateChanged(auth, (user) => {
                  // CRITICAL FIX: Only resolve when user is non-null. onAuthStateChanged
                  // may fire with null first (before persistence hydration completes on
                  // some Firebase versions). Resolving on null causes Phase B to proceed
                  // with null auth — ALL Firestore operations silently fail with
                  // permission-denied. The withTimeout (8s) handles the case where the
                  // user session genuinely doesn't exist.
                  if (user) {
                    authUnsub?.();
                    authUnsub = null;
                    resolve();
                  }
                });
              }),
              8_000,
              undefined,
            );
            // FIX: Clean up listener if timeout won the race (user never became non-null).
            // Without this, the onAuthStateChanged listener leaks and fires indefinitely.
            if (authUnsub) { (authUnsub as () => void)(); authUnsub = null; }
            logger.info(`✅ Firebase Auth restored (onAuthStateChanged): uid=${auth.currentUser?.uid || 'null'}`);
          }
        }
      } catch { /* non-blocking — Phase B will try anyway with cached identity fallback */ }

      // SAFETY CHECK: Verify Firebase Auth actually restored a user after the wait.
      // If still null, Phase B Firestore operations will fail with permission-denied.
      // IdentityService can still fall back to MMKV-cached UID for offline operation.
      try {
        const fbCheck = await import('../lib/firebase');
        const authCheck = fbCheck.getFirebaseAuth();
        if (authCheck && !authCheck.currentUser) {
          logger.error('⚠️ Firebase Auth currentUser is STILL null after authStateReady wait — Phase B Firestore ops may fail');
        }
      } catch { /* non-blocking */ }

      try {
        const { identityService } = await import('./services/IdentityService');
        await withTimeout(identityService.initialize(), 10_000, undefined);
        logger.info(`✅ IdentityService (id: ${identityService.getMyId()})`);

        // ELITE: Update lastSeen on app open + listen for AppState changes
        const uid = identityService.getUid();
        if (uid) {
          import('./services/firebase/FirebaseMessageOperations').then(({ updateLastSeen }) => {
            updateLastSeen(uid);
            // Also update on every foreground resume
            const { AppState } = require('react-native');
            // CRITICAL FIX: Remove previous listener before creating a new one.
            // Without this, each re-initialization leaks an AppState listener.
            const previousListener = (globalThis as any).__lastSeenListener;
            if (previousListener?.remove) {
              previousListener.remove();
            }
            const lastSeenListener = AppState.addEventListener('change', (state: string) => {
              if (state === 'active') {
                updateLastSeen(uid);
                // CRITICAL FIX: Re-attempt FCM token registration on every foreground resume.
                // If user granted notification permission after init.ts Phase E ran
                // (e.g., during onboarding, or via iOS Settings), the token was never registered.
                // This ensures tokens are registered as soon as the app becomes active.
                import('./services/FCMTokenService').then(({ fcmTokenService }) => {
                  if (!fcmTokenService.isReady()) {
                    fcmTokenService.initialize().catch(e => { if (__DEV__) logger.debug('Init: FCM token re-init failed:', e); });
                  }
                }).catch(e => { if (__DEV__) logger.debug('Init: FCMTokenService import failed:', e); });
              } else if (state === 'background' || state === 'inactive') {
                // Flush pending settings sync before app goes to background
                import('./services/SettingsSyncService').then(({ settingsSyncService }) => {
                  settingsSyncService.flushSync().catch(e => { if (__DEV__) logger.debug('Init: settings flush failed:', e); });
                }).catch(e => { if (__DEV__) logger.debug('Init: SettingsSyncService import failed:', e); });
              }
            });
            (globalThis as any).__lastSeenListener = lastSeenListener;
          }).catch(e => { if (__DEV__) logger.debug('Init: last-seen listener setup failed:', e); });
        }
      } catch (e: unknown) { logger.error('IdentityService:', e); }

      // PERF: Parallel core service init — FirebaseData + HybridMessage + MessageStore
      // These don't depend on each other, only on auth being ready (which it is).
      const coreResults = await Promise.allSettled([
        (async () => {
          const { firebaseDataService } = await import('./services/FirebaseDataService');
          await withTimeout(firebaseDataService.initialize(), 10_000, undefined);
          logger.info('✅ FirebaseDataService');
        })(),
        (async () => {
          const { hybridMessageService } = await import('./services/HybridMessageService');
          await withTimeout(hybridMessageService.initialize(), 15_000, undefined);
          if (hybridMessageUnsubscribe) { hybridMessageUnsubscribe(); hybridMessageUnsubscribe = null; }
          hybridMessageUnsubscribe = await hybridMessageService.subscribeToMessages((msg) => {
            logger.debug(`Cloud msg: ${msg.id} from ${msg.senderId}`);
          });
          logger.info('✅ HybridMessageService initialized + subscriptions');
        })(),
        (async () => {
          const { useMessageStore } = await import('./stores/messageStore');
          await withTimeout(useMessageStore.getState().initialize(), 10_000, undefined);
          logger.info('✅ MessageStore');
        })(),
      ]);
      for (const r of coreResults) {
        if (r.status === 'rejected') logger.error('Phase B core init:', r.reason);
      }

      // PERF: Parallel optional services — GroupChat + MeshBridge + VoiceCall + Presence + Contacts
      // CRITICAL FIX: PresenceService, ContactService, ContactRequestService were ONLY initialized
      // inside AuthService (login flow). When the app restores from MMKV cache after kill,
      // these services were NEVER started — breaking online/offline status and contacts.
      const optionalResults = await Promise.allSettled([
        (async () => {
          const { groupChatService } = await import('./services/GroupChatService');
          groupChatService.initialize();
          logger.info('✅ GroupChatService');
        })(),
        (async () => {
          const { meshMessageBridge } = await import('./services/mesh/MeshMessageBridge');
          await meshMessageBridge.initialize();
          logger.info('✅ MeshMessageBridge');
        })(),
        (async () => {
          const { voiceCallService } = await import('./services/VoiceCallService');
          // CRITICAL FIX: Reset isDestroyed flag from previous shutdown.
          // destroy() sets isDestroyed=true which permanently disables retry logic
          // in listenForIncomingCalls(). Without reinitialize(), incoming call listener
          // retries are dead for the new user session after logout+login.
          voiceCallService.reinitialize();
          if (voiceCallService.isAvailable()) {
            // FIX: Store unsubscriber to prevent listener leak on re-init
            if (voiceCallListenerUnsubscribe) { voiceCallListenerUnsubscribe(); voiceCallListenerUnsubscribe = null; }
            voiceCallListenerUnsubscribe = voiceCallService.listenForIncomingCalls();
            logger.info('✅ VoiceCallService listener');
          }
        })(),
        (async () => {
          const { presenceService } = await import('./services/PresenceService');
          await presenceService.initialize();
          logger.info('✅ PresenceService (online/offline status)');
        })(),
        (async () => {
          const { contactService } = await import('./services/ContactService');
          await contactService.initialize();
          logger.info('✅ ContactService');
        })(),
        (async () => {
          const { contactRequestService } = await import('./services/ContactRequestService');
          await contactRequestService.initialize();
          logger.info('✅ ContactRequestService');
        })(),
      ]);
      for (const r of optionalResults) {
        if (r.status === 'rejected') logger.error('Phase B optional service init failed:', r.reason);
      }

      // Settings cloud sync — cross-device settings persistence
      try {
        const { settingsSyncService } = await import('./services/SettingsSyncService');
        await settingsSyncService.initialize();
        logger.info('✅ SettingsSyncService (cloud settings)');
      } catch (e: unknown) { logger.error('SettingsSyncService:', e); }

    } else {
      logger.info('ℹ️ Auth-gated services deferred');
    }

    // NotificationCenter already initialized early (before Phase A) for cold-start safety.

    // FIX: Initialize NotificationService regardless of auth (sets up local notification infra)
    try {
      if (notificationService) {
        await notificationService.initialize();
        logger.info('✅ NotificationService');
      }
    } catch (e: unknown) { logger.error('NotificationService:', e); }

    // -----------------------------------------------------------------------
    // PHASE C: Location & Family
    // BUG 3 FIX: FamilyStore MUST init regardless of locationEnabled
    // — local cache must load so users can see their family members
    // — FamilyTrackingService.initialize() sets up Firebase listeners (no GPS needed)
    // — Only startTracking() actually requires location permission
    // -----------------------------------------------------------------------
    if (settings.locationEnabled) {
      if (locationService) {
        locationService.initialize().catch((e: unknown) => logger.error('Location:', e));
      } else {
        logger.warn('⚠️ LocationService unavailable — location features disabled (import may have failed)');
      }
    }

    // CRITICAL FIX: FamilyStore MUST init regardless of auth state
    // — MMKV cache loads locally, enabling UI to show family members
    // — Firebase sync inside initialize() gracefully fails if not authed
    try {
      const { useFamilyStore } = await import('./stores/familyStore');
      await withTimeout(useFamilyStore.getState().initialize(), 10_000, undefined);
      logger.info('✅ FamilyStore');
    } catch (e: unknown) { logger.error('FamilyStore:', e); }

    if (isAuthed) {
      // Initialize FamilyTrackingService — requires auth for Firebase listeners
      try {
        const { familyTrackingService } = await import('./services/FamilyTrackingService');
        await familyTrackingService.initialize();
        // CRITICAL FIX: Auto-resume location sharing if user previously enabled it.
        // Without this, location sharing SILENTLY STOPS on every app restart.
        // Families cannot find each other during earthquakes because the tracking
        // only started when the user manually opened FamilyScreen and toggled it on.
        // The setting is persisted in settingsStore (MMKV-backed Zustand).
        if (settings.familyLocationSharingEnabled && settings.locationEnabled) {
          familyTrackingService.startTracking('init-auto-resume').catch((e: unknown) => {
            logger.warn('Auto-resume family location tracking failed (non-critical):', e);
          });
          logger.info('✅ FamilyTrackingService initialized + auto-resumed location sharing');
        } else {
          logger.info('✅ FamilyTrackingService initialized (manual tracking only)');
        }
      } catch (e: unknown) { logger.error('FamilyTracking:', e); }

      // NOTE: GroupChatService already initialized in Phase B — removed duplicate call
    }

    // -----------------------------------------------------------------------
    // PHASE D: Earthquake & Background
    // -----------------------------------------------------------------------
    if (settings.earthquakeMonitoringEnabled) {
      try {
        await earthquakeService?.start?.();
        logger.info('✅ Earthquake service');
      } catch (e: unknown) { logger.error('Earthquake:', e); }
    }

    // BLE Mesh: Auto-initialize AND start for auth users.
    // Emergency app must have BLE mesh always active for offline SOS/messaging.
    // start() calls requestPermissions() + startDualMode() (GATT server + scanner).
    if (isAuthed) {
      try {
        const { meshNetworkService } = await import('./services/mesh/MeshNetworkService');
        await meshNetworkService.initialize();
        await meshNetworkService.start();
        logger.info('✅ MeshNetworkService started (BLE mesh active)');
      } catch (e: unknown) { logger.debug('Mesh start (optional):', e); }
    } else {
      logger.info('ℹ️ BLE Mesh deferred (not authenticated)');
    }

    try {
      await backgroundTaskService?.registerTasks?.();
      logger.info('✅ Background tasks');
    } catch (e: unknown) { logger.error('Background tasks:', e); }

    if (isAuthed) {
      syncService?.forceSync?.().catch((e: unknown) => logger.debug('Sync skipped:', e));
    }

    offlineMapService?.initialize?.().catch((e: unknown) => logger.debug('Offline map:', e));

    // -----------------------------------------------------------------------
    // PHASE E: EEW Advanced (auth + setting gated)
    // -----------------------------------------------------------------------
    if (isAuthed) {
      try { await fcmTokenService?.initialize?.(); logger.info('✅ FCM Token'); }
      catch (e: unknown) { logger.error('FCM Token:', e); }
    }

    if (isAuthed && settings.eewEnabled) {
      try { await backgroundEEWService?.initialize?.(); logger.info('✅ Background EEW'); }
      catch (e: unknown) { logger.error('Background EEW:', e); }
    }

    if (settings.locationEnabled && plumEEWService && locationService) {
      const loc = locationService.getCurrentLocation?.();
      if (loc) {
        plumEEWService.start({ latitude: loc.latitude, longitude: loc.longitude }).catch((e: unknown) =>
          logger.debug('PLUM:', e),
        );
      }
    }

    mlPWaveClassifier?.initialize?.().catch((e: unknown) => logger.debug('ML Classifier:', e));

    // -----------------------------------------------------------------------
    // PHASE F: Multi-Source EEW, Widget, Watch
    // -----------------------------------------------------------------------
    if (isAuthed && settings.eewEnabled) {
      // CRITICAL FIX: Do NOT call multiSourceEEWService.start() here.
      // The onEvent subscription is set up in Phase I (line ~867). If start() fires here,
      // the first poll completes before the subscription exists → events processed without
      // callbacks → missed notifications. start() is now called after subscription in Phase I.
      // multiSourceEEWService?.start?.() is called in Phase I after onEvent subscription

      // CRITICAL: Start EEWService for fast 5-second AFAD polling + P-wave detection
      try {
        const { eewService } = await import('./services/EEWService');
        await eewService.start();
        logger.info('✅ EEWService (5s AFAD polling + SeismicSensor)');
      } catch (e: unknown) { logger.error('EEWService start:', e); }
    }

    watchBridgeService?.initialize?.().catch((e: unknown) => logger.debug('Watch:', e));

    // -----------------------------------------------------------------------
    // PHASE G: Life-saving services (auth-gated)
    // SOS Listeners, AI Pre-warmup, NewsAggregator
    // -----------------------------------------------------------------------
    if (isAuthed) {
      // TurkeyOfflineData, Assembly, Tsunami are data-only — no init needed
      logger.info('✅ Life-saving data services available');

      // -- SOS Alert Listeners: Listen for family SOS + nearby broadcasts --
      try {
        const { getDeviceId } = await import('./utils/device');
        const myDeviceId = await getDeviceId();
        if (myDeviceId) {
          const { startSOSAlertListener } = await import('./services/sos/SOSAlertListener');
          const { startNearbySOSListener } = await import('./services/sos/NearbySOSListener');
          await startSOSAlertListener(myDeviceId);
          await startNearbySOSListener(myDeviceId);
          logger.info('✅ SOS Alert Listeners (family + nearby)');
        } else {
          logger.warn('⚠️ SOS listeners: no deviceId yet — retrying with backoff');
          // LIFE-SAFETY: Retry SOS listeners with exponential backoff — critical for first-launch users
          const MAX_SOS_RETRIES = 4;
          // CRITICAL FIX: Capture initEpoch at retry creation time. If shutdownApp() runs
          // between retries, initEpoch increments. The timer callback must check this to avoid
          // starting SOS listeners for an old/logged-out user after shutdown.
          const sosRetryEpoch = initEpoch;
          const retrySOSListeners = async (attempt: number, delayMs: number) => {
            if (attempt > MAX_SOS_RETRIES) {
              logger.error(`❌ SOS listeners FAILED after ${MAX_SOS_RETRIES} retries — user will NOT receive SOS alerts`);
              return;
            }
            const timer = setTimeout(async () => {
              // CRITICAL: Abort if shutdown happened since retry was scheduled
              if (initEpoch !== sosRetryEpoch) {
                logger.info(`SOS listeners retry #${attempt} aborted — init epoch changed (shutdown occurred)`);
                return;
              }
              try {
                const retryDeviceId = await getDeviceId();
                if (retryDeviceId) {
                  const { startSOSAlertListener } = await import('./services/sos/SOSAlertListener');
                  const { startNearbySOSListener } = await import('./services/sos/NearbySOSListener');
                  await startSOSAlertListener(retryDeviceId);
                  await startNearbySOSListener(retryDeviceId);
                  logger.info(`✅ SOS Alert Listeners started (retry #${attempt})`);
                } else {
                  logger.warn(`⚠️ SOS listeners retry #${attempt}: still no deviceId`);
                  retrySOSListeners(attempt + 1, Math.min(delayMs * 1.5, 30000));
                }
              } catch (retryErr) {
                logger.error(`SOS Listeners retry #${attempt}:`, retryErr);
                retrySOSListeners(attempt + 1, Math.min(delayMs * 1.5, 30000));
              }
            }, delayMs);
            // Track timer for cleanup on shutdown
            // CRITICAL FIX: Clear previous timer before storing new one to prevent leak
            // when recursive retries create multiple timers
            if ((globalThis as any).__sosRetryTimer) {
              clearTimeout((globalThis as any).__sosRetryTimer);
            }
            (globalThis as any).__sosRetryTimer = timer;
          };
          retrySOSListeners(1, 3000);
        }
      } catch (e: unknown) { logger.error('SOS Listeners:', e); }

      // -- UnifiedSOSController pre-initialization --
      // CRITICAL: Must initialize early so fall/crash detection is active from launch.
      // Without this, auto-SOS triggers (fall, crash) are completely dead until the user
      // manually taps the SOS button for the first time.
      try {
        const { unifiedSOSController } = await import('./services/sos/UnifiedSOSController');
        await unifiedSOSController.initialize();
        logger.info('✅ UnifiedSOSController pre-initialized (fall detection active)');
      } catch (e: unknown) { logger.error('UnifiedSOSController pre-init:', e); }

      // CRITICAL FIX: RescueBeaconService must be initialized for auto-beacon on 'trapped' status
      try {
        const { rescueBeaconService } = await import('./services/RescueBeaconService');
        rescueBeaconService.initialize();
        logger.info('✅ RescueBeaconService initialized (auto-beacon on trapped status)');
      } catch (e: unknown) { logger.error('RescueBeaconService init:', e); }

      // -- AI Knowledge Base Pre-warmup --
      try {
        const { aiAssistantCoordinator } = await import('./ai/services/AIAssistantCoordinator');
        // Calling getKnowledgeStats triggers lazy-load of the offline KB
        const stats = aiAssistantCoordinator.getKnowledgeStats();
        logger.info(`✅ AI Knowledge Base pre-loaded (${stats?.totalEntries || 0} entries)`);
      } catch (e: unknown) { logger.error('AI Pre-warmup:', e); }

      // -- NewsAggregator: Pre-fetch headlines for home screen --
      try {
        const { newsAggregatorService } = await import('./ai/services/NewsAggregatorService');
        await newsAggregatorService.initialize();
        logger.info('✅ NewsAggregator initialized');
      } catch (e: unknown) { logger.error('NewsAggregator:', e); }
    }

    // -----------------------------------------------------------------------
    // PHASE H: Realtime EEW connections (auth + EEW setting gated)
    // -----------------------------------------------------------------------
    if (isAuthed && settings.eewEnabled) {
      try {
        const { realtimeEarthquakeMonitor: rem } = await import('./services/RealtimeEarthquakeMonitor');
        realtimeEarthquakeMonitor = rem;
        const loc = locationService?.getCurrentLocation?.();
        if (loc) realtimeEarthquakeMonitor.setUserLocation(loc.latitude, loc.longitude);
        await realtimeEarthquakeMonitor.start();
        logger.info('✅ RealtimeEarthquakeMonitor (WebSocket)');
      } catch (e: unknown) { logger.error('RealtimeEQ:', e); }
    }

    if (isAuthed && settings.seismicSensorEnabled) {
      try {
        const { onDeviceSeismicDetector: odsd } = await import('./services/OnDeviceSeismicDetector');
        onDeviceSeismicDetector = odsd;
        await onDeviceSeismicDetector.start();
        logger.info('✅ OnDeviceSeismicDetector (P-Wave)');
      } catch (e: unknown) { logger.error('OnDeviceSeismic:', e); }
    }

    if (isAuthed && settings.sourceCommunity) {
      try {
        const { crowdsourcedSeismicNetwork: csn } = await import('./services/CrowdsourcedSeismicNetwork');
        crowdsourcedSeismicNetwork = csn;
        const loc = locationService?.getCurrentLocation?.();
        if (loc) crowdsourcedSeismicNetwork.setUserLocation(loc.latitude, loc.longitude);
        await crowdsourcedSeismicNetwork.initialize();
        logger.info('✅ CrowdsourcedSeismicNetwork');
      } catch (e: unknown) { logger.error('CrowdsourcedSeismic:', e); }
    }

    if (isAuthed && settings.seismicSensorEnabled) {
      try {
        const { backgroundSeismicMonitor: bsm } = await import('./services/BackgroundSeismicMonitor');
        backgroundSeismicMonitor = bsm;
        await backgroundSeismicMonitor.initialize();
        logger.info('✅ BackgroundSeismicMonitor (24/7)');
      } catch (e: unknown) { logger.error('BackgroundSeismic:', e); }
    }

    if (isAuthed && settings.eewEnabled) {
      try {
        const { realTimeEEWConnection: realtimeConn } = await import('./services/RealTimeEEWConnectionService');
        realTimeEEWConnection = realtimeConn;
        await realTimeEEWConnection.start();
        logger.info('✅ RealTimeEEWConnection');
      } catch (e: unknown) { logger.error('RealTimeEEW:', e); }
    }

    // REMOVED: NotificationCenter was here gated behind eewEnabled.
    // Moved to Phase B (auth-gated only) so ALL notifications work regardless of EEW setting.

    // -----------------------------------------------------------------------
    // PHASE I: Auto-start BLE Mesh on EEW alert (background safety net)
    // -----------------------------------------------------------------------
    if (isAuthed && settings.eewEnabled && multiSourceEEWService) {
      try {
        if (multiSourceBleAutoUnsubscribe) {
          multiSourceBleAutoUnsubscribe();
          multiSourceBleAutoUnsubscribe = null;
        }
        multiSourceBleAutoUnsubscribe = multiSourceEEWService.onEvent?.((event: any) => {
          // Auto-start BLE Mesh if M5+ earthquake detected
          if (event.magnitude >= 5.0 && bleMeshService && !bleMeshService.getIsRunning()) {
            bleMeshService.initialize().then(() => bleMeshService.start()).catch(e => { if (__DEV__) logger.debug('Init: BLE mesh auto-start failed:', e); });
            logger.warn(`🚨 BLE Mesh auto-started: M${event.magnitude} detected`);
          }
        }) || null;

        // CRITICAL FIX: Start multiSourceEEWService AFTER onEvent subscription is set up.
        // Previously started in Phase F, which caused a race: first poll completed before
        // subscription existed → events processed without callbacks → missed notifications.
        try {
          multiSourceEEWService.start?.();
          logger.info('✅ Multi-Source EEW started (after subscription setup)');
        } catch (startErr: unknown) { logger.error('Multi-Source EEW start:', startErr); }
      } catch (e: unknown) { logger.debug('BLE Mesh auto-trigger setup:', e); }
    }

    if (globalInitTimeoutId) { clearTimeout(globalInitTimeoutId); globalInitTimeoutId = null; }
    // CRITICAL FIX: Check epoch before setting flags. If shutdownApp() ran
    // concurrently (e.g., user logged out while init was still running, or
    // globalInitTimeout fired followed by shutdown), initEpoch will have been
    // incremented or isInitialized will have been set to false. Setting it back
    // to true here would permanently block future re-initialization.
    if (currentEpoch === initEpoch) {
      // FIX: Start seismic health check INSIDE epoch guard. Previously it was started
      // unconditionally BEFORE the epoch check. If shutdownApp() ran concurrently,
      // shutdown cleared the health check interval first, then startSeismicHealthCheck()
      // created a new interval that was never cleaned up — leaking a 60s timer that
      // restarts earthquake monitoring even after logout.
      startSeismicHealthCheck();
      isInitialized = true;
      isInitializing = false;
      appStore.setReady(true);
      logger.info('✨ Initialization complete');
    } else {
      isInitializing = false;
      logger.warn('⚠️ Initialization completed but epoch changed (concurrent shutdown detected) — NOT marking as initialized');
    }

  } catch (error: unknown) {
    if (globalInitTimeoutId) { clearTimeout(globalInitTimeoutId); globalInitTimeoutId = null; }
    logger.error('❌ CRITICAL init failure:', error);
    if (currentEpoch === initEpoch) {
      // FIX: Do NOT set isInitialized=true on failure — this permanently blocks
      // re-initialization on next login. Allow retry by keeping isInitialized=false.
      isInitialized = false;
      isInitializing = false;
      appStore.setReady(true); // Allow UI to render in error state
    } else {
      isInitializing = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

function startSeismicHealthCheck() {
  if (seismicHealthCheckInterval) return;
  seismicHealthCheckInterval = setInterval(() => {
    if (!useSettingsStore.getState().earthquakeMonitoringEnabled) return;
    if (earthquakeService && !earthquakeService.getIsRunning()) {
      logger.warn('⚠️ Seismic service stopped, restarting...');
      earthquakeService.start?.().catch((e: unknown) => logger.error('Seismic restart:', e));
    }
  }, 60000);
}

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

export async function shutdownApp() {
  if (!isInitialized && !isInitializing) return;
  logger.info('Shutting down...');

  // CRITICAL: Capture UID NOW before any service cleanup nullifies auth
  let shutdownUid = '';
  try {
    const { getFirebaseAuth } = await import('../lib/firebase');
    shutdownUid = getFirebaseAuth()?.currentUser?.uid || '';
  } catch (e) { logger.error('Shutdown UID capture failed:', e); }

  // CRITICAL FIX: Increment epoch so any in-flight initializeApp() body
  // knows that shutdown happened and won't overwrite isInitialized/isInitializing.
  initEpoch++;

  // CRITICAL FIX: Clear identity FIRST — before any service cleanup.
  // Services running during shutdown may use identityService.getUid() to write data.
  // If identity still holds old user's UID, services could write data under old user's
  // account during the cleanup window. Clearing identity immediately prevents this.
  try {
    const { identityService } = await import('./services/IdentityService');
    await identityService.clearIdentity();
  } catch { /* best effort */ }

  if (globalInitTimeoutId) { clearTimeout(globalInitTimeoutId); globalInitTimeoutId = null; }
  if (seismicHealthCheckInterval) { clearInterval(seismicHealthCheckInterval); seismicHealthCheckInterval = null; }
  if (settingsSubscription) { settingsSubscription(); settingsSubscription = null; }

  // CRITICAL FIX: Clean up lastSeen AppState listener to prevent memory leak on re-login
  if ((globalThis as any).__lastSeenListener) {
    (globalThis as any).__lastSeenListener.remove();
    (globalThis as any).__lastSeenListener = null;
  }

  // Clean up SOS retry timer
  if ((globalThis as any).__sosRetryTimer) {
    clearTimeout((globalThis as any).__sosRetryTimer);
    (globalThis as any).__sosRetryTimer = null;
  }

  // CRITICAL FIX: Cancel all pending navigation retry intervals on shutdown.
  // Without this, stale retry intervals from cold-start notification taps continue
  // firing dispatch() calls after logout, potentially navigating in the auth/onboarding
  // stack or causing crashes when MainNavigator is unmounted.
  try {
    const { clearPendingNavigationRetries } = require('./navigation/navigationRef');
    clearPendingNavigationRetries();
  } catch { /* navigation module not loaded */ }

  earthquakeService?.stop?.();
  bleMeshService?.stop?.();
  plumEEWService?.stop?.();
  multiSourceEEWService?.stop?.();
  realtimeEarthquakeMonitor?.stop?.();
  realTimeEEWConnection?.stop?.();
  onDeviceSeismicDetector?.stop?.();
  crowdsourcedSeismicNetwork?.stop?.();
  backgroundSeismicMonitor?.stop?.();

  if (multiSourceBleAutoUnsubscribe) {
    multiSourceBleAutoUnsubscribe();
    multiSourceBleAutoUnsubscribe = null;
  }

  // Flush and cleanup settings sync before shutdown
  try {
    const { settingsSyncService } = await import('./services/SettingsSyncService');
    await settingsSyncService.flushSync();
    settingsSyncService.cleanup();
  } catch { /* best effort */ }

  // CRITICAL FIX: Unsubscribe cloud/mesh listeners before destroying service
  if (hybridMessageUnsubscribe) { hybridMessageUnsubscribe(); hybridMessageUnsubscribe = null; }
  try {
    const { hybridMessageService } = await import('./services/HybridMessageService');
    hybridMessageService.destroy();
  } catch { /* already stopped */ }

  try {
    const { groupChatService } = await import('./services/GroupChatService');
    groupChatService.destroy();
  } catch { /* already stopped */ }

  // FIX: ConnectionManager NetInfo subscription leaks without destroy()
  try {
    const { connectionManager } = await import('./services/ConnectionManager');
    connectionManager.destroy();
  } catch { /* already stopped */ }

  try {
    const { voiceCommandService } = await import('./services/VoiceCommandService');
    await voiceCommandService.stopListening();
  } catch { /* already stopped */ }

  // FIX: Clean up VoiceCallService listener unsubscriber
  if (voiceCallListenerUnsubscribe) { voiceCallListenerUnsubscribe(); voiceCallListenerUnsubscribe = null; }

  // CRITICAL FIX: Destroy VoiceCallService (Firestore onSnapshot listener for incoming calls).
  // Without this, the listener for voice_calls_incoming/{uid} survives logout.
  // On account switch, the old user's incoming calls could trigger on the new user's device.
  try {
    const { voiceCallService } = await import('./services/VoiceCallService');
    voiceCallService.destroy();
  } catch { /* already stopped */ }

  // Cleanup BackgroundEEWService (AppState listener + background tasks)
  try {
    const { backgroundEEWService } = await import('./services/BackgroundEEWService');
    await backgroundEEWService.cleanup();
  } catch { /* already stopped */ }

  // CRITICAL FIX: Stop EEWService (5s AFAD polling + reconnect/pollSleep timers).
  // Started in Phase F but never stopped in shutdownApp() — timers leak after logout,
  // causing HTTP polling to continue for old user's session indefinitely.
  try {
    const { eewService } = await import('./services/EEWService');
    eewService.stop();
  } catch (e) { logger.error('EEW service stop failed:', e); }

  // CRITICAL FIX: Stop EmergencyHealthSharingService (broadcastInterval timer).
  // setInterval continues broadcasting health data via BLE mesh after logout.
  try {
    const { emergencyHealthSharingService } = await import('./services/EmergencyHealthSharingService');
    await emergencyHealthSharingService.stopBroadcast();
  } catch { /* already stopped */ }

  // CRITICAL FIX: Stop AutoCheckinService (checkInTimer + promptTimeoutTimer).
  // Timers continue firing after logout, potentially showing Alert dialogs for old user.
  try {
    const { autoCheckinService } = await import('./services/AutoCheckinService');
    autoCheckinService.stop();
  } catch { /* already stopped */ }

  // CRITICAL FIX: Cleanup MultiChannelAlertService (sound, vibration, TTS, LED, dismiss timers).
  // Without cleanup, alarms and vibrations continue after logout.
  try {
    const { multiChannelAlertService } = await import('./services/MultiChannelAlertService');
    await multiChannelAlertService.cancelAlert();
  } catch { /* already stopped */ }

  // Cleanup SOS listeners
  try {
    const { stopSOSAlertListener } = await import('./services/sos/SOSAlertListener');
    const { stopNearbySOSListener } = await import('./services/sos/NearbySOSListener');
    stopSOSAlertListener();
    stopNearbySOSListener();
  } catch { /* already stopped */ }

  // CRITICAL FIX: Clear incomingSOSAlerts on logout to prevent cross-account SOS marker leak.
  // Without this, SOS markers from the previous user's session persist on the map after account switch.
  try {
    const { useSOSStore } = await import('./services/sos/SOSStateManager');
    const sosState = useSOSStore.getState();
    if (typeof sosState.clearIncomingSOSAlerts === 'function') {
      sosState.clearIncomingSOSAlerts();
    } else {
      useSOSStore.setState({ incomingSOSAlerts: [] });
    }
    // Clear active SOS state to prevent next user from resuming previous user's SOS
    useSOSStore.setState({
      currentSignal: null,
      isActive: false,
      isCountingDown: false,
      countdownStartedAt: null,
      countdownSeconds: 0,
    });
  } catch { /* best-effort */ }

  // Cleanup UnifiedSOSController (timers, fall detection, beacon)
  try {
    const { unifiedSOSController } = await import('./services/sos/UnifiedSOSController');
    unifiedSOSController.destroy();
  } catch (e) { logger.error('UnifiedSOSController destroy failed:', e); }

  // Cleanup MeshEmergencyService (beacon timer, inactivity timer)
  // Without this, emergency beacons continue broadcasting for old user after account switch
  try {
    const { meshEmergencyService } = await import('./services/mesh/MeshEmergencyService');
    meshEmergencyService.cleanup();
  } catch { /* already stopped */ }

  // Cleanup RescueBeaconService (beacon interval + Zustand subscriptions)
  try {
    const { rescueBeaconService } = await import('./services/RescueBeaconService');
    rescueBeaconService.destroy();
  } catch { /* already stopped */ }

  // Cleanup DeliveryManager (ACK timeouts + monitor timer)
  try {
    const { deliveryManager } = await import('./services/DeliveryManager');
    deliveryManager.destroy();
  } catch { /* already stopped */ }

  // Cleanup MeshStoreForwardService (pending ACK timers + mailbox data)
  try {
    const { meshStoreForwardService } = await import('./services/mesh/MeshStoreForwardService');
    await meshStoreForwardService.destroy();
  } catch { /* already stopped */ }

  try {
    const { flushPendingMessages, flushPendingConversations } = await import('./stores/messageStore');
    flushPendingMessages();
    flushPendingConversations();
  } catch { /* best effort */ }

  // Cleanup PresenceService (set offline + remove listeners)
  try {
    const { presenceService } = await import('./services/PresenceService');
    await presenceService.cleanup();
  } catch { /* already stopped */ }

  // Cleanup ContactService (in-memory state + contact listeners)
  try {
    const { contactService } = await import('./services/ContactService');
    await contactService.cleanup();
  } catch { /* already stopped */ }

  // Cleanup ContactRequestService (Firestore listeners)
  try {
    const { contactRequestService } = await import('./services/ContactRequestService');
    await contactRequestService.cleanup();
  } catch { /* already stopped */ }

  // CRITICAL FIX: Clear IdentityService on shutdown to prevent cross-account identity leak.
  // Without this, the singleton retains the previous user's uid/displayName/email in memory.
  // authStore.signOut handler also clears it, but only on explicit sign-out — not on
  // token expiry, forced logout, or account switch scenarios.
  try {
    const { identityService } = await import('./services/IdentityService');
    await identityService.clearIdentity();
  } catch { /* already stopped */ }

  // Cleanup FCMTokenService (token refresh listener + retry timer)
  try {
    const { fcmTokenService } = await import('./services/FCMTokenService');
    fcmTokenService.cleanup();
  } catch { /* already stopped */ }

  // Cleanup BackendPushService (location interval + retry timeout)
  try {
    const { backendPushService } = await import('./services/BackendPushService');
    backendPushService.cleanup();
  } catch { /* already stopped */ }

  // Cleanup CryptoService (clear in-memory keys)
  try {
    const { cryptoService } = await import('./services/CryptoService');
    await cryptoService.destroy();
  } catch { /* already stopped */ }

  // Cleanup BackendEmergencyService (sync interval)
  try {
    const { backendEmergencyService } = await import('./services/BackendEmergencyService');
    backendEmergencyService.shutdown();
  } catch { /* already stopped */ }

  // Cleanup SessionSecurityService (check interval + AppState listener)
  try {
    const { sessionSecurityService } = await import('./services/security/SessionSecurityService');
    sessionSecurityService.stop();
  } catch { /* already stopped */ }

  // Clear SOS alert dedup on logout to prevent cross-account SOS dedup
  try {
    const { clearSOSAlertDedup } = await import('./services/sos/SOSAlertListener');
    clearSOSAlertDedup();
  } catch { /* already stopped */ }

  // Reset user status store to prevent cross-account SOS/status leak
  try {
    const { useUserStatusStore } = await import('./stores/userStatusStore');
    useUserStatusStore.getState().reset();
  } catch { /* already stopped */ }

  // Clear stores that retain user-private data (messages, contacts, SOS history, risk location, health)
  // Without this, cross-account data leaks on rapid logout+login
  try { const { useMessageStore } = await import('./stores/messageStore'); useMessageStore.getState().clear(); } catch { /* */ }
  try { const { useContactStore } = await import('./stores/contactStore'); useContactStore.getState().clearLocalCache(); } catch { /* */ }
  try { const { useEEWHistoryStore } = await import('./stores/eewHistoryStore'); useEEWHistoryStore.getState().clearHistory(); } catch { /* */ }
  try { const { useRescueStore } = await import('./stores/rescueStore'); useRescueStore.getState().clearTrappedUsers?.(); } catch { /* */ }
  // CRITICAL FIX: Reset healthProfileStore on logout — medical data (blood type, allergies,
  // medications, emergency contacts) is highly sensitive PII. Without this, user B sees
  // user A's health profile after account switch. Note: we reset in-memory state only;
  // the new user's loadProfile() will restore their own data from scoped storage + Firebase.
  try {
    const { useHealthProfileStore } = await import('./stores/healthProfileStore');
    useHealthProfileStore.setState({
      profile: {
        bloodType: '', allergies: [], chronicConditions: [], medications: [],
        emergencyContacts: [], notes: '', lastUpdated: 0,
      },
      isLoaded: false,
    });
  } catch { /* */ }
  try { const { useRiskStore } = await import('./stores/riskStore'); useRiskStore.setState({ riskAssessment: null, loading: false, error: null }); } catch { /* */ }
  try { const { useMapStore } = await import('./stores/mapStore'); useMapStore.setState({ realTimeTracking: false }); } catch { /* */ }
  try { const { useSettingsStore } = await import('./stores/settingsStore'); useSettingsStore.setState({ blockedUsers: [] }); } catch { /* */ }

  // AUTHORITATIVE: Purge ALL user-scoped security keys via single cleanup function
  try {
    const { purgeUserSecurityKeys } = await import('./services/security/SecurityKeyCleanup');
    await purgeUserSecurityKeys(shutdownUid);
  } catch { /* best effort */ }

  // Delete non-security user-scoped DirectStorage keys on logout
  // Uses shutdownUid captured at the start of shutdownApp (before auth is cleared)
  try {
    const { DirectStorage } = await import('./utils/storage');
    // Legacy unscoped keys
    DirectStorage.delete('@afetnet:my_family_status');
    DirectStorage.delete('@afetnet:apple_name_latest');
    DirectStorage.delete('@afetnet_openai_cost_tracker');
    DirectStorage.delete('@afetnet_openai_cost_stats');

    if (shutdownUid) {
      // Service scoped keys
      DirectStorage.delete(`@afetnet:msg_queue_v3:${shutdownUid}`);
      DirectStorage.delete(`@afetnet:seen_msg_ids:${shutdownUid}`);
      DirectStorage.delete(`@afetnet:delivery_tracking:${shutdownUid}`);
      DirectStorage.delete(`@afetnet:offline_sync_queue:${shutdownUid}`);
      DirectStorage.delete(`@afetnet:voice_messages:${shutdownUid}`);
      DirectStorage.delete(`@afetnet:family_members:${shutdownUid}`);
      DirectStorage.delete(`@afetnet:groups:${shutdownUid}`);
      DirectStorage.delete(`@afetnet:health_sharing_enabled:${shutdownUid}`);
      DirectStorage.delete(`@afetnet_preparedness_checklist_${shutdownUid}`);
      DirectStorage.delete(`@afetnet:apple_name_${shutdownUid}`);
      // Mesh bridge keys
      DirectStorage.delete(`@mesh_bridge_seen_ids:${shutdownUid}`);
      DirectStorage.delete(`@mesh_bridge_pending_sync:${shutdownUid}`);
      // Mesh emergency keys
      DirectStorage.delete(`@mesh_emergency_settings_:${shutdownUid}`);
      DirectStorage.delete(`@mesh_family_members_:${shutdownUid}`);
      // Contact service keys
      DirectStorage.delete(`@afetnet:contacts_cache_v4:${shutdownUid}`);
      DirectStorage.delete(`@afetnet:blocked_cache_v4:${shutdownUid}`);
      DirectStorage.delete(`@afetnet:contacts_pending_sync_v4:${shutdownUid}`);
      // Health profile key (CRITICAL: sensitive medical PII — blood type, allergies, medications)
      DirectStorage.delete(`@afetnet:health_profile:user:${shutdownUid}`);
    }
  } catch { /* */ }

  // FIX: Clear early notification handler on shutdown to prevent push notifications
  // from showing alerts after logout (privacy leak — old account's notifications appear).
  try {
    const { getNotificationsAsync } = await import('./services/notifications/NotificationModuleLoader');
    const Notif = await getNotificationsAsync();
    if (Notif && typeof Notif.setNotificationHandler === 'function') {
      Notif.setNotificationHandler(null);
    }
  } catch { /* best effort */ }

  // Clean up NotificationCenter listeners (foreground + response)
  try {
    const { notificationCenter } = await import('./services/notifications/NotificationCenter');
    notificationCenter.destroy();
  } catch { /* already stopped */ }

  // Cleanup GlobalErrorHandler (restore original console.error)
  try {
    const { globalErrorHandlerService } = await import('./services/GlobalErrorHandler');
    globalErrorHandlerService.destroy();
  } catch { /* already stopped */ }

  // Cleanup NetworkResilienceService (clear Maps to free memory)
  try {
    const { networkResilienceService } = await import('./services/NetworkResilienceService');
    networkResilienceService.destroy();
  } catch { /* already stopped */ }

  // NOTE: Do NOT call cleanupAuthListener() here.
  // The auth listener (onAuthStateChanged) must persist across login/logout cycles.
  // shutdownApp() is called when user logs OUT — if we destroy the listener here,
  // a subsequent re-login via AuthService.signInWith*() changes Firebase Auth state
  // but no listener exists to detect it, leaving the user stuck on the Auth screen forever.
  // The auth listener is a lightweight Firebase listener — safe to keep alive.
  // It is only cleaned up on true app unmount (component unmount in App.tsx).

  // Cleanup OfflineSyncService (NetInfo listener + sync timer)
  try {
    const { offlineSyncService } = await import('./services/OfflineSyncService');
    offlineSyncService.destroy();
  } catch { /* already stopped */ }

  // CRITICAL FIX: Destroy MeshNetworkService (identity, queues, dedup LRU, timers, BLE).
  // stop() intentionally preserves identity/queues/dedup for reconnection. destroy() clears
  // everything. Without destroy() on logout, new user inherits old user's myId, queued packets,
  // and dedup state — causing cross-account identity leak and silently dropped messages.
  try {
    const { meshNetworkService } = await import('./services/mesh/MeshNetworkService');
    await meshNetworkService.destroy();
  } catch { /* already stopped */ }

  // CRITICAL FIX: Destroy MeshCryptoService (Curve25519 keypair + peer shared secrets).
  // Without this, after account switch the new user inherits the previous user's keypair
  // from SecureStore — encrypted messages are signed with wrong identity and old peer
  // secrets allow decryption of messages intended for the previous user.
  try {
    const { meshCryptoService } = await import('./services/mesh/MeshCryptoService');
    await meshCryptoService.destroy();
  } catch { /* already stopped */ }

  // CRITICAL FIX: Destroy MeshPowerManager (battery listener + background mesh service).
  // Without this, battery state listener continues firing after logout, profile change
  // callbacks reference stale service state, and background mesh service continues running.
  try {
    const { meshPowerManager } = await import('./services/mesh/MeshPowerManager');
    meshPowerManager.destroy();
  } catch { /* already stopped */ }

  // FIX: Clear MeshStore BEFORE destroying MeshMessageBridge — bridge's destroy()
  // may flush pending messages that read from MeshStore. Clearing after destroy
  // creates a race where bridge tries to access already-cleared data.
  try {
    const { useMeshStore } = await import('./services/mesh/MeshStore');
    useMeshStore.getState().clearMessages();
  } catch { /* best-effort */ }

  // CRITICAL FIX: Destroy MeshMessageBridge (3 subscriptions + sync timer)
  try {
    const { meshMessageBridge } = await import('./services/mesh/MeshMessageBridge');
    meshMessageBridge.destroy();
  } catch { /* already stopped */ }

  // FIX: Destroy VoiceMessageService on logout — stops active recording/playback,
  // clears in-memory voice data, prevents cross-account data leak via non-user-scoped
  // VOICE_MESSAGE_STORAGE key.
  try {
    const { voiceMessageService } = await import('./services/VoiceMessageService');
    await voiceMessageService.destroy();
  } catch { /* best-effort */ }

  // CRITICAL FIX: Destroy FamilyTrackingService (background location continues after logout).
  // destroy() instead of stopTracking() ensures callbacks + cached member state are also cleared,
  // preventing stale data from leaking across account switches.
  try {
    const { familyTrackingService } = await import('./services/FamilyTrackingService');
    familyTrackingService.destroy();
  } catch { /* already stopped */ }
  // CRITICAL FIX: Clear familyLocationSharingEnabled on logout to prevent cross-account leak.
  // Without this, the next user who logs in would inherit the previous user's sharing state.
  try { useSettingsStore.getState().setFamilyLocationSharing(false); } catch { /* best-effort */ }

  // AUDIT FIX: Clear familyStore subscriptions (Firestore onSnapshot listeners)
  try {
    const { useFamilyStore } = await import('./stores/familyStore');
    useFamilyStore.getState().clear();
  } catch { /* best-effort */ }

  // PRIVACY UX HARDENING: make sure no legacy location tasks remain active after shutdown.
  try {
    const { stopLegacyBackgroundLocationTasks } = await import('./services/BackgroundLocationGuard');
    await stopLegacyBackgroundLocationTasks('shutdownApp');
  } catch { /* best effort */ }

  // CRITICAL FIX: Destroy HighPerformanceBle (state listener, scan timer, connections)
  try {
    const { highPerformanceBle } = await import('./ble/HighPerformanceBle');
    await highPerformanceBle.destroy();
  } catch { /* already stopped */ }

  // Reset LocationService (prevents stale location + isInitialized from leaking to next account)
  try {
    const { locationService } = await import('./services/LocationService');
    locationService.reset();
  } catch { /* already stopped */ }

  // FIX: Reset FirebaseLocationOperations throttle (prevents cross-account state leak)
  try {
    const { resetLocationThrottle } = await import('./services/firebase/FirebaseLocationOperations');
    resetLocationThrottle();
  } catch { /* best-effort */ }

  // Cleanup StorageManagementService (monitoring interval)
  try {
    const { storageManagementService } = await import('./services/StorageManagementService');
    storageManagementService.destroy();
  } catch { /* already stopped */ }

  // Cleanup FirebaseAnalyticsService (flush pending events + clear storage)
  try {
    const { firebaseAnalyticsService } = await import('./services/FirebaseAnalyticsService');
    await firebaseAnalyticsService.cleanup();
  } catch { /* already stopped */ }

  // Cleanup FirebaseCrashlyticsService (flush pending crashes + clear storage)
  // Without this, crash reports from user A leak to user B after account switch.
  try {
    const { firebaseCrashlyticsService } = await import('./services/FirebaseCrashlyticsService');
    await firebaseCrashlyticsService.cleanup();
  } catch { /* already stopped */ }

  // Cleanup AccessibilityServiceElite (system listeners)
  try {
    const { accessibilityServiceElite } = await import('./services/AccessibilityServiceElite');
    accessibilityServiceElite.destroy();
  } catch { /* already stopped */ }

  isInitialized = false;
  isInitializing = false;
  useAppStore.getState().setReady(false);
}
