/**
 * TIME UTILITIES
 * Timezone-aware date/time formatting for Turkey (Europe/Istanbul, GMT+3)
 * ELITE: Automatic timezone detection and conversion
 */

import { createLogger } from './logger';

const logger = createLogger('TimeUtils');

// Turkey timezone (Europe/Istanbul, GMT+3)
const TURKEY_TIMEZONE = 'Europe/Istanbul';

function getTurkeyDateParts(input: number | Date) {
  const date = input instanceof Date ? input : new Date(input);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TURKEY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
}

/**
 * Format a timestamp for Turkish-local earthquake provider APIs.
 * AFAD and Kandilli no-timezone date strings represent Europe/Istanbul time.
 */
export function formatTurkeyApiDateTime(input: number | Date = Date.now()): string {
  try {
    const parts = getTurkeyDateParts(input);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  } catch (error) {
    logger.warn('Turkey API datetime formatting error:', error);
    const fallbackDate = input instanceof Date ? input : new Date(input);
    return fallbackDate.toISOString().replace('Z', '').split('.')[0];
  }
}

/**
 * Format a timestamp as YYYY-MM-DD in Turkey local time.
 */
export function formatTurkeyApiDate(input: number | Date = Date.now()): string {
  return formatTurkeyApiDateTime(input).split('T')[0];
}

/**
 * Format timestamp to Turkish local time
 * Automatically converts to Turkey timezone regardless of device timezone
 * CRITICAL: Includes seconds for accurate real-time display
 */
export function formatToTurkishTime(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    
    // ELITE: Use Turkey timezone explicitly with 24-hour format
    return date.toLocaleString('tr-TR', {
      timeZone: TURKEY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit', // CRITICAL: Include seconds for accurate display
      hour12: false, // CRITICAL: Force 24-hour format (HH:MM:SS)
    });
  } catch (error) {
    logger.warn('Time formatting error:', error);
    return new Date(timestamp).toLocaleString('tr-TR', { hour12: false });
  }
}

/**
 * Format timestamp to Turkish date only (DD.MM.YYYY)
 */
export function formatToTurkishDate(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    
    return date.toLocaleDateString('tr-TR', {
      timeZone: TURKEY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (error) {
    logger.warn('Date formatting error:', error);
    return new Date(timestamp).toLocaleDateString('tr-TR');
  }
}

/**
 * Format timestamp to Turkish time only (HH:MM:SS)
 * CRITICAL: Includes seconds for accurate real-time display
 */
export function formatToTurkishTimeOnly(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    
    // CRITICAL: Force 24-hour format (HH:MM:SS) for Turkey timezone
    return date.toLocaleTimeString('tr-TR', {
      timeZone: TURKEY_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit', // CRITICAL: Include seconds for accurate display
      hour12: false, // CRITICAL: Force 24-hour format (22:59:30 instead of 10:59:30 PM)
    });
  } catch (error) {
    logger.warn('Time-only formatting error:', error);
    return new Date(timestamp).toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit', // CRITICAL: Include seconds
      hour12: false, // CRITICAL: Force 24-hour format
    });
  }
}

/**
 * Format timestamp to Turkish date and time (DD.MM.YYYY HH:MM:SS)
 * CRITICAL: Includes seconds for accurate real-time display
 */
export function formatToTurkishDateTime(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    
    // CRITICAL: Force 24-hour format (DD.MM.YYYY HH:MM:SS) for Turkey timezone
    return date.toLocaleString('tr-TR', {
      timeZone: TURKEY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit', // CRITICAL: Include seconds for accurate display
      hour12: false, // CRITICAL: Force 24-hour format (22:59:30 instead of 10:59:30 PM)
    });
  } catch (error) {
    logger.warn('DateTime formatting error:', error);
    return new Date(timestamp).toLocaleString('tr-TR', { hour12: false });
  }
}

/**
 * Calculate time difference in Turkish (e.g., "5 dakika önce", "2 saat önce")
 */
export function getTimeDifferenceTurkish(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'Az önce';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} dakika önce`;
  } else if (diffHours < 24) {
    return `${diffHours} saat önce`;
  } else if (diffDays < 7) {
    return `${diffDays} gün önce`;
  } else {
    return formatToTurkishDateTime(timestamp);
  }
}

/**
 * görev #10: Resmi deprem feed tarihlerini ms-since-epoch'a ayrıştırır.
 *
 * AFAD APIv2 (ISO-T formatı, "2025-11-10T22:27:06") tarihleri **UTC** olarak
 * yayımlar — saat dilimi eki yoktur. Kandilli (KOERI lst0.asp, noktalı format
 * "2025.11.10 22:27:06") ise **Türkiye yerel saatini** yayımlar. Sunucu
 * (functions/eew.ts:113-117) bu ayrımı doğru yapıyor; istemci eskiden ikisini
 * de Türkiye-yerel sanıp +03:00 ekliyordu → AFAD timestamp'leri 3 saat ileride
 * çıkıyor, isFreshOfficialEvent (±5dk) TÜM AFAD olaylarını "stale" diye eliyor
 * ve istemci-taraflı AFAD EEW yolu sessizce ölüyordu.
 *
 * Format farkı = kaynak farkı. Noktalı tarih varsa Kandilli (+03:00), ISO-T ise
 * AFAD (Z). Mevcut isim 'parseAFADDate' geriye dönük uyumluluk için kalıyor.
 */
export function parseAFADDate(dateString: string): number {
  try {
    if (!dateString || dateString.trim().length === 0) {
      if (__DEV__) {
        logger.warn('Empty date string provided');
      }
      return Date.now();
    }

    // AFAD APIv2 formatı: "2025-11-10T22:27:06" veya "2025-11-10 22:27:06" — UTC.
    // Kandilli (KOERI) noktalı formatı: "2025.11.10 22:27:06" — Türkiye yerel saati.
    // Format kaynağı netleştirir: noktalı varsa Kandilli, ISO-T varsa AFAD.
    let normalizedDate = dateString.trim();
    const dottedDateMatch = /^(\d{4})\.(\d{2})\.(\d{2})(.*)$/.exec(normalizedDate);
    const isKandilliFormat = dottedDateMatch !== null;
    if (dottedDateMatch) {
      normalizedDate = `${dottedDateMatch[1]}-${dottedDateMatch[2]}-${dottedDateMatch[3]}${dottedDateMatch[4]}`;
    }
    normalizedDate = normalizedDate.replace(/\s+/, 'T');
    
    // Check if date already has timezone info
    const hasTimezone = /[+-]\d{2}:\d{2}$/.test(normalizedDate) || normalizedDate.endsWith('Z');
    
    let parsedDate: Date;
    if (hasTimezone) {
      // Already has timezone - parse directly
      parsedDate = new Date(normalizedDate);
    } else {
      // görev #10: Saat dilimi eki yok — kaynak konvansiyonunu uygula.
      // - Kandilli (noktalı format → isKandilliFormat=true): Türkiye yerel (+03:00).
      //   Kandilli sayfası ve API'si yerel saat yayımlıyor; +03:00 doğru.
      // - AFAD APIv2 (ISO-T format → isKandilliFormat=false): UTC ('Z').
      //   Sunucu (functions/eew.ts:117 parseAfadUtcDateTime) UTC olarak ayrıştırıyor
      //   ve canlı doğrulama (M5.6 Malatya, 2026-05-21) UTC olduğunu kanıtladı.
      //   Eski kod ikisine de +03:00 uyguluyordu → AFAD timestamp'leri 3sa ileri
      //   kayıyor, ±5dk freshness gate'i istemci AFAD yolunu öldürüyordu.
      const tzSuffix = isKandilliFormat ? '+03:00' : 'Z';
      parsedDate = new Date(normalizedDate + tzSuffix);
      
      // Validate parse succeeded
      if (isNaN(parsedDate.getTime())) {
        if (__DEV__) {
          logger.warn('⚠️ AFAD date parse failed, trying fallback:', normalizedDate);
        }
        // Fallback: Try UTC (shouldn't happen, but safety net)
        const utcDate = new Date(normalizedDate + 'Z');
        if (!isNaN(utcDate.getTime())) {
          parsedDate = utcDate;
          if (__DEV__) {
            logger.warn('⚠️ Used UTC fallback for AFAD date:', normalizedDate);
          }
        } else {
          // Final fallback: Local timezone
          parsedDate = new Date(normalizedDate);
          if (__DEV__) {
            logger.warn('⚠️ Used local timezone fallback for AFAD date:', normalizedDate);
          }
        }
      } else {
        // Parse successful - verify it makes sense
        const now = Date.now();
        const parsedTime = parsedDate.getTime();
        const diffHours = Math.abs(parsedTime - now) / (60 * 60 * 1000);
        
        // ELITE: Only log if date seems very wrong (more than 30 days difference) - reduce log spam
        // Most AFAD dates are recent, so we don't need to log every parse
        // Only log in extreme cases to avoid terminal spam
        if (__DEV__ && diffHours > 24 * 30) {
          logger.debug(`AFAD date parsed (${diffHours.toFixed(1)}h diff):`, {
            input: normalizedDate,
            parsed: formatToTurkishDateTime(parsedTime),
            now: formatToTurkishDateTime(now),
          });
        }
      }
    }
    
    if (!isNaN(parsedDate.getTime())) {
      // Validate: result should be reasonable (not too far in past/future)
      const now = Date.now();
      const maxAge = 60 * 24 * 60 * 60 * 1000; // 60 days
      const maxFuture = 2 * 60 * 60 * 1000; // Allow 2 hours in future (clock drift, API delays)
      
      let parsedTime = parsedDate.getTime();
      
      // CRITICAL: Only validate if date is unreasonably far in future (more than 24 hours)
      // Don't assume wrong year - use actual current date
      const oneDayFromNow = now + (24 * 60 * 60 * 1000);
      if (parsedTime > oneDayFromNow) {
        // Check if it's more than 1 year in future (likely parse error)
        if (parsedTime > now + (365 * 24 * 60 * 60 * 1000)) {
          // More than 1 year in future - might be parse error, but don't auto-correct
          // Log warning but keep original parsed time
          if (__DEV__) {
            logger.warn('⚠️ Parsed date is more than 1 year in future:', {
              input: dateString,
              parsed: formatToTurkishDateTime(parsedTime),
              now: formatToTurkishDateTime(now),
              diffDays: (parsedTime - now) / (24 * 60 * 60 * 1000),
            });
          }
          // Keep original parsed time - might be correct if API has future data
        }
      }
      
      if (parsedTime <= now + maxFuture && parsedTime >= now - maxAge) {
        // ELITE: Remove success log - too verbose, only log errors
        // Success is expected, no need to log every parse
        return parsedTime;
      } else {
        // If validation fails, still return the parsed date but log warning
        if (__DEV__) {
          logger.warn('⚠️ Parsed date outside expected range:', {
            input: dateString,
            parsed: formatToTurkishDateTime(parsedTime),
            now: formatToTurkishDateTime(now),
            diffHours: (now - parsedTime) / (60 * 60 * 1000),
          });
        }
        // Still return the parsed date - validation is just a safety check
        return parsedTime;
      }
    }
    
    // Fallback: Try parsing without timezone (less reliable)
    const fallbackDate = new Date(normalizedDate);
    if (!isNaN(fallbackDate.getTime())) {
      // Get device timezone offset
      const deviceOffsetMinutes = fallbackDate.getTimezoneOffset();
      const deviceOffsetMs = deviceOffsetMinutes * 60 * 1000;
      
      // Turkey is GMT+3, which is UTC offset of -180 minutes
      const turkeyOffsetMinutes = -180;
      const turkeyOffsetMs = turkeyOffsetMinutes * 60 * 1000;
      
      // Calculate the difference and adjust
      const offsetDiff = deviceOffsetMs - turkeyOffsetMs;
      const adjustedTime = fallbackDate.getTime() - offsetDiff;
      
      if (__DEV__) {
        logger.debug('Used fallback timezone adjustment for AFAD date:', {
          input: dateString,
          adjusted: formatToTurkishDateTime(adjustedTime),
        });
      }
      return adjustedTime;
    }
    
    if (__DEV__) {
      logger.warn('❌ Failed to parse AFAD date:', dateString);
    }
    return Date.now();
  } catch (error) {
    if (__DEV__) {
      logger.warn('Date parse error:', error, dateString);
    }
    return Date.now();
  }
}

/**
 * Get current UTC timestamp (Unix timestamps are timezone-independent).
 * Use formatToTurkishTime() for Turkey-local display.
 */
export function getTurkeyTimeNow(): number {
  return Date.now();
}
