/**
 * ETA ESTIMATION SERVICE - Elite Early Warning
 * Calculates estimated time of arrival for earthquake waves
 * Based on P-wave and S-wave velocities and user distance from epicenter
 * 
 * P-wave velocity: ~6 km/s
 * S-wave velocity: ~3.5 km/s
 * 
 * This allows us to warn users BEFORE waves reach them
 */

import { createLogger } from '../utils/logger';
import * as Location from 'expo-location';

const logger = createLogger('ETAEstimationService');

// Wave velocities (km/s)
const P_WAVE_VELOCITY = 6.0; // km/s - Primary waves (faster, less destructive)
const S_WAVE_VELOCITY = 3.5; // km/s - Secondary waves (slower, more destructive)

// Alert levels based on time remaining (Google AEA style)
export enum AlertLevel {
  NONE = 'none',
  CAUTION = 'caution', // "Dikkatli Ol" - 30+ seconds
  ACTION = 'action', // "Harekete Geç" - 10-30 seconds
  IMMINENT = 'imminent', // "Çok Yakın" - < 10 seconds
}

export interface ETAEstimate {
  pWaveETA: number; // seconds until P-wave arrives
  sWaveETA: number; // seconds until S-wave arrives
  distance: number; // km from epicenter
  alertLevel: AlertLevel;
  recommendedAction: string;
}

class ETAEstimationService {
  /**
   * Calculate ETA for earthquake waves based on epicenter and user location
   */
  async calculateETA(
    epicenter: { latitude: number; longitude: number },
    userLocation?: { latitude: number; longitude: number } | null,
  ): Promise<ETAEstimate | null> {
    try {
      // Get user location if not provided
      let location = userLocation;
      if (!location) {
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
          } else {
            logger.warn('Location permission not granted - cannot calculate ETA');
            return null;
          }
        } catch (error) {
          logger.error('Failed to get user location for ETA:', error);
          return null;
        }
      }

      // Calculate distance from epicenter (Haversine formula)
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        epicenter.latitude,
        epicenter.longitude,
      );

      // Calculate ETA for P-wave and S-wave
      const pWaveETA = Math.round((distance / P_WAVE_VELOCITY) * 100) / 100; // seconds
      const sWaveETA = Math.round((distance / S_WAVE_VELOCITY) * 100) / 100; // seconds

      // Determine alert level (Google AEA style)
      const alertLevel = this.getAlertLevel(sWaveETA);
      const recommendedAction = this.getRecommendedAction(alertLevel, distance);

      return {
        pWaveETA,
        sWaveETA,
        distance: Math.round(distance * 100) / 100, // km, 2 decimal places
        alertLevel,
        recommendedAction,
      };
    } catch (error) {
      logger.error('ETA calculation error:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Determine alert level based on time remaining (Google AEA style)
   */
  private getAlertLevel(secondsRemaining: number): AlertLevel {
    if (secondsRemaining < 10) {
      return AlertLevel.IMMINENT; // "Çok Yakın" - < 10 seconds
    } else if (secondsRemaining < 30) {
      return AlertLevel.ACTION; // "Harekete Geç" - 10-30 seconds
    } else if (secondsRemaining < 60) {
      return AlertLevel.CAUTION; // "Dikkatli Ol" - 30-60 seconds
    } else {
      return AlertLevel.NONE; // No immediate danger
    }
  }

  /**
   * Get recommended action based on alert level and distance
   */
  private getRecommendedAction(alertLevel: AlertLevel, distance: number): string {
    switch (alertLevel) {
    case AlertLevel.IMMINENT:
      return distance < 50
        ? 'Deprem çok yakın! Hemen güvenli yere geçin ve çök-kapan-tutun pozisyonu alın!'
        : 'Deprem dalgaları yaklaşıyor! Güvenli yere geçin!';
      
    case AlertLevel.ACTION:
      return distance < 50
        ? 'Deprem yaklaşıyor! Güvenli yere geçin, pencerelerden uzak durun!'
        : 'Deprem dalgaları yaklaşıyor. Güvenli yere geçmeye hazırlanın!';
      
    case AlertLevel.CAUTION:
      return distance < 50
        ? 'Deprem yaklaşıyor. Güvenli yere geçmeye hazırlanın.'
        : 'Deprem dalgaları yaklaşıyor. Dikkatli olun.';
      
    default:
      return 'Deprem tespit edildi. Durumu takip edin.';
    }
  }

  /**
   * Format ETA message for user
   */
  formatETAMessage(eta: ETAEstimate, magnitude: number): string {
    const sWaveSeconds = Math.round(eta.sWaveETA);
    const pWaveSeconds = Math.round(eta.pWaveETA);
    
    if (eta.alertLevel === AlertLevel.IMMINENT) {
      return `🚨🚨🚨 DEPREM ÇOK YAKIN! ${sWaveSeconds} saniye içinde ulaşabilir! 🚨🚨🚨`;
    } else if (eta.alertLevel === AlertLevel.ACTION) {
      return `⚠️ Deprem yaklaşıyor! ${sWaveSeconds} saniye içinde ulaşabilir. Güvenli yere geçin!`;
    } else if (eta.alertLevel === AlertLevel.CAUTION) {
      return `⚠️ Deprem tespit edildi. ${sWaveSeconds} saniye içinde ulaşabilir. Dikkatli olun.`;
    } else {
      return `Deprem tespit edildi. ${magnitude.toFixed(1)} büyüklüğünde, ${Math.round(eta.distance)} km uzaklıkta.`;
    }
  }
}

export const etaEstimationService = new ETAEstimationService();

