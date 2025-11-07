// @afetnet: Advanced Network Health Monitoring & Telemetry
// Real-time network performance metrics and diagnostics for disaster communication

import { logger } from '../../core/utils/logger';
import { EventEmitter } from 'events';
import { advancedMeshNetwork } from '../security/protocols/aiSelector';
import { networkPartitionDetector } from './partition';
import { advancedMultipathRouter } from '../messaging/multipath';
import { pfsService } from '../security/pfs';
import { advancedBatteryManager } from '../power/budget';

export interface NetworkHealthMetrics {
  timestamp: number;
  connectivity: number; // 0-100
  latency: number; // ms
  packetLoss: number; // 0-100
  throughput: number; // kbps
  nodeCount: number;
  activeConnections: number;
  messageQueueSize: number;
  partitionCount: number;
  batteryLevel: number; // 0-100
  signalStrength: number; // 0-100
  protocolInUse: string;
  emergencyMode: boolean;
  securityLevel: 'military' | 'high' | 'standard';
}

export interface NetworkHealthState {
  overallHealth: number; // 0-100
  stability: number; // 0-100
  reliability: number; // 0-100
  efficiency: number; // 0-100
  securityScore: number; // 0-100
  lastUpdate: number;
  recommendations: string[];
  warnings: string[];
  criticalIssues: string[];
}

export interface HealthEvent {
  type: 'connectivity' | 'latency' | 'packet_loss' | 'partition' | 'security' | 'emergency';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  metrics: Partial<NetworkHealthMetrics>;
  recommendation?: string;
}

export class NetworkHealthMonitor extends EventEmitter {
  private healthMetrics: NetworkHealthMetrics[] = [];
  private healthState: NetworkHealthState;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthEvents: HealthEvent[] = [];
  private isMonitoring = false;
  private alertThresholds: {
    connectivity: number;
    latency: number;
    packetLoss: number;
    battery: number;
  };

  constructor() {
    super();
    this.healthState = this.initializeHealthState();
    this.alertThresholds = {
      connectivity: 30, // Alert if connectivity < 30%
      latency: 5000, // Alert if latency > 5000ms
      packetLoss: 20, // Alert if packet loss > 20%
      battery: 20, // Alert if battery < 20%
    };
  }

  private initializeHealthState(): NetworkHealthState {
    return {
      overallHealth: 100,
      stability: 100,
      reliability: 100,
      efficiency: 100,
      securityScore: 100,
      lastUpdate: Date.now(),
      recommendations: [],
      warnings: [],
      criticalIssues: [],
    };
  }

  async initialize(): Promise<void> {
    logger.debug('💚 Initializing network health monitor...');

    this.isMonitoring = true;

    // Start periodic health monitoring
    this.monitoringInterval = setInterval(() => {
      this.updateHealthMetrics();
      this.analyzeHealthTrends();
      this.generateRecommendations();
      this.checkAlertConditions();
    }, 5000); // Every 5 seconds

    // Listen for partition events
    networkPartitionDetector.on('partition', (event) => {
      this.handlePartitionEvent(event);
    });

    logger.debug('✅ Network health monitor initialized');
  }

  private updateHealthMetrics(): void {
    try {
      const now = Date.now();

      // Get metrics from various systems
      const meshHealth = advancedMeshNetwork.getNetworkHealth();
      const partitionMetrics = networkPartitionDetector.getPartitionMetrics();
      const multipathStats = advancedMultipathRouter.getMultipathStats();
      const pfsStats = pfsService.getSessionStats();
      const batteryProfile = advancedBatteryManager.getCurrentProfile();

      const metrics: NetworkHealthMetrics = {
        timestamp: now,
        connectivity: meshHealth.connectivity,
        latency: meshHealth.latency,
        packetLoss: meshHealth.packetLoss,
        throughput: 1000, // Mock - would get from actual network stats
        nodeCount: partitionMetrics.totalPartitions,
        activeConnections: meshHealth.connectivity > 50 ? partitionMetrics.largestPartitionSize : 0,
        messageQueueSize: multipathStats.activeMessages,
        partitionCount: partitionMetrics.totalPartitions,
        batteryLevel: batteryProfile.level,
        signalStrength: 80, // Mock - would get from BLE signal strength
        protocolInUse: advancedMeshNetwork.getActiveProtocol(),
        emergencyMode: false, // Would get from emergency manager
        securityLevel: 'military', // Would get from security manager
      };

      // Add to history
      this.healthMetrics.push(metrics);

      // Keep only last 1000 metrics
      if (this.healthMetrics.length > 1000) {
        this.healthMetrics = this.healthMetrics.slice(-1000);
      }

      // Update health state
      this.updateHealthState(metrics);

      logger.debug(`💚 Health metrics updated: ${metrics.connectivity}% connectivity, ${metrics.latency}ms latency`);

    } catch (error) {
      logger.error('Failed to update health metrics:', error);
    }
  }

  private updateHealthState(metrics: NetworkHealthMetrics): void {
    // Calculate overall health score
    const connectivityScore = metrics.connectivity;
    const latencyScore = Math.max(0, 100 - (metrics.latency / 100)); // Lower latency = higher score
    const packetLossScore = Math.max(0, 100 - metrics.packetLoss);
    const batteryScore = metrics.batteryLevel;
    const partitionScore = Math.max(0, 100 - (metrics.partitionCount * 10));

    this.healthState.overallHealth = (
      connectivityScore * 0.3 +
      latencyScore * 0.2 +
      packetLossScore * 0.2 +
      batteryScore * 0.2 +
      partitionScore * 0.1
    );

    // Calculate stability (based on recent metrics variance)
    this.healthState.stability = this.calculateStabilityScore();

    // Calculate reliability
    this.healthState.reliability = this.calculateReliabilityScore(metrics);

    // Calculate efficiency
    this.healthState.efficiency = this.calculateEfficiencyScore(metrics);

    // Calculate security score
    this.healthState.securityScore = this.calculateSecurityScore(metrics);

    this.healthState.lastUpdate = Date.now();
  }

  private calculateStabilityScore(): number {
    if (this.healthMetrics.length < 10) return 100;

    const recentMetrics = this.healthMetrics.slice(-10);
    const connectivityValues = recentMetrics.map(m => m.connectivity);
    const latencyValues = recentMetrics.map(m => m.latency);

    const connectivityVariance = this.calculateVariance(connectivityValues);
    const latencyVariance = this.calculateVariance(latencyValues);

    // Lower variance = higher stability
    const connectivityStability = Math.max(0, 100 - (connectivityVariance * 2));
    const latencyStability = Math.max(0, 100 - (latencyVariance / 100));

    return (connectivityStability + latencyStability) / 2;
  }

  private calculateReliabilityScore(metrics: NetworkHealthMetrics): number {
    // Reliability based on packet loss and connectivity
    const packetLossScore = Math.max(0, 100 - metrics.packetLoss);
    const connectivityScore = metrics.connectivity;

    return (packetLossScore + connectivityScore) / 2;
  }

  private calculateEfficiencyScore(metrics: NetworkHealthMetrics): number {
    // Efficiency based on throughput and latency
    const throughputScore = Math.min(100, metrics.throughput / 10); // Normalize to 0-100
    const latencyScore = Math.max(0, 100 - (metrics.latency / 100));

    return (throughputScore + latencyScore) / 2;
  }

  private calculateSecurityScore(metrics: NetworkHealthMetrics): number {
    // Security score based on protocol and emergency mode
    let score = 100;

    if (metrics.securityLevel === 'military') score += 10;
    if (metrics.emergencyMode) score += 5; // Emergency mode may have reduced security

    return Math.min(100, score);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private analyzeHealthTrends(): void {
    if (this.healthMetrics.length < 20) return;

    const recentMetrics = this.healthMetrics.slice(-10);
    const olderMetrics = this.healthMetrics.slice(-20, -10);

    // Compare recent vs older performance
    const recentAvgConnectivity = recentMetrics.reduce((sum, m) => sum + m.connectivity, 0) / recentMetrics.length;
    const olderAvgConnectivity = olderMetrics.reduce((sum, m) => sum + m.connectivity, 0) / olderMetrics.length;

    const connectivityTrend = recentAvgConnectivity - olderAvgConnectivity;

    if (connectivityTrend < -20) {
      this.addWarning('Connectivity degrading rapidly');
    } else if (connectivityTrend > 10) {
      this.addInfo('Connectivity improving');
    }

    // Check for increasing latency
    const recentAvgLatency = recentMetrics.reduce((sum, m) => sum + m.latency, 0) / recentMetrics.length;
    const olderAvgLatency = olderMetrics.reduce((sum, m) => sum + m.latency, 0) / olderMetrics.length;

    const latencyTrend = recentAvgLatency - olderAvgLatency;

    if (latencyTrend > 1000) {
      this.addWarning('Network latency increasing');
    }
  }

  private generateRecommendations(): void {
    const recommendations: string[] = [];
    const currentMetrics = this.healthMetrics[this.healthMetrics.length - 1];

    if (currentMetrics) {
      if (currentMetrics.connectivity < 50) {
        recommendations.push('Consider switching to more reliable routing protocol');
      }

      if (currentMetrics.latency > 2000) {
        recommendations.push('High latency detected - optimize network paths');
      }

      if (currentMetrics.packetLoss > 15) {
        recommendations.push('High packet loss - check network interference');
      }

      if (currentMetrics.batteryLevel < 30) {
        recommendations.push('Low battery - consider power saving mode');
      }

      if (currentMetrics.partitionCount > 1) {
        recommendations.push('Network partitions detected - trigger recovery');
      }
    }

    this.healthState.recommendations = recommendations;
  }

  private checkAlertConditions(): void {
    const latestMetrics = this.healthMetrics[this.healthMetrics.length - 1];

    if (!latestMetrics) return;

    // Check connectivity alerts
    if (latestMetrics.connectivity < this.alertThresholds.connectivity) {
      this.emitHealthEvent({
        type: 'connectivity',
        severity: 'error',
        message: `Low connectivity: ${latestMetrics.connectivity}%`,
        timestamp: Date.now(),
        metrics: { connectivity: latestMetrics.connectivity },
        recommendation: 'Switch to AODV protocol for better reliability',
      });
    }

    // Check latency alerts
    if (latestMetrics.latency > this.alertThresholds.latency) {
      this.emitHealthEvent({
        type: 'latency',
        severity: 'warning',
        message: `High latency: ${latestMetrics.latency}ms`,
        timestamp: Date.now(),
        metrics: { latency: latestMetrics.latency },
        recommendation: 'Optimize routing paths or reduce hop count',
      });
    }

    // Check packet loss alerts
    if (latestMetrics.packetLoss > this.alertThresholds.packetLoss) {
      this.emitHealthEvent({
        type: 'packet_loss',
        severity: 'warning',
        message: `High packet loss: ${latestMetrics.packetLoss}%`,
        timestamp: Date.now(),
        metrics: { packetLoss: latestMetrics.packetLoss },
        recommendation: 'Check network interference or switch protocols',
      });
    }

    // Check battery alerts
    if (latestMetrics.batteryLevel < this.alertThresholds.battery) {
      this.emitHealthEvent({
        type: 'security', // Battery affects overall security/reliability
        severity: 'warning',
        message: `Low battery: ${latestMetrics.batteryLevel}%`,
        timestamp: Date.now(),
        metrics: { batteryLevel: latestMetrics.batteryLevel },
        recommendation: 'Enable power saving mode',
      });
    }
  }

  private handlePartitionEvent(event: any): void {
    this.emitHealthEvent({
      type: 'partition',
      severity: event.severity === 'critical' ? 'critical' : 'warning',
      message: `Network partition: ${event.description}`,
      timestamp: Date.now(),
      metrics: {},
      recommendation: 'Trigger partition recovery or switch to redundant routing',
    });
  }

  private emitHealthEvent(event: Omit<HealthEvent, 'id'>): void {
    const fullEvent: HealthEvent = {
      ...event,
      id: `health_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    this.healthEvents.push(fullEvent);
    this.emit('health', fullEvent);

    // Keep only last 500 events
    if (this.healthEvents.length > 500) {
      this.healthEvents = this.healthEvents.slice(-500);
    }

    logger.info(`💚 Health event: ${event.type} (${event.severity}) - ${event.message}`);
  }

  private addWarning(message: string): void {
    this.healthState.warnings.push(message);
    if (this.healthState.warnings.length > 10) {
      this.healthState.warnings = this.healthState.warnings.slice(-10);
    }
  }

  private addInfo(message: string): void {
    // Keep info messages separate from warnings
    logger.info(`💚 Health info: ${message}`);
  }

  // Public API
  public getCurrentMetrics(): NetworkHealthMetrics | null {
    return this.healthMetrics.length > 0 ? this.healthMetrics[this.healthMetrics.length - 1] : null;
  }

  public getHealthState(): NetworkHealthState {
    return { ...this.healthState };
  }

  public getHealthHistory(): NetworkHealthMetrics[] {
    return [...this.healthMetrics];
  }

  public getHealthEvents(): HealthEvent[] {
    return [...this.healthEvents];
  }

  public getHealthScore(): number {
    return this.healthState.overallHealth;
  }

  public getConnectivityStatus(): {
    level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    percentage: number;
    trend: 'improving' | 'stable' | 'degrading';
  } {
    const latest = this.getCurrentMetrics();
    if (!latest) {
      return { level: 'critical', percentage: 0, trend: 'stable' };
    }

    let level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' = 'critical';
    if (latest.connectivity > 90) level = 'excellent';
    else if (latest.connectivity > 70) level = 'good';
    else if (latest.connectivity > 50) level = 'fair';
    else if (latest.connectivity > 20) level = 'poor';

    // Calculate trend
    const trend = this.calculateTrend('connectivity');

    return {
      level,
      percentage: latest.connectivity,
      trend,
    };
  }

  public getLatencyStatus(): {
    level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    value: number;
    trend: 'improving' | 'stable' | 'degrading';
  } {
    const latest = this.getCurrentMetrics();
    if (!latest) {
      return { level: 'critical', value: 0, trend: 'stable' };
    }

    let level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' = 'critical';
    if (latest.latency < 100) level = 'excellent';
    else if (latest.latency < 500) level = 'good';
    else if (latest.latency < 1000) level = 'fair';
    else if (latest.latency < 5000) level = 'poor';

    const trend = this.calculateTrend('latency');

    return {
      level,
      value: latest.latency,
      trend,
    };
  }

  private calculateTrend(metric: keyof NetworkHealthMetrics): 'improving' | 'stable' | 'degrading' {
    if (this.healthMetrics.length < 10) return 'stable';

    const recent = this.healthMetrics.slice(-5);
    const older = this.healthMetrics.slice(-10, -5);

    const recentAvg = recent.reduce((sum, m) => sum + (m[metric] as number), 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + (m[metric] as number), 0) / older.length;

    const change = recentAvg - olderAvg;

    if (metric === 'latency') {
      // For latency, negative change is improving
      if (change < -100) return 'improving';
      if (change > 100) return 'degrading';
    } else {
      // For other metrics, positive change is improving
      if (change > 10) return 'improving';
      if (change < -10) return 'degrading';
    }

    return 'stable';
  }

  public getBatteryStatus(): {
    level: number;
    isCharging: boolean;
    timeRemaining: number; // minutes
    status: 'critical' | 'low' | 'normal' | 'high';
  } {
    const latest = this.getCurrentMetrics();
    if (!latest) {
      return { level: 0, isCharging: false, timeRemaining: 0, status: 'critical' };
    }

    let status: 'critical' | 'low' | 'normal' | 'high' = 'normal';
    if (latest.batteryLevel <= 10) status = 'critical';
    else if (latest.batteryLevel <= 25) status = 'low';
    else if (latest.batteryLevel >= 80) status = 'high';

    // Estimate time remaining (simplified)
    const timeRemaining = latest.batteryLevel * 2; // 2 minutes per percentage point

    return {
      level: latest.batteryLevel,
      isCharging: false, // Would get from battery manager
      timeRemaining,
      status,
    };
  }

  public getProtocolStatus(): {
    current: string;
    efficiency: number;
    reliability: number;
    recommendation?: string;
  } {
    const latest = this.getCurrentMetrics();
    if (!latest) {
      return { current: 'unknown', efficiency: 0, reliability: 0 };
    }

    const protocol = latest.protocolInUse;
    let efficiency = 50;
    let reliability = 50;
    let recommendation: string | undefined;

    // Protocol-specific metrics
    switch (protocol) {
      case 'aodv':
        efficiency = 70; // Good for reliability
        reliability = 90;
        break;
      case 'dsr':
        efficiency = 85; // Good for efficiency
        reliability = 75;
        break;
      case 'olsr':
        efficiency = 60; // Good for large networks
        reliability = 80;
        break;
    }

    // Generate recommendation based on current conditions
    if (latest.connectivity < 50 && protocol !== 'aodv') {
      recommendation = 'Consider switching to AODV for better reliability';
    } else if (latest.nodeCount > 20 && protocol !== 'olsr') {
      recommendation = 'Consider switching to OLSR for better scalability';
    }

    return {
      current: protocol,
      efficiency,
      reliability,
      recommendation,
    };
  }

  public getRecommendations(): string[] {
    return [...this.healthState.recommendations];
  }

  public getWarnings(): string[] {
    return [...this.healthState.warnings];
  }

  public getCriticalIssues(): string[] {
    return [...this.healthState.criticalIssues];
  }

  public exportHealthReport(): {
    summary: NetworkHealthState;
    metrics: NetworkHealthMetrics[];
    events: HealthEvent[];
    timestamp: number;
  } {
    return {
      summary: this.getHealthState(),
      metrics: this.getHealthHistory(),
      events: this.getHealthEvents(),
      timestamp: Date.now(),
    };
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping network health monitor...');

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.debug('✅ Network health monitor stopped');
  }
}

// @afetnet: Export singleton instance
export const networkHealthMonitor = new NetworkHealthMonitor();


























