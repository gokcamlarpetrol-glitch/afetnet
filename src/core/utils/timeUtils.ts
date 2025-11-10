/**
 * TIME UTILITIES
 * Timezone-aware date/time formatting for Turkey (Europe/Istanbul, GMT+3)
 * ELITE: Automatic timezone detection and conversion
 */

import { createLogger } from './logger';

const logger = createLogger('TimeUtils');

// Turkey timezone (Europe/Istanbul, GMT+3)
const TURKEY_TIMEZONE = 'Europe/Istanbul';

/**
 * Format timestamp to Turkish local time
 * Automatically converts to Turkey timezone regardless of device timezone
 */
export function formatToTurkishTime(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    
    // ELITE: Use Turkey timezone explicitly
    return date.toLocaleString('tr-TR', {
      timeZone: TURKEY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (error) {
    logger.warn('Time formatting error:', error);
    return new Date(timestamp).toLocaleString('tr-TR');
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
 * Format timestamp to Turkish time only (HH:MM)
 */
export function formatToTurkishTimeOnly(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    
    return date.toLocaleTimeString('tr-TR', {
      timeZone: TURKEY_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    logger.warn('Time-only formatting error:', error);
    return new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Format timestamp to Turkish date and time (DD.MM.YYYY HH:MM)
 */
export function formatToTurkishDateTime(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    
    return date.toLocaleString('tr-TR', {
      timeZone: TURKEY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    logger.warn('DateTime formatting error:', error);
    return new Date(timestamp).toLocaleString('tr-TR');
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
 * Parse AFAD API date string to timestamp
 * AFAD API returns dates in format: "2025-11-10T01:42:12" (Turkey local time, GMT+3)
 * ELITE: Correctly handle Turkey timezone conversion
 */
export function parseAFADDate(dateString: string): number {
  try {
    if (!dateString || dateString.trim().length === 0) {
      logger.warn('Empty date string provided');
      return Date.now();
    }

    // AFAD API format: "2025-11-10T01:42:12" or "2025-11-10 01:42:12"
    // AFAD API returns dates in Turkey local time (GMT+3), not UTC
    let normalizedDate = dateString.trim().replace(' ', 'T');
    
    // Check if timezone info exists
    const hasTimezone = normalizedDate.includes('Z') || 
                        normalizedDate.includes('+') || 
                        normalizedDate.match(/-\d{2}:\d{2}$/);
    
    if (!hasTimezone) {
      // AFAD API returns dates without timezone - typically Turkey local time (GMT+3)
      // ELITE: Parse correctly by treating as Turkey timezone
      
      // Method 1: Parse as UTC and adjust for Turkey timezone (GMT+3)
      // AFAD "2025-11-10T01:42:12" means 01:42:12 Turkey time
      // Which is 22:42:12 UTC the previous day
      const utcDate = new Date(normalizedDate + 'Z');
      
      if (!isNaN(utcDate.getTime())) {
        // AFAD returns Turkey local time, so we need to convert:
        // If AFAD says "2025-11-10T01:42:12" (Turkey time)
        // That's actually "2025-11-09T22:42:12" UTC
        // So subtract 3 hours from UTC interpretation
        const turkeyTimeMs = utcDate.getTime() - (3 * 60 * 60 * 1000);
        
        // Validate: result should be reasonable (not too far in past/future)
        const now = Date.now();
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        if (turkeyTimeMs <= now && turkeyTimeMs >= now - maxAge) {
          return turkeyTimeMs;
        }
      }
      
      // Method 2: Parse as local time and adjust for device timezone
      // This handles cases where device timezone != Turkey timezone
      const localDate = new Date(normalizedDate);
      if (!isNaN(localDate.getTime())) {
        // Get device timezone offset
        const deviceOffsetMs = localDate.getTimezoneOffset() * 60 * 1000;
        // Turkey is GMT+3, so offset is -3 hours = -180 minutes
        const turkeyOffsetMs = -3 * 60 * 60 * 1000;
        // Calculate adjustment needed
        const adjustment = deviceOffsetMs - turkeyOffsetMs;
        const adjustedTime = localDate.getTime() - adjustment;
        
        // Validate
        const now = Date.now();
        const maxAge = 30 * 24 * 60 * 60 * 1000;
        if (adjustedTime <= now && adjustedTime >= now - maxAge) {
          return adjustedTime;
        }
      }
    } else {
      // Has timezone info, parse directly
      const date = new Date(normalizedDate);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    
    logger.warn('Failed to parse AFAD date:', dateString);
    return Date.now();
  } catch (error) {
    logger.warn('Date parse error:', error, dateString);
    return Date.now();
  }
}

/**
 * Get current Turkey time timestamp
 */
export function getTurkeyTimeNow(): number {
  try {
    const now = new Date();
    // Get Turkey timezone offset
    const turkeyTime = new Date(now.toLocaleString('en-US', { timeZone: TURKEY_TIMEZONE }));
    const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offset = turkeyTime.getTime() - utcTime.getTime();
    
    return now.getTime() + offset;
  } catch (error) {
    logger.warn('Turkey time calculation error:', error);
    return Date.now();
  }
}

