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
// Walking ~0.1g, typing ~0.05g.
// KRITIK FIX: 100km'deki M5.4 deprem cihazda ~0.005-0.02g üretir.
// Eski eşik 0.15g bu senaryoda 7-30 kat çok yüksekti → M5 altı tüm depremler sessiz geçiyordu.
const MIN_CONFIDENCE_FOR_ALERT = 80;       // 85→80: S-WAVE olaylarını da yakalamak için biraz gevşetildi
const MIN_MAGNITUDE_FOR_ALERT = 0.02;      // 0.15→0.02: 100km'deki M5+ deprem ~0.005-0.02g

// Super confidence threshold for FULL COUNTDOWN experience
// görev #18: Eşikler 88/0.2'den tutucu tek-dedektör değerlerine geri yükseltildi.
// Önceki yorum "EnsembleDetectionService 5 katmanlı filtre yukarı akışta koruma
// sağlar" diyordu — ama bu yol EnsembleDetectionService'i HİÇ çağırmıyor
// (SeismicSensorService.handleDetection doğrudan onDeviceEEWService.handleDetection'a
// gider). Tek dedektörle ~0.2g'lik bir sarsıntı bile tam ekran geri sayımı
// tetikleyebiliyordu. Tek dedektör için 95/0.3 yanlış pozitifleri minimumda tutar.
const SUPER_CONFIDENCE_THRESHOLD = 95;     // Tek dedektör — çok yüksek güven şart (ensemble yok)
const SUPER_MAGNITUDE_THRESHOLD = 0.3;     // 0.3g ≈ MMI VI+ — gerçek, aksiyon gerektiren sarsıntı

// Alert cooldown — 60s allows detection of rapid aftershock sequences (e.g. 2023 Kahramanmaraş)
const ALERT_COOLDOWN_MS = 60000;           // 60s minimum between on-device EEW alerts

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
      const { status } = await Location.getForegroundPermissionsAsync();
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
    // KRITIK FIX: Hem P-WAVE hem S-WAVE kabul et.
    // Mobil cihazda P-WAVE sınıflandırması (rectilinearity>0.7) nadiren geçer;
    // gerçek depremler S-WAVE'e düşüp atılıyordu. S-WAVE güçlü sarsıntı = aksiyon.
    // P-WAVE: daha düşük confidence eşiği (erken uyarı avantajı).
    // S-WAVE: daha yüksek magnitude eşiği (güçlü sarsıntıyı onayla).
    if (event.type !== 'P-WAVE' && event.type !== 'S-WAVE') return;

    // Debounce (Don't spam alerts for the same quake)
    if (Date.now() - this.lastAlertTime < ALERT_COOLDOWN_MS) return;

    logger.info(`🌊 Checking ${event.type}: Conf ${event.confidence}%, Mag ${event.magnitude.toFixed(3)}g`);

    // S-WAVE için biraz daha yüksek magnitude eşiği — güçlü sarsıntı onayı gerekir
    const magnitudeThreshold = event.type === 'S-WAVE'
      ? MIN_MAGNITUDE_FOR_ALERT * 1.5   // S-WAVE: 0.03g — sarsıntı zaten başladı
      : MIN_MAGNITUDE_FOR_ALERT;         // P-WAVE: 0.02g — erken uyarı

    // Check if meets threshold
    if (event.confidence >= MIN_CONFIDENCE_FOR_ALERT && event.magnitude >= magnitudeThreshold) {
      await this.triggerEarlyWarning(event);
    }
  }

  /**
   * ELITE: Trigger early warning with full countdown experience
   */
  private async triggerEarlyWarning(event: DetectionEvent) {
    // KRITIK FIX: isDeviceStill() guard KALDIRILDI.
    // Deprem anında cihaz zaten sarsılır → isDeviceStill() her zaman false döner
    // → P-dalgası algılama kalıcı olarak bloke oluyordu (sistemin kendini engellemesi).

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
      // KRİTİK (görev #12): Konum yoksa SAHTE (0,0) merkez (Null Island —
      // Türkiye'den ~6000 km) sentezleme. On-device EEW'de "origin" cihazın
      // kendi konumunun vekilidir; konum bilinmiyorsa origin tamamen atlanır.
      // Geri sayım süresi/büyüklük zaten origin'e bağlı değil; engine de
      // origin'i yalnızca mesh yayınında kullanır ve undefined'ı es geçer.
      ...(this.userLocation ? {
        origin: {
          latitude: this.userLocation.latitude,
          longitude: this.userLocation.longitude,
          depth: 10, // Assumed shallow
        },
      } : {}),
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
    const freq = event.frequency ?? 5;

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
    const normalizedConfidence = Math.max(0, Math.min(1, confidence / 100));
    // Cap confidence effect to +0.3 magnitude to avoid over-inflated alerts.
    const confMultiplier = normalizedConfidence * 0.3;

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
    const freq = event.frequency ?? 5;

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
      // görev #13: Boş catch yerine logla. Mesh yayını başarısızlığı kritik
      // DEĞİL (Firebase + bildirim yolları P-dalga sinyalini zaten taşır), bu
      // yüzden debug seviyesi — ama hata artık sessizce yutulmuyor.
      logger.debug('P-wave mesh broadcast failed (non-critical — Firebase/notification paths cover it):', error);
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
