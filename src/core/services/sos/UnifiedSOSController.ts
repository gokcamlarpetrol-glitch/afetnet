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
    SOSAck,
} from './SOSStateManager';
import { sosChannelRouter } from './SOSChannelRouter';
import { sosBeaconService } from './SOSBeaconService';
import * as Location from 'expo-location';
import * as haptics from '../../utils/haptics';
import { getDeviceId } from '../../utils/device';

const logger = createLogger('UnifiedSOSController');

// ============================================================================
// CONFIGURATION
// ============================================================================

const SOS_CONFIG = {
    COUNTDOWN_SECONDS: 3,
    COUNTDOWN_TICK_MS: 1000,
    AUTO_LOCATION: true,
};

// ============================================================================
// UNIFIED SOS CONTROLLER CLASS
// ============================================================================

class UnifiedSOSController {
    private isInitialized = false;
    private countdownTimer: NodeJS.Timeout | null = null;
    private deviceId: string = '';

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Get device ID
            this.deviceId = await getDeviceId();

            // Initialize channel router
            await sosChannelRouter.initialize();

            this.isInitialized = true;
            logger.info('Unified SOS Controller initialized');
        } catch (error) {
            logger.error('Failed to initialize SOS Controller:', error);
        }
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

        // Heavy haptic feedback
        haptics.impactHeavy();
        haptics.notificationError();

        // Start countdown
        store.startCountdown(reason, message);

        // V5: Safe access to currentSignal with null check
        const currentSignal = useSOSStore.getState().currentSignal;
        if (currentSignal) {
            // Update signal with device ID using immer-style update
            useSOSStore.setState(state => ({
                currentSignal: state.currentSignal ? {
                    ...state.currentSignal,
                    userId: this.deviceId
                } : null
            }));
        }

        // Get initial location
        await this.fetchLocation();

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
            store.stopSOS();
            haptics.notificationSuccess();
            logger.info('Active SOS stopped');
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

        const store = useSOSStore.getState();

        // Cancel any existing countdown
        if (store.isCountingDown) {
            this.stopCountdownTimer();
        }

        // Create and activate signal immediately
        store.startCountdown(reason, message);

        if (store.currentSignal) {
            store.currentSignal.userId = this.deviceId;
        }

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
