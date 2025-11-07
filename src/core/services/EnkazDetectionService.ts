/**
 * ENKAZ DETECTION SERVICE
 * Detects if user is trapped under debris using sensors
 */

import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';
import { useUserStatusStore } from '../stores/userStatusStore';

const logger = createLogger('EnkazDetection');

export type UserStatus = 'safe' | 'needs_help' | 'trapped' | 'sos' | 'offline';

interface MotionData {
  x: number;
  y: number;
  z: number;
}

class EnkazDetectionService {
  private isRunning = false;
  private lastMotionTime: number = Date.now();
  private lastLocation: { latitude: number; longitude: number } | null = null;
  private immobileStartTime: number | null = null;
  private suspectedFall = false;
  
  private accelerometerSubscription: any = null;
  private gyroscopeSubscription: any = null;
  private statusCheckInterval: NodeJS.Timeout | null = null;

  private readonly FALL_THRESHOLD = 2.5; // G-force threshold for fall detection
  private readonly IMMOBILE_DURATION_WARNING = 2 * 60 * 1000; // 2 minutes
  private readonly IMMOBILE_DURATION_TRAPPED = 5 * 60 * 1000; // 5 minutes
  private readonly MOTION_THRESHOLD = 0.1; // Minimum motion to consider "moving"

  async start() {
    if (this.isRunning) return;

    try {
      // Check sensor availability
      const accelAvailable = await Accelerometer.isAvailableAsync();
      const gyroAvailable = await Gyroscope.isAvailableAsync();

      if (!accelAvailable || !gyroAvailable) {
        logger.warn('Sensors not available');
        return;
      }

      this.isRunning = true;

      // Set update intervals
      Accelerometer.setUpdateInterval(100); // 10Hz
      Gyroscope.setUpdateInterval(100);

      // Subscribe to accelerometer
      this.accelerometerSubscription = Accelerometer.addListener((data) => {
        this.processAccelerometerData(data);
      });

      // Subscribe to gyroscope
      this.gyroscopeSubscription = Gyroscope.addListener((data) => {
        this.processGyroscopeData(data);
      });

      // Start status check loop
      this.statusCheckInterval = setInterval(() => {
        this.checkUserStatus();
      }, 30000); // Check every 30 seconds

      // Get initial location
      await this.updateLocation();

      logger.info('Started successfully');
    } catch (error) {
      logger.error('Start error:', error);
    }
  }

  stop() {
    this.isRunning = false;

    if (this.accelerometerSubscription) {
      this.accelerometerSubscription.remove();
      this.accelerometerSubscription = null;
    }

    if (this.gyroscopeSubscription) {
      this.gyroscopeSubscription.remove();
      this.gyroscopeSubscription = null;
    }

    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }

    logger.info('Stopped');
  }

  private processAccelerometerData(data: MotionData) {
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

    // Detect sudden fall (high G-force)
    if (magnitude > this.FALL_THRESHOLD) {
      this.suspectedFall = true;
      this.immobileStartTime = Date.now();
      logger.warn('Fall detected! Monitoring for immobility...');
    }

    // Detect motion
    if (magnitude > this.MOTION_THRESHOLD) {
      this.lastMotionTime = Date.now();
      this.immobileStartTime = null;
      this.suspectedFall = false;
    }
  }

  private processGyroscopeData(data: MotionData) {
    const rotationMagnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

    // Detect rotation (device movement)
    if (rotationMagnitude > 0.1) {
      this.lastMotionTime = Date.now();
    }
  }

  private async checkUserStatus() {
    const now = Date.now();
    const immobileDuration = now - this.lastMotionTime;

    let newStatus: UserStatus = 'safe';

    // Check if user is immobile
    if (immobileDuration > this.IMMOBILE_DURATION_TRAPPED && this.suspectedFall) {
      newStatus = 'trapped';
      logger.warn('User appears to be trapped under debris!');
      
      // Auto-trigger SOS if trapped for too long
      this.autoTriggerSOS();
    } else if (immobileDuration > this.IMMOBILE_DURATION_WARNING) {
      newStatus = 'needs_help';
      logger.warn('User appears immobile, may need help');
      
      // Send notification to user
      this.sendWarningNotification();
    } else {
      newStatus = 'safe';
    }

    // Update store
    useUserStatusStore.getState().setStatus(newStatus);

    // Update location
    await this.updateLocation();
  }

  private async updateLocation() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      this.lastLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      useUserStatusStore.getState().setLocation(this.lastLocation);
    } catch (error) {
      logger.error('Location update error:', error);
    }
  }

  private async autoTriggerSOS() {
    const store = useUserStatusStore.getState();
    
    if (!store.sosTriggered) {
      store.setSosTriggered(true);
      
      // Broadcast SOS via BLE Mesh
      const { bleMeshService } = await import('./BLEMeshService');
      await bleMeshService.sendSOS();
      
      logger.warn('Auto-triggered SOS!');
    }
  }

  private async sendWarningNotification() {
    try {
      // Import multi-channel alert service for critical warnings
      const { multiChannelAlertService } = await import('./MultiChannelAlertService');
      
      // Send warning alert to user
      await multiChannelAlertService.sendAlert({
        title: '⚠️ Durum Kontrolü',
        body: 'Hareketsiz görünüyorsunuz. İyi misiniz? Bu bildirime yanıt verin.',
        priority: 'high',
        sound: 'default',
        vibrationPattern: [0, 500, 200, 500], // Warning pattern
        duration: 12,
        channels: {
          fullScreenAlert: false,
          alarmSound: false,
          tts: false,
          bluetooth: false,
        },
      });
      
      logger.info('Warning notification sent');
    } catch (error) {
      logger.error('Warning notification error:', error);
    }
  }

  // Manual status override
  setManualStatus(status: UserStatus) {
    useUserStatusStore.getState().setStatus(status);
    logger.info('Manual status set:', status);
  }

  // User confirms they are safe
  confirmSafe() {
    this.lastMotionTime = Date.now();
    this.immobileStartTime = null;
    this.suspectedFall = false;
    useUserStatusStore.getState().setStatus('safe');
    useUserStatusStore.getState().setSosTriggered(false);
    logger.info('User confirmed safe');
  }
}

export const enkazDetectionService = new EnkazDetectionService();

