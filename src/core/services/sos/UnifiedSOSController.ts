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
import { isApprovedFamilyMember } from '../../utils/familyApproval';

const logger = createLogger('UnifiedSOSController');

// ============================================================================
// CONFIGURATION
// ============================================================================

const SOS_CONFIG = {
    // P0-4: COUNTDOWN_SECONDS is now a FALLBACK only. The real per-trigger
    // duration is decided in SOSStateManager.startCountdown:
    //   • Manual SOS         → 5 seconds  (DEFAULT_COUNTDOWN)
    //   • Fall / crash / inactivity / trapped detection → 30 seconds (AUTO_TRIGGER_COUNTDOWN)
    // This value is only used by legacy resume paths when the persisted store
    // is missing a countdownTotalSeconds snapshot.
    COUNTDOWN_SECONDS: 5,
    COUNTDOWN_TICK_MS: 1000,
    AUTO_LOCATION: true,
    // ELITE V2: Pre-cache location on app start for instant SOS attachment
    LOCATION_PRECACHE_INTERVAL_MS: 120_000,  // Refresh pre-cached location every 2 min (was 30s — too aggressive for battery)
    MAX_PRECACHE_LOCATION_AGE_MS: 180_000,
    MAX_SOS_LOCATION_FUTURE_SKEW_MS: 60_000,
};

function isUsableSOSLocation(location: SOSLocation | null | undefined, maxAgeMs = SOS_CONFIG.MAX_PRECACHE_LOCATION_AGE_MS): location is SOSLocation {
    if (!location) return false;
    const now = Date.now();
    // typeof NaN === 'number' — reject NaN at assignment so downstream is finite-only.
    const accuracy = (typeof location.accuracy === 'number' && Number.isFinite(location.accuracy))
        ? location.accuracy
        : Number.POSITIVE_INFINITY;
    return Number.isFinite(location.latitude)
        && Number.isFinite(location.longitude)
        && location.latitude >= -90
        && location.latitude <= 90
        && location.longitude >= -180
        && location.longitude <= 180
        // WP-3.3: (0,0) "Null Island" reddi — GPS fix alamadığında veya konum izni
        // yokken bazı API'lar (0,0) döndürür. Gerçek kullanıcı okyanus ortasından
        // SOS göndermez; (0,0) ile SOS kurtarma ekibini yanlış konuma yönlendirir.
        // (0,0) → konum kullanılamaz → SOS konumsuz gider (sunucu tüm kullanıcılara yayar).
        && !(location.latitude === 0 && location.longitude === 0)
        && Number.isFinite(accuracy)
        && accuracy >= 0
        && accuracy <= 5000
        && Number.isFinite(location.timestamp)
        && location.timestamp <= now + SOS_CONFIG.MAX_SOS_LOCATION_FUTURE_SKEW_MS
        && now - location.timestamp <= maxAgeMs;
}

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

    // Sprint Audit FIX A1: ACK timeout tracker for SOS channels
    private ackTimeoutTimer: NodeJS.Timeout | null = null;
    private static readonly ACK_TIMEOUT_MS = 60_000;

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
                // CRITICAL FIX (SOS-M8): Reject stale recovery — if SOS signal is >30 minutes old,
                // user has likely been rescued or the SOS was forgotten on a charging device.
                // Resuming an ancient broadcast spams rescue teams with false-positive alerts.
                const signalAge = Date.now() - (store.currentSignal.timestamp ?? 0);
                const MAX_RECOVERY_AGE_MS = 30 * 60 * 1000; // 30 minutes
                if (signalAge > MAX_RECOVERY_AGE_MS) {
                    logger.warn(`SOS recovery REJECTED — signal ${Math.floor(signalAge / 60000)}min old (max 30min)`);
                    try {
                        // Best-effort cancellation broadcast so any in-flight rescuers stand down
                        await this.broadcastCancellation(store.currentSignal).catch(() => { /* */ });
                    } catch { /* */ }
                    store.stopSOS();
                } else {
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
                        // CRITICAL FIX (SOS-H5): Restart fall detection on recovery path.
                        // initialize() line 88 only starts on first init; recovery path bypassed it,
                        // leaving fall detection inactive on resumed SOS. Secondary fall undetected.
                        fallDetectionService.start();
                    } catch (err) {
                        logger.error('SOS recovery broadcast failed:', err);
                    }
                }
            } else if (!store.isActive && store.isCountingDown && store.countdownStartedAt) {
                // CRITICAL FIX: Resume countdown from crash instead of clearing.
                // User pressed SOS, app crashed during countdown — they still need help!
                // P0-4: countdownTotalSeconds is persisted by the store, so we honour
                // the original 5s/30s decision rather than collapsing to a static config.
                const totalSeconds = typeof store.countdownTotalSeconds === 'number' && store.countdownTotalSeconds > 0
                    ? store.countdownTotalSeconds
                    : SOS_CONFIG.COUNTDOWN_SECONDS;
                const elapsed = Math.floor((Date.now() - store.countdownStartedAt) / 1000);
                const remaining = Math.max(0, totalSeconds - elapsed);
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
                const candidate: SOSLocation = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    accuracy: loc.coords.accuracy || 0,
                    timestamp: Date.now(),
                    source: 'gps' as const,
                };
                if (isUsableSOSLocation(candidate)) {
                    this.preCachedLocation = candidate;
                }
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
     * Start SOS countdown sequence.
     *
     * P0-4 — Countdown durations:
     *   • Manual SOS (button tap)             → 5 seconds
     *   • Fall / crash / inactivity / trapped → 30 seconds (Apple Watch standard)
     *   • Explicit `countdownSeconds` override → that value (clamped 1..60)
     */
    async triggerSOS(
        reason: EmergencyReason = EmergencyReason.MANUAL_SOS,
        message: string = 'Acil yardım gerekiyor!',
        isSilent: boolean = false,
        countdownSeconds?: number,
    ): Promise<void> {
        await this.initialize();

        const store = useSOSStore.getState();

        // KRİTİK (görev #17): Bayat/zombie kaçış kapısı — forceActivateSOS ile aynı.
        // Önceki kod isActive/isCountingDown'da KOŞULSUZ return ediyordu; 30dk+ eski
        // (uygulama çökmesinden orphan kalmış) ya da isActive=true + currentSignal=null
        // (zombie) durumda kullanıcının yeni SOS'u SESSİZCE düşüyordu. Manuel SOS
        // countdown'lı olduğundan iptal yarışı yok — cancelSOS() güvenle kullanılır.
        if (store.isActive && store.currentSignal) {
            const ageMs = Date.now() - (store.currentSignal.timestamp ?? 0);
            const MAX_RECOVERY_AGE_MS = 30 * 60 * 1000;
            if (ageMs > MAX_RECOVERY_AGE_MS) {
                logger.warn(`triggerSOS: mevcut sinyal ${Math.floor(ageMs / 60000)}dk eski — yeni SOS öncesi iptal ediliyor`);
                try {
                    await this.cancelSOS();
                } catch (err) {
                    logger.error('triggerSOS: bayat SOS iptali başarısız:', err);
                }
            } else {
                logger.warn('SOS zaten aktif (taze) — triggerSOS atlanıyor');
                return;
            }
        } else if (store.isActive) {
            logger.warn('SOS currentSignal olmadan aktif (zombie) — startCountdown ile üzerine yazılıyor');
        } else if (store.isCountingDown) {
            logger.warn('SOS countdown zaten sürüyor — triggerSOS atlanıyor');
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
        // P0-4: pass through optional countdownSeconds (UI override) — defaults
        // to 5s manual / 30s auto inside startCountdown.
        store.startCountdown(reason, this.userId || this.deviceId, message, isSilent, countdownSeconds);

        // ELITE V2: Use pre-cached location INSTANTLY (Noonlight pattern)
        // No delay — location was already fetched in background
        if (isUsableSOSLocation(this.preCachedLocation)) {
            useSOSStore.setState(state => ({
                currentSignal: state.currentSignal ? {
                    ...state.currentSignal,
                    location: this.preCachedLocation!
                } : null
            }));
            logger.info('📍 Pre-cached location attached to SOS instantly');
        } else if (this.preCachedLocation) {
            logger.warn('SOS pre-cached location ignored because it is stale or invalid');
            this.preCachedLocation = null;
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

            // Sprint Audit FIX A1: Stop ACK timeout tracker
            this.stopAckTimeoutTracker();

            // Sprint Audit FIX A7: Cancel pending channel retries
            try {
                sosChannelRouter.cancelChannelRetry();
            } catch { /* */ }

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

            // LIFE-SAFETY: Return mesh power manager to normal mode (battery-aware scan)
            try {
                const { meshPowerManager } = require('../mesh/MeshPowerManager');
                if (typeof meshPowerManager.disableEmergencyMode === 'function') {
                    meshPowerManager.disableEmergencyMode();
                    logger.info('🔋 Mesh emergency mode disabled (back to battery-aware)');
                }
            } catch { /* non-critical */ }

            store.stopSOS();
            haptics.notificationSuccess();
            logger.info('Active SOS stopped + cancellation broadcast sent');

            // Restart location precache for future SOS readiness
            this.startLocationPrecache();
        }
    }

    /**
     * KRİTİK (görev #17): Bayat (orphan) bir aktif SOS'u, hemen ardından YENİ bir
     * SOS aktive edilecekken temizler. cancelSOS()'tan farkı: mesh emergency mode'u
     * KAPATMAZ ve location precache'i yeniden başlatmaz — çünkü yeni SOS aktivasyonu
     * zaten emergency mode'u açacaktır; cancelSOS()'un await'siz disableEmergencyMode()
     * çağrısı yeni enableEmergencyMode() ile yarışıp mesh'i yanlışlıkla kapalı
     * bırakabilirdi. İptal yayını burada AWAIT edilir.
     */
    private async supersedeStaleSOS(staleSignal: SOSSignal): Promise<void> {
        sosBeaconService.stop();
        this.stopAckTimeoutTracker();
        try { sosChannelRouter.cancelChannelRetry(); } catch { /* non-critical */ }
        this.stopAlarmAndVibration().catch(e => { if (__DEV__) logger.warn('Supersede: stop alarm failed:', e); });
        this.stopAmbientRecording().catch(e => { if (__DEV__) logger.warn('Supersede: stop recording failed:', e); });
        try {
            const { stopSOSAckListener } = require('./SOSAckListener');
            stopSOSAckListener();
        } catch { /* non-critical */ }
        // İptal yayınını AWAIT et — eski signalId'nin cancel'ı yeni SOS yayınından
        // önce gitsin (responder'lar eski SOS'u kapatsın).
        try {
            await this.broadcastCancellation(staleSignal);
        } catch (err) {
            logger.error('Supersede: bayat SOS iptal yayını başarısız:', err);
        }
        useSOSStore.getState().stopSOS();
        // NOT: disableEmergencyMode() ve startLocationPrecache() çağrılmaz — yeni SOS
        // aktivasyonu emergency mode'u kuracak; precache zaten sürüyor.
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
    //
    // P0-1: If the device is offline when the user cancels, the cloud updates
    // here silently disappear (Firestore on RN has no persistent cache for
    // setDoc/updateDoc). We queue the cancellation to an MMKV outbox via
    // sosChannelRouter so it can be replayed when connectivity returns. The
    // mesh broadcast (step 4) still happens immediately and is unaffected.
    private async broadcastCancellation(originalSignal: SOSSignal): Promise<void> {
        // P0-1: Always enqueue the cancel into the outbox first. processCloudOutbox()
        // will reconcile, dedup, and drive retries; if we're already online the
        // immediate calls below will normally win the race and the outbox entry
        // will short-circuit on its next pass.
        try {
            await sosChannelRouter.queueCancelToOutbox(originalSignal.id);
        } catch (queueErr) {
            // Non-fatal: we still attempt the immediate cloud updates below.
            if (__DEV__) logger.debug('SOS: cancel outbox enqueue failed (non-fatal):', queueErr);
        }

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
                    const members = useFamilyStore.getState().members.filter(isApprovedFamilyMember);
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

                const cancelSenderName = (() => { try { const { identityService: idSvc } = require('../IdentityService'); return idSvc.getDisplayName() || 'Kullanıcı'; } catch { return 'Kullanıcı'; } })();

                // KRİTİK (görev #17): SOS_CANCEL'ı 3 kez, farklı messageId'lerle yay.
                // Tek fire-and-forget cancel paketi — yalnızca periyodik beacon gören
                // (ilk SOS broadcast'ini kaçırmış) mesh eşlerince kaçırılabilir; o
                // zaman harita işareti sonsuza dek "aktif" kalır. 3 bağımsız messageId
                // mesh dedup'a takılmadan 3 ayrı yayılma şansı verir.
                for (let attempt = 0; attempt < 3; attempt++) {
                    const cancelPayload = JSON.stringify({
                        type: 'SOS_CANCEL',
                        originalSignalId: originalSignal.id,
                        senderUid: originalSignal.userId,
                        senderName: cancelSenderName,
                        status: 'cancelled',
                        timestamp: Date.now(),
                    });
                    await meshNetworkService.broadcastMessage(cancelPayload, MeshMessageType.SOS, {
                        from: meshSenderId,
                        messageId: `cancel-${originalSignal.id}-${attempt}`,
                    });
                    if (attempt < 2) {
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                }
                logger.info('✅ SOS cancellation sent via BLE Mesh (3x redundant)');
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

        // Guard: don't create duplicate signal if SOS is already active.
        // BUT: if the existing signal is stale (>30min, e.g. orphaned by app crash
        // before init recovery ran), cancel it first so this auto-trigger (fall/crash
        // detection) is not silently dropped. cancelSOS() preserves signalHistory.
        if (store.isActive && store.currentSignal) {
            const ageMs = Date.now() - (store.currentSignal.timestamp ?? 0);
            const MAX_RECOVERY_AGE_MS = 30 * 60 * 1000;
            if (ageMs > MAX_RECOVERY_AGE_MS) {
                logger.warn(`forceActivateSOS: existing signal ${Math.floor(ageMs / 60000)}min old — cancelling stale before re-activating`);
                try {
                    // KRİTİK (görev #17): cancelSOS() yerine supersedeStaleSOS() —
                    // cancelSOS() mesh emergency mode'u (await'siz) KAPATIR; bu,
                    // hemen ardından gelen activateSOS()'un enableEmergencyMode()
                    // çağrısıyla yarışır (countdown buffer'ı olmayan bu yolda).
                    await this.supersedeStaleSOS(store.currentSignal);
                } catch (err) {
                    logger.error('Stale SOS supersede failed in forceActivate:', err);
                }
                // supersedeStaleSOS calls store.stopSOS() → isActive=false now.
            } else {
                logger.warn('SOS already active (fresh), skipping forceActivate');
                return;
            }
        } else if (store.isActive) {
            // isActive=true but currentSignal=null is a zombie state. stopSOS()
            // early-returns when currentSignal is null, so the flag stays stuck.
            // Fall through and let startCountdown() create a fresh signal — store
            // will overwrite isActive when activateSOS() runs. NEVER call reset()
            // here: it wipes signalHistory + incoming alerts (logout-only behavior).
            logger.warn('SOS active without currentSignal (zombie state) — overwriting via startCountdown');
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

        // Sprint 18-19: Multi-device gate — only PRIMARY device fires SOS broadcast.
        // Secondary devices still see countdown and local UX but don't duplicate Firestore writes,
        // mesh broadcasts, or push notifications. Primary device handles all delivery channels.
        try {
            const { multiDeviceService } = await import('../MultiDeviceService');
            if (!multiDeviceService.isPrimaryDevice()) {
                logger.warn('SOS activate: SECONDARY device — skipping broadcast (primary device handles it)');
                // Still mark state locally so user sees consistent UI
                const store = useSOSStore.getState();
                if (store.currentSignal) {
                    store.activateSOS(store.currentSignal);
                }
                return;
            }
        } catch (e) {
            // Service not available → continue (single-device user)
            logger.debug('Multi-device check skipped:', e);
        }

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

        // SOS ACK TIMEOUT TRACKER (Sprint Audit FIX A1):
        // After 60s, any channel still 'sent' (no ACK) is downgraded to 'unconfirmed'.
        // This prevents misleading "all green checkmarks" UI when nobody actually responded.
        // Life-safety transparency: user knows if rescue team really got the signal.
        this.startAckTimeoutTracker();

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

        // LIFE-SAFETY: Activate mesh emergency mode — aggressive BLE scan + advertising
        // even on low battery. Without this, BatteryOptimizedScanner may throttle scans
        // and trapped survivors' devices won't relay packets.
        // Battery is irrelevant if the user is buried; mesh propagation is the priority.
        try {
            const { meshPowerManager } = await import('../mesh/MeshPowerManager');
            await meshPowerManager.enableEmergencyMode();
            logger.warn('🚨 Mesh emergency mode ACTIVE (full-power scan + advertise)');
        } catch (powerErr) {
            logger.warn('Mesh emergency mode failed (non-critical):', powerErr);
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

            // 1) Önce gerçek-zamanlı GPS dene (yüksek doğruluk).
            try {
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
                if (isUsableSOSLocation(sosLocation)) {
                    useSOSStore.getState().updateLocation(sosLocation);
                    return sosLocation;
                }
                logger.warn('SOS gerçek-zamanlı GPS reddedildi (koordinat/doğruluk/zaman damgası) — son-bilinen konuma düşülüyor');
            } catch (liveErr) {
                logger.warn('SOS gerçek-zamanlı GPS başarısız — son-bilinen konuma düşülüyor:', liveErr);
            }

            // 2) (görev #4): OS-önbellekli SON-BİLİNEN konuma düş — dakika/saat eski
            // bile olsa hiç olmamasından İYİDİR. responder'lara "kullanıcı şurada
            // son görüldü" bilgisi verir; CF onSOSBroadcast proximity matcher'ı bu
            // koordinatla kurtarıcı bulabilir. Konum kaynağı 'cached' damgalanır —
            // alıcılar tazeliği görsün.
            try {
                const lastKnown = await Location.getLastKnownPositionAsync({
                    maxAge: 60 * 60 * 1000, // 1 saat — life-safety: eski bile değerli
                });
                if (lastKnown && Number.isFinite(lastKnown.coords.latitude) && Number.isFinite(lastKnown.coords.longitude)) {
                    const lastKnownTs = typeof lastKnown.timestamp === 'number' && Number.isFinite(lastKnown.timestamp)
                        ? lastKnown.timestamp
                        : Date.now();
                    // (deep-review): accuracy alanı için ?? kullan (|| 1000 honest-0'ı
                    // 1000'e çevirirdi). Yine de Number.isFinite ile guard.
                    const rawAccuracy = lastKnown.coords.accuracy;
                    const accuracy = (typeof rawAccuracy === 'number' && Number.isFinite(rawAccuracy) && rawAccuracy >= 0)
                        ? rawAccuracy
                        : 1000;
                    const fallback: SOSLocation = {
                        latitude: lastKnown.coords.latitude,
                        longitude: lastKnown.coords.longitude,
                        accuracy,
                        timestamp: lastKnownTs,
                        source: 'cached',
                    };
                    // (deep-review CRITICAL): isUsableSOSLocation'ı koş ama 1 saatlik
                    // genişletilmiş maxAge ile (life-safety: cached yol). Bu kontrol
                    // (0,0) Null Island reddi, accuracy ≤ 5000m sınırı, future-skew
                    // reddi ve lat/lon bounds'larını ortak validate ediyor. Eksikse
                    // (örn. iOS bazen accuracy=-1 döndürür → reject) konumsuz git;
                    // SOS yine mesh/family/firebase kanallarından ulaşır.
                    if (!isUsableSOSLocation(fallback, 60 * 60 * 1000)) {
                        logger.warn('Son-bilinen konum geçerlilik kontrolünden geçmedi (Null Island / accuracy / future-skew) — konumsuz devam');
                    } else {
                        const ageSec = Math.floor((Date.now() - lastKnownTs) / 1000);
                        logger.warn(`SOS son-bilinen konum kullanılıyor (yaş ${ageSec}sn) — gerçek-zamanlı GPS yok`);
                        useSOSStore.getState().updateLocation(fallback);
                        return fallback;
                    }
                }
            } catch (lastErr) {
                logger.warn('Son-bilinen konum fetch de başarısız:', lastErr);
            }

            return null; // hiçbir konum yok — mesh + family + push hâlâ çalışır
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

    /**
     * Sprint Audit FIX A1: SOS ACK timeout tracker.
     * After 60s, any channel still in 'sent' state is downgraded to 'unconfirmed'
     * to communicate that no actual ACK was received from rescue team.
     * This prevents the misleading UX where 6/6 green checkmarks suggest "all delivered"
     * when in reality only fire-and-forget transmissions occurred.
     */
    private startAckTimeoutTracker(): void {
        if (this.ackTimeoutTimer) {
            clearTimeout(this.ackTimeoutTimer);
            this.ackTimeoutTimer = null;
        }
        this.ackTimeoutTimer = setTimeout(() => {
            try {
                const store = useSOSStore.getState();
                const signal = store.currentSignal;
                if (!signal || !store.isActive) return;
                const channels = signal.channels;
                let downgradeCount = 0;
                for (const channelKey of Object.keys(channels) as Array<keyof typeof channels>) {
                    if (channels[channelKey] === 'sent') {
                        store.updateChannelStatus(channelKey, 'unconfirmed');
                        downgradeCount++;
                    }
                }
                if (downgradeCount > 0) {
                    logger.warn(`🟡 SOS ACK timeout: ${downgradeCount} channel(s) downgraded 'sent' → 'unconfirmed'`);
                }
            } catch (e) {
                logger.error('ACK timeout tracker error:', e);
            }
        }, UnifiedSOSController.ACK_TIMEOUT_MS);
    }

    private stopAckTimeoutTracker(): void {
        if (this.ackTimeoutTimer) {
            clearTimeout(this.ackTimeoutTimer);
            this.ackTimeoutTimer = null;
        }
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
            const { useSettingsStore } = await import('../../stores/settingsStore');
            if (!useSettingsStore.getState().sosAmbientAudioEnabled) {
                logger.info('SOS ambient recording disabled by user preference');
                return;
            }

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
                        await this.shareAmbientAudioWithApprovedFamily(signalId, audioUrl);
                    }
                } catch (fsErr) {
                    logger.warn('Failed to save audio URL to Firestore:', fsErr);
                }
            }
        } catch (err) {
            logger.warn('Ambient recording finish error:', err);
        }
    }

    private async shareAmbientAudioWithApprovedFamily(signalId: string, audioUrl: string): Promise<void> {
        try {
            const { useFamilyStore } = await import('../../stores/familyStore');
            const members = useFamilyStore.getState().members.filter(isApprovedFamilyMember);
            if (members.length === 0) return;

            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
            const db = await getFirestoreInstanceAsync();
            if (!db) return;

            const { doc, updateDoc } = await import('firebase/firestore');
            const targetIds = new Set<string>();
            members.forEach(member => {
                if (member.uid) targetIds.add(member.uid);
                if (member.deviceId) targetIds.add(member.deviceId);
            });

            const audioPatch = {
                audio_url: audioUrl,
                audio_timestamp: Date.now(),
                audio_consent: true,
            };

            const updates: Promise<unknown>[] = [];
            targetIds.forEach(targetId => {
                updates.push(updateDoc(doc(db, 'sos_alerts', targetId, 'items', signalId), audioPatch));
                updates.push(updateDoc(doc(db, 'devices', targetId, 'sos_alerts', signalId), audioPatch));
            });

            const results = await Promise.allSettled(updates);
            const successCount = results.filter(result => result.status === 'fulfilled').length;
            if (successCount === 0 && updates.length > 0) {
                logger.warn('Ambient audio family fan-out had no successful alert updates');
            } else {
                logger.info(`✅ Ambient audio shared to approved family alert paths (${successCount}/${updates.length})`);
            }
        } catch (error) {
            logger.warn('Ambient audio family sharing failed:', error);
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
