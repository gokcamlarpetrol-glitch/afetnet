/**
 * Ambee API Client
 * Ambee Earthquake / Natural Disasters API
 * https://www.getambee.com/api/earthquake
 */

import { BaseAPIClient } from './base';
import { RawEarthquakeEvent } from '../types/earthquake';
import { logger } from '../utils/logger';
import { config } from '../config';

interface AmbeeEarthquake {
  id: string;
  time: string; // ISO8601
  magnitude: number;
  latitude: number;
  longitude: number;
  depth?: number;
  location?: string;
  [key: string]: any;
}

interface AmbeeResponse {
  data: AmbeeEarthquake[];
  message?: string;
  [key: string]: any;
}

export class AmbeeClient extends BaseAPIClient {
  private apiKey: string;

  constructor(apiKey: string) {
    super('Ambee', 'https://api.getambee.com/v1', {
      'x-api-key': apiKey,
    });
    this.apiKey = apiKey;
  }

  protected async fetchData(): Promise<AmbeeResponse> {
    // Ambee API endpoint for recent earthquakes
    const params = {
      minMagnitude: config.magnitudeThreshold,
      limit: 100,
    };

    const response = await this.client.get<AmbeeResponse>('/earthquake', { params });

    if (!response.data || !response.data.data) {
      throw new Error('Invalid Ambee response format');
    }

    logger.debug(`Ambee fetched ${response.data.data.length} events`);

    return response.data;
  }

  protected getSourceName(): 'Ambee' {
    return 'Ambee';
  }

  /**
   * Convert Ambee response to raw events
   */
  async fetchRecent(): Promise<RawEarthquakeEvent[]> {
    const rawEvents = await super.fetchRecent();
    
    // Ambee returns data array
    if (rawEvents.length > 0 && Array.isArray(rawEvents[0].data.data)) {
      const earthquakes = rawEvents[0].data.data as AmbeeEarthquake[];
      return earthquakes.map((eq) => ({
        source: 'Ambee' as const,
        data: eq,
        fetchedAt: rawEvents[0].fetchedAt,
        latencyMs: rawEvents[0].latencyMs,
      }));
    }

    return rawEvents;
  }
}

export const ambeeClient = new AmbeeClient(config.ambeeApiKey);

