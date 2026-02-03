/**
 * NOTIFICATIONS MODULE - ELITE EDITION
 * Re-exports all notification functionality
 * 
 * This is the main entry point for notification services.
 * Use this instead of importing from individual files.
 */

// Module loader
export {
  getNotificationsAsync,
  isNotificationsAvailable,
  resetModuleState,
} from './NotificationModuleLoader';

// Channel management
export {
  initializeChannels,
  getChannelForType,
  resetChannelsState,
  NOTIFICATION_CHANNELS,
  type ChannelConfig,
} from './NotificationChannelManager';

// Scheduling
export {
  scheduleNotification,
  showCriticalNotification,
  showEarthquakeNotification,
  showSOSNotification,
  cancelNotification,
  cancelAllNotifications,
  type NotificationContent,
  type ScheduleOptions,
} from './NotificationScheduler';

// Permissions
export {
  getPermissionStatus,
  requestPermissions,
  isNotificationsEnabled,
  isCriticalAlertsEnabled,
  getExpoPushToken,
  getDevicePushToken,
  type PermissionStatus,
  type PermissionResult,
} from './NotificationPermissionHandler';

// ELITE: Convenience initialization function
import { initializeChannels } from './NotificationChannelManager';
import { requestPermissions } from './NotificationPermissionHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('NotificationsIndex');

/**
 * ELITE: Initialize the notification system
 * Call this once during app startup
 */
export async function initializeNotifications(): Promise<boolean> {
  try {
    // Request permissions first
    const permResult = await requestPermissions();

    if (permResult.status !== 'granted') {
      logger.debug('Notification permissions not granted');
      return false;
    }

    // Initialize channels (Android)
    await initializeChannels();

    if (__DEV__) {
      logger.debug('✅ Notification system initialized');
    }

    return true;
  } catch (error) {
    logger.error('Failed to initialize notifications:', error);
    return false;
  }
}
