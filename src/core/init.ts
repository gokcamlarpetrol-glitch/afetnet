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
import { useHealthProfileStore } from './stores/healthProfileStore';
import { useTrialStore } from './stores/trialStore';
import { createLogger } from './utils/logger';
import { runAllHealthChecks } from './utils/serviceHealthCheck';
import AsyncStorage from '@react-native-async-storage/async-storage';

const logger = createLogger('Init');

let isInitialized = false;
let isInitializing = false;

/**
 * Initialize service with timeout protection
 */
const initWithTimeout = async (fn: () => Promise<void>, name: string, timeout = 5000) => {
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`${name} timeout`)), timeout)
      )
    ]);
    logger.info(`✅ ${name} initialized`);
  } catch (error) {
    logger.error(`❌ ${name} failed:`, error);
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
           }, 'FirebaseServices');

    // Step 3: Location Service
    await initWithTimeout(() => locationService.initialize(), 'LocationService');

    // Step 4: Premium Service + Trial Store (3 gün deneme)
    await initWithTimeout(() => premiumService.initialize(), 'PremiumService');
    await initWithTimeout(() => useTrialStore.getState().initializeTrial(), 'TrialStore');

    // Step 5: Earthquake Service (CRITICAL)
    await initWithTimeout(() => earthquakeService.start(), 'EarthquakeService', 10000);

    // Step 6: BLE Mesh Service
    await initWithTimeout(() => bleMeshService.start(), 'BLEMeshService');

    // Step 7: EEW Service
    await initWithTimeout(() => eewService.start(), 'EEWService');

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

    // Step 15: Seismic Sensor Service
    // DISABLED TEMPORARILY - Too many false positives causing spam
    // Will be re-enabled after further optimization and testing
    // The service is still available for enkaz detection via EnkazDetectionService
    // try {
    //   logger.info('Step 15: Starting seismic sensor service...');
    //   await seismicSensorService.start();
    // } catch (error) {
    //   logger.error('Seismic sensor failed:', error);
    // }

    // Step 16: Life-Saving Services
    await initWithTimeout(() => whistleService.initialize(), 'WhistleService');
    await initWithTimeout(() => flashlightService.initialize(), 'FlashlightService');
    await initWithTimeout(() => voiceCommandService.initialize(), 'VoiceCommandService');
    await initWithTimeout(() => offlineMapService.initialize(), 'OfflineMapService');
    await initWithTimeout(() => useHealthProfileStore.getState().loadProfile(), 'HealthProfile');

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
    await initWithTimeout(async () => {
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
        const { riskScoringService } = await import('./ai/services/RiskScoringService');
        const { preparednessPlanService } = await import('./ai/services/PreparednessPlanService');
        const { panicAssistantService } = await import('./ai/services/PanicAssistantService');
        const { newsAggregatorService } = await import('./ai/services/NewsAggregatorService');
        const { openAIService } = await import('./ai/services/OpenAIService');
        
        await riskScoringService.initialize();
        await preparednessPlanService.initialize();
        await panicAssistantService.initialize();
        await newsAggregatorService.initialize();
        await openAIService.initialize();
        logger.info('AI services initialized');
      } else {
        logger.info('AI services disabled by feature flag');
      }
    }, 'AIServices', 5000);

    isInitialized = true;
    isInitializing = false;
  } catch (error) {
    logger.error('❌ CRITICAL: Init failed:', error);
    isInitializing = false;
  }
}

export function shutdownApp() {
  earthquakeService.stop();
  bleMeshService.stop();
  eewService.stop();
  cellBroadcastService.stop();
  seismicSensorService.stop();
  enkazDetectionService.stop();
  
  isInitialized = false;
}

