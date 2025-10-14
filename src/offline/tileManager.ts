import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { logger } from '../utils/productionLogger';
import { tilesForBBox } from './tiles';

export interface TilePack {
  id: string;
  path: string;
  sizeBytes: number;
  zooms: number[];
  kind: 'raster' | 'vector';
  type?: 'mbtiles' | 'directory';
  name?: string;
  description?: string;
}

export interface PrefetchOptions {
  center: { lat: number; lon: number };
  radiusKm: number;
  minZoom: number;
  maxZoom: number;
  packId?: string;
}

export interface PrefetchProgress {
  downloaded: number;
  total: number;
  currentTile: string;
  speed: number; // bytes per second
}

class TileManager {
  private documentDir: string;
  private tilePacks = new Map<string, TilePack>();
  private activePack: string | null = null;

  constructor() {
    this.documentDir = FileSystem.documentDirectory || '';
    this.initializeTilesDirectory();
  }

  private async initializeTilesDirectory(): Promise<void> {
    try {
      const tilesDir = `${this.documentDir}tiles/`;
      const dirInfo = await FileSystem.getInfoAsync(tilesDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(tilesDir, { intermediates: true });
      }
      
      // Load existing tile packs
      await this.scanForTilePacks();
    } catch (error) {
      logger.warn('Failed to initialize tiles directory:', error);
    }
  }

  private async scanForTilePacks(): Promise<void> {
    try {
      const tilesDir = `${this.documentDir}tiles/`;
      const dirInfo = await FileSystem.getInfoAsync(tilesDir);
      
      if (!dirInfo.exists) return;

      const contents = await FileSystem.readDirectoryAsync(tilesDir);
      
      for (const item of contents) {
        const itemPath = `${tilesDir}${item}`;
        const itemInfo = await FileSystem.getInfoAsync(itemPath);
        
        if (itemInfo.isDirectory) {
          // Check for folder-based tiles (z/x/y.png structure)
          const hasTiles = await this.checkFolderStructure(itemPath);
          if (hasTiles) {
            const zooms = await this.getFolderZooms(itemPath);
            const sizeBytes = await this.getFolderSize(itemPath);
            
            this.tilePacks.set(item, {
              id: item,
              path: itemPath,
              sizeBytes,
              zooms,
              kind: 'raster',
              name: item,
              description: `Folder tiles (${zooms.length} zoom levels)`
            });
          }
        } else if (item.endsWith('.mbtiles')) {
          // Check for MBTiles file
          const zooms = await this.getMbtilesZooms(itemPath);
          const sizeBytes = (itemInfo as any).size || 0;
          
          this.tilePacks.set(item, {
            id: item,
            path: itemPath,
            sizeBytes,
            zooms,
            kind: 'raster',
            name: item.replace('.mbtiles', ''),
            description: `MBTiles database (${zooms.length} zoom levels)`
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to scan for tile packs:', error);
    }
  }

  private async checkFolderStructure(folderPath: string): Promise<boolean> {
    try {
      const contents = await FileSystem.readDirectoryAsync(folderPath);
      // Look for zoom level directories (0-20)
      const hasZoomDirs = contents.some(dir => /^\d+$/.test(dir));
      
      if (hasZoomDirs) {
        // Check one zoom level for x/y structure
        const zoomDirs = contents.filter(dir => /^\d+$/.test(dir));
        if (zoomDirs.length > 0) {
          const sampleZoomPath = `${folderPath}/${zoomDirs[0]}`;
          const zoomContents = await FileSystem.readDirectoryAsync(sampleZoomPath);
          return zoomContents.some(dir => /^\d+$/.test(dir));
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  private async getFolderZooms(folderPath: string): Promise<number[]> {
    try {
      const contents = await FileSystem.readDirectoryAsync(folderPath);
      return contents
        .filter(dir => /^\d+$/.test(dir))
        .map(dir => parseInt(dir, 10))
        .sort((a, b) => a - b);
    } catch (error) {
      return [];
    }
  }

  private async getFolderSize(folderPath: string): Promise<number> {
    try {
      // This is a simplified size calculation
      // In production, you might want to implement recursive directory size calculation
      return 0;
    } catch (error) {
      return 0;
    }
  }

  private async getMbtilesZooms(mbtilesPath: string): Promise<number[]> {
    try {
      // For MBTiles, we would need to read the SQLite database
      // This is a simplified implementation - in production you'd use SQLite
      // to query the tiles table for zoom levels
      return [10, 11, 12, 13, 14, 15, 16, 17];
    } catch (error) {
      return [];
    }
  }

  async hasMbtiles(path: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(path);
      return fileInfo.exists && path.endsWith('.mbtiles');
    } catch (error) {
      return false;
    }
  }

  async listAvailableTilePacks(): Promise<TilePack[]> {
    await this.loadFromStorage();
    return Array.from(this.tilePacks.values());
  }

  async loadFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('afn/tilePacks/v1');
      if (stored) {
        const packs = JSON.parse(stored);
        this.tilePacks.clear();
        packs.forEach((pack: TilePack) => {
          this.tilePacks.set(pack.id, pack);
        });
      }
    } catch (error) {
      logger.warn('Failed to load tile packs from storage:', error);
    }
  }

  async saveToStorage(): Promise<void> {
    try {
      const packs = Array.from(this.tilePacks.values());
      await AsyncStorage.setItem('afn/tilePacks/v1', JSON.stringify(packs));
    } catch (error) {
      logger.warn('Failed to save tile packs to storage:', error);
    }
  }

  async openMbtiles(path: string): Promise<void> {
    try {
      // Copy MBTiles to document directory if it's not already there
      const fileName = path.split('/').pop() || 'tiles.mbtiles';
      const targetPath = `${this.documentDir}tiles/${fileName}`;
      
      // If source is not in document directory, copy it
      if (!path.startsWith(this.documentDir)) {
        await FileSystem.copyAsync({
          from: path,
          to: targetPath
        });
      }
      
      // Register the pack
      const packId = fileName.replace('.mbtiles', '');
      const zooms = await this.getMbtilesZooms(targetPath);
      const fileInfo = await FileSystem.getInfoAsync(targetPath);
      
      this.tilePacks.set(packId, {
        id: packId,
        path: targetPath,
        sizeBytes: (fileInfo as any).size || 0,
        zooms,
        type: 'mbtiles',
        name: packId,
        description: `MBTiles database (${zooms.length} zoom levels)`,
        kind: 'mbtiles' as const
      });
      
      logger.debug(`Opened MBTiles pack: ${packId}`);
    } catch (error) {
      logger.error('Failed to open MBTiles:', error);
      throw error;
    }
  }

  getUrlTemplateForLocalTiles(packId: string): string {
    const pack = this.tilePacks.get(packId);
    if (!pack) {
      throw new Error(`Tile pack ${packId} not found`);
    }

    // All packs use folder structure for now
    return `file://${pack.path}/{z}/{x}/{y}.png`;
  }

  async estimatePrefetchSize(bbox: { north: number; south: number; east: number; west: number }, zoombounds: { min: number; max: number }): Promise<number> {
    try {
      const tiles = tilesForBBox({
        minLat: bbox.south,
        minLon: bbox.west,
        maxLat: bbox.north,
        maxLon: bbox.east
      }, zoombounds.min, zoombounds.max);
      // Estimate 50KB per tile (typical satellite tile size)
      return tiles.length * 50 * 1024;
    } catch (error) {
      logger.error('Failed to estimate prefetch size:', error);
      return 0;
    }
  }

  async removeTilePack(id: string): Promise<void> {
    try {
      const pack = this.tilePacks.get(id);
      if (!pack) {
        throw new Error(`Tile pack ${id} not found`);
      }

      // Remove files
      await FileSystem.deleteAsync(pack.path, { idempotent: true });
      
      // Remove from registry
      this.tilePacks.delete(id);
      
      logger.debug(`Removed tile pack: ${id}`);
    } catch (error) {
      logger.error('Failed to remove tile pack:', error);
      throw error;
    }
  }

  async prefetchTiles(options: PrefetchOptions, onProgress?: (progress: PrefetchProgress) => void): Promise<void> {
    try {
      const { center, radiusKm, minZoom, maxZoom, packId } = options;
      
      // Calculate bounding box
      const bbox = {
        north: center.lat + (radiusKm / 111.32), // Rough conversion
        south: center.lat - (radiusKm / 111.32),
        east: center.lon + (radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180))),
        west: center.lon - (radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180)))
      };

      const tiles = tilesForBBox({
        minLat: bbox.south,
        minLon: bbox.west,
        maxLat: bbox.north,
        maxLon: bbox.east
      }, minZoom, maxZoom);
      const packIdFinal = packId || `prefetch_${Date.now()}`;
      const packPath = `${this.documentDir}tiles/${packIdFinal}`;
      
      // Create pack directory
      await FileSystem.makeDirectoryAsync(packPath, { intermediates: true });
      
      let downloaded = 0;
      const total = tiles.length;
      
      for (const tile of tiles) {
        try {
          const tilePath = `${packPath}/${tile.z}/${tile.x}/${tile.y}.png`;
          
          // Create zoom and x directories if they don't exist
          await FileSystem.makeDirectoryAsync(`${packPath}/${tile.z}`, { intermediates: true });
          await FileSystem.makeDirectoryAsync(`${packPath}/${tile.z}/${tile.x}`, { intermediates: true });
          
          // Download tile (using a placeholder URL - in production you'd use real tile server)
          const remoteUrl = `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`;
          
          await FileSystem.downloadAsync(remoteUrl, tilePath);
          downloaded++;
          
          // Report progress
          if (onProgress) {
            onProgress({
              downloaded,
              total,
              currentTile: `${tile.z}/${tile.x}/${tile.y}`,
              speed: 0 // Could calculate based on time
            });
          }
        } catch (tileError) {
          logger.warn(`Failed to download tile ${tile.z}/${tile.x}/${tile.y}:`, tileError);
          // Continue with other tiles
        }
      }
      
      // Register the new pack
      const zooms = Array.from(new Set(tiles.map(t => t.z))).sort((a, b) => a - b);
      const folderSize = await this.getFolderSize(packPath);
      
      this.tilePacks.set(packIdFinal, {
        id: packIdFinal,
        path: packPath,
        sizeBytes: folderSize,
        zooms,
        kind: 'raster',
        name: `Prefetch ${new Date().toLocaleDateString()}`,
        description: `Downloaded ${tiles.length} tiles`
      });
      
      logger.debug(`Prefetch completed: ${packIdFinal}`);
    } catch (error) {
      logger.error('Prefetch failed:', error);
      throw error;
    }
  }

  getActivePack(): string | null {
    return this.activePack;
  }

  setActivePack(packId: string | null): void {
    this.activePack = packId;
  }

  async getAvailableStorage(): Promise<number> {
    try {
      const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
      return freeDiskStorage;
    } catch (error) {
      logger.warn('Failed to get available storage:', error);
      return 0;
    }
  }

  async registerFolderPack(id: string, absPath: string, kind: 'raster' | 'vector', zooms: number[]): Promise<void> {
    try {
      const sizeBytes = await this.calculateFolderSize(absPath);
      
      const pack: TilePack = {
        id,
        path: absPath,
        sizeBytes,
        zooms,
        kind,
        name: id,
        description: `${kind} tiles (${zooms.length} zoom levels)`
      };
      
      this.tilePacks.set(id, pack);
      await this.saveToStorage();
      logger.debug(`Registered folder pack: ${id}`);
    } catch (error) {
      logger.error('Failed to register folder pack:', error);
      throw error;
    }
  }

  private async calculateFolderSize(folderPath: string): Promise<number> {
    try {
      let totalSize = 0;
      
      const calculateSize = async (path: string): Promise<number> => {
        try {
          const info = await FileSystem.getInfoAsync(path);
          if (info.exists) {
            if (info.isDirectory) {
              const items = await FileSystem.readDirectoryAsync(path);
              for (const item of items) {
                totalSize += await calculateSize(`${path}/${item}`);
              }
            } else {
              totalSize += info.size || 0;
            }
          }
          return totalSize;
        } catch (error) {
          return 0;
        }
      };
      
      await calculateSize(folderPath);
      return totalSize;
    } catch (error) {
      logger.warn('Failed to calculate folder size:', error);
      return 0;
    }
  }

  async ensurePackDir(id: string): Promise<string> {
    try {
      const packPath = `${this.documentDir}tiles/${id}/`;
      const dirInfo = await FileSystem.getInfoAsync(packPath);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(packPath, { intermediates: true });
      }
      
      return packPath;
    } catch (error) {
      logger.error('Failed to ensure pack directory:', error);
      throw error;
    }
  }

  getFolderTemplate(id: string): string {
    const pack = this.tilePacks.get(id);
    if (!pack) {
      throw new Error(`Tile pack ${id} not found`);
    }
    // Default to jpg, but could be extended to detect file extension
    return `file://${pack.path}{z}/{x}/{y}.jpg`;
  }

  async estimateFolderPrefetchSize(bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number }, zooms: number[]): Promise<number> {
    try {
      let totalTiles = 0;
      for (const zoom of zooms) {
        const tiles = tilesForBBox(bbox, zoom, zoom);
        totalTiles += tiles.length;
      }
      // Estimate 20KB per tile
      return totalTiles * 20 * 1024;
    } catch (error) {
      logger.error('Failed to estimate prefetch size:', error);
      return 0;
    }
  }
}

export const tileManager = new TileManager();
