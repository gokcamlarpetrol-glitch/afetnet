// @afetnet: Advanced Dead Reckoning Navigation System
// Combines sensor fusion with step detection and drift correction for GPS-independent positioning

import { logger } from '../../../core/utils/logger';
import { advancedIMUSensor, IMUSample } from '../sensors/imu';
import { advancedMagnetometerSensor, MagnetometerSample } from '../sensors/magneto';
import { advancedGPSSensor, GPSSample } from '../sensors/gps';
import { complementaryFilterFusion, OrientationState } from './complementary';

export interface DeadReckoningState {
  position: { lat: number; lon: number; alt: number };
  velocity: { x: number; y: number; z: number };
  orientation: OrientationState;
  stepCount: number;
  distance: number; // meters
  confidence: number; // 0-100
  lastUpdate: number;
  calibrationPoints: CalibrationPoint[];
  driftCorrection: { lat: number; lon: number; alt: number };
}

export interface CalibrationPoint {
  position: { lat: number; lon: number; alt: number };
  timestamp: number;
  accuracy: number;
  source: 'gps' | 'anchor' | 'mesh';
}

export interface StepEvent {
  timestamp: number;
  stepLength: number; // meters
  heading: number; // degrees
  confidence: number;
}

export class AdvancedDeadReckoningSystem {
  private state: DeadReckoningState;
  private stepDetector: StepDetector;
  private driftCorrector: DriftCorrector;
  private isActive = false;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.state = this.initializeDeadReckoningState();
    this.stepDetector = new StepDetector();
    this.driftCorrector = new DriftCorrector();
  }

  private initializeDeadReckoningState(): DeadReckoningState {
    return {
      position: { lat: 0, lon: 0, alt: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      orientation: {
        roll: 0,
        pitch: 0,
        yaw: 0,
        confidence: 0,
        timestamp: Date.now(),
        fusionQuality: 'poor',
      },
      stepCount: 0,
      distance: 0,
      confidence: 0,
      lastUpdate: Date.now(),
      calibrationPoints: [],
      driftCorrection: { lat: 0, lon: 0, alt: 0 },
    };
  }

  async initialize(): Promise<void> {
    logger.debug('🧭 Initializing advanced dead reckoning system...');

    try {
      // Initialize sensors
      await Promise.all([
        advancedIMUSensor.initialize(),
        advancedMagnetometerSensor.initialize(),
        advancedGPSSensor.initialize(),
        complementaryFilterFusion.initialize(),
      ]);

      // Initialize step detector
      await this.stepDetector.initialize();

      // Initialize drift corrector
      await this.driftCorrector.initialize();

      // Start periodic updates
      this.startPeriodicUpdates();

      this.isActive = true;
      logger.debug('✅ Advanced dead reckoning system initialized');
    } catch (error) {
      logger.error('Failed to initialize dead reckoning system:', error);
      throw error;
    }
  }

  private startPeriodicUpdates(): void {
    logger.debug('⏰ Starting dead reckoning updates...');

    this.updateInterval = setInterval(() => {
      if (this.isActive) {
        this.updateDeadReckoning();
      }
    }, 100); // 10Hz updates
  }

  private updateDeadReckoning(): void {
    try {
      const currentTime = Date.now();
      const deltaTime = (currentTime - this.state.lastUpdate) / 1000; // seconds

      if (deltaTime < 0.001) return; // Too frequent

      // Update orientation from complementary filter
      const orientation = complementaryFilterFusion.getCurrentOrientation();
      this.state.orientation = orientation;

      // Get sensor data
      const imuSample = advancedIMUSensor.getCurrentSample();
      const magnetoSample = advancedMagnetometerSensor.getCurrentSample();

      if (imuSample) {
        // Update velocity from IMU
        this.updateVelocityFromIMU(imuSample, deltaTime);

        // Detect steps
        const stepEvent = this.stepDetector.detectStep(imuSample, this.state.orientation);
        if (stepEvent) {
          this.handleStepEvent(stepEvent);
        }
      }

      // Apply drift correction
      this.applyDriftCorrection();

      // Update confidence
      this.updateConfidence();

      this.state.lastUpdate = currentTime;

    } catch (error) {
      logger.error('Failed to update dead reckoning:', error);
    }
  }

  private updateVelocityFromIMU(imuSample: IMUSample, deltaTime: number): void {
    // Update velocity based on acceleration
    const acceleration = imuSample.acceleration;

    // Apply complementary filter orientation
    const roll = this.state.orientation.roll * Math.PI / 180;
    const pitch = this.state.orientation.pitch * Math.PI / 180;

    // Transform acceleration to world frame
    const worldAccel = {
      x: acceleration.x * Math.cos(pitch) * Math.cos(roll) +
         acceleration.y * Math.sin(roll) +
         acceleration.z * (-Math.sin(pitch) * Math.cos(roll)),
      y: acceleration.y * Math.cos(roll) - acceleration.x * Math.sin(roll),
      z: acceleration.z * Math.cos(pitch) + acceleration.x * Math.sin(pitch),
    };

    // Update velocity (simple integration)
    this.state.velocity.x += worldAccel.x * deltaTime;
    this.state.velocity.y += worldAccel.y * deltaTime;
    this.state.velocity.z += worldAccel.z * deltaTime;

    // Apply damping to prevent velocity drift
    const damping = 0.95;
    this.state.velocity.x *= damping;
    this.state.velocity.y *= damping;
    this.state.velocity.z *= damping;
  }

  private handleStepEvent(stepEvent: StepEvent): void {
    // Update position based on step
    const headingRad = (this.state.orientation.yaw + stepEvent.heading) * Math.PI / 180;

    const deltaLat = (stepEvent.stepLength * Math.cos(headingRad)) / 111320; // meters to degrees
    const deltaLon = (stepEvent.stepLength * Math.sin(headingRad)) / (111320 * Math.cos(this.state.position.lat * Math.PI / 180));

    this.state.position.lat += deltaLat;
    this.state.position.lon += deltaLon;
    this.state.distance += stepEvent.stepLength;
    this.state.stepCount++;

    logger.debug(`👣 Step detected: ${stepEvent.stepLength.toFixed(2)}m at ${stepEvent.heading.toFixed(1)}°`);
  }

  private applyDriftCorrection(): void {
    // Apply drift correction from calibration points
    if (this.state.calibrationPoints.length > 0) {
      const latestCalibration = this.state.calibrationPoints[this.state.calibrationPoints.length - 1];

      const timeSinceCalibration = (Date.now() - latestCalibration.timestamp) / 1000; // seconds
      const driftRate = this.driftCorrector.getDriftRate();

      // Apply gradual drift correction
      const correctionFactor = Math.min(1, timeSinceCalibration / 300); // Max 5 minutes

      this.state.driftCorrection.lat = driftRate.lat * correctionFactor;
      this.state.driftCorrection.lon = driftRate.lon * correctionFactor;

      // Apply correction to position
      this.state.position.lat -= this.state.driftCorrection.lat;
      this.state.position.lon -= this.state.driftCorrection.lon;
    }
  }

  private updateConfidence(): void {
    // Update confidence based on various factors
    let confidence = 50; // Base confidence

    // Sensor quality
    const imuQuality = advancedIMUSensor.getMotionQuality();
    const magnetoQuality = advancedMagnetometerSensor.getHeadingAccuracy();

    if (imuQuality.accuracy === 'high') confidence += 20;
    if (imuQuality.stability > 80) confidence += 10;

    if (magnetoQuality.accuracy === 'high') confidence += 15;

    // Calibration quality
    if (this.state.calibrationPoints.length > 0) {
      const recentCalibration = this.state.calibrationPoints[this.state.calibrationPoints.length - 1];
      confidence += Math.min(20, recentCalibration.accuracy / 5);
    }

    // Time since last GPS fix
    const timeSinceGPS = Date.now() - (advancedGPSSensor.getLastUpdate() || 0);
    if (timeSinceGPS < 60000) { // Last minute
      confidence += 15;
    } else if (timeSinceGPS < 300000) { // Last 5 minutes
      confidence += 5;
    } else {
      confidence -= 10; // Old GPS data
    }

    // Step count (more steps = more confidence in distance)
    if (this.state.stepCount > 10) {
      confidence += Math.min(15, this.state.stepCount / 2);
    }

    this.state.confidence = Math.max(0, Math.min(100, confidence));
  }

  // Public API
  public getCurrentPosition(): { lat: number; lon: number; alt: number; confidence: number } {
    return {
      lat: this.state.position.lat,
      lon: this.state.position.lon,
      alt: this.state.position.alt,
      confidence: this.state.confidence,
    };
  }

  public getCurrentVelocity(): { speed: number; heading: number } {
    const speed = Math.sqrt(
      this.state.velocity.x ** 2 +
      this.state.velocity.y ** 2 +
      this.state.velocity.z ** 2
    );

    return {
      speed,
      heading: this.state.orientation.yaw,
    };
  }

  public getStepCount(): number {
    return this.state.stepCount;
  }

  public getTotalDistance(): number {
    return this.state.distance;
  }

  public getDeadReckoningState(): DeadReckoningState {
    return { ...this.state };
  }

  public addCalibrationPoint(point: CalibrationPoint): void {
    this.state.calibrationPoints.push(point);

    // Keep only last 20 calibration points
    if (this.state.calibrationPoints.length > 20) {
      this.state.calibrationPoints = this.state.calibrationPoints.slice(-20);
    }

    logger.debug(`📍 Added calibration point: ${point.position.lat.toFixed(6)}, ${point.position.lon.toFixed(6)}`);
  }

  public resetPosition(lat: number, lon: number, alt: number = 0): void {
    this.state.position = { lat, lon, alt };
    this.state.velocity = { x: 0, y: 0, z: 0 };
    this.state.stepCount = 0;
    this.state.distance = 0;
    this.state.lastUpdate = Date.now();

    logger.debug(`🔄 Dead reckoning reset to: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
  }

  public setReferenceHeading(heading: number): void {
    advancedMagnetometerSensor.setReferenceHeading(heading);
    logger.debug(`🧭 Reference heading set to ${heading} degrees`);
  }

  public getAccuracyMetrics(): {
    positionAccuracy: number; // meters
    headingAccuracy: number; // degrees
    velocityAccuracy: number; // m/s
    overallConfidence: number; // 0-100
  } {
    const imuQuality = advancedIMUSensor.getMotionQuality();
    const magnetoQuality = advancedMagnetometerSensor.getHeadingAccuracy();

    // Estimate position accuracy based on sensor quality and time since calibration
    let positionAccuracy = 10; // Base 10m accuracy

    if (imuQuality.stability < 50) positionAccuracy += 5;
    if (magnetoQuality.stability < 50) positionAccuracy += 5;

    const timeSinceCalibration = this.state.calibrationPoints.length > 0
      ? Date.now() - this.state.calibrationPoints[this.state.calibrationPoints.length - 1].timestamp
      : Infinity;

    if (timeSinceCalibration > 300000) { // 5 minutes
      positionAccuracy += 10;
    }

    return {
      positionAccuracy,
      headingAccuracy: 5, // Estimated heading accuracy
      velocityAccuracy: 0.5, // Estimated velocity accuracy
      overallConfidence: this.state.confidence,
    };
  }

  public isActive(): boolean {
    return this.isActive;
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping advanced dead reckoning system...');

    this.isActive = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Sensors will be stopped by their respective managers
    logger.debug('✅ Advanced dead reckoning system stopped');
  }
}

// Step Detection Algorithm
class StepDetector {
  private stepThreshold = 1.2; // m/s²
  private stepMinInterval = 300; // ms
  private lastStepTime = 0;
  private stepHistory: number[] = [];

  async initialize(): Promise<void> {
    logger.debug('👣 Initializing step detector...');
  }

  detectStep(imuSample: IMUSample, orientation: OrientationState): StepEvent | null {
    const now = Date.now();

    // Check minimum interval between steps
    if (now - this.lastStepTime < this.stepMinInterval) {
      return null;
    }

    // Calculate acceleration magnitude
    const acceleration = imuSample.acceleration;
    const magnitude = Math.sqrt(
      acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2
    );

    // Detect step if acceleration exceeds threshold
    if (magnitude > this.stepThreshold) {
      const stepLength = this.estimateStepLength(magnitude);
      const heading = orientation.yaw;

      const stepEvent: StepEvent = {
        timestamp: now,
        stepLength,
        heading,
        confidence: this.calculateStepConfidence(magnitude),
      };

      this.lastStepTime = now;
      this.stepHistory.push(now);

      // Keep only last 100 steps
      if (this.stepHistory.length > 100) {
        this.stepHistory = this.stepHistory.slice(-100);
      }

      return stepEvent;
    }

    return null;
  }

  private estimateStepLength(acceleration: number): number {
    // Simple step length estimation based on acceleration
    const baseLength = 0.7; // meters
    const accelerationFactor = Math.min(1.5, acceleration / 2);
    return baseLength * accelerationFactor;
  }

  private calculateStepConfidence(acceleration: number): number {
    // Higher acceleration = higher confidence
    return Math.min(100, (acceleration / 2) * 100);
  }
}

// Drift Correction System
class DriftCorrector {
  private driftRate: { lat: number; lon: number; alt: number } = { lat: 0, lon: 0, alt: 0 };

  async initialize(): Promise<void> {
    logger.debug('🔧 Initializing drift corrector...');
  }

  updateDriftRate(calibrationPoints: CalibrationPoint[]): void {
    if (calibrationPoints.length < 2) return;

    const latest = calibrationPoints[calibrationPoints.length - 1];
    const previous = calibrationPoints[calibrationPoints.length - 2];

    const timeDelta = (latest.timestamp - previous.timestamp) / 1000; // seconds
    const positionDelta = {
      lat: latest.position.lat - previous.position.lat,
      lon: latest.position.lon - previous.position.lon,
      alt: latest.position.alt - previous.position.alt,
    };

    // Calculate drift rate (position change per second)
    this.driftRate = {
      lat: positionDelta.lat / timeDelta,
      lon: positionDelta.lon / timeDelta,
      alt: positionDelta.alt / timeDelta,
    };

    logger.debug(`📐 Drift rate updated: lat=${this.driftRate.lat.toFixed(6)}, lon=${this.driftRate.lon.toFixed(6)}`);
  }

  getDriftRate(): { lat: number; lon: number; alt: number } {
    return { ...this.driftRate };
  }

  resetDrift(): void {
    this.driftRate = { lat: 0, lon: 0, alt: 0 };
    logger.debug('🔄 Drift correction reset');
  }
}

// @afetnet: Export singleton instance
export const advancedDeadReckoningSystem = new AdvancedDeadReckoningSystem();











