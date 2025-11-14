/**
 * RISK SCORING SERVICE
 * Calculates risk scores based on user profile and location
 * AI-powered with rule-based fallback
 */

import {
  RiskScore,
  RiskLevel,
  RiskFactor,
  RiskInsight,
  RegionalRiskSummary,
  RiskTrend,
  BuildingRiskAnalysis,
  FamilyRiskProfile,
  EnvironmentalRiskFactors,
  EvacuationReadiness,
  HistoricalRiskComparison,
  MitigationPotential,
  RiskSubFactor,
} from '../types/ai.types';
import { createLogger } from '../../utils/logger';
import { openAIService } from './OpenAIService';
import {
  REGIONAL_HAZARD_CLUSTERS,
  distanceInKm,
  type RegionalHazardCluster,
} from '../data/regionalRiskProfiles';

import type { LocationCoords } from '../../services/LocationService';
import type { Earthquake } from '../../stores/earthquakeStore';

const logger = createLogger('RiskScoringService');

interface BuildingProfile {
  type: string;
  floorNumber: number;
  constructionYear?: number;
  vulnerabilityScore: number;
  description: string;
}

interface PreparednessStats {
  completionRate: number;
  hasPlan: boolean;
}

interface EarthquakeStats {
  totalLast24h: number;
  totalLast7d: number;
  significantLast72h: Array<Earthquake & { distanceKm?: number }>;
  nearest?: { quake: Earthquake; distanceKm: number };
  maxMagnitude?: number;
  latestTimestamp?: number;
}

interface RiskContext {
  location?: LocationCoords | null;
  hazardCluster?: RegionalHazardCluster | null;
  distanceToClusterCenterKm?: number;
  building: BuildingProfile;
  preparedness: PreparednessStats;
  earthquakes: EarthquakeStats;
  familySize: number;
  hasChildren?: boolean;
  hasElderly?: boolean;
  hasDisabled?: boolean;
  petsCount?: number;
  soilType?: 'soft' | 'rock' | 'reclaimed' | 'unknown';
}

class RiskScoringService {
  private isInitialized = false;
  private cache = new Map<string, { data: RiskScore; timestamp: number }>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  private readonly lastScores = new Map<string, number>();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    logger.info('RiskScoringService initialized (hybrid AI/rule-based)');
    this.isInitialized = true;
  }

  async calculateRiskScore(params: {
    location?: { latitude: number; longitude: number };
    buildingType?: string;
    floorNumber?: number;
    constructionYear?: number;
    soilType?: 'soft' | 'rock' | 'reclaimed' | 'unknown';
    familySize?: number;
    hasChildren?: boolean;
    hasElderly?: boolean;
  } = {}): Promise<RiskScore> {
    await this.initialize();

    const context = await this.buildRiskContext(params);
    const cacheKey = this.buildCacheKey(context, params);

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.info('Returning cached risk score');
      const trend = this.computeTrend(cacheKey, cached.data.score);
      const refreshed: RiskScore = {
        ...cached.data,
        trend,
        lastUpdated: Date.now(),
      };
      this.lastScores.set(cacheKey, refreshed.score);
      return refreshed;
    }

    let result = this.calculateCompositeRisk(context, cacheKey);

    if (openAIService.isConfigured()) {
      try {
        result = await this.enrichWithAI(result, context);
      } catch (error) {
        logger.warn('AI enrichment failed, continuing with rule-based output', error);
      }
    }

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    this.lastScores.set(cacheKey, result.score);
    return result;
  }

  private buildCacheKey(context: RiskContext, params: Record<string, unknown>): string {
    return JSON.stringify({
      region: context.hazardCluster?.id ?? 'unknown',
      building: context.building.type,
      floor: context.building.floorNumber,
      constructionYear: context.building.constructionYear ?? 'na',
      familySize: context.familySize,
      params,
    });
  }

  private async buildRiskContext(params: {
    location?: { latitude: number; longitude: number };
    buildingType?: string;
    floorNumber?: number;
    constructionYear?: number;
    soilType?: 'soft' | 'rock' | 'reclaimed' | 'unknown';
    familySize?: number;
    hasChildren?: boolean;
    hasElderly?: boolean;
  }): Promise<RiskContext> {
    const location = await this.resolveLocation(params.location);
    const hazardCluster = location
      ? this.findHazardCluster(location)
      : null;

    const distanceToClusterCenterKm = location && hazardCluster
      ? distanceInKm(location, hazardCluster.center)
      : undefined;

    const building = this.buildBuildingProfile({
      buildingType: params.buildingType,
      floorNumber: params.floorNumber,
      constructionYear: params.constructionYear,
      soilType: params.soilType,
    });

    const preparedness = await this.getPreparednessStats();
    const earthquakes = await this.getEarthquakeStats(location);

    // ELITE: Get family profile information (disabilities and pets)
    let hasDisabled = false;
    let petsCount = 0;
    try {
      const { useFamilyStore } = await import('../../stores/familyStore');
      const familyState = useFamilyStore.getState();
      const members = familyState.members || [];
      
      // Check for disabilities (from notes)
      hasDisabled = members.some(m => {
        const notes = m.notes?.toLowerCase() || '';
        return notes.includes('engel') || notes.includes('disability') ||
               notes.includes('özürlü') || notes.includes('handicap');
      });
      
      // Count pets (from relationship or notes)
      petsCount = members.filter(m => {
        const rel = m.relationship?.toLowerCase() || '';
        const notes = m.notes?.toLowerCase() || '';
        return rel.includes('pet') || rel.includes('hayvan') ||
               rel.includes('köpek') || rel.includes('kedi') ||
               notes.includes('pet') || notes.includes('hayvan');
      }).length;
    } catch (familyError: any) {
      // CRITICAL: Handle LoadBundleFromServerRequestError gracefully
      const errorMessage = familyError?.message || String(familyError);
      const isBundleError = errorMessage.includes('LoadBundleFromServerRequestError') || 
                           errorMessage.includes('Could not load bundle');
      
      if (isBundleError) {
        // ELITE: Bundle errors are expected in some environments - log as debug silently
        if (__DEV__) {
          logger.debug('Family profile collection skipped for risk scoring (bundle error - expected)');
        }
      } else {
        logger.debug('Failed to collect family profile for risk scoring, using defaults:', familyError);
      }
    }

    return {
      location,
      hazardCluster,
      distanceToClusterCenterKm,
      building,
      preparedness,
      earthquakes,
      familySize: params.familySize ?? 4,
      hasChildren: params.hasChildren,
      hasElderly: params.hasElderly,
      hasDisabled,
      petsCount,
      soilType: params.soilType,
    };
  }

  private async resolveLocation(
    provided?: { latitude: number; longitude: number }
  ): Promise<LocationCoords | null> {
    if (provided) {
      return {
        latitude: provided.latitude,
        longitude: provided.longitude,
        accuracy: null,
        timestamp: Date.now(),
      };
    }

    try {
      const { locationService } = await import('../../services/LocationService');
      const current = locationService.getCurrentLocation();
      if (current) return current;
      return await locationService.updateLocation();
    } catch (error) {
      logger.warn('Location could not be resolved for risk scoring', error);
      return null;
    }
  }

  private findHazardCluster(location: LocationCoords): RegionalHazardCluster | null {
    let closestCluster: RegionalHazardCluster | null = null;
    let closestDistance = Number.MAX_VALUE;

    for (const cluster of REGIONAL_HAZARD_CLUSTERS) {
      const distanceKm = distanceInKm(location, cluster.center);
      if (distanceKm <= cluster.radiusKm && distanceKm < closestDistance) {
        closestCluster = cluster;
        closestDistance = distanceKm;
      }
    }

    if (!closestCluster) {
      // choose nearest cluster even if outside radius for context
      for (const cluster of REGIONAL_HAZARD_CLUSTERS) {
        const distanceKm = distanceInKm(location, cluster.center);
        if (distanceKm < closestDistance) {
          closestCluster = cluster;
          closestDistance = distanceKm;
        }
      }
    }

    return closestCluster;
  }

  private buildBuildingProfile(params: {
    buildingType?: string;
    floorNumber?: number;
    constructionYear?: number;
    soilType?: 'soft' | 'rock' | 'reclaimed' | 'unknown';
  }): BuildingProfile {
    const type = (params.buildingType || 'bilinmiyor').toLowerCase();
    const floorNumber = params.floorNumber ?? 3;
    const constructionYear = params.constructionYear;
    const soil = params.soilType ?? 'unknown';

    let vulnerability = 55;
    let description = 'Yapı tipi bilinmiyor, varsayılan risk değerleri kullanıldı.';

    if (type.includes('yığma') || type.includes('ahşap')) {
      vulnerability += 20;
      description = 'Yığma/ahşap yapı depremde hasar almaya yatkındır.';
    } else if (type.includes('beton') || type.includes('arme')) {
      vulnerability -= 5;
      description = 'Betonarme yapı daha dayanıklı kabul edilir, bakım durumu kritik.';
    } else if (type.includes('çelik')) {
      vulnerability -= 10;
      description = 'Çelik yapı yüksek dayanım sağlar, bağlantı noktaları düzenli kontrol edilmelidir.';
    }

    if (soil === 'soft' || soil === 'reclaimed') {
      vulnerability += 10;
      description += ' Zeminin yumuşak/sulu olması risk katsayısını artırır.';
    }

    if (floorNumber >= 8) {
      vulnerability += 12;
      description += ' Yüksek katlı bina için tahliye süreleri uzar.';
    } else if (floorNumber === 1) {
      vulnerability -= 5;
      description += ' Düşük kat sayısı tahliye avantajı sağlar.';
    }

    if (constructionYear) {
      if (constructionYear < 2000) {
        vulnerability += 15;
        description += ' 2000 öncesi Deprem Yönetmeliği öncesi yapılar güçlendirme gerektirebilir.';
      } else if (constructionYear >= 2019) {
        vulnerability -= 5;
        description += ' Yeni yönetmelik sonrası inşa edilen yapılar daha dayanıklıdır.';
      }
    }

    vulnerability = Math.max(10, Math.min(95, vulnerability));

    return {
      type: params.buildingType || 'Bilinmiyor',
      floorNumber,
      constructionYear,
      vulnerabilityScore: vulnerability,
      description,
    };
  }

  private async getPreparednessStats(): Promise<PreparednessStats> {
    try {
      const { useAIAssistantStore } = await import('../stores/aiAssistantStore');
      const state = useAIAssistantStore.getState();
      const completionRate = state.preparednessPlan?.completionRate ?? 0;
      return {
        completionRate,
        hasPlan: Boolean(state.preparednessPlan),
      };
    } catch (error) {
      logger.warn('Preparedness stats unavailable, using defaults', error);
      return { completionRate: 0, hasPlan: false };
    }
  }

  private async getEarthquakeStats(location?: LocationCoords | null): Promise<EarthquakeStats> {
    try {
      const { useEarthquakeStore } = await import('../../stores/earthquakeStore');
      const { items } = useEarthquakeStore.getState();
      const now = Date.now();

      const withDistance = location
        ? items.map((quake) => ({
            ...quake,
            distanceKm: distanceInKm(location, {
              latitude: quake.latitude,
              longitude: quake.longitude,
            }),
          }))
        : items;

      const filtered = location
        ? withDistance.filter((quake) => (quake as any).distanceKm <= 250)
        : withDistance;

      const last24h = filtered.filter((quake) => now - quake.time <= 24 * 60 * 60 * 1000);
      const last7d = filtered.filter((quake) => now - quake.time <= 7 * 24 * 60 * 60 * 1000);
      const significant = filtered.filter(
        (quake) => now - quake.time <= 72 * 60 * 60 * 1000 && quake.magnitude >= 4.0
      );

      let maxMagnitude: number | undefined;
      let latestTimestamp: number | undefined;
      let nearest: { quake: Earthquake; distanceKm: number } | undefined;

      for (const quake of filtered) {
        if (typeof maxMagnitude === 'undefined' || quake.magnitude > maxMagnitude) {
          maxMagnitude = quake.magnitude;
        }
        if (typeof latestTimestamp === 'undefined' || quake.time > latestTimestamp) {
          latestTimestamp = quake.time;
        }

        if (location) {
          const distanceKm = (quake as any).distanceKm as number | undefined;
          if (typeof distanceKm === 'number') {
            if (!nearest || distanceKm < nearest.distanceKm) {
              nearest = { quake, distanceKm };
            }
          }
        }
      }

      return {
        totalLast24h: last24h.length,
        totalLast7d: last7d.length,
        significantLast72h: significant as Array<Earthquake & { distanceKm?: number }> ,
        nearest,
        maxMagnitude,
        latestTimestamp,
      };
    } catch (error) {
      logger.warn('Earthquake stats unavailable, using defaults', error);
      return {
        totalLast24h: 0,
        totalLast7d: 0,
        significantLast72h: [],
      };
    }
  }

  private calculateCompositeRisk(context: RiskContext, cacheKey: string): RiskScore {
    const hazardScore = this.calculateHazardScore(context);
    const activityScore = this.calculateSeismicActivityScore(context);
    const buildingScore = context.building.vulnerabilityScore;
    const preparednessScore = 100 - context.preparedness.completionRate;
    const responseScore = this.calculateResponsePressureScore(context);

    const factors: RiskFactor[] = [
      {
        id: 'regional_hazard',
        name: 'Bölgesel Tehlike',
        weight: 0.35,
        value: hazardScore,
        description: context.hazardCluster
          ? `${context.hazardCluster.name} içinde konumlanmış bölge. ${context.hazardCluster.description}`
          : 'Bölgesel veriler sınırlı, ulusal risk katsayısı kullanıldı.',
        severity: this.valueToSeverity(hazardScore),
        references: context.hazardCluster?.notableFaults,
        impact: this.valueToSeverity(hazardScore) === 'critical' ? 'critical' : this.valueToSeverity(hazardScore) === 'high' ? 'high' : 'medium',
        controllability: 'low',
      },
      {
        id: 'recent_activity',
        name: 'Güncel Sismik Aktivite',
        weight: 0.25,
        value: activityScore,
        description: this.describeSeismicActivity(context),
        severity: this.valueToSeverity(activityScore),
        impact: this.valueToSeverity(activityScore) === 'critical' ? 'critical' : this.valueToSeverity(activityScore) === 'high' ? 'high' : 'medium',
        controllability: 'none',
      },
      {
        id: 'building_vulnerability',
        name: 'Bina Kırılganlığı',
        weight: 0.2,
        value: buildingScore,
        description: context.building.description,
        severity: this.valueToSeverity(buildingScore),
        impact: this.valueToSeverity(buildingScore) === 'critical' ? 'critical' : this.valueToSeverity(buildingScore) === 'high' ? 'high' : 'medium',
        controllability: 'medium',
      },
      {
        id: 'preparedness_gap',
        name: 'Hazırlık Açığı',
        weight: 0.1,
        value: preparednessScore,
        description: context.preparedness.hasPlan
          ? `Hazırlık planınız tamamlanma oranı %${context.preparedness.completionRate}. Eksikler risk skoruna yansıtıldı.`
          : 'Kişisel hazırlık planı bulunmuyor. Temel hazırlık adımları tamamlanmalı.',
        severity: this.valueToSeverity(preparednessScore),
        impact: this.valueToSeverity(preparednessScore) === 'critical' ? 'high' : 'medium',
        controllability: 'high',
      },
      {
        id: 'response_pressure',
        name: 'Acil Müdahale Baskısı',
        weight: 0.1,
        value: responseScore,
        description:
          'Bölgesel nüfus yoğunluğu, altyapı ve toplanma alanı kapasitesi dikkate alınarak afet sonrası erişim riski değerlendirildi.',
        severity: this.valueToSeverity(responseScore),
        impact: this.valueToSeverity(responseScore) === 'critical' ? 'high' : 'medium',
        controllability: 'low',
      },
    ];

    const totalScore = Math.min(
      100,
      Math.max(
        0,
        factors.reduce((sum, factor) => sum + factor.weight * factor.value, 0)
      )
    );

    const level: RiskLevel = totalScore >= 85
      ? 'critical'
      : totalScore >= 70
      ? 'high'
      : totalScore >= 45
      ? 'medium'
      : 'low';

    const trend = this.computeTrend(cacheKey, totalScore);
    const aftershockProbability = this.calculateAftershockProbability(context);
    const regionalSummary = this.buildRegionalSummary(context);
    const insights = this.createInsights(context, level, aftershockProbability, regionalSummary);
    const recommendations = this.createRecommendations(context, regionalSummary);
    const checklist = this.createChecklist(context);

    // Yeni detaylı analizler
    const buildingAnalysis = this.analyzeBuildingRisk(context);
    const familyProfile = this.analyzeFamilyRisk(context);
    const environmentalFactors = this.analyzeEnvironmentalRisk(context);
    const evacuationReadiness = this.analyzeEvacuationReadiness(context);
    const historicalComparison = this.buildHistoricalComparison(cacheKey, totalScore);
    const mitigationPotential = this.calculateMitigationPotential(context, totalScore, buildingAnalysis);
    const timeToSafety = this.calculateTimeToSafety(context, evacuationReadiness);
    const survivalProbability = this.calculateSurvivalProbability(totalScore, buildingAnalysis, evacuationReadiness);

    return {
      level,
      score: Math.round(totalScore),
      factors: this.enrichFactorsWithDetails(factors, context),
      recommendations,
      insights,
      regionalSummary,
      aftershockProbability,
      trend,
      checklist,
      lastUpdated: Date.now(),
      // Yeni detaylı alanlar
      buildingAnalysis,
      familyProfile,
      environmentalFactors,
      evacuationReadiness,
      historicalComparison,
      mitigationPotential,
      timeToSafety,
      survivalProbability,
    };
  }

  private calculateHazardScore(context: RiskContext): number {
    if (!context.hazardCluster) {
      return 55;
    }

    const base =
      context.hazardCluster.hazardLevel === 'very_high'
        ? 85
        : context.hazardCluster.hazardLevel === 'high'
        ? 75
        : context.hazardCluster.hazardLevel === 'medium'
        ? 55
        : 40;

    if (typeof context.distanceToClusterCenterKm === 'number') {
      const ratio = context.distanceToClusterCenterKm / context.hazardCluster.radiusKm;
      if (ratio > 1) {
        return Math.max(35, base - (ratio - 1) * 20);
      }
      return Math.min(95, base + (1 - ratio) * 10);
    }

    return base;
  }

  private calculateSeismicActivityScore(context: RiskContext): number {
    const { earthquakes } = context;

    let score = 35;

    if (earthquakes.maxMagnitude && earthquakes.maxMagnitude >= 6.0) {
      score += 30;
    } else if (earthquakes.maxMagnitude && earthquakes.maxMagnitude >= 5.0) {
      score += 20;
    } else if (earthquakes.maxMagnitude && earthquakes.maxMagnitude >= 4.0) {
      score += 10;
    }

    if (earthquakes.totalLast24h >= 5) {
      score += 15;
    } else if (earthquakes.totalLast24h >= 2) {
      score += 8;
    }

    if (earthquakes.significantLast72h.length >= 3) {
      score += 10;
    }

    if (earthquakes.nearest && earthquakes.nearest.distanceKm < 25) {
      score += 10;
    } else if (earthquakes.nearest && earthquakes.nearest.distanceKm < 100) {
      score += 5;
    }

    return Math.min(95, Math.max(15, score));
  }

  private calculateResponsePressureScore(context: RiskContext): number {
    if (!context.hazardCluster) {
      return 45;
    }

    const level = context.hazardCluster.hazardLevel;
    let base = level === 'very_high' ? 70 : level === 'high' ? 60 : level === 'medium' ? 50 : 40;

    if (context.familySize > 5) {
      base += 5;
    }

    if (context.preparedness.hasPlan) {
      base -= 5;
    }

    return Math.min(85, Math.max(30, base));
  }

  private describeSeismicActivity(context: RiskContext): string {
    const { earthquakes } = context;
    if (!earthquakes.maxMagnitude) {
      return 'Son günlerde kayda değer deprem aktivitesi raporlanmadı.';
    }

    const nearestInfo = earthquakes.nearest
      ? ` En yakın sarsıntı ${earthquakes.nearest.distanceKm.toFixed(0)} km mesafede ve büyüklüğü ${earthquakes.nearest.quake.magnitude}.`
      : '';

    return `Son 24 saatte ${earthquakes.totalLast24h} deprem kaydedildi, maksimum büyüklük ${earthquakes.maxMagnitude}.` + nearestInfo;
  }

  private calculateAftershockProbability(context: RiskContext): number {
    const { earthquakes } = context;
    if (!earthquakes.maxMagnitude || !earthquakes.latestTimestamp) {
      return 20;
    }

    const hoursSince = (Date.now() - earthquakes.latestTimestamp) / (1000 * 60 * 60);
    let probability = 15;

    if (earthquakes.maxMagnitude >= 7) {
      probability = 80;
    } else if (earthquakes.maxMagnitude >= 6) {
      probability = 65;
    } else if (earthquakes.maxMagnitude >= 5) {
      probability = 45;
    }

    if (hoursSince > 72) {
      probability *= 0.6;
    } else if (hoursSince > 24) {
      probability *= 0.8;
    }

    return Math.round(Math.min(95, Math.max(10, probability)));
  }

  private buildRegionalSummary(context: RiskContext): RegionalRiskSummary | undefined {
    if (!context.hazardCluster) return undefined;

    return {
      regionId: context.hazardCluster.id,
      regionName: context.hazardCluster.name,
      hazardLevel: context.hazardCluster.hazardLevel,
      description: context.hazardCluster.description,
      distanceKm: context.distanceToClusterCenterKm,
      historicalEvents: context.hazardCluster.historicalEvents,
      criticalInfrastructure: context.hazardCluster.criticalInfrastructure,
    };
  }

  private createInsights(
    context: RiskContext,
    level: RiskLevel,
    aftershockProbability: number,
    regionalSummary?: RegionalRiskSummary
  ): RiskInsight[] {
    const insights: RiskInsight[] = [];

    if (regionalSummary) {
      const distanceText =
        typeof regionalSummary.distanceKm === 'number'
          ? ` Bölge merkezine ${regionalSummary.distanceKm.toFixed(0)} km mesafedesiniz.`
          : '';

      insights.push({
        id: 'regional-hazard',
        title: `${regionalSummary.regionName} tehlike profili`,
        description: `${regionalSummary.description}${distanceText}`,
        severity: regionalSummary.hazardLevel === 'very_high'
          ? 'critical'
          : regionalSummary.hazardLevel === 'high'
          ? 'warning'
          : 'info',
        actions: [
          'AFAD toplanma alanlarını önceden kontrol edin',
          'Bina güçlendirme raporlarını güncelleyin',
        ],
      });
    }

    insights.push({
      id: 'aftershock',
      title: 'Artçı sarsıntı riski',
      description: `Son büyük deprem sonrasında artçı sarsıntı olasılığı %${aftershockProbability} olarak değerlendiriliyor. Sarsıntı sonrası güvenli tahliye planı hazır olmalı.`,
      severity: aftershockProbability >= 70 ? 'critical' : aftershockProbability >= 40 ? 'warning' : 'info',
      actions: ['Sarsıntı bitene kadar güvenli pozisyonda kalın', 'Sonrasında toplanma alanına geçiş planını uygulayın'],
    });

    insights.push({
      id: 'preparedness-gap',
      title: 'Hazırlık seviyesi',
      description: context.preparedness.hasPlan
        ? `Kişisel hazırlık planınızın tamamlanma oranı %${context.preparedness.completionRate}. Eksik maddeleri tamamlayarak risk puanınızı düşürebilirsiniz.`
        : 'Hazırlık planı oluşturulmamış görünüyor. Kişisel afet planı risk puanını düşürmek için kritik öneme sahip.',
      severity: context.preparedness.completionRate >= 75
        ? 'info'
        : context.preparedness.completionRate >= 40
        ? 'warning'
        : 'critical',
      actions: [
        'Afet çantası ve iletişim planı hazırlayın',
        'Aile üyeleriyle düzenli tatbikat gerçekleştirin',
      ],
    });

    if (level === 'critical' || level === 'high') {
      insights.push({
        id: 'risk-alert',
        title: 'Öncelikli aksiyon önerisi',
        description: 'Bölgesel risk seviyesi yüksek. Tahliye rotalarını ve yaşam üçgeni noktalarını aile üyeleriyle paylaşın.',
        severity: 'critical',
        actions: ['Bina dayanıklılık raporu alın', 'AFAD Deprem Dede uygulamasından toplanma alanı kontrolü yapın'],
      });
    }

    return insights;
  }

  private createRecommendations(
    context: RiskContext,
    regionalSummary?: RegionalRiskSummary
  ): string[] {
    const recommendations = new Set<string>();

    if (regionalSummary?.hazardLevel === 'very_high') {
      recommendations.add('Bina güçlendirme uzmanından hızlı değerlendirme alın.');
      recommendations.add('Deprem anında toplanma alanına alternatif ikinci rota belirleyin.');
    }

    if (context.preparedness.completionRate < 70) {
      recommendations.add('Hazırlık planındaki eksik maddeleri tamamlayın (acil durum çantası, aile iletişim planı).');
    }

    if (!context.preparedness.hasPlan) {
      recommendations.add('AfetNet Hazırlık Planı modülünden aile profiline özel plan oluşturun.');
    }

    if (context.building.constructionYear && context.building.constructionYear < 2000) {
      recommendations.add('2000 öncesi deprem yönetmeliği için bina taşıyıcı sistem uzman incelemesi talep edin.');
    }

    if (context.earthquakes.nearest && context.earthquakes.nearest.distanceKm < 50) {
      recommendations.add('Artçı sarsıntılar için ağır eşyaları sabitleyin ve gaz/elektrik vanalarını kontrol edin.');
    }

    recommendations.add('Acil durum çantasında 72 saat yetecek su ve gıda stoğu bulundurun.');
    recommendations.add('Toplanma alanına ulaşım süresini ölçün ve aile bireyleriyle paylaşın.');

    return Array.from(recommendations).slice(0, 6);
  }

  private createChecklist(context: RiskContext): string[] {
    const checklist: string[] = [];
    checklist.push('Acil durum çantasını güncelleyin (su, yiyecek, ilaç, hijyen).');
    checklist.push('Toplanma alanı rotasını telefonunuzda çevrimdışı kaydedin.');

    if (context.building.floorNumber >= 5) {
      checklist.push('Merdiven ve acil çıkış güzergâhlarını kontrol edin, engelleri kaldırın.');
    }

    if (!context.preparedness.hasPlan) {
      checklist.push('AfetNet Hazırlık Planı modülünde aile planı oluşturun.');
    }

    if (context.earthquakes.totalLast24h > 0) {
      checklist.push('Artçı sarsıntı uyarılarını takip edin ve çocuklarla çök-kapan-tutun tatbikatı yapın.');
    }

    return checklist.slice(0, 5);
  }

  private computeTrend(cacheKey: string, newScore: number): RiskTrend {
    const previous = this.lastScores.get(cacheKey);
    if (typeof previous !== 'number') {
      return 'stable';
    }

    const diff = newScore - previous;
    if (diff >= 5) {
      return 'worsening';
    }
    if (diff <= -5) {
      return 'improving';
    }
    return 'stable';
  }

  private valueToSeverity(value: number): RiskLevel {
    if (value >= 80) return 'critical';
    if (value >= 60) return 'high';
    if (value >= 40) return 'medium';
    return 'low';
  }

  // YENİ DETAYLI ANALİZ FONKSİYONLARI

  private analyzeBuildingRisk(context: RiskContext): BuildingRiskAnalysis {
    const building = context.building;
    const constructionYear = building.constructionYear ?? 2000;
    const floorNumber = building.floorNumber;
    const soilType = context.soilType ?? 'unknown';

    // Yapısal bütünlük skoru
    let structuralIntegrity = 70;
    if (building.type.toLowerCase().includes('beton') || building.type.toLowerCase().includes('arme')) {
      structuralIntegrity = 75;
    } else if (building.type.toLowerCase().includes('çelik')) {
      structuralIntegrity = 85;
    } else if (building.type.toLowerCase().includes('yığma') || building.type.toLowerCase().includes('ahşap')) {
      structuralIntegrity = 45;
    }

    // Yaş riski
    let ageRisk = 50;
    if (constructionYear < 2000) {
      ageRisk = 85;
    } else if (constructionYear < 2010) {
      ageRisk = 65;
    } else if (constructionYear >= 2019) {
      ageRisk = 30;
    }

    // Kat riski
    let floorRisk = 40;
    if (floorNumber >= 10) {
      floorRisk = 80;
    } else if (floorNumber >= 5) {
      floorRisk = 60;
    } else if (floorNumber === 1) {
      floorRisk = 25;
    }

    // Zemin riski
    let soilRisk = 50;
    if (soilType === 'soft' || soilType === 'reclaimed') {
      soilRisk = 85;
    } else if (soilType === 'rock') {
      soilRisk = 30;
    }

    // Bakım skoru (varsayılan)
    const maintenanceScore = 60;

    // Güçlendirme aciliyeti
    let retrofitUrgency: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (constructionYear < 2000 && structuralIntegrity < 50) {
      retrofitUrgency = 'critical';
    } else if (constructionYear < 2000) {
      retrofitUrgency = 'high';
    } else if (structuralIntegrity < 50) {
      retrofitUrgency = 'medium';
    }

    // Zayıflıklar ve güçlü yönler
    const vulnerabilities: string[] = [];
    const strengths: string[] = [];

    if (constructionYear < 2000) {
      vulnerabilities.push('2000 öncesi deprem yönetmeliği');
    }
    if (floorNumber >= 8) {
      vulnerabilities.push('Yüksek kat sayısı');
    }
    if (soilType === 'soft' || soilType === 'reclaimed') {
      vulnerabilities.push('Yumuşak zemin');
    }
    if (building.type.toLowerCase().includes('yığma')) {
      vulnerabilities.push('Yığma yapı tipi');
    }

    if (constructionYear >= 2019) {
      strengths.push('Yeni deprem yönetmeliği');
    }
    if (floorNumber <= 3) {
      strengths.push('Düşük kat sayısı');
    }
    if (soilType === 'rock') {
      strengths.push('Sağlam zemin');
    }
    if (building.type.toLowerCase().includes('çelik')) {
      strengths.push('Çelik yapı');
    }

    // Tahmini hasar seviyesi
    const avgRisk = (structuralIntegrity + ageRisk + floorRisk + soilRisk) / 4;
    let estimatedDamageLevel: 'minimal' | 'light' | 'moderate' | 'severe' | 'collapse' = 'moderate';
    if (avgRisk >= 80) {
      estimatedDamageLevel = 'collapse';
    } else if (avgRisk >= 65) {
      estimatedDamageLevel = 'severe';
    } else if (avgRisk >= 50) {
      estimatedDamageLevel = 'moderate';
    } else if (avgRisk >= 35) {
      estimatedDamageLevel = 'light';
    } else {
      estimatedDamageLevel = 'minimal';
    }

    // Tahliye süresi (dakika)
    let evacuationTimeMinutes = 5;
    if (floorNumber >= 10) {
      evacuationTimeMinutes = 15;
    } else if (floorNumber >= 5) {
      evacuationTimeMinutes = 10;
    }

    return {
      structuralIntegrity,
      ageRisk,
      floorRisk,
      soilRisk,
      maintenanceScore,
      retrofitUrgency,
      vulnerabilities,
      strengths,
      estimatedDamageLevel,
      evacuationTimeMinutes,
    };
  }

  private analyzeFamilyRisk(context: RiskContext): FamilyRiskProfile {
    const familySize = context.familySize;
    const childrenCount = context.hasChildren ? Math.floor(familySize * 0.3) : 0;
    const elderlyCount = context.hasElderly ? Math.floor(familySize * 0.2) : 0;
    const disabledCount = context.hasDisabled ? 1 : 0;
    const petsCount = context.petsCount ?? 0;

    const specialNeeds: string[] = [];
    if (childrenCount > 0) specialNeeds.push('Çocuk bakımı');
    if (elderlyCount > 0) specialNeeds.push('Yaşlı bakımı');
    if (disabledCount > 0) specialNeeds.push('Özel ihtiyaçlar');
    if (petsCount > 0) specialNeeds.push('Evcil hayvan');

    const mobilityLimitations = elderlyCount > 0 || disabledCount > 0;

    // Tahliye zorluğu
    let evacuationDifficulty: 'easy' | 'moderate' | 'difficult' | 'critical' = 'easy';
    if (disabledCount > 0 || (elderlyCount > 0 && familySize > 5)) {
      evacuationDifficulty = 'critical';
    } else if (elderlyCount > 0 || childrenCount > 3) {
      evacuationDifficulty = 'difficult';
    } else if (childrenCount > 0 || familySize > 5) {
      evacuationDifficulty = 'moderate';
    }

    // Risk çarpanı
    let riskMultiplier = 1.0;
    if (evacuationDifficulty === 'critical') {
      riskMultiplier = 1.8;
    } else if (evacuationDifficulty === 'difficult') {
      riskMultiplier = 1.5;
    } else if (evacuationDifficulty === 'moderate') {
      riskMultiplier = 1.2;
    }

    const specialConsiderations: string[] = [];
    if (childrenCount > 0) {
      specialConsiderations.push('Çocuklar için özel tahliye planı gerekli');
    }
    if (elderlyCount > 0) {
      specialConsiderations.push('Yaşlılar için yardım gerekebilir');
    }
    if (disabledCount > 0) {
      specialConsiderations.push('Engelli erişim yolları kontrol edilmeli');
    }
    if (petsCount > 0) {
      specialConsiderations.push('Evcil hayvanlar için hazırlık yapılmalı');
    }

    return {
      totalMembers: familySize,
      childrenCount,
      elderlyCount,
      disabledCount,
      petsCount,
      specialNeeds,
      mobilityLimitations,
      evacuationDifficulty,
      riskMultiplier,
      specialConsiderations,
    };
  }

  private analyzeEnvironmentalRisk(context: RiskContext): EnvironmentalRiskFactors {
    const hazardCluster = context.hazardCluster;
    const distanceToFault = context.distanceToClusterCenterKm ?? 50;

    // Fay yakınlığı
    const proximityToFault = distanceToFault;

    // Zemin sıvılaşması riski
    let soilLiquefactionRisk: 'none' | 'low' | 'medium' | 'high' = 'low';
    if (context.soilType === 'soft' && hazardCluster?.hazardLevel === 'very_high') {
      soilLiquefactionRisk = 'high';
    } else if (context.soilType === 'soft') {
      soilLiquefactionRisk = 'medium';
    }

    // Heyelan riski
    let landslideRisk: 'none' | 'low' | 'medium' | 'high' = 'low';
    if (hazardCluster?.hazardLevel === 'very_high' && distanceToFault < 20) {
      landslideRisk = 'medium';
    }

    // Tsunami riski (Türkiye için genelde düşük)
    const tsunamiRisk: 'none' | 'low' | 'medium' | 'high' = 'low';

    // Yangın riski
    let fireRisk: 'none' | 'low' | 'medium' | 'high' = 'medium';
    if (hazardCluster?.hazardLevel === 'very_high') {
      fireRisk = 'high';
    }

    // Altyapı yakınlığı (varsayılan)
    const gasLineProximity = false;
    const powerLineProximity = false;
    const industrialProximity = hazardCluster?.hazardLevel === 'very_high' || hazardCluster?.hazardLevel === 'high';

    // Genel çevresel skor
    let overallScore = 50;
    if (soilLiquefactionRisk === 'high') overallScore += 20;
    if (fireRisk === 'high') overallScore += 15;
    if (proximityToFault < 10) overallScore += 15;
    overallScore = Math.min(95, Math.max(20, overallScore));

    return {
      proximityToFault,
      soilLiquefactionRisk,
      landslideRisk,
      tsunamiRisk,
      fireRisk,
      gasLineProximity,
      powerLineProximity,
      industrialProximity,
      overallEnvironmentalScore: overallScore,
    };
  }

  private analyzeEvacuationReadiness(context: RiskContext): EvacuationReadiness {
    const building = context.building;
    const floorNumber = building.floorNumber;
    const familyProfile = this.analyzeFamilyRisk(context);

    // Rota netliği (varsayılan)
    let routeClarity: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
    if (context.preparedness.hasPlan && context.preparedness.completionRate > 70) {
      routeClarity = 'excellent';
    } else if (!context.preparedness.hasPlan) {
      routeClarity = 'fair';
    }

    // Alternatif rotalar
    const alternativeRoutes = context.preparedness.hasPlan ? 2 : 1;

    // Toplanma alanı mesafesi (varsayılan)
    const assemblyPointDistance = 2.5;

    // Erişilebilirlik
    let assemblyPointAccessibility: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
    if (familyProfile.mobilityLimitations) {
      assemblyPointAccessibility = 'fair';
    }

    // Araç erişimi
    const vehicleAccess = true; // Varsayılan

    // Toplu taşıma erişimi
    const publicTransportAccess = context.hazardCluster?.hazardLevel === 'very_high' || context.hazardCluster?.hazardLevel === 'high';

    // Tahliye süresi tahmini
    let evacuationTimeEstimate = 10;
    if (floorNumber >= 10) {
      evacuationTimeEstimate = 20;
    } else if (floorNumber >= 5) {
      evacuationTimeEstimate = 15;
    }
    if (familyProfile.evacuationDifficulty === 'critical') {
      evacuationTimeEstimate += 15;
    } else if (familyProfile.evacuationDifficulty === 'difficult') {
      evacuationTimeEstimate += 10;
    }

    // Engeller
    const obstacles: string[] = [];
    if (floorNumber >= 8) {
      obstacles.push('Yüksek kat sayısı');
    }
    if (familyProfile.mobilityLimitations) {
      obstacles.push('Hareket kısıtlamaları');
    }
    if (!context.preparedness.hasPlan) {
      obstacles.push('Hazırlık planı eksik');
    }

    // Hazırlık skoru
    let readinessScore = 60;
    if (routeClarity === 'excellent') readinessScore += 20;
    if (alternativeRoutes >= 2) readinessScore += 10;
    if (context.preparedness.hasPlan) readinessScore += 10;
    readinessScore = Math.min(100, Math.max(30, readinessScore));

    return {
      routeClarity,
      alternativeRoutes,
      assemblyPointDistance,
      assemblyPointAccessibility,
      vehicleAccess,
      publicTransportAccess,
      evacuationTimeEstimate,
      obstacles,
      readinessScore,
    };
  }

  private buildHistoricalComparison(cacheKey: string, newScore: number): HistoricalRiskComparison {
    const previous = this.lastScores.get(cacheKey);
    const previousScore = typeof previous === 'number' ? previous : undefined;
    const scoreChange = previousScore ? newScore - previousScore : 0;
    const trendDirection = this.computeTrend(cacheKey, newScore);

    const factorsImproved: string[] = [];
    const factorsWorsened: string[] = [];

    if (scoreChange < -3) {
      factorsImproved.push('Genel risk azaldı');
    } else if (scoreChange > 3) {
      factorsWorsened.push('Genel risk arttı');
    }

    return {
      previousScore,
      previousDate: previousScore ? Date.now() - 3600000 : undefined, // 1 saat önce varsayımı
      scoreChange,
      trendDirection,
      factorsImproved,
      factorsWorsened,
      comparisonPeriod: '24h',
    };
  }

  private calculateMitigationPotential(
    context: RiskContext,
    currentScore: number,
    buildingAnalysis: BuildingRiskAnalysis
  ): MitigationPotential {
    const quickWins: Array<{
      action: string;
      impact: number;
      effort: 'low' | 'medium' | 'high';
      cost: 'free' | 'low' | 'medium' | 'high';
      timeframe: string;
    }> = [];

    const longTermImprovements: Array<{
      action: string;
      impact: number;
      effort: 'low' | 'medium' | 'high';
      cost: 'free' | 'low' | 'medium' | 'high';
      timeframe: string;
    }> = [];

    // Hızlı kazanımlar
    if (!context.preparedness.hasPlan) {
      quickWins.push({
        action: 'Hazırlık planı oluştur',
        impact: 8,
        effort: 'low',
        cost: 'free',
        timeframe: '1 gün',
      });
    }

    if (context.preparedness.completionRate < 50) {
      quickWins.push({
        action: 'Hazırlık planını tamamla',
        impact: 5,
        effort: 'low',
        cost: 'free',
        timeframe: '1 hafta',
      });
    }

    quickWins.push({
      action: 'Acil durum çantası hazırla',
      impact: 3,
      effort: 'low',
      cost: 'low',
      timeframe: '1 gün',
    });

    quickWins.push({
      action: 'Ağır eşyaları sabitle',
      impact: 4,
      effort: 'low',
      cost: 'low',
      timeframe: '1 hafta',
    });

    // Uzun vadeli iyileştirmeler
    if (buildingAnalysis.retrofitUrgency === 'critical' || buildingAnalysis.retrofitUrgency === 'high') {
      longTermImprovements.push({
        action: 'Bina güçlendirme yap',
        impact: 25,
        effort: 'high',
        cost: 'high',
        timeframe: '6-12 ay',
      });
    }

    if (buildingAnalysis.soilRisk > 70) {
      longTermImprovements.push({
        action: 'Zemin iyileştirme',
        impact: 15,
        effort: 'high',
        cost: 'high',
        timeframe: '3-6 ay',
      });
    }

    longTermImprovements.push({
      action: 'Düzenli bina bakımı',
      impact: 8,
      effort: 'medium',
      cost: 'medium',
      timeframe: 'Sürekli',
    });

    const maxPotentialReduction = Math.min(30, quickWins.reduce((sum, w) => sum + w.impact, 0) + longTermImprovements.reduce((sum, w) => sum + w.impact, 0));
    const priorityActions = [
      ...quickWins.slice(0, 2).map((w) => w.action),
      ...longTermImprovements.slice(0, 1).map((w) => w.action),
    ];

    return {
      quickWins,
      longTermImprovements,
      maxPotentialReduction,
      priorityActions,
    };
  }

  private calculateTimeToSafety(context: RiskContext, evacuationReadiness: EvacuationReadiness): number {
    return evacuationReadiness.evacuationTimeEstimate + Math.round(evacuationReadiness.assemblyPointDistance * 2);
  }

  private calculateSurvivalProbability(
    totalScore: number,
    buildingAnalysis: BuildingRiskAnalysis,
    evacuationReadiness: EvacuationReadiness
  ): number {
    let probability = 100 - totalScore; // Temel skor

    // Bina analizi etkisi
    if (buildingAnalysis.estimatedDamageLevel === 'collapse') {
      probability -= 30;
    } else if (buildingAnalysis.estimatedDamageLevel === 'severe') {
      probability -= 15;
    }

    // Tahliye hazırlığı etkisi
    if (evacuationReadiness.readinessScore < 50) {
      probability -= 10;
    } else if (evacuationReadiness.readinessScore > 80) {
      probability += 10;
    }

    return Math.max(30, Math.min(95, Math.round(probability)));
  }

  private enrichFactorsWithDetails(factors: RiskFactor[], context: RiskContext): RiskFactor[] {
    return factors.map((factor) => {
      const enriched: RiskFactor = {
        ...factor,
        impact: factor.severity === 'critical' ? 'critical' : factor.severity === 'high' ? 'high' : factor.severity === 'medium' ? 'medium' : 'low',
        controllability: this.getControllability(factor.id),
        mitigationOptions: this.getMitigationOptions(factor.id, context),
        trend: 'stable',
      };

      // Alt faktörler ekle
      if (factor.id === 'building_vulnerability') {
        enriched.subFactors = [
          {
            id: 'age',
            name: 'Bina Yaşı',
            value: context.building.constructionYear ? (context.building.constructionYear < 2000 ? 85 : 50) : 60,
            description: context.building.constructionYear ? `${context.building.constructionYear} yılında inşa edilmiş` : 'Bilinmiyor',
            contribution: 30,
          },
          {
            id: 'floor',
            name: 'Kat Sayısı',
            value: context.building.floorNumber >= 8 ? 75 : context.building.floorNumber >= 5 ? 60 : 40,
            description: `${context.building.floorNumber} katlı bina`,
            contribution: 25,
          },
          {
            id: 'type',
            name: 'Yapı Tipi',
            value: context.building.vulnerabilityScore,
            description: context.building.type,
            contribution: 45,
          },
        ];
      }

      return enriched;
    });
  }

  private getControllability(factorId: string): 'high' | 'medium' | 'low' | 'none' {
    const controllabilityMap: Record<string, 'high' | 'medium' | 'low' | 'none'> = {
      regional_hazard: 'none',
      recent_activity: 'none',
      building_vulnerability: 'medium',
      preparedness_gap: 'high',
      response_pressure: 'low',
    };
    return controllabilityMap[factorId] ?? 'medium';
  }

  private getMitigationOptions(factorId: string, context: RiskContext): string[] {
    const options: Record<string, string[]> = {
      building_vulnerability: [
        'Bina güçlendirme yapılabilir',
        'Ağır eşyalar sabitlenebilir',
        'Zemin iyileştirme yapılabilir',
      ],
      preparedness_gap: [
        'Hazırlık planı oluşturulabilir',
        'Acil durum çantası hazırlanabilir',
        'Tatbikat yapılabilir',
      ],
      response_pressure: [
        'Alternatif rotalar belirlenebilir',
        'Toplanma alanları önceden ziyaret edilebilir',
      ],
    };
    return options[factorId] ?? [];
  }

  private async enrichWithAI(score: RiskScore, context: RiskContext): Promise<RiskScore> {
    try {
      const region = context.hazardCluster?.name ?? 'Bilinmiyor';
      const prompt = `Verilen risk skorunu kullanarak daha detaylı öneriler üret. Yalnızca JSON dön:
{
  "insights": [
    {
      "title": "Başlık",
      "description": "Açıklama",
      "severity": "info|warning|critical",
      "actions": ["Öneri"]
    }
  ],
  "recommendations": ["Öneri"],
  "checklist": ["Kısa madde"]
}

Bölge: ${region}
Skor: ${score.score}
Seviye: ${score.level}
Mevcut öneriler: ${score.recommendations.join('; ')}
Yapısal Not: ${context.building.description}`;

      const systemPrompt = `AFAD standartlarına uygun, insan hayatını koruyan öneriler üret. Yanıtta yalnızca JSON bulunsun.`;

      // ELITE: Cost optimization - reduced maxTokens
      const aiResponse = await openAIService.generateText(prompt, {
        systemPrompt,
        maxTokens: 400, // Optimized: Reduced from 600 to save ~$0.00012 per call
        temperature: 0.4,
        serviceName: 'RiskScoringService', // ELITE: For cost tracking
      });

      // ELITE: Extract JSON more safely - handle truncated responses
      let jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI enrichment JSON not found');
      }

      let jsonStr = jsonMatch[0];
      
      // ELITE: Fix truncated JSON by attempting to close unclosed brackets/braces
      // This handles cases where maxTokens limit cuts off the response
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/\]/g) || []).length;
      
      // Close unclosed structures
      if (openBraces > closeBraces) {
        jsonStr += '}'.repeat(openBraces - closeBraces);
      }
      if (openBrackets > closeBrackets) {
        jsonStr += ']'.repeat(openBrackets - closeBrackets);
      }
      
      // ELITE: Try to parse, if it fails, try to extract valid JSON substring
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        // If parse fails, try to find a valid JSON substring
        // Start from the first { and try progressively shorter substrings
        const firstBrace = jsonStr.indexOf('{');
        if (firstBrace >= 0) {
          for (let i = jsonStr.length; i > firstBrace + 10; i--) {
            try {
              const candidate = jsonStr.substring(firstBrace, i);
              parsed = JSON.parse(candidate);
              break;
            } catch {
              // Continue trying shorter strings
            }
          }
        }
        
        // If still no valid JSON, throw original error
        if (!parsed) {
          throw parseError;
        }
      }

      if (Array.isArray(parsed.insights)) {
        const extraInsights: RiskInsight[] = parsed.insights
          .map((item: any, idx: number) => ({
            id: `ai-${idx}`,
            title: item.title || 'AI Analizi',
            description: item.description || '',
            severity: item.severity === 'critical' || item.severity === 'warning' ? item.severity : 'info',
            actions: Array.isArray(item.actions) ? item.actions : undefined,
          }))
          .filter((item: RiskInsight) => item.description !== '');

        score.insights = [...score.insights, ...extraInsights];
      }

      if (Array.isArray(parsed.recommendations)) {
        const enriched = parsed.recommendations.filter((item: unknown): item is string => typeof item === 'string');
        score.recommendations = Array.from(new Set([...score.recommendations, ...enriched])).slice(0, 8);
      }

      if (Array.isArray(parsed.checklist)) {
        const enriched = parsed.checklist.filter((item: unknown): item is string => typeof item === 'string');
        score.checklist = Array.from(new Set([...(score.checklist ?? []), ...enriched])).slice(0, 8);
      }
    } catch (error) {
      logger.warn('AI enrichment parse error, using base recommendations', error);
    }

    return score;
  }
}

export const riskScoringService = new RiskScoringService();

