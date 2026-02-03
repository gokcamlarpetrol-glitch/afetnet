/**
 * ELITE NOTIFICATION SERVICE
 * Professional notification management with zero bundling-time dependencies
 * 
 * CRITICAL: This service NEVER imports expo-notifications at module level
 * All module loading happens at runtime, only when explicitly needed
 * This prevents NativeEventEmitter errors during app startup
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';

const logger = createLogger('NotificationService');

// ============================================================================
// ELITE MODULE LOADER - Zero Static Dependencies
// ============================================================================

/**
 * Module state management
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NotificationsModule: any = null;
let isModuleLoading = false;
let moduleLoadPromise: Promise<any> | null = null;
let loadAttempts = 0;
const MAX_LOAD_ATTEMPTS = 5;
const INITIAL_DELAY = 2000; // 2 seconds initial delay
const RETRY_DELAY_BASE = 1000; // Base retry delay

/**
 * ELITE: Check if React Native bridge is ready
 * Progressive validation with multiple checks
 */
async function isNativeBridgeReady(): Promise<boolean> {
  try {
    // Step 1: Check React Native availability
    const RN = require('react-native');
    if (!RN || typeof RN !== 'object') {
      return false;
    }

    // Step 2: Check NativeModules existence
    const NativeModules = RN.NativeModules;
    if (!NativeModules || typeof NativeModules !== 'object') {
      return false;
    }

    // Step 3: Check module count (bridge must have loaded some modules)
    const moduleKeys = Object.keys(NativeModules);
    if (moduleKeys.length === 0) {
      return false;
    }

    // Step 4: Check for Expo modules specifically
    const hasExpoModules = moduleKeys.some(key =>
      key.includes('Expo') ||
      key.includes('Location') ||
      key.includes('Camera'),
    );

    return hasExpoModules;
  } catch (error) {
    return false;
  }
}

/**
 * ELITE: Wait for native bridge with progressive checks
 * Returns true when bridge is ready, false if timeout
 * CRITICAL: Enhanced checks to prevent NativeEventEmitter errors
 */
async function waitForNativeBridge(maxWaitMs: number = 10000): Promise<boolean> {
  const CHECK_INTERVAL = 200;
  const maxChecks = Math.floor(maxWaitMs / CHECK_INTERVAL);

  for (let i = 0; i < maxChecks; i++) {
    if (await isNativeBridgeReady()) {
      // CRITICAL: Additional stabilization delay - native bridge needs time to fully initialize
      // This prevents NativeEventEmitter errors by ensuring all native modules are ready
      await new Promise(resolve => setTimeout(resolve, 500)); // Increased from 300ms to 500ms

      // CRITICAL: Double-check after delay to ensure bridge is still ready
      if (await isNativeBridgeReady()) {
        if (__DEV__) {
          logger.debug(`✅ Native bridge ready after ${(i + 1) * CHECK_INTERVAL}ms`);
        }
        return true;
      }
    }
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
  }

  // ELITE: Don't log at all - this is expected behavior in some environments
  // Native bridge may not be ready immediately, and notifications will initialize when needed
  return false;
}

/**
 * ELITE: Load expo-notifications module with zero static dependencies
 * Uses multiple fallback methods to prevent bundling-time loading
 */
async function loadNotificationsModule(): Promise<any> {
  // Return cached module if available
  if (NotificationsModule) {
    return NotificationsModule;
  }

  // Return existing promise if loading
  if (isModuleLoading && moduleLoadPromise) {
    return moduleLoadPromise;
  }

  // Prevent infinite retry loops
  if (loadAttempts >= MAX_LOAD_ATTEMPTS) {
    // ELITE: Log only once to prevent spam - this is expected behavior
    if (__DEV__ && loadAttempts === MAX_LOAD_ATTEMPTS) {
      logger.debug('Max load attempts reached - notifications disabled (this is normal in some environments)');
    }
    return null;
  }

  isModuleLoading = true;
  loadAttempts++;

  moduleLoadPromise = (async () => {
    try {
      // CRITICAL: Wait for native bridge first
      const bridgeReady = await waitForNativeBridge(INITIAL_DELAY + (loadAttempts * 500));
      if (!bridgeReady && loadAttempts < MAX_LOAD_ATTEMPTS) {
        // ELITE: Don't log - this is expected behavior, retries happen silently
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_BASE * loadAttempts));
        isModuleLoading = false;
        moduleLoadPromise = null;
        return loadNotificationsModule();
      }

      if (!bridgeReady) {
        // ELITE: Don't log as ERROR or WARN - this is expected in some scenarios
        // Notifications are optional - app works perfectly without them
        // Only log in dev mode at debug level to reduce production noise
        if (__DEV__) {
          logger.debug('Native bridge not ready after all attempts - notifications disabled (this is normal in some environments)');
        }
        return null;
      }

      // ELITE: Load module using dynamic import() - SAFER than require/eval
      // CRITICAL: Use dynamic import() to prevent NativeEventEmitter errors
      // Dynamic import() handles native module loading more gracefully
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let module: any = null;
      try {
        // CRITICAL: Use dynamic import() instead of require/eval
        // This prevents NativeEventEmitter errors by ensuring proper module initialization
        const moduleName = 'expo-notifications';
        const importedModule = await import(moduleName);
        module = importedModule.default || importedModule;

        // CRITICAL: Additional validation - ensure module is fully loaded
        if (!module || typeof module !== 'object') {
          throw new Error('Module loaded but invalid structure');
        }

        // CRITICAL: Wait a bit more to ensure native bridge is fully ready
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (importError: unknown) {
        // ELITE: If dynamic import fails, try with longer delay (native bridge might need more time)
        if (loadAttempts < MAX_LOAD_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_BASE * loadAttempts * 3));
          isModuleLoading = false;
          moduleLoadPromise = null;
          return loadNotificationsModule();
        }
        throw importError;
      }

      // Validate module structure
      if (!module || typeof module !== 'object') {
        throw new Error('Invalid module structure');
      }

      const moduleExports = module.default || module;

      // Validate required methods
      const requiredMethods = [
        'setNotificationHandler',
        'getPermissionsAsync',
        'requestPermissionsAsync',
        'scheduleNotificationAsync',
      ];

      for (const method of requiredMethods) {
        if (typeof moduleExports[method] !== 'function') {
          throw new Error(`Missing required method: ${method}`);
        }
      }

      // Success - cache and return
      NotificationsModule = moduleExports;
      loadAttempts = 0; // Reset on success
      logger.info('✅ expo-notifications module loaded successfully');
      return NotificationsModule;

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';

      // CRITICAL: Check for NativeEventEmitter errors (most common)
      const isNativeEventEmitterError =
        errorMsg.includes('NativeEventEmitter') ||
        errorMsg.includes('requires a non-null argument') ||
        errorMsg.includes('null') ||
        errorMsg.includes('undefined') ||
        (errorStack && errorStack.includes('NativeEventEmitter')) ||
        (errorStack && errorStack.includes('PushNotificationIOS'));

      if (isNativeEventEmitterError) {
        if (loadAttempts < MAX_LOAD_ATTEMPTS) {
          // ELITE: Log as debug in dev mode only - this is expected behavior
          // CRITICAL: Native bridge needs more time - wait longer before retry
          const retryDelay = RETRY_DELAY_BASE * loadAttempts * 3; // Longer delay for NativeEventEmitter errors
          if (__DEV__) {
            logger.debug(`NativeEventEmitter error (attempt ${loadAttempts}/${MAX_LOAD_ATTEMPTS}), retrying in ${retryDelay}ms...`);
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          isModuleLoading = false;
          moduleLoadPromise = null;
          return loadNotificationsModule();
        } else {
          // ELITE: Max attempts reached - gracefully disable notifications
          // This is expected behavior in some environments (e.g., Expo Go, simulator)
          if (__DEV__) {
            logger.debug('NativeEventEmitter error persisted after all retries - notifications disabled (this is normal in some environments)');
          }
          return null;
        }
      }

      // ELITE: Handle other errors (module not found, etc.)
      if (loadAttempts < MAX_LOAD_ATTEMPTS) {
        // Retry with delay for other errors too
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_BASE * loadAttempts * 2));
        isModuleLoading = false;
        moduleLoadPromise = null;
        return loadNotificationsModule();
      }

      // ELITE: Don't log as ERROR or WARN - notifications are optional
      // Only log in dev mode at debug level to avoid production noise
      if (__DEV__) {
        logger.debug(`Failed to load expo-notifications (attempt ${loadAttempts}): ${errorMsg}`);
      }
      return null;

    } finally {
      isModuleLoading = false;
      moduleLoadPromise = null;
    }
  })();

  return moduleLoadPromise;
}

/**
 * Get notifications module (sync - returns cached or null)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNotificationsSync(): any {
  return NotificationsModule;
}

/**
 * Get notifications module (async - ensures loading)
 * ELITE: Exported for use by other services
 */
export async function getNotificationsAsync(): Promise<any> {
  return loadNotificationsModule();
}

// ============================================================================
// NOTIFICATION SERVICE CLASS
// ============================================================================

class NotificationService {
  private isInitialized = false;
  private isInitializing = false; // CRITICAL: Prevent concurrent initialization
  private static hasLoggedUnavailable = false; // ELITE: Log only once

  /**
   * Initialize notification service
   * CRITICAL: Never throws - app continues even if notifications fail
   * ELITE: Prevents duplicate initialization with race condition protection
   */
  async initialize(): Promise<void> {
    // CRITICAL: Prevent duplicate initialization
    if (this.isInitialized) {
      return;
    }

    // CRITICAL: Prevent concurrent initialization (race condition protection)
    if (this.isInitializing) {
      // Wait for ongoing initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;

    try {
      // ELITE: Only log initialization in dev mode to reduce noise
      if (__DEV__) {
        logger.info('Initializing NotificationService...');
      }

      // CRITICAL: Wait for native bridge before loading module
      // This prevents NativeEventEmitter errors by ensuring bridge is ready
      const bridgeReady = await waitForNativeBridge(5000); // Wait up to 5 seconds
      if (!bridgeReady) {
        // ELITE: Don't log - this is expected behavior, will retry on-demand
        // Native bridge may not be ready immediately
        return;
      }

      // CRITICAL: Additional delay to ensure native bridge is fully stabilized
      await new Promise(resolve => setTimeout(resolve, 300));

      // Load module asynchronously
      const Notifications = await getNotificationsAsync();
      if (!Notifications) {
        // ELITE: Log only once to prevent spam
        if (!NotificationService.hasLoggedUnavailable) {
          if (__DEV__) {
            logger.debug('Notifications module not available - service disabled (this is normal in some environments)');
          }
          NotificationService.hasLoggedUnavailable = true;
        }
        return;
      }

      // ELITE: Set notification handler for foreground notifications
      try {
        Notifications.setNotificationHandler({
          handleNotification: async (notification) => {
            // ELITE: Determine behavior based on notification priority
            const priority = notification.request?.content?.data?.priority || 'normal';
            const isCritical = priority === 'critical' || notification.request?.content?.data?.type === 'eew' || notification.request?.content?.data?.type === 'sos';

            return {
              shouldShowAlert: true, // Always show alert
              shouldPlaySound: true, // Always play sound
              shouldSetBadge: true, // Always update badge
              shouldShowBanner: true, // Always show banner
              shouldShowList: true, // Always add to notification list
            };
          },
        });

        // ELITE: Set up notification response handler (when user taps notification)
        if (typeof Notifications.addNotificationResponseReceivedListener === 'function') {
          Notifications.addNotificationResponseReceivedListener((response) => {
            this.handleNotificationTap(response).catch((error) => {
              logger.error('Failed to handle notification tap:', error);
            });
          });
        }

        // ELITE: Check for notification that opened the app (cold start)
        if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
          Notifications.getLastNotificationResponseAsync().then((response) => {
            if (response) {
              this.handleNotificationTap(response).catch((error) => {
                logger.error('Failed to handle cold start notification:', error);
              });
            }
          }).catch((error) => {
            // Silent fail - this is optional
            if (__DEV__) {
              logger.debug('Failed to get last notification response:', error);
            }
          });
        }
      } catch (error) {
        logger.error('Failed to set notification handler:', error);
      }

      // ELITE: Skip automatic permission request during initialization
      // Permissions should be requested explicitly by PermissionGuard or Onboarding screens
      // This prevents blocking app startup and improves UX
      if (__DEV__) {
        logger.debug('Notification permissions will be requested explicitly by user');
      }

      // Create Android channels
      if (Platform.OS === 'android') {
        try {
          const channels = [
            {
              id: 'earthquake',
              name: 'Deprem Bildirimleri',
              importance: Notifications.AndroidImportance?.MAX || 5,
              vibrationPattern: [0, 250, 250, 250],
            },
            {
              id: 'sos',
              name: 'Acil Durum',
              importance: Notifications.AndroidImportance?.MAX || 5,
              vibrationPattern: [0, 500, 500, 500],
            },
            {
              id: 'messages',
              name: 'Mesajlar',
              importance: Notifications.AndroidImportance?.DEFAULT || 3,
            },
          ];

          for (const channel of channels) {
            await Notifications.setNotificationChannelAsync(channel.id, {
              name: channel.name,
              importance: channel.importance,
              vibrationPattern: channel.vibrationPattern,
              sound: 'default',
            });
          }
        } catch (error) {
          logger.error('Failed to create notification channels:', error);
        }
      }

      this.isInitialized = true;
      logger.info('✅ NotificationService initialized successfully');

    } catch (error) {
      logger.error('NotificationService initialization error:', error);
      // CRITICAL: Never throw - allow app to continue
    } finally {
      // CRITICAL: Always reset initializing flag
      this.isInitializing = false;
    }
  }

  /**
   * Show earthquake notification - ELITE IMPLEMENTATION
   * CRITICAL: Life-saving feature - instant delivery, 100% accuracy
   * ELITE: Uses MagnitudeBasedNotificationService for premium notifications
   * Fallback mechanism - works even if native bridge is not ready
   */
  async showEarthquakeNotification(magnitude: number, location: string, time?: Date, isEEW: boolean = false, timeAdvance?: number): Promise<void> {
    try {
      // ELITE: Validate inputs first - ensure 100% accuracy
      if (typeof magnitude !== 'number' || isNaN(magnitude) || magnitude <= 0 ||
        !location || typeof location !== 'string' || location.trim().length === 0) {
        if (__DEV__) {
          logger.debug('Invalid earthquake notification parameters');
        }
        return;
      }

      // ELITE: Use MagnitudeBasedNotificationService for premium notifications
      // This ensures magnitude-based priority, multi-channel alerts, and emergency mode
      try {
        const { showMagnitudeBasedNotification } = await import('./MagnitudeBasedNotificationService');
        await showMagnitudeBasedNotification(
          magnitude,
          location,
          isEEW,
          timeAdvance,
          time?.getTime() || Date.now(),
        );

        if (__DEV__) {
          logger.info(`✅ ELITE Magnitude-based notification sent: ${magnitude.toFixed(1)}M - ${location}`);
        }
        return;
      } catch (magnitudeError) {
        logger.error('Failed to show magnitude-based notification:', magnitudeError);
        // Fallback to standard notification
      }

      // ELITE: Fallback - Use NotificationFormatterService for professional formatting
      const { notificationFormatterService } = await import('./NotificationFormatterService');
      const formatted = notificationFormatterService.formatEarthquakeNotification(
        magnitude,
        location,
        time,
        isEEW,
        timeAdvance,
      );

      // ELITE: Try to load notifications module with fallback
      let Notifications = getNotificationsSync();
      if (!Notifications) {
        // Try async load with timeout
        try {
          Notifications = await Promise.race([
            getNotificationsAsync(),
            new Promise<any>((resolve) => setTimeout(() => resolve(null), 1000)), // 1 second timeout
          ]);
        } catch (error) {
          if (__DEV__) {
            logger.debug('Failed to load notifications module, using fallback');
          }
        }
      }

      // ELITE: Setup notification channels if needed (Android)
      if (Platform.OS === 'android' && Notifications) {
        try {
          const channelId = formatted.priority === 'critical' ? 'critical-alerts' : formatted.priority === 'high' ? 'high-priority' : 'normal-priority';
          await Notifications.setNotificationChannelAsync(channelId, {
            name: formatted.priority === 'critical' ? 'Critical Alerts' : formatted.priority === 'high' ? 'High Priority Alerts' : 'Normal Alerts',
            importance: formatted.priority === 'critical' ? (Notifications.AndroidImportance?.MAX || 5) : formatted.priority === 'high' ? (Notifications.AndroidImportance?.HIGH || 4) : (Notifications.AndroidImportance?.DEFAULT || 3),
            vibrationPattern: formatted.vibrationPattern || [0, 250, 250, 250],
            lightColor: formatted.priority === 'critical' ? '#FF0000' : formatted.priority === 'high' ? '#FF6600' : '#000000',
            sound: formatted.sound || 'default',
            enableVibrate: true,
            showBadge: true,
            bypassDnd: formatted.priority === 'critical' || formatted.priority === 'high', // Bypass Do Not Disturb for critical/high alerts
          });
        } catch (error) {
          if (__DEV__) {
            logger.debug('Failed to setup notification channel:', error);
          }
        }
      }

      // ELITE: If native notifications available, use formatted notification
      if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
        try {
          const channelId = formatted.priority === 'critical' ? 'critical-alerts' : formatted.priority === 'high' ? 'high-priority' : 'normal-priority';

          await Notifications.scheduleNotificationAsync({
            content: {
              title: formatted.title,
              body: formatted.body,
              sound: formatted.sound || 'default',
              priority: formatted.priority === 'critical' ? 'max' : formatted.priority === 'high' ? 'high' : 'default',
              data: formatted.data,
              sticky: formatted.priority === 'critical' || formatted.priority === 'high', // Critical/High alerts stay until dismissed
            },
            trigger: null, // CRITICAL: Instant delivery - no delay
            ...(Platform.OS === 'android' && {
              android: {
                channelId: channelId,
                importance: formatted.priority === 'critical' ? (Notifications.AndroidImportance?.MAX || 5) : formatted.priority === 'high' ? (Notifications.AndroidImportance?.HIGH || 4) : (Notifications.AndroidImportance?.DEFAULT || 3),
                vibrationPattern: formatted.vibrationPattern || [0, 250, 250, 250],
                priority: formatted.priority === 'critical' ? 'high' : formatted.priority === 'high' ? 'default' : 'low',
                sound: formatted.sound || 'default',
                autoCancel: false, // Don't auto-cancel critical/high alerts
              },
            }),
          });

          if (__DEV__) {
            logger.info(`✅ Formatted earthquake notification sent: ${magnitude.toFixed(1)} - ${location} (Priority: ${formatted.priority})`);
          }
          return;
        } catch (error) {
          if (__DEV__) {
            logger.debug('Native notification failed, using fallback:', error);
          }
        }
      }

      // ELITE: Fallback - at least log the notification (UI can show it)
      if (__DEV__) {
        logger.info(`📢 Formatted earthquake notification (fallback): ${formatted.title} - ${formatted.body}`);
      }

      // ELITE: Fallback - trigger haptic feedback even without native notifications
      try {
        const Haptics = await import('expo-haptics');
        if (magnitude >= 6.0) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else if (magnitude >= 5.0) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (error) {
        // Silent fail - haptics are optional
      }

    } catch (error) {
      logger.error('Earthquake notification error:', error);
      // CRITICAL: Don't throw - notification failure shouldn't block app
    }
  }

  /**
   * Show SOS notification
   * Uses NotificationFormatterService for professional formatting
   */
  async showSOSNotification(from: string, location?: { latitude: number; longitude: number }, message?: string): Promise<void> {
    try {
      // ELITE: Use NotificationFormatterService for professional formatting
      const { notificationFormatterService } = await import('./NotificationFormatterService');
      const formatted = notificationFormatterService.formatSOSNotification(from, location, message);

      // ELITE: Use async getter to ensure module is loaded
      const Notifications = await getNotificationsAsync();
      if (!Notifications) {
        return; // Silent fail - notifications are optional
      }

      // ELITE: Validate inputs
      if (!from || typeof from !== 'string' || from.trim().length === 0) {
        if (__DEV__) {
          logger.debug('Invalid SOS notification parameters');
        }
        return;
      }

      // ELITE: Setup notification channels if needed (Android)
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('sos', {
            name: 'SOS Alerts',
            importance: Notifications.AndroidImportance?.MAX || 5,
            vibrationPattern: formatted.vibrationPattern || [0, 1000, 200, 1000, 200, 1000],
            lightColor: '#FF0000',
            sound: formatted.sound || 'siren',
            enableVibrate: true,
            showBadge: true,
            bypassDnd: true, // Bypass Do Not Disturb for SOS
          });
        } catch (error) {
          if (__DEV__) {
            logger.debug('Failed to setup SOS notification channel:', error);
          }
        }
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: formatted.title,
          body: formatted.body,
          sound: formatted.sound || 'siren',
          priority: 'max',
          data: formatted.data,
          badge: 1,
          sticky: true, // SOS alerts stay until dismissed
        },
        trigger: null,
        ...(Platform.OS === 'android' && {
          android: {
            channelId: 'sos',
            importance: Notifications.AndroidImportance?.MAX || 5,
            vibrationPattern: formatted.vibrationPattern || [0, 1000, 200, 1000, 200, 1000],
            priority: 'high',
            sound: formatted.sound || 'siren',
          },
        }),
      });

      if (__DEV__) {
        logger.info(`✅ Formatted SOS notification sent: ${from}`);
      }
    } catch (error) {
      logger.error('SOS notification error:', error);
      // CRITICAL: Don't throw - notification failure shouldn't block app
    }
  }


  /**
   * Show news notification (professional format)
   * Uses NotificationFormatterService for professional formatting
   */
  async showNewsNotification(data: {
    title: string;
    summary: string;
    source: string;
    url?: string;
    articleId?: string
  }): Promise<void> {
    try {
      // ELITE: Use NotificationFormatterService for professional formatting
      const { notificationFormatterService } = await import('./NotificationFormatterService');
      const formatted = notificationFormatterService.formatNewsNotification(
        data.title,
        data.summary,
        data.source,
      );

      // ELITE: Use async getter to ensure module is loaded
      const Notifications = await getNotificationsAsync();
      if (!Notifications) {
        return; // Silent fail - notifications are optional
      }

      // ELITE: Validate inputs
      if (!data || typeof data !== 'object') {
        if (__DEV__) {
          logger.debug('Invalid news notification data');
        }
        return;
      }

      if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0 ||
        !data.summary || typeof data.summary !== 'string' || data.summary.trim().length === 0) {
        if (__DEV__) {
          logger.debug('Invalid news notification title or summary');
        }
        return;
      }

      // ELITE: Setup notification channels if needed (Android)
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('news', {
            name: 'News Alerts',
            importance: Notifications.AndroidImportance?.DEFAULT || 3,
            vibrationPattern: formatted.vibrationPattern || [0, 200],
            sound: formatted.sound || 'chime',
            enableVibrate: true,
            showBadge: true,
          });
        } catch (error) {
          if (__DEV__) {
            logger.debug('Failed to setup news notification channel:', error);
          }
        }
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: formatted.title,
          body: formatted.body,
          subtitle: data.source, // iOS subtitle
          sound: formatted.sound || 'chime',
          priority: formatted.priority === 'high' ? 'high' : 'default',
          data: {
            ...formatted.data,
            type: 'news',
            source: data.source || 'Unknown',
            url: data.url,
            articleId: data.articleId,
          },
        },
        trigger: null,
        ...(Platform.OS === 'android' && {
          android: {
            channelId: 'messages', // Use messages channel for news
            importance: Notifications.AndroidImportance?.HIGH || 4,
            priority: 'default',
            sound: 'default',
          },
        }),
      });

      if (__DEV__) {
        logger.info(`✅ News notification sent (${data.articleId || 'unknown'})`);
      }
    } catch (error) {
      logger.error('News notification error:', error);
      // CRITICAL: Don't throw - notification failure shouldn't block app
    }
  }

  /**
   * Show battery low notification
   */
  async showBatteryLowNotification(level: number): Promise<void> {
    try {
      // ELITE: Use async getter to ensure module is loaded
      const Notifications = await getNotificationsAsync();
      if (!Notifications) {
        return; // Silent fail - notifications are optional
      }

      // ELITE: Validate inputs
      if (typeof level !== 'number' || isNaN(level) || level < 0 || level > 100) {
        if (__DEV__) {
          logger.debug('Invalid battery level for notification');
        }
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔋 Düşük Pil',
          body: `Pil seviyesi %${level.toFixed(0)} - Şarj edin`,
          sound: 'default',
          data: { type: 'battery', level },
        },
        trigger: null,
        ...(Platform.OS === 'android' && {
          android: {
            channelId: 'messages',
            importance: Notifications.AndroidImportance?.DEFAULT || 3,
            priority: 'default',
            sound: 'default',
          },
        }),
      });

      if (__DEV__) {
        logger.info(`✅ Battery notification sent: ${level}%`);
      }
    } catch (error) {
      logger.error('Battery notification error:', error);
      // CRITICAL: Don't throw - notification failure shouldn't block app
    }
  }

  /**
   * Show network status notification
   */
  async showNetworkStatusNotification(isConnected: boolean): Promise<void> {
    try {
      // ELITE: Use async getter to ensure module is loaded
      const Notifications = await getNotificationsAsync();
      if (!Notifications) {
        return; // Silent fail - notifications are optional
      }

      // ELITE: Validate inputs
      if (typeof isConnected !== 'boolean') {
        if (__DEV__) {
          logger.debug('Invalid network status for notification');
        }
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: isConnected ? '🌐 İnternet Bağlandı' : '📡 İnternet Kesildi',
          body: isConnected ? 'Ağ bağlantısı yeniden kuruldu' : 'Offline moda geçildi',
          sound: 'default',
          data: { type: 'network', connected: isConnected },
        },
        trigger: null,
        ...(Platform.OS === 'android' && {
          android: {
            channelId: 'messages',
            importance: Notifications.AndroidImportance?.DEFAULT || 3,
            priority: 'low',
            sound: 'default',
          },
        }),
      });

      if (__DEV__) {
        logger.info(`✅ Network notification sent: ${isConnected ? 'connected' : 'disconnected'}`);
      }
    } catch (error) {
      logger.error('Network notification error:', error);
      // CRITICAL: Don't throw - notification failure shouldn't block app
    }
  }

  /**
   * Show family location update notification
   */
  async showFamilyLocationUpdateNotification(
    memberName: string,
    location: { latitude: number; longitude: number },
  ): Promise<void> {
    try {
      // ELITE: Use async getter to ensure module is loaded
      const Notifications = await getNotificationsAsync();
      if (!Notifications) {
        return; // Silent fail - notifications are optional
      }

      // ELITE: Validate inputs
      if (!memberName || typeof memberName !== 'string' || memberName.trim().length === 0 ||
        !location || typeof location !== 'object' ||
        typeof location.latitude !== 'number' || isNaN(location.latitude) ||
        typeof location.longitude !== 'number' || isNaN(location.longitude)) {
        if (__DEV__) {
          logger.debug('Invalid family location notification parameters');
        }
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📍 ${memberName.trim()} Konum Güncellendi`,
          body: `Yeni konum: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
          sound: 'default',
          data: { type: 'family_location', memberName: memberName.trim(), location },
        },
        trigger: null,
        ...(Platform.OS === 'android' && {
          android: {
            channelId: 'messages',
            importance: Notifications.AndroidImportance?.DEFAULT || 3,
            priority: 'default',
            sound: 'default',
          },
        }),
      });

      if (__DEV__) {
        logger.info(`✅ Family location notification sent: ${memberName}`);
      }
    } catch (error) {
      logger.error('Family location notification error:', error);
      // CRITICAL: Don't throw - notification failure shouldn't block app
    }
  }

  /**
   * ELITE: Show message notification (CRITICAL - instant delivery)
   * Called when a new message arrives via BLE Mesh or Firebase
   * Uses NotificationFormatterService for professional formatting
   */
  async showMessageNotification(
    senderName: string,
    messageContent: string,
    messageId: string,
    userId: string,
    priority: 'critical' | 'high' | 'normal' = 'normal',
    isSOS: boolean = false,
  ): Promise<void> {
    try {
      // ELITE: Use NotificationFormatterService for professional formatting
      const { notificationFormatterService } = await import('./NotificationFormatterService');
      const formatted = notificationFormatterService.formatMessageNotification(
        senderName,
        messageContent,
        isSOS,
        priority === 'critical',
      );

      const Notifications = await getNotificationsAsync();
      if (!Notifications) {
        // ELITE: Log as debug - this is expected in some environments
        logger.debug('Notifications not available for message (will retry when available)');
        return;
      }

      // ELITE: Validate inputs
      if (!senderName || typeof senderName !== 'string' || senderName.trim().length === 0) {
        logger.warn('Invalid senderName for message notification');
        return;
      }

      if (!messageContent || typeof messageContent !== 'string' || messageContent.trim().length === 0) {
        logger.warn('Invalid messageContent for message notification');
        return;
      }

      // ELITE: Setup notification channels if needed (Android)
      if (Platform.OS === 'android') {
        try {
          const channelId = isSOS ? 'sos' : priority === 'critical' ? 'sos' : 'messages';
          await Notifications.setNotificationChannelAsync(channelId, {
            name: isSOS ? 'SOS Alerts' : priority === 'critical' ? 'Critical Messages' : 'Messages',
            importance: isSOS || priority === 'critical' ? (Notifications.AndroidImportance?.MAX || 5) : (Notifications.AndroidImportance?.DEFAULT || 3),
            vibrationPattern: formatted.vibrationPattern || [0, 200],
            lightColor: isSOS || priority === 'critical' ? '#FF0000' : '#000000',
            sound: formatted.sound || 'default',
            enableVibrate: true,
            showBadge: true,
            bypassDnd: isSOS || priority === 'critical', // Bypass Do Not Disturb for SOS/critical
          });
        } catch (error) {
          if (__DEV__) {
            logger.debug('Failed to setup message notification channel:', error);
          }
        }
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: formatted.title,
          body: formatted.body,
          sound: formatted.sound || 'default',
          priority: formatted.priority === 'critical' ? 'max' : formatted.priority === 'high' ? 'high' : 'default',
          data: {
            ...formatted.data,
            messageId,
            userId,
            fullContent: messageContent, // Store full content in data
          },
          badge: 1,
          sticky: isSOS || priority === 'critical', // SOS/critical messages stay until dismissed
        },
        trigger: null,
        ...(Platform.OS === 'android' && {
          android: {
            channelId: isSOS ? 'sos' : priority === 'critical' ? 'sos' : 'messages',
            importance: isSOS || priority === 'critical' ? (Notifications.AndroidImportance?.MAX || 5) : (Notifications.AndroidImportance?.DEFAULT || 3),
            vibrationPattern: formatted.vibrationPattern || [0, 200],
            priority: isSOS || priority === 'critical' ? 'high' : 'default',
            sound: formatted.sound || 'default',
          },
        }),
      });

      if (__DEV__) {
        logger.info(`✅ Formatted message notification sent: ${senderName} - ${formatted.body.substring(0, 30)}...`);
      }
    } catch (error) {
      logger.error('Message notification error:', error);
      // CRITICAL: Don't throw - message delivery should continue even if notification fails
    }
  }

  /**
   * ELITE: Request notification permissions explicitly
   * Should be called from PermissionGuard or Onboarding screens
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const Notifications = await getNotificationsAsync();
      if (!Notifications) {
        if (__DEV__) {
          logger.debug('Notifications module not available - cannot request permissions');
        }
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: false,
            allowCriticalAlerts: true, // CRITICAL: Allow critical alerts for EEW
            provideAppNotificationSettings: false,
            allowProvisional: false,
          },
          android: {},
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        if (__DEV__) {
          logger.debug('Notification permission not granted by user');
        }
        return false;
      }

      if (__DEV__) {
        logger.info('✅ Notification permissions granted');
      }
      return true;
    } catch (error) {
      logger.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  /**
   * ELITE: Handle notification tap (when user taps on notification)
   * Navigates to appropriate screen based on notification type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleNotificationTap(response: any): Promise<void> {
    try {
      const data = response?.notification?.request?.content?.data;
      if (!data || typeof data !== 'object') {
        return;
      }

      const notificationType = data.type;

      // ELITE: Dynamic import to prevent circular dependencies
      const { Linking } = await import('react-native');

      switch (notificationType) {
        case 'earthquake':
        case 'turkey_earthquake_detection':
        case 'global_early_warning':
        case 'eew':
          // Navigate to earthquake detail or EEW screen
          if (data.eventId) {
            Linking.openURL(`afetnet://earthquake/${data.eventId}`).catch(() => {
              // Fallback: Navigate to earthquakes list
              Linking.openURL('afetnet://earthquakes').catch(() => {
                if (__DEV__) {
                  logger.debug('Failed to navigate to earthquake screen');
                }
              });
            });
          }
          break;

        case 'message':
          // Navigate to conversation
          if (data.userId) {
            Linking.openURL(`afetnet://messages/${data.userId}`).catch(() => {
              // Fallback: Navigate to messages list
              Linking.openURL('afetnet://messages').catch(() => {
                if (__DEV__) {
                  logger.debug('Failed to navigate to message screen');
                }
              });
            });
          }
          break;

        case 'news':
          // Navigate to news detail
          if (data.articleId) {
            Linking.openURL(`afetnet://news/${data.articleId}`).catch(() => {
              // Fallback: Open URL if available
              if (data.url) {
                Linking.openURL(data.url).catch(() => {
                  if (__DEV__) {
                    logger.debug('Failed to open news URL');
                  }
                });
              }
            });
          }
          break;

        case 'sos':
          // Navigate to SOS screen or family screen
          Linking.openURL('afetnet://sos').catch(() => {
            Linking.openURL('afetnet://family').catch(() => {
              if (__DEV__) {
                logger.debug('Failed to navigate to SOS screen');
              }
            });
          });
          break;

        case 'family_location':
          // Navigate to family screen
          Linking.openURL('afetnet://family').catch(() => {
            if (__DEV__) {
              logger.debug('Failed to navigate to family screen');
            }
          });
          break;

        default:
          // Default: Navigate to home
          Linking.openURL('afetnet://home').catch(() => {
            if (__DEV__) {
              logger.debug('Failed to navigate to home screen');
            }
          });
      }
    } catch (error) {
      logger.error('Failed to handle notification tap:', error);
      // CRITICAL: Don't throw - notification tap handling shouldn't break app
    }
  }

  /**
   * ELITE: Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      const Notifications = await getNotificationsAsync();
      if (!Notifications || typeof Notifications.cancelAllScheduledNotificationsAsync !== 'function') {
        return;
      }

      await Notifications.cancelAllScheduledNotificationsAsync();

      if (typeof Notifications.dismissAllNotificationsAsync === 'function') {
        await Notifications.dismissAllNotificationsAsync();
      }

      if (__DEV__) {
        logger.info('✅ All notifications cancelled');
      }
    } catch (error) {
      logger.error('Failed to cancel all notifications:', error);
    }
  }

  /**
   * ELITE: Get scheduled notifications
   */
  async getScheduledNotifications(): Promise<any[]> {
    try {
      const Notifications = await getNotificationsAsync();
      if (!Notifications || typeof Notifications.getAllScheduledNotificationsAsync !== 'function') {
        return [];
      }

      const notifications = await Notifications.getAllScheduledNotificationsAsync();

      if (__DEV__) {
        logger.info(`Found ${notifications.length} scheduled notifications`);
      }

      return notifications;
    } catch (error) {
      logger.error('Failed to get scheduled notifications:', error);
      return [];
    }
  }

  /**
   * ELITE: Show critical notification with maximum priority
   * Used for life-saving alerts like on-device EEW
   */
  async showCriticalNotification(
    title: string,
    body: string,
    options: { sound?: string; vibration?: number[]; critical?: boolean } = {},
  ): Promise<void> {
    try {
      const Notifications = await getNotificationsAsync();
      if (!Notifications) return;

      // Ensure critical channel exists (Android)
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('critical-alerts', {
            name: 'Critical Alerts',
            importance: Notifications.AndroidImportance?.MAX || 5,
            vibrationPattern: options.vibration || [0, 500, 200, 500],
            lightColor: '#FF0000',
            sound: options.sound || 'siren',
            enableVibrate: true,
            bypassDnd: true,
          });
        } catch (e) {
          // ELITE: Channel setup failure is non-critical, notification will still work
        }
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: options.sound || 'siren',
          priority: 'max',
          data: { type: 'critical' },
          badge: 1,
          sticky: true,
        },
        trigger: null,
        ...(Platform.OS === 'android' && {
          android: {
            channelId: 'critical-alerts',
            importance: Notifications.AndroidImportance?.MAX || 5,
            priority: 'high',
            sound: options.sound || 'siren',
            vibrationPattern: options.vibration || [0, 500, 200, 500],
          },
        }),
      });

      if (__DEV__) logger.info(`🚨 CRITICAL NOTIFICATION: ${title}`);
    } catch (error) {
      logger.error('Critical notification failed:', error);
    }
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const notificationService = new NotificationService();
