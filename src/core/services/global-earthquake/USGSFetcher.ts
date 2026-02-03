/**
 * USGS FETCHER - ELITE MODULAR
 * Fetches global earthquakes from USGS API
 */

import { createLogger } from '../../utils/logger';
import { ultraLowLatencyOptimizer } from '../UltraLowLatencyOptimizer';

const logger = createLogger('USGSFetcher');

export interface GlobalEarthquakeEvent {
  id: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depth: number;
  time: number;
  region: string;
  source: 'USGS' | 'JMA' | 'EMSC';
  distanceToTurkey?: number;
  etaToTurkey?: number;
  willAffectTurkey?: boolean;
  confidence?: number;
  priority?: boolean;
  alert?: string | null;
  tsunami?: number;
}

const USGS_API = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const USGS_REALTIME_FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';

const EXTENDED_REGION = {
  minLat: 30.0,
  maxLat: 45.0,
  minLon: 20.0,
  maxLon: 50.0,
};

/**
 * Fetch global earthquakes from USGS
 */
export async function fetchFromUSGS(): Promise<GlobalEarthquakeEvent[]> {
  try {
    const realtimeUrl = `${USGS_REALTIME_FEED}`;
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const queryUrl = `${USGS_API}?format=geojson&starttime=${twoHoursAgo.toISOString()}&minmagnitude=3.0&orderby=time&limit=200&minlatitude=${EXTENDED_REGION.minLat}&maxlatitude=${EXTENDED_REGION.maxLat}&minlongitude=${EXTENDED_REGION.minLon}&maxlongitude=${EXTENDED_REGION.maxLon}`;
    
    let url = realtimeUrl;
    let useRealtime = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    let response;
    try {
      response = await ultraLowLatencyOptimizer.optimizedFetch(
        url,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AfetNet/1.0',
          },
          signal: controller.signal,
        },
        'critical',
      );
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if (useRealtime) {
        if (__DEV__) {
          logger.warn('USGS real-time feed failed, falling back to query API');
        }
        url = queryUrl;
        useRealtime = false;
        response = await ultraLowLatencyOptimizer.optimizedFetch(
          url,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'AfetNet/1.0',
            },
          },
          'high',
        );
      } else {
        return [];
      }
    }

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }

    const events: GlobalEarthquakeEvent[] = [];
    for (const feature of data.features) {
      try {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates;
        
        if (!coords || !Array.isArray(coords) || coords.length < 2) {
          if (__DEV__) {
            logger.warn('Invalid USGS event coordinates:', feature);
          }
          continue;
        }

        const lat = Number(coords[1]);
        const lon = Number(coords[0]);
        const depth = Number(coords[2]) || 10;
        const mag = Number(props.mag);
        const eventTime = props.time ? new Date(props.time).getTime() : Date.now();

        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          if (__DEV__) {
            logger.warn('Invalid USGS event coordinates:', { lat, lon });
          }
          continue;
        }

        if (isNaN(mag) || mag < 0 || mag > 10) {
          if (__DEV__) {
            logger.warn('Invalid USGS event magnitude:', mag);
          }
          continue;
        }

        if (isNaN(eventTime) || eventTime <= 0 || eventTime > Date.now() + 60000) {
          if (__DEV__) {
            logger.warn('Invalid USGS event time:', eventTime);
          }
          continue;
        }

        events.push({
          id: `usgs-${feature.id || Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          latitude: lat,
          longitude: lon,
          magnitude: mag,
          depth: depth,
          time: eventTime,
          region: String(props.place || 'Unknown').substring(0, 255),
          source: 'USGS' as const,
          priority: true,
          alert: props.alert || null,
          tsunami: Number(props.tsunami) || 0,
        });
      } catch (error) {
        if (__DEV__) {
          logger.warn('Error parsing USGS event:', error, feature);
        }
      }
    }

    if (useRealtime) {
      return events.filter((e: GlobalEarthquakeEvent) => 
        e.latitude >= EXTENDED_REGION.minLat &&
        e.latitude <= EXTENDED_REGION.maxLat &&
        e.longitude >= EXTENDED_REGION.minLon &&
        e.longitude <= EXTENDED_REGION.maxLon &&
        e.magnitude >= 3.0,
      );
    }

    return events;
  } catch (error) {
    if (__DEV__) {
      logger.warn('USGS fetch error:', error);
    }
    return [];
  }
}









