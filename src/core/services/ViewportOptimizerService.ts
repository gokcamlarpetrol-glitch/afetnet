/**
 * VIEWPORT OPTIMIZER SERVICE - ELITE EDITION
 * Optimizes map rendering by only processing visible regions.
 *
 * Features:
 * - Viewport culling
 * - Level of Detail (LOD) management
 * - Tile prefetching
 * - Memory management
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('ViewportOptimizer');

export interface ViewportBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

export interface MapPoint {
    id: string;
    latitude: number;
    longitude: number;
    data?: any;
}

export interface ViewportConfig {
    bufferRatio: number; // How much extra area to load (1.0 = exact, 1.5 = 50% buffer)
    minZoomForDetails: number; // Zoom level to show details
    maxPointsOnScreen: number; // Maximum points to render
}

const DEFAULT_CONFIG: ViewportConfig = {
  bufferRatio: 1.2,
  minZoomForDetails: 10,
  maxPointsOnScreen: 500,
};

class ViewportOptimizerService {
  private config: ViewportConfig = DEFAULT_CONFIG;
  private currentViewport: ViewportBounds | null = null;
  private allPoints: MapPoint[] = [];
  private visiblePoints: MapPoint[] = [];
  private prefetchedTiles: Set<string> = new Set();

  /**
     * Update configuration
     */
  setConfig(config: Partial<ViewportConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
     * Set all available points
     */
  setAllPoints(points: MapPoint[]) {
    this.allPoints = points;
    if (this.currentViewport) {
      this.updateVisiblePoints();
    }
  }

  /**
     * Update current viewport
     */
  setViewport(bounds: ViewportBounds) {
    this.currentViewport = bounds;
    this.updateVisiblePoints();
  }

  /**
     * Get visible points for rendering
     */
  getVisiblePoints(): MapPoint[] {
    return this.visiblePoints;
  }

  /**
     * Check if a point is in viewport
     */
  isInViewport(point: MapPoint): boolean {
    if (!this.currentViewport) return true;

    const bounds = this.getBufferedBounds();
    return (
      point.latitude >= bounds.south &&
            point.latitude <= bounds.north &&
            point.longitude >= bounds.west &&
            point.longitude <= bounds.east
    );
  }

  /**
     * Get LOD (Level of Detail) for current zoom
     */
  getLOD(zoom: number): 'low' | 'medium' | 'high' {
    if (zoom < 8) return 'low';
    if (zoom < 12) return 'medium';
    return 'high';
  }

  /**
     * Get tile keys for prefetching
     */
  getTilesToPrefetch(zoom: number): string[] {
    if (!this.currentViewport) return [];

    const bounds = this.getBufferedBounds();
    const tiles: string[] = [];

    // Simple tile calculation (for MBTiles or similar)
    const tileSize = 256;
    const scale = Math.pow(2, zoom);

    const minTileX = Math.floor(((bounds.west + 180) / 360) * scale);
    const maxTileX = Math.floor(((bounds.east + 180) / 360) * scale);
    const minTileY = Math.floor(
      ((1 - Math.log(Math.tan((bounds.north * Math.PI) / 180) + 1 / Math.cos((bounds.north * Math.PI) / 180)) / Math.PI) / 2) * scale,
    );
    const maxTileY = Math.floor(
      ((1 - Math.log(Math.tan((bounds.south * Math.PI) / 180) + 1 / Math.cos((bounds.south * Math.PI) / 180)) / Math.PI) / 2) * scale,
    );

    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        const tileKey = `${zoom}/${x}/${y}`;
        if (!this.prefetchedTiles.has(tileKey)) {
          tiles.push(tileKey);
        }
      }
    }

    return tiles;
  }

  /**
     * Mark tiles as prefetched
     */
  markTilesPrefetched(tiles: string[]) {
    tiles.forEach((tile) => this.prefetchedTiles.add(tile));

    // Limit cache size
    if (this.prefetchedTiles.size > 500) {
      const toRemove = Array.from(this.prefetchedTiles).slice(0, 100);
      toRemove.forEach((tile) => this.prefetchedTiles.delete(tile));
    }
  }

  /**
     * Clear prefetch cache
     */
  clearCache() {
    this.prefetchedTiles.clear();
  }

  // Private Helpers

  private getBufferedBounds(): ViewportBounds {
    if (!this.currentViewport) {
      return { north: 90, south: -90, east: 180, west: -180 };
    }

    const latBuffer = (this.currentViewport.north - this.currentViewport.south) * (this.config.bufferRatio - 1);
    const lngBuffer = (this.currentViewport.east - this.currentViewport.west) * (this.config.bufferRatio - 1);

    return {
      north: Math.min(90, this.currentViewport.north + latBuffer),
      south: Math.max(-90, this.currentViewport.south - latBuffer),
      east: Math.min(180, this.currentViewport.east + lngBuffer),
      west: Math.max(-180, this.currentViewport.west - lngBuffer),
    };
  }

  private updateVisiblePoints() {
    if (!this.currentViewport) {
      this.visiblePoints = this.allPoints.slice(0, this.config.maxPointsOnScreen);
      return;
    }

    const filtered = this.allPoints.filter((point) => this.isInViewport(point));

    // Limit to max points
    if (filtered.length > this.config.maxPointsOnScreen) {
      // Sample points evenly
      const step = Math.ceil(filtered.length / this.config.maxPointsOnScreen);
      this.visiblePoints = filtered.filter((_, index) => index % step === 0);
    } else {
      this.visiblePoints = filtered;
    }

    logger.debug(`Viewport updated: ${this.visiblePoints.length}/${this.allPoints.length} points visible`);
  }
}

export const viewportOptimizer = new ViewportOptimizerService();
