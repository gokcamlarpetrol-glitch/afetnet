/**
 * REGIONAL RISK SERVICE
 * Calculates user-specific risk scores based on location, soil type, building age, etc.
 * Provides personalized risk warnings and recommendations
 */

import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';

const logger = createLogger('RegionalRiskService');

export interface RegionalRisk {
  earthquakeRisk: number; // 0-100
  tsunamiRisk: number; // 0-100
  floodRisk: number; // 0-100
  landslideRisk: number; // 0-100
  fireRisk: number; // 0-100
  overallRisk: number; // 0-100 (weighted average)
  
  factors: RiskFactor[];
  recommendations: string[];
  
  soilType?: 'Z1' | 'Z2' | 'Z3' | 'Z4'; // Z4 = worst
  buildingAge?: number; // Year built
  buildingFloor?: number; // Floor number
  distanceToSea?: number; // km
  distanceToFault?: number; // km
  elevation?: number; // meters
  slope?: number; // degrees
  populationDensity?: number; // per km²
  oldBuildingsRatio?: number; // 0-1 (percentage of old buildings)
}

export interface RiskFactor {
  type: 'earthquake' | 'tsunami' | 'flood' | 'landslide' | 'fire' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string; // "Senin bulunduğun il/bölge için şiddet X+ bekleniyor"
}

// Simplified risk database (in production, this would be from API or database)
const RISK_DATABASE: Record<string, Partial<RegionalRisk>> = {
  // Istanbul districts
  'istanbul_avcilar': {
    earthquakeRisk: 95,
    tsunamiRisk: 80,
    soilType: 'Z4',
    oldBuildingsRatio: 0.65,
    populationDensity: 450000,
    distanceToSea: 2,
    distanceToFault: 5,
  },
  'istanbul_bakirkoy': {
    earthquakeRisk: 90,
    tsunamiRisk: 85,
    soilType: 'Z4',
    oldBuildingsRatio: 0.55,
    populationDensity: 280000,
    distanceToSea: 1,
    distanceToFault: 8,
  },
  'istanbul_kadikoy': {
    earthquakeRisk: 85,
    tsunamiRisk: 75,
    soilType: 'Z3',
    oldBuildingsRatio: 0.60,
    populationDensity: 520000,
    distanceToSea: 3,
    distanceToFault: 10,
  },
  'istanbul_besiktas': {
    earthquakeRisk: 80,
    tsunamiRisk: 70,
    soilType: 'Z3',
    oldBuildingsRatio: 0.50,
    populationDensity: 190000,
    distanceToSea: 2,
    distanceToFault: 12,
  },
  
  // Ankara (lower risk)
  'ankara_cankaya': {
    earthquakeRisk: 45,
    tsunamiRisk: 0,
    floodRisk: 20,
    soilType: 'Z2',
    oldBuildingsRatio: 0.30,
    populationDensity: 920000,
    distanceToSea: 400,
    distanceToFault: 50,
  },
  
  // Izmir (moderate-high risk)
  'izmir_konak': {
    earthquakeRisk: 75,
    tsunamiRisk: 70,
    soilType: 'Z3',
    oldBuildingsRatio: 0.40,
    populationDensity: 350000,
    distanceToSea: 1,
    distanceToFault: 15,
  },
};

class RegionalRiskService {
  private currentRisk: RegionalRisk | null = null;
  private locationWatcher: Location.LocationSubscription | null = null;
  private callbacks: Array<(risk: RegionalRisk) => void> = [];

  async initialize() {
    if (__DEV__) {
      logger.info('Regional Risk Service initialized');
    }
    // Initial risk calculation can be done when location is available
  }

  async calculateRisk(
    latitude: number,
    longitude: number,
    userBuildingAge?: number,
    userBuildingFloor?: number,
  ): Promise<RegionalRisk> {
    try {
      // Get city/district name (reverse geocoding)
      const cityDistrict = await this.getCityDistrict(latitude, longitude);
      
      // Get base risk data
      const baseRisk = RISK_DATABASE[cityDistrict] || this.getDefaultRisk(latitude, longitude);
      
      // Calculate individual risks
      const earthquakeRisk = this.calculateEarthquakeRisk(
        baseRisk,
        latitude,
        longitude,
        userBuildingAge,
        userBuildingFloor,
      );
      
      const tsunamiRisk = this.calculateTsunamiRisk(
        baseRisk,
        latitude,
        longitude,
      );
      
      const floodRisk = this.calculateFloodRisk(
        baseRisk,
        latitude,
        longitude,
      );
      
      const landslideRisk = this.calculateLandslideRisk(
        baseRisk,
        latitude,
        longitude,
      );
      
      const fireRisk = this.calculateFireRisk(
        baseRisk,
        latitude,
        longitude,
      );
      
      // Calculate overall risk (weighted)
      const overallRisk = this.calculateOverallRisk({
        earthquakeRisk,
        tsunamiRisk,
        floodRisk,
        landslideRisk,
        fireRisk,
      });
      
      // Generate factors
      const factors = this.generateRiskFactors({
        earthquakeRisk,
        tsunamiRisk,
        floodRisk,
        landslideRisk,
        fireRisk,
        baseRisk,
        latitude,
        longitude,
        userBuildingAge,
        userBuildingFloor,
      });
      
      // Generate recommendations
      const recommendations = this.generateRecommendations({
        earthquakeRisk,
        tsunamiRisk,
        floodRisk,
        landslideRisk,
        fireRisk,
        baseRisk,
        userBuildingAge,
        userBuildingFloor,
      });
      
      const risk: RegionalRisk = {
        earthquakeRisk,
        tsunamiRisk,
        floodRisk,
        landslideRisk,
        fireRisk,
        overallRisk,
        factors,
        recommendations,
        soilType: baseRisk.soilType,
        buildingAge: userBuildingAge,
        buildingFloor: userBuildingFloor,
        distanceToSea: baseRisk.distanceToSea,
        distanceToFault: baseRisk.distanceToFault,
        elevation: baseRisk.elevation,
        slope: baseRisk.slope,
        populationDensity: baseRisk.populationDensity,
        oldBuildingsRatio: baseRisk.oldBuildingsRatio,
      };
      
      this.currentRisk = risk;
      this.notifyCallbacks(risk);
      
      return risk;
    } catch (error) {
      logger.error('Risk calculation error:', error);
      // Return minimal risk on error
      const defaultRisk: RegionalRisk = {
        earthquakeRisk: 50,
        tsunamiRisk: 0,
        floodRisk: 20,
        landslideRisk: 10,
        fireRisk: 20,
        overallRisk: 25,
        factors: [],
        recommendations: ['Konum bilgisi alınamadı. Lütfen konum izni verin.'],
      };
      return defaultRisk;
    }
  }

  async startLocationMonitoring() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        logger.warn('Location permission not granted');
        return;
      }

      // Watch location changes
      this.locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60000, // Every minute
          distanceInterval: 1000, // Every 1km
        },
        async (location) => {
          await this.calculateRisk(
            location.coords.latitude,
            location.coords.longitude,
          );
        },
      );
    } catch (error) {
      logger.error('Location monitoring error:', error);
    }
  }

  stopLocationMonitoring() {
    if (this.locationWatcher) {
      this.locationWatcher.remove();
      this.locationWatcher = null;
    }
  }

  onRiskUpdate(callback: (risk: RegionalRisk) => void) {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  getCurrentRisk(): RegionalRisk | null {
    return this.currentRisk;
  }

  private async getCityDistrict(lat: number, lng: number): Promise<string> {
    // Simplified reverse geocoding
    // In production, use a proper geocoding service
    
    // Turkey bounding box check
    if (lat >= 41.0 && lat <= 41.3 && lng >= 28.6 && lng <= 29.3) {
      // Istanbul area
      if (lat >= 41.0 && lat <= 41.05 && lng >= 28.8 && lng <= 28.95) {
        return 'istanbul_avcilar';
      }
      if (lat >= 41.03 && lat <= 41.05 && lng >= 28.85 && lng <= 28.9) {
        return 'istanbul_bakirkoy';
      }
      if (lat >= 40.98 && lat <= 41.02 && lng >= 29.0 && lng <= 29.05) {
        return 'istanbul_kadikoy';
      }
      if (lat >= 41.04 && lat <= 41.06 && lng >= 29.0 && lng <= 29.03) {
        return 'istanbul_besiktas';
      }
      return 'istanbul_default';
    }
    
    if (lat >= 39.8 && lat <= 40.0 && lng >= 32.7 && lng <= 33.0) {
      return 'ankara_cankaya';
    }
    
    if (lat >= 38.35 && lat <= 38.5 && lng >= 27.0 && lng <= 27.2) {
      return 'izmir_konak';
    }
    
    return 'unknown';
  }

  private getDefaultRisk(lat: number, lng: number): Partial<RegionalRisk> {
    // Default risk for unknown locations
    return {
      earthquakeRisk: 50,
      tsunamiRisk: lat < 40 ? 30 : 0, // Coastal check
      floodRisk: 20,
      landslideRisk: 10,
      soilType: 'Z2',
      oldBuildingsRatio: 0.40,
      distanceToSea: 50,
      distanceToFault: 30,
    };
  }

  private calculateEarthquakeRisk(
    baseRisk: Partial<RegionalRisk>,
    lat: number,
    lng: number,
    buildingAge?: number,
    buildingFloor?: number,
  ): number {
    let risk = baseRisk.earthquakeRisk || 50;
    
    // Soil type multiplier
    if (baseRisk.soilType === 'Z4') risk += 20;
    else if (baseRisk.soilType === 'Z3') risk += 10;
    else if (baseRisk.soilType === 'Z2') risk += 5;
    
    // Building age factor
    if (buildingAge && buildingAge < 2000) {
      risk += 15; // Old buildings are more vulnerable
    }
    
    // Floor factor (higher floors shake more)
    if (buildingFloor && buildingFloor > 5) {
      risk += 10;
    }
    
    // Distance to fault
    if (baseRisk.distanceToFault) {
      if (baseRisk.distanceToFault < 10) risk += 20;
      else if (baseRisk.distanceToFault < 20) risk += 10;
    }
    
    // Population density (more people = higher impact)
    if (baseRisk.populationDensity && baseRisk.populationDensity > 300000) {
      risk += 5;
    }
    
    return Math.min(100, Math.max(0, risk));
  }

  private calculateTsunamiRisk(
    baseRisk: Partial<RegionalRisk>,
    lat: number,
    lng: number,
  ): number {
    let risk = baseRisk.tsunamiRisk || 0;
    
    // Distance to sea
    if (baseRisk.distanceToSea !== undefined) {
      if (baseRisk.distanceToSea < 1) risk = 90;
      else if (baseRisk.distanceToSea < 3) risk = 70;
      else if (baseRisk.distanceToSea < 5) risk = 50;
      else if (baseRisk.distanceToSea < 10) risk = 30;
      else risk = 0;
    }
    
    // Elevation (lower = higher risk)
    if (baseRisk.elevation !== undefined && baseRisk.elevation < 10) {
      risk += 10;
    }
    
    return Math.min(100, Math.max(0, risk));
  }

  private calculateFloodRisk(
    baseRisk: Partial<RegionalRisk>,
    lat: number,
    lng: number,
  ): number {
    let risk = baseRisk.floodRisk || 20;
    
    // Elevation (lower = higher flood risk)
    if (baseRisk.elevation !== undefined) {
      if (baseRisk.elevation < 5) risk = 80;
      else if (baseRisk.elevation < 20) risk = 50;
      else if (baseRisk.elevation < 100) risk = 30;
      else risk = 10;
    }
    
    // Distance to sea (coastal areas)
    if (baseRisk.distanceToSea !== undefined && baseRisk.distanceToSea < 10) {
      risk += 10;
    }
    
    return Math.min(100, Math.max(0, risk));
  }

  private calculateLandslideRisk(
    baseRisk: Partial<RegionalRisk>,
    lat: number,
    lng: number,
  ): number {
    let risk = baseRisk.landslideRisk || 10;
    
    // Slope factor
    if (baseRisk.slope !== undefined) {
      if (baseRisk.slope > 30) risk = 80;
      else if (baseRisk.slope > 20) risk = 50;
      else if (baseRisk.slope > 10) risk = 30;
      else risk = 10;
    }
    
    // Soil type (soft soil = higher landslide risk)
    if (baseRisk.soilType === 'Z4') risk += 20;
    else if (baseRisk.soilType === 'Z3') risk += 10;
    
    return Math.min(100, Math.max(0, risk));
  }

  private calculateFireRisk(
    baseRisk: Partial<RegionalRisk>,
    lat: number,
    lng: number,
  ): number {
    let risk = baseRisk.fireRisk || 20;
    
    // Population density (more people = more fire risk)
    if (baseRisk.populationDensity) {
      if (baseRisk.populationDensity > 500000) risk += 20;
      else if (baseRisk.populationDensity > 300000) risk += 10;
    }
    
    // Old buildings (more fire risk)
    if (baseRisk.oldBuildingsRatio) {
      if (baseRisk.oldBuildingsRatio > 0.6) risk += 15;
      else if (baseRisk.oldBuildingsRatio > 0.4) risk += 10;
    }
    
    return Math.min(100, Math.max(0, risk));
  }

  private calculateOverallRisk(risks: {
    earthquakeRisk: number;
    tsunamiRisk: number;
    floodRisk: number;
    landslideRisk: number;
    fireRisk: number;
  }): number {
    // Weighted average (earthquake is most important)
    const weights = {
      earthquake: 0.40,
      tsunami: 0.20,
      flood: 0.15,
      landslide: 0.15,
      fire: 0.10,
    };
    
    const overall = 
      risks.earthquakeRisk * weights.earthquake +
      risks.tsunamiRisk * weights.tsunami +
      risks.floodRisk * weights.flood +
      risks.landslideRisk * weights.landslide +
      risks.fireRisk * weights.fire;
    
    return Math.round(overall);
  }

  private generateRiskFactors(params: {
    earthquakeRisk: number;
    tsunamiRisk: number;
    floodRisk: number;
    landslideRisk: number;
    fireRisk: number;
    baseRisk: Partial<RegionalRisk>;
    latitude: number;
    longitude: number;
    userBuildingAge?: number;
    userBuildingFloor?: number;
  }): RiskFactor[] {
    const factors: RiskFactor[] = [];
    
    // Earthquake factors
    if (params.earthquakeRisk >= 80) {
      factors.push({
        type: 'earthquake',
        severity: params.earthquakeRisk >= 90 ? 'critical' : 'high',
        description: 'Yüksek deprem riski bölgesi',
        impact: `Senin bulunduğun bölge için şiddet ${params.earthquakeRisk >= 90 ? '7.5+' : '6.5+'} bekleniyor`,
      });
    }
    
    if (params.baseRisk.soilType === 'Z4') {
      factors.push({
        type: 'earthquake',
        severity: 'critical',
        description: 'Yumuşak zemin - depremde 3x şiddet',
        impact: 'Z4 zemin sınıfı: Depremde şiddet 3 katına çıkar',
      });
    }
    
    if (params.userBuildingAge && params.userBuildingAge < 2000) {
      factors.push({
        type: 'earthquake',
        severity: 'high',
        description: 'Eski bina (1980 öncesi) - çökme riski yüksek',
        impact: '1980 öncesi bina: Deprem yönetmeliği öncesi yapı',
      });
    }
    
    if (params.baseRisk.distanceToFault && params.baseRisk.distanceToFault < 10) {
      factors.push({
        type: 'earthquake',
        severity: 'high',
        description: `Fay hattına ${params.baseRisk.distanceToFault}km - deprem merkez üssü olabilir`,
        impact: 'Yakın fay hattı: Deprem merkez üssü olabilir',
      });
    }
    
    // Tsunami factors
    if (params.tsunamiRisk >= 70) {
      factors.push({
        type: 'tsunami',
        severity: params.tsunamiRisk >= 80 ? 'critical' : 'high',
        description: 'Sahil yakını - tsunami riski',
        impact: params.baseRisk.distanceToSea 
          ? `Denize ${params.baseRisk.distanceToSea}km mesafe - tsunami riski yüksek`
          : 'Sahil yakını - tsunami riski',
      });
    }
    
    // Flood factors
    if (params.floodRisk >= 60) {
      factors.push({
        type: 'flood',
        severity: 'high',
        description: 'Düşük rakım - sel riski',
        impact: params.baseRisk.elevation 
          ? `${params.baseRisk.elevation}m rakım - sel riski yüksek`
          : 'Düşük rakım - sel riski',
      });
    }
    
    // Landslide factors
    if (params.landslideRisk >= 60) {
      factors.push({
        type: 'landslide',
        severity: 'high',
        description: 'Eğimli zemin - heyelan riski',
        impact: params.baseRisk.slope
          ? `${params.baseRisk.slope}° eğim - heyelan riski`
          : 'Eğimli zemin - heyelan riski',
      });
    }
    
    return factors;
  }

  private generateRecommendations(params: {
    earthquakeRisk: number;
    tsunamiRisk: number;
    floodRisk: number;
    landslideRisk: number;
    fireRisk: number;
    baseRisk: Partial<RegionalRisk>;
    userBuildingAge?: number;
    userBuildingFloor?: number;
  }): string[] {
    const recommendations: string[] = [];
    
    if (params.earthquakeRisk >= 80) {
      recommendations.push('Deprem sigortası yaptırın (DASK)');
      recommendations.push('Mobilyaları duvara sabitleyin');
      recommendations.push('Acil çıkış planı yapın ve ailenizle paylaşın');
      recommendations.push('Acil durum çantası hazırlayın');
    }
    
    if (params.baseRisk.soilType === 'Z4') {
      recommendations.push('Z4 zemin sınıfı: Bina güçlendirme çalışması yapın');
      recommendations.push('Sismik izolatör kullanımını değerlendirin');
    }
    
    if (params.userBuildingAge && params.userBuildingAge < 2000) {
      recommendations.push('Bina güçlendirme veya yenileme yapın');
      recommendations.push('Deprem testi yaptırın');
    }
    
    if (params.tsunamiRisk >= 70) {
      recommendations.push('Tsunami kaçış rotası belirleyin (yüksekliğe veya içeriye)');
      recommendations.push('Toplanma noktasını yüksek rakımlı yerde seçin');
    }
    
    if (params.floodRisk >= 60) {
      recommendations.push('Sel riski: Değerli eşyaları yüksek yerde saklayın');
      recommendations.push('Su geçirmez çanta kullanın');
    }
    
    if (params.landslideRisk >= 60) {
      recommendations.push('Heyelan riski: Eğimli bölgeden uzaklaşın');
      recommendations.push('Ağaçlandırma yapın');
    }
    
    if (params.userBuildingFloor && params.userBuildingFloor > 5) {
      recommendations.push('Yüksek kat: Asansör kullanmayın, merdiven kullanın');
      recommendations.push('Deprem anında pencere ve balkondan uzak durun');
    }
    
    return recommendations;
  }

  private notifyCallbacks(risk: RegionalRisk) {
    for (const callback of this.callbacks) {
      try {
        callback(risk);
      } catch (error) {
        logger.error('Callback error:', error);
      }
    }
  }
}

export const regionalRiskService = new RegionalRiskService();

