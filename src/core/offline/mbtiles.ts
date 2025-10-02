import * as FileSystem from 'expo-file-system';
import { TilesUpdater } from './tiles-updater';
import { PreferencesManager } from '../storage/prefs';

export interface MBTilesInfo {
  name: string;
  version: string;
  description?: string;
  format: 'png' | 'jpg' | 'webp' | 'pbf';
  bounds: [number, number, number, number]; // [west, south, east, north]
  center: [number, number, number]; // [lon, lat, zoom]
  minzoom: number;
  maxzoom: number;
  type: 'baselayer' | 'overlay';
  attribution?: string;
}

export class MBTilesManager {
  private static instance: MBTilesManager;
  private tilesUpdater = TilesUpdater.getInstance();
  private prefs = PreferencesManager.getInstance();
  private bundledTilesPath: string | null = null;

  static getInstance(): MBTilesManager {
    if (!MBTilesManager.instance) {
      MBTilesManager.instance = new MBTilesManager();
    }
    return MBTilesManager.instance;
  }

  async getActiveTilesPath(): Promise<string> {
    try {
      // First, try to get OTA tiles path
      const otaPath = await this.tilesUpdater.getActiveTilesPath();
      if (otaPath) {
        console.log('Using OTA tiles:', otaPath);
        return otaPath;
      }

      // Fallback to bundled tiles
      const bundledPath = await this.getBundledTilesPath();
      if (bundledPath) {
        console.log('Using bundled tiles:', bundledPath);
        return bundledPath;
      }

      throw new Error('No tiles available (neither OTA nor bundled)');
    } catch (error) {
      console.error('Failed to get active tiles path:', error);
      throw error;
    }
  }

  private async getBundledTilesPath(): Promise<string | null> {
    try {
      if (this.bundledTilesPath) {
        return this.bundledTilesPath;
      }

      // Check if bundled tiles exist
      const bundledPath = `${FileSystem.bundleDirectory}assets/mbtiles/istanbul.mbtiles`;
      const fileInfo = await FileSystem.getInfoAsync(bundledPath);
      
      if (fileInfo.exists) {
        this.bundledTilesPath = bundledPath;
        return bundledPath;
      }

      console.warn('Bundled tiles not found:', bundledPath);
      return null;
    } catch (error) {
      console.error('Failed to get bundled tiles path:', error);
      return null;
    }
  }

  async getTilesInfo(): Promise<MBTilesInfo | null> {
    try {
      const tilesPath = await this.getActiveTilesPath();
      const info = await this.readMBTilesMetadata(tilesPath);
      return info;
    } catch (error) {
      console.error('Failed to get tiles info:', error);
      return null;
    }
  }

  async getTile(z: number, x: number, y: number): Promise<ArrayBuffer | null> {
    try {
      const tilesPath = await this.getActiveTilesPath();
      const tileData = await this.readTile(tilesPath, z, x, y);
      return tileData;
    } catch (error) {
      console.error(`Failed to get tile ${z}/${x}/${y}:`, error);
      return null;
    }
  }

  private async readMBTilesMetadata(tilesPath: string): Promise<MBTilesInfo | null> {
    try {
      // For simplicity, we'll return a default Istanbul tiles info
      // In production, you'd read the actual SQLite metadata
      return {
        name: 'Istanbul Offline Tiles',
        version: await this.tilesUpdater.getActiveTilesVersion() || '1.0.0',
        description: 'Offline map tiles for Istanbul region',
        format: 'png',
        bounds: [28.5, 40.8, 29.3, 41.2], // Istanbul bounds
        center: [28.9784, 41.0082, 10], // Istanbul center
        minzoom: 0,
        maxzoom: 18,
        type: 'baselayer',
        attribution: '© AfetNet',
      };
    } catch (error) {
      console.error('Failed to read MBTiles metadata:', error);
      return null;
    }
  }

  private async readTile(tilesPath: string, z: number, x: number, y: number): Promise<ArrayBuffer | null> {
    try {
      // For simplicity, we'll return null to indicate no tile
      // In production, you'd query the SQLite database for the tile data
      console.log(`Reading tile ${z}/${x}/${y} from ${tilesPath}`);
      
      // This is a placeholder implementation
      // In reality, you'd use a SQLite library to query the tiles table
      // const db = await SQLite.openDatabase(tilesPath);
      // const result = await db.executeSql(
      //   'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?',
      //   [z, x, y]
      // );
      // return result.rows.item(0)?.tile_data || null;
      
      return null;
    } catch (error) {
      console.error(`Failed to read tile ${z}/${x}/${y}:`, error);
      return null;
    }
  }

  async isOTAUpdateAvailable(currentVersion: string): Promise<boolean> {
    try {
      const availableVersions = await this.tilesUpdater.getAvailableTilesVersions();
      if (availableVersions.length === 0) {
        return false;
      }

      const latestVersion = availableVersions[0];
      return this.isVersionNewer(latestVersion, currentVersion);
    } catch (error) {
      console.error('Failed to check for OTA update:', error);
      return false;
    }
  }

  private isVersionNewer(version1: string, version2: string): boolean {
    try {
      const v1Parts = version1.split('.').map(Number);
      const v2Parts = version2.split('.').map(Number);
      
      for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;
        
        if (v1Part > v2Part) return true;
        if (v1Part < v2Part) return false;
      }
      
      return false;
    } catch (error) {
      console.error('Version comparison failed:', error);
      return false;
    }
  }

  async getStorageUsage(): Promise<{ totalSize: number; tilesCount: number }> {
    try {
      const offlineDir = `${FileSystem.documentDirectory}offline`;
      const dirInfo = await FileSystem.getInfoAsync(offlineDir);
      
      if (!dirInfo.exists) {
        return { totalSize: 0, tilesCount: 0 };
      }

      const files = await FileSystem.readDirectoryAsync(offlineDir);
      const tilesFiles = files.filter(file => file.endsWith('.mbtiles'));
      
      let totalSize = 0;
      for (const file of tilesFiles) {
        const filePath = `${offlineDir}/${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        totalSize += fileInfo.size || 0;
      }

      return {
        totalSize,
        tilesCount: tilesFiles.length,
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return { totalSize: 0, tilesCount: 0 };
    }
  }

  async clearAllTiles(): Promise<void> {
    try {
      const offlineDir = `${FileSystem.documentDirectory}offline`;
      await FileSystem.deleteAsync(offlineDir, { idempotent: true });
      
      // Clear preferences
      await this.prefs.remove('activeTilesPath');
      await this.prefs.remove('activeTilesVersion');
      
      console.log('All tiles cleared successfully');
    } catch (error) {
      console.error('Failed to clear all tiles:', error);
      throw error;
    }
  }

  async getTilesStatus(): Promise<{
    hasActiveTiles: boolean;
    activeVersion: string | null;
    isOTA: boolean;
    availableVersions: string[];
  }> {
    try {
      const activePath = await this.tilesUpdater.getActiveTilesPath();
      const activeVersion = await this.tilesUpdater.getActiveTilesVersion();
      const availableVersions = await this.tilesUpdater.getAvailableTilesVersions();
      const bundledPath = await this.getBundledTilesPath();
      
      return {
        hasActiveTiles: !!activePath,
        activeVersion,
        isOTA: activePath !== bundledPath,
        availableVersions,
      };
    } catch (error) {
      console.error('Failed to get tiles status:', error);
      return {
        hasActiveTiles: false,
        activeVersion: null,
        isOTA: false,
        availableVersions: [],
      };
    }
  }
}