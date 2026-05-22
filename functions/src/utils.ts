/**
 * AFETNET FIREBASE FUNCTIONS - SHARED UTILITIES
 *
 * Common helpers, types, constants, and push notification infrastructure
 * shared across all domain modules.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// ============================================================
// FIREBASE ADMIN SINGLETON
// ============================================================

// Initialize Firebase Admin only once (idempotent check)
if (admin.apps.length === 0) {
    admin.initializeApp();
}

export const db = admin.firestore();
export const messaging = admin.messaging();

// ============================================================
// REGION CONFIGURATION - EUROPE-WEST1 FOR LOW LATENCY
// ============================================================

export const REGION = 'europe-west1';

// ============================================================
// TYPES
// ============================================================

export interface EEWEvent {
    id: string;
    magnitude: number;
    latitude: number;
    longitude: number;
    depth: number;
    location: string;
    source: 'AFAD' | 'KANDILLI' | 'USGS' | 'EMSC' | 'CROWDSOURCED';
    timestamp: number;
    issuedAt: number;
    verified?: boolean;
    verificationSources?: string[];
}

export interface FCMToken {
    token: string;
    userId: string;
    platform: 'ios' | 'android';
    lastUpdated: number;
    location?: {
        latitude: number;
        longitude: number;
    };
}

export interface PWaveConsensus {
    centerLatitude: number;
    centerLongitude: number;
    radiusKm: number;
    detectionCount: number;
    avgConfidence: number;
    avgMagnitude: number;
    deviceIds: string[];
    firstDetectionAt: number;
    lastDetectionAt: number;
}

export interface OpenAIProxyMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ExpoPushMessage {
    to: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    sound?: 'default' | string | null;
    badge?: number;
    priority?: 'default' | 'normal' | 'high';
    channelId?: string;
    categoryId?: string;
}

// ============================================================
// CONSTANTS - ELITE CONFIGURATION
// ============================================================

// API Endpoints
export const AFAD_API = 'https://deprem.afad.gov.tr/apiv2/event/filter';
export const KANDILLI_API = 'https://www.koeri.boun.edu.tr/scripts/lst0.asp';
// 2.5_hour feed — yerel anlamlı (M4+) depremleri de kapsar. 4.5_hour feed,
// Türkiye'deki orta büyüklükteki depremleri (M4.0–4.5) tamamen kaçırıyordu.
// Alt sınır fetchUSGSEvents içinde M4.0 olarak uygulanır.
export const USGS_API = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson';
export const EMSC_API = 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=4.5&limit=20&orderby=time';

// Thresholds
export const MIN_MAGNITUDE_ALERT = 4.0;
export const MIN_MAGNITUDE_CRITICAL = 5.5;
// ELITE: Two-layer protection — 3 phones to DETECT consensus, but FCM push requires 5 phones + 85%
// This lets the system detect events early while still requiring high confidence for user-facing alerts
export const CONSENSUS_THRESHOLD = 3;
export const CONSENSUS_CONFIDENCE = 75;

// Location-based push radius (km)
export const NEARBY_RADIUS_CRITICAL = 500; // M5.5+ -> 500km radius
export const NEARBY_RADIUS_NORMAL = 300;   // M4.0+ -> 300km radius

// Retry configuration
export const MAX_FCM_RETRIES = 3;
export const RETRY_DELAY_BASE_MS = 1000;

// Turkey bounding box
export const TURKEY_BOUNDS = {
    minLat: 36.0,
    maxLat: 42.5,
    minLon: 26.0,
    maxLon: 45.0,
};

// Expo Push API
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';
export const EMERGENCY_NOTIFICATION_SOUND = 'emergency-alert.wav';

// Firebase UID regex (strict canonical form used by most providers)
export const FIREBASE_UID_REGEX = /^[A-Za-z0-9]{20,40}$/;

/**
 * Broader Firebase UID detector:
 * - Standard Firebase UIDs (20-40 alnum)
 * - Phone-auth style IDs (+905...)
 * - Custom provider IDs with "-", "_" or "."
 * Rejects UUIDv4 hardware identifiers.
 */
export function isLikelyFirebaseUid(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 5) return false;

    if (/^\+[1-9]\d{5,14}$/.test(trimmed)) return true;
    if (FIREBASE_UID_REGEX.test(trimmed)) return true;

    if (trimmed.length >= 20 && /^[A-Za-z0-9\-_.]+$/.test(trimmed)) {
        const isUuidV4 = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(trimmed);
        if (!isUuidV4) return true;
    }

    return false;
}

// ============================================================
// EXPO PUSH NOTIFICATION HELPER
// CRITICAL: App registers Expo Push Tokens (ExponentPushToken[xxx])
// Firebase Admin's messaging.send() ONLY works with native FCM tokens.
// We MUST use Expo's Push API for sending to Expo tokens.
// ============================================================

/**
 * Map logical push type to Android notification channel ID defined in app.
 * Keeps backend payloads aligned with NotificationChannelManager channel IDs.
 */
export function resolveAndroidChannelId(data?: Record<string, string>): string {
    const rawType = (data?.type || '').toLowerCase();
    if (rawType === 'eew') return 'eew_critical';
    if (rawType === 'earthquake' || rawType === 'turkey_earthquake_detection' || rawType === 'global_early_warning') {
        return 'earthquake_alerts';
    }
    if (
        rawType === 'sos' ||
        rawType === 'sos_family' ||
        rawType === 'family_sos' ||
        rawType === 'sos_proximity' ||
        rawType === 'nearby_sos'
    ) {
        return 'sos_alerts';
    }
    if (rawType === 'family_status_update' || rawType === 'family_location') {
        return 'family_updates';
    }
    // CRITICAL FIX: sos_message is a regular chat message within an SOS conversation,
    // NOT an SOS alert. It must use the 'messages' channel (HIGH importance, no DND bypass).
    // Previously mapped to sos_alerts (MAX importance, bypass DND) which made every reply
    // during rescue coordination disruptively bypass DND — contradicting the client-side fix
    // that moved sos_message from the SOS handler to the message handler.
    if (rawType === 'new_message' || rawType === 'message' || rawType === 'message_received' || rawType === 'sos_message') {
        return 'messages';
    }
    if (rawType === 'contact_request') return 'family_updates';
    if (rawType === 'news') return 'news_updates';
    return 'default';
}

/**
 * Check if a token is an Expo Push Token
 */
export function isExpoPushToken(token: string): boolean {
    return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

/**
 * Map notification data.type → APNs category identifier registered in NotificationCenter.
 * Enables iOS Quick Actions (reply textInput, help/view buttons, dismiss).
 * Returns null for unknown types — APNs payload omits category and shows standard banner.
 */
export function mapTypeToApnsCategory(rawType: string): string | null {
    const t = (rawType || '').toLowerCase();
    if (!t) return null;
    if (t === 'new_message' || t === 'message' || t === 'sos_message') return 'chat_message';
    if (t === 'sos' || t === 'sos_alert' || t === 'sos_received' || t === 'sos_family'
        || t === 'family_sos' || t === 'sos_proximity' || t === 'nearby_sos') return 'sos';
    if (t === 'family' || t === 'family_status' || t === 'family_status_update'
        || t === 'family_location') return 'family';
    if (t === 'eew' || t === 'earthquake') return 'eew';
    return null;
}

/**
 * Send push notification via Expo's Push API
 * This is the ONLY way to deliver to ExponentPushToken[xxx] tokens
 */
export async function sendExpoPush(
    messages: ExpoPushMessage[],
    _retryAttempt = 0,
): Promise<{ successCount: number; failCount: number; invalidTokens: string[] }> {
    if (messages.length === 0) return { successCount: 0, failCount: 0, invalidTokens: [] };

    const MAX_RETRY_ATTEMPTS = 3;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(EXPO_PUSH_API, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
            // CRITICAL FIX: Handle 429 rate limiting with exponential backoff + jitter.
            // During SOS broadcasts, many push notifications fire concurrently.
            // Expo's API returns 429 when rate limited — retry with increasing delay.
            if (response.status === 429 && _retryAttempt < MAX_RETRY_ATTEMPTS) {
                const baseDelay = Math.min(1000 * Math.pow(2, _retryAttempt), 10000);
                const jitter = Math.random() * 1000;
                const delayMs = baseDelay + jitter;
                functions.logger.warn(`Expo Push API rate limited (429), retry ${_retryAttempt + 1}/${MAX_RETRY_ATTEMPTS} in ${Math.round(delayMs)}ms`);
                await new Promise(r => setTimeout(r, delayMs));
                return sendExpoPush(messages, _retryAttempt + 1);
            }
            if (response.status === 429) {
                functions.logger.error(`Expo Push API rate limited (429) — exhausted all ${MAX_RETRY_ATTEMPTS} retries`);
            } else {
                functions.logger.error(`Expo Push API error: ${response.status} ${response.statusText}`);
            }
            return { successCount: 0, failCount: messages.length, invalidTokens: [] };
        }

        const result = await response.json() as {
            data?: Array<{ status: string; message?: string; details?: { error?: string } }> | { status: string; message?: string; details?: { error?: string } };
        };
        const tickets = Array.isArray(result.data)
            ? result.data
            : (result.data ? [result.data] : []);
        let successCount = 0;
        let failCount = 0;
        const invalidTokens: string[] = [];

        for (let index = 0; index < tickets.length; index++) {
            const ticket = tickets[index];
            if (ticket.status === 'ok') {
                successCount++;
            } else {
                failCount++;
                functions.logger.warn(`Expo push ticket error: ${ticket.message}`);
                const expoError = ticket.details?.error;
                if (expoError === 'DeviceNotRegistered') {
                    const token = messages[index]?.to;
                    if (token) invalidTokens.push(token);
                }
            }
        }

        if (invalidTokens.length > 0) {
            await cleanupInvalidPushTokens(invalidTokens);
        }

        return { successCount, failCount, invalidTokens };
    } catch (error) {
        functions.logger.error('Expo Push API request failed:', error);
        return { successCount: 0, failCount: messages.length, invalidTokens: [] };
    }
}

const RESERVED_FCM_DATA_KEYS = new Set([
    'from',
    'collapse_key',
    'message_type',
    'google',
    'gcm',
    'notification',
]);

function isReservedFcmDataKey(key: string): boolean {
    const lower = key.toLowerCase();
    if (RESERVED_FCM_DATA_KEYS.has(lower)) return true;
    if (lower.startsWith('google.')) return true;
    if (lower.startsWith('gcm.')) return true;
    return false;
}

function sanitizePushDataPayload(data?: Record<string, string>): Record<string, string> | undefined {
    if (!data) return undefined;

    const sanitized: Record<string, string> = {};
    let droppedCount = 0;

    for (const [rawKey, rawValue] of Object.entries(data)) {
        const trimmedKey = rawKey.trim();
        if (!trimmedKey) {
            droppedCount++;
            continue;
        }

        if (isReservedFcmDataKey(trimmedKey)) {
            droppedCount++;
            continue;
        }

        const safeKey = trimmedKey.replace(/[^A-Za-z0-9_.-]/g, '_');
        if (!safeKey || isReservedFcmDataKey(safeKey)) {
            droppedCount++;
            continue;
        }

        const safeValue = typeof rawValue === 'string'
            ? rawValue
            : String(rawValue ?? '');

        sanitized[safeKey] = safeValue;
    }

    if (droppedCount > 0) {
        functions.logger.warn(`sendPushToToken: sanitized push payload (dropped ${droppedCount} invalid key(s))`);
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Send push notification that works with BOTH Expo and FCM tokens.
 * Routes to the correct API based on token type.
 * Retries up to 2 times on transient failures; cleans up permanently invalid FCM tokens.
 */
export async function sendPushToToken(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    _retryCount = 0,
): Promise<boolean> {
    try {
        const safeData = sanitizePushDataPayload(data);
        const channelId = resolveAndroidChannelId(safeData);
        const rawType = (safeData?.type || '').toLowerCase();
        // CRITICAL FIX: sos_message removed from emergency types.
        // It's a regular chat message within an SOS conversation, not an SOS alert.
        // Giving it time-sensitive iOS interruption level would bypass Focus mode
        // for every reply during rescue coordination — disruptive and incorrect.
        const isEmergencyType =
            rawType === 'eew' ||
            rawType === 'sos' ||
            rawType === 'sos_family' ||
            rawType === 'family_sos' ||
            rawType === 'sos_proximity' ||
            rawType === 'nearby_sos';
        const iosInterruptionLevel: 'active' | 'time-sensitive' = isEmergencyType
            ? 'time-sensitive'
            : 'active';
        const notificationSound = isEmergencyType ? EMERGENCY_NOTIFICATION_SOUND : 'default';

        if (isExpoPushToken(token)) {
            // G2: Propagate the same iOS category as native FCM path so Expo push
            // recipients also get Quick Actions (Yardıma git / Kapat for SOS,
            // Reply / View for chat). Without this, only native FCM tokens see
            // the lock-screen action buttons — and most production users have
            // Expo push tokens.
            const expoCategory = mapTypeToApnsCategory(rawType);
            const result = await sendExpoPush([{
                to: token,
                title,
                body,
                data: safeData,
                sound: notificationSound,
                priority: 'high',
                channelId,
                ...(expoCategory ? { categoryId: expoCategory } : {}),
            }]);
            return result.successCount > 0;
        } else {
            // Native FCM token — use Firebase Admin SDK
            // CRITICAL FIX: Include data fields in APNS payload explicitly.
            // When apns.payload is specified, Firebase Admin SDK does NOT auto-merge
            // the top-level data fields into the APNS payload. Without this, iOS
            // notification taps have EMPTY data → handleNotificationTap falls through
            // to "navigate to Home" instead of the target screen.
            // iOS notification grouping: thread-id from caller's explicit threadId,
            // or fall back to conversationId so DM/group chats collapse into one stack.
            const threadId = safeData?.threadId || safeData?.conversationId;
            // iOS notification category enables Quick Actions registered in NotificationCenter
            // (chat_message: reply textInput + view; sos: help + dismiss; family: view; eew: view + dismiss).
            const apnsCategory = mapTypeToApnsCategory(rawType);
            const aps: Record<string, unknown> = {
                alert: { title, body },
                sound: notificationSound,
                badge: 1,
                'interruption-level': iosInterruptionLevel,
                'content-available': 1,
            };
            if (threadId) aps['thread-id'] = threadId;
            if (apnsCategory) aps.category = apnsCategory;
            await messaging.send({
                token,
                notification: { title, body },
                data: safeData,
                android: {
                    priority: 'high',
                    notification: { sound: notificationSound, priority: 'max', channelId },
                },
                apns: {
                    payload: {
                        aps,
                        ...(safeData || {}),
                    },
                },
            });
            return true;
        }
    } catch (error: any) {
        const code = error?.code || error?.errorInfo?.code || '';
        // Permanent errors — don't retry, optionally cleanup token
        const isPermanent =
            code === 'messaging/invalid-argument' ||
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token';

        if (!isPermanent && _retryCount < 2) {
            await new Promise(r => setTimeout(r, 500 * (_retryCount + 1)));
            return sendPushToToken(token, title, body, data, _retryCount + 1);
        }

        functions.logger.warn(`Push to token failed (attempt ${_retryCount + 1}): ${error}`);

        // Best-effort cleanup of permanently invalid native FCM tokens
        if (isPermanent && !isExpoPushToken(token)) {
            try {
                const tokenSnap = await db.collectionGroup('devices')
                    .where('token', '==', token).limit(5).get();
                if (!tokenSnap.empty) {
                    const batch = db.batch();
                    tokenSnap.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                    functions.logger.info(`Cleaned up invalid FCM token from ${tokenSnap.size} device doc(s)`);
                }
            } catch { /* non-critical, best effort */ }
        }

        return false;
    }
}

/**
 * Collect ALL push tokens for a given user UID from V3 + legacy sources.
 */
export async function collectPushTokensForUid(ownerUid: string, fallbackToken?: string): Promise<string[]> {
    const allTokens: string[] = [];
    const seenTokens = new Set<string>();

    // V3: push_tokens/{uid}/devices — ALL devices (PRIORITY)
    try {
        const v3Snap = await db.collection('push_tokens').doc(ownerUid).collection('devices').get();
        for (const tDoc of v3Snap.docs) {
            const t = tDoc.data()?.token;
            if (t && !seenTokens.has(t)) { seenTokens.add(t); allTokens.push(t); }
        }
    } catch (e) { functions.logger.warn(`collectPushTokensForUid: V3 path failed for ${ownerUid}:`, e); }

    // Legacy: fcm_tokens/{uid} root token
    try {
        const tokenDoc = await db.collection('fcm_tokens').doc(ownerUid).get();
        const legacyToken = tokenDoc.exists ? tokenDoc.data()?.token : null;
        if (legacyToken && !seenTokens.has(legacyToken)) {
            seenTokens.add(legacyToken);
            allTokens.push(legacyToken);
        }

        // Legacy: fcm_tokens/{uid}/devices
        const devicesSnap = await db.collection('fcm_tokens').doc(ownerUid).collection('devices').get();
        for (const dDoc of devicesSnap.docs) {
            const dt = dDoc.data()?.token;
            if (dt && !seenTokens.has(dt)) {
                seenTokens.add(dt);
                allTokens.push(dt);
            }
        }
    } catch (e) { functions.logger.warn(`collectPushTokensForUid: legacy path failed for ${ownerUid}:`, e); }

    // Final fallback: caller-provided token
    if (fallbackToken && !seenTokens.has(fallbackToken)) {
        allTokens.push(fallbackToken);
    }

    // SAFETY: Limit tokens per user to prevent runaway push notifications
    // (e.g., a user with many old devices accumulating stale tokens)
    const MAX_TOKENS_PER_USER = 5;
    if (allTokens.length > MAX_TOKENS_PER_USER) {
        functions.logger.warn(`collectPushTokensForUid: ${ownerUid} has ${allTokens.length} tokens, capping to ${MAX_TOKENS_PER_USER}`);
    }
    return allTokens.slice(0, MAX_TOKENS_PER_USER);
}

/**
 * Cleanup invalid Expo/FCM push tokens from both V3 and legacy collections.
 */
export async function cleanupInvalidPushTokens(tokens: string[]): Promise<void> {
    const uniqueTokens = Array.from(new Set(tokens));
    if (uniqueTokens.length === 0) return;

    const refsToDelete: admin.firestore.DocumentReference[] = [];
    const IN_QUERY_LIMIT = 30;
    const BATCH_SIZE = 450;

    for (let i = 0; i < uniqueTokens.length; i += IN_QUERY_LIMIT) {
        const chunk = uniqueTokens.slice(i, i + IN_QUERY_LIMIT);

        // Legacy root docs: fcm_tokens/{uid}
        try {
            const legacyRootSnap = await db.collection('fcm_tokens').where('token', 'in', chunk).get();
            legacyRootSnap.docs.forEach(doc => refsToDelete.push(doc.ref));
        } catch (error) {
            functions.logger.warn('Invalid Expo token cleanup (fcm_tokens root) query failed:', error);
        }

        // Subcollection docs: push_tokens/{uid}/devices/* and fcm_tokens/{uid}/devices/*
        try {
            const devicesSnap = await db.collectionGroup('devices').where('token', 'in', chunk).limit(100).get();
            devicesSnap.docs.forEach(doc => {
                const rootCollection = doc.ref.parent.parent?.parent?.id;
                if (rootCollection === 'push_tokens' || rootCollection === 'fcm_tokens') {
                    refsToDelete.push(doc.ref);
                }
            });
        } catch (error) {
            functions.logger.warn('Invalid Expo token cleanup (devices collectionGroup) query failed:', error);
        }
    }

    if (refsToDelete.length === 0) return;

    for (let i = 0; i < refsToDelete.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = refsToDelete.slice(i, i + BATCH_SIZE);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
    }

    functions.logger.info(`Cleaned up ${refsToDelete.length} invalid Expo push token docs (from ${uniqueTokens.length} unique invalid tokens)`);
}

/**
 * Cleanup invalid native FCM tokens from fcm_tokens collection.
 */
export async function cleanupInvalidTokens(
    tokens: string[],
    responses: admin.messaging.SendResponse[]
): Promise<void> {
    const invalidTokens: string[] = [];

    responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(tokens[idx]);
        }
    });

    if (invalidTokens.length === 0) return;

    // FIX #3: Batch query instead of N+1 — query all invalid tokens at once
    // Firestore `in` operator supports up to 30 values per query
    const IN_QUERY_LIMIT = 30;
    const BATCH_SIZE = 450;
    const allDocsToDelete: admin.firestore.DocumentReference[] = [];

    for (let i = 0; i < invalidTokens.length; i += IN_QUERY_LIMIT) {
        const chunk = invalidTokens.slice(i, i + IN_QUERY_LIMIT);
        try {
            const snapshot = await db.collection('fcm_tokens')
                .where('token', 'in', chunk)
                .get();
            snapshot.docs.forEach(doc => allDocsToDelete.push(doc.ref));
        } catch (error) {
            functions.logger.warn('Token cleanup query failed for chunk:', error);
        }
    }

    // Delete in chunked batches to respect 500 limit
    for (let i = 0; i < allDocsToDelete.length; i += BATCH_SIZE) {
        const batchChunk = allDocsToDelete.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        batchChunk.forEach(ref => batch.delete(ref));
        await batch.commit();
    }

    functions.logger.info(`Cleaned up ${allDocsToDelete.length} invalid token docs (from ${invalidTokens.length} invalid tokens)`);
}

/**
 * Haversine distance between two lat/lon points in kilometers.
 */
export function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Alias for backward compatibility
export const calculateDistance = haversineDistance;

/**
 * Normalize a value to a valid Firebase UID string, or return ''.
 */
export function normalizeUid(value: unknown): string {
    if (!isLikelyFirebaseUid(value)) return '';
    return value.trim();
}
