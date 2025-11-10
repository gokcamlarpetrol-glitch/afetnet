/**
 * KANDILLI PROVIDER
 * Boğaziçi Üniversitesi Kandilli Rasathanesi
 */

import { Earthquake } from '../../stores/earthquakeStore';
import { createLogger } from '../../utils/logger';

const logger = createLogger('KandilliProvider');

export class KandilliProvider {
  name = 'Kandilli';

  async fetchRecent(): Promise<Earthquake[]> {
    // DISABLED: Kandilli HTTP endpoint doesn't work in React Native (CORS/network issues)
    // Will be re-enabled when we have a proper API or proxy
    return [];
    
    /* ORIGINAL CODE - DISABLED
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        'http://www.koeri.boun.edu.tr/scripts/lst0.asp',
        {
          headers: {
            'User-Agent': 'AfetNet/1.0',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Kandilli request failed');
      }

      const html = await response.text();
      const earthquakes = this.parseKandilliHTML(html);
      
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return earthquakes.filter(eq => eq.time >= oneDayAgo && eq.magnitude >= 3.0);
    } catch (error) {
      return [];
    }
    */
  }

  private parseKandilliHTML(html: string): Earthquake[] {
    try {
      const earthquakes: Earthquake[] = [];
      
      // Kandilli HTML format: pre tag with fixed-width text
      // Example line: 2024.01.15 12:34:56  38.1234  27.5678  10.5  3.2 ML IZMIR
      
      const lines = html.split('\n');
      
      for (const line of lines) {
        // Skip header lines
        if (line.includes('Date') || line.includes('---') || line.trim().length < 50) {
          continue;
        }

        try {
          // Parse fixed-width format
          const dateStr = line.substring(0, 10).trim();
          const timeStr = line.substring(11, 19).trim();
          const latStr = line.substring(20, 28).trim();
          const lonStr = line.substring(29, 37).trim();
          const depthStr = line.substring(38, 44).trim();
          const magStr = line.substring(45, 50).trim();
          const location = line.substring(56).trim();

          const date = new Date(`${dateStr} ${timeStr}`);
          const latitude = parseFloat(latStr);
          const longitude = parseFloat(lonStr);
          const depth = parseFloat(depthStr);
          const magnitude = parseFloat(magStr);

          if (!isNaN(date.getTime()) && magnitude > 0) {
            earthquakes.push({
              id: `kandilli-${date.getTime()}-${latitude}-${longitude}`,
              magnitude,
              location: location || 'Türkiye',
              depth,
              time: date.getTime(),
              latitude,
              longitude,
              source: 'KANDILLI',
            });
          }
        } catch (parseError) {
          // Skip malformed lines
          continue;
        }
      }

      return earthquakes
        .sort((a, b) => b.time - a.time)
        .slice(0, 100);
    } catch (error) {
      logger.error('Parse error:', error);
      return [];
    }
  }
}

export const kandilliProvider = new KandilliProvider();
