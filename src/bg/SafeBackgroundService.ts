// Safe Background Service wrapper to prevent crashes when native modules are not available
import { logger } from '../utils/productionLogger';
let BackgroundService: any = null;

try {
  BackgroundService = require('react-native-background-actions');
} catch (e) {
  logger.warn('react-native-background-actions not available');
}

export const SafeBackgroundService = {
  isAvailable: () => BackgroundService !== null,
  
  start: async (task: () => Promise<void>, options: Record<string, unknown>) => {
    if (!BackgroundService) {
      logger.warn('BackgroundService not available, cannot start');
      return;
    }
    try {
      await BackgroundService.start(task, options);
    } catch (e) {
      logger.warn('Failed to start background service:', e);
    }
  },
  
  stop: async () => {
    if (!BackgroundService) {
      logger.warn('BackgroundService not available, cannot stop');
      return;
    }
    try {
      await BackgroundService.stop();
    } catch (e) {
      logger.warn('Failed to stop background service:', e);
    }
  }
};



