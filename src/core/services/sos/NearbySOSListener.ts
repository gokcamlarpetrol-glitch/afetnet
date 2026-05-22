/**
 * NEARBY SOS LISTENER - ELITE V1
 * Real-time listener for global SOS broadcasts from ANY nearby user.
 *
 * HOW IT WORKS:
 * 1. SOSChannelRouter.broadcastToNearbyUsers → writes to `sos_broadcasts/{signalId}`
 * 2. Cloud Function `onSOSBroadcast` sends push to nearby users (50km radius)
 * 3. THIS listener watches `sos_broadcasts` via onSnapshot for real-time updates
 * 4. When a new broadcast arrives → adds to incomingSOSAlerts store → map marker
 *
 * WHY NEEDED:
 * - Push notifications may be delayed or blocked
 * - Firestore onSnapshot is instant when app is foreground
 * - Works with any network (WiFi, cellular, mesh fallback)
 *
 * LIFECYCLE:
 * - Started by familyStore.initialize() after device doc is created
 * - Stopped by familyStore.clear()
 */

import { createLogger } from '../../utils/logger';
import { normalizeTimestampMs } from '../../utils/dateUtils';

const logger = createLogger('NearbySOSListener');

// Track processed broadcast IDs to avoid duplicates
const processedBroadcastIds = new Set<string>();
const alertedBroadcastIds = new Set<string>();
const MAX_PROCESSED_IDS = 300;
const SOS_RADIUS_KM = 50;
const RECEIVER_LOCATION_MAX_AGE_MS = 15 * 60 * 1000;

let currentUnsubscribe: (() => void) | null = null;
let isListening = false;

// Retry state for automatic recovery after onSnapshot errors
let nearbyRetryCount = 0;
const NEARBY_MAX_RETRIES = 10;
let nearbyRetryTimer: ReturnType<typeof setTimeout> | null = null;
let lastMyDeviceId: string | null = null;

/**
 * Start listening for global SOS broadcasts from nearby users.
 * Watches Firestore `sos_broadcasts` collection in real-time.
 */
export async function startNearbySOSListener(myDeviceId: string): Promise<void> {
    if (!myDeviceId) {
        logger.warn('Cannot start nearby SOS listener: no device ID');
        return;
    }

    lastMyDeviceId = myDeviceId;
    nearbyRetryCount = 0; // Reset retry count on fresh start

    // Already listening — skip
    if (isListening && currentUnsubscribe) {
        return;
    }

    // Cleanup any previous listener
    stopNearbySOSListener();

    try {
        const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
        const db = await getFirestoreInstanceAsync();
        if (!db) {
            logger.warn('Nearby SOS listener skipped: Firestore unavailable');
            return;
        }

        const { collection, onSnapshot, query, where, orderBy, limit } = await import('firebase/firestore');

        const selfIds = new Set<string>();
        selfIds.add(myDeviceId);
        try {
            const { identityService } = await import('../IdentityService');
            const uid = identityService.getUid();
            if (uid) selfIds.add(uid);
        } catch {
            // best effort
        }
        try {
            const { getInstallationId } = await import('../../../lib/installationId');
            const installId = await getInstallationId().catch(() => '');
            if (installId) selfIds.add(installId);
        } catch {
            // best effort
        }

        // Listen for active SOS broadcasts from the last 30 minutes
        const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

        const broadcastsRef = collection(db, 'sos_broadcasts');
        const broadcastsQuery = query(
            broadcastsRef,
            where('timestamp', '>', thirtyMinutesAgo),
            orderBy('timestamp', 'desc'),
            limit(50),
        );

        currentUnsubscribe = onSnapshot(
            broadcastsQuery,
            (snapshot) => {
                for (const change of snapshot.docChanges()) {
                    const broadcastData = change.doc.data();
                    const broadcastId = change.doc.id;
                    if (!broadcastData) continue;

                    // Handle cancellations: remove from map + dismiss fullscreen alert + notify user
                    if (change.type === 'modified' && broadcastData.status === 'cancelled') {
                        const cancelSignalId = broadcastData.signalId || broadcastId;
                        try {
                            const { useSOSStore } = require('./SOSStateManager');
                            useSOSStore.getState().removeIncomingSOSAlertBySignalId?.(cancelSignalId);
                        } catch { /* best effort */ }

                        const wasShownLocally =
                            alertedBroadcastIds.has(broadcastId) ||
                            alertedBroadcastIds.has(cancelSignalId);

                        if (wasShownLocally) {
                            // CRITICAL: Dismiss fullscreen alert — without this, nearby SOS cancel
                            // leaves the receiver staring at an active emergency screen forever.
                            try {
                                const { DeviceEventEmitter } = require('react-native');
                                DeviceEventEmitter.emit('SOS_FULLSCREEN_CANCEL', { signalId: cancelSignalId });
                                logger.info(`SOS cancelled + fullscreen dismissed: ${broadcastId}`);
                            } catch { /* best effort */ }

                            // Show cancellation notification only if this device previously showed the SOS.
                            showSOSCancelledNotification(broadcastData, cancelSignalId).catch(() => {});
                        }
                        continue;
                    }

                    if (change.type !== 'added') continue;
                    if (broadcastData.status !== 'active') continue;

                    // Skip already processed
                    if (processedBroadcastIds.has(broadcastId)) continue;

                    // Skip if sender is THIS device
                    const senderDeviceId = typeof broadcastData.senderDeviceId === 'string'
                        ? broadcastData.senderDeviceId
                        : '';
                    const senderUid = typeof broadcastData.senderUid === 'string'
                        ? broadcastData.senderUid
                        : (typeof broadcastData.userId === 'string' ? broadcastData.userId : '');
                    if ((senderDeviceId && selfIds.has(senderDeviceId)) || (senderUid && selfIds.has(senderUid))) {
                        continue;
                    }

                    // Skip very old broadcasts (> 30 minutes)
                    const normalizedTimestamp = normalizeTimestampMs(broadcastData?.timestamp) ?? 0;
                    const broadcastAge = Date.now() - normalizedTimestamp;
                    if (broadcastAge > 30 * 60 * 1000) {
                        processedBroadcastIds.add(broadcastId);
                        continue;
                    }

                    processedBroadcastIds.add(broadcastId);

                    // Evict oldest entries to prevent memory leak
                    if (processedBroadcastIds.size > MAX_PROCESSED_IDS) {
                        const first = processedBroadcastIds.values().next().value;
                        if (first) {
                            processedBroadcastIds.delete(first);
                            alertedBroadcastIds.delete(first);
                        }
                    }

                    // Skip broadcasts without valid location
                    const hasLocation = broadcastData.hasLocation !== false;
                    const lat = broadcastData.latitude;
                    const lng = broadcastData.longitude;
                    if (!hasLocation || typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) {
                        logger.debug(`Nearby SOS broadcast ${broadcastId} has no valid location — skipping map marker`);
                        continue;
                    }

                    processNearbyBroadcastIfEligible(broadcastId, broadcastData, lat, lng)
                        .catch((error) => logger.warn(`Nearby SOS proximity check failed for ${broadcastId}:`, error));
                }
            },
            (error: any) => {
                const errorCode = error?.code || '';
                const errorMessage = error?.message || '';

                if (
                    errorCode === 'permission-denied' ||
                    errorMessage.includes('permission') ||
                    errorMessage.includes('Missing or insufficient permissions')
                ) {
                    if (__DEV__) {
                        logger.debug('Nearby SOS listener permission denied (offline-first mode — OK)');
                    }
                    return;
                }

                logger.error('Nearby SOS listener error:', error);

                // Retry with exponential backoff (2s, 4s, 8s, 16s, 30s max)
                if (nearbyRetryCount < NEARBY_MAX_RETRIES && lastMyDeviceId) {
                    nearbyRetryCount++;
                    const delay = Math.min(2000 * Math.pow(2, nearbyRetryCount - 1), 30000);
                    logger.info(`Nearby SOS listener retry ${nearbyRetryCount}/${NEARBY_MAX_RETRIES} in ${delay}ms`);
                    if (nearbyRetryTimer) clearTimeout(nearbyRetryTimer);
                    const capturedDeviceId = lastMyDeviceId; // Capture BEFORE stop nulls it
                    nearbyRetryTimer = setTimeout(() => {
                        nearbyRetryTimer = null;
                        if (capturedDeviceId) {
                            stopNearbySOSListener();
                            startNearbySOSListener(capturedDeviceId).catch((e) => {
                                logger.error('Nearby SOS listener retry failed:', e);
                            });
                        }
                    }, delay);
                } else if (nearbyRetryCount >= NEARBY_MAX_RETRIES && lastMyDeviceId) {
                    // LIFE-SAFETY REVIVAL: Schedule revival after 10 minutes (same as SOSAlertListener)
                    // CRITICAL FIX: 10 min revival delay was unacceptable for life-safety.
                    // SOSAlertListener uses 30s — NearbySOSListener must match.
                    logger.error('⚠️ NearbySOSListener exhausted retries — scheduling revival in 30s');
                    if (nearbyRetryTimer) clearTimeout(nearbyRetryTimer);
                    const capturedDeviceIdRevival = lastMyDeviceId; // Capture BEFORE stop nulls it
                    nearbyRetryTimer = setTimeout(() => {
                        nearbyRetryTimer = null;
                        nearbyRetryCount = 0;
                        if (capturedDeviceIdRevival) {
                            stopNearbySOSListener();
                            startNearbySOSListener(capturedDeviceIdRevival).catch((e) => {
                                logger.error('NearbySOSListener revival failed:', e);
                            });
                        }
                    }, 30_000);
                }
            },
        );

        isListening = true;
        logger.info(`✅ Nearby SOS listener started (device: ${myDeviceId})`);
    } catch (error) {
        logger.error('Failed to start nearby SOS listener:', error);
    }
}

/**
 * Stop the nearby SOS listener.
 */
export function stopNearbySOSListener(): void {
    if (nearbyRetryTimer) {
        clearTimeout(nearbyRetryTimer);
        nearbyRetryTimer = null;
    }
    if (currentUnsubscribe) {
        try {
            currentUnsubscribe();
        } catch {
            // no-op
        }
        currentUnsubscribe = null;
    }
    isListening = false;
    lastMyDeviceId = null; // Prevent stale retry timer callbacks from restarting listener after logout
    // DO NOT clear processedBroadcastIds on stop — they are needed to prevent
    // duplicate SOS notifications when the listener restarts (onSnapshot fires initial snapshot).
    // IDs will be naturally evicted by the MAX_PROCESSED_IDS cap.
}

/**
 * KRİTİK (görev #26): Logout / hesap değişiminde dedup setlerini temizle.
 * processedBroadcastIds process-global ve stop sırasında bilinçli korunuyor;
 * bunun çıkış yolunda temizlenmemesi B kullanıcısının bir SOS yayınını,
 * A kullanıcısı aynı broadcastId'yi işlediği için sessizce düşürmesine yol
 * açar. SOSAlertListener.clearSOSAlertDedup() ile birebir aynı amaç.
 */
export function clearNearbySOSDedup(): void {
    processedBroadcastIds.clear();
    alertedBroadcastIds.clear();
}

function toRad(value: number): number {
    return value * Math.PI / 180;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveReceiverLocation(): Promise<{ latitude: number; longitude: number; timestamp: number } | null> {
    try {
        const { locationService } = await import('../LocationService');
        const local = locationService.getCurrentLocation?.();
        if (
            local &&
            Number.isFinite(local.latitude) &&
            Number.isFinite(local.longitude) &&
            Date.now() - local.timestamp <= RECEIVER_LOCATION_MAX_AGE_MS
        ) {
            return {
                latitude: local.latitude,
                longitude: local.longitude,
                timestamp: local.timestamp,
            };
        }
    } catch {
        // fall back to Firestore cached current location
    }

    try {
        const { identityService } = await import('../IdentityService');
        const uid = identityService.getUid();
        if (!uid) return null;

        const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
        const db = await getFirestoreInstanceAsync();
        if (!db) return null;

        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'locations_current', uid));
        if (!snap.exists()) return null;
        const data = snap.data();
        const latitude = data?.latitude;
        const longitude = data?.longitude;
        const timestamp = normalizeTimestampMs(data?.timestamp || data?.updatedAt) ?? 0;
        if (
            typeof latitude === 'number' &&
            typeof longitude === 'number' &&
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            timestamp > 0 &&
            Date.now() - timestamp <= RECEIVER_LOCATION_MAX_AGE_MS
        ) {
            return { latitude, longitude, timestamp };
        }
    } catch {
        // no trusted local position available
    }

    return null;
}

async function processNearbyBroadcastIfEligible(
    broadcastId: string,
    broadcastData: any,
    sosLat: number,
    sosLng: number,
): Promise<void> {
    const receiverLocation = await resolveReceiverLocation();
    if (!receiverLocation) {
        logger.debug(`Nearby SOS ${broadcastId} skipped: receiver location unavailable/stale`);
        return;
    }

    const distanceKm = haversineDistanceKm(
        receiverLocation.latitude,
        receiverLocation.longitude,
        sosLat,
        sosLng,
    );

    if (!Number.isFinite(distanceKm) || distanceKm > SOS_RADIUS_KM) {
        logger.debug(`Nearby SOS ${broadcastId} skipped: ${Math.round(distanceKm)}km away`);
        return;
    }

    alertedBroadcastIds.add(broadcastId);
    const signalId = broadcastData.signalId || broadcastId;
    if (signalId) alertedBroadcastIds.add(signalId);

    logger.warn(`🚨 NEARBY SOS RECEIVED (${distanceKm.toFixed(1)}km) from ${broadcastData.senderName || broadcastData.senderDeviceId}!`);

    // ELITE: Direct foreground full-screen alert — bypasses notification pipeline.
    // Same pattern as SOSAlertListener: emit directly when app is in foreground.
    let fullScreenEmitted = false;
    try {
        const { AppState, DeviceEventEmitter } = require('react-native');
        if (AppState.currentState === 'active') {
            DeviceEventEmitter.emit('SOS_FULLSCREEN_ALERT', {
                signalId,
                senderUid: broadcastData.senderUid || broadcastData.userId,
                senderDeviceId: broadcastData.senderDeviceId,
                senderName: broadcastData.senderName || 'Yakındaki Kullanıcı',
                message: broadcastData.message || 'Acil yardım gerekiyor!',
                latitude: broadcastData.latitude,
                longitude: broadcastData.longitude,
                trapped: !!broadcastData.trapped,
                battery: broadcastData.battery ? Number(broadcastData.battery) : undefined,
            });
            fullScreenEmitted = true;
            logger.info('Nearby SOS FULLSCREEN ALERT emitted for foreground app');
        }
    } catch { /* DeviceEventEmitter not available — notification below handles it */ }

    // Add to SOS store for map marker display
    saveBroadcastToStore(broadcastId, broadcastData);

    // Show critical notification only if full-screen alert was NOT shown
    // (prevents duplicate alarm sounds + confusing dual alerts in foreground)
    if (!fullScreenEmitted) {
        showNearbySosNotification(broadcastData).catch((err) => {
            logger.error('Failed to show nearby SOS notification:', err);
        });
    }
}

/**
 * Save incoming SOS broadcast to the SOS store for map marker display.
 */
function saveBroadcastToStore(broadcastId: string, data: any): void {
    try {
        const { useSOSStore } = require('./SOSStateManager');

        useSOSStore.getState().addIncomingSOSAlert({
            id: broadcastId,
            signalId: data.signalId || broadcastId,
            senderDeviceId: data.senderDeviceId || '',
            senderUid: typeof data.senderUid === 'string'
                ? data.senderUid
                : (typeof data.userId === 'string' ? data.userId : undefined),
            senderName: data.senderName || 'Yakındaki Kullanıcı',
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: normalizeTimestampMs(data?.timestamp) ?? Date.now(),
            message: data.message || 'Acil yardım gerekiyor!',
            trapped: !!data.trapped,
            battery: data.battery,
        });
    } catch (error) {
        logger.error('Failed to save nearby SOS broadcast to store:', error);
    }
}

/**
 * Show notification when a nearby SOS is cancelled.
 */
async function showSOSCancelledNotification(data: any, signalId: string): Promise<void> {
    try {
        const { notificationCenter } = await import('../notifications/NotificationCenter');
        const senderName = data.senderName || 'Yakındaki Kullanıcı';

        // Use 'system' category (not 'sos') to prevent triggering false SOS full-screen alert
        // for a CANCELLATION notification. Matches SOSAlertListener pattern.
        // ADV: `as any` is intentional — NotifyDataMap['system'] is loosely typed
        // for ad-hoc system notifications; tightening would force a tagged-union
        // refactor across every notify() call site (low value vs effort).
        await notificationCenter.notify('system', {
            subtype: 'generic',
            title: `SOS İptal: ${senderName}`,
            message: `${senderName} SOS çağrısını iptal etti`,
        } as any, 'NearbySOSListener');
    } catch {
        // best effort
    }
}

/**
 * Show a critical notification when a nearby SOS broadcast is received.
 */
async function showNearbySosNotification(data: any): Promise<void> {
    try {
        const { notificationCenter } = await import('../notifications/NotificationCenter');

        const senderName = data.senderName || 'Yakındaki Kullanıcı';

        await notificationCenter.notify('sos_received', {
            from: senderName,
            senderName,
            senderId: data.senderUid || data.senderDeviceId,
            signalId: data.signalId,
            message: data.trapped
                ? `${senderName} enkaz altında! Acil yardım gerekiyor!`
                : (data.message || 'Yakınında biri acil yardım istiyor!'),
            location: Number.isFinite(Number(data.latitude)) && Number.isFinite(Number(data.longitude))
                ? {
                    latitude: Number(data.latitude),
                    longitude: Number(data.longitude),
                }
                : undefined,
            timestamp: normalizeTimestampMs(data?.timestamp) ?? Date.now(),
        }, 'NearbySOSListener');

        logger.info(`✅ Nearby SOS notification shown for broadcast from ${senderName}`);
    } catch (error) {
        logger.error('Failed to show nearby SOS notification:', error);
    }
}
