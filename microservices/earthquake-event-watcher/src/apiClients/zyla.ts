/**
 * Zyla API Client
 * Zyla API Hub - Earthquake Tracker API
 * https://zylalabs.com/api-marketplace/data/earthquake+tracker+api/941
 */

import { BaseAPIClient } from './base';
import { RawEarthquakeEvent } from '../types/earthquake';
import { logger } from '../utils/logger';
import { config } from '../config';

interface ZylaEarthquake {
  id: string;
  time: string; // ISO8601 or Unix timestamp
  magnitude: number;
  latitude: number;
  longitude: number;
  depth?: number;
  location?: string;
  [key: string]: any;
}

interface ZylaResponse {
  data: ZylaEarthquake[];
  status?: string;
  [key: string]: any;
}

export class ZylaClient extends BaseAPIClient {
  private apiKey: string;

  constructor(apiKey: string) {
    super('Zyla', 'https://api.zylalabs.com', {
      'Authorization': `Bearer ${apiKey}`,
    });
    this.apiKey = apiKey;
  }

  protected async fetchData(): Promise<ZylaResponse> {
    // Zyla Earthquake Tracker API endpoint
    const params = {
      minMagnitude: config.magnitudeThreshold,
      limit: 100,
    };

    const response = await this.client.get<ZylaResponse>('/earthquake-tracker', { params });

    if (!response.data || !response.data.data) {
      throw new Error('Invalid Zyla response format');
    }

    logger.debug(`Zyla fetched ${response.data.data.length} events`);

    return response.data;
  }

  protected getSourceName(): 'Zyla' {
    return 'Zyla';
  }

  /**
   * Convert Zyla response to raw events
   */
  async fetchRecent(): Promise<RawEarthquakeEvent[]> {
    const rawEvents = await super.fetchRecent();
    
    // Zyla returns data array
    if (rawEvents.length > 0 && Array.isArray(rawEvents[0].data.data)) {
      const earthquakes = rawEvents[0].data.data as ZylaEarthquake[];
      return earthquakes.map((eq) => ({
        source: 'Zyla' as const,
        data: eq,
        fetchedAt: rawEvents[0].fetchedAt,
        latencyMs: rawEvents[0].latencyMs,
      }));
    }

    return rawEvents;
  }
}

export const zylaClient = new ZylaClient(config.zylaApiKey);

