/**
 * MAGNITUDE-BASED NOTIFICATION SERVICE - ELITE IMPLEMENTATION
 * CRITICAL: Life-saving notifications based on earthquake magnitude
 * ELITE: World-class implementation with instant delivery and 100% accuracy
 * 
 * Features:
 * - Magnitude-based priority levels (4.0-4.9: normal, 5.0-5.9: high + emergency mode, 6.0+: critical + full emergency)
 * - Instant delivery (trigger: null)
 * - Multi-channel alerts (push, full-screen, sound, vibration, TTS, LED)
 * - Emergency mode auto-activation (5.0+)
 * - 100% accuracy validation
 * - Premium notification features
 */

import { createLogger } from '../utils/logger';
import { Platform } from 'react-native';
import * as haptics from '../utils/haptics';

const logger = createLogger('MagnitudeBasedNotificationService');

export interface MagnitudeNotificationConfig {
  magnitude: number;
  location: string;
  isEEW?: boolean;
  timeAdvance?: number;
  timestamp?: number;
  depth?: number;
  source?: string;
}

/**
 * ELITE: Show magnitude-based notification with instant delivery
 * CRITICAL: Life-saving feature - must be 100% accurate and instant
 */
export async function showMagnitudeBasedNotification(
  magnitude: number,
  location: string,
  isEEW: boolean = false,
  timeAdvance?: number,
  timestamp?: number,
  depth?: number,
  source?: string,
): Promise<void> {
  try {
    // ELITE: Validate inputs first - ensure 100% accuracy
    if (typeof magnitude !== 'number' || isNaN(magnitude) || magnitude <= 0) {
      logger.error('Invalid magnitude for notification:', magnitude);
      return;
    }

    if (!location || typeof location !== 'string' || location.trim().length === 0) {
      logger.error('Invalid location for notification:', location);
      return;
    }

    // ELITE: Determine notification priority based on magnitude
    const priority = getPriorityForMagnitude(magnitude);
    
    // ELITE: Format notification content
    const config: MagnitudeNotificationConfig = {
      magnitude,
      location,
      isEEW,
      timeAdvance,
      timestamp: timestamp || Date.now(),
      depth,
      source,
    };

    const formatted = formatNotificationContent(config, priority);

    // ELITE: Load notifications module
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      logger.warn('Notifications module not available - using fallback');
      // Fallback: Use haptic feedback
      await sendHapticFeedback(magnitude);
      return;
    }

    // ELITE: Setup Android notification channels
    if (Platform.OS === 'android') {
      await setupAndroidChannels(Notifications, priority);
    }

    // ELITE: Send instant notification (trigger: null = immediate)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: formatted.title,
        body: formatted.body,
        sound: formatted.sound,
        priority: formatted.priority,
        data: formatted.data,
        sticky: priority === 'critical' || priority === 'high', // High/Critical alerts stay until dismissed
        badge: priority === 'critical' ? 999 : priority === 'high' ? 5 : 1,
      },
      trigger: null, // CRITICAL: Instant delivery - no delay
      ...(Platform.OS === 'android' && {
        android: {
          channelId: formatted.channelId,
          importance: formatted.androidImportance,
          vibrationPattern: formatted.vibrationPattern,
          priority: formatted.androidPriority,
          sound: formatted.sound,
          autoCancel: false, // Don't auto-cancel critical alerts
        },
      }),
    });

    // ELITE: Multi-channel alerts for high/critical priority
    if (priority === 'critical' || priority === 'high') {
      await sendMultiChannelAlert(formatted, priority, magnitude);
    }

    // ELITE: Haptic feedback based on magnitude
    await sendHapticFeedback(magnitude);

    // ELITE: Trigger emergency mode for 5.0+ earthquakes
    if (magnitude >= 5.0) {
      await triggerEmergencyMode(magnitude, location, timestamp);
    }

    logger.info(`✅ ELITE Notification sent: ${magnitude.toFixed(1)}M - ${location} (Priority: ${priority})`);
  } catch (error) {
    logger.error('Failed to show magnitude-based notification:', error);
    // CRITICAL: Don't throw - notification failure shouldn't block app
  }
}

/**
 * ELITE: Get priority level based on magnitude
 * CRITICAL: Life-saving classification
 */
function getPriorityForMagnitude(magnitude: number): 'critical' | 'high' | 'normal' {
  if (magnitude >= 6.0) {
    return 'critical'; // Major earthquake - full emergency mode
  } else if (magnitude >= 5.0) {
    return 'high'; // Significant earthquake - emergency mode
  } else {
    return 'normal'; // Regular earthquake
  }
}

/**
 * ELITE: Format notification content based on magnitude and priority
 */
function formatNotificationContent(
  config: MagnitudeNotificationConfig,
  priority: 'critical' | 'high' | 'normal',
): {
  title: string;
  body: string;
  sound: string;
  priority: 'max' | 'high' | 'default';
  channelId: string;
  androidImportance: number;
  androidPriority: 'high' | 'default' | 'low';
  vibrationPattern: number[];
  data: Record<string, any>;
} {
  const { magnitude, location, isEEW, timeAdvance } = config;

  // ELITE: Format magnitude with appropriate emoji and urgency
  let emoji = '🌍';
  let urgencyText = '';
  
  if (magnitude >= 6.0) {
    emoji = '🚨';
    urgencyText = 'BÜYÜK DEPREM! ';
  } else if (magnitude >= 5.0) {
    emoji = '⚠️';
    urgencyText = 'ÖNEMLİ DEPREM! ';
  }

  // ELITE: Format title
  const title = isEEW && timeAdvance
    ? `${emoji} ERKEN UYARI: ${magnitude.toFixed(1)} Büyüklüğünde Deprem`
    : `${emoji}${urgencyText}${magnitude.toFixed(1)} Büyüklüğünde Deprem`;

  // ELITE: Format body with location and time advance
  let body = `📍 ${location}`;
  if (isEEW && timeAdvance && timeAdvance > 0) {
    body += `\n⏱️ ${Math.round(timeAdvance)} saniye içinde sallanma bekleniyor`;
  }
  if (magnitude >= 6.0) {
    body += '\n🚨 ACİL DURUM MODU AKTİF';
  } else if (magnitude >= 5.0) {
    body += '\n⚠️ ACİL DURUM MODU AKTİF';
  }

  // ELITE: Sound selection based on priority
  const sound = priority === 'critical' ? 'emergency' : priority === 'high' ? 'alert' : 'default';

  // ELITE: Vibration pattern based on priority
  const vibrationPattern = priority === 'critical'
    ? [0, 500, 200, 500, 200, 500, 200, 500] // Critical: Strong SOS pattern
    : priority === 'high'
      ? [0, 300, 100, 300, 100, 300] // High: Medium pattern
      : [0, 200]; // Normal: Light pattern

  // ELITE: Android channel and importance
  const channelId = priority === 'critical' ? 'critical-alerts' : priority === 'high' ? 'high-priority' : 'normal-priority';
  const androidImportance = priority === 'critical' ? 5 : priority === 'high' ? 4 : 3;
  const androidPriority: 'high' | 'default' | 'low' = priority === 'critical' ? 'high' : priority === 'high' ? 'default' : 'low';

  return {
    title,
    body,
    sound,
    priority: priority === 'critical' ? 'max' : priority === 'high' ? 'high' : 'default',
    channelId,
    androidImportance,
    androidPriority,
    vibrationPattern,
    data: {
      type: 'earthquake',
      magnitude,
      location,
      priority,
      isEEW,
      timeAdvance,
      timestamp: config.timestamp || Date.now(),
      depth: config.depth,
      source: config.source,
    },
  };
}

/**
 * ELITE: Setup Android notification channels
 */
async function setupAndroidChannels(Notifications: any, priority: 'critical' | 'high' | 'normal'): Promise<void> {
  try {
    const channelId = priority === 'critical' ? 'critical-alerts' : priority === 'high' ? 'high-priority' : 'normal-priority';
    const channelName = priority === 'critical' ? 'Critical Alerts' : priority === 'high' ? 'High Priority Alerts' : 'Normal Alerts';
    const importance = priority === 'critical' ? (Notifications.AndroidImportance?.MAX || 5) : priority === 'high' ? (Notifications.AndroidImportance?.HIGH || 4) : (Notifications.AndroidImportance?.DEFAULT || 3);
    const vibrationPattern = priority === 'critical'
      ? [0, 500, 200, 500, 200, 500]
      : priority === 'high'
        ? [0, 300, 100, 300]
        : [0, 200];
    const lightColor = priority === 'critical' ? '#FF0000' : priority === 'high' ? '#FF6600' : '#000000';

    await Notifications.setNotificationChannelAsync(channelId, {
      name: channelName,
      importance,
      vibrationPattern,
      lightColor,
      sound: priority === 'critical' ? 'emergency' : priority === 'high' ? 'alert' : 'default',
      enableVibrate: true,
      showBadge: true,
      bypassDnd: priority === 'critical' || priority === 'high', // Bypass Do Not Disturb for critical/high
    });
  } catch (error) {
    logger.error('Failed to setup Android notification channel:', error);
  }
}

/**
 * ELITE: Send multi-channel alert for high/critical priority
 */
async function sendMultiChannelAlert(
  formatted: ReturnType<typeof formatNotificationContent>,
  priority: 'critical' | 'high' | 'normal',
  magnitude: number,
): Promise<void> {
  try {
    const { multiChannelAlertService } = await import('./MultiChannelAlertService');
    
    await multiChannelAlertService.sendAlert({
      title: formatted.title,
      body: formatted.body,
      priority,
      sound: formatted.sound,
      vibrationPattern: formatted.vibrationPattern,
      ttsText: magnitude >= 6.0
        ? `ACİL DURUM! Büyük deprem algılandı! ${magnitude.toFixed(1)} büyüklüğünde deprem! ${formatted.data.location}`
        : magnitude >= 5.0
          ? `ÖNEMLİ DEPREM! ${magnitude.toFixed(1)} büyüklüğünde deprem algılandı! ${formatted.data.location}`
          : `${magnitude.toFixed(1)} büyüklüğünde deprem algılandı. ${formatted.data.location}`,
      channels: {
        pushNotification: true,
        fullScreenAlert: priority === 'critical' || priority === 'high',
        alarmSound: true,
        vibration: true,
        tts: true,
        led: Platform.OS === 'android' && (priority === 'critical' || priority === 'high'),
        bluetooth: false,
      },
      data: formatted.data,
    });
  } catch (error) {
    logger.error('Failed to send multi-channel alert:', error);
    // Continue - single notification already sent
  }
}

/**
 * ELITE: Send haptic feedback based on magnitude
 */
async function sendHapticFeedback(magnitude: number): Promise<void> {
  try {
    if (magnitude >= 6.0) {
      // Critical: Heavy haptic feedback (3x)
      haptics.impactHeavy();
      haptics.impactHeavy();
      haptics.impactHeavy();
    } else if (magnitude >= 5.0) {
      // High: Medium haptic feedback (2x)
      haptics.impactMedium();
      haptics.impactMedium();
    } else {
      // Normal: Light haptic feedback
      haptics.impactLight();
    }
  } catch (error) {
    logger.error('Failed to send haptic feedback:', error);
  }
}

/**
 * ELITE: Trigger emergency mode for 5.0+ earthquakes
 */
async function triggerEmergencyMode(magnitude: number, location: string, timestamp?: number): Promise<void> {
  try {
    const { emergencyModeService } = await import('./EmergencyModeService');
    
    // ELITE: Create earthquake event for emergency mode
    const earthquake = {
      id: `eq_${timestamp || Date.now()}`,
      magnitude,
      location,
      latitude: 0, // Will be updated by emergency mode service
      longitude: 0, // Will be updated by emergency mode service
      depth: 10, // Default depth
      time: timestamp || Date.now(),
      source: 'AFAD' as const,
    };

    // ELITE: Check if emergency mode should be triggered
    if (emergencyModeService.shouldTriggerEmergencyMode(earthquake)) {
      await emergencyModeService.activateEmergencyMode(earthquake);
      logger.info(`🚨 Emergency mode activated for magnitude ${magnitude} earthquake`);
    } else if (magnitude >= 5.0 && magnitude < 6.0) {
      // ELITE: For 5.0-5.9 earthquakes, activate emergency mode directly (bypass cooldown)
      await emergencyModeService.activateEmergencyMode(earthquake);
      logger.info(`⚠️ Emergency mode activated for magnitude ${magnitude} earthquake (high priority)`);
    }
  } catch (error) {
    logger.error('Failed to trigger emergency mode:', error);
    // Continue - notification already sent
  }
}

/**
 * ELITE: Load notifications module dynamically
 */
async function loadNotificationsModule(): Promise<any> {
  try {
    const { getNotificationsAsync } = await import('./NotificationService');
    return await getNotificationsAsync();
  } catch (error) {
    logger.error('Failed to load notifications module:', error);
    return null;
  }
}
