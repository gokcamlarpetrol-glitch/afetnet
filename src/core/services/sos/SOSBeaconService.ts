/**
 * SOS BEACON SERVICE - ELITE V4
 * Periodic emergency beacon broadcasting
 * 
 * FEATURES:
 * - Adaptive beacon intervals (battery-aware)
 * - Location updates
 * - ACK monitoring
 * - Background operation
 */

import { createLogger } from '../../utils/logger';
import { useSOSStore, SOSLocation } from './SOSStateManager';
import { sosChannelRouter } from './SOSChannelRouter';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { AppState, AppStateStatus } from 'react-native';

const logger = createLogger('SOSBeaconService');

// ============================================================================
// CONFIGURATION
// ============================================================================

const BEACON_CONFIG = {
    // Interval tiers (milliseconds)
    HIGH_BATTERY_INTERVAL: 5000,      // 5 seconds (battery > 50%)
    MEDIUM_BATTERY_INTERVAL: 15000,   // 15 seconds (battery 20-50%)
    LOW_BATTERY_INTERVAL: 30000,      // 30 seconds (battery < 20%)
    CRITICAL_BATTERY_INTERVAL: 60000, // 60 seconds (battery < 10%)

    // Location update intervals
    LOCATION_UPDATE_INTERVAL: 10000,  // 10 seconds
    LOW_BATTERY_LOCATION_INTERVAL: 30000, // 30 seconds

    // Battery thresholds
    HIGH_BATTERY_THRESHOLD: 50,
    MEDIUM_BATTERY_THRESHOLD: 20,
    CRITICAL_BATTERY_THRESHOLD: 10,
};

// ============================================================================
// BEACON SERVICE CLASS
// ============================================================================

class SOSBeaconService {
    private isActive = false;
    private beaconTimer: NodeJS.Timeout | null = null;
    private locationTimer: NodeJS.Timeout | null = null;
    private batteryCheckTimer: NodeJS.Timeout | null = null;
    private currentInterval = BEACON_CONFIG.HIGH_BATTERY_INTERVAL;
    private appStateSubscription: { remove: () => void } | null = null;
    private isInBackground = false;

    // ============================================================================
    // LIFECYCLE
    // ============================================================================

    /**
     * Start beacon broadcasting
     */
    async start(): Promise<void> {
        if (this.isActive) {
            logger.debug('Beacon already active');
            return;
        }

        this.isActive = true;
        logger.warn('🔔 SOS Beacon Service STARTED');

        // Setup app state listener
        this.setupAppStateListener();

        // Get initial battery level and set interval
        await this.updateBeaconInterval();

        // Start beacon loop
        this.startBeaconLoop();

        // Start location updates
        this.startLocationUpdates();

        // Start battery monitoring
        this.startBatteryMonitoring();
    }

    /**
     * Stop beacon broadcasting
     */
    stop(): void {
        if (!this.isActive) return;

        this.isActive = false;

        // Clear all timers
        if (this.beaconTimer) {
            clearInterval(this.beaconTimer);
            this.beaconTimer = null;
        }

        if (this.locationTimer) {
            clearInterval(this.locationTimer);
            this.locationTimer = null;
        }

        if (this.batteryCheckTimer) {
            clearInterval(this.batteryCheckTimer);
            this.batteryCheckTimer = null;
        }

        // Remove app state listener
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        logger.info('🛑 SOS Beacon Service STOPPED');
    }

    // ============================================================================
    // BEACON LOOP
    // ============================================================================

    private startBeaconLoop(): void {
        // Clear existing timer
        if (this.beaconTimer) {
            clearInterval(this.beaconTimer);
        }

        // Send initial beacon
        this.sendBeacon();

        // Start periodic beacon
        this.beaconTimer = setInterval(() => {
            if (this.isActive) {
                this.sendBeacon();
            }
        }, this.currentInterval);

        logger.debug(`Beacon loop started: ${this.currentInterval}ms interval`);
    }

    private async sendBeacon(): Promise<void> {
        const store = useSOSStore.getState();
        const signal = store.currentSignal;

        if (!signal || signal.status !== 'broadcasting') {
            return;
        }

        try {
            // Broadcast via mesh (always works offline)
            const { meshNetworkService } = await import('../mesh');
            const { MeshMessageType } = await import('../mesh/MeshProtocol');

            const beaconPayload = JSON.stringify({
                type: 'SOS_BEACON',
                id: signal.id,
                userId: signal.userId,
                timestamp: Date.now(),
                location: signal.location,
                message: signal.message,
                trapped: signal.trapped,
                beaconNumber: signal.beaconCount + 1,
                battery: signal.device.batteryLevel,
            });

            await meshNetworkService.broadcastMessage(beaconPayload, MeshMessageType.SOS);

            // Update beacon count
            store.incrementBeaconCount();

            logger.debug(`📡 Beacon #${signal.beaconCount + 1} sent`);
        } catch (error) {
            logger.error('Beacon send failed:', error);
        }
    }

    // ============================================================================
    // LOCATION UPDATES
    // ============================================================================

    private startLocationUpdates(): void {
        if (this.locationTimer) {
            clearInterval(this.locationTimer);
        }

        // Initial location update
        this.updateLocation();

        // Periodic updates
        const interval = this.isLowBattery()
            ? BEACON_CONFIG.LOW_BATTERY_LOCATION_INTERVAL
            : BEACON_CONFIG.LOCATION_UPDATE_INTERVAL;

        this.locationTimer = setInterval(() => {
            if (this.isActive) {
                this.updateLocation();
            }
        }, interval);
    }

    private async updateLocation(): Promise<void> {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: this.isLowBattery()
                    ? Location.Accuracy.Balanced
                    : Location.Accuracy.High,
            });

            const sosLocation: SOSLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy || 10,
                timestamp: Date.now(),
                source: 'gps',
            };

            useSOSStore.getState().updateLocation(sosLocation);
            logger.debug('📍 Location updated');
        } catch (error) {
            logger.debug('Location update failed:', error);
        }
    }

    // ============================================================================
    // BATTERY MONITORING
    // ============================================================================

    private startBatteryMonitoring(): void {
        if (this.batteryCheckTimer) {
            clearInterval(this.batteryCheckTimer);
        }

        // Check every 30 seconds
        this.batteryCheckTimer = setInterval(() => {
            if (this.isActive) {
                this.updateBeaconInterval();
            }
        }, 30000);
    }

    private async updateBeaconInterval(): Promise<void> {
        try {
            const batteryLevel = await sosChannelRouter.getBatteryLevel();

            // Update device status
            useSOSStore.getState().updateDeviceStatus({ batteryLevel });

            // Calculate new interval
            let newInterval: number;

            if (batteryLevel < BEACON_CONFIG.CRITICAL_BATTERY_THRESHOLD) {
                newInterval = BEACON_CONFIG.CRITICAL_BATTERY_INTERVAL;
            } else if (batteryLevel < BEACON_CONFIG.MEDIUM_BATTERY_THRESHOLD) {
                newInterval = BEACON_CONFIG.LOW_BATTERY_INTERVAL;
            } else if (batteryLevel < BEACON_CONFIG.HIGH_BATTERY_THRESHOLD) {
                newInterval = BEACON_CONFIG.MEDIUM_BATTERY_INTERVAL;
            } else {
                newInterval = BEACON_CONFIG.HIGH_BATTERY_INTERVAL;
            }

            // Only restart if interval changed
            if (newInterval !== this.currentInterval) {
                this.currentInterval = newInterval;
                logger.debug(`Beacon interval adjusted: ${newInterval}ms (battery: ${batteryLevel}%)`);

                // Restart beacon loop with new interval
                if (this.isActive) {
                    this.startBeaconLoop();
                }
            }
        } catch (error) {
            logger.debug('Battery check failed:', error);
        }
    }

    private isLowBattery(): boolean {
        const signal = useSOSStore.getState().currentSignal;
        return signal ? signal.device.batteryLevel < BEACON_CONFIG.MEDIUM_BATTERY_THRESHOLD : false;
    }

    // ============================================================================
    // APP STATE HANDLING
    // ============================================================================

    private setupAppStateListener(): void {
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    }

    private handleAppStateChange = (nextState: AppStateStatus): void => {
        if (nextState === 'background' || nextState === 'inactive') {
            this.isInBackground = true;
            logger.debug('App in background - beacon continues');
        } else if (nextState === 'active') {
            this.isInBackground = false;
            // Force location update when returning to foreground
            if (this.isActive) {
                this.updateLocation();
            }
        }
    };

    // ============================================================================
    // STATUS
    // ============================================================================

    isBeaconActive(): boolean {
        return this.isActive;
    }

    getCurrentInterval(): number {
        return this.currentInterval;
    }
}

export const sosBeaconService = new SOSBeaconService();
export default sosBeaconService;
