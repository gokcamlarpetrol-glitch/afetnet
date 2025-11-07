/**
 * CORE INITIALIZATION - Single Entry Point
 * All services initialized here, only once
 */

import { earthquakeService } from './services/EarthquakeService';
import { bleMeshService } from './services/BLEMeshService';
import { notificationService } from './services/NotificationService';
import { premiumService } from './services/PremiumService';
import { firebaseService } from './services/FirebaseService';
import { locationService } from './services/LocationService';
import { eewService } from './services/EEWService';
import { seismicSensorService } from './services/SeismicSensorService';
import { enkazDetectionService } from './services/EnkazDetectionService';
import { multiChannelAlertService } from './services/MultiChannelAlertService';
import { cellBroadcastService } from './services/CellBroadcastService';
import { accessibilityService } from './services/AccessibilityService';
// import { institutionalIntegrationService } from './services/InstitutionalIntegrationService'; // DISABLED
import { publicAPIService } from './services/PublicAPIService';
import { regionalRiskService } from './services/RegionalRiskService';
import { impactPredictionService } from './services/ImpactPredictionService';
import { whistleService } from './services/WhistleService';
import { flashlightService } from './services/FlashlightService';
import { voiceCommandService } from './services/VoiceCommandService';
import { offlineMapService } from './services/OfflineMapService';
import { firebaseDataService } from './services/FirebaseDataService';
import { storageManagementService } from './services/StorageManagementService';
import { batteryMonitoringService } from './services/BatteryMonitoringService';
import { networkMonitoringService } from './services/NetworkMonitoringService';
import { useHealthProfileStore } from './stores/healthProfileStore';
import { useTrialStore } from './stores/trialStore';
import { createLogger } from './utils/logger';
import { runAllHealthChecks } from './utils/serviceHealthCheck';
import AsyncStorage from '@react-native-async-storage/async-storage';

const logger = createLogger('Init');

let isInitialized = false;
let isInitializing = false;

/**
 * Elite: Initialize service with timeout protection and better error handling
 */
const initWithTimeout = async (fn: () => Promise<void>, name: string, timeout = 5000) => {
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`${name} timeout after ${timeout}ms`)), timeout)
      )
    ]);
    logger.info(`✅ ${name} initialized`);
  } catch (error: any) {
    // Elite: Better error handling - extract meaningful error message
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      // Handle error objects (like {jsEngine: "hermes"})
      if (error.message) {
        errorMessage = error.message;
      } else if (error.toString && error.toString() !== '[object Object]') {
        errorMessage = error.toString();
      } else {
        // Fallback: stringify only if it's a simple object
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = String(error);
        }
      }
    } else {
      errorMessage = String(error);
    }
    
    // Elite: Only log if it's not a timeout (timeouts are expected for optional services)
    if (errorMessage.includes('timeout')) {
      logger.warn(`⚠️ ${name} initialization timeout (${timeout}ms) - service may be optional`);
    } else {
      logger.error(`❌ ${name} failed: ${errorMessage}`);
    }
  }
};

export async function initializeApp() {
  // Prevent double initialization
  if (isInitialized || isInitializing) {
    return;
  }

  isInitializing = true;

  try {
    // Step 1: Notification Service & Multi-Channel Alert Service
    await initWithTimeout(() => notificationService.initialize(), 'NotificationService');
    await initWithTimeout(() => multiChannelAlertService.initialize(), 'MultiChannelAlertService');

           // Step 2: Firebase Services (initialize Firebase app first, then all services)
           // Elite: Increased timeout to 15 seconds for Firebase initialization (first launch can be slow)
           await initWithTimeout(async () => {
             const getFirebaseApp = (await import('../lib/firebase')).default;
             const firebaseApp = getFirebaseApp();
             if (!firebaseApp) throw new Error('Firebase app null');
             await firebaseService.initialize();
             await firebaseDataService.initialize();
             
             // Initialize additional Firebase services (disabled by default for privacy)
             const { firebaseStorageService } = await import('./services/FirebaseStorageService');
             await firebaseStorageService.initialize();
             
             // Analytics and Crashlytics disabled by default (Apple review compliance)
             // const { firebaseAnalyticsService } = await import('./services/FirebaseAnalyticsService');
             // await firebaseAnalyticsService.initialize();
             // const { firebaseCrashlyticsService } = await import('./services/FirebaseCrashlyticsService');
             // await firebaseCrashlyticsService.initialize();
           }, 'FirebaseServices', 15000); // 15 seconds timeout

    // Step 3: Location Service
    // Elite: Increased timeout to 15 seconds for GPS location acquisition (first launch can be slow)
    await initWithTimeout(() => locationService.initialize(), 'LocationService', 15000);

    // Step 4: Premium Service + Trial Store (3 gün deneme)
    await initWithTimeout(() => premiumService.initialize(), 'PremiumService');
    await initWithTimeout(() => useTrialStore.getState().initializeTrial(), 'TrialStore');

    // Step 5: Earthquake Service (CRITICAL)
    await initWithTimeout(() => earthquakeService.start(), 'EarthquakeService', 10000);

    // Step 6: BLE Mesh Service (check settings)
    await initWithTimeout(async () => {
      const { useSettingsStore } = await import('./stores/settingsStore');
      const bleMeshEnabled = useSettingsStore.getState().bleMeshEnabled;
      if (bleMeshEnabled) {
        await bleMeshService.start();
      } else {
        logger.info('BLE Mesh disabled in settings');
      }
    }, 'BLEMeshService');

    // Step 7: EEW Service (check settings)
    await initWithTimeout(async () => {
      const { useSettingsStore } = await import('./stores/settingsStore');
      const eewEnabled = useSettingsStore.getState().eewEnabled;
      if (eewEnabled) {
        await eewService.start();
      } else {
        logger.info('EEW Service disabled in settings');
      }
    }, 'EEWService');

    // Step 8: Cell Broadcast Service
    await initWithTimeout(() => cellBroadcastService.initialize(), 'CellBroadcastService');

    // Step 9: Accessibility Service
    await initWithTimeout(() => accessibilityService.initialize(), 'AccessibilityService');

    // Step 10: Institutional Integration Service
    // DISABLED - All API calls disabled, EarthquakeService handles AFAD
    // try {
    //   await institutionalIntegrationService.initialize();
    // } catch (error) {
    //   logger.error('Institutional integration failed:', error);
    // }

    // Step 11: Public API Service
    await initWithTimeout(() => publicAPIService.initialize(), 'PublicAPIService');

    // Step 12: Regional Risk Service
    await initWithTimeout(() => regionalRiskService.initialize(), 'RegionalRiskService');

    // Step 13: Impact Prediction Service
    await initWithTimeout(() => impactPredictionService.initialize(), 'ImpactPredictionService');

    // Step 14: Enkaz Detection Service (Emergency)
    await initWithTimeout(() => enkazDetectionService.start(), 'EnkazDetectionService');

           // Step 15: Seismic Sensor Service (REAL EARLY WARNING - FIRST-TO-ALERT)
           // ELITE: Re-enabled for REAL early warning - detects earthquakes AS THEY START
           // CRITICAL: This is the ONLY way to warn BEFORE earthquake fully happens
           // We MUST be FIRST - this is life-saving
           try {
             const { useSettingsStore } = await import('./stores/settingsStore');
             const seismicSensorEnabled = useSettingsStore.getState().seismicSensorEnabled;
             
             if (seismicSensorEnabled) {
               logger.info('Step 15: Starting seismic sensor service (FIRST-TO-ALERT - REAL EARLY WARNING)...');
               await initWithTimeout(() => seismicSensorService.start(), 'SeismicSensorService', 10000);
               logger.info('✅ SeismicSensorService started - FIRST-TO-ALERT active');
             } else {
               logger.info('SeismicSensorService disabled by user settings');
             }
           } catch (error) {
             logger.error('Seismic sensor failed:', error);
             // Continue without seismic detection - polling will still work
           }

    // Step 16: Life-Saving Services
    await initWithTimeout(() => whistleService.initialize(), 'WhistleService');
    await initWithTimeout(() => flashlightService.initialize(), 'FlashlightService');
    await initWithTimeout(() => voiceCommandService.initialize(), 'VoiceCommandService');
    await initWithTimeout(() => offlineMapService.initialize(), 'OfflineMapService');
    await initWithTimeout(() => useHealthProfileStore.getState().loadProfile(), 'HealthProfile');

    // Step 16.5: Storage Management Service (Critical)
    await initWithTimeout(async () => {
      await storageManagementService.initialize();
      storageManagementService.startMonitoring(60000); // Check every minute
    }, 'StorageManagementService');

    // Step 16.6: Rescue Beacon Service (Emergency)
    await initWithTimeout(async () => {
      const { rescueBeaconService } = await import('./services/RescueBeaconService');
      await rescueBeaconService.initialize();
    }, 'RescueBeaconService');

    // Step 16.7: Elite Monitoring Services (Battery & Network)
    await initWithTimeout(() => batteryMonitoringService.start(), 'BatteryMonitoringService');
    await initWithTimeout(() => networkMonitoringService.start(), 'NetworkMonitoringService');

    // Step 17: Auto-save device ID to Firestore
    await initWithTimeout(async () => {
      try {
        const { getDeviceId } = await import('../lib/device');
        const deviceId = await getDeviceId();
        if (deviceId && firebaseDataService.isInitialized) {
          await firebaseDataService.saveDeviceId(deviceId);
          logger.info(`Device ID auto-saved: ${deviceId}`);
        }
      } catch (error) {
        logger.error('Failed to auto-save device ID:', error);
      }
    }, 'DeviceIDAutoSave');

    // Step 18: Run service health checks (non-blocking)
    await initWithTimeout(async () => {
      const healthResults = await runAllHealthChecks();
      const downServices = healthResults.filter(r => r.status === 'down');
      if (downServices.length > 0) {
        logger.warn(`⚠️ ${downServices.length} service(s) down: ${downServices.map(s => s.name).join(', ')}`);
      }
    }, 'ServiceHealthCheck', 10000); // 10s timeout for health checks

    // Step 19: AI Services (optional, feature flag ile kontrol edilir)
    // Elite: Increased timeout to 10 seconds for AI services (may need to load OpenAI SDK)
    await initWithTimeout(async () => {
      try {
        const { aiFeatureToggle } = await import('./ai/services/AIFeatureToggle');
        await aiFeatureToggle.initialize();
        
        // Ilk kullanim: AI ozelliklerini otomatik aktif et
        const isFirstLaunch = await AsyncStorage.getItem('afetnet_first_launch');
        if (!isFirstLaunch) {
          await aiFeatureToggle.enable();
          await AsyncStorage.setItem('afetnet_first_launch', 'false');
          logger.info('AI features enabled by default (first launch)');
        }
        
        // AI ozellikleri aktifse servisleri baslat
        if (aiFeatureToggle.isFeatureEnabled()) {
          // Elite: Initialize services sequentially with individual error handling
          // CRITICAL: Each service must be initialized independently - failures shouldn't cascade
          const { openAIService } = await import('./ai/services/OpenAIService');
          await openAIService.initialize().catch((err: any) => {
            logger.warn('⚠️ OpenAIService init failed (non-critical):', err?.message || err);
          });
          
          const { riskScoringService } = await import('./ai/services/RiskScoringService');
          await riskScoringService.initialize().catch((err: any) => {
            logger.warn('⚠️ RiskScoringService init failed (non-critical):', err?.message || err);
          });
          
          const { preparednessPlanService } = await import('./ai/services/PreparednessPlanService');
          await preparednessPlanService.initialize().catch((err: any) => {
            logger.warn('⚠️ PreparednessPlanService init failed (non-critical):', err?.message || err);
          });
          
          const { panicAssistantService } = await import('./ai/services/PanicAssistantService');
          await panicAssistantService.initialize().catch((err: any) => {
            logger.warn('⚠️ PanicAssistantService init failed (non-critical):', err?.message || err);
          });
          
          const { newsAggregatorService } = await import('./ai/services/NewsAggregatorService');
          await newsAggregatorService.initialize().catch((err: any) => {
            logger.warn('⚠️ NewsAggregatorService init failed (non-critical):', err?.message || err);
          });
          
          const { earthquakeAnalysisService } = await import('./ai/services/EarthquakeAnalysisService');
          await earthquakeAnalysisService.initialize().catch((err: any) => {
            logger.warn('⚠️ EarthquakeAnalysisService init failed (non-critical):', err?.message || err);
          });
          
          logger.info('AI services initialized (OpenAI-powered)');
        } else {
          logger.info('AI services disabled by feature flag');
        }
      } catch (error: any) {
        // Elite: AI services are optional - don't fail app initialization
        const errorMessage = error?.message || error?.toString() || String(error);
        logger.warn(`⚠️ AI Services initialization failed (non-critical): ${errorMessage}`);
        // Continue app initialization - AI features are optional
      }
    }, 'AIServices', 10000); // Increased to 10 seconds

    isInitialized = true;
    isInitializing = false;
  } catch (error) {
    logger.error('❌ CRITICAL: Init failed:', error);
    isInitializing = false;
  }
}

export async function shutdownApp() {
  earthquakeService.stop();
  bleMeshService.stop();
  eewService.stop();
  cellBroadcastService.stop();
  seismicSensorService.stop();
  enkazDetectionService.stop();
  storageManagementService.stopMonitoring();
  batteryMonitoringService.stop();
  networkMonitoringService.stop();
  
  // Stop rescue beacon if active
  try {
    const { rescueBeaconService } = await import('./services/RescueBeaconService');
    rescueBeaconService.stopBeacon();
  } catch (error) {
    logger.error('Failed to stop rescue beacon:', error);
  }
  
  isInitialized = false;
}

