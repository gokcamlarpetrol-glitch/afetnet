import { PreferencesManager } from '../storage/prefs';

export interface TelemetryData {
  timestamp: number;
  eventType: string;
  eventData: Record<string, any>;
  sessionId: string;
  deviceId: string;
}

export interface TelemetryStats {
  helpRequestsCreated: number;
  resourcePostsCreated: number;
  damageReportsCreated: number;
  p2pMessagesSent: number;
  p2pMessagesReceived: number;
  smsSent: number;
  shakeDetections: number;
  appLaunches: number;
  lastReported: number;
}

export class MinimalTelemetry {
  private static instance: MinimalTelemetry;
  private preferencesManager: PreferencesManager;
  private stats: TelemetryStats;
  private sessionId: string;
  private deviceId: string;
  private isEnabled: boolean = false;

  private constructor() {
    this.preferencesManager = PreferencesManager.getInstance();
    this.sessionId = this.generateSessionId();
    this.deviceId = this.generateDeviceId();
    this.stats = {
      helpRequestsCreated: 0,
      resourcePostsCreated: 0,
      damageReportsCreated: 0,
      p2pMessagesSent: 0,
      p2pMessagesReceived: 0,
      smsSent: 0,
      shakeDetections: 0,
      appLaunches: 0,
      lastReported: 0,
    };
  }

  static getInstance(): MinimalTelemetry {
    if (!MinimalTelemetry.instance) {
      MinimalTelemetry.instance = new MinimalTelemetry();
    }
    return MinimalTelemetry.instance;
  }

  async initialize(): Promise<void> {
    try {
      await this.preferencesManager.initialize();
      this.isEnabled = this.preferencesManager.isTelemetryEnabled();
      
      if (this.isEnabled) {
        this.stats.appLaunches++;
      }

      console.log(`MinimalTelemetry initialized (enabled: ${this.isEnabled})`);
    } catch (error) {
      console.error('Failed to initialize MinimalTelemetry:', error);
    }
  }

  trackEvent(eventType: string, eventData: Record<string, any> = {}): void {
    if (!this.isEnabled) {
      return;
    }

    try {
      // Update stats based on event type
      switch (eventType) {
        case 'help_request_created':
          this.stats.helpRequestsCreated++;
          break;
        case 'resource_post_created':
          this.stats.resourcePostsCreated++;
          break;
        case 'damage_report_created':
          this.stats.damageReportsCreated++;
          break;
        case 'p2p_message_sent':
          this.stats.p2pMessagesSent++;
          break;
        case 'p2p_message_received':
          this.stats.p2pMessagesReceived++;
          break;
        case 'sms_sent':
          this.stats.smsSent++;
          break;
        case 'shake_detected':
          this.stats.shakeDetections++;
          break;
      }

      console.log(`Telemetry event: ${eventType}`, eventData);
    } catch (error) {
      console.error('Failed to track telemetry event:', error);
    }
  }

  async sendTelemetryReport(): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const telemetryData: TelemetryData = {
        timestamp: Date.now(),
        eventType: 'stats_report',
        eventData: {
          stats: this.stats,
          sessionId: this.sessionId,
          deviceId: this.deviceId,
        },
        sessionId: this.sessionId,
        deviceId: this.deviceId,
      };

      // In a real implementation, this would send to a telemetry endpoint
      console.log('Telemetry report:', JSON.stringify(telemetryData, null, 2));
      
      this.stats.lastReported = Date.now();
      return true;
    } catch (error) {
      console.error('Failed to send telemetry report:', error);
      return false;
    }
  }

  getStats(): TelemetryStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      helpRequestsCreated: 0,
      resourcePostsCreated: 0,
      damageReportsCreated: 0,
      p2pMessagesSent: 0,
      p2pMessagesReceived: 0,
      smsSent: 0,
      shakeDetections: 0,
      appLaunches: this.stats.appLaunches, // Keep app launches
      lastReported: this.stats.lastReported,
    };
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.preferencesManager.setTelemetryEnabled(enabled);
  }

  isTelemetryEnabled(): boolean {
    return this.isEnabled;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeviceId(): string {
    // In a real implementation, this would be a persistent device identifier
    return `device_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Privacy-focused methods
  async generatePrivacyReport(): Promise<{
    dataCollected: boolean;
    dataTypes: string[];
    retentionPeriod: string;
    optOutAvailable: boolean;
  }> {
    return {
      dataCollected: this.isEnabled,
      dataTypes: [
        'Usage statistics (counts only)',
        'Feature usage patterns',
        'Performance metrics',
        'Error rates',
      ],
      retentionPeriod: '30 days',
      optOutAvailable: true,
    };
  }

  async exportTelemetryData(): Promise<string> {
    return JSON.stringify({
      stats: this.stats,
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      isEnabled: this.isEnabled,
      exportedAt: Date.now(),
    }, null, 2);
  }

  async clearAllTelemetryData(): Promise<void> {
    this.resetStats();
    this.sessionId = this.generateSessionId();
    this.deviceId = this.generateDeviceId();
    this.setEnabled(false);
    
    console.log('All telemetry data cleared');
  }

  // Utility methods for common tracking scenarios
  trackHelpRequestCreated(): void {
    this.trackEvent('help_request_created');
  }

  trackResourcePostCreated(): void {
    this.trackEvent('resource_post_created');
  }

  trackDamageReportCreated(): void {
    this.trackEvent('damage_report_created');
  }

  trackP2PMessageSent(): void {
    this.trackEvent('p2p_message_sent');
  }

  trackP2PMessageReceived(): void {
    this.trackEvent('p2p_message_received');
  }

  trackSMSSent(): void {
    this.trackEvent('sms_sent');
  }

  trackShakeDetected(): void {
    this.trackEvent('shake_detected');
  }

  trackFeatureUsage(feature: string, context?: string): void {
    this.trackEvent('feature_usage', {
      feature,
      context: context || 'unknown',
    });
  }

  trackError(error: string, context?: string): void {
    this.trackEvent('error_occurred', {
      error,
      context: context || 'unknown',
    });
  }
}
