/**
 * MAP CLUSTER ENGINE
 * High-performance clustering using Supercluster.
 * Handles 10,000+ points at 60 FPS.
 */

import Supercluster from 'supercluster';
import type { BBox, Feature, Point } from 'geojson';

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Required for dynamic properties
}

export class MapClusterEngine {
  private index: Supercluster;
  private points: Feature<Point>[] = [];

  constructor(options: Supercluster.Options<any, any> = {}) {
    this.index = new Supercluster({
      radius: 40,
      maxZoom: 16,
      ...options,
    });
  }

  public load(points: MapPoint[]) {
    // Convert to GeoJSON Feature collection
    const features = points.map(point => ({
      type: 'Feature' as const,
      properties: {
        cluster: false,
        pointId: point.id,
        ...point,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [point.longitude, point.latitude],
      },
    }));

    this.index.load(features);
    this.points = features;
  }

  public getClusters(bbox: BBox, zoom: number) {
    return this.index.getClusters(bbox, zoom);
  }

  public getLeaves(clusterId: number, limit = 10, offset = 0) {
    return this.index.getLeaves(clusterId, limit, offset);
  }

  public getExpansionZoom(clusterId: number) {
    return this.index.getClusterExpansionZoom(clusterId);
  }
}
