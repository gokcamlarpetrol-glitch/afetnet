/**
 * IMPACT PREDICTION SERVICE
 * ShakeMap-like impact zone prediction for earthquakes
 * Calculates expected damage, infrastructure risk, and estimated casualties
 */

import { createLogger } from '../utils/logger';
import { calculateDistance } from '../utils/mapUtils';

const logger = createLogger('ImpactPredictionService');

export interface ImpactZone {
  epicenter: {
    lat: number;
    lng: number;
  };
  magnitude: number;
  depth: number;
  
  impactCircles: ImpactCircle[];
  
  infrastructureRisk: {
    hospitals: number;
    schools: number;
    bridges: number;
    dams: number;
    airports: number;
    powerPlants: number;
  };
  
  estimatedCasualties: {
    min: number;
    max: number;
    mostLikely: number;
  };
  
  responseTime: number; // seconds - estimated time for first responders
  
  severity: 'minimal' | 'light' | 'moderate' | 'severe' | 'catastrophic';
}

export interface ImpactCircle {
  radius: number; // km
  intensity: number; // Modified Mercalli Intensity (1-10)
  expectedDamage: 'minimal' | 'light' | 'moderate' | 'severe' | 'catastrophic';
  population: number;
  buildingsAffected: number;
  description: string;
}

// Simplified infrastructure database (in production, from API or database)
const INFRASTRUCTURE_DATABASE: Record<string, Array<{ lat: number; lng: number; type: string }>> = {
  // Istanbul
  'istanbul': [
    { lat: 41.0082, lng: 28.9784, type: 'hospital' }, // Marmara Üniversitesi
    { lat: 41.0151, lng: 28.9799, type: 'hospital' }, // Cerrahpaşa
    { lat: 41.0186, lng: 28.9647, type: 'hospital' }, // Şişli Etfal
    { lat: 41.0389, lng: 28.9866, type: 'school' }, // Galatasaray Lisesi
    { lat: 41.0522, lng: 28.9789, type: 'bridge' }, // Boğaziçi Köprüsü
    { lat: 41.0439, lng: 28.9978, type: 'bridge' }, // Fatih Sultan Mehmet Köprüsü
    { lat: 41.0082, lng: 28.9784, type: 'airport' }, // Atatürk Airport (old)
    { lat: 41.2622, lng: 28.7272, type: 'airport' }, // İstanbul Airport
  ],
};

class ImpactPredictionService {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    if (__DEV__) {
      logger.info('Impact Prediction Service initialized');
    }
    
    this.isInitialized = true;
  }

  async predictImpact(
    epicenterLat: number,
    epicenterLng: number,
    magnitude: number,
    depth: number = 10,
  ): Promise<ImpactZone> {
    try {
      // Calculate impact circles
      const impactCircles = this.calculateImpactCircles(
        epicenterLat,
        epicenterLng,
        magnitude,
        depth,
      );
      
      // Calculate infrastructure risk
      const infrastructureRisk = await this.calculateInfrastructureRisk(
        epicenterLat,
        epicenterLng,
        magnitude,
        impactCircles,
      );
      
      // Estimate casualties
      const estimatedCasualties = this.estimateCasualties(
        magnitude,
        impactCircles,
      );
      
      // Estimate response time
      const responseTime = this.estimateResponseTime(magnitude);
      
      // Determine overall severity
      const severity = this.determineSeverity(magnitude, impactCircles);
      
      const impactZone: ImpactZone = {
        epicenter: {
          lat: epicenterLat,
          lng: epicenterLng,
        },
        magnitude,
        depth,
        impactCircles,
        infrastructureRisk,
        estimatedCasualties,
        responseTime,
        severity,
      };
      
      return impactZone;
    } catch (error) {
      logger.error('Impact prediction error:', error);
      // Return minimal impact on error
      return this.getMinimalImpact(epicenterLat, epicenterLng, magnitude, depth);
    }
  }

  private calculateImpactCircles(
    epicenterLat: number,
    epicenterLng: number,
    magnitude: number,
    depth: number,
  ): ImpactCircle[] {
    const circles: ImpactCircle[] = [];
    
    // Calculate intensity based on magnitude and distance
    // Using simplified attenuation relationship
    const calculateIntensity = (distanceKm: number): number => {
      // Simplified: intensity decreases with distance
      // Real formula would consider magnitude, depth, soil type
      const baseIntensity = magnitude * 1.5; // Base intensity at epicenter
      const attenuation = distanceKm / 50; // Intensity decreases by 1 per 50km
      return Math.max(1, Math.min(10, baseIntensity - attenuation));
    };
    
    // Severe zone (MMI 9-10)
    const severeRadius = magnitude * 5; // 5km per magnitude unit
    circles.push({
      radius: severeRadius,
      intensity: calculateIntensity(severeRadius / 2),
      expectedDamage: 'severe',
      population: Math.round(magnitude * 50000),
      buildingsAffected: Math.round(magnitude * 10000),
      description: 'Ağır hasar: Binaların çoğu yıkılabilir',
    });
    
    // Moderate zone (MMI 7-8)
    const moderateRadius = magnitude * 15;
    circles.push({
      radius: moderateRadius,
      intensity: calculateIntensity(moderateRadius / 2),
      expectedDamage: 'moderate',
      population: Math.round(magnitude * 150000),
      buildingsAffected: Math.round(magnitude * 30000),
      description: 'Orta hasar: Bazı binalarda ağır hasar',
    });
    
    // Light zone (MMI 5-6)
    const lightRadius = magnitude * 30;
    circles.push({
      radius: lightRadius,
      intensity: calculateIntensity(lightRadius / 2),
      expectedDamage: 'light',
      population: Math.round(magnitude * 300000),
      buildingsAffected: Math.round(magnitude * 50000),
      description: 'Hafif hasar: Sınırlı yapısal hasar',
    });
    
    // Minimal zone (MMI 3-4)
    const minimalRadius = magnitude * 50;
    circles.push({
      radius: minimalRadius,
      intensity: calculateIntensity(minimalRadius / 2),
      expectedDamage: 'minimal',
      population: Math.round(magnitude * 500000),
      buildingsAffected: 0,
      description: 'Minimal hasar: Hissedilen ama hasar yok',
    });
    
    return circles;
  }

  private async calculateInfrastructureRisk(
    epicenterLat: number,
    epicenterLng: number,
    magnitude: number,
    impactCircles: ImpactCircle[],
  ): Promise<ImpactZone['infrastructureRisk']> {
    // Get city name (simplified)
    const city = this.getCityName(epicenterLat, epicenterLng);
    const infrastructure = INFRASTRUCTURE_DATABASE[city] || [];
    
    const risk = {
      hospitals: 0,
      schools: 0,
      bridges: 0,
      dams: 0,
      airports: 0,
      powerPlants: 0,
    };
    
    // Check each infrastructure item
    for (const item of infrastructure) {
      const distance = calculateDistance(
        epicenterLat,
        epicenterLng,
        item.lat,
        item.lng,
      );
      
      // Check if within impact radius
      const severeRadius = magnitude * 5;
      const moderateRadius = magnitude * 15;
      
      if (distance <= severeRadius) {
        // Severe zone - high risk
        if (item.type === 'hospital') risk.hospitals++;
        else if (item.type === 'school') risk.schools++;
        else if (item.type === 'bridge') risk.bridges++;
        else if (item.type === 'dam') risk.dams++;
        else if (item.type === 'airport') risk.airports++;
        else if (item.type === 'powerPlant') risk.powerPlants++;
      } else if (distance <= moderateRadius) {
        // Moderate zone - medium risk (counted as 0.5)
        // Simplified: only count if magnitude is high
        if (magnitude >= 6.0) {
          if (item.type === 'hospital') risk.hospitals++;
          else if (item.type === 'school') risk.schools++;
          else if (item.type === 'bridge') risk.bridges++;
        }
      }
    }
    
    return risk;
  }

  private estimateCasualties(
    magnitude: number,
    impactCircles: ImpactCircle[],
  ): { min: number; max: number; mostLikely: number } {
    // Simplified casualty estimation
    // Real models consider building types, population density, time of day
    
    let totalMin = 0;
    let totalMax = 0;
    let totalMostLikely = 0;
    
    for (const circle of impactCircles) {
      if (circle.expectedDamage === 'severe' || circle.expectedDamage === 'catastrophic') {
        // Severe damage: 1-5% casualty rate
        const minRate = 0.01;
        const maxRate = 0.05;
        const mostLikelyRate = 0.02;
        
        totalMin += Math.round(circle.population * minRate);
        totalMax += Math.round(circle.population * maxRate);
        totalMostLikely += Math.round(circle.population * mostLikelyRate);
      } else if (circle.expectedDamage === 'moderate') {
        // Moderate damage: 0.1-1% casualty rate
        const minRate = 0.001;
        const maxRate = 0.01;
        const mostLikelyRate = 0.003;
        
        totalMin += Math.round(circle.population * minRate);
        totalMax += Math.round(circle.population * maxRate);
        totalMostLikely += Math.round(circle.population * mostLikelyRate);
      }
    }
    
    return {
      min: totalMin,
      max: totalMax,
      mostLikely: totalMostLikely,
    };
  }

  private estimateResponseTime(magnitude: number): number {
    // Response time in seconds
    // Larger earthquakes = more affected areas = longer response time
    
    if (magnitude >= 7.0) {
      return 600; // 10 minutes - catastrophic
    } else if (magnitude >= 6.0) {
      return 300; // 5 minutes - severe
    } else if (magnitude >= 5.0) {
      return 180; // 3 minutes - moderate
    } else {
      return 120; // 2 minutes - light
    }
  }

  private determineSeverity(
    magnitude: number,
    impactCircles: ImpactCircle[],
  ): 'minimal' | 'light' | 'moderate' | 'severe' | 'catastrophic' {
    if (magnitude >= 7.5) {
      return 'catastrophic';
    } else if (magnitude >= 6.5) {
      return 'severe';
    } else if (magnitude >= 5.5) {
      return 'moderate';
    } else if (magnitude >= 4.5) {
      return 'light';
    } else {
      return 'minimal';
    }
  }

  private getCityName(lat: number, lng: number): string {
    // Simplified city detection
    if (lat >= 41.0 && lat <= 41.3 && lng >= 28.6 && lng <= 29.3) {
      return 'istanbul';
    }
    if (lat >= 39.8 && lat <= 40.0 && lng >= 32.7 && lng <= 33.0) {
      return 'ankara';
    }
    if (lat >= 38.35 && lat <= 38.5 && lng >= 27.0 && lng <= 27.2) {
      return 'izmir';
    }
    return 'unknown';
  }

  private getMinimalImpact(
    epicenterLat: number,
    epicenterLng: number,
    magnitude: number,
    depth: number,
  ): ImpactZone {
    return {
      epicenter: { lat: epicenterLat, lng: epicenterLng },
      magnitude,
      depth,
      impactCircles: [],
      infrastructureRisk: {
        hospitals: 0,
        schools: 0,
        bridges: 0,
        dams: 0,
        airports: 0,
        powerPlants: 0,
      },
      estimatedCasualties: { min: 0, max: 0, mostLikely: 0 },
      responseTime: 120,
      severity: 'minimal',
    };
  }
}

export const impactPredictionService = new ImpactPredictionService();

