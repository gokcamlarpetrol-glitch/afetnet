/**
 * SOS CHANNEL ROUTER - ELITE V4
 * Routes SOS signals through multiple channels simultaneously
 * 
 * FEATURES:
 * - Firebase Realtime (online)
 * - BLE Mesh Broadcast (offline)
 * - Backend API (rescue coordination)
 * - Push Notifications (family alerts)
 * - Automatic failover
 */

import { createLogger } from '../../utils/logger';
import { SOSSignal, ChannelStatus, useSOSStore } from './SOSStateManager';
import NetInfo from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';

const logger = createLogger('SOSChannelRouter');

type MeshDependencies = {
    meshNetworkService: {
        getIsRunning: () => boolean;
        start: () => Promise<void>;
        broadcastMessage: (payload: string, type: unknown, metadata?: Record<string, unknown>) => Promise<void>;
    };
    MeshMessageType: {
        SOS: unknown;
    };
    getInstallationId: () => Promise<string>;
    getDisplayName: () => string;
};

// ============================================================================
// AUTH POLLING HELPER
// ============================================================================

/**
 * Wait up to 2s for Firebase Auth to restore from MMKV persistence (cold start).
 * SOS is life-critical — MUST NOT silently fail due to auth race condition.
 * Returns the authenticated UID or null if auth never restores.
 */
async function waitForAuthUid(label: string): Promise<string | null> {
    const { getFirebaseAuth } = await import('../../../lib/firebase');
    let uid = getFirebaseAuth()?.currentUser?.uid ?? null;
    if (uid) return uid;

    // CRITICAL FIX: Increased from 2s to 5s. Auth restoration on cold start can take
    // up to 8s (INITIAL_RESTORE_GRACE_MS). 2s was insufficient — family/nearby SOS
    // channels silently failed because senderUid was null (Firestore rules reject).
    logger.warn(`⏳ ${label}: No auth yet — waiting up to 5s for auth restoration...`);
    const start = Date.now();
    while (!uid && Date.now() - start < 5000) {
        await new Promise(r => setTimeout(r, 250));
        uid = getFirebaseAuth()?.currentUser?.uid ?? null;
    }
    if (uid) {
        logger.info(`✅ ${label}: Auth restored after ${Date.now() - start}ms (uid: ${uid.substring(0, 8)}...)`);
    }
    return uid;
}

// ============================================================================
// CHANNEL ROUTER CLASS
// ============================================================================

class SOSChannelRouter {
    private isInitialized = false;

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        this.isInitialized = true;
        logger.info('SOS Channel Router initialized');
    }

    // ============================================================================
    // MAIN BROADCAST
    // ============================================================================

    /**
     * Broadcast SOS through ALL available channels
     * CRITICAL: Maximum reach for life-saving alerts
     */
    async broadcastSOS(signal: SOSSignal): Promise<void> {
        logger.warn('📡 Broadcasting SOS through all channels...');
        logger.debug(`[SOS] Signal: id=${signal.id}, timestamp=${signal.timestamp}, location=${signal.location ? 'YES' : 'NO'}`);

        // LIFE-SAFETY: Check for airplane mode — warn user if ALL channels are blocked
        try {
            const netState = await NetInfo.fetch();
            if (!netState.isConnected && netState.type === 'none') {
                logger.error('🚨 AIRPLANE MODE DETECTED — SOS channels severely limited!');
                // Notify user via notification center
                try {
                    const { notificationCenter } = await import('../notifications/NotificationCenter');
                    await notificationCenter.notify('system', {
                        title: 'Uçak Modu Aktif!',
                        message: 'SOS sinyaliniz gönderilemeyebilir. Bluetooth\'u açarak mesh ağına bağlanabilirsiniz.',
                        subtype: 'network'
                    }, 'SOSChannelRouter');
                } catch { /* best-effort notification */ }
            }
        } catch { /* NetInfo check is best-effort */ }

        const store = useSOSStore.getState();

        const channelNames = ['mesh', 'firebase', 'backend', 'push', 'family', 'nearbyUsers'];

        // Parallel broadcast through all channels
        const results = await Promise.allSettled([
            this.broadcastViaMesh(signal, store.updateChannelStatus),
            this.broadcastViaFirebase(signal, store.updateChannelStatus),
            this.broadcastViaBackend(signal, store.updateChannelStatus),
            this.broadcastViaPush(signal, store.updateChannelStatus),
            this.broadcastToFamily(signal),
            this.broadcastToNearbyUsers(signal),
        ]);

        // Log results of each channel
        const succeededChannels: string[] = [];
        const failedChannels: string[] = [];
        results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                logger.debug(`[SOS] Channel ${channelNames[i]}: ✅ OK`);
                succeededChannels.push(channelNames[i]);
            } else {
                logger.warn(`[SOS] Channel ${channelNames[i]}: ❌ FAILED: ${result.reason}`);
                failedChannels.push(channelNames[i]);
            }
        });

        if (failedChannels.length === channelNames.length) {
            logger.error(`🆘 SOS broadcast FAILED on ALL channels: ${failedChannels.join(', ')}`);
            // LIFE-SAFETY: Notify user that SOS was not delivered — they must take manual action
            try {
                const { notificationCenter } = await import('../notifications/NotificationCenter');
                await notificationCenter.notify('system', {
                    subtype: 'network',
                    title: '⚠️ SOS GÖNDERİLEMEDİ!',
                    message: 'Tüm kanallar başarısız oldu. İnternet bağlantısını veya Bluetooth\'u kontrol edin, ardından tekrar deneyin.',
                } as any, 'SOSChannelRouter-all-fail');
            } catch { /* best-effort — alert not critical vs SOS not delivered */ }

            // FIX 10: Emit DeviceEventEmitter event so UI can show an in-app alert
            // (NotificationCenter may be suppressed or unavailable — this provides a secondary path)
            try {
                const { DeviceEventEmitter } = require('react-native');
                DeviceEventEmitter.emit('SOS_ALL_CHANNELS_FAILED', {
                    failedChannels: failedChannels,
                    timestamp: Date.now(),
                });
            } catch { /* best-effort */ }
        } else if (failedChannels.length > 0) {
            logger.warn(`⚠️ SOS broadcast partial: ✅ ${succeededChannels.join(', ')} | ❌ ${failedChannels.join(', ')}`);
        } else {
            logger.info('✅ SOS broadcast completed on all channels');
        }
    }

    // ============================================================================
    // MESH CHANNEL (OFFLINE GUARANTEED)
    // ============================================================================

    private async loadMeshDependencies(): Promise<MeshDependencies> {
        const { meshNetworkService } = await import('../mesh');
        const { MeshMessageType } = await import('../mesh/MeshProtocol');
        const { getInstallationId } = await import('../../../lib/installationId');

        let getDisplayName = () => 'Acil Yardım';
        try {
            const { identityService } = await import('../IdentityService');
            getDisplayName = () => identityService.getDisplayName?.() || 'Acil Yardım';
        } catch {
            // best effort
        }

        return {
            meshNetworkService,
            MeshMessageType,
            getInstallationId,
            getDisplayName,
        };
    }

    private async broadcastViaMesh(
        signal: SOSSignal,
        updateStatus: (channel: 'mesh', status: ChannelStatus) => void
    ): Promise<void> {
        updateStatus('mesh', 'sending');

        try {
            const { meshNetworkService, MeshMessageType, getInstallationId, getDisplayName } = await this.loadMeshDependencies();

            // CRITICAL: Mesh sender identity must be installation-scoped, not account UID.
            // If two nearby devices are logged in with the same account, UID-based sender IDs
            // make receivers classify incoming SOS as self-originated and drop the alert.
            const installationId = await getInstallationId().catch((err) => {
                logger.warn('getInstallationId failed for mesh SOS identity:', err);
                return '';
            });
            const meshSenderId = (installationId && installationId.length > 0)
                ? installationId
                : `device-${signal.userId}`;

            const senderName = getDisplayName();

            // Ensure mesh is running — with timeout to prevent hanging SOS activation
            if (!meshNetworkService.getIsRunning()) {
                await Promise.race([
                    meshNetworkService.start(),
                    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Mesh start timeout')), 5000)),
                ]).catch(e => logger.warn('Mesh start failed/timeout, continuing with broadcast:', e));
            }

            // Create SOS payload
            // CRITICAL FIX: Include signal.status so receivers can distinguish active vs cancelled SOS.
            // Without this, a cancelled SOS broadcast via mesh is indistinguishable from a new SOS.
            const payload = JSON.stringify({
                type: 'SOS',
                id: signal.id,
                from: meshSenderId,
                userId: signal.userId,
                senderUid: signal.userId,
                senderName,
                timestamp: signal.timestamp,
                location: signal.location,
                message: signal.message,
                trapped: signal.trapped,
                reason: signal.reason,
                battery: signal.device.batteryLevel,
                status: signal.status,
            });

            // Check BLE + peer status — log actionable info for debugging
            try {
                const { default: highPerformanceBle } = await import('../../ble/HighPerformanceBle');
                const bleReady = await highPerformanceBle.isBluetoothPoweredOn();
                if (!bleReady) {
                    logger.error('🚨 SOS mesh broadcast: Bluetooth is OFF — mesh packets will be deferred until Bluetooth is enabled');
                }
                const { useMeshStore: getMeshStore } = await import('../mesh/MeshStore');
                const peerCount = getMeshStore.getState().peers.length;
                if (peerCount === 0) {
                    logger.warn('⚠️ SOS mesh broadcast: 0 peers discovered — signal queued, will auto-send when peers appear (BLE scan active)');
                } else {
                    logger.info(`✅ SOS mesh broadcast: ${peerCount} peer(s) visible — signal will be delivered`);
                }
            } catch { /* best-effort status check */ }

            // Broadcast via mesh with max TTL — timeout prevents hanging SOS activation
            await Promise.race([
                meshNetworkService.broadcastMessage(payload, MeshMessageType.SOS, {
                    from: meshSenderId,
                    messageId: signal.id,
                }),
                new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Mesh broadcast timeout')), 8000)),
            ]);

            // CRITICAL FIX: Check actual peer count AFTER broadcast.
            // broadcastMessage() queues the packet and returns success even with 0 peers.
            // If 0 peers → message sits in queue and may NEVER be delivered.
            // User should NOT see "SOS sent via mesh" when nobody can receive it.
            try {
                const { useMeshStore: getMeshStorePost } = await import('../mesh/MeshStore');
                const postPeerCount = getMeshStorePost.getState().peers.length;
                if (postPeerCount === 0) {
                    updateStatus('mesh', 'failed');
                    logger.warn('⚠️ Mesh SOS queued but 0 peers — marked as failed (will auto-send when peers appear)');
                } else {
                    // FIX 11: Status is 'sent' because peers were visible, but this means
                    // "queued to peers" — NOT confirmed delivery. BLE broadcast is fire-and-forget;
                    // actual receipt depends on peers' BLE scan being active.
                    updateStatus('mesh', 'sent');
                    logger.info(`✅ SOS queued to ${postPeerCount} visible mesh peer(s) — delivery not confirmed (BLE fire-and-forget)`);
                }
            } catch {
                // Fallback: mark as sent if we can't check peer count
                updateStatus('mesh', 'sent');
                logger.info('✅ SOS sent via Mesh');
            }
        } catch (error) {
            logger.error('❌ Mesh broadcast failed:', error);
            updateStatus('mesh', 'failed');
        }
    }

    // ============================================================================
    // FIREBASE CHANNEL (ONLINE)
    // ============================================================================

    private async broadcastViaFirebase(
        signal: SOSSignal,
        updateStatus: (channel: 'firebase', status: ChannelStatus) => void
    ): Promise<void> {
        updateStatus('firebase', 'pending');

        try {
            // CRITICAL FIX: Do NOT skip Firestore write when offline.
            // Firestore has offline persistence — writes are queued locally and
            // synced to server when connectivity returns. This ensures the SOS
            // signal is recorded even during network outage.
            updateStatus('firebase', 'sending');

            // CRITICAL FIX: Write SOS to a GLOBAL sos_signals collection,
            // NOT to the sender's own message inbox.
            // broadcastToFamily handles per-member delivery.
            // broadcastToNearbyUsers handles proximity-based delivery.
            // This channel saves the SOS signal as a global record.
            // CRITICAL: Validate auth FIRST — Firestore rules require creatorUid == request.auth.uid.
            // If auth is null, the write WILL be rejected. Don't mark as "sent" in that case.
            // LIFE-SAFETY: Auth may still be restoring from MMKV on cold start. Wait briefly
            // before giving up — SOS is life-critical and MUST NOT silently fail.
            const currentUid = await waitForAuthUid('Firebase SOS');
            if (!currentUid) {
                logger.error('❌ Firebase SOS broadcast FAILED: No authenticated user after 2s wait — Firestore rules will reject. Mesh channel is the fallback.');
                updateStatus('firebase', 'failed');
                return;
            }

            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
            const db = await getFirestoreInstanceAsync();
            if (!db) {
                updateStatus('firebase', 'failed');
                return;
            }

            const { doc, setDoc } = await import('firebase/firestore');

            // CRITICAL FIX: Include healthInfo in sos_signals so rescue teams
            // querying this global collection see blood type, allergies, medications.
            // Previously only broadcastToFamily and broadcastToNearbyUsers included it.
            const healthInfo = await this.loadHealthProfile();

            const sosRef = doc(db, 'sos_signals', signal.id);
            await setDoc(sosRef, {
                id: signal.id,
                userId: signal.userId,
                creatorUid: currentUid,
                message: signal.message,
                location: signal.location,
                trapped: signal.trapped,
                reason: signal.reason,
                battery: signal.device.batteryLevel,
                timestamp: signal.timestamp,
                status: signal.status === 'cancelled' ? 'cancelled' : 'active',
                healthInfo,
            });

            // CRITICAL FIX: Firestore on RN has NO persistent cache (memory-only).
            // setDoc() resolves immediately from memory cache even when offline,
            // but data evaporates on app kill. Only report 'sent' if actually online.
            const netInfo = await NetInfo.fetch();
            if (netInfo.isConnected && netInfo.isInternetReachable !== false) {
                updateStatus('firebase', 'sent');
                logger.info('✅ SOS saved to global sos_signals collection');
            } else {
                updateStatus('firebase', 'pending');
                logger.warn('⚠️ SOS queued in Firestore memory cache (offline) — will sync when online');
            }
        } catch (error) {
            logger.error('❌ Firebase broadcast failed:', error);
            updateStatus('firebase', 'failed');
        }
    }

    // ============================================================================
    // BACKEND CHANNEL (RESCUE COORDINATION)
    // ============================================================================

    private async broadcastViaBackend(
        signal: SOSSignal,
        updateStatus: (channel: 'backend', status: ChannelStatus) => void
    ): Promise<void> {
        updateStatus('backend', 'pending');

        try {
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) {
                logger.debug('Backend skipped: offline');
                updateStatus('backend', 'idle');
                return;
            }

            const { backendEmergencyService } = await import('../BackendEmergencyService');

            if (!backendEmergencyService.initialized) {
                await backendEmergencyService.initialize();
            }

            // SOS-BUG 1 FIX: If backend still not initialized after init attempt
            // (e.g. no API_BASE_URL configured), gracefully skip instead of failing
            if (!backendEmergencyService.initialized) {
                logger.debug('Backend channel skipped: API not configured (Firebase channels active)');
                updateStatus('backend', 'idle');
                return;
            }

            await backendEmergencyService.sendEmergencyMessage({
                messageId: signal.id,
                content: signal.message,
                timestamp: signal.timestamp,
                type: 'sos',
                priority: 'critical',
                location: signal.location ? {
                    latitude: signal.location.latitude,
                    longitude: signal.location.longitude,
                    accuracy: signal.location.accuracy,
                } : undefined,
            });

            updateStatus('backend', 'sent');
            logger.info('✅ SOS sent via Backend');
        } catch (error) {
            logger.error('❌ Backend broadcast failed:', error);
            updateStatus('backend', 'failed');
        }
    }

    // ============================================================================
    // PUSH NOTIFICATION CHANNEL (FAMILY ALERTS)
    // ============================================================================

    private async broadcastViaPush(
        _signal: SOSSignal,
        updateStatus: (channel: 'push', status: ChannelStatus) => void
    ): Promise<void> {
        // CRITICAL FIX: Do NOT send a push notification to the SENDER's own phone.
        // The sender already sees the SOSModal UI confirming their SOS is active.
        // Remote family/nearby alerts are delivered via broadcastToFamily and broadcastToNearbyUsers.
        // Sending a push to self was confusing — the user thought their own phone was receiving
        // someone else's SOS when in reality it was their own confirmation.
        updateStatus('push', 'sent');
        logger.info('✅ Push channel: self-notification skipped (sender sees SOSModal UI)');
    }

    // ============================================================================
    // FAMILY MEMBER CHANNEL (CRITICAL: Notify family on their devices)
    // ============================================================================

    /**
     * Write SOS alert to each family member's Firebase path
     * Family members' apps listen to these paths via real-time subscriptions
     */
    private async broadcastToFamily(signal: SOSSignal): Promise<void> {
        try {
            // Get family members from store
            const { useFamilyStore } = await import('../../stores/familyStore');
            let members = useFamilyStore.getState().members;

            // If members empty (cold-start recovery), wait briefly for hydration
            if (members.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                members = useFamilyStore.getState().members;
            }

            if (members.length === 0) {
                logger.warn('Family broadcast skipped: no family members after hydration wait');
                return;
            }

            // Resolve human-readable sender name
            let senderName = 'Bilinmeyen';
            try {
                const { identityService } = await import('../IdentityService');
                const identity = identityService.getIdentity();
                senderName = identity?.displayName || 'Aile Üyesi';
            } catch {
                senderName = 'Aile Üyesi';
            }

            const { getDeviceId } = await import('../../../lib/device');
            const senderDeviceId = await getDeviceId();

            // ELITE: Load health profile for life-saving info
            const healthInfo = await this.loadHealthProfile();

            // CRITICAL FIX: Use the ACTUAL Firebase Auth UID for senderUid, not signal.userId.
            // signal.userId may have fallen back to a device ID (AFN-XXXX) during cold start.
            // Firestore rules require senderUid == request.auth.uid for CREATE.
            // Without this, ALL family SOS writes are SILENTLY REJECTED.
            // LIFE-SAFETY: Wait briefly for auth to restore if not ready yet.
            let resolvedSenderUid = signal.userId;
            try {
                const authUid = await waitForAuthUid('Family SOS');
                if (!authUid) {
                    logger.error('❌ Family SOS: Auth still unavailable after 2s — Firestore writes will likely be rejected');
                }
                if (authUid) resolvedSenderUid = authUid;
            } catch { /* use fallback */ }

            const sosAlert = {
                signalId: signal.id,
                senderDeviceId: senderDeviceId || signal.userId,
                senderUid: resolvedSenderUid,
                senderName,
                message: signal.message,
                reason: signal.reason,
                location: signal.location ? {
                    latitude: signal.location.latitude,
                    longitude: signal.location.longitude,
                    accuracy: signal.location.accuracy,
                } : null,
                trapped: signal.trapped,
                battery: signal.device.batteryLevel,
                timestamp: signal.timestamp,
                status: signal.status === 'cancelled' ? 'cancelled' : 'active',
                healthInfo,
            };

            // CRITICAL FIX: Always attempt Firestore writes — Firestore offline persistence
            // queues them locally and syncs when connectivity returns.
            {
                logger.info(`📨 Broadcasting SOS to ${members.length} family members via Firestore...`);

                const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
                let db = await getFirestoreInstanceAsync();
                if (!db) {
                    // RETRY: Firestore may be initializing during cold start — wait 2s and retry once
                    logger.warn('Family Firestore broadcast: Firestore unavailable, retrying in 2s...');
                    await new Promise(r => setTimeout(r, 2000));
                    db = await getFirestoreInstanceAsync();
                }
                if (!db) {
                    logger.error('❌ Family Firestore broadcast FAILED: Firestore unavailable after retry');
                } else {
                    const { doc, setDoc } = await import('firebase/firestore');

                    // Resolve ALL sender identity forms for robust self-exclusion
                    const senderSelfIds = new Set<string>();
                    try {
                        // CRITICAL FIX: Use getFirebaseAuth() singleton instead of raw getAuth()
                        // Raw getAuth() creates new instance without MMKV persistence → null currentUser
                        const { getFirebaseAuth } = await import('../../../lib/firebase');
                        const authUid = getFirebaseAuth()?.currentUser?.uid;
                        if (authUid) senderSelfIds.add(authUid);
                    } catch { /* auth not ready */ }
                    if (signal.userId) senderSelfIds.add(signal.userId);
                    if (senderDeviceId) senderSelfIds.add(senderDeviceId);
                    try {
                        const { identityService: idSvc } = await import('../IdentityService');
                        const publicCode = idSvc.getPublicUserCode?.();
                        if (publicCode) senderSelfIds.add(publicCode);
                    } catch { /* non-critical */ }

                    const writePromises = members.flatMap((member) => {
                        // Skip self — check all known IDs for the sender
                        if ((member.uid && senderSelfIds.has(member.uid)) ||
                            (member.deviceId && senderSelfIds.has(member.deviceId))) {
                            return [];
                        }
                        // Write to ALL known IDs for this member
                        // SOSAlertListener may listen on physical deviceId, QR id, OR UID
                        const targetIds = new Set<string>();
                        if (member.deviceId) targetIds.add(member.deviceId);
                        if (member.uid) targetIds.add(member.uid);

                        return Array.from(targetIds).map(async (targetId) => {
                            try {
                                const legacyRef = doc(db, 'devices', targetId, 'sos_alerts', signal.id);
                                const v3Ref = doc(db, 'sos_alerts', targetId, 'items', signal.id);

                                const writes = await Promise.allSettled([
                                    setDoc(legacyRef, sosAlert),
                                    setDoc(v3Ref, sosAlert),
                                ]);

                                const hasSuccess = writes.some((result) => result.status === 'fulfilled');
                                if (!hasSuccess) {
                                    // RETRY: Single retry with 1s delay for transient Firestore errors
                                    logger.warn(`⚠️ SOS family write failed for ${member.name} (${targetId}), retrying in 1s...`);
                                    await new Promise(r => setTimeout(r, 1000));
                                    const retryWrites = await Promise.allSettled([
                                        setDoc(legacyRef, sosAlert),
                                        setDoc(v3Ref, sosAlert),
                                    ]);
                                    const retrySuccess = retryWrites.some((r) => r.status === 'fulfilled');
                                    if (!retrySuccess) {
                                        throw new Error('No SOS family write path succeeded after retry');
                                    }
                                }

                                logger.info(`✅ SOS alert sent to family member: ${member.name} (${targetId})`);
                            } catch (err) {
                                logger.error(`❌ Failed to send SOS to family member ${member.name} (${targetId}):`, err);
                                throw err; // Re-throw so Promise.allSettled counts it as rejected
                            }
                        });
                    });

                    const familyResults = await Promise.allSettled(writePromises);
                    const familySuccessCount = familyResults.filter(r => r.status === 'fulfilled').length;
                    logger.info(`✅ Family SOS Firestore broadcast: ${familySuccessCount}/${members.length} members`);
                    if (familySuccessCount === 0 && members.length > 0) {
                        throw new Error(`All ${members.length} family SOS writes failed`);
                    }
                }
            }

            // OFFLINE: Also broadcast via BLE Mesh with family tag (mesh always runs)
            try {
                const { meshNetworkService } = await import('../mesh');
                const { MeshMessageType } = await import('../mesh/MeshProtocol');
                const { getInstallationId } = await import('../../../lib/installationId');
                const installationId = await getInstallationId().catch(() => '');
                const meshSenderId = installationId || senderDeviceId || signal.userId;

                const familySOSPayload = JSON.stringify({
                    type: 'FAMILY_SOS',
                    from: meshSenderId,
                    ...sosAlert,
                });

                await Promise.race([
                    meshNetworkService.broadcastMessage(familySOSPayload, MeshMessageType.SOS, {
                        from: meshSenderId,
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Mesh family SOS timeout')), 8000)),
                ]);
                logger.info('✅ Family SOS sent via Mesh (offline backup)');
            } catch (meshErr) {
                logger.warn('Mesh family SOS broadcast failed:', meshErr);
            }
        } catch (error) {
            logger.error('❌ Family broadcast failed:', error);
        }
    }

    // ============================================================================
    // NEARBY USERS CHANNEL (CRITICAL: Alert ALL nearby users, not just family)
    // ============================================================================

    /**
     * Write SOS to global sos_broadcasts collection for proximity-based alerting.
     * Cloud Function picks this up and sends FCM push to all users within radius.
     * This is the ONLY channel that reaches non-family users online.
     */
    private async broadcastToNearbyUsers(signal: SOSSignal): Promise<void> {
        try {
            // CRITICAL FIX: Always attempt Firestore write — offline persistence queues it.
            // STEP 1: Firestore instance
            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
            let db = await getFirestoreInstanceAsync();
            if (!db) {
                // CRITICAL FIX: Retry after 2s — Firestore may still be initializing during cold start.
                // Without retry, nearby users get NO notification if SOS triggers before Firestore is ready.
                // broadcastToFamily already has this pattern (lines 423-426).
                logger.warn('Nearby SOS broadcast: Firestore unavailable, retrying in 2s...');
                await new Promise(r => setTimeout(r, 2000));
                db = await getFirestoreInstanceAsync();
            }
            if (!db) {
                logger.error('❌ Nearby SOS broadcast FAILED: Firestore unavailable after retry');
                return;
            }

            // STEP 3: Check auth state — resolve auth UID for Firestore rules compliance
            // LIFE-SAFETY: Wait briefly for auth to restore if not ready (cold start race)
            let authUid: string | null = null;
            try {
                authUid = await waitForAuthUid('Nearby SOS broadcast');
                logger.debug(`[SOS] Step 3 - Auth: uid=${authUid || 'NOT LOGGED IN'}`);
                if (!authUid) {
                    logger.error('[SOS] No authenticated user after 2s wait — skipping Firestore broadcast (will be rejected by rules). Mesh channel is the fallback.');
                    throw new Error('No auth for nearby broadcast');
                }
            } catch (authErr) {
                logger.error(`[SOS] Auth check failed — skipping Firestore broadcast:`, authErr);
                throw authErr;
            }

            // STEP 4: Get device ID + identity + health data
            const { doc, setDoc } = await import('firebase/firestore');
            const { getDeviceId } = await import('../../../lib/device');
            const senderDeviceId = await getDeviceId();
            logger.debug(`[SOS] Step 4 - DeviceId: ${senderDeviceId}`);

            // STEP 4.5: Resolve sender name for rescuers
            let senderName = 'Bilinmeyen';
            try {
                const { identityService } = await import('../IdentityService');
                const identity = identityService.getIdentity();
                senderName = identity?.displayName || 'Kullanıcı';
            } catch {
                senderName = 'Kullanıcı';
            }

            // STEP 4.6: Load health profile (life-saving)
            const healthInfo = await this.loadHealthProfile();

            // STEP 5: Build document
            const hasLocation = signal.location != null;
            if (!hasLocation) {
                logger.warn('Global SOS broadcast: NO location — sending to ALL devices (global fallback)');
            }

            // CRITICAL FIX: Use the ACTUAL Firebase Auth UID for senderUid, not signal.userId.
            // signal.userId may have fallen back to a device ID (AFN-XXXX) during cold start
            // when auth wasn't ready yet. Firestore rules require senderUid == request.auth.uid.
            // If we use the device ID, the write is SILENTLY REJECTED by Firestore rules.
            const broadcastData = {
                signalId: signal.id,
                senderDeviceId: senderDeviceId || signal.userId,
                senderUid: authUid!,
                userId: signal.userId,
                senderName,
                message: signal.message,
                reason: signal.reason,
                latitude: hasLocation ? (signal.location?.latitude ?? null) : null,
                longitude: hasLocation ? (signal.location?.longitude ?? null) : null,
                accuracy: hasLocation ? (signal.location?.accuracy || 0) : null,
                hasLocation: hasLocation,
                trapped: signal.trapped,
                battery: signal.device.batteryLevel,
                timestamp: signal.timestamp,
                status: signal.status === 'cancelled' ? 'cancelled' : 'active',
                healthInfo,
            };

            logger.debug(`[SOS] Step 5 - Document data:`, JSON.stringify({
                signalId: broadcastData.signalId,
                latitude: broadcastData.latitude,
                longitude: broadcastData.longitude,
                timestamp: broadcastData.timestamp,
                hasLocation: broadcastData.hasLocation,
                typeOfTimestamp: typeof broadcastData.timestamp,
                typeOfLatitude: typeof broadcastData.latitude,
            }));

            // STEP 6: Write to Firestore
            const broadcastRef = doc(db, 'sos_broadcasts', signal.id);
            logger.debug(`[SOS] Step 6 - Writing to: sos_broadcasts/${signal.id}`);

            await setDoc(broadcastRef, broadcastData);

            logger.debug('[SOS] Step 7 - ✅ WRITE SUCCESSFUL — Cloud Function should trigger now');
            logger.info('✅ Global SOS broadcast sent — Cloud Function will push to nearby users');
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.debug(`[SOS] ❌ WRITE FAILED: ${errMsg}`);
            logger.error('❌ Global SOS broadcast failed:', error);
        }
    }

    // ============================================================================
    // RESCUE ACK — Rescuer acknowledges they are on the way
    // ============================================================================

    /**
     * Send rescue acknowledgment to SOS sender.
     * Writes to Firestore so the trapped person can see help is coming.
     */
    async sendRescueACK(
        signalId: string,
        sosDeviceId: string,
        options?: { sosSenderUid?: string }
    ): Promise<void> {
        // CRITICAL FIX: Validate signalId is non-empty.
        // Empty signalId creates invalid Firestore paths like 'sos_broadcasts//acks/...'
        // which causes Firestore write errors and ACK never reaches the SOS sender.
        if (!signalId || signalId.trim().length === 0) {
            logger.error('❌ Cannot send rescue ACK: signalId is empty');
            throw new Error('Kurtarma mesajı gönderilemedi: Sinyal kimliği bulunamadı.');
        }

        try {
            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
            const db = await getFirestoreInstanceAsync();
            if (!db) {
                logger.warn('Cannot send ACK: Firestore unavailable');
                return;
            }

            const { doc, setDoc } = await import('firebase/firestore');
            const { getDeviceId } = await import('../../../lib/device');
            const rescuerDeviceId = await getDeviceId();

            let rescuerName = 'Gönüllü';
            try {
                const { identityService } = await import('../IdentityService');
                const identity = identityService.getIdentity();
                rescuerName = identity?.displayName || 'Gönüllü';
            } catch { /* fallback */ }

            // Get rescuer's location
            let rescuerLocation: { latitude: number; longitude: number } | null = null;
            try {
                const Location = await import('expo-location');
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                rescuerLocation = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                };
            } catch { /* location optional */ }

            // CRITICAL: Get auth UID for sos_broadcasts/acks rule (requires userId == auth.uid)
            let userId: string | undefined;
            try {
                const { getFirebaseAuth } = await import('../../../lib/firebase');
                userId = getFirebaseAuth()?.currentUser?.uid;
            } catch { /* fallback */ }
            if (!userId) {
                try {
                    const { identityService } = await import('../IdentityService');
                    userId = identityService.getUid() || undefined;
                } catch {
                    // fallback
                }
            }

            // CRITICAL FIX: userId is REQUIRED by sos_broadcasts/acks security rule
            // (request.resource.data.userId == request.auth.uid)
            // If userId is empty string '' → rule check '' == auth.uid → ALWAYS FALSE
            // → ACK write SILENTLY REJECTED → trapped person never sees rescue coming.
            // Ensure auth UID as last resort, and ABORT if truly unavailable.
            if (!userId || userId.trim().length === 0) {
                try {
                    const { getFirebaseAuth: getAuth2 } = await import('../../../lib/firebase');
                    userId = getAuth2()?.currentUser?.uid || undefined;
                } catch { /* last resort */ }
            }
            if (!userId || userId.trim().length === 0) {
                logger.error('❌ Cannot send rescue ACK: no valid userId — Firestore rules will reject');
                throw new Error('Kurtarma mesajı gönderilemedi: Kimlik doğrulama hatası');
            }
            const ackData: Record<string, any> = {
                rescuerDeviceId,
                rescuerUid: userId, // CRITICAL FIX: SOSAckListener reads rescuerUid first
                rescuerName,
                rescuerLocation,
                timestamp: Date.now(),
                type: 'on_the_way',
                userId,
            };

            const ackDocId = `${signalId}_${rescuerDeviceId || userId || Date.now().toString(36)}`;
            const targetIds = new Set<string>();
            if (sosDeviceId?.trim()) {
                targetIds.add(sosDeviceId.trim());
            }
            if (options?.sosSenderUid?.trim()) {
                targetIds.add(options.sosSenderUid.trim());
            }
            // LIFE-SAFETY: Validate we have at least one target before attempting delivery
            if (targetIds.size === 0) {
                logger.error(`❌ Rescue ACK has NO targets for signal ${signalId} — trapped person will NOT be notified`);
                throw new Error('Kurtarma mesajı gönderilemedi: Hedef bulunamadı. Lütfen tekrar deneyin.');
            }
            let deliveredTargetCount = 0;
            for (const targetId of targetIds) {
                const writes = await Promise.allSettled([
                    setDoc(doc(db, 'devices', targetId, 'sos_acks', ackDocId), ackData),
                    setDoc(doc(db, 'sos_alerts', targetId, 'acks', ackDocId), ackData),
                ]);
                if (writes.some((result) => result.status === 'fulfilled')) {
                    deliveredTargetCount += 1;
                }
            }
            if (deliveredTargetCount === 0) {
                logger.error(`❌ Rescue ACK delivery FAILED for signal ${signalId} — all write paths rejected`);
                throw new Error('Kurtarma mesajı gönderilemedi: Bağlantı hatası. Lütfen tekrar deneyin.');
            }

            // Also write to sos_broadcasts sub-collection for global visibility
            // CRITICAL FIX: Only attempt if userId is valid — rule requires userId == auth.uid
            // Writing with empty userId causes silent permission-denied rejection
            if (userId && userId.trim().length > 0) {
                try {
                    const broadcastAckRef = doc(db, 'sos_broadcasts', signalId, 'acks', rescuerDeviceId || userId);
                    await setDoc(broadcastAckRef, ackData);
                } catch (ackErr) {
                    logger.warn('Broadcast ACK write failed (non-critical):', ackErr);
                }
            } else {
                logger.warn('Broadcast ACK skipped: no valid userId for sos_broadcasts/acks rule');
            }

            logger.info(`✅ Rescue ACK sent for signal ${signalId} by ${rescuerName} (targets: ${deliveredTargetCount})`);

            // ENHANCEMENT: Also broadcast ACK via BLE Mesh for offline SOS senders
            try {
                const { meshNetworkService } = await import('../mesh');
                const { MeshMessageType } = await import('../mesh/MeshProtocol');
                const { getInstallationId } = await import('../../../lib/installationId');
                const installationId = await getInstallationId().catch(() => '');
                const meshSenderId = installationId || rescuerDeviceId || userId || 'anon';

                const meshAckPayload = JSON.stringify({
                    type: 'RESCUE_ACK',
                    signalId,
                    from: meshSenderId,
                    rescuerDeviceId,
                    rescuerUid: userId,
                    rescuerName,
                    rescuerLocation,
                    timestamp: Date.now(),
                });

                // Use SOS type for rescue ACK to get priority relay treatment
                await meshNetworkService.broadcastMessage(meshAckPayload, MeshMessageType.SOS, {
                    from: meshSenderId,
                });
                logger.info('✅ Rescue ACK also sent via BLE Mesh (offline backup)');
            } catch (meshErr) {
                logger.warn('Mesh ACK broadcast failed (non-critical):', meshErr);
            }
        } catch (error) {
            logger.error('Failed to send rescue ACK:', error);
            // CRITICAL FIX: Re-throw so SOSHelpScreen can show error to rescuer.
            // Previously this catch swallowed all errors including validation throws
            // (no userId, no targets, all writes failed) → UI showed "Bildirildi" (success)
            // when the ACK was NEVER delivered → trapped person never knew help was coming.
            throw error;
        }
    }

    // ============================================================================
    // HEALTH PROFILE
    // ============================================================================

    /**
     * Load user's health profile from AsyncStorage for SOS broadcast.
     * Returns null if no health profile exists.
     */
    /**
     * Public accessor for health profile — used by SOSBeaconService to include
     * health data in periodic beacon payloads.
     */
    async loadHealthProfileForBeacon(): Promise<{
        bloodType?: string;
        allergies?: string;
        chronicConditions?: string;
        emergencyNotes?: string;
    } | null> {
        return this.loadHealthProfile();
    }

    private async loadHealthProfile(): Promise<{
        bloodType?: string;
        allergies?: string;
        chronicConditions?: string;
        emergencyNotes?: string;
    } | null> {
        try {
            const { DirectStorage } = await import('../../utils/storage');

            // CRITICAL FIX: healthProfileStore uses scoped key '@afetnet:health_profile:user:{uid}'
            // (NOT '@health_profile'). The old key NEVER matched, so SOS broadcasts NEVER
            // included health data — rescuers had no blood type, allergies, or medications info.
            // Try scoped key first (normal case), then unscoped fallback.
            let raw: string | undefined;
            try {
                const { getFirebaseAuth } = await import('../../../lib/firebase');
                const uid = getFirebaseAuth()?.currentUser?.uid;
                if (uid) {
                    raw = DirectStorage.getString(`@afetnet:health_profile:user:${uid}`);
                }
            } catch { /* auth not ready */ }

            // Fallback: try unscoped key (guest mode or migration)
            if (!raw) {
                raw = DirectStorage.getString('@afetnet:health_profile');
            }

            if (!raw) return null;
            const profile = JSON.parse(raw);

            // Format arrays into human-readable strings for rescuers
            const allergiesStr = Array.isArray(profile.allergies) && profile.allergies.length > 0
                ? profile.allergies.join(', ')
                : (typeof profile.allergies === 'string' ? profile.allergies : undefined);

            const conditionsStr = Array.isArray(profile.chronicConditions) && profile.chronicConditions.length > 0
                ? profile.chronicConditions.join(', ')
                : (typeof profile.chronicConditions === 'string' ? profile.chronicConditions : undefined);

            const medicationsStr = Array.isArray(profile.medications) && profile.medications.length > 0
                ? profile.medications.join(', ')
                : undefined;

            return {
                bloodType: profile.bloodType || undefined,
                allergies: allergiesStr || undefined,
                chronicConditions: conditionsStr || undefined,
                emergencyNotes: profile.notes || profile.emergencyNotes || (medicationsStr ? `İlaçlar: ${medicationsStr}` : undefined),
            };
        } catch {
            return null;
        }
    }

    // ============================================================================
    // STATUS CHECK
    // ============================================================================

    async getNetworkStatus(): Promise<'online' | 'mesh' | 'offline'> {
        try {
            const netInfo = await NetInfo.fetch();
            if (netInfo.isConnected) {
                return 'online';
            }

            // Check mesh peers
            try {
                const { useMeshStore } = await import('../mesh/MeshStore');
                const meshPeers = useMeshStore.getState().peers.length;
                if (meshPeers > 0) {
                    return 'mesh';
                }
            } catch {
                // Mesh not available
            }

            return 'offline';
        } catch {
            return 'offline';
        }
    }

    // CRITICAL FIX: Cache last known battery level. Fallback 100% is dangerous —
    // rescuers see full battery when phone may actually be dying.
    private lastKnownBatteryLevel = -1;

    async getBatteryLevel(): Promise<number> {
        try {
            const level = await Battery.getBatteryLevelAsync();
            const percent = Math.round(level * 100);
            this.lastKnownBatteryLevel = percent;
            return percent;
        } catch {
            // Return last known level if available, otherwise -1 to indicate unknown
            return this.lastKnownBatteryLevel >= 0 ? this.lastKnownBatteryLevel : -1;
        }
    }
}

export const sosChannelRouter = new SOSChannelRouter();
export default sosChannelRouter;
