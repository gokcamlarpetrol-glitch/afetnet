/**
 * Normalization Module
 * Converts raw API responses to unified earthquake model
 */

import { NormalizedEarthquake, RawEarthquakeEvent, EarthquakeSource } from '../types/earthquake';
import { logger } from '../utils/logger';

export class NormalizationService {
  /**
   * Normalize raw earthquake events from all sources
   */
  normalize(events: RawEarthquakeEvent[]): NormalizedEarthquake[] {
    const normalized: NormalizedEarthquake[] = [];

    for (const event of events) {
      try {
        const normalizedEvent = this.normalizeEvent(event);
        if (normalizedEvent) {
          normalized.push(normalizedEvent);
        }
      } catch (error: any) {
        logger.warn(`Failed to normalize event from ${event.source}`, {
          error: error.message,
          eventId: event.data?.id,
        });
      }
    }

    return normalized;
  }

  /**
   * Normalize a single event based on source
   */
  private normalizeEvent(event: RawEarthquakeEvent): NormalizedEarthquake | null {
    switch (event.source) {
      case 'USGS':
        return this.normalizeUSGS(event);
      case 'Ambee':
        return this.normalizeAmbee(event);
      case 'Xweather':
        return this.normalizeXweather(event);
      case 'Zyla':
        return this.normalizeZyla(event);
      default:
        logger.warn(`Unknown source: ${event.source}`);
        return null;
    }
  }

  /**
   * Normalize USGS GeoJSON format
   */
  private normalizeUSGS(event: RawEarthquakeEvent): NormalizedEarthquake | null {
    const feature = event.data;
    if (!feature || !feature.properties || !feature.geometry) {
      return null;
    }

    const props = feature.properties;
    const coords = feature.geometry.coordinates; // [lon, lat, depth]

    const timestamp = props.time || Date.now();
    const magnitude = props.mag;
    const latitude = coords[1];
    const longitude = coords[0];
    const depth = coords[2] || null;

    if (!this.isValid(magnitude, latitude, longitude)) {
      return null;
    }

    return {
      id: `usgs-${feature.id}`,
      timestamp: timestamp,
      magnitude: magnitude,
      latitude: latitude,
      longitude: longitude,
      depthKm: depth ? depth / 1000 : null, // Convert meters to km
      source: 'USGS',
      originalId: feature.id,
      location: props.place,
      detectedAt: event.fetchedAt,
      latencyMs: event.latencyMs,
    };
  }

  /**
   * Normalize Ambee format
   */
  private normalizeAmbee(event: RawEarthquakeEvent): NormalizedEarthquake | null {
    const eq = event.data;
    if (!eq) {
      return null;
    }

    const timestamp = this.parseTimestamp(eq.time);
    const magnitude = eq.magnitude;
    const latitude = eq.latitude;
    const longitude = eq.longitude;
    const depth = eq.depth || null;

    if (!this.isValid(magnitude, latitude, longitude)) {
      return null;
    }

    return {
      id: `ambee-${eq.id}`,
      timestamp: timestamp,
      magnitude: magnitude,
      latitude: latitude,
      longitude: longitude,
      depthKm: depth,
      source: 'Ambee',
      originalId: eq.id,
      location: eq.location,
      detectedAt: event.fetchedAt,
      latencyMs: event.latencyMs,
    };
  }

  /**
   * Normalize Xweather format
   */
  private normalizeXweather(event: RawEarthquakeEvent): NormalizedEarthquake | null {
    const eq = event.data;
    if (!eq) {
      return null;
    }

    const timestamp = this.parseTimestamp(eq.timestamp);
    const magnitude = eq.magnitude;
    const latitude = eq.lat;
    const longitude = eq.lon;
    const depth = eq.depth || null;

    if (!this.isValid(magnitude, latitude, longitude)) {
      return null;
    }

    return {
      id: `xweather-${eq.id}`,
      timestamp: timestamp,
      magnitude: magnitude,
      latitude: latitude,
      longitude: longitude,
      depthKm: depth,
      source: 'Xweather',
      originalId: eq.id,
      location: eq.location,
      detectedAt: event.fetchedAt,
      latencyMs: event.latencyMs,
    };
  }

  /**
   * Normalize Zyla format
   */
  private normalizeZyla(event: RawEarthquakeEvent): NormalizedEarthquake | null {
    const eq = event.data;
    if (!eq) {
      return null;
    }

    const timestamp = this.parseTimestamp(eq.time);
    const magnitude = eq.magnitude;
    const latitude = eq.latitude;
    const longitude = eq.longitude;
    const depth = eq.depth || null;

    if (!this.isValid(magnitude, latitude, longitude)) {
      return null;
    }

    return {
      id: `zyla-${eq.id}`,
      timestamp: timestamp,
      magnitude: magnitude,
      latitude: latitude,
      longitude: longitude,
      depthKm: depth,
      source: 'Zyla',
      originalId: eq.id,
      location: eq.location,
      detectedAt: event.fetchedAt,
      latencyMs: event.latencyMs,
    };
  }

  /**
   * Parse timestamp from various formats
   */
  private parseTimestamp(time: string | number): number {
    if (typeof time === 'number') {
      // Assume milliseconds if > 1e12, otherwise seconds
      return time > 1e12 ? time : time * 1000;
    }

    // Try ISO8601
    const parsed = Date.parse(time);
    if (!isNaN(parsed)) {
      return parsed;
    }

    // Fallback to current time
    logger.warn(`Failed to parse timestamp: ${time}`);
    return Date.now();
  }

  /**
   * Validate earthquake data
   */
  private isValid(magnitude: number, latitude: number, longitude: number): boolean {
    return (
      !isNaN(magnitude) &&
      magnitude >= 0 &&
      magnitude <= 10 &&
      !isNaN(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      !isNaN(longitude) &&
      longitude >= -180 &&
      longitude <= 180
    );
  }
}

export const normalizationService = new NormalizationService();









