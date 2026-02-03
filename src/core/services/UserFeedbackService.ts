/**
 * USER FEEDBACK SERVICE - LastQuake-style "I felt it" system
 * Allows users to report felt earthquakes and share intensity data
 * This helps improve detection accuracy and provides community-based verification
 */

import { createLogger } from '../utils/logger';
import { firebaseDataService } from './FirebaseDataService';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId } from '../utils/device';

const logger = createLogger('UserFeedbackService');

export interface FeltEarthquakeReport {
  earthquakeId: string;
  deviceId: string;
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
  };
  intensity: 'weak' | 'moderate' | 'strong' | 'very_strong' | 'severe';
  feltDuration: number; // seconds
  effects: string[]; // e.g., ['shaking', 'objects_fell', 'difficult_to_stand']
  comments?: string;
}

export interface IntensityData {
  earthquakeId: string;
  reports: FeltEarthquakeReport[];
  averageIntensity: number;
  reportCount: number;
  lastUpdated: number;
}

class UserFeedbackService {
  private readonly STORAGE_KEY = 'felt_earthquake_reports';
  private readonly COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown per earthquake

  /**
   * Report a felt earthquake (LastQuake "I felt it" feature)
   */
  async reportFeltEarthquake(
    earthquakeId: string,
    intensity: FeltEarthquakeReport['intensity'],
    feltDuration: number,
    effects: string[] = [],
    comments?: string,
  ): Promise<boolean> {
    try {
      // Check cooldown to prevent spam
      const cooldownKey = `felt_cooldown_${earthquakeId}`;
      const lastReportTime = await AsyncStorage.getItem(cooldownKey);
      if (lastReportTime) {
        const timeSinceLastReport = Date.now() - parseInt(lastReportTime, 10);
        if (timeSinceLastReport < this.COOLDOWN_MS) {
          logger.warn('Report cooldown active - please wait before reporting again');
          return false;
        }
      }

      // Get user location
      let location: { latitude: number; longitude: number } | null = null;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        }
      } catch (error) {
        logger.error('Failed to get location for felt report:', error);
      }

      // Get device ID
      const deviceId = await getDeviceId();
      if (!deviceId) {
        logger.error('Cannot report felt earthquake: no device ID');
        return false;
      }

      // Create report
      const report: FeltEarthquakeReport = {
        earthquakeId,
        deviceId,
        timestamp: Date.now(),
        location: location || { latitude: 0, longitude: 0 },
        intensity,
        feltDuration,
        effects,
        comments,
      };

      // Save to Firebase
      if (firebaseDataService.isInitialized) {
        try {
          await firebaseDataService.saveFeltEarthquakeReport(report);
          logger.info(`✅ Felt earthquake report saved: ${earthquakeId} - ${intensity}`);
        } catch (error) {
          logger.error('Failed to save felt report to Firebase:', error);
          // Save locally for later sync
          await this.saveReportLocally(report);
        }
      } else {
        // Save locally for later sync
        await this.saveReportLocally(report);
      }

      // CRITICAL: Send to backend for rescue coordination
      // ELITE: This helps rescue teams understand earthquake impact
      try {
        const { backendEmergencyService } = await import('./BackendEmergencyService');
        if (backendEmergencyService.initialized) {
          // Map intensity string to number (1-10 scale)
          const intensityMap: Record<string, number> = {
            'weak': 2,
            'moderate': 4,
            'strong': 6,
            'very_strong': 8,
            'severe': 10,
          };
          const intensityValue = intensityMap[intensity] || 1;

          await backendEmergencyService.sendFeltEarthquakeReport({
            earthquakeId,
            intensity: intensityValue,
            feltDuration,
            effects,
            comments,
            location: report.location,
            timestamp: report.timestamp,
          }).catch((error) => {
            logger.error('Failed to send felt earthquake report to backend:', error);
          });
        }
      } catch (error) {
        logger.error('Failed to send felt earthquake report to backend:', error);
      }

      // Set cooldown
      await AsyncStorage.setItem(cooldownKey, String(Date.now()));

      // Track analytics
      try {
        const { firebaseAnalyticsService } = await import('./FirebaseAnalyticsService');
        firebaseAnalyticsService.logEvent('felt_earthquake_reported', {
          earthquakeId,
          intensity,
          feltDuration: String(feltDuration),
          effectsCount: String(effects.length),
        });
      } catch {
        // Ignore analytics errors
      }

      return true;
    } catch (error) {
      logger.error('Failed to report felt earthquake:', error);
      return false;
    }
  }

  /**
   * Get intensity data for an earthquake (community-based)
   */
  async getIntensityData(earthquakeId: string): Promise<IntensityData | null> {
    try {
      if (firebaseDataService.isInitialized) {
        return await firebaseDataService.getIntensityData(earthquakeId);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get intensity data:', error);
      return null;
    }
  }

  /**
   * Save report locally for later sync
   */
  private async saveReportLocally(report: FeltEarthquakeReport): Promise<void> {
    try {
      const existingReportsJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      const existingReports: FeltEarthquakeReport[] = existingReportsJson
        ? JSON.parse(existingReportsJson)
        : [];

      existingReports.push(report);

      // Keep only last 100 reports
      const recentReports = existingReports.slice(-100);

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentReports));
    } catch (error) {
      logger.error('Failed to save report locally:', error);
    }
  }

  /**
   * Sync local reports to Firebase
   */
  async syncLocalReports(): Promise<void> {
    try {
      const reportsJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!reportsJson) return;

      const reports: FeltEarthquakeReport[] = JSON.parse(reportsJson);
      if (reports.length === 0) return;

      if (!firebaseDataService.isInitialized) {
        logger.warn('Firebase not initialized - cannot sync reports');
        return;
      }

      // Sync all reports
      for (const report of reports) {
        try {
          await firebaseDataService.saveFeltEarthquakeReport(report);
        } catch (error) {
          logger.error(`Failed to sync report ${report.earthquakeId}:`, error);
        }
      }

      // Clear synced reports
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      logger.info(`✅ Synced ${reports.length} felt earthquake reports`);
    } catch (error) {
      logger.error('Failed to sync local reports:', error);
    }
  }

  /**
   * Check if user has already reported this earthquake
   */
  async hasReported(earthquakeId: string): Promise<boolean> {
    try {
      const cooldownKey = `felt_cooldown_${earthquakeId}`;
      const lastReportTime = await AsyncStorage.getItem(cooldownKey);
      if (!lastReportTime) return false;

      const timeSinceLastReport = Date.now() - parseInt(lastReportTime, 10);
      return timeSinceLastReport < this.COOLDOWN_MS;
    } catch {
      return false;
    }
  }
}

export const userFeedbackService = new UserFeedbackService();

