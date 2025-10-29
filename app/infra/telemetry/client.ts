// @afetnet: Advanced Telemetry Client for Enterprise Monitoring
// Pluggable telemetry system with offline storage and optional remote sync

import { logger } from '../../core/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TelemetryEvent {
  id: string;
  type: 'app_start' | 'app_crash' | 'feature_usage' | 'performance' | 'security' | 'network' | 'emergency' | 'custom';
  category: 'info' | 'warning' | 'error' | 'critical';
  timestamp: number;
  sessionId: string;
  userId?: string;
  deviceId: string;
  appVersion: string;
  platform: 'ios' | 'android';
  data: Record<string, any>;
  tags: string[];
  metadata: {
    batteryLevel?: number;
    networkType?: string;
    locationEnabled?: boolean;
    emergencyMode?: boolean;
  };
}

export interface TelemetryConfig {
  enabled: boolean;
  offlineStorage: boolean;
  remoteSync: boolean;
  remoteEndpoint?: string;
  batchSize: number;
  flushInterval: number; // milliseconds
  retentionPeriod: number; // days
  maxStorageSize: number; // MB
  compression: boolean;
  encryption: boolean;
}

export interface TelemetrySink {
  name: string;
  type: 'file' | 'remote' | 'console' | 'custom';
  config: Record<string, any>;
  enabled: boolean;
}

export class AdvancedTelemetryClient {
  private events: TelemetryEvent[] = [];
  private sinks: TelemetrySink[] = [];
  private config: TelemetryConfig;
  private sessionId: string;
  private deviceId: string;
  private isActive = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private storageSize = 0;

  constructor() {
    this.config = {
      enabled: true,
      offlineStorage: true,
      remoteSync: false, // Disabled by default for privacy
      batchSize: 50,
      flushInterval: 300000, // 5 minutes
      retentionPeriod: 7, // 7 days
      maxStorageSize: 10, // 10 MB
      compression: true,
      encryption: false, // Disabled by default for performance
    };

    this.sessionId = this.generateSessionId();
  }

  async initialize(): Promise<void> {
    logger.debug('📊 Initializing advanced telemetry client...');

    try {
      // Generate device ID
      this.deviceId = await this.getDeviceId();

      // Load existing events
      await this.loadStoredEvents();

      // Setup default sinks
      this.setupDefaultSinks();

      // Start periodic flush
      this.startPeriodicFlush();

      // Setup cleanup
      this.setupPeriodicCleanup();

      this.isActive = true;
      logger.debug('✅ Advanced telemetry client initialized');
    } catch (error) {
      logger.error('Failed to initialize telemetry client:', error);
      throw error;
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('telemetry_device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem('telemetry_device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      logger.error('Failed to get device ID:', error);
      return `fallback_${Date.now()}`;
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private async loadStoredEvents(): Promise<void> {
    try {
      const storedEvents = await AsyncStorage.getItem('telemetry_events');
      if (storedEvents) {
        this.events = JSON.parse(storedEvents);
        this.storageSize = JSON.stringify(this.events).length;
        logger.debug(`Loaded ${this.events.length} stored telemetry events`);
      }
    } catch (error) {
      logger.error('Failed to load stored events:', error);
    }
  }

  private setupDefaultSinks(): void {
    // File sink for offline storage
    this.addSink({
      name: 'file',
      type: 'file',
      config: { path: 'telemetry_events.json' },
      enabled: this.config.offlineStorage,
    });

    // Console sink for development
    if (__DEV__) {
      this.addSink({
        name: 'console',
        type: 'console',
        config: { level: 'debug' },
        enabled: true,
      });
    }

    // Remote sink (optional)
    if (this.config.remoteSync && this.config.remoteEndpoint) {
      this.addSink({
        name: 'remote',
        type: 'remote',
        config: { endpoint: this.config.remoteEndpoint },
        enabled: false, // Disabled by default for privacy
      });
    }
  }

  private startPeriodicFlush(): void {
    logger.debug('⏰ Starting periodic telemetry flush...');

    this.flushTimer = setInterval(async () => {
      if (this.isActive && this.events.length > 0) {
        await this.flush();
      }
    }, this.config.flushInterval);
  }

  private setupPeriodicCleanup(): void {
    logger.debug('🧹 Setting up periodic telemetry cleanup...');

    setInterval(async () => {
      await this.cleanupOldEvents();
    }, 3600000); // Every hour
  }

  // @afetnet: Track telemetry event
  async track(
    type: TelemetryEvent['type'],
    category: TelemetryEvent['category'],
    data: Record<string, any> = {},
    tags: string[] = []
  ): Promise<void> {
    if (!this.isActive || !this.config.enabled) return;

    try {
      const event: TelemetryEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type,
        category,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: await this.getUserId(),
        deviceId: this.deviceId,
        appVersion: await this.getAppVersion(),
        platform: this.getPlatform(),
        data,
        tags,
        metadata: await this.getMetadata(),
      };

      // Add to events
      this.events.push(event);

      // Check if we should flush
      if (this.events.length >= this.config.batchSize) {
        await this.flush();
      }

      // Store in memory
      await this.storeEvent(event);

      logger.debug(`📊 Tracked event: ${type} (${category})`);
    } catch (error) {
      logger.error('Failed to track telemetry event:', error);
    }
  }

  private async getUserId(): Promise<string | undefined> {
    try {
      return await AsyncStorage.getItem('user_id') || undefined;
    } catch {
      return undefined;
    }
  }

  private async getAppVersion(): Promise<string> {
    try {
      const packageJson = require('../../../../package.json');
      return packageJson.version;
    } catch {
      return '1.0.0';
    }
  }

  private getPlatform(): 'ios' | 'android' {
    // @afetnet: Platform detection - simplified for this example
    return 'ios'; // Would detect actual platform
  }

  private async getMetadata(): Promise<TelemetryEvent['metadata']> {
    try {
      // Get battery level
      const batteryLevel = await this.getBatteryLevel();

      // Get network type
      const networkType = await this.getNetworkType();

      // Get location enabled status
      const locationEnabled = await this.getLocationEnabled();

      // Get emergency mode status
      const emergencyMode = await this.getEmergencyMode();

      return {
        batteryLevel,
        networkType,
        locationEnabled,
        emergencyMode,
      };
    } catch (error) {
      logger.error('Failed to get metadata:', error);
      return {};
    }
  }

  private async getBatteryLevel(): Promise<number | undefined> {
    try {
      // @afetnet: Get battery level - simplified
      return 85; // Would get actual battery level
    } catch {
      return undefined;
    }
  }

  private async getNetworkType(): Promise<string | undefined> {
    try {
      // @afetnet: Get network type - simplified
      return 'wifi'; // Would detect actual network type
    } catch {
      return undefined;
    }
  }

  private async getLocationEnabled(): Promise<boolean | undefined> {
    try {
      // @afetnet: Check location permission - simplified
      return true; // Would check actual permission status
    } catch {
      return undefined;
    }
  }

  private async getEmergencyMode(): Promise<boolean | undefined> {
    try {
      // @afetnet: Check emergency mode status - simplified
      return false; // Would check actual emergency mode
    } catch {
      return undefined;
    }
  }

  private async storeEvent(event: TelemetryEvent): Promise<void> {
    try {
      // Store in AsyncStorage
      const storedEvents = await AsyncStorage.getItem('telemetry_events');
      const events = storedEvents ? JSON.parse(storedEvents) : [];
      events.push(event);

      // Keep only recent events
      const maxEvents = 1000;
      if (events.length > maxEvents) {
        events.splice(0, events.length - maxEvents);
      }

      await AsyncStorage.setItem('telemetry_events', JSON.stringify(events));

      // Update storage size
      this.storageSize = JSON.stringify(events).length;
    } catch (error) {
      logger.error('Failed to store telemetry event:', error);
    }
  }

  private async flush(): Promise<void> {
    try {
      logger.debug(`📤 Flushing ${this.events.length} telemetry events`);

      // Send to all enabled sinks
      for (const sink of this.sinks.filter(s => s.enabled)) {
        await this.sendToSink(sink, [...this.events]);
      }

      // Clear events after successful flush
      this.events = [];

      logger.debug('✅ Telemetry events flushed');
    } catch (error) {
      logger.error('Failed to flush telemetry events:', error);
    }
  }

  private async sendToSink(sink: TelemetrySink, events: TelemetryEvent[]): Promise<void> {
    try {
      switch (sink.type) {
        case 'file':
          await this.writeToFile(events);
          break;
        case 'remote':
          await this.sendToRemote(events, sink.config.endpoint);
          break;
        case 'console':
          this.logToConsole(events);
          break;
        case 'custom':
          await this.sendToCustomSink(events, sink.config);
          break;
      }
    } catch (error) {
      logger.error(`Failed to send to sink ${sink.name}:`, error);
    }
  }

  private async writeToFile(events: TelemetryEvent[]): Promise<void> {
    try {
      const filePath = 'telemetry_export.json';
      const data = JSON.stringify(events, null, 2);
      await AsyncStorage.setItem(filePath, data);
    } catch (error) {
      logger.error('Failed to write to file:', error);
    }
  }

  private async sendToRemote(events: TelemetryEvent[], endpoint: string): Promise<void> {
    try {
      // @afetnet: Send to remote endpoint (disabled by default for privacy)
      logger.debug(`📡 Would send ${events.length} events to remote endpoint`);
    } catch (error) {
      logger.error('Failed to send to remote:', error);
    }
  }

  private logToConsole(events: TelemetryEvent[]): void {
    for (const event of events) {
      logger.debug(`📊 Telemetry: ${event.type} - ${JSON.stringify(event.data)}`);
    }
  }

  private async sendToCustomSink(events: TelemetryEvent[], config: Record<string, any>): Promise<void> {
    // @afetnet: Custom sink implementation
    logger.debug('📡 Custom sink processing');
  }

  private async cleanupOldEvents(): Promise<void> {
    try {
      const cutoff = Date.now() - (this.config.retentionPeriod * 24 * 60 * 60 * 1000);

      // Remove old events from storage
      const storedEvents = await AsyncStorage.getItem('telemetry_events');
      if (storedEvents) {
        const events = JSON.parse(storedEvents);
        const filteredEvents = events.filter((event: TelemetryEvent) => event.timestamp > cutoff);

        await AsyncStorage.setItem('telemetry_events', JSON.stringify(filteredEvents));
        logger.debug(`🧹 Cleaned up ${events.length - filteredEvents.length} old telemetry events`);
      }

      // Check storage size
      if (this.storageSize > this.config.maxStorageSize * 1024 * 1024) {
        logger.warn('Telemetry storage size exceeded, reducing retention');
        this.config.retentionPeriod = Math.max(1, this.config.retentionPeriod - 1);
      }
    } catch (error) {
      logger.error('Failed to cleanup old events:', error);
    }
  }

  // Public API
  public addSink(sink: TelemetrySink): void {
    this.sinks.push(sink);
    logger.debug(`📡 Added telemetry sink: ${sink.name}`);
  }

  public removeSink(sinkName: string): void {
    const index = this.sinks.findIndex(s => s.name === sinkName);
    if (index !== -1) {
      this.sinks.splice(index, 1);
      logger.debug(`📡 Removed telemetry sink: ${sinkName}`);
    }
  }

  public getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.debug('Telemetry config updated');
  }

  public getEventCount(): number {
    return this.events.length;
  }

  public getStorageSize(): number {
    return this.storageSize;
  }

  public getSinks(): TelemetrySink[] {
    return [...this.sinks];
  }

  public async exportEvents(): Promise<TelemetryEvent[]> {
    try {
      const storedEvents = await AsyncStorage.getItem('telemetry_events');
      return storedEvents ? JSON.parse(storedEvents) : [];
    } catch (error) {
      logger.error('Failed to export events:', error);
      return [];
    }
  }

  public async clearEvents(): Promise<void> {
    try {
      await AsyncStorage.removeItem('telemetry_events');
      this.events = [];
      this.storageSize = 0;
      logger.debug('✅ Telemetry events cleared');
    } catch (error) {
      logger.error('Failed to clear events:', error);
    }
  }

  public async forceFlush(): Promise<void> {
    await this.flush();
  }

  public isActive(): boolean {
    return this.isActive;
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping advanced telemetry client...');

    this.isActive = false;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    if (this.events.length > 0) {
      await this.flush();
    }

    logger.debug('✅ Advanced telemetry client stopped');
  }
}

// @afetnet: Export singleton instance
export const advancedTelemetryClient = new AdvancedTelemetryClient();






