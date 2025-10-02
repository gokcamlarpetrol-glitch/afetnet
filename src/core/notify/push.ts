import { Platform, PermissionsAndroid, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { PreferencesManager } from '../storage/prefs';

export interface PushConfig {
  fcmSenderId?: string;
  fcmAppId?: string;
  fcmApiKey?: string;
  fcmProjectId?: string;
  apnsTeamId?: string;
  apnsKeyId?: string;
}

export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export class PushNotificationManager {
  private static instance: PushNotificationManager;
  private prefs = PreferencesManager.getInstance();
  private isInitialized = false;
  private pushToken: string | null = null;

  static getInstance(): PushNotificationManager {
    if (!PushNotificationManager.instance) {
      PushNotificationManager.instance = new PushNotificationManager();
    }
    return PushNotificationManager.instance;
  }

  async initPush(config: PushConfig): Promise<void> {
    try {
      console.log('Initializing push notifications with config:', config);

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Push notification permissions denied');
      }

      // Configure notification handling
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      // Get push token
      const token = await this.getPushToken(config);
      if (token) {
        this.pushToken = token;
        await this.prefs.set('pushToken', token);
        console.log('Push token obtained:', token);
      }

      this.isInitialized = true;
      console.log('Push notifications initialized successfully');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      throw error;
    }
  }

  private async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Request POST_NOTIFICATIONS permission for Android 13+
        const androidVersion = Platform.Version;
        if (androidVersion >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            {
              title: 'Notification Permission',
              message: 'AfetNet needs notification permission to send emergency alerts.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            return false;
          }
        }

        // Request other Android permissions
        const permissions = [
          PermissionsAndroid.PERMISSIONS.WAKE_LOCK,
          PermissionsAndroid.PERMISSIONS.VIBRATE,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        return allGranted;
      } else {
        // iOS permissions
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
      }
    } catch (error) {
      console.error('Failed to request push permissions:', error);
      return false;
    }
  }

  private async getPushToken(config: PushConfig): Promise<string | null> {
    try {
      if (Platform.OS === 'android' && config.fcmSenderId) {
        // Initialize Firebase for Android
        // In production, you'd initialize Firebase with the config
        console.log('Initializing Firebase for Android:', config.fcmSenderId);
        
        // For now, we'll use Expo's push token
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        return token;
      } else if (Platform.OS === 'ios') {
        // iOS push token
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        return token;
      }

      return null;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  async subscribeTopics(topics: string[]): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Push notifications not initialized');
      }

      if (!this.pushToken) {
        throw new Error('No push token available');
      }

      console.log('Subscribing to topics:', topics);

      // In production, you'd send subscription requests to your backend
      // which would then subscribe to FCM topics or APNs topics
      
      // For now, we'll store the topics locally
      await this.prefs.set('subscribedTopics', JSON.stringify(topics));
      
      console.log('Successfully subscribed to topics:', topics);
    } catch (error) {
      console.error('Failed to subscribe to topics:', error);
      throw error;
    }
  }

  async unsubscribeAll(): Promise<void> {
    try {
      console.log('Unsubscribing from all topics');
      
      // In production, you'd send unsubscription requests to your backend
      await this.prefs.remove('subscribedTopics');
      
      console.log('Successfully unsubscribed from all topics');
    } catch (error) {
      console.error('Failed to unsubscribe from topics:', error);
      throw error;
    }
  }

  async getSubscribedTopics(): Promise<string[]> {
    try {
      const topicsJson = await this.prefs.get('subscribedTopics');
      if (!topicsJson) {
        return [];
      }
      return JSON.parse(topicsJson);
    } catch (error) {
      console.error('Failed to get subscribed topics:', error);
      return [];
    }
  }

  async showLocalNotification(title: string, body: string, data?: Record<string, any>): Promise<void> {
    try {
      console.log('Showing local notification:', { title, body, data });

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });

      console.log('Local notification scheduled successfully');
    } catch (error) {
      console.error('Failed to show local notification:', error);
      throw error;
    }
  }

  async showEmergencyNotification(title: string, body: string, data?: Record<string, any>): Promise<void> {
    try {
      console.log('Showing emergency notification:', { title, body, data });

      // Emergency notifications should be more prominent
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { ...data, type: 'emergency' },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'EMERGENCY',
        },
        trigger: null, // Show immediately
      });

      console.log('Emergency notification scheduled successfully');
    } catch (error) {
      console.error('Failed to show emergency notification:', error);
      throw error;
    }
  }

  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('All notifications cleared');
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      throw error;
    }
  }

  async getNotificationSettings(): Promise<{
    hasPermission: boolean;
    isEnabled: boolean;
    pushToken: string | null;
    subscribedTopics: string[];
  }> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const pushToken = await this.prefs.get('pushToken');
      const subscribedTopics = await this.getSubscribedTopics();

      return {
        hasPermission: status === 'granted',
        isEnabled: this.isInitialized && !!pushToken,
        pushToken,
        subscribedTopics,
      };
    } catch (error) {
      console.error('Failed to get notification settings:', error);
      return {
        hasPermission: false,
        isEnabled: false,
        pushToken: null,
        subscribedTopics: [],
      };
    }
  }

  async testPushNotification(): Promise<void> {
    try {
      await this.showLocalNotification(
        'Test Notification',
        'This is a test notification from AfetNet',
        { test: true, timestamp: Date.now() }
      );
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }

  // Handle incoming notifications
  setupNotificationHandlers(): void {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      // You can add custom handling here
    });

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      // You can add navigation logic here based on notification data
    });
  }

  async isInitialized(): Promise<boolean> {
    return this.isInitialized;
  }

  async getPushToken(): Promise<string | null> {
    return this.pushToken;
  }
}
