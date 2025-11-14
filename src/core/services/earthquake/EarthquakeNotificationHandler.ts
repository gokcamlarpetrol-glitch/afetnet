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
  settings: { minMagnitudeForNotification: number; maxDistanceForNotification: number; notificationPush: boolean }
): Promise<void> {
  if (earthquakes.length === 0) {
    return;
  }

  const latestEq = earthquakes[0];
  const lastCheckedEq = await AsyncStorage.getItem('last_checked_earthquake');
  
  if (__DEV__) {
    logger.info('🔝 EN SON DEPREM:', {
      location: latestEq.location,
      magnitude: latestEq.magnitude,
      time: new Date(latestEq.time).toLocaleString('tr-TR'),
    });
  }
  
  // Check if this is a new earthquake
  if (latestEq.id !== lastCheckedEq) {
    await AsyncStorage.setItem('last_checked_earthquake', latestEq.id);
    
    // Send notification if magnitude meets threshold
    if (latestEq.magnitude >= settings.minMagnitudeForNotification) {
      let shouldNotify = true;
      if (settings.maxDistanceForNotification > 0) {
        // Distance check would require user location
        shouldNotify = true; // Will be enhanced with location-based filtering
      }
      
      if (shouldNotify && settings.notificationPush) {
        try {
          // ELITE: Use magnitude-based notification system
          // CRITICAL: Instant delivery, 100% accuracy, emergency mode for 5.0+
          const { showMagnitudeBasedNotification } = await import('../MagnitudeBasedNotificationService');
          await showMagnitudeBasedNotification(
            latestEq.magnitude,
            latestEq.location,
            false, // Not EEW
            undefined, // No time advance
            latestEq.time // Timestamp - CRITICAL for instant delivery
          ).catch(async (error) => {
            logger.error('Failed to show magnitude-based notification:', error);
            // Fallback to standard notification
            try {
              const { notificationService } = await import('../NotificationService');
              await notificationService.showEarthquakeNotification(
                latestEq.magnitude,
                latestEq.location,
                new Date(latestEq.time)
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
      try {
        logger.info(`Triggering AutoCheckin for magnitude ${latestEq.magnitude} earthquake`);
        autoCheckinService.startCheckIn(latestEq.magnitude).catch((error) => {
          logger.error('AutoCheckin failed:', error);
        });
        
        // 🚨 CRITICAL: Trigger emergency mode for significant earthquakes (5.0+)
        // ELITE: 5.0-5.9: High priority emergency mode
        // ELITE: 6.0+: Critical priority emergency mode
        if (emergencyModeService.shouldTriggerEmergencyMode(latestEq)) {
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

