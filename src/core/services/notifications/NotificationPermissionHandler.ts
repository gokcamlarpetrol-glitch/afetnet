/**
 * NOTIFICATION PERMISSION HANDLER - ELITE EDITION
 * Handles notification permission requests and status
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { createLogger } from '../../utils/logger';
import { getNotificationsAsync } from './NotificationModuleLoader';

const logger = createLogger('NotificationPermissionHandler');

// Permission states
export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface PermissionResult {
  status: PermissionStatus;
  canAskAgain: boolean;
  iosSettings?: {
    alert: boolean;
    badge: boolean;
    sound: boolean;
    criticalAlert: boolean;
  };
}

/**
 * ELITE: Get current permission status
 */
export async function getPermissionStatus(): Promise<PermissionResult> {
  try {
    const Notifications = await getNotificationsAsync();
    if (!Notifications) {
      return {
        status: 'unavailable',
        canAskAgain: false,
      };
    }

    const { status, canAskAgain, ios } = await Notifications.getPermissionsAsync();

    return {
      status: status as PermissionStatus,
      canAskAgain: canAskAgain ?? true,
      iosSettings: ios ? {
        alert: ios.allowsAlert ?? false,
        badge: ios.allowsBadge ?? false,
        sound: ios.allowsSound ?? false,
        criticalAlert: ios.allowsCriticalAlerts ?? false,
      } : undefined,
    };
  } catch (error) {
    logger.error('Failed to get permission status:', error);
    return {
      status: 'unavailable',
      canAskAgain: false,
    };
  }
}

/**
 * ELITE: Request notification permissions
 */
export async function requestPermissions(): Promise<PermissionResult> {
  try {
    // Check if device supports notifications
    if (!Device.isDevice) {
      if (__DEV__) {
        logger.debug('Running in simulator - permissions may be limited');
      }
    }

    const Notifications = await getNotificationsAsync();
    if (!Notifications) {
      return {
        status: 'unavailable',
        canAskAgain: false,
      };
    }

    // First check existing permissions
    const existingPerms = await Notifications.getPermissionsAsync();
    if (existingPerms.status === 'granted') {
      return {
        status: 'granted',
        canAskAgain: false,
        iosSettings: existingPerms.ios ? {
          alert: existingPerms.ios.allowsAlert ?? false,
          badge: existingPerms.ios.allowsBadge ?? false,
          sound: existingPerms.ios.allowsSound ?? false,
          criticalAlert: existingPerms.ios.allowsCriticalAlerts ?? false,
        } : undefined,
      };
    }

    // Request permissions with iOS-specific options
    const permissionOptions: any = {};

    if (Platform.OS === 'ios') {
      permissionOptions.ios = {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowProvisional: true, // Allow provisional notifications
        allowCriticalAlerts: true, // Request critical alerts for earthquake warnings
      };
    }

    const { status, canAskAgain, ios } = await Notifications.requestPermissionsAsync(permissionOptions);

    if (__DEV__) {
      logger.debug('Permission request result:', status);
    }

    return {
      status: status as PermissionStatus,
      canAskAgain: canAskAgain ?? false,
      iosSettings: ios ? {
        alert: ios.allowsAlert ?? false,
        badge: ios.allowsBadge ?? false,
        sound: ios.allowsSound ?? false,
        criticalAlert: ios.allowsCriticalAlerts ?? false,
      } : undefined,
    };
  } catch (error) {
    logger.error('Failed to request permissions:', error);
    return {
      status: 'unavailable',
      canAskAgain: false,
    };
  }
}

/**
 * ELITE: Check if notifications are enabled
 */
export async function isNotificationsEnabled(): Promise<boolean> {
  const result = await getPermissionStatus();
  return result.status === 'granted';
}

/**
 * ELITE: Check if critical alerts are enabled (iOS)
 */
export async function isCriticalAlertsEnabled(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return true; // Android doesn't have this restriction
  }

  const result = await getPermissionStatus();
  return result.iosSettings?.criticalAlert ?? false;
}

/**
 * ELITE: Get push notification token
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const Notifications = await getNotificationsAsync();
    if (!Notifications) {
      return null;
    }

    // Check permissions first
    const isEnabled = await isNotificationsEnabled();
    if (!isEnabled) {
      logger.debug('Notifications not enabled - cannot get push token');
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '072f1217-172a-40ce-af23-3fc0ad3f7f09', // EAS Project ID
    });

    return tokenData.data;
  } catch (error) {
    logger.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * ELITE: Get device push token (native)
 */
export async function getDevicePushToken(): Promise<{ token: string; type: 'apns' | 'fcm' } | null> {
  try {
    const Notifications = await getNotificationsAsync();
    if (!Notifications) {
      return null;
    }

    const isEnabled = await isNotificationsEnabled();
    if (!isEnabled) {
      return null;
    }

    const tokenData = await Notifications.getDevicePushTokenAsync();

    return {
      token: tokenData.data,
      type: Platform.OS === 'ios' ? 'apns' : 'fcm',
    };
  } catch (error) {
    logger.error('Failed to get device push token:', error);
    return null;
  }
}
