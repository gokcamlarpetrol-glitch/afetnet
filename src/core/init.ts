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
import { useHealthProfileStore } from './stores/healthProfileStore';
import { createLogger } from './utils/logger';

const logger = createLogger('Init');

let isInitialized = false;
let isInitializing = false;

export async function initializeApp() {
  // Prevent double initialization
  if (isInitialized || isInitializing) {
    return;
  }

  isInitializing = true;

  try {
    // Step 1: Notification Service & Multi-Channel Alert Service
    try {
      await notificationService.initialize();
      await multiChannelAlertService.initialize();
    } catch (error) {
      logger.error('Notification services failed:', error);
    }

    // Step 2: Firebase Service
    try {
      await firebaseService.initialize();
    } catch (error) {
      logger.error('Firebase failed:', error);
    }

    // Step 3: Location Service
    try {
      await locationService.initialize();
    } catch (error) {
      logger.error('Location service failed:', error);
    }

    // Step 4: Premium Service
    try {
      await premiumService.initialize();
    } catch (error) {
      logger.error('Premium service failed:', error);
    }

    // Step 5: Earthquake Service (CRITICAL)
    try {
      await earthquakeService.start();
    } catch (error) {
      logger.error('⚠️ CRITICAL: Earthquake service failed:', error);
    }

    // Step 6: BLE Mesh Service
    try {
      await bleMeshService.start();
    } catch (error) {
      logger.error('BLE Mesh failed:', error);
    }

    // Step 7: EEW Service
    // DISABLED - WebSocket endpoints are not real, causing 491 errors
    // Will be re-enabled when we have real EEW WebSocket endpoints
    // try {
    //   if (__DEV__) {
    //     logger.info('Step 7/15: Starting EEW service...');
    //   }
    //   await eewService.start();
    // } catch (error) {
    //   logger.error('EEW service failed to start:', error);
    //   // Continue without EEW
    // }

    // Step 8: Cell Broadcast Service
    try {
      await cellBroadcastService.initialize();
    } catch (error) {
      logger.error('Cell broadcast failed:', error);
    }

    // Step 9: Accessibility Service
    try {
      await accessibilityService.initialize();
    } catch (error) {
      logger.error('Accessibility failed:', error);
    }

    // Step 10: Institutional Integration Service
    // DISABLED - All API calls disabled, EarthquakeService handles AFAD
    // try {
    //   await institutionalIntegrationService.initialize();
    // } catch (error) {
    //   logger.error('Institutional integration failed:', error);
    // }

    // Step 11: Public API Service
    try {
      await publicAPIService.initialize();
    } catch (error) {
      logger.error('Public API failed:', error);
    }

    // Step 12: Regional Risk Service
    try {
      await regionalRiskService.initialize();
    } catch (error) {
      logger.error('Regional risk failed:', error);
    }

    // Step 13: Impact Prediction Service
    try {
      await impactPredictionService.initialize();
    } catch (error) {
      logger.error('Impact prediction failed:', error);
    }

    // Step 14: Enkaz Detection Service (Emergency)
    try {
      await enkazDetectionService.start();
    } catch (error) {
      logger.error('Enkaz detection failed:', error);
    }

    // Step 15: Seismic Sensor Service
    // DISABLED - Too many false positives, will be re-enabled after optimization

    // Step 16: Life-Saving Services
    try {
      await whistleService.initialize();
      await flashlightService.initialize();
      await voiceCommandService.initialize();
      await offlineMapService.initialize();
      await useHealthProfileStore.getState().loadProfile();
    } catch (error) {
      logger.error('Life-saving services failed:', error);
    }

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
  // eewService.stop(); // Disabled
  cellBroadcastService.stop();
  // seismicSensorService.stop(); // Disabled
  enkazDetectionService.stop();
  
  isInitialized = false;
}

