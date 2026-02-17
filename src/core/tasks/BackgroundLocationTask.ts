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

// CRITICAL FIX: Guard against double-define crash on iOS production
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
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
        // SINGLE ID ARCHITECTURE: Use only the unified ID from cached identity
        let singleId: string | null = null;

        // Get the unified ID from cached identity (same as IdentityService.id)
        try {
          const cachedIdentityJson = await AsyncStorage.getItem('@afetnet:identity_cache_v2');
          if (cachedIdentityJson) {
            const cachedIdentity = JSON.parse(cachedIdentityJson);
            if (cachedIdentity?.id && cachedIdentity.id !== 'unknown') {
              singleId = cachedIdentity.id; // AFN-{uid} — the single unified ID
            }
          }
        } catch {
          // Identity cache read failed
        }

        // Fallback: try AsyncStorage device ID (already synced to unified ID by IdentityService)
        if (!singleId) {
          singleId = bleMeshService.getMyDeviceId();
        }
        if (!singleId) {
          singleId = await AsyncStorage.getItem('@afetnet:device_id');
        }

        if (!singleId) {
          logger.warn('[BackgroundLocation] No device ID available');
          return;
        }

        // Push to Cloud (Firebase) — SINGLE ID, no fan-out needed
        try {
          await firebaseDataService.initialize();
        } catch { /* best effort */ }

        const locationPayload = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          heading: location.coords.heading,
          timestamp: location.timestamp || Date.now(),
        };

        const success = await firebaseDataService.saveLocationUpdate(singleId, locationPayload);
        if (!success) {
          logger.warn('[BackgroundLocation] Cloud location save failed');
        }

        // 3. Update Mesh (Offline)
        if (bleMeshService.getIsRunning()) {
          bleMeshService.shareLocation(location.coords.latitude, location.coords.longitude);
        }

      } catch (err) {
        logger.error('Background task processing failed:', err);
      }
    }
  });
} // end isTaskDefined guard
