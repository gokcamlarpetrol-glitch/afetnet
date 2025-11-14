/**
 * Xweather API Client
 * Xweather Weather API - Earthquakes endpoint
 * https://www.xweather.com/docs/weather-api/endpoints/earthquakes
 */

import { BaseAPIClient } from './base';
import { RawEarthquakeEvent } from '../types/earthquake';
import { logger } from '../utils/logger';
import { config } from '../config';

interface XweatherEarthquake {
  id: string;
  timestamp: string; // ISO8601
  magnitude: number;
  lat: number;
  lon: number;
  depth?: number;
  location?: string;
  [key: string]: any;
}

interface XweatherResponse {
  earthquakes: XweatherEarthquake[];
  meta?: {
    [key: string]: any;
  };
}

export class XweatherClient extends BaseAPIClient {
  private apiKey: string;

  constructor(apiKey: string) {
    super('Xweather', 'https://api.xweather.com', {
      'X-API-Key': apiKey,
    });
    this.apiKey = apiKey;
  }

  protected async fetchData(): Promise<XweatherResponse> {
    // Xweather earthquakes endpoint
    const params = {
      minMagnitude: config.magnitudeThreshold,
      limit: 100,
    };

    const response = await this.client.get<XweatherResponse>('/earthquakes', { params });

    if (!response.data || !response.data.earthquakes) {
      throw new Error('Invalid Xweather response format');
    }

    logger.debug(`Xweather fetched ${response.data.earthquakes.length} events`);

    return response.data;
  }

  protected getSourceName(): 'Xweather' {
    return 'Xweather';
  }

  /**
   * Convert Xweather response to raw events
   */
  async fetchRecent(): Promise<RawEarthquakeEvent[]> {
    const rawEvents = await super.fetchRecent();
    
    // Xweather returns earthquakes array
    if (rawEvents.length > 0 && Array.isArray(rawEvents[0].data.earthquakes)) {
      const earthquakes = rawEvents[0].data.earthquakes as XweatherEarthquake[];
      return earthquakes.map((eq) => ({
        source: 'Xweather' as const,
        data: eq,
        fetchedAt: rawEvents[0].fetchedAt,
        latencyMs: rawEvents[0].latencyMs,
      }));
    }

    return rawEvents;
  }
}

export const xweatherClient = new XweatherClient(config.xweatherApiKey);









