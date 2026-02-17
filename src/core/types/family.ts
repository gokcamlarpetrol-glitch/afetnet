/**
 * FAMILY TYPES — SINGLE-UID ARCHITECTURE v4.0
 * 
 * Every member is identified by Firebase Auth UID.
 * uid is the ONLY primary key. No legacy id field.
 */

export interface FamilyMember {
  /** Firebase Auth UID — TEK BİRİNCİL ANAHTAR */
  uid: string;
  /** Family group ID this member belongs to */
  familyId?: string;
  name: string;
  status: 'safe' | 'need-help' | 'unknown' | 'critical' | 'danger' | 'offline';
  lastSeen: number;
  latitude: number;
  longitude: number;
  location?: {
    latitude: number;
    longitude: number;
    timestamp?: number;
    accuracy?: number;
  };
  lastKnownLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
    batteryLevelAtCapture: number;
    source: 'gps' | 'mesh' | 'cloud' | 'manual';
  };
  batteryLevel?: number;
  isOnline?: boolean;
  deviceId?: string; // BLE mesh device ID — sadece offline mesh routing için
  avatarUrl?: string;
  relationship?: string;
  phoneNumber?: string;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
  locationHistory?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  }[];
}
