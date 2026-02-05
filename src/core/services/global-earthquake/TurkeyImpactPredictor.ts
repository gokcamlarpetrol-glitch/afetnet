/**
 * TURKEY IMPACT PREDICTOR - ELITE MODULAR
 * Predicts if global earthquakes will affect Turkey using AI and physics
 */

import { GlobalEarthquakeEvent } from './USGSFetcher';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TurkeyImpactPredictor');

export interface TurkeyImpactPrediction {
  willAffect: boolean;
  confidence: number; // 0-100
  estimatedArrivalTime: number; // seconds
  estimatedMagnitude: number; // at Turkey border
  affectedRegions: string[]; // Turkish regions that will be affected
  arrivalTimeUncertainty?: number; // seconds - optional uncertainty in arrival time
}

/**
 * Calculate distance from earthquake to Turkey border
 */
export function calculateDistanceToTurkey(lat: number, lon: number): number {
  if (typeof lat !== 'number' || typeof lon !== 'number' ||
    isNaN(lat) || isNaN(lon) ||
    lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    logger.warn('Invalid coordinates for distance calculation:', { lat, lon });
    return 1000;
  }

  const turkeyCenter = { lat: 39.0, lon: 35.0 };

  const R = 6371; // Earth radius in km
  const dLat = toRad(lat - turkeyCenter.lat);
  const dLon = toRad(lon - turkeyCenter.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(turkeyCenter.lat)) *
    Math.cos(toRad(lat)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  if (isNaN(distance) || distance < 0 || distance > 20000) {
    logger.warn('Invalid distance calculation result:', distance);
    return 1000;
  }

  return distance;
}

/**
 * Calculate ETA for waves to reach Turkey
 */
export function calculateETAForTurkey(distanceKm: number, depthKm: number): number {
  if (typeof distanceKm !== 'number' || typeof depthKm !== 'number' ||
    isNaN(distanceKm) || isNaN(depthKm) ||
    distanceKm < 0 || distanceKm > 20000 || depthKm < 0 || depthKm > 1000) {
    logger.warn('Invalid inputs for ETA calculation:', { distanceKm, depthKm });
    return 0;
  }

  const S_WAVE_VELOCITY = 3.5; // km/s

  const effectiveDistance = Math.sqrt(distanceKm * distanceKm + depthKm * depthKm);
  const eta = Math.round(effectiveDistance / S_WAVE_VELOCITY);

  if (isNaN(eta) || eta < 0 || eta > 3600) {
    logger.warn('Invalid ETA calculation result:', eta);
    return 0;
  }

  return eta;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  if (typeof degrees !== 'number' || isNaN(degrees)) {
    logger.warn('Invalid degrees for radian conversion:', degrees);
    return 0;
  }
  return degrees * (Math.PI / 180);
}

/**
 * AI-powered prediction of Turkey impact
 */
export async function predictTurkeyImpact(event: GlobalEarthquakeEvent): Promise<TurkeyImpactPrediction> {
  if (!event || typeof event.latitude !== 'number' || typeof event.longitude !== 'number') {
    logger.warn('Invalid event for AI prediction:', event);
    return ruleBasedTurkeyImpactPrediction(event);
  }

  try {
    // ELITE: Get backend URL from ENV config (centralized)
    const { ENV } = await import('../../config/env');
    const backendUrl = ENV.API_BASE_URL || ''; // DEPRECATED: Using Firebase

    if (!backendUrl || !backendUrl.startsWith('http')) {
      if (__DEV__) {
        logger.warn('Invalid backend URL, using fallback prediction');
      }
      return ruleBasedTurkeyImpactPrediction(event);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${backendUrl}/api/eew/predict-turkey-impact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AfetNet/1.0',
        },
        body: JSON.stringify({
          latitude: event.latitude,
          longitude: event.longitude,
          magnitude: event.magnitude,
          depth: event.depth || 10,
          distanceToTurkey: event.distanceToTurkey || 0,
          etaToTurkey: event.etaToTurkey || 0,
          source: event.source,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();

        if (data && typeof data === 'object') {
          const prediction = data.prediction || data;

          if (prediction && typeof prediction === 'object') {
            return {
              willAffect: Boolean(prediction.willAffect),
              confidence: Math.max(0, Math.min(100, Number(prediction.confidence) || 0)),
              estimatedArrivalTime: Math.max(0, Number(prediction.estimatedArrivalTime) || event.etaToTurkey || 0),
              estimatedMagnitude: Math.max(0, Math.min(10, Number(prediction.estimatedMagnitude) || event.magnitude)),
              affectedRegions: Array.isArray(prediction.affectedRegions) ? prediction.affectedRegions : [],
            };
          }
        }
      } else {
        if (__DEV__) {
          logger.warn(`Backend AI prediction failed: ${response.status} ${response.statusText}`);
        }
      }
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name !== 'AbortError' && __DEV__) {
        logger.warn('AI prediction fetch failed:', fetchError.message);
      } else if (__DEV__) {
        logger.warn('AI prediction fetch failed:', String(fetchError));
      }
    }
  } catch (error: unknown) {
    if (__DEV__) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('AI prediction error:', errorMessage);
    }
  }

  return ruleBasedTurkeyImpactPrediction(event);
}

/**
 * Rule-based prediction (fallback when AI unavailable)
 */
export function ruleBasedTurkeyImpactPrediction(event: GlobalEarthquakeEvent): TurkeyImpactPrediction {
  if (!event || typeof event.magnitude !== 'number' || isNaN(event.magnitude)) {
    return {
      willAffect: false,
      confidence: 0,
      estimatedArrivalTime: 0,
      estimatedMagnitude: 0,
      affectedRegions: [],
    };
  }

  const distance = Math.max(0, event.distanceToTurkey || 1000);
  const magnitude = Math.max(0, Math.min(10, event.magnitude));
  const eta = Math.max(0, event.etaToTurkey || 0);

  const willAffect = distance < 500 && magnitude >= 4.0 && eta > 0;

  let confidence = 0;
  if (distance < 200 && magnitude >= 5.0) {
    confidence = 90;
  } else if (distance < 300 && magnitude >= 4.5) {
    confidence = 75;
  } else if (distance < 400 && magnitude >= 4.0) {
    confidence = 60;
  } else {
    confidence = 40;
  }

  const affectedRegions = estimateAffectedRegions(event.latitude, event.longitude);

  return {
    willAffect,
    confidence: Math.max(0, Math.min(100, confidence)),
    estimatedArrivalTime: Math.max(0, eta),
    estimatedMagnitude: Math.max(0, Math.min(10, magnitude * 0.9)),
    affectedRegions: Array.isArray(affectedRegions) ? affectedRegions : [],
  };
}

/**
 * Estimate which Turkish regions will be affected
 */
function estimateAffectedRegions(lat: number, lon: number): string[] {
  if (typeof lat !== 'number' || typeof lon !== 'number' ||
    isNaN(lat) || isNaN(lon) ||
    lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return ['Türkiye Geneli'];
  }

  const regions: string[] = [];

  if (lat >= 40 && lon >= 26 && lon <= 30) {
    regions.push('Karadeniz Bölgesi');
  } else if (lat >= 38 && lat <= 42 && lon >= 26 && lon <= 30) {
    regions.push('Marmara Bölgesi');
  } else if (lat >= 36 && lat <= 40 && lon >= 30 && lon <= 36) {
    regions.push('İç Anadolu Bölgesi');
  } else if (lat >= 35 && lat <= 38 && lon >= 26 && lon <= 30) {
    regions.push('Ege Bölgesi');
  } else if (lat >= 35 && lat <= 38 && lon >= 30 && lon <= 44) {
    regions.push('Akdeniz Bölgesi');
  } else if (lat >= 37 && lat <= 40 && lon >= 36 && lon <= 44) {
    regions.push('Doğu Anadolu Bölgesi');
  } else if (lat >= 35 && lat <= 38 && lon >= 40 && lon <= 44) {
    regions.push('Güneydoğu Anadolu Bölgesi');
  }

  return regions.length > 0 ? regions : ['Türkiye Geneli'];
}

