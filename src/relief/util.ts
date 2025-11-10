// src/relief/util.ts
import { ReliefPoint, ReliefRequest, ReliefResource, ReliefVolunteer, ReliefTeam } from './types';

export class ReliefUtils {
  // Get current timestamp
  static now(): number {
    return Date.now();
  }

  // Calculate distance between two points
  static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Find nearest relief points
  static findNearestPoints(
    points: ReliefPoint[], 
    lat: number, 
    lng: number, 
    radius: number = 10
  ): ReliefPoint[] {
    return points
      .filter(point => {
        const distance = this.calculateDistance(lat, lng, point.lat, point.lng);
        return distance <= radius;
      })
      .sort((a, b) => {
        const distA = this.calculateDistance(lat, lng, a.lat, a.lng);
        const distB = this.calculateDistance(lat, lng, b.lat, b.lng);
        return distA - distB;
      });
  }

  // Filter points by type
  static filterPointsByType(points: ReliefPoint[], type: ReliefPoint['type']): ReliefPoint[] {
    return points.filter(point => point.type === type);
  }

  // Get available capacity
  static getAvailableCapacity(point: ReliefPoint): number {
    if (!point.capacity) return 0;
    return point.capacity - (point.occupied || 0);
  }

  // Check if point has capacity
  static hasCapacity(point: ReliefPoint): boolean {
    return this.getAvailableCapacity(point) > 0;
  }

  // Generate unique ID
  static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Make ID function (alias for generateId)
  static makeId(prefix: string = ''): string {
    return prefix + this.generateId();
  }

  // Get current timestamp (alias for now)
  static timestamp(): number {
    return Date.now();
  }

// Additional utility functions
static formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Add country code if missing
  if (cleaned.length === 10) {
    return '+90' + cleaned;
  }

  return '+' + cleaned;
}

  // Validate coordinates
  static isValidCoordinate(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  // Calculate priority score for requests
  static calculatePriorityScore(request: ReliefRequest): number {
    const priorityWeights = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    
    const typeWeights = {
      medical: 4,
      food: 2,
      water: 3,
      shelter: 3,
      transport: 2,
    };
    
    return priorityWeights[request.priority] * typeWeights[request.type];
  }

  // Sort requests by priority
  static sortRequestsByPriority(requests: ReliefRequest[]): ReliefRequest[] {
    return requests.sort((a, b) => {
      const scoreA = this.calculatePriorityScore(a);
      const scoreB = this.calculatePriorityScore(b);
      return scoreB - scoreA; // Higher score first
    });
  }

  // Check if resource is expired
  static isResourceExpired(resource: ReliefResource): boolean {
    if (!resource.expiryDate) return false;
    return new Date(resource.expiryDate) < new Date();
  }

  // Get volunteers by skill
  static getVolunteersBySkill(volunteers: ReliefVolunteer[], skill: string): ReliefVolunteer[] {
    return volunteers.filter(volunteer => 
      volunteer.skills.includes(skill) && volunteer.status === 'available'
    );
  }

  // Calculate team efficiency
  static calculateTeamEfficiency(team: ReliefTeam, completedRequests: ReliefRequest[]): number {
    const teamRequests = completedRequests.filter(req => 
      team.members.includes(req.requesterId)
    );
    
    if (teamRequests.length === 0) return 0;
    
    const avgCompletionTime = teamRequests.reduce((sum, req) => {
      const completionTime = new Date(req.updatedAt).getTime() - new Date(req.createdAt).getTime();
      return sum + completionTime;
    }, 0) / teamRequests.length;
    
    // Return efficiency score (lower completion time = higher efficiency)
    return Math.max(0, 100 - (avgCompletionTime / (1000 * 60 * 60))); // Hours
  }

  // Format date for display
  static formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Get status color
  static getStatusColor(status: string): string {
    const colors = {
      active: '#4CAF50',
      inactive: '#9E9E9E',
      full: '#F44336',
      pending: '#FF9800',
      in_progress: '#2196F3',
      completed: '#4CAF50',
      cancelled: '#F44336',
      available: '#4CAF50',
      busy: '#FF9800',
      offline: '#9E9E9E',
    };
    
    return colors[status as keyof typeof colors] || '#9E9E9E';
  }

  // Validate relief point data
  static validateReliefPoint(point: Partial<ReliefPoint>): string[] {
    const errors: string[] = [];

    if (!point.name || point.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!point.lat || !point.lng || !this.isValidCoordinate(point.lat, point.lng)) {
      errors.push('Valid coordinates are required');
    }

    if (!point.type) {
      errors.push('Type is required');
    }

    if (point.capacity && point.capacity < 0) {
      errors.push('Capacity cannot be negative');
    }

    if (point.occupied && point.occupied < 0) {
      errors.push('Occupied count cannot be negative');
    }

    if (point.capacity && point.occupied && point.occupied > point.capacity) {
      errors.push('Occupied count cannot exceed capacity');
    }

    return errors;
  }
}

// Export utility functions
export const makeId = (prefix: string = '') => ReliefUtils.makeId(prefix);
export const now = () => ReliefUtils.now();
export const timestamp = () => ReliefUtils.timestamp();
