/**
 * MARKER CLUSTERING UTILITY
 * Simple and efficient marker clustering for map performance
 */

export interface ClusterableMarker {
  id: string;
  latitude: number;
  longitude: number;
  [key: string]: any;
}

export interface Cluster {
  id: string;
  latitude: number;
  longitude: number;
  markers: ClusterableMarker[];
  count: number;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Cluster markers based on distance and zoom level
 */
export function clusterMarkers(
  markers: ClusterableMarker[],
  zoomLevel: number,
  minDistance: number = 0.05 // km
): (ClusterableMarker | Cluster)[] {
  // Don't cluster if zoom level is high (user is zoomed in)
  if (zoomLevel > 12) {
    return markers;
  }

  // Adjust cluster distance based on zoom level
  const clusterDistance = minDistance * (13 - zoomLevel);

  const clusters: Cluster[] = [];
  const processed = new Set<string>();

  markers.forEach((marker) => {
    if (processed.has(marker.id)) return;

    // Find nearby markers
    const nearbyMarkers = markers.filter((m) => {
      if (m.id === marker.id || processed.has(m.id)) return false;

      const distance = calculateDistance(
        marker.latitude,
        marker.longitude,
        m.latitude,
        m.longitude
      );

      return distance < clusterDistance;
    });

    if (nearbyMarkers.length > 0) {
      // Create cluster
      const clusterMarkers = [marker, ...nearbyMarkers];
      
      // Calculate cluster center (average position)
      const avgLat =
        clusterMarkers.reduce((sum, m) => sum + m.latitude, 0) /
        clusterMarkers.length;
      const avgLon =
        clusterMarkers.reduce((sum, m) => sum + m.longitude, 0) /
        clusterMarkers.length;

      clusters.push({
        id: `cluster-${marker.id}`,
        latitude: avgLat,
        longitude: avgLon,
        markers: clusterMarkers,
        count: clusterMarkers.length,
      });

      // Mark as processed
      clusterMarkers.forEach((m) => processed.add(m.id));
    } else {
      // Single marker, no clustering needed
      processed.add(marker.id);
    }
  });

  // Return clusters + unclustered markers
  const unclustered = markers.filter((m) => !processed.has(m.id));
  return [...clusters, ...unclustered];
}

/**
 * Check if item is a cluster
 */
export function isCluster(item: any): item is Cluster {
  return 'count' in item && 'markers' in item;
}

/**
 * Get zoom level from region
 */
export function getZoomLevel(latitudeDelta: number): number {
  // Approximate zoom level calculation
  return Math.round(Math.log(360 / latitudeDelta) / Math.LN2);
}


