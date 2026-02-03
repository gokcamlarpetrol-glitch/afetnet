/**
 * RISK HEATMAP SERVICE - ELITE EDITION
 * Generates risk density data for map visualization.
 *
 * Features:
 * - Risk Level Calculation
 * - Geographic Clustering
 * - Historical Earthquake Data Integration
 * - Real-time SOS Hotspot Detection
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('RiskHeatmapService');

export interface HeatmapPoint {
    latitude: number;
    longitude: number;
    intensity: number; // 0-1
}

export interface RiskZone {
    id: string;
    center: { latitude: number; longitude: number };
    radius: number; // km
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    source: 'earthquake' | 'sos' | 'historical' | 'custom';
}

class RiskHeatmapService {
  private heatmapPoints: HeatmapPoint[] = [];
  private riskZones: RiskZone[] = [];

  /**
     * Add earthquake to heatmap
     */
  addEarthquake(
    latitude: number,
    longitude: number,
    magnitude: number,
    timestamp: number,
  ) {
    // Intensity based on magnitude (M1-M10 mapped to 0.1-1.0)
    const intensity = Math.min(1, Math.max(0.1, magnitude / 10));

    // Decay factor based on time (recent = higher intensity)
    const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
    const decayFactor = Math.max(0.3, 1 - ageHours / 72); // 72 hours to decay to 30%

    this.heatmapPoints.push({
      latitude,
      longitude,
      intensity: intensity * decayFactor,
    });

    // Create risk zone for significant earthquakes
    if (magnitude >= 4.0) {
      this.riskZones.push({
        id: `eq-${Date.now()}`,
        center: { latitude, longitude },
        radius: magnitude * 10, // km
        riskLevel: this.getRiskLevel(magnitude),
        source: 'earthquake',
      });
    }

    this.cleanupOldPoints();
  }

  /**
     * Add SOS location to heatmap
     */
  addSOSLocation(latitude: number, longitude: number) {
    this.heatmapPoints.push({
      latitude,
      longitude,
      intensity: 0.8, // High intensity for SOS
    });

    this.riskZones.push({
      id: `sos-${Date.now()}`,
      center: { latitude, longitude },
      radius: 5, // 5km around SOS
      riskLevel: 'high',
      source: 'sos',
    });
  }

  /**
     * Get heatmap data for map rendering
     */
  getHeatmapData(): HeatmapPoint[] {
    return [...this.heatmapPoints];
  }

  /**
     * Get risk zones for map overlays
     */
  getRiskZones(): RiskZone[] {
    return [...this.riskZones];
  }

  /**
     * Check if a location is in a high-risk zone
     */
  isHighRisk(latitude: number, longitude: number): boolean {
    for (const zone of this.riskZones) {
      if (zone.riskLevel === 'high' || zone.riskLevel === 'critical') {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          zone.center.latitude,
          zone.center.longitude,
        );
        if (distance <= zone.radius) {
          return true;
        }
      }
    }
    return false;
  }

  /**
     * Get risk level for a location
     */
  getRiskLevelForLocation(latitude: number, longitude: number): RiskZone['riskLevel'] {
    let highestRisk: RiskZone['riskLevel'] = 'low';

    for (const zone of this.riskZones) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        zone.center.latitude,
        zone.center.longitude,
      );
      if (distance <= zone.radius) {
        if (this.riskPriority(zone.riskLevel) > this.riskPriority(highestRisk)) {
          highestRisk = zone.riskLevel;
        }
      }
    }

    return highestRisk;
  }

  /**
     * Clear all heatmap data
     */
  clear() {
    this.heatmapPoints = [];
    this.riskZones = [];
  }

  // Private Methods

  private getRiskLevel(magnitude: number): RiskZone['riskLevel'] {
    if (magnitude >= 7) return 'critical';
    if (magnitude >= 5.5) return 'high';
    if (magnitude >= 4) return 'medium';
    return 'low';
  }

  private riskPriority(level: RiskZone['riskLevel']): number {
    switch (level) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    // Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private cleanupOldPoints() {
    // Keep only last 1000 points
    if (this.heatmapPoints.length > 1000) {
      this.heatmapPoints = this.heatmapPoints.slice(-1000);
    }

    // Keep only recent risk zones (last 24 hours)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.riskZones = this.riskZones.filter((zone) => {
      const timestamp = parseInt(zone.id.split('-')[1] || '0', 10);
      return timestamp > dayAgo;
    });
  }
}

export const riskHeatmapService = new RiskHeatmapService();
