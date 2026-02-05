/**
 * SECURITY SERVICES - INDEX
 * 
 * Elite Security Suite exports
 * 
 * @version 2.0.0
 * @elite true
 */

// Main orchestrator
export {
    eliteSecurityService,
    type EliteSecurityStatus,
    type SecurityPolicy,
} from './EliteSecurityService';

// Individual services
export {
    biometricAuthService,
    type BiometricResult,
    type BiometricCapabilities,
} from './BiometricAuthService';

export {
    deviceSecurityService,
    type SecurityCheckResult,
    type SecurityThreat,
    type ThreatType,
    type DeviceInfo,
} from './DeviceSecurityService';

export {
    sessionSecurityService,
    type SessionState,
    type SessionConfig,
    type SessionEvent,
} from './SessionSecurityService';

export {
    screenProtectionService,
    type ScreenProtectionState,
} from './ScreenProtectionService';

// Firebase & API Security
export {
    appCheckService,
    type AppCheckState,
    type AppCheckToken,
} from './AppCheckService';

export {
    secureAPIClient,
    SecureAPIClient,
    type APIClientConfig,
    type APIRequest,
    type APIResponse,
} from './SecureAPIClient';
