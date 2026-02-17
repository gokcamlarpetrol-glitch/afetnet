/**
 * SOS ALERT LISTENER - ELITE V4
 * Real-time listener for incoming SOS alerts from family members.
 *
 * HOW IT WORKS:
 * 1. SOSChannelRouter.broadcastToFamily → writes to `devices/{targetDeviceId}/sos_alerts/{signalId}`
 * 2. This listener watches MY device's `sos_alerts` subcollection via onSnapshot
 * 3. When a new alert arrives → shows critical notification + navigates to SOS conversation
 *
 * LIFECYCLE:
 * - Started by familyStore.initialize() when device ID is available
 * - Stopped by familyStore.clear() or when device ID changes
 */

import { createLogger } from '../../utils/logger';
import { normalizeTimestampMs } from '../../utils/dateUtils';

const logger = createLogger('SOSAlertListener');

// Track processed alert IDs to avoid duplicate notifications on hot-reload
const processedAlertIds = new Set<string>();
const MAX_PROCESSED_IDS = 200;

let currentUnsubscribe: (() => void) | null = null;
let isListening = false;

/**
 * Process a single SOS alert document — shared by legacy and V3 listeners.
 * Uses processedAlertIds for dedup (prevents double notification from dual-path).
 */
function processSOSAlert(alertId: string, alertData: any): void {
    // CRITICAL: Skip self-sent SOS alerts — sender should NOT receive their own notification
    try {
        const { identityService } = require('../IdentityService');
        const myUid = identityService.getUid();
        const myId = identityService.getMyId?.();
        const selfIds = new Set<string>();
        if (myUid) selfIds.add(myUid);
        if (myId) selfIds.add(myId);
        const senderUid = alertData?.senderUid || alertData?.userId;
        const senderDeviceId = alertData?.senderDeviceId;
        if ((senderUid && selfIds.has(senderUid)) || (senderDeviceId && selfIds.has(senderDeviceId))) {
            processedAlertIds.add(alertId);
            return;
        }
    } catch { /* IdentityService not ready — allow alert through to be safe */ }

    // Skip already processed alerts (prevents duplicate on hot-reload or dual-path)
    if (processedAlertIds.has(alertId)) return;

    // Skip very old alerts (older than 30 minutes)
    const normalizedTimestamp = normalizeTimestampMs(alertData?.timestamp) ?? 0;
    const alertAge = Date.now() - normalizedTimestamp;
    if (alertAge > 30 * 60 * 1000) {
        processedAlertIds.add(alertId);
        return;
    }

    processedAlertIds.add(alertId);

    // Evict oldest entries to prevent memory leak
    if (processedAlertIds.size > MAX_PROCESSED_IDS) {
        const first = processedAlertIds.values().next().value;
        if (first) processedAlertIds.delete(first);
    }

    logger.warn(`🚨 SOS ALERT RECEIVED from ${alertData.senderName || alertData.senderDeviceId}!`);

    // Fire critical notification
    showSOSReceivedNotification(alertData).catch((err) => {
        logger.error('Failed to show SOS notification:', err);
    });

    // Save to SOS store for map marker display
    saveAlertToStore(alertId, alertData);
}

/**
 * Handle listener errors — shared by legacy and V3 listeners.
 * Permission-denied is expected during offline-first mode.
 */
function handleListenerError(error: any, listenerLabel: string): void {
    const errorCode = error?.code || '';
    const errorMessage = error?.message || '';

    if (
        errorCode === 'permission-denied' ||
        errorMessage.includes('permission') ||
        errorMessage.includes('Missing or insufficient permissions')
    ) {
        if (__DEV__) {
            logger.debug(`SOS alert listener permission denied for ${listenerLabel} (offline-first mode — OK)`);
        }
        return;
    }

    logger.error(`SOS alert listener error for ${listenerLabel}:`, error);
}

/**
 * Start listening for SOS alerts on this device's Firestore path.
 * Safe to call multiple times — will no-op if already listening for the same device.
 */
export async function startSOSAlertListener(myDeviceId: string): Promise<void> {
    if (!myDeviceId) {
        logger.warn('Cannot start SOS alert listener: no device ID');
        return;
    }

    // Already listening — skip
    if (isListening && currentUnsubscribe) {
        return;
    }

    // Cleanup any previous listener
    stopSOSAlertListener();

    try {
        // SINGLE ID ARCHITECTURE: Listen on only the unified ID
        // IdentityService now ensures identity.id = identity.deviceId = getDeviceId()
        const allTargetIds = new Set<string>();
        allTargetIds.add(myDeviceId);

        // Add UID for comprehensive SOS routing
        try {
            const { identityService } = await import('../IdentityService');
            const uid = identityService.getUid();
            if (uid) {
                allTargetIds.add(uid);
            }
        } catch {
            // Identity not available yet — listen on passed ID only
        }

        const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
        const db = await getFirestoreInstanceAsync();
        if (!db) {
            logger.warn('SOS alert listener skipped: Firestore unavailable');
            return;
        }

        const { collection, onSnapshot, query, where, orderBy } = await import('firebase/firestore');

        // Create listeners for each target ID
        const unsubscribers: (() => void)[] = [];

        for (const targetId of allTargetIds) {
            // === Legacy Listener: devices/{targetId}/sos_alerts ===
            try {
                const alertsRef = collection(db, 'devices', targetId, 'sos_alerts');

                // Only listen for active alerts (not resolved/cancelled)
                const alertsQuery = query(
                    alertsRef,
                    where('status', '==', 'active'),
                    orderBy('timestamp', 'desc'),
                );

                const unsub = onSnapshot(
                    alertsQuery,
                    (snapshot) => {
                        for (const change of snapshot.docChanges()) {
                            if (change.type !== 'added') continue;
                            processSOSAlert(change.doc.id, change.doc.data());
                        }
                    },
                    (error: any) => {
                        handleListenerError(error, `legacy:${targetId}`);
                    },
                );

                unsubscribers.push(unsub);
            } catch (err) {
                logger.warn(`Failed to start legacy SOS listener for targetId ${targetId}:`, err);
            }

            // === V3 Listener: sos_alerts/{targetId}/items ===
            try {
                const v3AlertsRef = collection(db, 'sos_alerts', targetId, 'items');

                const v3AlertsQuery = query(
                    v3AlertsRef,
                    where('status', '==', 'active'),
                    orderBy('timestamp', 'desc'),
                );

                const v3Unsub = onSnapshot(
                    v3AlertsQuery,
                    (snapshot) => {
                        for (const change of snapshot.docChanges()) {
                            if (change.type !== 'added') continue;
                            processSOSAlert(change.doc.id, change.doc.data());
                        }
                    },
                    (error: any) => {
                        handleListenerError(error, `v3:${targetId}`);
                    },
                );

                unsubscribers.push(v3Unsub);
            } catch (err) {
                logger.warn(`Failed to start V3 SOS listener for targetId ${targetId}:`, err);
            }
        }

        // Combine all unsubscribers
        currentUnsubscribe = () => {
            unsubscribers.forEach(unsub => {
                try { unsub(); } catch { /* no-op */ }
            });
        };

        isListening = true;
        logger.info(`✅ SOS alert listener started for ${allTargetIds.size} target IDs: ${Array.from(allTargetIds).join(', ')}`);
    } catch (error) {
        logger.error('Failed to start SOS alert listener:', error);
    }
}

/**
 * Stop the SOS alert listener.
 */
export function stopSOSAlertListener(): void {
    if (currentUnsubscribe) {
        try {
            currentUnsubscribe();
        } catch {
            // no-op
        }
        currentUnsubscribe = null;
    }
    isListening = false;
    processedAlertIds.clear();
}

/**
 * Show a critical notification when an SOS alert is received from a family member.
 */
async function showSOSReceivedNotification(alertData: any): Promise<void> {
    try {
        const { notificationCenter } = await import('../notifications/NotificationCenter');

        const senderName = alertData.senderName || 'Aile Üyesi';

        await notificationCenter.notify('sos_received', {
            from: senderName,
            senderName,
            senderId: alertData.senderUid || alertData.senderDeviceId,
            signalId: alertData.signalId,
            message: alertData.trapped
                ? `${senderName} enkaz altında! Acil yardım gerekiyor!`
                : (alertData.message || 'Acil yardım gerekiyor!'),
            location: alertData.location ? {
                latitude: alertData.location.latitude,
                longitude: alertData.location.longitude,
            } : undefined,
            timestamp: normalizeTimestampMs(alertData?.timestamp) ?? Date.now(),
        }, 'SOSAlertListener');

        logger.info(`✅ SOS notification shown for alert from ${senderName}`);
    } catch (error) {
        logger.error('Failed to show SOS received notification:', error);
    }
}

/**
 * Save incoming SOS alert to the SOS store for map marker display.
 */
function saveAlertToStore(alertId: string, alertData: any): void {
    try {
        // Dynamic import to avoid circular dependencies
        const { useSOSStore } = require('./SOSStateManager');

        const lat = alertData.location?.latitude;
        const lng = alertData.location?.longitude;

        // Only save if we have valid coordinates
        if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) {
            logger.warn('Incoming SOS alert has no valid location — skipping map marker');
            return;
        }

        useSOSStore.getState().addIncomingSOSAlert({
            id: alertId,
            signalId: alertData.signalId || alertId,
            senderDeviceId: alertData.senderDeviceId || '',
            senderUid: typeof alertData.senderUid === 'string'
                ? alertData.senderUid
                : (typeof alertData.userId === 'string' ? alertData.userId : undefined),
            senderName: alertData.senderName || 'Aile Üyesi',
            latitude: lat,
            longitude: lng,
            timestamp: normalizeTimestampMs(alertData?.timestamp) ?? Date.now(),
            message: alertData.message || 'Acil yardım gerekiyor!',
            trapped: !!alertData.trapped,
            battery: alertData.battery,
            healthInfo: alertData.healthInfo || undefined,
        });
    } catch (error) {
        logger.error('Failed to save SOS alert to store:', error);
    }
}
