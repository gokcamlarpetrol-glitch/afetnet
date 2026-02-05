/**
 * ELITE SECURITY SERVICE - MASTER ORCHESTRATOR
 * 
 * Tüm güvenlik servislerini koordine eden merkezi yönetici
 * 
 * ORCHESTRATES:
 * - BiometricAuthService
 * - DeviceSecurityService
 * - SessionSecurityService
 * - ScreenProtectionService
 * 
 * PROVIDES:
 * - Unified initialization
 * - Security status monitoring
 * - Threat assessment
 * - Security policy enforcement
 * 
 * @version 2.0.0
 * @elite true
 */

import { createLogger } from '../../utils/logger';
import { biometricAuthService, BiometricResult, BiometricCapabilities } from './BiometricAuthService';
import { deviceSecurityService, SecurityCheckResult, ThreatType } from './DeviceSecurityService';
import { sessionSecurityService, SessionState, SessionConfig } from './SessionSecurityService';
import { screenProtectionService, ScreenProtectionState } from './ScreenProtectionService';

const logger = createLogger('EliteSecurityService');

// ============================================================
// TYPES
// ============================================================

export interface EliteSecurityStatus {
    isSecure: boolean;
    overallRisk: 'none' | 'low' | 'medium' | 'high' | 'critical';
    deviceSecurity: SecurityCheckResult | null;
    biometricCapabilities: BiometricCapabilities;
    sessionState: SessionState;
    screenProtection: ScreenProtectionState;
    warnings: string[];
    timestamp: number;
}

export interface SecurityPolicy {
    requireBiometricForSensitiveScreens: boolean;
    blockOnJailbreak: boolean;
    warnOnJailbreak: boolean;
    blockOnEmulator: boolean;
    warnOnEmulator: boolean;
    enableScreenProtection: boolean;
    enableSessionTimeout: boolean;
}

type SecurityEventCallback = (status: EliteSecurityStatus) => void;

// ============================================================
// DEFAULT POLICY
// ============================================================

const DEFAULT_POLICY: SecurityPolicy = {
    requireBiometricForSensitiveScreens: true,
    blockOnJailbreak: false, // Just warn, don't block
    warnOnJailbreak: true,
    blockOnEmulator: false,
    warnOnEmulator: true,
    enableScreenProtection: true,
    enableSessionTimeout: true,
};

// ============================================================
// ELITE SECURITY SERVICE CLASS
// ============================================================

class EliteSecurityService {
    private isInitialized = false;
    private policy: SecurityPolicy = DEFAULT_POLICY;
    private eventListeners: Set<SecurityEventCallback> = new Set();
    private lastStatus: EliteSecurityStatus | null = null;

    // ==================== INITIALIZATION ====================

    /**
     * Initialize all security services
     * Call this at app startup
     */
    async initialize(customPolicy?: Partial<SecurityPolicy>): Promise<EliteSecurityStatus> {
        if (this.isInitialized) {
            logger.debug('EliteSecurityService already initialized');
            return this.getSecurityStatus();
        }

        try {
            logger.info('🛡️ Initializing Elite Security Suite...');
            const startTime = Date.now();

            // Apply custom policy
            if (customPolicy) {
                this.policy = { ...this.policy, ...customPolicy };
            }

            // Initialize all services in parallel
            await Promise.all([
                biometricAuthService.initialize(),
                deviceSecurityService.initialize(),
                sessionSecurityService.initialize({
                    inactivityTimeoutMs: 15 * 60 * 1000, // 15 minutes
                    backgroundTimeoutMs: 5 * 60 * 1000, // 5 minutes
                    requireBiometricOnResume: this.policy.requireBiometricForSensitiveScreens,
                }),
                screenProtectionService.initialize(),
            ]);

            // Set up session event listener
            sessionSecurityService.addEventListener((event, state) => {
                if (event === 'reauth_required' || event === 'session_locked') {
                    this.emitSecurityEvent();
                }
            });

            this.isInitialized = true;
            const elapsed = Date.now() - startTime;
            logger.info(`✅ Elite Security Suite initialized in ${elapsed}ms`);

            // Get initial status
            const status = await this.getSecurityStatus();
            this.logSecurityStatus(status);

            return status;
        } catch (error) {
            logger.error('❌ Elite Security Suite initialization failed:', error);
            this.isInitialized = true;
            return this.getSecurityStatus();
        }
    }

    // ==================== SECURITY STATUS ====================

    /**
     * Get comprehensive security status
     */
    async getSecurityStatus(): Promise<EliteSecurityStatus> {
        const warnings: string[] = [];
        let overallRisk: EliteSecurityStatus['overallRisk'] = 'none';

        // Get device security status
        const deviceSecurity = await deviceSecurityService.performSecurityCheck();

        // Collect warnings and assess risk
        if (deviceSecurity.threats.length > 0) {
            overallRisk = deviceSecurity.threatLevel;

            for (const threat of deviceSecurity.threats) {
                warnings.push(threat.description);
            }
        }

        // Check session state
        const sessionState = sessionSecurityService.getState();
        if (sessionState.isLocked) {
            warnings.push('Oturum kilitli');
        }
        if (sessionState.requiresReauth) {
            warnings.push('Yeniden kimlik doğrulama gerekli');
        }

        // Build status
        const status: EliteSecurityStatus = {
            isSecure: deviceSecurity.isSecure && sessionSecurityService.isSessionValid(),
            overallRisk,
            deviceSecurity,
            biometricCapabilities: biometricAuthService.getCapabilities(),
            sessionState,
            screenProtection: screenProtectionService.getState(),
            warnings,
            timestamp: Date.now(),
        };

        this.lastStatus = status;
        return status;
    }

    /**
     * Quick check if app should proceed (based on policy)
     */
    async canProceed(): Promise<{ allowed: boolean; reason?: string }> {
        const status = await this.getSecurityStatus();

        // Check jailbreak policy
        if (this.policy.blockOnJailbreak && deviceSecurityService.hasThreat('jailbreak')) {
            return {
                allowed: false,
                reason: 'Jailbreak tespit edildi. Güvenlik nedeniyle uygulama kullanılamaz.',
            };
        }

        if (this.policy.blockOnJailbreak && deviceSecurityService.hasThreat('root')) {
            return {
                allowed: false,
                reason: 'Root erişimi tespit edildi. Güvenlik nedeniyle uygulama kullanılamaz.',
            };
        }

        // Check emulator policy
        if (this.policy.blockOnEmulator && deviceSecurityService.hasThreat('emulator')) {
            return {
                allowed: false,
                reason: 'Emülatör tespit edildi. Gerçek cihaz kullanın.',
            };
        }

        return { allowed: true };
    }

    // ==================== AUTHENTICATION ====================

    /**
     * Authenticate user with biometrics
     */
    async authenticateWithBiometrics(
        reason?: string
    ): Promise<BiometricResult> {
        const result = await biometricAuthService.authenticate(reason);

        if (result.success) {
            // Unlock session on successful auth
            sessionSecurityService.unlockSession();
        }

        return result;
    }

    /**
     * Check if biometric authentication is required
     */
    requiresBiometricAuth(): boolean {
        return sessionSecurityService.requiresReauthentication();
    }

    /**
     * Check if biometric is available and enrolled
     */
    isBiometricAvailable(): boolean {
        return biometricAuthService.isBiometricAvailable();
    }

    // ==================== SESSION MANAGEMENT ====================

    /**
     * Start a new secure session
     */
    startSecureSession(): void {
        sessionSecurityService.startSession();
    }

    /**
     * End the current session (logout)
     */
    endSecureSession(): void {
        sessionSecurityService.endSession();
        biometricAuthService.invalidateSession();
    }

    /**
     * Record user activity (resets inactivity timer)
     */
    recordActivity(): void {
        sessionSecurityService.recordActivity();
    }

    // ==================== SCREEN PROTECTION ====================

    /**
     * Protect a sensitive screen
     */
    async protectScreen(screenName: string): Promise<void> {
        if (!this.policy.enableScreenProtection) return;
        await screenProtectionService.protectScreen(screenName);
    }

    /**
     * Remove protection from a screen
     */
    async unprotectScreen(screenName: string): Promise<void> {
        await screenProtectionService.unprotectScreen(screenName);
    }

    // ==================== THREAT CHECKING ====================

    /**
     * Check if a specific threat is detected
     */
    hasThreat(type: ThreatType): boolean {
        return deviceSecurityService.hasThreat(type);
    }

    /**
     * Check if device is jailbroken/rooted
     */
    isDeviceCompromised(): boolean {
        return deviceSecurityService.hasThreat('jailbreak') ||
            deviceSecurityService.hasThreat('root');
    }

    /**
     * Check if running on emulator
     */
    isEmulator(): boolean {
        return deviceSecurityService.hasThreat('emulator');
    }

    // ==================== EVENT LISTENERS ====================

    /**
     * Add security event listener
     */
    addSecurityListener(callback: SecurityEventCallback): () => void {
        this.eventListeners.add(callback);
        return () => this.eventListeners.delete(callback);
    }

    private emitSecurityEvent(): void {
        if (this.lastStatus) {
            this.eventListeners.forEach(callback => {
                try {
                    callback(this.lastStatus!);
                } catch (error) {
                    logger.error('Security event listener error:', error);
                }
            });
        }
    }

    // ==================== POLICY ====================

    /**
     * Update security policy
     */
    updatePolicy(newPolicy: Partial<SecurityPolicy>): void {
        this.policy = { ...this.policy, ...newPolicy };
        logger.info('Security policy updated');
    }

    /**
     * Get current policy
     */
    getPolicy(): SecurityPolicy {
        return { ...this.policy };
    }

    // ==================== UTILITIES ====================

    /**
     * Get human-readable security summary
     */
    getSecuritySummary(): string {
        const status = this.lastStatus;
        if (!status) return 'Güvenlik durumu kontrol ediliyor...';

        if (status.isSecure && status.overallRisk === 'none') {
            return '✅ Cihaz güvenli, tüm korumalar aktif';
        }

        const parts: string[] = [];

        if (status.warnings.length > 0) {
            parts.push(`⚠️ ${status.warnings.length} uyarı`);
        }

        if (status.sessionState.isLocked) {
            parts.push('🔒 Oturum kilitli');
        }

        if (parts.length === 0) {
            return '✅ Güvenlik durumu iyi';
        }

        return parts.join(' • ');
    }

    private logSecurityStatus(status: EliteSecurityStatus): void {
        logger.info('📊 Security Status:', {
            isSecure: status.isSecure,
            overallRisk: status.overallRisk,
            biometricAvailable: status.biometricCapabilities.isAvailable,
            biometricEnrolled: status.biometricCapabilities.isEnrolled,
            screenProtectionActive: status.screenProtection.isProtectionActive,
            warningCount: status.warnings.length,
        });
    }

    // ==================== CLEANUP ====================

    /**
     * Stop all security services
     */
    async stop(): Promise<void> {
        sessionSecurityService.stop();
        await screenProtectionService.stop();
        this.eventListeners.clear();
        logger.info('🛡️ Elite Security Suite stopped');
    }

    /**
     * Reset all security data (for account deletion)
     */
    async reset(): Promise<void> {
        await biometricAuthService.reset();
        sessionSecurityService.endSession();
        await screenProtectionService.stop();
        logger.info('🛡️ Elite Security Suite reset');
    }
}

// Export singleton instance
export const eliteSecurityService = new EliteSecurityService();

// Re-export individual services for direct access if needed
export { biometricAuthService } from './BiometricAuthService';
export { deviceSecurityService } from './DeviceSecurityService';
export { sessionSecurityService } from './SessionSecurityService';
export { screenProtectionService } from './ScreenProtectionService';
