/**
 * MBTILES PROVIDER
 * Custom tile provider for offline maps using MBTiles format
 */

import openDatabase from './mbtiles';
import { createLogger } from '../core/utils/logger';
// ELITE: Use legacy API to avoid deprecation warnings (migration to new API planned)
import * as FileSystem from 'expo-file-system/legacy';

const logger = createLogger('MBTilesProvider');

export interface TileCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface MBTilesMetadata {
  name: string;
  format: string;
  bounds: string;
  center: string;
  minzoom: number;
  maxzoom: number;
  description?: string;
}

class MBTilesProvider {
  private db: any = null;
  private metadata: MBTilesMetadata | null = null;
  private tileCache: Map<string, string> = new Map();
  private readonly MAX_CACHE_SIZE = 100; // Cache last 100 tiles

  /**
   * Initialize MBTiles provider with database file
   */
  async initialize(mbtilesPath: string): Promise<boolean> {
    try {
      logger.info('Initializing MBTiles provider:', mbtilesPath);

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(mbtilesPath);
      if (!fileInfo.exists) {
        logger.error('MBTiles file not found:', mbtilesPath);
        return false;
      }

      // Open database
      this.db = await new openDatabase().open(mbtilesPath);
      if (!this.db) {
        logger.error('Failed to open MBTiles database');
        return false;
      }

      // Load metadata
      await this.loadMetadata();

      logger.info('MBTiles provider initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize MBTiles provider:', error);
      return false;
    }
  }

  /**
   * Load metadata from MBTiles database
   */
  private async loadMetadata(): Promise<void> {
    if (!this.db) return;

    try {
      const results = await this.db.executeSql(
        'SELECT name, value FROM metadata'
      );

      const metadata: any = {};
      for (let i = 0; i < results[0].rows.length; i++) {
        const row = results[0].rows.item(i);
        metadata[row.name] = row.value;
      }

      this.metadata = {
        name: metadata.name || 'Unknown',
        format: metadata.format || 'png',
        bounds: metadata.bounds || '-180,-85,180,85',
        center: metadata.center || '0,0,0',
        minzoom: parseInt(metadata.minzoom || '0'),
        maxzoom: parseInt(metadata.maxzoom || '14'),
        description: metadata.description,
      };

      logger.info('MBTiles metadata loaded:', this.metadata);
    } catch (error) {
      logger.error('Failed to load metadata:', error);
    }
  }

  /**
   * Get tile from MBTiles database
   */
  async getTile(z: number, x: number, y: number): Promise<string | null> {
    if (!this.db) {
      logger.warn('MBTiles database not initialized');
      return null;
    }

    // Check cache first
    const cacheKey = `${z}/${x}/${y}`;
    if (this.tileCache.has(cacheKey)) {
      return this.tileCache.get(cacheKey)!;
    }

    try {
      // MBTiles uses TMS (Tile Map Service) coordinate system
      // Need to flip Y coordinate
      const tmsY = Math.pow(2, z) - 1 - y;

      // Query tile from database
      const results = await this.db.executeSql(
        'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?',
        [z, x, tmsY]
      );

      if (results[0].rows.length === 0) {
        logger.warn(`Tile not found: ${z}/${x}/${y}`);
        return null;
      }

      // Get tile data (blob)
      const tileData = results[0].rows.item(0).tile_data;

      // Convert to base64 data URI
      const format = this.metadata?.format || 'png';
      const dataUri = `data:image/${format};base64,${tileData}`;

      // Add to cache
      this.addToCache(cacheKey, dataUri);

      return dataUri;
    } catch (error) {
      logger.error(`Failed to get tile ${z}/${x}/${y}:`, error);
      return null;
    }
  }

  /**
   * Get tile URL for react-native-maps
   */
  getTileUrl(z: number, x: number, y: number): string {
    // Return a custom URL scheme that we'll intercept
    return `mbtiles://${z}/${x}/${y}`;
  }

  /**
   * Add tile to cache with LRU eviction
   */
  private addToCache(key: string, value: string): void {
    // Remove oldest entry if cache is full
    if (this.tileCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.tileCache.keys().next().value;
      this.tileCache.delete(firstKey);
    }

    this.tileCache.set(key, value);
  }

  /**
   * Clear tile cache
   */
  clearCache(): void {
    this.tileCache.clear();
    logger.info('Tile cache cleared');
  }

  /**
   * Get metadata
   */
  getMetadata(): MBTilesMetadata | null {
    return this.metadata;
  }

  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return this.db !== null && this.metadata !== null;
  }

  /**
   * Get tile count (for progress tracking)
   */
  async getTileCount(): Promise<number> {
    if (!this.db) return 0;

    try {
      const results = await this.db.executeSql('SELECT COUNT(*) as count FROM tiles');
      return results[0].rows.item(0).count;
    } catch (error) {
      logger.error('Failed to get tile count:', error);
      return 0;
    }
  }

  /**
   * Get database size
   */
  async getDatabaseSize(mbtilesPath: string): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(mbtilesPath);
      return fileInfo.exists ? fileInfo.size || 0 : 0;
    } catch (error) {
      logger.error('Failed to get database size:', error);
      return 0;
    }
  }

  /**
   * Close database
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
        this.metadata = null;
        this.clearCache();
        logger.info('MBTiles provider closed');
      } catch (error) {
        logger.error('Failed to close database:', error);
      }
    }
  }
}

export const mbtilesProvider = new MBTilesProvider();

