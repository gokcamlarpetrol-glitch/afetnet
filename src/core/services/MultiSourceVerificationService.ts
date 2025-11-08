/**
 * MULTI-SOURCE VERIFICATION SERVICE - Level 3 AI
 * Verifies earthquake detection using multiple sources
 * Combines: Sensor data + AFAD + USGS + Kandilli + EMSC + Community
 * 
 * This provides the highest accuracy by cross-verifying all sources
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('MultiSourceVerificationService');

export interface VerificationSource {
  source: 'sensor' | 'afad' | 'usgs' | 'kandilli' | 'emsc' | 'community';
  magnitude: number;
  location: { latitude: number; longitude: number };
  timestamp: number;
  confidence: number; // 0-100
}

export interface VerificationResult {
  verified: boolean;
  confidence: number; // 0-100
  consensusMagnitude: number;
  consensusLocation: { latitude: number; longitude: number };
  sourceCount: number;
  sources: VerificationSource[];
  verificationTime: number; // milliseconds
}

class MultiSourceVerificationService {
  private isInitialized = false;
  private readonly VERIFICATION_WINDOW = 60000; // 60 seconds - sources must agree within this window
  private readonly MIN_SOURCES = 2; // Minimum 2 sources for verification
  private readonly LOCATION_TOLERANCE = 0.5; // degrees - sources must be within 0.5° (~50km)
  private readonly MAGNITUDE_TOLERANCE = 0.5; // magnitude difference tolerance

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.isInitialized = true;
      if (__DEV__) {
        logger.info('MultiSourceVerificationService initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize MultiSourceVerificationService:', error);
      throw error;
    }
  }

  /**
   * ELITE: Verify earthquake using multiple sources
   */
  verify(sources: VerificationSource[]): VerificationResult {
    if (!this.isInitialized) {
      logger.warn('MultiSourceVerificationService not initialized');
      return this.createDefaultResult();
    }

    if (sources.length < this.MIN_SOURCES) {
      return this.createDefaultResult();
    }

    const verificationStartTime = Date.now();

    // Filter sources within time window
    const now = Date.now();
    const recentSources = sources.filter(s => 
      now - s.timestamp <= this.VERIFICATION_WINDOW
    );

    if (recentSources.length < this.MIN_SOURCES) {
      return this.createDefaultResult();
    }

    // Group sources by location (within tolerance)
    const locationGroups = this.groupByLocation(recentSources);

    // Find the largest group (consensus)
    const largestGroup = locationGroups.reduce((largest, group) => 
      group.length > largest.length ? group : largest
    );

    if (largestGroup.length < this.MIN_SOURCES) {
      return this.createDefaultResult();
    }

    // Verify magnitude consistency
    const magnitudeConsensus = this.verifyMagnitudeConsensus(largestGroup);
    if (!magnitudeConsensus.consistent) {
      return this.createDefaultResult();
    }

    // Calculate consensus location (weighted average)
    const consensusLocation = this.calculateConsensusLocation(largestGroup);

    // Calculate consensus magnitude (weighted average)
    const consensusMagnitude = this.calculateConsensusMagnitude(largestGroup);

    // Calculate overall confidence
    const confidence = this.calculateVerificationConfidence(
      largestGroup,
      magnitudeConsensus,
      recentSources.length
    );

    const verificationTime = Date.now() - verificationStartTime;

    if (__DEV__ && confidence > 80) {
      logger.info(`✅ MULTI-SOURCE VERIFICATION: ${largestGroup.length} sources agree - ${consensusMagnitude.toFixed(1)} magnitude, ${confidence.toFixed(1)}% confidence`);
    }

    return {
      verified: confidence > 75,
      confidence,
      consensusMagnitude,
      consensusLocation,
      sourceCount: largestGroup.length,
      sources: largestGroup,
      verificationTime,
    };
  }

  /**
   * Group sources by location (within tolerance)
   */
  private groupByLocation(sources: VerificationSource[]): VerificationSource[][] {
    const groups: VerificationSource[][] = [];

    for (const source of sources) {
      let added = false;
      
      for (const group of groups) {
        const groupCenter = this.calculateGroupCenter(group);
        const distance = this.calculateDistance(
          source.location,
          groupCenter
        );

        if (distance <= this.LOCATION_TOLERANCE) {
          group.push(source);
          added = true;
          break;
        }
      }

      if (!added) {
        groups.push([source]);
      }
    }

    return groups;
  }

  /**
   * Calculate group center (average location)
   */
  private calculateGroupCenter(group: VerificationSource[]): {
    latitude: number;
    longitude: number;
  } {
    const avgLat = group.reduce((sum, s) => sum + s.location.latitude, 0) / group.length;
    const avgLon = group.reduce((sum, s) => sum + s.location.longitude, 0) / group.length;
    
    return { latitude: avgLat, longitude: avgLon };
  }

  /**
   * Calculate distance between two locations (degrees)
   */
  private calculateDistance(
    loc1: { latitude: number; longitude: number },
    loc2: { latitude: number; longitude: number }
  ): number {
    const latDiff = Math.abs(loc1.latitude - loc2.latitude);
    const lonDiff = Math.abs(loc1.longitude - loc2.longitude);
    return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
  }

  /**
   * Verify magnitude consistency
   */
  private verifyMagnitudeConsensus(group: VerificationSource[]): {
    consistent: boolean;
    avgMagnitude: number;
    stdDev: number;
  } {
    const magnitudes = group.map(s => s.magnitude);
    const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const variance = magnitudes.reduce((sum, val) => sum + Math.pow(val - avgMagnitude, 2), 0) / magnitudes.length;
    const stdDev = Math.sqrt(variance);

    const consistent = stdDev <= this.MAGNITUDE_TOLERANCE;

    return { consistent, avgMagnitude, stdDev };
  }

  /**
   * Calculate consensus location (weighted by confidence)
   */
  private calculateConsensusLocation(group: VerificationSource[]): {
    latitude: number;
    longitude: number;
  } {
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLon = 0;

    for (const source of group) {
      const weight = source.confidence / 100;
      totalWeight += weight;
      weightedLat += source.location.latitude * weight;
      weightedLon += source.location.longitude * weight;
    }

    return {
      latitude: weightedLat / totalWeight,
      longitude: weightedLon / totalWeight,
    };
  }

  /**
   * Calculate consensus magnitude (weighted by confidence)
   */
  private calculateConsensusMagnitude(group: VerificationSource[]): number {
    let totalWeight = 0;
    let weightedMagnitude = 0;

    for (const source of group) {
      const weight = source.confidence / 100;
      totalWeight += weight;
      weightedMagnitude += source.magnitude * weight;
    }

    return weightedMagnitude / totalWeight;
  }

  /**
   * Calculate verification confidence
   */
  private calculateVerificationConfidence(
    group: VerificationSource[],
    magnitudeConsensus: { avgMagnitude: number; stdDev: number },
    totalSources: number
  ): number {
    let confidence = 50; // Base confidence

    // More sources = higher confidence
    confidence += Math.min(30, group.length * 5);

    // Magnitude consistency
    if (magnitudeConsensus.stdDev < 0.2) {
      confidence += 15; // Very consistent
    } else if (magnitudeConsensus.stdDev < 0.4) {
      confidence += 10; // Consistent
    }

    // Source diversity (different types)
    const sourceTypes = new Set(group.map(s => s.source));
    confidence += sourceTypes.size * 5; // +5% per unique source type

    // Individual source confidence
    const avgSourceConfidence = group.reduce((sum, s) => sum + s.confidence, 0) / group.length;
    confidence += (avgSourceConfidence - 50) * 0.3; // Weighted by source confidence

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Create default result
   */
  private createDefaultResult(): VerificationResult {
    return {
      verified: false,
      confidence: 0,
      consensusMagnitude: 0,
      consensusLocation: { latitude: 0, longitude: 0 },
      sourceCount: 0,
      sources: [],
      verificationTime: 0,
    };
  }

  /**
   * Stop the service
   */
  stop(): void {
    this.isInitialized = false;
    if (__DEV__) {
      logger.info('MultiSourceVerificationService stopped');
    }
  }
}

export const multiSourceVerificationService = new MultiSourceVerificationService();

