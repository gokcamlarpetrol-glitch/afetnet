import { OfficialFeedManager } from '../feeds';
import { Preferences } from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  Preferences: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

// Mock EventEmitter
const mockEventEmitter = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock('events', () => ({
  EventEmitter: jest.fn(() => mockEventEmitter),
}));

describe('OfficialFeedManager', () => {
  let manager: OfficialFeedManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new OfficialFeedManager();
  });

  describe('feed adapter management', () => {
    it('should register a new feed adapter', () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      manager.registerFeedAdapter(adapter);

      const adapters = manager.getFeedAdapters();
      expect(adapters).toHaveLength(1);
      expect(adapters[0]).toEqual(adapter);
    });

    it('should remove a feed adapter', () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      manager.registerFeedAdapter(adapter);
      expect(manager.getFeedAdapters()).toHaveLength(1);

      manager.removeFeedAdapter('test-feed');
      expect(manager.getFeedAdapters()).toHaveLength(0);
    });

    it('should update an existing feed adapter', () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      manager.registerFeedAdapter(adapter);

      const updatedAdapter = {
        ...adapter,
        name: 'Updated Test Feed',
        enabled: false,
      };

      manager.registerFeedAdapter(updatedAdapter);

      const adapters = manager.getFeedAdapters();
      expect(adapters).toHaveLength(1);
      expect(adapters[0]).toEqual(updatedAdapter);
    });
  });

  describe('feed parsing', () => {
    it('should parse JSON feed data correctly', async () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      const feedData = {
        data: {
          magnitude: 5.5,
          latitude: 40.7128,
          longitude: -74.0060,
          depth: 10.5,
          timestamp: '2023-01-01T12:00:00Z',
        },
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(feedData),
      });

      const result = await manager.testParse(adapter.url, adapter.pathMapping);

      expect(result).toEqual({
        magnitude: 5.5,
        latitude: 40.7128,
        longitude: -74.0060,
        depth: 10.5,
        timestamp: '2023-01-01T12:00:00Z',
      });
    });

    it('should handle nested JSON paths', async () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'earthquake.magnitude',
          latitude: 'earthquake.location.latitude',
          longitude: 'earthquake.location.longitude',
          depth: 'earthquake.location.depth',
          timestamp: 'earthquake.time',
        },
      };

      const feedData = {
        earthquake: {
          magnitude: 6.0,
          location: {
            latitude: 41.0082,
            longitude: 28.9784,
            depth: 15.0,
          },
          time: '2023-01-01T12:00:00Z',
        },
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(feedData),
      });

      const result = await manager.testParse(adapter.url, adapter.pathMapping);

      expect(result).toEqual({
        magnitude: 6.0,
        latitude: 41.0082,
        longitude: 28.9784,
        depth: 15.0,
        timestamp: '2023-01-01T12:00:00Z',
      });
    });

    it('should handle missing fields gracefully', async () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      const feedData = {
        data: {
          magnitude: 5.5,
          // Missing latitude, longitude, depth, timestamp
        },
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(feedData),
      });

      const result = await manager.testParse(adapter.url, adapter.pathMapping);

      expect(result).toEqual({
        magnitude: 5.5,
        latitude: undefined,
        longitude: undefined,
        depth: undefined,
        timestamp: undefined,
      });
    });

    it('should handle network errors during parsing', async () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        manager.testParse(adapter.url, adapter.pathMapping)
      ).rejects.toThrow('Network error');
    });

    it('should handle HTTP errors during parsing', async () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        manager.testParse(adapter.url, adapter.pathMapping)
      ).rejects.toThrow('HTTP 404: Not Found');
    });
  });

  describe('ETA calculation', () => {
    it('should calculate ETA correctly for nearby earthquake', () => {
      const deviceLocation = { latitude: 40.7128, longitude: -74.0060 };
      const epicenter = { latitude: 40.8000, longitude: -74.1000 };
      const depth = 10;

      const eta = manager.calculateETA(deviceLocation, epicenter, depth);

      // Should be approximately 3-5 seconds for nearby earthquake
      expect(eta).toBeGreaterThan(0);
      expect(eta).toBeLessThan(10);
    });

    it('should calculate ETA correctly for distant earthquake', () => {
      const deviceLocation = { latitude: 40.7128, longitude: -74.0060 };
      const epicenter = { latitude: 41.0082, longitude: 28.9784 }; // Istanbul
      const depth = 15;

      const eta = manager.calculateETA(deviceLocation, epicenter, depth);

      // Should be much longer for distant earthquake
      expect(eta).toBeGreaterThan(100);
    });

    it('should handle zero depth', () => {
      const deviceLocation = { latitude: 40.7128, longitude: -74.0060 };
      const epicenter = { latitude: 40.8000, longitude: -74.1000 };
      const depth = 0;

      const eta = manager.calculateETA(deviceLocation, epicenter, depth);

      expect(eta).toBeGreaterThan(0);
    });
  });

  describe('feed polling', () => {
    it('should poll all enabled feeds', async () => {
      const adapter1 = {
        id: 'feed1',
        name: 'Feed 1',
        url: 'https://test1.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      const adapter2 = {
        id: 'feed2',
        name: 'Feed 2',
        url: 'https://test2.example.com/feed.json',
        enabled: false,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      manager.registerFeedAdapter(adapter1);
      manager.registerFeedAdapter(adapter2);

      const feedData = {
        data: {
          magnitude: 5.5,
          latitude: 40.7128,
          longitude: -74.0060,
          depth: 10.5,
          timestamp: new Date().toISOString(),
        },
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(feedData),
      });

      // Mock device location
      const mockGetCurrentPosition = jest.fn().mockResolvedValue({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
      });

      // Mock navigator.geolocation
      Object.defineProperty(global, 'navigator', {
        value: {
          geolocation: {
            getCurrentPosition: mockGetCurrentPosition,
          },
        },
        writable: true,
      });

      await manager.pollAllFeeds();

      // Should only poll enabled feed
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('https://test1.example.com/feed.json');
    });

    it('should emit official alert when ETA is within cutoff', async () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      manager.registerFeedAdapter(adapter);

      // Very close earthquake
      const feedData = {
        data: {
          magnitude: 5.5,
          latitude: 40.7130, // Very close to device location
          longitude: -74.0062,
          depth: 10.5,
          timestamp: new Date().toISOString(),
        },
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(feedData),
      });

      // Mock device location very close to epicenter
      const mockGetCurrentPosition = jest.fn().mockResolvedValue({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          geolocation: {
            getCurrentPosition: mockGetCurrentPosition,
          },
        },
        writable: true,
      });

      await manager.pollAllFeeds();

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'eew:official_alert',
        expect.objectContaining({
          magnitude: 5.5,
          latitude: 40.7130,
          longitude: -74.0062,
          depth: 10.5,
        })
      );
    });

    it('should not emit alert when ETA is beyond cutoff', async () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      manager.registerFeedAdapter(adapter);

      // Very distant earthquake
      const feedData = {
        data: {
          magnitude: 5.5,
          latitude: 41.0082, // Istanbul - very far from device location
          longitude: 28.9784,
          depth: 10.5,
          timestamp: new Date().toISOString(),
        },
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(feedData),
      });

      // Mock device location in New York
      const mockGetCurrentPosition = jest.fn().mockResolvedValue({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          geolocation: {
            getCurrentPosition: mockGetCurrentPosition,
          },
        },
        writable: true,
      });

      await manager.pollAllFeeds();

      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
        'eew:official_alert',
        expect.any(Object)
      );
    });
  });

  describe('adapter persistence', () => {
    it('should save adapters to storage', async () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      manager.registerFeedAdapter(adapter);
      await manager.saveAdapters();

      expect(Preferences.setItem).toHaveBeenCalledWith(
        'eew_feed_adapters',
        JSON.stringify([adapter])
      );
    });

    it('should load adapters from storage', async () => {
      const adapter = {
        id: 'test-feed',
        name: 'Test Feed',
        url: 'https://test.example.com/feed.json',
        enabled: true,
        pathMapping: {
          magnitude: 'data.magnitude',
          latitude: 'data.latitude',
          longitude: 'data.longitude',
          depth: 'data.depth',
          timestamp: 'data.timestamp',
        },
      };

      (Preferences.getItem as jest.Mock).mockResolvedValue(JSON.stringify([adapter]));

      await manager.loadAdapters();

      const adapters = manager.getFeedAdapters();
      expect(adapters).toHaveLength(1);
      expect(adapters[0]).toEqual(adapter);
    });

    it('should handle empty storage gracefully', async () => {
      (Preferences.getItem as jest.Mock).mockResolvedValue(null);

      await manager.loadAdapters();

      const adapters = manager.getFeedAdapters();
      expect(adapters).toHaveLength(0);
    });

    it('should handle invalid JSON in storage', async () => {
      (Preferences.getItem as jest.Mock).mockResolvedValue('invalid json');

      await manager.loadAdapters();

      const adapters = manager.getFeedAdapters();
      expect(adapters).toHaveLength(0);
    });
  });
});
