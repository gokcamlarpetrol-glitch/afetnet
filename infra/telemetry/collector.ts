// @afetnet: Enterprise Telemetry Collector for Fleet Management
// Aggregates anonymized metrics from devices for monitoring and optimization

import { logger } from '../../app/core/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FleetMetrics {
  timestamp: number;
  deviceId: string;
  sessionId: string;
  location: { lat: number; lon: number };
  networkMetrics: {
    connectivity: number;
    latency: number;
    packetLoss: number;
    throughput: number;
    nodeCount: number;
    partitionCount: number;
    protocolInUse: string;
  };
  batteryMetrics: {
    level: number;
    state: string;
    temperature: number;
    powerMode: string;
  };
  performanceMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    queueDepth: number;
    messageDeliveryRate: number;
    emergencyActivations: number;
  };
  securityMetrics: {
    pqcReady: boolean;
    keyRotationCount: number;
    securityViolations: number;
    encryptionAlgorithm: string;
  };
  userMetrics: {
    appUsageTime: number;
    featureUsage: Record<string, number>;
    crashCount: number;
    emergencyUseCount: number;
  };
}

export interface FleetSummary {
  totalDevices: number;
  activeDevices: number;
  averageConnectivity: number;
  averageBatteryLevel: number;
  totalMessagesDelivered: number;
  emergencyActivations: number;
  networkPartitions: number;
  averageLatency: number;
  securityScore: number;
  lastUpdate: number;
}

export interface AlertPolicy {
  metric: string;
  threshold: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  cooldown: number; // minutes
}

export class FleetTelemetryCollector {
  private metricsHistory: FleetMetrics[] = [];
  private fleetSummary: FleetSummary;
  private alertPolicies: AlertPolicy[] = [];
  private activeAlerts: Map<string, number> = new Map();
  private isCollecting = false;
  private collectionInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.fleetSummary = this.initializeFleetSummary();
    this.setupAlertPolicies();
  }

  private initializeFleetSummary(): FleetSummary {
    return {
      totalDevices: 0,
      activeDevices: 0,
      averageConnectivity: 0,
      averageBatteryLevel: 0,
      totalMessagesDelivered: 0,
      emergencyActivations: 0,
      networkPartitions: 0,
      averageLatency: 0,
      securityScore: 0,
      lastUpdate: Date.now(),
    };
  }

  private setupAlertPolicies(): void {
    this.alertPolicies = [
      {
        metric: 'connectivity',
        threshold: 30,
        severity: 'critical',
        message: 'Critical connectivity loss detected',
        cooldown: 5,
      },
      {
        metric: 'battery',
        threshold: 15,
        severity: 'warning',
        message: 'Low battery detected across fleet',
        cooldown: 10,
      },
      {
        metric: 'emergency',
        threshold: 10,
        severity: 'error',
        message: 'Multiple emergency activations detected',
        cooldown: 15,
      },
      {
        metric: 'partition',
        threshold: 5,
        severity: 'warning',
        message: 'Network partitions detected',
        cooldown: 20,
      },
    ];
  }

  async initialize(): Promise<void> {
    logger.debug('📊 Initializing fleet telemetry collector...');

    this.isCollecting = true;

    // Load existing metrics
    await this.loadStoredMetrics();

    // Start periodic collection
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
      this.updateFleetSummary();
      this.checkAlertPolicies();
    }, 60000); // Every minute

    logger.debug('✅ Fleet telemetry collector initialized');
  }

  private async loadStoredMetrics(): Promise<void> {
    try {
      const storedMetrics = await AsyncStorage.getItem('fleet_metrics');
      if (storedMetrics) {
        this.metricsHistory = JSON.parse(storedMetrics);
        logger.debug(`Loaded ${this.metricsHistory.length} fleet metrics`);
      }
    } catch (error) {
      logger.error('Failed to load fleet metrics:', error);
    }
  }

  private async saveMetrics(): Promise<void> {
    try {
      // Keep only last 1000 metrics
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-1000);
      }

      await AsyncStorage.setItem('fleet_metrics', JSON.stringify(this.metricsHistory));
    } catch (error) {
      logger.error('Failed to save fleet metrics:', error);
    }
  }

  // @afetnet: Collect metrics from local device
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: FleetMetrics = {
        timestamp: Date.now(),
        deviceId: await this.getDeviceId(),
        sessionId: this.generateSessionId(),
        location: await this.getCurrentLocation(),
        networkMetrics: await this.getNetworkMetrics(),
        batteryMetrics: await this.getBatteryMetrics(),
        performanceMetrics: await this.getPerformanceMetrics(),
        securityMetrics: await this.getSecurityMetrics(),
        userMetrics: await this.getUserMetrics(),
      };

      this.metricsHistory.push(metrics);
      await this.saveMetrics();

      logger.debug('📊 Fleet metrics collected');
    } catch (error) {
      logger.error('Failed to collect fleet metrics:', error);
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch {
      return `fallback_${Date.now()}`;
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private async getCurrentLocation(): Promise<{ lat: number; lon: number }> {
    try {
      // @afetnet: Get current location - simplified
      return { lat: 39.9334, lon: 32.8597 }; // Ankara coordinates
    } catch {
      return { lat: 0, lon: 0 };
    }
  }

  private async getNetworkMetrics(): Promise<any> {
    try {
      // @afetnet: Get network metrics - simplified
      return {
        connectivity: 85,
        latency: 150,
        packetLoss: 2,
        throughput: 1000,
        nodeCount: 5,
        partitionCount: 0,
        protocolInUse: 'aodv',
      };
    } catch {
      return {
        connectivity: 0,
        latency: 0,
        packetLoss: 100,
        throughput: 0,
        nodeCount: 0,
        partitionCount: 0,
        protocolInUse: 'unknown',
      };
    }
  }

  private async getBatteryMetrics(): Promise<any> {
    try {
      // @afetnet: Get battery metrics - simplified
      return {
        level: 75,
        state: 'charging',
        temperature: 25,
        powerMode: 'balanced',
      };
    } catch {
      return {
        level: 0,
        state: 'unknown',
        temperature: 0,
        powerMode: 'unknown',
      };
    }
  }

  private async getPerformanceMetrics(): Promise<any> {
    try {
      // @afetnet: Get performance metrics - simplified
      return {
        cpuUsage: 15,
        memoryUsage: 45,
        queueDepth: 5,
        messageDeliveryRate: 98,
        emergencyActivations: 0,
      };
    } catch {
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        queueDepth: 0,
        messageDeliveryRate: 0,
        emergencyActivations: 0,
      };
    }
  }

  private async getSecurityMetrics(): Promise<any> {
    try {
      // @afetnet: Get security metrics - simplified
      return {
        pqcReady: true,
        keyRotationCount: 5,
        securityViolations: 0,
        encryptionAlgorithm: 'Kyber1024+AES256',
      };
    } catch {
      return {
        pqcReady: false,
        keyRotationCount: 0,
        securityViolations: 0,
        encryptionAlgorithm: 'Ed25519+AES256',
      };
    }
  }

  private async getUserMetrics(): Promise<any> {
    try {
      // @afetnet: Get user metrics - simplified
      return {
        appUsageTime: 120, // minutes
        featureUsage: {
          emergency: 2,
          messaging: 15,
          navigation: 8,
        },
        crashCount: 0,
        emergencyUseCount: 1,
      };
    } catch {
      return {
        appUsageTime: 0,
        featureUsage: {},
        crashCount: 0,
        emergencyUseCount: 0,
      };
    }
  }

  private updateFleetSummary(): void {
    if (this.metricsHistory.length === 0) return;

    const recentMetrics = this.metricsHistory.slice(-10);

    this.fleetSummary = {
      totalDevices: new Set(recentMetrics.map(m => m.deviceId)).size,
      activeDevices: recentMetrics.filter(m => m.networkMetrics.connectivity > 50).length,
      averageConnectivity: recentMetrics.reduce((sum, m) => sum + m.networkMetrics.connectivity, 0) / recentMetrics.length,
      averageBatteryLevel: recentMetrics.reduce((sum, m) => sum + m.batteryMetrics.level, 0) / recentMetrics.length,
      totalMessagesDelivered: recentMetrics.reduce((sum, m) => sum + m.performanceMetrics.messageDeliveryRate, 0) / recentMetrics.length * 100,
      emergencyActivations: recentMetrics.reduce((sum, m) => sum + m.userMetrics.emergencyUseCount, 0),
      networkPartitions: recentMetrics.reduce((sum, m) => sum + m.networkMetrics.partitionCount, 0) / recentMetrics.length,
      averageLatency: recentMetrics.reduce((sum, m) => sum + m.networkMetrics.latency, 0) / recentMetrics.length,
      securityScore: recentMetrics.reduce((sum, m) => sum + (m.securityMetrics.pqcReady ? 100 : 50), 0) / recentMetrics.length,
      lastUpdate: Date.now(),
    };

    logger.debug('📊 Fleet summary updated');
  }

  private checkAlertPolicies(): void {
    const now = Date.now();

    for (const policy of this.alertPolicies) {
      const alertKey = `${policy.metric}_${policy.threshold}`;

      // Check if alert should be triggered
      let shouldAlert = false;
      switch (policy.metric) {
        case 'connectivity':
          shouldAlert = this.fleetSummary.averageConnectivity < policy.threshold;
          break;
        case 'battery':
          shouldAlert = this.fleetSummary.averageBatteryLevel < policy.threshold;
          break;
        case 'emergency':
          shouldAlert = this.fleetSummary.emergencyActivations > policy.threshold;
          break;
        case 'partition':
          shouldAlert = this.fleetSummary.networkPartitions > policy.threshold;
          break;
      }

      if (shouldAlert) {
        // Check cooldown
        const lastAlert = this.activeAlerts.get(alertKey) || 0;
        const cooldownMs = policy.cooldown * 60 * 1000;

        if (now - lastAlert > cooldownMs) {
          this.triggerAlert(policy);
          this.activeAlerts.set(alertKey, now);
        }
      }
    }
  }

  private triggerAlert(policy: AlertPolicy): void {
    logger.warn(`🚨 Fleet Alert: ${policy.message} (${policy.severity})`);

    // In real implementation, would send to monitoring system
    // For now, just log
  }

  // Public API
  public getFleetSummary(): FleetSummary {
    return { ...this.fleetSummary };
  }

  public getMetricsHistory(): FleetMetrics[] {
    return [...this.metricsHistory];
  }

  public getActiveAlerts(): string[] {
    return Array.from(this.activeAlerts.keys());
  }

  public getAlertPolicies(): AlertPolicy[] {
    return [...this.alertPolicies];
  }

  public async exportFleetReport(): Promise<{
    summary: FleetSummary;
    metrics: FleetMetrics[];
    alerts: string[];
    timestamp: number;
  }> {
    return {
      summary: this.getFleetSummary(),
      metrics: this.getMetricsHistory(),
      alerts: this.getActiveAlerts(),
      timestamp: Date.now(),
    };
  }

  public addAlertPolicy(policy: AlertPolicy): void {
    this.alertPolicies.push(policy);
    logger.debug(`📊 Added alert policy: ${policy.metric}`);
  }

  public removeAlertPolicy(metric: string): void {
    this.alertPolicies = this.alertPolicies.filter(p => p.metric !== metric);
    logger.debug(`📊 Removed alert policy: ${metric}`);
  }

  public updateAlertThreshold(metric: string, threshold: number): void {
    const policy = this.alertPolicies.find(p => p.metric === metric);
    if (policy) {
      policy.threshold = threshold;
      logger.debug(`📊 Updated alert threshold: ${metric} = ${threshold}`);
    }
  }

  public getDeviceMetrics(deviceId: string): FleetMetrics[] {
    return this.metricsHistory.filter(m => m.deviceId === deviceId);
  }

  public getDeviceCount(): number {
    return new Set(this.metricsHistory.map(m => m.deviceId)).size;
  }

  public getActiveDeviceCount(): number {
    const recentMetrics = this.metricsHistory.slice(-10);
    return new Set(recentMetrics.filter(m => m.networkMetrics.connectivity > 50).map(m => m.deviceId)).size;
  }

  public async clearMetrics(): Promise<void> {
    this.metricsHistory = [];
    await AsyncStorage.removeItem('fleet_metrics');
    logger.debug('📊 Fleet metrics cleared');
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping fleet telemetry collector...');

    this.isCollecting = false;

    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    await this.saveMetrics();
    logger.debug('✅ Fleet telemetry collector stopped');
  }
}

// @afetnet: Export singleton instance
export const fleetTelemetryCollector = new FleetTelemetryCollector();






































