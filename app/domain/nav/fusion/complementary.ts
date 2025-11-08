// @afetnet: Complementary Filter Sensor Fusion for Dead Reckoning
// Combines accelerometer, gyroscope, and magnetometer data for accurate orientation

import { logger } from '../../../core/utils/logger';
import { advancedIMUSensor, IMUSample } from '../sensors/imu';
import { advancedMagnetometerSensor, MagnetometerSample } from '../sensors/magneto';

export interface OrientationState {
  roll: number; // degrees
  pitch: number; // degrees
  yaw: number; // degrees
  confidence: number; // 0-100
  timestamp: number;
  fusionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface ComplementaryFilterConfig {
  alpha: number; // Complementary filter coefficient (0-1)
  gyroWeight: number; // Weight for gyroscope data
  accelWeight: number; // Weight for accelerometer data
  magnetoWeight: number; // Weight for magnetometer data
  driftCorrectionRate: number; // How quickly to correct drift
}

export class ComplementaryFilterFusion {
  private orientationState: OrientationState;
  private config: ComplementaryFilterConfig;
  private previousTime: number = 0;
  private isInitialized = false;

  constructor() {
    this.config = {
      alpha: 0.98, // High weight for gyroscope (low-pass for accel/magneto)
      gyroWeight: 0.98,
      accelWeight: 0.02,
      magnetoWeight: 0.02,
      driftCorrectionRate: 0.001, // Very slow drift correction
    };

    this.orientationState = {
      roll: 0,
      pitch: 0,
      yaw: 0,
      confidence: 0,
      timestamp: Date.now(),
      fusionQuality: 'poor',
    };
  }

  async initialize(): Promise<void> {
    logger.debug('🔄 Initializing complementary filter fusion...');

    try {
      // Wait for sensors to initialize
      await Promise.all([
        advancedIMUSensor.initialize(),
        advancedMagnetometerSensor.initialize(),
      ]);

      // Initialize with current sensor data
      await this.initializeOrientation();

      this.isInitialized = true;
      logger.debug('✅ Complementary filter fusion initialized');
    } catch (error) {
      logger.error('Failed to initialize complementary filter:', error);
      throw error;
    }
  }

  private async initializeOrientation(): Promise<void> {
    try {
      // Get initial sensor readings
      const imuSample = advancedIMUSensor.getCurrentSample();
      const magnetoSample = advancedMagnetometerSensor.getCurrentSample();

      if (imuSample && magnetoSample) {
        // Initialize orientation from accelerometer and magnetometer
        const initialRoll = this.calculateRollFromAccel(imuSample.acceleration);
        const initialPitch = this.calculatePitchFromAccel(imuSample.acceleration);
        const initialYaw = magnetoSample.heading;

        this.orientationState = {
          roll: initialRoll,
          pitch: initialPitch,
          yaw: initialYaw,
          confidence: 80, // Good initial confidence
          timestamp: Date.now(),
          fusionQuality: 'good',
        };

        this.previousTime = Date.now();
        logger.debug('✅ Initial orientation calculated');
      } else {
        logger.warn('Insufficient sensor data for initialization');
      }
    } catch (error) {
      logger.error('Failed to initialize orientation:', error);
    }
  }

  async update(): Promise<OrientationState> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const currentTime = Date.now();
      const deltaTime = (currentTime - this.previousTime) / 1000; // seconds

      if (deltaTime < 0.001) return this.orientationState; // Too frequent updates

      // Get current sensor data
      const imuSample = advancedIMUSensor.getCurrentSample();
      const magnetoSample = advancedMagnetometerSensor.getCurrentSample();

      if (!imuSample) {
        return this.orientationState;
      }

      // Calculate gyro-based orientation change
      const gyroDeltaRoll = imuSample.rotation.beta * deltaTime; // Simplified
      const gyroDeltaPitch = imuSample.rotation.gamma * deltaTime; // Simplified
      const gyroDeltaYaw = imuSample.rotation.alpha * deltaTime; // Simplified

      // Apply complementary filter
      const filteredRoll = this.applyComplementaryFilter(
        this.orientationState.roll + gyroDeltaRoll,
        this.calculateRollFromAccel(imuSample.acceleration),
        this.config.gyroWeight,
        this.config.accelWeight
      );

      const filteredPitch = this.applyComplementaryFilter(
        this.orientationState.pitch + gyroDeltaPitch,
        this.calculatePitchFromAccel(imuSample.acceleration),
        this.config.gyroWeight,
        this.config.accelWeight
      );

      const filteredYaw = this.applyComplementaryFilter(
        this.orientationState.yaw + gyroDeltaYaw,
        magnetoSample?.heading || this.orientationState.yaw,
        this.config.gyroWeight,
        this.config.magnetoWeight
      );

      // Apply drift correction
      const correctedOrientation = this.applyDriftCorrection({
        roll: filteredRoll,
        pitch: filteredPitch,
        yaw: filteredYaw,
      });

      // Update state
      this.orientationState = {
        roll: correctedOrientation.roll,
        pitch: correctedOrientation.pitch,
        yaw: correctedOrientation.yaw,
        confidence: this.calculateConfidence(imuSample, magnetoSample),
        timestamp: currentTime,
        fusionQuality: this.determineFusionQuality(imuSample, magnetoSample),
      };

      this.previousTime = currentTime;

      return this.orientationState;
    } catch (error) {
      logger.error('Failed to update complementary filter:', error);
      return this.orientationState;
    }
  }

  private calculateRollFromAccel(acceleration: { x: number; y: number; z: number }): number {
    // Calculate roll from accelerometer data
    const roll = Math.atan2(acceleration.y, acceleration.z) * (180 / Math.PI);
    return roll;
  }

  private calculatePitchFromAccel(acceleration: { x: number; y: number; z: number }): number {
    // Calculate pitch from accelerometer data
    const pitch = Math.atan2(-acceleration.x, Math.sqrt(acceleration.y ** 2 + acceleration.z ** 2)) * (180 / Math.PI);
    return pitch;
  }

  private applyComplementaryFilter(gyroValue: number, accelValue: number, gyroWeight: number, accelWeight: number): number {
    // Complementary filter: high-pass gyro + low-pass accel
    return gyroWeight * gyroValue + accelWeight * accelValue;
  }

  private applyDriftCorrection(orientation: { roll: number; pitch: number; yaw: number }): { roll: number; pitch: number; yaw: number } {
    // Apply slow drift correction to prevent gyro drift accumulation
    const correctionRate = this.config.driftCorrectionRate;

    // Correct towards reference values (simplified)
    const correctedRoll = orientation.roll * (1 - correctionRate);
    const correctedPitch = orientation.pitch * (1 - correctionRate);
    const correctedYaw = orientation.yaw * (1 - correctionRate);

    return {
      roll: correctedRoll,
      pitch: correctedPitch,
      yaw: correctedYaw,
    };
  }

  private calculateConfidence(imuSample: IMUSample, magnetoSample: MagnetometerSample | null): number {
    let confidence = 80; // Base confidence

    // Reduce confidence if sensor data is poor
    if (imuSample.accuracy === 'unreliable') confidence -= 30;
    if (imuSample.accuracy === 'low') confidence -= 15;

    if (magnetoSample) {
      if (magnetoSample.accuracy === 'unreliable') confidence -= 20;
      if (magnetoSample.accuracy === 'low') confidence -= 10;
    } else {
      confidence -= 15; // No magnetometer data
    }

    return Math.max(0, Math.min(100, confidence));
  }

  private determineFusionQuality(imuSample: IMUSample, magnetoSample: MagnetometerSample | null): 'excellent' | 'good' | 'fair' | 'poor' {
    const confidence = this.calculateConfidence(imuSample, magnetoSample);

    if (confidence > 90) return 'excellent';
    if (confidence > 70) return 'good';
    if (confidence > 50) return 'fair';
    return 'poor';
  }

  // Public API
  public getCurrentOrientation(): OrientationState {
    return { ...this.orientationState };
  }

  public getConfig(): ComplementaryFilterConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<ComplementaryFilterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.debug('Complementary filter config updated');
  }

  public resetOrientation(): void {
    this.orientationState = {
      roll: 0,
      pitch: 0,
      yaw: 0,
      confidence: 0,
      timestamp: Date.now(),
      fusionQuality: 'poor',
    };
    this.previousTime = Date.now();
    logger.debug('Orientation reset');
  }

  public getFusionQuality(): {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    confidence: number;
    sensorStatus: {
      imu: boolean;
      magneto: boolean;
    };
  } {
    const imuActive = advancedIMUSensor.isActive();
    const magnetoActive = advancedMagnetometerSensor.isActive();

    return {
      quality: this.orientationState.fusionQuality,
      confidence: this.orientationState.confidence,
      sensorStatus: {
        imu: imuActive,
        magneto: magnetoActive,
      },
    };
  }

  public async recalibrate(): Promise<void> {
    logger.debug('🔄 Recalibrating complementary filter...');

    await this.initializeOrientation();
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping complementary filter fusion...');

    // Sensors will be stopped by their respective managers
    logger.debug('✅ Complementary filter fusion stopped');
  }
}

// @afetnet: Export singleton instance
export const complementaryFilterFusion = new ComplementaryFilterFusion();




























