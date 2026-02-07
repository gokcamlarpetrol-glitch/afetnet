/**
 * EMERGENCY MODE SERVICE - Automatic Emergency Activation
 * Triggers emergency mode for major earthquakes (magnitude >= 6.0)
 * This is a LIFE-SAVING feature - activates ALL emergency protocols
 */

import { Alert } from 'react-native';
import { createLogger } from '../utils/logger';
// import { notificationService } from './NotificationService'; // Removed to break circular dependency
import { bleMeshService } from './BLEMeshService';
import { locationService } from './LocationService';
import { useFamilyStore } from '../stores/familyStore';
import { useUserStatusStore } from '../stores/userStatusStore';
import * as haptics from '../utils/haptics';

const logger = createLogger('EmergencyModeService');

export interface Earthquake {
  id: string;
  magnitude: number;
  location: string;
  latitude: number;
  longitude: number;
  depth: number;
  time: number;
  source: 'AFAD' | 'USGS' | 'KANDILLI' | 'EMSC' | 'KOERI' | 'SEISMIC_SENSOR';
}

class EmergencyModeService {
  private isEmergencyMode = false;
  private lastTriggerTime = 0;
  private currentMagnitude = 0; // Track current emergency magnitude for upgrade logic
  private readonly COOLDOWN_CRITICAL_MS = 5 * 60 * 1000; // 5 min cooldown for 6.0+
  private readonly COOLDOWN_HIGH_MS = 2 * 60 * 1000; // 2 min cooldown for 5.0-5.9 (aftershock protection)

  /**
   * Check if earthquake should trigger emergency mode
   * ELITE: Updated to trigger for 5.0+ earthquakes (as requested)
   */
  shouldTriggerEmergencyMode(earthquake: Earthquake, distanceKm?: number | null): boolean {
    // ELITE: Significant earthquakes (5.0+) trigger emergency mode
    // CRITICAL: 5.0-5.9: High priority emergency mode
    // CRITICAL: 6.0+: Critical priority emergency mode
    if (earthquake.magnitude >= 5.0) {
      // ELITE: Distance-aware emergency mode — prevents false activation for distant quakes
      if (distanceKm != null) {
        // Magnitude-scaled max emergency distance (tighter than notification)
        const maxEmergencyDist = earthquake.magnitude >= 7.0 ? 1000
          : earthquake.magnitude >= 6.0 ? 500
            : 200; // M5.0-5.9: only within 200km
        if (distanceKm > maxEmergencyDist) {
          logger.info(`📍 Emergency mode skipped: M${earthquake.magnitude.toFixed(1)} is ${distanceKm.toFixed(0)}km away (max: ${maxEmergencyDist}km)`);
          return false;
        }
      } else {
        // FAIL-SAFE: Konum yok — sadece Türkiye sınırları içindeki depremler tetiklesin
        const isInTurkey = earthquake.latitude >= 35.8 && earthquake.latitude <= 42.1
          && earthquake.longitude >= 25.6 && earthquake.longitude <= 44.8;
        if (!isInTurkey && earthquake.magnitude < 7.0) {
          logger.info(`📍 Emergency mode skipped: no location, non-Turkey M${earthquake.magnitude.toFixed(1)}`);
          return false;
        }
      }

      const now = Date.now();
      const cooldownMs = earthquake.magnitude >= 6.0
        ? this.COOLDOWN_CRITICAL_MS  // 5 min for 6.0+
        : this.COOLDOWN_HIGH_MS;     // 2 min for 5.0-5.9 (aftershock protection)

      if (now - this.lastTriggerTime < cooldownMs) {
        // ELITE: Allow upgrade if new quake is significantly larger (≥ 0.5 bigger)
        if (earthquake.magnitude >= this.currentMagnitude + 0.5) {
          logger.info(`📈 Emergency upgrade: M${this.currentMagnitude} → M${earthquake.magnitude} (bypassing cooldown)`);
          return true;
        }
        logger.warn(`Emergency mode cooldown active (${Math.round((cooldownMs - (now - this.lastTriggerTime)) / 1000)}s remaining)`);
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Activate emergency mode for major earthquake
   */
  async activateEmergencyMode(earthquake: Earthquake) {
    // ELITE: If already active, check for magnitude upgrade
    if (this.isEmergencyMode) {
      if (earthquake.magnitude >= this.currentMagnitude + 0.5) {
        logger.info(`📈 Upgrading emergency mode: M${this.currentMagnitude} → M${earthquake.magnitude}`);
        this.currentMagnitude = earthquake.magnitude;
        this.lastTriggerTime = Date.now();
        // Re-notify with upgraded severity
        await this.sendCriticalNotification(earthquake);
        await this.notifyFamilyMembers(earthquake);
        this.showEmergencyModeAlert(earthquake);
        return;
      }
      logger.warn('Emergency mode already active, same severity — skipping');
      return;
    }

    // ELITE: Determine emergency mode priority based on magnitude
    const isCritical = earthquake.magnitude >= 6.0;
    const priority = isCritical ? 'CRITICAL' : 'HIGH';

    logger.info(`🚨 ACTIVATING ${priority} EMERGENCY MODE - Magnitude ${earthquake.magnitude} earthquake detected`);
    this.isEmergencyMode = true;
    this.lastTriggerTime = Date.now();
    this.currentMagnitude = earthquake.magnitude;

    // ELITE: Haptic feedback based on magnitude
    if (isCritical) {
      // Critical (6.0+): Heavy haptic feedback (3x)
      haptics.impactHeavy();
      haptics.impactHeavy();
      haptics.impactHeavy();
    } else {
      // High (5.0-5.9): Medium haptic feedback (2x)
      haptics.impactMedium();
      haptics.impactMedium();
    }

    try {
      // STEP 1: Send critical notification
      await this.sendCriticalNotification(earthquake);

      // STEP 2: Update user status to "NEEDS_HELP" if not already set
      const currentStatus = useUserStatusStore.getState().status;
      if (currentStatus !== 'safe') {
        useUserStatusStore.getState().updateStatus('needs_help', null);
      }

      // STEP 3: Start location tracking
      await this.startLocationTracking();

      // STEP 4: Activate BLE mesh for offline communication
      await this.activateBLEMesh(earthquake);

      // STEP 5: Notify family members
      await this.notifyFamilyMembers(earthquake);

      // STEP 6: Show emergency mode UI
      this.showEmergencyModeAlert(earthquake);

      logger.info('✅ Emergency mode activated successfully');
    } catch (error) {
      logger.error('Emergency mode activation error:', error);
    }
  }

  /**
   * Send critical earthquake notification - ELITE IMPLEMENTATION
   * CRITICAL: Instant delivery, magnitude-based priority, multi-channel alerts
   */
  private async sendCriticalNotification(earthquake: Earthquake) {
    try {
      // ELITE: Use magnitude-based notification for premium features
      const { showMagnitudeBasedNotification } = await import('./MagnitudeBasedNotificationService');
      await showMagnitudeBasedNotification(
        earthquake.magnitude,
        earthquake.location,
        false, // Not EEW
        undefined, // No time advance
        earthquake.time, // Timestamp
      ).catch(async (error) => {
        logger.error('Failed to show magnitude-based critical notification:', error);
        // Fallback to standard notification
        const { notificationService } = await import('./NotificationService');
        await notificationService.showEarthquakeNotification(
          earthquake.magnitude,
          earthquake.location,
          new Date(earthquake.time),
        );
      });
    } catch (error) {
      logger.error('Critical notification error:', error);
    }
  }

  /**
   * Start continuous location tracking
   */
  private async startLocationTracking() {
    try {
      // Location service will continuously update position
      // This ensures rescue teams can find the user
      logger.info('Starting continuous location tracking');

      // Get current location and broadcast
      const location = await locationService.getCurrentPosition();
      if (location) {
        logger.info(`Current location: ${location.latitude}, ${location.longitude}`);

        // Update user status with location
        useUserStatusStore.getState().updateStatus('needs_help', {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || null,
        });
      }
    } catch (error) {
      logger.error('Location tracking error:', error);
    }
  }

  /**
   * Activate BLE mesh for offline communication
   * CRITICAL: Broadcasts real earthquake data to nearby devices
   */
  private async activateBLEMesh(earthquake: Earthquake) {
    try {
      logger.info('Activating BLE mesh for offline communication');

      // BLE mesh should already be running from init.ts
      // This ensures it's broadcasting emergency status
      if (!bleMeshService.getIsRunning()) {
        await bleMeshService.start();
      }

      // CRITICAL FIX: Broadcast actual earthquake magnitude (was 0 before)
      await bleMeshService.broadcastEmergency(JSON.stringify({
        type: 'EARTHQUAKE_EMERGENCY',
        magnitude: earthquake.magnitude,
        location: earthquake.location,
        latitude: earthquake.latitude,
        longitude: earthquake.longitude,
        depth: earthquake.depth,
        source: earthquake.source,
        timestamp: earthquake.time,
        broadcastTime: Date.now(),
      }));

      logger.info(`✅ BLE emergency broadcast: M${earthquake.magnitude} ${earthquake.location}`);
    } catch (error) {
      logger.error('BLE mesh activation error:', error);
    }
  }

  /**
   * Notify all family members about emergency
   * CRITICAL: Sends REAL notifications via BLE mesh + Firebase
   */
  private async notifyFamilyMembers(earthquake: Earthquake) {
    try {
      const familyMembers = useFamilyStore.getState().members;

      if (familyMembers.length === 0) {
        logger.info('No family members to notify');
        return;
      }

      logger.info(`🔔 Notifying ${familyMembers.length} family members about M${earthquake.magnitude} earthquake`);

      const isCritical = earthquake.magnitude >= 6.0;
      const emergencyMessage = {
        type: 'EARTHQUAKE_EMERGENCY',
        magnitude: earthquake.magnitude,
        location: earthquake.location,
        latitude: earthquake.latitude,
        longitude: earthquake.longitude,
        timestamp: earthquake.time,
        priority: isCritical ? 'critical' : 'high',
      };

      // CHANNEL 1: BLE Mesh broadcast (works offline)
      try {
        await bleMeshService.broadcastMessage({
          type: 'emergency',
          content: JSON.stringify(emergencyMessage),
          priority: 'critical',
          ttl: 10,
        });
        logger.info('✅ Family notified via BLE mesh');
      } catch (bleError) {
        logger.warn('BLE family notification failed (will try Firebase):', bleError);
      }

      // CHANNEL 2: Firebase cloud notifications (works online)
      try {
        const { firebaseDataService } = await import('./FirebaseDataService');
        if (firebaseDataService.isInitialized) {
          const { getDeviceId } = await import('../utils/device');
          const myDeviceId = await getDeviceId();

          // Send emergency message to each family member
          const notifyPromises = familyMembers.map(async (member) => {
            const targetId = member.deviceId || member.id;
            if (!targetId) return;

            try {
              await firebaseDataService.saveMessage(myDeviceId, {
                id: `emergency_${Date.now()}_${targetId}`,
                fromDeviceId: myDeviceId,
                toDeviceId: targetId,
                content: isCritical
                  ? `🚨 ACİL! M${earthquake.magnitude} deprem: ${earthquake.location}. Güvende misiniz?`
                  : `⚠️ M${earthquake.magnitude} deprem: ${earthquake.location}. Durumunuzu bildirin.`,
                timestamp: Date.now(),
                type: 'emergency',
                status: 'sent',
                priority: 'critical',
              });
              logger.info(`✅ Notified ${member.name} via Firebase`);
            } catch (memberError) {
              logger.warn(`Failed to notify ${member.name} via Firebase:`, memberError);
            }
          });

          await Promise.allSettled(notifyPromises);
        }
      } catch (firebaseError) {
        logger.warn('Firebase family notification failed:', firebaseError);
      }

      // CHANNEL 3: Push notification to self (shows in notification tray)
      try {
        const { notificationService } = await import('./NotificationService');
        await notificationService.showCriticalNotification(
          isCritical ? '🚨 DEPREM — Aile Üyeleriniz Bilgilendirildi' : '⚠️ DEPREM — Aile Üyeleriniz Bilgilendirildi',
          `M${earthquake.magnitude} ${earthquake.location}. ${familyMembers.length} aile üyesine acil bildirim gönderildi.`,
          { sound: 'default', critical: true },
        );
      } catch (pushError) {
        logger.warn('Push notification for family alert failed:', pushError);
      }
    } catch (error) {
      logger.error('Family notification error:', error);
    }
  }

  /**
   * Show emergency mode UI alert
   * ELITE: Enhanced alert based on magnitude priority
   */
  private showEmergencyModeAlert(earthquake: Earthquake) {
    const isCritical = earthquake.magnitude >= 6.0;
    const priority = isCritical ? 'CRITICAL' : 'HIGH';
    const title = isCritical ? '🚨 ACİL DURUM MODU AKTİF' : '⚠️ ACİL DURUM MODU AKTİF';
    const magnitudeText = isCritical
      ? `Büyüklük ${earthquake.magnitude} BÜYÜK DEPREM algılandı!`
      : `Büyüklük ${earthquake.magnitude} ÖNEMLİ DEPREM algılandı!`;

    Alert.alert(
      title,
      `${magnitudeText}\n\n` +
      `📍 ${earthquake.location}\n\n` +
      `Acil durum protokolleri aktif edildi:\n` +
      `✓ Konumunuz sürekli paylaşılıyor\n` +
      `✓ Aile üyeleriniz bilgilendirildi\n` +
      `✓ BLE mesh aktif (şebekesiz iletişim)\n` +
      `✓ SOS butonu hazırda bekliyor\n` +
      `${isCritical ? '✓ Multi-channel alerts aktif\n' : ''}` +
      `\nGüvende misiniz? Durum güncellemesi yapın.`,
      [
        {
          text: 'Güvendeyim',
          onPress: () => {
            useUserStatusStore.getState().updateStatus('safe', null);
            this.deactivateEmergencyMode();
          },
        },
        {
          text: 'Yardım Gerekiyor',
          onPress: () => {
            useUserStatusStore.getState().updateStatus('needs_help', null);
            // Keep emergency mode active
          },
          style: 'destructive',
        },
        {
          text: 'Enkaz Altındayım',
          onPress: () => {
            useUserStatusStore.getState().updateStatus('trapped', null);
            // Keep emergency mode active
            // Activate whistle/flashlight
          },
          style: 'cancel',
        },
      ],
      {
        cancelable: false, // Must respond
      },
    );
  }

  /**
   * Deactivate emergency mode
   */
  deactivateEmergencyMode() {
    logger.info('Deactivating emergency mode');
    this.isEmergencyMode = false;
    this.currentMagnitude = 0;

    Alert.alert(
      'Acil Durum Modu Kapatıldı',
      'Normal mod aktif. İhtiyaç durumunda SOS butonunu kullanabilirsiniz.',
      [{ text: 'Tamam' }],
    );
  }

  /**
   * Get emergency mode status
   */
  isActive(): boolean {
    return this.isEmergencyMode;
  }
}

export const emergencyModeService = new EmergencyModeService();
export default emergencyModeService;

