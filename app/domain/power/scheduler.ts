// @afetnet: Advanced Power Scheduler for Real-time Resource Management
// Dynamic scheduling based on battery, temperature, and network conditions

import { logger } from '../../core/utils/logger';
import { advancedBatteryManager } from '../power/budget';
import { advancedPowerGovernor } from '../power/governor';

export interface ScheduleEntry {
  id: string;
  type: 'sensor_update' | 'network_scan' | 'message_check' | 'location_update' | 'sync_check';
  priority: 'critical' | 'high' | 'normal' | 'low';
  interval: number; // milliseconds
  lastExecution: number;
  nextExecution: number;
  isActive: boolean;
  canSkip: boolean;
  powerCost: number; // estimated mAh
  description: string;
}

export interface SchedulingPolicy {
  name: string;
  description: string;
  batteryThreshold: number; // minimum battery % to use this policy
  temperatureThreshold: number; // maximum temperature to use this policy
  networkLoad: 'light' | 'moderate' | 'heavy';
  emergencyMode: boolean;
  entries: ScheduleEntry[];
}

export interface PowerSchedule {
  policy: SchedulingPolicy;
  nextUpdates: ScheduleEntry[];
  totalPowerBudget: number; // mAh per hour
  currentConsumption: number; // mAh per hour
  efficiency: number; // 0-100
}

export class AdvancedPowerScheduler {
  private schedules: Map<string, ScheduleEntry> = new Map();
  private policies: Map<string, SchedulingPolicy> = new Map();
  private currentSchedule: PowerSchedule;
  private schedulingTimer: NodeJS.Timeout | null = null;
  private isActive = false;
  private executionHistory: Array<{ entryId: string; timestamp: number; success: boolean }> = [];

  constructor() {
    this.currentSchedule = this.initializeDefaultSchedule();
    this.initializePolicies();
  }

  private initializeDefaultSchedule(): PowerSchedule {
    return {
      policy: this.getDefaultPolicy(),
      nextUpdates: [],
      totalPowerBudget: 100, // mAh per hour
      currentConsumption: 0,
      efficiency: 100,
    };
  }

  private initializePolicies(): void {
    // Emergency policy - maximum performance
    this.policies.set('emergency', {
      name: 'Acil Durum',
      description: 'Maksimum performans için optimize edilmiş',
      batteryThreshold: 0,
      temperatureThreshold: 50,
      networkLoad: 'heavy',
      emergencyMode: true,
      entries: [
        {
          id: 'emergency_location',
          type: 'location_update',
          priority: 'critical',
          interval: 5000, // 5 seconds
          lastExecution: 0,
          nextExecution: Date.now() + 5000,
          isActive: true,
          canSkip: false,
          powerCost: 5,
          description: 'Emergency location updates',
        },
        {
          id: 'emergency_network',
          type: 'network_scan',
          priority: 'critical',
          interval: 3000, // 3 seconds
          lastExecution: 0,
          nextExecution: Date.now() + 3000,
          isActive: true,
          canSkip: false,
          powerCost: 8,
          description: 'Emergency network scanning',
        },
        {
          id: 'emergency_messaging',
          type: 'message_check',
          priority: 'critical',
          interval: 2000, // 2 seconds
          lastExecution: 0,
          nextExecution: Date.now() + 2000,
          isActive: true,
          canSkip: false,
          powerCost: 3,
          description: 'Emergency message checking',
        },
      ],
    });

    // High performance policy
    this.policies.set('high_performance', {
      name: 'Yüksek Performans',
      description: 'Optimum performans ve pil ömrü dengesi',
      batteryThreshold: 50,
      temperatureThreshold: 40,
      networkLoad: 'moderate',
      emergencyMode: false,
      entries: [
        {
          id: 'hp_location',
          type: 'location_update',
          priority: 'high',
          interval: 10000, // 10 seconds
          lastExecution: 0,
          nextExecution: Date.now() + 10000,
          isActive: true,
          canSkip: false,
          powerCost: 3,
          description: 'High performance location updates',
        },
        {
          id: 'hp_network',
          type: 'network_scan',
          priority: 'high',
          interval: 5000, // 5 seconds
          lastExecution: 0,
          nextExecution: Date.now() + 5000,
          isActive: true,
          canSkip: true,
          powerCost: 4,
          description: 'High performance network scanning',
        },
        {
          id: 'hp_messaging',
          type: 'message_check',
          priority: 'normal',
          interval: 5000, // 5 seconds
          lastExecution: 0,
          nextExecution: Date.now() + 5000,
          isActive: true,
          canSkip: true,
          powerCost: 2,
          description: 'High performance message checking',
        },
      ],
    });

    // Balanced policy
    this.policies.set('balanced', {
      name: 'Dengeli',
      description: 'Standart kullanım için optimize edilmiş',
      batteryThreshold: 30,
      temperatureThreshold: 35,
      networkLoad: 'light',
      emergencyMode: false,
      entries: [
        {
          id: 'balanced_location',
          type: 'location_update',
          priority: 'normal',
          interval: 30000, // 30 seconds
          lastExecution: 0,
          nextExecution: Date.now() + 30000,
          isActive: true,
          canSkip: true,
          powerCost: 2,
          description: 'Balanced location updates',
        },
        {
          id: 'balanced_network',
          type: 'network_scan',
          priority: 'normal',
          interval: 10000, // 10 seconds
          lastExecution: 0,
          nextExecution: Date.now() + 10000,
          isActive: true,
          canSkip: true,
          powerCost: 3,
          description: 'Balanced network scanning',
        },
        {
          id: 'balanced_messaging',
          type: 'message_check',
          priority: 'low',
          interval: 15000, // 15 seconds
          lastExecution: 0,
          nextExecution: Date.now() + 15000,
          isActive: true,
          canSkip: true,
          powerCost: 1,
          description: 'Balanced message checking',
        },
      ],
    });

    // Power saver policy
    this.policies.set('power_saver', {
      name: 'Güç Tasarrufu',
      description: 'Maksimum pil ömrü için optimize edilmiş',
      batteryThreshold: 20,
      temperatureThreshold: 30,
      networkLoad: 'light',
      emergencyMode: false,
      entries: [
        {
          id: 'saver_location',
          type: 'location_update',
          priority: 'low',
          interval: 60000, // 1 minute
          lastExecution: 0,
          nextExecution: Date.now() + 60000,
          isActive: true,
          canSkip: true,
          powerCost: 1,
          description: 'Power saver location updates',
        },
        {
          id: 'saver_network',
          type: 'network_scan',
          priority: 'low',
          interval: 30000, // 30 seconds
          lastExecution: 0,
          nextExecution: Date.now() + 30000,
          isActive: true,
          canSkip: true,
          powerCost: 2,
          description: 'Power saver network scanning',
        },
        {
          id: 'saver_messaging',
          type: 'message_check',
          priority: 'low',
          interval: 60000, // 1 minute
          lastExecution: 0,
          nextExecution: Date.now() + 60000,
          isActive: true,
          canSkip: true,
          powerCost: 0.5,
          description: 'Power saver message checking',
        },
      ],
    });

    // Ultra low power policy
    this.policies.set('ultra_low', {
      name: 'Ultra Düşük Güç',
      description: 'Kritik pil seviyesi için minimum güç tüketimi',
      batteryThreshold: 10,
      temperatureThreshold: 25,
      networkLoad: 'light',
      emergencyMode: false,
      entries: [
        {
          id: 'ultra_location',
          type: 'location_update',
          priority: 'low',
          interval: 300000, // 5 minutes
          lastExecution: 0,
          nextExecution: Date.now() + 300000,
          isActive: true,
          canSkip: true,
          powerCost: 0.5,
          description: 'Ultra low power location updates',
        },
        {
          id: 'ultra_network',
          type: 'network_scan',
          priority: 'low',
          interval: 600000, // 10 minutes
          lastExecution: 0,
          nextExecution: Date.now() + 600000,
          isActive: true,
          canSkip: true,
          powerCost: 1,
          description: 'Ultra low power network scanning',
        },
        {
          id: 'ultra_messaging',
          type: 'message_check',
          priority: 'low',
          interval: 300000, // 5 minutes
          lastExecution: 0,
          nextExecution: Date.now() + 300000,
          isActive: true,
          canSkip: true,
          powerCost: 0.2,
          description: 'Ultra low power message checking',
        },
      ],
    });
  }

  private getDefaultPolicy(): SchedulingPolicy {
    return this.policies.get('balanced') || this.policies.values().next().value;
  }

  async initialize(): Promise<void> {
    logger.debug('⏰ Initializing advanced power scheduler...');

    this.isActive = true;

    // Initialize with current battery and temperature
    await this.updateSchedule();

    // Start periodic scheduling
    this.startPeriodicScheduling();

    logger.debug('✅ Advanced power scheduler initialized');
  }

  private startPeriodicScheduling(): void {
    logger.debug('⏰ Starting periodic scheduling...');

    this.schedulingTimer = setInterval(async () => {
      if (this.isActive) {
        await this.updateSchedule();
      }
    }, 30000); // Every 30 seconds
  }

  private async updateSchedule(): Promise<void> {
    try {
      // Get current conditions
      const batteryProfile = advancedBatteryManager.getCurrentProfile();
      const batteryLevel = batteryProfile.level;
      const isCharging = batteryProfile.state === 'charging';
      const temperature = advancedPowerGovernor.getTemperature();
      const emergencyMode = advancedPowerGovernor.isEmergencyMode();

      // Select optimal policy
      const optimalPolicy = this.selectOptimalPolicy(batteryLevel, temperature, emergencyMode);

      if (optimalPolicy.id !== this.currentSchedule.policy.id) {
        this.currentSchedule.policy = optimalPolicy;
        logger.info(`⏰ Power policy switched to: ${optimalPolicy.name}`);
      }

      // Update schedule entries
      this.updateScheduleEntries();

      // Calculate power consumption
      this.calculatePowerConsumption();

      logger.debug(`⏰ Schedule updated: ${optimalPolicy.name} (${batteryLevel}% battery, ${temperature}°C)`);
    } catch (error) {
      logger.error('Failed to update power schedule:', error);
    }
  }

  private selectOptimalPolicy(batteryLevel: number, temperature: number, emergencyMode: boolean): SchedulingPolicy {
    // Emergency mode always takes priority
    if (emergencyMode) {
      return this.policies.get('emergency') || this.getDefaultPolicy();
    }

    // Select policy based on conditions
    for (const policy of this.policies.values()) {
      if (batteryLevel >= policy.batteryThreshold && temperature <= policy.temperatureThreshold) {
        return policy;
      }
    }

    // Fallback to lowest power policy
    return this.policies.get('ultra_low') || this.getDefaultPolicy();
  }

  private updateScheduleEntries(): void {
    const now = Date.now();
    this.currentSchedule.nextUpdates = [];

    for (const entry of this.currentSchedule.policy.entries) {
      if (entry.isActive) {
        // Check if entry should execute
        if (now >= entry.nextExecution) {
          // Execute entry
          this.executeScheduleEntry(entry);

          // Schedule next execution
          entry.lastExecution = now;
          entry.nextExecution = now + entry.interval;
        }

        // Add to next updates if within next 5 minutes
        if (entry.nextExecution - now < 300000) {
          this.currentSchedule.nextUpdates.push(entry);
        }
      }
    }

    // Sort by next execution time
    this.currentSchedule.nextUpdates.sort((a, b) => a.nextExecution - b.nextExecution);
  }

  private executeScheduleEntry(entry: ScheduleEntry): void {
    try {
      // Record execution
      this.executionHistory.push({
        entryId: entry.id,
        timestamp: Date.now(),
        success: true,
      });

      // Keep only last 1000 executions
      if (this.executionHistory.length > 1000) {
        this.executionHistory = this.executionHistory.slice(-1000);
      }

      logger.debug(`⏰ Executed schedule entry: ${entry.id} (${entry.description})`);
    } catch (error) {
      logger.error(`Failed to execute schedule entry ${entry.id}:`, error);

      this.executionHistory.push({
        entryId: entry.id,
        timestamp: Date.now(),
        success: false,
      });
    }
  }

  private calculatePowerConsumption(): void {
    const policy = this.currentSchedule.policy;
    const totalPowerCost = policy.entries
      .filter(entry => entry.isActive)
      .reduce((sum, entry) => sum + entry.powerCost, 0);

    // Calculate efficiency based on power consumption vs budget
    const efficiency = Math.max(0, Math.min(100, (this.currentSchedule.totalPowerBudget / totalPowerCost) * 100));

    this.currentSchedule.currentConsumption = totalPowerCost;
    this.currentSchedule.efficiency = efficiency;
  }

  // Public API
  public getCurrentSchedule(): PowerSchedule {
    return { ...this.currentSchedule };
  }

  public getPolicies(): SchedulingPolicy[] {
    return Array.from(this.policies.values());
  }

  public getScheduleEntry(entryId: string): ScheduleEntry | null {
    for (const entry of this.schedules.values()) {
      if (entry.id === entryId) {
        return entry;
      }
    }
    return null;
  }

  public updateScheduleEntry(entryId: string, updates: Partial<ScheduleEntry>): boolean {
    const entry = this.getScheduleEntry(entryId);
    if (!entry) return false;

    Object.assign(entry, updates);
    logger.debug(`⏰ Updated schedule entry: ${entryId}`);
    return true;
  }

  public getExecutionHistory(): Array<{ entryId: string; timestamp: number; success: boolean }> {
    return [...this.executionHistory];
  }

  public getScheduleStats(): {
    totalEntries: number;
    activeEntries: number;
    averageInterval: number;
    efficiency: number;
    successRate: number;
  } {
    const entries = Array.from(this.schedules.values());
    const activeEntries = entries.filter(entry => entry.isActive).length;
    const averageInterval = entries.length > 0
      ? entries.reduce((sum, entry) => sum + entry.interval, 0) / entries.length
      : 0;

    const totalExecutions = this.executionHistory.length;
    const successfulExecutions = this.executionHistory.filter(exec => exec.success).length;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 100;

    return {
      totalEntries: entries.length,
      activeEntries,
      averageInterval,
      efficiency: this.currentSchedule.efficiency,
      successRate,
    };
  }

  public addCustomScheduleEntry(entry: ScheduleEntry): void {
    this.schedules.set(entry.id, entry);
    logger.debug(`⏰ Added custom schedule entry: ${entry.id}`);
  }

  public removeScheduleEntry(entryId: string): boolean {
    const removed = this.schedules.delete(entryId);
    if (removed) {
      logger.debug(`⏰ Removed schedule entry: ${entryId}`);
    }
    return removed;
  }

  public getNextUpdates(): ScheduleEntry[] {
    return [...this.currentSchedule.nextUpdates];
  }

  public getPowerBudget(): {
    total: number;
    used: number;
    remaining: number;
    efficiency: number;
  } {
    const total = this.currentSchedule.totalPowerBudget;
    const used = this.currentSchedule.currentConsumption;
    const remaining = Math.max(0, total - used);
    const efficiency = this.currentSchedule.efficiency;

    return { total, used, remaining, efficiency };
  }

  public isActive(): boolean {
    return this.isActive;
  }

  async stop(): Promise<void> {
    logger.debug('⏰ Stopping advanced power scheduler...');

    this.isActive = false;

    if (this.schedulingTimer) {
      clearInterval(this.schedulingTimer);
      this.schedulingTimer = null;
    }

    logger.debug('✅ Advanced power scheduler stopped');
  }
}

// @afetnet: Export singleton instance
export const advancedPowerScheduler = new AdvancedPowerScheduler();





























