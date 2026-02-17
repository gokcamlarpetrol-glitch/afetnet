/**
 * NOTIFICATION SERVICE — Unified Notification Gateway
 *
 * SINGLE SOURCE OF TRUTH for all local notifications.
 * Delegates native module operations to notifications/ sub-modules.
 *
 * Responsibilities:
 *  1. Settings-aware delivery (quiet hours, mode, dedup)
 *  2. Content formatting (earthquake, SOS, message, news, system)
 *  3. Notification-tap deep-linking
 *  4. Android channel management (delegated)
 *  5. Permission management (delegated)
 *
 * All other notification files (ComprehensiveNotificationService,
 * MagnitudeBasedNotificationService, etc.) are DEPRECATED — their
 * logic is consolidated here.
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';
import {
  getNotificationsAsync,
  isNotificationsAvailable,
} from './notifications/NotificationModuleLoader';
import {
  initializeChannels,
  getChannelForType,
} from './notifications/NotificationChannelManager';
import { scheduleNotification } from './notifications/NotificationScheduler';

const logger = createLogger('NotificationService');

// ============================================================================
// TYPES
// ============================================================================

type NotificationPriority = 'normal' | 'high' | 'critical';

interface NotificationSettingsSnapshot {
  notificationsEnabled: boolean;
  notificationPush: boolean;
  notificationSound: boolean;
  notificationSoundType: 'default' | 'alarm' | 'sos' | 'beep' | 'chime' | 'siren' | 'custom';
  notificationSoundVolume: number;
  notificationSoundRepeat: number;
  notificationVibration: boolean;
  notificationMode: 'silent' | 'vibrate' | 'sound' | 'sound+vibrate' | 'critical-only';
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursCriticalOnly: boolean;
  notificationShowOnLockScreen: boolean;
  notificationShowPreview: boolean;
  notificationGroupByMagnitude: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsSnapshot = {
  notificationsEnabled: true,
  notificationPush: true,
  notificationSound: true,
  notificationSoundType: 'alarm',
  notificationSoundVolume: 80,
  notificationSoundRepeat: 3,
  notificationVibration: true,
  notificationMode: 'sound+vibrate',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  quietHoursCriticalOnly: true,
  notificationShowOnLockScreen: true,
  notificationShowPreview: true,
  notificationGroupByMagnitude: false,
};

// ============================================================================
// DEDUP — Single shared dedup for ALL notification paths
// ============================================================================

const DEDUP_WINDOW_MS = 10 * 60 * 1000;
const _recentKeys = new Map<string, number>();

function isDuplicate(key: string, windowMs: number = DEDUP_WINDOW_MS): boolean {
  const now = Date.now();

  // Lazy cleanup
  if (_recentKeys.size > 100) {
    for (const [k, ts] of _recentKeys) {
      if (now - ts > DEDUP_WINDOW_MS) _recentKeys.delete(k);
    }
  }

  const last = _recentKeys.get(key);
  if (last && now - last < windowMs) return true;

  _recentKeys.set(key, now);
  return false;
}

/**
 * Cross-system earthquake dedup (exported for MagnitudeBased & UltraFast).
 * Fingerprint = location:magnitude_bucket:time_window
 */
export function shouldDeliverNotification(
  magnitude: number,
  location: string,
  timestamp?: number,
  source: string = 'unknown',
): boolean {
  const now = timestamp || Date.now();
  const locKey = location.trim().substring(0, 30).toLowerCase().replace(/\s+/g, '_');
  const magBucket = (Math.round(magnitude * 2) / 2).toFixed(1);
  const timeBucket = Math.floor(now / (10 * 60 * 1000));
  const fingerprint = `eq:${locKey}:M${magBucket}:T${timeBucket}`;

  if (isDuplicate(fingerprint, 10 * 60 * 1000)) {
    if (__DEV__) {
      logger.debug(`⏭️ DEDUP: M${magnitude.toFixed(1)} "${location}" blocked (${source})`);
    }
    return false;
  }
  return true;
}

// Re-export getNotificationsAsync for services that need direct module access
export { getNotificationsAsync };

// ============================================================================
// NOTIFICATION SERVICE CLASS
// ============================================================================

class NotificationService {
  private isInitialized = false;
  private isInitializing = false;

  // ==================== SETTINGS ====================

  private async getSettings(): Promise<NotificationSettingsSnapshot> {
    try {
      const { useSettingsStore } = await import('../stores/settingsStore');
      const s = useSettingsStore.getState();
      return {
        notificationsEnabled: s.notificationsEnabled,
        notificationPush: s.notificationPush,
        notificationSound: s.notificationSound,
        notificationSoundType: s.notificationSoundType,
        notificationSoundVolume: s.notificationSoundVolume,
        notificationSoundRepeat: s.notificationSoundRepeat,
        notificationVibration: s.notificationVibration,
        notificationMode: s.notificationMode,
        quietHoursEnabled: s.quietHoursEnabled,
        quietHoursStart: s.quietHoursStart,
        quietHoursEnd: s.quietHoursEnd,
        quietHoursCriticalOnly: s.quietHoursCriticalOnly,
        notificationShowOnLockScreen: s.notificationShowOnLockScreen,
        notificationShowPreview: s.notificationShowPreview,
        notificationGroupByMagnitude: s.notificationGroupByMagnitude,
      };
    } catch {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
  }

  // ==================== QUIET HOURS ====================

  private isQuietHoursActive(settings: NotificationSettingsSnapshot): boolean {
    if (!settings.quietHoursEnabled) return false;
    const parse = (v: string) => {
      const m = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(v);
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    const start = parse(settings.quietHoursStart);
    const end = parse(settings.quietHoursEnd);
    if (start === null || end === null || start === end) return false;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return start < end
      ? nowMin >= start && nowMin < end
      : nowMin >= start || nowMin < end;
  }

  // ==================== DELIVERY GATE ====================

  private async shouldDeliver(
    priority: NotificationPriority,
    opts: { requiresPush?: boolean } = {},
  ): Promise<{ allowed: boolean; settings: NotificationSettingsSnapshot }> {
    const settings = await this.getSettings();

    if (!settings.notificationsEnabled) return { allowed: false, settings };
    if (opts.requiresPush !== false && !settings.notificationPush) return { allowed: false, settings };
    if (settings.notificationMode === 'silent') return { allowed: false, settings };
    if (settings.notificationMode === 'critical-only' && priority !== 'critical') return { allowed: false, settings };
    if (this.isQuietHoursActive(settings) && settings.quietHoursCriticalOnly && priority !== 'critical') {
      return { allowed: false, settings };
    }

    return { allowed: true, settings };
  }

  // ==================== SOUND RESOLUTION ====================

  private resolveSound(
    settings: NotificationSettingsSnapshot,
    priority: NotificationPriority,
    fallback: string = 'default',
  ): string | undefined {
    if (!settings.notificationSound || settings.notificationMode === 'vibrate' || settings.notificationSoundVolume <= 0) {
      return undefined;
    }
    if (priority === 'critical' && fallback !== 'default') return fallback;
    const map: Record<string, string> = {
      default: fallback, alarm: priority === 'critical' ? fallback : 'default',
      sos: priority === 'critical' ? fallback : 'default', beep: 'default',
      chime: 'default', siren: priority === 'critical' ? fallback : 'default', custom: fallback,
    };
    return map[settings.notificationSoundType] || fallback;
  }

  // ==================== iOS INTERRUPTION LEVEL ====================

  private resolveInterruptionLevel(
    settings: NotificationSettingsSnapshot,
    priority: NotificationPriority,
  ): 'passive' | 'active' | 'timeSensitive' | undefined {
    if (!settings.notificationShowOnLockScreen) return 'passive';
    if (priority === 'critical') return 'timeSensitive';
    if (priority === 'high') return 'active';
    return undefined;
  }

  // ==================== INITIALIZATION ====================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.isInitializing) {
      // Wait for concurrent init, but never wait forever.
      const startedAt = Date.now();
      const MAX_WAIT_MS = 7000;
      while (this.isInitializing) {
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          logger.warn('NotificationService init wait timeout; skipping duplicate initialize call');
          return;
        }
        await new Promise(r => setTimeout(r, 100));
      }
      return;
    }

    this.isInitializing = true;
    try {
      const Notifications = await getNotificationsAsync();
      if (!Notifications) {
        if (__DEV__) logger.debug('Notifications module not available — service disabled');
        return;
      }

      // Foreground handler is centralized in NotificationCenter.initialize()
      // Tap handling is centralized in NotificationCenter.initialize()

      // Android channels
      await initializeChannels();

      // CRITICAL: Dismiss all previously delivered notifications on app open
      // This prevents the "95+ notification flood" when opening the app
      try {
        if (typeof Notifications.dismissAllNotificationsAsync === 'function') {
          await Notifications.dismissAllNotificationsAsync();
        }
        if (typeof Notifications.cancelAllScheduledNotificationsAsync === 'function') {
          await Notifications.cancelAllScheduledNotificationsAsync();
        }
        if (typeof Notifications.setBadgeCountAsync === 'function') {
          await Notifications.setBadgeCountAsync(0);
        }
      } catch (e) {
        logger.debug('Failed to clear old notifications:', e);
      }

      this.isInitialized = true;
      logger.info('✅ NotificationService initialized');
    } catch (error) {
      logger.error('NotificationService init error:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  // ==================== EARTHQUAKE ====================

  async showEarthquakeNotification(
    magnitude: number,
    location: string,
    time?: Date,
    isEEW: boolean = false,
    timeAdvance?: number,
  ): Promise<void> {
    try {
      if (typeof magnitude !== 'number' || isNaN(magnitude) || magnitude <= 0 ||
        !location || typeof location !== 'string' || !location.trim()) return;

      const loc = location.trim();
      const priority: NotificationPriority = isEEW || magnitude >= 5 ? 'critical' : magnitude >= 4 ? 'high' : 'normal';
      const { allowed, settings } = await this.shouldDeliver(priority, { requiresPush: false });
      if (!allowed) return;

      if (!shouldDeliverNotification(magnitude, loc, time?.getTime(), 'NotificationService')) return;

      // Title & sound based on magnitude
      const icon = magnitude >= 6 ? '🚨' : magnitude >= 5 ? '🟠' : magnitude >= 4 ? '🟡' : '📍';
      const title = isEEW
        ? `🚨 DEPREM UYARISI (${magnitude.toFixed(1)})`
        : `${icon} Deprem: ${magnitude.toFixed(1)} ${loc}`;
      const body = isEEW
        ? `Sarsıntı Bekleniyor! ${loc} (~${Math.max(0, Math.round(timeAdvance || 0))}sn)`
        : `${time ? time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Şimdi'} - Detay için dokunun.`;

      const channelType = priority === 'critical' ? 'eew' as const : 'earthquake' as const;
      const sound = this.resolveSound(settings, priority, isEEW ? 'siren.wav' : 'default');

      await scheduleNotification(
        {
          title,
          body,
          data: { type: isEEW ? 'eew' : 'earthquake', magnitude, location: loc, timestamp: time?.getTime() },
          sound: sound || true,
          priority: priority === 'critical' ? 'max' : priority === 'high' ? 'high' : 'default',
          categoryIdentifier: 'earthquake',
        },
        { channelType },
      );

      if (__DEV__) logger.info(`✅ Earthquake notification: M${magnitude.toFixed(1)} ${loc}`);
    } catch (error) {
      logger.error('Earthquake notification error:', error);
    }
  }

  // ==================== SOS ====================

  async showSOSNotification(from: string, location?: { latitude: number; longitude: number }, message?: string): Promise<void> {
    try {
      if (!from?.trim()) return;
      const sender = from.trim();
      const { allowed } = await this.shouldDeliver('critical', { requiresPush: false });
      if (!allowed) return;

      if (isDuplicate(`sos:${sender}:${(message || '').slice(0, 24)}`, 4000)) return;

      await scheduleNotification(
        {
          title: `🆘 ACİL DURUM: ${sender}`,
          body: message || 'Acil yardım çağrısı alındı. Konumu görmek için dokunun.',
          data: { type: 'sos', from: sender, location },
          sound: 'siren.wav',
          priority: 'max',
          categoryIdentifier: 'sos',
        },
        { channelType: 'sos' },
      );

      if (__DEV__) logger.info(`✅ SOS notification: ${sender}`);
    } catch (error) {
      logger.error('SOS notification error:', error);
    }
  }

  // ==================== MESSAGE ====================

  async showMessageNotification(
    senderName: string,
    messageContent: string,
    messageId: string,
    userId: string,
    priority: 'critical' | 'high' | 'normal' = 'normal',
    isSOS: boolean = false,
  ): Promise<void> {
    try {
      const effectivePriority: NotificationPriority = isSOS || priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : 'normal';
      const { allowed, settings } = await this.shouldDeliver(effectivePriority, {
        requiresPush: !(isSOS || priority === 'critical'),
      });
      if (!allowed) return;

      const sender = senderName?.trim();
      const content = messageContent?.trim();
      if (!sender || !content) return;

      const dedupKey = messageId ? `msg:${messageId}` : `msg:${sender}:${userId}:${content.slice(0, 32)}`;
      if (isDuplicate(dedupKey, 15_000)) return;

      const truncContent = content.length > 140 ? `${content.slice(0, 137)}...` : content;
      const body = settings.notificationShowPreview
        ? truncContent
        : (isSOS ? 'Acil mesajı açmak için dokunun.' : 'Yeni mesajı açmak için dokunun.');

      const channelType = isSOS ? 'sos' as const : effectivePriority === 'critical' ? 'eew' as const : 'message' as const;
      const sound = this.resolveSound(settings, effectivePriority, 'default');

      await scheduleNotification(
        {
          title: isSOS ? `🆘 ${sender}` : `💬 ${sender}`,
          body,
          data: { type: 'message', from: sender, isSOS, messageId, userId, fullContent: content },
          sound: sound || true,
          priority: effectivePriority === 'critical' ? 'max' : effectivePriority === 'high' ? 'high' : 'default',
          categoryIdentifier: 'message',
        },
        { channelType },
      );

      if (__DEV__) logger.info(`✅ Message notification: ${sender}`);
    } catch (error) {
      logger.error('Message notification error:', error);
    }
  }

  // ==================== NEWS ====================

  async showNewsNotification(data: {
    title: string; summary: string; source: string; url?: string; articleId?: string;
  }): Promise<void> {
    try {
      const { allowed, settings } = await this.shouldDeliver('normal');
      if (!allowed) return;
      if (!data?.title?.trim() || !data?.summary?.trim()) return;

      const dedupKey = `news:${data.articleId || `${data.source}:${data.title}`}`;
      if (isDuplicate(dedupKey, 45_000)) return;

      const title = data.title.length > 90 ? `${data.title.slice(0, 87)}...` : data.title;
      const body = settings.notificationShowPreview
        ? (data.summary.length > 120 ? `${data.summary.slice(0, 117)}...` : data.summary)
        : 'Yeni haber detayları için dokunun.';

      await scheduleNotification(
        {
          title: `📰 ${title}`,
          body,
          data: { type: 'news', source: data.source, url: data.url, articleId: data.articleId },
          priority: 'default',
          categoryIdentifier: 'news',
        },
        { channelType: 'news' },
      );
    } catch (error) {
      logger.error('News notification error:', error);
    }
  }

  // ==================== SYSTEM ====================

  async showBatteryLowNotification(level: number): Promise<void> {
    try {
      const { allowed } = await this.shouldDeliver('normal');
      if (!allowed) return;
      if (typeof level !== 'number' || isNaN(level) || level < 0 || level > 100) return;
      if (isDuplicate(`battery:${Math.floor(level / 5)}`, 120_000)) return;

      await scheduleNotification(
        {
          title: '🔋 Düşük Pil',
          body: `Pil seviyesi %${level.toFixed(0)} - Şarj edin`,
          data: { type: 'battery', level },
        },
        { channelType: 'general' },
      );
    } catch (error) {
      logger.error('Battery notification error:', error);
    }
  }

  async showNetworkStatusNotification(isConnected: boolean): Promise<void> {
    try {
      const { allowed } = await this.shouldDeliver('normal');
      if (!allowed) return;
      if (isDuplicate(`network:${isConnected ? 'on' : 'off'}`, 60_000)) return;

      await scheduleNotification(
        {
          title: isConnected ? '🌐 İnternet Bağlandı' : '📡 İnternet Kesildi',
          body: isConnected ? 'Ağ bağlantısı yeniden kuruldu' : 'Offline moda geçildi',
          data: { type: 'network', connected: isConnected },
        },
        { channelType: 'general' },
      );
    } catch (error) {
      logger.error('Network notification error:', error);
    }
  }

  // ==================== FAMILY LOCATION ====================

  async showFamilyLocationUpdateNotification(
    memberName: string,
    location: { latitude: number; longitude: number },
  ): Promise<void> {
    try {
      const { allowed, settings } = await this.shouldDeliver('normal');
      if (!allowed) return;
      if (!memberName?.trim() || !location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') return;

      const name = memberName.trim();
      const locDigest = `${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}`;
      if (isDuplicate(`family-loc:${name}:${locDigest}`, 45_000)) return;

      const body = settings.notificationShowPreview
        ? `Yeni konum: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
        : 'Yeni konum güncellemesi için dokunun.';

      await scheduleNotification(
        {
          title: `📍 ${name} Konum Güncellendi`,
          body,
          data: { type: 'family_location', memberName: name, location },
        },
        { channelType: 'family' },
      );
    } catch (error) {
      logger.error('Family location notification error:', error);
    }
  }

  // ==================== CRITICAL ====================

  async showCriticalNotification(
    title: string,
    body: string,
    options: { sound?: string; vibration?: number[]; critical?: boolean } = {},
  ): Promise<void> {
    try {
      const { allowed } = await this.shouldDeliver('critical', { requiresPush: false });
      if (!allowed) return;
      if (isDuplicate(`critical:${title}:${body.slice(0, 30)}`, 4000)) return;

      await scheduleNotification(
        {
          title,
          body,
          data: { type: 'critical' },
          sound: options.sound || true,
          priority: 'max',
          categoryIdentifier: 'critical',
        },
        { channelType: options.critical ? 'eew' : 'earthquake' },
      );

      if (__DEV__) logger.info(`🚨 CRITICAL: ${title}`);
    } catch (error) {
      logger.error('Critical notification error:', error);
    }
  }

  // ==================== PERMISSIONS ====================

  async requestPermissions(): Promise<boolean> {
    try {
      const Notifications = await getNotificationsAsync();
      if (!Notifications) return false;

      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') return true;

      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
          allowCriticalAlerts: false,
          allowDisplayInCarPlay: false,
          provideAppNotificationSettings: false,
          allowProvisional: false,
        },
        android: {},
      });

      return status === 'granted';
    } catch (error) {
      logger.error('Permission request failed:', error);
      return false;
    }
  }

  // NOTE: Notification tap handling is centralized in NotificationCenter.handleNotificationTap
  // All tap-to-navigate logic lives there as the single source of truth.

  // ==================== CANCEL ====================

  async cancelAllNotifications(): Promise<void> {
    try {
      const Notifications = await getNotificationsAsync();
      if (!Notifications) return;
      if (typeof Notifications.cancelAllScheduledNotificationsAsync === 'function') {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
      if (typeof Notifications.dismissAllNotificationsAsync === 'function') {
        await Notifications.dismissAllNotificationsAsync();
      }
    } catch (error) {
      logger.error('Cancel notifications error:', error);
    }
  }

  async getScheduledNotifications(): Promise<any[]> {
    try {
      const Notifications = await getNotificationsAsync();
      if (!Notifications || typeof Notifications.getAllScheduledNotificationsAsync !== 'function') return [];
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch {
      return [];
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const notificationService = new NotificationService();
