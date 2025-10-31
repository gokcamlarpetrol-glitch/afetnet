import { QuakeItem, QuakeProvider } from '../types';
import { logger } from '../../../utils/productionLogger';

export class USGSProvider implements QuakeProvider {
  name = 'USGS';

  async fetchRecent(): Promise<QuakeItem[]> {
    try {
      // Get last 7 days of earthquakes worldwide
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const startTime = startDate.toISOString().split('T')[0];
      
      // USGS Earthquake API - Worldwide coverage
      const response = await fetch(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&minmagnitude=2.5&orderby=time&limit=1000`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AfetNet/1.0',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`USGS API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || !data.features) {
        logger.error('USGS API returned no features');
        return [];
      }

      logger.info(`✅ USGS: Fetched ${data.features.length} earthquakes`);
      return this.parseUSGSData(data.features);
    } catch (error) {
      logger.error('USGS fetch failed:', error);
      return [];
    }
  }

  private parseUSGSData(features: unknown[]): QuakeItem[] {
    try {
      const quakes: QuakeItem[] = [];

      for (const feature of features) {
        try {
          const f = feature as any;
          const properties = f.properties;
          const geometry = f.geometry;
          
          const id = f.id || `${properties.time}_${geometry.coordinates[0]}_${geometry.coordinates[1]}`;
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
              source: 'USGS',
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
      logger.error('❌ USGS parsing failed:', error);
      return [];
    }
  }
}

export const usgsProvider = new USGSProvider();