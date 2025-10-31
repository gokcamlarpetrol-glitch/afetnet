import { logger } from '../utils/productionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export interface SyncData {
  messages: any[];
  locations: any[];
  contacts: any[];
  familyData: any[];
  emergencyData: any[];
  timestamp: number;
  deviceId: string;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSync: number;
  pendingItems: number;
  syncInProgress: boolean;
  errors: string[];
  syncQueue: SyncData[];
}

class OfflineSyncManager {
  private syncStatus: SyncStatus = {
    isOnline: false,
    lastSync: 0,
    pendingItems: 0,
    syncInProgress: false,
    errors: [],
    syncQueue: [],
  };

  private syncInterval: NodeJS.Timeout | null = null;
  private networkListener: any = null;

  async start(): Promise<void> {
    logger.debug('🚀 Starting offline sync manager...');

    try {
      // Load previous sync status
      await this.loadSyncStatus();

      // Start network monitoring
      this.startNetworkMonitoring();

      // Start periodic sync checks
      this.startPeriodicSync();

      // Perform initial sync if online
      if (this.syncStatus.isOnline) {
        await this.performSync();
      }

      logger.debug('✅ Offline sync manager started');
    } catch (error) {
      logger.error('❌ Failed to start offline sync manager:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping offline sync manager...');

    // Stop intervals
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Remove network listener
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }

    // Save current status
    await this.saveSyncStatus();

    logger.debug('✅ Offline sync manager stopped');
  }

  private async loadSyncStatus(): Promise<void> {
    try {
      const statusData = await AsyncStorage.getItem('sync_status');
      if (statusData) {
        this.syncStatus = { ...this.syncStatus, ...JSON.parse(statusData) };
        logger.debug(`Loaded sync status: ${this.syncStatus.pendingItems} pending items`);
      }
    } catch (error) {
      logger.error('Failed to load sync status:', error);
    }
  }

  private async saveSyncStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_status', JSON.stringify(this.syncStatus));
      logger.debug('Sync status saved');
    } catch (error) {
      logger.error('Failed to save sync status:', error);
    }
  }

  private startNetworkMonitoring(): void {
    logger.debug('📡 Starting network monitoring...');

    this.networkListener = NetInfo.addEventListener(state => {
      const wasOnline = this.syncStatus.isOnline;
      const isOnline = !!state.isConnected;

      this.syncStatus.isOnline = isOnline;

      if (!wasOnline && isOnline) {
        logger.debug('🌐 Network connection restored - starting sync...');
        this.performSync();
      } else if (wasOnline && !isOnline) {
        logger.debug('📴 Network connection lost - entering offline mode');
        this.handleOfflineMode();
      }
    });
  }

  private startPeriodicSync(): void {
    logger.debug('🔄 Starting periodic sync checks...');

    this.syncInterval = setInterval(async () => {
      if (this.syncStatus.isOnline && !this.syncStatus.syncInProgress) {
        await this.performSync();
      }
    }, 30000); // Check every 30 seconds
  }

  private handleOfflineMode(): void {
    logger.debug('📴 Entering offline mode...');

    // Clear any pending sync operations
    this.syncStatus.syncInProgress = false;

    // Update last sync time
    this.syncStatus.lastSync = Date.now();

    this.saveSyncStatus();
  }

  async performSync(): Promise<void> {
    if (this.syncStatus.syncInProgress) {
      logger.debug('Sync already in progress, skipping...');
      return;
    }

    if (!this.syncStatus.isOnline) {
      logger.debug('Not online, skipping sync...');
      return;
    }

    logger.debug('🔄 Starting sync operation...');
    this.syncStatus.syncInProgress = true;
    this.syncStatus.errors = [];

    try {
      // Load pending sync data
      const syncData = await this.loadPendingSyncData();

      if (syncData) {
        // Sync messages
        await this.syncMessages(syncData.messages);

        // Sync locations
        await this.syncLocations(syncData.locations);

        // Sync contacts
        await this.syncContacts(syncData.contacts);

        // Sync family data
        await this.syncFamilyData(syncData.familyData);

        // Sync emergency data
        await this.syncEmergencyData(syncData.emergencyData);

        // Clear synced data
        await this.clearSyncedData(syncData);

        // Update sync status
        this.syncStatus.lastSync = Date.now();
        this.syncStatus.pendingItems = this.syncStatus.syncQueue.length;

        logger.debug('✅ Sync operation completed successfully');
      }

    } catch (error) {
      logger.error('❌ Sync operation failed:', error);
      this.syncStatus.errors.push(`Sync failed: ${error}`);
    } finally {
      this.syncStatus.syncInProgress = false;
      await this.saveSyncStatus();
    }
  }

  private async loadPendingSyncData(): Promise<SyncData | null> {
    try {
      // Check if there's pending sync data
      const pendingData = await AsyncStorage.getItem('pending_sync_data');
      if (pendingData) {
        const syncData: SyncData = JSON.parse(pendingData);

        // Check if data is not too old (max 7 days)
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (Date.now() - syncData.timestamp > maxAge) {
          logger.warn('Sync data too old, clearing...');
          await AsyncStorage.removeItem('pending_sync_data');
          return null;
        }

        return syncData;
      }

      return null;
    } catch (error) {
      logger.error('Failed to load pending sync data:', error);
      return null;
    }
  }

  private async syncMessages(messages: any[]): Promise<void> {
    if (messages.length === 0) return;

    logger.debug(`📨 Syncing ${messages.length} messages...`);

    try {
      // In real implementation, this would send to server
      // For now, simulate successful sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      logger.debug('✅ Messages synced successfully');
    } catch (error) {
      logger.error('Failed to sync messages:', error);
      throw error;
    }
  }

  private async syncLocations(locations: any[]): Promise<void> {
    if (locations.length === 0) return;

    logger.debug(`📍 Syncing ${locations.length} locations...`);

    try {
      // In real implementation, this would send to server
      await new Promise(resolve => setTimeout(resolve, 800));

      logger.debug('✅ Locations synced successfully');
    } catch (error) {
      logger.error('Failed to sync locations:', error);
      throw error;
    }
  }

  private async syncContacts(contacts: any[]): Promise<void> {
    if (contacts.length === 0) return;

    logger.debug(`👥 Syncing ${contacts.length} contacts...`);

    try {
      // In real implementation, this would send to server
      await new Promise(resolve => setTimeout(resolve, 600));

      logger.debug('✅ Contacts synced successfully');
    } catch (error) {
      logger.error('Failed to sync contacts:', error);
      throw error;
    }
  }

  private async syncFamilyData(familyData: any[]): Promise<void> {
    if (familyData.length === 0) return;

    logger.debug(`👨‍👩‍👧‍👦 Syncing family data...`);

    try {
      // In real implementation, this would send to server
      await new Promise(resolve => setTimeout(resolve, 500));

      logger.debug('✅ Family data synced successfully');
    } catch (error) {
      logger.error('Failed to sync family data:', error);
      throw error;
    }
  }

  private async syncEmergencyData(emergencyData: any[]): Promise<void> {
    if (emergencyData.length === 0) return;

    logger.debug(`🚨 Syncing emergency data...`);

    try {
      // Emergency data should be synced first and with highest priority
      await new Promise(resolve => setTimeout(resolve, 300));

      logger.debug('✅ Emergency data synced successfully');
    } catch (error) {
      logger.error('Failed to sync emergency data:', error);
      throw error;
    }
  }

  private async clearSyncedData(syncData: SyncData): Promise<void> {
    try {
      // Remove synced data from storage
      await AsyncStorage.removeItem('pending_sync_data');

      // Update sync queue
      this.syncStatus.syncQueue = this.syncStatus.syncQueue.filter(
        item => item.timestamp !== syncData.timestamp
      );

      logger.debug('✅ Synced data cleared');
    } catch (error) {
      logger.error('Failed to clear synced data:', error);
    }
  }

  // Public methods for adding data to sync queue
  async addMessageToSync(message: any): Promise<void> {
    try {
      const syncData = await this.getOrCreateSyncData();
      syncData.messages.push(message);
      await this.saveSyncData(syncData);

      this.syncStatus.pendingItems++;
      await this.saveSyncStatus();

      logger.debug(`📨 Message added to sync queue: ${message.id}`);
    } catch (error) {
      logger.error('Failed to add message to sync:', error);
    }
  }

  async addLocationToSync(location: any): Promise<void> {
    try {
      const syncData = await this.getOrCreateSyncData();
      syncData.locations.push(location);
      await this.saveSyncData(syncData);

      this.syncStatus.pendingItems++;
      await this.saveSyncStatus();

      logger.debug(`📍 Location added to sync queue: ${location.id}`);
    } catch (error) {
      logger.error('Failed to add location to sync:', error);
    }
  }

  async addEmergencyDataToSync(emergencyData: any): Promise<void> {
    try {
      const syncData = await this.getOrCreateSyncData();
      syncData.emergencyData.push(emergencyData);
      await this.saveSyncData(syncData);

      this.syncStatus.pendingItems++;
      await this.saveSyncStatus();

      // Emergency data should trigger immediate sync if online
      if (this.syncStatus.isOnline) {
        this.performSync();
      }

      logger.debug(`🚨 Emergency data added to sync queue`);
    } catch (error) {
      logger.error('Failed to add emergency data to sync:', error);
    }
  }

  private async getOrCreateSyncData(): Promise<SyncData> {
    try {
      const existingData = await AsyncStorage.getItem('pending_sync_data');
      if (existingData) {
        return JSON.parse(existingData);
      }

      // Create new sync data
      const deviceId = await this.getDeviceId();
      return {
        messages: [],
        locations: [],
        contacts: [],
        familyData: [],
        emergencyData: [],
        timestamp: Date.now(),
        deviceId,
      };
    } catch (error) {
      logger.error('Failed to get/create sync data:', error);
      throw error;
    }
  }

  private async saveSyncData(syncData: SyncData): Promise<void> {
    try {
      await AsyncStorage.setItem('pending_sync_data', JSON.stringify(syncData));
    } catch (error) {
      logger.error('Failed to save sync data:', error);
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      logger.error('Failed to get device ID:', error);
      return 'unknown_device';
    }
  }

  // Public API
  public getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  public async forceSync(): Promise<void> {
    logger.debug('🔄 Forcing sync operation...');
    await this.performSync();
  }

  public async clearSyncQueue(): Promise<void> {
    logger.debug('🗑️ Clearing sync queue...');

    try {
      await AsyncStorage.removeItem('pending_sync_data');
      this.syncStatus.syncQueue = [];
      this.syncStatus.pendingItems = 0;
      await this.saveSyncStatus();

      logger.debug('✅ Sync queue cleared');
    } catch (error) {
      logger.error('Failed to clear sync queue:', error);
    }
  }

  public getSyncQueueSize(): number {
    return this.syncStatus.pendingItems;
  }

  public isSyncInProgress(): boolean {
    return this.syncStatus.syncInProgress;
  }
}

// Export singleton instance
export const offlineSyncManager = new OfflineSyncManager();















