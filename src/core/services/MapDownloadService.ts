/**
 * MAP DOWNLOAD SERVICE
 * Downloads and manages offline map tiles
 */

// ELITE: Use legacy API to avoid deprecation warnings (migration to new API planned)
import * as FileSystem from 'expo-file-system/legacy';
import { createLogger } from '../utils/logger';
import { mbtilesProvider } from '../../offline/MBTilesProvider';

const logger = createLogger('MapDownloadService');

// ELITE: Type for FileSystem.DownloadResumable
type DownloadResumable = ReturnType<typeof FileSystem.createDownloadResumable>;

// ELITE: Extended FileInfo type with optional size
interface FileInfoWithSize {
  exists: boolean;
  uri: string;
  size?: number;
  isDirectory?: boolean;
  modificationTime?: number;
}

export interface MapRegion {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center: {
    latitude: number;
    longitude: number;
  };
  minZoom: number;
  maxZoom: number;
  estimatedSize: number; // bytes
  downloadUrl: string;
}

export interface DownloadProgress {
  regionId: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  status: 'downloading' | 'extracting' | 'completed' | 'failed' | 'paused';
}

// Predefined regions
export const AVAILABLE_REGIONS: MapRegion[] = [
  {
    id: 'istanbul',
    name: 'İstanbul',
    bounds: {
      north: 41.32,
      south: 40.80,
      east: 29.45,
      west: 28.50,
    },
    center: {
      latitude: 41.0082,
      longitude: 28.9784,
    },
    minZoom: 0,
    maxZoom: 14,
    estimatedSize: 850 * 1024 * 1024, // 850 MB
    downloadUrl: 'https://example.com/tiles/istanbul.mbtiles',
  },
  {
    id: 'ankara',
    name: 'Ankara',
    bounds: {
      north: 40.05,
      south: 39.75,
      east: 33.10,
      west: 32.60,
    },
    center: {
      latitude: 39.9334,
      longitude: 32.8597,
    },
    minZoom: 0,
    maxZoom: 14,
    estimatedSize: 450 * 1024 * 1024, // 450 MB
    downloadUrl: 'https://example.com/tiles/ankara.mbtiles',
  },
  {
    id: 'izmir',
    name: 'İzmir',
    bounds: {
      north: 38.60,
      south: 38.30,
      east: 27.35,
      west: 26.95,
    },
    center: {
      latitude: 38.4192,
      longitude: 27.1287,
    },
    minZoom: 0,
    maxZoom: 14,
    estimatedSize: 380 * 1024 * 1024, // 380 MB
    downloadUrl: 'https://example.com/tiles/izmir.mbtiles',
  },
];

class MapDownloadService {
  private downloads: Map<string, DownloadProgress> = new Map();
  private downloadTasks: Map<string, DownloadResumable> = new Map();
  private readonly MAPS_DIR = `${FileSystem.documentDirectory}maps/`;

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    try {
      // Create maps directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(this.MAPS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.MAPS_DIR, { intermediates: true });
        logger.info('Maps directory created');
      }

      logger.info('Map download service initialized');
    } catch (error) {
      logger.error('Failed to initialize map download service:', error);
    }
  }

  /**
   * Start downloading a region
   */
  async downloadRegion(region: MapRegion): Promise<boolean> {
    try {
      logger.info('Starting download for region:', region.name);

      // Check if already downloading
      if (this.downloads.has(region.id)) {
        logger.warn('Region already downloading:', region.name);
        return false;
      }

      // Check available storage
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      if (freeSpace < region.estimatedSize * 1.2) {
        // Need 20% extra space
        logger.error('Insufficient storage space');
        throw new Error('Yetersiz depolama alanı');
      }

      const filePath = `${this.MAPS_DIR}${region.id}.mbtiles`;

      // Initialize progress
      const progress: DownloadProgress = {
        regionId: region.id,
        bytesDownloaded: 0,
        totalBytes: region.estimatedSize,
        percentage: 0,
        status: 'downloading',
      };
      this.downloads.set(region.id, progress);

      // Create download resumable
      const downloadResumable = FileSystem.createDownloadResumable(
        region.downloadUrl,
        filePath,
        {},
        (downloadProgress) => {
          const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;

          progress.bytesDownloaded = totalBytesWritten;
          progress.totalBytes = totalBytesExpectedToWrite;
          progress.percentage = (totalBytesWritten / totalBytesExpectedToWrite) * 100;

          this.downloads.set(region.id, { ...progress });

          logger.info(`Download progress: ${progress.percentage.toFixed(1)}%`);
        },
      );

      this.downloadTasks.set(region.id, downloadResumable);

      // Start download
      const result = await downloadResumable.downloadAsync();

      if (result) {
        progress.status = 'completed';
        progress.percentage = 100;
        this.downloads.set(region.id, { ...progress });

        logger.info('Download completed:', region.name);

        // Initialize MBTiles provider with downloaded file
        await mbtilesProvider.initialize(filePath);

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Download failed:', error);

      const progress = this.downloads.get(region.id);
      if (progress) {
        progress.status = 'failed';
        this.downloads.set(region.id, { ...progress });
      }

      return false;
    }
  }

  /**
   * Pause download
   */
  async pauseDownload(regionId: string): Promise<boolean> {
    try {
      const task = this.downloadTasks.get(regionId);
      if (!task) return false;

      await task.pauseAsync();

      const progress = this.downloads.get(regionId);
      if (progress) {
        progress.status = 'paused';
        this.downloads.set(regionId, { ...progress });
      }

      logger.info('Download paused:', regionId);
      return true;
    } catch (error) {
      logger.error('Failed to pause download:', error);
      return false;
    }
  }

  /**
   * Resume download
   */
  async resumeDownload(regionId: string): Promise<boolean> {
    try {
      const task = this.downloadTasks.get(regionId);
      if (!task) return false;

      await task.resumeAsync();

      const progress = this.downloads.get(regionId);
      if (progress) {
        progress.status = 'downloading';
        this.downloads.set(regionId, { ...progress });
      }

      logger.info('Download resumed:', regionId);
      return true;
    } catch (error) {
      logger.error('Failed to resume download:', error);
      return false;
    }
  }

  /**
   * Cancel download
   */
  async cancelDownload(regionId: string): Promise<boolean> {
    try {
      const task = this.downloadTasks.get(regionId);
      if (task) {
        await task.cancelAsync();
        this.downloadTasks.delete(regionId);
      }

      this.downloads.delete(regionId);

      // Delete partial file
      const filePath = `${this.MAPS_DIR}${regionId}.mbtiles`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
      }

      logger.info('Download cancelled:', regionId);
      return true;
    } catch (error) {
      logger.error('Failed to cancel download:', error);
      return false;
    }
  }

  /**
   * Delete downloaded region
   */
  async deleteRegion(regionId: string): Promise<boolean> {
    try {
      const filePath = `${this.MAPS_DIR}${regionId}.mbtiles`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
        logger.info('Region deleted:', regionId);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to delete region:', error);
      return false;
    }
  }

  /**
   * Get download progress
   */
  getProgress(regionId: string): DownloadProgress | null {
    return this.downloads.get(regionId) || null;
  }

  /**
   * Get all downloads
   */
  getAllDownloads(): DownloadProgress[] {
    return Array.from(this.downloads.values());
  }

  /**
   * Check if region is downloaded
   */
  async isRegionDownloaded(regionId: string): Promise<boolean> {
    try {
      const filePath = `${this.MAPS_DIR}${regionId}.mbtiles`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get downloaded regions
   */
  async getDownloadedRegions(): Promise<string[]> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.MAPS_DIR);
      return files
        .filter((file) => file.endsWith('.mbtiles'))
        .map((file) => file.replace('.mbtiles', ''));
    } catch (error) {
      logger.error('Failed to get downloaded regions:', error);
      return [];
    }
  }

  /**
   * Get total size of downloaded maps
   */
  async getTotalDownloadedSize(): Promise<number> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.MAPS_DIR);
      let totalSize = 0;

      for (const file of files) {
        if (file.endsWith('.mbtiles')) {
          const filePath = `${this.MAPS_DIR}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath) as FileInfoWithSize;
          totalSize += fileInfo.size || 0;
        }
      }

      return totalSize;
    } catch (error) {
      logger.error('Failed to get total size:', error);
      return 0;
    }
  }
}

export const mapDownloadService = new MapDownloadService();

