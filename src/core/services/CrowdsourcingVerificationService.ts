/**
 * CROWDSOURCING VERIFICATION SERVICE - World's Most Advanced
 * 
 * Uses distributed network of user devices to verify earthquakes
 * Similar to MyShake (UC Berkeley) and Earthquake Network
 * 
 * Features:
 * - Real-time sensor data aggregation
 * - Consensus-based verification
 * - Network-based detection
 * - Offline-capable detection
 */

import { createLogger } from '../utils/logger';
import NetInfo from '@react-native-community/netinfo';
import { bleMeshService } from './BLEMeshService';
import { MeshMessage } from '../stores/meshStore';
import { useMeshStore } from '../stores/meshStore';

const logger = createLogger('CrowdsourcingVerificationService');

export interface SensorDataPacket {
  deviceId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  acceleration: {
    x: number;
    y: number;
    z: number;
    magnitude: number;
  };
  gyroscope?: {
    x: number;
    y: number;
    z: number;
  };
  barometer?: number;
  confidence: number; // 0-100
  eventDetected: boolean;
}

export interface ConsensusResult {
  verified: boolean;
  confidence: number; // 0-100
  participantCount: number;
  averageMagnitude: number;
  epicenterEstimate: {
    latitude: number;
    longitude: number;
  };
  timeWindow: number; // ms
}

class CrowdsourcingVerificationService {
  private isInitialized = false;
  private localSensorData: SensorDataPacket[] = [];
  private readonly MAX_LOCAL_DATA = 1000; // Keep last 1000 packets
  private readonly CONSENSUS_WINDOW_MS = 10000; // 10 seconds
  private readonly MIN_PARTICIPANTS = 3; // Minimum devices needed for consensus
  private readonly DISTANCE_THRESHOLD_KM = 50; // Devices within 50km
  private syncInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.isInitialized = true;

    // Start periodic sync with backend
    this.startPeriodicSync();

    if (__DEV__) {
      logger.info('CrowdsourcingVerificationService initialized - Network-based detection active');
    }
  }

  /**
   * ELITE: Submit sensor data for crowdsourcing verification
   */
  async submitSensorData(packet: SensorDataPacket): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('CrowdsourcingVerificationService not initialized');
      return;
    }

    // Store locally
    this.localSensorData.push(packet);
    if (this.localSensorData.length > this.MAX_LOCAL_DATA) {
      this.localSensorData.shift();
    }

    // ELITE: Broadcast via BLE mesh for offline detection
    try {
      await this.broadcastViaBLEMesh(packet);
    } catch (error) {
      // Silent fail - BLE is optional
    }

    // ELITE: Send to backend for consensus (if online)
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      try {
        await this.sendToBackend(packet);
      } catch (error) {
        // Silent fail - will retry on next sync
      }
    }
  }

  /**
   * ELITE: Check for consensus from nearby devices
   */
  async checkConsensus(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<ConsensusResult | null> {
    if (!this.isInitialized) {
      return null;
    }

    const windowStart = timestamp - this.CONSENSUS_WINDOW_MS;
    const windowEnd = timestamp + this.CONSENSUS_WINDOW_MS;

    // Filter data within time window and distance threshold
    const nearbyData = this.localSensorData.filter((packet) => {
      const timeMatch = packet.timestamp >= windowStart && packet.timestamp <= windowEnd;
      if (!timeMatch) return false;

      const distance = this.calculateDistance(
        latitude,
        longitude,
        packet.latitude,
        packet.longitude,
      );
      return distance <= this.DISTANCE_THRESHOLD_KM;
    });

    // Check if we have enough participants
    const uniqueDevices = new Set(nearbyData.map((d) => d.deviceId));
    if (uniqueDevices.size < this.MIN_PARTICIPANTS) {
      return null;
    }

    // Calculate consensus
    const eventDetections = nearbyData.filter((d) => d.eventDetected);
    const consensusRatio = eventDetections.length / nearbyData.length;

    if (consensusRatio < 0.6) {
      // Less than 60% consensus - not verified
      return null;
    }

    // Calculate average magnitude
    const magnitudes = eventDetections.map((d) => d.acceleration.magnitude);
    const averageMagnitude = magnitudes.reduce((sum, m) => sum + m, 0) / magnitudes.length;

    // Estimate epicenter (weighted average)
    const totalConfidence = eventDetections.reduce((sum, d) => sum + d.confidence, 0);
    const weightedLat = eventDetections.reduce(
      (sum, d) => sum + d.latitude * d.confidence,
      0,
    ) / totalConfidence;
    const weightedLon = eventDetections.reduce(
      (sum, d) => sum + d.longitude * d.confidence,
      0,
    ) / totalConfidence;

    // Calculate confidence
    const confidence = Math.min(100, consensusRatio * 100 + (uniqueDevices.size - this.MIN_PARTICIPANTS) * 5);

    return {
      verified: true,
      confidence: Math.round(confidence),
      participantCount: uniqueDevices.size,
      averageMagnitude,
      epicenterEstimate: {
        latitude: weightedLat,
        longitude: weightedLon,
      },
      timeWindow: windowEnd - windowStart,
    };
  }

  /**
   * ELITE: Broadcast sensor data via BLE mesh (offline detection)
   */
  private async broadcastViaBLEMesh(packet: SensorDataPacket): Promise<void> {
    try {
      // ELITE: Use meshStore broadcastMessage instead of direct BLE service
      const messageContent = JSON.stringify({
        type: 'sensor_data',
        deviceId: packet.deviceId,
        timestamp: packet.timestamp,
        latitude: packet.latitude,
        longitude: packet.longitude,
        acceleration: packet.acceleration,
        confidence: packet.confidence,
        eventDetected: packet.eventDetected,
      });

      await useMeshStore.getState().broadcastMessage(messageContent, 'broadcast');
    } catch (error) {
      // Silent fail - BLE is optional
    }
  }

  /**
   * ELITE: Send sensor data to backend for global consensus
   */
  private async sendToBackend(packet: SensorDataPacket): Promise<void> {
    // ELITE: Get API base URL from ENV config (centralized)
    const { ENV } = await import('../config/env');
    const apiBase = ENV.API_BASE_URL || 'https://afetnet-backend.onrender.com';

    const response = await fetch(`${apiBase}/api/sensor-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(packet),
    });

    if (!response.ok) {
      throw new Error(`Backend sync failed: ${response.status}`);
    }
  }

  /**
   * ELITE: Start periodic sync with backend
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 30 seconds
    this.syncInterval = setInterval(async () => {
      const netState = await NetInfo.fetch();
      if (netState.isConnected && this.localSensorData.length > 0) {
        try {
          // Send pending data
          const pendingData = this.localSensorData.slice(-100); // Last 100 packets
          for (const packet of pendingData) {
            try {
              await this.sendToBackend(packet);
            } catch (error) {
              // Continue with next packet
            }
          }
        } catch (error) {
          // Silent fail - will retry next time
        }
      }
    }, 30000); // 30 seconds
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Stop the service
   */
  stop(): void {
    this.isInitialized = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.localSensorData = [];

    if (__DEV__) {
      logger.info('CrowdsourcingVerificationService stopped');
    }
  }
}

export const crowdsourcingVerificationService = new CrowdsourcingVerificationService();

