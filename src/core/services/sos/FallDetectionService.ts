import { Accelerometer } from 'expo-sensors';
import { createLogger } from '../../utils/logger';
import { unifiedSOSController } from './UnifiedSOSController';
import { EmergencyReason } from './SOSStateManager';
import * as Haptics from 'expo-haptics';

const logger = createLogger('FallDetectionService');

/**
 * FALL & CRASH DETECTION SERVICE - ELITE V3
 * Uses device Accelerometer to detect high G-Force impacts (Car crashes, hard falls).
 *
 * Two-phase detection (Apple Watch / Pixel pattern):
 * 1. Phase 1: Detect sudden G-Force spike (> 4.5G)
 * 2. Phase 2: Confirm with stillness check (< 1.2G for 2+ seconds = user incapacitated)
 * 3. Triggers SOS countdown (NOT force-activate) so user can cancel false positives
 *
 * This prevents false positives from:
 * - Dropping the phone on a hard surface
 * - Slamming a car door while holding the phone
 * - Riding roller coasters
 */
class FallDetectionService {
    private subscription: any = null;
    private isActive: boolean = false;
    private readonly G_FORCE_THRESHOLD = 4.5; // 4.5G impact threshold
    private readonly STILLNESS_THRESHOLD = 1.2; // Below this = possibly unconscious
    private readonly STILLNESS_CONFIRM_MS = 2000; // 2 seconds of stillness needed
    private lastTriggerTime: number = 0;
    private readonly COOLDOWN_MS = 60000; // Prevent spamming within 1 minute

    // Phase 2: Stillness confirmation state
    private impactDetectedAt: number = 0;
    private isConfirmingImpact = false;
    private stillnessStartedAt: number = 0;
    private confirmationTimer: NodeJS.Timeout | null = null;

    constructor() {
        // Update interval is set in start() after availability check
    }

    public async start() {
        if (this.isActive) return;

        try {
            const isAvailable = await Accelerometer.isAvailableAsync();
            if (!isAvailable) {
                logger.warn('Accelerometer is not available on this device');
                return;
            }

            try {
                Accelerometer.setUpdateInterval(100);
            } catch (e) {
                logger.warn('Failed to set accelerometer update interval:', e);
            }

            this.subscription = Accelerometer.addListener((data) => {
                this.analyzeData(data);
            });
            this.isActive = true;
            logger.info('Fall & Crash Detection Started');
        } catch (error) {
            logger.error('Failed to start Fall Detection', error);
        }
    }

    public stop() {
        if (!this.isActive || !this.subscription) return;

        this.subscription.remove();
        this.subscription = null;
        this.isActive = false;
        this.cancelConfirmation();
        logger.info('Fall & Crash Detection Stopped');
    }

    private analyzeData(data: { x: number, y: number, z: number }) {
        const magnitude = Math.sqrt(
            Math.pow(data.x, 2) +
            Math.pow(data.y, 2) +
            Math.pow(data.z, 2)
        );

        if (this.isConfirmingImpact) {
            // Phase 2: Checking for stillness after impact
            this.checkStillness(magnitude);
            return;
        }

        // Phase 1: Detect initial impact
        if (magnitude >= this.G_FORCE_THRESHOLD) {
            this.handleImpactDetected(magnitude);
        }
    }

    private handleImpactDetected(magnitude: number) {
        const now = Date.now();
        if (now - this.lastTriggerTime < this.COOLDOWN_MS) return;

        logger.warn(`IMPACT DETECTED! G-Force: ${magnitude.toFixed(2)}G — starting stillness confirmation`);

        // Heavy haptic feedback to alert user
        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch { /* best effort */ }

        // Start Phase 2: Monitor for stillness (user possibly unconscious)
        this.impactDetectedAt = now;
        this.isConfirmingImpact = true;
        this.stillnessStartedAt = 0;

        // Safety timeout: if no stillness confirmed within 10 seconds, cancel
        // (user moved the phone = not a real fall/crash)
        this.confirmationTimer = setTimeout(() => {
            if (this.isConfirmingImpact) {
                logger.info('Impact confirmation timeout — user appears mobile, cancelling');
                this.cancelConfirmation();
            }
        }, 10000);
    }

    private checkStillness(magnitude: number) {
        const now = Date.now();

        if (magnitude < this.STILLNESS_THRESHOLD) {
            // Device is relatively still (user might be unconscious)
            if (this.stillnessStartedAt === 0) {
                this.stillnessStartedAt = now;
            } else if (now - this.stillnessStartedAt >= this.STILLNESS_CONFIRM_MS) {
                // Confirmed: impact + stillness = likely real fall/crash
                this.confirmImpact();
            }
        } else {
            // Movement detected — reset stillness counter
            // (if movement is very brief, allow a small tolerance)
            if (magnitude > 2.0) {
                // Significant movement — reset completely
                this.stillnessStartedAt = 0;
            }
            // Light movement (1.2-2.0G) could be involuntary — don't reset
        }
    }

    private confirmImpact() {
        this.cancelConfirmation();
        this.lastTriggerTime = Date.now();

        logger.warn('FALL/CRASH CONFIRMED: Impact + stillness pattern detected — triggering SOS countdown');

        // Use triggerSOS (NOT forceActivateSOS) to give user a CANCEL WINDOW
        // The countdown timer (default 10s) allows the user to cancel if false positive
        // CRITICAL FIX: .catch() prevents unhandled rejection crash during life-safety flow
        unifiedSOSController.triggerSOS(
            EmergencyReason.IMPACT_DETECTED,
            'Sert bir düşüş/çarpışma algılandı! SOS geri sayımı başladı.',
            false // not silent — user needs to hear alarm to cancel if false positive
        ).catch(err => {
            logger.error('Fall detection SOS trigger failed:', err);
        });
    }

    private cancelConfirmation() {
        this.isConfirmingImpact = false;
        this.stillnessStartedAt = 0;
        this.impactDetectedAt = 0;
        if (this.confirmationTimer) {
            clearTimeout(this.confirmationTimer);
            this.confirmationTimer = null;
        }
    }

    public getIsActive(): boolean {
        return this.isActive;
    }
}

export const fallDetectionService = new FallDetectionService();
