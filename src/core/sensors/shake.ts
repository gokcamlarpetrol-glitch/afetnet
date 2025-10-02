import { Accelerometer } from 'expo-sensors';
import { EventEmitter } from '../utils/events';

interface ShakeEvent {
  timestamp: number;
  acceleration: { x: number; y: number; z: number };
  magnitude: number;
}

export class ShakeDetector {
  private static instance: ShakeDetector;
  private eventEmitter = new EventEmitter();
  private shakeHistory: ShakeEvent[] = [];
  private threshold = 0.7; // g-force threshold for shake detection
  private windowSize = 6000; // 6 seconds window
  private subscription: any;
  private isEnabled = false;

  private constructor() {}

  static getInstance(): ShakeDetector {
    if (!ShakeDetector.instance) {
      ShakeDetector.instance = new ShakeDetector();
    }
    return ShakeDetector.instance;
  }

  async start(): Promise<void> {
    if (this.subscription || !this.isEnabled) {
      return;
    }

    try {
      Accelerometer.setUpdateInterval(100); // 100ms updates
      this.subscription = Accelerometer.addListener(accelerometerData => {
        this.handleAccelerometerData(accelerometerData);
      });
      console.log('ShakeDetector started');
    } catch (error) {
      console.error('Failed to start ShakeDetector:', error);
    }
  }

  stop(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = undefined;
    }
    this.shakeHistory = [];
    console.log('ShakeDetector stopped');
  }

  private handleAccelerometerData(data: { x: number; y: number; z: number }): void {
    const { x, y, z } = data;
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const timestamp = Date.now();

    // Add to shake history
    this.shakeHistory.push({
      timestamp,
      acceleration: { x, y, z },
      magnitude,
    });

    // Remove old entries outside window
    const cutoff = timestamp - this.windowSize;
    this.shakeHistory = this.shakeHistory.filter(event => event.timestamp > cutoff);

    // Check for significant shake
    if (magnitude > this.threshold) {
      this.detectShakePattern();
    }
  }

  private detectShakePattern(): void {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    
    // Count significant shakes in the window
    const significantShakes = this.shakeHistory.filter(
      event => event.timestamp > windowStart && event.magnitude > this.threshold
    );

    // Trigger if we have multiple significant shakes
    if (significantShakes.length >= 3) {
      const maxMagnitude = Math.max(...significantShakes.map(s => s.magnitude));
      
      this.eventEmitter.emit('shakeDetected', {
        timestamp: now,
        shakeCount: significantShakes.length,
        maxMagnitude,
        averageMagnitude: significantShakes.reduce((sum, s) => sum + s.magnitude, 0) / significantShakes.length,
      });

      // Clear history to prevent immediate re-triggering
      this.shakeHistory = [];
    }
  }

  // Event handling
  onShakeDetected(callback: (data: ShakeEventData) => void): () => void {
    return this.eventEmitter.on('shakeDetected', callback);
  }

  // Configuration
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  setThreshold(threshold: number): void {
    this.threshold = Math.max(0.1, Math.min(2.0, threshold));
  }

  setWindowSize(windowSizeMs: number): void {
    this.windowSize = Math.max(1000, Math.min(30000, windowSizeMs));
  }

  isRunning(): boolean {
    return !!this.subscription;
  }

  getStats(): {
    enabled: boolean;
    threshold: number;
    windowSize: number;
    isRunning: boolean;
    recentShakes: number;
  } {
    const now = Date.now();
    const recentShakes = this.shakeHistory.filter(
      event => event.timestamp > now - 10000 // Last 10 seconds
    ).length;

    return {
      enabled: this.isEnabled,
      threshold: this.threshold,
      windowSize: this.windowSize,
      isRunning: this.isRunning(),
      recentShakes,
    };
  }

  // Cleanup
  destroy(): void {
    this.stop();
    this.eventEmitter.removeAllListeners();
  }
}

export interface ShakeEventData {
  timestamp: number;
  shakeCount: number;
  maxMagnitude: number;
  averageMagnitude: number;
}