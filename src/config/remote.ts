import AsyncStorage from '@react-native-async-storage/async-storage';
import { logEvent } from '../store/devlog';

export type RemoteCfg = {
  version: number;
  flags: Record<string, boolean>;
  kill?: {
    active: boolean;
    message?: string;
  };
  features?: {
    groups?: boolean;
    training?: boolean;
    blackbox?: boolean;
    ultraBattery?: boolean;
  };
  limits?: {
    maxGroupSize?: number;
    maxMessageLength?: number;
    meshTTL?: number;
  };
  lastUpdated?: number;
};

const DEFAULT_CONFIG: RemoteCfg = {
  version: 1,
  flags: {},
  kill: { active: false },
  features: {
    groups: true,
    training: true,
    blackbox: true,
    ultraBattery: true,
  },
  limits: {
    maxGroupSize: 50,
    maxMessageLength: 240,
    meshTTL: 6,
  },
  lastUpdated: Date.now(),
};

const REMOTE_CONFIG_URL = process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL || 'https://afetnet-config.example.com/config.json';
const CONFIG_CACHE_KEY = 'afn/rcfg/v1';
const CONFIG_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

class RemoteConfigManager {
  private static instance: RemoteConfigManager;
  private config: RemoteCfg = DEFAULT_CONFIG;
  private lastFetchTime: number = 0;
  private isFetching: boolean = false;

  static getInstance(): RemoteConfigManager {
    if (!RemoteConfigManager.instance) {
      RemoteConfigManager.instance = new RemoteConfigManager();
    }
    return RemoteConfigManager.instance;
  }

  async initialize(): Promise<RemoteCfg> {
    try {
      // Load cached config first
      await this.loadCachedConfig();
      
      // Try to fetch fresh config
      await this.fetchRemoteConfig();
      
      return this.config;
    } catch (error) {
      console.error('Remote config initialization error:', error);
      logEvent('REMOTE_CONFIG_INIT_ERROR', { error: String(error) });
      return this.config;
    }
  }

  async getRemoteCfg(): Promise<RemoteCfg> {
    const now = Date.now();
    
    // If we haven't fetched recently, try to fetch
    if (now - this.lastFetchTime > CONFIG_CACHE_DURATION && !this.isFetching) {
      await this.fetchRemoteConfig();
    }
    
    return this.config;
  }

  private async fetchRemoteConfig(): Promise<void> {
    if (this.isFetching) return;
    
    this.isFetching = true;
    
    try {
      const response = await fetch(REMOTE_CONFIG_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0',
        },
        timeout: 10000, // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const remoteConfig: RemoteCfg = await response.json();
      
      // Validate config structure
      if (this.validateConfig(remoteConfig)) {
        this.config = {
          ...DEFAULT_CONFIG,
          ...remoteConfig,
          lastUpdated: Date.now(),
        };
        
        // Cache the config
        await this.cacheConfig();
        
        this.lastFetchTime = Date.now();
        logEvent('REMOTE_CONFIG_UPDATED', { 
          version: remoteConfig.version,
          killActive: remoteConfig.kill?.active || false,
          flagsCount: Object.keys(remoteConfig.flags || {}).length,
        });
      } else {
        throw new Error('Invalid remote config structure');
      }
    } catch (error) {
      console.error('Remote config fetch error:', error);
      logEvent('REMOTE_CONFIG_FETCH_ERROR', { error: String(error) });
      
      // Fall back to cached config or default
      await this.loadCachedConfig();
    } finally {
      this.isFetching = false;
    }
  }

  private validateConfig(config: any): boolean {
    try {
      // Basic structure validation
      if (typeof config !== 'object' || config === null) return false;
      if (typeof config.version !== 'number') return false;
      if (typeof config.flags !== 'object' || config.flags === null) return false;
      
      // Validate flags are boolean
      for (const [key, value] of Object.entries(config.flags)) {
        if (typeof value !== 'boolean') return false;
      }
      
      // Validate kill switch if present
      if (config.kill !== undefined) {
        if (typeof config.kill !== 'object' || config.kill === null) return false;
        if (typeof config.kill.active !== 'boolean') return false;
        if (config.kill.message !== undefined && typeof config.kill.message !== 'string') return false;
      }
      
      return true;
    } catch (error) {
      console.error('Config validation error:', error);
      return false;
    }
  }

  private async cacheConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Error caching remote config:', error);
    }
  }

  private async loadCachedConfig(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
      if (cached) {
        const parsedConfig: RemoteCfg = JSON.parse(cached);
        if (this.validateConfig(parsedConfig)) {
          this.config = parsedConfig;
          logEvent('REMOTE_CONFIG_LOADED_CACHE', { version: parsedConfig.version });
        }
      }
    } catch (error) {
      console.error('Error loading cached config:', error);
    }
  }

  getConfig(): RemoteCfg {
    return this.config;
  }

  isKillSwitchActive(): boolean {
    return this.config.kill?.active === true;
  }

  getKillSwitchMessage(): string {
    return this.config.kill?.message || 'Uygulama geçici olarak kullanıma kapatılmıştır.';
  }

  isFeatureEnabled(feature: keyof NonNullable<RemoteCfg['features']>): boolean {
    return this.config.features?.[feature] === true;
  }

  getLimit(key: keyof NonNullable<RemoteCfg['limits']>): number | undefined {
    return this.config.limits?.[key];
  }

  async refreshConfig(): Promise<void> {
    this.lastFetchTime = 0; // Force refresh
    await this.fetchRemoteConfig();
  }

  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CONFIG_CACHE_KEY);
      this.config = DEFAULT_CONFIG;
      logEvent('REMOTE_CONFIG_CACHE_CLEARED');
    } catch (error) {
      console.error('Error clearing config cache:', error);
    }
  }
}

export const remoteConfigManager = RemoteConfigManager.getInstance();

// Hook for React components
export function useRemoteFlag(key: string): boolean {
  const config = remoteConfigManager.getConfig();
  return config.flags[key] === true;
}

export function useRemoteFeature(feature: keyof NonNullable<RemoteCfg['features']>): boolean {
  return remoteConfigManager.isFeatureEnabled(feature);
}

export function useRemoteLimit(key: keyof NonNullable<RemoteCfg['limits']>): number | undefined {
  return remoteConfigManager.getLimit(key);
}

// Initialize on app start
export async function initializeRemoteConfig(): Promise<RemoteCfg> {
  return await remoteConfigManager.initialize();
}
