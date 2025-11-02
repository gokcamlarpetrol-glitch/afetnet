/**
 * LOCATION UTILS TESTS
 * Critical for distance calculations
 */

import {
  calculateDistance,
  filterByDistance,
  sortByDistance,
  getLocationName,
  ISTANBUL_CENTER,
} from '../../src/core/utils/locationUtils';

describe('Location Utils', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between Istanbul and Ankara', () => {
      const istanbulLat = 41.0082;
      const istanbulLon = 28.9784;
      const ankaraLat = 39.9334;
      const ankaraLon = 32.8597;

      const distance = calculateDistance(istanbulLat, istanbulLon, ankaraLat, ankaraLon);
      
      // Distance should be approximately 350-400 km
      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(450);
    });

    it('should return 0 for same location', () => {
      const lat = 41.0082;
      const lon = 28.9784;

      const distance = calculateDistance(lat, lon, lat, lon);
      expect(distance).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const distance = calculateDistance(-34.0, -64.0, -35.0, -65.0);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('filterByDistance', () => {
    it('should filter items within radius', () => {
      const items = [
        { latitude: 41.01, longitude: 28.98, name: 'Near' },
        { latitude: 42.0, longitude: 30.0, name: 'Far' },
      ];

      const filtered = filterByDistance(items, 41.0082, 28.9784, 10);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Near');
    });

    it('should return empty array when no items in radius', () => {
      const items = [
        { latitude: 50.0, longitude: 50.0, name: 'Very Far' },
      ];

      const filtered = filterByDistance(items, 41.0, 28.0, 10);
      expect(filtered.length).toBe(0);
    });
  });

  describe('sortByDistance', () => {
    it('should sort items by distance ascending', () => {
      const items = [
        { latitude: 42.0, longitude: 30.0, name: 'Far' },
        { latitude: 41.01, longitude: 28.98, name: 'Near' },
        { latitude: 41.5, longitude: 29.5, name: 'Mid' },
      ];

      const sorted = sortByDistance(items, 41.0082, 28.9784);
      
      expect(sorted[0].name).toBe('Near');
      expect(sorted[2].name).toBe('Far');
    });

    it('should not mutate original array', () => {
      const items = [
        { latitude: 42.0, longitude: 30.0, name: 'A' },
        { latitude: 41.0, longitude: 28.0, name: 'B' },
      ];

      const original = [...items];
      sortByDistance(items, 41.0, 28.0);
      
      expect(items).toEqual(original);
    });
  });

  describe('getLocationName', () => {
    it('should return İstanbul for Istanbul coordinates', () => {
      const name = getLocationName(41.0082, 28.9784);
      expect(name).toBe('İstanbul');
    });

    it('should return Ankara for Ankara coordinates', () => {
      const name = getLocationName(39.9334, 32.8597);
      expect(name).toBe('Ankara');
    });

    it('should return İzmir for İzmir coordinates', () => {
      const name = getLocationName(38.4237, 27.1428);
      expect(name).toBe('İzmir');
    });

    it('should return Türkiye for unknown location', () => {
      const name = getLocationName(50.0, 50.0);
      expect(name).toBe('Türkiye');
    });

    it('should handle coordinates near city boundaries', () => {
      // Just outside Istanbul radius
      const name = getLocationName(42.5, 29.0);
      expect(name).toBe('Türkiye');
    });
  });

  describe('ISTANBUL_CENTER', () => {
    it('should have correct Istanbul coordinates', () => {
      expect(ISTANBUL_CENTER.latitude).toBeCloseTo(41.0082, 2);
      expect(ISTANBUL_CENTER.longitude).toBeCloseTo(28.9784, 2);
    });
  });
});

