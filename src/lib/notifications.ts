/**
 * REAL NOTIFICATION SERVICE
 * Uses expo-notifications for actual push notification functionality
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Get push notification token
 * Returns real Expo push token for actual notifications
 */
export async function getPushToken(): Promise<string|null> {
  try {
    // Check if running on a real device
    if (!Device.isDevice) {
      if (__DEV__) {
        console.log('[Notifications] Not running on a real device - push token unavailable');
      }
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
        },
        android: {},
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      if (__DEV__) {
        console.log('[Notifications] Permission not granted');
      }
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '072f1217-172a-40ce-af23-3fc0ad3f7f09',
    });

    return tokenData.data;
  } catch (error) {
    if (__DEV__) {
      console.error('[Notifications] Error getting push token:', error);
    }
    return null;
  }
}

/**
 * Configure notification handlers
 * Sets up real notification handlers for foreground notifications
 */
export function configureHandlers() {
  try {
    // Configure how notifications are handled when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    if (__DEV__) {
      console.error('[Notifications] Error configuring handlers:', error);
    }
  }
}