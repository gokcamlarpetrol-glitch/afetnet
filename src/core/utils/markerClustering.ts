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
 * Cluster markers using Supercluster
 */
export function clusterMarkers(
  markers: ClusterableMarker[],
  zoomLevel: number,
  minDistance: number = 40, // pixels approx, supercluster uses 40 default
): (ClusterableMarker | Cluster)[] {

  // Supercluster instance
  const index = new Supercluster({
    radius: minDistance,
    maxZoom: 16,
  });

  // Convert to GeoJSON
  const points = markers.map(m => ({
    type: 'Feature' as const,
    properties: { cluster: false, ...m },
    geometry: {
      type: 'Point' as const,
      coordinates: [m.longitude, m.latitude],
    },
  }));

  try {
    index.load(points);

    // Get clusters for the whole world
    // In a real app with millions of points, we would pass the current BBox
    // But for < 10k points, clustering all is fine and simplifies state
    const clusters = index.getClusters([-180, -90, 180, 90], Math.floor(zoomLevel));

    // Map back to our flat structure
    return clusters.map(c => {
      const props = c.properties;

      if (props.cluster) {
        return {
          id: `cluster-${c.id}`,
          latitude: c.geometry.coordinates[1],
          longitude: c.geometry.coordinates[0],
          point_count: props.point_count,
          count: props.point_count,
          // expansionZoom: index.getClusterExpansionZoom(c.id as number),
        } as Cluster;
      }

      // Return original marker with its properties
      return {
        ...props,
        latitude: c.geometry.coordinates[1],
        longitude: c.geometry.coordinates[0],
      } as ClusterableMarker;
    });

  } catch (error) {
    logger.error('Clustering error:', error);
    return markers; // Fallback
  }
}

/**
 * Check if item is a cluster
 */
export function isCluster(item: unknown): item is Cluster {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (!!obj.point_count || !!obj.count || (typeof obj.id === 'string' && obj.id.startsWith('cluster-')));
}

/**
 * Get zoom level from region
 */
export function getZoomLevel(latitudeDelta: number): number {
  // Approximate zoom level calculation
  return Math.round(Math.log(360 / latitudeDelta) / Math.LN2);
}
