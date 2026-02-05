/**
 * BIOMETRIC AUTHENTICATION SERVICE - ELITE EDITION
 * 
 * Face ID / Touch ID ile güvenli kimlik doğrulama
 * 
 * SECURITY FEATURES:
 * - Hardware-backed biometric verification
 * - Fallback to device passcode
 * - Graceful degradation on unsupported devices
 * - Rate limiting for failed attempts
 * - Secure session management
 * 
 * @version 2.0.0
 * @elite true
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createLogger } from '../../utils/logger';
import { Platform } from 'react-native';

const logger = createLogger('BiometricAuthService');

// ============================================================
// TYPES
// ============================================================

export interface BiometricResult {
    success: boolean;
    error?: string;
    authType?: 'biometric' | 'passcode' | 'none';
    timestamp: number;
}

export interface BiometricCapabilities {
    isAvailable: boolean;
    isEnrolled: boolean;
    supportedTypes: LocalAuthentication.AuthenticationType[];
    securityLevel: 'high' | 'medium' | 'low' | 'none';
    biometricName: string;
}

interface FailedAttempt {
    count: number;
    lastAttempt: number;
    lockedUntil: number | null;
}

// ============================================================
// CONSTANTS
// ============================================================

const STORAGE_KEYS = {
    BIOMETRIC_ENABLED: '@afetnet:biometric_enabled',
    FAILED_ATTEMPTS: '@afetnet:biometric_failed_attempts',
    LAST_AUTH_TIMESTAMP: '@afetnet:last_biometric_auth',
} as const;

const SECURITY_CONFIG = {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION_MS: 5 * 60 * 1000, // 5 minutes
    AUTH_VALIDITY_MS: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_WINDOW_MS: 1000, // 1 second between attempts
} as const;

// ============================================================
// BIOMETRIC AUTH SERVICE CLASS
// ============================================================

class BiometricAuthService {
    private isInitialized = false;
    private capabilities: BiometricCapabilities | null = null;
    private failedAttempts: FailedAttempt = {
        count: 0,
        lastAttempt: 0,
        lockedUntil: null,
    };
    private lastSuccessfulAuth = 0;

    // ==================== INITIALIZATION ====================

    /**
     * Initialize the biometric authentication service
     * Must be called before using any other method
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.debug('BiometricAuthService already initialized');
            return;
        }

        try {
            logger.info('🔐 Initializing BiometricAuthService...');

            // Load failed attempts from storage
            await this.loadFailedAttempts();

            // Check hardware and enrollment
            this.capabilities = await this.checkCapabilities();

            this.isInitialized = true;
            logger.info('✅ BiometricAuthService initialized', {
                isAvailable: this.capabilities.isAvailable,
                isEnrolled: this.capabilities.isEnrolled,
                securityLevel: this.capabilities.securityLevel,
                biometricName: this.capabilities.biometricName,
            });
        } catch (error) {
            logger.error('❌ BiometricAuthService initialization failed:', error);
            // Set safe defaults
            this.capabilities = {
                isAvailable: false,
                isEnrolled: false,
                supportedTypes: [],
                securityLevel: 'none',
                biometricName: 'Biometric',
            };
            this.isInitialized = true;
        }
    }

    // ==================== CAPABILITIES ====================

    /**
     * Check device biometric capabilities
     */
    private async checkCapabilities(): Promise<BiometricCapabilities> {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

        // Determine security level
        let securityLevel: BiometricCapabilities['securityLevel'] = 'none';
        let biometricName = 'Biometric';

        if (hasHardware && isEnrolled) {
            const hasFaceId = supportedTypes.includes(
                LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
            );
            const hasFingerprint = supportedTypes.includes(
                LocalAuthentication.AuthenticationType.FINGERPRINT
            );
            const hasIris = supportedTypes.includes(
                LocalAuthentication.AuthenticationType.IRIS
            );

            if (hasFaceId) {
                securityLevel = 'high';
                biometricName = Platform.OS === 'ios' ? 'Face ID' : 'Yüz Tanıma';
            } else if (hasFingerprint) {
                securityLevel = 'high';
                biometricName = Platform.OS === 'ios' ? 'Touch ID' : 'Parmak İzi';
            } else if (hasIris) {
                securityLevel = 'high';
                biometricName = 'İris Taraması';
            } else {
                securityLevel = 'medium';
                biometricName = 'Biyometrik';
            }
        } else if (hasHardware) {
            securityLevel = 'low';
        }

        return {
            isAvailable: hasHardware,
            isEnrolled,
            supportedTypes,
            securityLevel,
            biometricName,
        };
    }

    /**
     * Get current biometric capabilities
     */
    getCapabilities(): BiometricCapabilities {
        if (!this.isInitialized || !this.capabilities) {
            return {
                isAvailable: false,
                isEnrolled: false,
                supportedTypes: [],
                securityLevel: 'none',
                biometricName: 'Biometric',
            };
        }
        return this.capabilities;
    }

    /**
     * Check if biometric authentication is available and enrolled
     */
    isBiometricAvailable(): boolean {
        return this.capabilities?.isAvailable === true &&
            this.capabilities?.isEnrolled === true;
    }

    // ==================== AUTHENTICATION ====================

    /**
     * Authenticate user with biometrics
     * @param reason The reason shown to the user
     * @param options Additional authentication options
     */
    async authenticate(
        reason: string = 'Kimliğinizi doğrulayın',
        options: {
            allowPasscode?: boolean;
            cancelLabel?: string;
            requireConfirmation?: boolean;
        } = {}
    ): Promise<BiometricResult> {
        const timestamp = Date.now();

        // Ensure initialized
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Check if locked out
        if (this.isLockedOut()) {
            const remainingMs = (this.failedAttempts.lockedUntil || 0) - timestamp;
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            logger.warn('🔒 Biometric authentication locked out', { remainingMinutes });
            return {
                success: false,
                error: `Çok fazla başarısız deneme. ${remainingMinutes} dakika sonra tekrar deneyin.`,
                authType: 'none',
                timestamp,
            };
        }

        // Rate limiting
        if (timestamp - this.failedAttempts.lastAttempt < SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS) {
            logger.debug('Rate limit applied for biometric auth');
            return {
                success: false,
                error: 'Lütfen biraz bekleyin',
                authType: 'none',
                timestamp,
            };
        }

        // Check if biometric is available
        if (!this.isBiometricAvailable()) {
            logger.info('Biometric not available, falling back to passcode');

            if (options.allowPasscode !== false) {
                // Try device passcode/password
                try {
                    const result = await LocalAuthentication.authenticateAsync({
                        promptMessage: reason,
                        cancelLabel: options.cancelLabel || 'İptal',
                        disableDeviceFallback: false,
                    });

                    if (result.success) {
                        this.lastSuccessfulAuth = timestamp;
                        this.resetFailedAttempts();
                        return {
                            success: true,
                            authType: 'passcode',
                            timestamp,
                        };
                    }
                } catch {
                    // Passcode not available
                }
            }

            return {
                success: false,
                error: 'Biyometrik doğrulama kullanılamıyor',
                authType: 'none',
                timestamp,
            };
        }

        try {
            logger.debug('Starting biometric authentication...');

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: reason,
                cancelLabel: options.cancelLabel || 'İptal',
                disableDeviceFallback: options.allowPasscode === false,
                requireConfirmation: options.requireConfirmation ?? false,
            });

            if (result.success) {
                logger.info('✅ Biometric authentication successful');
                this.lastSuccessfulAuth = timestamp;
                this.resetFailedAttempts();
                return {
                    success: true,
                    authType: 'biometric',
                    timestamp,
                };
            } else {
                // Handle failure
                this.recordFailedAttempt();

                let errorMessage = 'Kimlik doğrulama başarısız';
                // Type-safe access to error property
                const errorType = !result.success && 'error' in result
                    ? (result as { success: false; error: string }).error
                    : 'unknown';

                if (errorType === 'user_cancel') {
                    errorMessage = 'Kullanıcı iptal etti';
                } else if (errorType === 'user_fallback') {
                    errorMessage = 'Şifre kullanmak isteniyor';
                } else if (errorType === 'lockout') {
                    errorMessage = 'Çok fazla başarısız deneme';
                }

                logger.warn('❌ Biometric authentication failed:', errorType);
                return {
                    success: false,
                    error: errorMessage,
                    authType: 'none',
                    timestamp,
                };
            }
        } catch (error) {
            logger.error('❌ Biometric authentication error:', error);
            this.recordFailedAttempt();
            return {
                success: false,
                error: 'Biyometrik doğrulama hatası',
                authType: 'none',
                timestamp,
            };
        }
    }

    /**
     * Quick check if user has a valid recent authentication
     */
    hasValidSession(): boolean {
        if (this.lastSuccessfulAuth === 0) return false;
        const elapsed = Date.now() - this.lastSuccessfulAuth;
        return elapsed < SECURITY_CONFIG.AUTH_VALIDITY_MS;
    }

    /**
     * Invalidate the current session
     */
    invalidateSession(): void {
        this.lastSuccessfulAuth = 0;
        logger.debug('Biometric session invalidated');
    }

    // ==================== FAILED ATTEMPTS ====================

    private isLockedOut(): boolean {
        if (!this.failedAttempts.lockedUntil) return false;
        if (Date.now() >= this.failedAttempts.lockedUntil) {
            // Lockout expired
            this.failedAttempts.lockedUntil = null;
            this.failedAttempts.count = 0;
            return false;
        }
        return true;
    }

    private recordFailedAttempt(): void {
        this.failedAttempts.count++;
        this.failedAttempts.lastAttempt = Date.now();

        if (this.failedAttempts.count >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
            this.failedAttempts.lockedUntil = Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MS;
            logger.warn('🔒 Biometric authentication locked out due to too many failed attempts');
        }

        this.saveFailedAttempts().catch(() => { });
    }

    private resetFailedAttempts(): void {
        this.failedAttempts = {
            count: 0,
            lastAttempt: 0,
            lockedUntil: null,
        };
        this.saveFailedAttempts().catch(() => { });
    }

    private async loadFailedAttempts(): Promise<void> {
        try {
            const stored = await SecureStore.getItemAsync(STORAGE_KEYS.FAILED_ATTEMPTS);
            if (stored) {
                this.failedAttempts = JSON.parse(stored);
            }
        } catch {
            // Use defaults
        }
    }

    private async saveFailedAttempts(): Promise<void> {
        try {
            await SecureStore.setItemAsync(
                STORAGE_KEYS.FAILED_ATTEMPTS,
                JSON.stringify(this.failedAttempts)
            );
        } catch {
            // Silent fail
        }
    }

    // ==================== USER PREFERENCES ====================

    /**
     * Check if user has enabled biometric authentication
     */
    async isBiometricEnabled(): Promise<boolean> {
        try {
            const value = await SecureStore.getItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED);
            return value === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Enable or disable biometric authentication
     */
    async setBiometricEnabled(enabled: boolean): Promise<void> {
        try {
            if (enabled && !this.isBiometricAvailable()) {
                throw new Error('Biometric authentication is not available on this device');
            }
            await SecureStore.setItemAsync(
                STORAGE_KEYS.BIOMETRIC_ENABLED,
                enabled ? 'true' : 'false'
            );
            logger.info(`Biometric authentication ${enabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            logger.error('Failed to set biometric preference:', error);
            throw error;
        }
    }

    // ==================== CLEANUP ====================

    /**
     * Reset all biometric data (for logout/account deletion)
     */
    async reset(): Promise<void> {
        try {
            this.lastSuccessfulAuth = 0;
            this.resetFailedAttempts();
            await SecureStore.deleteItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED);
            await SecureStore.deleteItemAsync(STORAGE_KEYS.LAST_AUTH_TIMESTAMP);
            logger.info('BiometricAuthService reset complete');
        } catch (error) {
            logger.error('Failed to reset biometric data:', error);
        }
    }
}

// Export singleton instance
export const biometricAuthService = new BiometricAuthService();
