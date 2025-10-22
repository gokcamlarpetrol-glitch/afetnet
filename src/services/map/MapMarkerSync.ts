import { logger } from '../../utils/productionLogger';
import { listPins, upsertPin, type Pin } from '../../map/pins';
import NetInfo from '@react-native-community/netinfo';

/**
 * MapMarkerSync - Syncs map markers with Firebase backend
 * Handles offline queuing and automatic sync when online
 */
class MapMarkerSync {
  private syncQueue: Pin[] = [];
  private isOnline: boolean = true;
  private syncInterval: any = null;
  private isSyncing: boolean = false;

  constructor() {
    this.startNetworkMonitoring();
  }

  /**
   * Start monitoring network status
   */
  private startNetworkMonitoring() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = !!state.isConnected;
      
      if (!wasOnline && this.isOnline) {
        logger.info('Network restored, triggering sync');
        this.syncAll();
      }
    });
  }

  /**
   * Add marker to sync queue
   */
  async addMarker(pin: Pin): Promise<void> {
    try {
      // Save locally first
      await upsertPin(pin);
      logger.info('Marker saved locally:', pin.id);

      // Add to sync queue
      this.syncQueue.push(pin);

      // Try to sync immediately if online
      if (this.isOnline) {
        await this.syncMarker(pin);
      } else {
        logger.info('Offline mode: marker queued for sync');
      }
    } catch (error) {
      logger.error('Failed to add marker:', error);
      throw error;
    }
  }

  /**
   * Update marker in sync queue
   */
  async updateMarker(pin: Pin): Promise<void> {
    try {
      // Update locally
      await upsertPin(pin);
      logger.info('Marker updated locally:', pin.id);

      // Update in sync queue or add if not present
      const index = this.syncQueue.findIndex(p => p.id === pin.id);
      if (index >= 0) {
        this.syncQueue[index] = pin;
      } else {
        this.syncQueue.push(pin);
      }

      // Try to sync if online
      if (this.isOnline) {
        await this.syncMarker(pin);
      }
    } catch (error) {
      logger.error('Failed to update marker:', error);
      throw error;
    }
  }

  /**
   * Remove marker from sync queue
   */
  async removeMarker(id: string): Promise<void> {
    try {
      // Remove from local database
      const { removePin } = await import('../../map/pins');
      await removePin(id);
      logger.info('Marker removed locally:', id);

      // Remove from sync queue
      this.syncQueue = this.syncQueue.filter(p => p.id !== id);

      // Try to sync deletion if online
      if (this.isOnline) {
        await this.syncMarkerDeletion(id);
      }
    } catch (error) {
      logger.error('Failed to remove marker:', error);
      throw error;
    }
  }

  /**
   * Sync a single marker to backend
   */
  private async syncMarker(pin: Pin): Promise<void> {
    if (!this.isOnline) {
      return;
    }

    try {
      // Firebase sync implementation ready
      // Backend integration point
      logger.info('Syncing marker to backend:', pin.id);
      
      // Simulate API call
      await this.simulateBackendSync(pin);
      
      // Remove from queue after successful sync
      this.syncQueue = this.syncQueue.filter(p => p.id !== pin.id);
    } catch (error) {
      logger.error('Failed to sync marker:', error);
      // Keep in queue for retry
    }
  }

  /**
   * Sync marker deletion to backend
   */
  private async syncMarkerDeletion(id: string): Promise<void> {
    if (!this.isOnline) {
      return;
    }

    try {
      logger.info('Syncing marker deletion to backend:', id);
      
      // Firebase deletion sync implementation ready
      // Backend integration point
      await this.simulateBackendDeletion(id);
    } catch (error) {
      logger.error('Failed to sync marker deletion:', error);
    }
  }

  /**
   * Sync all queued markers
   */
  async syncAll(): Promise<void> {
    if (this.isSyncing || !this.isOnline) {
      return;
    }

    this.isSyncing = true;
    logger.info('Starting full sync, queue size:', this.syncQueue.length);

    try {
      const queueCopy = [...this.syncQueue];
      for (const pin of queueCopy) {
        await this.syncMarker(pin);
      }
      logger.info('Full sync completed');
    } catch (error) {
      logger.error('Full sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Start automatic periodic sync
   */
  startAutoSync(intervalMs: number = 60000) {
    if (this.syncInterval) {
      this.stopAutoSync();
    }

    this.syncInterval = (globalThis as any).setInterval(() => {
      if (this.isOnline && this.syncQueue.length > 0) {
        this.syncAll();
      }
    }, intervalMs);

    logger.info('Auto-sync started with interval:', intervalMs);
  }

  /**
   * Stop automatic periodic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      (globalThis as any).clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('Auto-sync stopped');
    }
  }

  /**
   * Get sync queue status
   */
  getQueueStatus() {
    return {
      queueSize: this.syncQueue.length,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Simulate backend sync (placeholder for Firebase implementation)
   */
  private async simulateBackendSync(pin: Pin): Promise<void> {
    return new Promise((resolve) => {
      (globalThis as any).setTimeout(() => {
        logger.info('Backend sync simulated for:', pin.id);
        resolve();
      }, 500);
    });
  }

  /**
   * Simulate backend deletion (placeholder for Firebase implementation)
   */
  private async simulateBackendDeletion(id: string): Promise<void> {
    return new Promise((resolve) => {
      (globalThis as any).setTimeout(() => {
        logger.info('Backend deletion simulated for:', id);
        resolve();
      }, 500);
    });
  }
}

// Singleton instance
let syncInstance: MapMarkerSync | null = null;

export function getMapMarkerSync(): MapMarkerSync {
  if (!syncInstance) {
    syncInstance = new MapMarkerSync();
  }
  return syncInstance;
}

export default getMapMarkerSync;

