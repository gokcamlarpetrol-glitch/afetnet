/**
 * BATTERY SOS SERVICE - ELITE EDITION
 * 
 * Kritik batarya seviyesinde otomatik SOS ve güç yönetimi
 * 
 * Features:
 * - Critical battery auto-SOS with location
 * - Power saving mode automation
 * - Auto-checkin when battery is low
 * - Background location persistence
 */

import * as Battery from 'expo-battery';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';

const logger = createLogger('BatterySOSService');

const BATTERY_TASK = 'BATTERY_MONITOR_TASK';
const STORAGE_KEY = '@afetnet/battery_sos_config';

export interface BatterySOSConfig {
    enabled: boolean;
    criticalThreshold: number;  // Default: 10%
    lowThreshold: number;       // Default: 20%
    autoSOSEnabled: boolean;
    autoCheckinEnabled: boolean;
    powerSaveEnabled: boolean;
    lastKnownLocation: {
        latitude: number;
        longitude: number;
        timestamp: number;
    } | null;
}

const DEFAULT_CONFIG: BatterySOSConfig = {
    enabled: true,
    criticalThreshold: 10,
    lowThreshold: 20,
    autoSOSEnabled: true,
    autoCheckinEnabled: true,
    powerSaveEnabled: true,
    lastKnownLocation: null,
};

class BatterySOSService {
    private config: BatterySOSConfig = { ...DEFAULT_CONFIG };
    private batterySubscription: Battery.Subscription | null = null;
    private isInitialized = false;
    private lastNotifiedLevel: number | null = null;
    private onSOSCallback: ((location: { latitude: number; longitude: number } | null) => void) | null = null;
    private onPowerSaveCallback: ((enabled: boolean) => void) | null = null;
    private onCheckinCallback: (() => void) | null = null;

    /**
     * Initialize service
     */
    async initialize(): Promise<void> {
        try {
            // Load saved config
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
            }

            // Start battery monitoring
            await this.startMonitoring();

            // Register background task
            if (Platform.OS !== 'web') {
                await this.registerBackgroundTask();
            }

            this.isInitialized = true;
            logger.info('Battery SOS service initialized');
        } catch (error) {
            logger.error('Failed to initialize battery SOS service:', error);
        }
    }

    /**
     * Set callbacks for events
     */
    setCallbacks(callbacks: {
        onSOS?: (location: { latitude: number; longitude: number } | null) => void;
        onPowerSave?: (enabled: boolean) => void;
        onCheckin?: () => void;
    }): void {
        if (callbacks.onSOS) this.onSOSCallback = callbacks.onSOS;
        if (callbacks.onPowerSave) this.onPowerSaveCallback = callbacks.onPowerSave;
        if (callbacks.onCheckin) this.onCheckinCallback = callbacks.onCheckin;
    }

    /**
     * Start battery monitoring
     */
    private async startMonitoring(): Promise<void> {
        try {
            // Get initial battery level
            const level = await Battery.getBatteryLevelAsync();
            await this.handleBatteryLevel(level * 100);

            // Subscribe to battery changes
            this.batterySubscription = Battery.addBatteryLevelListener(async ({ batteryLevel }) => {
                await this.handleBatteryLevel(batteryLevel * 100);
            });

            logger.info('Battery monitoring started');
        } catch (error) {
            logger.error('Battery monitoring error:', error);
        }
    }

    /**
     * Handle battery level changes
     */
    private async handleBatteryLevel(level: number): Promise<void> {
        if (!this.config.enabled) return;

        // ELITE: Ignore invalid battery levels (simulators return -1 or negative values)
        // This is expected behavior on iOS/Android simulators
        if (level < 0 || level > 100 || !isFinite(level)) {
            // Silently ignore - this is a simulator or battery not available
            return;
        }

        // Avoid duplicate notifications
        if (this.lastNotifiedLevel !== null &&
            Math.abs(level - this.lastNotifiedLevel) < 2) {
            return;
        }

        // Critical level - Auto SOS
        if (level <= this.config.criticalThreshold) {
            logger.warn(`CRITICAL BATTERY: ${level}%`);
            await this.triggerCriticalMode();
            this.lastNotifiedLevel = level;
        }
        // Low level - Power save and auto checkin
        else if (level <= this.config.lowThreshold) {
            logger.warn(`LOW BATTERY: ${level}%`);
            await this.triggerLowBatteryMode();
            this.lastNotifiedLevel = level;
        }
        // Normal level - disable power save if was on
        else if (this.lastNotifiedLevel !== null &&
            this.lastNotifiedLevel <= this.config.lowThreshold) {
            await this.disablePowerSaveMode();
            this.lastNotifiedLevel = level;
        }
    }

    /**
     * Trigger critical battery mode - AUTO SOS
     */
    private async triggerCriticalMode(): Promise<void> {
        try {
            // Get current location for SOS
            const location = await this.getCurrentLocation();

            // Save last known location
            if (location) {
                this.config.lastKnownLocation = {
                    ...location,
                    timestamp: Date.now(),
                };
                await this.saveConfig();
            }

            // Trigger auto SOS if enabled
            if (this.config.autoSOSEnabled && this.onSOSCallback) {
                logger.info('AUTO SOS TRIGGERED - Battery critical');
                this.onSOSCallback(location);
            }

            // Enable power save
            await this.enablePowerSaveMode();

        } catch (error) {
            logger.error('Critical mode error:', error);
        }
    }

    /**
     * Trigger low battery mode
     */
    private async triggerLowBatteryMode(): Promise<void> {
        try {
            // Auto check-in if enabled
            if (this.config.autoCheckinEnabled && this.onCheckinCallback) {
                logger.info('AUTO CHECK-IN - Battery low');
                this.onCheckinCallback();
            }

            // Enable power save
            if (this.config.powerSaveEnabled) {
                await this.enablePowerSaveMode();
            }

        } catch (error) {
            logger.error('Low battery mode error:', error);
        }
    }

    /**
     * Enable power saving mode
     */
    private async enablePowerSaveMode(): Promise<void> {
        if (!this.config.powerSaveEnabled) return;

        logger.info('Enabling power save mode');

        // Notify the app to reduce background activities
        if (this.onPowerSaveCallback) {
            this.onPowerSaveCallback(true);
        }
    }

    /**
     * Disable power saving mode
     */
    private async disablePowerSaveMode(): Promise<void> {
        logger.info('Disabling power save mode');

        if (this.onPowerSaveCallback) {
            this.onPowerSaveCallback(false);
        }
    }

    /**
     * Get current location
     */
    private async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                // Return last known location if available
                return this.config.lastKnownLocation;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced, // Save battery
            });

            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };
        } catch (error) {
            logger.error('Location error:', error);
            return this.config.lastKnownLocation;
        }
    }

    /**
     * Register background task for monitoring
     */
    private async registerBackgroundTask(): Promise<void> {
        try {
            // Define the task
            TaskManager.defineTask(BATTERY_TASK, async () => {
                const level = await Battery.getBatteryLevelAsync();
                await this.handleBatteryLevel(level * 100);
                return BackgroundFetch.BackgroundFetchResult.NewData;
            });

            // Register for background fetch
            await BackgroundFetch.registerTaskAsync(BATTERY_TASK, {
                minimumInterval: 15 * 60, // 15 minutes
                stopOnTerminate: false,
                startOnBoot: true,
            });

            logger.info('Background battery task registered');
        } catch (error) {
            logger.error('Background task registration error:', error);
        }
    }

    /**
     * Save config to storage
     */
    private async saveConfig(): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
        } catch (error) {
            logger.error('Config save error:', error);
        }
    }

    /**
     * Update configuration
     */
    async updateConfig(updates: Partial<BatterySOSConfig>): Promise<void> {
        this.config = { ...this.config, ...updates };
        await this.saveConfig();
        logger.info('Battery SOS config updated:', updates);
    }

    /**
     * Get current config
     */
    getConfig(): BatterySOSConfig {
        return { ...this.config };
    }

    /**
     * Get current battery level
     */
    async getCurrentBatteryLevel(): Promise<number> {
        const level = await Battery.getBatteryLevelAsync();
        return Math.round(level * 100);
    }

    /**
     * Check if charging
     */
    async isCharging(): Promise<boolean> {
        const state = await Battery.getBatteryStateAsync();
        return state === Battery.BatteryState.CHARGING ||
            state === Battery.BatteryState.FULL;
    }

    /**
     * Manual SOS trigger
     */
    async triggerManualSOS(): Promise<void> {
        const location = await this.getCurrentLocation();
        if (this.onSOSCallback) {
            this.onSOSCallback(location);
        }
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.batterySubscription) {
            this.batterySubscription.remove();
            this.batterySubscription = null;
        }
        logger.info('Battery SOS service stopped');
    }
}

export const batterySOSService = new BatterySOSService();
