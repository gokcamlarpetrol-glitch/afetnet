/**
 * CONNECTION MANAGER
 * Central source of truth for app's connectivity state.
 * Detects:
 * - Internet (Wi-Fi/Cellular) via NetInfo
 * - Mesh Availability via MeshNetworkService
 * - Backend Reachability (Ping)
 */

import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { createLogger } from '../utils/logger';
import { meshNetworkService } from './mesh/MeshNetworkService';

const logger = createLogger('ConnectionManager');

export type ConnectionMode = 'ONLINE' | 'MESH' | 'DISCONNECTED';

class ConnectionManager {
  private _isConnected: boolean = true;
  private _isInternetReachable: boolean | null = null;
  private _connectionType: string | null = null;
  private listeners: ((mode: ConnectionMode) => void)[] = [];
  // ELITE: Track NetInfo subscription for cleanup
  private netInfoSubscription: NetInfoSubscription | null = null;

  constructor() {
    // startMonitoring called lazily on first getConnectionMode() or explicitly via initialize()
  }

  initialize() {
    if (this.netInfoSubscription) return; // Already started
    this.startMonitoring();
  }

  private startMonitoring() {
    NetInfo.fetch().then((state: NetInfoState) => {
      this._isConnected = state.isConnected ?? true;
      this._isInternetReachable = state.isInternetReachable;
      this._connectionType = state.type;

      // ELITE FIX: Ensure Mesh starts immediately if app boots up offline
      const currentMode = this.getConnectionMode();
      if (currentMode === 'MESH' || currentMode === 'DISCONNECTED') {
        this.autoStartMeshNetwork().catch(e => { if (__DEV__) logger.debug('Mesh auto-start rejected:', e); });
      }
    }).catch(e => {
      // Assume online until proven otherwise
      if (__DEV__) logger.debug('NetInfo initial fetch failed:', e);
    });

    this.netInfoSubscription = NetInfo.addEventListener((state: NetInfoState) => {
      const prevMode = this.getConnectionMode();

      this._isConnected = state.isConnected ?? true;
      this._isInternetReachable = state.isInternetReachable;
      this._connectionType = state.type;

      const newMode = this.getConnectionMode();

      if (prevMode !== newMode) {
        logger.info(`Connection Mode Changed: ${prevMode} -> ${newMode} (${state.type})`);

        // ELITE FIX: Auto-start Mesh when moving to offline states
        // Without this, receiving devices never start listening for BLE packets!
        if (newMode === 'MESH' || newMode === 'DISCONNECTED') {
          this.autoStartMeshNetwork().catch(e => { if (__DEV__) logger.debug('Mesh auto-start rejected:', e); });
        }

        this.notifyListeners(newMode);
      }
    });
  }

  /**
   * ELITE FIX: Auto-start mesh networking to guarantee message reception
   * when the device drops off the standard internet/wifi network.
   */
  private async autoStartMeshNetwork() {
    if (!meshNetworkService.getIsRunning()) {
      logger.info('🛜 Auto-starting MeshNetworkService due to offline state drop');
      try {
        await meshNetworkService.start();
        logger.info('✅ Mesh auto-started successfully');
      } catch (err) {
        logger.error('❌ Mesh auto-start failed:', err);
      }
    }
  }

  /**
     * Get the current high-level connection mode.
     * CRITICAL: isInternetReachable is often null on iOS (unknown state).
     * Treat null as ONLINE (optimistic) — Firestore handles offline queuing
     * automatically. The old behavior (null → false → MESH) silently blocked
     * ALL cloud message writes, breaking messaging completely.
     */
  getConnectionMode(): ConnectionMode {
    // If connected AND reachable (or reachability unknown), assume ONLINE.
    // Only go to MESH/DISCONNECTED when we KNOW we're offline.
    if (this._isConnected && this._isInternetReachable !== false) {
      return 'ONLINE';
    }
    if (this._isConnected) {
      // Connected but explicitly not reachable — try mesh
      return 'MESH';
    }
    // Truly disconnected — no WiFi/Cellular
    return 'DISCONNECTED';
  }

  get isOnline(): boolean {
    return this.getConnectionMode() === 'ONLINE';
  }

  /**
     * More detailed network info
     */
  getNetworkState() {
    return {
      connected: this._isConnected,
      reachable: this._isInternetReachable,
      type: this._connectionType,
      mode: this.getConnectionMode(),
    };
  }

  subscribe(listener: (mode: ConnectionMode) => void) {
    this.listeners.push(listener);
    // Emit initial state
    listener(this.getConnectionMode());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(mode: ConnectionMode) {
    for (const l of [...this.listeners]) {
      try {
        l(mode);
      } catch (e) {
        logger.error('Connection listener threw:', e);
      }
    }
  }

  /**
   * ELITE: Cleanup resources - call on app shutdown
   */
  destroy(): void {
    if (this.netInfoSubscription) {
      this.netInfoSubscription();
      this.netInfoSubscription = null;
    }
    this.listeners = [];
    logger.info('ConnectionManager destroyed');
  }

  /**
   * Re-initialize NetInfo monitoring after destroy().
   * Must be called on re-login to restore online/offline detection.
   */
  reinitialize(): void {
    if (!this.netInfoSubscription) {
      this.startMonitoring();
      logger.info('ConnectionManager re-initialized');
    }
  }
}

export const connectionManager = new ConnectionManager();
