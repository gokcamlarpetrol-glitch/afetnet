/**
 * FAMILY TYPES - Shared Type Definitions
 * Separated to break circular dependencies
 */

export interface FamilyMember {
  id: string;
  name: string;
  status: 'safe' | 'need-help' | 'unknown' | 'critical';
  lastSeen: number;
  latitude: number;
  longitude: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  deviceId?: string; // BLE mesh device ID
}

