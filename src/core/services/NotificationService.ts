/**
 * NOTIFICATION SERVICE - Simple Notification Management
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    console.log('[NotificationService] Initializing...');

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[NotificationService] Permission not granted');
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
      console.log('[NotificationService] Initialized successfully');

    } catch (error) {
      console.error('[NotificationService] Initialization error:', error);
    }
  }

  async showEarthquakeNotification(magnitude: number, location: string) {
    try {
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
      console.error('[NotificationService] Earthquake notification error:', error);
    }
  }

  async showSOSNotification(from: string) {
    try {
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
      console.error('[NotificationService] SOS notification error:', error);
    }
  }

  async showMessageNotification(from: string, content: string) {
    try {
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
      console.error('[NotificationService] Message notification error:', error);
    }
  }
}

export const notificationService = new NotificationService();

