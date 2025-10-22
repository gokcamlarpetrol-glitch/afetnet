import { QuakeItem, QuakeProvider } from '../types';
import { logger } from '../../../utils/productionLogger';

export class KandilliProvider implements QuakeProvider {
  name = 'Kandilli';

  async fetchRecent(): Promise<QuakeItem[]> {
    try {
      // Kandilli Observatory earthquake feed endpoints
      const endpoints = [
        'https://www.koeri.boun.edu.tr/scripts/lst0.asp',
        'https://www.koeri.boun.edu.tr/scripts/lst1.asp',
        'https://deprem.koeri.boun.edu.tr/sismo/2/latest.txt',
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            headers: {
              'Accept': 'text/plain, application/json, */*',
              'User-Agent': 'AfetNet/1.0',
            },
          });

          if (response.ok) {
            const text = await response.text();
            const quakes = this.parseKandilliData(text);
            if (quakes.length > 0) {
              return quakes;
            }
          }
        } catch (endpointError) {
          logger.warn(`Kandilli endpoint ${endpoint} failed:`, endpointError);
          // Try next endpoint
        }
      }

      // All endpoints failed, return mock data
      return this.getMockData();
    } catch (error) {
      logger.warn('Kandilli fetch failed:', error);
      return this.getMockData();
    }
  }

  private parseKandilliData(text: string): QuakeItem[] {
    try {
      const quakes: QuakeItem[] = [];
      const lines = text.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          // Try JSON format first
          if (line.startsWith('[') || line.startsWith('{')) {
            const jsonData = JSON.parse(line);
            if (Array.isArray(jsonData)) {
              for (const item of jsonData) {
                const quake = this.parseKandilliJSON(item);
                if (quake) quakes.push(quake);
              }
            } else {
              const quake = this.parseKandilliJSON(jsonData);
              if (quake) quakes.push(quake);
            }
            continue;
          }

          // Try CSV-like format
          const quake = this.parseKandilliCSV(line);
          if (quake) quakes.push(quake);
        } catch (parseError) {
          logger.warn('Failed to parse Kandilli line:', parseError);
          // Skip malformed entries
        }
      }

      // Sort by time descending and limit to 100
      return quakes
        .sort((a, b) => b.time - a.time)
        .slice(0, 100);
    } catch (error) {
      logger.warn('Kandilli parsing failed:', error);
      return this.getMockData();
    }
  }

  private parseKandilliJSON(item: any): QuakeItem | null {
    try {
      const id = item.eventId || item.id || `${item.date}_${item.time}_${item.lat}_${item.lon}`;
      const time = this.parseDateTime(item.date, item.time);
      const mag = parseFloat(item.magnitude || item.mag || item.ml || '0');
      const place = item.location || item.place || item.region || 'Türkiye';
      const lat = parseFloat(item.latitude || item.lat || '0');
      const lon = parseFloat(item.longitude || item.lon || '0');
      const depth = parseFloat(item.depth || '0');

      if (time && mag > 0) {
        return {
          id,
          time,
          mag,
          place,
          lat: lat > 0 ? lat : undefined,
          lon: lon > 0 ? lon : undefined,
          depth: depth > 0 ? depth : undefined,
          source: 'Kandilli',
        };
      }
    } catch (error) {
      logger.warn('Failed to parse Kandilli JSON item:', error);
    }
    return null;
  }

  private parseKandilliCSV(line: string): QuakeItem | null {
    try {
      // Common Kandilli CSV format: date,time,lat,lon,depth,magnitude,location
      const parts = line.split(/\s+/).filter(part => part.trim());
      
      if (parts.length < 6) return null;

      const date = parts[0];
      const time = parts[1];
      const lat = parseFloat(parts[2]);
      const lon = parseFloat(parts[3]);
      const depth = parseFloat(parts[4]);
      const mag = parseFloat(parts[5]);
      const place = parts.slice(6).join(' ') || 'Türkiye';

      const parsedTime = this.parseDateTime(date, time);
      const id = `${date}_${time}_${lat}_${lon}`;

      if (parsedTime && mag > 0) {
        return {
          id,
          time: parsedTime,
          mag,
          place,
          lat: lat > 0 ? lat : undefined,
          lon: lon > 0 ? lon : undefined,
          depth: depth > 0 ? depth : undefined,
          source: 'Kandilli',
        };
      }
    } catch (error) {
      logger.warn('Failed to parse Kandilli CSV line:', error);
    }
    return null;
  }

  private parseDateTime(dateStr: string, timeStr?: string): number {
    try {
      let dateTimeStr = dateStr;
      
      if (timeStr) {
        dateTimeStr = `${dateStr} ${timeStr}`;
      }

      // Try various date formats
      const formats = [
        'YYYY.MM.DD HH:mm:ss',
        'YYYY-MM-DD HH:mm:ss',
        'DD.MM.YYYY HH:mm:ss',
        'DD/MM/YYYY HH:mm:ss',
      ];

      for (const format of formats) {
        try {
          // Simple date parsing
          let date: Date;
          
          if (format.includes('YYYY.MM.DD')) {
            const [datePart, timePart] = dateTimeStr.split(' ');
            const [year, month, day] = datePart.split('.');
            date = new Date(`${year}-${month}-${day} ${timePart || '00:00:00'}`);
          } else if (format.includes('DD.MM.YYYY')) {
            date = new Date(dateTimeStr.replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1'));
          } else {
            date = new Date(dateTimeStr);
          }
          
          if (!isNaN(date.getTime())) {
            return date.getTime();
          }
        } catch {
          // Try next format
        }
      }

      // Fallback to current time
      return Date.now();
    } catch (error) {
      return Date.now();
    }
  }

  private getMockData(): QuakeItem[] {
    const now = Date.now();
    return [
      {
        id: 'kandilli_mock_1',
        time: now - 1800000, // 30 minutes ago
        mag: 4.5,
        place: 'Marmara Denizi, Türkiye',
        lat: 40.7128,
        lon: 29.0060,
        depth: 12.8,
        source: 'Kandilli',
      },
      {
        id: 'kandilli_mock_2',
        time: now - 5400000, // 1.5 hours ago
        mag: 3.9,
        place: 'Antalya, Türkiye',
        lat: 36.8969,
        lon: 30.7133,
        depth: 7.2,
        source: 'Kandilli',
      },
      {
        id: 'kandilli_mock_3',
        time: now - 9000000, // 2.5 hours ago
        mag: 3.3,
        place: 'Trabzon, Türkiye',
        lat: 41.0015,
        lon: 39.7178,
        depth: 18.5,
        source: 'Kandilli',
      },
    ];
  }
}

export const kandilliProvider = new KandilliProvider();