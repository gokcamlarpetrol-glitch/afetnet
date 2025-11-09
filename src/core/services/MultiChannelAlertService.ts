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
  private vibrationStopTimeout: NodeJS.Timeout | null = null;
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
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
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

    // Check settings store for user preferences
    let alarmSoundEnabled = true;
    let vibrationEnabled = true;
    let notificationsEnabled = true;
    
    try {
      const { useSettingsStore } = await import('../stores/settingsStore');
      const settings = useSettingsStore.getState();
      alarmSoundEnabled = settings.alarmSoundEnabled;
      vibrationEnabled = settings.vibrationEnabled;
      notificationsEnabled = settings.notificationsEnabled;
    } catch (error) {
      // Settings store not available, use defaults
      logger.warn('Settings store not available, using defaults');
    }

    // AI mesaj optimizasyonu
    const optimizedOptions = this.optimizeAlertForChannels(options);
    this.currentAlert = optimizedOptions;
    this.isAlerting = true;

    const channels = { ...DEFAULT_CHANNELS, ...optimizedOptions.channels };
    
    // Apply user settings
    if (!alarmSoundEnabled) {
      channels.alarmSound = false;
    }
    if (!vibrationEnabled) {
      channels.vibration = false;
    }
    if (!notificationsEnabled) {
      channels.pushNotification = false;
    }
    
    const effectiveDuration = optimizedOptions.duration ?? this.getDefaultDuration(optimizedOptions.priority);
    optimizedOptions.duration = effectiveDuration;

    try {
      // ELITE: PARALLEL ALERT DELIVERY for MAXIMUM SPEED
      // CRITICAL: All channels fire simultaneously - no blocking
      // This ensures users get alerts INSTANTLY through all channels
      
      const alertPromises: Promise<any>[] = [];
      
      // 1. Push Notification (check settings) - HIGHEST PRIORITY, FIRE FIRST
      if (channels.pushNotification && notificationsEnabled) {
        // CRITICAL: Fire-and-forget for immediate delivery (don't await)
        alertPromises.push(
          this.sendPushNotification(optimizedOptions).catch(error => {
            logger.error('Push notification error:', error);
          })
        );
      }

      // 2. Full Screen Alert with Premium Countdown Modal - PARALLEL
      // ELITE: Always show countdown modal for early warnings (even if screen is off)
      // CRITICAL: This works even when app is closed (background notification triggers modal)
      if (channels.fullScreenAlert) {
        alertPromises.push(
          this.showFullScreenAlert(optimizedOptions).catch(error => {
            logger.error('Full screen alert error:', error);
          })
        );
      }

      // 3. Alarm Sound (check settings) - PARALLEL
      if (channels.alarmSound && alarmSoundEnabled) {
        alertPromises.push(
          this.playAlarmSound(optimizedOptions.sound).catch(error => {
            logger.error('Alarm sound error:', error);
          })
        );
      }

      // 4. Vibration (check settings) - PARALLEL
      if (channels.vibration && vibrationEnabled) {
        alertPromises.push(
          this.startVibration(optimizedOptions.vibrationPattern, optimizedOptions.duration).catch(error => {
            logger.error('Vibration error:', error);
          })
        );
      }

      // 5. LED Flash - PARALLEL
      if (channels.led && Platform.OS === 'android') {
        alertPromises.push(
          this.startLEDFlash().catch(error => {
            logger.error('LED flash error:', error);
          })
        );
      }

      // 6. Text-to-Speech (AI-optimized) - PARALLEL
      if (channels.tts) {
        alertPromises.push(
          this.speakText(optimizedOptions.ttsText || optimizedOptions.body).catch(error => {
            logger.error('TTS error:', error);
          })
        );
      }

      // 7. Bluetooth Broadcast (if enabled) - PARALLEL
      if (channels.bluetooth) {
        alertPromises.push(
          this.broadcastViaBluetooth(optimizedOptions).catch(error => {
            logger.error('Bluetooth broadcast error:', error);
          })
        );
      }
      
      // ELITE: Fire all alerts in parallel - don't wait for completion
      // CRITICAL: Speed is everything - alerts must be INSTANT
      void Promise.allSettled(alertPromises).then(() => {
        if (__DEV__) {
          logger.info(`✅ All ${alertPromises.length} alert channels fired`);
        }
      });

      // Auto-dismiss after duration (if set) - STORE TIMEOUT TO PREVENT MEMORY LEAK
      if (optimizedOptions.duration && optimizedOptions.duration > 0) {
        this.dismissTimeout = setTimeout(() => {
          this.cancelAlert();
        }, optimizedOptions.duration * 1000);
      }

    } catch (error) {
      logger.error('Alert error:', error);
      this.isAlerting = false;
      this.currentAlert = null;
    }
  }

  /**
   * AI mesajlarını kanallar için optimize et
   */
  private optimizeAlertForChannels(options: AlertOptions): AlertOptions {
    const optimized = { ...options };

    // TTS için özel metin oluştur (daha kısa ve net)
    if (!options.ttsText) {
      optimized.ttsText = this.generateTTSText(options);
    }

    // Elite: Enhanced magnitude-based optimization
    const magnitude = options.data?.earthquake?.magnitude || options.data?.magnitude || 0;
    
    if (magnitude >= 7.0) {
      // MEGA EARTHQUAKE - Maximum everything
      optimized.priority = 'critical';
      optimized.channels = {
        ...optimized.channels,
        pushNotification: true,
        fullScreenAlert: true,
        alarmSound: true,
        vibration: true,
        tts: true,
        bluetooth: true,
      };
      optimized.duration = 0; // Stay until dismissed
      logger.info('🚨🚨🚨 MEGA DEPREM (7.0+) - MAXIMUM ALERT');
    } else if (magnitude >= 6.0) {
      // MAJOR EARTHQUAKE - Critical alert
      optimized.priority = 'critical';
      optimized.channels = {
        ...optimized.channels,
        pushNotification: true,
        fullScreenAlert: true,
        alarmSound: true,
        vibration: true,
        tts: true,
        bluetooth: true,
      };
      optimized.duration = 0;
      logger.info('🚨 Büyük deprem (6.0+) - Kritik uyarı');
    } else if (magnitude >= 5.0) {
      // SIGNIFICANT EARTHQUAKE - High alert
      optimized.priority = 'critical';
      optimized.channels = {
        ...optimized.channels,
        pushNotification: true,
        fullScreenAlert: true,
        alarmSound: true,
        vibration: true,
        tts: true,
      };
      logger.info('🚨 Önemli deprem (5.0+) - Tüm kanallar aktif');
    } else if (magnitude >= 4.5) {
      // MODERATE EARTHQUAKE - High priority
      optimized.priority = 'high';
      optimized.channels = {
        ...optimized.channels,
        pushNotification: true,
        fullScreenAlert: false,
        alarmSound: true,
        vibration: true,
        tts: true,
      };
      logger.info('⚠️ Orta deprem (4.5+) - Yüksek öncelik');
    } else if (magnitude >= 4.0) {
      // NOTABLE EARTHQUAKE - Normal-high priority
      optimized.priority = 'high';
      optimized.channels = {
        ...optimized.channels,
        pushNotification: true,
        fullScreenAlert: false,
        alarmSound: false,
        vibration: true,
        tts: true,
      };
      logger.info('📢 Fark edilir deprem (4.0+) - Normal yüksek öncelik');
    }

    // Doğrulanmış depremler için özel işaretleme
    if (options.data?.verified) {
      logger.info('✅ Doğrulanmış deprem bilgisi');
    }

    return optimized;
  }

  /**
   * TTS için optimize edilmiş metin oluştur
   */
  private generateTTSText(options: AlertOptions): string {
    // AI mesajından TTS için uygun metin çıkar
    let ttsText = options.body;

    // Çok uzunsa kısalt (TTS için ideal: 100-150 karakter)
    if (ttsText.length > 150) {
      // İlk cümleyi al
      const firstSentence = ttsText.split('.')[0];
      if (firstSentence.length > 0 && firstSentence.length <= 150) {
        ttsText = firstSentence + '.';
      } else {
        ttsText = ttsText.substring(0, 147) + '...';
      }
    }

    // Özel karakterleri temizle
    ttsText = ttsText
      .replace(/[✓✅⚠️🚨]/g, '') // Emoji'leri kaldır
      .replace(/\s+/g, ' ') // Çoklu boşlukları tek boşluğa indir
      .trim();

    return ttsText;
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
      if (this.vibrationStopTimeout) {
        clearTimeout(this.vibrationStopTimeout);
        this.vibrationStopTimeout = null;
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
    const Notifications = getNotifications();
    if (!Notifications) {
      logger.warn('Notifications module not available; skipping push notification');
      return null;
    }

    let channelId = 'normal-priority';
    
    if (options.priority === 'critical') {
      channelId = 'critical-alerts';
    } else if (options.priority === 'high') {
      channelId = 'high-priority';
    }

    // ELITE: IMMEDIATE notification delivery - no delays
    // CRITICAL: Use highest priority for instant delivery
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
        // ELITE: Additional flags for immediate delivery
        badge: options.priority === 'critical' ? 1 : undefined,
        // iOS: Critical alerts bypass Do Not Disturb
        interruptionLevel: options.priority === 'critical' ? 'critical' : 'active',
      },
      trigger: null, // Immediate - no delay
      identifier: `alert-${Date.now()}-${Math.random()}`, // Unique ID to prevent deduplication
    });

    // For Android, set full-screen intent
    if (Platform.OS === 'android' && options.priority === 'critical') {
      // Full-screen intent is handled by Android system when notification is tapped
      // We'll also show a modal overlay
    }

    return notificationId;
  }

  /**
   * ELITE: Show premium full-screen alert with countdown
   * Modern, lüks ve zarif tasarımla premium bildirim
   */
  private async showFullScreenAlert(options: AlertOptions) {
    try {
      // ELITE: Premium countdown modal göster
      const { premiumAlertManager } = await import('./PremiumAlertManager');
      
      // Extract earthquake data
      const earthquake = options.data?.earthquake || options.data;
      const warning = options.data?.warning || options.data;
      const aiAnalysis = options.data?.aiAnalysis;
      
      // Calculate ETA if available
      let secondsRemaining = 0;
      let pWaveETA: number | undefined;
      let sWaveETA: number | undefined;
      let distance: number | undefined;
      let alertLevel: 'caution' | 'action' | 'imminent' | undefined;
      let recommendedAction: string | undefined;
      
      if (warning?.secondsRemaining) {
        secondsRemaining = Math.max(0, Math.floor(warning.secondsRemaining));
      }
      
      if (warning?.eta) {
        pWaveETA = warning.eta.pWaveETA;
        sWaveETA = warning.eta.sWaveETA;
        distance = warning.eta.distance;
        alertLevel = warning.eta.alertLevel as any;
        recommendedAction = warning.eta.recommendedAction;
      }
      
      // Determine alert level from magnitude if not provided
      if (!alertLevel && earthquake?.magnitude) {
        if (secondsRemaining < 10) {
          alertLevel = 'imminent';
        } else if (secondsRemaining < 30) {
          alertLevel = 'action';
        } else if (secondsRemaining < 60) {
          alertLevel = 'caution';
        }
      }
      
      // Get recommended action from AI analysis if available
      if (!recommendedAction && aiAnalysis?.recommendations?.length > 0) {
        recommendedAction = aiAnalysis.recommendations[0];
      }
      
      // ELITE: Extract data from multiple possible sources
      const magnitude = earthquake?.magnitude || options.data?.magnitude || 0;
      const location = earthquake?.location || options.data?.location || options.data?.region || 'Bilinmeyen';
      const region = earthquake?.region || options.data?.region || location;
      const source = earthquake?.source || options.data?.source || 'AfetNet';
      
      // ELITE: Get seconds remaining from multiple sources
      let finalSecondsRemaining = secondsRemaining;
      if (!finalSecondsRemaining && options.data?.warning?.secondsRemaining) {
        finalSecondsRemaining = Math.max(0, Math.floor(options.data.warning.secondsRemaining));
      }
      if (!finalSecondsRemaining && options.data?.etaSec) {
        finalSecondsRemaining = Math.max(0, Math.floor(options.data.etaSec));
      }
      if (!finalSecondsRemaining && options.data?.secondsRemaining) {
        finalSecondsRemaining = Math.max(0, Math.floor(options.data.secondsRemaining));
      }
      
      // Create premium countdown data
      const countdownData: any = {
        eventId: earthquake?.id || options.data?.eventId || `alert-${Date.now()}`,
        magnitude,
        location,
        region,
        source,
        secondsRemaining: finalSecondsRemaining || 30, // Default 30 seconds if not provided
        pWaveETA: pWaveETA || options.data?.warning?.eta?.pWaveETA || options.data?.eta?.pWaveETA,
        sWaveETA: sWaveETA || options.data?.warning?.eta?.sWaveETA || options.data?.eta?.sWaveETA,
        distance: distance || options.data?.warning?.eta?.distance || options.data?.eta?.distance,
        alertLevel: alertLevel || options.data?.warning?.eta?.alertLevel || options.data?.alertLevel,
        recommendedAction: recommendedAction || options.data?.recommendedAction || options.data?.warning?.eta?.recommendedAction || 'Güvenli bir yere geçin ve çök-kapan-tutun pozisyonu alın.',
      };
      
      // ELITE: Show premium countdown modal (works even when screen is off)
      // CRITICAL: This modal will appear even if app is closed (triggered by push notification)
      premiumAlertManager.showCountdown(countdownData);
      
      logger.info(`✅ Premium full-screen alert shown: ${countdownData.magnitude.toFixed(1)} magnitude, ${countdownData.secondsRemaining}s countdown`);
    } catch (error) {
      logger.error('Failed to show premium full-screen alert:', error);
      
      // Fallback: Use standard notification
      const Notifications = getNotifications();
      if (Notifications) {
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
  }

  private async playAlarmSound(soundFile?: string) {
    try {
      // Stop any existing sound
      if (this.soundInstance) {
        await this.soundInstance.stopAsync();
        await this.soundInstance.unloadAsync();
      }

      const AudioModule = getAudio();
      const Notifications = getNotifications();

      if (soundFile) {
        // Load custom sound
        if (!AudioModule) {
          logger.warn('Audio module not available; cannot play custom alarm sound');
          return;
        }
        const { sound } = await AudioModule.Sound.createAsync(
          { uri: soundFile },
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        this.soundInstance = sound;
      } else {
        // Use default alarm sound (SOS pattern)
        const sosPattern = [0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.5, 0.1, 0.5, 0.1, 0.5, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2];
        
        // For now, use system notification sound
        // Custom audio file would be better but requires asset bundling
        if (Notifications) {
          await Notifications.scheduleNotificationAsync({
            content: {
              sound: 'default',
            },
            trigger: null,
          });
        } else {
          logger.warn('Notifications module not available; skipping default alarm sound notification');
        }
      }
    } catch (error) {
      logger.error('Sound error:', error);
    }
  }

  private async startVibration(pattern?: number[], durationSeconds?: number) {
    try {
      const HapticsModule = getHaptics();
      if (!HapticsModule) {
        logger.warn('Haptics module not available; skipping vibration');
        return;
      }

      if (this.vibrationInterval) {
        clearInterval(this.vibrationInterval);
        this.vibrationInterval = null;
      }
      if (this.vibrationStopTimeout) {
        clearTimeout(this.vibrationStopTimeout);
        this.vibrationStopTimeout = null;
      }

      if (Platform.OS === 'ios') {
        // iOS supports haptic feedback
        const sosPattern = pattern || [0, 200, 100, 200, 100, 200, 100, 500, 100, 500, 100, 500, 100, 200, 100, 200, 100, 200];
        
        // Execute vibration pattern
        const vibrate = async () => {
          for (let i = 0; i < sosPattern.length; i += 2) {
            const duration = sosPattern[i];
            const pause = sosPattern[i + 1] || 0;
            
            if (duration > 0) {
              await HapticsModule.impactAsync(HapticsModule.ImpactFeedbackStyle.Heavy);
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
        await HapticsModule.impactAsync(HapticsModule.ImpactFeedbackStyle.Heavy);
        
        if (pattern) {
          // Custom pattern vibration
          this.vibrationInterval = setInterval(async () => {
            await HapticsModule.impactAsync(HapticsModule.ImpactFeedbackStyle.Heavy);
          }, 1000);
        }
      }

      if (durationSeconds && durationSeconds > 0 && this.vibrationInterval) {
        this.vibrationStopTimeout = setTimeout(() => {
          if (this.vibrationInterval) {
            clearInterval(this.vibrationInterval);
            this.vibrationInterval = null;
          }
        }, durationSeconds * 1000);
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
      const SpeechModule = getSpeech();
      if (!SpeechModule) {
        logger.warn('Speech module not available; skipping TTS');
        return;
      }

      const options = {
        language: 'tr-TR', // Turkish
        pitch: 1.2, // Slightly higher pitch for urgency
        rate: 0.9, // Slightly slower for clarity
        volume: 1.0,
      };

      await SpeechModule.speak(text, options);
    } catch (error) {
      logger.error('TTS error:', error);
    }
  }

  private getDefaultDuration(priority: AlertOptions['priority']): number {
    switch (priority) {
      case 'critical':
        return 45;
      case 'high':
        return 30;
      default:
        return 15;
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

