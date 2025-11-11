/**
 * CORE INITIALIZATION - Single Entry Point
 * All services initialized here, only once
 */

import { earthquakeService } from './services/EarthquakeService';
import { bleMeshService } from './services/BLEMeshService';
// CRITICAL: notificationService imported dynamically to prevent Metro bundler from loading expo-notifications
// import { notificationService } from './services/NotificationService'; // DISABLED - loaded dynamically
import { premiumService } from './services/PremiumService';
import { firebaseService } from './services/FirebaseService';
import { locationService } from './services/LocationService';
import { eewService } from './services/EEWService';
import { seismicSensorService } from './services/SeismicSensorService';
import { globalEarthquakeAnalysisService } from './services/GlobalEarthquakeAnalysisService';
import { enkazDetectionService } from './services/EnkazDetectionService';
// CRITICAL: multiChannelAlertService imported dynamically to prevent Metro bundler from loading expo-notifications
// import { multiChannelAlertService } from './services/MultiChannelAlertService'; // DISABLED - loaded dynamically
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
import { openAIService } from './ai/services/OpenAIService';
import { newsAggregatorService } from './ai/services/NewsAggregatorService';
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
    // CRITICAL: Notification services moved to Step 18 (LAST)
    // This ensures native bridge is fully ready before attempting to load expo-notifications

    // Step 1: Firebase Services (initialize Firebase app first, then data service)
    try {
      // ELITE: Initialize Firebase app with async getter (ensures retry mechanism)
      const { getFirebaseAppAsync } = await import('../lib/firebase');
      const firebaseApp = await getFirebaseAppAsync();
      
      if (!firebaseApp) {
        logger.warn('Firebase app initialization failed - app continues with offline mode');
      } else {
        logger.info('✅ Firebase app initialized successfully');
      }
      
      // Initialize Firebase messaging service
      await firebaseService.initialize();
      
      // Initialize Firebase Data Service (Firestore) - must be after Firebase app init
      await firebaseDataService.initialize();
      
      if (firebaseDataService.isInitialized) {
        logger.info('✅ Firebase services initialized successfully');
      } else {
        logger.warn('Firebase Data Service not initialized - app continues with AsyncStorage');
      }
    } catch (error) {
      logger.error('Firebase initialization error:', error);
      // ELITE: Don't throw - app continues with offline mode
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
    // Polling-only mode (WebSocket endpoints not available)
    // Uses AFAD API polling for earthquake data
    try {
      logger.info('Step 7: Starting EEW service (polling-only mode)...');
      await eewService.start();
    } catch (error) {
      logger.error('EEW service failed to start:', error);
      // Continue without EEW - EarthquakeService handles AFAD data
    }

    // Step 7.5: Global Earthquake Analysis Service
    // CRITICAL: Monitors USGS and EMSC for earthquakes that may affect Turkey
    // Provides EARLIER warnings than local detection by analyzing global data
    try {
      logger.info('Step 7.5: Starting Global Earthquake Analysis Service (USGS & EMSC monitoring)...');
      await globalEarthquakeAnalysisService.initialize();
    } catch (error) {
      logger.error('Global Earthquake Analysis Service failed to start:', error);
      // Continue without global analysis - local detection will still work
    }

    // Step 7.6: Earthquake Event Watcher Client (Microservice Integration)
    // ELITE: Connects to Earthquake Event Watcher microservice for ultra-fast detection
    // Integrates USGS, Ambee, Xweather, Zyla APIs for 10+ second early warning
    try {
      logger.info('Step 7.6: Starting Earthquake Event Watcher Client (microservice integration)...');
      const { earthquakeEventWatcherClient } = await import('./services/EarthquakeEventWatcherClient');
      await earthquakeEventWatcherClient.start();
      logger.info('✅ Earthquake Event Watcher Client started');
    } catch (error) {
      logger.warn('⚠️ Earthquake Event Watcher Client failed - will use local detection only', error);
      // Continue without microservice - local EarthquakeService will handle detection
    }

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
    // ELITE: Re-enabled with advanced P-wave detection and crowdsourcing verification
    // Now includes: P-wave detection, crowdsourcing, false positive filtering
    // CRITICAL: Service must stay active continuously - auto-restart if it stops
    try {
      logger.info('Step 15: Starting seismic sensor service (with P-wave detection and crowdsourcing)...');
      await seismicSensorService.start();
      
      // ELITE: Verify service started and set up monitoring
      setTimeout(async () => {
        const isRunning = seismicSensorService.getRunningStatus();
        if (!isRunning) {
          logger.warn('⚠️ Seismic sensor service stopped after start - attempting restart...');
          try {
            await seismicSensorService.start();
            logger.info('✅ Seismic sensor service restarted successfully');
          } catch (restartError) {
            logger.error('Failed to restart seismic sensor service:', restartError);
          }
        } else {
          logger.info('✅ Seismic sensor service is running and will stay active');
        }
      }, 3000); // Check after 3 seconds
      
      // ELITE: Periodic health check - restart if stopped
      setInterval(async () => {
        const isRunning = seismicSensorService.getRunningStatus();
        if (!isRunning) {
          if (__DEV__) {
            logger.warn('⚠️ Seismic sensor service stopped unexpectedly - auto-restarting...');
          }
          try {
            await seismicSensorService.start();
          } catch (restartError) {
            if (__DEV__) {
              logger.debug('Auto-restart failed (will retry):', restartError);
            }
          }
        }
      }, 60000); // Check every minute
      
    } catch (error) {
      logger.error('Seismic sensor failed:', error);
      // ELITE: Retry after delay
      setTimeout(async () => {
        try {
          await seismicSensorService.start();
          logger.info('✅ Seismic sensor service started after retry');
        } catch (retryError) {
          logger.error('Seismic sensor retry failed:', retryError);
        }
      }, 5000);
    }

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

    // Step 17: AI Services
    try {
      logger.info('Step 17: Initializing AI services...');
      await openAIService.initialize();
      logger.info('AI services initialized');
    } catch (error) {
      logger.error('AI services failed:', error);
      // Continue without AI - fallback mode will be used
    }

    // Step 18: News Aggregator Service
    try {
      logger.info('Step 18: Initializing News Aggregator Service...');
      await newsAggregatorService.initialize();
      logger.info('News Aggregator Service initialized');
    } catch (error) {
      logger.error('News Aggregator Service failed:', error);
      // Continue without news - NewsCard will handle gracefully
    }

    // Step 19: Notification Service & Multi-Channel Alert Service (PRE-INITIALIZATION)
    // ELITE: Pre-initialize notification service in background to prevent first notification delay
    // CRITICAL: These services require native bridge to be completely initialized
    // CRITICAL: These services are COMPLETELY OPTIONAL - app will work perfectly without them
    // ELITE: Pre-initialize in background (non-blocking) to eliminate first notification delay
    // CRITICAL: Load notificationService dynamically to prevent Metro bundler from seeing it
    try {
      const { notificationService } = await import('./services/NotificationService');
      const { multiChannelAlertService } = await import('./services/MultiChannelAlertService');
      
      // ELITE: Pre-initialize in background (non-blocking)
      // This eliminates the delay on first notification while not blocking app startup
      Promise.allSettled([
        (async () => {
          // Wait for native bridge to be ready
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds delay
          
          // Initialize with timeout protection (non-blocking)
          await Promise.race([
            Promise.allSettled([
              notificationService.initialize().catch(() => null),
              multiChannelAlertService.initialize().catch(() => null),
            ]),
            new Promise(resolve => setTimeout(resolve, 30000)), // 30s timeout
          ]);
          
          logger.info('✅ Notification services pre-initialized (background)');
        })(),
      ]).catch(() => {
        // Silent fail - will initialize on-demand if pre-init fails
        if (__DEV__) {
          logger.debug('Notification services pre-initialization skipped - will initialize on-demand');
        }
      });
    } catch (error) {
      // Silent fail - will initialize on-demand when needed
      if (__DEV__) {
        logger.debug('Notification services pre-initialization failed - will initialize on-demand when needed');
      }
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
  eewService.stop();
  globalEarthquakeAnalysisService.stop();
  cellBroadcastService.stop();
  seismicSensorService.stop();
  enkazDetectionService.stop();
  
  // ELITE: Cleanup Firebase service
  try {
    firebaseService.cleanup();
  } catch (error) {
    logger.error('Firebase cleanup error:', error);
  }
  
  // ELITE: Cleanup BackendPushService
  try {
    const { backendPushService } = require('./services/BackendPushService');
    backendPushService.cleanup();
  } catch (error) {
    logger.error('BackendPushService cleanup error:', error);
  }
  
  // ELITE: Cleanup Earthquake Event Watcher Client
  try {
    const { earthquakeEventWatcherClient } = require('./services/EarthquakeEventWatcherClient');
    earthquakeEventWatcherClient.stop();
  } catch (error) {
    logger.error('Earthquake Event Watcher Client cleanup error:', error);
  }
  
  isInitialized = false;
}

