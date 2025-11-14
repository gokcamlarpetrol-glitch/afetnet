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
    try {
      // ELITE: Try multiple Kandilli endpoints (real-time data sources)
      // ELITE: Optimized endpoint order for fastest initial load
      // Start with HTTPS endpoints first (more reliable in modern networks)
      // Reduced number of endpoints to try faster
      const endpoints = [
        'https://www.koeri.boun.edu.tr/scripts/lst1.asp', // Primary HTTPS (most reliable)
        'http://www.koeri.boun.edu.tr/scripts/lst1.asp',   // HTTP fallback
        'https://www.koeri.boun.edu.tr/scripts/lst0.asp',  // Alternative HTTPS
      ];

      let lastError: Error | null = null;
      let attemptCount = 0;
      const maxAttempts = endpoints.length;

      for (const url of endpoints) {
        attemptCount++;
        // CRITICAL: Create new AbortController for each endpoint attempt
        const controller = new AbortController();
        // ELITE: Reduced timeout to 20s for faster initial load
        // Kandilli endpoints should respond quickly - shorter timeout prevents delays
        // If first endpoint fails, try next one immediately instead of waiting 45s
        const timeoutId = setTimeout(() => {
          if (__DEV__) {
            logger.debug(`⏱️ Kandilli timeout başlatılıyor: ${url}`);
          }
          controller.abort();
        }, 20000); // 20s timeout (reduced from 45s for faster initial load)

        try {
          if (__DEV__) {
            logger.debug(`📡 Kandilli endpoint deneniyor: ${url}`);
          }

          // CRITICAL: Use fetch with proper error handling for React Native
          // CRITICAL: HTTP endpoints work better for Kandilli (no SSL issues)
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
            // Note: React Native fetch doesn't support cache option
            // CRITICAL: Allow redirects for Kandilli endpoints
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

          // CRITICAL: Check if HTML contains earthquake data
          if (!html.includes('<pre') && !html.includes('<PRE')) {
            throw new Error('No pre tag found in HTML');
          }

          const earthquakes = this.parseKandilliHTML(html);
          
          if (__DEV__) {
            logger.info(`📊 Kandilli HTML parse tamamlandı: ${earthquakes.length} deprem parse edildi (endpoint: ${url})`);
          }
          
          // Filter: Last 7 days and magnitude >= 1.0 (same as AFAD)
          const now = Date.now();
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
          const filtered = earthquakes.filter(eq => {
            const isRecent = eq.time >= sevenDaysAgo;
            const isValidMag = eq.magnitude >= 1.0;
            const isNotFuture = eq.time <= now + 2 * 60 * 60 * 1000; // Allow 2 hours in future
            
            return isRecent && isValidMag && isNotFuture;
          });

          if (__DEV__) {
            logger.info(`✅ Kandilli: ${filtered.length} deprem verisi alındı (${earthquakes.length} parse edildi)`);
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
                second: '2-digit'
              });
              logger.info(`🔝 Kandilli en son deprem: ${latest.location} - ${latest.magnitude} ML - ${latestTime}`);
            } else if (earthquakes.length > 0) {
              logger.warn(`⚠️ Kandilli: ${earthquakes.length} deprem parse edildi ama hiçbiri filtre kriterlerini geçmedi!`);
              const oldest = earthquakes[earthquakes.length - 1];
              const oldestTime = new Date(oldest.time).toLocaleString('tr-TR', { 
                timeZone: 'Europe/Istanbul', 
                hour12: false
              });
              logger.warn(`   En eski deprem: ${oldestTime} (${Math.round((now - oldest.time) / (24 * 60 * 60 * 1000))} gün önce)`);
            } else {
              logger.warn(`⚠️ Kandilli: Hiç deprem parse edilemedi!`);
            }
          }

          // CRITICAL: If we got valid filtered data, return immediately (don't try other endpoints)
          if (filtered.length > 0) {
            if (__DEV__) {
              logger.info(`✅ Kandilli başarılı: ${filtered.length} deprem alındı (endpoint: ${url}, deneme: ${attemptCount}/${maxAttempts})`);
            }
            return filtered;
          } else {
            // No earthquakes after filtering - might be empty or parse error
            if (__DEV__) {
              logger.warn(`⚠️ Kandilli parse sonucu boş: ${url} (deneme: ${attemptCount}/${maxAttempts}, parse edilen: ${earthquakes.length})`);
            }
            // Continue to next endpoint
            throw new Error('No earthquakes after filtering');
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          lastError = error;
          
          // CRITICAL: Log detailed error information
          const errorType = error?.name || 'Unknown';
          const errorMessage = error?.message || String(error);
          const isAborted = errorType === 'AbortError' || errorMessage.includes('aborted');
          const isNetworkError = errorMessage.includes('Network request failed') || 
                                errorMessage.includes('network') ||
                                errorType === 'TypeError';
          
          // ELITE: Reduce logging noise - only log first 2 attempts
          if (__DEV__ && attemptCount <= 2) {
            if (isAborted) {
              logger.debug(`⏱️ Kandilli timeout: ${url} (20s timeout)`);
            } else if (isNetworkError) {
              logger.debug(`🌐 Kandilli network error: ${url} - ${errorMessage}`);
            } else {
              logger.debug(`⚠️ Kandilli endpoint başarısız: ${url} - ${errorType}: ${errorMessage}`);
            }
          }
          
          // Try next endpoint
          continue;
        }
      }

      // All endpoints failed - silent fail (expected in some network conditions)
      // Don't spam logs - this is normal if Kandilli is down or network is slow
      if (__DEV__) {
        logger.debug(`⚠️ Tüm Kandilli endpoint'leri başarısız oldu (${attemptCount}/${maxAttempts} deneme):`, lastError?.message || 'Unknown error');
      }
      return [];
    } catch (error: any) {
      if (__DEV__) {
        logger.debug('Kandilli fetch error:', error?.message || String(error));
      }
      return [];
    }
  }

  private parseKandilliHTML(html: string): Earthquake[] {
    try {
      const earthquakes: Earthquake[] = [];
      
      // Kandilli HTML format: pre tag with fixed-width text
      // Real format from http://www.koeri.boun.edu.tr/scripts/lst0.asp:
      // 2025.11.10 22:54:37  39.2353   28.1785        8.5      -.-  1.7  -.-   SINDIRGI (BALIKESIR)                              İlksel
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
          // Positions based on actual web site format:
          // Date: YYYY.MM.DD (positions 0-10)
          // Time: HH:MM:SS (positions 11-19)
          // Lat: XX.XXXX (positions 20-28, variable spacing)
          // Lon: XX.XXXX (positions 29-37, variable spacing)
          // Depth: XX.X (positions 38-45, variable spacing)
          // MD: -.- or X.X (positions 46-50)
          // ML: X.X (positions 51-55) - THIS IS THE MAGNITUDE
          // Mw: -.- or X.X (positions 56-60)
          // Location: rest (position 61+)
          
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
          // Format: "YYYY-MM-DD HH:MM:SS" -> Parse as Turkey timezone
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

          // Validate parsed values with detailed logging
          if (isNaN(utcTime) || utcTime <= 0) {
            if (__DEV__ && earthquakes.length < 3) {
              logger.debug(`⚠️ Kandilli: Geçersiz zaman - ${dateStr} ${timeStr} -> ${utcTime}`);
            }
            continue;
          }
          
          if (isNaN(latitude) || latitude < 35 || latitude > 43 ||
              isNaN(longitude) || longitude < 25 || longitude > 45) {
            if (__DEV__ && earthquakes.length < 3) {
              logger.debug(`⚠️ Kandilli: Geçersiz koordinatlar - ${latitude}, ${longitude}`);
            }
            continue;
          }
          
          if (isNaN(depth) || depth < 0 || depth > 1000) {
            if (__DEV__ && earthquakes.length < 3) {
              logger.debug(`⚠️ Kandilli: Geçersiz derinlik - ${depth}`);
            }
            continue;
          }
          
          if (isNaN(magnitude) || magnitude < 0 || magnitude > 10) {
            if (__DEV__ && earthquakes.length < 3) {
              logger.debug(`⚠️ Kandilli: Geçersiz büyüklük - ${magnitude}`);
            }
            continue;
          }

          // Validate coordinates are within Turkey bounds
          // CRITICAL: Process each earthquake individually (one by one) - same as AFAD
          // Validate each earthquake before adding
          if (latitude >= 35 && latitude <= 43 && 
              longitude >= 25 && longitude <= 45 &&
              magnitude >= 1.0 && magnitude <= 10 &&
              location && location.length > 0) {
            const earthquake = {
              id: `kandilli-${utcTime}-${Math.round(latitude * 1000)}-${Math.round(longitude * 1000)}`,
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
              logger.debug(`✅ Kandilli deprem ${earthquakes.length} parse edildi: ${location} - ${magnitude} ML - ${dateStr} ${timeStr}`);
            }
          } else {
            if (__DEV__ && earthquakes.length < 3) {
              logger.debug(`⚠️ Kandilli deprem filtrelendi: ${location || 'N/A'} - ${magnitude} ML (lat: ${latitude}, lon: ${longitude})`);
            }
          }
        } catch (parseError) {
          // Skip malformed lines
          if (__DEV__) {
            logger.debug('Kandilli parse error for line:', trimmed.substring(0, 50));
          }
          continue;
        }
      }

      // Remove duplicates (same location and time within 5 minutes)
      const unique: Earthquake[] = [];
      const seen = new Set<string>();
      
      for (const eq of earthquakes) {
        const timeKey = Math.floor(eq.time / (5 * 60 * 1000)); // 5 minute buckets
        const latKey = Math.round(eq.latitude * 100);
        const lonKey = Math.round(eq.longitude * 100);
        const key = `${timeKey}-${latKey}-${lonKey}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(eq);
        }
      }

      return unique
        .sort((a, b) => b.time - a.time)
        .slice(0, 100);
    } catch (error) {
      logger.error('Kandilli parse error:', error);
      return [];
    }
  }
}

export const kandilliProvider = new KandilliProvider();
