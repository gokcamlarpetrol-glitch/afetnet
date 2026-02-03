/**
 * EARTHQUAKE DATA PROCESSOR - ELITE MODULAR
 * Processes and validates earthquake data from various sources
 */

import { getErrorMessage } from '../../utils/errorUtils';
import { Earthquake } from '../../stores/earthquakeStore';
import { createLogger } from '../../utils/logger';
import { parseAFADDate, formatToTurkishDateTime, formatToTurkishTimeOnly } from '../../utils/timeUtils';

const logger = createLogger('EarthquakeDataProcessor');

export interface ProcessedEarthquakeResult {
  earthquakes: Earthquake[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    filtered: number;
  };
}

/**
 * ELITE: Process AFAD events into Earthquake array
 * Extracted for reuse and better error handling
 */
export function processAFADEvents(events: any[]): Earthquake[] {
  // CRITICAL: AFAD API may return unsorted data - sort by eventDate descending (newest first)
  const sortedEvents = events.sort((a: any, b: any) => {
    const dateA = a.eventDate || a.date || a.originTime || '';
    const dateB = b.eventDate || b.date || b.originTime || '';
    return dateB.localeCompare(dateA);
  });

  if (__DEV__) {
    logger.info(`✅ AFAD'dan ${sortedEvents.length} deprem verisi alındı (sıralandı)`);
  }

  if (sortedEvents.length === 0) {
    if (__DEV__) {
      logger.warn('⚠️ AFAD API boş veri döndü!');
    }
    return [];
  }

  // Log first 10 earthquakes in dev mode
  if (__DEV__) {
    logAFADEvents(sortedEvents);
  }

  // Validate and transform earthquake data
  const earthquakes: Earthquake[] = [];

  for (let i = 0; i < sortedEvents.length; i++) {
    const item = sortedEvents[i];
    try {
      const earthquake = processAFADEvent(item, i);
      if (earthquake) {
        earthquakes.push(earthquake);
      }
    } catch (parseError: unknown) {
      if (__DEV__ && i < 5) {
        logger.warn(`⚠️ AFAD deprem parse hatası (${i + 1}/${events.length}):`, getErrorMessage(parseError));
      }
      continue;
    }
  }

  // Sort by time (newest first) and limit to 100
  earthquakes.sort((a, b) => b.time - a.time);
  const limitedEarthquakes = earthquakes.slice(0, 100);

  if (__DEV__) {
    logger.info(`✅ Validated ${limitedEarthquakes.length} earthquakes from ${events.length} raw events (AFAD)`);
  }

  return limitedEarthquakes;
}

/**
 * Process a single AFAD event
 */
function processAFADEvent(item: any, index: number): Earthquake | null {
  const eventDate = item.eventDate || item.date || item.originTime;
  const magnitude = parseFloat(item.mag || item.magnitude || item.ml || '0');

  // Validate magnitude
  if (isNaN(magnitude) || magnitude < 0 || magnitude > 10) {
    if (__DEV__ && index < 5) {
      logger.warn(`⚠️ AFAD deprem ${index + 1}: Geçersiz büyüklük - ${magnitude}`);
    }
    return null;
  }

  // Location parsing with validation
  const locationParts = [
    item.location,
    item.ilce,
    item.sehir,
    item.title,
    item.place,
  ].filter(Boolean);

  const location = locationParts.length > 0
    ? locationParts.join(', ').trim()
    : 'Türkiye';

  if (!location || location.length === 0) {
    if (__DEV__ && index < 5) {
      logger.warn(`⚠️ AFAD deprem ${index + 1}: Boş konum`);
    }
    return null;
  }

  // Parse coordinates
  const latitude = parseFloat(item.geojson?.coordinates?.[1] || item.latitude || item.lat || '0');
  const longitude = parseFloat(item.geojson?.coordinates?.[0] || item.longitude || item.lng || '0');

  // Parse depth
  const depth = parseFloat(item.depth || item.derinlik || '10');
  if (isNaN(depth) || depth < 0 || depth > 1000) {
    if (__DEV__ && index < 5) {
      logger.warn(`⚠️ AFAD deprem ${index + 1}: Geçersiz derinlik - ${depth}`);
    }
  }

  // Parse time
  let time: number;
  if (eventDate) {
    time = parseAFADDate(eventDate);

    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const maxFuture = 1 * 60 * 60 * 1000; // 1 hour

    if (time > now + maxFuture) {
      if (__DEV__ && index < 5) {
        const diffHours = (time - now) / (60 * 60 * 1000);
        logger.warn(`⚠️ AFAD deprem ${index + 1}: Parse edilen zaman ${diffHours.toFixed(1)} saat gelecekte`);
      }
    } else if (time < now - maxAge) {
      if (__DEV__ && index < 5) {
        const diffDays = (now - time) / (24 * 60 * 60 * 1000);
        logger.debug(`ℹ️ AFAD deprem ${index + 1}: Parse edilen zaman ${diffDays.toFixed(1)} gün önce`);
      }
    }

    if (isNaN(time) || time <= 0) {
      if (__DEV__ && index < 5) {
        logger.warn(`⚠️ AFAD deprem ${index + 1}: Geçersiz zaman - ${eventDate}`);
      }
      return null;
    }
  } else {
    time = Date.now();
    if (__DEV__ && index < 5) {
      logger.warn(`⚠️ AFAD deprem ${index + 1}: Tarih yok, şu anki zaman kullanılıyor`);
    }
  }

  // Generate stable ID
  const eventId = item.eventID || item.eventId || item.id;
  const id = eventId
    ? `afad-${eventId}`
    : `afad-${Math.round(latitude * 1000)}-${Math.round(longitude * 1000)}-${time}`;

  const earthquake: Earthquake = {
    id,
    magnitude,
    location,
    depth: isNaN(depth) ? 10 : Math.max(0, Math.min(1000, depth)),
    time,
    latitude,
    longitude,
    source: 'AFAD' as const,
  };

  // CRITICAL: AFAD is the official source - if AFAD shows an earthquake, we should show it too
  // Don't filter AFAD earthquakes by strict Turkey bounds - AFAD already decides what to show
  // Only validate that data is reasonable (magnitude, location exists)
  if (earthquake.magnitude >= 0.1 && earthquake.magnitude <= 10 &&
    earthquake.location && earthquake.location.length > 0 &&
    !isNaN(earthquake.latitude) && !isNaN(earthquake.longitude) &&
    earthquake.latitude >= -90 && earthquake.latitude <= 90 &&
    earthquake.longitude >= -180 && earthquake.longitude <= 180) {

    if (__DEV__ && index < 3) {
      logger.debug(`✅ AFAD deprem ${index + 1} parse edildi: ${earthquake.location} - ${earthquake.magnitude} ML`);
    }
    return earthquake;
  } else {
    if (__DEV__ && index < 5) {
      logger.debug(`⚠️ AFAD deprem filtrelendi: ${location} - ${magnitude} ML (geçersiz veri)`);
    }
    return null;
  }
}

/**
 * Log AFAD events for debugging
 */
function logAFADEvents(sortedEvents: any[]) {
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('📊 AFAD API VERİLERİ (İlk 10 Deprem - RAW API ORDER)');
  logger.info('═══════════════════════════════════════════════════════');
  const now = Date.now();
  const currentTimeStr = formatToTurkishDateTime(now);
  logger.info(`🕐 ŞU ANKİ ZAMAN (Türkiye): ${currentTimeStr}`);
  logger.info(`📅 Tarih: ${new Date(now).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}`);
  logger.info(`📊 Toplam ${sortedEvents.length} deprem API'den geldi`);
  logger.info('');

  sortedEvents.slice(0, 10).forEach((eq: any, i: number) => {
    const mag = eq.mag || eq.magnitude || eq.ml || 'N/A';
    const date = eq.eventDate || eq.date || eq.originTime || 'N/A';
    const loc = eq.location || eq.ilce || eq.sehir || 'N/A';
    logger.info(`  ${i + 1}. ${loc} - Büyüklük: ${mag} ML`);
    logger.info(`     📅 Raw API Date: ${date}`);

    if (date && date !== 'N/A') {
      const parsedTime = parseAFADDate(date);
      const parsedTimeStr = formatToTurkishDateTime(parsedTime);
      const parsedTimeOnly = formatToTurkishTimeOnly(parsedTime);
      const diffMinutes = Math.round((now - parsedTime) / (60 * 1000));
      const diffHours = Math.round(diffMinutes / 60);
      const isFuture = parsedTime > now;
      const isOld = parsedTime < now - 24 * 60 * 60 * 1000;

      logger.info(`     ✅ Parse Edildi: ${parsedTimeStr}`);
      logger.info(`     🕐 Saat: ${parsedTimeOnly}`);
      logger.info(`     ⏱️  Zaman Farkı: ${diffMinutes} dakika (${isFuture ? 'GELECEKTE' : diffHours + ' saat önce'})`);

      // ELITE: Only warn for critical issues (future time or very old data)
      // Reduce log noise by only warning for first 3 earthquakes or critical cases
      if (isFuture && diffHours > 1) {
        if (i < 3) {
          logger.warn(`     ⚠️ UYARI: Parse edilen zaman ${diffHours} saat GELECEKTE!`);
        }
      } else if (isOld && i < 3) {
        // Only log for first 3 earthquakes to reduce noise
        const daysOld = Math.round(diffHours / 24);
        if (daysOld > 5) {
          logger.debug(`     ℹ️ Parse edilen zaman ${daysOld} gün önce (normal - eski veri)`);
        }
      }
    } else {
      logger.warn(`     ⚠️ Tarih bilgisi yok!`);
    }
    logger.info('');
  });
  logger.info('═══════════════════════════════════════════════════════');
}

/**
 * Filter earthquakes by Turkey bounds
 */
export function filterByTurkeyBounds(earthquakes: Earthquake[]): Earthquake[] {
  const TURKEY_BOUNDS = {
    minLat: 35.0,
    maxLat: 43.0,
    minLon: 25.0,
    maxLon: 45.0,
  };

  return earthquakes.filter((eq) => {
    return eq.latitude >= TURKEY_BOUNDS.minLat &&
      eq.latitude <= TURKEY_BOUNDS.maxLat &&
      eq.longitude >= TURKEY_BOUNDS.minLon &&
      eq.longitude <= TURKEY_BOUNDS.maxLon;
  });
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

