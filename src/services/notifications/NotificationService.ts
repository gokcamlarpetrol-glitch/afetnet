import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Notification service for real-time notification management
export class NotificationService {
  private static instance: NotificationService;
  private notificationChannels: Map<string, Notifications.NotificationChannel> = new Map();

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Initialize notification channels
  async initializeChannels(): Promise<void> {
    try {
      // Emergency channel (highest priority)
      await this.createChannel('emergency', {
        name: 'Acil Durum Bildirimleri',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF0000',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });

      // Family channel (high priority)
      await this.createChannel('family', {
        name: 'Aile Bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00FF00',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });

      // Message channel (default priority)
      await this.createChannel('messages', {
        name: 'Mesaj Bildirimleri',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0000FF',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });

      // System channel (low priority)
      await this.createChannel('system', {
        name: 'Sistem Bildirimleri',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0, 250],
        lightColor: '#FFFF00',
        sound: 'default',
        enableVibrate: false,
        enableLights: true,
        showBadge: false,
      });

      // Marketing channel (lowest priority)
      await this.createChannel('marketing', {
        name: 'Pazarlama Bildirimleri',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0, 250],
        lightColor: '#FF00FF',
        sound: 'default',
        enableVibrate: false,
        enableLights: false,
        showBadge: false,
      });

      
    } catch {
      // Ignore channel initialization errors
    }
  }

  // Create notification channel
  private async createChannel(
    id: string, 
    config: Notifications.NotificationChannelInput,
  ): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(id, config);
        this.notificationChannels.set(id, config as any);
      }
    } catch {
      // Ignore channel creation errors
    }
  }

  // Send emergency notification
  async sendEmergencyNotification(
    title: string, 
    body: string, 
    data?: any,
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'emergency',
        },
        trigger: null, // Send immediately
      });

      // Trigger haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
    } catch {
      // Ignore emergency notification errors
    }
  }

  // Send family notification
  async sendFamilyNotification(
    title: string, 
    body: string, 
    data?: any,
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: 'family',
        },
        trigger: null,
      });

      // Trigger haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
    } catch {
      // Ignore family notification errors
    }
  }

  // Send message notification
  async sendMessageNotification(
    title: string, 
    body: string, 
    data?: any,
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          categoryIdentifier: 'messages',
        },
        trigger: null,
      });

      // Trigger haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
    } catch {
      // Ignore message notification errors
    }
  }

  // Send system notification
  async sendSystemNotification(
    title: string, 
    body: string, 
    data?: any,
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.LOW,
          categoryIdentifier: 'system',
        },
        trigger: null,
      });
      
    } catch {
      // Ignore system notification errors
    }
  }

  // Send marketing notification
  async sendMarketingNotification(
    title: string, 
    body: string, 
    data?: any,
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.LOW,
          categoryIdentifier: 'marketing',
        },
        trigger: null,
      });
      
    } catch {
      // Ignore marketing notification errors
    }
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      // Ignore permission request errors
      return false;
    }
  }

  // Get notification permissions status
  async getPermissionsStatus(): Promise<Notifications.NotificationPermissionsStatus> {
    try {
      return await Notifications.getPermissionsAsync();
    } catch {
      // Ignore permission status errors
      return { 
        status: 'undetermined' as Notifications.PermissionStatus,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      };
    }
  }

  // Clear all notifications
  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      
    } catch {
      // Ignore clear notifications errors
    }
  }

  // Set badge count
  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
      
    } catch {
      // Ignore badge count errors
    }
  }

  // Configure notification handler
  async configureNotificationHandler(
    soundEnabled: boolean,
    vibrationEnabled: boolean,  
  ): Promise<void> {
    try {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: soundEnabled,
          shouldSetBadge: false,
        } as Notifications.NotificationBehavior),
      });
      
    } catch {
      // Ignore notification handler errors
    }
  }

  // Test notification
  async sendTestNotification(type: 'emergency' | 'family' | 'messages' | 'system' | 'marketing'): Promise<void> {
    const testData = {
      emergency: { title: '🚨 Test Acil Durum', body: 'Bu bir test acil durum bildirimidir' },
      family: { title: '👨‍👩‍👧‍👦 Test Aile', body: 'Bu bir test aile bildirimidir' },
      messages: { title: '💬 Test Mesaj', body: 'Bu bir test mesaj bildirimidir' },
      system: { title: '⚙️ Test Sistem', body: 'Bu bir test sistem bildirimidir' },
      marketing: { title: '📢 Test Pazarlama', body: 'Bu bir test pazarlama bildirimidir' },
    };

    const data = testData[type];
    
    switch (type) {
    case 'emergency':
      await this.sendEmergencyNotification(data.title, data.body);
      break;
    case 'family':
      await this.sendFamilyNotification(data.title, data.body);
      break;
    case 'messages':
      await this.sendMessageNotification(data.title, data.body);
      break;
    case 'system':
      await this.sendSystemNotification(data.title, data.body);
      break;
    case 'marketing':
      await this.sendMarketingNotification(data.title, data.body);
      break;
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
