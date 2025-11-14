/**
 * Distance Calculation Utilities
 * Haversine formula for calculating distances between coordinates
 */

/**
 * Calculate distance between two coordinates in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if earthquake is within radius of user location
 */
export function isWithinRadius(
  eqLat: number,
  eqLon: number,
  userLat: number,
  userLon: number,
  radiusKm: number
): boolean {
  const distance = calculateDistance(eqLat, eqLon, userLat, userLon);
  return distance <= radiusKm;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}









