/**
 * FIREBASE SERVICE - Push Notifications
 * Firebase Cloud Messaging integration
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { FIREBASE_CONFIG } from '../config/firebase';

class FirebaseService {
  private isInitialized = false;
  private pushToken: string | null = null;

  async initialize() {
    if (this.isInitialized) return;

    console.log('[FirebaseService] Initializing...');

    try {
      // Request notification permissions
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.warn('[FirebaseService] Notification permission not granted');
          return;
        }

        // Get push token - Use EAS project ID from Constants
        try {
          const token = await Notifications.getExpoPushTokenAsync({
            projectId: '072f1217-172a-40ce-af23-3fc0ad3f7f09',
          });

          this.pushToken = token.data;
          console.log('[FirebaseService] Push token:', this.pushToken);
        } catch (tokenError) {
          console.warn('[FirebaseService] Failed to get push token, continuing without it:', tokenError);
          // Continue without push token - app will still work
        }
      } else {
        console.warn('[FirebaseService] Not a physical device, skipping push token');
      }

      // Configure notification channels (Android)
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
      console.log('[FirebaseService] Initialized successfully');

    } catch (error) {
      console.error('[FirebaseService] Initialization error:', error);
    }
  }

  getPushToken(): string | null {
    return this.pushToken;
  }

  async sendTestNotification() {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'AfetNet Test',
          body: 'Bildirimler çalışıyor!',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[FirebaseService] Test notification error:', error);
    }
  }
}

export const firebaseService = new FirebaseService();

