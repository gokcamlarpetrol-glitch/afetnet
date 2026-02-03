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

    logger.info('✅ Services loaded');

    // 2. Initialize Firebase (Notifications)
    // Fire and forget - don't block app startup
    firebaseService?.initialize?.().catch((err: unknown) => {
      logger.error('Firebase init warning:', err);
    });

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

    // 10. Start Seismic Health Check (Periodic)
    // Ensures earthquake polling is active
    startSeismicHealthCheck();

    isInitialized = true;
    isInitializing = false;
    appStore.setReady(true);

    logger.info('✨ AfetNet initialized successfully!');

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

  // Cleanup Firebase listeners
  try {
    firebaseService?.cleanup?.();
  } catch (error: unknown) {
    logger.error('Firebase cleanup error:', error);
  }

  isInitialized = false;
  useAppStore.getState().setReady(false);
}
