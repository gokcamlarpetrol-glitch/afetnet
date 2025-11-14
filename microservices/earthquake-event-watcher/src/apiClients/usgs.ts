/**
 * USGS API Client
 * USGS Earthquake Catalog API
 * https://earthquake.usgs.gov/fdsnws/event/1/
 */

import { BaseAPIClient } from './base';
import { RawEarthquakeEvent } from '../types/earthquake';
import { logger } from '../utils/logger';
import { config } from '../config';

interface USGSFeature {
  id: string;
  properties: {
    mag: number;
    time: number;
    place: string;
    [key: string]: any;
  };
  geometry: {
    coordinates: [number, number, number]; // [longitude, latitude, depth]
  };
}

interface USGSResponse {
  features: USGSFeature[];
  metadata: {
    generated: number;
    [key: string]: any;
  };
}

export class USGSClient extends BaseAPIClient {
  constructor() {
    super('USGS', 'https://earthquake.usgs.gov/fdsnws/event/1');
  }

  protected async fetchData(): Promise<USGSResponse> {
    // Fetch earthquakes from last 5 seconds
    const now = new Date();
    const startTime = new Date(now.getTime() - 5000); // 5 seconds ago

    const params = {
      format: 'geojson',
      orderby: 'time',
      starttime: startTime.toISOString(),
      minmagnitude: config.magnitudeThreshold,
      limit: 100,
    };

    const response = await this.client.get<USGSResponse>('/query', { params });

    if (!response.data || !response.data.features) {
      throw new Error('Invalid USGS response format');
    }

    logger.debug(`USGS fetched ${response.data.features.length} events`);

    return response.data;
  }

  protected getSourceName(): 'USGS' {
    return 'USGS';
  }

  /**
   * Convert USGS response to raw events
   */
  async fetchRecent(): Promise<RawEarthquakeEvent[]> {
    const rawEvents = await super.fetchRecent();
    
    // USGS returns GeoJSON, extract features
    if (rawEvents.length > 0 && rawEvents[0].data.features) {
      const features = rawEvents[0].data.features as USGSFeature[];
      return features.map((feature) => ({
        source: 'USGS' as const,
        data: feature,
        fetchedAt: rawEvents[0].fetchedAt,
        latencyMs: rawEvents[0].latencyMs,
      }));
    }

    return rawEvents;
  }
}

export const usgsClient = new USGSClient();









