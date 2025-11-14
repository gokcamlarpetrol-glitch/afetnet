/**
 * TURKEY RELEVANCE CHECKER - ELITE MODULAR
 * Checks if global earthquakes are relevant for Turkey
 */

import { GlobalEarthquakeEvent } from './USGSFetcher';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TurkeyRelevanceChecker');

const TURKEY_BOUNDS = {
  minLat: 35.0,
  maxLat: 43.0,
  minLon: 25.0,
  maxLon: 45.0,
};

const EXTENDED_REGION = {
  minLat: 30.0,
  maxLat: 45.0,
  minLon: 20.0,
  maxLon: 50.0,
};

/**
 * Check if earthquake is relevant for Turkey
 */
export function isRelevantForTurkey(event: GlobalEarthquakeEvent): boolean {
  if (!event || typeof event.latitude !== 'number' || typeof event.longitude !== 'number' ||
      typeof event.magnitude !== 'number' || typeof event.time !== 'number' ||
      isNaN(event.latitude) || isNaN(event.longitude) || isNaN(event.magnitude) || isNaN(event.time)) {
    return false;
  }

  const isCriticalMagnitude = event.magnitude >= 4.0;

  const insideTurkey = 
    event.latitude >= TURKEY_BOUNDS.minLat &&
    event.latitude <= TURKEY_BOUNDS.maxLat &&
    event.longitude >= TURKEY_BOUNDS.minLon &&
    event.longitude <= TURKEY_BOUNDS.maxLon;

  const inExtendedRegion = 
    event.latitude >= EXTENDED_REGION.minLat &&
    event.latitude <= EXTENDED_REGION.maxLat &&
    event.longitude >= EXTENDED_REGION.minLon &&
    event.longitude <= EXTENDED_REGION.maxLon;

  const magnitudeThreshold = isCriticalMagnitude ? 3.0 : 3.5;
  const timeWindow = isCriticalMagnitude ? 2 * 60 * 60 * 1000 : 60 * 60 * 1000;

  const significantMagnitude = event.magnitude >= magnitudeThreshold;
  const eventAge = Date.now() - event.time;
  const recent = eventAge >= 0 && eventAge < timeWindow;

  return (insideTurkey || inExtendedRegion) && significantMagnitude && recent;
}









