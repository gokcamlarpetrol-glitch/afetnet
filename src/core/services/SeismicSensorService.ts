/**
 * SEISMIC SENSOR SERVICE - ELITE EDITION
 * Controller for AdvancedSeismicEngine
 * Handles Background Execution via Location Heartbeat (iOS/Android compatible)
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { seismicEngine, DetectionEvent } from './seismic/AdvancedSeismicEngine';
import { createLogger } from '../utils/logger';
import { notificationService } from './NotificationService';
import { meshNetworkService } from './mesh/MeshNetworkService';
import { MeshMessageType } from './mesh/MeshProtocol';
import { onDeviceEEWService } from './seismic/OnDeviceEEWService';

const logger = createLogger('SeismicSensorService');
const LOCATION_TASK_NAME = 'SEISMIC_LOCATION_HEARTBEAT';

// ELITE: Proper type for TaskManager location data
interface LocationTaskData {
  locations?: Array<{
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number | null;
      speed: number | null;
      heading: number | null;
    };
    timestamp: number;
  }>;
}

// Background Task Definition - The "Heartbeat"
// This keeps the JS thread alive by receiving location updates
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    logger.warn('Location Heartbeat Error:', error);
    return;
  }

  if (data) {
    // We don't necessarily need the location here for seismic detection,
    // but the act of receiving it keeps the app alive.
    // However, we CAN use it to update the mesh network position silently!
    const taskData = data as LocationTaskData;
    if (taskData.locations && taskData.locations.length > 0) {
      // logger.debug('Heartbeat Pulse (Location)'); 
    }
  }
});

class SeismicSensorService {
  private isServiceRunning = false;
  private detectionCallbacks: ((event: DetectionEvent) => void)[] = [];
  private lastLocalAlertAt = 0;
  private readonly localAlertCooldownMs = 5000;

  /**
   * ELITE: Register callback for seismic detection events
   */
  onDetection(callback: (event: DetectionEvent) => void): () => void {
    this.detectionCallbacks.push(callback);
    return () => {
      const index = this.detectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.detectionCallbacks.splice(index, 1);
      }
    };
  }

  async start() {
    if (this.isServiceRunning) return;

    logger.info('Starting Seismic Service & Background Heartbeat...');

    // 1. Request ALWAYS Permissions (Critical for 24/7)
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      logger.warn('Background Location Permission denied! 24/7 monitoring will fail.');
      // Proceed anyway with foreground only
    }

    // 2. Start Engine (Accelerometer)
    // The engine itself runs in JS. It needs the JS thread to be alive.
    seismicEngine.start(this.handleDetection.bind(this));
    onDeviceEEWService.start();

    // ELITE: Start Activity Guard (Safety Protocol)
    try {
      const { activityRecognitionService } = await import('./ActivityRecognitionService');
      await activityRecognitionService.start();
    } catch (e) {
      logger.warn('Failed to start Activity Guard:', e);
    }

    // 3. Start "Heartbeat" via Background Location
    // On iOS, "Background Location" mode keeps the app running essentially forever
    // as long as we request updates.
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced, // Enough for city-level, saves some battery
        timeInterval: 10000, // Update every 10s (Heartbeat rate)
        distanceInterval: 50, // Or every 50 meters
        showsBackgroundLocationIndicator: true, // REQUIRED by Apple for continuous background use
        foregroundService: {
          notificationTitle: "Deprem İzleme Aktif",
          notificationBody: "AfetNet sizi ve sevdiklerinizi korumak için arka planda çalışıyor.",
          notificationColor: "#ef4444",
        },
        pausesUpdatesAutomatically: false, // CRITICAL: Don't let OS stop it
        activityType: Location.ActivityType.Other, // Generic
      });
      logger.info('Background Heartbeat Activated');
    } catch (e) {
      logger.error('Failed to start Background Heartbeat:', e);
    }

    this.isServiceRunning = true;
  }

  async stop() {
    logger.info('Stopping Seismic Service...');
    seismicEngine.stop();

    // ELITE: Stop Activity Guard
    try {
      const { activityRecognitionService } = await import('./ActivityRecognitionService');
      activityRecognitionService.stop();
    } catch (e) {
      // Ignore
    }

    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch (e) {
      // Ignore if already stopped
    }

    this.isServiceRunning = false;
  }

  private handleDetection(event: DetectionEvent) {
    logger.info(`SEISMIC DETECTED: ${event.type} (${event.magnitude.toFixed(2)}g)`);

    // ELITE: Route to On-Device EEW Service for potential immediate alert
    onDeviceEEWService.handleDetection(event);

    // 1. Local Notification (Critical Alert)
    const now = Date.now();
    if (event.confidence > 70 && now - this.lastLocalAlertAt >= this.localAlertCooldownMs) {
      this.lastLocalAlertAt = now;
      const estimatedMagnitude =
        (typeof event.estimatedMagnitude === 'number' && Number.isFinite(event.estimatedMagnitude) && event.estimatedMagnitude > 0)
          ? event.estimatedMagnitude
          : this.estimateMagnitudeFromAcceleration(event.magnitude, event.confidence);

      notificationService.showEarthquakeNotification(
        estimatedMagnitude,
        event.type === 'P-WAVE' ? 'Yerel Algılama - Erken Uyarı' : 'Yerel Algılama - Sarsıntı',
        new Date(event.timestamp),
        event.type === 'P-WAVE', // isEEW
        event.type === 'P-WAVE' ? 5 : 0, // timeAdvance for P-wave
      );
    }

    // 2. Broadcast to Mesh
    // Only broadcast high confidence events to avoid spamming the mesh
    if (event.confidence > 80) {
      meshNetworkService.broadcastMessage(
        JSON.stringify({
          subtype: 'SEISMIC_ALERT',
          magnitude: event.magnitude,
          timestamp: event.timestamp,
          confidence: event.confidence,
        }),
        MeshMessageType.SOS,
      );
    }

    // 3. Notify callbacks
    for (const callback of this.detectionCallbacks) {
      try {
        callback(event);
      } catch (err) {
        logger.warn('Detection callback error:', err);
      }
    }
  }

  getStatistics() {
    return seismicEngine.getStatistics();
  }

  private estimateMagnitudeFromAcceleration(gForce: number, confidence: number): number {
    const confBoost = Math.max(0, Math.min(1, confidence / 100));
    if (gForce < 0.02) return 3.2 + confBoost * 0.3;
    if (gForce < 0.05) return 3.8 + confBoost * 0.4;
    if (gForce < 0.1) return 4.5 + confBoost * 0.5;
    if (gForce < 0.2) return 5.2 + confBoost * 0.5;
    if (gForce < 0.5) return 6.0 + confBoost * 0.6;
    return 6.8;
  }

  getRunningStatus() {
    return seismicEngine.getRunningStatus();
  }

  getRecentReadings(limit?: number) {
    const readings = seismicEngine.getRecentReadings();
    if (limit && limit < readings.length) {
      return readings.slice(readings.length - limit);
    }
    return readings;
  }
}

export const seismicSensorService = new SeismicSensorService();
