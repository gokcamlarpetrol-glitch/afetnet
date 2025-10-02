import { RemoteConfig, EEWConfig, PushConfig, BackendConfig, TilesConfig, DEFAULT_EEW_CONFIG, DEFAULT_PUSH_CONFIG, DEFAULT_BACKEND_CONFIG } from './schema';
import { RemoteConfigFetcher } from './fetch';
import { PreferencesManager } from '../storage/prefs';

export class RemoteConfigManager {
  private static instance: RemoteConfigManager;
  private fetcher = RemoteConfigFetcher.getInstance();
  private prefs = PreferencesManager.getInstance();

  static getInstance(): RemoteConfigManager {
    if (!RemoteConfigManager.instance) {
      RemoteConfigManager.instance = new RemoteConfigManager();
    }
    return RemoteConfigManager.instance;
  }

  async getEffectiveConfig(): Promise<RemoteConfig> {
    try {
      // Merge strategy: prefs (Wizard overrides) > remote config > defaults
      const defaults = this.getDefaultConfig();
      const remoteConfig = await this.getRemoteConfig();
      const wizardOverrides = await this.getWizardOverrides();

      // Merge configurations with proper precedence
      const effective = this.mergeConfigs(defaults, remoteConfig, wizardOverrides);
      
      console.log('Effective config computed:', effective);
      return effective;
    } catch (error) {
      console.error('Failed to get effective config:', error);
      return this.getDefaultConfig();
    }
  }

  async getEEWConfig(): Promise<EEWConfig> {
    const effective = await this.getEffectiveConfig();
    return effective.eew || DEFAULT_EEW_CONFIG;
  }

  async getPushConfig(): Promise<PushConfig> {
    const effective = await this.getEffectiveConfig();
    return effective.push || DEFAULT_PUSH_CONFIG;
  }

  async getBackendConfig(): Promise<BackendConfig> {
    const effective = await this.getEffectiveConfig();
    return effective.backend || DEFAULT_BACKEND_CONFIG;
  }

  async getTilesConfig(): Promise<TilesConfig | null> {
    const effective = await this.getEffectiveConfig();
    return effective.tiles || null;
  }

  private getDefaultConfig(): RemoteConfig {
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      tiles: undefined,
      push: DEFAULT_PUSH_CONFIG,
      eew: DEFAULT_EEW_CONFIG,
      backend: DEFAULT_BACKEND_CONFIG,
    };
  }

  private async getRemoteConfig(): Promise<RemoteConfig | null> {
    try {
      return await this.fetcher.getCachedConfig();
    } catch (error) {
      console.error('Failed to get remote config:', error);
      return null;
    }
  }

  private async getWizardOverrides(): Promise<Partial<RemoteConfig> | null> {
    try {
      const wizardConfig = await this.prefs.get('activationWizardConfig');
      if (!wizardConfig) {
        return null;
      }

      const parsed = JSON.parse(wizardConfig);
      
      // Convert wizard config to remote config format
      const overrides: Partial<RemoteConfig> = {};
      
      if (parsed.tiles && parsed.tiles.url) {
        overrides.tiles = {
          url: parsed.tiles.url,
          version: parsed.tiles.version,
          sha256: parsed.tiles.sha256,
        };
      }

      if (parsed.push) {
        overrides.push = {
          topics: parsed.push.topics || [],
          fcmSenderId: parsed.push.fcmSenderId,
          fcmAppId: parsed.push.fcmAppId,
          fcmApiKey: parsed.push.fcmApiKey,
          fcmProjectId: parsed.push.fcmProjectId,
          apnsTeamId: parsed.push.apnsTeamId,
          apnsKeyId: parsed.push.apnsKeyId,
        };
      }

      if (parsed.eewFeeds && parsed.eewFeeds.length > 0) {
        overrides.eew = {
          ...DEFAULT_EEW_CONFIG,
          feeds: parsed.eewFeeds,
        };
      }

      if (parsed.backend) {
        overrides.backend = {
          apiBaseUrl: parsed.backend.apiBaseUrl,
          wsUrl: parsed.backend.wsUrl,
        };
      }

      return overrides;
    } catch (error) {
      console.error('Failed to get wizard overrides:', error);
      return null;
    }
  }

  private mergeConfigs(
    defaults: RemoteConfig,
    remote?: RemoteConfig | null,
    wizard?: Partial<RemoteConfig> | null
  ): RemoteConfig {
    // Start with defaults
    let merged = { ...defaults };

    // Apply remote config overrides
    if (remote) {
      merged = {
        ...merged,
        ...remote,
        eew: remote.eew ? { ...merged.eew, ...remote.eew } : merged.eew,
        push: remote.push ? { ...merged.push, ...remote.push } : merged.push,
        backend: remote.backend ? { ...merged.backend, ...remote.backend } : merged.backend,
        tiles: remote.tiles || merged.tiles,
      };
    }

    // Apply wizard overrides (highest precedence)
    if (wizard) {
      merged = {
        ...merged,
        ...wizard,
        eew: wizard.eew ? { ...merged.eew, ...wizard.eew } : merged.eew,
        push: wizard.push ? { ...merged.push, ...wizard.push } : merged.push,
        backend: wizard.backend ? { ...merged.backend, ...wizard.backend } : merged.backend,
        tiles: wizard.tiles || merged.tiles,
      };
    }

    return merged;
  }

  async fetchRemoteConfig(url: string) {
    return await this.fetcher.fetchRemoteConfig(url);
  }

  async getLastFetchInfo() {
    return await this.fetcher.getLastFetchInfo();
  }

  async clearCache() {
    await this.fetcher.clearCache();
  }

  // Force refresh from remote
  async refreshFromRemote(url: string): Promise<RemoteConfig> {
    const result = await this.fetcher.fetchRemoteConfig(url);
    if (result.success && result.config) {
      return result.config;
    }
    throw new Error(result.error || 'Failed to fetch remote config');
  }

  // Get config for specific feature
  async getFeatureConfig(feature: 'eew' | 'push' | 'backend' | 'tiles'): Promise<any> {
    const effective = await this.getEffectiveConfig();
    return effective[feature];
  }

  // Update wizard override for specific feature
  async updateWizardOverride(feature: string, value: any): Promise<void> {
    try {
      const wizardConfig = await this.prefs.get('activationWizardConfig');
      const parsed = wizardConfig ? JSON.parse(wizardConfig) : {};
      
      parsed[feature] = value;
      await this.prefs.set('activationWizardConfig', JSON.stringify(parsed));
      
      console.log(`Updated wizard override for ${feature}:`, value);
    } catch (error) {
      console.error(`Failed to update wizard override for ${feature}:`, error);
    }
  }
}
