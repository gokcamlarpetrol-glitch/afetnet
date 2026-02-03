/**
 * AFAD HTML Provider
 * Fallback provider that parses AFAD HTML page when API is unavailable
 * Ensures we always get live data even if API endpoints fail
 */

import { createLogger } from '../../utils/logger';
import { Earthquake } from '../../stores/earthquakeStore';
import { parseAFADDate } from '../../utils/timeUtils';

const logger = createLogger('AFADHTMLProvider');

export class AFADHTMLProvider {
  name = 'AFAD-HTML';

  async fetchRecent(): Promise<Earthquake[]> {
    try {
      // CRITICAL: Parse AFAD HTML page as fallback when API fails
      const url = 'https://deprem.afad.gov.tr/last-earthquakes.html';

      if (__DEV__) {
        logger.debug(`📡 AFAD HTML sayfası parse ediliyor: ${url}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout - ELITE: Faster timeout for instant updates

      // CRITICAL: Always fetch fresh data - no cache, no stale data
      // AFAD site updates every few seconds, we need instant updates
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        signal: controller.signal,
        cache: 'no-store', // CRITICAL: Never cache - always fetch fresh
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      if (!html || html.length < 100) {
        throw new Error('Empty or invalid response');
      }

      const earthquakes = this.parseAFADHTML(html);

      if (__DEV__) {
        logger.info(`✅ AFAD HTML parse tamamlandı: ${earthquakes.length} deprem parse edildi`);
      }

      // CRITICAL: No filtering - show ALL data from AFAD site (last 100 earthquakes)
      // AFAD site shows latest 100 earthquakes regardless of time or magnitude
      // We want to show exactly what AFAD shows for maximum accuracy
      const now = Date.now();
      const filtered = earthquakes.filter(eq => {
        // Only filter out future events (more than 1 hour in future - clock drift)
        const isNotFuture = eq.time <= now + 60 * 60 * 1000; // Allow 1 hour in future
        // Accept all magnitudes (AFAD shows all, even small ones)
        const isValidMag = eq.magnitude >= 0.1; // Very low threshold

        return isNotFuture && isValidMag;
      });

      if (__DEV__) {
        logger.info(`✅ AFAD HTML: ${filtered.length} deprem verisi alındı (${earthquakes.length} parse edildi)`);
        if (filtered.length > 0) {
          const latest = filtered[0];
          const latestTime = new Date(latest.time).toLocaleString('tr-TR', {
            timeZone: 'Europe/Istanbul',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          logger.info(`🔝 AFAD HTML en son deprem: ${latest.location} - ${latest.magnitude} ${latest.magnitude >= 4.0 ? 'MW' : 'ML'} - ${latestTime}`);
        }
      }

      return filtered;
    } catch (error: unknown) {
      if (__DEV__) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.debug('AFAD HTML fetch error:', errMsg);
      }
      return [];
    }
  }

  private parseAFADHTML(html: string): Earthquake[] {
    try {
      const earthquakes: Earthquake[] = [];

      // AFAD HTML format: Table rows with earthquake data
      // Format: <tr><td>2025-11-10 23:18:21</td><td>39.23</td><td>28.15472</td><td>6.48</td><td>ML</td><td>3.6</td><td>Sındırgı (Balıkesir)</td>...

      // Extract table rows - try multiple patterns for robustness
      let tbodyContent: string | null = null;
      const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
      if (tbodyMatch) {
        tbodyContent = tbodyMatch[1];
      } else {
        // Fallback: try to find table rows directly
        const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
        if (tableMatch) {
          tbodyContent = tableMatch[1];
        }
      }

      if (!tbodyContent) {
        if (__DEV__) {
          logger.warn('⚠️ AFAD HTML: <tbody> veya <table> tag bulunamadı! HTML uzunluğu:', html.length);
          // Log first 500 chars for debugging
          logger.debug('HTML başlangıcı:', html.substring(0, 500));
        }
        return [];
      }

      const rowMatches = tbodyContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

      for (const rowMatch of rowMatches) {
        const row = rowMatch[1];

        // Extract cells
        const cellMatches = row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
        const cells: string[] = [];
        for (const cellMatch of cellMatches) {
          const cellContent = cellMatch[1]
            .replace(/<[^>]+>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .trim();
          cells.push(cellContent);
        }

        if (cells.length < 7) continue; // Need at least 7 cells

        try {
          // Parse cells: [Date, Lat, Lon, Depth, Type, Magnitude, Location, ...]
          const dateStr = cells[0]; // "2025-11-10 23:18:21"
          const latStr = cells[1];
          const lonStr = cells[2];
          const depthStr = cells[3];
          const typeStr = cells[4]; // "ML" or "MW"
          const magStr = cells[5];
          const locationStr = cells[6];

          // Validate date format
          if (!/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(dateStr)) continue;

          // Parse date (AFAD HTML uses Turkey timezone)
          const dateTimeStr = dateStr.replace(' ', 'T') + '+03:00';
          const parsedDate = new Date(dateTimeStr);
          const time = parsedDate.getTime();

          if (isNaN(time) || time <= 0) continue;

          // Parse coordinates
          const latitude = parseFloat(latStr);
          const longitude = parseFloat(lonStr);
          const depth = parseFloat(depthStr);
          const magnitude = parseFloat(magStr);

          // CRITICAL: AFAD is the official source - if AFAD shows an earthquake, we should show it too
          // Don't filter by strict Turkey bounds - AFAD already decides what to show
          // Only validate that coordinates are reasonable (not NaN, reasonable ranges)
          if (isNaN(latitude) || latitude < -90 || latitude > 90 ||
            isNaN(longitude) || longitude < -180 || longitude > 180 ||
            isNaN(depth) || depth < 0 || depth > 1000 ||
            isNaN(magnitude) || magnitude < 0 || magnitude > 10) {
            continue;
          }

          // Validate location
          if (!locationStr || locationStr.trim().length === 0) {
            continue;
          }

          // Generate ID
          const id = `afad-html-${time}-${Math.round(latitude * 1000)}-${Math.round(longitude * 1000)}`;

          earthquakes.push({
            id,
            magnitude,
            location: locationStr.trim(),
            depth: Math.max(0, Math.min(1000, depth)),
            time,
            latitude,
            longitude,
            source: 'AFAD',
          });

          if (__DEV__ && earthquakes.length <= 3) {
            logger.debug(`✅ AFAD HTML parse: ${locationStr} - ${magnitude} ${typeStr} - ${dateStr}`);
          }
        } catch (parseError) {
          if (__DEV__) {
            logger.debug('AFAD HTML parse error for row:', row.substring(0, 100));
          }
          continue;
        }
      }

      // Remove duplicates
      const unique: Earthquake[] = [];
      const seen = new Set<string>();

      for (const eq of earthquakes) {
        // ELITE: More flexible deduplication - 1 minute buckets (allows same location earthquakes within 1 minute)
        // This ensures we don't miss rapid successive earthquakes at the same location
        const timeKey = Math.floor(eq.time / (1 * 60 * 1000)); // 1 minute buckets (was 5 minutes)
        const latKey = Math.round(eq.latitude * 10); // More precise (was 100)
        const lonKey = Math.round(eq.longitude * 10); // More precise (was 100)
        const magKey = Math.round(eq.magnitude * 10); // Include magnitude in deduplication
        const key = `${timeKey}-${latKey}-${lonKey}-${magKey}`;

        if (!seen.has(key)) {
          seen.add(key);
          unique.push(eq);
        }
      }

      return unique
        .sort((a, b) => b.time - a.time)
        .slice(0, 100);
    } catch (error) {
      logger.error('AFAD HTML parse error:', error);
      return [];
    }
  }
}

export const afadHTMLProvider = new AFADHTMLProvider();

