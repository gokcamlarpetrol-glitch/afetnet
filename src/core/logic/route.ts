import { ShelterRepository } from '../data/repositories';

export interface RouteStep {
  instruction: string;
  bearing: number; // degrees from north
  distance: number; // meters
  estimatedTime: number; // minutes
}

export interface RouteInfo {
  totalDistance: number; // meters
  totalTime: number; // minutes
  steps: RouteStep[];
  destination: {
    name: string;
    latitude: number;
    longitude: number;
    capacity: number;
    isOpen: boolean;
  };
}

export interface Location {
  latitude: number;
  longitude: number;
}

export class LightweightRouter {
  private static instance: LightweightRouter;

  private constructor() {}

  static getInstance(): LightweightRouter {
    if (!LightweightRouter.instance) {
      LightweightRouter.instance = new LightweightRouter();
    }
    return LightweightRouter.instance;
  }

  async getStepHints(from: Location, to: Location): Promise<RouteStep[]> {
    try {
      const distance = this.calculateDistance(from, to);
      const bearing = this.calculateBearing(from, to);
      
      // Generate step hints based on distance and bearing
      const steps = this.generateStepHints(from, to, distance, bearing);
      
      return steps;
    } catch (error) {
      console.error('Failed to generate route steps:', error);
      return [];
    }
  }

  async getRouteToNearestShelter(from: Location): Promise<RouteInfo | null> {
    try {
      // Get all shelters
      const shelters = await ShelterRepository.getAll();
      
      if (shelters.length === 0) {
        return null;
      }

      // Find nearest open shelter
      let nearestShelter = null;
      let shortestDistance = Infinity;

      for (const shelter of shelters) {
        if (!shelter.open) {
          continue; // Skip closed shelters
        }

        const distance = this.calculateDistance(from, {
          latitude: shelter.lat,
          longitude: shelter.lon,
        });

        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestShelter = shelter;
        }
      }

      if (!nearestShelter) {
        return null;
      }

      // Generate route to nearest shelter
      const destination = {
        latitude: nearestShelter.lat,
        longitude: nearestShelter.lon,
      };

      const steps = await this.getStepHints(from, destination);
      const totalTime = this.estimateWalkingTime(shortestDistance);

      return {
        totalDistance: shortestDistance,
        totalTime,
        steps,
        destination: {
          name: nearestShelter.name,
          latitude: nearestShelter.lat,
          longitude: nearestShelter.lon,
          capacity: nearestShelter.capacity,
          isOpen: nearestShelter.open,
        },
      };
    } catch (error) {
      console.error('Failed to get route to nearest shelter:', error);
      return null;
    }
  }

  private generateStepHints(
    from: Location,
    to: Location,
    totalDistance: number,
    bearing: number
  ): RouteStep[] {
    const steps: RouteStep[] = [];
    const distance = totalDistance;

    // For short distances, provide simple instructions
    if (distance < 100) {
      steps.push({
        instruction: this.getBearingInstruction(bearing, 'direct'),
        bearing,
        distance,
        estimatedTime: Math.ceil(distance / 80), // ~80 m/min walking speed
      });
      return steps;
    }

    // For longer distances, break into segments
    const segmentDistance = 200; // 200m segments
    const numSegments = Math.ceil(distance / segmentDistance);
    
    let remainingDistance = distance;
    let currentLocation = { ...from };

    for (let i = 0; i < numSegments && remainingDistance > 0; i++) {
      const segmentDist = Math.min(segmentDistance, remainingDistance);
      
      // Calculate intermediate point
      const intermediatePoint = this.calculateIntermediatePoint(
        currentLocation,
        bearing,
        segmentDist
      );

      const segmentBearing = this.calculateBearing(currentLocation, intermediatePoint);
      
      steps.push({
        instruction: this.getBearingInstruction(segmentBearing, i === 0 ? 'start' : 'continue'),
        bearing: segmentBearing,
        distance: segmentDist,
        estimatedTime: Math.ceil(segmentDist / 80),
      });

      remainingDistance -= segmentDist;
      currentLocation = intermediatePoint;
    }

    // Add final approach instruction
    if (remainingDistance > 0) {
      const finalBearing = this.calculateBearing(currentLocation, to);
      steps.push({
        instruction: this.getBearingInstruction(finalBearing, 'approach'),
        bearing: finalBearing,
        distance: remainingDistance,
        estimatedTime: Math.ceil(remainingDistance / 80),
      });
    }

    return steps;
  }

  private calculateDistance(from: Location, to: Location): number {
    // Haversine formula for calculating distance between two points
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(to.latitude - from.latitude);
    const dLon = this.toRadians(to.longitude - from.longitude);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(from.latitude)) *
        Math.cos(this.toRadians(to.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  private calculateBearing(from: Location, to: Location): number {
    const dLon = this.toRadians(to.longitude - from.longitude);
    const lat1 = this.toRadians(from.latitude);
    const lat2 = this.toRadians(to.latitude);

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = this.toDegrees(Math.atan2(y, x));
    bearing = (bearing + 360) % 360; // Normalize to 0-360

    return bearing;
  }

  private calculateIntermediatePoint(
    from: Location,
    bearing: number,
    distance: number
  ): Location {
    const R = 6371000; // Earth's radius in meters
    const bearingRad = this.toRadians(bearing);
    const distanceRad = distance / R;

    const lat1 = this.toRadians(from.latitude);
    const lon1 = this.toRadians(from.longitude);

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distanceRad) +
        Math.cos(lat1) * Math.sin(distanceRad) * Math.cos(bearingRad)
    );

    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearingRad) * Math.sin(distanceRad) * Math.cos(lat1),
        Math.cos(distanceRad) - Math.sin(lat1) * Math.sin(lat2)
      );

    return {
      latitude: this.toDegrees(lat2),
      longitude: this.toDegrees(lon2),
    };
  }

  private getBearingInstruction(bearing: number, context: 'start' | 'continue' | 'approach' | 'direct'): string {
    const direction = this.getDirectionFromBearing(bearing);
    
    switch (context) {
      case 'start':
        return `${direction} yönde yürümeye başlayın`;
      case 'continue':
        return `${direction} yönde devam edin`;
      case 'approach':
        return `Hedefe doğru ${direction.toLowerCase()} yönde yaklaşın`;
      case 'direct':
        return `${direction} yönde ${Math.round(bearing)}°`;
      default:
        return `${direction} yönde`;
    }
  }

  private getDirectionFromBearing(bearing: number): string {
    const directions = [
      'Kuzey',
      'Kuzeydoğu',
      'Doğu',
      'Güneydoğu',
      'Güney',
      'Güneybatı',
      'Batı',
      'Kuzeybatı',
    ];

    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  private estimateWalkingTime(distance: number): number {
    // Average walking speed: ~80 meters per minute
    return Math.ceil(distance / 80);
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  // Utility methods for bearing calculations
  getBearingText(bearing: number): string {
    return this.getDirectionFromBearing(bearing);
  }

  getBearingArrow(bearing: number): string {
    const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    const index = Math.round(bearing / 45) % 8;
    return arrows[index];
  }

  formatDistance(distance: number): string {
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    } else {
      const km = distance / 1000;
      return `${km.toFixed(1)}km`;
    }
  }

  formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}dk`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}sa ${remainingMinutes}dk`;
    }
  }
}
