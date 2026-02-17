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
                if (ackAge > 60 * 60 * 1000) {
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
                        const rescuerRef = typeof ackData.rescuerUid === 'string'
                            ? ackData.rescuerUid
                            : (typeof ackData.rescuerDeviceId === 'string' ? ackData.rescuerDeviceId : '');
                        store.addAck({
                            id: ackId,
                            receiverId: rescuerRef,
                            receiverName: rescuerName,
                            timestamp: ackTimestamp || Date.now(),
                            type: ackData.type === 'on_the_way' ? 'responding' : 'received',
                            distance: undefined,
                        });
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
        logger.info(`✅ SOS ACK listener started for ${targetIds.size} target IDs: ${Array.from(targetIds).join(', ')}`);
    } catch (error) {
        isStarting = false;
        logger.error('Failed to start ACK listener:', error);
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

    // Clear dedup set to prevent memory leak
    if (clearProcessed) {
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
