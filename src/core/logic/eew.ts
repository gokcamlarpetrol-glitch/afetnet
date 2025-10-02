import { EventEmitter, EEWLocalPWaveEvent, EEWClusterAlertEvent, EEWOfficialAlertEvent } from '../utils/events';
import { P2PManager } from '../p2p';
import { MessageQueue } from '../p2p/queue';
import { Preferences } from '../storage/prefs';

export interface EEWConfig {
  enabled: boolean;
  k: number;              // Minimum devices for quorum (default: 5)
  radiusKm: number;       // Radius for cluster detection (default: 8km)
  windowSec: number;      // Time window for quorum (default: 5s)
  pThreshold: number;     // STA/LTA threshold (default: 3.0)
  staMs: number;          // Short-term average window (default: 500ms)
  ltaMs: number;          // Long-term average window (default: 3000ms)
  minGapMs: number;       // Minimum gap between detections (default: 30000ms)
  officialFeedUrl: string; // Official feed URL
  etaCutoffSec: number;   // ETA cutoff for official alerts (default: 25s)
  deviceCooldownMs: number; // Device-level cooldown (default: 60000ms)
  regionCooldownMs: number; // Region-level cooldown (default: 30000ms)
}

export interface EEWPeerMessage {
  id: string;
  timestamp: number;
  lat: number;
  lon: number;
  accuracy?: number;
  strength: number;
  deviceId: string;
}

export interface EEWQuorumWindow {
  startTime: number;
  endTime: number;
  messages: EEWPeerMessage[];
  centerLat: number;
  centerLon: number;
  radius: number;
}

export class EEWManager {
  private static instance: EEWManager;
  private eventEmitter = new EventEmitter();
  private p2pManager: P2PManager;
  private messageQueue: MessageQueue;
  private config: EEWConfig;
  private peerMessages: Map<string, EEWPeerMessage> = new Map();
  private lastDeviceAlert = 0;
  private lastRegionAlert = 0;
  private alertHistory: Array<{ timestamp: number; lat: number; lon: number }> = [];

  private constructor() {
    this.p2pManager = P2PManager.getInstance();
    this.messageQueue = MessageQueue.getInstance();
    this.config = this.getDefaultConfig();
    this.loadConfig();
    this.setupP2PListeners();
  }

  static getInstance(): EEWManager {
    if (!EEWManager.instance) {
      EEWManager.instance = new EEWManager();
    }
    return EEWManager.instance;
  }

  private getDefaultConfig(): EEWConfig {
    return {
      enabled: true,
      k: 5,
      radiusKm: 8,
      windowSec: 5,
      pThreshold: 3.0,
      staMs: 500,
      ltaMs: 3000,
      minGapMs: 30000,
      officialFeedUrl: '',
      etaCutoffSec: 25,
      deviceCooldownMs: 60000,
      regionCooldownMs: 30000,
    };
  }

  private async loadConfig(): Promise<void> {
    try {
      const savedConfig = await Preferences.get<EEWConfig>('eewConfig');
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
      }
    } catch (error) {
      console.error('Failed to load EEW config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await Preferences.set('eewConfig', this.config);
    } catch (error) {
      console.error('Failed to save EEW config:', error);
    }
  }

  private setupP2PListeners(): void {
    // Listen for incoming EEW_P messages from P2P
    this.p2pManager.on('eew_peer_message', this.handlePeerEEWMessage.bind(this));
  }

  private handlePeerEEWMessage(message: any): void {
    try {
      if (message.type === 'EEW_P') {
        const eewMessage: EEWPeerMessage = {
          id: message.id,
          timestamp: message.timestamp,
          lat: message.location[0],
          lon: message.location[1],
          accuracy: message.location[2],
          strength: message.strength,
          deviceId: message.deviceId,
        };

        this.processPeerMessage(eewMessage);
      }
    } catch (error) {
      console.error('Error handling peer EEW message:', error);
    }
  }

  async onLocalPWave(event: EEWLocalPWaveEvent): Promise<void> {
    if (!this.config.enabled) {
      console.log('EEW disabled, ignoring local P-wave detection');
      return;
    }

    try {
      // Check device cooldown
      if (Date.now() - this.lastDeviceAlert < this.config.deviceCooldownMs) {
        console.log('Device cooldown active, ignoring local P-wave');
        return;
      }

      // Build P2P quorum probe message
      const eewMessage = {
        type: 'EEW_P',
        id: `eew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: event.timestamp,
        location: [event.lat, event.lon, event.accuracy || 0],
        strength: event.strength,
        deviceId: await this.getDeviceId(),
      };

      // Enqueue for immediate P2P broadcast (high priority)
      await this.p2pManager.enqueueMessage({
        id: eewMessage.id,
        type: 'EEW_P',
        payload: eewMessage,
        ttl: 2, // Small TTL for immediate propagation
        hops: 0,
        timestamp: event.timestamp,
        signature: '', // Will be signed by P2PManager
        source: 'self',
        priority: 'high', // High priority for EEW messages
      });

      // Add to local peer messages for quorum calculation
      const localPeerMessage: EEWPeerMessage = {
        id: eewMessage.id,
        timestamp: event.timestamp,
        lat: event.lat,
        lon: event.lon,
        accuracy: event.accuracy,
        strength: event.strength,
        deviceId: eewMessage.deviceId,
      };

      this.processPeerMessage(localPeerMessage);

      console.log('EEW local P-wave broadcasted via P2P:', {
        id: eewMessage.id,
        strength: event.strength,
        location: `${event.lat.toFixed(6)}, ${event.lon.toFixed(6)}`,
      });
    } catch (error) {
      console.error('Error processing local P-wave:', error);
    }
  }

  private processPeerMessage(message: EEWPeerMessage): void {
    // Store message
    this.peerMessages.set(message.id, message);

    // Clean up old messages (older than window + buffer)
    const cutoffTime = Date.now() - (this.config.windowSec * 1000 + 10000); // 10s buffer
    for (const [id, msg] of this.peerMessages.entries()) {
      if (msg.timestamp < cutoffTime) {
        this.peerMessages.delete(id);
      }
    }

    // Check for quorum
    this.checkQuorum(message.timestamp);
  }

  private checkQuorum(triggerTime: number): void {
    const windowStart = triggerTime - (this.config.windowSec * 1000);
    const windowEnd = triggerTime;

    // Get messages within time window
    const windowMessages = Array.from(this.peerMessages.values()).filter(
      msg => msg.timestamp >= windowStart && msg.timestamp <= windowEnd
    );

    if (windowMessages.length < this.config.k) {
      return; // Not enough devices
    }

    // Calculate cluster center and radius
    const cluster = this.calculateCluster(windowMessages);
    if (!cluster) {
      return; // No valid cluster found
    }

    // Check if cluster is within radius
    if (cluster.radius > this.config.radiusKm) {
      console.log('Cluster too large:', cluster.radius, 'km');
      return;
    }

    // Check region cooldown
    if (this.isInRecentAlertRegion(cluster.centerLat, cluster.centerLon)) {
      console.log('Region cooldown active, ignoring cluster alert');
      return;
    }

    // Trigger cluster alert
    this.triggerClusterAlert(cluster, windowMessages);
  }

  private calculateCluster(messages: EEWPeerMessage[]): EEWQuorumWindow | null {
    if (messages.length === 0) return null;

    // Calculate center (weighted by strength)
    let weightedLat = 0;
    let weightedLon = 0;
    let totalWeight = 0;

    messages.forEach(msg => {
      const weight = msg.strength;
      weightedLat += msg.lat * weight;
      weightedLon += msg.lon * weight;
      totalWeight += weight;
    });

    if (totalWeight === 0) return null;

    const centerLat = weightedLat / totalWeight;
    const centerLon = weightedLon / totalWeight;

    // Calculate radius (max distance from center)
    let maxRadius = 0;
    messages.forEach(msg => {
      const distance = this.calculateDistance(centerLat, centerLon, msg.lat, msg.lon);
      maxRadius = Math.max(maxRadius, distance);
    });

    return {
      startTime: Math.min(...messages.map(m => m.timestamp)),
      endTime: Math.max(...messages.map(m => m.timestamp)),
      messages,
      centerLat,
      centerLon,
      radius: maxRadius,
    };
  }

  private triggerClusterAlert(cluster: EEWQuorumWindow, messages: EEWPeerMessage[]): void {
    const avgStrength = messages.reduce((sum, msg) => sum + msg.strength, 0) / messages.length;
    
    // Estimate ETA (rough calculation based on distance to epicenter)
    const etaSeconds = this.estimateETA(cluster.centerLat, cluster.centerLon);
    
    // Determine confidence based on device count and strength
    let confidence: 'low' | 'medium' | 'high' = 'low';
    if (messages.length >= this.config.k * 2) {
      confidence = 'high';
    } else if (messages.length >= this.config.k * 1.5) {
      confidence = 'medium';
    }

    const alertEvent: EEWClusterAlertEvent = {
      timestamp: Date.now(),
      deviceCount: messages.length,
      avgStrength,
      centerLat: cluster.centerLat,
      centerLon: cluster.centerLon,
      radius: cluster.radius,
      etaSeconds,
      confidence,
    };

    // Update cooldowns
    this.lastDeviceAlert = Date.now();
    this.lastRegionAlert = Date.now();
    this.alertHistory.push({
      timestamp: Date.now(),
      lat: cluster.centerLat,
      lon: cluster.centerLon,
    });

    // Clean up old alert history
    this.alertHistory = this.alertHistory.filter(
      alert => Date.now() - alert.timestamp < this.config.regionCooldownMs
    );

    console.log('EEW Cluster Alert triggered:', {
      deviceCount: messages.length,
      confidence,
      etaSeconds,
      center: `${cluster.centerLat.toFixed(6)}, ${cluster.centerLon.toFixed(6)}`,
      radius: cluster.radius.toFixed(2),
    });

    this.eventEmitter.emit('eew:cluster_alert', alertEvent);
  }

  async sendEEWMessage(lat: number, lon: number, strength: number, deviceId: string): Promise<void> {
    try {
      if (!this.config.enabled) {
        return;
      }

      console.log('Sending EEW P-wave message:', { lat, lon, strength, deviceId });

      // Create EEW message data
      const messageData = {
        t: 3, // EEW_P message type
        id: `eew_${Date.now()}_${deviceId}`,
        ts: Date.now(),
        loc: {
          lat,
          lon,
          acc: 10, // 10 meter accuracy
        },
        prio: 2, // Critical priority
        flags: {
          underRubble: false,
          injured: false,
          anonymity: false,
        },
        ppl: 1,
        note: `EEW_P:${deviceId}`,
        ttl: 2, // Small TTL for fast propagation
        str: strength,
      };

      // Use fast-path for EEW messages
      await this.messageQueue.enqueueEEWImmediate(messageData);
      
      console.log('EEW message sent via fast-path');
    } catch (error) {
      console.error('Failed to send EEW message:', error);
    }
  }

  onOfficialFeedAlert(alertData: any): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      const etaSeconds = this.calculateOfficialETA(alertData);
      
      if (etaSeconds > this.config.etaCutoffSec) {
        console.log('Official alert ETA too long:', etaSeconds, 'seconds');
        return;
      }

      const alertEvent: EEWOfficialAlertEvent = {
        timestamp: Date.now(),
        magnitude: alertData.magnitude,
        epicenterLat: alertData.epicenterLat,
        epicenterLon: alertData.epicenterLon,
        originTime: alertData.originTime,
        etaSeconds,
        source: alertData.source || 'official',
        confidence: 'high',
      };

      console.log('EEW Official Alert received:', {
        magnitude: alertData.magnitude,
        etaSeconds,
        epicenter: `${alertData.epicenterLat.toFixed(6)}, ${alertData.epicenterLon.toFixed(6)}`,
        source: alertData.source,
      });

      this.eventEmitter.emit('eew:official_alert', alertEvent);
    } catch (error) {
      console.error('Error processing official feed alert:', error);
    }
  }

  private estimateETA(epicenterLat: number, epicenterLon: number): number {
    // Rough estimation: assume epicenter is at surface, use S-wave velocity
    // This is a simplified calculation for demo purposes
    const sWaveVelocity = 3.5; // km/s
    
    try {
      // Get current device location (simplified - in real app would get actual location)
      const deviceLat = 41.0082; // Istanbul default
      const deviceLon = 28.9784;
      
      const distance = this.calculateDistance(deviceLat, deviceLon, epicenterLat, epicenterLon);
      return Math.round(distance / sWaveVelocity);
    } catch (error) {
      console.error('Error calculating ETA:', error);
      return 30; // Default fallback
    }
  }

  private calculateOfficialETA(alertData: any): number {
    // Calculate ETA based on official alert data
    const originTime = new Date(alertData.originTime).getTime();
    const currentTime = Date.now();
    const elapsedMs = currentTime - originTime;
    
    // Estimate S-wave arrival time (simplified)
    const pWaveVelocity = 6.0; // km/s
    const sWaveVelocity = 3.5; // km/s
    
    const deviceLat = 41.0082; // Istanbul default
    const deviceLon = 28.9784;
    const distance = this.calculateDistance(
      deviceLat, deviceLon, 
      alertData.epicenterLat, alertData.epicenterLon
    );
    
    const sWaveArrivalMs = (distance / sWaveVelocity) * 1000;
    const etaMs = sWaveArrivalMs - elapsedMs;
    
    return Math.max(0, Math.round(etaMs / 1000));
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private isInRecentAlertRegion(lat: number, lon: number): boolean {
    const recentAlerts = this.alertHistory.filter(
      alert => Date.now() - alert.timestamp < this.config.regionCooldownMs
    );

    return recentAlerts.some(alert => {
      const distance = this.calculateDistance(lat, lon, alert.lat, alert.lon);
      return distance < 2; // 2km radius for region cooldown
    });
  }

  private async getDeviceId(): Promise<string> {
    try {
      const deviceId = await Preferences.get<string>('deviceId');
      if (deviceId) return deviceId;
      
      // Generate new device ID
      const newDeviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await Preferences.set('deviceId', newDeviceId);
      return newDeviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return `fallback_${Date.now()}`;
    }
  }

  // Configuration methods
  async updateConfig(updates: Partial<EEWConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
  }

  getConfig(): EEWConfig {
    return { ...this.config };
  }

  // Event subscription methods
  on(event: 'eew:cluster_alert', listener: (data: EEWClusterAlertEvent) => void): () => void;
  on(event: 'eew:official_alert', listener: (data: EEWOfficialAlertEvent) => void): () => void;
  on(event: string, listener: (...args: any[]) => void): () => void {
    return this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  // Utility methods
  getPeerMessageCount(): number {
    return this.peerMessages.size;
  }

  getLastDeviceAlert(): number {
    return this.lastDeviceAlert;
  }

  getLastRegionAlert(): number {
    return this.lastRegionAlert;
  }

  clearPeerMessages(): void {
    this.peerMessages.clear();
  }

  // Testing methods
  simulateClusterAlert(deviceCount: number = 6, strength: number = 4.0): void {
    const alertEvent: EEWClusterAlertEvent = {
      timestamp: Date.now(),
      deviceCount,
      avgStrength: strength,
      centerLat: 41.0082,
      centerLon: 28.9784,
      radius: 5.0,
      etaSeconds: 15,
      confidence: deviceCount >= 10 ? 'high' : deviceCount >= 7 ? 'medium' : 'low',
    };

    this.eventEmitter.emit('eew:cluster_alert', alertEvent);
  }

  simulateOfficialAlert(magnitude: number = 6.5, etaSeconds: number = 20): void {
    const alertEvent: EEWOfficialAlertEvent = {
      timestamp: Date.now(),
      magnitude,
      epicenterLat: 40.8,
      epicenterLon: 29.0,
      originTime: Date.now() - 5000, // 5 seconds ago
      etaSeconds,
      source: 'AFAD',
      confidence: 'high',
    };

    this.eventEmitter.emit('eew:official_alert', alertEvent);
  }
}

// Export convenience function
export const getEEWManager = (): EEWManager => {
  return EEWManager.getInstance();
};
