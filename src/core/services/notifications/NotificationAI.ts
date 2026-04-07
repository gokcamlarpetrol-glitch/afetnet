/**
 * NOTIFICATION AI — Intelligence Layer
 * 
 * Smart deduplication, priority assessment, staleness filtering,
 * aftershock grouping, and notification batching.
 * 
 * This module decides WHETHER a notification should be delivered,
 * not HOW it should be delivered.
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('NotificationAI');

// ============================================================================
// TYPES
// ============================================================================

export type NotificationCategory =
    | 'earthquake'
    | 'eew'
    | 'sos'
    | 'sos_received'
    | 'family_sos'
    | 'rescue'
    | 'family'
    | 'message'
    | 'news'
    | 'system'
    | 'drill';

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export interface NotificationPayload {
    category: NotificationCategory;
    title?: string;
    body?: string;
    data: Record<string, any>;
    /** Override priority (otherwise AI determines it) */
    priority?: NotificationPriority;
    /** Source service that triggered the notification */
    source?: string;
    /** Timestamp of the underlying event (NOT when notify was called) */
    eventTimestamp?: number;
}

export interface AIDecision {
    deliver: boolean;
    reason: string;
    priority: NotificationPriority;
    /** If true, notification should bypass DND */
    bypassDND: boolean;
    /** If true, this is part of an aftershock sequence */
    isAftershock: boolean;
    /** Suggested grouping key (for batching) */
    groupKey?: string;
    /** Fingerprint used for dedup */
    fingerprint: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Per-category staleness thresholds (ms) */
const STALENESS_THRESHOLDS: Record<NotificationCategory, number> = {
    earthquake: 15 * 60 * 1000,   // 15 min
    eew: 5 * 60 * 1000,   //  5 min (time-critical)
    sos: 30 * 60 * 1000,   // 30 min
    sos_received: 30 * 60 * 1000, // 30 min
    family_sos: 30 * 60 * 1000,  // 30 min (family member SOS)
    rescue: 30 * 60 * 1000,   // 30 min
    family: 60 * 60 * 1000,   //  1 hour
    message: 120 * 60 * 1000,   //  2 hours
    news: 360 * 60 * 1000,   //  6 hours
    system: 5 * 60 * 1000,   //  5 min
    drill: 30 * 60 * 1000,   // 30 min
};

/** Per-category dedup windows (ms) */
const DEDUP_WINDOWS: Record<NotificationCategory, number> = {
    earthquake: 10 * 60 * 1000,   // 10 min
    eew: 5 * 60 * 1000,   //  5 min
    sos: 10 * 60 * 1000,   // 10 min
    sos_received: 5 * 60 * 1000,  //  5 min
    family_sos: 5 * 60 * 1000,   //  5 min (family member SOS)
    rescue: 5 * 60 * 1000,   //  5 min
    family: 2 * 60 * 1000,   //  2 min
    message: 30 * 1000, // 30 sec
    news: 60 * 60 * 1000,   //  1 hour
    system: 5 * 60 * 1000,   //  5 min
    drill: 5 * 60 * 1000,   //  5 min
};

/** Per-category rate limits: max notifications per window */
const RATE_LIMITS: Record<NotificationCategory, { max: number; windowMs: number }> = {
    earthquake: { max: 3, windowMs: 5 * 60 * 1000 },
    eew: { max: 2, windowMs: 3 * 60 * 1000 },
    sos: { max: 5, windowMs: 10 * 60 * 1000 },
    sos_received: { max: 5, windowMs: 5 * 60 * 1000 },
    family_sos: { max: 5, windowMs: 5 * 60 * 1000 },
    rescue: { max: 3, windowMs: 5 * 60 * 1000 },
    family: { max: 5, windowMs: 5 * 60 * 1000 },
    message: { max: 10, windowMs: 60 * 1000 },
    news: { max: 3, windowMs: 30 * 60 * 1000 },
    system: { max: 2, windowMs: 10 * 60 * 1000 },
    drill: { max: 3, windowMs: 10 * 60 * 1000 },
};

/** Categories that ALWAYS bypass DND */
const DND_BYPASS_CATEGORIES: Set<NotificationCategory> = new Set([
    'eew', 'sos', 'sos_received', 'family_sos',
]);

/** Categories that conditionally bypass DND (based on priority) */
const CONDITIONAL_DND_BYPASS: Set<NotificationCategory> = new Set([
    'earthquake', 'rescue',
]);

/** Critical magnitude threshold — auto-escalates to CRITICAL (DND bypass, rate-limit bypass)
 *  M5.0+ causes structural damage and injuries — must bypass all notification suppressors.
 *  Previous value was 6.0, which left M5.0-5.9 without DND bypass; raised to critical.
 */
const CRITICAL_MAGNITUDE_THRESHOLD = 5.0;
/** High magnitude threshold — auto-escalates to HIGH (sound + vibration, but no DND bypass) */
const HIGH_MAGNITUDE_THRESHOLD = 4.5;

// ============================================================================
// STATE
// ============================================================================

/** fingerprint → timestamp of last delivery */
const _dedupMap = new Map<string, number>();

/** category → list of delivery timestamps */
const _rateMap = new Map<NotificationCategory, number[]>();

/** Recent earthquake magnitudes for aftershock detection */
const _recentEarthquakes: Array<{ magnitude: number; timestamp: number; location: string }> = [];

/** Global counter for total notifications delivered */
let _totalDelivered = 0;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Evaluate whether a notification should be delivered.
 * This is the CORE intelligence function — called by NotificationCenter.
 */
export function evaluateNotification(payload: NotificationPayload): AIDecision {
    const now = Date.now();
    const fingerprint = generateFingerprint(payload);

    // 1. STALENESS CHECK
    const stalenessResult = checkStaleness(payload, now);
    if (!stalenessResult.pass) {
        return reject(fingerprint, stalenessResult.reason);
    }

    // 2. DEDUP CHECK
    const dedupResult = checkDedup(fingerprint, payload.category, now);
    if (!dedupResult.pass) {
        return reject(fingerprint, dedupResult.reason);
    }

    // 3. RATE LIMIT CHECK (bypassed for critical events)
    const priority = assessPriority(payload);
    if (priority !== 'critical') {
        const rateResult = checkRateLimit(payload.category, now);
        if (!rateResult.pass) {
            return reject(fingerprint, rateResult.reason);
        }
    }

    // 4. AFTERSHOCK DETECTION
    const isAftershock = detectAftershock(payload, now);

    // 5. DETERMINE DND BYPASS
    const bypassDND = shouldBypassDND(payload.category, priority);

    // 6. RECORD DELIVERY
    recordDelivery(fingerprint, payload, now);

    // 7. DETERMINE GROUP KEY
    const groupKey = getGroupKey(payload);

    return {
        deliver: true,
        reason: isAftershock ? 'Aftershock notification approved' : 'Notification approved',
        priority,
        bypassDND,
        isAftershock,
        groupKey,
        fingerprint,
    };
}

/**
 * Clear all AI state. Used during initialization to prevent
 * stale data from causing issues after app restart.
 */
export function resetAIState(): void {
    _dedupMap.clear();
    _rateMap.clear();
    _recentEarthquakes.length = 0;
    _totalDelivered = 0;
    if (__DEV__) {
        logger.debug('🧠 AI state reset');
    }
}

/**
 * Get AI statistics for debugging.
 */
export function getAIStats() {
    return {
        totalDelivered: _totalDelivered,
        dedupMapSize: _dedupMap.size,
        recentEarthquakes: _recentEarthquakes.length,
        rateLimitEntries: _rateMap.size,
    };
}

// ============================================================================
// FINGERPRINT GENERATION
// ============================================================================

function generateFingerprint(payload: NotificationPayload): string {
    const { category, data, eventTimestamp } = payload;

    switch (category) {
        case 'earthquake':
        case 'eew': {
            // Earthquake fingerprint: magnitude bucket + location prefix + time window
            const mag = typeof data.magnitude === 'number' ? Math.round(data.magnitude * 10) : 0;
            const loc = typeof data.location === 'string' ? data.location.substring(0, 15).toLowerCase().trim() : 'unknown';
            const timeWindow = eventTimestamp ? Math.floor(eventTimestamp / 600_000) : Math.floor(Date.now() / 600_000);
            return `${category}_m${mag}_${loc}_t${timeWindow}`;
        }

        case 'sos':
        case 'sos_received':
        case 'family_sos': {
            // CRITICAL FIX: data.from is a reserved FCM key and gets stripped by CF sanitization.
            // Use senderUid/senderId as primary identifiers instead.
            const senderId = data.senderUid || data.senderId || data.fromName || data.from || data.userId || 'unknown';
            const timeWindow = Math.floor((eventTimestamp || Date.now()) / 300_000); // 5-min windows
            return `${category}_${senderId}_t${timeWindow}`;
        }

        case 'rescue': {
            const userId = data.userId || data.senderId || 'unknown';
            const timeWindow = Math.floor((eventTimestamp || Date.now()) / 300_000);
            return `rescue_${userId}_t${timeWindow}`;
        }

        case 'message': {
            // CRITICAL FIX: data.from is a reserved FCM key and gets stripped by CF sanitization.
            // Use senderUid/senderId/fromName as fallback instead.
            const from = data.senderUid || data.senderId || data.fromName || data.from || 'unknown';
            const msgId = data.messageId || data.id || '';
            return msgId ? `msg_${msgId}` : `msg_${from}_${Math.floor(Date.now() / 30_000)}`;
        }

        case 'family': {
            const memberId = data.memberId || data.userId || 'unknown';
            const type = data.type || 'update';
            return `family_${memberId}_${type}_${Math.floor(Date.now() / 120_000)}`;
        }

        case 'news': {
            const title = typeof data.title === 'string' ? data.title.substring(0, 30).toLowerCase().trim() : '';
            return `news_${title || Math.floor(Date.now() / 3600_000)}`;
        }

        case 'system': {
            const subtype = data.subtype || data.type || 'generic';
            return `system_${subtype}_${Math.floor(Date.now() / 300_000)}`;
        }

        case 'drill': {
            return `drill_${Math.floor(Date.now() / 300_000)}`;
        }

        default: {
            // FIX: Return a fallback fingerprint for unrecognized categories
            // instead of undefined, which would cause all unknown categories
            // to share the same dedup slot
            const fallbackKey = data.id || data.senderId || data.userId || '';
            return `${category}_${fallbackKey}_${Math.floor(Date.now() / 300_000)}`;
        }
    }
}

// ============================================================================
// INTELLIGENCE CHECKS
// ============================================================================

function checkStaleness(payload: NotificationPayload, now: number): { pass: boolean; reason: string } {
    const { category, eventTimestamp } = payload;
    // CRITICAL FIX: If eventTimestamp is missing for earthquake/eew categories, REJECT.
    // Missing timestamp means we can't verify freshness → could be hours-old stale data.
    // Other categories (message, sos) may legitimately lack eventTimestamp.
    if (!eventTimestamp) {
        if (category === 'earthquake' || category === 'eew') {
            return { pass: false, reason: 'No eventTimestamp for earthquake notification — cannot verify freshness' };
        }
        return { pass: true, reason: '' };
    }

    const age = now - eventTimestamp;
    const threshold = STALENESS_THRESHOLDS[category];

    if (age > threshold) {
        if (__DEV__) {
            logger.debug(`⏭️ Stale ${category}: ${Math.round(age / 60000)}min old (threshold: ${Math.round(threshold / 60000)}min)`);
        }
        return { pass: false, reason: `Stale: ${Math.round(age / 60000)}min old` };
    }
    return { pass: true, reason: '' };
}

function checkDedup(fingerprint: string, category: NotificationCategory, now: number): { pass: boolean; reason: string } {
    // Clean old entries
    for (const [key, ts] of _dedupMap.entries()) {
        if (now - ts > 30 * 60 * 1000) { // 30 min max retention
            _dedupMap.delete(key);
        }
    }

    const lastSeen = _dedupMap.get(fingerprint);
    if (lastSeen !== undefined) {
        const window = DEDUP_WINDOWS[category];
        if (now - lastSeen < window) {
            if (__DEV__) {
                logger.debug(`🔇 Duplicate ${category}: "${fingerprint}" (${Math.round((now - lastSeen) / 1000)}s ago)`);
            }
            return { pass: false, reason: `Duplicate within ${Math.round(window / 1000)}s` };
        }
    }

    return { pass: true, reason: '' };
}

function checkRateLimit(category: NotificationCategory, now: number): { pass: boolean; reason: string } {
    const limit = RATE_LIMITS[category];
    const timestamps = _rateMap.get(category) || [];

    // Clean old entries
    const filtered = timestamps.filter(t => now - t < limit.windowMs);
    _rateMap.set(category, filtered);

    if (filtered.length >= limit.max) {
        if (__DEV__) {
            logger.debug(`⏸️ Rate limited ${category}: ${filtered.length}/${limit.max} in ${Math.round(limit.windowMs / 1000)}s`);
        }
        return { pass: false, reason: `Rate limited: ${filtered.length}/${limit.max}` };
    }

    return { pass: true, reason: '' };
}

// ============================================================================
// PRIORITY ASSESSMENT
// ============================================================================

function assessPriority(payload: NotificationPayload): NotificationPriority {
    const { category, data, priority: overridePriority } = payload;

    // Category-based defaults
    switch (category) {
        case 'eew':
            return 'critical'; // EEW is ALWAYS critical
        case 'sos':
        case 'sos_received':
        case 'family_sos':
            return 'critical'; // SOS is ALWAYS critical

        case 'earthquake': {
            const mag = typeof data.magnitude === 'number' ? data.magnitude : 0;
            if (mag >= CRITICAL_MAGNITUDE_THRESHOLD) return 'critical';
            if (mag >= HIGH_MAGNITUDE_THRESHOLD) return 'high';
            return overridePriority || 'normal';
        }

        case 'rescue':
            return 'high';

        case 'family':
            return data.isSOS ? 'critical' : 'high';

        case 'message':
            return data.isSOS || data.isCritical ? 'critical' : 'high';

        case 'news':
            return overridePriority || 'normal';

        case 'system':
            return overridePriority || 'low';

        case 'drill':
            return 'normal';

        default:
            return overridePriority || 'normal';
    }
}

// ============================================================================
// AFTERSHOCK DETECTION
// ============================================================================

function detectAftershock(payload: NotificationPayload, now: number): boolean {
    if (payload.category !== 'earthquake') return false;

    const mag = typeof payload.data.magnitude === 'number' ? payload.data.magnitude : 0;
    const loc = typeof payload.data.location === 'string' ? payload.data.location : '';

    // Clean old entries (keep last 60 min)
    while (_recentEarthquakes.length > 0 && now - _recentEarthquakes[0].timestamp > 60 * 60 * 1000) {
        _recentEarthquakes.shift();
    }

    // Check if this is an aftershock (smaller magnitude, same region, within 60 min)
    const isAftershock = _recentEarthquakes.some(eq => {
        const sameRegion = loc.substring(0, 10) === eq.location.substring(0, 10);
        const isSmaller = mag < eq.magnitude;
        return sameRegion && isSmaller;
    });

    // Record this earthquake
    _recentEarthquakes.push({ magnitude: mag, timestamp: now, location: loc });
    if (_recentEarthquakes.length > 50) {
        _recentEarthquakes.shift();
    }

    return isAftershock;
}

// ============================================================================
// DND & GROUPING
// ============================================================================

function shouldBypassDND(category: NotificationCategory, priority: NotificationPriority): boolean {
    if (DND_BYPASS_CATEGORIES.has(category)) return true;
    if (CONDITIONAL_DND_BYPASS.has(category) && priority === 'critical') return true;
    return false;
}

function getGroupKey(payload: NotificationPayload): string | undefined {
    switch (payload.category) {
        case 'earthquake':
        case 'eew':
            return 'earthquake';
        case 'sos':
        case 'sos_received':
            return 'sos';
        case 'news':
            return 'news';
        default:
            return undefined;
    }
}

// ============================================================================
// RECORDING & HELPERS
// ============================================================================

function recordDelivery(fingerprint: string, payload: NotificationPayload, now: number): void {
    _dedupMap.set(fingerprint, now);

    const timestamps = _rateMap.get(payload.category) || [];
    timestamps.push(now);
    _rateMap.set(payload.category, timestamps);

    _totalDelivered++;
}

function reject(fingerprint: string, reason: string): AIDecision {
    return {
        deliver: false,
        reason,
        priority: 'normal',
        bypassDND: false,
        isAftershock: false,
        fingerprint,
    };
}
