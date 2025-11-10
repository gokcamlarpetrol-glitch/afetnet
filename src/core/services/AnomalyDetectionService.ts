/**
 * ANOMALY DETECTION SERVICE - Level 3 AI
 * Detects anomalies in sensor patterns that indicate earthquakes
 * 
 * Uses statistical analysis to identify deviations from normal patterns
 * Provides early detection of unusual seismic activity
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('AnomalyDetectionService');

export interface SensorReading {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

export interface AnomalyResult {
  anomalyDetected: boolean;
  confidence: number; // 0-100
  anomalyType: 'sudden_spike' | 'gradual_increase' | 'frequency_shift' | 'pattern_break' | 'none';
  severity: 'low' | 'medium' | 'high' | 'critical';
  deviation: number; // How much it deviates from normal
}

class AnomalyDetectionService {
  private isInitialized = false;
  private readonly BASELINE_WINDOW = 1000; // 10 seconds baseline
  private readonly ANOMALY_WINDOW = 200; // 2 seconds for anomaly detection
  private baselineMean: number = 0;
  private baselineStdDev: number = 0;
  private baselineCalculated: boolean = false;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.isInitialized = true;
      if (__DEV__) {
        logger.info('AnomalyDetectionService initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize AnomalyDetectionService:', error);
      throw error;
    }
  }

  /**
   * Update baseline (normal pattern)
   */
  updateBaseline(readings: SensorReading[]): void {
    if (readings.length < this.BASELINE_WINDOW) return;

    const magnitudes = readings.slice(-this.BASELINE_WINDOW).map(r => r.magnitude);
    this.baselineMean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const variance = magnitudes.reduce((sum, val) => sum + Math.pow(val - this.baselineMean, 2), 0) / magnitudes.length;
    this.baselineStdDev = Math.sqrt(variance);
    this.baselineCalculated = true;
  }

  /**
   * ELITE: Detect anomalies in sensor patterns
   */
  detect(readings: SensorReading[]): AnomalyResult {
    if (!this.isInitialized) {
      logger.warn('AnomalyDetectionService not initialized');
      return this.createDefaultResult();
    }

    if (readings.length < this.ANOMALY_WINDOW) {
      return this.createDefaultResult();
    }

    // Update baseline if not calculated
    if (!this.baselineCalculated && readings.length >= this.BASELINE_WINDOW) {
      this.updateBaseline(readings);
    }

    if (!this.baselineCalculated) {
      return this.createDefaultResult();
    }

    const recentReadings = readings.slice(-this.ANOMALY_WINDOW);
    const magnitudes = recentReadings.map(r => r.magnitude);

    // Detect different types of anomalies
    const spikeAnomaly = this.detectSuddenSpike(magnitudes);
    const gradualAnomaly = this.detectGradualIncrease(magnitudes);
    const frequencyAnomaly = this.detectFrequencyShift(magnitudes);
    const patternAnomaly = this.detectPatternBreak(magnitudes);

    // Return the most significant anomaly
    const anomalies = [spikeAnomaly, gradualAnomaly, frequencyAnomaly, patternAnomaly];
    const bestAnomaly = anomalies.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    if (bestAnomaly.anomalyDetected && bestAnomaly.confidence > 60) {
      if (__DEV__) {
        logger.info(`⚠️ ANOMALY DETECTED: ${bestAnomaly.anomalyType} - ${bestAnomaly.severity} severity, ${bestAnomaly.confidence}% confidence`);
      }
    }

    return bestAnomaly;
  }

  /**
   * Detect sudden spike anomaly
   */
  private detectSuddenSpike(magnitudes: number[]): AnomalyResult {
    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const max = Math.max(...magnitudes);
    
    // Sudden spike: max is significantly higher than mean
    const spikeThreshold = this.baselineMean + this.baselineStdDev * 3;
    const deviation = max - this.baselineMean;

    if (max > spikeThreshold && deviation > this.baselineStdDev * 2) {
      const confidence = Math.min(95, 50 + (deviation / this.baselineStdDev) * 10);
      const severity = this.determineSeverity(deviation);

      return {
        anomalyDetected: true,
        confidence,
        anomalyType: 'sudden_spike',
        severity,
        deviation,
      };
    }

    return this.createDefaultResult();
  }

  /**
   * Detect gradual increase anomaly
   */
  private detectGradualIncrease(magnitudes: number[]): AnomalyResult {
    if (magnitudes.length < 20) return this.createDefaultResult();

    const firstHalf = magnitudes.slice(0, Math.floor(magnitudes.length / 2));
    const secondHalf = magnitudes.slice(Math.floor(magnitudes.length / 2));

    const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const increase = secondMean - firstMean;
    const increaseThreshold = this.baselineStdDev * 1.5;

    if (increase > increaseThreshold && secondMean > this.baselineMean + this.baselineStdDev) {
      const confidence = Math.min(90, 60 + (increase / this.baselineStdDev) * 10);
      const severity = this.determineSeverity(increase);

      return {
        anomalyDetected: true,
        confidence,
        anomalyType: 'gradual_increase',
        severity,
        deviation: increase,
      };
    }

    return this.createDefaultResult();
  }

  /**
   * Detect frequency shift anomaly
   */
  private detectFrequencyShift(magnitudes: number[]): AnomalyResult {
    const frequencies = this.calculateFrequencies(magnitudes);
    const avgFrequency = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;

    // Normal frequency is around 0.1-1 Hz for background noise
    // Earthquakes cause frequency shifts
    const normalFrequencyRange = [0.05, 1.0];
    const isOutsideRange = avgFrequency < normalFrequencyRange[0] || avgFrequency > normalFrequencyRange[1];

    if (isOutsideRange) {
      const deviation = Math.abs(avgFrequency - (normalFrequencyRange[0] + normalFrequencyRange[1]) / 2);
      const confidence = Math.min(85, 50 + deviation * 50);
      const severity = deviation > 2.0 ? 'high' : deviation > 1.0 ? 'medium' : 'low';

      return {
        anomalyDetected: true,
        confidence,
        anomalyType: 'frequency_shift',
        severity,
        deviation,
      };
    }

    return this.createDefaultResult();
  }

  /**
   * Detect pattern break anomaly
   */
  private detectPatternBreak(magnitudes: number[]): AnomalyResult {
    // Check if pattern is consistent with baseline
    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const variance = magnitudes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / magnitudes.length;
    const stdDev = Math.sqrt(variance);

    // Pattern break: variance or mean significantly different from baseline
    const meanDeviation = Math.abs(mean - this.baselineMean);
    const varianceDeviation = Math.abs(stdDev - this.baselineStdDev);

    const meanThreshold = this.baselineStdDev * 2;
    const varianceThreshold = this.baselineStdDev * 1.5;

    if (meanDeviation > meanThreshold || varianceDeviation > varianceThreshold) {
      const totalDeviation = meanDeviation + varianceDeviation;
      const confidence = Math.min(90, 60 + (totalDeviation / this.baselineStdDev) * 10);
      const severity = this.determineSeverity(totalDeviation);

      return {
        anomalyDetected: true,
        confidence,
        anomalyType: 'pattern_break',
        severity,
        deviation: totalDeviation,
      };
    }

    return this.createDefaultResult();
  }

  /**
   * Calculate frequencies
   */
  private calculateFrequencies(magnitudes: number[]): number[] {
    const frequencies: number[] = [];
    const windowSize = 50; // 0.5 seconds

    for (let i = 0; i < magnitudes.length - windowSize; i += windowSize) {
      const window = magnitudes.slice(i, i + windowSize);
      const frequency = this.calculateDominantFrequency(window);
      frequencies.push(frequency);
    }

    return frequencies;
  }

  /**
   * Calculate dominant frequency
   */
  private calculateDominantFrequency(magnitudes: number[]): number {
    if (magnitudes.length < 10) return 0;

    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    let zeroCrossings = 0;

    for (let i = 1; i < magnitudes.length; i++) {
      if ((magnitudes[i - 1] - mean) * (magnitudes[i] - mean) < 0) {
        zeroCrossings++;
      }
    }

    const duration = magnitudes.length / 100; // seconds
    return zeroCrossings / (2 * duration); // Hz
  }

  /**
   * Determine severity
   */
  private determineSeverity(deviation: number): 'low' | 'medium' | 'high' | 'critical' {
    const normalizedDeviation = deviation / this.baselineStdDev;

    if (normalizedDeviation > 5) return 'critical';
    if (normalizedDeviation > 3) return 'high';
    if (normalizedDeviation > 2) return 'medium';
    return 'low';
  }

  /**
   * Create default result
   */
  private createDefaultResult(): AnomalyResult {
    return {
      anomalyDetected: false,
      confidence: 0,
      anomalyType: 'none',
      severity: 'low',
      deviation: 0,
    };
  }

  /**
   * Stop the service
   */
  stop(): void {
    this.isInitialized = false;
    this.baselineCalculated = false;
    if (__DEV__) {
      logger.info('AnomalyDetectionService stopped');
    }
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();

