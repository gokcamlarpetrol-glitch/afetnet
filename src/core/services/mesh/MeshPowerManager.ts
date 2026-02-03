/**
 * MESH POWER MANAGER - ELITE V4
 * Unified power management for mesh network
 * 
 * FEATURES:
 * - Coordinates battery scanner and background service
 * - Power mode notifications
 * - Emergency power override
 * - Power usage analytics
 */

import { createLogger } from '../../utils/logger';
import { batteryOptimizedScanner, ScanProfile, SCAN_PROFILES } from './BatteryOptimizedScanner';
import { backgroundMeshService } from './BackgroundMeshService';
import * as Battery from 'expo-battery';

const logger = createLogger('MeshPowerManager');

// ============================================================================
// TYPES
// ============================================================================

export type PowerMode = 'maximum' | 'balanced' | 'power_saver' | 'emergency';

export interface PowerState {
    mode: PowerMode;
    batteryLevel: number;
    isCharging: boolean;
    isBackgroundEnabled: boolean;
    isEmergencyMode: boolean;
    currentProfile: ScanProfile;
    estimatedRemainingTime: number | null; // minutes
}

// ============================================================================
// MESH POWER MANAGER CLASS
// ============================================================================

class MeshPowerManager {
    private isInitialized = false;
    private currentMode: PowerMode = 'balanced';
    private powerListeners: Set<(state: PowerState) => void> = new Set();
    private batterySubscription: Battery.Subscription | null = null;

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Initialize sub-services
            await batteryOptimizedScanner.initialize();
            await backgroundMeshService.initialize();

            // Subscribe to profile changes
            batteryOptimizedScanner.onProfileChange((profile) => {
                this.updateModeFromProfile(profile);
                this.notifyListeners();
            });

            // Subscribe to battery state changes
            this.batterySubscription = Battery.addBatteryStateListener(({ batteryState }) => {
                this.notifyListeners();
            });

            this.isInitialized = true;
            logger.info('Mesh Power Manager initialized');
        } catch (error) {
            logger.error('Failed to initialize:', error);
        }
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.batterySubscription) {
            this.batterySubscription.remove();
            this.batterySubscription = null;
        }

        batteryOptimizedScanner.destroy();
        backgroundMeshService.destroy();

        this.isInitialized = false;
    }

    // ============================================================================
    // MODE MANAGEMENT
    // ============================================================================

    private updateModeFromProfile(profile: ScanProfile): void {
        if (batteryOptimizedScanner.isInEmergencyMode()) {
            this.currentMode = 'emergency';
            return;
        }

        switch (profile.name) {
            case 'Active':
                this.currentMode = 'maximum';
                break;
            case 'Power Saver':
            case 'Ultra Saver':
                this.currentMode = 'power_saver';
                break;
            default:
                this.currentMode = 'balanced';
        }
    }

    /**
     * Set power mode manually
     */
    async setMode(mode: PowerMode): Promise<void> {
        this.currentMode = mode;

        switch (mode) {
            case 'emergency':
                batteryOptimizedScanner.enableEmergencyMode();
                await backgroundMeshService.enableBackground();
                break;

            case 'maximum':
                batteryOptimizedScanner.disableEmergencyMode();
                batteryOptimizedScanner.setProfile('ACTIVE');
                break;

            case 'power_saver':
                batteryOptimizedScanner.disableEmergencyMode();
                batteryOptimizedScanner.setProfile('POWER_SAVER');
                break;

            case 'balanced':
            default:
                batteryOptimizedScanner.disableEmergencyMode();
                batteryOptimizedScanner.recalculateProfile();
                break;
        }

        this.notifyListeners();
        logger.info(`Power mode set to: ${mode}`);
    }

    // ============================================================================
    // EMERGENCY MODE
    // ============================================================================

    /**
     * Enable emergency power mode
     * CRITICAL: Maximum power for life-saving operations
     */
    async enableEmergencyMode(): Promise<void> {
        logger.warn('⚡ EMERGENCY POWER MODE ENABLED');

        batteryOptimizedScanner.enableEmergencyMode();
        await backgroundMeshService.enableBackground();

        // Register SOS beacon with frequent interval
        await backgroundMeshService.registerSOSBeacon(30); // 30 seconds

        this.currentMode = 'emergency';
        this.notifyListeners();
    }

    /**
     * Disable emergency power mode
     */
    async disableEmergencyMode(): Promise<void> {
        logger.info('✅ Emergency power mode disabled');

        batteryOptimizedScanner.disableEmergencyMode();
        await backgroundMeshService.unregisterSOSBeacon();

        this.currentMode = 'balanced';
        batteryOptimizedScanner.recalculateProfile();
        this.notifyListeners();
    }

    // ============================================================================
    // STATE ACCESS
    // ============================================================================

    /**
     * Get current power state
     */
    async getState(): Promise<PowerState> {
        const batteryLevel = batteryOptimizedScanner.getBatteryLevel();
        const batteryState = await Battery.getBatteryStateAsync();
        const isCharging = batteryState === Battery.BatteryState.CHARGING ||
            batteryState === Battery.BatteryState.FULL;

        // Estimate remaining time (rough calculation)
        let estimatedRemainingTime: number | null = null;
        if (!isCharging && batteryLevel > 0) {
            // Assume ~1% per 10 minutes with mesh active
            // This is a very rough estimate
            const powerUsage = this.currentMode === 'power_saver' ? 0.5 :
                this.currentMode === 'maximum' ? 2 : 1;
            estimatedRemainingTime = Math.round((batteryLevel / powerUsage) * 10);
        }

        return {
            mode: this.currentMode,
            batteryLevel,
            isCharging,
            isBackgroundEnabled: backgroundMeshService.isEnabled(),
            isEmergencyMode: batteryOptimizedScanner.isInEmergencyMode(),
            currentProfile: batteryOptimizedScanner.getCurrentProfile(),
            estimatedRemainingTime,
        };
    }

    /**
     * Get current power mode
     */
    getMode(): PowerMode {
        return this.currentMode;
    }

    /**
     * Check if in emergency mode
     */
    isInEmergencyMode(): boolean {
        return batteryOptimizedScanner.isInEmergencyMode();
    }

    // ============================================================================
    // BACKGROUND CONTROL
    // ============================================================================

    /**
     * Enable background mesh operations
     */
    async enableBackground(): Promise<void> {
        await backgroundMeshService.enableBackground();
        this.notifyListeners();
    }

    /**
     * Disable background mesh operations
     */
    async disableBackground(): Promise<void> {
        await backgroundMeshService.disableBackground();
        this.notifyListeners();
    }

    // ============================================================================
    // ANALYTICS
    // ============================================================================

    /**
     * Get power usage analytics
     */
    async getAnalytics(): Promise<{
        scanStats: ReturnType<typeof batteryOptimizedScanner.getPowerStats>;
        backgroundStats: Awaited<ReturnType<typeof backgroundMeshService.getStats>>;
        currentState: PowerState;
    }> {
        return {
            scanStats: batteryOptimizedScanner.getPowerStats(),
            backgroundStats: await backgroundMeshService.getStats(),
            currentState: await this.getState(),
        };
    }

    // ============================================================================
    // LISTENERS
    // ============================================================================

    /**
     * Subscribe to power state changes
     */
    onStateChange(callback: (state: PowerState) => void): () => void {
        this.powerListeners.add(callback);
        return () => this.powerListeners.delete(callback);
    }

    private async notifyListeners(): Promise<void> {
        const state = await this.getState();
        this.powerListeners.forEach(cb => cb(state));
    }

    // ============================================================================
    // SCAN PARAMETERS
    // ============================================================================

    /**
     * Get current scan parameters (for MeshNetworkService)
     */
    getScanParams(): {
        scanDuration: number;
        scanInterval: number;
        advertiseDuration: number;
        advertiseInterval: number;
    } {
        return batteryOptimizedScanner.getScanParams();
    }

    /**
     * Record a scan operation
     */
    recordScan(duration: number): void {
        batteryOptimizedScanner.recordScan(duration);
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const meshPowerManager = new MeshPowerManager();
export default meshPowerManager;
