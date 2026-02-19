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
        } else if (failedChannels.length > 0) {
            logger.warn(`⚠️ SOS broadcast partial: ✅ ${succeededChannels.join(', ')} | ❌ ${failedChannels.join(', ')}`);
        } else {
            logger.info('✅ SOS broadcast completed on all channels');
        }
    }

    // ============================================================================
    // MESH CHANNEL (OFFLINE GUARANTEED)
    // ============================================================================

    private async broadcastViaMesh(
        signal: SOSSignal,
        updateStatus: (channel: 'mesh', status: ChannelStatus) => void
    ): Promise<void> {
        updateStatus('mesh', 'sending');

        try {
            // Dynamic import to avoid circular dependencies
            const { meshNetworkService } = await import('../mesh');
            const { MeshMessageType } = await import('../mesh/MeshProtocol');

            // Ensure mesh is running
            if (!meshNetworkService.getIsRunning()) {
                await meshNetworkService.start();
            }

            // Create SOS payload
            const payload = JSON.stringify({
                type: 'SOS',
                id: signal.id,
                userId: signal.userId,
                timestamp: signal.timestamp,
                location: signal.location,
                message: signal.message,
                trapped: signal.trapped,
                reason: signal.reason,
                battery: signal.device.batteryLevel,
            });

            // Broadcast via mesh with max TTL
            await meshNetworkService.broadcastMessage(payload, MeshMessageType.SOS);

            updateStatus('mesh', 'sent');
            logger.info('✅ SOS sent via Mesh');
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
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) {
                logger.debug('Firebase skipped: offline');
                updateStatus('firebase', 'idle');
                return;
            }

            updateStatus('firebase', 'sending');

            // CRITICAL FIX: Write SOS to a GLOBAL sos_signals collection,
            // NOT to the sender's own message inbox.
            // broadcastToFamily handles per-member delivery.
            // broadcastToNearbyUsers handles proximity-based delivery.
            // This channel saves the SOS signal as a global record.
            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
            const db = await getFirestoreInstanceAsync();
            if (!db) {
                updateStatus('firebase', 'failed');
                return;
            }

            const { doc, setDoc } = await import('firebase/firestore');
            const sosRef = doc(db, 'sos_signals', signal.id);
            const { getAuth } = await import('firebase/auth');
            const currentUid = getAuth()?.currentUser?.uid ?? signal.userId;
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
            });

            updateStatus('firebase', 'sent');
            logger.info('✅ SOS saved to global sos_signals collection');
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
            const members = useFamilyStore.getState().members;

            if (members.length === 0) {
                logger.debug('Family broadcast skipped: no family members');
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

            const sosAlert = {
                signalId: signal.id,
                senderDeviceId: senderDeviceId || signal.userId,
                senderUid: signal.userId,
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

            const netInfo = await NetInfo.fetch();

            // ONLINE: Write to Firestore → SOSAlertListener on receiver side picks it up
            if (netInfo.isConnected) {
                logger.info(`📨 Broadcasting SOS to ${members.length} family members via Firestore...`);

                const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
                const db = await getFirestoreInstanceAsync();
                if (!db) {
                    logger.warn('Family Firestore broadcast skipped: Firestore unavailable');
                } else {
                    const { doc, setDoc } = await import('firebase/firestore');

                    // Resolve ALL sender identity forms for robust self-exclusion
                    const senderSelfIds = new Set<string>();
                    try {
                        const { getAuth: getAuth2 } = await import('firebase/auth');
                        const authUid = getAuth2()?.currentUser?.uid;
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
                                    throw new Error('No SOS family write path succeeded');
                                }

                                logger.info(`✅ SOS alert sent to family member: ${member.name} (${targetId})`);
                            } catch (err) {
                                logger.error(`❌ Failed to send SOS to family member ${member.name} (${targetId}):`, err);
                            }
                        });
                    });

                    await Promise.allSettled(writePromises);
                    logger.info(`✅ Family SOS Firestore broadcast completed (${members.length} members)`);
                }
            }

            // OFFLINE: Also broadcast via BLE Mesh with family tag (mesh always runs)
            try {
                const { meshNetworkService } = await import('../mesh');
                const { MeshMessageType } = await import('../mesh/MeshProtocol');

                const familySOSPayload = JSON.stringify({
                    type: 'FAMILY_SOS',
                    ...sosAlert,
                });

                await meshNetworkService.broadcastMessage(familySOSPayload, MeshMessageType.SOS);
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
            // STEP 1: Network check
            const netInfo = await NetInfo.fetch();
            logger.debug(`[SOS] Step 1 - Network: connected=${netInfo.isConnected}, type=${netInfo.type}`);
            if (!netInfo.isConnected) {
                logger.debug('Global SOS broadcast skipped: offline (mesh still active)');
                return;
            }

            // STEP 2: Firestore instance
            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
            const db = await getFirestoreInstanceAsync();
            logger.debug(`[SOS] Step 2 - Firestore: ${db ? 'OK' : 'NULL'}`);
            if (!db) {
                logger.warn('Global SOS broadcast skipped: Firestore unavailable');
                return;
            }

            // STEP 3: Check auth state
            try {
                const { getAuth } = await import('firebase/auth');
                const { getApp } = await import('firebase/app');
                const auth = getAuth(getApp());
                const user = auth.currentUser;
                logger.debug(`[SOS] Step 3 - Auth: uid=${user?.uid || 'NOT LOGGED IN'}, emailVerified=${user?.emailVerified}`);
                if (!user) {
                    // CRITICAL FIX: Don't attempt Firestore write without auth — it will be rejected by rules.
                    // SOS will still be broadcast via mesh (offline) and other channels.
                    logger.error('[SOS] No authenticated user — skipping Firestore broadcast (will be rejected by rules)');
                    return;
                }
            } catch (authErr) {
                logger.debug(`[SOS] Step 3 - Auth check error: ${authErr}`);
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

            const broadcastData = {
                signalId: signal.id,
                senderDeviceId: senderDeviceId || signal.userId,
                senderUid: signal.userId,
                userId: signal.userId,
                senderName,
                message: signal.message,
                reason: signal.reason,
                latitude: hasLocation ? signal.location!.latitude : 0,
                longitude: hasLocation ? signal.location!.longitude : 0,
                accuracy: hasLocation ? (signal.location!.accuracy || 0) : 0,
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
                const { getAuth } = await import('firebase/auth');
                userId = getAuth()?.currentUser?.uid;
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
            // Always include it — if auth UID is unavailable, the Firestore write
            // will be rejected by rules anyway, so we must not omit the field.
            const ackData: Record<string, any> = {
                rescuerDeviceId,
                rescuerName,
                rescuerLocation,
                timestamp: Date.now(),
                type: 'on_the_way',
                userId: userId || '',
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
            try {
                const broadcastAckRef = doc(db, 'sos_broadcasts', signalId, 'acks', rescuerDeviceId || userId || 'anon');
                await setDoc(broadcastAckRef, ackData);
            } catch { /* not critical */ }

            logger.info(`✅ Rescue ACK sent for signal ${signalId} by ${rescuerName} (targets: ${deliveredTargetCount})`);

            // ENHANCEMENT: Also broadcast ACK via BLE Mesh for offline SOS senders
            try {
                const { meshNetworkService } = await import('../mesh');
                const { MeshMessageType } = await import('../mesh/MeshProtocol');

                const meshAckPayload = JSON.stringify({
                    type: 'RESCUE_ACK',
                    signalId,
                    rescuerDeviceId,
                    rescuerUid: userId,
                    rescuerName,
                    rescuerLocation,
                    timestamp: Date.now(),
                });

                await meshNetworkService.broadcastMessage(meshAckPayload, MeshMessageType.TEXT);
                logger.info('✅ Rescue ACK also sent via BLE Mesh (offline backup)');
            } catch (meshErr) {
                logger.warn('Mesh ACK broadcast failed (non-critical):', meshErr);
            }
        } catch (error) {
            logger.error('Failed to send rescue ACK:', error);
        }
    }

    // ============================================================================
    // HEALTH PROFILE
    // ============================================================================

    /**
     * Load user's health profile from AsyncStorage for SOS broadcast.
     * Returns null if no health profile exists.
     */
    private async loadHealthProfile(): Promise<{
        bloodType?: string;
        allergies?: string;
        chronicConditions?: string;
        emergencyNotes?: string;
    } | null> {
        try {
            const { DirectStorage } = await import('../../utils/storage');
            const raw = DirectStorage.getString('@health_profile');
            if (!raw) return null;
            const profile = JSON.parse(raw);
            return {
                bloodType: profile.bloodType || undefined,
                allergies: profile.allergies || undefined,
                chronicConditions: profile.chronicConditions || undefined,
                emergencyNotes: profile.emergencyNotes || undefined,
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

    async getBatteryLevel(): Promise<number> {
        try {
            const level = await Battery.getBatteryLevelAsync();
            return Math.round(level * 100);
        } catch {
            return 100;
        }
    }
}

export const sosChannelRouter = new SOSChannelRouter();
export default sosChannelRouter;
