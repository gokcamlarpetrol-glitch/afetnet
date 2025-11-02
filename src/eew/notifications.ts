import { Platform } from 'react-native';

// Lazy import to avoid early initialization
let Notifications: any = null;

function getNotifications() {
  if (!Notifications) {
    try {
      Notifications = require('expo-notifications');
      // Set notification handler on first use
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      } catch (e) {
        // ignore
      }
    } catch (error) {
      return null;
    }
  }
  return Notifications;
}

export async function ensureNotifPermissions(): Promise<void> {
  try {
    const Notif = getNotifications();
    if (!Notif) return;
    
    const settings = await Notif.getPermissionsAsync();
    if (!settings.granted) {
      await Notif.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true },
        android: {},
      });
    }
  } catch {
    // ignore
  }
}


