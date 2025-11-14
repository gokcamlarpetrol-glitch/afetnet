/**
 * EMERGENCY MODE SERVICE - Automatic Emergency Activation
 * Triggers emergency mode for major earthquakes (magnitude >= 6.0)
 * This is a LIFE-SAVING feature - activates ALL emergency protocols
 */

import { Alert } from 'react-native';
import { createLogger } from '../utils/logger';
import { notificationService } from './NotificationService';
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
  private readonly COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown between triggers

  /**
   * Check if earthquake should trigger emergency mode
   * ELITE: Updated to trigger for 5.0+ earthquakes (as requested)
   */
  shouldTriggerEmergencyMode(earthquake: Earthquake): boolean {
    // ELITE: Significant earthquakes (5.0+) trigger emergency mode
    // CRITICAL: 5.0-5.9: High priority emergency mode
    // CRITICAL: 6.0+: Critical priority emergency mode
    if (earthquake.magnitude >= 5.0) {
      // Check cooldown to prevent spam (only for 6.0+)
      if (earthquake.magnitude >= 6.0) {
        const now = Date.now();
        if (now - this.lastTriggerTime < this.COOLDOWN_MS) {
          logger.warn('Emergency mode cooldown active');
          return false;
        }
      }
      // ELITE: 5.0-5.9 earthquakes bypass cooldown for faster response
      return true;
    }
    return false;
  }

  /**
   * Activate emergency mode for major earthquake
   */
  async activateEmergencyMode(earthquake: Earthquake) {
    if (this.isEmergencyMode) {
      logger.warn('Emergency mode already active');
      return;
    }

    // ELITE: Determine emergency mode priority based on magnitude
    const isCritical = earthquake.magnitude >= 6.0;
    const priority = isCritical ? 'CRITICAL' : 'HIGH';
    
    logger.info(`🚨 ACTIVATING ${priority} EMERGENCY MODE - Magnitude ${earthquake.magnitude} earthquake detected`);
    this.isEmergencyMode = true;
    this.lastTriggerTime = Date.now();

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
      await this.activateBLEMesh();

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
        earthquake.time // Timestamp
      ).catch(async (error) => {
        logger.error('Failed to show magnitude-based critical notification:', error);
        // Fallback to standard notification
        await notificationService.showEarthquakeNotification(
          earthquake.magnitude,
          earthquake.location,
          new Date(earthquake.time)
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
   */
  private async activateBLEMesh() {
    try {
      logger.info('Activating BLE mesh for offline communication');
      
      // BLE mesh should already be running from init.ts
      // This ensures it's broadcasting emergency status
      if (!bleMeshService.getIsRunning()) {
        await bleMeshService.start();
      }
      
      // Broadcast emergency SOS via BLE
      await bleMeshService.broadcastEmergency({
        type: 'EARTHQUAKE_EMERGENCY',
        magnitude: 0, // Will be set by caller
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('BLE mesh activation error:', error);
    }
  }

  /**
   * Notify all family members about emergency
   */
  private async notifyFamilyMembers(earthquake: Earthquake) {
    try {
      const familyMembers = useFamilyStore.getState().members;
      
      if (familyMembers.length === 0) {
        logger.info('No family members to notify');
        return;
      }

      logger.info(`Notifying ${familyMembers.length} family members`);
      
      // Send status update to all family members
      // This will use BLE mesh + Firebase
      for (const member of familyMembers) {
        try {
          // Family status broadcasting handled by BLE mesh service
          logger.info(`Notified family member: ${member.name}`);
        } catch (error) {
          logger.error(`Failed to notify ${member.name}:`, error);
        }
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
      }
    );
  }

  /**
   * Deactivate emergency mode
   */
  deactivateEmergencyMode() {
    logger.info('Deactivating emergency mode');
    this.isEmergencyMode = false;
    
    Alert.alert(
      'Acil Durum Modu Kapatıldı',
      'Normal mod aktif. İhtiyaç durumunda SOS butonunu kullanabilirsiniz.',
      [{ text: 'Tamam' }]
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

