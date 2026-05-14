/**
 * EARTHQUAKE RISK ANALYSIS SERVICE
 *
 * BİLİMSEL DOĞRULUK NOTU:
 * Depremler "tahmin edilemez" — günümüz bilimi bir depremin tam zamanını, yerini
 * ve büyüklüğünü önceden söyleyemez. Bu servis:
 *
 *   1. Mevcut sensör verilerinden (akselerometre + gyro) P-dalgası tespiti yapar
 *      — bu "early warning" (erken uyarı) tekniğidir, deprem oluştuktan SONRA
 *      yerel sarsıntı şiddet TAHMİNİ verir. Tahmin edilen değer fay merkezi
 *      verilerinden değil, cihazın hissettiği sinyalden çıkarılır.
 *   2. Tarihsel verilerden bölgesel RİSK ANALİZİ yapar (Kahramanmaraş fayı,
 *      Marmara fayı vb. kaç yılda bir M7+ üretmiş, son depremden geçen süre).
 *
 * Eski isim `AIEarthquakePredictionService` yanıltıcıydı. Geriye uyumluluk için
 * eski export alias olarak korunuyor — yeni kullanımlar `earthquakeRiskAnalysisService`
 * üzerinden olmalı.
 */

import { createLogger } from '../utils/logger';
import { ensembleDetectionService, EnsembleResult } from './EnsembleDetectionService';
import { SensorReading } from './EnsembleDetectionService';

const logger = createLogger('AIEarthquakePredictionService');

export interface AIPredictionResult {
  willOccur: boolean;
  confidence: number; // 0-100
  estimatedMagnitude: number;
  timeAdvance: number; // seconds before earthquake
  probability: number; // 0-1
  factors: {
    seismicActivity: number;
    precursorSignals: number;
    historicalPattern: number;
    ensembleConsensus: number;
  };
  recommendedAction: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface HistoricalPattern {
  region: string;
  averageInterval: number; // days
  lastMajorEvent: number; // timestamp
  magnitudeTrend: number[];
}

// ELITE: Type-safe earthquake data interface
interface EarthquakeData {
  time: number;
  magnitude: number;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

class AIEarthquakePredictionService {
  private isInitialized = false;
  private historicalPatterns: Map<string, HistoricalPattern> = new Map();
  private recentPredictions: AIPredictionResult[] = [];
  private readonly MAX_PREDICTIONS_CACHE = 50;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await ensembleDetectionService.initialize();
      this.isInitialized = true;

      if (__DEV__) {
        logger.info('EarthquakeRiskAnalysisService initialized - on-device sensor analysis active');
      }
    } catch (error) {
      logger.error('Failed to initialize AIEarthquakePredictionService:', error);
      throw error;
    }
  }

  /**
   * ELITE: Predict earthquake using AI ensemble models
   */
  async predict(
    sensorReadings: SensorReading[],
    location?: { latitude: number; longitude: number },
    recentEarthquakes?: EarthquakeData[],
  ): Promise<AIPredictionResult | null> {
    if (!this.isInitialized) {
      await this.initialize().catch((error) => {
        logger.warn('AIEarthquakePredictionService initialize failed before predict', error);
      });
    }

    if (!this.isInitialized) {
      logger.warn('AIEarthquakePredictionService not initialized');
      return null;
    }

    try {
      // Step 1: Ensemble detection
      const ensembleResult = ensembleDetectionService.detect(sensorReadings);

      // Step 2: Historical pattern analysis
      const historicalFactor = location
        ? this.analyzeHistoricalPattern(location, recentEarthquakes)
        : 0.5;

      // Step 3: Precursor signal analysis
      const precursorFactor = this.analyzePrecursorSignals(sensorReadings);

      // Step 4: Seismic activity trend
      const activityFactor = this.analyzeSeismicActivityTrend(recentEarthquakes);

      // Step 5: Remote AI deliberately disabled for life-safety + cost control.
      // The final alert decision must come from deterministic on-device signal analysis,
      // not from an LLM.

      // Step 6: Combine all factors
      const factors = {
        seismicActivity: activityFactor,
        precursorSignals: precursorFactor,
        historicalPattern: historicalFactor,
        ensembleConsensus: ensembleResult.confidence / 100,
      };

      // Calculate final probability
      const probability = this.calculateProbability(factors, ensembleResult);

      // Determine if earthquake will occur
      const willOccur = probability > 0.7 && ensembleResult.confidence > 75;

      // Calculate time advance
      const timeAdvance = ensembleResult.timeAdvance || this.estimateTimeAdvance(probability, factors);

      // Determine urgency
      const urgency = this.determineUrgency(probability, ensembleResult.estimatedMagnitude, timeAdvance);

      // Get recommended action
      const recommendedAction = this.getRecommendedAction(urgency, ensembleResult.estimatedMagnitude, timeAdvance);

      const result: AIPredictionResult = {
        willOccur,
        confidence: Math.round(probability * 100),
        estimatedMagnitude: ensembleResult.estimatedMagnitude || 0,
        timeAdvance,
        probability,
        factors,
        recommendedAction,
        urgency,
      };

      // Cache prediction
      this.recentPredictions.push(result);
      if (this.recentPredictions.length > this.MAX_PREDICTIONS_CACHE) {
        this.recentPredictions.shift();
      }

      if (__DEV__ && willOccur) {
        logger.info(`Sensor risk signal: ${probability.toFixed(2)} probability, ${timeAdvance}s estimated advantage, ${ensembleResult.estimatedMagnitude.toFixed(1)} local intensity`);
      }

      return result;
    } catch (error) {
      logger.error('Sensor risk analysis error:', error);
      return null;
    }
  }

  /**
   * Analyze historical patterns for region
   */
  private analyzeHistoricalPattern(
    location: { latitude: number; longitude: number },
    recentEarthquakes?: EarthquakeData[],
  ): number {
    if (!recentEarthquakes || recentEarthquakes.length === 0) {
      return 0.5; // Neutral if no data
    }

    // Find region key
    const regionKey = this.getRegionKey(location);
    const pattern = this.historicalPatterns.get(regionKey);

    if (!pattern) {
      // Create new pattern
      const now = Date.now();
      const intervals: number[] = [];
      let lastEvent = 0;

      for (let i = 1; i < recentEarthquakes.length; i++) {
        const timeDiff = recentEarthquakes[i].time - recentEarthquakes[i - 1].time;
        intervals.push(timeDiff);
        if (recentEarthquakes[i].magnitude >= 5.0) {
          lastEvent = recentEarthquakes[i].time;
        }
      }

      const avgInterval = intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 30 * 24 * 60 * 60 * 1000; // Default 30 days

      const newPattern: HistoricalPattern = {
        region: regionKey,
        averageInterval: avgInterval,
        lastMajorEvent: lastEvent,
        magnitudeTrend: recentEarthquakes.map(e => e.magnitude || 0),
      };

      this.historicalPatterns.set(regionKey, newPattern);
      return 0.5;
    }

    // Analyze pattern
    const now = Date.now();
    const timeSinceLastMajor = now - pattern.lastMajorEvent;
    const intervalRatio = timeSinceLastMajor / pattern.averageInterval;

    // If approaching average interval, increase probability
    if (intervalRatio > 0.8 && intervalRatio < 1.2) {
      return 0.7; // High probability
    } else if (intervalRatio > 0.6 && intervalRatio < 1.4) {
      return 0.6; // Medium-high probability
    }

    return 0.5; // Neutral
  }

  /**
   * Analyze precursor signals
   */
  private analyzePrecursorSignals(readings: SensorReading[]): number {
    if (readings.length < 100) return 0.5;

    // Look for subtle precursor patterns
    const recentReadings = readings.slice(-500); // Last 5 seconds at 100Hz
    const magnitudes = recentReadings.map(r => r.magnitude);

    // Check for gradual increase (precursor signal)
    const firstHalf = magnitudes.slice(0, Math.floor(magnitudes.length / 2));
    const secondHalf = magnitudes.slice(Math.floor(magnitudes.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const increase = secondAvg - firstAvg;

    // Small gradual increase indicates precursor
    if (increase > 0.01 && increase < 0.1) {
      return 0.7; // High precursor signal
    } else if (increase > 0.005) {
      return 0.6; // Medium precursor signal
    }

    return 0.5; // Neutral
  }

  /**
   * Analyze seismic activity trend
   */
  private analyzeSeismicActivityTrend(recentEarthquakes?: EarthquakeData[]): number {
    if (!recentEarthquakes || recentEarthquakes.length < 3) {
      return 0.5; // Neutral
    }

    const now = Date.now();
    const last24h = recentEarthquakes.filter(e => now - e.time < 24 * 60 * 60 * 1000);
    const last7d = recentEarthquakes.filter(e => now - e.time < 7 * 24 * 60 * 60 * 1000);

    // Increased activity indicates higher probability
    if (last24h.length >= 5) {
      return 0.8; // Very high activity
    } else if (last24h.length >= 3) {
      return 0.7; // High activity
    } else if (last7d.length >= 10) {
      return 0.6; // Moderate activity
    }

    return 0.5; // Normal activity
  }

  /**
   * Calculate final probability from all factors
   */
  private calculateProbability(
    factors: AIPredictionResult['factors'],
    ensembleResult: EnsembleResult,
  ): number {
    // Weighted combination
    const weights = {
      seismicActivity: 0.25,
      precursorSignals: 0.30,
      historicalPattern: 0.20,
      ensembleConsensus: 0.25,
    };

    const weightedSum =
      factors.seismicActivity * weights.seismicActivity +
      factors.precursorSignals * weights.precursorSignals +
      factors.historicalPattern * weights.historicalPattern +
      factors.ensembleConsensus * weights.ensembleConsensus;

    return Math.max(0, Math.min(1, weightedSum));
  }

  /**
   * Estimate time advance based on probability and factors
   */
  private estimateTimeAdvance(
    probability: number,
    factors: AIPredictionResult['factors'],
  ): number {
    // Higher probability and stronger precursor signals = more advance time
    const baseAdvance = 10; // Base 10 seconds
    const probabilityBonus = probability * 10; // Up to 10 seconds bonus
    const precursorBonus = factors.precursorSignals * 5; // Up to 5 seconds bonus

    return Math.round(baseAdvance + probabilityBonus + precursorBonus);
  }

  /**
   * Determine urgency level
   */
  private determineUrgency(
    probability: number,
    magnitude: number,
    timeAdvance: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (probability > 0.85 && magnitude >= 5.0) {
      return 'critical';
    }
    if (probability > 0.75 && magnitude >= 4.5) {
      return 'critical';
    }
    if (probability > 0.70 && magnitude >= 4.0) {
      return 'high';
    }
    if (probability > 0.60 && timeAdvance < 15) {
      return 'high';
    }
    if (probability > 0.50) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get recommended action
   */
  private getRecommendedAction(
    urgency: 'low' | 'medium' | 'high' | 'critical',
    magnitude: number,
    timeAdvance: number,
  ): string {
    if (urgency === 'critical') {
      return `🚨 KRİTİK SENSÖR UYARISI! ${magnitude.toFixed(1)} tahmini sarsıntı sinyali algılandı. Yaklaşık ${Math.round(timeAdvance)} saniyelik avantaj olabilir. HEMEN güvenli pozisyona geçin!`;
    }
    if (urgency === 'high') {
      return `⚠️ YÜKSEK SENSÖR RİSKİ! ${magnitude.toFixed(1)} tahmini sarsıntı sinyali algılandı. Yaklaşık ${Math.round(timeAdvance)} saniyelik avantaj olabilir. Güvenli pozisyona geçin!`;
    }
    if (urgency === 'medium') {
      return `⚠️ ORTA SENSÖR RİSKİ! Cihaz sarsıntı sinyali algılıyor. Hazırlıklı olun ve resmi uyarıları takip edin.`;
    }
    return `ℹ️ Düşük risk seviyesi. Dikkatli olun.`;
  }

  /**
   * Get region key for pattern tracking
   */
  private getRegionKey(location: { latitude: number; longitude: number }): string {
    // Round to 0.5 degree grid (approximately 50km)
    const lat = Math.round(location.latitude * 2) / 2;
    const lng = Math.round(location.longitude * 2) / 2;
    return `${lat},${lng}`;
  }

  /**
   * Get recent predictions
   */
  getRecentPredictions(count: number = 10): AIPredictionResult[] {
    return this.recentPredictions.slice(-count).reverse();
  }

  /**
   * Stop the service
   */
  stop(): void {
    this.isInitialized = false;
    this.historicalPatterns.clear();
    this.recentPredictions = [];

    if (__DEV__) {
      logger.info('AIEarthquakePredictionService stopped');
    }
  }
}

// Yeni isim (kullanılmalı)
export const earthquakeRiskAnalysisService = new AIEarthquakePredictionService();

// Geriye uyumluluk — eski adıyla import edenler için (deprecated)
/** @deprecated Use `earthquakeRiskAnalysisService` instead. */
export const aiEarthquakePredictionService = earthquakeRiskAnalysisService;
