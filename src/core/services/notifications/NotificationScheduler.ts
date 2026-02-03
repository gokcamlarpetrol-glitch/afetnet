/**
 * NOTIFICATION SCHEDULER - ELITE EDITION
 * Handles notification scheduling and delivery
 */

import { Platform } from 'react-native';
import { createLogger } from '../../utils/logger';
import { getNotificationsAsync } from './NotificationModuleLoader';
import { getChannelForType, initializeChannels } from './NotificationChannelManager';

const logger = createLogger('NotificationScheduler');

// Types
export interface NotificationContent {
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: boolean | string;
    badge?: number;
    priority?: 'default' | 'high' | 'max';
    categoryIdentifier?: string;
}

export interface ScheduleOptions {
    delay?: number; // seconds
    repeats?: boolean;
    channelType?: 'earthquake' | 'eew' | 'sos' | 'family' | 'news' | 'general';
}

// Rate limiting state
const recentNotifications = new Map<string, number>();
const RATE_LIMIT_WINDOW = 5000; // 5 seconds
const MAX_NOTIFICATIONS_PER_WINDOW = 3;

/**
 * ELITE: Check rate limiting for notification deduplication
 */
function shouldSendNotification(key: string): boolean {
  const now = Date.now();
  const recentTime = recentNotifications.get(key);

  // Clean old entries
  for (const [k, time] of recentNotifications.entries()) {
    if (now - time > RATE_LIMIT_WINDOW * 2) {
      recentNotifications.delete(k);
    }
  }

  if (recentTime && now - recentTime < RATE_LIMIT_WINDOW) {
    return false; // Duplicate within window
  }

  // Check overall rate
  let recentCount = 0;
  for (const time of recentNotifications.values()) {
    if (now - time < RATE_LIMIT_WINDOW) {
      recentCount++;
    }
  }

  if (recentCount >= MAX_NOTIFICATIONS_PER_WINDOW) {
    return false; // Rate limited
  }

  recentNotifications.set(key, now);
  return true;
}

/**
 * ELITE: Schedule a notification immediately
 */
export async function scheduleNotification(
  content: NotificationContent,
  options: ScheduleOptions = {},
): Promise<string | null> {
  try {
    const Notifications = await getNotificationsAsync();
    if (!Notifications) {
      logger.debug('Notifications not available - skipping');
      return null;
    }

    // Rate limiting check
    const notificationKey = `${content.title}:${content.body.substring(0, 50)}`;
    if (!shouldSendNotification(notificationKey)) {
      logger.debug('Notification rate limited:', content.title);
      return null;
    }

    // Ensure channels are initialized
    await initializeChannels();

    // Build content
    const notificationContent: any = {
      title: content.title,
      body: content.body,
      data: content.data || {},
      sound: content.sound !== false,
    };

    // Add Android-specific options
    if (Platform.OS === 'android') {
      notificationContent.channelId = getChannelForType(options.channelType || 'general');

      if (content.priority === 'max') {
        notificationContent.priority = 'max';
      } else if (content.priority === 'high') {
        notificationContent.priority = 'high';
      }
    }

    // Add iOS-specific options
    if (Platform.OS === 'ios') {
      notificationContent.badge = content.badge;
      notificationContent.categoryIdentifier = content.categoryIdentifier;
    }

    // Build trigger
    let trigger: any = null;
    if (options.delay) {
      trigger = {
        seconds: options.delay,
        repeats: options.repeats || false,
      };
    }

    // Schedule
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger,
    });

    if (__DEV__) {
      logger.debug('📣 Notification scheduled:', content.title);
    }

    return notificationId;
  } catch (error) {
    logger.error('Failed to schedule notification:', error);
    return null;
  }
}

/**
 * ELITE: Show critical notification (earthquake/EEW)
 */
export async function showCriticalNotification(
  title: string,
  body: string,
  options: {
        sound?: string;
        vibration?: number[];
        critical?: boolean;
        data?: Record<string, any>;
    } = {},
): Promise<string | null> {
  return scheduleNotification(
    {
      title,
      body,
      data: { ...options.data, critical: true },
      sound: options.sound || true,
      priority: 'max',
    },
    {
      channelType: options.critical ? 'eew' : 'earthquake',
    },
  );
}

/**
 * ELITE: Show earthquake notification with magnitude-based formatting
 */
export async function showEarthquakeNotification(
  magnitude: number,
  location: string,
  distance?: number,
  data?: Record<string, any>,
): Promise<string | null> {
  // Format based on magnitude
  let title: string;
  let priority: 'default' | 'high' | 'max';
  let channelType: 'earthquake' | 'general';

  if (magnitude >= 6.0) {
    title = `🚨 BÜYÜK DEPREM: ${magnitude.toFixed(1)}`;
    priority = 'max';
    channelType = 'earthquake';
  } else if (magnitude >= 4.5) {
    title = `⚠️ Deprem: ${magnitude.toFixed(1)}`;
    priority = 'high';
    channelType = 'earthquake';
  } else if (magnitude >= 3.0) {
    title = `📍 Hafif Deprem: ${magnitude.toFixed(1)}`;
    priority = 'default';
    channelType = 'general';
  } else {
    title = `Deprem: ${magnitude.toFixed(1)}`;
    priority = 'default';
    channelType = 'general';
  }

  // Build body
  let body = location;
  if (distance !== undefined) {
    body += ` • ${distance.toFixed(0)} km`;
  }

  return scheduleNotification(
    {
      title,
      body,
      data: { ...data, type: 'earthquake', magnitude },
      priority,
    },
    { channelType },
  );
}

/**
 * ELITE: Show SOS notification
 */
export async function showSOSNotification(
  senderName: string,
  message?: string,
  data?: Record<string, any>,
): Promise<string | null> {
  return scheduleNotification(
    {
      title: `🆘 SOS: ${senderName}`,
      body: message || 'Yardım istiyor!',
      data: { ...data, type: 'sos' },
      priority: 'max',
    },
    { channelType: 'sos' },
  );
}

/**
 * ELITE: Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    const Notifications = await getNotificationsAsync();
    if (Notifications) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
  } catch (error) {
    logger.debug('Failed to cancel notification:', error);
  }
}

/**
 * ELITE: Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    const Notifications = await getNotificationsAsync();
    if (Notifications) {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  } catch (error) {
    logger.debug('Failed to cancel all notifications:', error);
  }
}
