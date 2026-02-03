/**
 * GUARDIAN SERVICE - Elite Proactive Assistant
 * Monitors user context and proactively suggests actions or alerts.
 * Acts as the "Guardian Angel" of the application.
 */

import { contextBuilder, UserContext } from './ai/ContextBuilder';
import { createLogger } from '../utils/logger';
import { notificationService } from './NotificationService'; // Assuming this exists based on file list
import * as Haptics from '../utils/haptics';

const logger = createLogger('GuardianService');

export interface GuardianAlert {
    id: string;
    type: 'warning' | 'suggestion' | 'critical';
    title: string;
    message: string;
    action?: string;
    timestamp: number;
}

class GuardianService {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastAlerts: Map<string, number> = new Map(); // id -> timestamp
  private readonly CHECK_INTERVAL_MS = 60000; // Check every minute
  private readonly ALERT_COOLDOWN_MS = 3600000; // Don't repeat same alert for 1 hour

  /**
     * Start the Guardian
     */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.check(); // Initial check
    this.checkInterval = setInterval(() => this.check(), this.CHECK_INTERVAL_MS);
    logger.info('GuardianService started - Watching over user');
  }

  /**
     * Stop the Guardian
     */
  stop() {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
     * Main check loop
     */
  private async check() {
    try {
      const context = await contextBuilder.build();
      this.analyzeContext(context);
    } catch (error) {
      logger.error('Guardian check failed:', error);
    }
  }

  /**
     * Analyze context rules
     */
  private analyzeContext(context: UserContext) {
    // Rule 1: Low Battery Warning
    if (context.device.batteryLow) {
      this.triggerAlert('battery_low', {
        type: 'warning',
        title: 'Düşük Pil Uyarısı',
        message: 'Pil seviyeniz kritik seviyede (%20 altı). Acil Durum Modu\'na geçmek ister misiniz?',
        action: 'ENABLE_EMBERGENCY_MODE',
      });
    }

    // Rule 2: Offline Mode Suggestion
    if (!context.device.networkAvailable) {
      this.triggerAlert('offline_detected', {
        type: 'suggestion',
        title: 'Çevrimdışı Mod',
        message: 'İnternet bağlantısı koptu. Mesh Ağı üzerinden iletişim devam ediyor.',
        action: 'OPEN_MESH_SETTINGS',
      });
    }

    // Rule 3: High Motion / Panic Detection (Experimental)
    if (context.activity.isRunning && context.emergency.recentEarthquake) {
      this.triggerAlert('panic_motion', {
        type: 'critical',
        title: 'Hareket Algılandı',
        message: 'Hızlı hareket ediyorsunuz. Yaralandınız mı? Güvenli toplanma alanına yönlendirme yapabilirim.',
        action: 'SHOW_SAFE_ZONES',
      });
    }
  }

  /**
     * Trigger an alert if cooldown has passed
     */
  private async triggerAlert(id: string, alertData: Omit<GuardianAlert, 'id' | 'timestamp'>) {
    const now = Date.now();
    const lastTime = this.lastAlerts.get(id) || 0;

    if (now - lastTime > this.ALERT_COOLDOWN_MS) {
      this.lastAlerts.set(id, now);

      logger.info(`Guardian Alert: ${alertData.title}`);

      // Haptic Feedback based on severity
      if (alertData.type === 'critical') {
        await Haptics.notificationError();
      } else {
        await Haptics.notificationWarning();
      }

      // In a real app, this would show a Toast, Modal, or Push Notification
      // For now, we interact with NotificationService if possible, or just log
      // Assuming NotificationService can handle local notifications:
      // notificationService.showLocalNotification({ ... }) 

      // For this implementation, we'll log it as a "System Notification"
      logger.info(`[GUARDIAN] ${alertData.title}: ${alertData.message}`);
    }
  }
}

export const guardianService = new GuardianService();
