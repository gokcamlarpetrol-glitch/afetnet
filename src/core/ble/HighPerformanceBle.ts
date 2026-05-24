// CRITICAL: Lazy-load BLE native modules with try-catch to prevent app crash
// These modules require native code and will crash if unavailable
let BleManagerClass: any = null;
let BleManagerAvailable = false;

try {
  const blePlx = require('react-native-ble-plx');
  BleManagerClass = blePlx.BleManager;
  BleManagerAvailable = true;
} catch (e) {
  // BLE PLX not available — graceful degradation
}

// AfetNet BLE Peripheral (GATT Server) — replaces broken react-native-ble-peripheral
interface AfetNetPeripheralAPI {
  startPeripheral(serviceUUID: string, characteristicUUIDs: string[], sosCharacteristicUUID: string): Promise<void>;
  stopPeripheral(): Promise<void>;
  isPeripheralRunning(): boolean;
  updateAdvertisementData(data: string): void;
  notifyCharacteristic(characteristicUUID: string, data: string): void;
  getConnectedDeviceCount(): number;
  addOnWriteReceivedListener(listener: (event: { deviceId: string; characteristicUUID: string; data: string }) => void): { remove: () => void };
  addOnDeviceConnectedListener(listener: (event: { deviceId: string }) => void): { remove: () => void };
  addOnDeviceDisconnectedListener(listener: (event: { deviceId: string }) => void): { remove: () => void };
  // FAZ 1 TIER1-04: killed-app restoration sonrası iOS event'i. JS bunu
  // yakalayıp scanner + listener'ları ~30s background penceresinde bootstrap eder.
  addOnStateRestoredListener?(listener: (event: {
    serviceUUIDs: string[];
    characteristicUUIDs: string[];
    hadAdvertisementData: boolean;
    timestamp: number;
  }) => void): { remove: () => void };
}
let AfetNetPeripheral: AfetNetPeripheralAPI | null = null;
try {
  AfetNetPeripheral = require('../../../modules/afetnet-ble-peripheral');
} catch (e) {
  // Native module not available — graceful degradation
}

import { Platform, PermissionsAndroid } from 'react-native';
import {
  AFETNET_SERVICE_UUID,
  AFETNET_CHAR_MSG_UUID,
  AFETNET_CHAR_CHUNK_UUID,
  AFETNET_CHAR_SOS_UUID,
  AFETNET_CHAR_LOCATION_UUID,
  MANUFACTURER_ID,
  CONNECTION_TIMEOUT_MS,
  MAX_CHUNK_SIZE,
  MAX_ADVERTISING_DATA,
} from './constants';
import { createLogger } from '../utils/logger';
import { Buffer } from 'buffer';

const logger = createLogger('HighPerformanceBle');

// All characteristic UUIDs for GATT server setup
const ALL_CHAR_UUIDS = [
  AFETNET_CHAR_MSG_UUID,
  AFETNET_CHAR_CHUNK_UUID,
  AFETNET_CHAR_SOS_UUID,
  AFETNET_CHAR_LOCATION_UUID,
];

// Max concurrent GATT connections (iOS limit is ~7, Android ~5-7)
const MAX_GATT_CONNECTIONS = 5;

export interface BlePeer {
  id: string;
  rssi: number;
  manufacturerData?: string;
  lastSeen: number;
}

interface GATTConnection {
  device: any; // ble-plx Device
  mtu: number;
  disconnectSub: { remove: () => void } | null;
  monitorSubs: { remove: () => void }[];
}

class HighPerformanceBle {
  private manager: any; // BleManager | null
  private isScanning = false;
  private isAdvertising = false;
  private peripheralRunning = false;
  private startingPeripheral = false; // Prevent concurrent startPeripheral calls
  private hasLoggedPeripheralUnavailable = false;
  private dualModeRequested = false;
  private bleStateSubscription: { remove: () => void } | null = null;
  private scanFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private useBroadScanFallback = false;
  private lastPeerDiscoveredAt = 0;
  // görev #19: Tarama hatası kurtarma. Eskiden bir geçici tarama hatası
  // isScanning=false yapıp dönüyordu; hiçbir şey yeniden başlatmadığından
  // keşif bir sonraki BT toggle'a kadar ölüyordu (SOS peer'ları görünmez).
  private scanRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private scanRetryAttempt = 0;
  private static readonly MAX_SCAN_RETRY_ATTEMPTS = 6;
  private static readonly SCAN_RETRY_BASE_MS = 2000;
  // Watchdog: dualMode isteniyorken tarama düşmüşse yeniden silahlandırır.
  private scanWatchdogTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly SCAN_WATCHDOG_INTERVAL_MS = 15000;
  private foundPeers: Map<string, BlePeer> = new Map();
  private scanListeners: ((peer: BlePeer) => void)[] = [];

  // GATT Client connections (to remote GATT servers)
  private connectedPeers: Map<string, GATTConnection> = new Map();
  private connectionInProgress: Set<string> = new Set();
  // Throttle failed connection attempts per device (deviceId → next allowed attempt time)
  private connectionCooldowns: Map<string, number> = new Map();

  // Incoming data listeners (from GATT server writes + GATT client notifications)
  private incomingDataListeners: ((deviceId: string, charUUID: string, data: Buffer) => void)[] = [];
  private nativeEventSubscriptions: { remove: () => void }[] = [];

  constructor() {
    try {
      if (BleManagerAvailable && BleManagerClass) {
        this.manager = new BleManagerClass();
        this.attachBleStateListener();
      } else {
        logger.warn('BleManager not available — BLE features disabled');
        this.manager = null;
      }
    } catch (error) {
      logger.warn('BleManager initialization failed — BLE features disabled:', error);
      this.manager = null;
    }
  }

  private attachBleStateListener(): void {
    if (!this.manager || typeof this.manager.onStateChange !== 'function') {
      return;
    }

    try {
      this.bleStateSubscription = this.manager.onStateChange((state: string) => {
        if (state !== 'PoweredOn') {
          this.isScanning = false;
          this.peripheralRunning = false;
          this.isAdvertising = false;
          this.clearScanFallbackTimer();
          // görev #19: BT kapalıyken bekleyen tarama-retry'sini ve watchdog'u
          // durdur — boş yere dönmesinler. PoweredOn olunca ensureDualModeActive
          // taramayı yeniden başlatır.
          this.clearScanRetryTimer();
          this.stopScanWatchdog();
          this.scanRetryAttempt = 0;
          this.useBroadScanFallback = false;
          // Clean up dead GATT connections — they become invalid when BT turns off
          for (const [, peer] of this.connectedPeers) {
            peer.disconnectSub?.remove();
            for (const sub of peer.monitorSubs) {
              try { sub.remove(); } catch { /* best effort */ }
            }
          }
          this.connectedPeers.clear();
          this.connectionInProgress.clear();
          this.connectionCooldowns.clear();
        }

        // CRITICAL FIX: If mesh was started while Bluetooth was off (common in airplane mode),
        // automatically resume when Bluetooth turns on later.
        if (state === 'PoweredOn' && this.dualModeRequested) {
          this.ensureDualModeActive().catch((error) => {
            logger.warn('BLE dual mode resume failed after state change:', error);
          });
        }
      }, true);
    } catch (error) {
      logger.warn('BLE state listener setup failed:', error);
    }
  }

  private async ensureDualModeActive(): Promise<void> {
    if (!this.manager) return;

    try {
      const state = await this.manager.state();
      if (state !== 'PoweredOn') {
        logger.warn(`BLE dual mode pending: Bluetooth state is ${state}`);
        return;
      }
    } catch {
      logger.warn('BLE state check failed while ensuring dual mode');
      return;
    }

    // 1) Start GATT server + advertising via native module
    await this.startPeripheral();

    // 2) Keep scanning active so nearby peers are discovered
    await this.startScanning();
  }

  async isBluetoothPoweredOn(): Promise<boolean> {
    if (!this.manager) return false;
    try {
      const state = await this.manager.state();
      return state === 'PoweredOn';
    } catch {
      return false;
    }
  }

  /**
   * K3: Resolve the raw BLE state into a user-actionable reason.
   *
   * Returns null when mesh is healthy and ready to use. When unavailable,
   * the reason maps to MeshStore.meshUnavailableReason so the UI can show
   * a precise banner ("Bluetooth açık mı?" vs "İzin verin").
   *
   * - 'unsupported': BleManager wasn't even constructable on this device
   *                  (typically iOS simulator without Bluetooth, or Android
   *                  without BLE chipset). Mesh is permanently disabled here.
   * - 'no-permission': iOS 'Unauthorized' or Android missing BLUETOOTH_*.
   *                    User must enable in Settings.
   * - 'bluetooth-off': hardware is fine + permission OK, but radio is off.
   *                    Quick fix — toggle Bluetooth.
   */
  async getMeshAvailabilityReason(): Promise<
    'no-permission' | 'bluetooth-off' | 'unsupported' | null
  > {
    if (!this.manager) return 'unsupported';
    try {
      const state = await this.manager.state();
      if (state === 'Unauthorized') return 'no-permission';
      if (state === 'PoweredOff') return 'bluetooth-off';
      if (state === 'Unsupported') return 'unsupported';
      if (state === 'PoweredOn') return null;
      // 'Unknown' / 'Resetting' — treat as transient; report as 'bluetooth-off'
      // so the user sees actionable guidance rather than a spinner.
      return 'bluetooth-off';
    } catch {
      return 'unsupported';
    }
  }

  // ===========================================================================
  // DUAL MODE: GATT Server (peripheral) + BLE Scanner (central)
  // ===========================================================================

  /**
   * Start Dual Mode: GATT Server (advertising + accepting writes) + BLE Scanner (discovery + GATT client)
   * The payload parameter is now only used for backward compatibility (identity packet).
   * Real data transfer happens via GATT write/notify, not advertisement payload.
   */
  async startDualMode(_payload?: Uint8Array): Promise<void> {
    this.dualModeRequested = true;

    // CRITICAL FIX: Recreate BleManager if destroy() was called previously.
    // destroy() nulls this.manager, making BLE permanently dead for the singleton.
    // Without this, account switch → cleanup → re-init leaves BLE non-functional.
    if (!this.manager && BleManagerAvailable && BleManagerClass) {
      try {
        this.manager = new BleManagerClass();
        this.attachBleStateListener();
        logger.info('BleManager re-created after previous destroy()');
      } catch (error) {
        logger.warn('BleManager re-creation failed:', error);
      }
    }

    const permissionsGranted = await this.requestPermissions();
    if (!permissionsGranted) {
      logger.warn('BLE permissions not granted — dual mode cannot start');
      return;
    }

    await this.ensureDualModeActive();
  }

  async stopDualMode() {
    this.dualModeRequested = false;
    await this.stopPeripheral();
    this.stopScanning();
    await this.disconnectAllPeers();
  }

  /**
   * Full cleanup — call on app shutdown to prevent resource leaks.
   */
  async destroy(): Promise<void> {
    this.dualModeRequested = false;
    this.bleStateSubscription?.remove();
    this.bleStateSubscription = null;
    this.clearScanFallbackTimer();
    await this.stopPeripheral();
    this.stopScanning();
    await this.disconnectAllPeers();
    this.foundPeers.clear();
    this.connectionInProgress.clear();
    this.connectionCooldowns.clear();
    this.scanListeners = [];
    this.incomingDataListeners = [];
    if (this.manager) {
      try { this.manager.destroy(); } catch { /* best effort */ }
      this.manager = null;
    }
  }

  // ===========================================================================
  // GATT SERVER (via AfetNetBlePeripheral native module)
  // ===========================================================================

  private async startPeripheral(): Promise<void> {
    if (this.peripheralRunning || this.startingPeripheral) return;

    if (!AfetNetPeripheral) {
      if (!this.hasLoggedPeripheralUnavailable) {
        logger.warn('AfetNetBlePeripheral native module not available — GATT server disabled');
        this.hasLoggedPeripheralUnavailable = true;
      }
      return;
    }

    this.startingPeripheral = true;
    try {
      await AfetNetPeripheral.startPeripheral(AFETNET_SERVICE_UUID, ALL_CHAR_UUIDS, AFETNET_CHAR_SOS_UUID);
      this.peripheralRunning = true;
      this.isAdvertising = true;

      // Listen for incoming writes from remote GATT clients
      this.setupNativeEventListeners();
      logger.info('GATT Server started (advertising + 4 characteristics)');
    } catch (error) {
      logger.warn('GATT Server start failed:', error);
      this.peripheralRunning = false;
      this.isAdvertising = false;
    } finally {
      this.startingPeripheral = false;
    }
  }

  private async stopPeripheral(): Promise<void> {
    if (!AfetNetPeripheral || !this.peripheralRunning) {
      this.peripheralRunning = false;
      this.isAdvertising = false;
      return;
    }

    // Remove native event listeners
    for (const sub of this.nativeEventSubscriptions) {
      sub.remove();
    }
    this.nativeEventSubscriptions = [];

    try {
      await AfetNetPeripheral.stopPeripheral();
      logger.info('GATT Server stopped');
    } catch {
      // best effort
    } finally {
      this.peripheralRunning = false;
      this.isAdvertising = false;
    }
  }

  private setupNativeEventListeners(): void {
    if (!AfetNetPeripheral) return;

    // Clean up any previous subscriptions
    for (const sub of this.nativeEventSubscriptions) {
      sub.remove();
    }
    this.nativeEventSubscriptions = [];

    // Listen for writes from connected GATT clients
    const writeSub = AfetNetPeripheral.addOnWriteReceivedListener((event) => {
      try {
        const data = Buffer.from(event.data, 'hex');
        this.notifyIncomingData(event.deviceId, event.characteristicUUID, data);
      } catch (e) {
        logger.debug('Failed to process incoming GATT write:', e);
      }
    });
    this.nativeEventSubscriptions.push(writeSub);

    const connectSub = AfetNetPeripheral.addOnDeviceConnectedListener((event) => {
      logger.debug(`GATT client connected: ${event.deviceId.substring(0, 8)}`);
    });
    this.nativeEventSubscriptions.push(connectSub);

    const disconnectSub = AfetNetPeripheral.addOnDeviceDisconnectedListener((event) => {
      logger.debug(`GATT client disconnected: ${event.deviceId.substring(0, 8)}`);
    });
    this.nativeEventSubscriptions.push(disconnectSub);

    // FAZ 1 TIER1-04: killed-app restoration sonrası native side onStateRestored
    // event'i gönderir (yalnızca iOS). MeshNetworkService bunu DeviceEventEmitter
    // üzerinden yakalayıp scanner + listener bootstrap eder; ayrıca burada
    // peripheralRunning + isAdvertising flag'leri restore edilir, böylece üst
    // katman "GATT server kapalı" sanmaz ve yeniden start denemez.
    if (typeof AfetNetPeripheral.addOnStateRestoredListener === 'function') {
      const restoreSub = AfetNetPeripheral.addOnStateRestoredListener((event) => {
        logger.info(
          `🔄 BLE state restored: services=${event.serviceUUIDs.length} chars=${event.characteristicUUIDs.length} adData=${event.hadAdvertisementData}`
        );
        this.peripheralRunning = true;
        this.isAdvertising = true;

        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { DeviceEventEmitter } = require('react-native');
          DeviceEventEmitter.emit('AFETNET_BLE_STATE_RESTORED', event);
        } catch {
          /* RN her zaman var ama emit hatasını yutuyoruz */
        }
      });
      this.nativeEventSubscriptions.push(restoreSub);
    }
  }

  /**
   * Get the number of devices connected to our GATT server (inbound clients).
   * This is different from getConnectedPeerIds() which returns outbound connections.
   */
  getGATTServerClientCount(): number {
    if (!AfetNetPeripheral || !this.peripheralRunning) return 0;
    try {
      return AfetNetPeripheral.getConnectedDeviceCount();
    } catch {
      return 0;
    }
  }

  /**
   * Send notification to all connected GATT clients via the native GATT server
   */
  notifyGATTClients(characteristicUUID: string, data: Buffer): void {
    if (!AfetNetPeripheral || !this.peripheralRunning) return;
    try {
      AfetNetPeripheral.notifyCharacteristic(characteristicUUID, data.toString('hex'));
    } catch (e) {
      logger.debug('GATT notify failed:', e);
    }
  }

  /**
   * Update advertisement data (for beacon-style small payloads like SOS)
   */
  updateAdvertisementData(data: Buffer): void {
    if (!AfetNetPeripheral || !this.peripheralRunning) return;
    // FIX: BLE advertisement payload must be ≤31 bytes. Android fails silently
    // with ADVERTISE_FAILED_DATA_TOO_LARGE if exceeded.
    if (data.length > MAX_ADVERTISING_DATA) {
      if (__DEV__) logger.warn(`Advertisement data too large: ${data.length} > ${MAX_ADVERTISING_DATA} bytes, skipping`);
      return;
    }
    try {
      AfetNetPeripheral.updateAdvertisementData(data.toString('hex'));
    } catch (e) {
      logger.debug('Advertisement data update failed:', e);
    }
  }

  // ===========================================================================
  // GATT CLIENT: Connect to remote peers' GATT servers
  // ===========================================================================

  /**
   * Connect to a discovered peer's GATT server.
   * Returns true if connection succeeded.
   */
  async connectToPeer(deviceId: string): Promise<boolean> {
    if (!this.manager) return false;
    if (this.connectedPeers.has(deviceId) || this.connectionInProgress.has(deviceId)) {
      return this.connectedPeers.has(deviceId);
    }

    // FIX: Evict expired cooldowns FIRST — stale entries from disconnected peers
    // blocked new connection attempts until map exceeded 50 entries.
    const now = Date.now();
    if (this.connectionCooldowns.size > 0) {
      for (const [id, expiry] of this.connectionCooldowns) {
        if (now >= expiry) this.connectionCooldowns.delete(id);
      }
    }

    // Throttle: skip if we recently failed to connect to this device
    const cooldownUntil = this.connectionCooldowns.get(deviceId);
    if (cooldownUntil && now < cooldownUntil) {
      return false;
    }

    // Enforce connection limit
    if (this.connectedPeers.size >= MAX_GATT_CONNECTIONS) {
      logger.debug(`Connection limit reached (${MAX_GATT_CONNECTIONS}), skipping ${deviceId.substring(0, 8)}`);
      return false;
    }

    this.connectionInProgress.add(deviceId);

    try {
      const device = await this.manager.connectToDevice(deviceId, {
        timeout: CONNECTION_TIMEOUT_MS,
        autoConnect: false,
      });

      await device.discoverAllServicesAndCharacteristics();

      // Request maximum MTU (iOS defaults to ~185, Android to ~23 without request)
      let mtu = MAX_CHUNK_SIZE;
      try {
        const mtuDevice = await device.requestMTU(512);
        mtu = (mtuDevice?.mtu || MAX_CHUNK_SIZE) - 3; // ATT header overhead
      } catch {
        // MTU negotiation failed, use default
      }

      // Monitor disconnection
      const disconnectSub = device.onDisconnected(() => {
        const conn = this.connectedPeers.get(deviceId);
        if (conn) {
          // Clean up all monitor subscriptions
          for (const sub of conn.monitorSubs) {
            try { sub.remove(); } catch { /* best effort */ }
          }
          // CRITICAL FIX: Also remove the disconnect subscription itself to prevent native leak
          try { conn.disconnectSub?.remove(); } catch { /* best effort */ }
        }
        this.connectedPeers.delete(deviceId);
        logger.debug(`GATT peer disconnected: ${deviceId.substring(0, 8)}`);
      });

      // CRITICAL FIX: Store connection entry BEFORE subscribing to characteristics.
      // If the device disconnects during the subscription loop, the disconnect callback
      // needs to find the entry in connectedPeers to clean up already-created subs.
      const connection: GATTConnection = { device, mtu, disconnectSub, monitorSubs: [] };
      this.connectedPeers.set(deviceId, connection);

      // Subscribe to GATT notifications from remote peer's characteristics
      for (const charUUID of ALL_CHAR_UUIDS) {
        try {
          const monSub = device.monitorCharacteristicForService(
            AFETNET_SERVICE_UUID,
            charUUID,
            (error: any, characteristic: any) => {
              if (error) {
                if (__DEV__) logger.debug('GATT monitor error:', error?.message);
                return; // Subscription error — peer may have disconnected
              }
              if (characteristic?.value) {
                try {
                  const data = Buffer.from(characteristic.value, 'base64');
                  this.notifyIncomingData(deviceId, charUUID.toLowerCase(), data);
                } catch { /* malformed data */ }
              }
            },
          );
          if (monSub) connection.monitorSubs.push(monSub);
        } catch {
          // Characteristic may not support notify on this peer
        }
      }

      // Clear cooldown on success
      this.connectionCooldowns.delete(deviceId);
      logger.debug(`GATT connected to ${deviceId.substring(0, 8)} (MTU: ${mtu})`);
      return true;
    } catch (e) {
      logger.debug(`GATT connect failed for ${deviceId.substring(0, 8)}:`, e);
      // Set cooldown: 15s before next attempt to this device
      this.connectionCooldowns.set(deviceId, Date.now() + 15000);
      return false;
    } finally {
      this.connectionInProgress.delete(deviceId);
    }
  }

  /**
   * Write data to a connected peer's GATT characteristic.
   * Uses writeWithResponse for reliability.
   */
  async writeToCharacteristic(deviceId: string, charUUID: string, data: Buffer): Promise<boolean> {
    const peer = this.connectedPeers.get(deviceId);
    if (!peer) return false;

    try {
      const base64Data = data.toString('base64');
      await peer.device.writeCharacteristicWithResponseForService(
        AFETNET_SERVICE_UUID, charUUID, base64Data
      );
      return true;
    } catch (e) {
      logger.debug(`GATT write failed for ${deviceId.substring(0, 8)}:`, e);
      // Connection might be dead — clean up
      this.cleanupDeadPeer(deviceId);
      return false;
    }
  }

  /**
   * Get MTU for a connected peer (used for chunking decisions)
   */
  getPeerMTU(deviceId: string): number {
    return this.connectedPeers.get(deviceId)?.mtu || MAX_CHUNK_SIZE;
  }

  /**
   * Get all connected peer device IDs
   */
  getConnectedPeerIds(): string[] {
    return Array.from(this.connectedPeers.keys());
  }

  /**
   * Get number of connected GATT peers
   */
  getConnectedPeerCount(): number {
    return this.connectedPeers.size;
  }

  /**
   * Get discovered but not-yet-connected peer IDs.
   * Used by MeshNetworkService to urgently establish GATT connections
   * when a message needs to be sent but no outbound connections exist.
   */
  getUnconnectedDiscoveredPeerIds(): string[] {
    const unconnected: string[] = [];
    const now = Date.now();
    for (const [id, peer] of this.foundPeers) {
      // Only include peers seen recently (within 60s) and not already connected or in-progress
      if (
        now - peer.lastSeen < 60_000 &&
        !this.connectedPeers.has(id) &&
        !this.connectionInProgress.has(id)
      ) {
        // Check cooldown
        const cooldown = this.connectionCooldowns.get(id);
        if (!cooldown || now >= cooldown) {
          unconnected.push(id);
        }
      }
    }
    return unconnected;
  }

  private cleanupDeadPeer(deviceId: string): void {
    const peer = this.connectedPeers.get(deviceId);
    if (peer) {
      peer.disconnectSub?.remove();
      for (const sub of peer.monitorSubs) {
        try { sub.remove(); } catch { /* best effort */ }
      }
      try { peer.device.cancelConnection(); } catch { /* best effort */ }
      this.connectedPeers.delete(deviceId);
    }
  }

  private async disconnectAllPeers(): Promise<void> {
    for (const [, peer] of this.connectedPeers) {
      peer.disconnectSub?.remove();
      for (const sub of peer.monitorSubs) {
        try { sub.remove(); } catch { /* best effort */ }
      }
      try { await peer.device.cancelConnection(); } catch { /* best effort */ }
    }
    this.connectedPeers.clear();
    this.connectionCooldowns.clear();
  }

  // ===========================================================================
  // INCOMING DATA (from both GATT server writes and GATT client notifications)
  // ===========================================================================

  /**
   * Register a listener for incoming data from any GATT channel.
   * Returns unsubscribe function.
   */
  onIncomingData(callback: (deviceId: string, charUUID: string, data: Buffer) => void): () => void {
    this.incomingDataListeners.push(callback);
    return () => {
      this.incomingDataListeners = this.incomingDataListeners.filter(cb => cb !== callback);
    };
  }

  private notifyIncomingData(deviceId: string, charUUID: string, data: Buffer): void {
    for (const listener of [...this.incomingDataListeners]) {
      try {
        listener(deviceId, charUUID, data);
      } catch (e) {
        logger.debug('Incoming data listener error:', e);
      }
    }
  }

  // ===========================================================================
  // BLE SCANNING (using ble-plx)
  // ===========================================================================

  private clearScanFallbackTimer(): void {
    if (this.scanFallbackTimer) {
      clearTimeout(this.scanFallbackTimer);
      this.scanFallbackTimer = null;
    }
  }

  private scheduleScanFallback(): void {
    this.clearScanFallbackTimer();
    this.scanFallbackTimer = setTimeout(() => {
      if (!this.isScanning || this.useBroadScanFallback || !this.manager) {
        return;
      }

      // Only skip fallback if peers were discovered RECENTLY (within 60s).
      // CRITICAL FIX: Use AND instead of OR — stale peers in foundPeers Map
      // (discovered long ago) should NOT suppress the broad scan fallback.
      // The condition must check that peers exist AND were discovered recently.
      const recentThreshold = Date.now() - 60000;
      if (this.foundPeers.size > 0 && this.lastPeerDiscoveredAt > recentThreshold) {
        return;
      }

      logger.warn('No peers discovered with UUID-filtered scan; switching to broad BLE scan fallback');
      this.restartWithBroadScanFallback().catch((error) => {
        logger.warn('Broad scan fallback restart failed:', error);
      });
    }, 12000);
  }

  private async restartWithBroadScanFallback(): Promise<void> {
    if (!this.manager || !this.isScanning || this.useBroadScanFallback) {
      return;
    }

    try {
      this.manager.stopDeviceScan();
    } catch {
      // best effort
    }

    this.isScanning = false;
    this.useBroadScanFallback = true;
    await this.startScanning(true);
  }

  async startScanning(forceBroadScan = false) {
    if (this.isScanning || !this.manager) return;

    const state = await this.manager.state();
    if (state !== 'PoweredOn') {
      logger.warn('Bluetooth not powered on');
      return;
    }

    this.useBroadScanFallback = forceBroadScan;
    this.isScanning = true;
    logger.info(`BLE Scanning Started (${forceBroadScan ? 'broad fallback' : 'service filtered'})`);

    const scanFilter = forceBroadScan ? null : [AFETNET_SERVICE_UUID];
    try {
      this.manager.startDeviceScan(
        scanFilter,
        { allowDuplicates: true },
        (error: any, device: any) => {
          if (error) {
            // görev #19: Geçici tarama hatasında durmuyoruz — sınırlı backoff
            // ile yeniden deneme planlıyoruz. Eskiden burada return ediliyordu
            // ve keşif bir sonraki BT toggle'a kadar ölüyordu.
            logger.warn('Scan error — scheduling bounded retry:', error);
            this.isScanning = false;
            this.clearScanFallbackTimer();
            this.scheduleScanRetry(forceBroadScan);
            return;
          }
          if (device) this.processDiscoveredDevice(device);
        },
      );
    } catch (e) {
      logger.warn('startDeviceScan threw — scheduling bounded retry:', e);
      this.isScanning = false;
      this.clearScanFallbackTimer();
      this.scheduleScanRetry(forceBroadScan);
      return;
    }

    // görev #19: Tarama başarıyla kuruldu — retry sayacını sıfırla ve dualMode
    // isteniyorsa watchdog'u çalıştır (tarama beklenmedik şekilde düşerse re-arm).
    this.scanRetryAttempt = 0;
    this.clearScanRetryTimer();
    if (this.dualModeRequested) {
      this.startScanWatchdog();
    }

    if (!forceBroadScan) {
      this.scheduleScanFallback();
    } else {
      this.clearScanFallbackTimer();
    }
  }

  stopScanning() {
    this.clearScanFallbackTimer();
    // görev #19: Bilinçli durdurmada retry/watchdog timer'larını da temizle —
    // aksi halde watchdog stopScanning sonrası taramayı tekrar başlatır.
    this.clearScanRetryTimer();
    this.stopScanWatchdog();
    this.scanRetryAttempt = 0;
    if (this.manager) {
      this.manager.stopDeviceScan();
    }
    this.isScanning = false;
    this.useBroadScanFallback = false;
    logger.info('BLE Scanning Stopped');
  }

  // görev #19: Tarama hatası sonrası sınırlı üstel backoff ile yeniden deneme.
  // dualMode istenmiyorsa veya manager yoksa planlama yapılmaz.
  private scheduleScanRetry(forceBroadScan: boolean): void {
    this.clearScanRetryTimer();
    if (!this.manager || !this.dualModeRequested) {
      return;
    }
    if (this.scanRetryAttempt >= HighPerformanceBle.MAX_SCAN_RETRY_ATTEMPTS) {
      // Backoff tükendi — watchdog uzun aralıkta yeniden denemeyi sürdürür.
      logger.warn('Scan retry attempts exhausted; watchdog will keep retrying');
      if (this.dualModeRequested) this.startScanWatchdog();
      return;
    }
    const attempt = this.scanRetryAttempt;
    this.scanRetryAttempt += 1;
    // 2s, 4s, 8s, ... 64s cap
    const delay = Math.min(
      HighPerformanceBle.SCAN_RETRY_BASE_MS * Math.pow(2, attempt),
      64000,
    );
    logger.info(`BLE scan retry ${attempt + 1}/${HighPerformanceBle.MAX_SCAN_RETRY_ATTEMPTS} in ${delay}ms`);
    this.scanRetryTimer = setTimeout(() => {
      this.scanRetryTimer = null;
      if (this.isScanning || !this.dualModeRequested) return;
      this.startScanning(forceBroadScan).catch((e) => {
        logger.warn('BLE scan retry failed:', e);
      });
    }, delay);
  }

  private clearScanRetryTimer(): void {
    if (this.scanRetryTimer) {
      clearTimeout(this.scanRetryTimer);
      this.scanRetryTimer = null;
    }
  }

  // görev #19: Watchdog — dualMode isteniyorken tarama düşmüşse yeniden başlat.
  // Backoff tükense bile keşif kalıcı olarak ölmez.
  private startScanWatchdog(): void {
    if (this.scanWatchdogTimer) return;
    this.scanWatchdogTimer = setInterval(() => {
      if (!this.dualModeRequested) {
        this.stopScanWatchdog();
        return;
      }
      if (this.isScanning || this.scanRetryTimer) return;
      // Tarama düşmüş ve bekleyen retry yok — yeniden silahlandır.
      logger.warn('Scan watchdog: scanning is down while dual mode requested — re-arming');
      this.scanRetryAttempt = 0;
      this.startScanning(this.useBroadScanFallback).catch((e) => {
        logger.warn('Scan watchdog re-arm failed:', e);
      });
    }, HighPerformanceBle.SCAN_WATCHDOG_INTERVAL_MS);
  }

  private stopScanWatchdog(): void {
    if (this.scanWatchdogTimer) {
      clearInterval(this.scanWatchdogTimer);
      this.scanWatchdogTimer = null;
    }
  }

  private processDiscoveredDevice(device: any) {
    const normalizedServiceUuid = AFETNET_SERVICE_UUID.toLowerCase();
    // Check all possible UUID surfaces from ble-plx device payload.
    // On some devices, `serviceUUIDs` can be null even when the scan itself was
    // filtered by service UUID. We must not hard-drop those peers.
    const serviceUUIDs: string[] = Array.isArray(device?.serviceUUIDs) ? device.serviceUUIDs : [];
    const solicitedServiceUUIDs: string[] = Array.isArray(device?.solicitedServiceUUIDs)
      ? device.solicitedServiceUUIDs
      : [];
    const serviceDataKeys: string[] = device?.serviceData && typeof device.serviceData === 'object'
      ? Object.keys(device.serviceData)
      : [];
    const hasAfetNetService =
      serviceUUIDs.some((uuid: string) => uuid?.toLowerCase?.() === normalizedServiceUuid)
      || solicitedServiceUUIDs.some((uuid: string) => uuid?.toLowerCase?.() === normalizedServiceUuid)
      || serviceDataKeys.some((uuid: string) => uuid?.toLowerCase?.() === normalizedServiceUuid);

    // Also check manufacturer data for legacy compatibility
    const rawManufacturerData = device?.manufacturerData;
    let manufacturerDataHex = '';

    if (rawManufacturerData && typeof rawManufacturerData === 'string') {
      try {
        const payloadBuffer = Buffer.from(rawManufacturerData, 'base64');
        if (payloadBuffer.length >= 2) {
          const companyId = payloadBuffer.readUInt16LE(0);
          if (companyId === MANUFACTURER_ID) {
            const meshPayloadBuffer = payloadBuffer.subarray(2);
            manufacturerDataHex = meshPayloadBuffer.toString('hex');
          }
        }
      } catch {
        // Invalid manufacturer data
      }
    }

    const localName = typeof device?.localName === 'string' ? device.localName : '';
    const deviceName = typeof device?.name === 'string' ? device.name : '';
    const hasAfetNetName =
      localName.toLowerCase().startsWith('afetnet')
      || deviceName.toLowerCase().startsWith('afetnet');
    const discoveredDuringFilteredScan = !this.useBroadScanFallback;
    const hasTrustedAfetNetSignature =
      hasAfetNetService
      || !!manufacturerDataHex
      // Filtered scan callbacks are already pre-filtered by AFETNET_SERVICE_UUID.
      || discoveredDuringFilteredScan
      // Broad fallback must still be scoped; local name is the safest available hint.
      || (this.useBroadScanFallback && hasAfetNetName);

    // Must have at least one trusted AfetNet signature
    if (!hasTrustedAfetNetSignature) {
      return;
    }

    // Verify manufacturer data has AfetNet magic byte (if present)
    if (manufacturerDataHex && !manufacturerDataHex.startsWith('af')) {
      if (!hasAfetNetService) return;
      manufacturerDataHex = ''; // Clear invalid manufacturer data
    }

    const now = Date.now();
    this.lastPeerDiscoveredAt = now;
    const peer: BlePeer = {
      id: device.id,
      rssi: device.rssi || -100,
      manufacturerData: manufacturerDataHex || undefined,
      lastSeen: now,
    };

    this.foundPeers.set(device.id, peer);

    // Evict stale peers (> 5 min old) to free BLE connection slots and memory
    if (this.foundPeers.size > 20) {
      const staleThreshold = now - 5 * 60 * 1000;
      for (const [peerId, p] of this.foundPeers) {
        if (p.lastSeen < staleThreshold) this.foundPeers.delete(peerId);
      }
    }

    this.clearScanFallbackTimer();

    // Notify listeners (MeshNetworkService handles peer tracking)
    [...this.scanListeners].forEach(listener => listener(peer));

    // Auto-connect GATT client to discovered AfetNet peer
    if (hasTrustedAfetNetSignature && !this.connectedPeers.has(device.id) && !this.connectionInProgress.has(device.id)) {
      this.connectToPeer(device.id).catch(e => { if (__DEV__) logger.debug('BLE: auto-connect to peer failed:', e); });
    }
  }

  onPeerFound(callback: (peer: BlePeer) => void) {
    this.scanListeners.push(callback);
  }

  removePeerFoundListener(callback: (peer: BlePeer) => void) {
    this.scanListeners = this.scanListeners.filter(l => l !== callback);
  }

  // ===========================================================================
  // LEGACY: startAdvertising (backward compatibility for MeshNetworkService heartbeat)
  // In the new architecture, advertising is handled by startPeripheral().
  // This method is kept to avoid breaking the heartbeat logic in MeshNetworkService,
  // but now it just updates the advertisement data (not the full restart cycle).
  // ===========================================================================

  async startAdvertising(payload: Uint8Array): Promise<boolean> {
    if (!this.peripheralRunning) {
      // If peripheral isn't started yet, try starting it
      await this.startPeripheral();
    }

    if (this.peripheralRunning && AfetNetPeripheral) {
      // FIX: Enforce 31-byte BLE advertisement limit (same as updateAdvertisementData).
      // Android silently fails with ADVERTISE_FAILED_DATA_TOO_LARGE if exceeded.
      if (payload.length > MAX_ADVERTISING_DATA) {
        if (__DEV__) logger.warn(`startAdvertising: payload too large: ${payload.length} > ${MAX_ADVERTISING_DATA} bytes, skipping`);
        return false;
      }
      try {
        const hexData = Buffer.from(payload).toString('hex');
        AfetNetPeripheral.updateAdvertisementData(hexData);
        this.isAdvertising = true;
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  async stopAdvertising() {
    // In the new architecture, advertising is tied to the peripheral lifecycle.
    // Stop the full peripheral to stop advertising.
    this.isAdvertising = false;
    await this.stopPeripheral();
  }

  // ===========================================================================
  // PERMISSIONS
  // ===========================================================================

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const permissions: string[] = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      if (Platform.Version >= 31) {
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        );
      }
      const results = await PermissionsAndroid.requestMultiple(permissions as any);
      const allGranted = Object.values(results).every(
        r => r === PermissionsAndroid.RESULTS.GRANTED
      );
      if (!allGranted) {
        logger.warn('BLE permissions denied on Android — mesh networking unavailable');
      }
      return allGranted;
    }

    if (Platform.OS === 'ios') {
      if (!this.manager) {
        logger.warn('BLE manager not available on iOS — returning false');
        return false;
      }
      try {
        const state = await this.manager.state();
        if (state === 'Unauthorized') {
          logger.warn('BLE permission denied on iOS — mesh networking unavailable');
          return false;
        }
        if (state !== 'PoweredOn') {
          logger.warn(`BLE state on iOS: ${state} — mesh may not work`);
          return state !== 'Unauthorized';
        }
        return true;
      } catch {
        logger.warn('BLE state check failed on iOS — returning false');
        return false;
      }
    }
    return true;
  }

  // ===========================================================================
  // DIAGNOSTICS
  // ===========================================================================

  async getDiagnostics(): Promise<{
    bleManagerAvailable: boolean;
    peripheralModuleAvailable: boolean;
    bluetoothState: string;
    bluetoothPoweredOn: boolean;
    isScanning: boolean;
    scanMode: 'filtered' | 'broad_fallback' | 'stopped';
    isAdvertising: boolean;
    dualModeRequested: boolean;
    knownPeerCount: number;
    lastPeerDiscoveredAt: number | null;
    connectedGATTPeers: number;
    gattServerRunning: boolean;
  }> {
    let bluetoothState = 'unavailable';
    if (this.manager) {
      try {
        bluetoothState = await this.manager.state();
      } catch {
        bluetoothState = 'unknown';
      }
    }

    return {
      bleManagerAvailable: !!this.manager,
      peripheralModuleAvailable: !!AfetNetPeripheral,
      bluetoothState,
      bluetoothPoweredOn: bluetoothState === 'PoweredOn',
      isScanning: this.isScanning,
      scanMode: this.isScanning
        ? (this.useBroadScanFallback ? 'broad_fallback' : 'filtered')
        : 'stopped',
      isAdvertising: this.isAdvertising,
      dualModeRequested: this.dualModeRequested,
      knownPeerCount: this.foundPeers.size,
      lastPeerDiscoveredAt: this.lastPeerDiscoveredAt > 0 ? this.lastPeerDiscoveredAt : null,
      connectedGATTPeers: this.connectedPeers.size,
      gattServerRunning: this.peripheralRunning,
    };
  }
}

export const highPerformanceBle = new HighPerformanceBle();
export default highPerformanceBle;
