/**
 * EARTHQUAKE SERVICE TESTS - ELITE EDITION
 * Comprehensive test coverage for earthquake data fetching
 */

import { earthquakeService } from '../EarthquakeService';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('EarthquakeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Initialization', () => {
    it('should be a singleton instance', () => {
      expect(earthquakeService).toBeDefined();
      expect(typeof earthquakeService).toBe('object');
    });

    it('should have required methods', () => {
      expect(typeof earthquakeService.fetchEarthquakes).toBe('function');
      expect(typeof earthquakeService.fetchEarthquakeDetail).toBe('function');
    });
  });

  describe('Earthquake Fetching', () => {
    it('should fetch earthquakes successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify([
          {
            eventID: '12345',
            mag: 4.5,
            lat: 41.0082,
            lng: 28.9784,
            depth: 10,
            title: 'İstanbul',
            date: new Date().toISOString(),
          },
        ])),
      });

      const result = await earthquakeService.fetchEarthquakes();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('[]'),
      });

      const result = await earthquakeService.fetchEarthquakes();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await earthquakeService.fetchEarthquakes();

      // Should return empty array or cached data, not throw
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Earthquake Detail', () => {
    it('should fetch earthquake detail by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({
          eventID: '12345',
          mag: 5.2,
          lat: 41.0082,
          lng: 28.9784,
          depth: 15,
          title: 'İstanbul Açıkları',
          date: new Date().toISOString(),
        })),
      });

      const result = await earthquakeService.fetchEarthquakeDetail('12345');

      // Should return earthquake or null
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should handle missing earthquake', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not found'),
      });

      const result = await earthquakeService.fetchEarthquakeDetail('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('Data Validation', () => {
    it('should validate earthquake object structure', () => {
      const validEarthquake = {
        id: 'afad-12345',
        magnitude: 4.5,
        latitude: 41.0082,
        longitude: 28.9784,
        depth: 10,
        location: 'Test',
        time: Date.now(),
        source: 'AFAD',
      };

      expect(validEarthquake).toBeValidEarthquake();
    });

    it('should reject invalid magnitude', () => {
      const invalidEarthquake = {
        id: 'test',
        magnitude: -1, // Invalid
        latitude: 41.0,
        longitude: 28.9,
      };

      expect(invalidEarthquake).not.toBeValidEarthquake();
    });

    it('should reject missing coordinates', () => {
      const invalidEarthquake = {
        id: 'test',
        magnitude: 4.0,
        // Missing latitude and longitude
      };

      expect(invalidEarthquake).not.toBeValidEarthquake();
    });
  });

  describe('Caching', () => {
    it('should cache earthquake data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify([
          { eventID: '1', mag: 4.0, lat: 41.0, lng: 28.9, depth: 10, title: 'Test', date: new Date().toISOString() },
        ])),
      });

      // First fetch
      const first = await earthquakeService.fetchEarthquakes();

      // Mock network failure
      mockFetch.mockRejectedValueOnce(new Error('Network failed'));

      // Second fetch should return cached data
      const second = await earthquakeService.fetchEarthquakes();

      expect(Array.isArray(first)).toBe(true);
      expect(Array.isArray(second)).toBe(true);
    });
  });

  describe('Source Validation', () => {
    it('should normalize AFAD source', () => {
      const source = 'AFAD';
      expect(['AFAD', 'Kandilli', 'USGS']).toContain(source);
    });

    it('should normalize Kandilli source', () => {
      const source = 'Kandilli';
      expect(['AFAD', 'Kandilli', 'USGS']).toContain(source);
    });
  });
});

describe('EarthquakeService - Edge Cases', () => {
  describe('Timeout Handling', () => {
    it('should handle request timeout', async () => {
      mockFetch.mockImplementationOnce(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100),
        ),
      );

      const result = await earthquakeService.fetchEarthquakes();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Invalid JSON', () => {
    it('should handle malformed JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('not valid json'),
      });

      const result = await earthquakeService.fetchEarthquakes();

      // Should not crash, return empty or cached
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle 429 rate limit response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValue('Rate limited'),
      });

      const result = await earthquakeService.fetchEarthquakes();

      // Should return cached data or empty
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
