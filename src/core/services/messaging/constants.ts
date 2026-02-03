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
export const MAX_QUEUE_SIZE = 1000;

/** Maximum number of messages to keep in memory */
export const MAX_MESSAGES_IN_MEMORY = 500;

/** Maximum number of seen message IDs to cache (for deduplication) */
export const MAX_SEEN_MESSAGE_IDS = 1000;

/** Queue persistence debounce interval in ms */
export const QUEUE_SAVE_DEBOUNCE_MS = 2000;

// =============================================================================
// RETRY CONFIGURATION
// =============================================================================

/** Initial retry delay in ms */
export const RETRY_INITIAL_DELAY_MS = 1000;

/** Maximum retry delay in ms */
export const RETRY_MAX_DELAY_MS = 30000;

/** Retry backoff multiplier */
export const RETRY_MULTIPLIER = 2;

/** Maximum number of retry attempts */
export const RETRY_MAX_ATTEMPTS = 10;

/** Jitter range for retry (0.5 to 1.5x) */
export const RETRY_JITTER_MIN = 0.5;
export const RETRY_JITTER_MAX = 1.5;

// =============================================================================
// ACK & DELIVERY CONFIGURATION
// =============================================================================

/** Time to wait for ACK before retry (ms) */
export const ACK_TIMEOUT_MS = 10000;

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

/** Typing debounce delay (ms) */
export const TYPING_DEBOUNCE_MS = 500;

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

/** Peer stale timeout - remove peers not seen in this time (ms) */
export const PEER_STALE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/** Message TTL (hops) */
export const MESSAGE_DEFAULT_TTL = 3;

// =============================================================================
// CONNECTION MONITORING
// =============================================================================

/** Connection state check interval (ms) */
export const CONNECTION_CHECK_INTERVAL_MS = 5000;

/** Queue processing interval (ms) */
export const QUEUE_PROCESS_INTERVAL_MS = 10000;

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
