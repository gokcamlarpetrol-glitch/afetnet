/**
 * BATTERY OPTIMIZED SCANNER - ELITE V4
 * Adaptive BLE scanning based on battery level and activity
 * 
 * FEATURES:
 * - Battery-aware scan intervals
 * - Activity-based optimization
 * - Emergency mode bypass
 * - Background/Foreground adaptation
 * - Power consumption tracking
 */

import { createLogger } from '../../utils/logger';
import * as Battery from 'expo-battery';
import { AppState, AppStateStatus } from 'react-native';
import { useMeshStore } from './MeshStore';
import NetInfo from '@react-native-community/netinfo';
import { highPerformanceBle } from '../../ble/HighPerformanceBle';

const logger = createLogger('BatteryOptimizedScanner');

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface ScanProfile {
    name: string;
    scanDuration: number;      // ms
    scanInterval: number;      // ms
    advertiseDuration: number; // ms
    advertiseInterval: number; // ms
}

const SCAN_PROFILES: Record<string, ScanProfile> = {
    // Maximum power - Emergency mode
    EMERGENCY: {
        name: 'Emergency',
        scanDuration: 5000,
        scanInterval: 2000,
        advertiseDuration: 3000,
        advertiseInterval: 1000,
    },

    // High power - Foreground, good battery
    ACTIVE: {
        name: 'Active',
        scanDuration: 3000,
        scanInterval: 5000,
        advertiseDuration: 2000,
        advertiseInterval: 3000,
    },

    // Balanced - Foreground, medium battery
    BALANCED: {
        name: 'Balanced',
        scanDuration: 2000,
        scanInterval: 10000,
        advertiseDuration: 1500,
        advertiseInterval: 5000,
    },

    // Power saver - Background or low battery
    POWER_SAVER: {
        name: 'Power Saver',
        scanDuration: 1500,
        scanInterval: 30000,
        advertiseDuration: 1000,
        advertiseInterval: 15000,
    },

    // Ultra power saver - Critical battery
    ULTRA_SAVER: {
        name: 'Ultra Saver',
        scanDuration: 1000,
        scanInterval: 60000,
        advertiseDuration: 500,
        advertiseInterval: 30000,
    },
};

// Battery thresholds
const BATTERY_THRESHOLDS = {
    CRITICAL: 10,
    LOW: 20,
    MEDIUM: 50,
    GOOD: 80,
};

// ============================================================================
// BATTERY OPTIMIZED SCANNER CLASS
// ============================================================================

class BatteryOptimizedScanner {
    private isInitialized = false;
    private currentProfile: ScanProfile = SCAN_PROFILES.BALANCED;
    private batteryLevel = 100;
    private isCharging = false;
    private appState: AppStateStatus = 'active';
    private isEmergencyMode = false;
    private batterySubscription: Battery.Subscription | null = null;
    private appStateSubscription: { remove: () => void } | null = null;
    private profileListeners: Set<(profile: ScanProfile) => void> = new Set();
    private lastProfileChange = 0;

    // Duty-cycle yönetimi: BLE scan'i profiline göre açıp kapatan zamanlayıcılar
    private dutyCycleScanTimer: ReturnType<typeof setTimeout> | null = null;
    private dutyCyclePauseTimer: ReturnType<typeof setTimeout> | null = null;
    private dutyCycleActive = false;

    // Power tracking
    private scanCount = 0;
    private totalScanTime = 0;
    private sessionStartTime = 0;

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            this.sessionStartTime = Date.now();

            // Get initial battery state
            this.batteryLevel = Math.round(await Battery.getBatteryLevelAsync() * 100);
            const batteryState = await Battery.getBatteryStateAsync();
            this.isCharging = batteryState === Battery.BatteryState.CHARGING ||
                batteryState === Battery.BatteryState.FULL;

            // Subscribe to battery changes
            this.batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
                this.batteryLevel = Math.round(batteryLevel * 100);
                this.updateProfile();
            });

            // Subscribe to app state changes
            this.appStateSubscription = AppState.addEventListener('change', (state) => {
                this.appState = state;
                this.updateProfile();
            });

            // Initial profile selection
            this.updateProfile();

            this.isInitialized = true;
            logger.info(`Battery Optimized Scanner initialized - Profile: ${this.currentProfile.name}`);
        } catch (error) {
            logger.error('Failed to initialize:', error);
        }
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.dutyCycleActive = false;
        this.clearDutyCycleTimers();

        if (this.batterySubscription) {
            this.batterySubscription.remove();
            this.batterySubscription = null;
        }

        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        this.isInitialized = false;
    }

    // ============================================================================
    // PROFILE MANAGEMENT
    // ============================================================================

    private updateProfile(): void {
        const newProfile = this.selectOptimalProfile();

        if (newProfile.name !== this.currentProfile.name) {
            const prevProfile = this.currentProfile;
            this.currentProfile = newProfile;
            this.lastProfileChange = Date.now();

            logger.info(`Profil değişti: ${prevProfile.name} → ${newProfile.name}`);
            this.notifyListeners(newProfile);

            // Profil değiştiğinde HighPerformanceBle'nin duty-cycle'ını güncelle
            if (this.dutyCycleActive) {
                this.applyDutyCycle(newProfile);
            }
        }
    }

    // ============================================================================
    // DUTY-CYCLE KÖPRÜSÜ (BatteryOptimizedScanner → HighPerformanceBle)
    // ============================================================================

    /**
     * Duty-cycle kontrolünü etkinleştirir.
     * Emergency modda: scan sürekli tam güçte çalışır.
     * Diğer profillerde: scanDuration ms açık, scanInterval ms kapalı döngüsü.
     */
    enableDutyCycle(): void {
        if (this.dutyCycleActive) return;
        this.dutyCycleActive = true;
        this.applyDutyCycle(this.currentProfile);
        logger.info(`Duty-cycle etkinleştirildi. Profil: ${this.currentProfile.name}`);
    }

    /**
     * Duty-cycle kontrolünü devre dışı bırakır.
     * HighPerformanceBle'yi durdurmaz — üst katman yönetir.
     */
    disableDutyCycle(): void {
        this.dutyCycleActive = false;
        this.clearDutyCycleTimers();
        logger.info('Duty-cycle devre dışı');
    }

    private clearDutyCycleTimers(): void {
        if (this.dutyCycleScanTimer !== null) {
            clearTimeout(this.dutyCycleScanTimer);
            this.dutyCycleScanTimer = null;
        }
        if (this.dutyCyclePauseTimer !== null) {
            clearTimeout(this.dutyCyclePauseTimer);
            this.dutyCyclePauseTimer = null;
        }
    }

    /**
     * Duty-cycle "köprüsü": BLE tarayıcısının açık kalmasını sağlar.
     *
     * KRİTİK P0 (görev #5 / v1.6.3 "EEW-FIX-3" regresyonu): Önceki sürüm
     * düşük-pil profillerinde (POWER_SAVER → 30 sn, ULTRA_SAVER → 60 sn) BLE
     * tarayıcısını periyodik olarak durduruyordu. Acil iletişim uygulamasında
     * bu kabul edilemez: tarayıcı kapalıyken yakındaki bir SOS beacon'ı
     * DUYULMAZ — mahsur kullanıcı, kurtarıcı telefonlara o pencere boyunca
     * görünmez kalır. Bu yüzden tarama artık TÜM profillerde sürekli açık
     * tutulur. Pil optimizasyonu ileride tarayıcıyı kapatarak değil, düşük-güç
     * tarama KİPİ (BLE scan mode) ile yapılmalıdır. Profil bilgisi yine
     * getScanParams() üzerinden advertise/zamanlama kararlarını etkiler.
     */
    private applyDutyCycle(_profile: ScanProfile): void {
        this.clearDutyCycleTimers();

        if (!this.dutyCycleActive) return;

        highPerformanceBle.startScanning().catch((err: unknown) => {
            logger.warn('Duty-cycle scan başlatma hatası:', err);
        });
    }

    private selectOptimalProfile(): ScanProfile {
        // Emergency mode always uses maximum power
        if (this.isEmergencyMode) {
            return SCAN_PROFILES.EMERGENCY;
        }

        // Check if charging - can be more aggressive
        if (this.isCharging) {
            return this.appState === 'active'
                ? SCAN_PROFILES.ACTIVE
                : SCAN_PROFILES.BALANCED;
        }

        // Critical battery - minimal scanning
        if (this.batteryLevel <= BATTERY_THRESHOLDS.CRITICAL) {
            return SCAN_PROFILES.ULTRA_SAVER;
        }

        // Low battery
        if (this.batteryLevel <= BATTERY_THRESHOLDS.LOW) {
            return SCAN_PROFILES.POWER_SAVER;
        }

        // Medium battery
        if (this.batteryLevel <= BATTERY_THRESHOLDS.MEDIUM) {
            return this.appState === 'active'
                ? SCAN_PROFILES.BALANCED
                : SCAN_PROFILES.POWER_SAVER;
        }

        // Good battery
        if (this.batteryLevel <= BATTERY_THRESHOLDS.GOOD) {
            return this.appState === 'active'
                ? SCAN_PROFILES.ACTIVE
                : SCAN_PROFILES.BALANCED;
        }

        // Full battery - maximum power in foreground
        return this.appState === 'active'
            ? SCAN_PROFILES.ACTIVE
            : SCAN_PROFILES.BALANCED;
    }

    // ============================================================================
    // EMERGENCY MODE
    // ============================================================================

    /**
     * Acil modu etkinleştirir — maksimum tarama gücü.
     */
    enableEmergencyMode(): void {
        if (this.isEmergencyMode) return;

        this.isEmergencyMode = true;
        this.updateProfile();

        // KRİTİK (görev #6): Acil modda BLE taraması KOŞULSUZ açılır — duty-cycle
        // initialize edilmemiş olsa bile (init hatası / başlatma sırası sorunu).
        // Önceki kod scan başlatmayı `if (this.dutyCycleActive)` ile sınırlıyordu;
        // init başarısızsa enableEmergencyMode tarayıcıya hiç dokunmuyor, SOS
        // tetiklendiği anda tarayıcı kısık kalabiliyordu. Acil mod, yaşam-döngüsünden
        // bağımsız sert override olmalı — tarayıcı her hâlükârda açık.
        this.clearDutyCycleTimers();
        highPerformanceBle.startScanning().catch((err: unknown) => {
            logger.warn('Acil mod scan başlatma hatası:', err);
        });

        logger.warn('Acil mod etkinleştirildi — maksimum tarama gücü');
    }

    /**
     * Acil modu devre dışı bırakır — normal optimizasyona dön
     */
    disableEmergencyMode(): void {
        if (!this.isEmergencyMode) return;

        this.isEmergencyMode = false;
        this.updateProfile();

        // Normal profil için duty-cycle'ı yeniden başlat
        if (this.dutyCycleActive) {
            this.applyDutyCycle(this.currentProfile);
        }

        logger.info('Acil mod devre dışı — normal optimizasyon devam ediyor');
    }

    // ============================================================================
    // SCAN TRACKING
    // ============================================================================

    /**
     * Record a scan operation for power tracking
     */
    recordScan(duration: number): void {
        this.scanCount++;
        this.totalScanTime += duration;
    }

    /**
     * Get power usage statistics
     */
    getPowerStats(): {
        scanCount: number;
        totalScanTime: number;
        averageScanTime: number;
        sessionDuration: number;
        estimatedPowerUsage: 'low' | 'medium' | 'high';
    } {
        const sessionDuration = Date.now() - this.sessionStartTime;
        const averageScanTime = this.scanCount > 0
            ? this.totalScanTime / this.scanCount
            : 0;

        // Estimate power usage based on scan frequency
        const scansPerMinute = (this.scanCount / sessionDuration) * 60000;
        let estimatedPowerUsage: 'low' | 'medium' | 'high';

        if (scansPerMinute < 2) {
            estimatedPowerUsage = 'low';
        } else if (scansPerMinute < 5) {
            estimatedPowerUsage = 'medium';
        } else {
            estimatedPowerUsage = 'high';
        }

        return {
            scanCount: this.scanCount,
            totalScanTime: this.totalScanTime,
            averageScanTime,
            sessionDuration,
            estimatedPowerUsage,
        };
    }

    // ============================================================================
    // LISTENERS
    // ============================================================================

    /**
     * Subscribe to profile changes
     */
    onProfileChange(callback: (profile: ScanProfile) => void): () => void {
        this.profileListeners.add(callback);
        return () => this.profileListeners.delete(callback);
    }

    private notifyListeners(profile: ScanProfile): void {
        this.profileListeners.forEach(cb => cb(profile));
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    /**
     * Get current scan profile
     */
    getCurrentProfile(): ScanProfile {
        return this.currentProfile;
    }

    /**
     * Get current battery level
     */
    getBatteryLevel(): number {
        return this.batteryLevel;
    }

    /**
     * Check if currently in emergency mode
     */
    isInEmergencyMode(): boolean {
        return this.isEmergencyMode;
    }

    /**
     * Get scan parameters for current profile
     */
    getScanParams(): {
        scanDuration: number;
        scanInterval: number;
        advertiseDuration: number;
        advertiseInterval: number;
    } {
        return {
            scanDuration: this.currentProfile.scanDuration,
            scanInterval: this.currentProfile.scanInterval,
            advertiseDuration: this.currentProfile.advertiseDuration,
            advertiseInterval: this.currentProfile.advertiseInterval,
        };
    }

    /**
     * Force profile recalculation
     */
    recalculateProfile(): void {
        this.updateProfile();
    }

    /**
     * Get all available profiles
     */
    getAvailableProfiles(): ScanProfile[] {
        return Object.values(SCAN_PROFILES);
    }

    /**
     * Manually set profile (for testing)
     */
    setProfile(profileName: keyof typeof SCAN_PROFILES): void {
        if (SCAN_PROFILES[profileName]) {
            this.currentProfile = SCAN_PROFILES[profileName];
            this.notifyListeners(this.currentProfile);
            logger.info(`Profile manually set to: ${profileName}`);
        }
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const batteryOptimizedScanner = new BatteryOptimizedScanner();
export default batteryOptimizedScanner;
export { SCAN_PROFILES, BATTERY_THRESHOLDS };
