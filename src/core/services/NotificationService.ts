/**
 * NOTIFICATION SERVICE - Simple Notification Management
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';

const logger = createLogger('NotificationService');

// Lazy import notifications to avoid early initialization
let Notifications: any = null;

function getNotifications() {
  if (!Notifications) {
    try {
      Notifications = require('expo-notifications');
    } catch (error) {
      logger.error('expo-notifications not available:', error);
      return null;
    }
  }
  return Notifications;
}

class NotificationService {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    if (__DEV__) logger.info('Initializing...');

    try {
      const Notifications = getNotifications();
      if (!Notifications) {
        logger.warn('Notifications not available - skipping initialization');
        return;
      }

      // Set notification handler
      try {
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
        logger.error('Failed to set notification handler:', error);
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        if (__DEV__) logger.warn('Permission not granted');
        return;
      }

      // Create channels (Android)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('earthquake', {
          name: 'Deprem Bildirimleri',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('sos', {
          name: 'Acil Durum',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 500, 500],
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Mesajlar',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      }

      this.isInitialized = true;
      if (__DEV__) logger.info('Initialized successfully');

    } catch (error) {
      logger.error('Initialization error:', error);
    }
  }

  async showEarthquakeNotification(magnitude: number, location: string) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🚨 Deprem: ${magnitude.toFixed(1)}`,
          body: location,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { type: 'earthquake' },
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      logger.error('Earthquake notification error:', error);
    }
  }

  async showSOSNotification(from: string) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🆘 Acil Durum',
          body: `${from} yardım istiyor!`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { type: 'sos', from },
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('SOS notification error:', error);
    }
  }

  async showMessageNotification(from: string, content: string) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💬 ${from}`,
          body: content,
          sound: 'default',
          data: { type: 'message', from },
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('Message notification error:', error);
    }
  }

  async showNewsNotification(data: { title: string; summary: string; source: string; url?: string; articleId?: string }) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📰 ${data.title}`,
          body: data.summary,
          sound: 'default',
          data: { type: 'news', source: data.source },
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('News notification error:', error);
    }
  }

  async showBatteryLowNotification(level: number) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔋 Düşük Pil',
          body: `Pil seviyesi %${level.toFixed(0)} - Şarj edin`,
          sound: 'default',
          data: { type: 'battery', level },
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('Battery notification error:', error);
    }
  }

  async showNetworkStatusNotification(isConnected: boolean) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: isConnected ? '🌐 İnternet Bağlandı' : '📡 İnternet Kesildi',
          body: isConnected ? 'Ağ bağlantısı yeniden kuruldu' : 'Offline moda geçildi',
          sound: 'default',
          data: { type: 'network', connected: isConnected },
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('Network notification error:', error);
    }
  }

  async showFamilyLocationUpdateNotification(memberName: string, location: { latitude: number; longitude: number }) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📍 ${memberName} Konum Güncellendi`,
          body: `Yeni konum: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
          sound: 'default',
          data: { type: 'family_location', memberName, location },
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('Family location notification error:', error);
    }
  }
}

export const notificationService = new NotificationService();

