/**
 * BATTERY MONITORING SERVICE
 * Monitors battery level and sends notifications for low battery
 */

import * as Battery from 'expo-battery';
import { AppState, AppStateStatus } from 'react-native';
import { createLogger } from '../utils/logger';
import { notificationService } from './NotificationService';

const logger = createLogger('BatteryMonitoringService');

class BatteryMonitoringService {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastNotifiedLevel: number | null = null;
  private appStateListener: any = null;
  private currentBatteryLevel: number = 100; // Default to 100% if unknown
  private isCharging: boolean = false;
  private readonly LOW_BATTERY_THRESHOLD = 20; // 20%
  private readonly CRITICAL_BATTERY_THRESHOLD = 10; // 10%
  private readonly CHECK_INTERVAL = 60000; // Check every minute
  
  /**
   * ELITE: Get current battery level (0-100)
   */
  getBatteryLevel(): number {
    return this.currentBatteryLevel;
  }
  
  /**
   * ELITE: Check if device is charging
   */
  isDeviceCharging(): boolean {
    return this.isCharging;
  }
  
  /**
   * ELITE: Check if battery is low (needs power saving)
   */
  isBatteryLow(): boolean {
    return this.currentBatteryLevel <= this.LOW_BATTERY_THRESHOLD;
  }
  
  /**
   * ELITE: Check if battery is critical (needs aggressive power saving)
   */
  isBatteryCritical(): boolean {
    return this.currentBatteryLevel <= this.CRITICAL_BATTERY_THRESHOLD;
  }
  
  /**
   * ELITE: Get recommended polling interval multiplier based on battery level
   * Returns: 1.0 (normal), 2.0 (low battery - slower), 3.0 (critical - much slower)
   * CRITICAL: Safe to call even if service not fully initialized
   */
  getPollingIntervalMultiplier(): number {
    // If service not running, return normal multiplier (safe fallback)
    if (!this.isRunning) {
      return 1.0;
    }
    
    if (this.isCharging) {
      return 0.8; // Faster when charging (can afford more frequent checks)
    }
    if (this.isBatteryCritical()) {
      return 3.0; // 3x slower when critical
    }
    if (this.isBatteryLow()) {
      return 2.0; // 2x slower when low
    }
    return 1.0; // Normal speed
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Starting battery monitoring...');

    // Initial check
    await this.checkBatteryLevel();

    // Check periodically
    this.checkInterval = setInterval(() => {
      void this.checkBatteryLevel();
    }, this.CHECK_INTERVAL);

    // Check when app comes to foreground
    this.appStateListener = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void this.checkBatteryLevel();
      }
    });

    // Listen to battery level changes (if available)
    try {
      Battery.addBatteryLevelListener(({ batteryLevel }) => {
        const level = Math.round(batteryLevel * 100);
        this.currentBatteryLevel = level;
        void this.handleBatteryLevel(level);
      });
      
      // Listen to battery state changes (charging status)
      Battery.addBatteryStateListener(({ batteryState }) => {
        this.isCharging = batteryState === Battery.BatteryState.CHARGING || 
                          batteryState === Battery.BatteryState.FULL;
      });
    } catch (error) {
      logger.warn('Battery level listener not available:', error);
    }
    
    // Initial battery state check
    try {
      const batteryState = await Battery.getBatteryStateAsync();
      this.isCharging = batteryState === Battery.BatteryState.CHARGING || 
                        batteryState === Battery.BatteryState.FULL;
    } catch {
      // Ignore errors
    }
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    logger.info('Stopping battery monitoring...');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
  }

  private async checkBatteryLevel() {
    try {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      const level = Math.round(batteryLevel * 100);
      this.currentBatteryLevel = level;
      
      // Check charging status
      try {
        const batteryState = await Battery.getBatteryStateAsync();
        this.isCharging = batteryState === Battery.BatteryState.CHARGING || 
                          batteryState === Battery.BatteryState.FULL;
      } catch {
        // Ignore charging status errors
        this.isCharging = false;
      }
      
      await this.handleBatteryLevel(level);
    } catch (error) {
      logger.error('Failed to check battery level:', error);
    }
  }

  private async handleBatteryLevel(level: number) {
    // Only notify once per threshold level
    if (level <= this.CRITICAL_BATTERY_THRESHOLD) {
      if (this.lastNotifiedLevel !== null && this.lastNotifiedLevel <= this.CRITICAL_BATTERY_THRESHOLD) {
        return; // Already notified for critical level
      }
      this.lastNotifiedLevel = level;
      await notificationService.showBatteryLowNotification(level);
      
      // Also send multi-channel alert for critical battery
      try {
        const { multiChannelAlertService } = await import('./MultiChannelAlertService');
        await multiChannelAlertService.sendAlert({
          title: '🔋 KRİTİK PİL SEVİYESİ',
          body: `Pil seviyesi %${level}. Acil durum modunda pil tasarrufu aktif.`,
          priority: 'high',
          channels: {
            pushNotification: true,
            fullScreenAlert: false,
            alarmSound: false,
            vibration: true,
            tts: true,
          },
          data: {
            type: 'battery_critical',
            batteryLevel: level,
          },
        });
      } catch (error) {
        logger.error('Failed to send critical battery alert:', error);
      }
    } else if (level <= this.LOW_BATTERY_THRESHOLD) {
      if (this.lastNotifiedLevel !== null && this.lastNotifiedLevel <= this.LOW_BATTERY_THRESHOLD) {
        return; // Already notified for low level
      }
      this.lastNotifiedLevel = level;
      await notificationService.showBatteryLowNotification(level);
    } else {
      // Battery is above threshold - reset notification flag
      if (this.lastNotifiedLevel !== null && this.lastNotifiedLevel > this.LOW_BATTERY_THRESHOLD) {
        this.lastNotifiedLevel = null;
      }
    }
  }
}

export const batteryMonitoringService = new BatteryMonitoringService();

