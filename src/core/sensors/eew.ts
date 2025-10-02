import { Accelerometer } from 'expo-sensors';
import { EventEmitter } from '../utils/events';
import * as Location from 'expo-location';

export interface EEWDetectionOptions {
  staMs?: number;        // Short-term average window (default: 500ms)
  ltaMs?: number;        // Long-term average window (default: 3000ms)
  pThreshold?: number;   // STA/LTA threshold (default: 3.0)
  minGapMs?: number;     // Minimum gap between detections (default: 30000ms)
  minAccelG?: number;    // Minimum absolute acceleration in G (default: 0.08)
  updateIntervalMs?: number; // Accelerometer update interval (default: 20ms for ~50Hz)
}

export interface EEWDetectionResult {
  timestamp: number;
  strength: number;      // STA/LTA ratio
  lat: number;
  lon: number;
  accuracy?: number;
  acceleration: {
    x: number;
    y: number;
    z: number;
    magnitude: number;
  };
  sta: number;
  lta: number;
}

export interface EEWDataPoint {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

export class EEWDetector {
  private static instance: EEWDetector;
  private eventEmitter = new EventEmitter();
  private subscription: any = null;
  private isDetecting = false;
  private dataWindow: EEWDataPoint[] = [];
  private lastDetectionTime = 0;
  
  private options: Required<EEWDetectionOptions> = {
    staMs: 500,
    ltaMs: 3000,
    pThreshold: 3.0,
    minGapMs: 30000,
    minAccelG: 0.08,
    updateIntervalMs: 20,
  };

  private constructor() {}

  static getInstance(): EEWDetector {
    if (!EEWDetector.instance) {
      EEWDetector.instance = new EEWDetector();
    }
    return EEWDetector.instance;
  }

  async startEEWDetection(opts?: EEWDetectionOptions): Promise<void> {
    if (this.isDetecting) {
      console.log('EEW detection already running');
      return;
    }

    // Update options
    this.options = { ...this.options, ...opts };

    try {
      // Request location permission for accurate positioning
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted for EEW detection');
      }

      // Set accelerometer update interval
      Accelerometer.setUpdateInterval(this.options.updateIntervalMs);

      // Start accelerometer subscription
      this.subscription = Accelerometer.addListener(accelerometerData => {
        this.processAccelerometerData(accelerometerData);
      });

      this.isDetecting = true;
      this.dataWindow = [];
      this.lastDetectionTime = 0;

      console.log('EEW detection started', {
        updateInterval: this.options.updateIntervalMs,
        staWindow: this.options.staMs,
        ltaWindow: this.options.ltaMs,
        threshold: this.options.pThreshold,
      });

      this.eventEmitter.emit('eew:detection_started', this.options);
    } catch (error) {
      console.error('Failed to start EEW detection:', error);
      this.eventEmitter.emit('eew:detection_error', { error: error.message });
    }
  }

  stopEEWDetection(): void {
    if (!this.isDetecting) {
      return;
    }

    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    this.isDetecting = false;
    this.dataWindow = [];

    console.log('EEW detection stopped');
    this.eventEmitter.emit('eew:detection_stopped');
  }

  private processAccelerometerData(data: { x: number; y: number; z: number }): void {
    if (!this.isDetecting) return;

    const timestamp = Date.now();
    const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
    
    // Add new data point
    this.dataWindow.push({
      timestamp,
      x: data.x,
      y: data.y,
      z: data.z,
      magnitude,
    });

    // Remove old data points outside LTA window
    const cutoffTime = timestamp - this.options.ltaMs;
    this.dataWindow = this.dataWindow.filter(point => point.timestamp > cutoffTime);

    // Need enough data for LTA calculation
    if (this.dataWindow.length < 10) {
      return;
    }

    // Calculate STA and LTA
    const sta = this.calculateSTA(timestamp);
    const lta = this.calculateLTA(timestamp);

    if (sta === 0 || lta === 0) {
      return;
    }

    const ratio = sta / lta;
    const absoluteAccel = magnitude;

    // Check detection criteria
    if (this.shouldTriggerDetection(ratio, absoluteAccel, timestamp)) {
      this.triggerDetection(timestamp, ratio, sta, lta, data, magnitude);
    }
  }

  private calculateSTA(currentTime: number): number {
    const cutoffTime = currentTime - this.options.staMs;
    const staData = this.dataWindow.filter(point => point.timestamp > cutoffTime);
    
    if (staData.length === 0) return 0;
    
    const sum = staData.reduce((acc, point) => acc + point.magnitude, 0);
    return sum / staData.length;
  }

  private calculateLTA(currentTime: number): number {
    const cutoffTime = currentTime - this.options.ltaMs;
    const ltaData = this.dataWindow.filter(point => point.timestamp > cutoffTime);
    
    if (ltaData.length === 0) return 0;
    
    const sum = ltaData.reduce((acc, point) => acc + point.magnitude, 0);
    return sum / ltaData.length;
  }

  private shouldTriggerDetection(ratio: number, absoluteAccel: number, timestamp: number): boolean {
    // Check cooldown period
    if (timestamp - this.lastDetectionTime < this.options.minGapMs) {
      return false;
    }

    // Check threshold conditions
    const meetsThreshold = ratio > this.options.pThreshold;
    const meetsMinAccel = absoluteAccel > this.options.minAccelG;

    return meetsThreshold && meetsMinAccel;
  }

  private async triggerDetection(
    timestamp: number,
    strength: number,
    sta: number,
    lta: number,
    acceleration: { x: number; y: number; z: number },
    magnitude: number
  ): Promise<void> {
    try {
      // Get current location
      let lat = 0;
      let lon = 0;
      let accuracy = 0;

      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          maximumAge: 5000, // Use cached location if less than 5 seconds old
        });
        lat = location.coords.latitude;
        lon = location.coords.longitude;
        accuracy = location.coords.accuracy || 0;
      } catch (locationError) {
        console.warn('Failed to get location for EEW detection:', locationError);
        // Use default Istanbul coordinates as fallback
        lat = 41.0082;
        lon = 28.9784;
      }

      const result: EEWDetectionResult = {
        timestamp,
        strength,
        lat,
        lon,
        accuracy,
        acceleration: {
          x: acceleration.x,
          y: acceleration.y,
          z: acceleration.z,
          magnitude,
        },
        sta,
        lta,
      };

      this.lastDetectionTime = timestamp;

      console.log('EEW Local P-wave detected:', {
        strength: strength.toFixed(2),
        sta: sta.toFixed(4),
        lta: lta.toFixed(4),
        magnitude: magnitude.toFixed(4),
        location: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      });

      this.eventEmitter.emit('eew:local_pwave', result);
    } catch (error) {
      console.error('Error processing EEW detection:', error);
      this.eventEmitter.emit('eew:detection_error', { error: error.message });
    }
  }

  // Event subscription methods
  on(event: 'eew:local_pwave', listener: (data: EEWDetectionResult) => void): () => void;
  on(event: 'eew:detection_started', listener: (data: EEWDetectionOptions) => void): () => void;
  on(event: 'eew:detection_stopped', listener: () => void): () => void;
  on(event: 'eew:detection_error', listener: (data: { error: string }) => void): () => void;
  on(event: string, listener: (...args: any[]) => void): () => void {
    return this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  // Getters
  getIsDetecting(): boolean {
    return this.isDetecting;
  }

  getOptions(): Required<EEWDetectionOptions> {
    return { ...this.options };
  }

  getDataWindowSize(): number {
    return this.dataWindow.length;
  }

  getLastDetectionTime(): number {
    return this.lastDetectionTime;
  }

  // Utility methods for testing
  getCurrentSTA(): number {
    if (this.dataWindow.length === 0) return 0;
    return this.calculateSTA(Date.now());
  }

  getCurrentLTA(): number {
    if (this.dataWindow.length === 0) return 0;
    return this.calculateLTA(Date.now());
  }

  // Simulate detection for testing
  simulateDetection(strength: number = 4.0, acceleration: number = 0.1): void {
    if (!this.isDetecting) return;

    const timestamp = Date.now();
    const mockAcceleration = {
      x: acceleration * Math.random(),
      y: acceleration * Math.random(),
      z: acceleration * Math.random(),
    };
    const magnitude = Math.sqrt(
      mockAcceleration.x ** 2 + mockAcceleration.y ** 2 + mockAcceleration.z ** 2
    );

    this.triggerDetection(timestamp, strength, strength * 0.1, 0.1, mockAcceleration, magnitude);
  }

  // Cleanup
  cleanup(): void {
    this.stopEEWDetection();
    this.eventEmitter = new EventEmitter();
  }
}

// Export convenience function
export const startEEWDetection = async (opts?: EEWDetectionOptions): Promise<void> => {
  const detector = EEWDetector.getInstance();
  return await detector.startEEWDetection(opts);
};

export const stopEEWDetection = (): void => {
  const detector = EEWDetector.getInstance();
  detector.stopEEWDetection();
};
