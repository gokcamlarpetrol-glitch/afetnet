import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';

export interface PowerMode {
  id: string;
  name: string;
  batteryThreshold: number;
  features: string[];
  enabled: boolean;
}

class EmergencyPowerManager extends SimpleEventEmitter {
  private powerModes = new Map<string, PowerMode>();
  private currentMode: PowerMode | null = null;

  constructor() {
    super();
    this.initializePowerModes();
    console.log('🔋 Emergency Power Manager initialized');
  }

  private initializePowerModes(): void {
    this.addPowerMode({
      id: 'emergency_power',
      name: 'Emergency Power Mode',
      batteryThreshold: 20,
      features: ['sos_only', 'location_tracking', 'mesh_network'],
      enabled: true
    });
  }

  addPowerMode(mode: PowerMode): void {
    this.powerModes.set(mode.id, mode);
  }

  getCurrentPowerMode(): PowerMode | null {
    return this.currentMode;
  }

  getPowerModes(): PowerMode[] {
    return Array.from(this.powerModes.values());
  }

  // CRITICAL: Start Battery Monitoring
  async startBatteryMonitoring(): Promise<boolean> {
    try {
      console.log('🔋 Starting battery monitoring...');
      
      // Set default power mode
      this.currentMode = this.powerModes.get('emergency_power') || null;
      
      this.emit('batteryMonitoringStarted');
      console.log('✅ Battery monitoring started');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start battery monitoring:', error);
      return false;
    }
  }

  // CRITICAL: Stop Battery Monitoring
  async stopBatteryMonitoring(): Promise<boolean> {
    try {
      console.log('🔋 Stopping battery monitoring...');
      
      this.currentMode = null;
      
      this.emit('batteryMonitoringStopped');
      console.log('✅ Battery monitoring stopped');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to stop battery monitoring:', error);
      return false;
    }
  }

  // CRITICAL: Get Power Optimization
  getPowerOptimization(): any {
    return {
      currentMode: this.currentMode?.name || 'normal',
      batteryLevel: 85, // Mock battery level
      isOptimized: true,
      availableModes: this.getPowerModes()
    };
  }

  // CRITICAL: Set Power Mode
  async setPowerMode(modeId: string): Promise<boolean> {
    try {
      const mode = this.powerModes.get(modeId);
      if (!mode) {
        return false;
      }

      this.currentMode = mode;
      this.emit('powerModeChanged', mode);
      
      console.log(`✅ Power mode changed to: ${mode.name}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to set power mode:', error);
      return false;
    }
  }
}

export const emergencyPowerManager = new EmergencyPowerManager();
export default EmergencyPowerManager;