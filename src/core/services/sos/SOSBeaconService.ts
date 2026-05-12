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
    private isSending = false; // Concurrency guard: prevent overlapping sendBeacon calls
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
        this.isSending = false; // Reset concurrency guard to prevent stuck state after crash

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

        // CRITICAL FIX: Capture userId BEFORE calling clearSOSLocationFlag().
        // store.stopSOS() nulls currentSignal, so the async clearSOSLocationFlag()
        // reads null and returns early — leaving isSOS:true on Firestore forever.
        const capturedUserId = useSOSStore.getState().currentSignal?.userId;
        if (capturedUserId) {
            this.clearSOSLocationFlag(capturedUserId).catch(e => { if (__DEV__) logger.debug('SOSBeacon: clear location flag failed:', e); });
        }

        logger.info('🛑 SOS Beacon Service STOPPED');
    }

    // ============================================================================
    // BEACON LOOP
    // ============================================================================

    private startBeaconLoop(sendImmediate = true): void {
        // Clear existing timer
        if (this.beaconTimer) {
            clearInterval(this.beaconTimer);
        }

        // Send initial beacon (skip when called from updateBeaconInterval to avoid duplicate)
        if (sendImmediate) {
            // CRITICAL FIX: Add .catch() for unhandled promise rejection from async function
            this.sendBeacon().catch(e => logger.debug('Initial beacon send failed:', e));
        }

        // Start periodic beacon
        this.beaconTimer = setInterval(() => {
            if (this.isActive) {
                // CRITICAL FIX: Add .catch() for unhandled promise rejection from async function
                this.sendBeacon().catch(e => logger.debug('Periodic beacon send failed:', e));
            }
        }, this.currentInterval);

        logger.debug(`Beacon loop started: ${this.currentInterval}ms interval`);
    }

    private async sendBeacon(): Promise<void> {
        // Concurrency guard: setInterval can fire before previous sendBeacon completes
        // (e.g., mesh start takes 5s but interval is 5s). Without this, overlapping calls
        // send duplicate beacons and corrupt beacon count.
        if (this.isSending) return;
        this.isSending = true;

        try {
            const store = useSOSStore.getState();
            const signal = store.currentSignal;

            if (!signal || (signal.status !== 'broadcasting' && signal.status !== 'acknowledged')) {
                return;
            }

            // Broadcast via mesh (always works offline)
            const { meshNetworkService } = await import('../mesh');
            const { MeshMessageType } = await import('../mesh/MeshProtocol');

            // V5: Ensure mesh is running before sending beacon — with timeout to prevent beacon hang
            if (!meshNetworkService.getIsRunning()) {
                logger.debug('Mesh not running, attempting to start for beacon...');
                try {
                    await Promise.race([
                        meshNetworkService.start(),
                        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Mesh start timeout')), 12000)),
                    ]);
                } catch (startError) {
                    logger.warn('Failed to start mesh for beacon:', startError);
                    // Continue anyway - may still work
                }
            }

            // CRITICAL FIX: Include senderName, senderUid, and signalId in beacon payload.
            // Without these, receivers who missed the initial SOS broadcast (and only catch
            // periodic beacons) have no sender identity — just an anonymous map marker.
            let senderName = 'Bilinmeyen';
            try {
                const { identityService } = require('../IdentityService');
                const identity = identityService.getIdentity?.();
                senderName = identity?.displayName || 'Bilinmeyen';
            } catch { /* best-effort */ }

            // CRITICAL FIX: Include healthInfo in beacon payload so rescuers who
            // only receive periodic beacons (missed initial SOS) still see blood type,
            // allergies, and medications — life-saving data for first responders.
            let healthInfo: Record<string, string> | null = null;
            try {
                healthInfo = await sosChannelRouter.loadHealthProfileForBeacon();
            } catch { /* best-effort — health info is supplementary */ }

            const beaconPayload = JSON.stringify({
                type: 'SOS_BEACON',
                id: signal.id,
                signalId: signal.id,
                userId: signal.userId,
                senderUid: signal.userId,
                senderName,
                status: signal.status,
                timestamp: Date.now(),
                location: signal.location,
                message: signal.message,
                reason: signal.reason || 'SOS',
                trapped: signal.trapped,
                beaconNumber: signal.beaconCount + 1,
                battery: signal.device.batteryLevel,
                healthInfo,
            });

            // LIFE-SAFETY: Timeout prevents isSending from staying true forever
            // if mesh broadcast hangs (e.g., BLE stack frozen)
            await Promise.race([
                meshNetworkService.broadcastMessage(beaconPayload, MeshMessageType.SOS),
                new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Beacon broadcast timeout')), 4000)),
            ]);

            // Update beacon count
            store.incrementBeaconCount();

            logger.debug(`📡 Beacon #${signal.beaconCount + 1} sent`);
        } catch (error) {
            logger.error('Beacon send failed:', error);
        } finally {
            this.isSending = false;
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
        // CRITICAL FIX: Add .catch() for unhandled promise rejection from async function
        this.updateLocation().catch(e => logger.debug('Initial location update failed:', e));

        // Periodic updates
        const interval = this.isLowBattery()
            ? BEACON_CONFIG.LOW_BATTERY_LOCATION_INTERVAL
            : BEACON_CONFIG.LOCATION_UPDATE_INTERVAL;

        this.locationTimer = setInterval(() => {
            if (this.isActive) {
                // CRITICAL FIX: Add .catch() for unhandled promise rejection from async function
                this.updateLocation().catch(e => logger.debug('Periodic location update failed:', e));
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

            // ELITE V4: Write to Firestore locations_current so rescuers can track live
            // Non-blocking, fails silently if offline (mesh beacon still works)
            this.writeLocationToFirestore(sosLocation).catch(e => { if (__DEV__) logger.debug('SOSBeacon: Firestore location write failed:', e); });
        } catch (error) {
            logger.debug('Location update failed:', error);
        }
    }

    /**
     * Write current location to Firestore locations_current/{userId}
     * SOSHelpScreen listens to this document for live location tracking.
     * Fails silently when offline — mesh beacon is the primary offline channel.
     */
    private async writeLocationToFirestore(location: SOSLocation): Promise<void> {
        // Guard: don't write if beacon has been stopped (prevents stale writes from in-flight calls)
        if (!this.isActive) return;

        const signal = useSOSStore.getState().currentSignal;
        if (!signal?.userId) return;

        try {
            // Auth guard: don't attempt Firestore write if user is logged out / token expired
            const { getFirebaseAuth } = await import('../../../lib/firebase');
            const auth = getFirebaseAuth();
            if (!auth.currentUser) return;

            const { getFirestoreInstanceAsync } = await import(
                '../firebase/FirebaseInstanceManager'
            );
            const db = await getFirestoreInstanceAsync();
            if (!db) return;

            const { doc, setDoc } = await import('firebase/firestore');
            await setDoc(
                doc(db, 'locations_current', signal.userId),
                {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    accuracy: location.accuracy,
                    timestamp: location.timestamp,
                    source: location.source,
                    isSOS: true,
                    batteryLevel: signal.device.batteryLevel,
                },
                { merge: true },
            );
        } catch (err) {
            logger.debug('Location sync to Firestore failed (mesh backup active):', err);
        }
    }

    /**
     * Clear the isSOS flag on Firestore when SOS is cancelled.
     * Rescuers watching locations_current will see isSOS: false.
     */
    private async clearSOSLocationFlag(userId?: string): Promise<void> {
        // Use passed userId (captured before stopSOS nulls currentSignal) or fall back to store
        const effectiveUserId = userId || useSOSStore.getState().currentSignal?.userId;
        if (!effectiveUserId) return;

        try {
            const { getFirestoreInstanceAsync } = await import(
                '../firebase/FirebaseInstanceManager'
            );
            const db = await getFirestoreInstanceAsync();
            if (!db) return;

            const { doc, setDoc } = await import('firebase/firestore');
            await setDoc(
                doc(db, 'locations_current', effectiveUserId),
                { isSOS: false, cancelledAt: Date.now() },
                { merge: true },
            );
        } catch {
            // Best-effort — offline scenarios handled by other cancellation channels
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
                // CRITICAL FIX: Add .catch() for unhandled promise rejection from async function
                this.updateBeaconInterval().catch(e => logger.debug('Battery interval update failed:', e));
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

                // Restart beacon loop AND location updates with new interval
                // Pass false to avoid unnecessary immediate beacon on interval change
                if (this.isActive) {
                    this.startBeaconLoop(false);
                    this.startLocationUpdates();
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
            // CRITICAL FIX: Add .catch() for unhandled promise rejection from async function
            if (this.isActive) {
                this.updateLocation().catch(e => logger.debug('Foreground location update failed:', e));
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
