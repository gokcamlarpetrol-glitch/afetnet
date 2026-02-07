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

          // ELITE: Try to get FCM token (for Firebase Cloud Messaging)
          // Note: FCM token may not be available in all environments (e.g., Expo Go, web)
          // This is optional - Expo push token is primary
          try {
            const { getFCMToken } = await import('../../lib/firebase');

            // ELITE: Wait a bit for Firebase to fully initialize
            await new Promise(resolve => setTimeout(resolve, 1000));

            const fcmToken = await getFCMToken();
            if (fcmToken && typeof fcmToken === 'string' && fcmToken.length > 10) {
              this.fcmToken = fcmToken;
              if (__DEV__) {
                logger.info('FCM token obtained:', fcmToken.substring(0, 20) + '...');
              }

              // ELITE: Register FCM token with backend (fire and forget)
              this.registerTokenWithBackend(fcmToken).catch((backendError) => {
                // Backend registration is optional - don't block initialization
                if (__DEV__) {
                  logger.debug('Backend token registration failed (non-critical):', backendError);
                }
              });
            } else {
              if (__DEV__) {
                logger.debug('FCM token not available (using Expo push token only)');
              }
            }
          } catch (fcmError: unknown) {
            // FCM token is optional - Expo push token is primary
            const errorMessage = fcmError instanceof Error ? fcmError.message : String(fcmError);
            if (__DEV__) {
              logger.debug('FCM token not available (using Expo push token):', errorMessage);
            }
            // Don't throw - continue with Expo push token
          }

          // ELITE: Set up foreground message handler for Firebase
          await this.setupForegroundMessageHandler();

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
   * ELITE: Set up foreground message handler for Firebase Cloud Messaging
   */
  private async setupForegroundMessageHandler(): Promise<void> {
    try {
      const { onForegroundMessage } = await import('../../lib/firebase');

      // ELITE: Handle foreground messages from Firebase
      this.foregroundMessageUnsubscribe = await onForegroundMessage(async (payload: FirebaseMessagePayload) => {
        try {
          if (__DEV__) {
            logger.info('📨 Firebase foreground message received:', payload);
          }

          // ELITE: Process Firebase message and show notification
          await this.handleFirebaseMessage(payload);
        } catch (error) {
          logger.error('Failed to handle Firebase foreground message:', error);
        }
      });

      if (__DEV__) {
        logger.info('✅ Firebase foreground message handler registered');
      }
    } catch (error) {
      // ELITE: Foreground message handler is optional
      if (__DEV__) {
        logger.debug('Firebase foreground message handler not available:', error);
      }
    }
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

      // ELITE: Get notification service dynamically
      const { notificationService } = await import('./NotificationService');

      // ELITE: Determine notification type and show appropriate notification
      const notificationType = safeLowerCase(data.type || 'general');

      switch (notificationType) {
      case 'earthquake':
      case 'eew': {
        const magnitude = parseFloat(data.magnitude || '0');
        const location = String(data.location || data.region || 'Bilinmeyen konum').trim();

        if (magnitude > 0 && location.length > 0) {
          await notificationService.showEarthquakeNotification(magnitude, location);
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
        const priority = (data.priority === 'critical' || data.priority === 'high') ? data.priority : 'normal';

        if (senderName.length > 0 && messageContent.length > 0) {
          await notificationService.showMessageNotification(
            senderName,
            messageContent,
            messageId,
            userId,
            priority,
          );
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
          await notificationService.showNewsNotification({
            title,
            summary,
            source,
            url: data.url && typeof data.url === 'string' ? data.url.trim() : undefined,
            articleId: data.articleId && typeof data.articleId === 'string' ? data.articleId.trim() : undefined,
          });
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
          await notificationService.showSOSNotification(from);
        } else {
          if (__DEV__) {
            logger.debug('Invalid SOS notification data:', { from });
          }
        }
        break;
      }

      default: {
        // ELITE: Show generic notification for unknown types
        const Notifications = await getNotificationsAsync();
        if (Notifications) {
          const genericTitle = String(notification.title || 'AfetNet').trim();
          const genericBody = String(notification.body || data.message || '').trim();

          if (genericTitle.length > 0 || genericBody.length > 0) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: genericTitle || 'AfetNet',
                body: genericBody || '',
                sound: 'default',
                data: data,
              },
              trigger: null,
            });
          }
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
   * ELITE: Refresh FCM token (called when token changes)
   * This should be called periodically or when token refresh is detected
   */
  async refreshFCMToken(): Promise<string | null> {
    try {
      const { getFCMToken } = await import('../../lib/firebase');
      const newToken = await getFCMToken();

      if (newToken && typeof newToken === 'string' && newToken.length > 10) {
        if (newToken !== this.fcmToken) {
          const oldToken = this.fcmToken;
          this.fcmToken = newToken;

          // ELITE: Re-register with backend if token changed
          if (oldToken) {
            // Fire and forget - don't block token refresh
            this.registerTokenWithBackend(newToken).catch((backendError) => {
              if (__DEV__) {
                logger.debug('Backend token re-registration failed (non-critical):', backendError);
              }
            });
          } else {
            // First time getting token - register with backend
            this.registerTokenWithBackend(newToken).catch((backendError) => {
              if (__DEV__) {
                logger.debug('Backend token registration failed (non-critical):', backendError);
              }
            });
          }

          if (__DEV__) {
            logger.info('✅ FCM token refreshed');
          }
        }
      } else {
        // Token is null or invalid - this is expected in some environments
        if (__DEV__) {
          logger.debug('FCM token refresh returned null (expected in some environments)');
        }
      }

      return this.fcmToken;
    } catch (error: unknown) {
      const errorObj = error as { message?: string };
      const errorMessage = errorObj?.message || String(error);

      // ELITE: Some errors are expected and shouldn't be logged as errors
      if (errorMessage.includes('messaging/unsupported-browser') ||
        errorMessage.includes('messaging/registration-token-not-found')) {
        if (__DEV__) {
          logger.debug('FCM token refresh not available (expected in some environments)');
        }
      } else {
        logger.error('Failed to refresh FCM token:', errorMessage);
      }

      return this.fcmToken;
    }
  }

  getPushToken(): string | null {
    return this.pushToken;
  }

  getFCMToken(): string | null {
    return this.fcmToken;
  }

  async sendTestNotification() {
    try {
      const Notifications = await getNotificationsAsync();
      if (!Notifications) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'AfetNet Test',
          body: 'Bildirimler çalışıyor!',
        },
        trigger: null,
      });
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
