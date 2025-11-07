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
  private readonly LOW_BATTERY_THRESHOLD = 20; // 20%
  private readonly CRITICAL_BATTERY_THRESHOLD = 10; // 10%
  private readonly CHECK_INTERVAL = 60000; // Check every minute

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
        void this.handleBatteryLevel(level);
      });
    } catch (error) {
      logger.warn('Battery level listener not available:', error);
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

