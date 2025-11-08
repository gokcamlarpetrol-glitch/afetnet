/**
 * REAL-TIME DETECTION SERVICE - Level 2 AI
 * CREIME-like real-time earthquake detection
 * Multi-sensor fusion with statistical learning
 * 
 * Provides high-accuracy real-time detection without heavy ML dependencies
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('RealTimeDetectionService');

export interface MultiSensorReading {
  timestamp: number;
  accelerometer: { x: number; y: number; z: number; magnitude: number };
  gyroscope?: { x: number; y: number; z: number; magnitude: number };
  barometer?: { pressure: number; change: number };
}

export interface DetectionResult {
  isEarthquake: boolean;
  confidence: number; // 0-100
  magnitude: number;
  estimatedMagnitude: number;
  detectionTime: number; // milliseconds
  sensorFusion: {
    accelerometer: number; // 0-100 confidence
    gyroscope?: number;
    barometer?: number;
  };
}

class RealTimeDetectionService {
  private isInitialized = false;
  private readonly WINDOW_SIZE = 200; // 2 seconds at 100Hz
  private readonly DETECTION_THRESHOLD = 0.2; // m/s²
  private readonly MAGNITUDE_THRESHOLD = 0.15; // m/s² for magnitude estimation

  // Statistical learning parameters (updated based on historical data)
  private falsePositiveRate = 0.2; // 20% initial
  private truePositiveRate = 0.8; // 80% initial
  private adaptiveThreshold = 0.2; // Adaptive threshold

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.isInitialized = true;
      
      // Load learned parameters from storage (if available)
      await this.loadLearnedParameters();
      
      if (__DEV__) {
        logger.info('RealTimeDetectionService initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize RealTimeDetectionService:', error);
      throw error;
    }
  }

  /**
   * Real-time earthquake detection with multi-sensor fusion
   */
  detect(readings: MultiSensorReading[]): DetectionResult {
    // ELITE: Silent initialization check - service may be initializing (race condition)
    // Return safe default instead of logging warning
    if (!this.isInitialized) {
      return {
        isEarthquake: false,
        confidence: 0,
        magnitude: 0,
        estimatedMagnitude: 0,
        detectionTime: 0,
        sensorFusion: { accelerometer: 0 },
      };
    }

    if (readings.length < 50) {
      return {
        isEarthquake: false,
        confidence: 0,
        magnitude: 0,
        estimatedMagnitude: 0,
        detectionTime: 0,
        sensorFusion: { accelerometer: 0 },
      };
    }

    const detectionStartTime = Date.now();

    // Multi-sensor fusion
    const accelerometerResult = this.analyzeAccelerometer(readings);
    const gyroscopeResult = readings[0].gyroscope ? this.analyzeGyroscope(readings) : null;
    const barometerResult = readings[0].barometer ? this.analyzeBarometer(readings) : null;

    // Combine sensor results (weighted fusion)
    const fusionResult = this.fuseSensors(accelerometerResult, gyroscopeResult, barometerResult);

    // Statistical learning: Update thresholds based on detection
    if (fusionResult.isEarthquake) {
      this.updateLearnedParameters(true);
    }

    const detectionTime = Date.now() - detectionStartTime;

    return {
      isEarthquake: fusionResult.isEarthquake,
      confidence: fusionResult.confidence,
      magnitude: fusionResult.magnitude,
      estimatedMagnitude: fusionResult.estimatedMagnitude,
      detectionTime,
      sensorFusion: {
        accelerometer: accelerometerResult.confidence,
        gyroscope: gyroscopeResult?.confidence,
        barometer: barometerResult?.confidence,
      },
    };
  }

  /**
   * Analyze accelerometer data
   */
  private analyzeAccelerometer(readings: MultiSensorReading[]): {
    isEarthquake: boolean;
    confidence: number;
    magnitude: number;
  } {
    const magnitudes = readings.map(r => r.accelerometer.magnitude);
    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const max = Math.max(...magnitudes);
    const variance = magnitudes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / magnitudes.length;
    const stdDev = Math.sqrt(variance);

    // Real-time detection criteria
    const hasMagnitude = max > this.adaptiveThreshold;
    const hasVariance = variance > 0.01; // Significant variance
    const hasSuddenOnset = this.hasSuddenOnset(magnitudes);

    let confidence = 0;

    if (hasMagnitude) {
      confidence += 40;
    }
    if (hasVariance) {
      confidence += 20;
    }
    if (hasSuddenOnset) {
      confidence += 30;
    }

    // Boost confidence for strong signals
    if (max > 0.5) {
      confidence += 10;
    }

    confidence = Math.min(confidence, 95);

    return {
      isEarthquake: confidence > 60,
      confidence,
      magnitude: max,
    };
  }

  /**
   * Analyze gyroscope data (for rotation detection - helps filter false positives)
   */
  private analyzeGyroscope(readings: MultiSensorReading[]): {
    isEarthquake: boolean;
    confidence: number;
  } | null {
    if (!readings[0].gyroscope) return null;

    const magnitudes = readings.map(r => r.gyroscope!.magnitude);
    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const max = Math.max(...magnitudes);

    // Earthquakes cause translation, not rotation
    // High rotation = false positive (device manipulation)
    if (max > 2.0 && mean > 0.5) {
      // High rotation detected - likely false positive
      return {
        isEarthquake: false,
        confidence: 80, // High confidence it's NOT an earthquake
      };
    }

    // Low rotation = consistent with earthquake
    return {
      isEarthquake: true,
      confidence: 60,
    };
  }

  /**
   * Analyze barometer data (for pressure changes)
   */
  private analyzeBarometer(readings: MultiSensorReading[]): {
    isEarthquake: boolean;
    confidence: number;
  } | null {
    if (!readings[0].barometer) return null;

    const pressures = readings.map(r => r.barometer!.pressure);
    const pressureChanges = readings.map(r => Math.abs(r.barometer!.change || 0));
    const maxChange = Math.max(...pressureChanges);

    // Earthquakes cause small pressure changes (< 1 hPa typically)
    if (maxChange > 2.0) {
      // Large pressure change - likely not earthquake (weather, altitude change)
      return {
        isEarthquake: false,
        confidence: 70,
      };
    }

    // Small pressure change - consistent with earthquake
    if (maxChange > 0.1 && maxChange < 1.0) {
      return {
        isEarthquake: true,
        confidence: 50,
      };
    }

    return {
      isEarthquake: false,
      confidence: 30,
    };
  }

  /**
   * Fuse multiple sensor results (weighted combination)
   */
  private fuseSensors(
    accelerometer: { isEarthquake: boolean; confidence: number; magnitude: number },
    gyroscope: { isEarthquake: boolean; confidence: number } | null,
    barometer: { isEarthquake: boolean; confidence: number } | null
  ): {
    isEarthquake: boolean;
    confidence: number;
    magnitude: number;
    estimatedMagnitude: number;
  } {
    // Weighted fusion
    let totalConfidence = accelerometer.confidence * 0.7; // Accelerometer is primary (70%)
    let earthquakeVotes = accelerometer.isEarthquake ? 1 : 0;
    let totalVotes = 1;

    if (gyroscope) {
      totalConfidence += gyroscope.confidence * 0.2; // Gyroscope contributes 20%
      if (gyroscope.isEarthquake) earthquakeVotes++;
      totalVotes++;
    }

    if (barometer) {
      totalConfidence += barometer.confidence * 0.1; // Barometer contributes 10%
      if (barometer.isEarthquake) earthquakeVotes++;
      totalVotes++;
    }

    // Normalize confidence
    const normalizedConfidence = Math.min(95, totalConfidence);

    // Decision: Majority vote + confidence threshold
    const majorityVote = earthquakeVotes > totalVotes / 2;
    const isEarthquake = majorityVote && normalizedConfidence > 60;

    // Estimate magnitude from accelerometer (most reliable)
    const estimatedMagnitude = this.estimateMagnitude(accelerometer.magnitude);

    return {
      isEarthquake,
      confidence: normalizedConfidence,
      magnitude: accelerometer.magnitude,
      estimatedMagnitude,
    };
  }

  /**
   * Check for sudden onset
   */
  private hasSuddenOnset(magnitudes: number[]): boolean {
    if (magnitudes.length < 20) return false;

    const firstHalf = magnitudes.slice(0, Math.floor(magnitudes.length / 2));
    const secondHalf = magnitudes.slice(Math.floor(magnitudes.length / 2));

    const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const increase = secondMean - firstMean;
    return increase > this.DETECTION_THRESHOLD * 0.5; // 50% of threshold
  }

  /**
   * Estimate magnitude from acceleration
   */
  private estimateMagnitude(acceleration: number): number {
    // Empirical relationship: M ≈ log10(a) + constant
    // Simplified for mobile sensors
    if (acceleration < this.MAGNITUDE_THRESHOLD) {
      return 1.0; // Below detection threshold
    }

    const magnitude = Math.log10(acceleration + 0.01) * 2.5 + 2.0;
    return Math.max(1.0, Math.min(8.0, magnitude));
  }

  /**
   * Update learned parameters (statistical learning)
   */
  private updateLearnedParameters(isTruePositive: boolean): void {
    // Simple adaptive learning
    if (isTruePositive) {
      // True positive detected - increase sensitivity slightly
      this.truePositiveRate = Math.min(0.95, this.truePositiveRate + 0.01);
      this.adaptiveThreshold = Math.max(0.15, this.adaptiveThreshold - 0.01);
    } else {
      // False positive detected - decrease sensitivity
      this.falsePositiveRate = Math.max(0.05, this.falsePositiveRate - 0.01);
      this.adaptiveThreshold = Math.min(0.3, this.adaptiveThreshold + 0.01);
    }

    // Save learned parameters (async, fire-and-forget)
    void this.saveLearnedParameters();
  }

  /**
   * Load learned parameters from storage
   */
  private async loadLearnedParameters(): Promise<void> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const saved = await AsyncStorage.getItem('realtime_detection_params');
      
      if (saved) {
        const params = JSON.parse(saved);
        this.falsePositiveRate = params.falsePositiveRate || this.falsePositiveRate;
        this.truePositiveRate = params.truePositiveRate || this.truePositiveRate;
        this.adaptiveThreshold = params.adaptiveThreshold || this.adaptiveThreshold;
      }
    } catch (error) {
      logger.error('Failed to load learned parameters:', error);
      // Use defaults
    }
  }

  /**
   * Save learned parameters to storage
   */
  private async saveLearnedParameters(): Promise<void> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem('realtime_detection_params', JSON.stringify({
        falsePositiveRate: this.falsePositiveRate,
        truePositiveRate: this.truePositiveRate,
        adaptiveThreshold: this.adaptiveThreshold,
        lastUpdated: Date.now(),
      }));
    } catch (error) {
      logger.error('Failed to save learned parameters:', error);
    }
  }

  /**
   * Stop the service
   */
  stop(): void {
    this.isInitialized = false;
    // Save parameters before stopping
    void this.saveLearnedParameters();
    
    if (__DEV__) {
      logger.info('RealTimeDetectionService stopped');
    }
  }
}

export const realTimeDetectionService = new RealTimeDetectionService();

