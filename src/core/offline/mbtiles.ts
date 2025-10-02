import { FileSystem } from 'expo-file-system';
import { Preferences } from '../storage/prefs';

export interface MBTilesInfo {
  name: string;
  version: string;
  description: string;
  attribution: string;
  type: string;
  format: string;
  bounds: [number, number, number, number];
  center: [number, number, number];
  minzoom: number;
  maxzoom: number;
}

export interface FileInfo {
  exists: boolean;
  uri: string;
  size: number;
  modificationTime: number;
  isDirectory: boolean;
}

export class MBTilesLoader {
  private static instance: MBTilesLoader;
  private tilesPath: string;
  private tilesInfo: MBTilesInfo | null = null;

  private constructor() {
    this.tilesPath = `${FileSystem.documentDirectory}tiles/`;
  }

  static getInstance(): MBTilesLoader {
    if (!MBTilesLoader.instance) {
      MBTilesLoader.instance = new MBTilesLoader();
    }
    return MBTilesLoader.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure tiles directory exists
      const dirInfo = await FileSystem.getInfoAsync(this.tilesPath);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.tilesPath, { intermediates: true });
      }

      // Load tiles info
      await this.loadTilesInfo();

      console.log('MBTilesLoader initialized successfully');
    } catch (error) {
      console.error('MBTilesLoader initialization failed:', error);
      throw error;
    }
  }

  private async loadTilesInfo(): Promise<void> {
    try {
      const infoPath = `${this.tilesPath}tiles-info.json`;
      const infoExists = await FileSystem.getInfoAsync(infoPath);
      
      if (infoExists.exists) {
        const infoContent = await FileSystem.readAsStringAsync(infoPath);
        this.tilesInfo = JSON.parse(infoContent);
      } else {
        // Load default tiles info
        this.tilesInfo = {
          name: 'Istanbul Base Map',
          version: '1.0.0',
          description: 'Base map tiles for Istanbul',
          attribution: 'AfetNet',
          type: 'baselayer',
          format: 'pbf',
          bounds: [28.5, 40.8, 29.5, 41.2],
          center: [29.0, 41.0, 10],
          minzoom: 8,
          maxzoom: 16,
        };
      }
    } catch (error) {
      console.error('Failed to load tiles info:', error);
      this.tilesInfo = null;
    }
  }

  getTilesInfo(): MBTilesInfo | null {
    return this.tilesInfo;
  }

  getTilesPath(): string {
    return this.tilesPath;
  }

  async getActiveTilesPath(): Promise<string> {
    try {
      // Check for OTA tiles first
      const otaPath = await Preferences.get('activeTilesPath');
      if (otaPath) {
        const otaExists = await FileSystem.getInfoAsync(otaPath);
        if (otaExists.exists) {
          return otaPath;
        }
      }

      // Fallback to bundled tiles
      const bundledPath = `${this.tilesPath}istanbul.mbtiles`;
      const bundledExists = await FileSystem.getInfoAsync(bundledPath);
      if (bundledExists.exists) {
        return bundledPath;
      }

      // Return default path
      return bundledPath;
    } catch (error) {
      console.error('Failed to get active tiles path:', error);
      return `${this.tilesPath}istanbul.mbtiles`;
    }
  }

  async setActiveTilesPath(path: string): Promise<void> {
    await Preferences.set('activeTilesPath', path);
  }

  async getFileInfo(path: string): Promise<FileInfo> {
    try {
      const info = await FileSystem.getInfoAsync(path);
      return {
        exists: info.exists,
        uri: info.uri,
        size: info.size || 0,
        modificationTime: info.modificationTime || 0,
        isDirectory: info.isDirectory || false,
      };
    } catch (error) {
      console.error('Failed to get file info:', error);
      return {
        exists: false,
        uri: path,
        size: 0,
        modificationTime: 0,
        isDirectory: false,
      };
    }
  }
}
}