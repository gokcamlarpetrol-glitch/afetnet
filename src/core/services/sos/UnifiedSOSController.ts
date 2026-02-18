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

const logger = createLogger('UnifiedSOSController');

// ============================================================================
// CONFIGURATION
// ============================================================================

const SOS_CONFIG = {
    COUNTDOWN_SECONDS: 3,  // Default, overridden by user settings
    COUNTDOWN_TICK_MS: 1000,
    AUTO_LOCATION: true,
    // ELITE V2: Pre-cache location on app start for instant SOS attachment
    LOCATION_PRECACHE_INTERVAL_MS: 30_000,  // Refresh pre-cached location every 30s
};

// ============================================================================
// UNIFIED SOS CONTROLLER CLASS
// ============================================================================

class UnifiedSOSController {
    private isInitialized = false;
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

        try {
            // Get device ID
            this.deviceId = await getDeviceId();

            // Resolve canonical sender UID for SOS attribution
            this.userId = await this.resolveCurrentUserId();

            // Initialize channel router
            await sosChannelRouter.initialize();

            // ELITE V2: Start pre-caching location for instant SOS (Noonlight pattern)
            this.startLocationPrecache();

            this.isInitialized = true;
            logger.info('Unified SOS Controller initialized');
        } catch (error) {
            logger.error('Failed to initialize SOS Controller:', error);
        }
    }

    // ELITE V2: Continuously pre-cache location so SOS has instant coordinates
    private startLocationPrecache(): void {
        // Fetch immediately
        this.refreshPrecachedLocation();

        // Then refresh periodically
        this.locationPrecacheTimer = setInterval(() => {
            this.refreshPrecachedLocation();
        }, SOS_CONFIG.LOCATION_PRECACHE_INTERVAL_MS);
    }

    private async refreshPrecachedLocation(): Promise<void> {
        try {
            const Location = await import('expo-location');
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
            const identityUid = identityService.getUid();
            if (identityUid) {
                return identityUid;
            }
        } catch {
            // best effort
        }

        try {
            const { getAuth } = await import('firebase/auth');
            const authUid = getAuth()?.currentUser?.uid;
            if (authUid) {
                return authUid;
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
        message: string = 'Acil yardım gerekiyor!'
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

        // Heavy haptic feedback
        haptics.impactHeavy();
        haptics.notificationError();

        // Start countdown with resolved userId
        store.startCountdown(reason, this.userId || this.deviceId, message);

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
        this.fetchLocation();

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

            // ELITE V4: Stop alarm sound + vibration + ambient recording
            this.stopAlarmAndVibration();
            this.stopAmbientRecording();

            // Stop ACK listener
            try {
                const { stopSOSAckListener } = require('./SOSAckListener');
                stopSOSAckListener();
            } catch { /* non-critical */ }

            // ELITE V2: Broadcast cancellation to ALL channels (Noonlight pattern)
            // Responders need to know the SOS was cancelled
            const signal = store.currentSignal;
            if (signal) {
                this.broadcastCancellation(signal).catch(err => {
                    logger.warn('SOS cancellation broadcast failed:', err);
                });
            }

            store.stopSOS();
            haptics.notificationSuccess();
            logger.info('Active SOS stopped + cancellation broadcast sent');
        }
    }

    // ELITE V2: Broadcast SOS cancellation to all channels
    private async broadcastCancellation(originalSignal: SOSSignal): Promise<void> {
        const cancellationSignal: SOSSignal = {
            ...originalSignal,
            id: `cancel-${originalSignal.id}`,
            status: 'cancelled' as SOSStatus,
            message: `SOS İPTAL EDİLDİ: ${originalSignal.message || 'Acil durum iptal edildi'}`,
            timestamp: Date.now(),
        };

        try {
            await sosChannelRouter.broadcastSOS(cancellationSignal);
            logger.info('✅ SOS cancellation broadcast sent to all channels');
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
        message: string = 'Otomatik algılandı: Acil yardım gerekiyor!'
    ): Promise<void> {
        await this.initialize();
        this.userId = await this.resolveCurrentUserId();

        const store = useSOSStore.getState();

        // Cancel any existing countdown
        if (store.isCountingDown) {
            this.stopCountdownTimer();
        }

        // Create and activate signal immediately with resolved userId
        store.startCountdown(reason, this.userId || this.deviceId, message);

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
            this.onCountdownTick();
        }, SOS_CONFIG.COUNTDOWN_TICK_MS);
    }

    private stopCountdownTimer(): void {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }

    private async onCountdownTick(): Promise<void> {
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

    private async activateSOS(): Promise<void> {
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

        // Activate in store
        store.activateSOS(signal);

        // Broadcast through all channels
        await sosChannelRouter.broadcastSOS(signal);

        // Start beacon service
        await sosBeaconService.start();

        // ELITE V4: Start SOS alarm sound + continuous vibration
        this.startAlarmAndVibration();

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
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                logger.warn('Location permission denied');
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
