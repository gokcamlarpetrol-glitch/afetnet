import { DeviceInfo } from 'react-native-device-info';
import { MessageQueue } from './queue';
import { P2PManager } from './index';
import { Platform, NativeModules } from 'react-native';
import { startForegroundService } from '../utils/fg';

export interface SchedulerConfig {
  baseInterval: number;
  minInterval: number;
  maxInterval: number;
  peerDensityThreshold: number;
  batteryThreshold: number;
  adaptiveMode: boolean;
  ultraLowPowerMode: boolean;
  ultraLowPowerThreshold: number; // Battery % for ultra low power (default 8%)
  criticalBatteryThreshold: number; // Battery % for critical mode (default 5%)
}

export interface PeerDensity {
  ble: number;
  nearby: number;
  multipeer: number;
  total: number;
}

export const ensureForegroundIfNeeded = async () => {
  if (Platform.OS === 'android') { await startForegroundService(); }
};

export class AdaptiveScheduler {
  private static instance: AdaptiveScheduler;
  private config: SchedulerConfig;
  private currentInterval: number;
  private isRunning: boolean;
  private timer?: NodeJS.Timeout;
  private peerDensity: PeerDensity;
  private batteryLevel: number;

  private constructor() {
    this.config = {
      baseInterval: 30000, // 30 seconds
      minInterval: 10000,  // 10 seconds
      maxInterval: 300000, // 5 minutes
      peerDensityThreshold: 5,
      batteryThreshold: 20,
      adaptiveMode: true,
      ultraLowPowerMode: true,
      ultraLowPowerThreshold: 8, // 8%
      criticalBatteryThreshold: 5, // 5%
    };
    this.currentInterval = this.config.baseInterval;
    this.isRunning = false;
    this.peerDensity = { ble: 0, nearby: 0, multipeer: 0, total: 0 };
    this.batteryLevel = 100;
  }

  static getInstance(): AdaptiveScheduler {
    if (!AdaptiveScheduler.instance) {
      AdaptiveScheduler.instance = new AdaptiveScheduler();
    }
    return AdaptiveScheduler.instance;
  }

  async initialize(): Promise<void> {
    await this.updateBatteryLevel();
    console.log('AdaptiveScheduler initialized');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.scheduleNext();
    console.log('AdaptiveScheduler started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    console.log('AdaptiveScheduler stopped');
  }

  async updatePeerDensity(density: Partial<PeerDensity>): Promise<void> {
    this.peerDensity = { ...this.peerDensity, ...density };
    this.peerDensity.total = this.peerDensity.ble + this.peerDensity.nearby + this.peerDensity.multipeer;
    
    if (this.config.adaptiveMode) {
      await this.adjustInterval();
    }
  }

  async updateBatteryLevel(): Promise<void> {
    try {
      this.batteryLevel = await DeviceInfo.getBatteryLevel();
      if (this.config.adaptiveMode) {
        await this.adjustInterval();
      }
    } catch (error) {
      console.error('Failed to get battery level:', error);
      this.batteryLevel = 100; // Assume full battery if can't read
    }
  }

  private async adjustInterval(): Promise<void> {
    let newInterval = this.config.baseInterval;

    // Ultra low-power mode adjustments
    if (this.config.ultraLowPowerMode) {
      if (this.batteryLevel < this.config.ultraLowPowerThreshold) {
        // Ultra low power: advertise every 6-10 minutes, scan 15s every 5min
        newInterval = this.getUltraLowPowerInterval();
        console.log(`Ultra low-power mode activated (battery: ${this.batteryLevel}%)`);
      } else if (this.batteryLevel < this.config.criticalBatteryThreshold) {
        // Critical battery: even more conservative
        newInterval = this.getCriticalBatteryInterval();
        console.log(`Critical battery mode activated (battery: ${this.batteryLevel}%)`);
      }
    }

    // Normal adaptive adjustments (only if not in ultra low-power mode)
    if (this.batteryLevel >= this.config.ultraLowPowerThreshold || !this.config.ultraLowPowerMode) {
      // Adjust based on peer density
      if (this.peerDensity.total > this.config.peerDensityThreshold) {
        // More peers = faster communication
        newInterval = Math.max(
          this.config.minInterval,
          newInterval / Math.min(this.peerDensity.total / this.config.peerDensityThreshold, 3)
        );
      } else if (this.peerDensity.total === 0) {
        // No peers = slower communication to save battery
        newInterval = Math.min(this.config.maxInterval, newInterval * 2);
      }

      // Adjust based on battery level
      if (this.batteryLevel < this.config.batteryThreshold) {
        // Low battery = slower communication
        newInterval = Math.min(this.config.maxInterval, newInterval * 2);
      }
    }

    // Ensure interval is within bounds
    newInterval = Math.max(this.config.minInterval, Math.min(this.config.maxInterval, newInterval));

    if (newInterval !== this.currentInterval) {
      this.currentInterval = newInterval;
      console.log(`Scheduler interval adjusted to ${newInterval}ms (peers: ${this.peerDensity.total}, battery: ${this.batteryLevel}%)`);
      
      // Restart timer if running
      if (this.isRunning) {
        this.scheduleNext();
      }
    }
  }

  private getUltraLowPowerInterval(): number {
    // Advertise every 6-10 minutes (360000-600000ms)
    return 480000; // 8 minutes average
  }

  private getCriticalBatteryInterval(): number {
    // Even more conservative: every 10-15 minutes
    return 900000; // 15 minutes
  }

  private scheduleNext(): void {
    if (!this.isRunning) {
      return;
    }

    this.timer = setTimeout(async () => {
      await this.executeScheduledTask();
      this.scheduleNext();
    }, this.currentInterval);
  }

  private async executeScheduledTask(): Promise<void> {
    try {
      // Update battery level
      await this.updateBatteryLevel();

      // Get P2P manager instance
      const p2pManager = P2PManager.getInstance();
      
      // Execute beacon/advertising cycle
      await p2pManager.executeBeaconCycle();

      // Flush message queue
      const queue = MessageQueue.getInstance(p2pManager.getDatabase());
      await queue.flush();

      console.log(`Scheduled task executed (interval: ${this.currentInterval}ms)`);
    } catch (error) {
      console.error('Scheduled task failed:', error);
    }
  }

  getCurrentInterval(): number {
    return this.currentInterval;
  }

  getPeerDensity(): PeerDensity {
    return { ...this.peerDensity };
  }

  getBatteryLevel(): number {
    return this.batteryLevel;
  }

  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Recalculate interval if adaptive mode is enabled
    if (this.config.adaptiveMode) {
      this.adjustInterval();
    }
  }

  async getStats(): Promise<{
    currentInterval: number;
    peerDensity: PeerDensity;
    batteryLevel: number;
    isRunning: boolean;
    adaptiveMode: boolean;
    ultraLowPowerMode: boolean;
    isUltraLowPower: boolean;
    isCriticalBattery: boolean;
  }> {
    return {
      currentInterval: this.currentInterval,
      peerDensity: this.getPeerDensity(),
      batteryLevel: this.batteryLevel,
      isRunning: this.isRunning,
      adaptiveMode: this.config.adaptiveMode,
      ultraLowPowerMode: this.config.ultraLowPowerMode,
      isUltraLowPower: this.batteryLevel < this.config.ultraLowPowerThreshold,
      isCriticalBattery: this.batteryLevel < this.config.criticalBatteryThreshold,
    };
  }

  isUltraLowPowerMode(): boolean {
    return this.config.ultraLowPowerMode && this.batteryLevel < this.config.ultraLowPowerThreshold;
  }

  isCriticalBattery(): boolean {
    return this.batteryLevel < this.config.criticalBatteryThreshold;
  }

  getLeanFrameConfig(): {
    stripNote: boolean;
    coarseLocation: boolean;
    ttl: number;
  } {
    if (this.isUltraLowPowerMode()) {
      return {
        stripNote: true,
        coarseLocation: true, // Round to ~100m precision
        ttl: 4,
      };
    }
    
    return {
      stripNote: false,
      coarseLocation: false,
      ttl: 6,
    };
  }

  shouldBumpTriageForBattery(): boolean {
    return this.batteryLevel < this.config.criticalBatteryThreshold;
  }

  async cleanup(): Promise<void> {
    await this.stop();
    console.log('AdaptiveScheduler cleaned up');
  }
}