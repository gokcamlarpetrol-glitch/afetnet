/**
 * KANDILLI HTML PROVIDER
 * Boğaziçi Üniversitesi Kandilli Rasathanesi - HTML Parse Fallback
 * Ensures we always get live Kandilli data even if API endpoints fail
 */

import { Earthquake } from '../../stores/earthquakeStore';
import { createLogger } from '../../utils/logger';

const logger = createLogger('KandilliHTMLProvider');

export class KandilliHTMLProvider {
  name = 'Kandilli-HTML';

  async fetchRecent(): Promise<Earthquake[]> {
    try {
      // CRITICAL: Parse Kandilli HTML page as fallback when API endpoints fail
      // ELITE: Try fewer URLs with shorter timeout for faster initial load
      // Start with most reliable URLs first
      const urls = [
        'https://www.koeri.boun.edu.tr/scripts/lst1.asp',  // Primary HTTPS (most reliable)
        'http://www.koeri.boun.edu.tr/scripts/lst1.asp',   // HTTP fallback
        'https://www.koeri.boun.edu.tr/scripts/lst0.asp',  // Alternative HTTPS
      ];

      let lastError: Error | null = null;

      for (const url of urls) {
        try {
          if (__DEV__) {
            logger.debug(`📡 Kandilli HTML sayfası parse ediliyor: ${url}`);
          }

          const controller = new AbortController();
          // ELITE: Reduced timeout to 15s for faster initial load
          // Kandilli HTML is fast when it works, so shorter timeout prevents delays
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout (reduced from 30s)

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'tr-TR,tr;q=0.9',
              'Accept-Encoding': 'gzip, deflate',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
              'Connection': 'keep-alive',
            },
            signal: controller.signal,
            redirect: 'follow',
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const html = await response.text();

          if (!html || html.length < 100) {
            throw new Error('Empty or invalid response');
          }

          // Check if HTML contains earthquake data
          if (!html.includes('<pre') && !html.includes('<PRE')) {
            throw new Error('No pre tag found in HTML');
          }

          const earthquakes = this.parseKandilliHTML(html);

          if (__DEV__) {
            logger.info(`✅ Kandilli HTML parse tamamlandı: ${earthquakes.length} deprem parse edildi (URL: ${url})`);
          }

          // Filter: Last 7 days and magnitude >= 1.0
          const now = Date.now();
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
          const filtered = earthquakes.filter(eq => {
            const isRecent = eq.time >= sevenDaysAgo;
            const isValidMag = eq.magnitude >= 1.0;
            const isNotFuture = eq.time <= now + 2 * 60 * 60 * 1000; // Allow 2 hours in future

            return isRecent && isValidMag && isNotFuture;
          });

          if (__DEV__) {
            logger.info(`✅ Kandilli HTML: ${filtered.length} deprem verisi alındı (${earthquakes.length} parse edildi)`);
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
              logger.info(`🔝 Kandilli HTML en son deprem: ${latest.location} - ${latest.magnitude} ML - ${latestTime}`);
            } else if (earthquakes.length > 0) {
              logger.warn(`⚠️ Kandilli HTML: ${earthquakes.length} deprem parse edildi ama hiçbiri filtre kriterlerini geçmedi!`);
            }
          }

          // ELITE: If we got valid filtered data, return immediately (don't try other URLs)
          if (filtered.length > 0) {
            if (__DEV__) {
              logger.info(`✅ Kandilli HTML başarılı: ${filtered.length} deprem alındı (URL: ${url})`);
            }
            return filtered;
          }
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error(String(error));
          // ELITE: Reduce logging noise - only log first 2 attempts
          if (__DEV__ && urls.indexOf(url) < 2) {
            const errorType = error instanceof Error ? error.name : 'Unknown';
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.debug(`⚠️ Kandilli HTML fetch başarısız (${url}): ${errorType}: ${errorMessage}`);
          }
          // Try next URL
          continue;
        }
      }

      // All URLs failed - silent fail (expected in some network conditions)
      // Don't spam logs - this is normal if Kandilli is down or network is slow
      if (__DEV__) {
        logger.debug(`⚠️ Tüm Kandilli HTML URL'leri başarısız oldu:`, lastError?.message || 'Unknown error');
      }
      return [];
    } catch (error: unknown) {
      if (__DEV__) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.debug('Kandilli HTML fetch error:', errMsg);
      }
      return [];
    }
  }

  private parseKandilliHTML(html: string): Earthquake[] {
    try {
      const earthquakes: Earthquake[] = [];

      // Kandilli HTML format: pre tag with fixed-width text
      // Real format: "2025.11.10 22:54:37  39.2353   28.1785        8.5      -.-  1.7  -.-   SINDIRGI (BALIKESIR)"
      // Format: YYYY.MM.DD HH:MM:SS  LAT      LON      DEPTH    MD   ML   Mw    LOCATION

      // Extract pre tag content - CRITICAL: Handle both <pre> and <PRE> tags
      const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      if (!preMatch) {
        if (__DEV__) {
          logger.warn('⚠️ Kandilli HTML: <pre> tag bulunamadı!');
        }
        return [];
      }

      const content = preMatch[1];
      const lines = content.split('\n');

      if (__DEV__) {
        logger.debug(`📊 Kandilli HTML: ${lines.length} satır bulundu`);
      }

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines, header lines, and lines that are too short
        if (!trimmed ||
          trimmed.length < 50 ||
          trimmed.includes('Date') ||
          trimmed.includes('Tarih') ||
          trimmed.includes('Büyüklük') ||
          trimmed.includes('TÜRKİYE VE YAKIN') ||
          trimmed.includes('BÖLGESEL DEPREM') ||
          trimmed.includes('YAPAY SARSINTI') ||
          trimmed.includes('Son 500 deprem') ||
          trimmed.includes('---') ||
          trimmed.startsWith('YYYY') ||
          trimmed.startsWith('----------') ||
          trimmed.startsWith('..................') ||
          trimmed.startsWith('.....') ||
          /^[^0-9]/.test(trimmed)) {
          continue;
        }

        try {
          // CRITICAL: Parse Kandilli fixed-width format accurately
          // Real format: "2025.11.10 22:54:37  39.2353   28.1785        8.5      -.-  1.7  -.-   SINDIRGI (BALIKESIR)"

          if (trimmed.length < 60) continue;

          // Use regex for more flexible parsing (handles variable spacing)
          const dateTimeMatch = trimmed.match(/^(\d{4}\.\d{2}\.\d{2})\s+(\d{2}:\d{2}:\d{2})/);
          if (!dateTimeMatch) continue;

          const dateStr = dateTimeMatch[1]; // YYYY.MM.DD
          const timeStr = dateTimeMatch[2]; // HH:MM:SS

          // Extract coordinates and magnitude using regex (more reliable)
          const coordsMatch = trimmed.match(/\s+(\d{2}\.\d{4})\s+(\d{2}\.\d{4})\s+(\d+\.?\d*)\s+/);
          if (!coordsMatch) continue;

          const latStr = coordsMatch[1];
          const lonStr = coordsMatch[2];
          const depthStr = coordsMatch[3];

          // Extract ML magnitude (main magnitude field)
          // Format: "MD   ML   Mw" -> we want ML (second value)
          // Example: "      -.-  1.7  -.-   " -> ML = 1.7
          // More flexible regex to handle variable spacing
          const magPattern = /\s+(-\.-|\d+\.\d+)\s+(-\.-|\d+\.\d+)\s+(-\.-|\d+\.\d+)\s+/;
          let magMatch = trimmed.match(magPattern);

          if (!magMatch) {
            // Fallback: Try simpler pattern
            const simpleMagMatch = trimmed.match(/\s+(-\.-|\d+\.\d+)\s+(-\.-|\d+\.\d+)\s+(-\.-|\d+\.\d+)/);
            if (!simpleMagMatch) continue;
            magMatch = simpleMagMatch;
          }

          // ML is the second magnitude value (index 2 in match array)
          // Priority: ML > Mw > MD (use first valid magnitude)
          let magStr = '-1';
          const magnitudes = [magMatch[1], magMatch[2], magMatch[3]]; // MD, ML, Mw

          // Prefer ML (index 1), then Mw (index 2), then MD (index 0)
          const priority = [1, 2, 0]; // ML first, then Mw, then MD
          for (const idx of priority) {
            if (magnitudes[idx] && magnitudes[idx] !== '-.-') {
              const magValue = parseFloat(magnitudes[idx]);
              if (!isNaN(magValue) && magValue > 0) {
                magStr = magnitudes[idx];
                break;
              }
            }
          }

          if (magStr === '-1') continue; // No valid magnitude found

          // Extract location (everything after the magnitude fields)
          const locationMatch = trimmed.match(/\s+(-\.-|\d+\.\d+)\s+(-\.-|\d+\.\d+)\s+(-\.-|\d+\.\d+)\s+(.+?)(?:\s+İlksel|$)/);
          const location = locationMatch && locationMatch[4]
            ? locationMatch[4].trim().replace(/\s+/g, ' ')
            : trimmed.substring(61).trim().replace(/\s+/g, ' ').split(/\s+/)[0] || 'Türkiye';

          // Validate date format (YYYY.MM.DD)
          if (!/^\d{4}\.\d{2}\.\d{2}$/.test(dateStr)) continue;

          // Validate time format (HH:MM:SS)
          if (!/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) continue;

          // Parse date/time (Kandilli uses Turkey timezone UTC+3)
          // CRITICAL: Kandilli verileri Türkiye saatine göre (UTC+3) geliyor
          const dateTimeStr = `${dateStr.replace(/\./g, '-')} ${timeStr}`;

          // CRITICAL: Parse as Turkey timezone (UTC+3) explicitly
          // Add timezone indicator to ensure correct parsing
          const dateTimeWithTz = `${dateTimeStr}+03:00`;
          const parsedDate = new Date(dateTimeWithTz);

          // If timezone parsing fails, fallback to manual conversion
          let utcTime: number;
          if (!isNaN(parsedDate.getTime())) {
            utcTime = parsedDate.getTime();
          } else {
            // Fallback: Parse as local and convert from Turkey timezone (UTC+3)
            const localDate = new Date(dateTimeStr);
            const localTime = localDate.getTime();
            const localOffset = localDate.getTimezoneOffset() * 60 * 1000; // Local timezone offset in ms
            const turkeyOffset = -3 * 60 * 60 * 1000; // UTC+3 = -180 minutes
            // Convert: local time -> UTC -> Turkey time -> UTC (subtract Turkey offset)
            utcTime = localTime - localOffset - turkeyOffset;
          }

          const latitude = parseFloat(latStr);
          const longitude = parseFloat(lonStr);
          const depth = parseFloat(depthStr);
          const magnitude = parseFloat(magStr);

          // Validate parsed values
          if (isNaN(utcTime) || utcTime <= 0) {
            if (__DEV__ && earthquakes.length < 3) {
              logger.debug(`⚠️ Kandilli HTML: Geçersiz zaman - ${dateStr} ${timeStr} -> ${utcTime}`);
            }
            continue;
          }

          if (isNaN(latitude) || latitude < 35 || latitude > 43 ||
            isNaN(longitude) || longitude < 25 || longitude > 45) {
            if (__DEV__ && earthquakes.length < 3) {
              logger.debug(`⚠️ Kandilli HTML: Geçersiz koordinatlar - ${latitude}, ${longitude}`);
            }
            continue;
          }

          if (isNaN(depth) || depth < 0 || depth > 1000) {
            if (__DEV__ && earthquakes.length < 3) {
              logger.debug(`⚠️ Kandilli HTML: Geçersiz derinlik - ${depth}`);
            }
            continue;
          }

          if (isNaN(magnitude) || magnitude < 0 || magnitude > 10) {
            if (__DEV__ && earthquakes.length < 3) {
              logger.debug(`⚠️ Kandilli HTML: Geçersiz büyüklük - ${magnitude}`);
            }
            continue;
          }

          // Validate coordinates are within Turkey bounds
          if (latitude >= 35 && latitude <= 43 &&
            longitude >= 25 && longitude <= 45 &&
            magnitude >= 1.0 && magnitude <= 10 &&
            location && location.length > 0) {
            const earthquake = {
              id: `kandilli-html-${utcTime}-${Math.round(latitude * 1000)}-${Math.round(longitude * 1000)}`,
              magnitude,
              location: location || 'Türkiye',
              depth: Math.max(0, Math.min(1000, depth)),
              time: utcTime,
              latitude,
              longitude,
              source: 'KANDILLI' as const,
            };

            earthquakes.push(earthquake);

            if (__DEV__ && earthquakes.length <= 3) {
              logger.debug(`✅ Kandilli HTML deprem ${earthquakes.length} parse edildi: ${location} - ${magnitude} ML - ${dateStr} ${timeStr}`);
            }
          } else {
            if (__DEV__ && earthquakes.length < 3) {
              logger.debug(`⚠️ Kandilli HTML deprem filtrelendi: ${location || 'N/A'} - ${magnitude} ML (lat: ${latitude}, lon: ${longitude})`);
            }
          }
        } catch (parseError) {
          // Skip malformed lines
          if (__DEV__ && earthquakes.length < 3) {
            logger.debug('Kandilli HTML parse error for line:', trimmed.substring(0, 50));
          }
          continue;
        }
      }

      // ELITE: Remove duplicates with flexible deduplication (same as AFAD HTML Provider)
      // 1 minute buckets ensures rapid successive earthquakes are not missed
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
      logger.error('Kandilli HTML parse error:', error);
      return [];
    }
  }
}

export const kandilliHTMLProvider = new KandilliHTMLProvider();

