import React, { useEffect } from 'react';
import { notificationService } from '../services/notifications/NotificationService';

// Initialize notification service on app startup
export default function NotificationInitializer() {
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        await notificationService.initializeChannels();
        console.log('✅ Notification service initialized');
      } catch (error) {
        console.warn('Failed to initialize notification service:', error);
      }
    };

    initializeNotifications();
  }, []);

  return null; // This component doesn't render anything
}

