/**
 * FIREBASE SERVICE - Push Notifications
 * Firebase Cloud Messaging integration
 */

import { Platform } from 'react-native';
import { FIREBASE_CONFIG } from '../config/firebase';
import { createLogger } from '../utils/logger';

const logger = createLogger('FirebaseService');

// Lazy imports to avoid early initialization
let Notifications: any = null;
let Device: any = null;

function getNotifications() {
  if (!Notifications) {
    try {
      Notifications = require('expo-notifications');
    } catch (e) { /* ignore */ }
  }
  return Notifications;
}

function getDevice() {
  if (!Device) {
    try {
      Device = require('expo-device');
    } catch (e) { /* ignore */ }
  }
  return Device;
}

class FirebaseService {
  private isInitialized = false;
  private pushToken: string | null = null;

  async initialize() {
    if (this.isInitialized) return;

    if (__DEV__) logger.info('Initializing...');

    try {
      const Notifications = getNotifications();
      const Device = getDevice();
      
      if (!Notifications || !Device) {
        logger.warn('Notifications or Device not available - Firebase disabled');
        return;
      }

      // Request notification permissions
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          if (__DEV__) logger.warn('Notification permission not granted');
          return;
        }

        // Get push token - Use EAS project ID from Constants
        try {
          const token = await Notifications.getExpoPushTokenAsync({
            projectId: '072f1217-172a-40ce-af23-3fc0ad3f7f09',
          });

          this.pushToken = token.data;
          if (__DEV__) logger.info('Push token:', this.pushToken);
        } catch (tokenError) {
          if (__DEV__) logger.warn('Failed to get push token, continuing without it:', tokenError);
          // Continue without push token - app will still work
        }
      } else {
        if (__DEV__) logger.warn('Not a physical device, skipping push token');
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
      if (__DEV__) logger.info('Initialized successfully');

    } catch (error) {
      logger.error('Initialization error:', error);
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
      logger.error('Test notification error:', error);
    }
  }
}

export const firebaseService = new FirebaseService();

