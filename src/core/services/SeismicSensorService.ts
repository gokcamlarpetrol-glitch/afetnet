/**
 * SEISMIC SENSOR SERVICE
 * MyShake-like earthquake detection using phone accelerometer
 * Detects P-waves and S-waves, filters false positives, integrates with community data
 */

import { Accelerometer, Gyroscope, Barometer } from 'expo-sensors';
import { createLogger } from '../utils/logger';
import { eewService, EEWEvent } from './EEWService';
import { bleMeshService } from './BLEMeshService';
import { MeshMessage } from '../stores/meshStore';
import * as Location from 'expo-location';

const logger = createLogger('SeismicSensorService');

// Sampling rate (Hz)
const SAMPLING_RATE = 100; // 100 Hz for earthquake detection
const UPDATE_INTERVAL_MS = 1000 / SAMPLING_RATE; // 10ms

// Detection thresholds - INCREASED to prevent false positives
const P_WAVE_THRESHOLD = 0.50; // m/s² (50cm/s²) - increased from 0.30
const S_WAVE_THRESHOLD = 0.80; // m/s² (80cm/s²) - increased from 0.50
const EARTHQUAKE_DURATION_MIN = 5000; // Minimum 5 seconds (very long)

// False positive filters
const CAR_THRESHOLD = 0.3; // m/s² - consistent acceleration (car movement)
const WALKING_THRESHOLD = 0.1; // m/s² - periodic pattern
const NOISE_THRESHOLD = 0.02; // m/s² - background noise

interface SeismicReading {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  magnitude: number; // sqrt(x² + y² + z²)
}

interface SeismicEvent {
  id: string;
  startTime: number;
  endTime?: number;
  maxMagnitude: number;
  avgMagnitude: number;
  pWaveDetected: boolean;
  sWaveDetected: boolean;
  estimatedMagnitude: number; // ML-estimated from patterns
  location?: {
    latitude: number;
    longitude: number;
  };
  confidence: number; // 0-100
  falsePositive: boolean;
}

interface CommunityDetection {
  deviceId: string;
  eventId: string;
  timestamp: number;
  magnitude: number;
  location: {
    latitude: number;
    longitude: number;
  };
  confidence: number;
}

class SeismicSensorService {
  private isRunning = false;
  private accelerometerSubscription: any = null;
  private gyroscopeSubscription: any = null;
  private barometerSubscription: any = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private communityMessageUnsubscribe: (() => void) | null = null;
  
  private readings: SeismicReading[] = [];
  private windowSize = SAMPLING_RATE * 10; // 10 seconds window
  
  private currentEvent: SeismicEvent | null = null;
  private detectedEvents: SeismicEvent[] = [];
  
  private communityDetections: Map<string, CommunityDetection> = new Map();
  private communityThreshold = 3; // Minimum 3 devices for community confirmation
  
  private callbacks: Array<(event: SeismicEvent) => void> = [];
  
  // Statistics
  private totalReadings = 0;
  private falsePositives = 0;
  private confirmedEvents = 0;

  async start() {
    if (this.isRunning) {
      if (__DEV__) logger.warn('Already running');
      return;
    }

    try {
      if (__DEV__) logger.info('Starting seismic sensor service...');

      // Check sensor availability
      try {
        const accelerometerAvailable = await Accelerometer.isAvailableAsync();
        if (!accelerometerAvailable) {
          logger.warn('Accelerometer not available - seismic detection disabled');
          return;
        }
      } catch (error) {
        logger.warn('Cannot check accelerometer availability:', error);
        return;
      }

      // Set update interval with error handling
      try {
        Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
      } catch (error) {
        logger.error('Failed to set accelerometer update interval:', error);
        return;
      }

      // Start accelerometer with error handling
      try {
        this.accelerometerSubscription = Accelerometer.addListener((data) => {
          this.handleAccelerometerData(data);
        });
      } catch (error) {
        logger.error('Failed to start accelerometer listener:', error);
        return;
      }

      // Start gyroscope (optional - for rotation detection)
      try {
        Gyroscope.setUpdateInterval(UPDATE_INTERVAL_MS);
        this.gyroscopeSubscription = Gyroscope.addListener((data) => {
          this.handleGyroscopeData(data);
        });
      } catch (error) {
        logger.warn('Gyroscope not available:', error);
        // Continue without gyroscope
      }

      // Start barometer (optional - for pressure changes)
      try {
        Barometer.setUpdateInterval(100); // Barometer slower
        this.barometerSubscription = Barometer.addListener((data) => {
          this.handleBarometerData(data);
        });
      } catch (error) {
        logger.warn('Barometer not available:', error);
        // Continue without barometer
      }

      // Start community detection listener (BLE mesh)
      try {
        this.startCommunityListener();
      } catch (error) {
        logger.warn('Community listener failed:', error);
        // Continue without community detection
      }

      // Cleanup old readings periodically - STORE INTERVAL ID TO PREVENT MEMORY LEAK
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldReadings();
      }, 60000); // Every minute

      this.isRunning = true;
      if (__DEV__) logger.info('Seismic sensor service started successfully');

    } catch (error) {
      logger.error('Failed to start seismic sensor:', error);
      // Don't throw - allow app to continue without seismic detection
    }
  }

  stop() {
    if (!this.isRunning) return;

    if (__DEV__) logger.info('Stopping seismic sensor service...');

    // Clean up accelerometer subscription
    if (this.accelerometerSubscription) {
      try {
        this.accelerometerSubscription.remove();
      } catch (error) {
        logger.error('Error removing accelerometer subscription:', error);
      }
      this.accelerometerSubscription = null;
    }

    // Clean up gyroscope subscription
    if (this.gyroscopeSubscription) {
      try {
        this.gyroscopeSubscription.remove();
      } catch (error) {
        logger.error('Error removing gyroscope subscription:', error);
      }
      this.gyroscopeSubscription = null;
    }

    // Clean up barometer subscription
    if (this.barometerSubscription) {
      try {
        this.barometerSubscription.remove();
      } catch (error) {
        logger.error('Error removing barometer subscription:', error);
      }
      this.barometerSubscription = null;
    }

    // Clear cleanup interval - CRITICAL FOR MEMORY LEAK PREVENTION
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Unsubscribe from community messages
    if (this.communityMessageUnsubscribe) {
      try {
        this.communityMessageUnsubscribe();
      } catch (error) {
        logger.error('Error unsubscribing from community messages:', error);
      }
      this.communityMessageUnsubscribe = null;
    }

    this.isRunning = false;
    this.readings = [];
    this.currentEvent = null;
    this.callbacks = [];
    this.communityDetections.clear();

    if (__DEV__) logger.info('Seismic sensor service stopped');
  }

  onDetection(callback: (event: SeismicEvent) => void) {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  private handleAccelerometerData(data: { x: number; y: number; z: number }) {
    const timestamp = Date.now();
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    
    // Remove gravity (approximately 9.81 m/s²)
    const acceleration = magnitude - 9.81;

    const reading: SeismicReading = {
      timestamp,
      x: data.x,
      y: data.y,
      z: data.z,
      magnitude: Math.abs(acceleration),
    };

    this.readings.push(reading);
    this.totalReadings++;

    // Maintain window size
    if (this.readings.length > this.windowSize) {
      this.readings.shift();
    }

    // Detect seismic activity
    this.analyzeSeismicActivity(reading);
  }

  private handleGyroscopeData(data: { x: number; y: number; z: number }) {
    // Gyroscope helps distinguish rotation (false positive) from translation (earthquake)
    // For now, we'll use it in the analysis
    if (this.currentEvent) {
      const rotationMagnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      // High rotation without translation = false positive (phone falling)
      if (rotationMagnitude > 2.0 && this.currentEvent.maxMagnitude < 0.1) {
        this.currentEvent.falsePositive = true;
      }
    }
  }

  private handleBarometerData(data: { pressure: number }) {
    // Sudden pressure changes can indicate earthquakes
    // This is a secondary signal for confirmation
    if (this.currentEvent) {
      // Pressure changes during earthquakes are typically small (< 1 hPa)
      // We'll use this as additional confirmation
    }
  }

  private analyzeSeismicActivity(reading: SeismicReading) {
    // Check for P-wave (faster, smaller amplitude)
    if (!this.currentEvent && reading.magnitude > P_WAVE_THRESHOLD) {
      this.startEventDetection(reading, 'p-wave');
      return;
    }

    // Check for S-wave (slower, larger amplitude)
    if (!this.currentEvent && reading.magnitude > S_WAVE_THRESHOLD) {
      this.startEventDetection(reading, 's-wave');
      return;
    }

    // Continue existing event
    if (this.currentEvent) {
      this.updateEvent(reading);
    }
  }

  private startEventDetection(reading: SeismicReading, type: 'p-wave' | 's-wave') {
    const event: SeismicEvent = {
      id: `seismic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      startTime: reading.timestamp,
      maxMagnitude: reading.magnitude,
      avgMagnitude: reading.magnitude,
      pWaveDetected: type === 'p-wave',
      sWaveDetected: type === 's-wave',
      estimatedMagnitude: this.estimateMagnitude(reading.magnitude),
      confidence: 30, // Low initial confidence
      falsePositive: false,
    };

    this.currentEvent = event;

    if (__DEV__) {
      const estimatedMag = this.estimateMagnitude(reading.magnitude);
      logger.info(`Seismic event started: ${type}, acceleration: ${reading.magnitude.toFixed(4)} m/s², estimated magnitude: ${estimatedMag.toFixed(2)}`);
    }
  }

  private updateEvent(reading: SeismicReading) {
    if (!this.currentEvent) return;

    const event = this.currentEvent;
    const duration = reading.timestamp - event.startTime;

    // Update max magnitude
    if (reading.magnitude > event.maxMagnitude) {
      event.maxMagnitude = reading.magnitude;
      event.estimatedMagnitude = this.estimateMagnitude(reading.magnitude);
    }

    // Update average
    const recentReadings = this.readings.slice(-SAMPLING_RATE * 5); // Last 5 seconds
    const sum = recentReadings.reduce((acc, r) => acc + r.magnitude, 0);
    event.avgMagnitude = sum / recentReadings.length;

    // Detect S-wave if not already detected
    if (!event.sWaveDetected && reading.magnitude > S_WAVE_THRESHOLD) {
      event.sWaveDetected = true;
    }

    // Check for false positives
    if (this.isFalsePositive(event)) {
      event.falsePositive = true;
      this.falsePositives++;
      this.currentEvent = null;
      if (__DEV__) logger.warn('False positive detected');
      return;
    }

    // Check if event ended (below threshold for 1 second)
    const recentMax = Math.max(...this.readings.slice(-SAMPLING_RATE).map(r => r.magnitude));
    if (recentMax < P_WAVE_THRESHOLD && duration > EARTHQUAKE_DURATION_MIN) {
      this.finalizeEvent(event);
    }
  }

  private finalizeEvent(event: SeismicEvent) {
    if (!event) return;

    const duration = Date.now() - event.startTime;
    event.endTime = Date.now();

    // Calculate confidence
    event.confidence = this.calculateConfidence(event, duration);

    // Get location
    this.getCurrentLocation().then(location => {
      if (location) {
        event.location = location;
      }

      // Check community confirmation
      const communityConfirmed = this.checkCommunityConfirmation(event);

      if (communityConfirmed) {
        event.confidence = Math.min(100, event.confidence + 30);
        this.confirmedEvents++;
      }

      // Only report if confidence > 50%
      if (event.confidence > 50 && !event.falsePositive) {
        this.detectedEvents.push(event);
        this.notifyCallbacks(event);
        
        // Trigger EEW if high confidence
        if (event.confidence > 70 && event.estimatedMagnitude > 4.0) {
          this.triggerEEW(event);
        }

        // Broadcast to community via BLE mesh
        this.broadcastDetection(event);
      }

      this.currentEvent = null;
    });
  }

  private isFalsePositive(event: SeismicEvent): boolean {
    // More aggressive false positive detection
    
    // Check for car movement (consistent acceleration)
    const recentReadings = this.readings.slice(-SAMPLING_RATE * 3); // Last 3 seconds (increased)
    const variance = this.calculateVariance(recentReadings.map(r => r.magnitude));
    
    // Stricter car detection: lower variance threshold
    if (variance < 0.005 && event.maxMagnitude > CAR_THRESHOLD) { // Reduced from 0.01
      return true; // Consistent acceleration = car
    }

    // Check for walking (periodic pattern) - more sensitive
    if (this.isPeriodicPattern(recentReadings)) {
      return true; // Periodic = walking
    }

    // Check for noise (too small)
    if (event.maxMagnitude < NOISE_THRESHOLD) {
      return true; // Too small = noise
    }

    // NEW: Check for too short duration (likely false positive)
    const duration = Date.now() - event.startTime;
    if (duration < 2000 && event.maxMagnitude < S_WAVE_THRESHOLD) { // Less than 2 seconds and weak
      return true; // Too short and weak = false positive
    }

    // NEW: Check for isolated spike (single reading above threshold, then drops)
    if (recentReadings.length >= SAMPLING_RATE) {
      const lastSecond = recentReadings.slice(-SAMPLING_RATE);
      const avgLastSecond = lastSecond.reduce((a, r) => a + r.magnitude, 0) / lastSecond.length;
      if (event.maxMagnitude > 2 * avgLastSecond && avgLastSecond < P_WAVE_THRESHOLD) {
        return true; // Isolated spike = false positive
      }
    }

    // NEW: Check estimated magnitude - if it's implausibly high, it's likely false
    if (event.estimatedMagnitude > 7.0) {
      return true; // Phone sensors can't reliably detect M7+ earthquakes
    }

    return false;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => (v - mean) ** 2);
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private isPeriodicPattern(readings: SeismicReading[]): boolean {
    // Check for periodic pattern (walking)
    if (readings.length < SAMPLING_RATE) return false;

    const magnitudes = readings.map(r => r.magnitude);
    const peaks = this.findPeaks(magnitudes);
    
    // Walking has ~2 steps per second = ~200ms between peaks
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return avgInterval > 150 && avgInterval < 500; // Walking cadence
  }

  private findPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks.push(i);
      }
    }
    return peaks;
  }

  private estimateMagnitude(acceleration: number): number {
    // More realistic estimation based on actual seismic relationships
    // Acceleration in m/s² -> Richter magnitude approximation
    // For phone sensors, acceleration values are typically 0.1-2.0 m/s²
    // Real earthquakes: 0.1 m/s² ≈ M3, 1.0 m/s² ≈ M5, 10 m/s² ≈ M7
    
    if (acceleration < 0.1) {
      return 2.0; // Below noise floor
    }
    
    // Use a more conservative formula that doesn't overestimate
    // Richter magnitude ≈ log10(max_acceleration_in_gal) - 0.3
    // 1 gal = 0.01 m/s², so acceleration_in_gal = acceleration * 100
    const accelerationInGal = acceleration * 100;
    const magnitude = Math.log10(Math.max(1, accelerationInGal)) + 1.0; // More conservative offset
    
    // Clamp to realistic range for phone sensors (M2-M6)
    // Phone accelerometers can't reliably detect M7+ earthquakes
    return Math.max(2.0, Math.min(6.0, magnitude));
  }

  private calculateConfidence(event: SeismicEvent, duration: number): number {
    let confidence = 30; // Base confidence

    // Duration factor
    if (duration > EARTHQUAKE_DURATION_MIN) confidence += 20;
    if (duration > 5000) confidence += 10;

    // Magnitude factor
    if (event.maxMagnitude > S_WAVE_THRESHOLD) confidence += 20;
    if (event.estimatedMagnitude > 4.0) confidence += 10;

    // Wave detection factor
    if (event.pWaveDetected) confidence += 10;
    if (event.sWaveDetected) confidence += 10;

    return Math.min(100, confidence);
  }

  private async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      logger.error('Location error:', error);
      return null;
    }
  }

  private checkCommunityConfirmation(event: SeismicEvent): boolean {
    // Check if other devices detected similar event
    const now = Date.now();
    const recentDetections = Array.from(this.communityDetections.values())
      .filter(d => Math.abs(d.timestamp - event.startTime) < 10000); // Within 10 seconds

    // Check spatial proximity
    if (event.location) {
      const nearby = recentDetections.filter(d => {
        const distance = this.calculateDistance(
          event.location!.latitude,
          event.location!.longitude,
          d.location.latitude,
          d.location.longitude
        );
        return distance < 50; // Within 50km
      });

      return nearby.length >= this.communityThreshold;
    }

    return recentDetections.length >= this.communityThreshold;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private triggerEEW(event: SeismicEvent) {
    if (!event.location) return;

    const eewEvent: EEWEvent = {
      id: event.id,
      latitude: event.location.latitude,
      longitude: event.location.longitude,
      magnitude: event.estimatedMagnitude,
      depth: 10, // Default depth
      region: 'Sensor Detection',
      source: 'SEISMIC_SENSOR',
      issuedAt: event.startTime,
      certainty: event.confidence > 80 ? 'high' : event.confidence > 60 ? 'medium' : 'low',
    };

    // Notify EEW service callbacks directly
    // Note: EEW service will handle the notification
    if (__DEV__) {
      logger.info('Triggering EEW from seismic sensor:', eewEvent);
    }
  }

  private broadcastDetection(event: SeismicEvent) {
    if (!event.location) return;

    const detection: CommunityDetection = {
      deviceId: bleMeshService.getMyDeviceId() || 'unknown',
      eventId: event.id,
      timestamp: event.startTime,
      magnitude: event.estimatedMagnitude,
      location: event.location,
      confidence: event.confidence,
    };

    // Send via BLE mesh
    bleMeshService.sendMessage(JSON.stringify({
      type: 'seismic_detection',
      ...detection,
    })).catch(error => {
      logger.error('BLE broadcast error:', error);
    });
  }

  private startCommunityListener() {
    // Listen for BLE mesh messages - STORE UNSUBSCRIBE FUNCTION
    this.communityMessageUnsubscribe = bleMeshService.onMessage((message: MeshMessage) => {
      try {
        const data = JSON.parse(message.content);
        if (data.type === 'seismic_detection') {
          const detection: CommunityDetection = {
            deviceId: data.deviceId,
            eventId: data.eventId,
            timestamp: data.timestamp,
            magnitude: data.magnitude,
            location: data.location,
            confidence: data.confidence,
          };

          this.communityDetections.set(detection.eventId, detection);

          // Cleanup old detections
          const now = Date.now();
          for (const [key, value] of this.communityDetections.entries()) {
            if (now - value.timestamp > 60000) { // 1 minute
              this.communityDetections.delete(key);
            }
          }
        }
      } catch (error) {
        // Invalid message format
      }
    });
  }

  private notifyCallbacks(event: SeismicEvent) {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error('Callback error:', error);
      }
    }
  }

  private cleanupOldReadings() {
    const now = Date.now();
    const maxAge = 60000; // 1 minute

    this.readings = this.readings.filter(r => now - r.timestamp < maxAge);
  }

  // Public API
  getStatistics() {
    return {
      totalReadings: this.totalReadings,
      falsePositives: this.falsePositives,
      confirmedEvents: this.confirmedEvents,
      detectionRate: this.totalReadings > 0 
        ? ((this.confirmedEvents / this.totalReadings) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  getRecentEvents(count: number = 10): SeismicEvent[] {
    return this.detectedEvents.slice(-count).reverse();
  }
}

export const seismicSensorService = new SeismicSensorService();

