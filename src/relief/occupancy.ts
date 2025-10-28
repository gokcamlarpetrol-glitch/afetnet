// src/relief/occupancy.ts
import { ReliefPoint } from './types';
import { ReliefStore } from './store';
import { logger } from '../utils/productionLogger';

export interface OccupancyData {
  pointId: string;
  currentOccupancy: number;
  maxCapacity: number;
  occupancyRate: number;
  lastUpdated: string;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export class OccupancyManager {
  private static occupancyHistory: Map<string, OccupancyData[]> = new Map();

  // Update occupancy for a relief point
  static async updateOccupancy(pointId: string, newOccupancy: number): Promise<void> {
    try {
      const point = await this.getPointById(pointId);
      if (!point) {
        throw new Error(`Relief point with ID ${pointId} not found`);
      }

      // Update the point
      await ReliefStore.updatePoint(pointId, {
        occupied: newOccupancy,
        status: this.calculateStatus(newOccupancy, point.capacity || 0),
      });

      // Update occupancy history
      await this.addToHistory(pointId, {
        pointId,
        currentOccupancy: newOccupancy,
        maxCapacity: point.capacity || 0,
        occupancyRate: this.calculateOccupancyRate(newOccupancy, point.capacity || 0),
        lastUpdated: new Date().toISOString(),
        trend: this.calculateTrend(pointId, newOccupancy),
      });
    } catch (error) {
      logger.error('Error updating occupancy:', error);
      throw error;
    }
  }

  // Get current occupancy data
  static async getOccupancyData(pointId: string): Promise<OccupancyData | null> {
    const history = this.occupancyHistory.get(pointId);
    if (!history || history.length === 0) {
      return null;
    }
    return history[history.length - 1];
  }

  // Get occupancy history
  static getOccupancyHistory(pointId: string, hours: number = 24): OccupancyData[] {
    const history = this.occupancyHistory.get(pointId) || [];
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return history.filter(data => new Date(data.lastUpdated) >= cutoffTime);
  }

  // Get all occupancy data
  static async getAllOccupancyData(): Promise<OccupancyData[]> {
    const points = await ReliefStore.getPoints();
    const occupancyData: OccupancyData[] = [];

    for (const point of points) {
      const data = await this.getOccupancyData(point.id);
      if (data) {
        occupancyData.push(data);
      }
    }

    return occupancyData;
  }

  // Get overcrowded points
  static async getOvercrowdedPoints(threshold: number = 0.9): Promise<OccupancyData[]> {
    const allData = await this.getAllOccupancyData();
    return allData.filter(data => data.occupancyRate >= threshold);
  }

  // Get underutilized points
  static async getUnderutilizedPoints(threshold: number = 0.3): Promise<OccupancyData[]> {
    const allData = await this.getAllOccupancyData();
    return allData.filter(data => data.occupancyRate <= threshold);
  }

  // Calculate occupancy rate
  private static calculateOccupancyRate(current: number, max: number): number {
    if (max === 0) return 0;
    return Math.min(current / max, 1);
  }

  // Calculate status based on occupancy
  private static calculateStatus(current: number, max: number): ReliefPoint['status'] {
    if (max === 0) return 'inactive';
    
    const rate = this.calculateOccupancyRate(current, max);
    if (rate >= 1) return 'full';
    if (rate >= 0.8) return 'active';
    return 'active';
  }

  // Calculate trend
  private static calculateTrend(pointId: string, newOccupancy: number): OccupancyData['trend'] {
    const history = this.occupancyHistory.get(pointId) || [];
    if (history.length < 2) return 'stable';

    const previous = history[history.length - 1];
    const diff = newOccupancy - previous.currentOccupancy;

    if (diff > 0) return 'increasing';
    if (diff < 0) return 'decreasing';
    return 'stable';
  }

  // Add to occupancy history
  private static async addToHistory(pointId: string, data: OccupancyData): Promise<void> {
    const history = this.occupancyHistory.get(pointId) || [];
    history.push(data);

    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }

    this.occupancyHistory.set(pointId, history);
  }

  // Get point by ID
  private static async getPointById(pointId: string): Promise<ReliefPoint | null> {
    const points = await ReliefStore.getPoints();
    return points.find(p => p.id === pointId) || null;
  }

  // Get occupancy statistics
  static async getOccupancyStats(): Promise<{
    totalPoints: number;
    averageOccupancyRate: number;
    overcrowdedPoints: number;
    underutilizedPoints: number;
    fullPoints: number;
  }> {
    const allData = await this.getAllOccupancyData();
    
    if (allData.length === 0) {
      return {
        totalPoints: 0,
        averageOccupancyRate: 0,
        overcrowdedPoints: 0,
        underutilizedPoints: 0,
        fullPoints: 0,
      };
    }

    const averageOccupancyRate = allData.reduce((sum, data) => sum + data.occupancyRate, 0) / allData.length;
    const overcrowdedPoints = allData.filter(data => data.occupancyRate >= 0.9).length;
    const underutilizedPoints = allData.filter(data => data.occupancyRate <= 0.3).length;
    const fullPoints = allData.filter(data => data.occupancyRate >= 1).length;

    return {
      totalPoints: allData.length,
      averageOccupancyRate,
      overcrowdedPoints,
      underutilizedPoints,
      fullPoints,
    };
  }

  // Clear occupancy history
  static clearHistory(pointId?: string): void {
    if (pointId) {
      this.occupancyHistory.delete(pointId);
    } else {
      this.occupancyHistory.clear();
    }
  }

  // Export occupancy data
  static exportOccupancyData(pointId?: string): string {
    if (pointId) {
      const history = this.occupancyHistory.get(pointId) || [];
      return JSON.stringify(history, null, 2);
    } else {
      const allData = Array.from(this.occupancyHistory.entries()).map(([id, history]) => ({
        pointId: id,
        history,
      }));
      return JSON.stringify(allData, null, 2);
    }
  }

  // Handle incoming occupancy data - Full implementation
  static handleIncoming(data: any): void {
    logger.debug('📊 Processing incoming occupancy data:', data);

    try {
      // Parse and validate incoming data
      if (data && typeof data === 'object') {
        const { pointId, occupancy, timestamp } = data;

        if (pointId && typeof occupancy === 'number') {
          // Update occupancy in real-time
          this.updateOccupancy(pointId, occupancy).catch(error => {
            logger.error('Failed to update occupancy from incoming data:', error);
          });

          logger.debug(`✅ Occupancy updated for point ${pointId}: ${occupancy}`);
        } else {
          logger.warn('Invalid occupancy data format:', data);
        }
      }
    } catch (error) {
      logger.error('Error processing incoming occupancy data:', error);
    }
  }


  // Get occupancy data for a specific point
  static async getOcc(pointId: string): Promise<number> {
    const data = await this.getOccupancyData(pointId);
    return data?.currentOccupancy || 0;
  }

  // Set occupancy for a specific point
  static async setOccupancy(pointId: string, occupancy: number): Promise<void> {
    await this.updateOccupancy(pointId, occupancy);
  }
}

// Export functions for compatibility
export const getOcc = (pointId: string) => OccupancyManager.getOcc(pointId);
export const setOccupancy = (pointId: string, occupancy: number) => OccupancyManager.setOccupancy(pointId, occupancy);