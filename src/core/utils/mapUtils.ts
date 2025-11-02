/**
 * MAP UTILITIES
 * Utilities for map calculations and operations
 */

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Check if coordinates are within Turkey bounds
 */
export function isInTurkey(lat: number, lng: number): boolean {
  return lat >= 36 && lat <= 42 && lng >= 26 && lng <= 45;
}

/**
 * Get closest earthquake to user location
 */
export function getClosestEarthquake(
  userLat: number,
  userLng: number,
  earthquakes: Array<{ latitude: number; longitude: number; magnitude: number; id: string }>
): { earthquake: any; distance: number } | null {
  if (earthquakes.length === 0) return null;

  let closest = earthquakes[0];
  let minDistance = calculateDistance(userLat, userLng, closest.latitude, closest.longitude);

  for (let i = 1; i < earthquakes.length; i++) {
    const distance = calculateDistance(
      userLat,
      userLng,
      earthquakes[i].latitude,
      earthquakes[i].longitude
    );

    if (distance < minDistance) {
      minDistance = distance;
      closest = earthquakes[i];
    }
  }

  return { earthquake: closest, distance: minDistance };
}

/**
 * Calculate ETA for earthquake wave
 * @param distance Distance in km
 * @param waveSpeed Wave speed in km/s (P-wave: ~6 km/s, S-wave: ~3.5 km/s)
 * @returns ETA in seconds
 */
export function calculateETA(distance: number, waveSpeed: number = 3.5): number {
  return distance / waveSpeed;
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km`;
  }
  return `${Math.round(distanceKm)} km`;
}

/**
 * Get magnitude color for map markers
 */
export function getMagnitudeColor(magnitude: number): string {
  if (magnitude >= 7.0) return '#8B0000'; // Dark red - Major
  if (magnitude >= 6.0) return '#DC143C'; // Crimson - Strong
  if (magnitude >= 5.0) return '#FF4500'; // Orange red - Moderate
  if (magnitude >= 4.0) return '#FFA500'; // Orange - Light
  if (magnitude >= 3.0) return '#FFD700'; // Gold - Minor
  return '#FFFF00'; // Yellow - Micro
}

/**
 * Get magnitude size for map markers
 */
export function getMagnitudeSize(magnitude: number): number {
  if (magnitude >= 7.0) return 50;
  if (magnitude >= 6.0) return 40;
  if (magnitude >= 5.0) return 32;
  if (magnitude >= 4.0) return 24;
  if (magnitude >= 3.0) return 18;
  return 14;
}

/**
 * Calculate bounds for map region
 */
export function calculateMapBounds(
  points: Array<{ latitude: number; longitude: number }>
): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} | null {
  if (points.length === 0) return null;

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;

  points.forEach((point) => {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude);
    maxLng = Math.max(maxLng, point.longitude);
  });

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = (maxLat - minLat) * 1.5; // Add 50% padding
  const longitudeDelta = (maxLng - minLng) * 1.5;

  return {
    latitude,
    longitude,
    latitudeDelta: Math.max(latitudeDelta, 0.1), // Minimum delta
    longitudeDelta: Math.max(longitudeDelta, 0.1),
  };
}


