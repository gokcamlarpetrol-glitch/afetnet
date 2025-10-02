import { EventEmitter, EEWOfficialAlertEvent } from '../utils/events';
import { Preferences } from '../storage/prefs';
import * as Location from 'expo-location';
import { EEWFeedAdapter, parseJsonPath, parseXmlPath } from '../remoteconfig/schema';

export interface OfficialFeedConfig {
  url: string;
  pollIntervalMs: number;
  timeoutMs: number;
  enabled: boolean;
}

export interface FeedAdapter extends EEWFeedAdapter {
  id: string;
  enabled: boolean;
  lastPolled?: number;
  lastError?: string;
}

export interface OfficialAlertData {
  id: string;
  magnitude: number;
  epicenterLat: number;
  epicenterLon: number;
  depth: number; // km
  originTime: string; // ISO timestamp
  source: string;
  confidence: 'high' | 'medium' | 'low';
  region: string;
  country: string;
}

export interface ParsedFeedResponse {
  alerts: OfficialAlertData[];
  lastUpdate: string;
  source: string;
}

export class OfficialFeedManager {
  private static instance: OfficialFeedManager;
  private eventEmitter = new EventEmitter();
  private config: OfficialFeedConfig;
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastAlertTime = 0;
  private adapters: Map<string, FeedAdapter> = new Map();

  private constructor() {
    this.config = {
      url: '',
      pollIntervalMs: 5000, // 5 seconds for EEW
      timeoutMs: 10000, // 10 seconds
      enabled: false,
    };
  }

  static getInstance(): OfficialFeedManager {
    if (!OfficialFeedManager.instance) {
      OfficialFeedManager.instance = new OfficialFeedManager();
    }
    return OfficialFeedManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      const savedConfig = await Preferences.get<OfficialFeedConfig>('officialFeedConfig');
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
      }

      if (this.config.enabled && this.config.url) {
        await this.startPolling();
      }

      console.log('OfficialFeedManager initialized:', {
        enabled: this.config.enabled,
        url: this.config.url ? 'configured' : 'not configured',
        pollInterval: this.config.pollIntervalMs,
      });
    } catch (error) {
      console.error('Failed to initialize OfficialFeedManager:', error);
    }
  }

  async updateConfig(updates: Partial<OfficialFeedConfig>): Promise<void> {
    const wasPolling = this.isPolling;
    
    if (wasPolling) {
      await this.stopPolling();
    }

    this.config = { ...this.config, ...updates };

    try {
      await Preferences.set('officialFeedConfig', this.config);
    } catch (error) {
      console.error('Failed to save official feed config:', error);
    }

    if (this.config.enabled && this.config.url && !wasPolling) {
      await this.startPolling();
    }
  }

  getConfig(): OfficialFeedConfig {
    return { ...this.config };
  }

  async startPolling(): Promise<void> {
    if (this.isPolling || !this.config.enabled || !this.config.url) {
      return;
    }

    this.isPolling = true;
    console.log('Starting official feed polling...');

    // Initial poll
    await this.pollOfficialFeed();

    // Set up recurring polling
    this.pollTimer = setInterval(async () => {
      try {
        await this.pollOfficialFeed();
      } catch (error) {
        console.error('Error during scheduled feed poll:', error);
      }
    }, this.config.pollIntervalMs);

    console.log('Official feed polling started');
  }

  async stopPolling(): Promise<void> {
    if (!this.isPolling) {
      return;
    }

    this.isPolling = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    console.log('Official feed polling stopped');
  }

  async pollOfficialFeed(): Promise<ParsedFeedResponse | null> {
    if (!this.config.enabled || !this.config.url) {
      return null;
    }

    try {
      console.log('Polling official feed:', this.config.url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(this.config.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet-EEW/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const parsedResponse = this.parseFeedResponse(data);

      if (parsedResponse && parsedResponse.alerts.length > 0) {
        await this.processAlerts(parsedResponse.alerts);
      }

      console.log('Official feed poll completed:', {
        alerts: parsedResponse?.alerts.length || 0,
        source: parsedResponse?.source || 'unknown',
      });

      return parsedResponse;
    } catch (error) {
      console.error('Failed to poll official feed:', error);
      this.eventEmitter.emit('eew:feed_error', { error: error.message });
      return null;
    }
  }

  private parseFeedResponse(data: any): ParsedFeedResponse | null {
    try {
      // This is a generic parser - in reality, you'd need to adapt to specific feed formats
      // Common formats: USGS, AFAD, Kandilli, etc.
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid feed response format');
      }

      let alerts: OfficialAlertData[] = [];
      let source = 'unknown';
      let lastUpdate = new Date().toISOString();

      // Try to parse different common formats
      if (data.features && Array.isArray(data.features)) {
        // GeoJSON format (USGS-like)
        alerts = this.parseGeoJSONFormat(data.features);
        source = 'USGS';
      } else if (data.earthquakes && Array.isArray(data.earthquakes)) {
        // Simple array format
        alerts = this.parseSimpleArrayFormat(data.earthquakes);
        source = data.source || 'AFAD';
      } else if (data.events && Array.isArray(data.events)) {
        // Events format
        alerts = this.parseEventsFormat(data.events);
        source = data.source || 'Kandilli';
      } else if (Array.isArray(data)) {
        // Direct array format
        alerts = this.parseSimpleArrayFormat(data);
        source = 'generic';
      } else {
        throw new Error('Unrecognized feed format');
      }

      return {
        alerts,
        lastUpdate,
        source,
      };
    } catch (error) {
      console.error('Failed to parse feed response:', error);
      return null;
    }
  }

  private parseGeoJSONFormat(features: any[]): OfficialAlertData[] {
    return features
      .filter(feature => feature.geometry && feature.properties)
      .map(feature => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;
        
        return {
          id: props.id || props.eventId || `geojson_${Date.now()}`,
          magnitude: parseFloat(props.mag || props.magnitude || 0),
          epicenterLat: parseFloat(coords[1]),
          epicenterLon: parseFloat(coords[0]),
          depth: parseFloat(props.depth || props.depthKm || 0),
          originTime: props.time || props.originTime || new Date().toISOString(),
          source: props.source || 'USGS',
          confidence: this.mapConfidence(props.confidence || 'medium'),
          region: props.place || props.region || '',
          country: props.country || '',
        };
      })
      .filter(alert => alert.magnitude > 0); // Filter out invalid alerts
  }

  private parseSimpleArrayFormat(earthquakes: any[]): OfficialAlertData[] {
    return earthquakes
      .map(eq => ({
        id: eq.id || eq.eventId || `simple_${Date.now()}`,
        magnitude: parseFloat(eq.magnitude || eq.mag || 0),
        epicenterLat: parseFloat(eq.latitude || eq.lat || 0),
        epicenterLon: parseFloat(eq.longitude || eq.lon || 0),
        depth: parseFloat(eq.depth || eq.depthKm || 0),
        originTime: eq.originTime || eq.time || eq.timestamp || new Date().toISOString(),
        source: eq.source || 'AFAD',
        confidence: this.mapConfidence(eq.confidence || 'medium'),
        region: eq.region || eq.place || '',
        country: eq.country || 'Turkey',
      }))
      .filter(alert => alert.magnitude > 0);
  }

  private parseEventsFormat(events: any[]): OfficialAlertData[] {
    return events
      .map(event => ({
        id: event.id || event.eventId || `event_${Date.now()}`,
        magnitude: parseFloat(event.magnitude || event.mag || 0),
        epicenterLat: parseFloat(event.latitude || event.lat || 0),
        epicenterLon: parseFloat(event.longitude || event.lon || 0),
        depth: parseFloat(event.depth || event.depthKm || 0),
        originTime: event.originTime || event.time || new Date().toISOString(),
        source: event.source || 'Kandilli',
        confidence: this.mapConfidence(event.confidence || 'medium'),
        region: event.region || event.place || '',
        country: event.country || 'Turkey',
      }))
      .filter(alert => alert.magnitude > 0);
  }

  private mapConfidence(confidence: string): 'high' | 'medium' | 'low' {
    const conf = confidence.toLowerCase();
    if (conf.includes('high') || conf.includes('confident')) return 'high';
    if (conf.includes('low') || conf.includes('uncertain')) return 'low';
    return 'medium';
  }

  private async processAlerts(alerts: OfficialAlertData[]): Promise<void> {
    for (const alert of alerts) {
      try {
        await this.processAlert(alert);
      } catch (error) {
        console.error('Error processing alert:', error);
      }
    }
  }

  private async processAlert(alert: OfficialAlertData): Promise<void> {
    try {
      // Check if this is a new alert (not already processed)
      const alertKey = `${alert.id}_${alert.originTime}`;
      const lastProcessed = await Preferences.get<number>(`processed_alert_${alertKey}`);
      
      if (lastProcessed && Date.now() - lastProcessed < 300000) { // 5 minutes
        return; // Already processed recently
      }

      // Calculate ETA for current device location
      const etaSeconds = await this.calculateETA(alert);
      
      if (etaSeconds <= 0) {
        console.log('Alert ETA is negative or zero, skipping:', alert.id);
        return;
      }

      // Check if ETA is within cutoff (configurable, default 25 seconds)
      const etaCutoff = 25; // This should come from config
      if (etaSeconds > etaCutoff) {
        console.log('Alert ETA too long, skipping:', alert.id, 'ETA:', etaSeconds);
        return;
      }

      // Create official alert event
      const alertEvent: EEWOfficialAlertEvent = {
        timestamp: Date.now(),
        magnitude: alert.magnitude,
        epicenterLat: alert.epicenterLat,
        epicenterLon: alert.epicenterLon,
        originTime: new Date(alert.originTime).getTime(),
        etaSeconds,
        source: alert.source,
        confidence: alert.confidence === 'high' ? 'high' : 'very_high',
      };

      // Mark as processed
      await Preferences.set(`processed_alert_${alertKey}`, Date.now());

      console.log('Processing official alert:', {
        id: alert.id,
        magnitude: alert.magnitude,
        eta: etaSeconds,
        source: alert.source,
      });

      this.eventEmitter.emit('eew:official_alert', alertEvent);
    } catch (error) {
      console.error('Error processing individual alert:', error);
    }
  }

  private async calculateETA(alert: OfficialAlertData): Promise<number> {
    try {
      // Get current device location
      let deviceLat = 41.0082; // Istanbul default
      let deviceLon = 28.9784;

      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          maximumAge: 60000, // Use cached location if less than 1 minute old
        });
        deviceLat = location.coords.latitude;
        deviceLon = location.coords.longitude;
      } catch (locationError) {
        console.warn('Using default Istanbul location for ETA calculation');
      }

      // Calculate distance to epicenter
      const distance = this.calculateDistance(
        deviceLat, deviceLon,
        alert.epicenterLat, alert.epicenterLon
      );

      // Calculate origin time
      const originTime = new Date(alert.originTime).getTime();
      const currentTime = Date.now();
      const elapsedSeconds = (currentTime - originTime) / 1000;

      // Estimate S-wave arrival time
      // P-wave velocity: ~6 km/s, S-wave velocity: ~3.5 km/s
      const sWaveVelocity = 3.5; // km/s
      const sWaveArrivalSeconds = distance / sWaveVelocity;
      
      // ETA = S-wave arrival time - elapsed time
      const etaSeconds = sWaveArrivalSeconds - elapsedSeconds;

      return Math.max(0, Math.round(etaSeconds));
    } catch (error) {
      console.error('Error calculating ETA:', error);
      return 0;
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Event subscription methods
  on(event: 'eew:official_alert', listener: (data: EEWOfficialAlertEvent) => void): () => void;
  on(event: 'eew:feed_error', listener: (data: { error: string }) => void): () => void;
  on(event: string, listener: (...args: any[]) => void): () => void {
    return this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  // Utility methods
  getIsPolling(): boolean {
    return this.isPolling;
  }

  getLastAlertTime(): number {
    return this.lastAlertTime;
  }

  // Testing methods
  async simulateOfficialAlert(magnitude: number = 6.5, etaSeconds: number = 20): Promise<void> {
    const alertEvent: EEWOfficialAlertEvent = {
      timestamp: Date.now(),
      magnitude,
      epicenterLat: 40.8,
      epicenterLon: 29.0,
      originTime: Date.now() - 5000, // 5 seconds ago
      etaSeconds,
      source: 'AFAD_TEST',
      confidence: 'high',
    };

    this.eventEmitter.emit('eew:official_alert', alertEvent);
  }

  // Adapter management methods
  async registerFeedAdapter(adapter: EEWFeedAdapter): Promise<void> {
    try {
      const feedAdapter: FeedAdapter = {
        ...adapter,
        id: `${adapter.name}_${Date.now()}`,
        enabled: true,
      };

      this.adapters.set(feedAdapter.id, feedAdapter);
      await this.saveAdapters();

      console.log('Feed adapter registered:', feedAdapter.name);
    } catch (error) {
      console.error('Failed to register feed adapter:', error);
      throw error;
    }
  }

  async removeFeedAdapter(adapterId: string): Promise<void> {
    try {
      this.adapters.delete(adapterId);
      await this.saveAdapters();
      console.log('Feed adapter removed:', adapterId);
    } catch (error) {
      console.error('Failed to remove feed adapter:', error);
      throw error;
    }
  }

  async getFeedAdapters(): Promise<FeedAdapter[]> {
    return Array.from(this.adapters.values());
  }

  async testParse(adapter: EEWFeedAdapter): Promise<void> {
    try {
      console.log('Testing parse for adapter:', adapter.name);
      
      const response = await fetch(adapter.url, {
        method: 'GET',
        headers: {
          'Accept': adapter.type === 'json' ? 'application/json' : 'application/xml',
          'User-Agent': 'AfetNet-EEW/1.0',
        },
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let data: any;
      if (adapter.type === 'json') {
        data = await response.json();
      } else {
        const xmlText = await response.text();
        // For XML, we'd need a proper XML parser in production
        data = { xml: xmlText };
      }

      // Test parsing using the adapter's path mapping
      const testAlert = this.parseWithAdapter(data, adapter);
      
      if (testAlert) {
        console.log('Test parse successful:', testAlert);
        // Emit a test alert
        const testEvent: EEWOfficialAlertEvent = {
          timestamp: Date.now(),
          magnitude: testAlert.magnitude,
          epicenterLat: testAlert.epicenterLat,
          epicenterLon: testAlert.epicenterLon,
          originTime: new Date(testAlert.originTime).getTime(),
          etaSeconds: 15, // Test ETA
          source: adapter.name,
          confidence: 'high',
        };
        
        this.eventEmitter.emit('eew:official_alert', testEvent);
      } else {
        throw new Error('Failed to parse test data');
      }
    } catch (error) {
      console.error('Test parse failed:', error);
      throw error;
    }
  }

  private parseWithAdapter(data: any, adapter: EEWFeedAdapter): OfficialAlertData | null {
    try {
      const lat = adapter.type === 'json' 
        ? parseJsonPath(data, adapter.pathMapping.lat)
        : parseXmlPath(JSON.stringify(data), adapter.pathMapping.lat);
      
      const lon = adapter.type === 'json'
        ? parseJsonPath(data, adapter.pathMapping.lon)
        : parseXmlPath(JSON.stringify(data), adapter.pathMapping.lon);
      
      const mag = adapter.type === 'json'
        ? parseJsonPath(data, adapter.pathMapping.mag)
        : parseXmlPath(JSON.stringify(data), adapter.pathMapping.mag);
      
      const origin = adapter.type === 'json'
        ? parseJsonPath(data, adapter.pathMapping.origin)
        : parseXmlPath(JSON.stringify(data), adapter.pathMapping.origin);
      
      const id = adapter.type === 'json'
        ? parseJsonPath(data, adapter.pathMapping.id)
        : parseXmlPath(JSON.stringify(data), adapter.pathMapping.id);

      if (!lat || !lon || !mag || !origin || !id) {
        return null;
      }

      return {
        id: String(id),
        magnitude: parseFloat(String(mag)),
        epicenterLat: parseFloat(String(lat)),
        epicenterLon: parseFloat(String(lon)),
        depth: 0,
        originTime: String(origin),
        source: adapter.name,
        confidence: 'medium',
        region: '',
        country: 'Turkey',
      };
    } catch (error) {
      console.error('Failed to parse with adapter:', error);
      return null;
    }
  }

  async pollAllFeeds(): Promise<void> {
    try {
      const enabledAdapters = Array.from(this.adapters.values()).filter(adapter => adapter.enabled);
      
      for (const adapter of enabledAdapters) {
        try {
          await this.pollFeedAdapter(adapter);
        } catch (error) {
          console.error(`Failed to poll adapter ${adapter.name}:`, error);
          adapter.lastError = error instanceof Error ? error.message : 'Unknown error';
        }
      }
    } catch (error) {
      console.error('Failed to poll all feeds:', error);
    }
  }

  private async pollFeedAdapter(adapter: FeedAdapter): Promise<void> {
    try {
      const response = await fetch(adapter.url, {
        method: 'GET',
        headers: {
          'Accept': adapter.type === 'json' ? 'application/json' : 'application/xml',
          'User-Agent': 'AfetNet-EEW/1.0',
        },
        timeout: this.config.timeoutMs,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let data: any;
      if (adapter.type === 'json') {
        data = await response.json();
      } else {
        const xmlText = await response.text();
        data = { xml: xmlText };
      }

      const alert = this.parseWithAdapter(data, adapter);
      if (alert) {
        await this.processAlertWithETA(alert, adapter);
      }

      adapter.lastPolled = Date.now();
      adapter.lastError = undefined;
    } catch (error) {
      adapter.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  private async processAlertWithETA(alert: OfficialAlertData, adapter: FeedAdapter): Promise<void> {
    try {
      const etaSeconds = await this.calculateETA(alert);
      
      if (etaSeconds <= 0 || etaSeconds > (adapter.etaCutoffSec || 25)) {
        return;
      }

      const alertEvent: EEWOfficialAlertEvent = {
        timestamp: Date.now(),
        magnitude: alert.magnitude,
        epicenterLat: alert.epicenterLat,
        epicenterLon: alert.epicenterLon,
        originTime: new Date(alert.originTime).getTime(),
        etaSeconds,
        source: adapter.name,
        confidence: 'high',
      };

      console.log('Processing adapter alert:', {
        adapter: adapter.name,
        magnitude: alert.magnitude,
        eta: etaSeconds,
      });

      this.eventEmitter.emit('eew:official_alert', alertEvent);
    } catch (error) {
      console.error('Failed to process alert with ETA:', error);
    }
  }

  private async saveAdapters(): Promise<void> {
    try {
      const adaptersArray = Array.from(this.adapters.values());
      await Preferences.set('eewFeedAdapters', JSON.stringify(adaptersArray));
    } catch (error) {
      console.error('Failed to save adapters:', error);
    }
  }

  private async loadAdapters(): Promise<void> {
    try {
      const adaptersJson = await Preferences.get('eewFeedAdapters');
      if (adaptersJson) {
        const adaptersArray = JSON.parse(adaptersJson);
        this.adapters.clear();
        
        for (const adapter of adaptersArray) {
          this.adapters.set(adapter.id, adapter);
        }
        
        console.log('Loaded adapters:', adaptersArray.length);
      }
    } catch (error) {
      console.error('Failed to load adapters:', error);
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.stopPolling();
    this.eventEmitter = new EventEmitter();
    this.adapters.clear();
  }
}

// Export convenience function
export const getOfficialFeedManager = (): OfficialFeedManager => {
  return OfficialFeedManager.getInstance();
};
