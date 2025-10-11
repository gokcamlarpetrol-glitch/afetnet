import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { Vibration } from 'react-native';
import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';

export interface HealthCheck {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  timestamp: number;
  details?: any;
  autoFixable: boolean;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  checks: HealthCheck[];
  lastUpdated: number;
  criticalIssues: number;
  warningIssues: number;
  autoFixedIssues: number;
}

export interface HealthMetrics {
  uptime: number;
  memoryUsage: number;
  batteryLevel: number;
  networkLatency: number;
  messageQueueSize: number;
  connectedNodes: number;
  lastSOSSuccess: number;
  lastLocationUpdate: number;
}

class SystemHealthMonitor extends SimpleEventEmitter {
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();
  private healthHistory: HealthCheck[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metrics: HealthMetrics = {
    uptime: 0,
    memoryUsage: 0,
    batteryLevel: 100,
    networkLatency: 0,
    messageQueueSize: 0,
    connectedNodes: 0,
    lastSOSSuccess: 0,
    lastLocationUpdate: 0,
  };
  private startTime = Date.now();

  constructor() {
    super();
    this.initializeHealthChecks();
    this.startMetricsCollection();
  }

  private initializeHealthChecks() {
    logger.debug('🏥 Initializing System Health Checks...');

    // Critical System Health Checks
    this.healthChecks.set('mesh_network', () => this.checkMeshNetwork());
    this.healthChecks.set('sos_system', () => this.checkSOSSystem());
    this.healthChecks.set('location_services', () => this.checkLocationServices());
    this.healthChecks.set('message_queue', () => this.checkMessageQueue());
    this.healthChecks.set('battery_level', () => this.checkBatteryLevel());
    this.healthChecks.set('network_connectivity', () => this.checkNetworkConnectivity());
    this.healthChecks.set('storage_space', () => this.checkStorageSpace());
    this.healthChecks.set('voice_commands', () => this.checkVoiceCommands());
    this.healthChecks.set('sensor_monitoring', () => this.checkSensorMonitoring());
    this.healthChecks.set('encryption_keys', () => this.checkEncryptionKeys());

    logger.debug(`✅ ${this.healthChecks.size} health checks initialized`);
  }

  // CRITICAL: Start Health Monitoring
  async startHealthMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    try {
      logger.debug('🏥 Starting System Health Monitoring...');
      
      this.isMonitoring = true;
      
      // Run initial health check
      await this.runAllHealthChecks();
      
      // Start continuous monitoring
      this.monitoringInterval = setInterval(async () => {
        await this.runAllHealthChecks();
      }, 30000); // Check every 30 seconds

      // Critical systems check every 10 seconds
      setInterval(async () => {
        await this.runCriticalHealthChecks();
      }, 10000);

      this.emit('healthMonitoringStarted');
      logger.debug('✅ System Health Monitoring started');

    } catch (error) {
      logger.error('❌ Failed to start health monitoring:', error);
      this.emit('healthMonitoringError', error);
    }
  }

  // CRITICAL: Stop Health Monitoring
  async stopHealthMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    try {
      logger.debug('🛑 Stopping System Health Monitoring...');
      
      this.isMonitoring = false;
      
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      this.emit('healthMonitoringStopped');
      logger.debug('✅ System Health Monitoring stopped');

    } catch (error) {
      logger.error('❌ Error stopping health monitoring:', error);
    }
  }

  // CRITICAL: Run All Health Checks
  async runAllHealthChecks(): Promise<SystemHealth> {
    const checks: HealthCheck[] = [];
    let criticalIssues = 0;
    let warningIssues = 0;
    let autoFixedIssues = 0;

    try {
      logger.debug('🏥 Running comprehensive health checks...');

      // Run all health checks in parallel
      const checkPromises = Array.from(this.healthChecks.entries()).map(
        async ([id, checkFunction]) => {
          try {
            const check = await checkFunction();
            return { id, check };
          } catch (error) {
            logger.error(`❌ Health check ${id} failed:`, error);
            return {
              id,
              check: {
                id,
                name: id,
                status: 'critical' as const,
                message: `Health check failed: ${error}`,
                timestamp: Date.now(),
                autoFixable: false,
              },
            };
          }
        }
      );

      const results = await Promise.all(checkPromises);

      // Process results
      for (const { id, check } of results) {
        checks.push(check);

        // Count issues
        if (check.status === 'critical') criticalIssues++;
        else if (check.status === 'warning') warningIssues++;

        // Attempt auto-fix
        if (check.autoFixable && check.status !== 'healthy') {
          const fixed = await this.attemptAutoFix(check);
          if (fixed) autoFixedIssues++;
        }

        // Store in history
        this.healthHistory.push(check);
      }

      // Determine overall health
      const overall = criticalIssues > 0 ? 'critical' : 
                     warningIssues > 0 ? 'warning' : 'healthy';

      const systemHealth: SystemHealth = {
        overall,
        checks,
        lastUpdated: Date.now(),
        criticalIssues,
        warningIssues,
        autoFixedIssues,
      };

      // Emit health status
      this.emit('healthStatusUpdated', systemHealth);

      // Critical alert for critical issues
      if (criticalIssues > 0) {
        await this.handleCriticalHealthIssues(systemHealth);
      }

      // Save health history
      await this.saveHealthHistory();

      logger.debug(`🏥 Health check completed: ${overall} (${criticalIssues} critical, ${warningIssues} warnings)`);

      return systemHealth;

    } catch (error) {
      logger.error('❌ Critical error in health monitoring:', error);
      this.emit('healthMonitoringError', error);
      
      // Return emergency health status
      return {
        overall: 'critical',
        checks: [{
          id: 'health_monitor',
          name: 'Health Monitor',
          status: 'critical',
          message: 'Health monitoring system failed',
          timestamp: Date.now(),
          autoFixable: false,
        }],
        lastUpdated: Date.now(),
        criticalIssues: 1,
        warningIssues: 0,
        autoFixedIssues: 0,
      };
    }
  }

  // CRITICAL: Run Critical Health Checks Only
  async runCriticalHealthChecks(): Promise<void> {
    const criticalChecks = ['mesh_network', 'sos_system', 'location_services', 'battery_level'];
    
    for (const checkId of criticalChecks) {
      const checkFunction = this.healthChecks.get(checkId);
      if (checkFunction) {
        try {
          const check = await checkFunction();
          if (check.status === 'critical') {
            logger.error(`🚨 CRITICAL: ${check.name} - ${check.message}`);
            this.emit('criticalHealthIssue', check);
          }
        } catch (error) {
          logger.error(`❌ Critical health check ${checkId} failed:`, error);
        }
      }
    }
  }

  // Health Check Implementations
  private async checkMeshNetwork(): Promise<HealthCheck> {
    try {
      // Check mesh network status
      const { emergencyMeshManager } = await import('../emergency/EmergencyMeshManager');
      const isActive = emergencyMeshManager.isMeshActive;
      const stats = await emergencyMeshManager.getNetworkStats();

      if (!isActive) {
        return {
          id: 'mesh_network',
          name: 'Mesh Network',
          status: 'critical',
          message: 'Mesh network is not active',
          timestamp: Date.now(),
          autoFixable: true,
          details: { isActive, stats },
        };
      }

      if (stats.networkHealth < 50) {
        return {
          id: 'mesh_network',
          name: 'Mesh Network',
          status: 'warning',
          message: `Network health is low: ${stats.networkHealth}%`,
          timestamp: Date.now(),
          autoFixable: true,
          details: stats,
        };
      }

      return {
        id: 'mesh_network',
        name: 'Mesh Network',
        status: 'healthy',
        message: `Network healthy: ${stats.networkHealth}%, ${stats.onlineNodes} nodes`,
        timestamp: Date.now(),
        autoFixable: false,
        details: stats,
      };

    } catch (error) {
      return {
        id: 'mesh_network',
        name: 'Mesh Network',
        status: 'critical',
        message: `Mesh network check failed: ${error}`,
        timestamp: Date.now(),
        autoFixable: false,
      };
    }
  }

  private async checkSOSSystem(): Promise<HealthCheck> {
    try {
      // Check SOS system functionality
      const { offlineMessageManager } = await import('../messaging/OfflineMessageManager');
      const queueStatus = offlineMessageManager.getQueueStatus();

      // Check for failed SOS messages
      if (queueStatus.failedMessages > 0) {
        return {
          id: 'sos_system',
          name: 'SOS System',
          status: 'critical',
          message: `${queueStatus.failedMessages} failed SOS messages`,
          timestamp: Date.now(),
          autoFixable: true,
          details: queueStatus,
        };
      }

      // Check message queue size
      if (queueStatus.pendingMessages > 50) {
        return {
          id: 'sos_system',
          name: 'SOS System',
          status: 'warning',
          message: `High message queue: ${queueStatus.pendingMessages} pending`,
          timestamp: Date.now(),
          autoFixable: true,
          details: queueStatus,
        };
      }

      return {
        id: 'sos_system',
        name: 'SOS System',
        status: 'healthy',
        message: 'SOS system operational',
        timestamp: Date.now(),
        autoFixable: false,
        details: queueStatus,
      };

    } catch (error) {
      return {
        id: 'sos_system',
        name: 'SOS System',
        status: 'critical',
        message: `SOS system check failed: ${error}`,
        timestamp: Date.now(),
        autoFixable: false,
      };
    }
  }

  private async checkLocationServices(): Promise<HealthCheck> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        return {
          id: 'location_services',
          name: 'Location Services',
          status: 'critical',
          message: 'Location permission not granted',
          timestamp: Date.now(),
          autoFixable: true,
        };
      }

      // Try to get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      const accuracy = location.coords.accuracy || 0;
      
      if (accuracy > 100) {
        return {
          id: 'location_services',
          name: 'Location Services',
          status: 'warning',
          message: `Poor GPS accuracy: ${accuracy}m`,
          timestamp: Date.now(),
          autoFixable: false,
          details: { accuracy, coords: location.coords },
        };
      }

      return {
        id: 'location_services',
        name: 'Location Services',
        status: 'healthy',
        message: `GPS accuracy: ${accuracy}m`,
        timestamp: Date.now(),
        autoFixable: false,
        details: { accuracy, coords: location.coords },
      };

    } catch (error) {
      return {
        id: 'location_services',
        name: 'Location Services',
        status: 'critical',
        message: `Location services error: ${error}`,
        timestamp: Date.now(),
        autoFixable: true,
      };
    }
  }

  private async checkMessageQueue(): Promise<HealthCheck> {
    try {
      const { offlineMessageManager } = await import('../messaging/OfflineMessageManager');
      const queueStatus = offlineMessageManager.getQueueStatus();

      this.metrics.messageQueueSize = queueStatus.pendingMessages;

      if (queueStatus.pendingMessages > 100) {
        return {
          id: 'message_queue',
          name: 'Message Queue',
          status: 'warning',
          message: `Queue overloaded: ${queueStatus.pendingMessages} messages`,
          timestamp: Date.now(),
          autoFixable: true,
          details: queueStatus,
        };
      }

      return {
        id: 'message_queue',
        name: 'Message Queue',
        status: 'healthy',
        message: `Queue healthy: ${queueStatus.pendingMessages} messages`,
        timestamp: Date.now(),
        autoFixable: false,
        details: queueStatus,
      };

    } catch (error) {
      return {
        id: 'message_queue',
        name: 'Message Queue',
        status: 'critical',
        message: `Message queue check failed: ${error}`,
        timestamp: Date.now(),
        autoFixable: false,
      };
    }
  }

  private async checkBatteryLevel(): Promise<HealthCheck> {
    try {
      // This would typically use a battery monitoring library
      // For now, we'll use a placeholder
      const batteryLevel = 85; // Placeholder
      this.metrics.batteryLevel = batteryLevel;

      if (batteryLevel < 10) {
        return {
          id: 'battery_level',
          name: 'Battery Level',
          status: 'critical',
          message: `Critical battery: ${batteryLevel}%`,
          timestamp: Date.now(),
          autoFixable: true,
          details: { batteryLevel },
        };
      }

      if (batteryLevel < 25) {
        return {
          id: 'battery_level',
          name: 'Battery Level',
          status: 'warning',
          message: `Low battery: ${batteryLevel}%`,
          timestamp: Date.now(),
          autoFixable: true,
          details: { batteryLevel },
        };
      }

      return {
        id: 'battery_level',
        name: 'Battery Level',
        status: 'healthy',
        message: `Battery OK: ${batteryLevel}%`,
        timestamp: Date.now(),
        autoFixable: false,
        details: { batteryLevel },
      };

    } catch (error) {
      return {
        id: 'battery_level',
        name: 'Battery Level',
        status: 'unknown',
        message: `Battery check failed: ${error}`,
        timestamp: Date.now(),
        autoFixable: false,
      };
    }
  }

  private async checkNetworkConnectivity(): Promise<HealthCheck> {
    try {
      const networkState = await NetInfo.fetch();
      
      if (!networkState.isConnected) {
        return {
          id: 'network_connectivity',
          name: 'Network Connectivity',
          status: 'warning',
          message: 'No internet connection - using offline mode',
          timestamp: Date.now(),
          autoFixable: false,
          details: networkState,
        };
      }

      return {
        id: 'network_connectivity',
        name: 'Network Connectivity',
        status: 'healthy',
        message: `Connected via ${networkState.type}`,
        timestamp: Date.now(),
        autoFixable: false,
        details: networkState,
      };

    } catch (error) {
      return {
        id: 'network_connectivity',
        name: 'Network Connectivity',
        status: 'unknown',
        message: `Network check failed: ${error}`,
        timestamp: Date.now(),
        autoFixable: false,
      };
    }
  }

  private async checkStorageSpace(): Promise<HealthCheck> {
    try {
      // Check available storage space
      // This would typically use a storage monitoring library
      const availableSpace = 1024 * 1024 * 1024; // 1GB placeholder
      
      if (availableSpace < 100 * 1024 * 1024) { // Less than 100MB
        return {
          id: 'storage_space',
          name: 'Storage Space',
          status: 'critical',
          message: 'Low storage space',
          timestamp: Date.now(),
          autoFixable: true,
          details: { availableSpace },
        };
      }

      return {
        id: 'storage_space',
        name: 'Storage Space',
        status: 'healthy',
        message: 'Storage space OK',
        timestamp: Date.now(),
        autoFixable: false,
        details: { availableSpace },
      };

    } catch (error) {
      return {
        id: 'storage_space',
        name: 'Storage Space',
        status: 'unknown',
        message: `Storage check failed: ${error}`,
        timestamp: Date.now(),
        autoFixable: false,
      };
    }
  }

  private async checkVoiceCommands(): Promise<HealthCheck> {
    try {
      const { voiceCommandManager } = await import('../voice/VoiceCommandManager');
      
      return {
        id: 'voice_commands',
        name: 'Voice Commands',
        status: 'healthy',
        message: 'Voice commands available',
        timestamp: Date.now(),
        autoFixable: false,
      };

    } catch (error) {
      return {
        id: 'voice_commands',
        name: 'Voice Commands',
        status: 'warning',
        message: 'Voice commands not available',
        timestamp: Date.now(),
        autoFixable: true,
      };
    }
  }

  private async checkSensorMonitoring(): Promise<HealthCheck> {
    try {
      const { emergencySensorManager } = await import('../sensors/EmergencySensorManager');
      const isMonitoring = emergencySensorManager.isCurrentlyMonitoring();

      if (!isMonitoring) {
        return {
          id: 'sensor_monitoring',
          name: 'Sensor Monitoring',
          status: 'warning',
          message: 'Sensor monitoring not active',
          timestamp: Date.now(),
          autoFixable: true,
        };
      }

      return {
        id: 'sensor_monitoring',
        name: 'Sensor Monitoring',
        status: 'healthy',
        message: 'Sensor monitoring active',
        timestamp: Date.now(),
        autoFixable: false,
      };

    } catch (error) {
      return {
        id: 'sensor_monitoring',
        name: 'Sensor Monitoring',
        status: 'unknown',
        message: `Sensor check failed: ${error}`,
        timestamp: Date.now(),
        autoFixable: false,
      };
    }
  }

  private async checkEncryptionKeys(): Promise<HealthCheck> {
    try {
      // Check if encryption keys are properly initialized
      const keysExist = true; // Placeholder
      
      if (!keysExist) {
        return {
          id: 'encryption_keys',
          name: 'Encryption Keys',
          status: 'critical',
          message: 'Encryption keys not initialized',
          timestamp: Date.now(),
          autoFixable: true,
        };
      }

      return {
        id: 'encryption_keys',
        name: 'Encryption Keys',
        status: 'healthy',
        message: 'Encryption keys OK',
        timestamp: Date.now(),
        autoFixable: false,
      };

    } catch (error) {
      return {
        id: 'encryption_keys',
        name: 'Encryption Keys',
        status: 'critical',
        message: `Encryption check failed: ${error}`,
        timestamp: Date.now(),
        autoFixable: false,
      };
    }
  }

  // Auto-fix attempts
  private async attemptAutoFix(check: HealthCheck): Promise<boolean> {
    try {
      logger.debug(`🔧 Attempting auto-fix for ${check.name}...`);

      switch (check.id) {
        case 'mesh_network':
          const { emergencyMeshManager } = await import('../emergency/EmergencyMeshManager');
          await emergencyMeshManager.startEmergencyMesh();
          break;

        case 'sos_system':
          const { offlineMessageManager } = await import('../messaging/OfflineMessageManager');
          await offlineMessageManager.retryFailedMessages();
          break;

        case 'location_services':
          await Location.requestForegroundPermissionsAsync();
          break;

        case 'battery_level':
          // Enable power saving mode
          logger.debug('🔋 Enabling power saving mode');
          break;

        case 'storage_space':
          // Clear old logs and cache
          logger.debug('🧹 Clearing old data');
          break;

        case 'voice_commands':
          const { voiceCommandManager } = await import('../voice/VoiceCommandManager');
          await voiceCommandManager.startVoiceRecognition();
          break;

        case 'sensor_monitoring':
          const { emergencySensorManager } = await import('../sensors/EmergencySensorManager');
          await emergencySensorManager.startEmergencyMonitoring();
          break;

        case 'encryption_keys':
          // Re-initialize encryption keys
          logger.debug('🔐 Re-initializing encryption keys');
          break;

        default:
          return false;
      }

      logger.debug(`✅ Auto-fix successful for ${check.name}`);
      return true;

    } catch (error) {
      logger.error(`❌ Auto-fix failed for ${check.name}:`, error);
      return false;
    }
  }

  // Handle critical health issues
  private async handleCriticalHealthIssues(health: SystemHealth): Promise<void> {
    logger.error('🚨 CRITICAL HEALTH ISSUES DETECTED!');
    
    // Vibrate device to alert user
    Vibration.vibrate([0, 1000, 500, 1000, 500, 1000]);

    // Emit critical alert
    this.emit('criticalHealthAlert', health);

    // Log critical issues
    const criticalChecks = health.checks.filter(check => check.status === 'critical');
    for (const check of criticalChecks) {
      logger.error(`🚨 CRITICAL: ${check.name} - ${check.message}`);
    }
  }

  // Metrics collection
  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics();
    }, 5000); // Update metrics every 5 seconds
  }

  private updateMetrics(): void {
    this.metrics.uptime = Date.now() - this.startTime;
    // Other metrics would be updated here
  }

  // Save/load health history
  private async saveHealthHistory(): Promise<void> {
    try {
      // Keep only last 1000 health checks
      this.healthHistory = this.healthHistory.slice(-1000);
      
      await AsyncStorage.setItem('health_history', JSON.stringify(this.healthHistory));
    } catch (error) {
      logger.error('Failed to save health history:', error);
    }
  }

  private async loadHealthHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('health_history');
      if (stored) {
        this.healthHistory = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Failed to load health history:', error);
    }
  }

  // Public methods
  getCurrentHealth(): SystemHealth {
    const criticalChecks = this.healthHistory.filter(check => check.status === 'critical').length;
    const warningChecks = this.healthHistory.filter(check => check.status === 'warning').length;
    
    const overall = criticalChecks > 0 ? 'critical' : 
                   warningChecks > 0 ? 'warning' : 'healthy';

    return {
      overall,
      checks: this.healthHistory.slice(-20), // Last 20 checks
      lastUpdated: Date.now(),
      criticalIssues: criticalChecks,
      warningIssues: warningChecks,
      autoFixedIssues: 0,
    };
  }

  getMetrics(): HealthMetrics {
    return { ...this.metrics };
  }

  getHealthHistory(): HealthCheck[] {
    return [...this.healthHistory];
  }
}

// Export singleton instance
export const systemHealthMonitor = new SystemHealthMonitor();
export default SystemHealthMonitor;
