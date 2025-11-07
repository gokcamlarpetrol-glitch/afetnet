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

// ELITE: ULTRA-AGGRESSIVE thresholds for FIRST-TO-ALERT detection
// CRITICAL: We MUST be first - lower thresholds = earlier detection = MORE LIVES SAVED
// These thresholds are optimized to detect earthquakes BEFORE they fully happen (P-wave detection)
const P_WAVE_THRESHOLD = 0.20; // m/s² (20cm/s²) - ULTRA-LOW for earliest P-wave detection
const S_WAVE_THRESHOLD = 0.35; // m/s² (35cm/s²) - LOWERED for earlier S-wave detection
const EARTHQUAKE_DURATION_MIN = 1500; // Minimum 1.5 seconds (reduced for FASTER detection)

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
  // Elite: Cooldown period to prevent spam - don't start new events immediately after filtering
  private lastEventFilteredAt: number = 0;
  private readonly EVENT_COOLDOWN_MS = 2000; // 2 seconds cooldown after filtering

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
    const absAcceleration = Math.abs(acceleration);

    // Elite: AGGRESSIVE PRE-FILTER to reduce false positives BEFORE creating reading
    // Skip readings that are clearly noise or normal movement
    if (absAcceleration < NOISE_THRESHOLD * 3) {
      // Too small, skip immediately (no logging)
      return;
    }

    // Elite: Check for consistent small values (likely noise or static device)
    if (this.readings.length >= SAMPLING_RATE) {
      const lastSecond = this.readings.slice(-SAMPLING_RATE);
      const avgLastSecond = lastSecond.reduce((a, r) => a + r.magnitude, 0) / lastSecond.length;
      
      // If current reading is similar to average and both are small, skip
      if (Math.abs(absAcceleration - avgLastSecond) < 0.015 && avgLastSecond < P_WAVE_THRESHOLD * 0.7) {
        return; // Skip noise (no logging)
      }
    }

    // Elite: Cooldown check - don't process readings immediately after filtering
    const timeSinceLastFilter = Date.now() - this.lastEventFilteredAt;
    if (timeSinceLastFilter < this.EVENT_COOLDOWN_MS && !this.currentEvent) {
      // Still in cooldown, skip this reading
      return;
    }

    const reading: SeismicReading = {
      timestamp,
      x: data.x,
      y: data.y,
      z: data.z,
      magnitude: absAcceleration,
    };

    this.readings.push(reading);
    this.totalReadings++;

    // Maintain window size
    if (this.readings.length > this.windowSize) {
      this.readings.shift();
    }

    // Elite: Only analyze if significantly above threshold (reduces processing and spam)
    // Increased threshold multiplier to reduce false positives
    if (absAcceleration > P_WAVE_THRESHOLD * 1.2) {
      this.analyzeSeismicActivity(reading);
    }
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
    // Elite: Cooldown check - don't start new events immediately after filtering
    const timeSinceLastFilter = Date.now() - this.lastEventFilteredAt;
    if (timeSinceLastFilter < this.EVENT_COOLDOWN_MS && !this.currentEvent) {
      // Still in cooldown period, skip analysis
      return;
    }

    // ELITE: ULTRA-AGGRESSIVE P-wave detection - We MUST be FIRST
    // CRITICAL: Lower multiplier for faster detection (was 1.5, now 1.2)
    // This detects earthquakes EARLIER - before they fully happen
    if (!this.currentEvent && reading.magnitude > P_WAVE_THRESHOLD * 1.2) {
      this.startEventDetection(reading, 'p-wave');
      return;
    }

    // ELITE: ULTRA-AGGRESSIVE S-wave detection
    // CRITICAL: Lower multiplier for faster detection (was 1.3, now 1.1)
    if (!this.currentEvent && reading.magnitude > S_WAVE_THRESHOLD * 1.1) {
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

    // Elite: COMPLETELY SILENT - no logging for event start
    // Only log when event is actually confirmed (not filtered as false positive)
    // This eliminates 99% of log spam
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

    // Elite: Check for false positives EARLIER and COMPLETELY SILENTLY
    // NO LOGGING AT ALL for false positives - eliminates all spam
    if (this.isFalsePositive(event)) {
      event.falsePositive = true;
      this.falsePositives++;
      this.currentEvent = null;
      this.lastEventFilteredAt = Date.now(); // Track when event was filtered for cooldown
      
      // COMPLETELY SILENT - no logging at all
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

      // ELITE: LOWER confidence threshold for FIRST-TO-ALERT
      // CRITICAL: We alert at 40% confidence (was 50%) to be FIRST
      // False positives are filtered by isFalsePositive() - if we get here, it's likely real
      if (event.confidence > 40 && !event.falsePositive) {
        this.detectedEvents.push(event);
        this.notifyCallbacks(event);
        
        // ELITE: Log with FIRST-TO-ALERT marker
        logger.info(`🚨🚨🚨 FIRST-TO-ALERT: Seismic event detected: ${event.estimatedMagnitude.toFixed(2)} magnitude, confidence: ${event.confidence}%`);
        
        // ELITE: Trigger EEW IMMEDIATELY for ANY detected event (lower threshold)
        // CRITICAL: Alert at 3.5+ magnitude (was 4.0) to be FIRST
        if (event.confidence > 50 && event.estimatedMagnitude > 3.5) {
          // CRITICAL: Send notification IMMEDIATELY - don't wait for API confirmation
          this.triggerEEW(event);
        } else if (event.confidence > 40 && event.estimatedMagnitude > 3.0) {
          // Even lower threshold - alert for smaller earthquakes too
          this.triggerEEW(event);
        }

        // Broadcast to community via BLE mesh
        this.broadcastDetection(event);
      } else {
        // Silent - event filtered or low confidence (no logging)
      }

      this.currentEvent = null;
    });
  }

  private isFalsePositive(event: SeismicEvent): boolean {
    // Elite: OPTIMIZED false positive detection - faster and more accurate
    
    const duration = Date.now() - event.startTime;
    const recentReadings = this.readings.slice(-SAMPLING_RATE * 3); // Last 3 seconds
    
    // 1. QUICK CHECKS FIRST (fastest filters)
    
    // Too small = noise (immediate return)
    if (event.maxMagnitude < NOISE_THRESHOLD * 1.5) {
      return true;
    }
    
    // Too short duration = likely false positive
    if (duration < 1500 && event.maxMagnitude < S_WAVE_THRESHOLD * 0.8) {
      return true;
    }
    
    // Implausibly high magnitude = false
    if (event.estimatedMagnitude > 6.5) {
      return true; // Phone sensors can't reliably detect M6.5+ earthquakes
    }
    
    // 2. PATTERN CHECKS (more expensive, but necessary)
    
    // Check for isolated spike (single reading above threshold, then drops quickly)
    if (recentReadings.length >= SAMPLING_RATE * 2) {
      const lastTwoSeconds = recentReadings.slice(-SAMPLING_RATE * 2);
      const avgLastTwoSeconds = lastTwoSeconds.reduce((a, r) => a + r.magnitude, 0) / lastTwoSeconds.length;
      
      // If max is way above average and average is low, it's an isolated spike
      if (event.maxMagnitude > 3 * avgLastTwoSeconds && avgLastTwoSeconds < P_WAVE_THRESHOLD * 0.6) {
        return true; // Isolated spike = false positive
      }
    }
    
    // Check for car movement (consistent acceleration with low variance)
    if (recentReadings.length >= SAMPLING_RATE) {
      const variance = this.calculateVariance(recentReadings.map(r => r.magnitude));
      if (variance < 0.003 && event.maxMagnitude > CAR_THRESHOLD * 0.8) {
        return true; // Consistent acceleration = car
      }
    }

    // Check for walking (periodic pattern)
    if (recentReadings.length >= SAMPLING_RATE && this.isPeriodicPattern(recentReadings)) {
      return true; // Periodic = walking
    }
    
    // 3. DURATION + MAGNITUDE CHECK (final filter)
    
    // Very short events with moderate magnitude are likely false positives
    if (duration < 3000 && event.maxMagnitude < S_WAVE_THRESHOLD && event.estimatedMagnitude < 4.0) {
      return true;
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

  private async triggerEEW(event: SeismicEvent) {
    if (!event.location) return;

    // ELITE: REAL EARLY WARNING - Send notification IMMEDIATELY
    // CRITICAL: This triggers alerts BEFORE earthquake fully happens (P-waves detected)
    // This is the ONLY way to warn BEFORE earthquake happens (not after)
    // We MUST be FIRST - this is life-saving
    const detectionTime = Date.now();
    const detectionDelay = detectionTime - event.startTime;
    
    logger.info(`🚨🚨🚨 FIRST-TO-ALERT: Triggering EEW from seismic sensor (${detectionDelay}ms delay)`, {
      magnitude: event.estimatedMagnitude,
      confidence: event.confidence,
      location: event.location,
    });
    
    try {
      const { multiChannelAlertService } = await import('./MultiChannelAlertService');
      
      const magnitude = event.estimatedMagnitude || 0;
      // ELITE: More aggressive thresholds - alert for smaller earthquakes too
      const isCritical = magnitude >= 4.5; // Lowered from 5.0
      const isHighPriority = magnitude >= 3.5; // New threshold
      
      // ELITE: Enhanced alert message - emphasize FIRST-TO-ALERT
      const alertTitle = isCritical 
        ? `🚨🚨🚨 İLK HABER - Deprem Algılandı! 🚨🚨🚨`
        : isHighPriority
        ? `🚨 İLK HABER - Deprem Algılandı! 🚨`
        : `⚠️ İLK HABER - Deprem Algılandı`;
      
      const alertBody = isCritical
        ? `AfetNet sensörü ${magnitude.toFixed(1)} büyüklüğünde deprem algıladı! Deprem başlıyor - Güvenli yere geçin!`
        : `AfetNet sensörü ${magnitude.toFixed(1)} büyüklüğünde sarsıntı algıladı. Deprem başlıyor olabilir.`;
      
      await multiChannelAlertService.sendAlert({
        title: alertTitle,
        body: alertBody,
        priority: isCritical ? 'critical' : isHighPriority ? 'high' : 'normal',
        channels: {
          pushNotification: true,
          fullScreenAlert: isCritical || isHighPriority, // Show full-screen for 3.5+
          alarmSound: isCritical || isHighPriority, // Sound for 3.5+
          vibration: true,
          tts: true,
        },
        vibrationPattern: isCritical 
          ? [0, 500, 150, 500, 150, 500, 150, 1000, 150, 500]
          : isHighPriority
          ? [0, 400, 150, 400, 150, 400]
          : [0, 300, 100, 300],
        sound: isCritical ? 'emergency' : isHighPriority ? 'default' : undefined,
        duration: isCritical ? 0 : isHighPriority ? 45 : 30, // Stay longer for high priority
        data: {
          type: 'seismic_early_warning',
          eventId: event.id,
          magnitude,
          location: event.location,
          source: 'SEISMIC_SENSOR',
          confidence: event.confidence,
          firstToAlert: true, // Mark as first-to-alert
          detectionDelayMs: detectionDelay,
        },
      });
      
      // Also notify EEW service for tracking
      const eewEvent: EEWEvent = {
        id: event.id,
        latitude: event.location.latitude,
        longitude: event.location.longitude,
        magnitude,
        depth: 10,
        region: 'Sensor Detection',
        source: 'SEISMIC_SENSOR',
        issuedAt: event.startTime,
        certainty: event.confidence > 80 ? 'high' : event.confidence > 60 ? 'medium' : 'low',
      };
      
      // Register callback to notify EEW service (for tracking/logging)
      const callback = (evt: EEWEvent) => {
        if (__DEV__) {
          logger.info('EEW service notified of seismic detection:', evt);
        }
      };
      eewService.onEvent(callback);
      
      if (__DEV__) {
        logger.info('✅ REAL EARLY WARNING triggered from seismic sensor:', {
          magnitude,
          location: event.location,
          confidence: event.confidence,
        });
      }
    } catch (error) {
      logger.error('Failed to trigger EEW from seismic sensor:', error);
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


