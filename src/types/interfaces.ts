/**
 * TypeScript Interfaces - Elite Type Safety
 * Replace 'any' with these proper types
 */

/**
 * Navigation prop type
 */
export interface NavigationProp {
  navigate: (screen: string, params?: Record<string, any>) => void;
  goBack: () => void;
  push: (screen: string, params?: Record<string, any>) => void;
  replace: (screen: string, params?: Record<string, any>) => void;
  reset: (config: any) => void;
}

/**
 * SOS Alert data structure
 */
export interface SOSAlertData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  message?: string;
  tags?: string[];
  people: number;
  priority: 'low' | 'med' | 'high';
  timestamp: number;
}

/**
 * Mesh message structure
 */
export interface MeshMessage {
  meshId: string;
  type: 'SOS' | 'PING' | 'ACK' | 'MSG' | 'LOCATION';
  payload: MeshPayload;
  ttl: number;
  hopCount: number;
  fromAfnId: string;
  toAfnId?: string;
  relayedBy: string[];
  expiresAt: Date;
}

/**
 * Mesh payload types
 */
export type MeshPayload = 
  | { type: 'text'; text: string }
  | { type: 'location'; lat: number; lon: number; accuracy?: number }
  | { type: 'sos'; alert: SOSAlertData }
  | { type: 'ping'; timestamp: number }
  | { type: 'ack'; messageId: string };

/**
 * Queue item structure
 */
export interface QueueItem {
  id: string;
  type: 'sos' | 'msg' | 'mesh';
  payload: SOSAlertData | MeshMessage | MessagePayload;
  ts: number;
  attempts?: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
}

/**
 * Message payload
 */
export interface MessagePayload {
  receiverAfnId: string;
  content: string;
  type?: 'text' | 'sos' | 'location' | 'image';
  latitude?: number;
  longitude?: number;
}

/**
 * Family member structure
 */
export interface FamilyMember {
  afnId: string;
  name: string;
  relation?: string;
  phone?: string;
  lastSeen?: number;
  latitude?: number;
  longitude?: number;
  batteryLevel?: number;
  isOnline: boolean;
}

/**
 * Device info for BLE
 */
export interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  lastSeen: number;
  services?: string[];
  isConnected: boolean;
}

/**
 * Location coordinates
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

/**
 * API Response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

/**
 * User profile
 */
export interface UserProfile {
  id: string;
  afnId: string;
  name: string;
  email?: string;
  phone?: string;
  isPremium: boolean;
  isActive: boolean;
  createdAt: Date;
  lastSeenAt?: Date;
}

/**
 * Earthquake data
 */
export interface EarthquakeData {
  id: string;
  magnitude: number;
  depth: number;
  latitude: number;
  longitude: number;
  location: string;
  timestamp: Date;
  source: 'AFAD' | 'USGS' | 'KANDILLI';
}

/**
 * Export all interfaces
 * Note: Commented out to avoid export conflicts - import directly from specific files
 */
// export type {
//   NavigationProp,
//   SOSAlertData,
//   MeshMessage,
//   MeshPayload,
//   QueueItem,
//   MessagePayload,
//   FamilyMember,
//   BLEDevice,
//   Coordinates,
//   APIResponse,
//   UserProfile,
//   EarthquakeData,
// };

