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
  };
  deviceId?: string; // BLE mesh device ID
  // ELITE: Extended fields for better member management
  relationship?: string; // Relationship type (anne, baba, kardes, etc.)
  phoneNumber?: string; // Phone number (optional)
  notes?: string; // Additional notes (optional)
  createdAt?: number; // Member creation timestamp
  updatedAt?: number; // Last update timestamp
}

