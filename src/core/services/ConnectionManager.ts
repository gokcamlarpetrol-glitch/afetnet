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
  private _isConnected: boolean = false;
  private _isInternetReachable: boolean = false;
  private _connectionType: string | null = null;
  private listeners: ((mode: ConnectionMode) => void)[] = [];
  // ELITE: Track NetInfo subscription for cleanup
  private netInfoSubscription: NetInfoSubscription | null = null;

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring() {
    this.netInfoSubscription = NetInfo.addEventListener((state: NetInfoState) => {
      const prevMode = this.getConnectionMode();

      this._isConnected = state.isConnected ?? false;
      this._isInternetReachable = state.isInternetReachable ?? false;
      this._connectionType = state.type;

      const newMode = this.getConnectionMode();

      if (prevMode !== newMode) {
        logger.info(`Connection Mode Changed: ${prevMode} -> ${newMode} (${state.type})`);
        this.notifyListeners(newMode);

        // Auto-manage Mesh Service based on connectivity?
        // Strategy: Always keep Mesh ready, but prioritize Internet for heavy tasks.
      }
    });
  }

  /**
     * Get the current high-level connection mode
     */
  getConnectionMode(): ConnectionMode {
    if (this._isConnected && this._isInternetReachable) {
      return 'ONLINE';
    }
    // If no internet, check if Mesh Service is active/running
    // (Assuming MeshService is always 'available' as an offline fallback if enabled)
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
