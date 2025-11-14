/**
 * UNIFIED EARTHQUAKE API PROVIDER
 * Uses third-party API that combines AFAD and Kandilli data
 * More reliable than direct HTML parsing
 * API: https://api.orhanaydogdu.com.tr/deprem/
 * Source: https://github.com/orhanayd/kandilli-rasathanesi-api
 */

import { createLogger } from '../../utils/logger';
import { Earthquake } from '../../stores/earthquakeStore';
import { parseAFADDate } from '../../utils/timeUtils';

const logger = createLogger('UnifiedEarthquakeAPI');

interface UnifiedAPIResponse {
  status: boolean;
  httpStatus: number;
  result: Array<{
    earthquake_id: string;
    provider: 'kandilli' | 'afad';
    title: string;
    mag: number;
    depth: number;
    geojson: {
      type: string;
      coordinates: [number, number]; // [lon, lat]
    };
    date_time: string;
    location_properties?: {
      closestCity?: {
        name: string;
        cityCode: number;
        distance: number;
      };
    };
  }>;
  metadata?: {
    total: number;
    count: number;
  };
}

export class UnifiedEarthquakeAPI {
  name = 'Unified-API';
  private readonly baseUrl = 'https://api.orhanaydogdu.com.tr/deprem';
  private readonly timeout = 30000; // 30 seconds
  
  // ELITE: Smart endpoint selection - avoid /latest if it's consistently failing
  private useLatestEndpoint = true;
  private latestEndpointFailures = 0;
  private readonly MAX_LATEST_FAILURES = 3;

  /**
   * Fetch recent earthquakes from unified API (AFAD + Kandilli combined)
   * ELITE: Uses official API from https://github.com/orhanayd/kandilli-rasathanesi-api
   * Provides fastest and most reliable data from both sources
   * OPTIMIZED: Smart endpoint selection to avoid redundant 404 calls
   */
  async fetchRecent(): Promise<Earthquake[]> {
    try {
      // ELITE: Skip /latest if it failed multiple times, go directly to /search
      if (!this.useLatestEndpoint || this.latestEndpointFailures >= this.MAX_LATEST_FAILURES) {
        if (__DEV__ && this.latestEndpointFailures >= this.MAX_LATEST_FAILURES) {
          logger.debug(`ℹ️ Unified API /latest disabled after ${this.latestEndpointFailures} failures, using /search directly`);
        }
        return await this.fetchAFADOnly();
      }
      
      // CRITICAL: Use /data/latest endpoint - combines AFAD + Kandilli in one call
      // This is the fastest way to get data from both sources
      // API Documentation: https://github.com/orhanayd/kandilli-rasathanesi-api#-api-endpoints
      const url = `${this.baseUrl}/data/latest`;
      
      if (__DEV__) {
        logger.debug(`📡 Unified API çağrılıyor (latest): ${url}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // ELITE: Track /latest failures - if it fails too many times, disable it
        this.latestEndpointFailures++;
        
        // ELITE: 404 is expected - /latest endpoint may not exist, fallback to /search
        // Only log at debug level to reduce noise
        if (__DEV__) {
          if (response.status === 404) {
            logger.debug(`ℹ️ Unified API /latest not available (404), using /search fallback... (failure ${this.latestEndpointFailures}/${this.MAX_LATEST_FAILURES})`);
          } else {
            logger.warn(`⚠️ Unified API /latest failed (${response.status}), trying alternatives...`);
          }
        }
        return await this.fetchAFADOnly();
      }
      
      // ELITE: Success - reset failure counter
      this.latestEndpointFailures = 0;

      const data: UnifiedAPIResponse = await response.json();
      
      // CRITICAL: Check status field - API returns status: true/false
      if (!data.status || data.httpStatus !== 200) {
        if (__DEV__) {
          logger.warn(`⚠️ Unified API returned status: ${data.status}, httpStatus: ${data.httpStatus}`);
        }
        return await this.fetchAFADOnly();
      }
      
      if (!Array.isArray(data.result)) {
        if (__DEV__) {
          logger.warn('⚠️ Unified API: result is not an array');
        }
        return await this.fetchAFADOnly();
      }

      const earthquakes: Earthquake[] = [];
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      // Process each earthquake individually
      for (let i = 0; i < data.result.length; i++) {
        const item = data.result[i];
        try {
          // Parse coordinates (API returns [lon, lat])
          const longitude = item.geojson.coordinates[0];
          const latitude = item.geojson.coordinates[1];
          
          // Validate coordinates (Turkey bounds)
          if (isNaN(latitude) || latitude < 35 || latitude > 43 ||
              isNaN(longitude) || longitude < 25 || longitude > 45) {
            if (__DEV__ && i < 5) {
              logger.debug(`⚠️ Unified API deprem ${i + 1}: Türkiye sınırları dışında`);
            }
            continue;
          }

          // Parse magnitude
          const magnitude = parseFloat(String(item.mag));
          if (isNaN(magnitude) || magnitude < 1.0 || magnitude > 10) {
            if (__DEV__ && i < 5) {
              logger.debug(`⚠️ Unified API deprem ${i + 1}: Geçersiz büyüklük - ${magnitude}`);
            }
            continue;
          }

          // Parse depth
          const depth = parseFloat(String(item.depth));
          if (isNaN(depth) || depth < 0 || depth > 1000) {
            if (__DEV__ && i < 5) {
              logger.debug(`⚠️ Unified API deprem ${i + 1}: Geçersiz derinlik - ${depth}`);
            }
          }

          // Parse time
          // API returns: "2024-01-15 14:23:11" (Turkey timezone)
          const dateTimeStr = item.date_time.replace(' ', 'T') + '+03:00';
          const parsedDate = new Date(dateTimeStr);
          const time = parsedDate.getTime();

          if (isNaN(time) || time <= 0) {
            if (__DEV__ && i < 5) {
              logger.debug(`⚠️ Unified API deprem ${i + 1}: Geçersiz zaman - ${item.date_time}`);
            }
            continue;
          }

          // Filter by time (last 7 days)
          if (time < sevenDaysAgo) {
            continue;
          }

          // Parse location
          const location = item.title || 
                          item.location_properties?.closestCity?.name || 
                          'Türkiye';

          if (!location || location.trim().length === 0) {
            if (__DEV__ && i < 5) {
              logger.debug(`⚠️ Unified API deprem ${i + 1}: Boş konum`);
            }
            continue;
          }

          // Determine source
          const source = item.provider === 'kandilli' ? 'KANDILLI' : 'AFAD';

          // Generate ID
          const id = `unified-${item.earthquake_id || `${time}-${Math.round(latitude * 1000)}-${Math.round(longitude * 1000)}`}`;

          const earthquake: Earthquake = {
            id,
            magnitude,
            location: location.trim(),
            depth: isNaN(depth) ? 10 : Math.max(0, Math.min(1000, depth)),
            time,
            latitude,
            longitude,
            source: source as 'AFAD' | 'KANDILLI',
          };

          earthquakes.push(earthquake);

          if (__DEV__ && earthquakes.length <= 3) {
            logger.debug(`✅ Unified API deprem ${earthquakes.length} parse edildi: ${location} - ${magnitude} ML (${source})`);
          }
        } catch (parseError: any) {
          if (__DEV__ && i < 5) {
            logger.warn(`⚠️ Unified API deprem parse hatası (${i + 1}/${data.result.length}):`, parseError?.message);
          }
          continue;
        }
      }

      // Sort by time (newest first)
      earthquakes.sort((a, b) => b.time - a.time);

      if (__DEV__) {
        logger.info(`✅ Unified API: ${earthquakes.length} deprem verisi alındı (${data.result.length} parse edildi)`);
        if (earthquakes.length > 0) {
          const latest = earthquakes[0];
          const latestTime = new Date(latest.time).toLocaleString('tr-TR', { 
            timeZone: 'Europe/Istanbul', 
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          logger.info(`🔝 Unified API en son deprem: ${latest.location} - ${latest.magnitude} ML (${latest.source}) - ${latestTime}`);
        }
      }

      return earthquakes.slice(0, 100); // Limit to 100
    } catch (error: any) {
      const errorType = error?.name || 'Unknown';
      const errorMessage = error?.message || String(error);
      const isAborted = errorType === 'AbortError' || errorMessage.includes('aborted');
      const isNetworkError = errorMessage.includes('Network request failed') || 
                            errorMessage.includes('network') ||
                            errorType === 'TypeError';

      if (__DEV__) {
        if (isAborted) {
          logger.debug(`⏱️ Unified API timeout: ${this.timeout}ms`);
        } else if (isNetworkError) {
          logger.debug(`🌐 Unified API network error: ${errorMessage}`);
        } else {
          logger.debug(`⚠️ Unified API error: ${errorType}: ${errorMessage}`);
        }
      }
      return [];
    }
  }

  /**
   * ELITE: Fetch only AFAD earthquakes using POST /deprem/data/search
   * More reliable than GET endpoints
   */
  async fetchAFADOnly(): Promise<Earthquake[]> {
    try {
      // Use POST /deprem/data/search endpoint - more reliable according to docs
      const url = `${this.baseUrl}/data/search`;
      
      if (__DEV__) {
        logger.debug(`📡 Unified API (AFAD via search) çağrılıyor: ${url}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Calculate date range (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const requestBody = {
        provider: 'afad',
        match: {
          mag: 1.0, // Minimum magnitude
          date_starts: startDate.toISOString().replace('T', ' ').substring(0, 19),
          date_ends: endDate.toISOString().replace('T', ' ').substring(0, 19),
        },
        sort: 'date_-1', // Sort by date descending (newest first)
        limit: 100,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: UnifiedAPIResponse = await response.json();
      
      if (!data.status || data.httpStatus !== 200 || !Array.isArray(data.result)) {
        return [];
      }

      return this.parseAPIResponse(data.result, 'AFAD');
    } catch (error: any) {
      if (__DEV__) {
        logger.debug('Unified API (AFAD) fetch error:', error?.message || String(error));
      }
      return [];
    }
  }

  /**
   * ELITE: Fetch only Kandilli earthquakes using POST /deprem/data/search
   * More reliable than GET endpoints
   */
  async fetchKandilliOnly(): Promise<Earthquake[]> {
    try {
      // Use POST /deprem/data/search endpoint - more reliable according to docs
      const url = `${this.baseUrl}/data/search`;
      
      if (__DEV__) {
        logger.debug(`📡 Unified API (Kandilli via search) çağrılıyor: ${url}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Calculate date range (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const requestBody = {
        provider: 'kandilli',
        match: {
          mag: 1.0, // Minimum magnitude
          date_starts: startDate.toISOString().replace('T', ' ').substring(0, 19),
          date_ends: endDate.toISOString().replace('T', ' ').substring(0, 19),
        },
        sort: 'date_-1', // Sort by date descending (newest first)
        limit: 100,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: UnifiedAPIResponse = await response.json();
      
      if (!data.status || data.httpStatus !== 200 || !Array.isArray(data.result)) {
        return [];
      }

      return this.parseAPIResponse(data.result, 'KANDILLI');
    } catch (error: any) {
      if (__DEV__) {
        logger.debug('Unified API (Kandilli) fetch error:', error?.message || String(error));
      }
      return [];
    }
  }

  /**
   * Parse API response items
   */
  private parseAPIResponse(
    items: UnifiedAPIResponse['result'],
    source: 'AFAD' | 'KANDILLI'
  ): Earthquake[] {
    const earthquakes: Earthquake[] = [];
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const longitude = item.geojson.coordinates[0];
        const latitude = item.geojson.coordinates[1];
        
        if (isNaN(latitude) || latitude < 35 || latitude > 43 ||
            isNaN(longitude) || longitude < 25 || longitude > 45) {
          continue;
        }

        const magnitude = parseFloat(String(item.mag));
        if (isNaN(magnitude) || magnitude < 1.0 || magnitude > 10) {
          continue;
        }

        const depth = parseFloat(String(item.depth));
        const dateTimeStr = item.date_time.replace(' ', 'T') + '+03:00';
        const parsedDate = new Date(dateTimeStr);
        const time = parsedDate.getTime();

        if (isNaN(time) || time <= 0 || time < sevenDaysAgo) {
          continue;
        }

        const location = item.title || 
                        item.location_properties?.closestCity?.name || 
                        'Türkiye';

        if (!location || location.trim().length === 0) {
          continue;
        }

        const id = `unified-${source.toLowerCase()}-${item.earthquake_id || `${time}-${Math.round(latitude * 1000)}-${Math.round(longitude * 1000)}`}`;

        earthquakes.push({
          id,
          magnitude,
          location: location.trim(),
          depth: isNaN(depth) ? 10 : Math.max(0, Math.min(1000, depth)),
          time,
          latitude,
          longitude,
          source,
        });
      } catch (parseError) {
        continue;
      }
    }

    return earthquakes.sort((a, b) => b.time - a.time).slice(0, 100);
  }
}

export const unifiedEarthquakeAPI = new UnifiedEarthquakeAPI();

