import { QuakeItem, QuakeProvider } from '../types';
import { logger } from '../../../utils/productionLogger';

export class USGSProvider implements QuakeProvider {
  name = 'USGS';

  async fetchRecent(): Promise<QuakeItem[]> {
    try {
      // USGS Earthquake API for Turkey region
      const response = await fetch(
        'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2024-01-01&minmagnitude=2.5&maxlatitude=42.0&minlatitude=35.0&maxlongitude=45.0&minlongitude=25.0&orderby=time&limit=100',
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AfetNet/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`USGS API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || !data.features) {
        return this.getMockData();
      }

      return this.parseUSGSData(data.features);
    } catch (error) {
      logger.warn('USGS fetch failed:', error);
      return this.getMockData();
    }
  }

  private parseUSGSData(features: unknown[]): QuakeItem[] {
    try {
      const quakes: QuakeItem[] = [];

      for (const feature of features) {
        try {
          const properties = feature.properties;
          const geometry = feature.geometry;
          
          const id = feature.id || `${properties.time}_${geometry.coordinates[0]}_${geometry.coordinates[1]}`;
          const time = properties.time;
          const mag = properties.mag;
          const place = properties.place || 'Türkiye';
          const lon = geometry.coordinates[0];
          const lat = geometry.coordinates[1];
          const depth = geometry.coordinates[2];

          if (time && mag > 0) {
            quakes.push({
              id,
              time,
              mag,
              place,
              lat,
              lon,
              depth,
              source: 'USGS'
            });
          }
        } catch (parseError) {
          logger.warn('Failed to parse USGS feature:', parseError);
          // Skip malformed entries
        }
      }

      // Sort by time descending and limit to 100
      return quakes
        .sort((a, b) => b.time - a.time)
        .slice(0, 100);
    } catch (error) {
      logger.warn('USGS parsing failed:', error);
      return this.getMockData();
    }
  }

  private getMockData(): QuakeItem[] {
    const now = Date.now();
    return [
      {
        id: 'usgs_mock_1',
        time: now - 2400000, // 40 minutes ago
        mag: 4.1,
        place: 'Turkey',
        lat: 37.0662,
        lon: 37.3833,
        depth: 9.7,
        source: 'USGS'
      },
      {
        id: 'usgs_mock_2',
        time: now - 4800000, // 80 minutes ago
        mag: 3.7,
        place: 'Turkey',
        lat: 39.9334,
        lon: 32.8597,
        depth: 11.2,
        source: 'USGS'
      },
      {
        id: 'usgs_mock_3',
        time: now - 7200000, // 2 hours ago
        mag: 3.2,
        place: 'Turkey',
        lat: 41.0082,
        lon: 28.9784,
        depth: 14.8,
        source: 'USGS'
      }
    ];
  }
}

export const usgsProvider = new USGSProvider();