import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { logger } from '../../utils/productionLogger';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface SensorReading {
  id: string;
  type: 'accelerometer' | 'gyroscope' | 'magnetometer' | 'barometer' | 'proximity' | 'ambient_light';
  value: number;
  unit: string;
  timestamp: number;
  accuracy: number;
}

class EmergencySensorManager extends SimpleEventEmitter {
  private sensorReadings = new Map<string, SensorReading[]>();
  private isMonitoring = false;

  constructor() {
    super();
    logger.debug('📡 Emergency Sensor Manager initialized');
  }

  // CRITICAL: Start Emergency Monitoring
  async startEmergencyMonitoring(): Promise<boolean> {
    try {
      if (this.isMonitoring) return true;

      logger.debug('📡 Starting emergency sensor monitoring...');

      this.isMonitoring = true;

      this.emit('sensorMonitoringStarted');
      emergencyLogger.logSystem('info', 'Emergency sensor monitoring started');

      logger.debug('✅ Emergency sensor monitoring started');
      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to start sensor monitoring', { error: String(error) });
      logger.error('❌ Failed to start sensor monitoring:', error);
      return false;
    }
  }

  // CRITICAL: Stop Emergency Monitoring
  async stopEmergencyMonitoring(): Promise<void> {
    try {
      if (!this.isMonitoring) return;

      logger.debug('🛑 Stopping emergency sensor monitoring...');

      this.isMonitoring = false;

      this.emit('sensorMonitoringStopped');
      emergencyLogger.logSystem('info', 'Emergency sensor monitoring stopped');

      logger.debug('✅ Emergency sensor monitoring stopped');

    } catch (error) {
      emergencyLogger.logSystem('error', 'Error stopping sensor monitoring', { error: String(error) });
      logger.error('❌ Error stopping sensor monitoring:', error);
    }
  }

  // CRITICAL: Get Sensor Status
  getSensorStatus(): {
    isMonitoring: boolean;
    activeSensors: number;
    totalReadings: number;
    } {
    let totalReadings = 0;
    for (const readings of this.sensorReadings.values()) {
      totalReadings += readings.length;
    }

    return {
      isMonitoring: this.isMonitoring,
      activeSensors: this.sensorReadings.size,
      totalReadings,
    };
  }

  // Provide latest sensor data snapshot for dashboards
  getLatestSensorData(): Record<string, SensorReading | undefined> {
    const latest: Record<string, SensorReading | undefined> = {};
    for (const [type, readings] of this.sensorReadings.entries()) {
      latest[type] = readings.length ? readings[readings.length - 1] : undefined;
    }
    return latest;
  }

  // Placeholder: return recent earthquake detections if any (app expects an array)
  getEarthquakeDetections(): Array<{ id: string; magnitude: number; ts: number }> {
    return [];
  }

  // Expose simple flag for health monitor
  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }
}

export const emergencySensorManager = new EmergencySensorManager();
export default EmergencySensorManager;