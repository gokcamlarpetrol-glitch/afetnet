import { Platform } from 'react-native';

// ELITE: Zero static dependencies - lazy load expo-notifications
let Notifications: any = null;
let isNotificationsLoading = false;

async function getNotificationsAsync(): Promise<any> {
  if (Notifications) return Notifications;
  if (isNotificationsLoading) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return Notifications;
  }
  
  isNotificationsLoading = true;
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // ELITE: Use eval to prevent static analysis
    const moduleName = 'expo-' + 'notifications';
    Notifications = eval(`require('${moduleName}')`);
    
    // Set notification handler on first use
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
      } catch (e) {
        // ignore
      }
    }
    
    return Notifications;
  } catch (error) {
    return null;
  } finally {
    isNotificationsLoading = false;
  }
}

function getNotifications() {
  return Notifications;
}

export async function ensureNotifPermissions(): Promise<void> {
  try {
    const Notif = await getNotificationsAsync();
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
