// src/relief/store.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReliefPoint, ReliefRequest, ReliefResource, ReliefVolunteer, ReliefTeam, ReliefStats } from './types';
import { logger } from '../utils/productionLogger';

const STORAGE_KEYS = {
  POINTS: 'relief_points',
  REQUESTS: 'relief_requests',
  RESOURCES: 'relief_resources',
  VOLUNTEERS: 'relief_volunteers',
  TEAMS: 'relief_teams',
};

export class ReliefStore {
  // Relief Points
  static async getPoints(): Promise<ReliefPoint[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.POINTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error('Error getting relief points:', error);
      return [];
    }
  }

  static async savePoints(points: ReliefPoint[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.POINTS, JSON.stringify(points));
    } catch (error) {
      logger.error('Error saving relief points:', error);
    }
  }

  static async addPoint(point: ReliefPoint): Promise<void> {
    const points = await this.getPoints();
    points.push(point);
    await this.savePoints(points);
  }

  static async updatePoint(id: string, updates: Partial<ReliefPoint>): Promise<void> {
    const points = await this.getPoints();
    const index = points.findIndex(p => p.id === id);
    if (index !== -1) {
      points[index] = { ...points[index], ...updates, updatedAt: new Date().toISOString() };
      await this.savePoints(points);
    }
  }

  static async deletePoint(id: string): Promise<void> {
    const points = await this.getPoints();
    const filtered = points.filter(p => p.id !== id);
    await this.savePoints(filtered);
  }

  // Relief Requests
  static async getRequests(): Promise<ReliefRequest[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.REQUESTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error('Error getting relief requests:', error);
      return [];
    }
  }

  static async saveRequests(requests: ReliefRequest[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
    } catch (error) {
      logger.error('Error saving relief requests:', error);
    }
  }

  static async addRequest(request: ReliefRequest): Promise<void> {
    const requests = await this.getRequests();
    requests.push(request);
    await this.saveRequests(requests);
  }

  static async updateRequest(id: string, updates: Partial<ReliefRequest>): Promise<void> {
    const requests = await this.getRequests();
    const index = requests.findIndex(r => r.id === id);
    if (index !== -1) {
      requests[index] = { ...requests[index], ...updates, updatedAt: new Date().toISOString() };
      await this.saveRequests(requests);
    }
  }

  // Relief Resources
  static async getResources(): Promise<ReliefResource[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RESOURCES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error('Error getting relief resources:', error);
      return [];
    }
  }

  static async saveResources(resources: ReliefResource[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(resources));
    } catch (error) {
      logger.error('Error saving relief resources:', error);
    }
  }

  static async addResource(resource: ReliefResource): Promise<void> {
    const resources = await this.getResources();
    resources.push(resource);
    await this.saveResources(resources);
  }

  // Relief Volunteers
  static async getVolunteers(): Promise<ReliefVolunteer[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.VOLUNTEERS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error('Error getting relief volunteers:', error);
      return [];
    }
  }

  static async saveVolunteers(volunteers: ReliefVolunteer[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VOLUNTEERS, JSON.stringify(volunteers));
    } catch (error) {
      logger.error('Error saving relief volunteers:', error);
    }
  }

  static async addVolunteer(volunteer: ReliefVolunteer): Promise<void> {
    const volunteers = await this.getVolunteers();
    volunteers.push(volunteer);
    await this.saveVolunteers(volunteers);
  }

  // Relief Teams
  static async getTeams(): Promise<ReliefTeam[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TEAMS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error('Error getting relief teams:', error);
      return [];
    }
  }

  static async saveTeams(teams: ReliefTeam[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
    } catch (error) {
      logger.error('Error saving relief teams:', error);
    }
  }

  static async addTeam(team: ReliefTeam): Promise<void> {
    const teams = await this.getTeams();
    teams.push(team);
    await this.saveTeams(teams);
  }

  // Statistics
  static async getStats(): Promise<ReliefStats> {
    const [points, requests, resources, volunteers] = await Promise.all([
      this.getPoints(),
      this.getRequests(),
      this.getResources(),
      this.getVolunteers(),
    ]);

    return {
      totalPoints: points.length,
      activePoints: points.filter(p => p.status === 'active').length,
      totalRequests: requests.length,
      pendingRequests: requests.filter(r => r.status === 'pending').length,
      completedRequests: requests.filter(r => r.status === 'completed').length,
      totalVolunteers: volunteers.length,
      activeVolunteers: volunteers.filter(v => v.status === 'available').length,
      totalResources: resources.length,
      availableResources: resources.filter(r => r.available).length,
    };
  }

  // Clear all data
  static async clearAll(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.POINTS),
        AsyncStorage.removeItem(STORAGE_KEYS.REQUESTS),
        AsyncStorage.removeItem(STORAGE_KEYS.RESOURCES),
        AsyncStorage.removeItem(STORAGE_KEYS.VOLUNTEERS),
        AsyncStorage.removeItem(STORAGE_KEYS.TEAMS),
      ]);
    } catch (error) {
      logger.error('Error clearing relief data:', error);
    }
  }

  // Additional functions for compatibility
  static async loadFacilities(): Promise<any[]> {
    return this.getPoints();
  }

  static async saveFacilities(facilities: any[]): Promise<void> {
    await this.savePoints(facilities);
  }

  static async searchFacilities(query: string, facilities?: any[], kinds?: string[]): Promise<any[]> {
    const points = facilities || await this.getPoints();
    let filtered = points.filter(point =>
      point.name.toLowerCase().includes(query.toLowerCase()) ||
      point.type.toLowerCase().includes(query.toLowerCase())
    );

    if (kinds && kinds.length > 0) {
      filtered = filtered.filter(point => kinds.includes(point.kind));
    }

    return filtered;
  }
}

// Export functions for compatibility
export const loadFacilities = async () => await ReliefStore.loadFacilities();
export const saveFacilities = async (facilities: any[]) => await ReliefStore.saveFacilities(facilities);
export const searchFacilities = async (query: string, facilities?: any[], kinds?: string[]) => await ReliefStore.searchFacilities(query, facilities, kinds);


