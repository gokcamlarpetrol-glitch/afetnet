/**
 * BACKGROUND NOTIFICATION SERVICE
 * Ensures notifications work even when app is closed
 * Registers background tasks for EEW and Earthquake polling
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform, AppState } from 'react-native';
import { createLogger } from '../utils/logger';
import NetInfo from '@react-native-community/netinfo';

const logger = createLogger('BackgroundNotificationService');

// Task names
const EEW_BACKGROUND_TASK = 'EEW_BACKGROUND_POLL';
const EARTHQUAKE_BACKGROUND_TASK = 'EARTHQUAKE_BACKGROUND_POLL';

/**
 * ELITE: Background task for EEW polling
 * CRITICAL: This runs even when app is closed
 */
TaskManager.defineTask(EEW_BACKGROUND_TASK, async () => {
  try {
    logger.info('🔔 Background EEW polling started');
    
    // Check network
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      logger.warn('No network in background EEW task');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Lazy import to avoid circular dependencies
    const { eewService } = await import('./EEWService');
    
    // Trigger EEW check
    await eewService.start();
    
    logger.info('✅ Background EEW polling completed');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    logger.error('Background EEW task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * ELITE: Background task for Earthquake polling
 * CRITICAL: This runs even when app is closed
 */
TaskManager.defineTask(EARTHQUAKE_BACKGROUND_TASK, async () => {
  try {
    logger.info('🔔 Background Earthquake polling started');
    
    // Check network
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      logger.warn('No network in background Earthquake task');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Lazy import to avoid circular dependencies
    const { earthquakeService } = await import('./EarthquakeService');
    
    // Trigger earthquake check
    await earthquakeService.fetchEarthquakes({ reason: 'background-fetch', force: true });
    
    logger.info('✅ Background Earthquake polling completed');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    logger.error('Background Earthquake task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

class BackgroundNotificationService {
  private isRegistered = false;

  /**
   * Initialize background notification service
   */
  async initialize() {
    if (this.isRegistered) {
      logger.info('Background notification service already registered');
      return;
    }

    try {
      // Request background fetch permissions
      const status = await BackgroundFetch.getStatusAsync();
      
      if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
        logger.warn('Background fetch is restricted');
        return;
      }

      if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        logger.warn('Background fetch is denied');
        return;
      }

      // Register EEW background task
      try {
        await BackgroundFetch.registerTaskAsync(EEW_BACKGROUND_TASK, {
          minimumInterval: 30, // 30 seconds minimum (system may throttle)
          stopOnTerminate: false, // CRITICAL: Continue when app is terminated
          startOnBoot: true, // CRITICAL: Start on device boot
        });
        logger.info('✅ EEW background task registered');
      } catch (error) {
        logger.error('Failed to register EEW background task:', error);
      }

      // Register Earthquake background task
      try {
        await BackgroundFetch.registerTaskAsync(EARTHQUAKE_BACKGROUND_TASK, {
          minimumInterval: 60, // 60 seconds minimum (system may throttle)
          stopOnTerminate: false, // CRITICAL: Continue when app is terminated
          startOnBoot: true, // CRITICAL: Start on device boot
        });
        logger.info('✅ Earthquake background task registered');
      } catch (error) {
        logger.error('Failed to register Earthquake background task:', error);
      }

      this.isRegistered = true;
      logger.info('✅ Background notification service initialized');
    } catch (error) {
      logger.error('Failed to initialize background notification service:', error);
    }
  }

  /**
   * Check if background fetch is available
   */
  async checkStatus(): Promise<{
    available: boolean;
    status: BackgroundFetch.BackgroundFetchStatus;
  }> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      return {
        available: status === BackgroundFetch.BackgroundFetchStatus.Available,
        status,
      };
    } catch (error) {
      logger.error('Failed to check background fetch status:', error);
      return {
        available: false,
        status: BackgroundFetch.BackgroundFetchStatus.Restricted,
      };
    }
  }

  /**
   * Unregister background tasks (for testing or cleanup)
   */
  async unregister() {
    try {
      await BackgroundFetch.unregisterTaskAsync(EEW_BACKGROUND_TASK);
      await BackgroundFetch.unregisterTaskAsync(EARTHQUAKE_BACKGROUND_TASK);
      this.isRegistered = false;
      logger.info('Background tasks unregistered');
    } catch (error) {
      logger.error('Failed to unregister background tasks:', error);
    }
  }
}

export const backgroundNotificationService = new BackgroundNotificationService();

