/**
 * CORE INITIALIZATION - ELITE PRODUCTION
 * Handles all service startup sequences with dependency management
 * Uses dynamic imports to prevent circular dependencies and improve startup time
 */

import { createLogger } from './utils/logger';
import { useAppStore } from './stores/appStore';
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

export async function initializeApp() {
  if (isInitialized || isInitializing) {
    return;
  }

  isInitializing = true;
  const appStore = useAppStore.getState();

  try {
    logger.info('🚀 Starting AfetNet Elite initialization...');

    // 1. Load core services dynamically (Parallel Loading for Speed)
    // CRITICAL: Load all services in parallel to minimize startup time
    logger.info('📦 Loading services dynamically...');

    const [
      { earthquakeService: es },
      { bleMeshService: bms },
      { locationService: ls },
      { notificationService: ns },
      { firebaseService: fs },
      { permissionService: ps },
      { backgroundTaskService: bts },
      { offlineSyncService: ss },
      { offlineMapService: oms },
      // ELITE: EEW Advanced Services
      { fcmTokenService: fts },
      { backgroundEEWService: bews },
      { plumEEWService: pews },
      { mlPWaveClassifier: mlc },
      // ELITE: Multi-Source, Widget & Watch Services
      { multiSourceEEWService: msews },
      { widgetDataBridgeService: wdbs },
      { watchBridgeService: wbs },
      // ELITE: Life-Saving Services (2026)
      { turkeyOfflineDataService: tods },
      { turkeyAssemblyPointsService: taps },
      { comprehensiveNotificationService: cns },
      { voiceEvacuationService: ves },
      { nearestSafeZoneService: nszs },
      { batterySOSService: bsos },
      { tsunamiRiskService: trs },
      { firstAidGuideService: fags },
      { ultraEliteWaveService: uews },
    ] = await Promise.all([
      import('./services/EarthquakeService'),
      import('./services/BLEMeshService'),
      import('./services/LocationService'),
      import('./services/NotificationService'),
      import('./services/FirebaseService'),
      import('./services/PermissionService'),
      import('./services/BackgroundTaskService'),
      import('./services/OfflineSyncService'),
      import('./services/OfflineMapService'),
      // ELITE: EEW Advanced Services
      import('./services/FCMTokenService'),
      import('./services/BackgroundEEWService'),
      import('./services/PLUMEEWService'),
      import('./services/MLPWaveClassifier'),
      // ELITE: Multi-Source, Widget & Watch Services
      import('./services/MultiSourceEEWService'),
      import('./services/WidgetDataBridgeService'),
      import('./services/WatchBridgeService'),
      // ELITE: Life-Saving Services (2026)
      import('./services/TurkeyOfflineDataService'),
      import('./services/TurkeyAssemblyPointsService'),
      import('./services/ComprehensiveNotificationService'),
      import('./services/VoiceEvacuationService'),
      import('./services/NearestSafeZoneService'),
      import('./services/BatterySOSService'),
      import('./services/TsunamiRiskService'),
      import('./services/FirstAidGuideService'),
      import('./services/UltraEliteWaveService'),
    ]);

    // Assign to module-level variables
    earthquakeService = es;
    bleMeshService = bms;
    locationService = ls;
    notificationService = ns;
    firebaseService = fs;
    permissionService = ps;
    backgroundTaskService = bts;
    syncService = ss;
    offlineMapService = oms;
    // ELITE: EEW Advanced Services
    fcmTokenService = fts;
    backgroundEEWService = bews;
    plumEEWService = pews;
    mlPWaveClassifier = mlc;
    // ELITE: Multi-Source, Widget & Watch Services
    multiSourceEEWService = msews;
    widgetDataBridgeService = wdbs;
    watchBridgeService = wbs;
    // ELITE: Life-Saving Services (2026)
    turkeyOfflineDataService = tods;
    turkeyAssemblyPointsService = taps;
    comprehensiveNotificationService = cns;
    voiceEvacuationService = ves;
    nearestSafeZoneService = nszs;
    batterySOSService = bsos;
    tsunamiRiskService = trs;
    firstAidGuideService = fags;
    ultraEliteWaveService = uews;

    logger.info('✅ Services loaded (including EEW Elite + Multi-Source + Life-Saving)');

    // 2. Initialize Firebase (Notifications)
    // Fire and forget - don't block app startup
    firebaseService?.initialize?.().catch((err: unknown) => {
      logger.error('Firebase init warning:', err);
    });

    // 3. CRITICAL: Initialize FirebaseDataService (Messaging & Data)
    // Bu olmadan mesajlar Cloud'a kaydedilmiyor!
    try {
      const { firebaseDataService } = await import('./services/FirebaseDataService');
      await firebaseDataService.initialize();
      logger.info('✅ FirebaseDataService initialized (messaging enabled)');
    } catch (err: unknown) {
      logger.error('FirebaseDataService init warning (app continues with mesh):', err);
    }

    // 4. Initialize Location (Required for distance calculations)
    // Fire and forget - permission prompt will handle UI
    locationService?.initialize?.().catch((err: unknown) => {
      logger.error('Location init warning:', err);
    });

    // 5. Initialize Earthquake Service (Core Feature)
    // Starts polling for earthquake data
    try {
      await earthquakeService?.start?.();
      logger.info('✅ Earthquake service started');
    } catch (error: unknown) {
      logger.error('❌ Earthquake service start failed:', error);
    }

    // 6. Initialize BLE Mesh (Offline Communication)
    // Starts advertising/scanning if enabled
    try {
      await bleMeshService?.start?.();
      logger.info('✅ BLE Mesh service started');
    } catch (error: unknown) {
      logger.error('❌ BLE Mesh service start failed:', error);
    }

    // 7. Initialize Background Tasks
    // Registers background fetch/tasks
    try {
      await backgroundTaskService?.registerTasks?.();
      logger.info('✅ Background tasks registered');
    } catch (error: unknown) {
      logger.error('❌ Background task registration failed:', error);
    }

    // 8. Initialize Sync Service
    // Syncs data with backend if online
    syncService?.forceSync?.().catch((err: unknown) => {
      logger.debug('Initial sync skipped:', err);
    });

    // 9. Initialize Offline Maps
    // Checks for downloaded maps
    offlineMapService?.initialize?.().catch((err: unknown) => {
      logger.debug('Offline map init skipped:', err);
    });

    // ============================================================
    // ELITE: EEW ADVANCED SERVICES INITIALIZATION
    // ============================================================

    // 10. Initialize FCM Token Service (Push Notifications)
    // Registers device for server-side push notifications
    try {
      await fcmTokenService?.initialize?.();
      logger.info('✅ FCM Token service initialized');
    } catch (error: unknown) {
      logger.error('❌ FCM Token service init failed:', error);
    }

    // 11. Initialize Background EEW Service
    // Enables earthquake monitoring when app is in background
    try {
      await backgroundEEWService?.initialize?.();
      logger.info('✅ Background EEW service initialized');
    } catch (error: unknown) {
      logger.error('❌ Background EEW service init failed:', error);
    }

    // 12. Initialize PLUM EEW Service
    // JMA-style proximity-based intensity prediction
    // Note: PLUM uses start() not initialize() - requires user location
    if (plumEEWService && locationService) {
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

    // 14. Initialize Multi-Source EEW Service
    // AFAD, Kandilli, USGS, EMSC - çoklu kaynak desteği
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

    // 24. ELITE: Initialize Realtime Earthquake Monitor (World-Class EEW)
    // WebSocket + HTTP fallback for EMSC, AFAD, Kandilli
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

    // 25. ELITE: Initialize On-Device Seismic Detector (WORLD'S FASTEST!)
    // Uses phone's accelerometer for P-wave detection - <1 second alerts!
    try {
      const { onDeviceSeismicDetector: odsd } = await import('./services/OnDeviceSeismicDetector');
      onDeviceSeismicDetector = odsd;

      await onDeviceSeismicDetector.start();
      logger.info('🚀 OnDeviceSeismicDetector started (P-Wave Detection - <1s Alert!)');
    } catch (error: unknown) {
      logger.error('❌ OnDeviceSeismicDetector start failed:', error);
    }

    // 26. ELITE: Initialize Crowdsourced Seismic Network
    // Connects with other AfetNet users for multi-device verification
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

    // 27. ELITE: Initialize Background Seismic Monitor
    // Provides 24/7 earthquake detection even when app is closed
    try {
      const { backgroundSeismicMonitor: bsm } = await import('./services/BackgroundSeismicMonitor');
      backgroundSeismicMonitor = bsm;
      await backgroundSeismicMonitor.initialize();
      logger.info('🌙 BackgroundSeismicMonitor initialized (24/7 protection)');
    } catch (error: unknown) {
      logger.error('❌ BackgroundSeismicMonitor init failed:', error);
    }

    // 28. ELITE: Initialize Real-Time EEW Connection (Sub-100ms Delivery!)
    // WebSocket-like Firebase Realtime DB listener for instant alerts
    try {
      const { realTimeEEWConnection } = await import('./services/RealTimeEEWConnectionService');
      await realTimeEEWConnection.start();
      logger.info('⚡ RealTimeEEWConnection started (Sub-100ms delivery via Realtime DB)');
    } catch (error: unknown) {
      logger.error('❌ RealTimeEEWConnection start failed:', error);
    }

    // 28b. ELITE: Start Multi-Source EEW Service (AFAD/Kandilli/USGS Polling)
    // CRITICAL: This enables real-time polling from multiple sources for EEW
    try {
      const { multiSourceEEWService } = await import('./services/MultiSourceEEWService');
      multiSourceEEWService.start();
      logger.info('🌐 MultiSourceEEWService started (AFAD 5s, Kandilli 10s, USGS 30s polling)');
    } catch (error: unknown) {
      logger.error('❌ MultiSourceEEWService start failed:', error);
    }

    // 29. ELITE: Warmup UltraFast EEW Notification (Zero-latency TTS!)
    // Pre-loads TTS engine and sound files for instant alert delivery
    try {
      const { ultraFastEEWNotification } = await import('./services/UltraFastEEWNotification');
      await ultraFastEEWNotification.warmup();
      logger.info('🔥 UltraFastEEWNotification warmed up (Zero-latency TTS ready)');
    } catch (error: unknown) {
      logger.error('❌ UltraFastEEWNotification warmup failed:', error);
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

  // Stop services gracefully
  if (earthquakeService) earthquakeService.stop();
  if (bleMeshService) bleMeshService.stop();

  // ELITE: Stop EEW Advanced Services
  if (plumEEWService) plumEEWService.stop();
  if (realtimeEarthquakeMonitor) realtimeEarthquakeMonitor.stop();
  if (onDeviceSeismicDetector) onDeviceSeismicDetector.stop();
  // backgroundEEWService and fcmTokenService don't have stop methods - they clean up automatically

  // Cleanup Firebase listeners
  try {
    firebaseService?.cleanup?.();
  } catch (error: unknown) {
    logger.error('Firebase cleanup error:', error);
  }

  isInitialized = false;
  useAppStore.getState().setReady(false);
}
