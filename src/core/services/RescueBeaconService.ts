/**
 * RESCUE BEACON SERVICE
 * Continuous SOS beacon for trapped users
 * Battery-optimized broadcasting with RSSI-based proximity detection
 */

import { createLogger } from '../utils/logger';
import { bleMeshService } from './BLEMeshService';
import { useRescueStore } from '../stores/rescueStore';
import { useUserStatusStore } from '../stores/userStatusStore';
import { locationService } from './LocationService';
import * as Battery from 'expo-battery';
import { getDeviceId } from '../../lib/device';

const logger = createLogger('RescueBeaconService');

export interface BeaconPayload {
  type: 'SOS_BEACON';
  userId: string;
  userName: string;
  status: 'trapped' | 'injured' | 'safe';
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  battery?: number;
  timestamp: number;
  message?: string;
}

class RescueBeaconService {
  private isActive = false;
  private beaconInterval: NodeJS.Timeout | null = null;
  private intervalMs = 10000; // Default: 10 seconds

  /**
   * Initialize beacon service
   */
  async initialize() {
    try {
      logger.info('Initializing rescue beacon service...');

      // Listen to user status changes
      useUserStatusStore.subscribe((state, prevState) => {
        if (state.status === 'trapped' && prevState.status !== 'trapped') {
          // Auto-start beacon when user is trapped
          this.startBeacon();
        } else if (state.status !== 'trapped' && prevState.status === 'trapped') {
          // Auto-stop beacon when user is no longer trapped
          this.stopBeacon();
        }
      });

      // Listen to rescue store changes
      useRescueStore.subscribe((state, prevState) => {
        if (state.beaconInterval !== prevState.beaconInterval) {
          this.setInterval(state.beaconInterval * 1000);
        }
      });

      logger.info('Rescue beacon service initialized');
    } catch (error) {
      logger.error('Failed to initialize rescue beacon service:', error);
    }
  }

  /**
   * Start broadcasting SOS beacon
   */
  async startBeacon() {
    if (this.isActive) {
      logger.warn('Beacon already active');
      return;
    }

    try {
      logger.info('Starting SOS beacon...');

      // Update store
      useRescueStore.getState().startBeacon();

      this.isActive = true;

      // Broadcast immediately
      await this.broadcastBeacon();

      // Start interval broadcasting
      this.beaconInterval = setInterval(async () => {
        await this.broadcastBeacon();
      }, this.intervalMs);

      logger.info(`SOS beacon started (interval: ${this.intervalMs}ms)`);
    } catch (error) {
      logger.error('Failed to start beacon:', error);
      this.isActive = false;
    }
  }

  /**
   * Stop broadcasting beacon
   */
  stopBeacon() {
    if (!this.isActive) return;

    try {
      logger.info('Stopping SOS beacon...');

      if (this.beaconInterval) {
        clearInterval(this.beaconInterval);
        this.beaconInterval = null;
      }

      this.isActive = false;

      // Update store
      useRescueStore.getState().stopBeacon();

      logger.info('SOS beacon stopped');
    } catch (error) {
      logger.error('Failed to stop beacon:', error);
    }
  }

  /**
   * Set beacon broadcast interval
   */
  setInterval(ms: number) {
    this.intervalMs = ms;

    // Restart beacon with new interval if active
    if (this.isActive) {
      this.stopBeacon();
      this.startBeacon();
    }
  }

  /**
   * Broadcast SOS beacon via BLE Mesh
   */
  private async broadcastBeacon() {
    try {
      // Get user info
      const userStatus = useUserStatusStore.getState();
      const deviceId = await getDeviceId();

      // Get location
      let location: any = null;
      try {
        const currentLocation = await locationService.getCurrentLocation();
        if (currentLocation) {
          location = {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            accuracy: currentLocation.accuracy,
          };
        }
      } catch (error) {
        logger.warn('Failed to get location for beacon:', error);
      }

      // Get battery level
      let battery: number | undefined;
      try {
        const batteryLevel = await Battery.getBatteryLevelAsync();
        battery = Math.round(batteryLevel * 100);
      } catch (error) {
        logger.warn('Failed to get battery level:', error);
      }

      // Create beacon payload
      const payload: BeaconPayload = {
        type: 'SOS_BEACON',
        userId: deviceId,
        userName: (userStatus as any).name || 'Unknown',
        status: userStatus.status as any,
        location,
        battery,
        timestamp: Date.now(),
        message: userStatus.status === 'trapped' ? 'Enkaz altında yardım bekliyorum!' : undefined,
      };

      // Broadcast via BLE Mesh
      await bleMeshService.broadcastMessage({
        type: 'sos',
        content: JSON.stringify(payload),
        ttl: 10,
      });

      logger.info('SOS beacon broadcasted', {
        battery,
        hasLocation: !!location,
      });
    } catch (error) {
      logger.error('Failed to broadcast beacon:', error);
    }
  }

  /**
   * Handle received beacon from another user
   */
  async handleReceivedBeacon(payload: BeaconPayload, rssi?: number) {
    try {
      // Only process if in rescue team mode
      const rescueStore = useRescueStore.getState();
      if (!rescueStore.isRescueTeamMode) {
        return;
      }

      logger.info('Received SOS beacon:', {
        userId: payload.userId,
        userName: payload.userName,
        status: payload.status,
        rssi,
      });

      // Calculate estimated distance from RSSI
      let distance: number | undefined;
      if (rssi !== undefined) {
        // RSSI to distance formula (approximate)
        // d = 10 ^ ((Measured Power - RSSI) / (10 * N))
        // Measured Power = -59 dBm (at 1 meter)
        // N = 2 (path loss exponent)
        const measuredPower = -59;
        const pathLossExponent = 2;
        distance = Math.pow(10, (measuredPower - rssi) / (10 * pathLossExponent));
      }

      // Add or update trapped user in store
      const isNewUser = !rescueStore.trappedUsers.find(u => u.id === payload.userId);
      rescueStore.addTrappedUser({
        id: payload.userId,
        name: payload.userName,
        status: payload.status,
        location: payload.location,
        rssi,
        distance,
        lastSeen: Date.now(),
        battery: payload.battery,
        message: payload.message,
      });

      // Elite: Send notification for trapped users (only for new users or critical updates)
      if (isNewUser || payload.status === 'trapped') {
        await this.sendTrappedUserNotification(payload, rssi, distance);
      }
    } catch (error) {
      logger.error('Failed to handle received beacon:', error);
    }
  }

  /**
   * Get beacon status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      intervalMs: this.intervalMs,
      startTime: useRescueStore.getState().beaconStartTime,
    };
  }

  /**
   * Elite: Send notification for trapped users
   */
  private async sendTrappedUserNotification(payload: BeaconPayload, rssi?: number, distance?: number) {
    try {
      const { multiChannelAlertService } = await import('./MultiChannelAlertService');
      
      const distanceText = distance 
        ? distance < 1000 
          ? `${Math.round(distance)}m uzaklıkta` 
          : `${(distance / 1000).toFixed(1)}km uzaklıkta`
        : rssi 
          ? `Sinyal gücü: ${rssi} dBm`
          : 'Yakın bölgede';
      
      const batteryText = payload.battery !== undefined ? `Pil: %${payload.battery}` : '';
      const locationText = payload.location 
        ? `Konum: ${payload.location.latitude.toFixed(4)}, ${payload.location.longitude.toFixed(4)}`
        : '';
      
      const body = [
        payload.message || `${payload.userName} yardım bekliyor`,
        distanceText,
        batteryText,
        locationText,
      ].filter(Boolean).join(' • ');

      await multiChannelAlertService.sendAlert({
        title: payload.status === 'trapped' 
          ? '🚨 ENKAZ ALTINDA KİŞİ TESPİT EDİLDİ' 
          : '⚠️ YARDIM GEREKEN KİŞİ TESPİT EDİLDİ',
        body,
        priority: payload.status === 'trapped' ? 'critical' : 'high',
        channels: {
          pushNotification: true,
          fullScreenAlert: payload.status === 'trapped',
          alarmSound: payload.status === 'trapped',
          vibration: true,
          tts: true,
        },
        data: {
          type: 'trapped_user',
          userId: payload.userId,
          status: payload.status,
          location: payload.location,
        },
        duration: payload.status === 'trapped' ? 0 : 30, // Critical alerts stay until dismissed
      });
    } catch (error) {
      logger.error('Failed to send trapped user notification:', error);
    }
  }

  /**
   * Cleanup expired trapped users (not seen for 30 minutes - longer for offline mode)
   * Elite: Extended expiry time for offline scenarios
   */
  cleanupExpiredUsers() {
    const rescueStore = useRescueStore.getState();
    const now = Date.now();
    const expiryTime = 30 * 60 * 1000; // 30 minutes (extended for offline)

    rescueStore.trappedUsers.forEach((user) => {
      if (now - user.lastSeen > expiryTime) {
        logger.info(`Removing expired trapped user: ${user.name}`);
        rescueStore.removeTrappedUser(user.id);
      }
    });
  }
}

export const rescueBeaconService = new RescueBeaconService();

