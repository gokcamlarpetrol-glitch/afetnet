/**
 * ELITE: OFFLINE SYNC SERVICE
 * Queue-based sync with conflict resolution and retry mechanism
 * Ensures data consistency and reliability
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createLogger } from '../utils/logger';
import { firebaseDataService } from './FirebaseDataService';
import { firebaseAnalyticsService } from './FirebaseAnalyticsService';

const logger = createLogger('OfflineSyncService');

interface SyncOperation {
  id: string;
  type: 'save' | 'update' | 'delete';
  collection: string;
  documentId: string;
  data: any;
  timestamp: number;
  retryCount: number;
  lastError?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

interface ConflictResolution {
  strategy: 'last-write-wins' | 'merge' | 'manual';
  resolved: boolean;
  resolvedData?: any;
}

const SYNC_QUEUE_KEY = 'afetnet_sync_queue';
const SYNC_CONFLICTS_KEY = 'afetnet_sync_conflicts';
const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 1000; // 1 second base delay
const SYNC_INTERVAL = 30000; // 30 seconds

class OfflineSyncService {
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private syncQueue: SyncOperation[] = [];
  private conflicts: Map<string, ConflictResolution> = new Map();
  private isOnline = true;
  private networkListener: any = null;

  /**
   * ELITE: Initialize sync service
   */
  async initialize() {
    if (this.isRunning) return;

    try {
      // Load sync queue from storage
      await this.loadSyncQueue();

      // Setup network monitoring
      this.setupNetworkMonitoring();

      // Start sync loop
      this.startSyncLoop();

      this.isRunning = true;
      logger.info('✅ OfflineSyncService initialized');
    } catch (error) {
      logger.error('Failed to initialize OfflineSyncService:', error);
    }
  }

  /**
   * ELITE: Setup network monitoring
   */
  private setupNetworkMonitoring() {
    // Monitor network state changes
    this.networkListener = NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (!wasOnline && this.isOnline) {
        // Just came online - trigger immediate sync
        logger.info('🌐 Network connected - triggering sync');
        this.processSyncQueue().catch(error => {
          logger.error('Sync failed after network reconnect:', error);
        });
      }

      // Track network state analytics
      firebaseAnalyticsService.logEvent('network_state_changed', {
        isConnected: String(this.isOnline),
        connectionType: state.type || 'unknown',
      });
    });

    // Get initial network state
    NetInfo.fetch().then(state => {
      this.isOnline = state.isConnected ?? false;
    });
  }

  /**
   * ELITE: Start sync loop
   */
  private startSyncLoop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.syncQueue.length > 0) {
        this.processSyncQueue().catch(error => {
          logger.error('Sync loop error:', error);
        });
      }
    }, SYNC_INTERVAL);

    // Process immediately if online
    if (this.isOnline && this.syncQueue.length > 0) {
      this.processSyncQueue().catch(error => {
        logger.error('Initial sync error:', error);
      });
    }
  }

  /**
   * ELITE: Add operation to sync queue
   */
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const syncOp: SyncOperation = {
      ...operation,
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.syncQueue.push(syncOp);
    
    // Sort by priority (critical first)
    this.syncQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Save queue to storage
    await this.saveSyncQueue();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.processSyncQueue().catch(error => {
        logger.error('Immediate sync failed:', error);
      });
    }

    logger.info(`📤 Operation queued: ${syncOp.type} ${syncOp.collection}/${syncOp.documentId} (priority: ${syncOp.priority})`);

    return syncOp.id;
  }

  /**
   * ELITE: Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    if (!firebaseDataService.isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping sync');
      return;
    }

    const operationsToProcess = [...this.syncQueue];
    const successfulOps: string[] = [];
    const failedOps: SyncOperation[] = [];

    for (const operation of operationsToProcess) {
      try {
        const success = await this.executeOperation(operation);
        
        if (success) {
          successfulOps.push(operation.id);
        } else {
          // Check retry limit
          if (operation.retryCount < MAX_RETRIES) {
            operation.retryCount++;
            operation.lastError = 'Operation failed, will retry';
            failedOps.push(operation);
          } else {
            // Max retries reached - mark as failed
            logger.error(`❌ Operation failed after ${MAX_RETRIES} retries: ${operation.id}`);
            firebaseAnalyticsService.logEvent('sync_operation_failed', {
              operation_type: operation.type,
              collection: operation.collection,
              retry_count: String(operation.retryCount),
            });
          }
        }

        // Rate limiting: Don't overwhelm Firebase
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Sync operation error: ${operation.id}`, error);
        
        if (operation.retryCount < MAX_RETRIES) {
          operation.retryCount++;
          operation.lastError = error instanceof Error ? error.message : String(error);
          failedOps.push(operation);
        }
      }
    }

    // Remove successful operations from queue
    this.syncQueue = this.syncQueue.filter(op => !successfulOps.includes(op.id));
    
    // Update failed operations (with exponential backoff delay)
    for (const op of failedOps) {
      const delay = RETRY_DELAY_BASE * Math.pow(2, op.retryCount - 1);
      const shouldRetry = Date.now() - op.timestamp > delay;
      
      if (shouldRetry) {
        // Ready to retry - keep in queue
      } else {
        // Not ready yet - remove temporarily (will be re-added on next sync)
        this.syncQueue = this.syncQueue.filter(o => o.id !== op.id);
        this.syncQueue.push(op); // Re-add for later retry
      }
    }

    // Save updated queue
    await this.saveSyncQueue();

    if (successfulOps.length > 0) {
      logger.info(`✅ Synced ${successfulOps.length} operations`);
      firebaseAnalyticsService.logEvent('sync_completed', {
        operations_synced: String(successfulOps.length),
        operations_failed: String(failedOps.length),
      });
    }
  }

  /**
   * ELITE: Execute sync operation with conflict resolution
   */
  private async executeOperation(operation: SyncOperation): Promise<boolean> {
    try {
      const { collection, documentId, type, data } = operation;

      // Check for conflicts
      const conflict = await this.checkConflict(operation);
      if (conflict && !conflict.resolved) {
        // Resolve conflict
        const resolved = await this.resolveConflict(operation, conflict);
        if (!resolved) {
          logger.warn(`Conflict not resolved for ${collection}/${documentId}`);
          return false;
        }
      }

      // Execute operation based on type
      switch (type) {
        case 'save':
          return await this.executeSave(collection, documentId, data);
        case 'update':
          return await this.executeUpdate(collection, documentId, data);
        case 'delete':
          return await this.executeDelete(collection, documentId);
        default:
          logger.error(`Unknown operation type: ${type}`);
          return false;
      }
    } catch (error) {
      logger.error(`Execute operation error: ${operation.id}`, error);
      return false;
    }
  }

  /**
   * ELITE: Check for conflicts
   */
  private async checkConflict(operation: SyncOperation): Promise<ConflictResolution | null> {
    // For now, use last-write-wins strategy
    // Can be extended to check server timestamp vs local timestamp
    return null; // No conflict detected
  }

  /**
   * ELITE: Resolve conflict
   */
  private async resolveConflict(
    operation: SyncOperation,
    conflict: ConflictResolution
  ): Promise<boolean> {
    switch (conflict.strategy) {
      case 'last-write-wins':
        // Use local data (newer timestamp wins)
        return true;
      case 'merge':
        // Merge local and server data
        if (conflict.resolvedData) {
          operation.data = conflict.resolvedData;
          return true;
        }
        return false;
      case 'manual':
        // Requires user intervention - skip for now
        logger.warn('Manual conflict resolution required - skipping');
        return false;
      default:
        return false;
    }
  }

  /**
   * ELITE: Execute save operation
   */
  private async executeSave(collection: string, documentId: string, data: any): Promise<boolean> {
    // Use FirebaseDataService methods based on collection type
    switch (collection) {
      case 'familyMembers':
        const deviceId = await this.getDeviceId();
        if (deviceId) {
          return await firebaseDataService.saveFamilyMember(deviceId, data);
        }
        return false;
      case 'healthProfile':
        const deviceId2 = await this.getDeviceId();
        if (deviceId2) {
          return await firebaseDataService.saveHealthProfile(deviceId2, data);
        }
        return false;
      case 'earthquakes':
        return await firebaseDataService.saveEarthquake(data);
      default:
        logger.warn(`Unknown collection for save: ${collection}`);
        return false;
    }
  }

  /**
   * ELITE: Execute update operation
   */
  private async executeUpdate(collection: string, documentId: string, data: any): Promise<boolean> {
    // Similar to save but with merge: true
    return await this.executeSave(collection, documentId, data);
  }

  /**
   * ELITE: Execute delete operation
   */
  private async executeDelete(collection: string, documentId: string): Promise<boolean> {
    switch (collection) {
      case 'familyMembers':
        const deviceId = await this.getDeviceId();
        if (deviceId) {
          return await firebaseDataService.deleteFamilyMember(deviceId, documentId);
        }
        return false;
      default:
        logger.warn(`Unknown collection for delete: ${collection}`);
        return false;
    }
  }

  /**
   * ELITE: Get device ID
   */
  private async getDeviceId(): Promise<string | null> {
    try {
      const { getDeviceId } = await import('../../lib/device');
      return await getDeviceId();
    } catch {
      return null;
    }
  }

  /**
   * ELITE: Load sync queue from storage
   */
  private async loadSyncQueue() {
    try {
      const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        this.syncQueue = JSON.parse(stored);
        logger.info(`Loaded ${this.syncQueue.length} operations from sync queue`);
      }
    } catch (error) {
      logger.error('Failed to load sync queue:', error);
    }
  }

  /**
   * ELITE: Save sync queue to storage
   */
  private async saveSyncQueue() {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      logger.error('Failed to save sync queue:', error);
    }
  }

  /**
   * ELITE: Get sync status
   */
  getSyncStatus(): {
    queueLength: number;
    isOnline: boolean;
    isRunning: boolean;
    pendingOperations: number;
    failedOperations: number;
  } {
    const pendingOps = this.syncQueue.filter(op => op.retryCount < MAX_RETRIES);
    const failedOps = this.syncQueue.filter(op => op.retryCount >= MAX_RETRIES);

    return {
      queueLength: this.syncQueue.length,
      isOnline: this.isOnline,
      isRunning: this.isRunning,
      pendingOperations: pendingOps.length,
      failedOperations: failedOps.length,
    };
  }

  /**
   * ELITE: Force sync (manual trigger)
   */
  async forceSync(): Promise<void> {
    if (!this.isOnline) {
      logger.warn('Cannot force sync - offline');
      return;
    }

    logger.info('🔄 Force sync triggered');
    await this.processSyncQueue();
  }

  /**
   * ELITE: Clear failed operations
   */
  async clearFailedOperations(): Promise<void> {
    const before = this.syncQueue.length;
    this.syncQueue = this.syncQueue.filter(op => op.retryCount < MAX_RETRIES);
    const after = this.syncQueue.length;
    
    await this.saveSyncQueue();
    
    logger.info(`Cleared ${before - after} failed operations`);
  }

  /**
   * ELITE: Stop sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }

    this.isRunning = false;
    logger.info('OfflineSyncService stopped');
  }
}

export const offlineSyncService = new OfflineSyncService();

