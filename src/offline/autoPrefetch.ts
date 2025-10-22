// AUTO PREFETCH - PRODUCTION READY
// Automatically prefetches tiles for offline use

import { TileManager } from './tileManager';
import { getTilesInBounds, deg2num } from './tiles';

export interface PrefetchOptions {
  radius: number; // km
  zoomLevels: number[];
  maxTiles: number;
}

export class AutoPrefetch {
  private tileManager: TileManager;
  private options: PrefetchOptions;

  constructor(tileManager: TileManager, options: PrefetchOptions) {
    this.tileManager = tileManager;
    this.options = {
      radius: 5,
      zoomLevels: [10, 11, 12, 13, 14],
      maxTiles: 1000,
      ...options,
    };
  }

  async prefetchForLocation(lat: number, lon: number): Promise<void> {
    try {
      const tiles: Array<{ z: number; x: number; y: number }> = [];
      
      // Calculate bounds around location
      const radiusKm = this.options.radius;
      const latOffset = radiusKm / 111; // Approximate km per degree
      const lonOffset = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
      
      const bounds = {
        north: lat + latOffset,
        south: lat - latOffset,
        east: lon + lonOffset,
        west: lon - lonOffset,
      };

      // Get tiles for each zoom level
      for (const zoom of this.options.zoomLevels) {
        const zoomTiles = getTilesInBounds(bounds, zoom);
        tiles.push(...zoomTiles);
      }

      // Limit number of tiles
      const limitedTiles = tiles.slice(0, this.options.maxTiles);

      // Prefetch tiles
      for (const tile of limitedTiles) {
        await this.tileManager.getTile(tile.z, tile.x, tile.y);
      }

      console.log(`Prefetched ${limitedTiles.length} tiles for location ${lat}, ${lon}`);
    } catch (error) {
      console.error('AutoPrefetch error:', error);
    }
  }

  async prefetchForRoute(routePoints: Array<{ lat: number; lon: number }>): Promise<void> {
    try {
      for (const point of routePoints) {
        await this.prefetchForLocation(point.lat, point.lon);
      }
    } catch (error) {
      console.error('Route prefetch error:', error);
    }
  }
}

export default AutoPrefetch;