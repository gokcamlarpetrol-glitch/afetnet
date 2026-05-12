/**
 * MESSAGING CONSTANTS - ELITE EDITION
 * Centralized configuration for the messaging system
 * 
 * All magic numbers extracted for easy tuning and maintenance.
 */

// =============================================================================
// MESSAGE QUEUE CONFIGURATION
// =============================================================================

/** Maximum number of messages in the outgoing queue */
export const MAX_QUEUE_SIZE = 5000;

/** Maximum number of messages to keep in memory */
export const MAX_MESSAGES_IN_MEMORY = 500;

/** Maximum number of seen message IDs to cache (for deduplication) */
export const MAX_SEEN_MESSAGE_IDS = 5000;

/** Queue persistence debounce interval in ms */
export const QUEUE_SAVE_DEBOUNCE_MS = 2000;

// =============================================================================
// RETRY CONFIGURATION
// =============================================================================

/** Initial retry delay in ms */
export const RETRY_INITIAL_DELAY_MS = 1000;

/** Maximum retry delay in ms */
export const RETRY_MAX_DELAY_MS = 120000;

/** Retry backoff multiplier */
export const RETRY_MULTIPLIER = 2;

/** Maximum number of retry attempts */
export const RETRY_MAX_ATTEMPTS = 20;

/** Jitter range for retry (0.5 to 1.5x) */
export const RETRY_JITTER_MIN = 0.5;
export const RETRY_JITTER_MAX = 1.5;

// =============================================================================
// ACK & DELIVERY CONFIGURATION
// =============================================================================

/** Time to wait for ACK before retry (ms) */
export const ACK_TIMEOUT_MS = 30000;

/** Maximum time a message can be pending before marked as failed (ms) */
export const MESSAGE_MAX_PENDING_TIME_MS = 5 * 60 * 1000; // 5 minutes

/** Delivery record cleanup age (days) */
export const DELIVERY_RECORD_MAX_AGE_DAYS = 7;

// =============================================================================
// TYPING INDICATOR CONFIGURATION
// =============================================================================

/** Minimum interval between typing broadcasts (ms) */
export const TYPING_THROTTLE_MS = 1000;

/** Auto-clear typing indicator after (ms) */
export const TYPING_AUTO_CLEAR_MS = 5000;

/** Typing debounce delay (ms) — time after last keystroke before sending stop-typing.
 *  500ms was too short — user pausing between words caused indicator to flicker.
 *  3000ms matches WhatsApp behavior: stop-typing signal fires 3s after last keystroke. */
export const TYPING_DEBOUNCE_MS = 3000;

// =============================================================================
// BLE MESH CONFIGURATION
// =============================================================================

/** BLE scan duration (ms) */
export const BLE_SCAN_DURATION_MS = 4000;

/** BLE advertise duration (ms) */
export const BLE_ADVERTISE_DURATION_MS = 3000;

/** Heartbeat interval (ms) */
export const BLE_HEARTBEAT_INTERVAL_MS = 30000;

/** Main loop interval (ms) - balance between responsiveness and battery */
export const BLE_LOOP_INTERVAL_MS = 1000;

/**
 * Sprint Audit FIX A11: Battery-aware BLE scan throttling.
 * Returns adjusted scan duration based on battery level.
 * Below 20% battery (non-charging): halve scan time to preserve power.
 * Above 50% battery or charging: full scan duration.
 * SOS active overrides this (mesh emergency mode = always full power).
 */
export function getAdaptiveBLEScanDuration(batteryLevel: number, isCharging: boolean, isSOSActive: boolean): number {
  if (isSOSActive) return BLE_SCAN_DURATION_MS; // Life-safety: never throttle during SOS
  if (isCharging) return BLE_SCAN_DURATION_MS;
  if (batteryLevel < 0.2) return Math.floor(BLE_SCAN_DURATION_MS * 0.5); // 2s
  if (batteryLevel < 0.5) return Math.floor(BLE_SCAN_DURATION_MS * 0.75); // 3s
  return BLE_SCAN_DURATION_MS;
}

/** Peer stale timeout - remove peers not seen in this time (ms) */
export const PEER_STALE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/** Message TTL (hops) — default for general text/data messages */
export const MESSAGE_DEFAULT_TTL = 4;

/**
 * HATA 4 FIX: EEW magnitude thresholds — SINGLE SOURCE OF TRUTH.
 * Önceden 3 farklı yerde 3 farklı değer vardı (EEWService user-setting M3.0,
 * MultiSourceEEWService hardcoded M4.5, Critical Alerts başvurusu M4.0).
 * Bu sabitler artık tüm pipeline'larda kullanılmalı.
 */
export const EEW_THRESHOLDS = {
  /** En düşük bildirim eşiği — bu altında HİÇ bildirim gönderilmez. */
  MIN_NOTIFY_MAGNITUDE: 4.0,
  /** Critical Alerts (DND bypass) eşiği — sadece M5+ */
  CRITICAL_ALERT_MAGNITUDE: 5.0,
  /** Acil durum modu (alarm + countdown) eşiği */
  EMERGENCY_MODE_MAGNITUDE: 5.0,
  /** "Major" deprem etiketi */
  MAJOR_MAGNITUDE: 6.0,
  /** "Catastrophic" deprem etiketi */
  CATASTROPHIC_MAGNITUDE: 7.0,
} as const;

/**
 * SPRINT 17: Adaptive TTL per message type.
 *
 * SOS messages must propagate further (life-safety) — trapped survivors may be
 * dozens of hops away from a rescuer with internet. General chat messages must
 * NOT flood the network (battery + bandwidth waste).
 *
 * Values calibrated for typical Turkish urban density (Istanbul/Ankara):
 *   - SOS / SOS_BEACON / SOS_CANCEL / FAMILY_SOS: 15 hops (~3-5km mesh reach)
 *   - FAMILY messages (status, location): 8 hops
 *   - HEALTH_SOS (medical info to nearby rescuers): 10 hops
 *   - General CHAT / TEXT / DATA: 4 hops (default)
 *   - PING / heartbeat (identity exchange): 1 hop (direct only)
 *   - LOCATION (background tracking): 4 hops
 *
 * Rationale: BLE indoor range ~10-30m, urban density gives ~2-5 peers per scan
 * window. With 4 hops a TEXT reaches ~100-150m. With 15 hops SOS reaches ~500m-1km
 * in dense areas. Past 15 hops the packet duplication overhead exceeds delivery
 * probability gain.
 */
export const ADAPTIVE_TTL = {
  SOS: 15,
  EMERGENCY_BEACON: 15,
  RESCUE_SIGNAL: 15,
  HEALTH_SOS: 10,
  FAMILY_SEARCH: 10,
  STATUS: 8,
  LOCATION: 4,
  CHAT: 4,
  TEXT: 4,
  DATA: 4,
  PING: 1,
  ACK: 2,
  DEFAULT: MESSAGE_DEFAULT_TTL,
} as const;

/**
 * Resolve adaptive TTL for a given mesh message type.
 * Returns the appropriate hop count; defaults to MESSAGE_DEFAULT_TTL.
 */
export function getAdaptiveTTL(messageType: string | number): number {
  // MeshMessageType is a numeric enum; convert to string key.
  const key = typeof messageType === 'number'
    ? meshTypeToKey(messageType)
    : String(messageType).toUpperCase();

  return (ADAPTIVE_TTL as Record<string, number>)[key] ?? ADAPTIVE_TTL.DEFAULT;
}

/** Map MeshMessageType enum values to ADAPTIVE_TTL keys.
 * Synced with src/core/services/mesh/MeshProtocol.ts MeshMessageType enum. */
function meshTypeToKey(type: number): string {
  const map: Record<number, keyof typeof ADAPTIVE_TTL> = {
    0x01: 'SOS',
    0x02: 'STATUS',
    0x03: 'TEXT',
    0x04: 'PING',
    0x05: 'ACK',
    0x06: 'LOCATION',
    0x30: 'EMERGENCY_BEACON',
    0x31: 'FAMILY_SEARCH',
    0x32: 'RESCUE_SIGNAL',
    0x33: 'HEALTH_SOS',
  };
  return map[type] ?? 'DEFAULT';
}

// =============================================================================
// CONNECTION MONITORING
// =============================================================================

/** Connection state check interval (ms) — faster detection means quicker queue flush on reconnect */
export const CONNECTION_CHECK_INTERVAL_MS = 2000;

/** Queue processing interval (ms) — WhatsApp-grade: 3s cycle for near-instant retry */
export const QUEUE_PROCESS_INTERVAL_MS = 3000;

/** ACK monitor interval (ms) */
export const ACK_MONITOR_INTERVAL_MS = 60000;

// =============================================================================
// MESSAGE SIZE LIMITS
// =============================================================================

/** Maximum message content length */
export const MAX_MESSAGE_LENGTH = 10000;

/** Maximum message display length */
export const MAX_DISPLAY_LENGTH = 5000;

/** Maximum preview length */
export const MAX_PREVIEW_LENGTH = 100;

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const STORAGE_KEYS = {
    MESSAGE_QUEUE: '@afetnet:msg_queue_v3',
    SEEN_MESSAGE_IDS: '@afetnet:seen_msg_ids',
    MESH_QUEUE: '@afetnet:mesh_queue_v2',
    DELIVERY_TRACKING: '@afetnet:delivery_tracking',
    CRYPTO_KEYS: '@afetnet:crypto_known_keys_v2',
} as const;

// =============================================================================
// PRIORITY WEIGHTS
// =============================================================================

export const PRIORITY_ORDER = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
} as const;

// =============================================================================
// MESSAGE STATUS PRIORITY (prevents status regression)
// =============================================================================

/**
 * Status priority for regression guard. Import this instead of hardcoding STATUS_RANK.
 *
 * DELIVERY STATE MACHINE:
 *   pending → sending → sent → delivered → read
 *                     ↘ failed (retryable)  → pending (auto-retry)
 *                     ↘ permanently_failed   (non-retryable, terminal)
 *
 * Rules:
 * - Status can only advance (higher rank), never regress.
 * - Exception: any status → failed/permanently_failed (always allowed).
 * - Exception: failed → pending (retry resets to beginning of pipeline).
 * - `failed` rank is -1 so it never blocks transitions TO higher states.
 * - `permanently_failed` rank is -2 so it is NEVER overwritten by anything
 *   except an explicit clear. Once permanently_failed, the message is dead.
 */
export const MESSAGE_STATUS_PRIORITY: Record<string, number> = {
    permanently_failed: -2,
    failed: -1,
    pending: 0,
    sending: 1,
    sent: 2,
    delivered: 3,
    read: 4,
};

/**
 * Check whether a status transition is allowed.
 * Used across HybridMessageService, messageStore, and GroupChatService
 * to enforce the delivery state machine consistently.
 */
export function isStatusTransitionAllowed(
    currentStatus: string | undefined,
    newStatus: string,
): boolean {
    // Always allow transitions to failed/permanently_failed
    if (newStatus === 'failed' || newStatus === 'permanently_failed') return true;
    // Allow retry: failed → pending
    if (currentStatus === 'failed' && newStatus === 'pending') return true;
    // Never allow anything to overwrite permanently_failed
    if (currentStatus === 'permanently_failed') return false;
    // Normal advancement: newRank must be >= currentRank
    const currentRank = MESSAGE_STATUS_PRIORITY[currentStatus || ''] ?? 0;
    const newRank = MESSAGE_STATUS_PRIORITY[newStatus] ?? 0;
    return newRank >= currentRank;
}

// =============================================================================
// LOG LEVELS (for production filtering)
// =============================================================================

export const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
} as const;

/** Minimum log level for production */
export const PRODUCTION_MIN_LOG_LEVEL = __DEV__ ? 'debug' : 'warn';
