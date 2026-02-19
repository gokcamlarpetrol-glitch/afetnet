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
    // Bug #23: Add alertId to processedAlertIds at the START to prevent duplicate processing
    if (processedAlertIds.has(alertId)) return;
    processedAlertIds.add(alertId);

    // Evict oldest entries in batch to prevent unbounded memory growth
    if (processedAlertIds.size >= MAX_PROCESSED_IDS) {
        const toEvict = Math.max(5, Math.floor(MAX_PROCESSED_IDS * 0.1));
        const iter = processedAlertIds.values();
        for (let i = 0; i < toEvict; i++) {
            const val = iter.next().value;
            if (val) processedAlertIds.delete(val);
        }
    }

    // CRITICAL: Skip self-sent SOS alerts — sender should NOT receive their own notification
    try {
        const { identityService } = require('../IdentityService');
        const selfIds = new Set<string>();

        // Collect ALL identity forms for robust self-detection
        const uid = identityService.getUid();
        const myId = identityService.getMyId?.();
        const publicCode = identityService.getPublicUserCode?.();
        if (uid) selfIds.add(uid);
        if (myId) selfIds.add(myId);
        if (publicCode) selfIds.add(publicCode);

        // Also check Firebase Auth UID directly (in case IdentityService hasn't synced)
        try {
            const { getAuth } = require('firebase/auth');
            const authUid = getAuth()?.currentUser?.uid;
            if (authUid) selfIds.add(authUid);
        } catch { /* auth not ready */ }

        // Check ALL sender identity fields from the alert
        const senderIds = [
            alertData?.senderUid,
            alertData?.userId,
            alertData?.senderDeviceId,
            alertData?.creatorUid,
        ].filter(Boolean) as string[];

        if (senderIds.some(id => selfIds.has(id))) {
            return;
        }
    } catch { /* IdentityService not ready — allow alert through to be safe */ }

    // Skip very old alerts (older than 30 minutes)
    const normalizedTimestamp = normalizeTimestampMs(alertData?.timestamp) ?? 0;
    const alertAge = Date.now() - normalizedTimestamp;
    if (alertAge > 30 * 60 * 1000) {
        return;
    }

    // Handle cancellation signals — show "SOS cancelled" notification and remove from store
    if (alertData.status === 'cancelled') {
        logger.info(`✅ SOS CANCELLED by ${alertData.senderName || alertData.senderDeviceId}`);
        showSOSCancelledNotification(alertData).catch((err) => {
            logger.error('Failed to show SOS cancellation notification:', err);
        });
        // Remove the original active alert from SOS store (map markers)
        // Cancellation signalId has 'cancel-' prefix — strip it to match the original
        try {
            const { useSOSStore } = require('./SOSStateManager');
            const rawSignalId = alertData.signalId || '';
            const originalSignalId = rawSignalId.startsWith('cancel-')
                ? rawSignalId.slice(7)
                : rawSignalId;
            if (originalSignalId) {
                useSOSStore.getState().removeIncomingSOSAlertBySignalId(originalSignalId);
            }
        } catch { /* store not available */ }
        return;
    }

    logger.warn(`🚨 SOS ALERT RECEIVED from ${alertData.senderName || alertData.senderDeviceId}!`);

    // ELITE FIX: Direct foreground full-screen alert — bypasses notification pipeline entirely.
    // The notification chain (notify → deliver → scheduleNotification → addNotificationReceivedListener
    // → DeviceEventEmitter) is fragile on iOS. Instead, emit directly when app is in foreground.
    try {
        const { AppState, DeviceEventEmitter } = require('react-native');
        if (AppState.currentState === 'active') {
            const senderName = alertData.senderName || 'Aile Üyesi';
            const message = alertData.message || 'Acil yardım gerekiyor!';
            DeviceEventEmitter.emit('SOS_FULLSCREEN_ALERT', {
                signalId: alertData.signalId || alertId,
                senderUid: alertData.senderUid || alertData.userId,
                senderDeviceId: alertData.senderDeviceId,
                senderName,
                message,
                latitude: alertData.location?.latitude,
                longitude: alertData.location?.longitude,
                trapped: alertData.trapped === true || alertData.trapped === 'true',
                battery: alertData.battery ? Number(alertData.battery) : undefined,
                healthInfo: alertData.healthInfo && typeof alertData.healthInfo === 'object'
                    ? alertData.healthInfo
                    : undefined,
            });
            logger.info(`📱 SOS FULLSCREEN ALERT emitted directly for foreground app`);
        }
    } catch { /* DeviceEventEmitter not available — notification pipeline below handles it */ }

    // Fire critical notification (push banner + sound — also works for background/killed)
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
// CRITICAL FIX: Track retry state for SOS listener recovery
let sosRetryCount = 0;
const SOS_MAX_RETRIES = 10;
let sosRetryTimer: ReturnType<typeof setTimeout> | null = null;
let lastDeviceId: string | null = null;

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

    // CRITICAL FIX: Retry with exponential backoff (like GroupChatService)
    if (sosRetryCount < SOS_MAX_RETRIES && lastDeviceId) {
        sosRetryCount++;
        const delay = Math.min(2000 * Math.pow(2, sosRetryCount - 1), 30000);
        logger.info(`🔄 SOS listener retry ${sosRetryCount}/${SOS_MAX_RETRIES} in ${delay}ms`);
        if (sosRetryTimer) clearTimeout(sosRetryTimer);
        sosRetryTimer = setTimeout(() => {
            sosRetryTimer = null;
            if (lastDeviceId) {
                stopSOSAlertListener();
                startSOSAlertListener(lastDeviceId).catch((e) => {
                    logger.error('SOS listener retry failed:', e);
                });
            }
        }, delay);
    }
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
    lastDeviceId = myDeviceId;
    sosRetryCount = 0; // Reset retry count on fresh start

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

                // Listen for active AND cancelled alerts (cancellation must reach recipients)
                const alertsQuery = query(
                    alertsRef,
                    where('status', 'in', ['active', 'cancelled']),
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
                    where('status', 'in', ['active', 'cancelled']),
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
 * Show notification when an SOS alert is cancelled by the sender.
 */
async function showSOSCancelledNotification(alertData: any): Promise<void> {
    try {
        const { notificationCenter } = await import('../notifications/NotificationCenter');
        const senderName = alertData.senderName || 'Aile Üyesi';

        await notificationCenter.notify('system', {
            subtype: 'generic',
            title: `SOS İptal: ${senderName}`,
            message: `${senderName} acil durum çağrısını iptal etti.`,
        } as any, 'SOSAlertListener-cancel');

        logger.info(`✅ SOS cancellation notification shown for ${senderName}`);
    } catch (error) {
        logger.error('Failed to show SOS cancellation notification:', error);
    }
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
            // Pass all fields needed by SOSHelp screen for deep link navigation
            senderUid: alertData.senderUid,
            senderDeviceId: alertData.senderDeviceId,
            signalId: alertData.signalId,
            message: alertData.trapped
                ? `${senderName} enkaz altında! Acil yardım gerekiyor!`
                : (alertData.message || 'Acil yardım gerekiyor!'),
            location: alertData.location ? {
                latitude: alertData.location.latitude,
                longitude: alertData.location.longitude,
            } : undefined,
            trapped: alertData.trapped,
            battery: alertData.battery,
            healthInfo: alertData.healthInfo,
            timestamp: normalizeTimestampMs(alertData?.timestamp) ?? Date.now(),
        } as any, 'SOSAlertListener');

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
