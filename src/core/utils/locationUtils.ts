/**
 * LOCATION UTILITIES
 * Distance calculation and location filtering
 */

export interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Filter items by distance from a location
 */
export function filterByDistance<T extends { latitude: number; longitude: number }>(
  items: T[],
  centerLat: number,
  centerLon: number,
  radiusKm: number,
): T[] {
  return items.filter((item) => {
    const distance = calculateDistance(centerLat, centerLon, item.latitude, item.longitude);
    return distance <= radiusKm;
  });
}

/**
 * Sort items by distance from a location
 */
export function sortByDistance<T extends { latitude: number; longitude: number }>(
  items: T[],
  centerLat: number,
  centerLon: number,
): T[] {
  return [...items].sort((a, b) => {
    const distA = calculateDistance(centerLat, centerLon, a.latitude, a.longitude);
    const distB = calculateDistance(centerLat, centerLon, b.latitude, b.longitude);
    return distA - distB;
  });
}

/**
 * Get location name (reverse geocoding)
 * For production: Integrate with reverse geocoding API (Google Maps, Nominatim, etc.)
 * Current: Simplified version using approximate city detection
 */
export function getLocationName(lat: number, lon: number): string {
  // Major Turkey cities with approximate coordinates
  const cities = [
    { name: 'İstanbul', lat: 41.0082, lon: 28.9784, radius: 100 },
    { name: 'Ankara', lat: 39.9334, lon: 32.8597, radius: 80 },
    { name: 'İzmir', lat: 38.4237, lon: 27.1428, radius: 80 },
    { name: 'Antalya', lat: 36.8969, lon: 30.7133, radius: 60 },
    { name: 'Bursa', lat: 40.1826, lon: 29.0665, radius: 60 },
    { name: 'Adana', lat: 37.0000, lon: 35.3213, radius: 60 },
    { name: 'Gaziantep', lat: 37.0662, lon: 37.3833, radius: 50 },
    { name: 'Konya', lat: 37.8713, lon: 32.4846, radius: 70 },
  ];

  // Find closest city within radius
  for (const city of cities) {
    const distance = calculateDistance(lat, lon, city.lat, city.lon);
    if (distance < city.radius) {
      return city.name;
    }
  }
  
  // Default to "Türkiye" if no city match
  return 'Türkiye';
}

/**
 * Istanbul center coordinates
 */
export const ISTANBUL_CENTER: Location = {
  latitude: 41.0082,
  longitude: 28.9784,
};

