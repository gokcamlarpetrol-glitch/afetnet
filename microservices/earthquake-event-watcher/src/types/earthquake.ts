/**
 * Unified Earthquake Event Model
 * Normalized format for all API sources
 */

export type EarthquakeSource = 'USGS' | 'Ambee' | 'Xweather' | 'Zyla' | 'AI-EARLY';

export interface NormalizedEarthquake {
  id: string;
  timestamp: number; // Unix milliseconds
  magnitude: number;
  latitude: number;
  longitude: number;
  depthKm: number | null;
  source: EarthquakeSource;
  originalId?: string; // Original ID from source API
  location?: string; // Human-readable location
  detectedAt: number; // When this service detected it (Unix milliseconds)
  latencyMs?: number; // Detection latency in milliseconds
}

export interface RawEarthquakeEvent {
  source: EarthquakeSource;
  data: any; // Raw API response
  fetchedAt: number; // When fetched (Unix milliseconds)
  latencyMs: number; // Request latency
}

export interface DeduplicationKey {
  lat: number;
  lon: number;
  time: number; // Rounded to deduplication window
}

export interface PrioritizedEvent extends NormalizedEarthquake {
  priorityScore: number; // Lower = faster detection
  duplicateSources: EarthquakeSource[]; // Other sources that detected same event
}

