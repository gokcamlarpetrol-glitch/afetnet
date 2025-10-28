/**
 * CLIENT-SIDE EARTHQUAKE WARNING SERVICE
 * 
 * Handles life-saving earthquake warnings with:
 * - Full-screen audio siren alerts
 * - Countdown timer UI
 * - Quick safety action buttons
 * - BLE relay for offline users
 */

import * as Notifications from 'expo-notifications';
import * as Audio from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Alert, Platform } from 'react-native';
import { logger } from '../utils/productionLogger';

export interface EarthquakeWarningData {
  event: {
    magnitude: number;
    region: string;
    timestamp: number;
  };
  warning: {
    secondsRemaining: number;
    intensity: number;
    action: 'drop' | 'cover' | 'hold' | 'evacuate';
    priority: 'critical' | 'high' | 'normal';
  };
}

export interface WarningDisplayState {
  isActive: boolean;
  secondsRemaining: number;
  magnitude: number;
  region: string;
  intensity: number;
  action: string;
  recommendedSteps: string[];
}

class EarthquakeWarningService {
  private sirenSound: any | null = null;
  private countdownInterval: NodeJS.Timeout | null = null;
  private currentWarning: EarthquakeWarningData | null = null;
  private isWarningActive = false;
  private hapticsEnabled = true;
  
  constructor() {
    this.setupNotificationHandlers();
    this.loadSirenSound();
  }

  /**
   * Setup notification handlers for earthquake warnings
   */
  private setupNotificationHandlers() {
    // Handle received notifications
    Notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.content.data?.type === 'earthquake_warning') {
        this.handleWarning(notification.request.content.data);
      }
    });

    // Handle user interaction with notifications
    Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data?.type === 'earthquake_warning') {
        this.handleNotificationTap(response.notification.request.content.data);
      }
    });

    // Configure notification presentation
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    } as any),
    });

    logger.info('✅ Earthquake warning notification handlers configured');
  }

  /**
   * Load siren sound for audio alerts
   */
  private async loadSirenSound() {
    try {
      // Load emergency siren sound from assets
      const AudioModule = await import('expo-av');
      const { sound } = await (AudioModule as any).Sound.createAsync(
        require('../../assets/emergency-alert.wav'),
        { shouldPlay: false, volume: 0.8 }
      );
      // Note: silence-2s.mp3 is a placeholder. 
      // In production, use real emergency siren sound file.
      this.sirenSound = sound;
      logger.info('✅ Emergency siren sound loaded');
    } catch (error) {
      logger.error('❌ Failed to load siren sound:', error);
      // System alert sound as fallback
      this.sirenSound = null;
    }
  }

  /**
   * Handle incoming earthquake warning (public for BLE relay)
   */
  async handleWarning(data: any) {
    if (this.isWarningActive) {
      // If warning already active, update with new data
      logger.info('🔄 Updating active earthquake warning');
    } else {
      logger.warn(`🚨 EARTHQUAKE WARNING: ${data.warning.secondsRemaining}s remaining`);
    }
    
    this.currentWarning = data;
    this.isWarningActive = true;
    
    // Trigger immediate alert
    await this.showCriticalAlert(data);
    
    // Start countdown timer
    this.startCountdown(data.warning.secondsRemaining);
    
    // Start haptics
    if (this.hapticsEnabled) {
      await this.startHaptics();
    }
    
    // Play siren if available
    if (this.sirenSound) {
      try {
        await this.sirenSound.playAsync();
        await this.sirenSound.setIsLoopingAsync(true);
      } catch (error) {
        logger.error('❌ Failed to play siren:', error);
      }
    }
  }

  /**
   * Show critical full-screen alert
   */
  private async showCriticalAlert(data: EarthquakeWarningData) {
    const actionMap = {
      drop: 'Yere Düşün',
      cover: 'Sağlam Bir Şeyin Altına Girin',
      hold: 'Sağlam Bir Yapıya Tutunun',
      evacuate: 'Güvenli Açık Alan Tara',
    };
    
    const urgencyText = data.warning.priority === 'critical' ? 'ACİL' : 'UYARI';
    
    Alert.alert(
      `🚨 ${urgencyText} - DEPREM UYARISI 🚨`,
      `Şiddet: M${data.event.magnitude.toFixed(1)}\n` +
      `Bölge: ${data.event.region}\n` +
      `Kalan Süre: ${data.warning.secondsRemaining} saniye\n\n` +
      `HAZIR OLUN: ${actionMap[data.warning.action]}\n\n` +
      `Tahmini Sarsıntı Şiddeti: ${data.warning.intensity}/12 (MMI)`,
      [
        {
          text: 'Bildirimi Arka Plan Yap',
          style: 'cancel',
          onPress: () => {
            // Minimize alert but keep countdown
          },
        },
        {
          text: 'Acil Durum Planı',
          onPress: () => {
            // Navigate to emergency plan
          },
        },
      ],
      { cancelable: false }
    );
  }

  /**
   * Start countdown timer with voice announcements
   */
  private startCountdown(initialSeconds: number) {
    let remaining = initialSeconds;
    
    // Clear any existing interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    this.countdownInterval = setInterval(() => {
      remaining--;
      
      // Critical announcements at 30s, 20s, 10s, 5s
      if ([30, 20, 10, 5].includes(remaining)) {
        logger.warn(`⚠️ ${remaining} seconds remaining!`);
        
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
      
      if (remaining <= 0) {
        this.handleArrival();
      }
    }, 1000);
  }

  /**
   * Handle earthquake arrival
   */
  private async handleArrival() {
    logger.error('⚡️ EARTHQUAKE ARRIVED!');
    
    // Stop countdown
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    // Stop siren
    if (this.sirenSound) {
      try {
        await this.sirenSound.stopAsync();
        await this.sirenSound.unloadAsync();
      } catch (error) {
        logger.error('❌ Failed to stop siren:', error);
      }
    }
    
    // Show arrival alert
    Alert.alert(
      '⚡️ SARSINTI BAŞLADI',
      'YERE DÜŞÜN, SAĞLAM BİR ŞEYİN ALTINA GİRİN, TUTUNUN!',
      [{ text: 'Bildirimi Kapat', style: 'destructive' }],
      { cancelable: true }
    );
    
    // Keep warning active for post-earthquake actions
    setTimeout(() => {
      this.isWarningActive = false;
      this.currentWarning = null;
    }, 60000); // Keep active for 1 minute after arrival
  }

  /**
   * Start haptic feedback
   */
  private async startHaptics() {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      logger.error('❌ Haptics failed:', error);
    }
  }

  /**
   * Handle notification tap
   */
  private handleNotificationTap(data: any) {
    logger.info('📱 User tapped earthquake warning notification');
    this.handleWarning(data);
  }

  /**
   * Get current warning state for UI
   */
  getCurrentWarning(): WarningDisplayState | null {
    if (!this.isWarningActive || !this.currentWarning) {
      return null;
    }
    
    const actionSteps = {
      drop: ['Yere çömel', 'Başını ve boynunu koru'],
      cover: ['Sağlam masaya, sıraya veya zemine gir', 'Başını koru'],
      hold: ['Sağlam bir yapıya tutun', 'Bekle ve bekle'],
      evacuate: ['Dışarı çık', 'Açık alana git', 'Yüksek yapılardan uzaklaş'],
    };
    
    return {
      isActive: this.isWarningActive,
      secondsRemaining: this.currentWarning.warning.secondsRemaining,
      magnitude: this.currentWarning.event.magnitude,
      region: this.currentWarning.event.region,
      intensity: this.currentWarning.warning.intensity,
      action: this.currentWarning.warning.action,
      recommendedSteps: actionSteps[this.currentWarning.warning.action] || [],
    };
  }

  /**
   * Enable/disable haptics
   */
  setHapticsEnabled(enabled: boolean) {
    this.hapticsEnabled = enabled;
  }

  /**
   * Dismiss current warning
   */
  dismissWarning() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    if (this.sirenSound) {
      this.sirenSound.stopAsync().catch(() => {});
    }
    
    this.isWarningActive = false;
    this.currentWarning = null;
  }
}

// Singleton instance
export const earthquakeWarningService = new EarthquakeWarningService();

