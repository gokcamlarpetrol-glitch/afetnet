/**
 * BACKGROUND TASK SERVICE - Handle Background Operations
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { createLogger } from '../utils/logger';

const logger = createLogger('BackgroundTaskService');

const BACKGROUND_FETCH_TASK = 'background-fetch-task';

class BackgroundTaskService {
  private isInitialized = false;

  async registerTasks() {
    if (this.isInitialized) return;

    try {
      // Define the task
      TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
        try {
          logger.info('Background fetch task running');

          // 1. Check for new earthquakes
          const { earthquakeService } = require('./EarthquakeService');
          await earthquakeService.checkRecentEarthquakes();

          // 2. Sync family status (if user is logged in/has ID)
          const { useFamilyStore } = require('../stores/familyStore');
          await useFamilyStore.getState().initialize(); // Re-syncs with Firebase

          // 3. Sync offline queue
          const { offlineSyncService } = require('./OfflineSyncService');
          await offlineSyncService.processQueue();

          logger.info('Background sync completed successfully');
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch (error) {
          logger.error('Background fetch failed:', error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });

      // Register the task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 60 * 15, // 15 minutes
        stopOnTerminate: false, // Continue even if app is terminated
        startOnBoot: true, // Start on device boot
      });

      logger.info('Background tasks registered successfully');
      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to register background tasks:', error);
    }
  }

  async unregisterTasks() {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      logger.info('Background tasks unregistered');
    } catch (error) {
      logger.error('Failed to unregister background tasks:', error);
    }
  }
}

export const backgroundTaskService = new BackgroundTaskService();
