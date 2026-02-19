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
    this.startMonitoring();
  }

  private startMonitoring() {
    NetInfo.fetch().then((state: NetInfoState) => {
      this._isConnected = state.isConnected ?? true;
      this._isInternetReachable = state.isInternetReachable;
      this._connectionType = state.type;
    }).catch(() => {
      // Assume online until proven otherwise
    });

    this.netInfoSubscription = NetInfo.addEventListener((state: NetInfoState) => {
      const prevMode = this.getConnectionMode();

      this._isConnected = state.isConnected ?? true;
      this._isInternetReachable = state.isInternetReachable;
      this._connectionType = state.type;

      const newMode = this.getConnectionMode();

      if (prevMode !== newMode) {
        logger.info(`Connection Mode Changed: ${prevMode} -> ${newMode} (${state.type})`);
        this.notifyListeners(newMode);
      }
    });
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
    return 'MESH';
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
    this.listeners.forEach(l => l(mode));
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
}

export const connectionManager = new ConnectionManager();
