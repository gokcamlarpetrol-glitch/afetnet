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

let isInitialized = false;
let isInitializing = false;

export async function initializeApp() {
  // Prevent double initialization
  if (isInitialized || isInitializing) {
    console.log('[Init] Already initialized or initializing');
    return;
  }

  isInitializing = true;
  console.log('[Init] Starting app initialization...');

  try {
    // Step 1: Notification Service
    console.log('[Init] Step 1/6: Initializing notifications...');
    await notificationService.initialize();

    // Step 2: Firebase Service
    console.log('[Init] Step 2/6: Initializing Firebase...');
    await firebaseService.initialize();

    // Step 3: Location Service
    console.log('[Init] Step 3/6: Initializing location...');
    await locationService.initialize();

    // Step 4: Premium Service
    console.log('[Init] Step 4/6: Initializing premium...');
    await premiumService.initialize();

    // Step 5: Earthquake Service
    console.log('[Init] Step 5/6: Starting earthquake service...');
    await earthquakeService.start();

        // Step 6: BLE Mesh Service
        console.log('[Init] Step 6/7: Starting BLE mesh...');
        await bleMeshService.start();

        // Step 7: EEW Service
        console.log('[Init] Step 7/7: Starting EEW service...');
        await eewService.start();

        isInitialized = true;
        isInitializing = false;
        console.log('[Init] ✅ App initialized successfully');

  } catch (error) {
    console.error('[Init] ❌ Initialization error:', error);
    isInitializing = false;
    // Continue anyway - app should work with degraded functionality
  }
}

export function shutdownApp() {
  console.log('[Init] Shutting down...');
  
  earthquakeService.stop();
  bleMeshService.stop();
  
  isInitialized = false;
  console.log('[Init] Shutdown complete');
}

