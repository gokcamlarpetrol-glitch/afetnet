/**
 * FIREBASE TYPES — UID-CENTRIC ARCHITECTURE v3.0
 * 
 * THE GOLDEN RULE: Firebase Auth UID is the primary key.
 * All types reference uid, NOT device IDs, for identity.
 */

// ─── MESSAGING ──────────────────────────────────────

/**
 * Message stored in conversations/{conversationId}/messages/{messageId}
 */
export interface MessageData {
  id: string;
  /** Firebase UID of the sender — THE source of truth */
  senderUid: string;
  /** Display name of sender (denormalized for UI speed) */
  senderName?: string;
  /** Message text content */
  content: string;
  /** Epoch ms timestamp */
  timestamp: number;
  /** Message type */
  type?: 'text' | 'sos' | 'location' | 'status' | 'image' | 'voice' | 'emergency';
  /** Delivery status */
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  /** Priority level */
  priority?: 'critical' | 'high' | 'normal' | 'low';
  /** Client-generated UUID for deduplication */
  clientMessageId?: string;
  /** Structured location data */
  location?: { lat: number; lng: number; address?: string };
  /** Media metadata */
  mediaType?: 'image' | 'voice' | 'video' | 'location';
  mediaUrl?: string;
  mediaDuration?: number;
  mediaThumbnail?: string;
  /** Reply reference */
  replyTo?: string;
  replyPreview?: string;
  /** Schema version for migration safety */
  schemaVersion?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;

  // ─── BACKWARD COMPAT (deprecated) ─────────────────
  /** @deprecated Use senderUid */
  fromDeviceId?: string;
  /** @deprecated Use conversation participants */
  toDeviceId?: string;
}

/**
 * Conversation thread stored in conversations/{conversationId}
 */
export interface ConversationData {
  /** Auto-generated conversation ID (UUID) */
  id: string;
  /** Conversation type: dm = 1:1, group = multi */
  type: 'dm' | 'group';
  /** Firebase UIDs of participants */
  participants: string[];
  /** For DM: hash(minUid|maxUid) — indexed for fast lookup */
  pairKey?: string;
  /** Group name (only for type=group) */
  name?: string;
  /** Last message preview (denormalized) */
  lastMessage?: string;
  /** Last message sender name */
  lastMessageSenderName?: string;
  /** Last message timestamp */
  lastMessageAt?: number;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt?: number;
  /** Schema version */
  schemaVersion?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * User inbox thread metadata stored in user_inbox/{uid}/threads/{conversationId}
 */
export interface UserInboxThread {
  /** Reference to conversation ID */
  conversationId: string;
  /** Last read timestamp by this user */
  lastReadAt?: number;
  /** Unread message count */
  unreadCount: number;
  /** Last message preview */
  lastMessagePreview?: string;
  /** Last message sender name */
  lastMessageSenderName?: string;
  /** Last message timestamp */
  lastMessageAt?: number;
  /** Muted until timestamp (0 = not muted) */
  mutedUntil?: number;
  /** Pinned flag */
  pinned?: boolean;
}

// ─── LOCATION ──────────────────────────────────────

/**
 * Current location stored in locations_current/{uid}
 */
export interface LocationUpdateData {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  /** Battery percent (0-100) */
  battery?: number;
  timestamp: number;
  source?: 'gps' | 'network' | 'manual';
  /** Which families this location is shared with */
  sharingTo?: string[];
  metadata?: Record<string, unknown>;
}

// ─── HEALTH & ICE ──────────────────────────────────

/**
 * Health profile stored in users/{uid}/health/current
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
 * ICE data stored in users/{uid}/ice/current
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

// ─── STATUS ──────────────────────────────────────

/**
 * Status update stored in users/{uid}/status/current
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

// ─── EARTHQUAKE ──────────────────────────────────

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
