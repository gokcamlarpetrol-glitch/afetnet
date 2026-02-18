/**
 * FIREBASE SERVICE - Push Notifications
 * Firebase Cloud Messaging integration
 * CRITICAL: Lazy imports to prevent module loading errors
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';
import type { FirebaseMessagePayload } from '../types/firebase-messaging';
import { safeLowerCase } from '../utils/safeString';

const logger = createLogger('FirebaseService');

// CRITICAL: Lazy load Firebase config to prevent module loading errors
let firebaseConfigCache: any = null;
async function getFirebaseConfig() {
  if (firebaseConfigCache) {
    return firebaseConfigCache;
  }
  try {
    const { FIREBASE_CONFIG } = await import('../config/firebase');
    firebaseConfigCache = Platform.OS === 'ios' ? FIREBASE_CONFIG.ios : FIREBASE_CONFIG.android;
    return firebaseConfigCache;
  } catch (error: unknown) {
    if (__DEV__) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to load Firebase config:', errMsg);
    }
    return null;
  }
}

/**
 * ELITE: Lazy imports to avoid early initialization
 * Uses async loading to prevent NativeEventEmitter errors
 */
let Notifications: any = null;
let Device: any = null;
let isNotificationsLoading = false;

// ELITE: Promise cache for preventing race conditions
let notificationsLoadPromise: Promise<typeof import('expo-notifications') | null> | null = null;

async function getNotificationsAsync(): Promise<typeof import('expo-notifications') | null> {
  // Return cached module if available
  if (Notifications) return Notifications;

  // If already loading, wait for the same promise (prevents race condition)
  if (notificationsLoadPromise) {
    return notificationsLoadPromise;
  }

  // Create and cache the loading promise
  notificationsLoadPromise = (async () => {
    try {
      // ELITE: Use dynamic import instead of eval (safe, App Store compliant)
      const module = await import('expo-notifications');
      Notifications = module;
      return Notifications;
    } catch (error) {
      if (__DEV__) {
        logger.debug('expo-notifications not available:', error);
      }
      return null;
    } finally {
      notificationsLoadPromise = null;
    }
  })();

  return notificationsLoadPromise;
}

function getNotifications(): any {
  return Notifications;
}

function getDevice() {
  if (!Device) {
    try {
      Device = require('expo-device');
    } catch (error) {
      // ELITE: Log Firebase errors but don't crash the app
      if (__DEV__) {
        logger.debug('Firebase operation failed (non-critical):', error);
      }
    }
  }
  return Device;
}

class FirebaseService {
  private isInitialized = false;
  private pushToken: string | null = null;
  private fcmToken: string | null = null;
  private foregroundMessageUnsubscribe: (() => void) | null = null;

  async initialize() {
    if (this.isInitialized) return;

    if (__DEV__) logger.info('Initializing Firebase Service...');

    try {
      // ELITE: Use async loader to ensure native bridge is ready
      const Notifications = await getNotificationsAsync();
      const Device = getDevice();

      if (!Notifications || !Device) {
        logger.warn('Notifications or Device not available - Firebase disabled');
        return;
      }

      // Request notification permissions
      if (Device.isDevice) {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          if (__DEV__) {
            logger.info('Notification permission not granted yet; Firebase push token registration deferred');
          }
          return;
        }

        // ELITE: Get both Expo push token and FCM token
        try {
          // Get Expo push token (for Expo push notification service)
          const expoToken = await Notifications.getExpoPushTokenAsync({
            projectId: '072f1217-172a-40ce-af23-3fc0ad3f7f09',
          });
          this.pushToken = expoToken.data;
          if (__DEV__) logger.info('Expo push token:', this.pushToken);

          // NOTE: firebase/messaging (web SDK) is NOT used in React Native
          // Push notifications handled entirely by expo-notifications + Expo push token
          // FCM token registration is done via FCMTokenService if needed
          if (__DEV__) {
            logger.debug('FCM web SDK skipped — using Expo push token for notifications');
          }

          // ELITE: Sync token with Firestore (Future-proof)
          try {
            const { tokenSyncManager } = await import('./TokenSyncManager');
            // Don't await - let it run in background
            tokenSyncManager.syncToken().catch(err => {
              if (__DEV__) logger.debug('Background token sync failed:', err);
            });
          } catch (syncError) {
            // Ignore import errors
          }

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
      if (__DEV__) logger.info('✅ FirebaseService initialized successfully');

    } catch (error) {
      logger.error('FirebaseService initialization error:', error);
      // ELITE: Don't throw - app continues without FCM push notifications
    }
  }

  /**
   * NOTE: Foreground message handling is done via expo-notifications
   * firebase/messaging (web SDK) is NOT available in React Native
   */
  private async setupForegroundMessageHandler(): Promise<void> {
    // No-op: firebase/messaging web SDK removed
    // Foreground notifications handled by expo-notifications
  }

  /**
   * ELITE: Handle Firebase Cloud Messaging payload
   */
  private async handleFirebaseMessage(payload: FirebaseMessagePayload): Promise<void> {
    try {
      // ELITE: Validate payload
      if (!payload || typeof payload !== 'object') {
        if (__DEV__) {
          logger.debug('Invalid Firebase message payload received');
        }
        return;
      }

      const data = payload?.data || {};
      const notification = payload?.notification || {};

      // ELITE: Determine notification type and show appropriate notification
      const notificationType = safeLowerCase(data.type || 'general');

      switch (notificationType) {
        case 'earthquake':
        case 'eew': {
          const magnitude = parseFloat(data.magnitude || '0');
          const location = String(data.location || data.region || 'Bilinmeyen konum').trim();

          if (magnitude > 0 && location.length > 0) {
            // CRITICAL FIX: Route through MagnitudeBasedNotificationService directly.
            // Using notificationService.showEarthquakeNotification adds unnecessary
            // indirection (it calls MBN internally anyway) and lacks lat/lng passing.
            const { notificationCenter } = await import('./notifications/NotificationCenter');
            await notificationCenter.notify('earthquake', {
              magnitude,
              location,
              isEEW: notificationType === 'eew',
              timestamp: Date.now(),
              depth: data.depth ? parseFloat(data.depth) : undefined,
              source: data.source || 'FCM',
              latitude: data.latitude ? parseFloat(data.latitude) : undefined,
              longitude: data.longitude ? parseFloat(data.longitude) : undefined,
            }, 'FirebaseService');
          } else {
            if (__DEV__) {
              logger.debug('Invalid earthquake notification data:', { magnitude, location });
            }
          }
          break;
        }

        case 'message': {
          const senderName = String(data.senderName || 'Bilinmeyen').trim();
          const messageContent = String(data.message || notification.body || '').trim();
          const messageId = String(data.messageId || '').trim();
          const userId = String(data.userId || '').trim();

          if (senderName.length > 0 && messageContent.length > 0) {
            const { notificationCenter } = await import('./notifications/NotificationCenter');
            await notificationCenter.notify('message', {
              senderName,
              from: senderName,
              message: messageContent,
              messageId,
              senderId: userId,
              senderUid: String(data.senderUid || userId || '').trim() || undefined,
              userId,
              conversationId: String(data.conversationId || userId || '').trim() || undefined,
              isGroup: data.isGroup === 'true' || data.chatType === 'group' || data.conversationType === 'group',
            }, 'FirebaseService');
          } else {
            if (__DEV__) {
              logger.debug('Invalid message notification data:', { senderName, messageContent });
            }
          }
          break;
        }

        case 'news': {
          const title = String(notification.title || data.title || 'Yeni Haber').trim();
          const summary = String(notification.body || data.summary || '').trim();
          const source = String(data.source || 'Haber').trim();

          if (title.length > 0 && summary.length > 0) {
            const { notificationCenter } = await import('./notifications/NotificationCenter');
            await notificationCenter.notify('news', {
              title,
              summary,
              source,
              url: data.url && typeof data.url === 'string' ? data.url.trim() : undefined,
            }, 'FirebaseService');
          } else {
            if (__DEV__) {
              logger.debug('Invalid news notification data:', { title, summary });
            }
          }
          break;
        }

        case 'sos': {
          const from = String(data.from || data.senderName || 'Bilinmeyen').trim();

          if (from.length > 0) {
            const { notificationCenter } = await import('./notifications/NotificationCenter');
            await notificationCenter.notify('sos_received', {
              from,
              senderName: from,
              senderId: String(data.userId || data.senderId || '').trim() || undefined,
              signalId: String(data.signalId || data.id || '').trim() || undefined,
              timestamp: Date.now(),
              location: data.latitude && data.longitude ? {
                latitude: parseFloat(data.latitude),
                longitude: parseFloat(data.longitude),
              } : undefined,
            }, 'FirebaseService');
          } else {
            if (__DEV__) {
              logger.debug('Invalid SOS notification data:', { from });
            }
          }
          break;
        }

        default: {
          // ELITE: Show generic notification for unknown types via NotificationCenter
          const genericTitle = String(notification.title || 'AfetNet').trim();
          const genericBody = String(notification.body || data.message || '').trim();

          if (genericTitle.length > 0 || genericBody.length > 0) {
            const { notificationCenter } = await import('./notifications/NotificationCenter');
            await notificationCenter.notify('system', {
              subtype: 'generic',
              title: genericTitle || 'AfetNet',
              message: genericBody || '',
            }, 'FirebaseService-generic');
          }
        }
      }
    } catch (error: unknown) {
      const errorObj = error as { message?: string };
      const errorMessage = errorObj?.message || String(error);
      logger.error('Failed to handle Firebase message:', errorMessage);
      // CRITICAL: Don't throw - message handling failure shouldn't break app
    }
  }

  /**
   * ELITE: Register FCM token with backend
   */
  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      // ELITE: Get user's location for backend registration
      // For now, use default province (Türkiye) - can be extended with user preferences
      const provinces: string[] = ['Türkiye'];

      // ELITE: Register with backend worker (FCM token)
      const { registerTokenWithWorker } = await import('../../push/fcm');
      const success = await registerTokenWithWorker(token, provinces);

      if (success) {
        if (__DEV__) {
          logger.info('✅ FCM token registered with backend');
        }
      } else {
        if (__DEV__) {
          logger.debug('FCM token registration with backend failed (non-critical)');
        }
      }

      // ELITE: Also register with BackendPushService (for additional backend features)
      try {
        const { backendPushService } = await import('./BackendPushService');
        await backendPushService.initialize(token);
      } catch (backendError) {
        // BackendPushService is optional
        if (__DEV__) {
          logger.debug('BackendPushService registration skipped:', backendError);
        }
      }
    } catch (error) {
      // ELITE: Backend registration is optional - app continues without it
      if (__DEV__) {
        logger.debug('Backend token registration skipped:', error);
      }
    }
  }

  /**
   * NOTE: FCM token refresh via web SDK removed
   * Token management handled by FCMTokenService + expo-notifications
   */
  async refreshFCMToken(): Promise<string | null> {
    // firebase/messaging web SDK not available in React Native
    // FCM token is managed by FCMTokenService 
    return this.fcmToken;
  }

  getPushToken(): string | null {
    return this.pushToken;
  }

  getFCMToken(): string | null {
    return this.fcmToken;
  }

  async sendTestNotification() {
    try {
      const { notificationCenter } = await import('./notifications/NotificationCenter');
      await notificationCenter.notify('system', {
        subtype: 'generic',
        title: 'AfetNet Test',
        message: 'Bildirimler çalışıyor!',
      }, 'FirebaseService-test');
    } catch (error) {
      logger.error('Test notification error:', error);
    }
  }

  /**
   * ELITE: Cleanup on shutdown
   */
  cleanup(): void {
    if (this.foregroundMessageUnsubscribe) {
      try {
        this.foregroundMessageUnsubscribe();
      } catch (error) {
        // Silent fail - cleanup errors shouldn't break shutdown
        if (__DEV__) {
          logger.debug('Error during foreground message unsubscribe:', error);
        }
      }
      this.foregroundMessageUnsubscribe = null;
    }
  }
}

export const firebaseService = new FirebaseService();
