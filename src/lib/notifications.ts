import * as Notifications from "expo-notifications";

/**
 * Push notification token alımı
 * Expo Push Notification servisi için gerekli
 */
export async function getPushToken(): Promise<string|null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    let final = status;
    if (final !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      final = req.status;
    }
    if (final !== "granted") {
      console.warn("AfetNet: Bildirim izni reddedildi");
      return null;
    }
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID || '072f1217-172a-40ce-af23-3fc0ad3f7f09'
    });
    console.log("AfetNet: Push token alındı:", token.data.slice(0, 20) + "...");
    return token.data;
  } catch (error) {
    console.error("AfetNet: Push token alınamadı:", error);
    return null;
  }
}

/**
 * Notification handler yapılandırması
 * Acil durum bildirimleri için öncelikli ayarlar
 */
export function configureHandlers() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true, // Acil durum için ses aktif
      shouldSetBadge: true,
    }),
  });
}

/**
 * Acil durum bildirimi gönder (local)
 */
export async function sendLocalEmergencyNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        data: { type: 'emergency' },
      },
      trigger: null, // Anında gönder
    });
  } catch (error) {
    console.error("AfetNet: Local bildirim gönderilemedi:", error);
  }
}
