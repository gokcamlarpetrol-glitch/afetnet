/**
 * ADVANCED WAVE DETECTION SERVICE - Level 2 AI
 * PhaseNet-like P/S wave detection using advanced algorithms
 * Provides high-accuracy wave arrival time detection
 * 
 * This is a rule-based implementation that mimics PhaseNet behavior
 * without requiring TensorFlow.js dependencies
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('AdvancedWaveDetectionService');

export interface SensorReading {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

export interface WaveDetectionResult {
  pWaveDetected: boolean;
  sWaveDetected: boolean;
  pWaveArrivalTime?: number; // milliseconds from start
  sWaveArrivalTime?: number; // milliseconds from start
  confidence: number; // 0-100
  magnitude: number;
  waveType: 'p_wave' | 's_wave' | 'surface_wave' | 'none';
}

class AdvancedWaveDetectionService {
  private isInitialized = false;
  private readonly WINDOW_SIZE = 1000; // 10 seconds at 100Hz
  private readonly P_WAVE_FREQUENCY_RANGE = [1, 20]; // Hz - P-waves are high frequency
  private readonly S_WAVE_FREQUENCY_RANGE = [0.1, 10]; // Hz - S-waves are lower frequency
  private readonly SURFACE_WAVE_FREQUENCY_RANGE = [0.05, 5]; // Hz - Surface waves are very low frequency

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.isInitialized = true;
      if (__DEV__) {
        logger.info('AdvancedWaveDetectionService initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize AdvancedWaveDetectionService:', error);
      throw error;
    }
  }

  /**
   * Detect P and S waves with high accuracy (PhaseNet-like)
   */
  detectWaves(readings: SensorReading[]): WaveDetectionResult {
    // ELITE: Silent initialization check - service may be initializing (race condition)
    // Return safe default instead of logging warning
    if (!this.isInitialized) {
      return {
        pWaveDetected: false,
        sWaveDetected: false,
        confidence: 0,
        magnitude: 0,
        waveType: 'none',
      };
    }

    if (readings.length < 100) {
      return {
        pWaveDetected: false,
        sWaveDetected: false,
        confidence: 0,
        magnitude: 0,
        waveType: 'none',
      };
    }

    // Extract features for wave detection
    const features = this.extractWaveFeatures(readings);

    // Detect P-wave (first arrival, high frequency)
    const pWaveResult = this.detectPWave(readings, features);

    // Detect S-wave (second arrival, lower frequency, stronger)
    const sWaveResult = this.detectSWave(readings, features, pWaveResult.arrivalTime);

    // Determine overall wave type
    const waveType = this.determineWaveType(pWaveResult, sWaveResult, features);

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(pWaveResult, sWaveResult, features);

    // Estimate magnitude from wave characteristics
    const magnitude = this.estimateMagnitudeFromWaves(pWaveResult, sWaveResult, features);

    return {
      pWaveDetected: pWaveResult.detected,
      sWaveDetected: sWaveResult.detected,
      pWaveArrivalTime: pWaveResult.arrivalTime,
      sWaveArrivalTime: sWaveResult.arrivalTime,
      confidence,
      magnitude,
      waveType,
    };
  }

  /**
   * Extract features for wave detection (similar to CNN feature extraction)
   */
  private extractWaveFeatures(readings: SensorReading[]): {
    magnitudes: number[];
    frequencies: number[];
    amplitudes: number[];
    phases: number[];
    energy: number[];
    spectralDensity: number[];
  } {
    const magnitudes = readings.map(r => r.magnitude);
    
    // Calculate frequency spectrum (simplified FFT-like analysis)
    const frequencies = this.calculateFrequencySpectrum(magnitudes);
    
    // Calculate amplitudes (envelope)
    const amplitudes = this.calculateAmplitudes(magnitudes);
    
    // Calculate phases (for wave type detection)
    const phases = this.calculatePhases(magnitudes);
    
    // Calculate energy (for magnitude estimation)
    const energy = this.calculateEnergy(magnitudes);
    
    // Calculate spectral density (for frequency analysis)
    const spectralDensity = this.calculateSpectralDensity(magnitudes);

    return {
      magnitudes,
      frequencies,
      amplitudes,
      phases,
      energy,
      spectralDensity,
    };
  }

  /**
   * Detect P-wave (Primary wave - first arrival, high frequency)
   */
  private detectPWave(
    readings: SensorReading[],
    features: ReturnType<typeof this.extractWaveFeatures>
  ): { detected: boolean; arrivalTime?: number; confidence: number } {
    // P-wave characteristics:
    // 1. First arrival (sudden onset)
    // 2. High frequency (1-20 Hz)
    // 3. Lower amplitude than S-wave
    // 4. Compressional motion

    // Find sudden onset (rapid increase in magnitude)
    const onsetIndex = this.findOnset(features.magnitudes, 0.15); // Threshold for P-wave
    
    if (onsetIndex === -1) {
      return { detected: false, confidence: 0 };
    }

    const arrivalTime = readings[onsetIndex].timestamp - readings[0].timestamp;

    // Analyze frequency content around onset
    const windowSize = Math.min(100, readings.length - onsetIndex); // 1 second window
    const onsetWindow = features.magnitudes.slice(onsetIndex, onsetIndex + windowSize);
    const frequency = this.calculateDominantFrequency(onsetWindow);

    // Check if frequency is in P-wave range
    const isPWaveFrequency = frequency >= this.P_WAVE_FREQUENCY_RANGE[0] && 
                             frequency <= this.P_WAVE_FREQUENCY_RANGE[1];

    // Check amplitude (P-waves are typically smaller)
    const amplitude = Math.max(...onsetWindow);
    const isPWaveAmplitude = amplitude < 0.5; // P-waves are typically < 0.5 m/s²

    // Calculate confidence
    let confidence = 50; // Base confidence
    
    if (isPWaveFrequency) confidence += 25;
    if (isPWaveAmplitude) confidence += 15;
    if (arrivalTime < 2000) confidence += 10; // Early arrival is good sign

    confidence = Math.min(confidence, 95);

    return {
      detected: isPWaveFrequency && isPWaveAmplitude,
      arrivalTime,
      confidence,
    };
  }

  /**
   * Detect S-wave (Secondary wave - second arrival, lower frequency, stronger)
   */
  private detectSWave(
    readings: SensorReading[],
    features: ReturnType<typeof this.extractWaveFeatures>,
    pWaveArrivalTime?: number
  ): { detected: boolean; arrivalTime?: number; confidence: number } {
    // S-wave characteristics:
    // 1. Second arrival (after P-wave)
    // 2. Lower frequency (0.1-10 Hz)
    // 3. Higher amplitude than P-wave
    // 4. Shear motion

    // If P-wave detected, look for S-wave after it
    const startIndex = pWaveArrivalTime !== undefined
      ? Math.floor((pWaveArrivalTime / 1000) * 100) // Convert to index (100Hz)
      : 0;

    if (startIndex >= readings.length - 50) {
      return { detected: false, confidence: 0 };
    }

    // Find S-wave onset (stronger than P-wave)
    const sWaveThreshold = 0.3; // S-waves are stronger
    const onsetIndex = this.findOnset(
      features.magnitudes.slice(startIndex),
      sWaveThreshold,
      startIndex
    );

    if (onsetIndex === -1) {
      return { detected: false, confidence: 0 };
    }

    const arrivalTime = readings[onsetIndex].timestamp - readings[0].timestamp;

    // Analyze frequency content
    const windowSize = Math.min(100, readings.length - onsetIndex);
    const onsetWindow = features.magnitudes.slice(onsetIndex, onsetIndex + windowSize);
    const frequency = this.calculateDominantFrequency(onsetWindow);

    // Check if frequency is in S-wave range
    const isSWaveFrequency = frequency >= this.S_WAVE_FREQUENCY_RANGE[0] && 
                              frequency <= this.S_WAVE_FREQUENCY_RANGE[1];

    // Check amplitude (S-waves are stronger)
    const amplitude = Math.max(...onsetWindow);
    const isSWaveAmplitude = amplitude > 0.3; // S-waves are typically > 0.3 m/s²

    // Check timing (S-wave should arrive after P-wave)
    const timingCorrect = pWaveArrivalTime === undefined || (arrivalTime > pWaveArrivalTime);

    // Calculate confidence
    let confidence = 50; // Base confidence
    
    if (isSWaveFrequency) confidence += 25;
    if (isSWaveAmplitude) confidence += 15;
    if (timingCorrect) confidence += 10;

    confidence = Math.min(confidence, 95);

    return {
      detected: isSWaveFrequency && isSWaveAmplitude && timingCorrect,
      arrivalTime,
      confidence,
    };
  }

  /**
   * Find onset (sudden increase in magnitude)
   */
  private findOnset(
    magnitudes: number[],
    threshold: number,
    offset: number = 0
  ): number {
    if (magnitudes.length < 20) return -1;

    // Look for rapid increase
    for (let i = 10; i < magnitudes.length - 10; i++) {
      const prevAvg = magnitudes.slice(i - 10, i).reduce((a, b) => a + b, 0) / 10;
      const currAvg = magnitudes.slice(i, i + 10).reduce((a, b) => a + b, 0) / 10;
      
      const increase = currAvg - prevAvg;
      
      // Sudden onset: rapid increase above threshold
      if (increase > threshold * 0.5 && currAvg > threshold) {
        return offset + i;
      }
    }

    return -1;
  }

  /**
   * Calculate frequency spectrum (simplified FFT)
   */
  private calculateFrequencySpectrum(magnitudes: number[]): number[] {
    // Simplified frequency analysis using zero-crossing method
    const frequencies: number[] = [];
    const windowSize = 100; // 1 second at 100Hz
    
    for (let i = 0; i < magnitudes.length - windowSize; i += windowSize) {
      const window = magnitudes.slice(i, i + windowSize);
      const frequency = this.calculateDominantFrequency(window);
      frequencies.push(frequency);
    }
    
    return frequencies;
  }

  /**
   * Calculate dominant frequency using zero-crossing method
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

    // Convert to Hz (assuming 100Hz sampling rate)
    const duration = magnitudes.length / 100; // seconds
    return zeroCrossings / (2 * duration); // Hz
  }

  /**
   * Calculate amplitudes (envelope)
   */
  private calculateAmplitudes(magnitudes: number[]): number[] {
    const amplitudes: number[] = [];
    const windowSize = 10; // 0.1 second

    for (let i = 0; i < magnitudes.length; i += windowSize) {
      const window = magnitudes.slice(i, i + windowSize);
      const max = Math.max(...window);
      const min = Math.min(...window);
      amplitudes.push((max - min) / 2); // Peak-to-peak amplitude
    }

    return amplitudes;
  }

  /**
   * Calculate phases (for wave type detection)
   */
  private calculatePhases(magnitudes: number[]): number[] {
    // Simplified phase calculation using Hilbert transform approximation
    const phases: number[] = [];
    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;

    for (let i = 1; i < magnitudes.length; i++) {
      const phase = Math.atan2(magnitudes[i] - mean, magnitudes[i - 1] - mean);
      phases.push(phase);
    }

    return phases;
  }

  /**
   * Calculate energy (for magnitude estimation)
   */
  private calculateEnergy(magnitudes: number[]): number[] {
    const energy: number[] = [];
    const windowSize = 50; // 0.5 second

    for (let i = 0; i < magnitudes.length; i += windowSize) {
      const window = magnitudes.slice(i, i + windowSize);
      const windowEnergy = window.reduce((sum, val) => sum + val * val, 0) / windowSize;
      energy.push(windowEnergy);
    }

    return energy;
  }

  /**
   * Calculate spectral density (for frequency analysis)
   */
  private calculateSpectralDensity(magnitudes: number[]): number[] {
    // Simplified spectral density using variance in frequency domain
    const frequencies = this.calculateFrequencySpectrum(magnitudes);
    const meanFreq = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
    
    return frequencies.map(freq => Math.pow(freq - meanFreq, 2));
  }

  /**
   * Determine wave type
   */
  private determineWaveType(
    pWave: { detected: boolean; confidence: number },
    sWave: { detected: boolean; confidence: number },
    features: ReturnType<typeof this.extractWaveFeatures>
  ): 'p_wave' | 's_wave' | 'surface_wave' | 'none' {
    if (pWave.detected && pWave.confidence > 70) {
      return 'p_wave';
    }
    
    if (sWave.detected && sWave.confidence > 70) {
      return 's_wave';
    }

    // Check for surface waves (very low frequency)
    const avgFrequency = features.frequencies.reduce((a, b) => a + b, 0) / features.frequencies.length;
    if (avgFrequency >= this.SURFACE_WAVE_FREQUENCY_RANGE[0] && 
        avgFrequency <= this.SURFACE_WAVE_FREQUENCY_RANGE[1]) {
      return 'surface_wave';
    }

    return 'none';
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(
    pWave: { detected: boolean; confidence: number },
    sWave: { detected: boolean; confidence: number },
    features: ReturnType<typeof this.extractWaveFeatures>
  ): number {
    let confidence = 0;

    if (pWave.detected) {
      confidence += pWave.confidence * 0.4; // P-wave contributes 40%
    }

    if (sWave.detected) {
      confidence += sWave.confidence * 0.6; // S-wave contributes 60% (more reliable)
    }

    // Boost confidence if both detected
    if (pWave.detected && sWave.detected) {
      confidence *= 1.2; // 20% boost
    }

    return Math.min(confidence, 95);
  }

  /**
   * Estimate magnitude from wave characteristics
   */
  private estimateMagnitudeFromWaves(
    pWave: { detected: boolean; confidence: number },
    sWave: { detected: boolean; confidence: number },
    features: ReturnType<typeof this.extractWaveFeatures>
  ): number {
    // Use energy and amplitude to estimate magnitude
    const maxAmplitude = Math.max(...features.amplitudes);
    const totalEnergy = features.energy.reduce((a, b) => a + b, 0);

    // Empirical relationship: magnitude ≈ log10(amplitude) + log10(energy)
    // Simplified for mobile sensors
    const magnitude = Math.log10(maxAmplitude + 0.01) * 2 + Math.log10(totalEnergy + 0.01) * 1.5 + 2.5;

    // Clamp to reasonable range
    return Math.max(1.0, Math.min(8.0, magnitude));
  }

  /**
   * Stop the service
   */
  stop(): void {
    this.isInitialized = false;
    if (__DEV__) {
      logger.info('AdvancedWaveDetectionService stopped');
    }
  }
}

export const advancedWaveDetectionService = new AdvancedWaveDetectionService();

