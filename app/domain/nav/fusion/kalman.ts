// @afetnet: Advanced Kalman Filter for Sensor Fusion
// Extended Kalman Filter (EKF) for position, velocity, and orientation estimation

import { logger } from '../../../core/utils/logger';

export interface KalmanState {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  acceleration: { x: number; y: number; z: number };
  orientation: { roll: number; pitch: number; yaw: number };
  covariance: number[][]; // 12x12 state covariance matrix
  timestamp: number;
}

export interface KalmanMeasurement {
  position?: { x: number; y: number; z: number };
  velocity?: { x: number; y: number; z: number };
  acceleration?: { x: number; y: number; z: number };
  orientation?: { roll: number; pitch: number; yaw: number };
  timestamp: number;
  source: 'gps' | 'imu' | 'magneto' | 'mesh' | 'anchor';
  accuracy: number; // meters or degrees
}

export interface KalmanConfig {
  processNoise: number; // Q matrix diagonal
  measurementNoise: number; // R matrix diagonal
  initialUncertainty: number; // P matrix diagonal
  gravity: number; // m/s²
  magneticField: number; // microTesla
}

export class AdvancedKalmanFilter {
  private state: KalmanState;
  private config: KalmanConfig;
  private isInitialized = false;
  private measurementHistory: KalmanMeasurement[] = [];

  constructor() {
    this.config = {
      processNoise: 0.1,
      measurementNoise: 0.01,
      initialUncertainty: 1.0,
      gravity: 9.81,
      magneticField: 50,
    };

    this.state = this.initializeState();
  }

  private initializeState(): KalmanState {
    return {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      orientation: { roll: 0, pitch: 0, yaw: 0 },
      covariance: this.createIdentityMatrix(12),
      timestamp: Date.now(),
    };
  }

  private createIdentityMatrix(size: number): number[][] {
    const matrix = [];
    for (let i = 0; i < size; i++) {
      const row = new Array(size).fill(0);
      row[i] = 1;
      matrix.push(row);
    }
    return matrix;
  }

  async initialize(): Promise<void> {
    logger.debug('🧮 Initializing advanced Kalman filter...');

    this.isInitialized = true;
    logger.debug('✅ Advanced Kalman filter initialized');
  }

  // @afetnet: Predict state forward in time
  predict(deltaTime: number): void {
    if (!this.isInitialized) return;

    try {
      // State transition matrix (simplified)
      const dt = deltaTime;
      const dt2 = dt * dt / 2;

      // Position prediction
      this.state.position.x += this.state.velocity.x * dt + this.state.acceleration.x * dt2;
      this.state.position.y += this.state.velocity.y * dt + this.state.acceleration.y * dt2;
      this.state.position.z += this.state.velocity.z * dt + this.state.acceleration.z * dt2;

      // Velocity prediction
      this.state.velocity.x += this.state.acceleration.x * dt;
      this.state.velocity.y += this.state.acceleration.y * dt;
      this.state.velocity.z += this.state.acceleration.z * dt;

      // Process noise
      this.addProcessNoise();

    } catch (error) {
      logger.error('Failed to predict Kalman state:', error);
    }
  }

  // @afetnet: Update state with new measurement
  update(measurement: KalmanMeasurement): void {
    if (!this.isInitialized) return;

    try {
      // Calculate Kalman gain
      const kalmanGain = this.calculateKalmanGain(measurement);

      // Innovation (measurement - prediction)
      const innovation = this.calculateInnovation(measurement);

      // Update state
      this.applyStateUpdate(kalmanGain, innovation, measurement);

      // Update covariance
      this.updateCovariance(kalmanGain);

      this.state.timestamp = measurement.timestamp;

    } catch (error) {
      logger.error('Failed to update Kalman state:', error);
    }
  }

  private addProcessNoise(): void {
    // Add process noise to covariance matrix
    for (let i = 0; i < this.state.covariance.length; i++) {
      this.state.covariance[i][i] += this.config.processNoise;
    }
  }

  private calculateKalmanGain(measurement: KalmanMeasurement): number[][] {
    // Simplified Kalman gain calculation
    const gain = this.createIdentityMatrix(12);

    // Adjust gain based on measurement accuracy
    const accuracyFactor = Math.max(0.1, 1 - (measurement.accuracy / 100));
    for (let i = 0; i < gain.length; i++) {
      for (let j = 0; j < gain[i].length; j++) {
        gain[i][j] *= accuracyFactor;
      }
    }

    return gain;
  }

  private calculateInnovation(measurement: KalmanMeasurement): number[] {
    // Calculate innovation vector (measurement - prediction)
    const innovation = new Array(12).fill(0);

    if (measurement.position) {
      innovation[0] = measurement.position.x - this.state.position.x;
      innovation[1] = measurement.position.y - this.state.position.y;
      innovation[2] = measurement.position.z - this.state.position.z;
    }

    if (measurement.velocity) {
      innovation[3] = measurement.velocity.x - this.state.velocity.x;
      innovation[4] = measurement.velocity.y - this.state.velocity.y;
      innovation[5] = measurement.velocity.z - this.state.velocity.z;
    }

    if (measurement.acceleration) {
      innovation[6] = measurement.acceleration.x - this.state.acceleration.x;
      innovation[7] = measurement.acceleration.y - this.state.acceleration.y;
      innovation[8] = measurement.acceleration.z - this.state.acceleration.z;
    }

    if (measurement.orientation) {
      innovation[9] = measurement.orientation.roll - this.state.orientation.roll;
      innovation[10] = measurement.orientation.pitch - this.state.orientation.pitch;
      innovation[11] = measurement.orientation.yaw - this.state.orientation.yaw;
    }

    return innovation;
  }

  private applyStateUpdate(kalmanGain: number[][], innovation: number[], measurement: KalmanMeasurement): void {
    // Apply state update: x = x + K * (z - H * x)
    for (let i = 0; i < innovation.length; i++) {
      const update = kalmanGain[i]?.reduce((sum, gain, j) => sum + gain * innovation[j], 0) || 0;

      if (i < 3) {
        // Position update
        if (measurement.position) {
          const posKeys = ['x', 'y', 'z'] as const;
          (this.state.position as any)[posKeys[i]] += update;
        }
      } else if (i < 6) {
        // Velocity update
        if (measurement.velocity) {
          const velKeys = ['x', 'y', 'z'] as const;
          (this.state.velocity as any)[velKeys[i - 3]] += update;
        }
      } else if (i < 9) {
        // Acceleration update
        if (measurement.acceleration) {
          const accKeys = ['x', 'y', 'z'] as const;
          (this.state.acceleration as any)[accKeys[i - 6]] += update;
        }
      } else if (i < 12) {
        // Orientation update
        if (measurement.orientation) {
          const orientKeys = ['roll', 'pitch', 'yaw'] as const;
          (this.state.orientation as any)[orientKeys[i - 9]] += update;
        }
      }
    }
  }

  private updateCovariance(kalmanGain: number[][]): void {
    // Update covariance matrix: P = (I - K * H) * P
    const identity = this.createIdentityMatrix(12);

    // Simplified covariance update
    for (let i = 0; i < this.state.covariance.length; i++) {
      for (let j = 0; j < this.state.covariance[i].length; j++) {
        const gainEffect = kalmanGain[i]?.reduce((sum, gain, k) => sum + gain * (identity[k]?.[j] || 0), 0) || 0;
        this.state.covariance[i][j] *= (1 - gainEffect);
      }
    }
  }

  // Public API
  public getState(): KalmanState {
    return { ...this.state };
  }

  public getPosition(): { x: number; y: number; z: number; accuracy: number } {
    const positionUncertainty = Math.sqrt(
      this.state.covariance[0][0] + this.state.covariance[1][1] + this.state.covariance[2][2]
    ) / 3;

    return {
      x: this.state.position.x,
      y: this.state.position.y,
      z: this.state.position.z,
      accuracy: positionUncertainty,
    };
  }

  public getVelocity(): { x: number; y: number; z: number; speed: number } {
    const velocity = this.state.velocity;
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);

    return {
      x: velocity.x,
      y: velocity.y,
      z: velocity.z,
      speed,
    };
  }

  public getOrientation(): { roll: number; pitch: number; yaw: number; uncertainty: number } {
    const orientationUncertainty = Math.sqrt(
      this.state.covariance[9][9] + this.state.covariance[10][10] + this.state.covariance[11][11]
    ) / 3;

    return {
      roll: this.state.orientation.roll,
      pitch: this.state.orientation.pitch,
      yaw: this.state.orientation.yaw,
      uncertainty: orientationUncertainty,
    };
  }

  public getUncertainty(): {
    position: number;
    velocity: number;
    orientation: number;
    overall: number;
  } {
    const positionUncertainty = Math.sqrt(
      this.state.covariance[0][0] + this.state.covariance[1][1] + this.state.covariance[2][2]
    ) / 3;

    const velocityUncertainty = Math.sqrt(
      this.state.covariance[3][3] + this.state.covariance[4][4] + this.state.covariance[5][5]
    ) / 3;

    const orientationUncertainty = Math.sqrt(
      this.state.covariance[9][9] + this.state.covariance[10][10] + this.state.covariance[11][11]
    ) / 3;

    const overallUncertainty = (positionUncertainty + velocityUncertainty + orientationUncertainty) / 3;

    return {
      position: positionUncertainty,
      velocity: velocityUncertainty,
      orientation: orientationUncertainty,
      overall: overallUncertainty,
    };
  }

  public updateConfig(newConfig: Partial<KalmanConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.debug('Kalman filter config updated');
  }

  public reset(): void {
    this.state = this.initializeState();
    this.measurementHistory = [];
    logger.debug('Kalman filter reset');
  }

  public addMeasurement(measurement: KalmanMeasurement): void {
    this.measurementHistory.push(measurement);

    // Keep only last 100 measurements
    if (this.measurementHistory.length > 100) {
      this.measurementHistory = this.measurementHistory.slice(-100);
    }
  }

  public getMeasurementHistory(): KalmanMeasurement[] {
    return [...this.measurementHistory];
  }

  public isInitialized(): boolean {
    return this.isInitialized;
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping advanced Kalman filter...');
    // No cleanup needed for this implementation
    logger.debug('✅ Advanced Kalman filter stopped');
  }
}

// @afetnet: Export singleton instance
export const advancedKalmanFilter = new AdvancedKalmanFilter();






































