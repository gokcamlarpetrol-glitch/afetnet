/**
 * ACTIVITY RECOGNITION SERVICE - ELITE SAFETY GUARD
 * Prevents false earthquake alarms by detecting human activity.
 * 
 * Logic:
 * - If user is Walking/Running (Pedometer) -> IGNORE SEISMIC
 * - If device is Tilting significanly -> IGNORE SEISMIC
 * - Only "STILL" devices can be trusted for EEW.
 */

import { Pedometer } from 'expo-sensors';
import { DeviceMotion } from 'expo-sensors';
import { createLogger } from '../utils/logger';

const logger = createLogger('ActivityRecognitionService');

export type ActivityState = 'STILL' | 'MOVING' | 'UNKNOWN';

class ActivityRecognitionService {
  private isServiceRunning = false;
  private currentActivity: ActivityState = 'UNKNOWN';
  private lastMovementTime = 0;
  private readonly MOVEMENT_TIMEOUT_MS = 10000; // 10 seconds of stillness required

  // Subscriptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private motionSubscription: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pedometerSubscription: any = null;

  async start() {
    if (this.isServiceRunning) return;
    this.isServiceRunning = true;

    logger.info('Starting Activity Recognition Guard...');

    // 1. Pedometer (Walking Detection)
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      if (isAvailable) {
        this.pedometerSubscription = Pedometer.watchStepCount((result) => {
          this.markAsMoving('Walking');
        });
      }
    } catch (e) {
      logger.warn('Pedometer not available:', e);
    }

    // 2. Device Motion (Tilt/Rotation Detection)
    // We look for significant rotation which implies phone is being handled
    DeviceMotion.setUpdateInterval(500); // Check every 500ms
    this.motionSubscription = DeviceMotion.addListener((event) => {
      const { rotationRate } = event;
      if (!rotationRate) return;

      // Threshold for "Handling" the phone
      const THRESHOLD = 0.5; // radians/sec approx
      if (Math.abs(rotationRate.alpha) > THRESHOLD ||
        Math.abs(rotationRate.beta) > THRESHOLD ||
        Math.abs(rotationRate.gamma) > THRESHOLD) {
        this.markAsMoving('Device Handling');
      }
    });
  }

  stop() {
    if (this.pedometerSubscription) this.pedometerSubscription.remove();
    if (this.motionSubscription) this.motionSubscription.remove();
    this.isServiceRunning = false;
    this.pedometerSubscription = null;
    this.motionSubscription = null;
  }

  private markAsMoving(source: string) {
    this.currentActivity = 'MOVING';
    this.lastMovementTime = Date.now();
    // logger.debug(`Activity Detected: ${source} - Seismic Guard Active`);
  }

  /**
     * ELITE: Is the device safe to use as a seismometer?
     * Returns TRUE only if device has been still for MOVEMENT_TIMEOUT_MS.
     */
  isDeviceStill(): boolean {
    const timeSinceMove = Date.now() - this.lastMovementTime;
    const isStill = timeSinceMove > this.MOVEMENT_TIMEOUT_MS;

    // Auto-reset state if enough time passed
    if (isStill && this.currentActivity === 'MOVING') {
      this.currentActivity = 'STILL';
      // logger.debug('Device is now STILL - Seismic Guard Lifted');
    }

    return isStill;
  }

  getStatus() {
    return {
      activity: this.currentActivity,
      lastMovementSecondsAgo: (Date.now() - this.lastMovementTime) / 1000,
      isSeismicAllowed: this.isDeviceStill(),
    };
  }
}

export const activityRecognitionService = new ActivityRecognitionService();
