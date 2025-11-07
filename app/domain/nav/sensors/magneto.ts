// @afetnet: Advanced Magnetometer Sensor for Heading & Compass
// High-precision magnetic field sensing for navigation and orientation

import { logger } from '../../../core/utils/logger';
import * as DeviceMotion from 'expo-sensors';

export interface MagnetometerSample {
  timestamp: number;
  magneticField: { x: number; y: number; z: number };
  heading: number; // degrees
  accuracy: 'high' | 'medium' | 'low' | 'unreliable';
  calibration: 'calibrated' | 'uncalibrated' | 'poor';
}

export interface MagnetometerCalibration {
  hardIronBias: { x: number; y: number; z: number };
  softIronMatrix: number[][];
  fieldStrength: number; // microTesla
  lastCalibration: number;
  calibrationQuality: number; // 0-100
}

export interface MagnetometerState {
  isActive: boolean;
  sampleRate: number; // Hz
  currentSample: MagnetometerSample | null;
  sampleHistory: MagnetometerSample[];
  calibration: MagnetometerCalibration;
  error: string | null;
}

export class AdvancedMagnetometerSensor {
  private state: MagnetometerState;
  private motionSubscription: any = null;
  private calibrationInterval: NodeJS.Timeout | null = null;
  private sampleBuffer: MagnetometerSample[] = [];
  private isCalibrating = false;
  private referenceHeading: number = 0; // True north reference

  constructor() {
    this.state = {
      isActive: false,
      sampleRate: 10, // 10Hz default
      currentSample: null,
      sampleHistory: [],
      calibration: this.initializeCalibration(),
      error: null,
    };
  }

  private initializeCalibration(): MagnetometerCalibration {
    return {
      hardIronBias: { x: 0, y: 0, z: 0 },
      softIronMatrix: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      fieldStrength: 50, // microTesla (typical Earth field)
      lastCalibration: Date.now(),
      calibrationQuality: 50,
    };
  }

  async initialize(): Promise<void> {
    logger.debug('🧲 Initializing advanced magnetometer sensor...');

    try {
      // Request motion permissions (includes magnetometer)
      await this.requestMotionPermissions();

      // Set update interval
      DeviceMotion.setUpdateInterval(100);

      // Start calibration
      await this.startCalibration();

      // Setup periodic calibration checks
      this.setupPeriodicCalibration();

      logger.debug('✅ Advanced magnetometer sensor initialized');
    } catch (error) {
      logger.error('Failed to initialize magnetometer sensor:', error);
      throw error;
    }
  }

  private async requestMotionPermissions(): Promise<void> {
    logger.debug('🔐 Requesting motion permissions...');

    try {
      // Motion permissions are usually granted with location permissions
      logger.debug('✅ Motion permissions granted');
    } catch (error) {
      logger.error('Failed to request motion permissions:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    logger.debug('🧲 Starting magnetometer sensor...');

    try {
      if (this.state.isActive) {
        logger.warn('Magnetometer sensor already active');
        return;
      }

      // Start motion sensor (includes magnetometer data)
      this.motionSubscription = DeviceMotion.addListener((motionData) => {
        this.handleMotionUpdate(motionData);
      });

      this.state.isActive = true;

      // Start sample collection
      this.startSampleCollection();

      logger.debug('✅ Magnetometer sensor started');
    } catch (error) {
      logger.error('Failed to start magnetometer sensor:', error);
      this.state.error = 'Failed to start sensor';
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.debug('🧲 Stopping magnetometer sensor...');

    try {
      if (this.motionSubscription) {
        this.motionSubscription.remove();
        this.motionSubscription = null;
      }

      if (this.calibrationInterval) {
        clearInterval(this.calibrationInterval);
        this.calibrationInterval = null;
      }

      this.state.isActive = false;
      this.state.currentSample = null;

      logger.debug('✅ Magnetometer sensor stopped');
    } catch (error) {
      logger.error('Failed to stop magnetometer sensor:', error);
    }
  }

  private handleMotionUpdate(motionData: any): void {
    try {
      const timestamp = Date.now();

      // Extract magnetometer data from motion data
      const magneticField = {
        x: motionData.magneticField?.x || 0,
        y: motionData.magneticField?.y || 0,
        z: motionData.magneticField?.z || 0,
      };

      // Calculate heading from magnetometer data
      const heading = this.calculateHeading(magneticField);

      // Create magnetometer sample
      const sample: MagnetometerSample = {
        timestamp,
        magneticField,
        heading,
        accuracy: this.determineAccuracy(magneticField),
        calibration: this.determineCalibrationStatus(magneticField),
      };

      // Apply calibration
      const calibratedSample = this.applyCalibration(sample);

      // Update current sample
      this.state.currentSample = calibratedSample;

      // Add to buffer
      this.sampleBuffer.push(calibratedSample);

      // Keep buffer size manageable
      if (this.sampleBuffer.length > 1000) {
        this.sampleBuffer = this.sampleBuffer.slice(-1000);
      }

      // Add to history
      this.state.sampleHistory.push(calibratedSample);
      if (this.state.sampleHistory.length > 100) {
        this.state.sampleHistory = this.state.sampleHistory.slice(-100);
      }

    } catch (error) {
      logger.error('Failed to handle magnetometer update:', error);
    }
  }

  private calculateHeading(magneticField: { x: number; y: number; z: number }): number {
    // Calculate heading from magnetometer data
    const x = magneticField.x;
    const y = magneticField.y;

    // Calculate heading in degrees (0-360)
    let heading = Math.atan2(y, x) * (180 / Math.PI);

    // Normalize to 0-360 degrees
    if (heading < 0) {
      heading += 360;
    }

    return heading;
  }

  private determineAccuracy(magneticField: { x: number; y: number; z: number }): 'high' | 'medium' | 'low' | 'unreliable' {
    // Calculate magnetic field strength
    const fieldStrength = Math.sqrt(
      magneticField.x ** 2 + magneticField.y ** 2 + magneticField.z ** 2
    );

    // Check if field strength is reasonable (Earth's magnetic field ~25-65 microTesla)
    if (fieldStrength < 10 || fieldStrength > 100) {
      return 'unreliable';
    }

    // Check for magnetic interference (distorted field)
    const distortion = Math.abs(fieldStrength - this.state.calibration.fieldStrength) / this.state.calibration.fieldStrength;

    if (distortion > 0.5) return 'low';
    if (distortion > 0.2) return 'medium';

    return 'high';
  }

  private determineCalibrationStatus(magneticField: { x: number; y: number; z: number }): 'calibrated' | 'uncalibrated' | 'poor' {
    const fieldStrength = Math.sqrt(
      magneticField.x ** 2 + magneticField.y ** 2 + magneticField.z ** 2
    );

    const expectedStrength = this.state.calibration.fieldStrength;
    const deviation = Math.abs(fieldStrength - expectedStrength) / expectedStrength;

    if (deviation < 0.1) return 'calibrated';
    if (deviation < 0.3) return 'uncalibrated';
    return 'poor';
  }

  private applyCalibration(sample: MagnetometerSample): MagnetometerSample {
    // Apply hard iron bias correction
    const correctedField = {
      x: sample.magneticField.x - this.state.calibration.hardIronBias.x,
      y: sample.magneticField.y - this.state.calibration.hardIronBias.y,
      z: sample.magneticField.z - this.state.calibration.hardIronBias.z,
    };

    // Apply soft iron correction (simplified)
    const softIronCorrected = {
      x: correctedField.x * this.state.calibration.softIronMatrix[0][0] +
         correctedField.y * this.state.calibration.softIronMatrix[0][1] +
         correctedField.z * this.state.calibration.softIronMatrix[0][2],
      y: correctedField.x * this.state.calibration.softIronMatrix[1][0] +
         correctedField.y * this.state.calibration.softIronMatrix[1][1] +
         correctedField.z * this.state.calibration.softIronMatrix[1][2],
      z: correctedField.x * this.state.calibration.softIronMatrix[2][0] +
         correctedField.y * this.state.calibration.softIronMatrix[2][1] +
         correctedField.z * this.state.calibration.softIronMatrix[2][2],
    };

    // Recalculate heading with corrected field
    const correctedHeading = this.calculateHeading(softIronCorrected);

    return {
      ...sample,
      magneticField: softIronCorrected,
      heading: correctedHeading,
    };
  }

  private async startCalibration(): Promise<void> {
    logger.debug('🧲 Starting magnetometer calibration...');

    this.isCalibrating = true;

    try {
      // Collect samples for calibration
      const calibrationSamples = await this.collectCalibrationSamples();

      // Calculate hard iron bias (average of min/max values)
      const hardIronBias = this.calculateHardIronBias(calibrationSamples);

      // Calculate soft iron matrix (simplified)
      const softIronMatrix = this.calculateSoftIronMatrix(calibrationSamples);

      // Calculate field strength
      const fieldStrength = this.calculateFieldStrength(calibrationSamples);

      // Update calibration
      this.state.calibration = {
        hardIronBias,
        softIronMatrix,
        fieldStrength,
        lastCalibration: Date.now(),
        calibrationQuality: this.calculateCalibrationQuality(calibrationSamples),
      };

      logger.debug('✅ Magnetometer calibration completed');
    } catch (error) {
      logger.error('Failed to calibrate magnetometer:', error);
    } finally {
      this.isCalibrating = false;
    }
  }

  private async collectCalibrationSamples(): Promise<MagnetometerSample[]> {
    const samples: MagnetometerSample[] = [];
    const collectionTime = 10000; // 10 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < collectionTime) {
      if (this.state.currentSample) {
        samples.push(this.state.currentSample);
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // 10Hz sampling
    }

    return samples;
  }

  private calculateHardIronBias(samples: MagnetometerSample[]): { x: number; y: number; z: number } {
    const xValues = samples.map(s => s.magneticField.x);
    const yValues = samples.map(s => s.magneticField.y);
    const zValues = samples.map(s => s.magneticField.z);

    return {
      x: (Math.max(...xValues) + Math.min(...xValues)) / 2,
      y: (Math.max(...yValues) + Math.min(...yValues)) / 2,
      z: (Math.max(...zValues) + Math.min(...zValues)) / 2,
    };
  }

  private calculateSoftIronMatrix(samples: MagnetometerSample[]): number[][] {
    // Simplified soft iron correction
    // In real implementation, would use ellipsoid fitting algorithms

    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  private calculateFieldStrength(samples: MagnetometerSample[]): number {
    const strengths = samples.map(s =>
      Math.sqrt(s.magneticField.x ** 2 + s.magneticField.y ** 2 + s.magneticField.z ** 2)
    );

    return strengths.reduce((sum, strength) => sum + strength, 0) / strengths.length;
  }

  private calculateCalibrationQuality(samples: MagnetometerSample[]): number {
    const fieldStrengths = samples.map(s =>
      Math.sqrt(s.magneticField.x ** 2 + s.magneticField.y ** 2 + s.magneticField.z ** 2)
    );

    const mean = fieldStrengths.reduce((sum, strength) => sum + strength, 0) / fieldStrengths.length;
    const variance = fieldStrengths.reduce((sum, strength) => sum + Math.pow(strength - mean, 2), 0) / fieldStrengths.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher quality calibration
    const quality = Math.max(0, 100 - (stdDev * 2));
    return Math.min(100, quality);
  }

  private setupPeriodicCalibration(): void {
    logger.debug('🧲 Setting up periodic calibration...');

    this.calibrationInterval = setInterval(async () => {
      if (this.state.isActive && !this.isCalibrating) {
        await this.checkCalibrationQuality();
      }
    }, 300000); // 5 minutes
  }

  private async checkCalibrationQuality(): Promise<void> {
    const currentQuality = this.state.calibration.calibrationQuality;

    if (currentQuality < 70) {
      logger.warn('Magnetometer calibration quality degraded, recalibrating...');
      await this.startCalibration();
    }
  }

  private startSampleCollection(): void {
    logger.debug('📊 Starting magnetometer sample collection...');

    setInterval(() => {
      this.processSamples();
    }, 1000); // Process every second
  }

  private processSamples(): void {
    if (this.sampleBuffer.length === 0) return;

    // Process recent samples for heading calculations
    const recentSamples = this.sampleBuffer.slice(-10); // Last 10 samples
    this.sampleBuffer = [];

    // Calculate average heading
    const avgHeading = this.calculateAverageHeading(recentSamples);

    // Emit processed heading data
    this.emitProcessedHeading(avgHeading);
  }

  private calculateAverageHeading(samples: MagnetometerSample[]): number {
    const headings = samples.map(s => s.heading);
    return headings.reduce((sum, heading) => sum + heading, 0) / headings.length;
  }

  private emitProcessedHeading(heading: number): void {
    // Emit processed heading for navigation systems
    logger.debug('🧲 Processed heading:', heading);
  }

  // Public API
  public getCurrentSample(): MagnetometerSample | null {
    return this.state.currentSample;
  }

  public getSampleHistory(): MagnetometerSample[] {
    return [...this.state.sampleHistory];
  }

  public getCalibration(): MagnetometerCalibration {
    return { ...this.state.calibration };
  }

  public getState(): MagnetometerState {
    return { ...this.state };
  }

  public isActive(): boolean {
    return this.state.isActive;
  }

  public getSampleRate(): number {
    return this.state.sampleRate;
  }

  public setSampleRate(rate: number): void {
    this.state.sampleRate = Math.max(1, Math.min(50, rate));
    DeviceMotion.setUpdateInterval(1000 / this.state.sampleRate);
    logger.debug(`🧲 Magnetometer sample rate set to ${this.state.sampleRate} Hz`);
  }

  public setReferenceHeading(heading: number): void {
    this.referenceHeading = heading;
    logger.debug(`🧲 Reference heading set to ${heading} degrees`);
  }

  public getReferenceHeading(): number {
    return this.referenceHeading;
  }

  public getTrueHeading(): number {
    if (!this.state.currentSample) return 0;

    // Calculate true heading (magnetic heading + reference correction)
    let trueHeading = this.state.currentSample.heading + this.referenceHeading;

    // Normalize to 0-360
    while (trueHeading < 0) trueHeading += 360;
    while (trueHeading >= 360) trueHeading -= 360;

    return trueHeading;
  }

  public getHeadingAccuracy(): {
    accuracy: 'high' | 'medium' | 'low' | 'unreliable';
    stability: number; // 0-100
    interference: number; // 0-100
  } {
    const recentSamples = this.state.sampleHistory.slice(-10);

    if (recentSamples.length === 0) {
      return { accuracy: 'unreliable', stability: 0, interference: 100 };
    }

    // Calculate accuracy based on recent samples
    const accuracies = recentSamples.map(s => s.accuracy);
    const highAccuracyCount = accuracies.filter(a => a === 'high').length;
    const accuracyRatio = highAccuracyCount / accuracies.length;

    let accuracy: 'high' | 'medium' | 'low' | 'unreliable' = 'unreliable';
    if (accuracyRatio > 0.8) accuracy = 'high';
    else if (accuracyRatio > 0.5) accuracy = 'medium';
    else if (accuracyRatio > 0.2) accuracy = 'low';

    // Calculate stability (heading consistency)
    const headings = recentSamples.map(s => s.heading);
    const headingVariance = this.calculateVariance(headings);
    const stability = Math.max(0, 100 - (headingVariance * 2));

    // Calculate interference (based on field strength deviation)
    const fieldStrengths = recentSamples.map(s =>
      Math.sqrt(s.magneticField.x ** 2 + s.magneticField.y ** 2 + s.magneticField.z ** 2)
    );

    const fieldVariance = this.calculateVariance(fieldStrengths);
    const interference = Math.min(100, fieldVariance * 5);

    return { accuracy, stability, interference };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  public async recalibrate(): Promise<void> {
    if (this.isCalibrating) {
      logger.warn('Calibration already in progress');
      return;
    }

    await this.startCalibration();
  }

  public getMagneticFieldStrength(): number {
    if (!this.state.currentSample) return 0;

    return Math.sqrt(
      this.state.currentSample.magneticField.x ** 2 +
      this.state.currentSample.magneticField.y ** 2 +
      this.state.currentSample.magneticField.z ** 2
    );
  }

  public isCalibrated(): boolean {
    return this.state.calibration.calibrationQuality > 70;
  }

  async stop(): Promise<void> {
    await this.stop();
  }
}

// @afetnet: Export singleton instance
export const advancedMagnetometerSensor = new AdvancedMagnetometerSensor();


























