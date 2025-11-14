/**
 * VIEWPORT UTILITIES
 * Elite: Viewport-based data loading and optimization
 */

export interface ViewportBounds {
  northEast: { latitude: number; longitude: number };
  southWest: { latitude: number; longitude: number };
}

export interface ViewportRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Calculate viewport bounds from region
 */
export function getViewportBounds(region: ViewportRegion): ViewportBounds {
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
  
  return {
    northEast: {
      latitude: latitude + latitudeDelta / 2,
      longitude: longitude + longitudeDelta / 2,
    },
    southWest: {
      latitude: latitude - latitudeDelta / 2,
      longitude: longitude - longitudeDelta / 2,
    },
  };
}

/**
 * Check if point is within viewport bounds
 */
export function isPointInViewport(
  point: { latitude: number; longitude: number },
  bounds: ViewportBounds
): boolean {
  return (
    point.latitude >= bounds.southWest.latitude &&
    point.latitude <= bounds.northEast.latitude &&
    point.longitude >= bounds.southWest.longitude &&
    point.longitude <= bounds.northEast.longitude
  );
}

/**
 * Filter markers by viewport (for performance)
 */
export function filterByViewport<T extends { latitude: number; longitude: number }>(
  items: T[],
  bounds: ViewportBounds
): T[] {
  return items.filter(item => isPointInViewport(item, bounds));
}

/**
 * Calculate zoom level from latitudeDelta
 */
export function getZoomFromDelta(latitudeDelta: number): number {
  return Math.round(Math.log(360 / latitudeDelta) / Math.LN2);
}

/**
 * Calculate optimal cluster distance based on zoom
 */
export function getClusterDistance(zoom: number): number {
  // Smaller distance at higher zoom levels
  if (zoom >= 15) return 0.01; // ~1km
  if (zoom >= 12) return 0.05; // ~5km
  if (zoom >= 10) return 0.1; // ~10km
  return 0.2; // ~20km
}









