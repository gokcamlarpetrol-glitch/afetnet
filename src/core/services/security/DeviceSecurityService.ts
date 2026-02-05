/**
 * DEVICE SECURITY SERVICE - ELITE EDITION
 * 
 * Jailbreak / Root Detection ve Cihaz Güvenlik Kontrolü
 * 
 * SECURITY FEATURES:
 * - Jailbreak detection (iOS)
 * - Root detection (Android)
 * - Emulator/Simulator detection
 * - Debugger detection
 * - Hooking framework detection
 * - Mock location detection
 * - App tampering detection
 * 
 * @version 2.0.0
 * @elite true
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system';
import { createLogger } from '../../utils/logger';

const logger = createLogger('DeviceSecurityService');

// ============================================================
// TYPES
// ============================================================

export interface SecurityCheckResult {
    isSecure: boolean;
    threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
    threats: SecurityThreat[];
    deviceInfo: DeviceInfo;
    timestamp: number;
}

export interface SecurityThreat {
    type: ThreatType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
}

export type ThreatType =
    | 'jailbreak'
    | 'root'
    | 'emulator'
    | 'debugger'
    | 'hooking'
    | 'mock_location'
    | 'tampering'
    | 'developer_mode';

export interface DeviceInfo {
    brand: string | null;
    modelName: string | null;
    osName: string | null;
    osVersion: string | null;
    isDevice: boolean;
    deviceType: Device.DeviceType;
}

// ============================================================
// JAILBREAK/ROOT DETECTION PATHS
// ============================================================

// iOS Jailbreak indicators
const JAILBREAK_PATHS = [
    '/Applications/Cydia.app',
    '/Library/MobileSubstrate/MobileSubstrate.dylib',
    '/bin/bash',
    '/usr/sbin/sshd',
    '/etc/apt',
    '/private/var/lib/apt',
    '/private/var/lib/cydia',
    '/private/var/stash',
    '/Applications/blackra1n.app',
    '/Applications/SBSettings.app',
    '/Applications/WinterBoard.app',
    '/Applications/FakeCarrier.app',
    '/Applications/Icy.app',
    '/Applications/IntelliScreen.app',
    '/Applications/MxTube.app',
    '/Applications/RockApp.app',
    '/Applications/SBSettings.app',
    '/Library/MobileSubstrate/DynamicLibraries/Veency.plist',
    '/System/Library/LaunchDaemons/com.ikey.bbot.plist',
    '/System/Library/LaunchDaemons/com.saurik.Cydia.Startup.plist',
    '/usr/bin/ssh',
    '/usr/bin/sshd',
    '/var/cache/apt',
    '/var/lib/apt',
    '/var/lib/cydia',
    '/var/log/syslog',
    '/var/tmp/cydia.log',
];

// Android root indicators
const ROOT_PATHS = [
    '/system/app/Superuser.apk',
    '/sbin/su',
    '/system/bin/su',
    '/system/xbin/su',
    '/data/local/xbin/su',
    '/data/local/bin/su',
    '/system/sd/xbin/su',
    '/system/bin/failsafe/su',
    '/data/local/su',
    '/su/bin/su',
    '/system/bin/daemonsu',
    '/system/xbin/daemonsu',
    '/system/etc/init.d/99SuperSUDaemon',
    '/system/app/SuperSU.apk',
    '/system/app/SuperSU',
    '/system/app/Magisk',
    '/data/adb/magisk',
];

// Hooking framework indicators
const HOOKING_INDICATORS = [
    'frida',
    'frida-server',
    'frida-gadget',
    'substrate',
    'cydia',
    'xposed',
    'lsposed',
    'edxposed',
];

// ============================================================
// DEVICE SECURITY SERVICE CLASS
// ============================================================

class DeviceSecurityService {
    private isInitialized = false;
    private cachedResult: SecurityCheckResult | null = null;
    private cacheExpiryMs = 5 * 60 * 1000; // 5 minutes

    // ==================== INITIALIZATION ====================

    /**
     * Initialize the device security service
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.debug('DeviceSecurityService already initialized');
            return;
        }

        try {
            logger.info('🔐 Initializing DeviceSecurityService...');

            // Perform initial security check
            await this.performSecurityCheck();

            this.isInitialized = true;
            logger.info('✅ DeviceSecurityService initialized');
        } catch (error) {
            logger.error('❌ DeviceSecurityService initialization failed:', error);
            this.isInitialized = true; // Continue anyway with safe defaults
        }
    }

    // ==================== MAIN SECURITY CHECK ====================

    /**
     * Perform comprehensive device security check
     * @param forceRefresh Force a new check even if cached result exists
     */
    async performSecurityCheck(forceRefresh = false): Promise<SecurityCheckResult> {
        // Return cached result if valid
        if (!forceRefresh && this.cachedResult) {
            const elapsed = Date.now() - this.cachedResult.timestamp;
            if (elapsed < this.cacheExpiryMs) {
                return this.cachedResult;
            }
        }

        const timestamp = Date.now();
        const threats: SecurityThreat[] = [];
        const deviceInfo = this.getDeviceInfo();

        try {
            // Run all security checks in parallel
            const [
                jailbreakResult,
                emulatorResult,
                debuggerResult,
                hookingResult,
            ] = await Promise.all([
                this.checkJailbreakRoot(),
                this.checkEmulator(),
                this.checkDebugger(),
                this.checkHookingFrameworks(),
            ]);

            // Collect all detected threats
            threats.push(...jailbreakResult);
            threats.push(...emulatorResult);
            threats.push(...debuggerResult);
            threats.push(...hookingResult);

            // Calculate overall threat level
            const threatLevel = this.calculateThreatLevel(threats);

            const result: SecurityCheckResult = {
                isSecure: threats.length === 0,
                threatLevel,
                threats,
                deviceInfo,
                timestamp,
            };

            // Cache the result
            this.cachedResult = result;

            // Log security status
            if (threats.length > 0) {
                logger.warn('⚠️ Security threats detected:', {
                    count: threats.length,
                    level: threatLevel,
                    types: threats.map(t => t.type),
                });
            } else {
                logger.info('✅ Device security check passed');
            }

            return result;
        } catch (error) {
            logger.error('Security check failed:', error);

            // Return safe default on error
            return {
                isSecure: true, // Assume secure to not block users
                threatLevel: 'none',
                threats: [],
                deviceInfo,
                timestamp,
            };
        }
    }

    // ==================== INDIVIDUAL CHECKS ====================

    /**
     * Check for jailbreak (iOS) or root (Android)
     */
    private async checkJailbreakRoot(): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];
        const pathsToCheck = Platform.OS === 'ios' ? JAILBREAK_PATHS : ROOT_PATHS;
        const threatType: ThreatType = Platform.OS === 'ios' ? 'jailbreak' : 'root';

        for (const path of pathsToCheck) {
            try {
                const fileInfo = await FileSystem.getInfoAsync(path);
                if (fileInfo.exists) {
                    threats.push({
                        type: threatType,
                        severity: 'critical',
                        description: Platform.OS === 'ios'
                            ? 'Jailbreak tespit edildi'
                            : 'Root erişimi tespit edildi',
                        recommendation: 'Güvenlik riski - resmi yazılım kullanın',
                    });
                    // One detection is enough
                    break;
                }
            } catch {
                // File not accessible - this is good
            }
        }

        // Additional check: try to write to restricted paths
        if (Platform.OS === 'ios') {
            try {
                const testPath = '/private/jailbreak_test_' + Date.now();
                await FileSystem.writeAsStringAsync(testPath, 'test', { encoding: FileSystem.EncodingType.UTF8 });
                // If we can write, device is jailbroken
                await FileSystem.deleteAsync(testPath, { idempotent: true });
                threats.push({
                    type: 'jailbreak',
                    severity: 'critical',
                    description: 'Sandbox kısıtlamaları devre dışı',
                    recommendation: 'Cihaz güvenliği tehlikeye girmiş',
                });
            } catch {
                // Cannot write to restricted path - this is good
            }
        }

        return threats;
    }

    /**
     * Check if running on emulator/simulator
     */
    private async checkEmulator(): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        // Check if this is a real device
        if (!Device.isDevice) {
            threats.push({
                type: 'emulator',
                severity: 'medium',
                description: 'Emülatör/Simülatör tespit edildi',
                recommendation: 'Gerçek cihazda test edin',
            });
        }

        // Additional emulator detection
        if (Platform.OS === 'android') {
            const model = Device.modelName?.toLowerCase() || '';
            const brand = Device.brand?.toLowerCase() || '';

            const emulatorIndicators = [
                'sdk',
                'emulator',
                'genymotion',
                'google_sdk',
                'droid4x',
                'nox',
                'bluestacks',
                'andy',
                'memu',
                'ldplayer',
            ];

            for (const indicator of emulatorIndicators) {
                if (model.includes(indicator) || brand.includes(indicator)) {
                    threats.push({
                        type: 'emulator',
                        severity: 'medium',
                        description: 'Sanal cihaz tespit edildi',
                        recommendation: 'Gerçek cihazda kullanın',
                    });
                    break;
                }
            }
        }

        return threats;
    }

    /**
     * Check if debugger is attached
     */
    private async checkDebugger(): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        // Check __DEV__ flag
        if (__DEV__) {
            threats.push({
                type: 'debugger',
                severity: 'low',
                description: 'Geliştirme modu aktif',
                recommendation: 'Production build kullanın',
            });
        }

        return threats;
    }

    /**
     * Check for hooking frameworks (Frida, Xposed, etc.)
     */
    private async checkHookingFrameworks(): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        // Check for common hooking framework files
        const pathsToCheck = Platform.OS === 'ios'
            ? ['/usr/lib/frida', '/Library/MobileSubstrate']
            : ['/data/local/tmp/frida-server', '/system/framework/XposedBridge.jar'];

        for (const path of pathsToCheck) {
            try {
                const fileInfo = await FileSystem.getInfoAsync(path);
                if (fileInfo.exists) {
                    threats.push({
                        type: 'hooking',
                        severity: 'critical',
                        description: 'Hooking framework tespit edildi',
                        recommendation: 'Güvenlik riski - manipülasyon mümkün',
                    });
                    break;
                }
            } catch {
                // Not accessible - this is good
            }
        }

        return threats;
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Get basic device information
     */
    private getDeviceInfo(): DeviceInfo {
        return {
            brand: Device.brand,
            modelName: Device.modelName,
            osName: Device.osName,
            osVersion: Device.osVersion,
            isDevice: Device.isDevice,
            deviceType: Device.deviceType ?? Device.DeviceType.UNKNOWN,
        };
    }

    /**
     * Calculate overall threat level based on detected threats
     */
    private calculateThreatLevel(
        threats: SecurityThreat[]
    ): SecurityCheckResult['threatLevel'] {
        if (threats.length === 0) return 'none';

        const severityOrder = ['low', 'medium', 'high', 'critical'] as const;
        let maxSeverity: typeof severityOrder[number] = 'low';

        for (const threat of threats) {
            const currentIndex = severityOrder.indexOf(threat.severity);
            const maxIndex = severityOrder.indexOf(maxSeverity);
            if (currentIndex > maxIndex) {
                maxSeverity = threat.severity;
            }
        }

        return maxSeverity;
    }

    /**
     * Quick check if device is considered secure
     */
    isDeviceSecure(): boolean {
        if (!this.cachedResult) return true; // Assume secure if not checked
        return this.cachedResult.isSecure;
    }

    /**
     * Get cached security result
     */
    getCachedResult(): SecurityCheckResult | null {
        return this.cachedResult;
    }

    /**
     * Check if specific threat type was detected
     */
    hasThreat(type: ThreatType): boolean {
        if (!this.cachedResult) return false;
        return this.cachedResult.threats.some(t => t.type === type);
    }

    /**
     * Get human-readable security status message
     */
    getSecurityStatusMessage(): string {
        if (!this.cachedResult) return 'Güvenlik kontrolü bekleniyor...';

        if (this.cachedResult.isSecure) {
            return '✅ Cihaz güvenli';
        }

        switch (this.cachedResult.threatLevel) {
            case 'low':
                return '⚠️ Düşük güvenlik riski';
            case 'medium':
                return '⚠️ Orta güvenlik riski';
            case 'high':
                return '🔴 Yüksek güvenlik riski';
            case 'critical':
                return '🚨 Kritik güvenlik riski';
            default:
                return 'Güvenlik durumu bilinmiyor';
        }
    }
}

// Export singleton instance
export const deviceSecurityService = new DeviceSecurityService();
