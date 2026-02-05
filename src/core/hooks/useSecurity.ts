/**
 * USE SECURITY HOOK - ELITE EDITION
 * 
 * React hook for security features
 * 
 * @version 2.0.0
 * @elite true
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    eliteSecurityService,
    biometricAuthService,
    sessionSecurityService,
    screenProtectionService,
    EliteSecurityStatus,
    BiometricResult,
} from '../services/security';
import { createLogger } from '../utils/logger';

const logger = createLogger('useSecurity');

// ============================================================
// MAIN SECURITY HOOK
// ============================================================

export interface UseSecurityOptions {
    /** Enable biometric authentication for this screen */
    requireBiometric?: boolean;
    /** Enable screen capture protection for this screen */
    protectScreen?: boolean;
    /** Unique screen name for protection tracking */
    screenName?: string;
}

export interface UseSecurityResult {
    /** Whether security is fully initialized */
    isInitialized: boolean;
    /** Current security status */
    securityStatus: EliteSecurityStatus | null;
    /** Whether user is authenticated */
    isAuthenticated: boolean;
    /** Whether biometric is available */
    isBiometricAvailable: boolean;
    /** Trigger biometric authentication */
    authenticate: (reason?: string) => Promise<BiometricResult>;
    /** Record user activity (resets timeout) */
    recordActivity: () => void;
    /** Check if device is compromised */
    isDeviceCompromised: boolean;
    /** Human-readable security summary */
    securitySummary: string;
}

/**
 * Hook for integrating security features into screens
 */
export function useSecurity(options: UseSecurityOptions = {}): UseSecurityResult {
    const {
        requireBiometric = false,
        protectScreen = false,
        screenName = 'UnknownScreen',
    } = options;

    const [isInitialized, setIsInitialized] = useState(false);
    const [securityStatus, setSecurityStatus] = useState<EliteSecurityStatus | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const isProtected = useRef(false);

    // Initialize security on mount
    useEffect(() => {
        const initSecurity = async () => {
            try {
                const status = await eliteSecurityService.initialize();
                setSecurityStatus(status);
                setIsAuthenticated(!sessionSecurityService.requiresReauthentication());
                setIsInitialized(true);
            } catch (error) {
                logger.error('Security initialization failed:', error);
                setIsInitialized(true);
            }
        };

        initSecurity();
    }, []);

    // Handle screen protection on focus
    useFocusEffect(
        useCallback(() => {
            if (protectScreen && !isProtected.current) {
                screenProtectionService.protectScreen(screenName);
                isProtected.current = true;
                logger.debug(`Screen protected: ${screenName}`);
            }

            // Cleanup when leaving screen
            return () => {
                if (isProtected.current) {
                    screenProtectionService.unprotectScreen(screenName);
                    isProtected.current = false;
                    logger.debug(`Screen unprotected: ${screenName}`);
                }
            };
        }, [protectScreen, screenName])
    );

    // Handle biometric requirement
    useEffect(() => {
        if (requireBiometric && isInitialized && !isAuthenticated) {
            // Auto-trigger biometric if required
            if (biometricAuthService.isBiometricAvailable()) {
                authenticate('Bu ekrana erişmek için kimliğinizi doğrulayın');
            }
        }
    }, [requireBiometric, isInitialized, isAuthenticated]);

    // Add security event listener
    useEffect(() => {
        const unsubscribe = eliteSecurityService.addSecurityListener((status) => {
            setSecurityStatus(status);
            setIsAuthenticated(!sessionSecurityService.requiresReauthentication());
        });

        return unsubscribe;
    }, []);

    // Authentication function
    const authenticate = useCallback(async (reason?: string): Promise<BiometricResult> => {
        const result = await eliteSecurityService.authenticateWithBiometrics(
            reason || 'Kimliğinizi doğrulayın'
        );

        if (result.success) {
            setIsAuthenticated(true);
        }

        return result;
    }, []);

    // Record activity function
    const recordActivity = useCallback(() => {
        eliteSecurityService.recordActivity();
    }, []);

    return {
        isInitialized,
        securityStatus,
        isAuthenticated,
        isBiometricAvailable: biometricAuthService.isBiometricAvailable(),
        authenticate,
        recordActivity,
        isDeviceCompromised: eliteSecurityService.isDeviceCompromised(),
        securitySummary: eliteSecurityService.getSecuritySummary(),
    };
}

// ============================================================
// BIOMETRIC AUTHENTICATION HOOK
// ============================================================

export interface UseBiometricResult {
    isAvailable: boolean;
    isEnrolled: boolean;
    biometricName: string;
    authenticate: (reason?: string) => Promise<BiometricResult>;
    hasValidSession: boolean;
}

/**
 * Hook specifically for biometric authentication
 */
export function useBiometric(): UseBiometricResult {
    const [_, setUpdate] = useState(0);
    const capabilities = biometricAuthService.getCapabilities();

    const authenticate = useCallback(async (reason?: string): Promise<BiometricResult> => {
        const result = await biometricAuthService.authenticate(
            reason || 'Kimliğinizi doğrulayın'
        );
        setUpdate(prev => prev + 1); // Force re-render
        return result;
    }, []);

    return {
        isAvailable: capabilities.isAvailable,
        isEnrolled: capabilities.isEnrolled,
        biometricName: capabilities.biometricName,
        authenticate,
        hasValidSession: biometricAuthService.hasValidSession(),
    };
}

// ============================================================
// SESSION SECURITY HOOK
// ============================================================

export interface UseSessionResult {
    isActive: boolean;
    isLocked: boolean;
    timeUntilTimeout: number;
    recordActivity: () => void;
    lockSession: () => void;
}

/**
 * Hook for session management
 */
export function useSession(): UseSessionResult {
    const [state, setState] = useState(sessionSecurityService.getState());
    const [timeUntilTimeout, setTimeUntilTimeout] = useState(0);

    useEffect(() => {
        // Update state on session events
        const unsubscribe = sessionSecurityService.addEventListener((event, newState) => {
            setState(newState);
        });

        // Update timeout countdown
        const interval = setInterval(() => {
            setTimeUntilTimeout(sessionSecurityService.getTimeUntilTimeout());
        }, 1000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, []);

    const recordActivity = useCallback(() => {
        sessionSecurityService.recordActivity();
    }, []);

    const lockSession = useCallback(() => {
        sessionSecurityService.lockSession();
    }, []);

    return {
        isActive: state.isActive,
        isLocked: state.isLocked,
        timeUntilTimeout,
        recordActivity,
        lockSession,
    };
}

// ============================================================
// DEVICE SECURITY HOOK
// ============================================================

export interface UseDeviceSecurityResult {
    isSecure: boolean;
    isJailbroken: boolean;
    isEmulator: boolean;
    threatLevel: string;
    securityMessage: string;
}

/**
 * Hook for device security status
 */
export function useDeviceSecurity(): UseDeviceSecurityResult {
    const [status, setStatus] = useState<EliteSecurityStatus | null>(null);

    useEffect(() => {
        eliteSecurityService.getSecurityStatus().then(setStatus);
    }, []);

    return {
        isSecure: status?.deviceSecurity?.isSecure ?? true,
        isJailbroken: eliteSecurityService.hasThreat('jailbreak'),
        isEmulator: eliteSecurityService.hasThreat('emulator'),
        threatLevel: status?.deviceSecurity?.threatLevel ?? 'none',
        securityMessage: eliteSecurityService.getSecuritySummary(),
    };
}
