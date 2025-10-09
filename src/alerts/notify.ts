import * as Notifications from 'expo-notifications';
import { QuakeItem } from '../services/quake/types';

// Debounce tracking to prevent spam notifications
const lastNotificationTime = new Map<string, number>();
const notificationDebounceMs = 2 * 60 * 1000; // 2 minutes

export async function notifyQuake(quake: QuakeItem, tag: 'live' | 'bg'): Promise<void> {
  try {
    const quakeId = quake.id;
    const now = Date.now();
    
    // Check debounce
    const lastTime = lastNotificationTime.get(quakeId) || 0;
    if (now - lastTime < notificationDebounceMs) {
      console.log(`Skipping notification for ${quakeId} (debounced)`);
      return;
    }
    
    // Update debounce tracking
    lastNotificationTime.set(quakeId, now);
    
    // Clean old entries (keep only last 100)
    if (lastNotificationTime.size > 100) {
      const entries = Array.from(lastNotificationTime.entries());
      entries.sort((a, b) => b[1] - a[1]);
      lastNotificationTime.clear();
      entries.slice(0, 50).forEach(([key, value]) => {
        lastNotificationTime.set(key, value);
      });
    }
    
    // Create notification content
    const title = `Deprem Uyarısı • M${quake.mag.toFixed(1)}`;
    const body = `${quake.place} • ${new Date(quake.time).toLocaleTimeString('tr-TR')}`;
    
    // Ensure notification channel exists
    await ensureQuakeChannel();
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          quakeId: quake.id,
          magnitude: quake.mag,
          location: quake.place,
          source: quake.source,
          tag,
          timestamp: quake.time
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: 'quake-alert'
      },
      trigger: null, // Send immediately
    });
    
    console.log(`Notification sent for quake ${quakeId} (${tag})`);
    
  } catch (error) {
    console.error('Failed to send quake notification:', error);
  }
}

async function ensureQuakeChannel(): Promise<void> {
  try {
    // Check if channel already exists
    const channels = await Notifications.getNotificationChannelsAsync();
    const existingChannel = channels.find(ch => ch.id === 'quakes');
    
    if (!existingChannel) {
      // Create the channel
      await Notifications.setNotificationChannelAsync('quakes', {
        name: 'Deprem Uyarıları',
        description: 'Canlı deprem uyarıları ve bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF0000',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });
      console.log('Created quakes notification channel');
    }
  } catch (error) {
    console.warn('Failed to create notification channel:', error);
  }
}

export async function notifyPWaveAlert(): Promise<void> {
  try {
    const title = 'Ön Uyarı (Deneysel)';
    const body = 'Olası sarsıntı tespiti — doğrulanmadı';
    
    await ensureQuakeChannel();
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'pwave-experimental',
          timestamp: Date.now()
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        categoryIdentifier: 'pwave-alert'
      },
      trigger: null,
    });
    
    console.log('P-wave experimental alert sent');
  } catch (error) {
    console.error('Failed to send P-wave alert:', error);
  }
}

export async function notifyTestAlert(): Promise<void> {
  try {
    const title = 'Test Bildirim';
    const body = 'Deprem bildirimi test edildi';
    
    await ensureQuakeChannel();
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'test',
          timestamp: Date.now()
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null,
    });
    
    console.log('Test notification sent');
  } catch (error) {
    console.error('Failed to send test notification:', error);
  }
}
