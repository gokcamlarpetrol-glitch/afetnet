/**
 * HEALTH SERVICE - ELITE EDITION
 * Monitors health data for panic detection and emergency alerts.
 *
 * Features:
 * - Heart Rate Monitoring (via HealthKit/Google Fit)
 * - Panic Detection Algorithm
 * - Automatic SOS Trigger
 * - Health Data Caching
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const logger = createLogger('HealthService');

// Thresholds for panic detection
const PANIC_BPM_THRESHOLD = 120; // Heart rate above this for sustained period
const PANIC_DURATION_MS = 30000; // 30 seconds of elevated heart rate
const REST_BPM_THRESHOLD = 60; // Below this = resting
const SAMPLE_INTERVAL_MS = 5000; // Check every 5 seconds

export interface HealthData {
    heartRate: number | null;
    lastUpdated: number;
    isElevated: boolean;
    isPanic: boolean;
    elevatedSince: number | null;
}

export interface HealthProfile {
    bloodType: string;
    allergies: string[];
    medications: string[];
    emergencyContact: string;
    medicalConditions: string[];
}

class HealthService {
  private isMonitoring = false;
  private healthData: HealthData = {
    heartRate: null,
    lastUpdated: 0,
    isElevated: false,
    isPanic: false,
    elevatedSince: null,
  };
  private panicCallbacks: Array<() => void> = [];
  private monitorInterval: NodeJS.Timeout | null = null;

  /**
     * Start health monitoring
     * Note: Actual HealthKit/Google Fit integration requires native modules
     * This is a framework that can be connected to real health APIs
     */
  async startMonitoring() {
    if (this.isMonitoring) return;

    logger.info('Starting Health Monitoring');
    this.isMonitoring = true;

    // In production, connect to HealthKit (iOS) or Google Fit (Android)
    // For now, we simulate with placeholder
    this.monitorInterval = setInterval(() => {
      this.checkHeartRate();
    }, SAMPLE_INTERVAL_MS);
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
    logger.info('Health Monitoring Stopped');
  }

  /**
     * Register callback for panic detection
     */
  onPanic(callback: () => void) {
    this.panicCallbacks.push(callback);
    return () => {
      const index = this.panicCallbacks.indexOf(callback);
      if (index > -1) this.panicCallbacks.splice(index, 1);
    };
  }

  /**
     * Get current health data
     */
  getHealthData(): HealthData {
    return { ...this.healthData };
  }

  /**
     * Manually report heart rate (for testing or manual input)
     */
  reportHeartRate(bpm: number) {
    this.processHeartRate(bpm);
  }

  /**
     * Save health profile
     */
  async saveProfile(profile: HealthProfile) {
    try {
      await AsyncStorage.setItem('@afetnet:health_profile', JSON.stringify(profile));
      logger.info('Health profile saved');
    } catch (e) {
      logger.error('Failed to save health profile', e);
    }
  }

  /**
     * Load health profile
     */
  async loadProfile(): Promise<HealthProfile | null> {
    try {
      const data = await AsyncStorage.getItem('@afetnet:health_profile');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      logger.error('Failed to load health profile', e);
      return null;
    }
  }

  // Private Methods

  private async checkHeartRate() {
    // In production, this would query HealthKit or Google Fit
    // For now, we just check if manual data was reported
    if (this.healthData.heartRate && Date.now() - this.healthData.lastUpdated < 60000) {
      this.processHeartRate(this.healthData.heartRate);
    }
  }

  private processHeartRate(bpm: number) {
    const now = Date.now();
    this.healthData.heartRate = bpm;
    this.healthData.lastUpdated = now;

    // Check if elevated
    if (bpm >= PANIC_BPM_THRESHOLD) {
      if (!this.healthData.isElevated) {
        this.healthData.isElevated = true;
        this.healthData.elevatedSince = now;
      } else {
        // Check duration
        const duration = now - (this.healthData.elevatedSince || now);
        if (duration >= PANIC_DURATION_MS && !this.healthData.isPanic) {
          this.triggerPanic();
        }
      }
    } else {
      // Heart rate normalized
      this.healthData.isElevated = false;
      this.healthData.isPanic = false;
      this.healthData.elevatedSince = null;
    }
  }

  private triggerPanic() {
    logger.warn('🚨 PANIC DETECTED - Heart rate elevated for extended period');
    this.healthData.isPanic = true;

    // Notify all callbacks
    for (const callback of this.panicCallbacks) {
      try {
        callback();
      } catch (e) {
        logger.error('Panic callback error', e);
      }
    }
  }
}

export const healthService = new HealthService();
