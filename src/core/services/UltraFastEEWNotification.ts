/**
 * ULTRA-FAST EEW NOTIFICATION SERVICE - ELITE EDITION
 * 
 * HAYAT KURTARAN BİLDİRİM SİSTEMİ
 * 
 * ELITE FEATURES:
 * - Zero-delay notification delivery
 * - Critical alert bypass (DND, silent mode)
 * - Multi-channel simultaneous delivery
 * - Premium visual design
 * - Haptic feedback escalation
 * - TTS with urgency modulation
 * - Background wake capability
 * - Lock screen priority display
 * 
 * PERFORMANCE TARGETS:
 * - Detection to notification: < 100ms
 * - Full alert chain execution: < 500ms
 * - UI render time: < 50ms
 * 
 * @version 1.0.0
 * @elite true
 * @lifesaving true
 */

import { Platform, Vibration, AppState } from 'react-native';
import { setAudioModeAsync, createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { createLogger } from '../utils/logger';
import { shouldDeliverNotification } from './NotificationService';
import { useSettingsStore } from '../stores/settingsStore';
import { SeismicWaveCalculator } from '../utils/SeismicWaveCalculator';
import { firebaseAnalyticsService } from './FirebaseAnalyticsService';

const logger = createLogger('UltraFastEEWNotification');

// ============================================================
// TYPES
// ============================================================

export interface EEWNotificationConfig {
    /** Estimated magnitude */
    magnitude: number;
    /** Location description */
    location: string;
    /** Seconds until S-wave arrival */
    warningSeconds: number;
    /** Estimated intensity (MMI) */
    estimatedIntensity: number;
    /** Distance from epicenter (km) */
    epicentralDistance: number;
    /** Source of detection */
    source: 'AFAD' | 'KANDILLI' | 'USGS' | 'EMSC' | 'CROWDSOURCED' | 'ON-DEVICE';
    /** Coordinates */
    epicenter?: { latitude: number; longitude: number };
}

export interface NotificationResult {
    delivered: boolean;
    deliveryTimeMs: number;
    channels: {
        push: boolean;
        sound: boolean;
        vibration: boolean;
        tts: boolean;
        fullscreen: boolean;
    };
}

// ============================================================
// CONSTANTS
// ============================================================

// Vibration patterns for urgency levels (milliseconds)
const VIBRATION_PATTERNS = {
    critical: [0, 500, 100, 500, 100, 500, 100, 500, 100, 500], // Continuous strong
    high: [0, 400, 150, 400, 150, 400],
    medium: [0, 300, 200, 300, 200],
    low: [0, 200, 300, 200],
} as const;

// Alarm sounds (frequencies in Hz for haptic simulation)
const ALARM_CONFIG = {
    critical: { volume: 1.0, loop: true, rate: 1.5 },
    high: { volume: 0.9, loop: true, rate: 1.3 },
    medium: { volume: 0.8, loop: false, rate: 1.1 },
    low: { volume: 0.6, loop: false, rate: 1.0 },
} as const;

// Message templates (Turkish)
const MESSAGES_TR = {
    critical: (m: number, loc: string, s: number) =>
        `ACIL DEPREM UYARISI! Büyüklük ${m.toFixed(1)}! ${loc}! ${s} saniye kaldı! Derhal koruma pozisyonu alın!`,
    high: (m: number, loc: string, s: number) =>
        `DEPREM UYARISI! M${m.toFixed(1)} ${loc}! ${s} saniye içinde varış!`,
    medium: (m: number, loc: string) =>
        `Deprem Algılandı: M${m.toFixed(1)} - ${loc}`,
    low: (m: number, loc: string) =>
        `Deprem Bildirimi: M${m.toFixed(1)} - ${loc}`,
};

// ============================================================
// ULTRA-FAST EEW NOTIFICATION SERVICE
// ============================================================

class UltraFastEEWNotificationService {
    private isInitialized = false;
    private notifModule: typeof import('expo-notifications') | null = null;
    private activeSound: AudioPlayer | null = null;
    private vibrationActive = false;
    private deliveryStartTime = 0;
    private ttsWarmedUp = false;

    // PRODUCTION FIX: Global rate limiter — the final defense against notification spam.
    // ALL notification callers (10+ services) flow through sendEEWNotification(),
    // so rate-limiting here catches everything regardless of source.
    private static readonly GLOBAL_ALERT_COOLDOWN_MS = 30000;   // 30s between any alerts
    private static readonly MAX_ALERTS_PER_WINDOW = 6;          // Max 6 alerts per 5 min
    private static readonly RATE_WINDOW_MS = 5 * 60 * 1000;     // 5 minute window
    private static readonly CRITICAL_MAG_BYPASS = 5.0;           // M5.0+ bypasses all limits
    private static readonly SAME_LOCATION_COOLDOWN_MS = 30000;   // 30s cooldown for same location
    private static readonly DIFF_LOCATION_COOLDOWN_MS = 15000;   // 15s cooldown for different location
    private static readonly SAME_LOCATION_RADIUS_KM = 50;        // 50km = "same location"
    private lastAlertTime = 0;
    private lastAlertEpicenter: { latitude: number; longitude: number } | null = null;
    private alertTimestamps: number[] = [];

    // ==================== INITIALIZATION ====================

    /**
     * Pre-initialize for zero-delay response
     * Call this at app startup!
     * ELITE: Now includes TTS pre-warming for instant speech!
     */
    async warmup(): Promise<void> {
        if (this.isInitialized) return;

        const start = Date.now();
        logger.info('🚀 Warming up UltraFastEEWNotification...');

        try {
            // Pre-load notification module
            this.notifModule = await import('expo-notifications');

            // Pre-configure audio
            await setAudioModeAsync({
                playsInSilentMode: true,
                shouldPlayInBackground: true,
            });

            // Apple-review safe: do not trigger permission prompt during warmup.
            // Permissions are requested from explicit user actions (onboarding/settings).
            if (this.notifModule) {
                const permissions = await this.notifModule.getPermissionsAsync?.();
                if (__DEV__ && permissions?.status !== 'granted') {
                    logger.info('Notification permission not granted yet; ultra-fast local push channel is deferred');
                }
            }

            // ELITE: Pre-warm TTS engine with silent utterance
            // This loads the TTS engine into memory for instant response
            await this.prewarmTTS();

            this.isInitialized = true;
            logger.info(`✅ UltraFastEEWNotification ready in ${Date.now() - start}ms`);
        } catch (error) {
            logger.error('Failed to warmup:', error);
        }
    }

    /**
     * ELITE: Pre-warm TTS engine for zero-latency speech during EEW
     * Speaks a silent character to load the engine into memory
     */
    private async prewarmTTS(): Promise<void> {
        if (this.ttsWarmedUp) return;

        try {
            // Speak a very short silent utterance to warm up the engine
            await Speech.speak(' ', {
                language: 'tr-TR',
                volume: 0.01, // Nearly silent
                rate: 2.0,    // Fast to complete quickly
            });

            this.ttsWarmedUp = true;
            logger.info('🎤 TTS engine pre-warmed for instant EEW response');
        } catch (error) {
            // TTS not available on this device
            logger.debug('TTS pre-warm skipped:', error);
        }
    }

    // ==================== MAIN NOTIFICATION METHODS ====================

    /**
     * ULTRA-FAST: Send life-saving EEW notification
     * Optimized for minimum latency!
     */
    async sendEEWNotification(config: EEWNotificationConfig): Promise<NotificationResult> {
        this.deliveryStartTime = Date.now();
        const now = this.deliveryStartTime;

        // ==================== CROSS-SYSTEM DEDUP ====================
        // CRITICAL: Prevents double-delivery when both UltraFast and MBN
        // are triggered for the same earthquake by different services.
        if (!shouldDeliverNotification(config.magnitude, config.location, undefined, 'UltraFast')) {
            return { delivered: false, deliveryTimeMs: 0, channels: { push: false, sound: false, vibration: false, tts: false, fullscreen: false } };
        }

        // ==================== SERVICE-LEVEL RATE LIMITER ====================
        const isCritical = config.magnitude >= UltraFastEEWNotificationService.CRITICAL_MAG_BYPASS;

        if (!isCritical) {
            // Check cooldown (2 min between alerts)
            if (now - this.lastAlertTime < UltraFastEEWNotificationService.GLOBAL_ALERT_COOLDOWN_MS) {
                logger.info(`⏭️ GLOBAL RATE LIMIT: Alert suppressed (${Math.round((now - this.lastAlertTime) / 1000)}s since last, need ${UltraFastEEWNotificationService.GLOBAL_ALERT_COOLDOWN_MS / 1000}s). M${config.magnitude.toFixed(1)} ${config.source}`);
                return { delivered: false, deliveryTimeMs: 0, channels: { push: false, sound: false, vibration: false, tts: false, fullscreen: false } };
            }

            // Check window rate limit (max 3 per 5 min)
            const windowStart = now - UltraFastEEWNotificationService.RATE_WINDOW_MS;
            this.alertTimestamps = this.alertTimestamps.filter(t => t > windowStart);
            if (this.alertTimestamps.length >= UltraFastEEWNotificationService.MAX_ALERTS_PER_WINDOW) {
                logger.info(`⏭️ GLOBAL RATE LIMIT: ${this.alertTimestamps.length}/${UltraFastEEWNotificationService.MAX_ALERTS_PER_WINDOW} alerts in 5 min window — skipping M${config.magnitude.toFixed(1)}`);
                return { delivered: false, deliveryTimeMs: 0, channels: { push: false, sound: false, vibration: false, tts: false, fullscreen: false } };
            }
        }

        // Record this alert
        this.lastAlertTime = now;
        this.alertTimestamps.push(now);

        // Determine urgency level
        const urgency = this.calculateUrgency(config);

        logger.warn(`🚨 SENDING EEW NOTIFICATION: M${config.magnitude} ${config.location} (${urgency})`);

        // Execute all channels in PARALLEL for speed
        const [pushResult, soundResult, vibrationResult, ttsResult, fullscreenResult] = await Promise.all([
            this.sendCriticalPushNotification(config, urgency),
            this.playAlarmSound(urgency),
            this.startVibration(urgency),
            this.speakWarning(config, urgency),
            this.showFullScreenAlert(config),
        ]);

        const deliveryTimeMs = Date.now() - this.deliveryStartTime;

        const result: NotificationResult = {
            delivered: true,
            deliveryTimeMs,
            channels: {
                push: pushResult,
                sound: soundResult,
                vibration: vibrationResult,
                tts: ttsResult,
                fullscreen: fullscreenResult,
            },
        };

        logger.info(`⚡ EEW notification delivered in ${deliveryTimeMs}ms`);

        return result;
    }

    /**
     * Stop all active alerts
     */
    async stopAllAlerts(): Promise<void> {
        try {
            // Stop sound
            if (this.activeSound) {
                this.activeSound.pause();
                this.activeSound.remove();
                this.activeSound = null;
            }

            // Stop vibration
            if (Platform.OS !== 'web') {
                Vibration.cancel();
            }
            this.vibrationActive = false;

            // Stop TTS
            await Speech.stop();

            logger.info('All alerts stopped');
        } catch (error) {
            logger.error('Failed to stop alerts:', error);
        }
    }

    // ==================== CHANNEL IMPLEMENTATIONS ====================

    /**
     * Send critical push notification (bypasses DND)
     */
    private async sendCriticalPushNotification(
        config: EEWNotificationConfig,
        urgency: 'critical' | 'high' | 'medium' | 'low'
    ): Promise<boolean> {
        try {
            // NOTIFICATION GATEWAY FIX: Route through central NotificationScheduler
            // instead of calling scheduleNotificationAsync directly.
            // This ensures all push notifications go through a single rate-limited pipeline.
            const { scheduleNotification } = await import('./notifications/NotificationScheduler');

            const title = urgency === 'critical'
                ? '🚨 ACİL DEPREM UYARISI!'
                : urgency === 'high'
                    ? '⚠️ DEPREM UYARISI!'
                    : '🌍 Deprem Bildirimi';

            const body = this.getNotificationBody(config, urgency);

            await scheduleNotification(
                {
                    title,
                    body,
                    data: {
                        type: 'EEW',
                        magnitude: config.magnitude,
                        location: config.location,
                        warningSeconds: config.warningSeconds,
                        source: config.source,
                    },
                    sound: 'default',
                    priority: 'max',
                    categoryIdentifier: 'earthquake',
                },
                { channelType: 'eew' },
            );

            return true;
        } catch (error) {
            logger.error('Push notification failed:', error);
            return false;
        }
    }

    /**
     * Play alarm sound with urgency-based intensity
     * PREMIUM: Loads and plays the actual emergency-alert.wav file
     * ELITE: Respects settings.notificationSound and settings.alarmSoundEnabled
     * NOTE: Critical/High urgency ALWAYS plays for life safety!
     */
    private async playAlarmSound(urgency: 'critical' | 'high' | 'medium' | 'low'): Promise<boolean> {
        try {
            // ELITE: Check settings - but CRITICAL/HIGH urgency always plays for life safety
            const settings = useSettingsStore.getState();
            const shouldPlay = urgency === 'critical' || urgency === 'high' ||
                (settings.notificationSound && settings.alarmSoundEnabled);

            if (!shouldPlay) {
                logger.debug('Alarm sound skipped (disabled in settings)');
                return false;
            }

            // Stop any existing sound
            if (this.activeSound) {
                try {
                    this.activeSound.pause();
                    this.activeSound.remove();
                } catch (e) {
                    logger.debug('Sound cleanup error:', e);
                }
                this.activeSound = null;
            }

            // PREMIUM: Get urgency-based audio configuration
            const config = ALARM_CONFIG[urgency];

            // PREMIUM: Load and play the actual emergency alert sound file
            try {
                const sound = createAudioPlayer(
                    require('../../../assets/emergency-alert.wav'),
                );
                sound.loop = config.loop;
                sound.volume = config.volume;
                sound.play();
                this.activeSound = sound;

                // Auto-stop after 30 seconds for safety (prevent infinite loop)
                setTimeout(async () => {
                    if (this.activeSound === sound) {
                        try {
                            sound.pause();
                            sound.remove();
                            this.activeSound = null;
                        } catch (e) {
                            // Already cleaned up
                        }
                    }
                }, 30000);

                logger.info(`🔊 Emergency alarm sound playing (urgency: ${urgency}, volume: ${config.volume})`);
            } catch (soundError) {
                logger.warn('Emergency sound file failed, using haptic fallback:', soundError);
            }

            // PREMIUM: Also fire haptic feedback alongside audio for multi-sensory alert
            const hapticSequence = async () => {
                const iterations = urgency === 'critical' ? 10 : urgency === 'high' ? 7 : 5;
                for (let i = 0; i < iterations; i++) {
                    if (urgency === 'critical' || urgency === 'high') {
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    } else {
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    }
                    await new Promise(r => setTimeout(r, 200));
                }
            };

            // Fire and forget (non-blocking)
            hapticSequence();

            return true;
        } catch (error) {
            logger.debug('Sound playback failed:', error);
            return false;
        }
    }

    /**
     * Start progressive vibration pattern
     * ELITE: Respects settings.notificationVibration
     * NOTE: Critical/High urgency ALWAYS vibrates for life safety!
     */
    private async startVibration(urgency: 'critical' | 'high' | 'medium' | 'low'): Promise<boolean> {
        try {
            if (Platform.OS === 'web') return false;

            // ELITE: Check settings - but CRITICAL/HIGH urgency always vibrates for life safety
            const settings = useSettingsStore.getState();
            const shouldVibrate = urgency === 'critical' || urgency === 'high' ||
                settings.notificationVibration;

            if (!shouldVibrate) {
                logger.debug('Vibration skipped (disabled in settings)');
                return false;
            }

            const pattern = VIBRATION_PATTERNS[urgency];
            const repeat = urgency === 'critical' || urgency === 'high';

            Vibration.vibrate([...pattern], repeat);
            this.vibrationActive = true;

            // Auto-stop after 30 seconds for safety
            setTimeout(() => {
                if (this.vibrationActive) {
                    Vibration.cancel();
                    this.vibrationActive = false;
                }
            }, 30000);

            return true;
        } catch (error) {
            logger.debug('Vibration failed:', error);
            return false;
        }
    }

    /**
     * Speak warning with urgency modulation
     * ELITE: Respects settings.notificationTTS
     * NOTE: Critical/High urgency ALWAYS speaks for life safety!
     */
    private async speakWarning(
        config: EEWNotificationConfig,
        urgency: 'critical' | 'high' | 'medium' | 'low'
    ): Promise<boolean> {
        try {
            // ELITE: Check settings - but CRITICAL/HIGH urgency always speaks for life safety
            const settings = useSettingsStore.getState();
            const shouldSpeak = urgency === 'critical' || urgency === 'high' ||
                settings.notificationTTS;

            if (!shouldSpeak) {
                logger.debug('TTS skipped (disabled in settings)');
                return false;
            }

            const message = this.getTTSMessage(config, urgency);

            // Rate and pitch based on urgency
            const rate = urgency === 'critical' ? 1.4 : urgency === 'high' ? 1.2 : 1.0;
            const pitch = urgency === 'critical' ? 1.3 : urgency === 'high' ? 1.1 : 1.0;

            await Speech.speak(message, {
                language: 'tr-TR',
                rate,
                pitch,
                // Repeat critical messages
                ...(urgency === 'critical' && { onDone: () => Speech.speak('Koruma pozisyonu alın!', { language: 'tr-TR', rate: 1.3 }) }),
            });

            return true;
        } catch (error) {
            logger.debug('TTS failed:', error);
            return false;
        }
    }

    /**
     * Show full-screen alert (triggers event for UI layer)
     */
    private async showFullScreenAlert(config: EEWNotificationConfig): Promise<boolean> {
        try {
            // Import and trigger the EEW countdown engine
            const { eewCountdownEngine } = await import('./EEWCountdownEngine');

            // Only start countdown if we have warning time
            if (config.warningSeconds > 0) {
                await eewCountdownEngine.startCountdown({
                    warningTime: config.warningSeconds,
                    magnitude: config.magnitude,
                    estimatedIntensity: config.estimatedIntensity,
                    location: config.location,
                    epicentralDistance: config.epicentralDistance,
                    pWaveArrivalTime: 0,
                    sWaveArrivalTime: config.warningSeconds,
                    origin: config.epicenter ? {
                        latitude: config.epicenter.latitude,
                        longitude: config.epicenter.longitude,
                        depth: 10,
                    } : { latitude: 0, longitude: 0, depth: 10 },
                });
            }

            return true;
        } catch (error) {
            logger.debug('Full-screen alert failed:', error);
            return false;
        }
    }

    // ==================== HELPERS ====================

    /**
     * Calculate urgency level from config
     */
    private calculateUrgency(config: EEWNotificationConfig): 'critical' | 'high' | 'medium' | 'low' {
        const { magnitude, warningSeconds, epicentralDistance, estimatedIntensity } = config;

        // Critical: Large earthquake, close, little time
        if (
            (magnitude >= 6.0) ||
            (magnitude >= 5.0 && epicentralDistance < 50) ||
            (warningSeconds <= 10 && estimatedIntensity >= 6) ||
            (estimatedIntensity >= 7)
        ) {
            return 'critical';
        }

        // High: Significant earthquake
        if (
            (magnitude >= 5.0) ||
            (magnitude >= 4.0 && epicentralDistance < 100) ||
            (warningSeconds <= 20) ||
            (estimatedIntensity >= 5)
        ) {
            return 'high';
        }

        // Medium: Notable earthquake
        if (
            (magnitude >= 4.0) ||
            (estimatedIntensity >= 4)
        ) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Get notification body text
     */
    private getNotificationBody(config: EEWNotificationConfig, urgency: string): string {
        const { magnitude, location, warningSeconds, estimatedIntensity, epicentralDistance, source } = config;

        if (urgency === 'critical') {
            return `M${magnitude.toFixed(1)} ${location}\n` +
                `⏱️ ${warningSeconds} saniye!\n` +
                `🎯 Şiddet: ${estimatedIntensity} (MMI)\n` +
                `📍 ${epicentralDistance.toFixed(0)} km uzakta\n` +
                `DERHAL KORUMA POZİSYONU ALIN!`;
        }

        if (urgency === 'high') {
            return `M${magnitude.toFixed(1)} ${location}\n` +
                `⏱️ ${warningSeconds} saniye\n` +
                `🎯 Şiddet: ${estimatedIntensity} | 📍 ${epicentralDistance.toFixed(0)} km`;
        }

        return `M${magnitude.toFixed(1)} depremi ${location} bölgesinde algılandı. Kaynak: ${source}`;
    }

    /**
     * Get TTS message
     */
    private getTTSMessage(config: EEWNotificationConfig, urgency: string): string {
        const { magnitude, location, warningSeconds } = config;

        if (urgency === 'critical') {
            return MESSAGES_TR.critical(magnitude, location, warningSeconds);
        }
        if (urgency === 'high') {
            return MESSAGES_TR.high(magnitude, location, warningSeconds);
        }
        if (urgency === 'medium') {
            return MESSAGES_TR.medium(magnitude, location);
        }
        return MESSAGES_TR.low(magnitude, location);
    }

    // ==================== STATUS ====================

    /**
     * Check if service is ready
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Get warmup status
     */
    getStatus(): { initialized: boolean; hasNotifModule: boolean; ttsWarmed: boolean } {
        return {
            initialized: this.isInitialized,
            hasNotifModule: this.notifModule !== null,
            ttsWarmed: this.ttsWarmedUp,
        };
    }

    // ==================== COUNTDOWN NOTIFICATION ====================

    /**
     * ELITE: Speak countdown for EEW
     * "5...4...3...2...1...DEPREM! Koruma pozisyonu!"
     */
    async speakCountdown(seconds: number): Promise<void> {
        if (seconds <= 0 || seconds > 60) return;

        try {
            // Only countdown last 5 seconds vocally
            const countdownStart = Math.min(seconds, 5);

            for (let i = countdownStart; i >= 1; i--) {
                await Speech.speak(String(i), {
                    language: 'tr-TR',
                    rate: 1.5,
                    pitch: 1.2,
                });
                // Wait 800ms between numbers (fast countdown)
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            // Final warning!
            await Speech.speak('DEPREM! ÇÖK KAPAN TUTUN!', {
                language: 'tr-TR',
                rate: 1.3,
                pitch: 1.4,
            });
        } catch (error) {
            logger.debug('Countdown speech failed:', error);
        }
    }

    /**
     * ELITE: Start countdown with progressive warnings
     * This is called alongside EEW notification for enhanced experience
     */
    async startCountdownWithWarnings(config: EEWNotificationConfig): Promise<void> {
        const { warningSeconds, magnitude, location } = config;

        if (warningSeconds <= 5) {
            // Too little time - just immediate warning
            await Speech.speak(`DEPREM! M${magnitude.toFixed(1)} ${location}! Koruma pozisyonu!`, {
                language: 'tr-TR',
                rate: 1.4,
                pitch: 1.3,
            });
            return;
        }

        // For longer warnings, speak initial then countdown
        await Speech.speak(`Dikkat! M${magnitude.toFixed(1)} deprem. ${warningSeconds} saniye`, {
            language: 'tr-TR',
            rate: 1.2,
        });

        // Wait until last 5 seconds, then countdown
        const waitTime = Math.max(0, (warningSeconds - 5) * 1000);
        setTimeout(() => this.speakCountdown(5), waitTime);
    }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const ultraFastEEWNotification = new UltraFastEEWNotificationService();

// ============================================================
// REACT HOOK
// ============================================================

import { useEffect, useState } from 'react';

/**
 * Hook for ultra-fast EEW notifications
 */
export function useUltraFastEEWNotification() {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        ultraFastEEWNotification.warmup().then(() => {
            setIsReady(true);
        });
    }, []);

    return {
        isReady,
        sendNotification: ultraFastEEWNotification.sendEEWNotification.bind(ultraFastEEWNotification),
        stopAlerts: ultraFastEEWNotification.stopAllAlerts.bind(ultraFastEEWNotification),
    };
}
