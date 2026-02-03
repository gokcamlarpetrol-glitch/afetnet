/**
 * TILE CACHE SERVICE - OFFLINE MAP BRIDGE
 * Extracts tiles from MBTiles SQLite DB to FileSystem for MapView consumption.
 * Acts as a clean bridge between low-level DB and UI components.
 */

import * as FileSystem from 'expo-file-system';
import { mbtilesProvider } from './MBTilesProvider';
import { createLogger } from '../core/utils/logger';
import { Buffer } from 'buffer';

const logger = createLogger('TileCacheService');

class TileCacheService {
  private cacheDir: string;
  private isProcessing = false;
  private queue: any[] = [];
  private activeDownloads = 0;
  private readonly MAX_CONCURRENT_DOWNLOADS = 5;
  private downloadListeners: ((progress: number, total: number) => void)[] = [];

  constructor() {
    this.cacheDir = `${FileSystem.cacheDirectory}tiles`;
  }

  /**
     * Initialize cache directory
     */
  async initialize(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
      }
    } catch (error) {
      logger.error('Failed to init tile cache dir:', error);
    }
  }

  /**
     * Get URL template for MapView
     */
  getUrlTemplate(): string {
    return `${this.cacheDir}/{z}/{x}/{y}.png`;
  }

  /**
     * Calculate number of tiles in a region for zoom levels
     */
  estimateTileCount(
    region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number },
    minZoom: number,
    maxZoom: number,
  ): number {
    let count = 0;
    for (let z = minZoom; z <= maxZoom; z++) {
      const [minX, maxX, minY, maxY] = this.getTileBounds(region, z);
      count += (maxX - minX + 1) * (maxY - minY + 1);
    }
    return count;
  }

  /**
     * Download (prefetch) tiles for a region
     */
  async downloadRegion(
    region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number },
    minZoom: number = 10,
    maxZoom: number = 15,
    onProgress?: (progress: number, total: number) => void,
  ): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Download already in progress');
      return;
    }
    this.isProcessing = true;
    this.queue = [];

    try {
      // Generate queue
      for (let z = minZoom; z <= maxZoom; z++) {
        const [minX, maxX, minY, maxY] = this.getTileBounds(region, z);
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            this.queue.push({ z, x, y });
          }
        }
      }

      const totalTiles = this.queue.length;
      let downloadedTiles = 0;
      logger.info(`Starting download of ${totalTiles} tiles`);

      if (onProgress) this.downloadListeners.push(onProgress);

      // Process queue
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.MAX_CONCURRENT_DOWNLOADS);
        await Promise.all(batch.map(async (tile) => {
          await this.downloadTile(tile.z, tile.x, tile.y);
          downloadedTiles++;
          this.notifyProgress(downloadedTiles, totalTiles);
        }));
      }

      logger.info('Region download complete');

    } catch (error) {
      logger.error('Region download error:', error);
    } finally {
      this.isProcessing = false;
      this.downloadListeners = [];
    }
  }

  private notifyProgress(current: number, total: number) {
    this.downloadListeners.forEach(listener => listener(current, total));
  }

  /**
     * Download a single tile from OpenStreetMap (or other source)
     * In a real app, use a proper tile server or MBTiles provider if online
     */
  private async downloadTile(z: number, x: number, y: number): Promise<void> {
    const path = `${this.cacheDir}/${z}/${x}/${y}.png`;
    const dir = `${this.cacheDir}/${z}/${x}`;

    try {
      // Check if exists
      const fileInfo = await FileSystem.getInfoAsync(path);
      if (fileInfo.exists) return;

      // Ensure directory
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

      // Fetch from OSM (Example) - Replace with your key/server if needed
      // CartoDB Light is good for free usage
      const url = `https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/${z}/${x}/${y}.png`;

      await FileSystem.downloadAsync(url, path);

    } catch (error) {
      // Silent fail for individual tile
      // logger.debug(`Failed to download tile ${z}/${x}/${y}`, error);
    }
  }

  /**
     * Get tile bounds for a region at zoom level
     */
  private getTileBounds(
    region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number },
    z: number,
  ): [number, number, number, number] {
    const n = Math.pow(2, z);

    const degToRad = (deg: number) => deg * Math.PI / 180;

    const lonToX = (lon: number) => Math.floor(n * (lon + 180) / 360);
    const latToY = (lat: number) => Math.floor(n * (1 - Math.log(Math.tan(degToRad(lat)) + 1 / Math.cos(degToRad(lat))) / Math.PI) / 2);

    const minLon = region.longitude - region.longitudeDelta / 2;
    const maxLon = region.longitude + region.longitudeDelta / 2;
    const minLat = region.latitude - region.latitudeDelta / 2;
    const maxLat = region.latitude + region.latitudeDelta / 2;

    const minX = lonToX(minLon);
    const maxX = lonToX(maxLon);
    const minY = latToY(maxLat); // Latitude is inverted
    const maxY = latToY(minLat);

    return [
      Math.max(0, minX), Math.min(n - 1, maxX),
      Math.max(0, minY), Math.min(n - 1, maxY),
    ];
  }

  /**
     * Clear cache
     */
  async clearCache(): Promise<void> {
    try {
      await FileSystem.deleteAsync(this.cacheDir, { idempotent: true });
      await this.initialize();
    } catch (error) {
      logger.error('Clear cache error:', error);
    }
  }
}

export const tileCacheService = new TileCacheService();
export default tileCacheService;
