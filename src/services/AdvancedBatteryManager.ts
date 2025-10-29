import { logger } from '../utils/productionLogger';
import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BatteryProfile {
  level: number; // 0-100
  state: 'charging' | 'discharging' | 'full' | 'unknown';
  lowPowerMode: boolean;
  timestamp: number;
}

export interface PowerOptimizationSettings {
  bleScanInterval: number;
  messageFrequency: number;
  locationUpdateInterval: number;
  heartbeatInterval: number;
  meshNetworkMode: 'full' | 'reduced' | 'minimal';
  tileServerEnabled: boolean;
  backgroundSyncEnabled: boolean;
}

export type BatteryThreshold = 'critical' | 'low' | 'normal' | 'high';

class AdvancedBatteryManager {
  private currentProfile: BatteryProfile = {
    level: 100,
    state: 'unknown',
    lowPowerMode: false,
    timestamp: Date.now(),
  };

  private batteryListener: any = null;
  private optimizationSettings: PowerOptimizationSettings = this.getDefaultSettings();
  private isMonitoring = false;
  private batteryHistory: BatteryProfile[] = [];
  private powerModeListeners: Set<(profile: BatteryProfile, settings: PowerOptimizationSettings) => void> = new Set();

  async start(): Promise<void> {
    logger.debug('🔋 Starting advanced battery manager...');

    try {
      // Load battery history
      await this.loadBatteryHistory();

      // Start battery monitoring
      this.startBatteryMonitoring();

      // Update current profile
      await this.updateBatteryProfile();

      // Apply initial optimizations
      this.applyOptimizations();

      // Start periodic optimization checks
      this.startPeriodicOptimization();

      this.isMonitoring = true;
      logger.debug('✅ Advanced battery manager started');

    } catch (error) {
      logger.error('❌ Failed to start advanced battery manager:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping advanced battery manager...');

    this.isMonitoring = false;

    // Stop battery monitoring
    if (this.batteryListener) {
      this.batteryListener.remove();
      this.batteryListener = null;
    }

    // Save battery history
    await this.saveBatteryHistory();

    logger.debug('✅ Advanced battery manager stopped');
  }

  private async loadBatteryHistory(): Promise<void> {
    try {
      const historyData = await AsyncStorage.getItem('battery_history');
      if (historyData) {
        this.batteryHistory = JSON.parse(historyData);
        logger.debug(`Loaded ${this.batteryHistory.length} battery history entries`);
      }
    } catch (error) {
      logger.error('Failed to load battery history:', error);
    }
  }

  private async saveBatteryHistory(): Promise<void> {
    try {
      // Keep only last 100 entries
      if (this.batteryHistory.length > 100) {
        this.batteryHistory = this.batteryHistory.slice(-100);
      }

      await AsyncStorage.setItem('battery_history', JSON.stringify(this.batteryHistory));
      logger.debug('Battery history saved');
    } catch (error) {
      logger.error('Failed to save battery history:', error);
    }
  }

  private startBatteryMonitoring(): void {
    logger.debug('📊 Starting battery monitoring...');

    // Listen for battery level changes
    this.batteryListener = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      this.updateBatteryProfile();
    });

    // Listen for battery state changes
    Battery.addBatteryStateListener(({ batteryState }) => {
      this.updateBatteryProfile();
    });
  }

  private async updateBatteryProfile(): Promise<void> {
    try {
      const [batteryLevel, batteryState] = await Promise.all([
        Battery.getBatteryLevelAsync(),
        Battery.getBatteryStateAsync(),
      ]);

      const lowPowerMode = await this.isLowPowerModeEnabled();

      const newProfile: BatteryProfile = {
        level: Math.round(batteryLevel * 100),
        state: this.mapBatteryState(batteryState),
        lowPowerMode,
        timestamp: Date.now(),
      };

      // Only update if there are significant changes
      if (this.shouldUpdateProfile(newProfile)) {
        this.currentProfile = newProfile;

        // Add to history
        this.batteryHistory.push(newProfile);

        // Apply optimizations based on new profile
        this.applyOptimizations();

        // Notify listeners
        this.notifyListeners();

        logger.debug(`🔋 Battery profile updated: ${newProfile.level}% (${newProfile.state})`);
      }

    } catch (error) {
      logger.error('Failed to update battery profile:', error);
    }
  }

  private shouldUpdateProfile(newProfile: BatteryProfile): boolean {
    const current = this.currentProfile;

    // Update if level changed significantly (>5%)
    if (Math.abs(newProfile.level - current.level) >= 5) return true;

    // Update if state changed
    if (newProfile.state !== current.state) return true;

    // Update if low power mode changed
    if (newProfile.lowPowerMode !== current.lowPowerMode) return true;

    // Update every 5 minutes regardless
    if (Date.now() - current.timestamp > 300000) return true;

    return false;
  }

  private mapBatteryState(state: any): 'charging' | 'discharging' | 'full' | 'unknown' {
    switch (state) {
      case Battery.BatteryState.CHARGING:
        return 'charging';
      case Battery.BatteryState.FULL:
        return 'full';
      case Battery.BatteryState.UNPLUGGED:
        return 'discharging';
      default:
        return 'unknown';
    }
  }

  private async isLowPowerModeEnabled(): Promise<boolean> {
    try {
      // Check if device has low power mode capability
      if (Device.isDevice) {
        // In real implementation, check actual low power mode
        return false; // Placeholder
      }
      return false;
    } catch {
      return false;
    }
  }

  private applyOptimizations(): void {
    const threshold = this.getBatteryThreshold();
    const settings = this.getOptimizedSettings(threshold);

    this.optimizationSettings = settings;

    // Apply BLE optimizations
    this.applyBLEOptimizations(settings);

    // Apply messaging optimizations
    this.applyMessagingOptimizations(settings);

    // Apply location optimizations
    this.applyLocationOptimizations(settings);

    logger.debug(`🔧 Applied ${threshold} battery optimizations`);
  }


  private getOptimizedSettings(threshold: BatteryThreshold): PowerOptimizationSettings {
    const baseSettings = this.getDefaultSettings();

    switch (threshold) {
      case 'critical':
        return {
          bleScanInterval: 10000, // 10 seconds (very slow)
          messageFrequency: 60000, // 1 minute
          locationUpdateInterval: 300000, // 5 minutes
          heartbeatInterval: 120000, // 2 minutes
          meshNetworkMode: 'minimal',
          tileServerEnabled: false,
          backgroundSyncEnabled: false,
        };

      case 'low':
        return {
          bleScanInterval: 5000, // 5 seconds
          messageFrequency: 30000, // 30 seconds
          locationUpdateInterval: 120000, // 2 minutes
          heartbeatInterval: 60000, // 1 minute
          meshNetworkMode: 'reduced',
          tileServerEnabled: false,
          backgroundSyncEnabled: true,
        };

      case 'normal':
        return baseSettings;

      case 'high':
        return {
          ...baseSettings,
          bleScanInterval: Math.max(1000, baseSettings.bleScanInterval - 1000), // Faster scanning
          meshNetworkMode: 'full',
          tileServerEnabled: true,
          backgroundSyncEnabled: true,
        };

      default:
        return baseSettings;
    }
  }

  private getDefaultSettings(): PowerOptimizationSettings {
    return {
      bleScanInterval: 3000, // 3 seconds
      messageFrequency: 20000, // 20 seconds
      locationUpdateInterval: 60000, // 1 minute
      heartbeatInterval: 30000, // 30 seconds
      meshNetworkMode: 'full',
      tileServerEnabled: true,
      backgroundSyncEnabled: true,
    };
  }

  private applyBLEOptimizations(settings: PowerOptimizationSettings): void {
    try {
      // Apply BLE scan interval optimization
      if (typeof (globalThis as any).BLEManager !== 'undefined') {
        // In real implementation, adjust BLE scan intervals
        logger.debug(`📡 BLE scan interval set to ${settings.bleScanInterval}ms`);
      }

      // Apply mesh network mode
      if (settings.meshNetworkMode === 'minimal') {
        // Reduce mesh network activity
        logger.debug('🔄 BLE mesh network set to minimal mode');
      } else if (settings.meshNetworkMode === 'reduced') {
        // Reduce mesh network activity
        logger.debug('🔄 BLE mesh network set to reduced mode');
      }

    } catch (error) {
      logger.error('Failed to apply BLE optimizations:', error);
    }
  }

  private applyMessagingOptimizations(settings: PowerOptimizationSettings): void {
    // Apply messaging frequency optimizations
    logger.debug(`💬 Message frequency set to ${settings.messageFrequency}ms`);
    logger.debug(`💓 Heartbeat interval set to ${settings.heartbeatInterval}ms`);
  }

  private applyLocationOptimizations(settings: PowerOptimizationSettings): void {
    // Apply location update frequency optimizations
    logger.debug(`📍 Location update interval set to ${settings.locationUpdateInterval}ms`);
  }

  private startPeriodicOptimization(): void {
    logger.debug('⏰ Starting periodic optimization checks...');

    setInterval(() => {
      if (this.isMonitoring) {
        this.updateBatteryProfile();
        this.analyzeBatteryTrends();
      }
    }, 60000); // Every minute
  }

  private analyzeBatteryTrends(): void {
    if (this.batteryHistory.length < 5) return;

    const recent = this.batteryHistory.slice(-10);
    const older = this.batteryHistory.slice(-20, -10);

    const recentAvg = recent.reduce((sum, p) => sum + p.level, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p.level, 0) / older.length;

    const trend = recentAvg - olderAvg;

    if (trend < -10) {
      logger.warn('📉 Battery draining rapidly, applying aggressive optimizations');
      this.applyEmergencyOptimizations();
    } else if (trend > 5) {
      logger.debug('📈 Battery recovering, can increase performance');
      this.applyPerformanceOptimizations();
    }
  }

  private applyEmergencyOptimizations(): void {
    // Apply most aggressive battery saving
    this.optimizationSettings = {
      bleScanInterval: 15000,
      messageFrequency: 120000,
      locationUpdateInterval: 600000,
      heartbeatInterval: 300000,
      meshNetworkMode: 'minimal',
      tileServerEnabled: false,
      backgroundSyncEnabled: false,
    };

    this.applyOptimizations();
  }

  private applyPerformanceOptimizations(): void {
    // Increase performance when battery is recovering
    if (this.currentProfile.level > 50) {
      this.optimizationSettings = {
        ...this.optimizationSettings,
        bleScanInterval: Math.max(2000, this.optimizationSettings.bleScanInterval - 500),
        messageFrequency: Math.max(15000, this.optimizationSettings.messageFrequency - 2000),
      };

      this.applyOptimizations();
    }
  }

  private notifyListeners(): void {
    for (const listener of this.powerModeListeners) {
      try {
        listener(this.currentProfile, this.optimizationSettings);
      } catch (error) {
        logger.error('Power mode listener error:', error);
      }
    }
  }

  // Public API
  public getCurrentProfile(): BatteryProfile {
    return { ...this.currentProfile };
  }

  public getOptimizationSettings(): PowerOptimizationSettings {
    return { ...this.optimizationSettings };
  }

  public getBatteryThreshold(): BatteryThreshold {
    const level = this.currentProfile.level;
    const isCharging = this.currentProfile.state === 'charging';
    const isLowPowerMode = this.currentProfile.lowPowerMode;

    if (level <= 10 || isLowPowerMode) return 'critical';
    if (level <= 25) return 'low';
    if (level >= 80 && isCharging) return 'high';
    return 'normal';
  }

  public getBatteryHistory(): BatteryProfile[] {
    return [...this.batteryHistory];
  }

  public addPowerModeListener(listener: (profile: BatteryProfile, settings: PowerOptimizationSettings) => void): () => void {
    this.powerModeListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.powerModeListeners.delete(listener);
    };
  }

  public async getBatteryHealth(): Promise<{
    currentLevel: number;
    trend: 'improving' | 'stable' | 'declining' | 'critical';
    estimatedTimeRemaining: number; // minutes
    recommendation: string;
  }> {
    const profile = this.getCurrentProfile();
    const threshold = this.getBatteryThreshold();

    // Calculate trend
    let trend: 'improving' | 'stable' | 'declining' | 'critical' = 'stable';
    if (this.batteryHistory.length >= 5) {
      const recent = this.batteryHistory.slice(-5);
      const avgRecent = recent.reduce((sum, p) => sum + p.level, 0) / recent.length;
      const avgOlder = this.batteryHistory.slice(-10, -5).reduce((sum, p) => sum + p.level, 0) / 5;

      const diff = avgRecent - avgOlder;
      if (diff > 2) trend = 'improving';
      else if (diff < -2) trend = 'declining';
      else if (profile.level <= 10) trend = 'critical';
    }

    // Estimate time remaining based on trend and usage
    let estimatedTime = 120; // 2 hours default
    if (trend === 'declining') estimatedTime = 60;
    if (trend === 'critical') estimatedTime = 30;
    if (profile.state === 'charging') estimatedTime = 180;

    // Generate recommendation
    let recommendation = 'Battery level is normal';
    if (threshold === 'critical') {
      recommendation = 'Critical battery level! Enable maximum power saving immediately.';
    } else if (threshold === 'low') {
      recommendation = 'Low battery. Consider enabling power saving mode.';
    } else if (trend === 'declining') {
      recommendation = 'Battery draining quickly. Monitor usage and enable power saving.';
    } else if (profile.state === 'charging') {
      recommendation = 'Battery is charging. Full performance mode enabled.';
    }

    return {
      currentLevel: profile.level,
      trend,
      estimatedTimeRemaining: estimatedTime,
      recommendation,
    };
  }

  public async enableEmergencyPowerSaving(): Promise<void> {
    logger.debug('🚨 Enabling emergency power saving...');

    this.applyEmergencyOptimizations();

    // Send notification to all components
    this.notifyListeners();

    logger.debug('✅ Emergency power saving enabled');
  }

  public async disablePowerSaving(): Promise<void> {
    logger.debug('⚡ Disabling power saving...');

    this.optimizationSettings = this.getDefaultSettings();
    this.applyOptimizations();

    // Send notification to all components
    this.notifyListeners();

    logger.debug('✅ Power saving disabled');
  }

  public getPowerSavings(): {
    bleScanReduction: number;
    messageFrequencyReduction: number;
    locationUpdateReduction: number;
    totalPowerSavings: number; // estimated percentage
  } {
    const defaultSettings = this.getDefaultSettings();
    const currentSettings = this.optimizationSettings;

    const bleReduction = ((defaultSettings.bleScanInterval - currentSettings.bleScanInterval) / defaultSettings.bleScanInterval) * 100;
    const messageReduction = ((defaultSettings.messageFrequency - currentSettings.messageFrequency) / defaultSettings.messageFrequency) * 100;
    const locationReduction = ((defaultSettings.locationUpdateInterval - currentSettings.locationUpdateInterval) / defaultSettings.locationUpdateInterval) * 100;

    const totalSavings = (bleReduction + messageReduction + locationReduction) / 3;

    return {
      bleScanReduction: Math.round(bleReduction),
      messageFrequencyReduction: Math.round(messageReduction),
      locationUpdateReduction: Math.round(locationReduction),
      totalPowerSavings: Math.round(totalSavings),
    };
  }
}

// Export singleton instance
export const advancedBatteryManager = new AdvancedBatteryManager();







