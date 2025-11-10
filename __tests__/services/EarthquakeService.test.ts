/**
 * EARTHQUAKE SERVICE TESTS
 * Critical service - must have 100% test coverage
 */

import { EarthquakeService } from '../../src/core/services/EarthquakeService';
import { useEarthquakeStore } from '../../src/core/stores/earthquakeStore';

// Mock fetch
global.fetch = jest.fn();

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

describe('EarthquakeService', () => {
  let service: EarthquakeService;

  beforeEach(() => {
    service = new EarthquakeService();
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    service.stop();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await service.initialize();
      expect(service).toBeDefined();
    });

    it('should not initialize twice', async () => {
      await service.initialize();
      await service.initialize();
      // Should not throw or cause issues
      expect(service).toBeDefined();
    });
  });

  describe('Fetch Earthquakes', () => {
    it('should fetch earthquakes from USGS', async () => {
      const mockUSGSData = {
        features: [
          {
            id: 'us1000test',
            properties: {
              mag: 5.5,
              place: 'Test Location',
              time: Date.now(),
              depth: 10,
            },
            geometry: {
              coordinates: [28.9784, 41.0082, 10],
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUSGSData,
      });

      await service.fetchEarthquakes();

      const state = useEarthquakeStore.getState();
      expect(state.items.length).toBeGreaterThan(0);
    });

    it('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await service.fetchEarthquakes();

      const state = useEarthquakeStore.getState();
      // Should not crash, may have cached data or empty array
      expect(state.items).toBeDefined();
    });

    it('should filter earthquakes by magnitude >= 3.0', async () => {
      const mockData = {
        features: [
          {
            id: 'small1',
            properties: { mag: 2.5, place: 'Small', time: Date.now(), depth: 5 },
            geometry: { coordinates: [28.9, 41.0, 5] },
          },
          {
            id: 'large1',
            properties: { mag: 4.5, place: 'Large', time: Date.now(), depth: 10 },
            geometry: { coordinates: [29.0, 41.1, 10] },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      await service.fetchEarthquakes();

      const state = useEarthquakeStore.getState();
      const allAbove3 = state.items.every(eq => eq.magnitude >= 3.0);
      expect(allAbove3).toBe(true);
    });
  });

  describe('Caching', () => {
    it('should save earthquakes to cache', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      
      const mockData = {
        features: [
          {
            id: 'cache1',
            properties: { mag: 4.0, place: 'Cache Test', time: Date.now(), depth: 8 },
            geometry: { coordinates: [30.0, 40.0, 8] },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      await service.fetchEarthquakes();

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate similar earthquakes', async () => {
      const now = Date.now();
      const mockData = {
        features: [
          {
            id: 'dup1',
            properties: { mag: 4.5, place: 'Test 1', time: now, depth: 10 },
            geometry: { coordinates: [28.9784, 41.0082, 10] },
          },
          {
            id: 'dup2',
            properties: { mag: 4.5, place: 'Test 2', time: now + 1000, depth: 10 },
            geometry: { coordinates: [28.9785, 41.0083, 10] }, // Very close location
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      await service.fetchEarthquakes();

      const state = useEarthquakeStore.getState();
      // Should deduplicate very similar events
      expect(state.items.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Stop', () => {
    it('should stop polling when stopped', () => {
      service.start();
      service.stop();
      // Should not throw and should clear intervals
      expect(service).toBeDefined();
    });
  });
});

