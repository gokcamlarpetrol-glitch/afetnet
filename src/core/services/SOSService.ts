/**
 * SOS SERVICE - Emergency Help System
 * BLE mesh broadcast, location sharing, continuous beacon
 */

import { logger } from '../utils/logger';
import * as haptics from '../utils/haptics';

interface SOSSignal {
  id: string;
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  message: string;
  userId: string;
}

class SOSService {
  private isActive: boolean = false;
  private beaconInterval: NodeJS.Timeout | null = null;
  private currentSignal: SOSSignal | null = null;

  /**
   * Send SOS Signal
   */
  async sendSOSSignal(location: { latitude: number; longitude: number; accuracy: number } | null, message: string = 'Acil yardım gerekiyor!'): Promise<void> {
    try {
      logger.info('📡 Sending SOS signal...');

      // Get real device ID from secure storage
      const { getDeviceId } = await import('../../lib/device');
      const userId = await getDeviceId();

      const signal: SOSSignal = {
        id: `sos_${Date.now()}`,
        timestamp: Date.now(),
        location,
        message,
        userId,
      };

      this.currentSignal = signal;
      this.isActive = true;

      // Broadcast via BLE
      await this.broadcastViaBLE(signal);

      // Notify nearby devices
      await this.notifyNearbyDevices(signal);

      // Start continuous beacon
      this.startContinuousBeacon();

      // Heavy haptic feedback
      haptics.impactHeavy();

      logger.info('✅ SOS signal sent successfully');
    } catch (error) {
      logger.error('❌ Failed to send SOS signal:', error);
      throw error;
    }
  }

  /**
   * Broadcast via BLE Mesh
   */
  private async broadcastViaBLE(signal: SOSSignal): Promise<void> {
    try {
      logger.info('📡 Broadcasting SOS via BLE mesh...');
      
      // Integrate with BLEMeshService
      const { bleMeshService } = await import('./BLEMeshService');
      
      await bleMeshService.sendMessage(JSON.stringify({
        type: 'SOS',
        signal: {
          id: signal.id,
          timestamp: signal.timestamp,
          location: signal.location,
          message: signal.message,
          userId: signal.userId,
        },
        priority: 'critical',
      }));

      logger.info('✅ BLE broadcast sent');
    } catch (error) {
      logger.error('❌ BLE broadcast failed:', error);
      // Don't throw - continue with other methods
    }
  }

  /**
   * Notify Nearby Devices
   */
  private async notifyNearbyDevices(signal: SOSSignal): Promise<void> {
    try {
      logger.info('📢 Notifying nearby devices...');
      
      // Integrate with multi-channel alert service
      const { multiChannelAlertService } = await import('./MultiChannelAlertService');
      
      // Send critical alert to all channels
      await multiChannelAlertService.sendAlert({
        title: '🆘 Acil Yardım Çağrısı',
        body: signal.message,
        priority: 'critical',
        sound: 'emergency',
        vibrationPattern: [0, 200, 100, 200, 100, 200], // SOS pattern
        ttsText: 'Acil yardım çağrısı! Bölgede biri yardıma ihtiyacı olan biri var!',
      });

      logger.info('✅ Nearby devices notified');
    } catch (error) {
      logger.error('❌ Failed to notify nearby devices:', error);
      // Don't throw - continue with other methods
    }
  }

  /**
   * Start Continuous Beacon
   */
  private startContinuousBeacon(): void {
    if (this.beaconInterval) {
      clearInterval(this.beaconInterval);
    }

    logger.info('🔄 Starting continuous SOS beacon...');

    // Broadcast every 10 seconds
    this.beaconInterval = setInterval(async () => {
      if (this.isActive && this.currentSignal) {
        try {
          await this.broadcastViaBLE(this.currentSignal);
          
          // Medium haptic feedback every beacon
          haptics.impactMedium();
        } catch (error) {
          logger.error('❌ Beacon broadcast failed:', error);
        }
      }
    }, 10000); // 10 seconds
  }

  /**
   * Stop SOS Signal
   */
  stopSOSSignal(): void {
    logger.info('🛑 Stopping SOS signal...');

    this.isActive = false;
    this.currentSignal = null;

    if (this.beaconInterval) {
      clearInterval(this.beaconInterval);
      this.beaconInterval = null;
    }

    logger.info('✅ SOS signal stopped');
  }

  /**
   * Check if SOS is active
   */
  isSOSActive(): boolean {
    return this.isActive;
  }

  /**
   * Get current SOS signal
   */
  getCurrentSignal(): SOSSignal | null {
    return this.currentSignal;
  }
}

// Singleton instance
let sosServiceInstance: SOSService | null = null;

export function getSOSService(): SOSService {
  if (!sosServiceInstance) {
    sosServiceInstance = new SOSService();
  }
  return sosServiceInstance;
}

export default SOSService;

