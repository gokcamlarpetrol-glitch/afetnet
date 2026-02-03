/**
 * EEW EVENT PROCESSOR - ELITE EDITION
 * Handles event normalization and processing for Early Earthquake Warning
 */

import { createLogger } from '../../utils/logger';
import { eliteWaveCalculationService, type EliteWaveCalculationResult } from '../EliteWaveCalculationService';

const logger = createLogger('EEWEventProcessor');

// Event types
export interface RawEarthquakeData {
  eventId?: string;
  id?: string;
  eventID?: string;
  lat?: number;
  latitude?: number;
  lng?: number;
  lon?: number;
  longitude?: number;
  mag?: number;
  magnitude?: number;
  depth?: number;
  location?: string;
  region?: string;
  title?: string;
  date?: string;
  time?: string;
  timestamp?: number;
  issuedAt?: number;
  created_at?: string;
  source?: string;
}

export interface EEWEvent {
  id: string;
  latitude: number;
  longitude: number;
  magnitude?: number;
  depth?: number;
  region?: string;
  source: string;
  issuedAt: number;
  etaSec?: number;
  certainty?: 'low' | 'medium' | 'high';
  waveCalculation?: EliteWaveCalculationResult;
}

// Event deduplication
const seenEvents = new Set<string>();
const MAX_SEEN_EVENTS = 1000;

/**
 * ELITE: Normalize raw earthquake data to standard EEWEvent format
 */
export function normalizeEvent(data: RawEarthquakeData): EEWEvent | null {
  try {
    // Extract ID
    const id = data.eventId || data.id || data.eventID || `eew-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Extract coordinates
    const latitude = data.lat ?? data.latitude;
    const longitude = data.lng ?? data.lon ?? data.longitude;

    if (latitude === undefined || longitude === undefined) {
      logger.debug('Event missing coordinates:', id);
      return null;
    }

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
      isNaN(latitude) || isNaN(longitude)) {
      logger.debug('Invalid coordinates:', { latitude, longitude });
      return null;
    }

    // Extract magnitude
    const magnitude = data.mag ?? data.magnitude;

    // Extract depth
    const depth = data.depth;

    // Extract region/location
    const region = data.region || data.location || data.title;

    // Extract timestamp
    let issuedAt: number;
    if (data.issuedAt) {
      issuedAt = data.issuedAt;
    } else if (data.timestamp) {
      issuedAt = data.timestamp;
    } else if (data.date || data.time) {
      const dateStr = data.date ? `${data.date}${data.time ? ` ${data.time}` : ''}` : data.time;
      issuedAt = dateStr ? new Date(dateStr).getTime() : Date.now();
    } else if (data.created_at) {
      issuedAt = new Date(data.created_at).getTime();
    } else {
      issuedAt = Date.now();
    }

    // Validate timestamp
    if (isNaN(issuedAt) || issuedAt <= 0) {
      issuedAt = Date.now();
    }

    // Determine source
    const source = data.source || 'AFAD';

    return {
      id,
      latitude,
      longitude,
      magnitude: typeof magnitude === 'number' && !isNaN(magnitude) ? magnitude : undefined,
      depth: typeof depth === 'number' && !isNaN(depth) ? depth : undefined,
      region,
      source,
      issuedAt,
    };
  } catch (error) {
    logger.error('Event normalization error:', error);
    return null;
  }
}

/**
 * ELITE: Normalize array of raw events
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeEvents(data: any): EEWEvent[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawEvents: any[] = [];

    if (Array.isArray(data)) {
      rawEvents = data;
    } else if (data?.result && Array.isArray(data.result)) {
      rawEvents = data.result;
    } else if (data?.data && Array.isArray(data.data)) {
      rawEvents = data.data;
    }

    return rawEvents
      .map(raw => normalizeEvent(raw))
      .filter((event): event is EEWEvent => event !== null);
  } catch (error) {
    logger.error('Events normalization error:', error);
    return [];
  }
}

/**
 * ELITE: Check if event has been seen (deduplication)
 */
export function isEventSeen(eventId: string): boolean {
  return seenEvents.has(eventId);
}

/**
 * ELITE: Mark event as seen
 */
export function markEventSeen(eventId: string): void {
  // Prevent memory leak
  if (seenEvents.size >= MAX_SEEN_EVENTS) {
    const iterator = seenEvents.values();
    for (let i = 0; i < 100; i++) {
      const value = iterator.next().value;
      if (value) seenEvents.delete(value);
    }
  }

  seenEvents.add(eventId);
}

/**
 * ELITE: Clear seen events cache
 */
export function clearSeenEvents(): void {
  seenEvents.clear();
}

/**
 * ELITE: Enhance event with wave calculations
 */
export async function enhanceWithWaveCalculation(
  event: EEWEvent,
  userLocation: { latitude: number; longitude: number },
): Promise<EEWEvent> {
  try {
    if (!event.magnitude || !event.depth) {
      return event;
    }

    const waveCalc = await eliteWaveCalculationService.calculateWaves(
      {
        latitude: event.latitude,
        longitude: event.longitude,
        depth: event.depth,
        magnitude: event.magnitude,
        originTime: event.issuedAt,
      },
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      },
    );

    return {
      ...event,
      waveCalculation: waveCalc ?? undefined,
      etaSec: waveCalc?.sWaveArrivalTime,
      certainty: determineCertainty(event.magnitude, waveCalc?.epicentralDistance),
    };
  } catch (error) {
    logger.debug('Wave calculation failed:', error);
    return event;
  }
}

/**
 * ELITE: Determine event certainty based on magnitude and distance
 */
function determineCertainty(
  magnitude: number | undefined,
  distance: number | undefined,
): 'low' | 'medium' | 'high' {
  if (!magnitude) return 'low';

  if (magnitude >= 5.0) {
    return 'high';
  } else if (magnitude >= 4.0) {
    return distance && distance < 100 ? 'high' : 'medium';
  } else if (magnitude >= 3.0) {
    return distance && distance < 50 ? 'medium' : 'low';
  }

  return 'low';
}

/**
 * ELITE: Filter significant events (for notifications)
 */
export function filterSignificantEvents(
  events: EEWEvent[],
  minMagnitude: number = 3.0,
): EEWEvent[] {
  return events.filter(event => {
    // Skip already seen events
    if (isEventSeen(event.id)) {
      return false;
    }

    // Skip low magnitude events
    if (event.magnitude && event.magnitude < minMagnitude) {
      return false;
    }

    return true;
  });
}
