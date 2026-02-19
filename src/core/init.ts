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
let widgetDataBridgeService: any;
let multiSourceWidgetUnsubscribe: (() => void) | null = null;
let multiSourceBleAutoUnsubscribe: (() => void) | null = null;
// CRITICAL FIX: Store HybridMessageService subscription unsubscribe to prevent listener leaks
let hybridMessageUnsubscribe: (() => void) | null = null;

let isInitialized = false;
let isInitializing = false;
let seismicHealthCheckInterval: NodeJS.Timeout | null = null;
let settingsSubscription: (() => void) | null = null;

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
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
};

// ===========================================================================
// initializeApp — Phase-based bootstrapper
// ===========================================================================

export async function initializeApp(options: { authenticated?: boolean } = {}) {
  if (isInitialized || isInitializing) return;
  isInitializing = true;
  const appStore = useAppStore.getState();

  try {
    logger.info('🚀 Starting initialization...');

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
      // Multi-source / Widget / Watch
      msewsModule, wdbsModule, wbsModule,
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
      safeImport(() => import('./services/WidgetDataBridgeService'), 'WidgetDataBridgeService'),
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
    widgetDataBridgeService = wdbsModule?.widgetDataBridgeService;

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
        const { getAuth } = await import('firebase/auth');
        const fbMod = await import('../lib/firebase');
        const app = fbMod.getFirebaseAppAsync
          ? await Promise.race([fbMod.getFirebaseAppAsync(), new Promise<null>(r => setTimeout(() => r(null), 3000))])
          : null;
        if (app) isAuthed = !!getAuth(app).currentUser;
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
          ).catch(() => { });
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
    if (isAuthed) {
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
            const lastSeenListener = AppState.addEventListener('change', (state: string) => {
              if (state === 'active') updateLastSeen(uid);
            });
            // Store cleanup ref (cleaned up in shutdownApp via module unload)
            (globalThis as any).__lastSeenListener = lastSeenListener;
          }).catch(() => {});
        }
      } catch (e: unknown) { logger.error('IdentityService:', e); }

      try {
        const { firebaseDataService } = await import('./services/FirebaseDataService');
        await withTimeout(firebaseDataService.initialize(), 10_000, undefined);
        logger.info('✅ FirebaseDataService');
      } catch (e: unknown) { logger.error('FirebaseDataService:', e); }

      try {
        const { hybridMessageService } = await import('./services/HybridMessageService');
        // BUG 1 FIX: initialize() MUST be called before subscribeToMessages()
        // Without this, queue processing, connection listener, and device registration never start
        await withTimeout(hybridMessageService.initialize(), 15_000, undefined);
        // CRITICAL FIX: Store unsubscribe to prevent listener accumulation on re-login
        if (hybridMessageUnsubscribe) { hybridMessageUnsubscribe(); hybridMessageUnsubscribe = null; }
        hybridMessageUnsubscribe = await hybridMessageService.subscribeToMessages((msg) => {
          logger.debug(`Cloud msg: ${msg.id} from ${msg.senderId}`);
        });
        logger.info('✅ HybridMessageService initialized + subscriptions');
      } catch (e: unknown) { logger.error('HybridMessageService:', e); }

      // FIX: Initialize messageStore on boot (was only called lazily in MessagesScreen)
      // Without this, messages don't load from local storage until user opens Messages tab
      try {
        const { useMessageStore } = await import('./stores/messageStore');
        await withTimeout(useMessageStore.getState().initialize(), 10_000, undefined);
        logger.info('✅ MessageStore');
      } catch (e: unknown) { logger.error('MessageStore:', e); }

      // FIX: Initialize GroupChatService on boot so group message notifications
      // fire even before the user opens FamilyGroupChatScreen
      try {
        const { groupChatService } = await import('./services/GroupChatService');
        groupChatService.initialize();
        logger.info('✅ GroupChatService');
      } catch (e: unknown) { logger.error('GroupChatService:', e); }

      // CRITICAL FIX: Initialize MeshMessageBridge — bridges mesh ↔ cloud messages.
      // Without this, offline mesh messages never appear in the unified message UI
      // and are never synced to Firebase when the device comes back online.
      try {
        const { meshMessageBridge } = await import('./services/mesh/MeshMessageBridge');
        await meshMessageBridge.initialize();
        logger.info('✅ MeshMessageBridge');
      } catch (e: unknown) { logger.debug('MeshMessageBridge (optional):', e); }

      // ELITE: Start listening for incoming voice calls
      try {
        const { voiceCallService } = await import('./services/VoiceCallService');
        if (voiceCallService.isAvailable()) {
          voiceCallService.listenForIncomingCalls();
          logger.info('✅ VoiceCallService listener');
        }
      } catch (e: unknown) { logger.debug('VoiceCallService (optional):', e); }

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
      locationService?.initialize?.().catch((e: unknown) => logger.error('Location:', e));
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
        // Only start GPS tracking if location is enabled
        if (settings.locationEnabled) {
          await familyTrackingService.startTracking('init');
        }
        logger.info(`✅ FamilyTrackingService (tracking: ${settings.locationEnabled})`);
      } catch (e: unknown) { logger.error('FamilyTracking:', e); }

      // Initialize GroupChatService — subscribes to user's group conversations
      try {
        const { groupChatService } = await import('./services/GroupChatService');
        groupChatService.initialize();
        logger.info('✅ GroupChatService');
      } catch (e: unknown) { logger.error('GroupChatService:', e); }
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

    // BLE Mesh: Auto-initialize (not start) for auth users.
    // Only call initialize() which sets up identity and queues — does NOT prompt for Bluetooth.
    // The actual BLE scan/advertise starts when user triggers mesh or on SOS.
    // This ensures MeshNetworkService is ready to go instantly when needed.
    if (isAuthed) {
      try {
        const { meshNetworkService } = await import('./services/mesh/MeshNetworkService');
        await meshNetworkService.initialize();
        logger.info('✅ MeshNetworkService pre-initialized (BLE deferred until user action)');
      } catch (e: unknown) { logger.debug('Mesh pre-init (optional):', e); }
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
      try {
        multiSourceEEWService?.start?.();
        logger.info('✅ Multi-Source EEW (AFAD, Kandilli, USGS, EMSC)');
        if (multiSourceWidgetUnsubscribe) {
          multiSourceWidgetUnsubscribe();
          multiSourceWidgetUnsubscribe = null;
        }
        multiSourceWidgetUnsubscribe = multiSourceEEWService?.onEvent?.((event: any) => {
          widgetDataBridgeService?.updateLatestEarthquake?.({
            magnitude: event.magnitude,
            location: event.location,
            depth: event.depth,
            time: new Date(event.originTime),
          }).catch(() => { });
        }) || null;
      } catch (e: unknown) { logger.error('Multi-Source EEW:', e); }
    }

    widgetDataBridgeService?.initialize?.().catch((e: unknown) => logger.debug('Widget:', e));
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
          const retrySOSListeners = async (attempt: number, delayMs: number) => {
            if (attempt > MAX_SOS_RETRIES) {
              logger.error(`❌ SOS listeners FAILED after ${MAX_SOS_RETRIES} retries — user will NOT receive SOS alerts`);
              return;
            }
            setTimeout(async () => {
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
          };
          retrySOSListeners(1, 3000);
        }
      } catch (e: unknown) { logger.error('SOS Listeners:', e); }

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

    // iOS Live Activities
    if (Platform.OS === 'ios') {
      try {
        const { iOSLiveActivities } = await import('./services/iOSLiveActivitiesService');
        if (iOSLiveActivities.isAvailable()) logger.info('✅ iOS Live Activities');
      } catch { /* iOS 16.1+ required */ }
    }

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
            bleMeshService.initialize().then(() => bleMeshService.start()).catch(() => { });
            logger.warn(`🚨 BLE Mesh auto-started: M${event.magnitude} detected`);
          }
        }) || null;
      } catch (e: unknown) { logger.debug('BLE Mesh auto-trigger setup:', e); }
    }

    // Seismic health check (periodic restart if service dies)
    startSeismicHealthCheck();

    isInitialized = true;
    isInitializing = false;
    appStore.setReady(true);
    logger.info('✨ Initialization complete');

  } catch (error: unknown) {
    logger.error('❌ CRITICAL init failure:', error);
    isInitializing = false;
    appStore.setReady(true); // Allow UI to render in error state
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

  if (seismicHealthCheckInterval) { clearInterval(seismicHealthCheckInterval); seismicHealthCheckInterval = null; }
  if (settingsSubscription) { settingsSubscription(); settingsSubscription = null; }

  earthquakeService?.stop?.();
  bleMeshService?.stop?.();
  plumEEWService?.stop?.();
  multiSourceEEWService?.stop?.();
  realtimeEarthquakeMonitor?.stop?.();
  realTimeEEWConnection?.stop?.();
  onDeviceSeismicDetector?.stop?.();
  crowdsourcedSeismicNetwork?.stop?.();
  backgroundSeismicMonitor?.stop?.();

  if (multiSourceWidgetUnsubscribe) {
    multiSourceWidgetUnsubscribe();
    multiSourceWidgetUnsubscribe = null;
  }
  if (multiSourceBleAutoUnsubscribe) {
    multiSourceBleAutoUnsubscribe();
    multiSourceBleAutoUnsubscribe = null;
  }

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

  try {
    const { voiceCommandService } = await import('./services/VoiceCommandService');
    await voiceCommandService.stopListening();
  } catch { /* already stopped */ }

  // Cleanup BackgroundEEWService (AppState listener + background tasks)
  try {
    const { backgroundEEWService } = await import('./services/BackgroundEEWService');
    await backgroundEEWService.cleanup();
  } catch { /* already stopped */ }

  // Cleanup SOS listeners
  try {
    const { stopSOSAlertListener } = await import('./services/sos/SOSAlertListener');
    const { stopNearbySOSListener } = await import('./services/sos/NearbySOSListener');
    stopSOSAlertListener();
    stopNearbySOSListener();
  } catch { /* already stopped */ }

  isInitialized = false;
  isInitializing = false;
  useAppStore.getState().setReady(false);
}
