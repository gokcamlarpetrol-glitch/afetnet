/**
 * iOS LIVE ACTIVITIES SERVICE - ELITE EDITION
 * 
 * Provides lock-screen countdown for EEW alerts
 * Uses iOS Live Activities API (iOS 16.1+)
 * 
 * Note: This is a bridge to native ActivityKit
 * Requires native module implementation for full functionality
 * 
 * FEATURES:
 * - Lock-screen EEW countdown
 * - Dynamic Island integration
 * - Real-time updates
 * - Automatic end when countdown finishes
 */

import { createLogger } from '../utils/logger';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

const logger = createLogger('iOSLiveActivities');

// ============================================================
// TYPES
// ============================================================

interface EEWActivityState {
    magnitude: number;
    location: string;
    warningSeconds: number;
    intensity: string;
    epicentralDistance: number;
    startTime: number;
}

interface ActivityContentState {
    countdown: number;
    isActive: boolean;
}

// ============================================================
// iOS LIVE ACTIVITIES SERVICE
// ============================================================

class iOSLiveActivitiesService {
    private static instance: iOSLiveActivitiesService;
    private isSupported = false;
    private currentActivityId: string | null = null;
    private countdownTimer: NodeJS.Timeout | null = null;
    private nativeModule: any = null;

    private constructor() {
        // Check if we're on iOS 16.1+
        if (Platform.OS === 'ios') {
            const version = parseInt(Platform.Version as string, 10);
            this.isSupported = version >= 16;

            // Try to get the native module
            try {
                this.nativeModule = NativeModules.AfetNetLiveActivities;
            } catch (error) {
                logger.debug('Live Activities native module not available');
            }
        }
    }

    static getInstance(): iOSLiveActivitiesService {
        if (!iOSLiveActivitiesService.instance) {
            iOSLiveActivitiesService.instance = new iOSLiveActivitiesService();
        }
        return iOSLiveActivitiesService.instance;
    }

    // ==================== PUBLIC API ====================

    /**
     * Check if Live Activities are supported
     */
    isAvailable(): boolean {
        return this.isSupported && this.nativeModule !== null;
    }

    /**
     * Start an EEW countdown Live Activity
     */
    async startEEWCountdown(params: {
        magnitude: number;
        location: string;
        warningSeconds: number;
        epicentralDistance: number;
    }): Promise<boolean> {
        if (!this.isSupported) {
            logger.debug('Live Activities not supported on this device');
            return false;
        }

        try {
            // If native module is available, use it
            if (this.nativeModule) {
                const result = await this.nativeModule.startEEWActivity({
                    magnitude: params.magnitude,
                    location: params.location,
                    warningSeconds: params.warningSeconds,
                    intensity: this.calculateIntensityString(params.magnitude),
                    epicentralDistance: params.epicentralDistance,
                });

                this.currentActivityId = result.activityId;
                logger.info(`✅ Live Activity started: ${this.currentActivityId}`);

                // Start countdown update timer
                this.startCountdownUpdates(params.warningSeconds);

                return true;
            }

            // Fallback: Log that we would start a Live Activity
            if (__DEV__) {
                logger.info(`📱 Live Activities native module missing; dev countdown only: M${params.magnitude.toFixed(1)} - ${params.location} (${params.warningSeconds}s)`);
                this.startCountdownUpdates(params.warningSeconds);
                return true;
            }

            logger.warn('Live Activities unavailable: native ActivityKit bridge missing');
            return false;
        } catch (error) {
            logger.error('Failed to start Live Activity:', error);
            return false;
        }
    }

    /**
     * Update the countdown in the Live Activity
     */
    async updateCountdown(secondsRemaining: number): Promise<void> {
        if (!this.currentActivityId && !__DEV__) return;

        try {
            if (this.nativeModule) {
                await this.nativeModule.updateEEWActivity({
                    activityId: this.currentActivityId,
                    countdown: secondsRemaining,
                    isActive: secondsRemaining > 0,
                });
            }

            // Log in development
            if (__DEV__) {
                logger.debug(`⏱️ Live Activity countdown: ${secondsRemaining}s`);
            }
        } catch (error) {
            logger.error('Failed to update Live Activity:', error);
        }
    }

    /**
     * End the current Live Activity
     */
    async endActivity(): Promise<void> {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }

        if (!this.currentActivityId) return;

        try {
            if (this.nativeModule) {
                await this.nativeModule.endEEWActivity({
                    activityId: this.currentActivityId,
                    dismissalPolicy: 'immediate',
                });
            }

            logger.info('✅ Live Activity ended');
            this.currentActivityId = null;
        } catch (error) {
            logger.error('Failed to end Live Activity:', error);
        }
    }

    // ==================== COUNTDOWN MANAGEMENT ====================

    private startCountdownUpdates(initialSeconds: number): void {
        let remaining = initialSeconds;

        // Update every second
        this.countdownTimer = setInterval(() => {
            remaining--;

            if (remaining <= 0) {
                this.updateCountdown(0);
                this.endActivityAfterDelay();
            } else {
                this.updateCountdown(remaining);
            }
        }, 1000);
    }

    private async endActivityAfterDelay(): Promise<void> {
        // Keep the activity visible for 5 more seconds showing "ÇÖK KAPAN TUTUN!"
        setTimeout(() => {
            this.endActivity();
        }, 5000);
    }

    // ==================== HELPERS ====================

    private calculateIntensityString(magnitude: number): string {
        if (magnitude >= 7.0) return 'ÇOK ŞİDDETLİ';
        if (magnitude >= 6.0) return 'ŞİDDETLİ';
        if (magnitude >= 5.0) return 'ORTA';
        if (magnitude >= 4.0) return 'HAFİF';
        return 'ZAYIF';
    }

    /**
     * Check if there's an active Live Activity
     */
    hasActiveActivity(): boolean {
        return this.currentActivityId !== null;
    }
}

export const iOSLiveActivities = iOSLiveActivitiesService.getInstance();
export default iOSLiveActivities;
