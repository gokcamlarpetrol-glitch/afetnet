/**
 * BACKGROUND LOCATION GUARD
 * Stops stale location tasks that can survive app upgrades and cause
 * persistent iOS location indicator noise.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('BackgroundLocationGuard');

// Legacy task names from previous builds/services.
const LOCATION_TASK_CANDIDATES = [
  'LOCATION_TRACKING',
  'AFETNET_EEW_LOCATION_TASK',
  'SEISMIC_LOCATION_HEARTBEAT',
] as const;

let cleanupInFlight: Promise<number> | null = null;

export async function stopLegacyBackgroundLocationTasks(reason: string = 'startup'): Promise<number> {
  if (cleanupInFlight) {
    return cleanupInFlight;
  }

  cleanupInFlight = (async () => {
    let stoppedCount = 0;

    for (const taskName of LOCATION_TASK_CANDIDATES) {
      try {
        const [isRegistered, hasStarted] = await Promise.all([
          TaskManager.isTaskRegisteredAsync(taskName).catch(() => false),
          Location.hasStartedLocationUpdatesAsync(taskName).catch(() => false),
        ]);

        if (!isRegistered && !hasStarted) {
          continue;
        }

        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(taskName);
          stoppedCount += 1;
          logger.info(`Stopped stale background location task: ${taskName} (${reason})`);
        } else {
          logger.info(`Location task registered but not running: ${taskName} (${reason})`);
        }
      } catch (error) {
        logger.warn(`Failed to stop background location task ${taskName}:`, error);
      }
    }

    if (stoppedCount > 0) {
      logger.warn(`Background location cleanup stopped ${stoppedCount} stale task(s) (${reason})`);
    }

    return stoppedCount;
  })();

  try {
    return await cleanupInFlight;
  } finally {
    cleanupInFlight = null;
  }
}

