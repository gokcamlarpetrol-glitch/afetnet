/**
 * SOS ACK LISTENER - ELITE V2 (HARDENED)
 * Real-time listener for incoming rescue acknowledgments.
 *
 * HOW IT WORKS:
 * 1. SOSChannelRouter.sendRescueACK → writes to `devices/{sosDeviceId}/sos_acks/{signalId}_{rescuerId}`
 * 2. THIS listener watches that path via onSnapshot
 * 3. When ACK arrives → updates SOSStore → haptic + notification
 *
 * LIFECYCLE:
 * - Started by UnifiedSOSController.activateSOS()
 * - Stopped by UnifiedSOSController.cancelSOS() or stopSOS()
 *
 * SAFETY:
 * - Race-condition guarded via isStarting flag
 * - processedAckIds cleared on stop to prevent memory leaks
 * - No orderBy (avoids Firestore composite index requirement)
 * - All operations wrapped in try/catch — never crashes the SOS flow
 */

import { createLogger } from '../../utils/logger';
import * as haptics from '../../utils/haptics';
import { normalizeTimestampMs } from '../../utils/dateUtils';

const logger = createLogger('SOSAckListener');

// Deduplication: skip ACKs we've already processed
const processedAckIds = new Set<string>();
const MAX_PROCESSED_IDS = 200;

let currentUnsubscribe: (() => void) | null = null;
let isListening = false;
let isStarting = false; // Race condition guard
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let revivalTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
let lastDeviceId: string | null = null; // For retry after error
let listenerStartedAt = 0; // Timestamp when listener was started — skip ACKs before this
const MAX_RETRIES = 15;
const MAX_BACKOFF_MS = 60000;
const REVIVAL_INTERVAL_MS = 30_000; // 30 seconds — life-safety: trapped person must know rescue is coming

/**
 * Schedule a retry after listener error (exponential backoff).
 * CRITICAL: For a trapped person, rescue ACKs are life-saving information.
 * After exhausting retries, schedule a revival attempt every 10 minutes.
 */
function scheduleRetry(): void {
    if (retryCount >= MAX_RETRIES) {
        logger.error(`SOSAckListener: exhausted ${MAX_RETRIES} retries — scheduling revival in ${REVIVAL_INTERVAL_MS / 60000}min`);
        scheduleRevival();
        return;
    }
    if (retryTimer) { clearTimeout(retryTimer); }
    retryCount++;
    const delay = Math.min(3000 * Math.pow(2, retryCount - 1), MAX_BACKOFF_MS);
    logger.info(`SOSAckListener: retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
    retryTimer = setTimeout(() => {
        retryTimer = null;
        if (lastDeviceId && !isListening && !isStarting) {
            startSOSAckListener(lastDeviceId).catch(e => {
                logger.error('SOSAckListener retry failed:', e);
            });
        }
    }, delay);
}

/**
 * Revival mechanism: After exhausting all retries, try once every 10 minutes.
 * For a trapped person under rubble, the network may recover after hours.
 * Without revival, rescue ACKs are permanently lost.
 */
function scheduleRevival(): void {
    if (revivalTimer) { clearTimeout(revivalTimer); }
    revivalTimer = setTimeout(() => {
        revivalTimer = null;
        if (lastDeviceId && !isListening && !isStarting) {
            logger.info('SOSAckListener: revival attempt — resetting retry count');
            retryCount = 0; // Reset for fresh retry cycle
            startSOSAckListener(lastDeviceId).catch(e => {
                logger.error('SOSAckListener revival failed:', e);
            });
        }
    }, REVIVAL_INTERVAL_MS);
}

/**
 * Start listening for rescue ACKs on this device's Firestore path.
 * Called when SOS is activated — stops when SOS is cancelled/stopped.
 */
export async function startSOSAckListener(myDeviceId: string): Promise<void> {
    // GUARD 1: No device ID
    if (!myDeviceId) {
        logger.warn('Cannot start ACK listener: no device ID');
        return;
    }

    // GUARD 2: Already listening or starting (race condition prevention)
    if (isListening || isStarting) {
        logger.debug('ACK listener already active or starting — skipping');
        return;
    }

    // Set starting flag IMMEDIATELY to prevent concurrent starts
    isStarting = true;
    lastDeviceId = myDeviceId; // Save for retry

    // Clean up any stale listener
    stopSOSAckListenerInternal(false); // Don't clear processedAckIds on restart

    try {
        const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
        const db = await getFirestoreInstanceAsync();
        if (!db) {
            logger.warn('ACK listener skipped: Firestore unavailable');
            isStarting = false;
            return;
        }

        const { collection, onSnapshot } = await import('firebase/firestore');

        const targetIds = new Set<string>();
        targetIds.add(myDeviceId);
        try {
            const { identityService } = await import('../IdentityService');
            const uid = identityService.getUid();
            if (uid) targetIds.add(uid);
        } catch {
            // best effort
        }

        const unsubscribers: Array<() => void> = [];
        const processAckSnapshot = (snapshot: any) => {
            if (!snapshot || !snapshot.docChanges) return;

            for (const change of snapshot.docChanges()) {
                if (change.type !== 'added') continue;

                const ackData = change.doc.data();
                if (!ackData) continue;

                const ackId = change.doc.id;
                if (processedAckIds.has(ackId)) continue;

                const ackTimestamp = normalizeTimestampMs(ackData.timestamp) ?? 0;
                const ackAge = Date.now() - ackTimestamp;
                // Skip ACKs older than 1 hour
                if (ackAge > 60 * 60 * 1000) {
                    processedAckIds.add(ackId);
                    continue;
                }
                // CRITICAL FIX: Skip ACKs that predate this listener session.
                // onSnapshot fires for ALL existing docs on initial load (type='added').
                // Without this, every app restart replays all recent ACKs as new notifications.
                if (ackTimestamp > 0 && ackTimestamp < listenerStartedAt) {
                    processedAckIds.add(ackId);
                    continue;
                }

                processedAckIds.add(ackId);
                if (processedAckIds.size > MAX_PROCESSED_IDS) {
                    const iterator = processedAckIds.values();
                    const first = iterator.next();
                    if (!first.done && first.value) {
                        processedAckIds.delete(first.value);
                    }
                }

                const rescuerName = typeof ackData.rescuerName === 'string'
                    ? ackData.rescuerName
                    : 'Gönüllü';
                logger.warn(`✅ RESCUE ACK received from ${rescuerName}!`);

                try {
                    const { useSOSStore } = require('./SOSStateManager');
                    const store = useSOSStore.getState();

                    if (store.currentSignal) {
                        const rescuerUid = typeof ackData.rescuerUid === 'string' ? ackData.rescuerUid : '';
                        const rescuerDeviceId = typeof ackData.rescuerDeviceId === 'string' ? ackData.rescuerDeviceId : '';
                        const rescuerRef = rescuerUid || rescuerDeviceId;
                        store.addAck({
                            id: ackId,
                            receiverId: rescuerRef,
                            receiverName: rescuerName,
                            timestamp: ackTimestamp || Date.now(),
                            type: ackData.type === 'on_the_way' ? 'responding' : 'received',
                            distance: undefined,
                        });

                        // P0-2: Rescuer has explicitly ACK'd. Add them to the
                        // health-sharing allowlist so directed HEALTH_SOS packets
                        // can reach them. Both uid and deviceId are added because
                        // BLE peer IDs and Firebase UIDs come from different
                        // namespaces.
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-require-imports
                            const { emergencyHealthSharingService } = require('../EmergencyHealthSharingService');
                            if (rescuerUid) emergencyHealthSharingService.addRescuerPeer(rescuerUid);
                            if (rescuerDeviceId) emergencyHealthSharingService.addRescuerPeer(rescuerDeviceId);
                        } catch (healthError) {
                            if (__DEV__) logger.debug('Failed to register rescuer for health allowlist:', healthError);
                        }
                    }
                } catch (storeError) {
                    logger.error('Failed to update SOS store with ACK:', storeError);
                }

                try {
                    haptics.notificationSuccess();
                } catch {
                    // Haptics non-critical
                }

                showAckNotification(rescuerName).catch((err) => {
                    logger.error('Failed to show ACK notification:', err);
                });
            }
        };

        const handleAckListenerError = (targetId: string, pathLabel: string) => (error: any) => {
            const errorCode = error?.code || '';
            const errorMessage = typeof error?.message === 'string' ? error.message : '';

            if (
                errorCode === 'permission-denied' ||
                errorMessage.includes('permission') ||
                errorMessage.includes('Missing or insufficient permissions')
            ) {
                if (__DEV__) {
                    logger.debug(`ACK listener permission denied for ${pathLabel}:${targetId} (offline-first mode — OK)`);
                }
                return;
            }

            logger.error(`ACK listener error for ${pathLabel}:${targetId}:`, error);

            // ELITE: onSnapshot error kills subscription permanently — schedule retry
            // This is critical for SOS: if listener dies, rescue ACKs are never received
            // CRITICAL FIX: Stop ALL listeners before retry to prevent duplicate subscriptions.
            // Without this, only the failed listener is dead but working listeners continue,
            // and scheduleRetry() re-creates ALL of them — causing duplicates.
            if (isListening) {
                stopSOSAckListenerInternal(false);
            }
            if (lastDeviceId) {
                scheduleRetry();
            }
        };

        for (const targetId of targetIds) {
            // === Legacy path: devices/{targetId}/sos_acks ===
            const legacyAcksRef = collection(db, 'devices', targetId, 'sos_acks');
            const legacyUnsub = onSnapshot(
                legacyAcksRef,
                processAckSnapshot,
                handleAckListenerError(targetId, 'legacy'),
            );
            unsubscribers.push(legacyUnsub);

            // === V3 path: sos_alerts/{targetId}/acks ===
            try {
                const v3AcksRef = collection(db, 'sos_alerts', targetId, 'acks');
                const v3Unsub = onSnapshot(
                    v3AcksRef,
                    processAckSnapshot,
                    handleAckListenerError(targetId, 'v3'),
                );
                unsubscribers.push(v3Unsub);
            } catch (v3Err) {
                logger.warn(`Failed to start V3 ACK listener for ${targetId}:`, v3Err);
            }
        }

        currentUnsubscribe = () => {
            unsubscribers.forEach((unsubscribe) => {
                try {
                    unsubscribe();
                } catch {
                    // no-op
                }
            });
        };

        isListening = true;
        isStarting = false;
        retryCount = 0; // Reset retry count on successful start
        listenerStartedAt = Date.now(); // Record start time to filter pre-existing ACKs
        logger.info(`✅ SOS ACK listener started for ${targetIds.size} target IDs: ${Array.from(targetIds).join(', ')}`);
    } catch (error) {
        isStarting = false;
        logger.error('Failed to start ACK listener:', error);
        // Schedule retry on start failure
        if (lastDeviceId) {
            scheduleRetry();
        }
    }
}

/**
 * Stop the SOS ACK listener and clean up resources.
 */
export function stopSOSAckListener(): void {
    stopSOSAckListenerInternal(true);
}

/**
 * Internal stop with option to clear processedAckIds.
 */
function stopSOSAckListenerInternal(clearProcessed: boolean): void {
    if (currentUnsubscribe) {
        try {
            currentUnsubscribe();
        } catch {
            // no-op — unsubscribe can throw if already detached
        }
        currentUnsubscribe = null;
    }
    isListening = false;
    isStarting = false;

    // Clear retry state on full stop
    if (clearProcessed) {
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        if (revivalTimer) { clearTimeout(revivalTimer); revivalTimer = null; }
        retryCount = 0;
        lastDeviceId = null;
        listenerStartedAt = 0;
        processedAckIds.clear();
    }
}

/**
 * Show a notification when rescue ACK is received.
 */
async function showAckNotification(rescuerName: string): Promise<void> {
    try {
        const { notificationCenter } = await import('../notifications/NotificationCenter');

        await notificationCenter.notify('rescue', {
            userId: rescuerName,
            userName: rescuerName,
            status: 'responding',
            message: `${rescuerName} yardıma geliyor!`,
        }, 'SOSAckListener');

        logger.info(`✅ ACK notification shown: ${rescuerName} is responding`);
    } catch (error) {
        logger.error('Failed to show ACK notification:', error);
    }
}
