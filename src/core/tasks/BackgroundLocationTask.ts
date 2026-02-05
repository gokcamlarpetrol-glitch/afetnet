import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';
import { firebaseDataService } from '../services/FirebaseDataService';
import { bleMeshService } from '../services/BLEMeshService';
import { getDeviceId } from '../../lib/device';
import AsyncStorage from '@react-native-async-storage/async-storage';

const logger = createLogger('BackgroundLocationTask');

export const LOCATION_TASK_NAME = 'LOCATION_TRACKING';

/**
 * BACKGROUND LOCATION TASK - ELITE EDITION
 * Runs even when app is killed/minimized.
 * CRITICAL SAFETY FEATURE.
 */
// ELITE: Task body type from Expo TaskManager
interface LocationTaskBody {
  data?: {
    locations?: Location.LocationObject[];
  };
  error?: Error | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    logger.error('Background location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    if (!locations || locations.length === 0) return;

    const location = locations[0]; // Get the most recent location

    // We do minimal logging to avoid spam
    if (__DEV__) {
      logger.info('[BackgroundLocation] Received update:', location.coords.latitude, location.coords.longitude);
    }

    try {
      // 1. Get Device ID (needs to be robust)
      let deviceId: string | null = bleMeshService.getMyDeviceId();
      if (!deviceId) {
        // Fallback to storage directly if service not initialized in background context
        deviceId = await AsyncStorage.getItem('@afetnet:device_id');
      }

      if (!deviceId) {
        logger.warn('[BackgroundLocation] No device ID available');
        return;
      }

      // 2. Push to Cloud (Firebase)
      // Note: firebaseDataService handles its own initialization checks
      if (!firebaseDataService.isInitialized) {
        await firebaseDataService.initialize();
      }

      await firebaseDataService.saveLocationUpdate(deviceId, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: location.timestamp || Date.now(),
      });

      // 3. Update Mesh (Offline)
      // Note: BLE might be restricted in background on some OS versions, 
      // but we attempt it anyway.
      // Only if service is already running or we can start it quickly
      if (bleMeshService.getIsRunning()) {
        bleMeshService.shareLocation(location.coords.latitude, location.coords.longitude);
      }

    } catch (err) {
      logger.error('Background task processing failed:', err);
    }
  }
});
