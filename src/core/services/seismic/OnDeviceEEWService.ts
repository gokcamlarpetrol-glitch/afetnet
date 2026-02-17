/**
 * ON-DEVICE EEW SERVICE - ELITE EDITION V2
 * "Seconds Matter"
 * 
 * UPGRADED: Full integration with EEWCountdownEngine and Firebase
 * 
 * Listens to AdvancedSeismicEngine detections.
 * If a high-confidence P-Wave is detected:
 * 1. Calculates estimated S-Wave arrival time based on distance estimation.
 * 2. Triggers countdown engine with full UI experience.
 * 3. Reports to Firebase for crowdsourced consensus.
 * 4. Broadcasts to mesh network for offline users.
 * 
 * @version 2.0.0
 * @elite true
 */

import * as haptics from '../../utils/haptics';
import * as Location from 'expo-location';
// NotificationCenter handles all notifications now
import { createLogger } from '../../utils/logger';
import { seismicEngine, DetectionEvent } from './AdvancedSeismicEngine';
import { eewCountdownEngine, CountdownConfig } from '../EEWCountdownEngine';
import { eliteWaveCalculationService } from '../EliteWaveCalculationService';
import { savePWaveDetection } from '../firebase/FirebaseEEWOperations';
import { firebaseDataService } from '../FirebaseDataService';

const logger = createLogger('OnDeviceEEWService');

// ============================================================
// THRESHOLDS - ELITE OPTIMIZED FOR DEPREM AĞI-LEVEL SPEED
// ============================================================

// PRODUCTION: Thresholds calibrated to eliminate false positives from normal phone usage.
// Walking ~0.1g, typing ~0.05g, real earthquakes >0.15g at epicenter.
const MIN_CONFIDENCE_FOR_ALERT = 85;       // High confidence required to reduce false alerts
const MIN_MAGNITUDE_FOR_ALERT = 0.15;      // Well above walking/vibration noise floor

// Super confidence threshold for FULL COUNTDOWN experience
// Only the most certain detections get the full countdown UI
const SUPER_CONFIDENCE_THRESHOLD = 95;     // Must be very confident for full countdown
const SUPER_MAGNITUDE_THRESHOLD = 0.3;     // Strong shaking required for countdown

// Alert cooldown (prevent spam) - 2 minutes between alerts
const ALERT_COOLDOWN_MS = 120000;          // 120s minimum between on-device EEW alerts

// ============================================================
// SERVICE
// ============================================================

class OnDeviceEEWService {
  private isListening = false;
  private lastAlertTime = 0;
  private userLocation: { latitude: number; longitude: number } | null = null;
  private deviceId: string = '';

  /**
   * Start the on-device EEW service
   */
  async start() {
    if (this.isListening) return;
    this.isListening = true;

    logger.info('🚨 On-Device EEW Service V2 Armed');

    // Get device ID
    try {
      const Constants = require('expo-constants');
      this.deviceId = Constants.installationId || `device-${Date.now()}`;
    } catch {
      this.deviceId = `device-${Date.now()}`;
    }

    // Get initial location
    await this.updateUserLocation();
  }

  /**
   * Update user location
   */
  private async updateUserLocation(): Promise<void> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      this.userLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      logger.debug('Location update failed:', error);
    }
  }

  /**
   * Called by SeismicSensorService when a detection occurs
   */
  async handleDetection(event: DetectionEvent) {
    // Only process P-waves (S-waves are too late for early warning)
    if (event.type !== 'P-WAVE') return;

    // Debounce (Don't spam alerts for the same quake)
    if (Date.now() - this.lastAlertTime < ALERT_COOLDOWN_MS) return;

    logger.info(`🌊 Checking P-Wave: Conf ${event.confidence}%, Mag ${event.magnitude.toFixed(3)}g`);

    // Check if meets threshold
    if (event.confidence >= MIN_CONFIDENCE_FOR_ALERT && event.magnitude >= MIN_MAGNITUDE_FOR_ALERT) {
      await this.triggerEarlyWarning(event);
    }
  }

  /**
   * ELITE: Trigger early warning with full countdown experience
   */
  private async triggerEarlyWarning(event: DetectionEvent) {
    // ELITE: SAFETY CHECK - Activity Guard
    try {
      const { activityRecognitionService } = await import('../ActivityRecognitionService');
      if (!activityRecognitionService.isDeviceStill()) {
        logger.warn('⛔️ SEISMIC ALERT BLOCKED: Device is moving (Safety Protocol)');
        return;
      }
    } catch {
      // Activity recognition not available, continue cautiously
    }

    this.lastAlertTime = Date.now();
    logger.warn('🚨 LOCAL EEW TRIGGERED! P-WAVE DETECTED! 🚨');

    // ==================== FIREBASE REPORTING ====================
    // Report to Firebase immediately (fire and forget)
    this.reportToFirebase(event).catch(err => {
      if (__DEV__) logger.debug('Firebase reporting failed:', err);
    });

    // ==================== MESH NETWORK BROADCAST ====================
    // Broadcast to mesh network for offline users
    this.broadcastToMesh(event).catch(err => {
      if (__DEV__) logger.debug('Mesh broadcast failed:', err);
    });

    // ==================== CONFIDENCE CHECK ====================
    // Only show full alert if super confident
    const isSuperConfident = event.confidence > SUPER_CONFIDENCE_THRESHOLD &&
      event.magnitude > SUPER_MAGNITUDE_THRESHOLD;

    if (!isSuperConfident) {
      // PRODUCTION FIX: Do NOT send notifications for low-confidence detections.
      // This was the #1 source of notification spam (~200 alerts from normal phone movement).
      // Only log for debugging purposes.
      logger.info(`🔇 Silent Sentinel: Detection logged but NOT notified (conf=${event.confidence}%, mag=${event.magnitude.toFixed(3)}g)`);
      return;
    }

    // ==================== FULL COUNTDOWN EXPERIENCE ====================
    logger.warn('🔴 SUPER CONFIDENT P-WAVE! Starting full countdown!');

    // Immediate haptic feedback
    haptics.earthquakeWarning();

    // Update location for accurate calculations
    await this.updateUserLocation();

    // Estimate warning time based on P-wave characteristics
    const estimatedWarningTime = this.estimateWarningTime(event);

    // Estimate magnitude from G-force (rough approximation)
    const estimatedMagnitude = this.estimateMagnitudeFromGForce(event.magnitude, event.confidence);

    // Create countdown config
    const config: CountdownConfig = {
      warningTime: estimatedWarningTime,
      magnitude: estimatedMagnitude,
      estimatedIntensity: this.estimateIntensity(event.magnitude),
      location: 'Yerel Algılama - On-Device EEW',
      epicentralDistance: this.estimateDistance(event),
      pWaveArrivalTime: 0, // Already arrived
      sWaveArrivalTime: estimatedWarningTime,
      origin: this.userLocation ? {
        latitude: this.userLocation.latitude,
        longitude: this.userLocation.longitude,
        depth: 10, // Assumed shallow
      } : {
        latitude: 0,
        longitude: 0,
        depth: 10,
      },
    };

    // START COUNTDOWN ENGINE!
    await eewCountdownEngine.startCountdown(config);

    // Show critical notification via MagnitudeBasedNotificationService
    // CRITICAL FIX: Do NOT use notificationService.showEarthquakeNotification —
    // it calls showMagnitudeBasedNotification internally, adding unnecessary indirection.
    // Route directly to MBN which has cross-system dedup + rate limiting.
    try {
      const { notificationCenter } = await import('../notifications/NotificationCenter');
      await notificationCenter.notify('eew', {
        magnitude: estimatedMagnitude,
        location: `DEPREM UYARISI! ~${estimatedWarningTime}sn`,
        isEEW: true,
        timeAdvance: estimatedWarningTime,
        timestamp: Date.now(),
      }, 'OnDeviceEEWService');
    } catch (error) {
      logger.error('Failed to show on-device EEW notification:', error);
    }
  }

  /**
   * Estimate warning time based on P-wave characteristics
   */
  private estimateWarningTime(event: DetectionEvent): number {
    // P-wave frequency gives distance hint
    // Lower frequency = more distant = more warning time
    const freq = event.frequency || 5;

    if (freq < 2) return 15; // Very low freq = distant (15s)
    if (freq < 5) return 10; // Low freq = medium (10s)
    if (freq < 10) return 7;  // Medium freq = closer (7s)
    return 5; // High freq = close (5s minimum)
  }

  /**
   * Estimate magnitude from G-force
   */
  private estimateMagnitudeFromGForce(gForce: number, confidence: number): number {
    // Rough approximation based on near-field PGA
    // Higher confidence = trust the reading more
    const confMultiplier = confidence / 100;

    if (gForce < 0.02) return 4.0 + confMultiplier;
    if (gForce < 0.05) return 4.5 + confMultiplier;
    if (gForce < 0.10) return 5.0 + confMultiplier;
    if (gForce < 0.20) return 5.5 + confMultiplier;
    if (gForce < 0.50) return 6.0 + confMultiplier;
    return 6.5 + confMultiplier;
  }

  /**
   * Estimate intensity (MMI) from G-force
   */
  private estimateIntensity(gForce: number): number {
    if (gForce < 0.02) return 4; // Light
    if (gForce < 0.05) return 5; // Moderate
    if (gForce < 0.10) return 6; // Strong
    if (gForce < 0.20) return 7; // Very Strong
    if (gForce < 0.50) return 8; // Severe
    return 9; // Violent
  }

  /**
   * Estimate distance from P-wave characteristics
   */
  private estimateDistance(event: DetectionEvent): number {
    // Frequency-based distance estimation
    // Ts - Tp ≈ Distance/8 for typical crustal velocities
    const freq = event.frequency || 5;

    if (freq < 2) return 100; // ~100km
    if (freq < 5) return 50;  // ~50km
    if (freq < 10) return 25; // ~25km
    return 10; // ~10km
  }

  /**
   * ELITE: Report to Firebase for crowdsourced consensus
   */
  private async reportToFirebase(event: DetectionEvent): Promise<void> {
    if (!this.userLocation) {
      await this.updateUserLocation();
    }

    if (!this.userLocation) {
      logger.debug('No location available for Firebase report');
      return;
    }

    await savePWaveDetection({
      deviceId: this.deviceId,
      timestamp: event.timestamp || Date.now(),
      latitude: this.userLocation.latitude,
      longitude: this.userLocation.longitude,
      accuracy: 100,
      magnitude: event.magnitude,
      frequency: event.frequency || 0,
      confidence: event.confidence,
      staltaRatio: event.stalta || 0,
    }, firebaseDataService.isInitialized);

    logger.info('📤 P-wave reported to Firebase');
  }

  /**
   * ELITE: Broadcast to mesh network
   */
  private async broadcastToMesh(event: DetectionEvent): Promise<void> {
    try {
      const { meshNetworkService } = await import('../mesh/MeshNetworkService');
      const { MeshMessageType } = await import('../mesh/MeshProtocol');

      // Safe check - use getIsRunning() method
      if (!meshNetworkService.getIsRunning()) return;

      await meshNetworkService.broadcastMessage(
        JSON.stringify({
          type: 'P_WAVE_DETECTED',
          magnitude: event.magnitude,
          confidence: event.confidence,
          timestamp: event.timestamp || Date.now(),
          location: this.userLocation,
        }),
        MeshMessageType.SOS,
      );

      logger.info('📡 P-wave broadcast to mesh network');
    } catch (error) {
      // Mesh not available
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  private async reportToSwarm(event: DetectionEvent): Promise<void> {
    // Now forwards to Firebase
    await this.reportToFirebase(event);
  }
}

export const onDeviceEEWService = new OnDeviceEEWService();
