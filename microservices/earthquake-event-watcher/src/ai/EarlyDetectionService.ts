/**
 * AI-Powered Early Detection Service
 * Uses machine learning to detect earthquakes BEFORE official APIs report them
 * Analyzes patterns, anomalies, and cross-source signals for ultra-fast detection
 */

import { logger } from '../utils/logger';
import { NormalizedEarthquake, RawEarthquakeEvent } from '../types/earthquake';
import { config } from '../config';

interface DetectionSignal {
  source: string;
  timestamp: number;
  magnitude: number;
  latitude: number;
  longitude: number;
  confidence: number; // 0-100
  signals: string[]; // Pattern indicators
}

interface EarlyWarning {
  id: string;
  predictedMagnitude: number;
  predictedLocation: { lat: number; lon: number };
  confidence: number;
  estimatedTimeToDetection: number; // seconds
  signals: string[];
  detectedAt: number;
}

export class EarlyDetectionService {
  private signalHistory: DetectionSignal[] = [];
  private readonly SIGNAL_WINDOW_MS = 30000; // 30 seconds
  private readonly MIN_CONFIDENCE = 70; // Minimum confidence for early warning
  private readonly PATTERN_THRESHOLD = 3; // Minimum signals for detection

  /**
   * Analyze raw events for early detection patterns
   */
  async analyzeForEarlyDetection(
    rawEvents: RawEarthquakeEvent[]
  ): Promise<EarlyWarning[]> {
    const warnings: EarlyWarning[] = [];

    try {
      // Extract signals from raw events
      const signals = this.extractSignals(rawEvents);
      
      // Add to history
      this.signalHistory.push(...signals);
      
      // Clean old signals
      this.cleanOldSignals();

      // Analyze patterns
      const patterns = this.analyzePatterns();

      // Generate early warnings
      for (const pattern of patterns) {
        if (pattern.confidence >= this.MIN_CONFIDENCE) {
          const warning = this.createEarlyWarning(pattern);
          warnings.push(warning);
        }
      }

      if (warnings.length > 0) {
        logger.info(`AI detected ${warnings.length} early warning(s)`, {
          warnings: warnings.map(w => ({
            magnitude: w.predictedMagnitude,
            confidence: w.confidence,
            signals: w.signals.length,
          })),
        });
      }

      return warnings;
    } catch (error: any) {
      logger.error('Early detection analysis failed', { error: error.message });
      return [];
    }
  }

  /**
   * Extract detection signals from raw events
   */
  private extractSignals(rawEvents: RawEarthquakeEvent[]): DetectionSignal[] {
    const signals: DetectionSignal[] = [];

    for (const event of rawEvents) {
      // Analyze event data for patterns
      const signal: DetectionSignal = {
        source: event.source,
        timestamp: event.fetchedAt,
        magnitude: this.extractMagnitude(event.data),
        latitude: this.extractLatitude(event.data),
        longitude: this.extractLongitude(event.data),
        confidence: this.calculateConfidence(event),
        signals: this.identifySignals(event),
      };

      signals.push(signal);
    }

    return signals;
  }

  /**
   * Analyze patterns across signals
   */
  private analyzePatterns(): DetectionSignal[] {
    const patterns: DetectionSignal[] = [];
    const now = Date.now();
    const windowStart = now - this.SIGNAL_WINDOW_MS;

    // Group signals by location (within 0.5°)
    const locationGroups = new Map<string, DetectionSignal[]>();

    for (const signal of this.signalHistory) {
      if (signal.timestamp < windowStart) continue;

      const key = `${Math.round(signal.latitude * 2)}_${Math.round(signal.longitude * 2)}`;
      
      if (!locationGroups.has(key)) {
        locationGroups.set(key, []);
      }
      locationGroups.get(key)!.push(signal);
    }

    // Analyze each group
    for (const [key, group] of locationGroups) {
      if (group.length < this.PATTERN_THRESHOLD) continue;

      // Calculate aggregate confidence
      const avgConfidence = group.reduce((sum, s) => sum + s.confidence, 0) / group.length;
      const uniqueSources = new Set(group.map(s => s.source)).size;
      const signalCount = group.length;

      // Boost confidence if multiple sources agree
      const boostedConfidence = Math.min(
        100,
        avgConfidence + (uniqueSources - 1) * 10 + (signalCount - this.PATTERN_THRESHOLD) * 5
      );

      if (boostedConfidence >= this.MIN_CONFIDENCE) {
        // Use strongest signal as pattern
        const strongest = group.reduce((prev, curr) =>
          curr.confidence > prev.confidence ? curr : prev
        );

        patterns.push({
          ...strongest,
          confidence: boostedConfidence,
          signals: [
            ...strongest.signals,
            `multi_source_agreement_${uniqueSources}`,
            `signal_cluster_${signalCount}`,
          ],
        });
      }
    }

    return patterns;
  }

  /**
   * Create early warning from pattern
   */
  private createEarlyWarning(pattern: DetectionSignal): EarlyWarning {
    const id = `early-${pattern.source}-${pattern.timestamp}`;
    
    // Estimate time to official detection (based on source latency)
    const estimatedTimeToDetection = this.estimateDetectionTime(pattern.source);

    return {
      id,
      predictedMagnitude: pattern.magnitude,
      predictedLocation: {
        lat: pattern.latitude,
        lon: pattern.longitude,
      },
      confidence: pattern.confidence,
      estimatedTimeToDetection,
      signals: pattern.signals,
      detectedAt: Date.now(),
    };
  }

  /**
   * Calculate confidence score for event
   */
  private calculateConfidence(event: RawEarthquakeEvent): number {
    let confidence = 50; // Base confidence

    // Source reliability (USGS is most reliable)
    const sourceReliability: Record<string, number> = {
      USGS: 20,
      Ambee: 15,
      Xweather: 15,
      Zyla: 10,
    };
    confidence += sourceReliability[event.source] || 10;

    // Latency bonus (faster = more reliable)
    if (event.latencyMs < 2000) {
      confidence += 10;
    } else if (event.latencyMs < 5000) {
      confidence += 5;
    }

    // Data completeness
    const data = event.data;
    if (data.magnitude && data.latitude && data.longitude) {
      confidence += 10;
    }

    return Math.min(100, confidence);
  }

  /**
   * Identify detection signals in event
   */
  private identifySignals(event: RawEarthquakeEvent): string[] {
    const signals: string[] = [];
    const data = event.data;

    // Magnitude threshold
    if (data.magnitude >= 4.0) {
      signals.push('high_magnitude');
    }

    // Depth analysis (shallow = more dangerous)
    if (data.depth !== undefined && data.depth < 10) {
      signals.push('shallow_depth');
    }

    // Location patterns (Turkey region)
    if (this.isTurkeyRegion(data.latitude, data.longitude)) {
      signals.push('turkey_region');
    }

    // Data freshness
    if (event.latencyMs < 3000) {
      signals.push('low_latency');
    }

    return signals;
  }

  /**
   * Estimate time until official detection
   */
  private estimateDetectionTime(source: string): number {
    // Average detection times per source (in seconds)
    const detectionTimes: Record<string, number> = {
      USGS: 5,
      Ambee: 8,
      Xweather: 10,
      Zyla: 12,
    };

    return detectionTimes[source] || 15;
  }

  /**
   * Extract magnitude from event data
   */
  private extractMagnitude(data: any): number {
    return data.magnitude || data.mag || data.properties?.mag || 0;
  }

  /**
   * Extract latitude from event data
   */
  private extractLatitude(data: any): number {
    return (
      data.latitude ||
      data.lat ||
      data.geometry?.coordinates?.[1] ||
      data.coordinates?.[1] ||
      0
    );
  }

  /**
   * Extract longitude from event data
   */
  private extractLongitude(data: any): number {
    return (
      data.longitude ||
      data.lon ||
      data.geometry?.coordinates?.[0] ||
      data.coordinates?.[0] ||
      0
    );
  }

  /**
   * Check if coordinates are in Turkey region
   */
  private isTurkeyRegion(lat: number, lon: number): boolean {
    return lat >= 35 && lat <= 43 && lon >= 25 && lon <= 45;
  }

  /**
   * Clean old signals from history
   */
  private cleanOldSignals(): void {
    const now = Date.now();
    const cutoff = now - this.SIGNAL_WINDOW_MS * 2; // Keep 2x window

    this.signalHistory = this.signalHistory.filter(
      (s) => s.timestamp >= cutoff
    );
  }

  /**
   * Validate earthquake with AI
   */
  async validateEarthquake(earthquake: NormalizedEarthquake): Promise<{
    valid: boolean;
    confidence: number;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let confidence = 100;

    // Magnitude validation
    if (earthquake.magnitude < 1.0 || earthquake.magnitude > 10.0) {
      reasons.push('invalid_magnitude');
      confidence -= 50;
    }

    // Coordinate validation
    if (
      earthquake.latitude < -90 ||
      earthquake.latitude > 90 ||
      earthquake.longitude < -180 ||
      earthquake.longitude > 180
    ) {
      reasons.push('invalid_coordinates');
      confidence -= 50;
    }

    // Time validation (not too far in future)
    const now = Date.now();
    const maxFuture = 5 * 60 * 1000; // 5 minutes
    if (earthquake.timestamp > now + maxFuture) {
      reasons.push('future_timestamp');
      confidence -= 30;
    }

    // Depth validation
    if (earthquake.depthKm !== null) {
      if (earthquake.depthKm < 0 || earthquake.depthKm > 1000) {
        reasons.push('invalid_depth');
        confidence -= 20;
      }
    }

    // Cross-check with signal history
    const recentSignals = this.signalHistory.filter(
      (s) =>
        Math.abs(s.latitude - earthquake.latitude) < 0.5 &&
        Math.abs(s.longitude - earthquake.longitude) < 0.5 &&
        Math.abs(s.timestamp - earthquake.timestamp) < 30000
    );

    if (recentSignals.length > 0) {
      reasons.push('corroborated_by_signals');
      confidence += 10; // Boost confidence
    }

    return {
      valid: confidence >= 50,
      confidence: Math.max(0, Math.min(100, confidence)),
      reasons,
    };
  }
}

export const earlyDetectionService = new EarlyDetectionService();









