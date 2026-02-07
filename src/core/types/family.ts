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
    timestamp?: number;
    accuracy?: number; // ELITE: GPS accuracy in meters
  };
  // ELITE: Find My-grade Last Known Location (persisted when battery dies)
  lastKnownLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
    batteryLevelAtCapture: number; // Battery level when location was saved
    source: 'gps' | 'mesh' | 'cloud' | 'manual'; // How was this captured
  };
  batteryLevel?: number; // ELITE: Real-time battery percentage (0-100)
  isOnline?: boolean; // ELITE: Currently online/reachable
  deviceId?: string; // BLE mesh device ID
  avatarUrl?: string; // ELITE: Profile avatar URL
  // ELITE: Extended fields for better member management
  relationship?: string; // Relationship type (anne, baba, kardes, etc.)
  phoneNumber?: string; // Phone number (optional)
  notes?: string; // Additional notes (optional)
  createdAt?: number; // Member creation timestamp
  updatedAt?: number; // Last update timestamp
  // FAZ 4: Location history for trail tracking (max 100 entries)
  locationHistory?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  }[];
}

