/**
 * NOTIFICATION CHANNEL MANAGER - ELITE EDITION
 * Handles Android notification channel creation and management
 */

import { Platform } from 'react-native';
import { createLogger } from '../../utils/logger';
import { getNotificationsAsync } from './NotificationModuleLoader';

const logger = createLogger('NotificationChannelManager');

// Channel definitions
export interface ChannelConfig {
  id: string;
  name: string;
  importance: 'MAX' | 'HIGH' | 'DEFAULT' | 'LOW' | 'MIN';
  description?: string;
  sound?: string;
  vibrationPattern?: number[];
  bypassDnd?: boolean;
  enableLights?: boolean;
  lightColor?: string;
}

// ELITE: Predefined channels for AfetNet
export const NOTIFICATION_CHANNELS: Record<string, ChannelConfig> = {
  EARTHQUAKE_ALERT: {
    id: 'earthquake_alerts',
    name: 'Deprem Uyarıları',
    importance: 'MAX',
    description: 'Acil deprem uyarı bildirimleri',
    sound: 'default',
    vibrationPattern: [0, 500, 200, 500, 200, 500],
    bypassDnd: true,
    enableLights: true,
    lightColor: '#FF0000',
  },
  EEW_CRITICAL: {
    id: 'eew_critical',
    name: 'Erken Uyarı (Kritik)',
    importance: 'MAX',
    description: 'P-Dalga tespit kritik uyarıları',
    sound: 'default',
    vibrationPattern: [0, 1000, 500, 1000],
    bypassDnd: true,
    enableLights: true,
    lightColor: '#FF0000',
  },
  SOS_ALERTS: {
    id: 'sos_alerts',
    name: 'SOS Bildirimleri',
    importance: 'HIGH',
    description: 'Aile üyelerinden SOS bildirimleri',
    sound: 'default',
    vibrationPattern: [0, 300, 200, 300],
    bypassDnd: true,
  },
  FAMILY_UPDATES: {
    id: 'family_updates',
    name: 'Aile Güncellemeleri',
    importance: 'HIGH',
    description: 'Aile konum ve durum güncellemeleri',
  },
  NEWS_UPDATES: {
    id: 'news_updates',
    name: 'Haberler',
    importance: 'DEFAULT',
    description: 'Afet haberleri ve güncellemeleri',
  },
  GENERAL: {
    id: 'default',
    name: 'Genel Bildirimler',
    importance: 'DEFAULT',
    description: 'Genel uygulama bildirimleri',
  },
};

// State
let channelsInitialized = false;

/**
 * ELITE: Map importance string to Android importance level
 */
function getImportanceLevel(importance: ChannelConfig['importance']): number {
  const importanceMap: Record<string, number> = {
    MAX: 5,
    HIGH: 4,
    DEFAULT: 3,
    LOW: 2,
    MIN: 1,
  };
  return importanceMap[importance] || 3;
}

/**
 * ELITE: Initialize all notification channels
 */
export async function initializeChannels(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true; // iOS doesn't need channels
  }

  if (channelsInitialized) {
    return true;
  }

  try {
    const Notifications = await getNotificationsAsync();
    if (!Notifications) {
      logger.debug('Notifications module not available - skipping channel setup');
      return false;
    }

    // Create all channels
    const channelPromises = Object.values(NOTIFICATION_CHANNELS).map(async (config) => {
      try {
        await Notifications.setNotificationChannelAsync(config.id, {
          name: config.name,
          importance: getImportanceLevel(config.importance),
          description: config.description,
          sound: config.sound,
          vibrationPattern: config.vibrationPattern,
          bypassDnd: config.bypassDnd,
          enableLights: config.enableLights,
          lightColor: config.lightColor,
        });
      } catch (channelError) {
        // ELITE: Individual channel failure is non-critical
        logger.debug(`Channel ${config.id} setup failed:`, channelError);
      }
    });

    await Promise.all(channelPromises);
    channelsInitialized = true;

    if (__DEV__) {
      logger.debug('✅ All notification channels initialized');
    }

    return true;
  } catch (error) {
    logger.error('Failed to initialize notification channels:', error);
    return false;
  }
}

/**
 * ELITE: Get channel ID for notification type
 */
export function getChannelForType(type: 'earthquake' | 'eew' | 'sos' | 'family' | 'news' | 'general'): string {
  const channelMap: Record<string, string> = {
    earthquake: NOTIFICATION_CHANNELS.EARTHQUAKE_ALERT.id,
    eew: NOTIFICATION_CHANNELS.EEW_CRITICAL.id,
    sos: NOTIFICATION_CHANNELS.SOS_ALERTS.id,
    family: NOTIFICATION_CHANNELS.FAMILY_UPDATES.id,
    news: NOTIFICATION_CHANNELS.NEWS_UPDATES.id,
    general: NOTIFICATION_CHANNELS.GENERAL.id,
  };
  return channelMap[type] || NOTIFICATION_CHANNELS.GENERAL.id;
}

/**
 * ELITE: Reset channels state (for testing)
 */
export function resetChannelsState(): void {
  channelsInitialized = false;
}
