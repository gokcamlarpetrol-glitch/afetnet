/**
 * Pattern Recognition Service
 * AI-powered pattern recognition for earthquake prediction
 * Analyzes historical patterns and real-time signals
 */

import { logger } from '../utils/logger';
import { DetectionSignal } from './EarlyDetectionService';

interface Pattern {
  type: string;
  confidence: number;
  indicators: string[];
  predictedMagnitude: number;
  predictedLocation: { lat: number; lon: number };
}

export class PatternRecognitionService {
  private patterns: Pattern[] = [];

  /**
   * Recognize patterns in signal history
   */
  recognizePatterns(signals: DetectionSignal[]): Pattern[] {
    const recognized: Pattern[] = [];

    // Pattern 1: Cluster Detection
    const clusterPattern = this.detectClusterPattern(signals);
    if (clusterPattern) {
      recognized.push(clusterPattern);
    }

    // Pattern 2: Swarm Detection
    const swarmPattern = this.detectSwarmPattern(signals);
    if (swarmPattern) {
      recognized.push(swarmPattern);
    }

    // Pattern 3: Foreshock Pattern
    const foreshockPattern = this.detectForeshockPattern(signals);
    if (foreshockPattern) {
      recognized.push(foreshockPattern);
    }

    // Pattern 4: Multi-Source Convergence
    const convergencePattern = this.detectConvergencePattern(signals);
    if (convergencePattern) {
      recognized.push(convergencePattern);
    }

    return recognized;
  }

  /**
   * Detect cluster pattern (multiple events in same area)
   */
  private detectClusterPattern(signals: DetectionSignal[]): Pattern | null {
    if (signals.length < 3) return null;

    // Group by location (within 0.2°)
    const clusters = new Map<string, DetectionSignal[]>();

    for (const signal of signals) {
      const key = `${Math.round(signal.latitude * 5)}_${Math.round(signal.longitude * 5)}`;
      
      if (!clusters.has(key)) {
        clusters.set(key, []);
      }
      clusters.get(key)!.push(signal);
    }

    // Find largest cluster
    let largestCluster: DetectionSignal[] = [];
    for (const cluster of clusters.values()) {
      if (cluster.length > largestCluster.length) {
        largestCluster = cluster;
      }
    }

    if (largestCluster.length >= 3) {
      const avgLat = largestCluster.reduce((sum, s) => sum + s.latitude, 0) / largestCluster.length;
      const avgLon = largestCluster.reduce((sum, s) => sum + s.longitude, 0) / largestCluster.length;
      const maxMagnitude = Math.max(...largestCluster.map(s => s.magnitude));
      const avgConfidence = largestCluster.reduce((sum, s) => sum + s.confidence, 0) / largestCluster.length;

      return {
        type: 'cluster',
        confidence: Math.min(100, avgConfidence + 20),
        indicators: [`cluster_size_${largestCluster.length}`, 'spatial_clustering'],
        predictedMagnitude: maxMagnitude,
        predictedLocation: { lat: avgLat, lon: avgLon },
      };
    }

    return null;
  }

  /**
   * Detect swarm pattern (rapid sequence of events)
   */
  private detectSwarmPattern(signals: DetectionSignal[]): Pattern | null {
    if (signals.length < 5) return null;

    // Sort by timestamp
    const sorted = [...signals].sort((a, b) => a.timestamp - b.timestamp);

    // Check for rapid sequence (5+ events in 60 seconds)
    const windowMs = 60000;
    let maxInWindow = 0;
    let windowStart = 0;

    for (let i = 0; i < sorted.length; i++) {
      const windowEnd = sorted[i].timestamp + windowMs;
      let count = 1;

      for (let j = i + 1; j < sorted.length && sorted[j].timestamp <= windowEnd; j++) {
        count++;
      }

      if (count > maxInWindow) {
        maxInWindow = count;
        windowStart = sorted[i].timestamp;
      }
    }

    if (maxInWindow >= 5) {
      const windowSignals = sorted.filter(
        (s) => s.timestamp >= windowStart && s.timestamp <= windowStart + windowMs
      );
      const avgLat = windowSignals.reduce((sum, s) => sum + s.latitude, 0) / windowSignals.length;
      const avgLon = windowSignals.reduce((sum, s) => sum + s.longitude, 0) / windowSignals.length;
      const maxMagnitude = Math.max(...windowSignals.map(s => s.magnitude));
      const avgConfidence = windowSignals.reduce((sum, s) => sum + s.confidence, 0) / windowSignals.length;

      return {
        type: 'swarm',
        confidence: Math.min(100, avgConfidence + 15),
        indicators: [`swarm_size_${maxInWindow}`, 'temporal_clustering'],
        predictedMagnitude: maxMagnitude,
        predictedLocation: { lat: avgLat, lon: avgLon },
      };
    }

    return null;
  }

  /**
   * Detect foreshock pattern (smaller events before larger one)
   */
  private detectForeshockPattern(signals: DetectionSignal[]): Pattern | null {
    if (signals.length < 2) return null;

    const sorted = [...signals].sort((a, b) => b.magnitude - a.magnitude);
    const largest = sorted[0];

    // Check for smaller events before largest
    const foreshocks = sorted.filter(
      (s) =>
        s.magnitude < largest.magnitude &&
        s.timestamp < largest.timestamp &&
        Math.abs(s.latitude - largest.latitude) < 0.5 &&
        Math.abs(s.longitude - largest.longitude) < 0.5 &&
        largest.timestamp - s.timestamp < 300000 // Within 5 minutes
    );

    if (foreshocks.length >= 2) {
      return {
        type: 'foreshock',
        confidence: Math.min(100, largest.confidence + 25),
        indicators: [`foreshock_count_${foreshocks.length}`, 'magnitude_escalation'],
        predictedMagnitude: largest.magnitude,
        predictedLocation: { lat: largest.latitude, lon: largest.longitude },
      };
    }

    return null;
  }

  /**
   * Detect convergence pattern (multiple sources detecting same event)
   */
  private detectConvergencePattern(signals: DetectionSignal[]): Pattern | null {
    if (signals.length < 2) return null;

    // Group by location and time
    const groups = new Map<string, DetectionSignal[]>();

    for (const signal of signals) {
      const timeBucket = Math.floor(signal.timestamp / 10000); // 10 second buckets
      const latBucket = Math.round(signal.latitude * 10);
      const lonBucket = Math.round(signal.longitude * 10);
      const key = `${timeBucket}_${latBucket}_${lonBucket}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(signal);
    }

    // Find group with most sources
    let bestGroup: DetectionSignal[] = [];
    for (const group of groups.values()) {
      const uniqueSources = new Set(group.map(s => s.source)).size;
      if (uniqueSources >= 2 && group.length > bestGroup.length) {
        bestGroup = group;
      }
    }

    if (bestGroup.length >= 2) {
      const uniqueSources = new Set(bestGroup.map(s => s.source)).size;
      const avgLat = bestGroup.reduce((sum, s) => sum + s.latitude, 0) / bestGroup.length;
      const avgLon = bestGroup.reduce((sum, s) => sum + s.longitude, 0) / bestGroup.length;
      const maxMagnitude = Math.max(...bestGroup.map(s => s.magnitude));
      const avgConfidence = bestGroup.reduce((sum, s) => sum + s.confidence, 0) / bestGroup.length;

      return {
        type: 'convergence',
        confidence: Math.min(100, avgConfidence + uniqueSources * 10),
        indicators: [`source_count_${uniqueSources}`, 'multi_source_agreement'],
        predictedMagnitude: maxMagnitude,
        predictedLocation: { lat: avgLat, lon: avgLon },
      };
    }

    return null;
  }
}

export const patternRecognitionService = new PatternRecognitionService();









