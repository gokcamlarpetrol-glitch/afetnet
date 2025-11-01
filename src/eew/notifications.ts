import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function ensureNotifPermissions(): Promise<void> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (!settings.granted) {
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true },
        android: {},
      });
    }
  } catch {
    // ignore
  }
}

// Ensure foreground notifications display and play sound
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});


