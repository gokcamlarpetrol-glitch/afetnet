/**
 * Normalization Service Tests
 */

import { normalizationService } from '../normalization';
import { RawEarthquakeEvent } from '../types/earthquake';

describe('NormalizationService', () => {
  describe('normalizeUSGS', () => {
    it('should normalize USGS GeoJSON format', () => {
      const rawEvent: RawEarthquakeEvent = {
        source: 'USGS',
        data: {
          id: 'test123',
          properties: {
            mag: 4.5,
            time: Date.now(),
            place: 'Test Location',
          },
          geometry: {
            coordinates: [28.5, 39.2, 10000], // [lon, lat, depth_m]
          },
        },
        fetchedAt: Date.now(),
        latencyMs: 100,
      };

      const normalized = normalizationService.normalize([rawEvent]);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].source).toBe('USGS');
      expect(normalized[0].magnitude).toBe(4.5);
      expect(normalized[0].latitude).toBe(39.2);
      expect(normalized[0].longitude).toBe(28.5);
      expect(normalized[0].depthKm).toBe(10); // Converted from meters
    });
  });

  describe('normalizeAmbee', () => {
    it('should normalize Ambee format', () => {
      const rawEvent: RawEarthquakeEvent = {
        source: 'Ambee',
        data: {
          id: 'ambee123',
          time: new Date().toISOString(),
          magnitude: 3.8,
          latitude: 39.5,
          longitude: 28.3,
          depth: 5.2,
          location: 'Test City',
        },
        fetchedAt: Date.now(),
        latencyMs: 150,
      };

      const normalized = normalizationService.normalize([rawEvent]);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].source).toBe('Ambee');
      expect(normalized[0].magnitude).toBe(3.8);
    });
  });
});

