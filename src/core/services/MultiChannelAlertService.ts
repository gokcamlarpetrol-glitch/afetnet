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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Audio: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Haptics: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Speech: any = null;

// ELITE: Promise cache for preventing race conditions
let notificationsLoadPromise: Promise<typeof import('expo-notifications') | null> | null = null;

/**
 * ELITE: Safe async notification module loader
 * Uses dynamic import instead of eval (secure, App Store compliant)
 */
async function getNotificationsAsync(): Promise<typeof import('expo-notifications') | null> {
  // Return cached module if available
  if (Notifications) {
    return Notifications;
  }

  // If already loading, wait for the same promise (prevents race condition)
  if (notificationsLoadPromise) {
    return notificationsLoadPromise;
  }

  // Create and cache the loading promise
  notificationsLoadPromise = (async () => {
    try {
      // ELITE: Use dynamic import (safe, no eval, App Store compliant)
      const module = await import('expo-notifications');
      Notifications = module.default || module;
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

/**
 * ELITE: Sync wrapper (for backward compatibility)
 * Returns null if module not ready
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  soundVolume?: number; // 0-100
  soundRepeat?: number; // 1-10
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

interface AlertSettingsSnapshot {
  notificationsEnabled: boolean;
  notificationPush: boolean;
  notificationFullScreen: boolean;
  notificationSound: boolean;
  notificationSoundType: 'default' | 'alarm' | 'sos' | 'beep' | 'chime' | 'siren' | 'custom';
  notificationSoundVolume: number;
  notificationSoundRepeat: number;
  alarmSoundEnabled: boolean;
  notificationVibration: boolean;
  vibrationEnabled: boolean;
  magnitudeBasedSound: boolean;
  magnitudeBasedVibration: boolean;
  notificationTTS: boolean;
  notificationMode: 'silent' | 'vibrate' | 'sound' | 'sound+vibrate' | 'critical-only';
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursCriticalOnly: boolean;
  notificationShowOnLockScreen: boolean;
}

const DEFAULT_ALERT_SETTINGS: AlertSettingsSnapshot = {
  notificationsEnabled: true,
  notificationPush: true,
  notificationFullScreen: true,
  notificationSound: true,
  notificationSoundType: 'alarm',
  notificationSoundVolume: 80,
  notificationSoundRepeat: 3,
  alarmSoundEnabled: true,
  notificationVibration: true,
  vibrationEnabled: true,
  magnitudeBasedSound: true,
  magnitudeBasedVibration: true,
  notificationTTS: true,
  notificationMode: 'sound+vibrate',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  quietHoursCriticalOnly: true,
  notificationShowOnLockScreen: true,
};

class MultiChannelAlertService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private soundInstance: any = null; // Audio.Sound | null
  private ledInterval: NodeJS.Timeout | null = null;
  private vibrationInterval: NodeJS.Timeout | null = null;
  private dismissTimeout: NodeJS.Timeout | null = null;
  private currentAlert: AlertOptions | null = null;
  private isAlerting = false;
  private static hasLoggedUnavailable = false; // ELITE: Log only once
  private recentAlertKeys = new Map<string, number>();

  private async getSettingsSnapshot(): Promise<AlertSettingsSnapshot> {
    try {
      const { useSettingsStore } = await import('../stores/settingsStore');
      const state = useSettingsStore.getState();
      return {
        notificationsEnabled: state.notificationsEnabled,
        notificationPush: state.notificationPush,
        notificationFullScreen: state.notificationFullScreen,
        notificationSound: state.notificationSound,
        notificationSoundType: state.notificationSoundType,
        notificationSoundVolume: state.notificationSoundVolume,
        notificationSoundRepeat: state.notificationSoundRepeat,
        alarmSoundEnabled: state.alarmSoundEnabled,
        notificationVibration: state.notificationVibration,
        vibrationEnabled: state.vibrationEnabled,
        magnitudeBasedSound: state.magnitudeBasedSound,
        magnitudeBasedVibration: state.magnitudeBasedVibration,
        notificationTTS: state.notificationTTS,
        notificationMode: state.notificationMode,
        quietHoursEnabled: state.quietHoursEnabled,
        quietHoursStart: state.quietHoursStart,
        quietHoursEnd: state.quietHoursEnd,
        quietHoursCriticalOnly: state.quietHoursCriticalOnly,
        notificationShowOnLockScreen: state.notificationShowOnLockScreen,
      };
    } catch (error) {
      return DEFAULT_ALERT_SETTINGS;
    }
  }

  private parseMinutes(value: string): number | null {
    const match = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) {
      return null;
    }
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private isQuietHoursActive(settings: AlertSettingsSnapshot): boolean {
    if (!settings.quietHoursEnabled) {
      return false;
    }
    const start = this.parseMinutes(settings.quietHoursStart);
    const end = this.parseMinutes(settings.quietHoursEnd);
    if (start === null || end === null || start === end) {
      return false;
    }
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (start < end) {
      return nowMinutes >= start && nowMinutes < end;
    }
    return nowMinutes >= start || nowMinutes < end;
  }

  private getDefaultDuration(priority: AlertOptions['priority']): number {
    if (priority === 'critical') {
      return 45;
    }
    if (priority === 'high') {
      return 25;
    }
    if (priority === 'normal') {
      return 12;
    }
    return 8;
  }

  private buildAlertFingerprint(options: AlertOptions): string {
    const data = options.data || {};
    const eventId = typeof data.eventId === 'string' ? data.eventId : undefined;
    const messageId = typeof data.messageId === 'string' ? data.messageId : undefined;
    const coreId = eventId || messageId || `${options.title}:${options.body.slice(0, 40)}`;
    return `${options.priority}:${coreId}`;
  }

  private shouldSuppressDuplicate(fingerprint: string, windowMs: number): boolean {
    const now = Date.now();

    for (const [key, timestamp] of this.recentAlertKeys.entries()) {
      if (now - timestamp > 5 * 60 * 1000) {
        this.recentAlertKeys.delete(key);
      }
    }

    const last = this.recentAlertKeys.get(fingerprint);
    if (last && now - last < windowMs) {
      return true;
    }
    this.recentAlertKeys.set(fingerprint, now);
    return false;
  }

  private applySettingsToChannels(
    channels: AlertChannels,
    options: AlertOptions,
    settings: AlertSettingsSnapshot,
  ): AlertChannels {
    const effective = { ...channels };

    if (!settings.notificationsEnabled) {
      return {
        pushNotification: false,
        fullScreenAlert: false,
        alarmSound: false,
        vibration: false,
        led: false,
        tts: false,
        bluetooth: false,
      };
    }

    if (settings.notificationMode === 'silent') {
      return {
        pushNotification: false,
        fullScreenAlert: false,
        alarmSound: false,
        vibration: false,
        led: false,
        tts: false,
        bluetooth: false,
      };
    }

    if (settings.notificationMode === 'critical-only' && options.priority !== 'critical') {
      return {
        pushNotification: false,
        fullScreenAlert: false,
        alarmSound: false,
        vibration: false,
        led: false,
        tts: false,
        bluetooth: false,
      };
    }

    if (!settings.notificationPush) {
      effective.pushNotification = false;
    }
    if (!settings.notificationFullScreen) {
      effective.fullScreenAlert = false;
    }
    if (!settings.notificationSound || settings.notificationSoundVolume <= 0 || !settings.alarmSoundEnabled || settings.notificationMode === 'vibrate') {
      effective.alarmSound = false;
    }
    if (!settings.notificationVibration || !settings.vibrationEnabled || settings.notificationMode === 'sound') {
      effective.vibration = false;
    }
    if (!settings.notificationTTS || settings.notificationMode === 'vibrate') {
      effective.tts = false;
    }

    const quietHoursActive = this.isQuietHoursActive(settings);
    if (quietHoursActive && settings.quietHoursCriticalOnly && options.priority !== 'critical') {
      effective.fullScreenAlert = false;
      effective.alarmSound = false;
      effective.vibration = false;
      effective.tts = false;
    }

    return effective;
  }

  private resolveNotificationSound(
    settings: AlertSettingsSnapshot,
    priority: AlertOptions['priority'],
    fallback?: string,
  ): string {
    if (fallback) {
      return fallback;
    }
    if (settings.notificationSoundType === 'default') {
      return 'default';
    }
    if (priority === 'critical' || priority === 'high') {
      return 'default';
    }
    return 'default';
  }

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
    const fingerprint = this.buildAlertFingerprint(options);
    const dedupWindow = options.priority === 'critical' ? 3000 : 10000;
    if (this.shouldSuppressDuplicate(fingerprint, dedupWindow)) {
      return;
    }

    if (this.isAlerting) {
      // Queue or replace based on priority
      if (this.currentAlert) {
        const currentFingerprint = this.buildAlertFingerprint(this.currentAlert);
        const priorityDelta = this.comparePriority(options.priority, this.currentAlert.priority);
        if (priorityDelta < 0) {
          return; // Lower priority, ignore
        }
        if (priorityDelta === 0 && currentFingerprint === fingerprint) {
          return; // Same alert already active
        }
      }
      // Higher or different same-priority alert, cancel current and send new
      await this.cancelAlert();
    }

    const settings = await this.getSettingsSnapshot();
    const channels = this.applySettingsToChannels(
      { ...DEFAULT_CHANNELS, ...options.channels },
      options,
      settings,
    );
    const effectiveSoundVolume = Math.max(
      0,
      Math.min(100, options.soundVolume ?? settings.notificationSoundVolume),
    );
    const effectiveSoundRepeat = Math.max(
      1,
      Math.min(10, Math.round(options.soundRepeat ?? settings.notificationSoundRepeat)),
    );
    const hasEnabledChannel = Object.values(channels).some(Boolean);
    if (!hasEnabledChannel) {
      return;
    }

    this.currentAlert = options;
    this.isAlerting = true;

    try {
      const tasks: Promise<unknown>[] = [];

      if (channels.pushNotification) {
        tasks.push(this.sendPushNotification(options, settings));
      }
      if (channels.fullScreenAlert && (options.priority === 'critical' || options.priority === 'high')) {
        tasks.push(this.showFullScreenAlert(options, settings));
      }
      if (channels.alarmSound) {
        tasks.push(this.playAlarmSound(
          this.resolveNotificationSound(settings, options.priority, options.sound),
          effectiveSoundVolume,
          settings.magnitudeBasedSound ? effectiveSoundRepeat : 1,
        ));
      }
      if (channels.vibration) {
        tasks.push(this.startVibration(
          options.vibrationPattern,
          settings.magnitudeBasedVibration ? effectiveSoundRepeat : 1,
        ));
      }
      if (channels.led && Platform.OS === 'android') {
        tasks.push(this.startLEDFlash());
      }
      if (channels.tts) {
        tasks.push(this.speakText(options.ttsText || options.body));
      }
      if (channels.bluetooth) {
        tasks.push(this.broadcastViaBluetooth(options));
      }

      const results = await Promise.allSettled(tasks);
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(`Alert channel task ${index} failed:`, result.reason);
        }
      });

      const resolvedDuration = options.duration ?? this.getDefaultDuration(options.priority);
      // Auto-dismiss after duration (if set) - STORE TIMEOUT TO PREVENT MEMORY LEAK
      if (resolvedDuration > 0) {
        this.dismissTimeout = setTimeout(() => {
          this.cancelAlert();
        }, resolvedDuration * 1000);
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

  private async sendPushNotification(options: AlertOptions, settings: AlertSettingsSnapshot) {
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

    const sound = this.resolveNotificationSound(settings, options.priority, options.sound);
    const notificationId = await NotificationsAsync.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        sound: sound || 'default',
        priority: options.priority === 'critical' ? 'max' :
          options.priority === 'high' ? 'high' :
            'default',
        data: options.data || {},
        categoryIdentifier: 'alert',
        sticky: options.priority === 'critical', // Critical alerts stay until dismissed
        interruptionLevel: settings.notificationShowOnLockScreen
          ? (options.priority === 'critical' ? 'timeSensitive' : undefined)
          : 'passive',
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

  private async showFullScreenAlert(options: AlertOptions, settings: AlertSettingsSnapshot) {
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
          sound: this.resolveNotificationSound(settings, options.priority, options.sound),
          priority: 'max',
          data: { ...options.data, fullScreen: true },
          interruptionLevel: settings.notificationShowOnLockScreen ? 'timeSensitive' : 'passive',
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
          sound: this.resolveNotificationSound(settings, options.priority, options.sound),
          priority: 'max',
          data: { ...options.data, fullScreen: true },
        },
        trigger: null,
      });
    }
  }

  private async playAlarmSound(
    soundFile?: string,
    volumePercent: number = 100,
    repeatCount: number = 1,
  ) {
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

      const volume = Math.max(0, Math.min(1, volumePercent / 100));
      const repeatWindowMs = Math.max(1, Math.min(10, repeatCount)) * 5000;

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
          { shouldPlay: true, isLooping: repeatCount > 1, volume },
        );
        this.soundInstance = sound;
        if (repeatCount > 1) {
          setTimeout(async () => {
            if (this.soundInstance === sound) {
              try {
                await sound.stopAsync();
                await sound.unloadAsync();
                this.soundInstance = null;
              } catch {
                // already cleaned up
              }
            }
          }, repeatWindowMs);
        }
      } else {
        // PREMIUM: Load the actual emergency alert sound file
        try {
          const { sound } = await Audio.Sound.createAsync(
            require('../../../assets/emergency-alert.wav'),
            { shouldPlay: true, isLooping: repeatCount > 1, volume },
          );
          this.soundInstance = sound;

          // Auto-stop after configured repeat window (bounded for safety)
          setTimeout(async () => {
            if (this.soundInstance === sound) {
              try {
                await sound.stopAsync();
                await sound.unloadAsync();
                this.soundInstance = null;
              } catch (e) {
                // Already cleaned up
              }
            }
          }, Math.max(5000, Math.min(90000, repeatWindowMs)));

          logger.info('🔊 Emergency alert sound playing via MultiChannelAlertService');
        } catch (soundError) {
          logger.warn('Emergency sound file failed, using system notification fallback:', soundError);
          // Last resort fallback to system notification sound
          const Notifications = getNotifications();
          if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
            await Notifications.scheduleNotificationAsync({
              content: { sound: 'default' },
              trigger: null,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Sound error:', error);
    }
  }

  private async startVibration(pattern?: number[], repeatCount: number = 1) {
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
        const repeatWindowMs = Math.max(1, Math.min(10, repeatCount)) * 3000;
        this.vibrationInterval = setInterval(() => {
          vibrate().catch((error) => {
            logger.error('Vibration interval error:', error);
          });
        }, 3000); // Repeat every 3 seconds

        // Initial vibration
        vibrate().catch((error) => {
          logger.error('Initial vibration error:', error);
        });
        if (repeatCount > 0) {
          setTimeout(() => {
            if (this.vibrationInterval) {
              clearInterval(this.vibrationInterval);
              this.vibrationInterval = null;
            }
          }, repeatWindowMs);
        }
      } else {
        // Android vibration is handled by notification channel
        // But we can also trigger additional vibrations
        if (Haptics.impactAsync) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Heavy || Haptics.ImpactFeedbackStyle?.Medium);
        }

        if (pattern) {
          // Custom pattern vibration
          const repeatWindowMs = Math.max(1, Math.min(10, repeatCount)) * 1000;
          this.vibrationInterval = setInterval(async () => {
            try {
              if (Haptics.impactAsync) {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Heavy || Haptics.ImpactFeedbackStyle?.Medium);
              }
            } catch (error) {
              logger.error('Vibration interval error:', error);
            }
          }, 1000);
          if (repeatCount > 0) {
            setTimeout(() => {
              if (this.vibrationInterval) {
                clearInterval(this.vibrationInterval);
                this.vibrationInterval = null;
              }
            }, repeatWindowMs);
          }
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
