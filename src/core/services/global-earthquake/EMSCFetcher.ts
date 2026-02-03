/**
 * EMSC FETCHER - ELITE MODULAR
 * Fetches global earthquakes from EMSC API
 */

import { createLogger } from '../../utils/logger';
import { ultraLowLatencyOptimizer } from '../UltraLowLatencyOptimizer';
import { GlobalEarthquakeEvent } from './USGSFetcher';

const logger = createLogger('EMSCFetcher');

const EMSC_API = 'https://www.seismicportal.eu/fdsnws/event/1/query';
const EMSC_REALTIME_FEED = 'https://www.seismicportal.eu/fdsnws/event/1/query?format=geojson&limit=200';

const EXTENDED_REGION = {
  minLat: 30.0,
  maxLat: 45.0,
  minLon: 20.0,
  maxLon: 50.0,
};

// ELITE: Exponential backoff for EMSC API failures
let emscFailureCount = 0;
let lastEmscFailureTime = 0;
const EMSC_BACKOFF_BASE = 60000; // 1 minute base
const EMSC_MAX_BACKOFF = 600000; // 10 minutes max

function shouldSkipEMSC(): boolean {
  if (emscFailureCount === 0) return false;

  const backoffTime = Math.min(
    EMSC_BACKOFF_BASE * Math.pow(2, emscFailureCount - 1),
    EMSC_MAX_BACKOFF,
  );

  const timeSinceFailure = Date.now() - lastEmscFailureTime;
  return timeSinceFailure < backoffTime;
}

function recordEMSCFailure(): void {
  emscFailureCount++;
  lastEmscFailureTime = Date.now();
  if (__DEV__) {
    const nextRetryIn = Math.min(
      EMSC_BACKOFF_BASE * Math.pow(2, emscFailureCount - 1),
      EMSC_MAX_BACKOFF,
    );
    logger.debug(`EMSC API failed ${emscFailureCount} times. Next retry in ${Math.round(nextRetryIn / 1000)}s`);
  }
}

function recordEMSCSuccess(): void {
  if (emscFailureCount > 0) {
    if (__DEV__) {
      logger.info('EMSC API recovered after failures');
    }
    emscFailureCount = 0;
    lastEmscFailureTime = 0;
  }
}

/**
 * Fetch earthquakes from EMSC
 * ELITE: With exponential backoff to prevent excessive API calls on repeated failures
 */
export async function fetchFromEMSC(): Promise<GlobalEarthquakeEvent[]> {
  // ELITE: Skip if in backoff period
  if (shouldSkipEMSC()) {
    if (__DEV__) {
      logger.debug('EMSC API skipped (in backoff period)');
    }
    return [];
  }
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const realtimeUrl = `${EMSC_REALTIME_FEED}&starttime=${twoHoursAgo.toISOString()}&minmagnitude=3.0&minlatitude=${EXTENDED_REGION.minLat}&maxlatitude=${EXTENDED_REGION.maxLat}&minlongitude=${EXTENDED_REGION.minLon}&maxlongitude=${EXTENDED_REGION.maxLon}`;
    const queryUrl = `${EMSC_API}?format=geojson&starttime=${twoHoursAgo.toISOString()}&minmagnitude=3.0&orderby=time&limit=200&minlatitude=${EXTENDED_REGION.minLat}&maxlatitude=${EXTENDED_REGION.maxLat}&minlongitude=${EXTENDED_REGION.minLon}&maxlongitude=${EXTENDED_REGION.maxLon}`;

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
          logger.debug('EMSC real-time feed failed, falling back to query API');
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
      recordEMSCFailure(); // ELITE: Record failure for backoff
      if (__DEV__) {
        logger.debug(`EMSC API returned ${response.status}: ${response.statusText} (expected in some scenarios)`);
      }
      return [];
    }

    // ELITE: Record success - reset backoff counter
    recordEMSCSuccess();

    let data: any;
    try {
      const responseText = await response.text();
      if (!responseText || responseText.trim().length === 0) {
        if (__DEV__) {
          logger.debug('EMSC API returned empty response (no earthquakes in time window)');
        }
        return [];
      }

      try {
        data = JSON.parse(responseText);
      } catch (parseError: unknown) {
        if (__DEV__) {
          const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
          logger.debug('EMSC JSON parse error (truncated response - expected):', errorMessage);
        }
        return [];
      }
    } catch (textError: unknown) {
      if (__DEV__) {
        const errorMessage = textError instanceof Error ? textError.message : String(textError);
        logger.debug('EMSC response text read error (expected):', errorMessage);
      }
      return [];
    }

    if (!data || typeof data !== 'object' || !data.features || !Array.isArray(data.features)) {
      if (__DEV__) {
        logger.debug('EMSC API returned invalid data structure (no earthquakes in time window)');
      }
      return [];
    }

    if (data.features.length === 0) {
      if (__DEV__) {
        logger.debug('EMSC API returned empty features array (no earthquakes in time window)');
      }
      return [];
    }

    const events: GlobalEarthquakeEvent[] = [];
    for (const feature of data.features) {
      try {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates;

        if (!coords || !Array.isArray(coords) || coords.length < 2) {
          if (__DEV__) {
            logger.debug('Invalid EMSC event coordinates (filtered):', feature?.id || 'unknown');
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
            logger.debug('Invalid EMSC event coordinates (filtered):', { lat, lon });
          }
          continue;
        }

        if (isNaN(mag) || mag < 0 || mag > 10) {
          if (__DEV__) {
            logger.debug('Invalid EMSC event magnitude (filtered):', mag);
          }
          continue;
        }

        if (isNaN(eventTime) || eventTime <= 0 || eventTime > Date.now() + 60000) {
          if (__DEV__) {
            logger.debug('Invalid EMSC event time (filtered):', eventTime);
          }
          continue;
        }

        events.push({
          id: `emsc-${feature.id || Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          latitude: lat,
          longitude: lon,
          magnitude: mag,
          depth: depth,
          time: eventTime,
          region: String(props.place || 'Unknown').substring(0, 255),
          source: 'EMSC' as const,
          priority: true,
        });
      } catch (error: unknown) {
        if (__DEV__) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.debug('Error parsing EMSC event (filtered):', errorMessage, feature?.id || 'unknown');
        }
      }
    }

    return events;
  } catch (error: unknown) {
    recordEMSCFailure(); // ELITE: Record failure for backoff
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('JSON Parse error') || errorMsg.includes('Unexpected end')) {
      if (__DEV__) {
        logger.debug('EMSC JSON parse error (silent):', errorMsg);
      }
    } else {
      if (__DEV__) {
        logger.debug('EMSC fetch error (expected):', errorMsg);
      }
    }
    return [];
  }
}

