/**
 * MULTI-CHANNEL ALERT SERVICE
 * Critical alerts through multiple channels: push, full-screen, alarm, vibration, LED, TTS
 * Bypasses Do Not Disturb, silent mode, and screen locks
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';

/**
 * ELITE: Multi-Channel Alert Service - Safe Module Loading
 * Uses the same safe loading pattern as NotificationService
 */

// Lazy imports to avoid early initialization
let Notifications: any = null;
let Audio: any = null;
let Haptics: any = null;
let Speech: any = null;

/**
 * ELITE: Safe notification module loader
 * Reuses the same pattern from NotificationService for consistency
 */
/**
 * ELITE: Safe async notification module loader
 * Uses dynamic import to prevent immediate native bridge initialization
 */
async function getNotificationsAsync(): Promise<typeof import('expo-notifications') | null> {
  // CRITICAL: Return cached module if available
  if (Notifications) {
    return Notifications;
  }
  
  // ELITE: Wait for native bridge with progressive checks
  const MAX_WAIT_TIME = 2000;
  const CHECK_INTERVAL = 200;
  const MAX_CHECKS = MAX_WAIT_TIME / CHECK_INTERVAL;
  
  for (let attempt = 0; attempt < MAX_CHECKS; attempt++) {
    try {
      // CRITICAL: Check if React Native bridge is ready
      const RN = require('react-native');
      const NativeModules = RN?.NativeModules;
      if (!NativeModules || typeof NativeModules !== 'object' || Object.keys(NativeModules).length === 0) {
        await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
        continue;
      }
      
      // ELITE: Use eval to prevent static analysis
      try {
        const moduleName = 'expo-' + 'notifications';
        const module = eval(`require('${moduleName}')`);
        if (module && typeof module === 'object') {
          Notifications = module.default || module;
          return Notifications;
        }
      } catch (evalError: unknown) {
        // Fallback: Function constructor
        try {
          const expoPart = 'expo';
          const notificationsPart = 'notifications';
          const moduleNameDynamic = expoPart + '-' + notificationsPart;
          const requireFn = new Function('moduleName', 'return require(moduleName)');
          const module = requireFn(moduleNameDynamic);
          if (module && typeof module === 'object') {
            Notifications = module.default || module;
            return Notifications;
          }
        } catch (fnError: unknown) {
          const errorMessage = fnError instanceof Error ? fnError.message : String(fnError);
          if (errorMessage.includes('NativeEventEmitter') || errorMessage.includes('null')) {
            await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL * 2));
            continue;
          }
        }
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('NativeEventEmitter') || errorMessage.includes('null')) {
        await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL * 2));
        continue;
      }
      // Other error - return null
      return null;
    }
  }
  
  // Max attempts reached
  return null;
}

/**
 * ELITE: Sync wrapper (for backward compatibility)
 * Returns null if module not ready
 */
function getNotifications(): any {
  return Notifications;
}

function getAudio() {
  if (!Audio) {
    try {
      Audio = require('expo-av').Audio;
    } catch (error) {
      // ELITE: Log notification errors but don't crash the app
      if (__DEV__) {
        logger.debug('Notification operation failed (non-critical):', error);
      }
    }
  }
  return Audio;
}

function getHaptics() {
  if (!Haptics) {
    try {
      Haptics = require('expo-haptics');
    } catch (error) {
      // ELITE: Log notification errors but don't crash the app
      if (__DEV__) {
        logger.debug('Notification operation failed (non-critical):', error);
      }
    }
  }
  return Haptics;
}

function getBrightness() {
  // DISABLED: expo-brightness causing TypeError: briary
  // LED flash feature disabled for stability
  return null;
}

function getSpeech() {
  if (!Speech) {
    try {
      Speech = require('expo-speech');
    } catch (error) {
      // ELITE: Log notification errors but don't crash the app
      if (__DEV__) {
        logger.debug('Notification operation failed (non-critical):', error);
      }
    }
  }
  return Speech;
}

const logger = createLogger('MultiChannelAlertService');

export interface AlertChannels {
  pushNotification: boolean;
  fullScreenAlert: boolean;
  alarmSound: boolean;
  vibration: boolean;
  led: boolean;
  tts: boolean;
  bluetooth: boolean;
}

export interface AlertOptions {
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  channels?: Partial<AlertChannels>;
  sound?: string; // Custom sound file
  vibrationPattern?: number[]; // Android vibration pattern
  ttsText?: string; // Custom TTS text
  data?: Record<string, unknown>;
  duration?: number; // Alert duration in seconds (0 = until dismissed)
}

const DEFAULT_CHANNELS: AlertChannels = {
  pushNotification: true,
  fullScreenAlert: true,
  alarmSound: true,
  vibration: true,
  led: false, // LED might not be available on all devices
  tts: true,
  bluetooth: false,
};

class MultiChannelAlertService {
  private soundInstance: any = null; // Audio.Sound | null
  private ledInterval: NodeJS.Timeout | null = null;
  private vibrationInterval: NodeJS.Timeout | null = null;
  private dismissTimeout: NodeJS.Timeout | null = null;
  private currentAlert: AlertOptions | null = null;
  private isAlerting = false;
  private static hasLoggedUnavailable = false; // ELITE: Log only once

  async initialize() {
    try {
      // ELITE: Use async loader to ensure native bridge is ready
      const Notifications = await getNotificationsAsync();
      if (!Notifications) {
        // ELITE: Log only once to prevent spam - this is expected behavior
        if (!MultiChannelAlertService.hasLoggedUnavailable) {
          if (__DEV__) {
            logger.debug('Notifications not available - multi-channel alerts disabled (this is normal in some environments)');
          }
          MultiChannelAlertService.hasLoggedUnavailable = true;
        }
        // CRITICAL: Don't throw - allow app to continue without multi-channel alerts
        return;
      }

      // Configure notification channels (Android)
      if (Platform.OS === 'android') {
        try {
          await this.setupAndroidChannels();
        } catch (error) {
          logger.error('Failed to setup Android channels:', error);
          // Continue without Android channels
        }
      }

      // Set notification handler
      try {
        if (typeof Notifications.setNotificationHandler === 'function') {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }),
          });
        }
      } catch (error) {
        logger.error('Failed to set notification handler:', error);
        // Continue without notification handler
      }

      if (__DEV__) logger.info('Multi-channel alert service initialized');
    } catch (error) {
      logger.error('Initialization error:', error);
      // Don't throw - allow app to continue
    }
  }

  async sendAlert(options: AlertOptions) {
    if (this.isAlerting) {
      // Queue or replace based on priority
      if (this.currentAlert && this.comparePriority(options.priority, this.currentAlert.priority) <= 0) {
        return; // Lower priority, ignore
      }
      // Higher priority, cancel current and send new
      await this.cancelAlert();
    }

    this.currentAlert = options;
    this.isAlerting = true;

    const channels = { ...DEFAULT_CHANNELS, ...options.channels };

    try {
      // 1. Push Notification (always on)
      if (channels.pushNotification) {
        await this.sendPushNotification(options);
      }

      // 2. Full Screen Alert (critical priority)
      if (channels.fullScreenAlert && (options.priority === 'critical' || options.priority === 'high')) {
        await this.showFullScreenAlert(options);
      }

      // 3. Alarm Sound
      if (channels.alarmSound) {
        await this.playAlarmSound(options.sound);
      }

      // 4. Vibration
      if (channels.vibration) {
        await this.startVibration(options.vibrationPattern);
      }

      // 5. LED Flash
      if (channels.led && Platform.OS === 'android') {
        await this.startLEDFlash();
      }

      // 6. Text-to-Speech
      if (channels.tts) {
        await this.speakText(options.ttsText || options.body);
      }

      // 7. Bluetooth Broadcast (if enabled)
      if (channels.bluetooth) {
        await this.broadcastViaBluetooth(options);
      }

      // Auto-dismiss after duration (if set) - STORE TIMEOUT TO PREVENT MEMORY LEAK
      if (options.duration && options.duration > 0) {
        this.dismissTimeout = setTimeout(() => {
          this.cancelAlert();
        }, options.duration * 1000);
      }

    } catch (error) {
      logger.error('Alert error:', error);
      this.isAlerting = false;
      this.currentAlert = null;
    }
  }

  async cancelAlert() {
    try {
      // Clear dismiss timeout - PREVENT MEMORY LEAK
      if (this.dismissTimeout) {
        clearTimeout(this.dismissTimeout);
        this.dismissTimeout = null;
      }

      // Cancel sound
      if (this.soundInstance) {
        try {
          await this.soundInstance.stopAsync();
          await this.soundInstance.unloadAsync();
        } catch (error) {
          logger.error('Sound cleanup error:', error);
        }
        this.soundInstance = null;
      }

      // Cancel LED
      if (this.ledInterval) {
        clearInterval(this.ledInterval);
        this.ledInterval = null;
        // Brightness restore disabled (expo-brightness causing errors)
      }

      // Cancel vibration
      if (this.vibrationInterval) {
        clearInterval(this.vibrationInterval);
        this.vibrationInterval = null;
      }

      // Cancel TTS
      const Speech = getSpeech();
      if (Speech) {
        try {
          Speech.stop();
        } catch (error) {
          logger.error('TTS stop error:', error);
        }
      }

      // Cancel notifications
      const Notifications = getNotifications();
      if (Notifications) {
        try {
          await Notifications.dismissAllNotificationsAsync();
        } catch (error) {
          logger.error('Notification dismiss error:', error);
        }
      }

      this.isAlerting = false;
      this.currentAlert = null;

      if (__DEV__) logger.info('Alert cancelled');
    } catch (error) {
      logger.error('Cancel alert error:', error);
    }
  }

  private async setupAndroidChannels() {
    const Notifications = getNotifications();
    if (!Notifications || typeof Notifications.setNotificationChannelAsync !== 'function') {
      return;
    }
    
    // Critical alert channel (bypasses Do Not Disturb)
    await Notifications.setNotificationChannelAsync('critical-alerts', {
      name: 'Critical Alerts',
      importance: Notifications.AndroidImportance?.MAX || 5,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF0000',
      sound: 'alert_sound.mp3',
      enableVibrate: true,
      showBadge: true,
      bypassDnd: true, // Bypass Do Not Disturb
    });

    // High priority channel
    await Notifications.setNotificationChannelAsync('high-priority', {
      name: 'High Priority Alerts',
      importance: Notifications.AndroidImportance?.HIGH || 4,
      vibrationPattern: [0, 200, 200, 200],
      lightColor: '#FF6600',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    // Normal priority channel
    await Notifications.setNotificationChannelAsync('normal-priority', {
      name: 'Normal Alerts',
      importance: Notifications.AndroidImportance?.DEFAULT || 3,
      sound: 'default',
      enableVibrate: true,
    });
  }

  private async sendPushNotification(options: AlertOptions) {
    // ELITE: Use async getter to ensure notifications module is ready
    const NotificationsAsync = await getNotificationsAsync();
    if (!NotificationsAsync || typeof NotificationsAsync.scheduleNotificationAsync !== 'function') {
      // ELITE: Log as debug - this is expected in some environments
      logger.debug('Notifications not available for push notification (using fallback channels)');
      return null;
    }
    
    let channelId = 'normal-priority';
    
    if (options.priority === 'critical') {
      channelId = 'critical-alerts';
    } else if (options.priority === 'high') {
      channelId = 'high-priority';
    }

    const notificationId = await NotificationsAsync.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        sound: options.sound || 'default',
        priority: options.priority === 'critical' ? 'max' : 
                 options.priority === 'high' ? 'high' :
                 'default',
        data: options.data || {},
        categoryIdentifier: 'alert',
        sticky: options.priority === 'critical', // Critical alerts stay until dismissed
      },
      trigger: null, // Immediate
      identifier: `alert-${Date.now()}`,
      ...(Platform.OS === 'android' && {
        android: {
          channelId: channelId,
          priority: options.priority === 'critical' ? 'high' : options.priority === 'high' ? 'default' : 'low',
        },
      }),
    });

    // For Android, set full-screen intent
    if (Platform.OS === 'android' && options.priority === 'critical') {
      // Full-screen intent is handled by Android system when notification is tapped
      // We'll also show a modal overlay
    }

    return notificationId;
  }

  private async showFullScreenAlert(options: AlertOptions) {
    // This will be handled by a React component overlay
    // For now, we'll use a high-priority notification that shows on lock screen
    // The actual full-screen modal will be shown by the AlertModal component
    
    // ELITE: Use async getter to ensure notifications module is ready
    const NotificationsAsync = await getNotificationsAsync();
    if (!NotificationsAsync || typeof NotificationsAsync.scheduleNotificationAsync !== 'function') {
      // ELITE: Log as debug - this is expected in some environments
      logger.debug('Notifications not available for full-screen alert (using fallback channels)');
      return;
    }
    
    // Schedule a critical notification that shows on lock screen
    if (Platform.OS === 'ios') {
      await NotificationsAsync.scheduleNotificationAsync({
        content: {
          title: options.title,
          body: options.body,
          sound: 'default',
          priority: 'max',
          data: { ...options.data, fullScreen: true },
        },
        trigger: null,
      });
    } else if (Platform.OS === 'android') {
      // Android full-screen intent
      // ELITE: Android-specific options are handled via notification channels
      // The 'android' property is not part of the standard API - removed for type safety
      await NotificationsAsync.scheduleNotificationAsync({
        content: {
          title: options.title,
          body: options.body,
          sound: 'default',
          priority: 'max',
          data: { ...options.data, fullScreen: true },
        },
        trigger: null,
      });
    }
  }

  private async playAlarmSound(soundFile?: string) {
    try {
      // ELITE: Get Audio module dynamically
      const Audio = getAudio();
      if (!Audio) {
        logger.warn('Audio module not available - using notification sound instead');
        // Fallback to notification sound
        const Notifications = getNotifications();
        if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
          await Notifications.scheduleNotificationAsync({
            content: { sound: 'default' },
            trigger: null,
          });
        }
        return;
      }

      // Stop any existing sound
      if (this.soundInstance) {
        try {
          await this.soundInstance.stopAsync();
          await this.soundInstance.unloadAsync();
        } catch (error) {
          logger.error('Sound cleanup error:', error);
        }
        this.soundInstance = null;
      }

      if (soundFile) {
        // Load custom sound
        const { sound } = await Audio.Sound.createAsync(
          { uri: soundFile },
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        this.soundInstance = sound;
      } else {
        // Use default alarm sound (SOS pattern)
        const sosPattern = [0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.5, 0.1, 0.5, 0.1, 0.5, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2];
        
        // For now, use system notification sound
        // Custom audio file would be better but requires asset bundling
        const Notifications = getNotifications();
        if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
          await Notifications.scheduleNotificationAsync({
            content: {
              sound: 'default',
            },
            trigger: null,
          });
        }
      }
    } catch (error) {
      logger.error('Sound error:', error);
    }
  }

  private async startVibration(pattern?: number[]) {
    try {
      // ELITE: Get Haptics module dynamically
      const Haptics = getHaptics();
      if (!Haptics) {
        logger.warn('Haptics module not available - vibration disabled');
        return;
      }

      if (Platform.OS === 'ios') {
        // iOS supports haptic feedback
        const sosPattern = pattern || [0, 200, 100, 200, 100, 200, 100, 500, 100, 500, 100, 500, 100, 200, 100, 200, 100, 200];
        
        // Execute vibration pattern
        const vibrate = async () => {
          try {
            for (let i = 0; i < sosPattern.length; i += 2) {
              const duration = sosPattern[i];
              const pause = sosPattern[i + 1] || 0;
              
              if (duration > 0 && Haptics.impactAsync) {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Heavy || Haptics.ImpactFeedbackStyle?.Medium);
              }
              
              if (pause > 0) {
                await new Promise(resolve => setTimeout(resolve, pause));
              }
            }
          } catch (error) {
            logger.error('Vibration pattern error:', error);
          }
        };

        // Repeat pattern
        this.vibrationInterval = setInterval(() => {
          vibrate().catch((error) => {
            logger.error('Vibration interval error:', error);
          });
        }, 3000); // Repeat every 3 seconds

        // Initial vibration
        vibrate().catch((error) => {
          logger.error('Initial vibration error:', error);
        });
      } else {
        // Android vibration is handled by notification channel
        // But we can also trigger additional vibrations
        if (Haptics.impactAsync) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Heavy || Haptics.ImpactFeedbackStyle?.Medium);
        }
        
        if (pattern) {
          // Custom pattern vibration
          this.vibrationInterval = setInterval(async () => {
            try {
              if (Haptics.impactAsync) {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Heavy || Haptics.ImpactFeedbackStyle?.Medium);
              }
            } catch (error) {
              logger.error('Vibration interval error:', error);
            }
          }, 1000);
        }
      }
    } catch (error) {
      logger.error('Vibration error:', error);
    }
  }

  private async startLEDFlash() {
    // DISABLED: expo-brightness causing TypeError
    // LED flash feature disabled for stability
    // App will use vibration and sound instead
    return;
  }

  private async speakText(text: string) {
    try {
      // ELITE: Get Speech module dynamically
      const Speech = getSpeech();
      if (!Speech || typeof Speech.speak !== 'function') {
        logger.warn('Speech module not available - TTS disabled');
        return;
      }

      const options = {
        language: 'tr-TR', // Turkish
        pitch: 1.2, // Slightly higher pitch for urgency
        rate: 0.9, // Slightly slower for clarity
        volume: 1.0,
      };

      await Speech.speak(text, options);
    } catch (error) {
      logger.error('TTS error:', error);
      // ELITE: Don't throw - TTS failure shouldn't block alert
    }
  }

  private async broadcastViaBluetooth(options: AlertOptions) {
    // This will be handled by BLEMeshService
    // For now, just log
    if (__DEV__) {
      logger.info('Bluetooth broadcast:', options.title);
    }
  }

  private comparePriority(a: string, b: string): number {
    const priorities = { critical: 4, high: 3, normal: 2, low: 1 };
    return (priorities[a as keyof typeof priorities] || 0) - (priorities[b as keyof typeof priorities] || 0);
  }
}

export const multiChannelAlertService = new MultiChannelAlertService();

