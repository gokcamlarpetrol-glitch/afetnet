/**
 * EARTHQUAKE NOTIFICATION HANDLER - ELITE MODULAR
 * Handles notifications for new earthquakes
 */

import { DirectStorage } from '../../utils/storage';
import { Earthquake } from '../../stores/earthquakeStore';
import { createLogger } from '../../utils/logger';
import { autoCheckinService } from '../AutoCheckinService';

const logger = createLogger('EarthquakeNotificationHandler');
const LAST_CHECKED_KEY = 'last_checked_earthquake';

// PRODUCTION FIX: Global notification rate limiter to prevent floods
const MAX_NOTIFICATIONS_PER_HOUR = 3;
const NOTIFICATION_DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes per earthquake ID
const notificationTimestamps: number[] = [];
const recentlyNotifiedIds = new Map<string, number>(); // earthquake ID → timestamp

/**
 * Process notifications and auto-checkin for new earthquakes
 */
export async function processEarthquakeNotifications(
  earthquakes: Earthquake[],
  settings: {
    minMagnitudeForNotification: number;
    maxDistanceForNotification: number;
    criticalMagnitudeThreshold: number;
    criticalDistanceThreshold: number;
    eewMinMagnitude: number;
    eewWarningTime: number;
    priorityCritical: 'critical' | 'high' | 'normal';
    priorityHigh: 'critical' | 'high' | 'normal';
    priorityMedium: 'high' | 'normal' | 'low';
    priorityLow: 'normal' | 'low';
    notificationPush: boolean;
  },
): Promise<void> {
  if (earthquakes.length === 0) {
    return;
  }

  const latestEq = earthquakes[0];
  const lastCheckedEq = DirectStorage.getString(LAST_CHECKED_KEY) ?? null;

  // NOTIFICATION GATEWAY FIX: Skip stale earthquakes (older than 15 minutes)
  // This prevents the notification flood when the app is reopened and
  // re-fetches historical earthquake data that was already notified.
  const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
  const earthquakeAge = Date.now() - latestEq.time;
  if (earthquakeAge > STALE_THRESHOLD_MS) {
    if (__DEV__) {
      logger.info(`⏭️ Stale earthquake skipped: M${latestEq.magnitude.toFixed(1)} ${latestEq.location} (${Math.round(earthquakeAge / 60000)}min old)`);
    }
    // Still update the last-checked marker so we don't re-check it
    DirectStorage.setString(LAST_CHECKED_KEY, latestEq.id);
    return;
  }

  if (__DEV__) {
    logger.info('🔝 EN SON DEPREM:', {
      location: latestEq.location,
      magnitude: latestEq.magnitude,
      time: new Date(latestEq.time).toLocaleString('tr-TR'),
    });
  }

  // Check if this is a new earthquake
  if (latestEq.id !== lastCheckedEq) {
    DirectStorage.setString(LAST_CHECKED_KEY, latestEq.id);
    let epicenterDistanceKm: number | null = null;

    // Send notification if magnitude meets threshold
    if (latestEq.magnitude >= settings.minMagnitudeForNotification) {
      let shouldNotify = true;
      const isCriticalBySettings = latestEq.magnitude >= settings.criticalMagnitudeThreshold;
      const selectedPriority: 'critical' | 'high' | 'normal' | 'low' =
        isCriticalBySettings
          ? settings.priorityCritical
          : latestEq.magnitude >= 5.0
            ? settings.priorityHigh
            : latestEq.magnitude >= 4.0
              ? settings.priorityMedium
              : settings.priorityLow;
      if (settings.maxDistanceForNotification > 0) {
        // ELITE: Distance-based filtering with magnitude-scaled thresholds
        try {
          const { locationService } = await import('../LocationService');
          const userLoc = locationService.getCurrentLocation();
          if (userLoc && userLoc.latitude !== 0 && userLoc.longitude !== 0) {
            const { calculateDistance } = await import('../../utils/locationUtils');
            const distKm = calculateDistance(userLoc.latitude, userLoc.longitude, latestEq.latitude, latestEq.longitude);
            epicenterDistanceKm = distKm;
            // ELITE: Magnitude-scaled maximum notification distance
            const maxDistKm = latestEq.magnitude >= 7.0 ? 2000
              : latestEq.magnitude >= 6.0 ? 1000
                : latestEq.magnitude >= 5.0 ? 500
                  : Math.min(settings.maxDistanceForNotification, 200);
            const effectiveMaxDistKm = isCriticalBySettings
              ? Math.max(maxDistKm, settings.criticalDistanceThreshold)
              : maxDistKm;
            if (distKm > effectiveMaxDistKm) {
              shouldNotify = false;
              logger.info(`📍 Distance filter: M${latestEq.magnitude.toFixed(1)} is ${distKm.toFixed(0)}km away (max: ${effectiveMaxDistKm}km) — skipping`);
            }
          }
          // If userLoc is null/zero → fail-open, notify anyway
        } catch {
          // Fail-open: location check failed, still notify for safety
        }
      }

      if (shouldNotify && settings.notificationPush) {
        // PRODUCTION FIX: Rate limiter — max 3 notifications per hour (except critical M6.0+)
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;

        // Clean up old timestamps and dedup entries
        while (notificationTimestamps.length > 0 && notificationTimestamps[0] < oneHourAgo) {
          notificationTimestamps.shift();
        }
        for (const [id, ts] of recentlyNotifiedIds) {
          if (now - ts > NOTIFICATION_DEDUP_WINDOW_MS) {
            recentlyNotifiedIds.delete(id);
          }
        }

        // Check dedup: skip if same earthquake notified within 10 min
        if (recentlyNotifiedIds.has(latestEq.id)) {
          logger.info(`⏭️ Notification dedup: earthquake ${latestEq.id} already notified within 10 min — skipping`);
          shouldNotify = false;
        }

        // Check rate limit (bypass for critical M6.0+ emergencies)
        if (shouldNotify && notificationTimestamps.length >= MAX_NOTIFICATIONS_PER_HOUR && latestEq.magnitude < 6.0) {
          logger.info(`⏭️ Notification rate limit: ${notificationTimestamps.length}/${MAX_NOTIFICATIONS_PER_HOUR} per hour — skipping M${latestEq.magnitude.toFixed(1)}`);
          shouldNotify = false;
        }
      }

      if (shouldNotify && settings.notificationPush) {
        // Record notification for rate limiting
        notificationTimestamps.push(Date.now());
        recentlyNotifiedIds.set(latestEq.id, Date.now());
        try {
          // ELITE: Use unified notification center
          const { notificationCenter } = await import('../notifications/NotificationCenter');
          await notificationCenter.notify('earthquake', {
            magnitude: latestEq.magnitude,
            location: latestEq.location,
            isEEW: latestEq.magnitude >= settings.eewMinMagnitude && selectedPriority === 'critical',
            timeAdvance: latestEq.magnitude >= settings.eewMinMagnitude ? settings.eewWarningTime : undefined,
            timestamp: latestEq.time,
            latitude: latestEq.latitude,
            longitude: latestEq.longitude,
            depth: latestEq.depth,
            source: latestEq.source || 'AFAD',
            earthquakeId: latestEq.id,
          }, 'EarthquakeNotificationHandler');
          logger.info(`✅ Notification sent: ${latestEq.magnitude.toFixed(1)}M - ${latestEq.location}`);
        } catch (error) {
          logger.error('Failed to send notification:', error);
        }
      }
    }

    // ELITE: Trigger auto check-in for significant earthquakes (4.0+)
    // NOTE: Emergency mode (5.0+) is now handled INTERNALLY by
    // MagnitudeBasedNotificationService.triggerEmergencyMode().
    // Do NOT call activateEmergencyMode here — it causes double-triggering.
    if (latestEq.magnitude >= 4.0) {
      let shouldRunProximityActions = true;
      if (epicenterDistanceKm != null) {
        const maxActionDistanceKm = latestEq.magnitude >= 7.0 ? 2000
          : latestEq.magnitude >= 6.0 ? 800
            : latestEq.magnitude >= 5.0 ? 400
              : 250;
        const effectiveActionDistanceKm = latestEq.magnitude >= settings.criticalMagnitudeThreshold
          ? Math.max(maxActionDistanceKm, settings.criticalDistanceThreshold)
          : maxActionDistanceKm;
        if (epicenterDistanceKm > effectiveActionDistanceKm) {
          shouldRunProximityActions = false;
          logger.info(`📍 Proximity guard: skipping auto-checkin (${epicenterDistanceKm.toFixed(0)}km, max ${effectiveActionDistanceKm}km)`);
        }
      } else {
        const isInTurkey = latestEq.latitude >= 35.8 && latestEq.latitude <= 42.1
          && latestEq.longitude >= 25.6 && latestEq.longitude <= 44.8;
        if (!isInTurkey && latestEq.magnitude < 6.5) {
          shouldRunProximityActions = false;
          logger.info('📍 Proximity guard: no user location + non-Turkey event, skipping auto-checkin');
        }
      }

      if (!shouldRunProximityActions) {
        return;
      }

      try {
        logger.info(`Triggering AutoCheckin for magnitude ${latestEq.magnitude} earthquake`);
        autoCheckinService.startCheckIn(latestEq.magnitude).catch((error) => {
          logger.error('AutoCheckin failed:', error);
        });
      } catch (error) {
        logger.error('Failed to trigger auto check-in:', error);
      }
    }
  }
}
