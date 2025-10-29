// @afetnet: Advanced Trilateration for Mesh-Assisted Positioning
// RSSI-based positioning using BLE/Wi-Fi mesh network for enhanced accuracy

import { logger } from '../../../core/utils/logger';

export interface AnchorNode {
  id: string;
  position: { lat: number; lon: number; alt: number };
  rssi: number; // dBm
  distance: number; // meters (estimated from RSSI)
  accuracy: number; // meters
  lastSeen: number;
  isReliable: boolean;
}

export interface TrilaterationResult {
  position: { lat: number; lon: number; alt: number };
  accuracy: number; // meters
  confidence: number; // 0-100
  anchorCount: number;
  algorithm: 'least_squares' | 'weighted' | 'robust';
  timestamp: number;
}

export interface TrilaterationConfig {
  rssiToDistanceModel: 'log' | 'linear' | 'custom';
  pathLossExponent: number; // n in RSSI = -10*n*log10(d) + C
  referenceDistance: number; // meters
  referenceRSSI: number; // dBm at reference distance
  outlierThreshold: number; // meters
  minimumAnchors: number;
  maximumIterations: number;
}

export class AdvancedTrilaterationSystem {
  private anchorNodes: Map<string, AnchorNode> = new Map();
  private config: TrilaterationConfig;
  private isActive = false;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      rssiToDistanceModel: 'log',
      pathLossExponent: 2.0, // Typical for indoor environments
      referenceDistance: 1.0, // 1 meter
      referenceRSSI: -50, // dBm at 1 meter
      outlierThreshold: 10.0, // meters
      minimumAnchors: 3,
      maximumIterations: 100,
    };
  }

  async initialize(): Promise<void> {
    logger.debug('📡 Initializing advanced trilateration system...');

    this.isActive = true;

    // Start periodic anchor updates
    this.updateInterval = setInterval(() => {
      this.updateAnchorPositions();
    }, 5000); // Every 5 seconds

    logger.debug('✅ Advanced trilateration system initialized');
  }

  // @afetnet: Add anchor node for trilateration
  addAnchorNode(node: Omit<AnchorNode, 'distance' | 'accuracy' | 'isReliable'>): void {
    const distance = this.calculateDistanceFromRSSI(node.rssi);
    const accuracy = this.estimateDistanceAccuracy(node.rssi);

    const anchorNode: AnchorNode = {
      ...node,
      distance,
      accuracy,
      isReliable: this.isAnchorReliable(node.rssi, accuracy),
      lastSeen: Date.now(),
    };

    this.anchorNodes.set(node.id, anchorNode);

    logger.debug(`📍 Added anchor node: ${node.id} at ${node.position.lat.toFixed(6)}, ${node.position.lon.toFixed(6)} (${distance.toFixed(2)}m)`);
  }

  // @afetnet: Remove anchor node
  removeAnchorNode(nodeId: string): void {
    this.anchorNodes.delete(nodeId);
    logger.debug(`📍 Removed anchor node: ${nodeId}`);
  }

  // @afetnet: Update anchor positions from mesh network
  updateAnchorPositions(): void {
    // Update anchor positions based on latest mesh data
    for (const [nodeId, anchor] of this.anchorNodes) {
      // Update last seen timestamp
      anchor.lastSeen = Date.now();

      // Mark as unreliable if not seen recently
      if (Date.now() - anchor.lastSeen > 30000) { // 30 seconds
        anchor.isReliable = false;
      }
    }

    // Remove very old anchors
    this.cleanupOldAnchors();
  }

  private cleanupOldAnchors(): void {
    const now = Date.now();
    const maxAge = 600000; // 10 minutes

    for (const [nodeId, anchor] of this.anchorNodes) {
      if (now - anchor.lastSeen > maxAge) {
        this.anchorNodes.delete(nodeId);
        logger.debug(`🧹 Cleaned up old anchor: ${nodeId}`);
      }
    }
  }

  // @afetnet: Calculate position using trilateration
  async calculatePosition(): Promise<TrilaterationResult | null> {
    try {
      const reliableAnchors = Array.from(this.anchorNodes.values())
        .filter(anchor => anchor.isReliable && anchor.distance > 0);

      if (reliableAnchors.length < this.config.minimumAnchors) {
        logger.warn(`Insufficient reliable anchors: ${reliableAnchors.length}/${this.config.minimumAnchors}`);
        return null;
      }

      logger.debug(`📐 Calculating position with ${reliableAnchors.length} anchors`);

      // Use weighted least squares for position calculation
      const result = this.calculateWeightedLeastSquares(reliableAnchors);

      return result;
    } catch (error) {
      logger.error('Failed to calculate trilateration position:', error);
      return null;
    }
  }

  private calculateWeightedLeastSquares(anchors: AnchorNode[]): TrilaterationResult {
    // Weighted least squares trilateration algorithm
    const weights = anchors.map(anchor => 1 / (anchor.accuracy ** 2));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Initial estimate (centroid)
    let estimatedLat = 0;
    let estimatedLon = 0;
    let estimatedAlt = 0;

    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      const weight = weights[i] / totalWeight;

      estimatedLat += anchor.position.lat * weight;
      estimatedLon += anchor.position.lon * weight;
      estimatedAlt += anchor.position.alt * weight;
    }

    // Iterative refinement (simplified)
    for (let iteration = 0; iteration < this.config.maximumIterations; iteration++) {
      let deltaLat = 0;
      let deltaLon = 0;
      let deltaAlt = 0;

      for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        const weight = weights[i];

        // Calculate expected distance from current estimate
        const currentDistance = this.calculateDistance(
          { lat: estimatedLat, lon: estimatedLon, alt: estimatedAlt },
          anchor.position
        );

        // Distance error
        const error = anchor.distance - currentDistance;

        // Calculate gradients
        const gradientLat = (estimatedLat - anchor.position.lat) / currentDistance;
        const gradientLon = (estimatedLon - anchor.position.lon) / currentDistance;
        const gradientAlt = (estimatedAlt - anchor.position.alt) / currentDistance;

        // Update estimate
        deltaLat += weight * error * gradientLat;
        deltaLon += weight * error * gradientLon;
        deltaAlt += weight * error * gradientAlt;
      }

      // Apply updates with damping
      const damping = 0.1;
      estimatedLat += damping * deltaLat;
      estimatedLon += damping * deltaLon;
      estimatedAlt += damping * deltaAlt;

      // Check convergence
      const maxDelta = Math.max(Math.abs(deltaLat), Math.abs(deltaLon), Math.abs(deltaAlt));
      if (maxDelta < 0.01) { // 1cm convergence threshold
        break;
      }
    }

    // Calculate final accuracy
    const accuracy = this.calculatePositionAccuracy(anchors, { lat: estimatedLat, lon: estimatedLon, alt: estimatedAlt });

    return {
      position: { lat: estimatedLat, lon: estimatedLon, alt: estimatedAlt },
      accuracy,
      confidence: this.calculateConfidence(anchors, accuracy),
      anchorCount: anchors.length,
      algorithm: 'weighted',
      timestamp: Date.now(),
    };
  }

  private calculateDistance(point1: { lat: number; lon: number; alt: number }, point2: { lat: number; lon: number; alt: number }): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lon - point1.lon) * Math.PI / 180;
    const dAlt = point2.alt - point1.alt;

    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const horizontalDistance = R * c;

    // Include altitude in 3D distance
    return Math.sqrt(horizontalDistance ** 2 + dAlt ** 2);
  }

  private calculatePositionAccuracy(anchors: AnchorNode[], estimatedPosition: { lat: number; lon: number; alt: number }): number {
    // Calculate position accuracy based on anchor geometry and individual accuracies
    let totalAccuracy = 0;
    let weightSum = 0;

    for (const anchor of anchors) {
      const distanceToAnchor = this.calculateDistance(estimatedPosition, anchor.position);
      const weight = 1 / (distanceToAnchor ** 2 + 1); // Closer anchors have more weight

      totalAccuracy += anchor.accuracy * weight;
      weightSum += weight;
    }

    const averageAccuracy = totalAccuracy / weightSum;

    // Add geometric dilution of precision (GDOP) factor
    const gdopFactor = this.calculateGDOP(anchors, estimatedPosition);

    return averageAccuracy * gdopFactor;
  }

  private calculateGDOP(anchors: AnchorNode[], position: { lat: number; lon: number; alt: number }): number {
    // Simplified GDOP calculation
    // In real implementation, would use proper matrix inversion

    if (anchors.length < 3) return 2.0; // Poor geometry
    if (anchors.length >= 4) return 1.0; // Good geometry

    return 1.5; // Moderate geometry
  }

  private calculateConfidence(anchors: AnchorNode[], accuracy: number): number {
    // Calculate confidence based on number of anchors and accuracy
    const baseConfidence = Math.min(100, (anchors.length / this.config.minimumAnchors) * 50);
    const accuracyConfidence = Math.max(0, 100 - (accuracy * 2)); // Lower accuracy = lower confidence

    return (baseConfidence + accuracyConfidence) / 2;
  }

  private calculateDistanceFromRSSI(rssi: number): number {
    // Convert RSSI to distance using path loss model
    const pathLoss = this.config.referenceRSSI - rssi;
    const distance = this.config.referenceDistance * Math.pow(10, pathLoss / (10 * this.config.pathLossExponent));

    return Math.max(0.1, distance); // Minimum 10cm
  }

  private estimateDistanceAccuracy(rssi: number): number {
    // Estimate distance accuracy based on RSSI variance
    const rssiVariance = this.estimateRSSIVariance(rssi);
    const accuracy = Math.sqrt(rssiVariance) * 0.1; // Simplified

    return Math.max(1, Math.min(50, accuracy)); // 1-50 meters
  }

  private estimateRSSIVariance(rssi: number): number {
    // Estimate RSSI variance based on signal strength
    // Stronger signals have lower variance
    const signalStrength = Math.abs(rssi);

    if (signalStrength > 60) return 1; // Low variance for strong signals
    if (signalStrength > 80) return 4; // Medium variance
    return 9; // High variance for weak signals
  }

  private isAnchorReliable(rssi: number, accuracy: number): boolean {
    // Anchor is reliable if RSSI is strong enough and accuracy is reasonable
    return rssi > -80 && accuracy < 20;
  }

  // Public API
  public getAnchorNodes(): AnchorNode[] {
    return Array.from(this.anchorNodes.values());
  }

  public getReliableAnchors(): AnchorNode[] {
    return Array.from(this.anchorNodes.values()).filter(anchor => anchor.isReliable);
  }

  public getAnchorCount(): number {
    return this.anchorNodes.size;
  }

  public getReliableAnchorCount(): number {
    return this.getReliableAnchors().length;
  }

  public updateConfig(newConfig: Partial<TrilaterationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.debug('Trilateration config updated');
  }

  public getConfig(): TrilaterationConfig {
    return { ...this.config };
  }

  public getPositioningAccuracy(): {
    accuracy: number;
    confidence: number;
    anchorCount: number;
    reliability: 'excellent' | 'good' | 'fair' | 'poor';
  } {
    const anchors = this.getReliableAnchors();
    const anchorCount = anchors.length;

    if (anchorCount < this.config.minimumAnchors) {
      return {
        accuracy: 100, // Poor accuracy without enough anchors
        confidence: 0,
        anchorCount,
        reliability: 'poor',
      };
    }

    // Calculate average accuracy
    const avgAccuracy = anchors.reduce((sum, anchor) => sum + anchor.accuracy, 0) / anchorCount;

    // Calculate confidence
    const confidence = Math.min(100, (anchorCount / 6) * 100); // Max 6 anchors for 100% confidence

    let reliability: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (avgAccuracy < 5 && confidence > 80) reliability = 'excellent';
    else if (avgAccuracy < 10 && confidence > 60) reliability = 'good';
    else if (avgAccuracy < 20 && confidence > 40) reliability = 'fair';

    return {
      accuracy: avgAccuracy,
      confidence,
      anchorCount,
      reliability,
    };
  }

  public clearAnchors(): void {
    this.anchorNodes.clear();
    logger.debug('📍 All anchor nodes cleared');
  }

  public isActive(): boolean {
    return this.isActive;
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping advanced trilateration system...');

    this.isActive = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    logger.debug('✅ Advanced trilateration system stopped');
  }
}

// @afetnet: Export singleton instance
export const advancedTrilaterationSystem = new AdvancedTrilaterationSystem();






