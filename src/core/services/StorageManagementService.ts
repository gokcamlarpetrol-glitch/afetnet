/**
 * STORAGE MANAGEMENT SERVICE
 * Monitors storage space and manages data cleanup
 * Critical for preventing data loss and app crashes
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { createLogger } from '../utils/logger';
import { Alert } from 'react-native';

const logger = createLogger('StorageManagementService');

export interface StorageStats {
  totalSpace: number; // bytes
  freeSpace: number; // bytes
  usedSpace: number; // bytes
  usedPercentage: number;
  asyncStorageSize: number; // bytes
  fileSystemSize: number; // bytes
}

export interface StorageWarning {
  level: 'info' | 'warning' | 'critical';
  message: string;
  freeSpaceMB: number;
  usedPercentage: number;
}

// Storage thresholds
const CRITICAL_THRESHOLD = 0.95; // 95% full
const WARNING_THRESHOLD = 0.85; // 85% full
const MIN_FREE_SPACE_MB = 50; // Minimum 50MB free

// Data priorities (higher = more important)
const DATA_PRIORITIES = {
  earthquakes: 10,
  family: 9,
  userStatus: 9,
  messages: 8,
  settings: 8,
  aiCache: 5,
  news: 3,
  offlineMaps: 2,
};

class StorageManagementService {
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastWarningTime = 0;
  private readonly WARNING_COOLDOWN = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize storage monitoring
   */
  async initialize() {
    try {
      logger.info('Initializing storage management...');
      
      // Check initial storage
      const stats = await this.getStorageStats();
      logger.info('Initial storage stats:', {
        freeSpaceMB: (stats.freeSpace / 1024 / 1024).toFixed(2),
        usedPercentage: stats.usedPercentage.toFixed(2),
      });

      // Check for warnings
      const warning = this.checkStorageWarning(stats);
      if (warning && warning.level === 'critical') {
        await this.handleCriticalStorage(stats);
      }

      logger.info('Storage management initialized');
    } catch (error) {
      logger.error('Storage management init error:', error);
    }
  }

  /**
   * Start monitoring storage space
   */
  startMonitoring(intervalMs: number = 60000) {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        const stats = await this.getStorageStats();
        const warning = this.checkStorageWarning(stats);

        if (warning) {
          await this.handleStorageWarning(warning, stats);
        }
      } catch (error) {
        logger.error('Storage monitoring error:', error);
      }
    }, intervalMs);

    logger.info('Storage monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    logger.info('Storage monitoring stopped');
  }

  /**
   * Get current storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      // Get file system info
      const fsInfo = await FileSystem.getFreeDiskStorageAsync();
      const totalSpace = await FileSystem.getTotalDiskCapacityAsync();
      const freeSpace = fsInfo;
      const usedSpace = totalSpace - freeSpace;
      const usedPercentage = (usedSpace / totalSpace) * 100;

      // Get AsyncStorage size
      const asyncStorageSize = await this.getAsyncStorageSize();

      return {
        totalSpace,
        freeSpace,
        usedSpace,
        usedPercentage,
        asyncStorageSize,
        fileSystemSize: usedSpace - asyncStorageSize,
      };
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      // Return safe defaults
      return {
        totalSpace: 0,
        freeSpace: 0,
        usedSpace: 0,
        usedPercentage: 0,
        asyncStorageSize: 0,
        fileSystemSize: 0,
      };
    }
  }

  /**
   * Get AsyncStorage size
   */
  private async getAsyncStorageSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }

      return totalSize;
    } catch (error) {
      logger.error('Failed to get AsyncStorage size:', error);
      return 0;
    }
  }

  /**
   * Check if storage warning is needed
   */
  private checkStorageWarning(stats: StorageStats): StorageWarning | null {
    const freeSpaceMB = stats.freeSpace / 1024 / 1024;
    const usedPercentage = stats.usedPercentage / 100;

    if (usedPercentage >= CRITICAL_THRESHOLD || freeSpaceMB < MIN_FREE_SPACE_MB) {
      return {
        level: 'critical',
        message: `Depolama alanı kritik seviyede! Sadece ${freeSpaceMB.toFixed(0)}MB boş alan kaldı.`,
        freeSpaceMB,
        usedPercentage: stats.usedPercentage,
      };
    }

    if (usedPercentage >= WARNING_THRESHOLD) {
      return {
        level: 'warning',
        message: `Depolama alanı azalıyor. ${freeSpaceMB.toFixed(0)}MB boş alan kaldı.`,
        freeSpaceMB,
        usedPercentage: stats.usedPercentage,
      };
    }

    return null;
  }

  /**
   * Handle storage warning
   */
  private async handleStorageWarning(warning: StorageWarning, stats: StorageStats) {
    // Check cooldown
    const now = Date.now();
    if (now - this.lastWarningTime < this.WARNING_COOLDOWN) {
      return;
    }

    this.lastWarningTime = now;

    logger.warn('Storage warning:', warning);

    if (warning.level === 'critical') {
      await this.handleCriticalStorage(stats);
    } else {
      // Show warning alert
      Alert.alert(
        'Depolama Uyarısı',
        `${warning.message}\n\nÖnemsiz verileri temizlemek ister misiniz?`,
        [
          { text: 'Daha Sonra', style: 'cancel' },
          {
            text: 'Temizle',
            onPress: async () => {
              await this.cleanupLowPriorityData();
            },
          },
        ]
      );
    }
  }

  /**
   * Handle critical storage situation
   */
  private async handleCriticalStorage(stats: StorageStats) {
    logger.error('Critical storage situation!', stats);

    Alert.alert(
      'Kritik Depolama Durumu',
      'Depolama alanı dolmak üzere! Önemsiz veriler otomatik olarak temizlenecek.',
      [
        {
          text: 'Tamam',
          onPress: async () => {
            await this.cleanupLowPriorityData();
            await this.cleanupMediumPriorityData();
          },
        },
      ]
    );
  }

  /**
   * Cleanup low priority data (AI cache, news)
   */
  async cleanupLowPriorityData(): Promise<number> {
    let cleanedBytes = 0;

    try {
      logger.info('Cleaning up low priority data...');

      // Clean AI cache
      const aiCacheKeys = await this.getKeysByPrefix('@afetnet:ai_cache:');
      for (const key of aiCacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          cleanedBytes += new Blob([value]).size;
        }
        await AsyncStorage.removeItem(key);
      }

      // Clean news cache
      const newsKeys = await this.getKeysByPrefix('@afetnet:news:');
      for (const key of newsKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          cleanedBytes += new Blob([value]).size;
        }
        await AsyncStorage.removeItem(key);
      }

      logger.info(`Cleaned ${(cleanedBytes / 1024 / 1024).toFixed(2)}MB of low priority data`);
      return cleanedBytes;
    } catch (error) {
      logger.error('Failed to cleanup low priority data:', error);
      return 0;
    }
  }

  /**
   * Cleanup medium priority data (old earthquakes, old messages)
   */
  async cleanupMediumPriorityData(): Promise<number> {
    let cleanedBytes = 0;

    try {
      logger.info('Cleaning up medium priority data...');

      // Keep only last 100 earthquakes
      const earthquakesKey = '@afetnet:earthquakes';
      const earthquakesData = await AsyncStorage.getItem(earthquakesKey);
      if (earthquakesData) {
        const earthquakes = JSON.parse(earthquakesData);
        if (Array.isArray(earthquakes) && earthquakes.length > 100) {
          const oldSize = new Blob([earthquakesData]).size;
          const trimmed = earthquakes.slice(0, 100);
          await AsyncStorage.setItem(earthquakesKey, JSON.stringify(trimmed));
          const newData = await AsyncStorage.getItem(earthquakesKey);
          const newSize = newData ? new Blob([newData]).size : 0;
          cleanedBytes += oldSize - newSize;
        }
      }

      // Clean old messages (older than 30 days)
      const messagesKey = '@afetnet:messages';
      const messagesData = await AsyncStorage.getItem(messagesKey);
      if (messagesData) {
        const messages = JSON.parse(messagesData);
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const oldSize = new Blob([messagesData]).size;
        const filtered = messages.filter((msg: any) => msg.timestamp > thirtyDaysAgo);
        await AsyncStorage.setItem(messagesKey, JSON.stringify(filtered));
        const newData = await AsyncStorage.getItem(messagesKey);
        const newSize = newData ? new Blob([newData]).size : 0;
        cleanedBytes += oldSize - newSize;
      }

      logger.info(`Cleaned ${(cleanedBytes / 1024 / 1024).toFixed(2)}MB of medium priority data`);
      return cleanedBytes;
    } catch (error) {
      logger.error('Failed to cleanup medium priority data:', error);
      return 0;
    }
  }

  /**
   * Get all keys with a specific prefix
   */
  private async getKeysByPrefix(prefix: string): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys.filter(key => key.startsWith(prefix));
    } catch (error) {
      logger.error('Failed to get keys by prefix:', error);
      return [];
    }
  }

  /**
   * Clear all non-critical data
   */
  async clearAllNonCriticalData(): Promise<number> {
    let cleanedBytes = 0;

    try {
      logger.info('Clearing all non-critical data...');

      cleanedBytes += await this.cleanupLowPriorityData();
      cleanedBytes += await this.cleanupMediumPriorityData();

      logger.info(`Total cleaned: ${(cleanedBytes / 1024 / 1024).toFixed(2)}MB`);
      return cleanedBytes;
    } catch (error) {
      logger.error('Failed to clear non-critical data:', error);
      return 0;
    }
  }

  /**
   * Get storage info for display
   */
  async getStorageInfo(): Promise<{
    totalMB: number;
    usedMB: number;
    freeMB: number;
    usedPercentage: number;
    asyncStorageMB: number;
    status: 'ok' | 'warning' | 'critical';
  }> {
    const stats = await this.getStorageStats();
    const warning = this.checkStorageWarning(stats);

    return {
      totalMB: stats.totalSpace / 1024 / 1024,
      usedMB: stats.usedSpace / 1024 / 1024,
      freeMB: stats.freeSpace / 1024 / 1024,
      usedPercentage: stats.usedPercentage,
      asyncStorageMB: stats.asyncStorageSize / 1024 / 1024,
      status: warning ? (warning.level === 'critical' ? 'critical' : 'warning') : 'ok',
    };
  }
}

export const storageManagementService = new StorageManagementService();


