/**
 * EARTHQUAKE NOTIFICATION HANDLER - ELITE MODULAR
 * Handles notifications for new earthquakes
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Earthquake } from '../../stores/earthquakeStore';
import { createLogger } from '../../utils/logger';
import { autoCheckinService } from '../AutoCheckinService';
import { emergencyModeService } from '../EmergencyModeService';

const logger = createLogger('EarthquakeNotificationHandler');
const LAST_CHECKED_KEY = 'last_checked_earthquake';

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
  const lastCheckedEq = await AsyncStorage.getItem(LAST_CHECKED_KEY);

  if (__DEV__) {
    logger.info('🔝 EN SON DEPREM:', {
      location: latestEq.location,
      magnitude: latestEq.magnitude,
      time: new Date(latestEq.time).toLocaleString('tr-TR'),
    });
  }

  // Check if this is a new earthquake
  if (latestEq.id !== lastCheckedEq) {
    await AsyncStorage.setItem(LAST_CHECKED_KEY, latestEq.id);
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
        try {
          // ELITE: Use magnitude-based notification system
          // CRITICAL: Instant delivery, 100% accuracy, emergency mode for 5.0+
          const { showMagnitudeBasedNotification } = await import('../MagnitudeBasedNotificationService');
          await showMagnitudeBasedNotification(
            latestEq.magnitude,
            latestEq.location,
            latestEq.magnitude >= settings.eewMinMagnitude && selectedPriority === 'critical',
            latestEq.magnitude >= settings.eewMinMagnitude ? settings.eewWarningTime : undefined,
            latestEq.time, // Timestamp - CRITICAL for instant delivery
          ).catch(async (error) => {
            logger.error('Failed to show magnitude-based notification:', error);
            // Fallback to standard notification
            try {
              const { notificationService } = await import('../NotificationService');
              await notificationService.showEarthquakeNotification(
                latestEq.magnitude,
                latestEq.location,
                new Date(latestEq.time),
              );
            } catch (fallbackError) {
              logger.error('Failed to show fallback notification:', fallbackError);
            }
          });
          logger.info(`✅ ELITE Magnitude-based notification sent: ${latestEq.magnitude.toFixed(1)}M - ${latestEq.location}`);
        } catch (error) {
          logger.error('Failed to load notification service:', error);
        }
      }
    }

    // ELITE: Trigger auto check-in and emergency mode for significant earthquakes
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
          logger.info(`📍 Proximity guard: skipping auto-checkin/emergency (${epicenterDistanceKm.toFixed(0)}km, max ${effectiveActionDistanceKm}km)`);
        }
      } else {
        const isInTurkey = latestEq.latitude >= 35.8 && latestEq.latitude <= 42.1
          && latestEq.longitude >= 25.6 && latestEq.longitude <= 44.8;
        if (!isInTurkey && latestEq.magnitude < 6.5) {
          shouldRunProximityActions = false;
          logger.info('📍 Proximity guard: no user location + non-Turkey event, skipping auto-checkin/emergency');
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

        // 🚨 CRITICAL: Trigger emergency mode for significant earthquakes (5.0+)
        // ELITE: 5.0-5.9: High priority emergency mode
        // ELITE: 6.0+: Critical priority emergency mode
        const forceCriticalPolicy = latestEq.magnitude >= settings.criticalMagnitudeThreshold
          && settings.priorityCritical !== 'normal';
        if (forceCriticalPolicy || emergencyModeService.shouldTriggerEmergencyMode(latestEq, epicenterDistanceKm)) {
          const priority = latestEq.magnitude >= 6.0 ? 'CRITICAL' : 'HIGH';
          logger.info(`🚨 ${priority} EARTHQUAKE DETECTED: ${latestEq.magnitude}M - Activating emergency mode`);
          emergencyModeService.activateEmergencyMode(latestEq).catch((error) => {
            logger.error('Emergency mode activation failed:', error);
          });
        }
      } catch (error) {
        logger.error('Failed to trigger auto check-in or emergency mode:', error);
      }
    }
  }
}
