import { EventEmitter } from '../utils/events';
import { Preferences } from '../storage/prefs';
import { EEWLocalPWaveEvent, EEWClusterAlertEvent, EEWOfficialAlertEvent } from '../utils/events';

export interface EEWFilterConfig {
  requireQuorum: boolean;
  requireOfficial: boolean;
  deviceCooldownMs: number;
  regionCooldownMs: number;
  silentPrepEnabled: boolean;
  silentPrepThreshold: number; // Minimum devices for silent prep
}

export interface CooldownEntry {
  timestamp: number;
  lat: number;
  lon: number;
  type: 'device' | 'region';
}

export interface SilentPrepEvent {
  timestamp: number;
  deviceCount: number;
  avgStrength: number;
  centerLat: number;
  centerLon: number;
  reason: 'insufficient_devices' | 'cooldown_active' | 'no_quorum';
}

export class EEWFilter {
  private static instance: EEWFilter;
  private eventEmitter = new EventEmitter();
  private config: EEWFilterConfig;
  private cooldownHistory: CooldownEntry[] = [];
  private lastDeviceAlert = 0;
  private lastRegionAlert = 0;
  private alertHistory: Array<{ timestamp: number; lat: number; lon: number }> = [];

  private constructor() {
    this.config = {
      requireQuorum: true,
      requireOfficial: false,
      deviceCooldownMs: 60000, // 1 minute
      regionCooldownMs: 30000, // 30 seconds
      silentPrepEnabled: true,
      silentPrepThreshold: 2, // Show silent prep for 2+ devices
    };
  }

  static getInstance(): EEWFilter {
    if (!EEWFilter.instance) {
      EEWFilter.instance = new EEWFilter();
    }
    return EEWFilter.instance;
  }

  async initialize(): Promise<void> {
    try {
      const savedConfig = await Preferences.get<EEWFilterConfig>('eewFilterConfig');
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
      }

      // Load cooldown history
      const savedCooldowns = await Preferences.get<CooldownEntry[]>('eewCooldownHistory');
      if (savedCooldowns) {
        this.cooldownHistory = savedCooldowns;
      }

      // Clean up old cooldown entries
      this.cleanupCooldownHistory();

      console.log('EEWFilter initialized:', this.config);
    } catch (error) {
      console.error('Failed to initialize EEWFilter:', error);
    }
  }

  async updateConfig(updates: Partial<EEWFilterConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    
    try {
      await Preferences.set('eewFilterConfig', this.config);
    } catch (error) {
      console.error('Failed to save EEW filter config:', error);
    }
  }

  getConfig(): EEWFilterConfig {
    return { ...this.config };
  }

  // Main filtering method
  async filterLocalPWave(
    localEvent: EEWLocalPWaveEvent,
    hasQuorum: boolean = false,
    hasOfficial: boolean = false
  ): Promise<{
    shouldAlert: boolean;
    shouldSilentPrep: boolean;
    reason?: string;
  }> {
    try {
      console.log('Filtering local P-wave event:', {
        strength: localEvent.strength,
        hasQuorum,
        hasOfficial,
        deviceCooldown: Date.now() - this.lastDeviceAlert,
        regionCooldown: Date.now() - this.lastRegionAlert,
      });

      // Check device cooldown
      if (this.isDeviceCooldownActive()) {
        const reason = 'Device cooldown active';
        console.log(reason);
        return { shouldAlert: false, shouldSilentPrep: false, reason };
      }

      // Check region cooldown
      if (this.isRegionCooldownActive(localEvent.lat, localEvent.lon)) {
        const reason = 'Region cooldown active';
        console.log(reason);
        return { shouldAlert: false, shouldSilentPrep: false, reason };
      }

      // Check if official feed is required but not available
      if (this.config.requireOfficial && !hasOfficial) {
        const reason = 'Official feed required but not available';
        console.log(reason);
        
        // Show silent prep if enabled
        if (this.config.silentPrepEnabled) {
          return { shouldAlert: false, shouldSilentPrep: true, reason };
        }
        
        return { shouldAlert: false, shouldSilentPrep: false, reason };
      }

      // Check if quorum is required but not available
      if (this.config.requireQuorum && !hasQuorum) {
        const reason = 'Quorum required but not available';
        console.log(reason);
        
        // Show silent prep if enabled
        if (this.config.silentPrepEnabled) {
          return { shouldAlert: false, shouldSilentPrep: true, reason };
        }
        
        return { shouldAlert: false, shouldSilentPrep: false, reason };
      }

      // All checks passed - should alert
      console.log('Local P-wave event passed all filters');
      return { shouldAlert: true, shouldSilentPrep: false };

    } catch (error) {
      console.error('Error filtering local P-wave event:', error);
      return { shouldAlert: false, shouldSilentPrep: false, reason: 'Filter error' };
    }
  }

  async filterClusterAlert(
    clusterEvent: EEWClusterAlertEvent
  ): Promise<{
    shouldAlert: boolean;
    shouldSilentPrep: boolean;
    reason?: string;
  }> {
    try {
      console.log('Filtering cluster alert:', {
        deviceCount: clusterEvent.deviceCount,
        confidence: clusterEvent.confidence,
        etaSeconds: clusterEvent.etaSeconds,
      });

      // Check device cooldown
      if (this.isDeviceCooldownActive()) {
        const reason = 'Device cooldown active';
        console.log(reason);
        return { shouldAlert: false, shouldSilentPrep: false, reason };
      }

      // Check region cooldown
      if (this.isRegionCooldownActive(clusterEvent.centerLat, clusterEvent.centerLon)) {
        const reason = 'Region cooldown active';
        console.log(reason);
        return { shouldAlert: false, shouldSilentPrep: false, reason };
      }

      // Check confidence threshold
      if (clusterEvent.confidence === 'low' && clusterEvent.deviceCount < 5) {
        const reason = 'Low confidence cluster alert';
        console.log(reason);
        
        // Show silent prep for low confidence
        if (this.config.silentPrepEnabled) {
          return { shouldAlert: false, shouldSilentPrep: true, reason };
        }
        
        return { shouldAlert: false, shouldSilentPrep: false, reason };
      }

      // All checks passed - should alert
      console.log('Cluster alert passed all filters');
      return { shouldAlert: true, shouldSilentPrep: false };

    } catch (error) {
      console.error('Error filtering cluster alert:', error);
      return { shouldAlert: false, shouldSilentPrep: false, reason: 'Filter error' };
    }
  }

  async filterOfficialAlert(
    officialEvent: EEWOfficialAlertEvent
  ): Promise<{
    shouldAlert: boolean;
    shouldSilentPrep: boolean;
    reason?: string;
  }> {
    try {
      console.log('Filtering official alert:', {
        magnitude: officialEvent.magnitude,
        etaSeconds: officialEvent.etaSeconds,
        source: officialEvent.source,
        confidence: officialEvent.confidence,
      });

      // Official alerts have higher priority - only check basic cooldowns
      
      // Check device cooldown (shorter for official alerts)
      if (this.isDeviceCooldownActive(30000)) { // 30 second cooldown for official
        const reason = 'Device cooldown active (official)';
        console.log(reason);
        return { shouldAlert: false, shouldSilentPrep: false, reason };
      }

      // Check region cooldown
      if (this.isRegionCooldownActive(officialEvent.epicenterLat, officialEvent.epicenterLon)) {
        const reason = 'Region cooldown active (official)';
        console.log(reason);
        return { shouldAlert: false, shouldSilentPrep: false, reason };
      }

      // Official alerts should generally pass through
      console.log('Official alert passed all filters');
      return { shouldAlert: true, shouldSilentPrep: false };

    } catch (error) {
      console.error('Error filtering official alert:', error);
      return { shouldAlert: false, shouldSilentPrep: false, reason: 'Filter error' };
    }
  }

  // Cooldown management
  private isDeviceCooldownActive(customCooldownMs?: number): boolean {
    const cooldownMs = customCooldownMs || this.config.deviceCooldownMs;
    return Date.now() - this.lastDeviceAlert < cooldownMs;
  }

  private isRegionCooldownActive(lat: number, lon: number): boolean {
    const cutoffTime = Date.now() - this.config.regionCooldownMs;
    
    return this.alertHistory.some(alert => {
      if (alert.timestamp < cutoffTime) return false;
      
      const distance = this.calculateDistance(lat, lon, alert.lat, alert.lon);
      return distance < 2; // 2km radius for region cooldown
    });
  }

  // Alert tracking
  recordDeviceAlert(): void {
    this.lastDeviceAlert = Date.now();
    this.addCooldownEntry({
      timestamp: Date.now(),
      lat: 0,
      lon: 0,
      type: 'device',
    });
  }

  recordRegionAlert(lat: number, lon: number): void {
    this.lastRegionAlert = Date.now();
    this.alertHistory.push({
      timestamp: Date.now(),
      lat,
      lon,
    });

    // Clean up old alert history
    const cutoffTime = Date.now() - this.config.regionCooldownMs;
    this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > cutoffTime);

    this.addCooldownEntry({
      timestamp: Date.now(),
      lat,
      lon,
      type: 'region',
    });
  }

  private addCooldownEntry(entry: CooldownEntry): void {
    this.cooldownHistory.push(entry);
    this.saveCooldownHistory();
  }

  private async saveCooldownHistory(): Promise<void> {
    try {
      await Preferences.set('eewCooldownHistory', this.cooldownHistory);
    } catch (error) {
      console.error('Failed to save cooldown history:', error);
    }
  }

  private cleanupCooldownHistory(): void {
    const cutoffTime = Date.now() - Math.max(
      this.config.deviceCooldownMs,
      this.config.regionCooldownMs
    ) * 2; // Keep 2x the longest cooldown

    this.cooldownHistory = this.cooldownHistory.filter(
      entry => entry.timestamp > cutoffTime
    );
  }

  // Silent prep handling
  async triggerSilentPrep(
    localEvent: EEWLocalPWaveEvent,
    reason: 'insufficient_devices' | 'cooldown_active' | 'no_quorum',
    deviceCount: number = 1
  ): Promise<void> {
    if (!this.config.silentPrepEnabled) {
      return;
    }

    const silentPrepEvent: SilentPrepEvent = {
      timestamp: Date.now(),
      deviceCount,
      avgStrength: localEvent.strength,
      centerLat: localEvent.lat,
      centerLon: localEvent.lon,
      reason,
    };

    console.log('Triggering silent prep:', silentPrepEvent);
    this.eventEmitter.emit('eew:silent_prep', silentPrepEvent);
  }

  // Utility methods
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Event subscription methods
  on(event: 'eew:silent_prep', listener: (data: SilentPrepEvent) => void): () => void;
  on(event: string, listener: (...args: any[]) => void): () => void {
    return this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  // Getters for debugging
  getLastDeviceAlert(): number {
    return this.lastDeviceAlert;
  }

  getLastRegionAlert(): number {
    return this.lastRegionAlert;
  }

  getCooldownHistory(): CooldownEntry[] {
    return [...this.cooldownHistory];
  }

  getAlertHistory(): Array<{ timestamp: number; lat: number; lon: number }> {
    return [...this.alertHistory];
  }

  // Testing methods
  clearCooldowns(): void {
    this.lastDeviceAlert = 0;
    this.lastRegionAlert = 0;
    this.cooldownHistory = [];
    this.alertHistory = [];
    this.saveCooldownHistory();
  }

  simulateDeviceCooldown(): void {
    this.lastDeviceAlert = Date.now();
  }

  simulateRegionCooldown(lat: number, lon: number): void {
    this.recordRegionAlert(lat, lon);
  }
}

// Export convenience function
export const getEEWFilter = (): EEWFilter => {
  return EEWFilter.getInstance();
};
