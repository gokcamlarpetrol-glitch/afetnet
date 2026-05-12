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

// NotificationCenter (Unified Gateway — ALL notifications MUST go through this)
export {
  notificationCenter,
  type NotifyResult,
  type NotifyDataMap,
  type EarthquakeNotifyData,
  type SOSNotifyData,
  type MessageNotifyData,
  type FamilyNotifyData,
  type NewsNotifyData,
  type SystemNotifyData,
  type RescueNotifyData,
  type DrillNotifyData,
} from './NotificationCenter';

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
 *
 * CRITICAL FIX: Changed from requestPermissions() to getPermissionStatus().
 * requestPermissions() triggers the OS notification permission dialog, which
 * violates Apple guideline 5.1.1 if called during init (before user action).
 * Startup must only CHECK existing status — explicit user actions (onboarding
 * button tap) call requestPermissions() when the user is ready.
 */
export async function initializeNotifications(): Promise<boolean> {
  try {
    // Check existing permissions (does NOT trigger OS dialog)
    const { getPermissionStatus: checkStatus } = await import('./NotificationPermissionHandler');
    const permResult = await checkStatus();

    if (permResult.status !== 'granted') {
      logger.debug('Notification permissions not granted — channels deferred');
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
