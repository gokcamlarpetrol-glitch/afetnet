import { BLEMeshManager } from './bleMesh';
import { CBOREncoder, MessagePayload } from '../crypto/cbor';
import { Curve25519Crypto } from '../crypto/curve25519';
import { Priority, ResourceType } from '../database/models';

export interface P2PConfig {
  enableBLE: boolean;
  enableNearbyConnections: boolean;
  enableMultipeerConnectivity: boolean;
  adaptiveInterval: boolean;
  batteryOptimized: boolean;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export class P2PManager {
  private static instance: P2PManager;
  private bleMesh: BLEMeshManager;
  private crypto: Curve25519Crypto;
  private isInitialized: boolean = false;
  private config: P2PConfig;
  private currentLocation: LocationData | null = null;
  private batteryLevel: number = 100;

  private constructor() {
    this.bleMesh = BLEMeshManager.getInstance();
    this.crypto = Curve25519Crypto.getInstance();
    this.config = {
      enableBLE: true,
      enableNearbyConnections: true,
      enableMultipeerConnectivity: true,
      adaptiveInterval: true,
      batteryOptimized: false,
    };
  }

  static getInstance(): P2PManager {
    if (!P2PManager.instance) {
      P2PManager.instance = new P2PManager();
    }
    return P2PManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      if (this.config.enableBLE) {
        await this.bleMesh.initialize();
      }

      // Initialize other P2P protocols here
      // await this.initializeNearbyConnections();
      // await this.initializeMultipeerConnectivity();

      this.isInitialized = true;
      console.log('P2P Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize P2P Manager:', error);
      throw error;
    }
  }

  async startP2P(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (this.config.enableBLE) {
        await this.bleMesh.startScanning();
        await this.bleMesh.startAdvertising();
      }

      console.log('P2P networking started');
    } catch (error) {
      console.error('Failed to start P2P networking:', error);
      throw error;
    }
  }

  async stopP2P(): Promise<void> {
    try {
      if (this.config.enableBLE) {
        await this.bleMesh.stopScanning();
        await this.bleMesh.stopAdvertising();
      }

      console.log('P2P networking stopped');
    } catch (error) {
      console.error('Failed to stop P2P networking:', error);
    }
  }

  async sendHelpRequest(
    priority: Priority,
    underRubble: boolean,
    injured: boolean,
    peopleCount: number,
    note: string,
    location: LocationData,
  ): Promise<void> {
    if (!this.currentLocation) {
      this.currentLocation = location;
    }

    const ephemeralId = this.crypto.getCurrentEphemeralId();
    if (!ephemeralId) {
      throw new Error('No ephemeral ID available');
    }

    const payload = {
      t: 'HELP' as const,
      id: ephemeralId.id,
      ts: Date.now(),
      loc: [location.latitude, location.longitude, location.accuracy] as [number, number, number],
      prio: priority,
      flags: {
        rubble: underRubble,
        injury: injured,
      },
      ppl: peopleCount,
      note,
      batt: this.batteryLevel,
      ttl: this.calculateTTL(priority),
      sig: '',
    };

    // Sign the message
    const encodedPayload = CBOREncoder.encode(payload);
    payload.sig = this.crypto.encodeBase64(this.crypto.sign(encodedPayload));

    await this.bleMesh.queueMessage(payload);
    console.log('Help request queued for P2P transmission');
  }

  async sendSafePing(
    note: string | undefined,
    location: LocationData,
  ): Promise<void> {
    if (!this.currentLocation) {
      this.currentLocation = location;
    }

    const ephemeralId = this.crypto.getCurrentEphemeralId();
    if (!ephemeralId) {
      throw new Error('No ephemeral ID available');
    }

    const payload = {
      t: 'SAFE' as const,
      id: ephemeralId.id,
      ts: Date.now(),
      loc: [location.latitude, location.longitude, location.accuracy] as [number, number, number],
      note,
      batt: this.batteryLevel,
      ttl: 3600000, // 1 hour
      sig: '',
    };

    // Sign the message
    const encodedPayload = CBOREncoder.encode(payload);
    payload.sig = this.crypto.encodeBase64(this.crypto.sign(encodedPayload));

    await this.bleMesh.queueMessage(payload);
    console.log('Safe ping queued for P2P transmission');
  }

  async sendResourcePost(
    type: ResourceType,
    location: LocationData,
    qty?: string,
    desc?: string,
  ): Promise<void> {
    if (!this.currentLocation) {
      this.currentLocation = location;
    }

    const ephemeralId = this.crypto.getCurrentEphemeralId();
    if (!ephemeralId) {
      throw new Error('No ephemeral ID available');
    }

    const payload = {
      t: 'RES' as const,
      id: ephemeralId.id,
      ts: Date.now(),
      loc: [location.latitude, location.longitude, location.accuracy] as [number, number, number],
      type,
      qty,
      desc,
      ttl: 7200000, // 2 hours
      sig: '',
    };

    // Sign the message
    const encodedPayload = CBOREncoder.encode(payload);
    payload.sig = this.crypto.encodeBase64(this.crypto.sign(encodedPayload));

    await this.bleMesh.queueMessage(payload);
    console.log('Resource post queued for P2P transmission');
  }

  async sendPing(location: LocationData): Promise<void> {
    if (!this.currentLocation) {
      this.currentLocation = location;
    }

    const ephemeralId = this.crypto.getCurrentEphemeralId();
    if (!ephemeralId) {
      throw new Error('No ephemeral ID available');
    }

    const payload = {
      t: 'PING' as const,
      id: ephemeralId.id,
      ts: Date.now(),
      loc: [location.latitude, location.longitude, location.accuracy] as [number, number, number],
      batt: this.batteryLevel,
      ttl: 300000, // 5 minutes
      sig: '',
    };

    // Sign the message
    const encodedPayload = CBOREncoder.encode(payload);
    payload.sig = this.crypto.encodeBase64(this.crypto.sign(encodedPayload));

    await this.bleMesh.queueMessage(payload);
    console.log('Ping queued for P2P transmission');
  }

  private calculateTTL(priority: Priority): number {
    // Higher priority messages get longer TTL
    switch (priority) {
      case 0: // Critical
        return 86400000; // 24 hours
      case 1: // High
        return 43200000; // 12 hours
      case 2: // Normal
        return 21600000; // 6 hours
      default:
        return 3600000; // 1 hour
    }
  }

  updateLocation(location: LocationData): void {
    this.currentLocation = location;
  }

  updateBatteryLevel(level: number): void {
    this.batteryLevel = level;
    
    // Switch to battery-optimized mode if battery is low
    if (level < 15 && !this.config.batteryOptimized) {
      this.config.batteryOptimized = true;
      console.log('Switching to battery-optimized mode');
    } else if (level > 30 && this.config.batteryOptimized) {
      this.config.batteryOptimized = false;
      console.log('Switching to normal mode');
    }
  }

  updateConfig(newConfig: Partial<P2PConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): P2PConfig {
    return { ...this.config };
  }

  getDiscoveredDevices() {
    return this.bleMesh.getDiscoveredDevices();
  }

  getQueueStats() {
    return this.bleMesh.getQueueStats();
  }

  async cleanup(): Promise<void> {
    await this.bleMesh.cleanup();
    this.isInitialized = false;
    console.log('P2P Manager cleaned up');
  }
}
