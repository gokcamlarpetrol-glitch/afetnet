/**
 * FIREBASE TYPES - ELITE TYPE DEFINITIONS
 * Proper type definitions for Firebase operations
 */

/**
 * Message data structure
 */
export interface MessageData {
  id: string;
  fromDeviceId: string;
  toDeviceId: string;
  content: string;
  timestamp: number;
  type?: 'text' | 'sos' | 'location' | 'status';
  metadata?: Record<string, unknown>;
}

/**
 * Conversation data structure
 */
export interface ConversationData {
  id: string;
  participants: string[];
  lastMessage?: MessageData;
  lastMessageTime?: number;
  unreadCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Health profile data structure
 */
export interface HealthProfileData {
  userId: string;
  bloodType?: string;
  allergies?: string[];
  medications?: string[];
  conditions?: string[];
  emergencyContact?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * ICE (In Case of Emergency) data structure
 */
export interface ICEData {
  userId: string;
  contacts: Array<{
    name: string;
    phone: string;
    relationship?: string;
  }>;
  medicalInfo?: HealthProfileData;
  metadata?: Record<string, unknown>;
}

/**
 * Location update data structure
 */
export interface LocationUpdateData {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  timestamp: number;
  source?: 'gps' | 'network' | 'manual';
  metadata?: Record<string, unknown>;
}

/**
 * Status update data structure
 */
export interface StatusUpdateData {
  userId: string;
  status: 'safe' | 'need_help' | 'trapped' | 'evacuated' | 'unknown';
  message?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Earthquake data structure for Firebase
 */
export interface EarthquakeFirebaseData {
  id: string;
  magnitude: number;
  depth: number;
  latitude: number;
  longitude: number;
  location: string;
  timestamp: number;
  source: 'afad' | 'kandilli' | 'usgs' | 'emsc';
  metadata?: Record<string, unknown>;
}

/**
 * Felt earthquake report data structure
 */
export interface FeltEarthquakeReportData {
  userId: string;
  earthquakeId: string;
  felt: boolean;
  intensity?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
  metadata?: Record<string, unknown>;
}









