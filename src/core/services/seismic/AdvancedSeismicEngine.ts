/**
 * ADVANCED SEISMIC ENGINE - ELITE EDITION V5
 * "The Heartbeat of the Earth"
 *
 * Features:
 * - Recursive STA/LTA Triggering (Industry Standard)
 * - Frequency Domain Confirmation (DFT)
 * - P/S Wave Classification
 * - Rotation Rejection (Gyroscope)
 * - Signal Buffer for FFT Analysis
 */

import { Accelerometer, Gyroscope } from 'expo-sensors';
import { RecursiveSTALTA, RingBuffer, FrequencyAnalyzer, AICPicker } from './SeismicMath';
import { useSettingsStore } from '../../stores/settingsStore';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SeismicEngine');

// ELITE: Type-safe sensor subscription interface
interface SensorSubscription {
  remove: () => void;
}

// Sampling Config
const HZ = 50; // 50Hz sampling rate
const UPDATE_MS = 1000 / HZ;
const BUFFER_SIZE = 64; // Power of 2 for FFT

// ... (other imports)

// Base Thresholds (Modifiers applied at runtime)
const BASE_TRIGGER = 3.5;

// Trigger Thresholds
const STA_LTA_DETRIGGER = 2.0;
const MIN_TRIGGER_DURATION = 1000;

// Physics Thresholds
const MIN_G = 0.015;
const P_WAVE_MAX_G = 0.2;
const ROTATION_THRESHOLD = 0.5;

// Frequency Thresholds (Earthquakes: 0.5-15Hz, Noise: >20Hz)
const EARTHQUAKE_FREQ_MIN = 0.5;
const EARTHQUAKE_FREQ_MAX = 15;
const NOISE_FREQ_THRESHOLD = 20;

export interface DetectionEvent {
  id: string;
  type: 'P-WAVE' | 'S-WAVE';
  magnitude: number;
  stalta: number;
  frequency: number;
  timestamp: number;
  confidence: number;
  // ELITE: Additional properties for wave detection
  pWaveDetected?: boolean;
  sWaveDetected?: boolean;
  estimatedMagnitude?: number;
}

class AdvancedSeismicEngine {
  private isRunning = false;
  // ELITE: Type-safe sensor subscriptions
  private subAccel: SensorSubscription | null = null;
  private subGyro: SensorSubscription | null = null;

  // Algorithms
  private stalta: RecursiveSTALTA;
  private freqAnalyzer: FrequencyAnalyzer;
  private signalBuffer: RingBuffer;

  // State
  private lastTriggerTime = 0;
  private isTriggered = false;
  private currRotation = 0;
  private currentRatio = 0;
  private lastFrequency = 0;
  private totalReadings = 0;
  private confirmedEvents = 0;
  private lastDataTimestamp = 0;

  // Callback
  private onDetectionCallback: ((e: DetectionEvent) => void) | null = null;

  private getDynamicThreshold(): number {
    const sensitivity = useSettingsStore.getState().sensorSensitivity;
    switch (sensitivity) {
      case 'high': return 2.5; // Easier to trigger
      case 'medium': return 3.5; // Standard
      case 'low': return 4.5; // Harder to trigger
      default: return 3.5;
    }
  }

  constructor() {
    this.stalta = new RecursiveSTALTA(25, 500); // STA: 0.5s, LTA: 10s
    this.freqAnalyzer = new FrequencyAnalyzer(BUFFER_SIZE);
    this.signalBuffer = new RingBuffer(BUFFER_SIZE);
  }

  start(onDetection: (e: DetectionEvent) => void) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.onDetectionCallback = onDetection;

    logger.info('🌊 Seismic Engine V5 Starting [STA/LTA + FFT Mode]');

    // Accelerometer
    Accelerometer.setUpdateInterval(UPDATE_MS);
    this.subAccel = Accelerometer.addListener(({ x, y, z }) => {
      this.processFrame(x, y, z);
    });

    // Gyroscope
    Gyroscope.setUpdateInterval(UPDATE_MS);
    this.subGyro = Gyroscope.addListener(({ x, y, z }) => {
      this.currRotation = Math.sqrt(x * x + y * y + z * z);
    });
  }

  stop() {
    this.isRunning = false;
    if (this.subAccel) this.subAccel.remove();
    if (this.subGyro) this.subGyro.remove();
    this.stalta.reset();
  }

  private processFrame(x: number, y: number, z: number) {
    const rawMag = Math.sqrt(x * x + y * y + z * z);
    const linearAccel = Math.abs(rawMag - 1.0);

    // Noise gate
    if (linearAccel < MIN_G) {
      this.stalta.update(0);
      this.signalBuffer.push(0);
      return;
    }

    this.signalBuffer.push(linearAccel);
    const ratio = this.stalta.update(linearAccel);
    this.currentRatio = ratio;
    this.totalReadings++;
    this.lastDataTimestamp = Date.now();

    // Trigger Logic
    const dynamicTrigger = this.getDynamicThreshold();

    if (!this.isTriggered && ratio > dynamicTrigger) {
      this.handleTrigger(linearAccel, ratio);
    } else if (this.isTriggered && ratio < STA_LTA_DETRIGGER) {
      if (Date.now() - this.lastTriggerTime > MIN_TRIGGER_DURATION) {
        this.isTriggered = false;
      }
    }
  }

  private handleTrigger(accel: number, ratio: number) {
    // REJECTION 1: Rotation Check
    if (this.currRotation > ROTATION_THRESHOLD) {
      return;
    }

    // REJECTION 2: Frequency Analysis
    let frequency = 0;
    let signalData: number[] = [];

    if (this.signalBuffer.isFull()) {
      signalData = this.signalBuffer.toArray();
      frequency = this.freqAnalyzer.getDominantFrequency(signalData, HZ);
      this.lastFrequency = frequency;

      // High frequency = noise (motor, footsteps, etc.)
      if (frequency > NOISE_FREQ_THRESHOLD) {
        return;
      }
    }

    // ELITE UPGRADE: P-Wave Onset Detection (AIC)
    // Refine the trigger time using AIC Picker
    // If AIC fails to find a distinct onset, it might be gradual noise
    const pickIndex = AICPicker.pick(signalData);
    if (pickIndex === -1 && ratio < 8.0) {
      // Weak signal with no clear onset -> Skip
      return;
    }

    this.isTriggered = true;
    this.lastTriggerTime = Date.now();

    // ELITE UPGRADE: Polarization Analysis (PCA)
    // We need 3-component data history for this. 
    // Ideally we buffer X,Y,Z separately. For now, we simulate differentiation based on magnitude characteristics
    // or assumption. In a full implementation, RingBuffer would store {x,y,z} objects.

    // Mock PCA result based on verticality (Z-axis dominance currently not tracked in single buffer)
    // But we can infer from Frequency + Acceleration Profile

    // P-Wave Characteristics:
    // - Higher Frequency
    // - Vertical (Z) dominant (if we had axis data)
    // - Sharp onset (Low AIC index)

    // S-Wave Characteristics:
    // - Lower Frequency
    // - Horizontal dominant
    // - Larger amplitude

    let type: 'P-WAVE' | 'S-WAVE' = 'S-WAVE';
    let confidence = 75;

    // Elite Classification Logic
    const isSharpOnset = pickIndex > 0 && pickIndex < 20; // Early in the window
    const isSeismicFreq = frequency > 1.0 && frequency < 10.0;

    if (accel < P_WAVE_MAX_G && isSeismicFreq && isSharpOnset) {
      type = 'P-WAVE';
      confidence = 85;
      // Boost confidence if Ratio is high but G is low (Typical deep P-wave)
      if (ratio > 5.0) confidence += 10;
    } else {
      type = 'S-WAVE';
      confidence = 80;
      // S-waves are usually stronger
      if (accel > 0.05) confidence += 10;
    }

    // Cap confidence
    confidence = Math.min(100, confidence);

    // Emit Event
    if (this.onDetectionCallback) {
      this.confirmedEvents++;
      this.onDetectionCallback({
        id: Date.now().toString(),
        type,
        magnitude: accel,
        stalta: ratio,
        frequency,
        timestamp: Date.now(),
        confidence,
      });
    }
  }


  // ELITE: Public Getters for UI/Service
  getStatistics() {
    return {
      stalta: this.currentRatio,
      frequency: this.lastFrequency,
      rotation: this.currRotation,
      isTriggered: this.isTriggered,
      isRunning: this.isRunning,
      totalReadings: this.totalReadings,
      timeSinceLastData: this.lastDataTimestamp > 0 ? Date.now() - this.lastDataTimestamp : 999999,
      confirmedEvents: this.confirmedEvents,
    };
  }

  getRunningStatus(): boolean {
    return this.isRunning;
  }

  getRecentReadings(): number[] {
    return this.signalBuffer.toArray();
  }
}

export const seismicEngine = new AdvancedSeismicEngine();
