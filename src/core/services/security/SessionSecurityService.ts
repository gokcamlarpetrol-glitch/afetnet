/**
 * SESSION SECURITY SERVICE - ELITE EDITION
 * 
 * Oturum zaman aşımı ve güvenlik yönetimi
 * 
 * SECURITY FEATURES:
 * - Automatic session timeout after inactivity
 * - Background/foreground state tracking
 * - Secure session token management
 * - Activity monitoring
 * - Forced re-authentication
 * 
 * @version 2.0.0
 * @elite true
 */

import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SessionSecurityService');

// ============================================================
// TYPES
// ============================================================

export interface SessionState {
    isActive: boolean;
    isLocked: boolean;
    lastActivity: number;
    sessionStart: number;
    backgroundAt: number | null;
    requiresReauth: boolean;
}

export interface SessionConfig {
    /** Inactivity timeout in milliseconds (default: 15 minutes) */
    inactivityTimeoutMs: number;
    /** Background timeout before requiring re-auth (default: 5 minutes) */
    backgroundTimeoutMs: number;
    /** Maximum session duration in milliseconds (default: 24 hours) */
    maxSessionDurationMs: number;
    /** Whether to lock immediately when app goes to background */
    lockOnBackground: boolean;
    /** Require biometric on resume from background */
    requireBiometricOnResume: boolean;
}

export type SessionEvent =
    | 'session_start'
    | 'session_end'
    | 'session_timeout'
    | 'session_locked'
    | 'session_unlocked'
    | 'activity_recorded'
    | 'background_detected'
    | 'foreground_detected'
    | 'reauth_required';

type SessionEventCallback = (event: SessionEvent, state: SessionState) => void;

// ============================================================
// CONSTANTS
// ============================================================

const STORAGE_KEYS = {
    SESSION_STATE: '@afetnet:session_state',
    SESSION_CONFIG: '@afetnet:session_config',
} as const;

const DEFAULT_CONFIG: SessionConfig = {
    inactivityTimeoutMs: 15 * 60 * 1000, // 15 minutes
    backgroundTimeoutMs: 5 * 60 * 1000, // 5 minutes
    maxSessionDurationMs: 24 * 60 * 60 * 1000, // 24 hours
    lockOnBackground: false,
    requireBiometricOnResume: true,
};

// ============================================================
// SESSION SECURITY SERVICE CLASS
// ============================================================

class SessionSecurityService {
    private isInitialized = false;
    private config: SessionConfig = DEFAULT_CONFIG;
    private state: SessionState = {
        isActive: false,
        isLocked: false,
        lastActivity: 0,
        sessionStart: 0,
        backgroundAt: null,
        requiresReauth: false,
    };

    private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private appStateSubscription: { remove: () => void } | null = null;
    private eventListeners: Set<SessionEventCallback> = new Set();

    // ==================== INITIALIZATION ====================

    /**
     * Initialize the session security service
     */
    async initialize(customConfig?: Partial<SessionConfig>): Promise<void> {
        if (this.isInitialized) {
            logger.debug('SessionSecurityService already initialized');
            return;
        }

        try {
            logger.info('🔐 Initializing SessionSecurityService...');

            // Load saved config or use provided/defaults
            await this.loadConfig();
            if (customConfig) {
                this.config = { ...this.config, ...customConfig };
            }

            // Set up app state listener
            this.appStateSubscription = AppState.addEventListener(
                'change',
                this.handleAppStateChange.bind(this)
            );

            // Start periodic security check
            this.startSecurityCheck();

            this.isInitialized = true;
            logger.info('✅ SessionSecurityService initialized', {
                inactivityTimeout: this.config.inactivityTimeoutMs / 60000 + ' min',
                backgroundTimeout: this.config.backgroundTimeoutMs / 60000 + ' min',
            });
        } catch (error) {
            logger.error('❌ SessionSecurityService initialization failed:', error);
            this.isInitialized = true; // Continue with defaults
        }
    }

    // ==================== SESSION MANAGEMENT ====================

    /**
     * Start a new session
     */
    startSession(): void {
        const now = Date.now();
        this.state = {
            isActive: true,
            isLocked: false,
            lastActivity: now,
            sessionStart: now,
            backgroundAt: null,
            requiresReauth: false,
        };

        this.resetInactivityTimer();
        this.emitEvent('session_start');
        logger.info('🟢 Session started');
    }

    /**
     * End the current session
     */
    endSession(): void {
        this.state = {
            isActive: false,
            isLocked: false,
            lastActivity: 0,
            sessionStart: 0,
            backgroundAt: null,
            requiresReauth: false,
        };

        this.clearInactivityTimer();
        this.emitEvent('session_end');
        logger.info('🔴 Session ended');
    }

    /**
     * Lock the current session
     */
    lockSession(): void {
        if (!this.state.isActive) return;

        this.state.isLocked = true;
        this.state.requiresReauth = true;
        this.clearInactivityTimer();
        this.emitEvent('session_locked');
        logger.info('🔒 Session locked');
    }

    /**
     * Unlock the session after successful authentication
     */
    unlockSession(): void {
        if (!this.state.isActive) {
            this.startSession();
            return;
        }

        this.state.isLocked = false;
        this.state.requiresReauth = false;
        this.state.lastActivity = Date.now();
        this.state.backgroundAt = null;
        this.resetInactivityTimer();
        this.emitEvent('session_unlocked');
        logger.info('🔓 Session unlocked');
    }

    // ==================== ACTIVITY TRACKING ====================

    /**
     * Record user activity to reset inactivity timer
     */
    recordActivity(): void {
        if (!this.state.isActive || this.state.isLocked) return;

        this.state.lastActivity = Date.now();
        this.resetInactivityTimer();
        this.emitEvent('activity_recorded');
    }

    /**
     * Get time remaining before session timeout
     */
    getTimeUntilTimeout(): number {
        if (!this.state.isActive || this.state.isLocked) return 0;

        const elapsed = Date.now() - this.state.lastActivity;
        const remaining = this.config.inactivityTimeoutMs - elapsed;
        return Math.max(0, remaining);
    }

    /**
     * Get session duration
     */
    getSessionDuration(): number {
        if (!this.state.isActive) return 0;
        return Date.now() - this.state.sessionStart;
    }

    // ==================== APP STATE HANDLING ====================

    /**
     * Handle app state changes (foreground/background)
     */
    private handleAppStateChange(nextState: AppStateStatus): void {
        const now = Date.now();

        if (nextState === 'background' || nextState === 'inactive') {
            // App going to background
            this.state.backgroundAt = now;
            this.emitEvent('background_detected');
            logger.debug('App moved to background');

            if (this.config.lockOnBackground) {
                this.lockSession();
            }
        } else if (nextState === 'active') {
            // App coming to foreground
            this.emitEvent('foreground_detected');
            logger.debug('App moved to foreground');

            if (this.state.backgroundAt) {
                const backgroundDuration = now - this.state.backgroundAt;

                // Check if background timeout exceeded
                if (backgroundDuration > this.config.backgroundTimeoutMs) {
                    logger.info('Background timeout exceeded, requiring re-auth');
                    this.state.requiresReauth = true;
                    this.emitEvent('reauth_required');
                }

                this.state.backgroundAt = null;
            }

            // Check session validity
            this.checkSessionValidity();
        }
    }

    // ==================== TIMER MANAGEMENT ====================

    /**
     * Reset the inactivity timer
     */
    private resetInactivityTimer(): void {
        this.clearInactivityTimer();

        if (!this.state.isActive || this.state.isLocked) return;

        this.inactivityTimer = setTimeout(() => {
            logger.info('Session timed out due to inactivity');
            this.emitEvent('session_timeout');
            this.lockSession();
        }, this.config.inactivityTimeoutMs);
    }

    /**
     * Clear the inactivity timer
     */
    private clearInactivityTimer(): void {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    }

    /**
     * Start periodic security check
     */
    private startSecurityCheck(): void {
        // Check every minute
        this.checkInterval = setInterval(() => {
            this.checkSessionValidity();
        }, 60 * 1000);
    }

    /**
     * Check if session is still valid
     */
    private checkSessionValidity(): void {
        if (!this.state.isActive) return;

        const now = Date.now();

        // Check max session duration
        if (now - this.state.sessionStart > this.config.maxSessionDurationMs) {
            logger.info('Max session duration exceeded');
            this.emitEvent('session_timeout');
            this.lockSession();
            return;
        }

        // Check inactivity (for cases where timer might not fire)
        if (!this.state.isLocked &&
            now - this.state.lastActivity > this.config.inactivityTimeoutMs) {
            logger.info('Session timed out (periodic check)');
            this.emitEvent('session_timeout');
            this.lockSession();
        }
    }

    // ==================== EVENT MANAGEMENT ====================

    /**
     * Add event listener
     */
    addEventListener(callback: SessionEventCallback): () => void {
        this.eventListeners.add(callback);
        return () => this.eventListeners.delete(callback);
    }

    /**
     * Emit event to all listeners
     */
    private emitEvent(event: SessionEvent): void {
        const stateCopy = { ...this.state };
        this.eventListeners.forEach(callback => {
            try {
                callback(event, stateCopy);
            } catch (error) {
                logger.error('Event listener error:', error);
            }
        });
    }

    // ==================== STATE & CONFIG ====================

    /**
     * Get current session state
     */
    getState(): SessionState {
        return { ...this.state };
    }

    /**
     * Check if session requires re-authentication
     */
    requiresReauthentication(): boolean {
        return this.state.requiresReauth || this.state.isLocked;
    }

    /**
     * Check if session is active and not locked
     */
    isSessionValid(): boolean {
        return this.state.isActive && !this.state.isLocked && !this.state.requiresReauth;
    }

    /**
     * Update configuration
     */
    async updateConfig(newConfig: Partial<SessionConfig>): Promise<void> {
        this.config = { ...this.config, ...newConfig };
        await this.saveConfig();

        // Reset timer with new config
        if (this.state.isActive && !this.state.isLocked) {
            this.resetInactivityTimer();
        }

        logger.info('Session config updated');
    }

    /**
     * Get current configuration
     */
    getConfig(): SessionConfig {
        return { ...this.config };
    }

    // ==================== PERSISTENCE ====================

    private async loadConfig(): Promise<void> {
        try {
            const stored = await SecureStore.getItemAsync(STORAGE_KEYS.SESSION_CONFIG);
            if (stored) {
                this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
            }
        } catch {
            // Use defaults
        }
    }

    private async saveConfig(): Promise<void> {
        try {
            await SecureStore.setItemAsync(
                STORAGE_KEYS.SESSION_CONFIG,
                JSON.stringify(this.config)
            );
        } catch {
            // Silent fail
        }
    }

    // ==================== CLEANUP ====================

    /**
     * Stop the service and clean up
     */
    stop(): void {
        this.clearInactivityTimer();

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        this.eventListeners.clear();
        this.endSession();

        logger.info('SessionSecurityService stopped');
    }
}

// Export singleton instance
export const sessionSecurityService = new SessionSecurityService();
