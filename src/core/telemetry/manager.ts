import { PreferencesManager } from '../storage/prefs';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

export interface TelemetryConfig {
  enabled: boolean;
  endpoint?: string;
  batchSize?: number;
  flushInterval?: number;
}

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  type: string;
  data: Record<string, any>;
  sessionId: string;
  deviceId: string;
}

export interface TelemetryBatch {
  events: TelemetryEvent[];
  timestamp: number;
  deviceInfo: DeviceInfo;
}

export interface DeviceInfo {
  deviceId: string;
  platform: string;
  version: string;
  buildNumber: string;
  model: string;
  brand?: string;
  appVersion: string;
}

export class TelemetryManager {
  private static instance: TelemetryManager;
  private prefs = PreferencesManager.getInstance();
  private config: TelemetryConfig = {
    enabled: false,
    endpoint: 'https://telemetry.afetnet.org/api/events',
    batchSize: 50,
    flushInterval: 30000, // 30 seconds
  };
  private eventQueue: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionId: string = '';
  private deviceId: string = '';
  private deviceInfo: DeviceInfo | null = null;

  static getInstance(): TelemetryManager {
    if (!TelemetryManager.instance) {
      TelemetryManager.instance = new TelemetryManager();
    }
    return TelemetryManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      await this.initializeDeviceInfo();
      
      if (this.config.enabled) {
        this.startFlushTimer();
      }
      
      console.log('TelemetryManager initialized:', {
        enabled: this.config.enabled,
        deviceId: this.deviceId,
        sessionId: this.sessionId,
      });
    } catch (error) {
      console.error('Failed to initialize TelemetryManager:', error);
    }
  }

  async setConfig(config: Partial<TelemetryConfig>): Promise<void> {
    const wasEnabled = this.config.enabled;
    
    this.config = { ...this.config, ...config };
    
    try {
      await this.prefs.set('telemetryConfig', JSON.stringify(this.config));
      
      if (this.config.enabled && !wasEnabled) {
        this.startFlushTimer();
      } else if (!this.config.enabled && wasEnabled) {
        this.stopFlushTimer();
        await this.flush(); // Flush remaining events
      }
      
      console.log('Telemetry config updated:', this.config);
    } catch (error) {
      console.error('Failed to save telemetry config:', error);
    }
  }

  getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  async trackEvent(type: string, data: Record<string, any> = {}): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const event: TelemetryEvent = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type,
        data: this.sanitizeData(data),
        sessionId: this.sessionId,
        deviceId: this.deviceId,
      };

      this.eventQueue.push(event);
      console.log('Telemetry event tracked:', type, data);

      // Flush if batch size reached
      if (this.eventQueue.length >= (this.config.batchSize || 50)) {
        await this.flush();
      }
    } catch (error) {
      console.error('Failed to track telemetry event:', error);
    }
  }

  async sendTestPing(): Promise<void> {
    try {
      await this.trackEvent('test_ping', {
        message: 'Test ping from ActivationWizard',
        timestamp: Date.now(),
      });
      
      // Force flush for test ping
      await this.flush();
      
      console.log('Test ping sent successfully');
    } catch (error) {
      console.error('Failed to send test ping:', error);
      throw error;
    }
  }

  async trackAppLaunch(): Promise<void> {
    await this.trackEvent('app_launch', {
      launchTime: Date.now(),
      platform: Device.osName,
      version: Device.osVersion,
    });
  }

  async trackHelpRequestSent(helpRequest: any): Promise<void> {
    await this.trackEvent('help_request_sent', {
      hasLocation: !!helpRequest.location,
      priority: helpRequest.priority,
      peopleCount: helpRequest.peopleCount,
      // Don't include sensitive data
    });
  }

  async trackResourceShared(resource: any): Promise<void> {
    await this.trackEvent('resource_shared', {
      resourceType: resource.type,
      hasLocation: !!resource.location,
      // Don't include sensitive data
    });
  }

  async trackEEWAlert(alertType: 'local' | 'cluster' | 'official', data: any): Promise<void> {
    await this.trackEvent('eew_alert', {
      alertType,
      magnitude: data.magnitude,
      etaSeconds: data.etaSeconds,
      confidence: data.confidence,
      // Don't include location data
    });
  }

  async trackP2PMessageSent(messageType: string): Promise<void> {
    await this.trackEvent('p2p_message_sent', {
      messageType,
      timestamp: Date.now(),
    });
  }

  async trackP2PMessageReceived(messageType: string): Promise<void> {
    await this.trackEvent('p2p_message_received', {
      messageType,
      timestamp: Date.now(),
    });
  }

  async trackError(error: string, context: string): Promise<void> {
    await this.trackEvent('error', {
      error: error.substring(0, 100), // Limit error message length
      context,
      timestamp: Date.now(),
    });
  }

  async trackFeatureUsage(feature: string, action: string): Promise<void> {
    await this.trackEvent('feature_usage', {
      feature,
      action,
      timestamp: Date.now(),
    });
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    try {
      const batch: TelemetryBatch = {
        events: [...this.eventQueue],
        timestamp: Date.now(),
        deviceInfo: this.deviceInfo!,
      };

      console.log('Flushing telemetry batch:', batch.events.length, 'events');

      const response = await fetch(this.config.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0.0',
        },
        body: JSON.stringify(batch),
      });

      if (response.ok) {
        this.eventQueue = [];
        console.log('Telemetry batch sent successfully');
      } else {
        console.error('Failed to send telemetry batch:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to flush telemetry:', error);
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const configJson = await this.prefs.get('telemetryConfig');
      if (configJson) {
        this.config = { ...this.config, ...JSON.parse(configJson) };
      }
    } catch (error) {
      console.error('Failed to load telemetry config:', error);
    }
  }

  private async initializeDeviceInfo(): Promise<void> {
    try {
      // Get or generate device ID
      let deviceId = await this.prefs.get('deviceId');
      if (!deviceId) {
        deviceId = this.generateDeviceId();
        await this.prefs.set('deviceId', deviceId);
      }
      this.deviceId = deviceId;

      // Generate session ID
      this.sessionId = this.generateSessionId();

      // Get device info
      this.deviceInfo = {
        deviceId: this.deviceId,
        platform: Device.osName || 'unknown',
        version: Device.osVersion || 'unknown',
        buildNumber: Application.nativeBuildVersion || 'unknown',
        model: Device.modelName || 'unknown',
        brand: Device.brand || undefined,
        appVersion: Application.nativeApplicationVersion || '1.0.0',
      };

      console.log('Device info initialized:', this.deviceInfo);
    } catch (error) {
      console.error('Failed to initialize device info:', error);
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval || 30000);

    console.log('Telemetry flush timer started');
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
      console.log('Telemetry flush timer stopped');
    }
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeData(data: Record<string, any>): Record<string, any> {
    // Remove sensitive data
    const sanitized = { ...data };
    
    // Remove location data
    delete sanitized.latitude;
    delete sanitized.longitude;
    delete sanitized.location;
    delete sanitized.coords;
    
    // Remove personal data
    delete sanitized.name;
    delete sanitized.email;
    delete sanitized.phone;
    delete sanitized.contact;
    
    // Remove notes that might contain personal info
    if (sanitized.note && typeof sanitized.note === 'string') {
      sanitized.note = sanitized.note.length > 0 ? '[REDACTED]' : '';
    }
    
    return sanitized;
  }

  async getTelemetryStatus(): Promise<{
    enabled: boolean;
    queueSize: number;
    sessionId: string;
    deviceId: string;
    lastFlush?: number;
  }> {
    return {
      enabled: this.config.enabled,
      queueSize: this.eventQueue.length,
      sessionId: this.sessionId,
      deviceId: this.deviceId,
    };
  }

  async clearTelemetryData(): Promise<void> {
    try {
      this.eventQueue = [];
      await this.prefs.remove('deviceId');
      await this.prefs.remove('telemetryConfig');
      
      // Reinitialize
      await this.initializeDeviceInfo();
      
      console.log('Telemetry data cleared');
    } catch (error) {
      console.error('Failed to clear telemetry data:', error);
      throw error;
    }
  }
}
