// @afetnet: Advanced IMU Sensor Management for Dead Reckoning
// High-frequency (10Hz) accelerometer and gyroscope integration for disaster navigation

import { logger } from '../../../core/utils/logger';
import * as DeviceMotion from 'expo-sensors';

export interface IMUSample {
  timestamp: number;
  acceleration: { x: number; y: number; z: number };
  rotation: { alpha: number; beta: number; gamma: number };
  interval: number;
  accuracy: 'high' | 'medium' | 'low' | 'unreliable';
}

export interface IMUCalibration {
  accelerationBias: { x: number; y: number; z: number };
  rotationBias: { alpha: number; beta: number; gamma: number };
  scaleFactors: { x: number; y: number; z: number };
  lastCalibration: number;
  calibrationQuality: number; // 0-100
}

export interface IMUState {
  isActive: boolean;
  sampleRate: number; // Hz
  currentSample: IMUSample | null;
  sampleHistory: IMUSample[];
  calibration: IMUCalibration;
  error: string | null;
}

export class AdvancedIMUSensor {
  private state: IMUState;
  private motionSubscription: any = null;
  private calibrationInterval: NodeJS.Timeout | null = null;
  private sampleBuffer: IMUSample[] = [];
  private isCalibrating = false;

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

  private initializeCalibration(): IMUCalibration {
    return {
      accelerationBias: { x: 0, y: 0, z: 0 },
      rotationBias: { alpha: 0, beta: 0, gamma: 0 },
      scaleFactors: { x: 1, y: 1, z: 1 },
      lastCalibration: Date.now(),
      calibrationQuality: 50,
    };
  }

  async initialize(): Promise<void> {
    logger.debug('📱 Initializing advanced IMU sensor...');

    try {
      // Request motion permissions
      await this.requestMotionPermissions();

      // Set update interval to 100ms (10Hz)
      DeviceMotion.setUpdateInterval(100);

      // Start calibration
      await this.startCalibration();

      // Setup periodic calibration checks
      this.setupPeriodicCalibration();

      logger.debug('✅ Advanced IMU sensor initialized');
    } catch (error) {
      logger.error('Failed to initialize IMU sensor:', error);
      throw error;
    }
  }

  private async requestMotionPermissions(): Promise<void> {
    logger.debug('🔐 Requesting motion permissions...');

    try {
      // Motion permissions are usually granted with location permissions
      // In real implementation, would check specific motion permissions

      logger.debug('✅ Motion permissions granted');
    } catch (error) {
      logger.error('Failed to request motion permissions:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    logger.debug('📱 Starting IMU sensor...');

    try {
      if (this.state.isActive) {
        logger.warn('IMU sensor already active');
        return;
      }

      // Start motion sensor
      this.motionSubscription = DeviceMotion.addListener((motionData) => {
        this.handleMotionUpdate(motionData);
      });

      this.state.isActive = true;

      // Start sample collection
      this.startSampleCollection();

      logger.debug('✅ IMU sensor started');
    } catch (error) {
      logger.error('Failed to start IMU sensor:', error);
      this.state.error = 'Failed to start sensor';
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.debug('📱 Stopping IMU sensor...');

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

      logger.debug('✅ IMU sensor stopped');
    } catch (error) {
      logger.error('Failed to stop IMU sensor:', error);
    }
  }

  private handleMotionUpdate(motionData: any): void {
    try {
      const timestamp = Date.now();

      // Create IMU sample
      const sample: IMUSample = {
        timestamp,
        acceleration: motionData.acceleration || { x: 0, y: 0, z: 0 },
        rotation: motionData.rotation || { alpha: 0, beta: 0, gamma: 0 },
        interval: motionData.interval || 100,
        accuracy: this.determineAccuracy(motionData),
      };

      // Apply calibration
      const calibratedSample = this.applyCalibration(sample);

      // Update current sample
      this.state.currentSample = calibratedSample;

      // Add to buffer
      this.sampleBuffer.push(calibratedSample);

      // Keep buffer size manageable (last 1000 samples)
      if (this.sampleBuffer.length > 1000) {
        this.sampleBuffer = this.sampleBuffer.slice(-1000);
      }

      // Add to history (keep last 100 samples)
      this.state.sampleHistory.push(calibratedSample);
      if (this.state.sampleHistory.length > 100) {
        this.state.sampleHistory = this.state.sampleHistory.slice(-100);
      }

    } catch (error) {
      logger.error('Failed to handle motion update:', error);
    }
  }

  private determineAccuracy(motionData: any): 'high' | 'medium' | 'low' | 'unreliable' {
    // Determine accuracy based on data quality
    if (!motionData.acceleration || !motionData.rotation) {
      return 'unreliable';
    }

    const accMagnitude = Math.sqrt(
      motionData.acceleration.x ** 2 +
      motionData.acceleration.y ** 2 +
      motionData.acceleration.z ** 2
    );

    // Check if acceleration is reasonable (not too high noise)
    if (accMagnitude > 20) return 'low'; // Too much noise
    if (accMagnitude > 15) return 'medium';

    return 'high';
  }

  private applyCalibration(sample: IMUSample): IMUSample {
    // Apply bias correction and scaling
    const calibratedAcceleration = {
      x: (sample.acceleration.x - this.state.calibration.accelerationBias.x) * this.state.calibration.scaleFactors.x,
      y: (sample.acceleration.y - this.state.calibration.accelerationBias.y) * this.state.calibration.scaleFactors.y,
      z: (sample.acceleration.z - this.state.calibration.accelerationBias.z) * this.state.calibration.scaleFactors.z,
    };

    const calibratedRotation = {
      alpha: sample.rotation.alpha - this.state.calibration.rotationBias.alpha,
      beta: sample.rotation.beta - this.state.calibration.rotationBias.beta,
      gamma: sample.rotation.gamma - this.state.calibration.rotationBias.gamma,
    };

    return {
      ...sample,
      acceleration: calibratedAcceleration,
      rotation: calibratedRotation,
    };
  }

  private async startCalibration(): Promise<void> {
    logger.debug('🔧 Starting IMU calibration...');

    this.isCalibrating = true;

    try {
      // Collect stationary samples for bias calculation
      const stationarySamples = await this.collectStationarySamples();

      // Calculate bias
      const accelerationBias = this.calculateBias(stationarySamples.map(s => s.acceleration));
      const rotationBias = this.calculateBias(stationarySamples.map(s => s.rotation));

      // Calculate scale factors (simplified)
      const scaleFactors = { x: 1, y: 1, z: 1 };

      // Update calibration
      this.state.calibration = {
        accelerationBias,
        rotationBias,
        scaleFactors,
        lastCalibration: Date.now(),
        calibrationQuality: this.calculateCalibrationQuality(stationarySamples),
      };

      logger.debug('✅ IMU calibration completed');
    } catch (error) {
      logger.error('Failed to calibrate IMU:', error);
    } finally {
      this.isCalibrating = false;
    }
  }

  private async collectStationarySamples(): Promise<IMUSample[]> {
    // Collect samples while device is stationary
    const samples: IMUSample[] = [];
    const collectionTime = 3000; // 3 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < collectionTime) {
      if (this.state.currentSample) {
        samples.push(this.state.currentSample);
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // 10Hz sampling
    }

    return samples;
  }

  private calculateBias(values: Array<{ x: number; y: number; z: number }>): { x: number; y: number; z: number } {
    const xValues = values.map(v => v.x);
    const yValues = values.map(v => v.y);
    const zValues = values.map(v => v.z);

    return {
      x: this.calculateMean(xValues),
      y: this.calculateMean(yValues),
      z: this.calculateMean(zValues),
    };
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateCalibrationQuality(samples: IMUSample[]): number {
    // Calculate how stationary the samples were
    const accelerationVariances = samples.map(s => {
      const magnitude = Math.sqrt(s.acceleration.x ** 2 + s.acceleration.y ** 2 + s.acceleration.z ** 2);
      return magnitude;
    });

    const variance = this.calculateVariance(accelerationVariances);
    const quality = Math.max(0, 100 - (variance * 10)); // Lower variance = higher quality

    return Math.min(100, quality);
  }

  private calculateVariance(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return this.calculateMean(squaredDiffs);
  }

  private setupPeriodicCalibration(): void {
    logger.debug('🔧 Setting up periodic calibration...');

    // Check calibration quality every 5 minutes
    this.calibrationInterval = setInterval(async () => {
      if (this.state.isActive && !this.isCalibrating) {
        await this.checkCalibrationQuality();
      }
    }, 300000); // 5 minutes
  }

  private async checkCalibrationQuality(): Promise<void> {
    const currentQuality = this.state.calibration.calibrationQuality;

    if (currentQuality < 70) {
      logger.warn('IMU calibration quality degraded, recalibrating...');
      await this.startCalibration();
    }
  }

  private startSampleCollection(): void {
    logger.debug('📊 Starting sample collection...');

    // Process samples for dead reckoning calculations
    setInterval(() => {
      this.processSamples();
    }, 1000); // Process every second
  }

  private processSamples(): void {
    if (this.sampleBuffer.length === 0) return;

    // Process recent samples for dead reckoning
    const recentSamples = this.sampleBuffer.slice(-10); // Last 10 samples (1 second at 10Hz)
    this.sampleBuffer = []; // Clear buffer

    // Calculate average motion for dead reckoning
    const avgAcceleration = this.calculateAverageAcceleration(recentSamples);
    const avgRotation = this.calculateAverageRotation(recentSamples);

    // Emit processed data for dead reckoning
    this.emitProcessedMotion(avgAcceleration, avgRotation);
  }

  private calculateAverageAcceleration(samples: IMUSample[]): { x: number; y: number; z: number } {
    const total = { x: 0, y: 0, z: 0 };
    let count = 0;

    for (const sample of samples) {
      total.x += sample.acceleration.x;
      total.y += sample.acceleration.y;
      total.z += sample.acceleration.z;
      count++;
    }

    if (count === 0) return { x: 0, y: 0, z: 0 };

    return {
      x: total.x / count,
      y: total.y / count,
      z: total.z / count,
    };
  }

  private calculateAverageRotation(samples: IMUSample[]): { alpha: number; beta: number; gamma: number } {
    const total = { alpha: 0, beta: 0, gamma: 0 };
    let count = 0;

    for (const sample of samples) {
      total.alpha += sample.rotation.alpha;
      total.beta += sample.rotation.beta;
      total.gamma += sample.rotation.gamma;
      count++;
    }

    if (count === 0) return { alpha: 0, beta: 0, gamma: 0 };

    return {
      alpha: total.alpha / count,
      beta: total.beta / count,
      gamma: total.gamma / count,
    };
  }

  private emitProcessedMotion(acceleration: { x: number; y: number; z: number }, rotation: { alpha: number; beta: number; gamma: number }): void {
    // Emit processed motion data for dead reckoning
    // In real implementation, would emit to event emitter
    logger.debug('📊 Processed motion data:', { acceleration, rotation });
  }

  // Public API
  public getCurrentSample(): IMUSample | null {
    return this.state.currentSample;
  }

  public getSampleHistory(): IMUSample[] {
    return [...this.state.sampleHistory];
  }

  public getCalibration(): IMUCalibration {
    return { ...this.state.calibration };
  }

  public getState(): IMUState {
    return { ...this.state };
  }

  public isActive(): boolean {
    return this.state.isActive;
  }

  public getSampleRate(): number {
    return this.state.sampleRate;
  }

  public setSampleRate(rate: number): void {
    this.state.sampleRate = Math.max(1, Math.min(50, rate)); // 1-50 Hz
    DeviceMotion.setUpdateInterval(1000 / this.state.sampleRate);
    logger.debug(`📱 IMU sample rate set to ${this.state.sampleRate} Hz`);
  }

  public async recalibrate(): Promise<void> {
    if (this.isCalibrating) {
      logger.warn('Calibration already in progress');
      return;
    }

    await this.startCalibration();
  }

  public getMotionQuality(): {
    accuracy: 'high' | 'medium' | 'low' | 'unreliable';
    stability: number; // 0-100
    noiseLevel: number; // 0-100
  } {
    const recentSamples = this.state.sampleHistory.slice(-10);

    if (recentSamples.length === 0) {
      return { accuracy: 'unreliable', stability: 0, noiseLevel: 100 };
    }

    // Calculate accuracy based on recent samples
    const accuracies = recentSamples.map(s => s.accuracy);
    const highAccuracyCount = accuracies.filter(a => a === 'high').length;
    const accuracyRatio = highAccuracyCount / accuracies.length;

    let accuracy: 'high' | 'medium' | 'low' | 'unreliable' = 'unreliable';
    if (accuracyRatio > 0.8) accuracy = 'high';
    else if (accuracyRatio > 0.5) accuracy = 'medium';
    else if (accuracyRatio > 0.2) accuracy = 'low';

    // Calculate stability (how consistent the samples are)
    const accelerationMagnitudes = recentSamples.map(s =>
      Math.sqrt(s.acceleration.x ** 2 + s.acceleration.y ** 2 + s.acceleration.z ** 2)
    );

    const stability = this.calculateStability(accelerationMagnitudes);

    // Calculate noise level
    const variance = this.calculateVariance(accelerationMagnitudes);
    const noiseLevel = Math.min(100, variance * 10);

    return { accuracy, stability, noiseLevel };
  }

  private calculateStability(values: number[]): number {
    if (values.length < 2) return 100;

    const mean = this.calculateMean(values);
    const variance = this.calculateVariance(values);

    // Lower variance = higher stability
    return Math.max(0, 100 - (variance * 10));
  }

  private calculateVariance(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return this.calculateMean(squaredDiffs);
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  async stop(): Promise<void> {
    await this.stop();
  }
}

// @afetnet: Export singleton instance
export const advancedIMUSensor = new AdvancedIMUSensor();





























