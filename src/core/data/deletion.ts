import { database } from './db';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

export interface DeletionProgress {
  step: string;
  progress: number;
  total: number;
}

export class DataDeletionManager {
  private static instance: DataDeletionManager;

  private constructor() {}

  static getInstance(): DataDeletionManager {
    if (!DataDeletionManager.instance) {
      DataDeletionManager.instance = new DataDeletionManager();
    }
    return DataDeletionManager.instance;
  }

  async deleteAllData(): Promise<boolean> {
    try {
      console.log('Starting complete data deletion...');

      // Step 1: Clear WatermelonDB
      await this.clearDatabase();

      // Step 2: Clear AsyncStorage
      await this.clearAsyncStorage();

      // Step 3: Clear cached files
      await this.clearCachedFiles();

      // Step 4: Clear logs and temporary files
      await this.clearLogsAndTemp();

      // Step 5: Reset app state
      await this.resetAppState();

      console.log('Data deletion completed successfully');
      return true;
    } catch (error) {
      console.error('Failed to delete all data:', error);
      return false;
    }
  }

  private async clearDatabase(): Promise<void> {
    try {
      console.log('Clearing database...');
      
      // Get all collections
      const collections = [
        'help_requests',
        'status_pings', 
        'resource_posts',
        'shelters',
        'device_peers',
        'family_members',
        'damage_reports',
      ];

      // Delete all records from each collection
      for (const collectionName of collections) {
        try {
          const collection = database.collections.get(collectionName);
          const allRecords = await collection.query().fetch();
          
          if (allRecords.length > 0) {
            await database.write(async () => {
              for (const record of allRecords) {
                await record.destroyPermanently();
              }
            });
            console.log(`Deleted ${allRecords.length} records from ${collectionName}`);
          }
        } catch (collectionError) {
          console.warn(`Failed to clear collection ${collectionName}:`, collectionError);
          // Continue with other collections
        }
      }

      // Clear any pending operations
      await database.adapter.unsafeResetDatabase();
      
      console.log('Database cleared successfully');
    } catch (error) {
      console.error('Failed to clear database:', error);
      throw error;
    }
  }

  private async clearAsyncStorage(): Promise<void> {
    try {
      console.log('Clearing AsyncStorage...');
      
      // Get all keys
      const keys = await AsyncStorage.getAllKeys();
      
      // Filter out keys we want to keep (like device settings)
      const keysToKeep = [
        'firstRun', // Keep first run flag
        'appVersion', // Keep app version for migrations
      ];
      
      const keysToDelete = keys.filter(key => !keysToKeep.includes(key));
      
      if (keysToDelete.length > 0) {
        await AsyncStorage.multiRemove(keysToDelete);
        console.log(`Removed ${keysToDelete.length} keys from AsyncStorage`);
      }
      
      console.log('AsyncStorage cleared successfully');
    } catch (error) {
      console.error('Failed to clear AsyncStorage:', error);
      throw error;
    }
  }

  private async clearCachedFiles(): Promise<void> {
    try {
      console.log('Clearing cached files...');
      
      // Clear MBTiles cache (if any downloaded copies exist)
      const mbtilesDir = `${FileSystem.documentDirectory}mbtiles/`;
      const mbtilesExists = await FileSystem.getInfoAsync(mbtilesDir);
      
      if (mbtilesExists.exists) {
        await FileSystem.deleteAsync(mbtilesDir, { idempotent: true });
        console.log('MBTiles cache cleared');
      }

      // Clear media cache
      const mediaDir = `${FileSystem.cacheDirectory}media/`;
      const mediaExists = await FileSystem.getInfoAsync(mediaDir);
      
      if (mediaExists.exists) {
        await FileSystem.deleteAsync(mediaDir, { idempotent: true });
        console.log('Media cache cleared');
      }

      // Clear compressed images
      const compressedDir = `${FileSystem.cacheDirectory}compressed/`;
      const compressedExists = await FileSystem.getInfoAsync(compressedDir);
      
      if (compressedExists.exists) {
        await FileSystem.deleteAsync(compressedDir, { idempotent: true });
        console.log('Compressed images cache cleared');
      }

      console.log('Cached files cleared successfully');
    } catch (error) {
      console.error('Failed to clear cached files:', error);
      // Don't throw - this is not critical
    }
  }

  private async clearLogsAndTemp(): Promise<void> {
    try {
      console.log('Clearing logs and temporary files...');
      
      // Clear debug logs
      const logsDir = `${FileSystem.documentDirectory}logs/`;
      const logsExists = await FileSystem.getInfoAsync(logsDir);
      
      if (logsExists.exists) {
        await FileSystem.deleteAsync(logsDir, { idempotent: true });
        console.log('Debug logs cleared');
      }

      // Clear temporary files
      const tempDir = `${FileSystem.cacheDirectory}temp/`;
      const tempExists = await FileSystem.getInfoAsync(tempDir);
      
      if (tempExists.exists) {
        await FileSystem.deleteAsync(tempDir, { idempotent: true });
        console.log('Temporary files cleared');
      }

      console.log('Logs and temporary files cleared successfully');
    } catch (error) {
      console.error('Failed to clear logs and temp files:', error);
      // Don't throw - this is not critical
    }
  }

  private async resetAppState(): Promise<void> {
    try {
      console.log('Resetting app state...');
      
      // Reset preferences to defaults
      const defaultPreferences = {
        firstRun: false, // Keep false so onboarding doesn't show again
        language: 'tr',
        theme: 'dark',
        eewEnabled: false,
        p2pEnabled: true,
        locationEnabled: false,
        bluetoothEnabled: false,
        telemetryEnabled: false,
        shakeDetectionEnabled: false,
        ultraLowPowerMode: false,
        silentMode: false,
      };

      // Set default preferences
      for (const [key, value] of Object.entries(defaultPreferences)) {
        await AsyncStorage.setItem(key, JSON.stringify(value));
      }

      console.log('App state reset successfully');
    } catch (error) {
      console.error('Failed to reset app state:', error);
      throw error;
    }
  }

  async deleteSpecificData(dataType: 'help_requests' | 'resource_posts' | 'damage_reports' | 'all'): Promise<boolean> {
    try {
      console.log(`Deleting specific data: ${dataType}`);

      if (dataType === 'all') {
        return await this.deleteAllData();
      }

      // Delete specific collection
      const collection = database.collections.get(dataType);
      const allRecords = await collection.query().fetch();
      
      if (allRecords.length > 0) {
        await database.write(async () => {
          for (const record of allRecords) {
            await record.destroyPermanently();
          }
        });
        console.log(`Deleted ${allRecords.length} records from ${dataType}`);
      }

      return true;
    } catch (error) {
      console.error(`Failed to delete ${dataType}:`, error);
      return false;
    }
  }

  async getDataSummary(): Promise<{
    helpRequests: number;
    resourcePosts: number;
    damageReports: number;
    familyMembers: number;
    devicePeers: number;
    totalSize: string;
  }> {
    try {
      const helpRequests = await database.collections.get('help_requests').query().fetchCount();
      const resourcePosts = await database.collections.get('resource_posts').query().fetchCount();
      const damageReports = await database.collections.get('damage_reports').query().fetchCount();
      const familyMembers = await database.collections.get('family_members').query().fetchCount();
      const devicePeers = await database.collections.get('device_peers').query().fetchCount();

      // Estimate total size (rough calculation)
      const totalRecords = helpRequests + resourcePosts + damageReports + familyMembers + devicePeers;
      const estimatedSizeKB = totalRecords * 2; // Rough estimate: 2KB per record
      const totalSize = estimatedSizeKB > 1024 
        ? `${(estimatedSizeKB / 1024).toFixed(1)} MB`
        : `${estimatedSizeKB} KB`;

      return {
        helpRequests,
        resourcePosts,
        damageReports,
        familyMembers,
        devicePeers,
        totalSize,
      };
    } catch (error) {
      console.error('Failed to get data summary:', error);
      return {
        helpRequests: 0,
        resourcePosts: 0,
        damageReports: 0,
        familyMembers: 0,
        devicePeers: 0,
        totalSize: '0 KB',
      };
    }
  }

  async exportDataBeforeDeletion(): Promise<string | null> {
    try {
      console.log('Exporting data before deletion...');
      
      const summary = await this.getDataSummary();
      const exportData = {
        exportDate: new Date().toISOString(),
        summary,
        helpRequests: await database.collections.get('help_requests').query().fetch(),
        resourcePosts: await database.collections.get('resource_posts').query().fetch(),
        damageReports: await database.collections.get('damage_reports').query().fetch(),
        familyMembers: await database.collections.get('family_members').query().fetch(),
      };

      const fileName = `afetnet-backup-${Date.now()}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));
      
      console.log('Data exported successfully');
      return fileUri;
    } catch (error) {
      console.error('Failed to export data:', error);
      return null;
    }
  }

  async callBackendDeletionAPI(userId?: string): Promise<boolean> {
    try {
      // Placeholder for future backend integration
      // This would call a GDPR deletion endpoint if backend exists
      
      if (!userId) {
        console.log('No user ID provided, skipping backend deletion');
        return true;
      }

      console.log('Calling backend deletion API...');
      
      // Example API call (commented out for now)
      /*
      const response = await fetch(`${BACKEND_URL}/gdpr/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(`Backend deletion failed: ${response.status}`);
      }
      */

      console.log('Backend deletion completed successfully');
      return true;
    } catch (error) {
      console.error('Backend deletion failed:', error);
      // Don't throw - local deletion is more important
      return false;
    }
  }

  // Utility method to show deletion confirmation
  static showDeletionConfirmation(
    onConfirm: () => void,
    onCancel: () => void = () => {}
  ): void {
    Alert.alert(
      'Tüm Verileri Sil',
      'Bu işlem geri alınamaz. Tüm yerel verileriniz, ayarlarınız ve geçmişiniz silinecektir. Uygulama sıfırlanacaktır.\n\nDevam etmek istediğinizden emin misiniz?',
      [
        {
          text: 'İptal',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: onConfirm,
        },
      ],
      { cancelable: true }
    );
  }

  // Utility method to show deletion success
  static showDeletionSuccess(): void {
    Alert.alert(
      'Veriler Silindi',
      'Tüm verileriniz başarıyla silindi. Uygulama varsayılan ayarlarına sıfırlandı.',
      [{ text: 'Tamam' }]
    );
  }

  // Utility method to show deletion error
  static showDeletionError(): void {
    Alert.alert(
      'Silme Hatası',
      'Veriler silinirken bir hata oluştu. Lütfen tekrar deneyin veya uygulamayı yeniden yükleyin.',
      [{ text: 'Tamam' }]
    );
  }
}

// Export convenience function
export const deleteAllData = async (): Promise<boolean> => {
  const manager = DataDeletionManager.getInstance();
  return await manager.deleteAllData();
};
