/**
 * MULTI-CHANNEL ALERT SERVICE
 * Critical alerts through multiple channels: push, full-screen, alarm, vibration, LED, TTS
 * Bypasses Do Not Disturb, silent mode, and screen locks
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';

// Lazy imports to avoid early initialization
let Notifications: any = null;
let Audio: any = null;
let Haptics: any = null;
let Speech: any = null;

function getNotifications() {
  if (!Notifications) {
    try {
      Notifications = require('expo-notifications');
    } catch (e) { /* ignore */ }
  }
  return Notifications;
}

function getAudio() {
  if (!Audio) {
    try {
      Audio = require('expo-av').Audio;
    } catch (e) { /* ignore */ }
  }
  return Audio;
}

function getHaptics() {
  if (!Haptics) {
    try {
      Haptics = require('expo-haptics');
    } catch (e) { /* ignore */ }
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
    } catch (e) { /* ignore */ }
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
  data?: Record<string, any>;
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

  async initialize() {
    try {
      const Notifications = getNotifications();
      if (!Notifications) {
        logger.warn('Notifications not available - multi-channel alerts disabled');
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
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
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
    // Critical alert channel (bypasses Do Not Disturb)
    await Notifications.setNotificationChannelAsync('critical-alerts', {
      name: 'Critical Alerts',
      importance: Notifications.AndroidImportance.MAX,
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
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 200, 200],
      lightColor: '#FF6600',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    // Normal priority channel
    await Notifications.setNotificationChannelAsync('normal-priority', {
      name: 'Normal Alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      enableVibrate: true,
    });
  }

  private async sendPushNotification(options: AlertOptions) {
    let channelId = 'normal-priority';
    
    if (options.priority === 'critical') {
      channelId = 'critical-alerts';
    } else if (options.priority === 'high') {
      channelId = 'high-priority';
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        sound: options.sound || 'default',
        priority: options.priority === 'critical' ? Notifications.AndroidNotificationPriority.MAX : 
                 options.priority === 'high' ? Notifications.AndroidNotificationPriority.HIGH :
                 Notifications.AndroidNotificationPriority.DEFAULT,
        data: options.data || {},
        categoryIdentifier: 'alert',
        sticky: options.priority === 'critical', // Critical alerts stay until dismissed
      },
      trigger: null, // Immediate
      identifier: `alert-${Date.now()}`,
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
    
    // Schedule a critical notification that shows on lock screen
    if (Platform.OS === 'ios') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: options.title,
          body: options.body,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { ...options.data, fullScreen: true },
        },
        trigger: null,
      });
    }
  }

  private async playAlarmSound(soundFile?: string) {
    try {
      // Stop any existing sound
      if (this.soundInstance) {
        await this.soundInstance.stopAsync();
        await this.soundInstance.unloadAsync();
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
        await Notifications.scheduleNotificationAsync({
          content: {
            sound: 'default',
          },
          trigger: null,
        });
      }
    } catch (error) {
      logger.error('Sound error:', error);
    }
  }

  private async startVibration(pattern?: number[]) {
    try {
      if (Platform.OS === 'ios') {
        // iOS supports haptic feedback
        const sosPattern = pattern || [0, 200, 100, 200, 100, 200, 100, 500, 100, 500, 100, 500, 100, 200, 100, 200, 100, 200];
        
        // Execute vibration pattern
        const vibrate = async () => {
          for (let i = 0; i < sosPattern.length; i += 2) {
            const duration = sosPattern[i];
            const pause = sosPattern[i + 1] || 0;
            
            if (duration > 0) {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }
            
            if (pause > 0) {
              await new Promise(resolve => setTimeout(resolve, pause));
            }
          }
        };

        // Repeat pattern
        this.vibrationInterval = setInterval(() => {
          vibrate();
        }, 3000); // Repeat every 3 seconds

        // Initial vibration
        vibrate();
      } else {
        // Android vibration is handled by notification channel
        // But we can also trigger additional vibrations
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        
        if (pattern) {
          // Custom pattern vibration
          this.vibrationInterval = setInterval(async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
      const options = {
        language: 'tr-TR', // Turkish
        pitch: 1.2, // Slightly higher pitch for urgency
        rate: 0.9, // Slightly slower for clarity
        volume: 1.0,
      };

      await Speech.speak(text, options);
    } catch (error) {
      logger.error('TTS error:', error);
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

