/**
 * UNIFIED SOS CONTROLLER - ELITE V4
 * Central controller for all SOS operations
 * 
 * FEATURES:
 * - Multi-channel broadcasting (Firebase, Mesh, Backend, Push)
 * - Automatic detection (impact, inactivity, low battery)
 * - Countdown timer with cancellation
 * - ACK tracking
 * - Location updates
 * - Battery-optimized beaconing
 */

import { createLogger } from '../../utils/logger';
import {
    useSOSStore,
    EmergencyReason,
    SOSSignal,
    SOSLocation,
    SOSStatus,
    SOSAck,
    ChannelStatus,
} from './SOSStateManager';
import { sosChannelRouter } from './SOSChannelRouter';
import { sosBeaconService } from './SOSBeaconService';
import * as Location from 'expo-location';
import * as haptics from '../../utils/haptics';
import { Vibration } from 'react-native';
import { getDeviceId } from '../../utils/device';
import { fallDetectionService } from './FallDetectionService';

const logger = createLogger('UnifiedSOSController');

// ============================================================================
// CONFIGURATION
// ============================================================================

const SOS_CONFIG = {
    COUNTDOWN_SECONDS: 3,  // Default, overridden by user settings
    COUNTDOWN_TICK_MS: 1000,
    AUTO_LOCATION: true,
    // ELITE V2: Pre-cache location on app start for instant SOS attachment
    LOCATION_PRECACHE_INTERVAL_MS: 120_000,  // Refresh pre-cached location every 2 min (was 30s — too aggressive for battery)
};

// ============================================================================
// UNIFIED SOS CONTROLLER CLASS
// ============================================================================

class UnifiedSOSController {
    private isInitialized = false;
    private isDestroying = false;
    private countdownTimer: NodeJS.Timeout | null = null;
    private deviceId: string = '';
    private userId: string = ''; // Firebase Auth UID (NOT device ID)

    // ELITE V2: Pre-cached location (Noonlight pattern)
    // Location is fetched continuously so it's available INSTANTLY when SOS triggers
    private preCachedLocation: SOSLocation | null = null;
    private locationPrecacheTimer: NodeJS.Timeout | null = null;

    // ELITE V4: Ambient recording timer
    private ambientRecordingTimer: NodeJS.Timeout | null = null;
    private isAmbientRecording = false;

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        this.isDestroying = false;

        try {
            // Get device ID
            this.deviceId = await getDeviceId();

            // Resolve canonical sender UID for SOS attribution
            this.userId = await this.resolveCurrentUserId();

            // Initialize channel router
            await sosChannelRouter.initialize();

            // ELITE V2: Start pre-caching location for instant SOS (Noonlight pattern)
            this.startLocationPrecache();

            // ELITE V2: Start Fall & Crash Detection Sensor
            fallDetectionService.start();

            this.isInitialized = true;
            logger.info('Unified SOS Controller initialized');

            // CRITICAL FIX: Resume SOS after app crash/restart
            // If the persisted store says SOS is active but no beacons are running,
            // the user is trapped under rubble with a dead SOS — resume immediately.
            // NOTE: Recovery is best-effort. If it fails, SOS system is still initialized
            // and the user can trigger a new SOS manually.
            const store = useSOSStore.getState();
            if (store.isActive && store.currentSignal) {
                logger.warn('RECOVERING ACTIVE SOS after app restart — resuming beacons and alarm');
                try {
                    await Promise.race([
                        sosChannelRouter.broadcastSOS(store.currentSignal),
                        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Recovery broadcast timeout')), 8000)),
                    ]).catch(err => logger.error('SOS recovery broadcast failed/timed out:', err));
                    sosBeaconService.start();
                    if (!store.currentSignal.isSilent) {
                        this.startAlarmAndVibration();
                    }
                } catch (err) {
                    logger.error('SOS recovery broadcast failed:', err);
                }
            } else if (!store.isActive && store.isCountingDown && store.countdownStartedAt) {
                // CRITICAL FIX: Resume countdown from crash instead of clearing.
                // User pressed SOS, app crashed during 3s countdown — they still need help!
                const elapsed = Math.floor((Date.now() - store.countdownStartedAt) / 1000);
                const remaining = Math.max(0, SOS_CONFIG.COUNTDOWN_SECONDS - elapsed);
                if (remaining > 0) {
                    logger.warn(`Resuming SOS countdown from crash: ${remaining}s remaining`);
                    store.recalculateCountdown();
                    this.startCountdownTimer(); // Resume the setInterval
                } else {
                    logger.warn('SOS countdown expired during crash — activating immediately');
                    this.stopCountdownTimer(); // FIX: ensure no stale timer before activation
                    await this.activateSOS();
                }
            } else if (!store.isActive && (store.isCountingDown || store.currentSignal?.status === 'countdown')) {
                // countdownStartedAt missing — can't resume accurately, clear
                logger.warn('Clearing orphaned SOS countdown (no timestamp)');
                store.cancelCountdown();
            }
        } catch (error) {
            // CRITICAL FIX: Reset isInitialized on failure so future calls can re-init.
            // Without this, init failure → isInitialized stays true → future initialize()
            // calls return early at line 71 guard → SOS permanently disabled.
            this.isInitialized = false;
            logger.error('Failed to initialize SOS Controller:', error);
        }
    }

    // ELITE V2: Continuously pre-cache location so SOS has instant coordinates
    private startLocationPrecache(): void {
        // Clear any previous timer to prevent leak on repeated calls
        if (this.locationPrecacheTimer) {
            clearInterval(this.locationPrecacheTimer);
            this.locationPrecacheTimer = null;
        }

        // Fetch immediately
        this.refreshPrecachedLocation();

        // Then refresh periodically
        this.locationPrecacheTimer = setInterval(() => {
            this.refreshPrecachedLocation();
        }, SOS_CONFIG.LOCATION_PRECACHE_INTERVAL_MS);
    }

    private async refreshPrecachedLocation(): Promise<void> {
        try {
            // Use top-level Location import (not dynamic import which shadows it)
            // Without this check, getCurrentPositionAsync throws on iOS if not granted.
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            if (loc?.coords) {
                this.preCachedLocation = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    accuracy: loc.coords.accuracy || 0,
                    timestamp: Date.now(),
                    source: 'gps' as const,
                };
            }
        } catch {
            // Pre-cache failure is silent — location will be fetched on-demand as fallback
        }
    }

    private async resolveCurrentUserId(): Promise<string> {
        try {
            const { identityService } = await import('../IdentityService');
            await identityService.initialize().catch(e => { if (__DEV__) logger.debug('SOS: identity init best-effort:', e); });
            const identityUid = identityService.getUid();
            if (identityUid) {
                return identityUid;
            }
        } catch {
            // best effort
        }

        try {
            const { onAuthStateChanged } = await import('firebase/auth');
            const { getFirebaseAuth } = await import('../../../lib/firebase');
            const auth = getFirebaseAuth();
            const authUid = auth?.currentUser?.uid;
            if (authUid) {
                return authUid;
            }

            const waitedUid = await new Promise<string | null>((resolve) => {
                let settled = false;
                let unsubscribe: (() => void) | null = null;
                const finish = (value: string | null) => {
                    if (settled) return;
                    settled = true;
                    if (unsubscribe) {
                        try { unsubscribe(); } catch { /* no-op */ }
                        unsubscribe = null;
                    }
                    resolve(value);
                };

                const timer = setTimeout(() => finish(null), 2500);
                unsubscribe = onAuthStateChanged(auth, (user) => {
                    const uid = typeof user?.uid === 'string' ? user.uid.trim() : '';
                    if (!uid) return;
                    clearTimeout(timer);
                    finish(uid);
                });
            });

            if (waitedUid) {
                return waitedUid;
            }
        } catch {
            // best effort
        }

        return this.deviceId;
    }

    // ============================================================================
    // MAIN SOS TRIGGER
    // ============================================================================

    /**
     * Start SOS countdown sequence
     * User has 3 seconds to cancel before broadcast
     */
    async triggerSOS(
        reason: EmergencyReason = EmergencyReason.MANUAL_SOS,
        message: string = 'Acil yardım gerekiyor!',
        isSilent: boolean = false
    ): Promise<void> {
        await this.initialize();

        const store = useSOSStore.getState();

        // Check if already active
        if (store.isActive || store.isCountingDown) {
            logger.warn('SOS already in progress');
            return;
        }

        logger.warn('🆘 SOS TRIGGERED - Starting countdown');
        this.userId = await this.resolveCurrentUserId();

        // FIX 9: Auth pre-check — log warning if no authenticated user.
        // This is NOT a blocker (offline users still need mesh SOS), but provides
        // visibility into why Firebase channels may fail during broadcast.
        try {
            const { getFirebaseAuth } = await import('../../../lib/firebase');
            const auth = getFirebaseAuth();
            if (!auth?.currentUser?.uid) {
                logger.warn('No authenticated user — SOS will use device ID for mesh-only broadcast');
            }
        } catch {
            logger.warn('Auth check failed during SOS trigger — proceeding with mesh-only fallback');
        }

        // SOS haptic feedback — ALWAYS fires even if vibration is disabled
        // User MUST feel this to know SOS countdown started (e.g. pocket trigger)
        haptics.sosAlert();

        // Start countdown with resolved userId
        store.startCountdown(reason, this.userId || this.deviceId, message, isSilent);

        // ELITE V2: Use pre-cached location INSTANTLY (Noonlight pattern)
        // No delay — location was already fetched in background
        if (this.preCachedLocation) {
            useSOSStore.setState(state => ({
                currentSignal: state.currentSignal ? {
                    ...state.currentSignal,
                    location: this.preCachedLocation!
                } : null
            }));
            logger.info('📍 Pre-cached location attached to SOS instantly');
        }

        // Also fetch fresh location in parallel (will update if better)
        this.fetchLocation().catch(err => logger.error('SOS location fetch failed:', err));

        // Get device status
        await this.updateDeviceStatus();

        // Start countdown timer
        this.startCountdownTimer();
    }

    /**
     * Cancel SOS countdown (before activation)
     */
    cancelSOS(): void {
        const store = useSOSStore.getState();

        if (store.isCountingDown) {
            this.stopCountdownTimer();
            store.cancelCountdown();
            haptics.notificationSuccess();
            logger.info('SOS countdown cancelled');
        } else if (store.isActive) {
            // Stop active SOS
            sosBeaconService.stop();

            // CRITICAL FIX: Stop location precache timer to prevent battery drain
            if (this.locationPrecacheTimer) {
                clearInterval(this.locationPrecacheTimer);
                this.locationPrecacheTimer = null;
            }

            // ELITE V4: Stop alarm sound + vibration + ambient recording
            this.stopAlarmAndVibration().catch(e => { if (__DEV__) logger.warn('Stop alarm failed:', e); });
            this.stopAmbientRecording().catch(e => { if (__DEV__) logger.warn('Stop recording failed:', e); });

            // Stop ACK listener
            try {
                const { stopSOSAckListener } = require('./SOSAckListener');
                stopSOSAckListener();
            } catch { /* non-critical */ }

            // ELITE V2: Broadcast cancellation to ALL channels (Noonlight pattern)
            // Responders need to know the SOS was cancelled — LIFE-SAFETY CRITICAL
            const signal = store.currentSignal;
            if (signal) {
                this.broadcastCancellation(signal).catch(err => {
                    logger.error('❌ SOS cancellation broadcast failed — responders may still see active SOS:', err);
                });
            }

            // Deactivate emergency GPS mode
            try {
                const { familyTrackingService } = require('../FamilyTrackingService');
                familyTrackingService.setEmergencyMode(false);
            } catch { /* non-critical */ }

            store.stopSOS();
            haptics.notificationSuccess();
            logger.info('Active SOS stopped + cancellation broadcast sent');

            // Restart location precache for future SOS readiness
            this.startLocationPrecache();
        }
    }

    /**
     * Clean shutdown — stop all timers, fall detection, and reset initialization state.
     * Called from shutdownApp() on logout to prevent timer leaks across sessions.
     */
    destroy(): void {
        // CRITICAL: Set destroying flag BEFORE clearing timers to prevent
        // stale countdown ticks from calling activateSOS() after auth is destroyed.
        this.isDestroying = true;

        // Stop countdown if active
        this.stopCountdownTimer();

        // Stop location precache
        if (this.locationPrecacheTimer) {
            clearInterval(this.locationPrecacheTimer);
            this.locationPrecacheTimer = null;
        }

        // Stop alarm and ambient recording
        // CRITICAL FIX: Add .catch() — these are async methods called from synchronous destroy().
        // Without .catch(), rejected promises from whistleService.stop() or recording.stop()
        // cause unhandled promise rejections that can crash the app.
        this.stopAlarmAndVibration().catch(e => { if (__DEV__) logger.debug('Stop alarm error in destroy:', e); });
        this.stopAmbientRecording().catch(e => { if (__DEV__) logger.debug('Stop recording error in destroy:', e); });

        // Stop fall detection sensor
        fallDetectionService.stop();

        // Stop beacon
        sosBeaconService.stop();

        // Stop ACK listener to prevent Firestore leak during logout
        try {
            const { stopSOSAckListener } = require('./SOSAckListener');
            stopSOSAckListener();
        } catch { /* non-critical */ }

        // CRITICAL FIX: Broadcast cancellation before clearing state, so family/nearby
        // users stop seeing the active SOS. Without this, logout while SOS active leaves
        // family members seeing an active SOS indefinitely.
        try {
            const store = useSOSStore.getState();
            if (store.isActive && store.currentSignal) {
                this.broadcastCancellation(store.currentSignal).catch(e => {
                    if (__DEV__) logger.warn('Cancellation broadcast during destroy failed:', e);
                });
            }
            if (store.isActive || store.currentSignal || store.isCountingDown) {
                store.stopSOS();
                store.cancelCountdown();
            }
        } catch (e) { logger.error('SOS state clear failed on logout:', e); }

        // CRITICAL FIX: Reset concurrency guards and user identity state.
        // Without this, isActivating/isBroadcasting can remain true after destroy(),
        // preventing SOS activation on the next session after re-initialize().
        this.isActivating = false;
        this.isBroadcasting = false;
        this.userId = '';
        this.deviceId = '';
        this.preCachedLocation = null;

        this.isInitialized = false;
        logger.info('UnifiedSOSController destroyed');
    }

    // ELITE V2: Broadcast SOS cancellation to all channels
    // CRITICAL FIX: Only updateDoc existing documents — do NOT call broadcastSOS() with
    // cancel-prefixed signal. broadcastSOS creates NEW Firestore documents which trigger
    // Cloud Functions onCreate → sends NEW "emergency" push notifications for a CANCELLED SOS.
    private async broadcastCancellation(originalSignal: SOSSignal): Promise<void> {
        try {
            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
            const db = await getFirestoreInstanceAsync();
            if (db) {
                const { doc, updateDoc } = await import('firebase/firestore');
                const cancelData = { status: 'cancelled', cancelledAt: Date.now() };

                // 1. Update original broadcast document (NearbySOSListener watches for 'modified')
                await updateDoc(doc(db, 'sos_broadcasts', originalSignal.id), cancelData)
                    .catch(e => logger.warn('SOS: cancel broadcast update failed:', e));

                // 2. Update original signal document
                await updateDoc(doc(db, 'sos_signals', originalSignal.id), cancelData)
                    .catch(e => logger.warn('SOS: cancel signal update failed:', e));

                // 3. Update per-family-member alert documents
                // SOSAlertListener watches sos_alerts/{memberId}/items/{signalId}
                try {
                    const { useFamilyStore } = await import('../../stores/familyStore');
                    const members = useFamilyStore.getState().members;
                    if (members.length > 0) {
                        await Promise.allSettled(
                            members.flatMap(m => {
                                const ids = [m.uid, m.deviceId].filter(Boolean) as string[];
                                return ids.flatMap(id => [
                                    updateDoc(doc(db, 'sos_alerts', id, 'items', originalSignal.id), cancelData)
                                        .catch(e => logger.debug('SOS: cancel user alert best-effort:', e)),
                                    updateDoc(doc(db, 'devices', id, 'sos_alerts', originalSignal.id), cancelData)
                                        .catch(e => logger.debug('SOS: cancel device alert best-effort:', e)),
                                ]);
                            })
                        );
                        logger.info('✅ SOS cancellation propagated to family member alert documents');
                    }
                } catch (e) { logger.error('Family SOS cancellation broadcast failed:', e); }
            }

            // 4. Broadcast cancel via BLE mesh with explicit SOS_CANCEL type
            try {
                const { meshNetworkService } = await import('../mesh');
                const { MeshMessageType } = await import('../mesh/MeshProtocol');
                const { getInstallationId } = await import('../../../lib/installationId');
                const installationId = await getInstallationId().catch(() => '');
                const meshSenderId = installationId || originalSignal.userId || this.deviceId;

                const cancelPayload = JSON.stringify({
                    type: 'SOS_CANCEL',
                    originalSignalId: originalSignal.id,
                    senderUid: originalSignal.userId,
                    senderName: (() => { try { const { identityService: idSvc } = require('../IdentityService'); return idSvc.getDisplayName() || 'Kullanıcı'; } catch { return 'Kullanıcı'; } })(),
                    status: 'cancelled',
                    timestamp: Date.now(),
                });

                await meshNetworkService.broadcastMessage(cancelPayload, MeshMessageType.SOS, {
                    from: meshSenderId,
                    messageId: `cancel-${originalSignal.id}`,
                });
                logger.info('✅ SOS cancellation sent via BLE Mesh');
            } catch (meshErr) {
                logger.warn('Mesh cancel broadcast failed (non-critical):', meshErr);
            }

            logger.info('✅ SOS cancellation broadcast completed');
        } catch (error) {
            logger.error('Failed to broadcast SOS cancellation:', error);
        }
    }

    /**
     * Force immediate SOS (skip countdown)
     * For auto-triggered emergencies
     */
    async forceActivateSOS(
        reason: EmergencyReason,
        message: string = 'Otomatik algılandı: Acil yardım gerekiyor!',
        isSilent: boolean = false
    ): Promise<void> {
        await this.initialize();
        this.userId = await this.resolveCurrentUserId();

        const store = useSOSStore.getState();

        // Guard: don't create duplicate signal if SOS is already active
        if (store.isActive) {
            logger.warn('SOS already active, skipping forceActivate');
            return;
        }

        // Cancel any existing countdown — clear BOTH timer AND store state
        // Without cancelCountdown(), store remains isCountingDown=true if activateSOS
        // fails before store.activateSOS() is reached → UI stuck in countdown state.
        if (store.isCountingDown) {
            this.stopCountdownTimer();
            store.cancelCountdown();
        }

        // Create and activate signal immediately with resolved userId
        store.startCountdown(reason, this.userId || this.deviceId, message, isSilent);

        await this.fetchLocation();
        await this.updateDeviceStatus();

        // Skip countdown - activate immediately
        await this.activateSOS();
    }

    // ============================================================================
    // COUNTDOWN MANAGEMENT
    // ============================================================================

    private startCountdownTimer(): void {
        this.stopCountdownTimer();

        this.countdownTimer = setInterval(() => {
            // CRITICAL FIX: onCountdownTick is async — unhandled promise rejection from
            // setInterval callback can crash the app. Add .catch() for safety.
            this.onCountdownTick().catch(e => logger.error('Countdown tick error:', e));
        }, SOS_CONFIG.COUNTDOWN_TICK_MS);
    }

    private stopCountdownTimer(): void {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }

    private async onCountdownTick(): Promise<void> {
        // CRITICAL: Guard against stale ticks firing after destroy()
        if (this.isDestroying) {
            this.stopCountdownTimer();
            return;
        }

        const store = useSOSStore.getState();

        if (!store.isCountingDown) {
            this.stopCountdownTimer();
            return;
        }

        // Haptic tick
        haptics.impactMedium();

        // Decrement
        const remaining = store.decrementCountdown();

        logger.debug(`Countdown: ${remaining}`);

        // Check if countdown complete
        if (remaining <= 0) {
            this.stopCountdownTimer();
            await this.activateSOS();
        }
    }

    // ============================================================================
    // SOS ACTIVATION
    // ============================================================================

    private isActivating = false;
    private isBroadcasting = false;

    private async activateSOS(): Promise<void> {
        // Guard against double activation (countdown race condition)
        if (this.isActivating) return;
        this.isActivating = true;

        try {
            await this.activateSOSInternal();
        } finally {
            this.isActivating = false;
        }
    }

    private async activateSOSInternal(): Promise<void> {
        const store = useSOSStore.getState();
        const signal = store.currentSignal;

        if (!signal) {
            logger.error('No signal to activate');
            return;
        }

        logger.warn('🚨 SOS ACTIVATED - Broadcasting on all channels');

        // Final heavy haptic
        haptics.impactHeavy();
        haptics.notificationError();

        // Activate in store (sets status to 'broadcasting')
        store.activateSOS(signal);

        // Re-read signal from store AFTER activation to get correct status
        const activatedSignal = useSOSStore.getState().currentSignal;

        // LIFE-SAFETY: Broadcast with timeout + concurrency guard to prevent overlapping
        // broadcasts and to ensure SOS activation completes even if a channel hangs.
        if (!this.isBroadcasting) {
            this.isBroadcasting = true;
            try {
                await Promise.race([
                    sosChannelRouter.broadcastSOS(activatedSignal || signal),
                    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Broadcast timeout')), 8000)),
                ]);
            } catch (broadcastErr) {
                logger.error('SOS broadcast failed or timed out:', broadcastErr);
            } finally {
                this.isBroadcasting = false;
            }
        } else {
            logger.warn('SOS broadcast already in progress — skipping duplicate');
        }

        // Start beacon service
        await sosBeaconService.start();

        // ELITE: Activate emergency GPS mode (1s interval) for precise location tracking
        try {
            const { familyTrackingService } = await import('../FamilyTrackingService');
            familyTrackingService.setEmergencyMode(true);
        } catch { /* non-critical */ }

        // ELITE V4: Start SOS alarm sound if NOT silent
        if (!signal.isSilent) {
            this.startAlarmAndVibration();
        } else {
            logger.info('🔇 Silent SOS active - Alarm and continuous vibration skipped');
            try { Vibration.vibrate([0, 100, 100, 100], false); } catch { }
        }

        // ELITE V4: Start 10-second ambient sound recording
        this.startAmbientRecording(signal.id);

        // Start ACK listener so we get notified when rescuers respond
        try {
            const { startSOSAckListener } = await import('./SOSAckListener');
            await startSOSAckListener(this.deviceId);
        } catch (ackErr) {
            logger.warn('ACK listener start failed (non-critical):', ackErr);
        }

        // Track analytics
        this.trackSOSActivated(signal);
    }

    // ============================================================================
    // LOCATION
    // ============================================================================

    private async fetchLocation(): Promise<SOSLocation | null> {
        try {
            // CRITICAL FIX: Use getForegroundPermissionsAsync (check-only) instead of
            // requestForegroundPermissionsAsync (shows dialog). Permission dialogs during
            // SOS activation violate Apple guidelines — permissions must be pre-requested
            // during onboarding or first use, not during emergency flows.
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                logger.warn('Location permission not granted — skipping SOS location');
                useSOSStore.getState().updateDeviceStatus({ locationEnabled: false });
                return null;
            }

            useSOSStore.getState().updateDeviceStatus({ locationEnabled: true });

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const sosLocation: SOSLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy || 10,
                timestamp: Date.now(),
                source: 'gps',
            };

            useSOSStore.getState().updateLocation(sosLocation);
            return sosLocation;
        } catch (error) {
            logger.error('Failed to get location:', error);
            return null;
        }
    }

    // ============================================================================
    // DEVICE STATUS
    // ============================================================================

    private async updateDeviceStatus(): Promise<void> {
        const store = useSOSStore.getState();

        const [batteryLevel, networkStatus, meshPeers] = await Promise.all([
            sosChannelRouter.getBatteryLevel(),
            sosChannelRouter.getNetworkStatus(),
            this.getMeshPeerCount(),
        ]);

        store.updateDeviceStatus({
            batteryLevel,
            networkStatus,
            meshPeers,
        });
    }

    private async getMeshPeerCount(): Promise<number> {
        try {
            const { useMeshStore } = await import('../mesh/MeshStore');
            return useMeshStore.getState().peers.length;
        } catch {
            return 0;
        }
    }

    // ============================================================================
    // ACK HANDLING
    // ============================================================================

    /**
     * Process received ACK from rescuer
     */
    processAck(ack: SOSAck): void {
        const store = useSOSStore.getState();

        if (store.currentSignal) {
            store.addAck(ack);

            // Haptic notification
            haptics.notificationSuccess();

            logger.info(`✅ ACK received: ${ack.receiverName || ack.receiverId} (${ack.type})`);
        }
    }

    // ============================================================================
    // ELITE V4: ALARM SOUND + VIBRATION
    // ============================================================================

    private async startAlarmAndVibration(): Promise<void> {
        try {
            const { whistleService } = await import('../WhistleService');
            await whistleService.initialize();
            await whistleService.playSOSWhistle('continuous');
            logger.info('🔊 SOS alarm sound started');
        } catch (err) {
            logger.warn('Alarm sound failed (non-critical):', err);
        }

        // Continuous vibration pattern: 500ms on, 500ms off, repeating
        try {
            Vibration.vibrate([500, 500, 500, 500], true);
            logger.info('📳 SOS vibration started');
        } catch { /* non-critical */ }
    }

    private async stopAlarmAndVibration(): Promise<void> {
        try {
            const { whistleService } = await import('../WhistleService');
            await whistleService.stop();
            logger.info('🔇 SOS alarm sound stopped');
        } catch { /* non-critical */ }

        try {
            Vibration.cancel();
        } catch { /* non-critical */ }
    }

    // ============================================================================
    // ELITE V4: AMBIENT SOUND RECORDING (10 seconds)
    // ============================================================================

    private async startAmbientRecording(signalId: string): Promise<void> {
        if (this.isAmbientRecording) return;

        try {
            // CRITICAL FIX: Check microphone permission before recording.
            // Starting recording without permission violates Apple guidelines and crashes on iOS.
            const { getRecordingPermissionsAsync } = await import('expo-audio');
            const { status } = await getRecordingPermissionsAsync();
            if (status !== 'granted') {
                logger.warn('Microphone permission not granted — skipping ambient recording');
                return;
            }

            const { voiceMessageService } = await import('../VoiceMessageService');
            const started = await voiceMessageService.startRecording();
            if (!started) {
                logger.warn('Ambient recording failed to start');
                return;
            }

            this.isAmbientRecording = true;
            logger.info('🎙️ Ambient recording started (10s)');

            // Stop recording after 10 seconds and save to Firebase
            this.ambientRecordingTimer = setTimeout(async () => {
                await this.finishAmbientRecording(signalId);
            }, 10_000);
        } catch (err) {
            logger.warn('Ambient recording error:', err);
        }
    }

    private async finishAmbientRecording(signalId: string): Promise<void> {
        if (!this.isAmbientRecording) return;
        this.isAmbientRecording = false;
        this.ambientRecordingTimer = null;

        try {
            const { voiceMessageService } = await import('../VoiceMessageService');
            const recording = await voiceMessageService.stopRecording();
            if (!recording) {
                logger.warn('No ambient recording data');
                return;
            }

            logger.info('🎙️ Ambient recording completed, uploading to Firebase...');

            // Upload to Firebase Storage and get URL
            const audioUrl = await voiceMessageService.backupToFirebase(recording);
            if (audioUrl) {
                // Save audio URL to sos_signals/{signalId}/audio_url in Firestore
                try {
                    const { getFirestoreInstanceAsync } = await import(
                        '../firebase/FirebaseInstanceManager'
                    );
                    const db = await getFirestoreInstanceAsync();
                    if (db) {
                        const { doc, setDoc } = await import('firebase/firestore');
                        await setDoc(
                            doc(db, 'sos_signals', signalId),
                            { audio_url: audioUrl, audio_timestamp: Date.now() },
                            { merge: true },
                        );
                        logger.info('✅ Ambient recording saved to Firestore:', audioUrl);
                    }
                } catch (fsErr) {
                    logger.warn('Failed to save audio URL to Firestore:', fsErr);
                }
            }
        } catch (err) {
            logger.warn('Ambient recording finish error:', err);
        }
    }

    private async stopAmbientRecording(): Promise<void> {
        if (this.ambientRecordingTimer) {
            clearTimeout(this.ambientRecordingTimer);
            this.ambientRecordingTimer = null;
        }

        if (this.isAmbientRecording) {
            this.isAmbientRecording = false;
            try {
                const { voiceMessageService } = await import('../VoiceMessageService');
                await voiceMessageService.cancelRecording();
            } catch { /* non-critical */ }
        }
    }

    // ============================================================================
    // ANALYTICS
    // ============================================================================

    private trackSOSActivated(signal: SOSSignal): void {
        try {
            const { firebaseAnalyticsService } = require('../FirebaseAnalyticsService');
            firebaseAnalyticsService.logEvent('sos_activated', {
                signalId: signal.id,
                reason: signal.reason,
                trapped: String(signal.trapped),
                hasLocation: String(!!signal.location),
                batteryLevel: String(signal.device.batteryLevel),
                networkStatus: signal.device.networkStatus,
                meshPeers: String(signal.device.meshPeers),
            });
        } catch {
            // Analytics is non-critical
        }
    }

    // ============================================================================
    // GETTERS
    // ============================================================================

    isSOSActive(): boolean {
        return useSOSStore.getState().isActive;
    }

    isCountingDown(): boolean {
        return useSOSStore.getState().isCountingDown;
    }

    getCountdownSeconds(): number {
        return useSOSStore.getState().countdownSeconds;
    }

    getCurrentSignal(): SOSSignal | null {
        return useSOSStore.getState().currentSignal;
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const unifiedSOSController = new UnifiedSOSController();
export default unifiedSOSController;
