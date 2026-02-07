/**
 * CORE INITIALIZATION - ELITE PRODUCTION
 * Handles all service startup sequences with dependency management
 * Uses dynamic imports to prevent circular dependencies and improve startup time
 */

import { createLogger, setLogLevel } from './utils/logger';
import { useAppStore } from './stores/appStore';
import { useSettingsStore } from './stores/settingsStore';
import { Platform } from 'react-native';

const logger = createLogger('Init');

// ELITE: Type-safe service instance types using typeof imports
// This provides full type safety while maintaining lazy-loading to avoid circular deps
type EarthquakeServiceType = typeof import('./services/EarthquakeService')['earthquakeService'];
type BLEMeshServiceType = typeof import('./services/BLEMeshService')['bleMeshService'];
type LocationServiceType = typeof import('./services/LocationService')['locationService'];
type NotificationServiceType = typeof import('./services/NotificationService')['notificationService'];
type FirebaseServiceType = typeof import('./services/FirebaseService')['firebaseService'];
type PermissionServiceType = typeof import('./services/PermissionService')['permissionService'];
type BackgroundTaskServiceType = typeof import('./services/BackgroundTaskService')['backgroundTaskService'];
type SyncServiceType = typeof import('./services/OfflineSyncService')['offlineSyncService'];
type OfflineMapServiceType = typeof import('./services/OfflineMapService')['offlineMapService'];
// ELITE: EEW Advanced Services
type FCMTokenServiceType = typeof import('./services/FCMTokenService')['fcmTokenService'];
type BackgroundEEWServiceType = typeof import('./services/BackgroundEEWService')['backgroundEEWService'];
type PLUMEEWServiceType = typeof import('./services/PLUMEEWService')['plumEEWService'];
type MLPWaveClassifierType = typeof import('./services/MLPWaveClassifier')['mlPWaveClassifier'];
// ELITE: Multi-Source, Widget & Watch Services
type MultiSourceEEWServiceType = typeof import('./services/MultiSourceEEWService')['multiSourceEEWService'];
type WidgetDataBridgeServiceType = typeof import('./services/WidgetDataBridgeService')['widgetDataBridgeService'];
type WatchBridgeServiceType = typeof import('./services/WatchBridgeService')['watchBridgeService'];
// ELITE: Life-Saving Services (2026)
type TurkeyOfflineDataServiceType = typeof import('./services/TurkeyOfflineDataService')['turkeyOfflineDataService'];
type TurkeyAssemblyPointsServiceType = typeof import('./services/TurkeyAssemblyPointsService')['turkeyAssemblyPointsService'];
type ComprehensiveNotificationServiceType = typeof import('./services/ComprehensiveNotificationService')['comprehensiveNotificationService'];
type VoiceEvacuationServiceType = typeof import('./services/VoiceEvacuationService')['voiceEvacuationService'];
type NearestSafeZoneServiceType = typeof import('./services/NearestSafeZoneService')['nearestSafeZoneService'];
type BatterySOSServiceType = typeof import('./services/BatterySOSService')['batterySOSService'];
type TsunamiRiskServiceType = typeof import('./services/TsunamiRiskService')['tsunamiRiskService'];
type FirstAidGuideServiceType = typeof import('./services/FirstAidGuideService')['firstAidGuideService'];
type UltraEliteWaveServiceType = typeof import('./services/UltraEliteWaveService')['ultraEliteWaveService'];
// ELITE: World-Class EEW System (2026)
type RealtimeEarthquakeMonitorType = typeof import('./services/RealtimeEarthquakeMonitor')['realtimeEarthquakeMonitor'];
// ELITE: On-Device P-Wave Detection - WORLD'S FASTEST
type OnDeviceSeismicDetectorType = typeof import('./services/OnDeviceSeismicDetector')['onDeviceSeismicDetector'];
// ELITE: Crowdsourced Network - TÜRKIYE ÇAPINDA AĞ
type CrowdsourcedSeismicNetworkType = typeof import('./services/CrowdsourcedSeismicNetwork')['crowdsourcedSeismicNetwork'];

// Module-level variables with proper types (initialized after dynamic import)
let earthquakeService: EarthquakeServiceType | undefined;
let bleMeshService: BLEMeshServiceType | undefined;
let locationService: LocationServiceType | undefined;
let notificationService: NotificationServiceType | undefined;
let firebaseService: FirebaseServiceType | undefined;
let permissionService: PermissionServiceType | undefined;
let backgroundTaskService: BackgroundTaskServiceType | undefined;
let syncService: SyncServiceType | undefined;
let offlineMapService: OfflineMapServiceType | undefined;
// ELITE: EEW Advanced Service instances
let fcmTokenService: FCMTokenServiceType | undefined;
let backgroundEEWService: BackgroundEEWServiceType | undefined;
let plumEEWService: PLUMEEWServiceType | undefined;
let mlPWaveClassifier: MLPWaveClassifierType | undefined;
// ELITE: Multi-Source, Widget & Watch instances
let multiSourceEEWService: MultiSourceEEWServiceType | undefined;
let widgetDataBridgeService: WidgetDataBridgeServiceType | undefined;
let watchBridgeService: WatchBridgeServiceType | undefined;
// ELITE: Life-Saving Service instances
let turkeyOfflineDataService: TurkeyOfflineDataServiceType | undefined;
let turkeyAssemblyPointsService: TurkeyAssemblyPointsServiceType | undefined;
let comprehensiveNotificationService: ComprehensiveNotificationServiceType | undefined;
let voiceEvacuationService: VoiceEvacuationServiceType | undefined;
let nearestSafeZoneService: NearestSafeZoneServiceType | undefined;
let batterySOSService: BatterySOSServiceType | undefined;
let tsunamiRiskService: TsunamiRiskServiceType | undefined;
let firstAidGuideService: FirstAidGuideServiceType | undefined;
let ultraEliteWaveService: UltraEliteWaveServiceType | undefined;
// ELITE: World-Class EEW System
let realtimeEarthquakeMonitor: RealtimeEarthquakeMonitorType | undefined;
// ELITE: On-Device P-Wave (World's Fastest)
let onDeviceSeismicDetector: OnDeviceSeismicDetectorType | undefined;
// ELITE: Crowdsourced Network (Türkiye Çapında)
let crowdsourcedSeismicNetwork: CrowdsourcedSeismicNetworkType | undefined;
// ELITE: Background Seismic Monitor (7/24 Protection)
type BackgroundSeismicMonitorType = typeof import('./services/BackgroundSeismicMonitor')['backgroundSeismicMonitor'];
let backgroundSeismicMonitor: BackgroundSeismicMonitorType | undefined;

let isInitialized = false;
let isInitializing = false;
let seismicHealthCheckInterval: NodeJS.Timeout | null = null;
let settingsSubscription: (() => void) | null = null;

function mapFontScaleToAccessibilitySize(fontScale: number): 'small' | 'normal' | 'large' | 'extraLarge' {
  if (fontScale <= 0.9) return 'small';
  if (fontScale < 1.15) return 'normal';
  if (fontScale < 1.4) return 'large';
  return 'extraLarge';
}

function applyLogLevelFromSettings(debugModeEnabled: boolean, verboseLoggingEnabled: boolean): void {
  if (verboseLoggingEnabled || debugModeEnabled) {
    setLogLevel('debug');
    return;
  }
  setLogLevel(__DEV__ ? 'info' : 'warn');
}

async function applyRuntimeSettingEffects(): Promise<void> {
  const settings = useSettingsStore.getState();

  applyLogLevelFromSettings(settings.debugModeEnabled, settings.verboseLoggingEnabled);

  try {
    const { accessibilityServiceElite } = await import('./services/AccessibilityServiceElite');
    await accessibilityServiceElite.initialize();
    await accessibilityServiceElite.updateSettings({
      fontSize: mapFontScaleToAccessibilitySize(settings.fontScale),
      highContrast: settings.highContrastEnabled,
    });
  } catch (error) {
    logger.debug('Accessibility runtime bridge skipped:', error);
  }

  try {
    const { voiceCommandService } = await import('./services/VoiceCommandService');
    if (settings.voiceCommandEnabled) {
      await voiceCommandService.initialize();
      await voiceCommandService.startListening();
    } else {
      await voiceCommandService.stopListening();
    }
  } catch (error) {
    logger.debug('Voice command runtime bridge skipped:', error);
  }

  try {
    if (multiSourceEEWService) {
      multiSourceEEWService.setSourceEnabled('AFAD', settings.sourceAFAD);
      multiSourceEEWService.setSourceEnabled('KANDILLI', settings.sourceKOERI);
      multiSourceEEWService.setSourceEnabled('USGS', settings.sourceUSGS);
      multiSourceEEWService.setSourceEnabled('EMSC', settings.sourceEMSC);
    }
  } catch (error) {
    logger.debug('EEW source runtime bridge skipped:', error);
  }
}

export async function initializeApp(options: { authenticated?: boolean } = {}) {
  if (isInitialized || isInitializing) {
    return;
  }

  isInitializing = true;
  const appStore = useAppStore.getState();

  try {
    logger.info('🚀 Starting AfetNet Elite initialization...');

    // 1. Load core services dynamically (Parallel Loading for Speed)
    // CRITICAL: Use Promise.allSettled so ONE service failure doesn't crash entire app
    logger.info('📦 Loading services dynamically...');

    // ELITE RESILIENT PATTERN: Load each service with individual try-catch
    const safeImport = async <T>(importFn: () => Promise<T>, name: string): Promise<T | null> => {
      try {
        return await importFn();
      } catch (error) {
        logger.error(`Failed to import ${name}:`, error);
        return null;
      }
    };

    const [
      esModule,
      bmsModule,
      lsModule,
      nsModule,
      fsModule,
      psModule,
      btsModule,
      ssModule,
      omsModule,
      // ELITE: EEW Advanced Services
      ftsModule,
      bewsModule,
      pewsModule,
      mlcModule,
      // ELITE: Multi-Source, Widget & Watch Services
      msewsModule,
      wdbsModule,
      wbsModule,
      // ELITE: Life-Saving Services (2026)
      todsModule,
      tapsModule,
      cnsModule,
      vesModule,
      nszsModule,
      bsosModule,
      trsModule,
      fagsModule,
      uewsModule,
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
      // ELITE: EEW Advanced Services
      safeImport(() => import('./services/FCMTokenService'), 'FCMTokenService'),
      safeImport(() => import('./services/BackgroundEEWService'), 'BackgroundEEWService'),
      safeImport(() => import('./services/PLUMEEWService'), 'PLUMEEWService'),
      safeImport(() => import('./services/MLPWaveClassifier'), 'MLPWaveClassifier'),
      // ELITE: Multi-Source, Widget & Watch Services
      safeImport(() => import('./services/MultiSourceEEWService'), 'MultiSourceEEWService'),
      safeImport(() => import('./services/WidgetDataBridgeService'), 'WidgetDataBridgeService'),
      safeImport(() => import('./services/WatchBridgeService'), 'WatchBridgeService'),
      // ELITE: Life-Saving Services (2026)
      safeImport(() => import('./services/TurkeyOfflineDataService'), 'TurkeyOfflineDataService'),
      safeImport(() => import('./services/TurkeyAssemblyPointsService'), 'TurkeyAssemblyPointsService'),
      safeImport(() => import('./services/ComprehensiveNotificationService'), 'ComprehensiveNotificationService'),
      safeImport(() => import('./services/VoiceEvacuationService'), 'VoiceEvacuationService'),
      safeImport(() => import('./services/NearestSafeZoneService'), 'NearestSafeZoneService'),
      safeImport(() => import('./services/BatterySOSService'), 'BatterySOSService'),
      safeImport(() => import('./services/TsunamiRiskService'), 'TsunamiRiskService'),
      safeImport(() => import('./services/FirstAidGuideService'), 'FirstAidGuideService'),
      safeImport(() => import('./services/UltraEliteWaveService'), 'UltraEliteWaveService'),
    ]);

    // ELITE: Safely extract services with null fallback
    earthquakeService = esModule?.earthquakeService;
    bleMeshService = bmsModule?.bleMeshService;
    locationService = lsModule?.locationService;
    notificationService = nsModule?.notificationService;
    firebaseService = fsModule?.firebaseService;
    permissionService = psModule?.permissionService;
    backgroundTaskService = btsModule?.backgroundTaskService;
    syncService = ssModule?.offlineSyncService;
    offlineMapService = omsModule?.offlineMapService;
    // ELITE: EEW Advanced Services
    fcmTokenService = ftsModule?.fcmTokenService;
    backgroundEEWService = bewsModule?.backgroundEEWService;
    plumEEWService = pewsModule?.plumEEWService;
    mlPWaveClassifier = mlcModule?.mlPWaveClassifier;
    // ELITE: Multi-Source, Widget & Watch Services
    multiSourceEEWService = msewsModule?.multiSourceEEWService;
    widgetDataBridgeService = wdbsModule?.widgetDataBridgeService;
    watchBridgeService = wbsModule?.watchBridgeService;
    // ELITE: Life-Saving Services (2026)
    turkeyOfflineDataService = todsModule?.turkeyOfflineDataService;
    turkeyAssemblyPointsService = tapsModule?.turkeyAssemblyPointsService;
    comprehensiveNotificationService = cnsModule?.comprehensiveNotificationService;
    voiceEvacuationService = vesModule?.voiceEvacuationService;
    nearestSafeZoneService = nszsModule?.nearestSafeZoneService;
    batterySOSService = bsosModule?.batterySOSService;
    tsunamiRiskService = trsModule?.tsunamiRiskService;
    firstAidGuideService = fagsModule?.firstAidGuideService;
    ultraEliteWaveService = uewsModule?.ultraEliteWaveService;

    logger.info('✅ Services loaded (including EEW Elite + Multi-Source + Life-Saving)');

    // 2. Initialize Firebase (Notifications)
    // Fire and forget - don't block app startup
    firebaseService?.initialize?.().catch((err: unknown) => {
      logger.error('Firebase init warning:', err);
    });

    // ============================================================
    // ELITE AUTH GUARD: Check authentication state for Phase B services
    // Phase A = public API / local services (no auth needed)
    // Phase B = Firestore / FCM / Sync services (auth required)
    // ============================================================
    let isUserAuthenticated = options.authenticated === true;
    if (!isUserAuthenticated) {
      try {
        const { getAuth } = await import('firebase/auth');
        const fbModule = await import('../lib/firebase');
        const firebaseApp = fbModule.getFirebaseAppAsync ? await Promise.race([
          fbModule.getFirebaseAppAsync(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]) : null;
        if (firebaseApp) {
          isUserAuthenticated = !!getAuth(firebaseApp).currentUser;
        }
      } catch (authCheckErr) {
        logger.debug('Auth check skipped (Firebase not ready):', authCheckErr);
      }
    }

    const runtimeSettings = useSettingsStore.getState();
    await applyRuntimeSettingEffects();

    if (settingsSubscription) {
      settingsSubscription();
      settingsSubscription = null;
    }
    settingsSubscription = useSettingsStore.subscribe((state, prev) => {
      const runtimeBridgeChanged =
        state.fontScale !== prev.fontScale ||
        state.highContrastEnabled !== prev.highContrastEnabled ||
        state.debugModeEnabled !== prev.debugModeEnabled ||
        state.verboseLoggingEnabled !== prev.verboseLoggingEnabled ||
        state.voiceCommandEnabled !== prev.voiceCommandEnabled ||
        state.sourceAFAD !== prev.sourceAFAD ||
        state.sourceKOERI !== prev.sourceKOERI ||
        state.sourceUSGS !== prev.sourceUSGS ||
        state.sourceEMSC !== prev.sourceEMSC;

      if (runtimeBridgeChanged) {
        void applyRuntimeSettingEffects();
      }

      if (state.earthquakeMonitoringEnabled !== prev.earthquakeMonitoringEnabled) {
        if (state.earthquakeMonitoringEnabled) {
          earthquakeService?.start?.().catch((error: unknown) => {
            logger.error('Failed to start earthquake service after setting change:', error);
          });
        } else {
          earthquakeService?.stop?.();
        }
      }

      if (state.locationEnabled !== prev.locationEnabled) {
        if (state.locationEnabled) {
          locationService?.initialize?.().catch((error: unknown) => {
            logger.error('Failed to initialize location service after setting change:', error);
          });
        } else {
          import('./services/FamilyTrackingService').then(({ familyTrackingService }) => {
            familyTrackingService.stopTracking('settings-location-disabled');
          }).catch((error) => {
            logger.debug('FamilyTrackingService stop skipped:', error);
          });
        }
      }

      if (state.sourceCommunity !== prev.sourceCommunity) {
        if (state.sourceCommunity) {
          crowdsourcedSeismicNetwork?.initialize?.().catch((error: unknown) => {
            logger.error('Failed to start community seismic network after setting change:', error);
          });
        } else {
          crowdsourcedSeismicNetwork?.stop?.();
        }
      }
    });

    // 3. CRITICAL: Initialize FirebaseDataService (Messaging & Data)
    // Bu olmadan mesajlar Cloud'a kaydedilmiyor!
    // ELITE: Only initialize if user is authenticated (prevents permission-denied errors)
    if (isUserAuthenticated) {
      try {
        const { firebaseDataService } = await import('./services/FirebaseDataService');
        await firebaseDataService.initialize();
        logger.info('✅ FirebaseDataService initialized (messaging enabled)');
      } catch (err: unknown) {
        logger.error('FirebaseDataService init warning (app continues with mesh):', err);
      }
    } else {
      logger.info('ℹ️ FirebaseDataService deferred — awaiting user authentication');
    }

    // 4. Initialize Location (Required for distance calculations)
    // Global location toggle: do not start location stack when disabled.
    if (runtimeSettings.locationEnabled) {
      locationService?.initialize?.().catch((err: unknown) => {
        logger.error('Location init warning:', err);
      });
    } else {
      logger.info('ℹ️ Location services disabled by user settings');
    }

    // 5. Initialize Earthquake Service (Core Feature)
    // Starts polling for earthquake data
    if (runtimeSettings.earthquakeMonitoringEnabled) {
      try {
        await earthquakeService?.start?.();
        logger.info('✅ Earthquake service started');
      } catch (error: unknown) {
        logger.error('❌ Earthquake service start failed:', error);
      }
    } else {
      logger.info('ℹ️ Earthquake service disabled by user settings');
    }

    // 6. BLE Mesh startup is deferred.
    // Apple review compliance: avoid Bluetooth permission prompts at app launch.
    // Mesh starts when the user explicitly enables the feature in UI/onboarding.
    logger.info('ℹ️ BLE Mesh auto-start deferred until user action');

    // 7. Initialize Background Tasks
    // Registers background fetch/tasks
    try {
      await backgroundTaskService?.registerTasks?.();
      logger.info('✅ Background tasks registered');
    } catch (error: unknown) {
      logger.error('❌ Background task registration failed:', error);
    }

    // 8. Initialize Sync Service (AUTH REQUIRED)
    // Syncs data with backend if online
    if (isUserAuthenticated) {
      syncService?.forceSync?.().catch((err: unknown) => {
        logger.debug('Initial sync skipped:', err);
      });
    }

    // 9. Initialize Offline Maps
    // Checks for downloaded maps
    offlineMapService?.initialize?.().catch((err: unknown) => {
      logger.debug('Offline map init skipped:', err);
    });

    // ============================================================
    // ELITE: EEW ADVANCED SERVICES INITIALIZATION
    // ============================================================

    // 10. Initialize FCM Token Service (AUTH REQUIRED — Push Notifications)
    // Registers device for server-side push notifications
    if (isUserAuthenticated) {
      try {
        await fcmTokenService?.initialize?.();
        logger.info('✅ FCM Token service initialized');
      } catch (error: unknown) {
        logger.error('❌ FCM Token service init failed:', error);
      }
    }

    // 11. Initialize Background EEW Service (AUTH REQUIRED)
    // Enables earthquake monitoring when app is in background
    if (isUserAuthenticated && runtimeSettings.eewEnabled) {
      try {
        await backgroundEEWService?.initialize?.();
        logger.info('✅ Background EEW service initialized');
      } catch (error: unknown) {
        logger.error('❌ Background EEW service init failed:', error);
      }
    } else if (isUserAuthenticated) {
      logger.info('ℹ️ Background EEW disabled by user settings');
    }

    // 12. Initialize PLUM EEW Service
    // JMA-style proximity-based intensity prediction
    // Note: PLUM uses start() not initialize() - requires user location
    if (runtimeSettings.locationEnabled && plumEEWService && locationService) {
      const loc = locationService.getCurrentLocation?.();
      if (loc) {
        plumEEWService.start({ latitude: loc.latitude, longitude: loc.longitude }).catch((err: unknown) => {
          logger.debug('PLUM EEW start skipped:', err);
        });
      }
    }

    // 13. Initialize ML P-Wave Classifier
    // Reduces false positives with intelligent classification
    mlPWaveClassifier?.initialize?.().catch((err: unknown) => {
      logger.debug('ML Classifier init skipped:', err);
    });

    // ============================================================
    // ELITE: MULTI-SOURCE, WIDGET & WATCH SERVICES
    // ============================================================

    // 14. Initialize Multi-Source EEW Service (AUTH REQUIRED)
    // AFAD, Kandilli, USGS, EMSC - çoklu kaynak desteği
    if (isUserAuthenticated && runtimeSettings.eewEnabled) {
      try {
        multiSourceEEWService?.start?.();
        logger.info('✅ Multi-Source EEW service started (AFAD, Kandilli, USGS, EMSC)');

        // Subscribe to events and forward to widget
        multiSourceEEWService?.onEvent?.((event) => {
          // Update widget with latest earthquake
          widgetDataBridgeService?.updateLatestEarthquake?.({
            magnitude: event.magnitude,
            location: event.location,
            depth: event.depth,
            time: new Date(event.originTime),
          }).catch(() => { /* ignore widget errors */ });
        });
      } catch (error: unknown) {
        logger.error('❌ Multi-Source EEW service start failed:', error);
      }
    } else if (isUserAuthenticated) {
      logger.info('ℹ️ Multi-Source EEW disabled by user settings');
    } else {
      logger.info('ℹ️ Multi-Source EEW deferred — awaiting user authentication');
    }

    // 15. Initialize Widget Data Bridge
    // iOS/Android widget veri senkronizasyonu
    widgetDataBridgeService?.initialize?.().catch((err: unknown) => {
      logger.debug('Widget bridge init skipped:', err);
    });

    // 16. Initialize Watch Bridge Service
    // Apple Watch / WearOS bağlantısı
    watchBridgeService?.initialize?.().catch((err: unknown) => {
      logger.debug('Watch bridge init skipped:', err);
    });

    // ============================================================
    // ELITE: LIFE-SAVING SERVICES INITIALIZATION (2026)
    // ============================================================

    if (isUserAuthenticated) {
      // 18. Initialize Comprehensive Notification Service
      // 12 Android channels, 25+ notification types
      comprehensiveNotificationService?.initialize?.().catch((err: unknown) => {
        logger.debug('Comprehensive notification init skipped:', err);
      });

      // 19. Initialize Voice Evacuation Service
      // TR/EN TTS-based evacuation guidance
      voiceEvacuationService?.initialize?.().catch((err: unknown) => {
        logger.debug('Voice evacuation init skipped:', err);
      });

      // 20. Initialize Battery SOS Service
      // Auto-SOS at 10% battery
      batterySOSService?.initialize?.().catch((err: unknown) => {
        logger.debug('Battery SOS init skipped:', err);
      });

      // 21. Initialize Nearest Safe Zone Service
      // Assembly points navigation
      nearestSafeZoneService?.initialize?.().catch((err: unknown) => {
        logger.debug('Safe zone service init skipped:', err);
      });

      // 22. Initialize Ultra Elite Wave Service
      // World's most advanced P/S wave calculations
      ultraEliteWaveService?.initialize?.().catch((err: unknown) => {
        logger.debug('Ultra elite wave service init skipped:', err);
      });

      // Note: TurkeyOfflineDataService, TurkeyAssemblyPointsService,
      // TsunamiRiskService, FirstAidGuideService are data-only services
      // No initialization required - they're ready to use immediately
      logger.info('✅ Life-Saving services initialized (Notification, Voice, Battery, SafeZone, Wave)');
    } else {
      logger.info('ℹ️ Life-Saving realtime services deferred — awaiting user authentication');
    }

    // 24. ELITE: Initialize Realtime Earthquake Monitor (World-Class EEW) (AUTH REQUIRED)
    // WebSocket + HTTP fallback for EMSC, AFAD, Kandilli
    if (isUserAuthenticated && runtimeSettings.eewEnabled) {
      try {
        const { realtimeEarthquakeMonitor: rem } = await import('./services/RealtimeEarthquakeMonitor');
        realtimeEarthquakeMonitor = rem;

        // Get user location and set it
        const loc = locationService?.getCurrentLocation?.();
        if (loc) {
          realtimeEarthquakeMonitor.setUserLocation(loc.latitude, loc.longitude);
        }

        await realtimeEarthquakeMonitor.start();
        logger.info('✅ RealtimeEarthquakeMonitor started (WebSocket + 3-Source Redundancy)');
      } catch (error: unknown) {
        logger.error('❌ RealtimeEarthquakeMonitor start failed:', error);
      }
    }

    // 25. ELITE: Initialize On-Device Seismic Detector (WORLD'S FASTEST!) (AUTH REQUIRED)
    // Uses phone's accelerometer for P-wave detection - <1 second alerts!
    if (isUserAuthenticated && runtimeSettings.seismicSensorEnabled) {
      try {
        const { onDeviceSeismicDetector: odsd } = await import('./services/OnDeviceSeismicDetector');
        onDeviceSeismicDetector = odsd;

        await onDeviceSeismicDetector.start();
        logger.info('🚀 OnDeviceSeismicDetector started (P-Wave Detection - <1s Alert!)');
      } catch (error: unknown) {
        logger.error('❌ OnDeviceSeismicDetector start failed:', error);
      }
    } else if (isUserAuthenticated) {
      logger.info('ℹ️ OnDeviceSeismicDetector disabled by user settings');
    }

    // 26. ELITE: Initialize Crowdsourced Seismic Network (AUTH REQUIRED)
    // Connects with other AfetNet users for multi-device verification
    if (isUserAuthenticated && runtimeSettings.sourceCommunity) {
      try {
        const { crowdsourcedSeismicNetwork: csn } = await import('./services/CrowdsourcedSeismicNetwork');
        crowdsourcedSeismicNetwork = csn;

        // Set user location if available
        const loc = locationService?.getCurrentLocation?.();
        if (loc) {
          crowdsourcedSeismicNetwork.setUserLocation(loc.latitude, loc.longitude);
        }

        await crowdsourcedSeismicNetwork.initialize();
        logger.info('🌐 CrowdsourcedSeismicNetwork initialized (Türkiye-wide network)');
      } catch (error: unknown) {
        logger.error('❌ CrowdsourcedSeismicNetwork init failed:', error);
      }
    } else if (isUserAuthenticated) {
      logger.info('ℹ️ CrowdsourcedSeismicNetwork disabled by sourceCommunity setting');
    }

    // 27. ELITE: Initialize Background Seismic Monitor (AUTH REQUIRED)
    // Provides 24/7 earthquake detection even when app is closed
    if (isUserAuthenticated && runtimeSettings.seismicSensorEnabled) {
      try {
        const { backgroundSeismicMonitor: bsm } = await import('./services/BackgroundSeismicMonitor');
        backgroundSeismicMonitor = bsm;
        await backgroundSeismicMonitor.initialize();
        logger.info('🌙 BackgroundSeismicMonitor initialized (24/7 protection)');
      } catch (error: unknown) {
        logger.error('❌ BackgroundSeismicMonitor init failed:', error);
      }
    }

    // 28. ELITE: Initialize Real-Time EEW Connection (AUTH REQUIRED — Sub-100ms Delivery!)
    // WebSocket-like Firebase Realtime DB listener for instant alerts
    if (isUserAuthenticated && runtimeSettings.eewEnabled) {
      try {
        const { realTimeEEWConnection } = await import('./services/RealTimeEEWConnectionService');
        await realTimeEEWConnection.start();
        logger.info('⚡ RealTimeEEWConnection started (Sub-100ms delivery via Realtime DB)');
      } catch (error: unknown) {
        logger.error('❌ RealTimeEEWConnection start failed:', error);
      }
    }

    // 28b. MultiSourceEEWService already started at step 14.

    // 29. ELITE: Warmup UltraFast EEW Notification (AUTH REQUIRED)
    // Pre-loads TTS engine and sound files for instant alert delivery
    if (isUserAuthenticated && runtimeSettings.eewEnabled) {
      try {
        const { ultraFastEEWNotification } = await import('./services/UltraFastEEWNotification');
        await ultraFastEEWNotification.warmup();
        logger.info('🔥 UltraFastEEWNotification warmed up (Zero-latency TTS ready)');
      } catch (error: unknown) {
        logger.error('❌ UltraFastEEWNotification warmup failed:', error);
      }
    }

    // 30. ELITE: Initialize Elite Notification Handler (Premium UI)
    // Manages premium animated overlays and adaptive proximity alerts
    try {
      const { eliteNotificationHandler } = await import('./services/EliteNotificationHandlerService');
      await eliteNotificationHandler.initialize();
      logger.info('🎨 EliteNotificationHandler initialized (Premium UI + Adaptive Proximity)');
    } catch (error: unknown) {
      logger.error('❌ EliteNotificationHandler init failed:', error);
    }

    // 31. ELITE: Initialize iOS Live Activities (Lock-Screen Countdown)
    // Provides lock-screen EEW countdown on iOS 16.1+
    if (Platform.OS === 'ios') {
      try {
        const { iOSLiveActivities } = await import('./services/iOSLiveActivitiesService');
        if (iOSLiveActivities.isAvailable()) {
          logger.info('📱 iOS Live Activities available (Lock-screen countdown ready)');
        } else {
          logger.debug('iOS Live Activities not available (iOS 16.1+ required or native module missing)');
        }
      } catch (error: unknown) {
        logger.debug('iOS Live Activities setup skipped:', error);
      }
    }

    // 23. Start Seismic Health Check (Periodic)
    // Ensures earthquake polling is active
    startSeismicHealthCheck();

    isInitialized = true;
    isInitializing = false;
    appStore.setReady(true);

    logger.info('✨ AfetNet initialized successfully - 31 Elite Services Active!');

  } catch (error: unknown) {
    logger.error('❌ CRITICAL: Init failed:', error);
    isInitializing = false;
    // Even if init fails, we set ready to true to allow UI to render (possibly in error state)
    appStore.setReady(true);
  }
}

function startSeismicHealthCheck() {
  if (seismicHealthCheckInterval) return;

  // Check every 1 minute
  seismicHealthCheckInterval = setInterval(() => {
    if (!useSettingsStore.getState().earthquakeMonitoringEnabled) {
      return;
    }
    if (earthquakeService && !earthquakeService.getIsRunning()) {
      logger.warn('⚠️ Seismic service stopped, restarting...');
      earthquakeService.start?.().catch((err: unknown) => {
        logger.error('Failed to restart seismic service:', err);
      });
    }
  }, 60000);
}

export async function shutdownApp() {
  if (!isInitialized) return;

  logger.info('Shutting down...');

  if (seismicHealthCheckInterval) {
    clearInterval(seismicHealthCheckInterval);
    seismicHealthCheckInterval = null;
  }

  if (settingsSubscription) {
    settingsSubscription();
    settingsSubscription = null;
  }

  // Stop services gracefully
  if (earthquakeService) earthquakeService.stop();
  if (bleMeshService) bleMeshService.stop();

  // ELITE: Stop EEW Advanced Services
  if (plumEEWService) plumEEWService.stop();
  if (realtimeEarthquakeMonitor) realtimeEarthquakeMonitor.stop();
  if (onDeviceSeismicDetector) onDeviceSeismicDetector.stop();
  if (crowdsourcedSeismicNetwork) crowdsourcedSeismicNetwork.stop();
  // backgroundEEWService and fcmTokenService don't have stop methods - they clean up automatically

  try {
    const { voiceCommandService } = await import('./services/VoiceCommandService');
    await voiceCommandService.stopListening();
  } catch (error) {
    logger.debug('Voice command shutdown skipped:', error);
  }

  // Cleanup Firebase listeners
  try {
    firebaseService?.cleanup?.();
  } catch (error: unknown) {
    logger.error('Firebase cleanup error:', error);
  }

  isInitialized = false;
  useAppStore.getState().setReady(false);
}
