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
// CRITICAL: Track intervals for cleanup to prevent memory leaks
let seismicHealthCheckInterval: NodeJS.Timeout | null = null;

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
      
      // ELITE: Initialize Firebase with timeout protection
      const initPromise = getFirebaseAppAsync();
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 10000) // 10 second timeout
      );
      
      const firebaseApp = await Promise.race([initPromise, timeoutPromise]);
      
      if (!firebaseApp) {
        if (__DEV__) {
          logger.debug('Firebase app initialization failed or timed out - app continues with offline mode');
        }
      } else {
        if (__DEV__) {
          logger.info('✅ Firebase app initialized successfully');
        }
      }
      
      // Initialize Firebase messaging service (non-blocking)
      firebaseService.initialize().catch((error: any) => {
        // CRITICAL: Handle LoadBundleFromServerRequestError gracefully
        const errorMessage = error?.message || String(error);
        if (!errorMessage.includes('LoadBundleFromServerRequestError') && 
            !errorMessage.includes('Could not load bundle')) {
          if (__DEV__) {
            logger.debug('Firebase messaging service initialization failed:', errorMessage);
          }
        }
      });
      
      // Initialize Firebase Data Service (Firestore) - must be after Firebase app init
      await firebaseDataService.initialize();
      
      if (firebaseDataService.isInitialized) {
        if (__DEV__) {
          logger.info('✅ Firebase services initialized successfully');
        }
        
        // CRITICAL: Save device ID to Firebase immediately after initialization
        // ELITE: This ensures every device has a unique ID in Firebase
        // CRITICAL: Use lib/device.ts for consistency (afn- format)
        // ELITE: Use dynamic import with better error handling to prevent Metro bundler issues
        try {
          // ELITE: Dynamic import with explicit path to prevent module resolution issues
          const deviceModule = await import('../../lib/device');
          
          // ELITE: Validate module and function exist before calling
          if (!deviceModule || typeof deviceModule.getDeviceId !== 'function') {
            throw new Error('getDeviceId function not available in device module');
          }
          
          const deviceId = await deviceModule.getDeviceId();
          
          if (deviceId && deviceId.length > 0) {
            const saved = await firebaseDataService.saveDeviceId(deviceId);
            if (saved) {
              if (__DEV__) {
                logger.info(`✅ Device ID saved to Firebase: ${deviceId}`);
              }
            } else {
              if (__DEV__) {
                logger.debug('Device ID save to Firebase failed (non-critical - app continues)');
              }
            }
          }
        } catch (deviceIdError: any) {
          // ELITE: Device ID save is non-critical - app continues without it
          const errorMessage = deviceIdError?.message || String(deviceIdError);
          // ELITE: Better error handling - check for common Metro bundler errors
          if (errorMessage.includes('is not a function') || 
              errorMessage.includes('undefined') ||
              errorMessage.includes('unknown module') ||
              errorMessage.includes('Cannot find module')) {
            if (__DEV__) {
              logger.debug('Device ID save skipped: device module not available (non-critical - Metro bundler may need cache clear)');
            }
          } else {
            if (__DEV__) {
              logger.debug('Device ID save skipped:', errorMessage);
            }
          }
        }
      } else {
        if (__DEV__) {
          logger.debug('Firebase Data Service not initialized - app continues with AsyncStorage');
        }
      }
    } catch (error: any) {
      // CRITICAL: Handle LoadBundleFromServerRequestError gracefully
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('LoadBundleFromServerRequestError') || 
          errorMessage.includes('Could not load bundle')) {
        // ELITE: Bundle errors are expected in some environments - don't log as error
        if (__DEV__) {
          logger.debug('Firebase initialization skipped (bundle error - expected in some environments)');
        }
      } else {
        logger.error('Firebase initialization error:', error);
      }
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
    // CRITICAL: Runs continuously for P and S wave monitoring
    try {
      logger.info('Step 7: Starting EEW service (polling-only mode - continuous monitoring)...');
      await eewService.start();
      logger.info('✅ EEW Service started - P and S wave monitoring active');
    } catch (error) {
      logger.error('EEW service failed to start:', error);
      // Continue without EEW - EarthquakeService handles AFAD data
    }

    // Step 7.1: Background Wave Monitoring Task
    // CRITICAL: Continuous P and S wave monitoring in background
    // This ensures users receive early warnings even when app is closed
    try {
      logger.info('Step 7.1: Registering background wave monitoring task...');
      // CRITICAL: Import and register task - TaskManager.defineTask() runs at module load time
      // This ensures the task is defined before registration
      // CRITICAL: Use dynamic import with error handling
      // Path is relative to src/core/init.ts -> src/jobs/bgWaveMonitoring.ts
      // @ts-ignore - Dynamic import path may not resolve in TypeScript but works at runtime
      const bgWaveModule = await import('../../jobs/bgWaveMonitoring').catch(() => null);
      if (bgWaveModule && typeof bgWaveModule.registerBgWaveMonitoring === 'function') {
        await bgWaveModule.registerBgWaveMonitoring();
        logger.info('✅ Background wave monitoring registered - P and S wave alerts active 24/7');
      } else {
        logger.warn('Background wave monitoring module not available - skipping registration');
      }
    } catch (error: any) {
      // ELITE: More detailed error logging for debugging
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('Cannot find module')) {
        logger.debug('Background wave monitoring module not found - this is OK if running in Expo Go');
      } else {
        logger.warn('Background wave monitoring registration failed:', errorMessage);
      }
      // Continue without background monitoring - foreground monitoring still works
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

    // Step 11: Backend Emergency Service
    // CRITICAL: Sends emergency messages and family member data to backend for rescue coordination
    try {
      const { backendEmergencyService } = await import('./services/BackendEmergencyService');
      await backendEmergencyService.initialize();
      if (__DEV__) {
        logger.info('✅ Backend Emergency Service initialized - rescue coordination active');
      }
    } catch (error) {
      logger.error('Backend Emergency Service failed:', error);
      // Continue - backend sync is optional but recommended
    }

    // Step 11.1: Public API Service
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
    // CRITICAL: This is LIFE-SAVING - P/S wave detection provides earliest possible warning
    // CRITICAL: AUTOMATIC START - No user interaction required, must run continuously
    try {
      logger.info('Step 15: Starting seismic sensor service (with P-wave detection and crowdsourcing)...');
      logger.info('🚨 CRITICAL: P/S wave detection is LIFE-SAVING - ensures continuous monitoring for early warnings');
      logger.info('📡 AUTOMATIC START: Service starts automatically - no user interaction required');
      
      // CRITICAL: Start service immediately
      await seismicSensorService.start();
      
      // CRITICAL: Verify service started immediately
      const initialStatus = seismicSensorService.getRunningStatus();
      if (!initialStatus) {
        logger.warn('⚠️ Seismic sensor service did not start - retrying...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await seismicSensorService.start();
        
        // CRITICAL: Verify again after retry
        const retryStatus = seismicSensorService.getRunningStatus();
        if (!retryStatus) {
          logger.error('❌ Seismic sensor service failed to start after retry - will retry periodically');
          // Don't throw - service will retry automatically via health check
        } else {
          logger.info('✅ Seismic sensor service started successfully after retry');
        }
      } else {
        logger.info('✅ Seismic sensor service started successfully');
      }
      
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
      // CRITICAL: More frequent checks for 7/24 continuous monitoring
      // CRITICAL: Store interval ID for cleanup to prevent memory leaks
      seismicHealthCheckInterval = setInterval(async () => {
        const isRunning = seismicSensorService.getRunningStatus();
        const stats = seismicSensorService.getStatistics();
        
        // CRITICAL: Smart detection - service is active if running OR has recent readings
        const isActuallyActive = isRunning || (stats.totalReadings > 0 && stats.timeSinceLastData < 60000);
        
        if (!isActuallyActive) {
          if (__DEV__) {
            logger.warn('⚠️ Seismic sensor service stopped unexpectedly - auto-restarting for 7/24 continuous monitoring...');
          }
          try {
            await seismicSensorService.start();
            if (__DEV__) {
              logger.info('✅ Seismic sensor service auto-restarted successfully - 7/24 monitoring active');
            }
          } catch (restartError) {
            if (__DEV__) {
              logger.debug('Auto-restart failed (will retry):', restartError);
            }
          }
        } else {
          // ELITE: Log statistics periodically to confirm continuous operation (only in DEV to reduce noise)
          if (__DEV__ && stats.totalReadings > 0) {
            const timeSinceLastData = isNaN(stats.timeSinceLastData) ? 0 : stats.timeSinceLastData;
            const timeStr = timeSinceLastData < 1000 
              ? 'Canlı' 
              : timeSinceLastData < 60000 
                ? `${Math.round(timeSinceLastData / 1000)}s önce`
                : 'Veri yok';
            logger.debug(`📊 Seismic monitoring active (7/24): ${stats.totalReadings} okuma, ${stats.confirmedEvents} tespit, son veri: ${timeStr}`);
          }
        }
      }, 30000); // Check every 30 seconds for 7/24 continuous monitoring
      
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
      // CRITICAL: Increased delay to ensure native bridge is fully ready before loading notifications
      Promise.allSettled([
        (async () => {
          // CRITICAL: Wait longer for native bridge to be fully ready
          // This prevents NativeEventEmitter errors by ensuring all native modules are initialized
          await new Promise(resolve => setTimeout(resolve, 8000)); // Increased from 5s to 8s
          
          // Initialize with timeout protection (non-blocking)
          // CRITICAL: Each service initializes independently to prevent cascading errors
          await Promise.race([
            Promise.allSettled([
              notificationService.initialize().catch((error) => {
                // ELITE: Silent fail - notifications are optional
                if (__DEV__) {
                  logger.debug('NotificationService pre-init failed (will initialize on-demand):', error?.message || error);
                }
                return null;
              }),
              multiChannelAlertService.initialize().catch((error) => {
                // ELITE: Silent fail - multi-channel alerts are optional
                if (__DEV__) {
                  logger.debug('MultiChannelAlertService pre-init failed (will initialize on-demand):', error?.message || error);
                }
                return null;
              }),
            ]),
            new Promise(resolve => setTimeout(resolve, 30000)), // 30s timeout
          ]);
          
          if (__DEV__) {
            logger.info('✅ Notification services pre-initialized (background)');
          }
        })(),
      ]).catch((error) => {
        // Silent fail - will initialize on-demand if pre-init fails
        if (__DEV__) {
          logger.debug('Notification services pre-initialization skipped - will initialize on-demand:', error?.message || error);
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
  if (!isInitialized) return;
  
  logger.info('Shutting down app...');
  
  // CRITICAL: Clear intervals to prevent memory leaks
  if (seismicHealthCheckInterval) {
    clearInterval(seismicHealthCheckInterval);
    seismicHealthCheckInterval = null;
  }
  
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

  // ELITE: Cleanup BackendEmergencyService
  try {
    const { backendEmergencyService } = require('./services/BackendEmergencyService');
    backendEmergencyService.shutdown();
  } catch (error) {
    logger.error('BackendEmergencyService cleanup error:', error);
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

