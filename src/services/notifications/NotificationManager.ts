import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { logger } from '../../utils/productionLogger';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface NotificationData {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'critical';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  read: boolean;
  actions?: NotificationAction[];
  sound?: boolean;
  vibration?: boolean;
  persistent?: boolean;
}

export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  style: 'default' | 'destructive' | 'cancel';
}

class NotificationManager extends SimpleEventEmitter {
  private notifications = new Map<string, NotificationData>();
  private isActive = false;

  constructor() {
    super();
    logger.debug('🔔 Notification Manager initialized');
  }

  // CRITICAL: Start Notification System
  async startNotificationSystem(): Promise<boolean> {
    try {
      if (this.isActive) return true;

      logger.debug('🔔 Starting notification system...');
      this.isActive = true;

      this.emit('notificationSystemStarted');
      emergencyLogger.logSystem('info', 'Notification system started');

      logger.debug('✅ Notification system started');
      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to start notification system', { error: String(error) });
      logger.error('❌ Failed to start notification system:', error);
      return false;
    }
  }

  // CRITICAL: Show Notification
  async showNotification(notification: Omit<NotificationData, 'id' | 'timestamp' | 'read'>): Promise<string> {
    try {
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      const fullNotification: NotificationData = {
        ...notification,
        id: notificationId,
        timestamp: Date.now(),
        read: false
      };

      this.notifications.set(notificationId, fullNotification);

      // Trigger notification display
      this.emit('notificationShown', fullNotification);

      // Auto-remove low priority notifications after 5 minutes
      if (notification.priority === 'low') {
        setTimeout(() => {
          this.removeNotification(notificationId);
        }, 300000);
      }

      emergencyLogger.logSystem('info', 'Notification shown', {
        notificationId,
        type: notification.type,
        priority: notification.priority
      });

      logger.debug(`🔔 Notification shown: ${notification.title}`);
      return notificationId;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to show notification', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Show Critical Alert
  async showCriticalAlert(title: string, message: string, actions?: NotificationAction[]): Promise<string> {
    return this.showNotification({
      type: 'critical',
      title,
      message,
      priority: 'critical',
      sound: true,
      vibration: true,
      persistent: true,
      actions
    });
  }

  // CRITICAL: Show Emergency SOS Notification
  async showEmergencySOSNotification(sosData: any): Promise<string> {
    return this.showCriticalAlert(
      '🚨 ACİL DURUM SOS',
      `Konum: ${sosData.location.lat}, ${sosData.location.lon}\nKişi sayısı: ${sosData.peopleCount}\nÖncelik: ${sosData.priority.toUpperCase()}`,
      [
        { id: 'acknowledge', label: 'Onayla', action: 'acknowledge_sos', style: 'default' },
        { id: 'respond', label: 'Yanıtla', action: 'respond_sos', style: 'default' }
      ]
    );
  }

  // CRITICAL: Show Survivor Detection Notification
  async showSurvivorDetectionNotification(detection: any): Promise<string> {
    return this.showCriticalAlert(
      '👥 MAĞDUR TESPİT EDİLDİ',
      `Enkaz altında mağdur tespit edildi!\nKonum: ${detection.location.lat}, ${detection.location.lon}\nÖncelik: ${detection.priority.toUpperCase()}`,
      [
        { id: 'acknowledge', label: 'Onayla', action: 'acknowledge_detection', style: 'default' },
        { id: 'rescue', label: 'Kurtarma Başlat', action: 'start_rescue', style: 'default' }
      ]
    );
  }

  // CRITICAL: Show Early Warning Notification
  async showEarlyWarningNotification(warning: any): Promise<string> {
    const priority = warning.severity === 'critical' ? 'critical' : 'high';
    
    return this.showNotification({
      type: warning.severity === 'critical' ? 'critical' : 'warning',
      title: `⚠️ ${warning.title}`,
      message: warning.description,
      priority,
      sound: warning.severity === 'critical',
      vibration: warning.severity === 'critical',
      persistent: warning.severity === 'critical'
    });
  }

  // CRITICAL: Remove Notification
  removeNotification(notificationId: string): boolean {
    try {
      const removed = this.notifications.delete(notificationId);
      if (removed) {
        this.emit('notificationRemoved', notificationId);
        emergencyLogger.logSystem('info', 'Notification removed', { notificationId });
      }
      return removed;
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to remove notification', { error: String(error) });
      return false;
    }
  }

  // CRITICAL: Mark as Read
  markAsRead(notificationId: string): boolean {
    try {
      const notification = this.notifications.get(notificationId);
      if (notification) {
        notification.read = true;
        this.notifications.set(notificationId, notification);
        this.emit('notificationRead', notification);
        return true;
      }
      return false;
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to mark notification as read', { error: String(error) });
      return false;
    }
  }

  // CRITICAL: Get Notifications
  getNotifications(): NotificationData[] {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // CRITICAL: Get Unread Count
  getUnreadCount(): number {
    return Array.from(this.notifications.values())
      .filter(n => !n.read).length;
  }

  // CRITICAL: Clear All Notifications
  clearAllNotifications(): void {
    try {
      this.notifications.clear();
      this.emit('allNotificationsCleared');
      emergencyLogger.logSystem('info', 'All notifications cleared');
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to clear notifications', { error: String(error) });
    }
  }

  // CRITICAL: Get Notification Status
  getNotificationStatus(): {
    isActive: boolean;
    totalNotifications: number;
    unreadNotifications: number;
    criticalNotifications: number;
  } {
    const allNotifications = Array.from(this.notifications.values());
    
    return {
      isActive: this.isActive,
      totalNotifications: allNotifications.length,
      unreadNotifications: allNotifications.filter(n => !n.read).length,
      criticalNotifications: allNotifications.filter(n => n.priority === 'critical').length
    };
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager();
export default NotificationManager;












