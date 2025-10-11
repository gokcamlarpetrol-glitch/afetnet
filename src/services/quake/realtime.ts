import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { notifyQuake } from '../../alerts/notify';
import { matchesRegionFilter } from '../../lib/region';
import { EewSettings } from '../../store/settings';
import { providerRegistry } from './providers';
import { QuakeItem } from './types';

interface LiveFeedMeta {
  source: string;
  latencyMs: number;
  timestamp: number;
}

interface LiveFeedCallbacks {
  onEvents: (items: QuakeItem[], meta: LiveFeedMeta) => void;
  onError?: (error: string) => void;
}

class LiveFeedManager {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private burstMode = false;
  private burstEndTime = 0;
  private lastEventId: string | null = null;
  private appStateSubscription: any = null;

  constructor(
    private initialSettings: EewSettings,
    private callbacks: LiveFeedCallbacks
  ) {
    this.setupAppStateListener();
  }

  private async getCurrentSettings(): Promise<EewSettings> {
    try {
      const settingsData = await AsyncStorage.getItem('afn/settings/v1');
      if (settingsData) {
        const parsed = JSON.parse(settingsData);
        return {
          quakeProvider: parsed.state?.quakeProvider || this.initialSettings.quakeProvider,
          magThreshold: parsed.state?.magThreshold || 3.5, // Default to 3.5 if missing
          liveMode: parsed.state?.liveMode !== undefined ? parsed.state.liveMode : this.initialSettings.liveMode,
          pollFastMs: parsed.state?.pollFastMs || this.initialSettings.pollFastMs,
          pollSlowMs: parsed.state?.pollSlowMs || this.initialSettings.pollSlowMs,
          region: parsed.state?.region || this.initialSettings.region,
          experimentalPWave: parsed.state?.experimentalPWave !== undefined ? parsed.state.experimentalPWave : this.initialSettings.experimentalPWave
        };
      }
    } catch (error) {
      logger.warn('Failed to read current settings:', error);
    }
    return this.initialSettings;
  }

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && this.isRunning) {
        // App came to foreground - start burst mode
        this.startBurstMode();
      }
    });
  }

  private startBurstMode(): void {
    this.burstMode = true;
    this.burstEndTime = Date.now() + (2 * 60 * 1000); // 2 minutes
    logger.debug('Live feed: Started burst mode for 2 minutes');
  }

  private getCurrentPollInterval(): number {
    if (this.burstMode && Date.now() < this.burstEndTime) {
      return this.settings.pollFastMs;
    } else {
      this.burstMode = false;
      return this.settings.pollSlowMs;
    }
  }

  private async fetchAndProcessEvents(): Promise<void> {
    try {
      // Get current settings (always read latest)
      const settings = await this.getCurrentSettings();
      
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        logger.debug('Live feed: No network, showing cache');
        await this.showCache();
        return;
      }

      // Get provider
      const provider = providerRegistry[settings.quakeProvider];
      const startTime = Date.now();

      // Fetch from provider
      const rawQuakes = await provider.fetchRecent();
      const latencyMs = Date.now() - startTime;

      // Filter by magnitude threshold
      const filteredByMag = rawQuakes.filter(quake => 
        quake.mag >= settings.magThreshold
      );

      // Filter by region
      const filteredByRegion = filteredByMag.filter(quake =>
        matchesRegionFilter(quake, settings.region)
      );

      // Check for new events
      const newQuakes = this.findNewQuakes(filteredByRegion);

      if (newQuakes.length > 0) {
        logger.debug(`Live feed: Found ${newQuakes.length} new quakes`);
        
        // Update last event ID
        this.lastEventId = newQuakes[0].id;
        
        // Trigger burst mode for new events
        this.startBurstMode();
        
        // Send notifications for new qualifying quakes
        for (const quake of newQuakes) {
          await notifyQuake(quake, 'live');
        }
        
        // Call callback with new events
        this.callbacks.onEvents(newQuakes, {
          source: settings.quakeProvider,
          latencyMs,
          timestamp: Date.now()
        });
      }

      // Update cache
      if (filteredByRegion.length > 0) {
        await this.updateCache(filteredByRegion);
      }

    } catch (error) {
      logger.error('Live feed fetch error:', error);
      this.callbacks.onError?.(error instanceof Error ? error.message : 'Canlı deprem verisi alınamıyor');
      
      // Show cache on error
      await this.showCache();
    }
  }

  private findNewQuakes(quakes: QuakeItem[]): QuakeItem[] {
    if (!this.lastEventId) {
      // First run - return latest quake only
      return quakes.slice(0, 1);
    }

    // Find quakes newer than last known
    const newQuakes: QuakeItem[] = [];
    for (const quake of quakes) {
      if (quake.id === this.lastEventId) {
        break; // Found last known quake, stop here
      }
      newQuakes.push(quake);
    }

    return newQuakes;
  }

  private async showCache(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem('afn/quakes/cache/v1');
      if (cached) {
        const quakes = JSON.parse(cached);
        const filtered = quakes.filter((quake: QuakeItem) =>
          quake.mag >= this.settings.magThreshold &&
          matchesRegionFilter(quake, this.settings.region)
        );

        this.callbacks.onEvents(filtered, {
          source: 'cache',
          latencyMs: 0,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.warn('Failed to show cache:', error);
    }
  }

  private async updateCache(quakes: QuakeItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem('afn/quakes/cache/v1', JSON.stringify(quakes));
    } catch (error) {
      logger.warn('Failed to update cache:', error);
    }
  }

  public start(): void {
    if (this.isRunning) {
      logger.debug('Live feed: Already running');
      return;
    }

    this.isRunning = true;
    this.startBurstMode(); // Start in burst mode
    
    logger.debug(`Live feed: Started with ${this.settings.quakeProvider} provider`);
    
    // Initial fetch
    this.fetchAndProcessEvents();
    
    // Set up polling
    this.scheduleNextPoll();
  }

  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    const interval = this.getCurrentPollInterval();
    
    this.intervalId = setTimeout(() => {
      this.fetchAndProcessEvents();
      this.scheduleNextPoll();
    }, interval);
  }

  public stop(): void {
    if (!this.isRunning) {
      logger.debug('Live feed: Not running');
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    
    logger.debug('Live feed: Stopped');
  }

  public updateSettings(newSettings: EewSettings): void {
    this.settings = newSettings;
    logger.debug('Live feed: Settings updated');
  }
}

export function startLiveFeed(
  settings: EewSettings,
  callbacks: LiveFeedCallbacks
): { stop: () => void } {
  const manager = new LiveFeedManager(settings, callbacks);
  manager.start();
  
  return {
    stop: () => manager.stop()
  };
}

export function getProvider(providerKey: string) {
  return providerRegistry[providerKey as keyof typeof providerRegistry];
}
