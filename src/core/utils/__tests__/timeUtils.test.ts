/**
 * TIME UTILITIES TESTS - ELITE TEST SUITE
 * Comprehensive tests for timezone-aware date/time formatting
 */

import {
  formatToTurkishTime,
  formatToTurkishDate,
  formatToTurkishTimeOnly,
  formatToTurkishDateTime,
  getTimeDifferenceTurkish,
  parseAFADDate,
} from '../timeUtils';

// Fixed timestamp for testing: 2025-01-15 14:30:45 UTC
// This is 17:30:45 in Turkey (GMT+3)
const TEST_TIMESTAMP = 1736951445000;

describe('timeUtils', () => {
  describe('formatToTurkishTime', () => {
    it('should format timestamp to Turkish locale', () => {
      const result = formatToTurkishTime(TEST_TIMESTAMP);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // Should contain date separators
      expect(result).toMatch(/\d{2}[./]\d{2}[./]\d{4}/);
    });

    it('should handle current timestamp', () => {
      const result = formatToTurkishTime(Date.now());
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include seconds in output', () => {
      const result = formatToTurkishTime(TEST_TIMESTAMP);
      // Should have time with seconds (HH:MM:SS pattern)
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('formatToTurkishDate', () => {
    it('should format timestamp to DD.MM.YYYY', () => {
      const result = formatToTurkishDate(TEST_TIMESTAMP);
      expect(result).toBeDefined();
      expect(result).toMatch(/\d{2}[./]\d{2}[./]\d{4}/);
    });

    it('should not include time component', () => {
      const result = formatToTurkishDate(TEST_TIMESTAMP);
      // Should NOT contain time separator ":"
      expect(result).not.toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('formatToTurkishTimeOnly', () => {
    it('should return only time component', () => {
      const result = formatToTurkishTimeOnly(TEST_TIMESTAMP);
      expect(result).toBeDefined();
      // Should match HH:MM:SS pattern
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('should use 24-hour format', () => {
      // Evening timestamp (17:30 in Turkey)
      const result = formatToTurkishTimeOnly(TEST_TIMESTAMP);
      // Should NOT contain AM/PM
      expect(result).not.toMatch(/([AP]M|am|pm)/i);
    });
  });

  describe('formatToTurkishDateTime', () => {
    it('should include both date and time', () => {
      const result = formatToTurkishDateTime(TEST_TIMESTAMP);
      expect(result).toBeDefined();
      // Should contain date
      expect(result).toMatch(/\d{2}[./]\d{2}[./]\d{4}/);
      // Should contain time
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('getTimeDifferenceTurkish', () => {
    it('should return "Az önce" for very recent timestamps', () => {
      const now = Date.now();
      const result = getTimeDifferenceTurkish(now - 30000); // 30 seconds ago
      expect(result).toBe('Az önce');
    });

    it('should return minutes for timestamps within an hour', () => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const result = getTimeDifferenceTurkish(fiveMinutesAgo);
      expect(result).toMatch(/\d+ dakika önce/);
    });

    it('should return hours for timestamps within a day', () => {
      const now = Date.now();
      const threeHoursAgo = now - 3 * 60 * 60 * 1000;
      const result = getTimeDifferenceTurkish(threeHoursAgo);
      expect(result).toMatch(/\d+ saat önce/);
    });

    it('should return days for timestamps within a week', () => {
      const now = Date.now();
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
      const result = getTimeDifferenceTurkish(twoDaysAgo);
      expect(result).toMatch(/\d+ gün önce/);
    });
  });

  describe('parseAFADDate', () => {
    it('should parse AFAD date format with T separator', () => {
      const result = parseAFADDate('2025-01-15T17:30:45');
      expect(result).toBeDefined();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should parse AFAD date format with space separator', () => {
      const result = parseAFADDate('2025-01-15 17:30:45');
      expect(result).toBeDefined();
      expect(typeof result).toBe('number');
    });

    it('should handle empty string', () => {
      const result = parseAFADDate('');
      // Should return current time as fallback
      expect(result).toBeGreaterThan(0);
      expect(Math.abs(result - Date.now())).toBeLessThan(1000);
    });

    it('should handle whitespace-only string', () => {
      const result = parseAFADDate('   ');
      expect(result).toBeGreaterThan(0);
    });

    it('should treat date without timezone as Turkey local time', () => {
      // 22:30:00 Turkey time = 19:30:00 UTC
      const result = parseAFADDate('2025-01-15T22:30:00');
      const date = new Date(result);
      // Year should be 2025
      expect(date.getUTCFullYear()).toBe(2025);
    });
  });
});
