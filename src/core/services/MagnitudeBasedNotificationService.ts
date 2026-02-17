/**
 * MAGNITUDE-BASED NOTIFICATION SERVICE
 * Earthquake notifications with magnitude-based priority, formatting,
 * multi-channel alerts, haptic feedback, and emergency mode activation.
 *
 * Delegates to:
 *  - NotificationService: dedup, module loading
 *  - NotificationScheduler: push delivery
 *  - MultiChannelAlertService: sound, TTS, LED
 */

import { createLogger } from '../utils/logger';
import { Platform } from 'react-native';
import { shouldDeliverNotification, getNotificationsAsync } from './NotificationService';
import { scheduleNotification } from './notifications/NotificationScheduler';
import * as haptics from '../utils/haptics';

const logger = createLogger('MagnitudeBasedNotificationService');

// ============================================================================
// RATE LIMITER
// ============================================================================
const RATE = {
  COOLDOWN_MS: 120_000,
  MAX_PER_WINDOW: 3,
  WINDOW_MS: 5 * 60 * 1000,
  CRITICAL_BYPASS_MAG: 6.0,
};

let _lastTime = 0;
const _timestamps: number[] = [];

function isRateLimited(magnitude: number): boolean {
  if (magnitude >= RATE.CRITICAL_BYPASS_MAG) return false;
  const now = Date.now();
  if (now - _lastTime < RATE.COOLDOWN_MS) return true;
  while (_timestamps.length > 0 && _timestamps[0] < now - RATE.WINDOW_MS) _timestamps.shift();
  return _timestamps.length >= RATE.MAX_PER_WINDOW;
}

function recordSent(): void {
  const now = Date.now();
  _lastTime = now;
  _timestamps.push(now);
}

// ============================================================================
// TYPES
// ============================================================================

export interface MagnitudeNotificationConfig {
  magnitude: number;
  location: string;
  isEEW?: boolean;
  timeAdvance?: number;
  timestamp?: number;
  depth?: number;
  source?: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function showMagnitudeBasedNotification(
  magnitude: number,
  location: string,
  isEEW: boolean = false,
  timeAdvance?: number,
  timestamp?: number,
  depth?: number,
  source?: string,
  latitude?: number,
  longitude?: number,
): Promise<void> {
  try {
    if (typeof magnitude !== 'number' || isNaN(magnitude) || magnitude <= 0) return;
    if (!location?.trim()) return;

    const loc = location.trim();

    // Cross-system dedup
    if (!shouldDeliverNotification(magnitude, loc, timestamp, 'MBN')) return;

    // Rate limit
    if (isRateLimited(magnitude)) {
      if (__DEV__) logger.debug(`⏭️ Rate limited: M${magnitude.toFixed(1)}`);
      return;
    }

    // Settings check
    const settings = await getSettings();
    if (!settings.notificationsEnabled || settings.notificationMode === 'silent') return;

    const priority = getPriority(magnitude);
    if (settings.notificationMode === 'critical-only' && priority !== 'critical') return;

    recordSent();

    // Format & send push notification
    const fmt = formatContent(magnitude, loc, isEEW, timeAdvance, priority);

    if (settings.notificationPush) {
      const channelType = priority === 'critical' ? 'eew' as const : priority === 'high' ? 'earthquake' as const : 'general' as const;
      await scheduleNotification(
        {
          title: fmt.title,
          body: fmt.body,
          sound: 'default',
          priority: priority === 'critical' ? 'max' : priority === 'high' ? 'high' : 'default',
          data: { type: 'earthquake', magnitude, location: loc, priority, isEEW, timeAdvance, timestamp: timestamp || Date.now(), depth, source },
        },
        { channelType },
      );
    }

    // Multi-channel for high/critical
    if (priority === 'critical' || priority === 'high') {
      try {
        const { multiChannelAlertService } = await import('./MultiChannelAlertService');
        await multiChannelAlertService.sendAlert({
          title: fmt.title,
          body: fmt.body,
          priority,
          sound: 'default',
          soundVolume: settings.notificationSoundVolume,
          soundRepeat: settings.notificationSoundRepeat,
          vibrationPattern: fmt.vibration,
          ttsText: magnitude >= 6.0
            ? `ACİL DURUM! ${magnitude.toFixed(1)} büyüklüğünde deprem! ${loc}`
            : `ÖNEMLİ DEPREM! ${magnitude.toFixed(1)} büyüklüğünde deprem! ${loc}`,
          channels: {
            pushNotification: false,
            fullScreenAlert: true,
            alarmSound: settings.notificationMode !== 'vibrate',
            vibration: settings.notificationMode !== 'sound',
            tts: true,
            led: Platform.OS === 'android',
            bluetooth: false,
          },
          data: { type: 'earthquake', magnitude, location: loc },
        });
      } catch (e) {
        logger.error('Multi-channel alert failed:', e);
      }
    }

    // Haptic feedback
    sendHaptic(magnitude);

    // Emergency mode (5.0+)
    if (magnitude >= 5.0) {
      triggerEmergency(magnitude, loc, timestamp, latitude, longitude).catch(e =>
        logger.error('Emergency mode trigger failed:', e),
      );
    }

    logger.info(`✅ M${magnitude.toFixed(1)} ${loc} (${priority})`);
  } catch (error) {
    logger.error('MagnitudeBasedNotification error:', error);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getPriority(mag: number): 'critical' | 'high' | 'normal' {
  return mag >= 6.0 ? 'critical' : mag >= 5.0 ? 'high' : 'normal';
}

function formatContent(
  magnitude: number,
  location: string,
  isEEW: boolean,
  timeAdvance: number | undefined,
  priority: 'critical' | 'high' | 'normal',
): { title: string; body: string; vibration: number[] } {
  const emoji = magnitude >= 6.0 ? '🚨' : magnitude >= 5.0 ? '⚠️' : '🌍';
  const urgency = magnitude >= 6.0 ? 'BÜYÜK DEPREM! ' : magnitude >= 5.0 ? 'ÖNEMLİ DEPREM! ' : '';

  const title = isEEW && timeAdvance
    ? `${emoji} ERKEN UYARI: ${magnitude.toFixed(1)} Büyüklüğünde Deprem`
    : `${emoji}${urgency}${magnitude.toFixed(1)} Büyüklüğünde Deprem`;

  let body = `📍 ${location}`;
  if (isEEW && timeAdvance && timeAdvance > 0) body += `\n⏱️ ${Math.round(timeAdvance)} saniye içinde sallanma bekleniyor`;
  if (magnitude >= 5.0) body += `\n${magnitude >= 6.0 ? '🚨' : '⚠️'} ACİL DURUM MODU AKTİF`;

  const vibration = priority === 'critical'
    ? [0, 500, 200, 500, 200, 500, 200, 500]
    : priority === 'high'
      ? [0, 300, 100, 300, 100, 300]
      : [0, 200];

  return { title, body, vibration };
}

function sendHaptic(magnitude: number): void {
  try {
    if (magnitude >= 6.0) { haptics.impactHeavy(); haptics.impactHeavy(); haptics.impactHeavy(); }
    else if (magnitude >= 5.0) { haptics.impactMedium(); haptics.impactMedium(); }
    else haptics.impactLight();
  } catch { /* non-critical */ }
}

async function triggerEmergency(
  magnitude: number,
  location: string,
  timestamp?: number,
  latitude?: number,
  longitude?: number,
): Promise<void> {
  const { emergencyModeService } = await import('./EmergencyModeService');
  const earthquake = {
    id: `eq_${timestamp || Date.now()}`,
    magnitude,
    location,
    latitude: latitude ?? 0,
    longitude: longitude ?? 0,
    depth: 10,
    time: timestamp || Date.now(),
    source: 'AFAD' as const,
  };
  if (emergencyModeService.shouldTriggerEmergencyMode(earthquake)) {
    await emergencyModeService.activateEmergencyMode(earthquake);
    logger.info(`🚨 Emergency mode activated for M${magnitude.toFixed(1)}`);
  }
}

async function getSettings() {
  try {
    const { useSettingsStore } = await import('../stores/settingsStore');
    const s = useSettingsStore.getState();
    return {
      notificationsEnabled: s.notificationsEnabled as boolean,
      notificationPush: s.notificationPush as boolean,
      notificationMode: s.notificationMode as string,
      notificationSoundVolume: (s.notificationSoundVolume as number) || 80,
      notificationSoundRepeat: (s.notificationSoundRepeat as number) || 3,
    };
  } catch {
    return { notificationsEnabled: true, notificationPush: true, notificationMode: 'sound+vibrate', notificationSoundVolume: 80, notificationSoundRepeat: 3 };
  }
}
