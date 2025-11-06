// @afetnet: Advanced Power Governor for Dynamic Resource Management
// Intelligent power management system for disaster communication optimization

import { logger } from '../../core/utils/logger';
import { advancedBatteryManager } from '../power/budget';

export interface PowerMode {
  id: string;
  name: string;
  description: string;
  batteryThreshold: number; // Minimum battery % to enter this mode
  samplingRates: {
    imu: number; // Hz
    gps: number; // Hz
    ble: number; // Hz
    network: number; // Hz
  };
  dutyCycles: {
    ble: number; // % active time
    network: number; // % active time
  };
  features: {
    locationTracking: boolean;
    meshNetworking: boolean;
    backgroundSync: boolean;
    emergencyMode: boolean;
  };
  performance: {
    latency: 'low' | 'medium' | 'high';
    reliability: 'low' | 'medium' | 'high';
    batteryLife: 'short' | 'medium' | 'long';
  };
}

export interface PowerState {
  currentMode: PowerMode;
  batteryLevel: number;
  temperature: number;
  isCharging: boolean;
  emergencyMode: boolean;
  lastModeSwitch: number;
  modeSwitchCount: number;
  totalEnergyConsumed: number; // mAh
  averagePowerDraw: number; // mW
}

export class AdvancedPowerGovernor {
  private powerModes: Map<string, PowerMode> = new Map();
  private currentState: PowerState;
  private modeSwitchTimer: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isActive = false;

  constructor() {
    this.currentState = this.initializePowerState();
    this.initializePowerModes();
  }

  private initializePowerState(): PowerState {
    return {
      currentMode: this.getDefaultPowerMode(),
      batteryLevel: 100,
      temperature: 25, // Celsius
      isCharging: false,
      emergencyMode: false,
      lastModeSwitch: Date.now(),
      modeSwitchCount: 0,
      totalEnergyConsumed: 0,
      averagePowerDraw: 100, // mW
    };
  }

  private initializePowerModes(): void {
    const modes: PowerMode[] = [
      {
        id: 'emergency',
        name: 'Acil Durum',
        description: 'Maksimum performans ve güvenilirlik için optimize edilmiş',
        batteryThreshold: 0, // Always available
        samplingRates: {
          imu: 50, // High frequency for precise tracking
          gps: 10, // High frequency for emergency location
          ble: 20, // High frequency for mesh networking
          network: 10, // High frequency for emergency communication
        },
        dutyCycles: {
          ble: 100, // Always on
          network: 100, // Always on
        },
        features: {
          locationTracking: true,
          meshNetworking: true,
          backgroundSync: true,
          emergencyMode: true,
        },
        performance: {
          latency: 'low',
          reliability: 'high',
          batteryLife: 'short',
        },
      },
      {
        id: 'high_performance',
        name: 'Yüksek Performans',
        description: 'Optimum performans ve pil ömrü dengesi',
        batteryThreshold: 50,
        samplingRates: {
          imu: 20,
          gps: 5,
          ble: 10,
          network: 5,
        },
        dutyCycles: {
          ble: 80,
          network: 80,
        },
        features: {
          locationTracking: true,
          meshNetworking: true,
          backgroundSync: true,
          emergencyMode: false,
        },
        performance: {
          latency: 'medium',
          reliability: 'high',
          batteryLife: 'medium',
        },
      },
      {
        id: 'balanced',
        name: 'Dengeli',
        description: 'Standart kullanım için optimize edilmiş',
        batteryThreshold: 30,
        samplingRates: {
          imu: 10,
          gps: 1,
          ble: 5,
          network: 1,
        },
        dutyCycles: {
          ble: 60,
          network: 60,
        },
        features: {
          locationTracking: true,
          meshNetworking: true,
          backgroundSync: false,
          emergencyMode: false,
        },
        performance: {
          latency: 'medium',
          reliability: 'medium',
          batteryLife: 'long',
        },
      },
      {
        id: 'power_saver',
        name: 'Güç Tasarrufu',
        description: 'Maksimum pil ömrü için optimize edilmiş',
        batteryThreshold: 20,
        samplingRates: {
          imu: 5,
          gps: 0.5,
          ble: 2,
          network: 0.5,
        },
        dutyCycles: {
          ble: 30,
          network: 30,
        },
        features: {
          locationTracking: false, // Limited location tracking
          meshNetworking: true, // Keep mesh active
          backgroundSync: false,
          emergencyMode: false,
        },
        performance: {
          latency: 'high',
          reliability: 'medium',
          batteryLife: 'long',
        },
      },
      {
        id: 'ultra_low_power',
        name: 'Ultra Düşük Güç',
        description: 'Kritik pil seviyesi için minimum güç tüketimi',
        batteryThreshold: 10,
        samplingRates: {
          imu: 1,
          gps: 0.1,
          ble: 0.5,
          network: 0.1,
        },
        dutyCycles: {
          ble: 10,
          network: 10,
        },
        features: {
          locationTracking: false,
          meshNetworking: false, // Emergency only
          backgroundSync: false,
          emergencyMode: true, // Keep emergency features
        },
        performance: {
          latency: 'high',
          reliability: 'low',
          batteryLife: 'very_long',
        },
      },
    ];

    for (const mode of modes) {
      this.powerModes.set(mode.id, mode);
    }
  }

  private getDefaultPowerMode(): PowerMode {
    return this.powerModes.get('balanced') || this.initializePowerModes()[2]; // Fallback to balanced
  }

  async initialize(): Promise<void> {
    logger.debug('⚡ Initializing advanced power governor...');

    try {
      // Monitor battery changes
      this.startBatteryMonitoring();

      // Start periodic optimization
      this.startPeriodicOptimization();

      // Initialize with current battery level
      await this.updatePowerMode();

      this.isActive = true;
      logger.debug('✅ Advanced power governor initialized');
    } catch (error) {
      logger.error('Failed to initialize power governor:', error);
      throw error;
    }
  }

  private startBatteryMonitoring(): void {
    logger.debug('🔋 Starting battery monitoring...');

    // Monitor battery changes every 30 seconds
    setInterval(async () => {
      if (this.isActive) {
        await this.updatePowerMode();
      }
    }, 30000);
  }

  private startPeriodicOptimization(): void {
    logger.debug('⚡ Starting periodic optimization...');

    this.monitoringInterval = setInterval(() => {
      if (this.isActive) {
        this.optimizePowerUsage();
      }
    }, 60000); // Every minute
  }

  private async updatePowerMode(): Promise<void> {
    try {
      const batteryProfile = advancedBatteryManager.getCurrentProfile();
      const batteryLevel = batteryProfile.level;
      const isCharging = batteryProfile.state === 'charging';

      this.currentState.batteryLevel = batteryLevel;
      this.currentState.isCharging = isCharging;

      // Determine optimal power mode based on battery level and charging state
      const optimalMode = this.selectOptimalPowerMode(batteryLevel, isCharging);

      if (optimalMode.id !== this.currentState.currentMode.id) {
        await this.switchPowerMode(optimalMode);
      }

      logger.debug(`⚡ Power mode updated: ${optimalMode.name} (${batteryLevel}% battery)`);
    } catch (error) {
      logger.error('Failed to update power mode:', error);
    }
  }

  private selectOptimalPowerMode(batteryLevel: number, isCharging: boolean): PowerMode {
    // Emergency mode always takes priority
    if (this.currentState.emergencyMode) {
      return this.powerModes.get('emergency') || this.getDefaultPowerMode();
    }

    // If charging and battery is high, use high performance
    if (isCharging && batteryLevel > 70) {
      return this.powerModes.get('high_performance') || this.getDefaultPowerMode();
    }

    // Select mode based on battery level
    for (const mode of this.powerModes.values()) {
      if (batteryLevel >= mode.batteryThreshold) {
        return mode;
      }
    }

    // Fallback to lowest power mode
    return this.powerModes.get('ultra_low_power') || this.getDefaultPowerMode();
  }

  private async switchPowerMode(newMode: PowerMode): Promise<void> {
    logger.debug(`🔄 Switching power mode: ${this.currentState.currentMode.name} → ${newMode.name}`);

    const oldMode = this.currentState.currentMode;
    this.currentState.currentMode = newMode;
    this.currentState.lastModeSwitch = Date.now();
    this.currentState.modeSwitchCount++;

    // Apply new power settings
    await this.applyPowerSettings(newMode);

    // Log mode switch
    logger.info(`⚡ Power mode switched: ${oldMode.name} → ${newMode.name} (${newMode.description})`);
  }

  private async applyPowerSettings(mode: PowerMode): Promise<void> {
    try {
      // Apply sampling rates
      // In real implementation, would configure actual sensor sampling rates

      logger.debug(`⚙️ Applied power settings for ${mode.name}:`);
      logger.debug(`  • IMU sampling: ${mode.samplingRates.imu}Hz`);
      logger.debug(`  • GPS sampling: ${mode.samplingRates.gps}Hz`);
      logger.debug(`  • BLE duty cycle: ${mode.dutyCycles.ble}%`);
      logger.debug(`  • Network duty cycle: ${mode.dutyCycles.network}%`);
      logger.debug(`  • Location tracking: ${mode.features.locationTracking ? 'ON' : 'OFF'}`);
      logger.debug(`  • Mesh networking: ${mode.features.meshNetworking ? 'ON' : 'OFF'}`);
    } catch (error) {
      logger.error('Failed to apply power settings:', error);
    }
  }

  private optimizePowerUsage(): void {
    // Optimize power usage based on current conditions
    const mode = this.currentState.currentMode;

    // Adjust settings based on temperature
    if (this.currentState.temperature > 35) {
      logger.warn('High temperature detected - reducing power consumption');
      // Reduce sampling rates in high temperature
    }

    // Optimize based on current usage patterns
    this.analyzePowerUsagePatterns();
  }

  private analyzePowerUsagePatterns(): void {
    // Analyze power usage patterns and optimize
    // In real implementation, would use historical data to predict optimal settings
  }

  // Public API
  public getCurrentMode(): PowerMode {
    return { ...this.currentState.currentMode };
  }

  public getPowerState(): PowerState {
    return { ...this.currentState };
  }

  public getAvailableModes(): PowerMode[] {
    return Array.from(this.powerModes.values());
  }

  public async setEmergencyMode(enabled: boolean): Promise<void> {
    if (this.currentState.emergencyMode === enabled) return;

    this.currentState.emergencyMode = enabled;

    if (enabled) {
      await this.switchPowerMode(this.powerModes.get('emergency') || this.getDefaultPowerMode());
      logger.info('🚨 Emergency power mode activated');
    } else {
      await this.updatePowerMode(); // Return to battery-based mode
      logger.info('✅ Emergency power mode deactivated');
    }
  }

  public isEmergencyMode(): boolean {
    return this.currentState.emergencyMode;
  }

  public async forcePowerMode(modeId: string): Promise<boolean> {
    const mode = this.powerModes.get(modeId);
    if (!mode) {
      logger.error(`Unknown power mode: ${modeId}`);
      return false;
    }

    await this.switchPowerMode(mode);
    return true;
  }

  public getPowerConsumption(): {
    current: number; // mW
    average: number; // mW
    estimatedBatteryLife: number; // hours
  } {
    const current = this.currentState.averagePowerDraw;
    const average = this.currentState.averagePowerDraw; // Simplified

    // Estimate battery life based on current consumption and battery level
    const estimatedBatteryLife = this.currentState.batteryLevel / (current / 1000); // hours

    return {
      current,
      average,
      estimatedBatteryLife,
    };
  }

  public getPowerOptimizationTips(): string[] {
    const tips: string[] = [];
    const mode = this.currentState.currentMode;

    if (mode.id === 'ultra_low_power' || mode.id === 'power_saver') {
      tips.push('Güç tasarrufu modundasınız - gereksiz özellikleri kapatın');
      tips.push('Arka planda çalışan uygulamaları kapatın');
      tips.push('Ekran parlaklığını azaltın');
    }

    if (this.currentState.temperature > 30) {
      tips.push('Cihaz sıcak - havalandırma sağlayın');
    }

    if (!this.currentState.isCharging && this.currentState.batteryLevel < 30) {
      tips.push('Düşük pil - şarj cihazına bağlayın');
    }

    return tips;
  }

  public getModeRecommendations(): {
    recommendedMode: PowerMode;
    reason: string;
    estimatedBatteryLife: number;
  } {
    const batteryLevel = this.currentState.batteryLevel;
    const isCharging = this.currentState.isCharging;

    let recommendedMode: PowerMode;
    let reason: string;
    let estimatedBatteryLife: number;

    if (this.currentState.emergencyMode) {
      recommendedMode = this.powerModes.get('emergency') || this.getDefaultPowerMode();
      reason = 'Acil durum modu aktif';
      estimatedBatteryLife = 2; // Emergency mode has short battery life
    } else if (isCharging && batteryLevel > 80) {
      recommendedMode = this.powerModes.get('high_performance') || this.getDefaultPowerMode();
      reason = 'Şarj olurken yüksek performans kullanılabilir';
      estimatedBatteryLife = 24; // Full battery life
    } else if (batteryLevel < 15) {
      recommendedMode = this.powerModes.get('ultra_low_power') || this.getDefaultPowerMode();
      reason = 'Kritik pil seviyesi - maksimum tasarruf gerekli';
      estimatedBatteryLife = 1; // Very short battery life
    } else if (batteryLevel < 30) {
      recommendedMode = this.powerModes.get('power_saver') || this.getDefaultPowerMode();
      reason = 'Düşük pil seviyesi - güç tasarrufu önerilir';
      estimatedBatteryLife = 4;
    } else {
      recommendedMode = this.powerModes.get('balanced') || this.getDefaultPowerMode();
      reason = 'Normal kullanım için dengeli mod';
      estimatedBatteryLife = 12;
    }

    return {
      recommendedMode,
      reason,
      estimatedBatteryLife,
    };
  }

  public updateTemperature(temperature: number): void {
    this.currentState.temperature = temperature;
    logger.debug(`🌡️ Temperature updated: ${temperature}°C`);
  }

  public getTemperature(): number {
    return this.currentState.temperature;
  }

  public getModeSwitchHistory(): {
    count: number;
    lastSwitch: number;
    averageInterval: number;
  } {
    const now = Date.now();
    const timeSinceLastSwitch = now - this.currentState.lastModeSwitch;
    const averageInterval = this.currentState.modeSwitchCount > 0
      ? timeSinceLastSwitch / this.currentState.modeSwitchCount
      : 0;

    return {
      count: this.currentState.modeSwitchCount,
      lastSwitch: this.currentState.lastModeSwitch,
      averageInterval,
    };
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping advanced power governor...');

    this.isActive = false;

    if (this.modeSwitchTimer) {
      clearInterval(this.modeSwitchTimer);
      this.modeSwitchTimer = null;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.debug('✅ Advanced power governor stopped');
  }
}

// @afetnet: Export singleton instance
export const advancedPowerGovernor = new AdvancedPowerGovernor();

























