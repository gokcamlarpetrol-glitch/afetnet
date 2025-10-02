export interface Location {
  latitude: number;
  longitude: number;
}

export interface LocationWithAccuracy extends Location {
  accuracy: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeoResult {
  distance: number; // in kilometers
  bearing: number; // in degrees
}

export class GeoUtils {
  private static readonly EARTH_RADIUS_KM = 6371;
  private static readonly EARTH_RADIUS_M = 6371000;

  /**
   * Calculate distance between two points using Haversine formula
   */
  static calculateDistance(point1: Location, point2: Location): number {
    const lat1Rad = (point1.latitude * Math.PI) / 180;
    const lat2Rad = (point2.latitude * Math.PI) / 180;
    const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLonRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return this.EARTH_RADIUS_KM * c;
  }

  /**
   * Calculate bearing between two points
   */
  static calculateBearing(point1: Location, point2: Location): number {
    const lat1Rad = (point1.latitude * Math.PI) / 180;
    const lat2Rad = (point2.latitude * Math.PI) / 180;
    const deltaLonRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);

    let bearing = Math.atan2(y, x);
    bearing = (bearing * 180) / Math.PI;
    bearing = (bearing + 360) % 360;

    return bearing;
  }

  /**
   * Get distance and bearing between two points
   */
  static getDistanceAndBearing(point1: Location, point2: Location): GeoResult {
    return {
      distance: this.calculateDistance(point1, point2),
      bearing: this.calculateBearing(point1, point2),
    };
  }

  /**
   * Check if a point is within a certain radius of another point
   */
  static isWithinRadius(center: Location, point: Location, radiusKm: number): boolean {
    return this.calculateDistance(center, point) <= radiusKm;
  }

  /**
   * Calculate bounding box around a center point
   */
  static getBoundingBox(center: Location, radiusKm: number): BoundingBox {
    const latDelta = (radiusKm / this.EARTH_RADIUS_KM) * (180 / Math.PI);
    const lonDelta = latDelta / Math.cos((center.latitude * Math.PI) / 180);

    return {
      north: center.latitude + latDelta,
      south: center.latitude - latDelta,
      east: center.longitude + lonDelta,
      west: center.longitude - lonDelta,
    };
  }

  /**
   * Calculate approximate heading direction (N, NE, E, SE, S, SW, W, NW)
   */
  static getHeadingDirection(bearing: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  /**
   * Format distance for display
   */
  static formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    } else if (distanceKm < 10) {
      return `${distanceKm.toFixed(1)}km`;
    } else {
      return `${Math.round(distanceKm)}km`;
    }
  }

  /**
   * Calculate approximate walking time (assuming 5 km/h average)
   */
  static getWalkingTime(distanceKm: number): number {
    return (distanceKm / 5) * 60; // in minutes
  }

  /**
   * Calculate approximate driving time (assuming 30 km/h average in city)
   */
  static getDrivingTime(distanceKm: number): number {
    return (distanceKm / 30) * 60; // in minutes
  }

  /**
   * Add jitter to location for privacy (approximate location)
   */
  static addLocationJitter(location: Location, radiusMeters: number = 100): Location {
    // Convert radius to degrees (approximate)
    const radiusDegrees = radiusMeters / 111000; // 1 degree ≈ 111km

    // Generate random offset within radius
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusDegrees;

    const latOffset = distance * Math.cos(angle);
    const lonOffset = distance * Math.sin(angle) / Math.cos((location.latitude * Math.PI) / 180);

    return {
      latitude: location.latitude + latOffset,
      longitude: location.longitude + lonOffset,
    };
  }

  /**
   * Check if two locations are approximately the same (within accuracy threshold)
   */
  static isSameLocation(
    location1: LocationWithAccuracy,
    location2: LocationWithAccuracy,
    thresholdMeters: number = 50
  ): boolean {
    const distance = this.calculateDistance(location1, location2) * 1000; // Convert to meters
    const accuracyThreshold = Math.max(location1.accuracy, location2.accuracy, thresholdMeters);
    
    return distance <= accuracyThreshold;
  }

  /**
   * Sort locations by distance from a center point
   */
  static sortByDistance<T extends Location>(center: Location, locations: T[]): T[] {
    return locations.sort((a, b) => {
      const distanceA = this.calculateDistance(center, a);
      const distanceB = this.calculateDistance(center, b);
      return distanceA - distanceB;
    });
  }

  /**
   * Filter locations within a certain radius
   */
  static filterByRadius<T extends Location>(
    center: Location,
    locations: T[],
    radiusKm: number
  ): T[] {
    return locations.filter(location => this.isWithinRadius(center, location, radiusKm));
  }

  /**
   * Calculate center point of multiple locations
   */
  static calculateCenter(locations: Location[]): Location {
    if (locations.length === 0) {
      throw new Error('Cannot calculate center of empty location array');
    }

    let totalLat = 0;
    let totalLon = 0;

    locations.forEach(location => {
      totalLat += location.latitude;
      totalLon += location.longitude;
    });

    return {
      latitude: totalLat / locations.length,
      longitude: totalLon / locations.length,
    };
  }

  /**
   * Validate if coordinates are within reasonable bounds
   */
  static isValidLocation(location: Location): boolean {
    return (
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  /**
   * Check if location is within Istanbul bounds (approximate)
   */
  static isInIstanbul(location: Location): boolean {
    // Istanbul approximate bounds
    const istanbulBounds: BoundingBox = {
      north: 41.2,
      south: 40.8,
      east: 29.3,
      west: 28.5,
    };

    return (
      location.latitude >= istanbulBounds.south &&
      location.latitude <= istanbulBounds.north &&
      location.longitude >= istanbulBounds.west &&
      location.longitude <= istanbulBounds.east
    );
  }

  /**
   * Get simple routing instructions (heading only)
   */
  static getRoutingInstructions(from: Location, to: Location): {
    distance: number;
    bearing: number;
    direction: string;
    instructions: string;
  } {
    const distance = this.calculateDistance(from, to);
    const bearing = this.calculateBearing(from, to);
    const direction = this.getHeadingDirection(bearing);

    let instructions = `${direction} yönünde ${this.formatDistance(distance)} mesafe`;
    
    if (distance < 0.1) {
      instructions = 'Çok yakın mesafe';
    } else if (distance < 0.5) {
      instructions = `Yürüyerek ${Math.round(this.getWalkingTime(distance))} dakika`;
    } else {
      instructions = `Araçla yaklaşık ${Math.round(this.getDrivingTime(distance))} dakika`;
    }

    return {
      distance,
      bearing,
      direction,
      instructions,
    };
  }
}
