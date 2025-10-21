import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notifications/NotificationService';
import { getFcmToken, registerTokenWithWorker } from '../push/fcm';
import { useSettings } from '../store/settings';
import { logger } from '../utils/productionLogger';

// Initialize notification service on app startup
export default function NotificationInitializer() {
  const { selectedProvinces } = useSettings();

  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        await notificationService.initializeChannels();
        console.log('✅ Notification service initialized');

        // Request permissions on first launch (idempotent)
        const perm = await Notifications.getPermissionsAsync();
        if (!perm.granted) {
          await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true }
          });
        }

        // Obtain native push token (APNs on iOS, FCM on Android)
        const token = await getFcmToken();
        if (token) {
          // Register token with the worker (for regional push)
          await registerTokenWithWorker(token, selectedProvinces);
        } else {
          logger.warn('Push token not available on init');
        }
      } catch (error) {
        console.warn('Failed to initialize notification service:', error);
      }
    };

    initializeNotifications();
  }, []);

  return null; // This component doesn't render anything
}

