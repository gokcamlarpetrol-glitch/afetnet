import { RemoteConfigManager } from '../manager';
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

describe('RemoteConfigManager', () => {
  let manager: RemoteConfigManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new RemoteConfigManager();
  });

  describe('merge strategy', () => {
    it('should prioritize prefs over remote config', async () => {
      const prefs = {
        tiles: {
          updateUrl: 'https://prefs.example.com/tiles',
          updateInterval: 3600,
        },
      };

      const remoteConfig = {
        tiles: {
          updateUrl: 'https://remote.example.com/tiles',
          updateInterval: 7200,
        },
        push: {
          enabled: true,
          topics: ['emergency', 'general'],
        },
      };

      const defaults = {
        tiles: {
          updateUrl: 'https://default.example.com/tiles',
          updateInterval: 86400,
        },
        push: {
          enabled: false,
          topics: [],
        },
      };

      (Preferences.getItem as jest.Mock).mockResolvedValue(JSON.stringify(prefs));
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(remoteConfig),
      });

      const result = await manager.mergeConfig(defaults);

      expect(result.tiles.updateUrl).toBe(prefs.tiles.updateUrl);
      expect(result.tiles.updateInterval).toBe(prefs.tiles.updateInterval);
      expect(result.push.enabled).toBe(remoteConfig.push.enabled);
      expect(result.push.topics).toEqual(remoteConfig.push.topics);
    });

    it('should use remote config when prefs are empty', async () => {
      const remoteConfig = {
        tiles: {
          updateUrl: 'https://remote.example.com/tiles',
          updateInterval: 7200,
        },
        push: {
          enabled: true,
          topics: ['emergency'],
        },
      };

      const defaults = {
        tiles: {
          updateUrl: 'https://default.example.com/tiles',
          updateInterval: 86400,
        },
        push: {
          enabled: false,
          topics: [],
        },
      };

      (Preferences.getItem as jest.Mock).mockResolvedValue(null);
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(remoteConfig),
      });

      const result = await manager.mergeConfig(defaults);

      expect(result.tiles.updateUrl).toBe(remoteConfig.tiles.updateUrl);
      expect(result.tiles.updateInterval).toBe(remoteConfig.tiles.updateInterval);
      expect(result.push.enabled).toBe(remoteConfig.push.enabled);
      expect(result.push.topics).toEqual(remoteConfig.push.topics);
    });

    it('should use defaults when remote config fails', async () => {
      const defaults = {
        tiles: {
          updateUrl: 'https://default.example.com/tiles',
          updateInterval: 86400,
        },
        push: {
          enabled: false,
          topics: [],
        },
      };

      (Preferences.getItem as jest.Mock).mockResolvedValue(null);
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await manager.mergeConfig(defaults);

      expect(result.tiles.updateUrl).toBe(defaults.tiles.updateUrl);
      expect(result.tiles.updateInterval).toBe(defaults.tiles.updateInterval);
      expect(result.push.enabled).toBe(defaults.push.enabled);
      expect(result.push.topics).toEqual(defaults.push.topics);
    });

    it('should handle partial prefs override', async () => {
      const prefs = {
        tiles: {
          updateUrl: 'https://prefs.example.com/tiles',
        },
      };

      const remoteConfig = {
        tiles: {
          updateUrl: 'https://remote.example.com/tiles',
          updateInterval: 7200,
        },
        push: {
          enabled: true,
          topics: ['emergency'],
        },
      };

      const defaults = {
        tiles: {
          updateUrl: 'https://default.example.com/tiles',
          updateInterval: 86400,
        },
        push: {
          enabled: false,
          topics: [],
        },
      };

      (Preferences.getItem as jest.Mock).mockResolvedValue(JSON.stringify(prefs));
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(remoteConfig),
      });

      const result = await manager.mergeConfig(defaults);

      expect(result.tiles.updateUrl).toBe(prefs.tiles.updateUrl);
      expect(result.tiles.updateInterval).toBe(remoteConfig.tiles.updateInterval);
      expect(result.push.enabled).toBe(remoteConfig.push.enabled);
      expect(result.push.topics).toEqual(remoteConfig.push.topics);
    });

    it('should handle invalid prefs JSON', async () => {
      const remoteConfig = {
        tiles: {
          updateUrl: 'https://remote.example.com/tiles',
          updateInterval: 7200,
        },
        push: {
          enabled: true,
          topics: ['emergency'],
        },
      };

      const defaults = {
        tiles: {
          updateUrl: 'https://default.example.com/tiles',
          updateInterval: 86400,
        },
        push: {
          enabled: false,
          topics: [],
        },
      };

      (Preferences.getItem as jest.Mock).mockResolvedValue('invalid json');
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(remoteConfig),
      });

      const result = await manager.mergeConfig(defaults);

      expect(result.tiles.updateUrl).toBe(remoteConfig.tiles.updateUrl);
      expect(result.tiles.updateInterval).toBe(remoteConfig.tiles.updateInterval);
      expect(result.push.enabled).toBe(remoteConfig.push.enabled);
      expect(result.push.topics).toEqual(remoteConfig.push.topics);
    });

    it('should handle empty remote config response', async () => {
      const defaults = {
        tiles: {
          updateUrl: 'https://default.example.com/tiles',
          updateInterval: 86400,
        },
        push: {
          enabled: false,
          topics: [],
        },
      };

      (Preferences.getItem as jest.Mock).mockResolvedValue(null);
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await manager.mergeConfig(defaults);

      expect(result.tiles.updateUrl).toBe(defaults.tiles.updateUrl);
      expect(result.tiles.updateInterval).toBe(defaults.tiles.updateInterval);
      expect(result.push.enabled).toBe(defaults.push.enabled);
      expect(result.push.topics).toEqual(defaults.push.topics);
    });

    it('should handle nested object merging', async () => {
      const prefs = {
        eew: {
          enabled: true,
          k: 3,
          radiusKm: 5,
          windowSec: 30,
        },
      };

      const remoteConfig = {
        eew: {
          enabled: false,
          k: 5,
          radiusKm: 10,
          windowSec: 60,
          pThreshold: 0.5,
          staMs: 1000,
          ltaMs: 10000,
        },
        tiles: {
          updateUrl: 'https://remote.example.com/tiles',
          updateInterval: 7200,
        },
      };

      const defaults = {
        eew: {
          enabled: false,
          k: 1,
          radiusKm: 1,
          windowSec: 10,
          pThreshold: 0.3,
          staMs: 500,
          ltaMs: 5000,
        },
        tiles: {
          updateUrl: 'https://default.example.com/tiles',
          updateInterval: 86400,
        },
      };

      (Preferences.getItem as jest.Mock).mockResolvedValue(JSON.stringify(prefs));
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(remoteConfig),
      });

      const result = await manager.mergeConfig(defaults);

      expect(result.eew.enabled).toBe(prefs.eew.enabled);
      expect(result.eew.k).toBe(prefs.eew.k);
      expect(result.eew.radiusKm).toBe(prefs.eew.radiusKm);
      expect(result.eew.windowSec).toBe(prefs.eew.windowSec);
      expect(result.eew.pThreshold).toBe(remoteConfig.eew.pThreshold);
      expect(result.eew.staMs).toBe(remoteConfig.eew.staMs);
      expect(result.eew.ltaMs).toBe(remoteConfig.eew.ltaMs);
      expect(result.tiles.updateUrl).toBe(remoteConfig.tiles.updateUrl);
      expect(result.tiles.updateInterval).toBe(remoteConfig.tiles.updateInterval);
    });
  });

  describe('config persistence', () => {
    it('should save prefs when updatePrefs is called', async () => {
      const prefs = {
        tiles: {
          updateUrl: 'https://prefs.example.com/tiles',
          updateInterval: 3600,
        },
      };

      await manager.updatePrefs(prefs);

      expect(Preferences.setItem).toHaveBeenCalledWith(
        'remote_config_prefs',
        JSON.stringify(prefs)
      );
    });

    it('should load prefs when getPrefs is called', async () => {
      const prefs = {
        tiles: {
          updateUrl: 'https://prefs.example.com/tiles',
          updateInterval: 3600,
        },
      };

      (Preferences.getItem as jest.Mock).mockResolvedValue(JSON.stringify(prefs));

      const result = await manager.getPrefs();

      expect(result).toEqual(prefs);
    });

    it('should return empty object when no prefs are saved', async () => {
      (Preferences.getItem as jest.Mock).mockResolvedValue(null);

      const result = await manager.getPrefs();

      expect(result).toEqual({});
    });
  });

  describe('remote config fetching', () => {
    it('should fetch remote config successfully', async () => {
      const remoteConfig = {
        tiles: {
          updateUrl: 'https://remote.example.com/tiles',
          updateInterval: 7200,
        },
        push: {
          enabled: true,
          topics: ['emergency'],
        },
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(remoteConfig),
      });

      const result = await manager.fetchRemoteConfig('https://config.example.com/config.json');

      expect(result).toEqual(remoteConfig);
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        manager.fetchRemoteConfig('https://config.example.com/config.json')
      ).rejects.toThrow('Network error');
    });

    it('should handle HTTP errors', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        manager.fetchRemoteConfig('https://config.example.com/config.json')
      ).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should handle invalid JSON response', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(
        manager.fetchRemoteConfig('https://config.example.com/config.json')
      ).rejects.toThrow('Invalid JSON');
    });
  });
});
