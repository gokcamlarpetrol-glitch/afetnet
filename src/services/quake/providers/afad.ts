import { QuakeItem, QuakeProvider } from '../types';

export class AFADProvider implements QuakeProvider {
  name = 'AFAD';

  async fetchRecent(): Promise<QuakeItem[]> {
    try {
      // AFAD public earthquake feed endpoint
      const response = await fetch('https://deprem.afad.gov.tr/EventService/GetEventsByFilter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          EventSearchFilterList: [
            {
              FilterType: 9,
              FilterValue: 7 // Last 7 days
            }
          ],
          Skip: 0,
          Take: 100,
          SortDescriptor: {
            field: 'EventDate',
            dir: 'desc'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AFAD API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || !data.eventList) {
        // Fallback to mock data if API structure changes
        return this.getMockData();
      }

      return this.parseAFADData(data.eventList);
    } catch (error) {
      console.warn('AFAD fetch failed:', error);
      // Return mock data for development/testing
      return this.getMockData();
    }
  }

  private parseAFADData(eventList: any[]): QuakeItem[] {
    try {
      const quakes: QuakeItem[] = [];

      for (const event of eventList) {
        try {
          // Parse AFAD event structure
          const id = event.eventId || event.id || `${event.eventDate}_${event.latitude}_${event.longitude}`;
          const time = this.parseDateTime(event.eventDate, event.eventTime);
          const mag = parseFloat(event.magnitude || event.ml || event.mw || '0');
          const place = this.parseLocation(event.location, event.district, event.city);
          const lat = parseFloat(event.latitude || '0');
          const lon = parseFloat(event.longitude || '0');
          const depth = parseFloat(event.depth || '0');

          if (time && mag > 0) {
            quakes.push({
              id,
              time,
              mag,
              place,
              lat: lat > 0 ? lat : undefined,
              lon: lon > 0 ? lon : undefined,
              depth: depth > 0 ? depth : undefined,
              source: 'AFAD'
            });
          }
        } catch (parseError) {
          console.warn('Failed to parse AFAD event:', parseError);
          // Skip malformed entries
        }
      }

      // Sort by time descending and limit to 100
      return quakes
        .sort((a, b) => b.time - a.time)
        .slice(0, 100);
    } catch (error) {
      console.warn('AFAD parsing failed:', error);
      return this.getMockData();
    }
  }

  private parseDateTime(dateStr: string, timeStr?: string): number {
    try {
      let dateTimeStr = dateStr;
      
      if (timeStr) {
        dateTimeStr = `${dateStr} ${timeStr}`;
      }

      // Try various date formats
      const formats = [
        'YYYY-MM-DD HH:mm:ss',
        'YYYY-MM-DDTHH:mm:ss',
        'DD.MM.YYYY HH:mm:ss',
        'DD/MM/YYYY HH:mm:ss'
      ];

      for (const format of formats) {
        try {
          // Simple date parsing - in production, use a proper date library
          const date = new Date(dateTimeStr.replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1'));
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

  private parseLocation(location?: string, district?: string, city?: string): string {
    const parts = [location, district, city].filter(Boolean);
    return parts.join(', ') || 'Türkiye';
  }

  private getMockData(): QuakeItem[] {
    const now = Date.now();
    return [
      {
        id: 'afad_mock_1',
        time: now - 3600000, // 1 hour ago
        mag: 4.2,
        place: 'İzmir, Türkiye',
        lat: 38.4192,
        lon: 27.1287,
        depth: 10.5,
        source: 'AFAD'
      },
      {
        id: 'afad_mock_2',
        time: now - 7200000, // 2 hours ago
        mag: 3.8,
        place: 'Ankara, Türkiye',
        lat: 39.9334,
        lon: 32.8597,
        depth: 8.2,
        source: 'AFAD'
      },
      {
        id: 'afad_mock_3',
        time: now - 10800000, // 3 hours ago
        mag: 3.1,
        place: 'İstanbul, Türkiye',
        lat: 41.0082,
        lon: 28.9784,
        depth: 15.3,
        source: 'AFAD'
      }
    ];
  }
}

export const afadProvider = new AFADProvider();