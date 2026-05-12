/**
 * MARKER CLUSTERING UTILITY
 * Efficient clustering using Supercluster (O(N log N))
 */

import Supercluster from 'supercluster';
import { createLogger } from './logger';

const logger = createLogger('MarkerClustering');

export interface ClusterableMarker {
  id: string;
  latitude: number;
  longitude: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Required for dynamic marker properties from supercluster
}

export interface Cluster {
  id: string;
  latitude: number;
  longitude: number;
  point_count: number;
  count: number; // Backward compatibility
  // markers array is removed for performance as supercluster doesn't provide it cheaply
}

/**
 * Create a reusable Supercluster index from markers.
 * Call this once when data changes, then call getClustersAtZoom on pan/zoom.
 */
export function createClusterIndex(
  markers: ClusterableMarker[],
  minDistance: number = 40,
): Supercluster {
  const index = new Supercluster({
    radius: minDistance,
    maxZoom: 16,
  });

  const points = markers.map(m => ({
    type: 'Feature' as const,
    properties: { cluster: false, ...m },
    geometry: {
      type: 'Point' as const,
      coordinates: [m.longitude, m.latitude],
    },
  }));

  index.load(points);
  return index;
}

/**
 * Get clusters from a pre-built index at a given zoom level.
 * This is O(log N) — safe to call on every pan/zoom.
 */
export function getClustersAtZoom(
  index: Supercluster | null,
  zoomLevel: number,
  fallbackMarkers: ClusterableMarker[],
): (ClusterableMarker | Cluster)[] {
  if (!index) return fallbackMarkers;

  try {
    const clusters = index.getClusters([-180, -90, 180, 90], Math.floor(zoomLevel));

    return clusters.map(c => {
      const props = c.properties;

      if (props.cluster) {
        return {
          id: `cluster-${c.id}`,
          latitude: c.geometry.coordinates[1],
          longitude: c.geometry.coordinates[0],
          point_count: props.point_count,
          count: props.point_count,
        } as Cluster;
      }

      return {
        ...props,
        latitude: c.geometry.coordinates[1],
        longitude: c.geometry.coordinates[0],
      } as ClusterableMarker;
    });
  } catch (error) {
    logger.error('Clustering error:', error);
    return fallbackMarkers;
  }
}

/**
 * Cluster markers using Supercluster (convenience wrapper).
 * For repeated zoom changes on the same data, prefer createClusterIndex + getClustersAtZoom.
 */
export function clusterMarkers(
  markers: ClusterableMarker[],
  zoomLevel: number,
  minDistance: number = 40,
): (ClusterableMarker | Cluster)[] {
  const index = createClusterIndex(markers, minDistance);
  return getClustersAtZoom(index, zoomLevel, markers);
}

/**
 * Check if item is a cluster
 */
export function isCluster(item: unknown): item is Cluster {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (typeof obj.point_count === 'number' && obj.point_count > 0) ||
    (typeof obj.id === 'string' && obj.id.startsWith('cluster-'));
}

/**
 * Get zoom level from region
 */
export function getZoomLevel(latitudeDelta: number): number {
  // Approximate zoom level calculation
  return Math.round(Math.log(360 / latitudeDelta) / Math.LN2);
}
