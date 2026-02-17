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
const MAX_PROCESSED_IDS = 300;

let currentUnsubscribe: (() => void) | null = null;
let isListening = false;

/**
 * Start listening for global SOS broadcasts from nearby users.
 * Watches Firestore `sos_broadcasts` collection in real-time.
 */
export async function startNearbySOSListener(myDeviceId: string): Promise<void> {
    if (!myDeviceId) {
        logger.warn('Cannot start nearby SOS listener: no device ID');
        return;
    }

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

        const { collection, onSnapshot, query, where, orderBy } = await import('firebase/firestore');

        const selfIds = new Set<string>();
        selfIds.add(myDeviceId);
        try {
            const { identityService } = await import('../IdentityService');
            const uid = identityService.getUid();
            if (uid) selfIds.add(uid);
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
        );

        currentUnsubscribe = onSnapshot(
            broadcastsQuery,
            (snapshot) => {
                for (const change of snapshot.docChanges()) {
                    if (change.type !== 'added') continue;

                    const broadcastData = change.doc.data();
                    const broadcastId = change.doc.id;
                    if (!broadcastData || broadcastData.status !== 'active') continue;

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
                        if (first) processedBroadcastIds.delete(first);
                    }

                    // Skip broadcasts without valid location
                    const hasLocation = broadcastData.hasLocation !== false;
                    const lat = broadcastData.latitude;
                    const lng = broadcastData.longitude;
                    if (!hasLocation || typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) {
                        logger.debug(`Nearby SOS broadcast ${broadcastId} has no valid location — skipping map marker`);
                        continue;
                    }

                    logger.warn(`🚨 NEARBY SOS RECEIVED from ${broadcastData.senderName || broadcastData.senderDeviceId}!`);

                    // Add to SOS store for map marker display
                    saveBroadcastToStore(broadcastId, broadcastData);

                    // Show critical notification
                    showNearbySosNotification(broadcastData).catch((err) => {
                        logger.error('Failed to show nearby SOS notification:', err);
                    });
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
    if (currentUnsubscribe) {
        try {
            currentUnsubscribe();
        } catch {
            // no-op
        }
        currentUnsubscribe = null;
    }
    isListening = false;
    processedBroadcastIds.clear();
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
            healthInfo: data.healthInfo || undefined,
        });
    } catch (error) {
        logger.error('Failed to save nearby SOS broadcast to store:', error);
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
