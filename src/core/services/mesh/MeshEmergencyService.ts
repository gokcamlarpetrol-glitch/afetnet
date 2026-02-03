/**
 * MESH EMERGENCY SERVICE - ELITE V1
 * Automatic emergency detection, SOS broadcast, and family search.
 * 
 * Features:
 * - Automatic emergency beacon when app in background
 * - Motion sensor detection for potential emergencies
 * - Periodic location broadcast in emergency mode
 * - Family member search across mesh network
 * - Priority SOS channel with max TTL relay
 */

import { AppState, AppStateStatus, Platform } from 'react-native';
import { Accelerometer, AccelerometerMeasurement } from 'expo-sensors';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { createLogger } from '../../utils/logger';
import { MeshProtocol, MeshMessageType, MeshPriority } from './MeshProtocol';
import { useMeshStore, MeshMessage, MeshNode } from './MeshStore';
import { meshStoreForwardService } from './MeshStoreForwardService';
import { identityService } from '../IdentityService';

const logger = createLogger('MeshEmergency');

// Storage keys
const STORAGE_KEY_EMERGENCY_SETTINGS = '@mesh_emergency_settings';
const STORAGE_KEY_FAMILY_MEMBERS = '@mesh_family_members';

// Configuration
const EMERGENCY_BEACON_INTERVAL_MS = 30 * 1000; // Broadcast every 30s in emergency
const INACTIVITY_WARNING_MS = 5 * 60 * 1000; // 5 min inactivity warning
const INACTIVITY_SOS_MS = 10 * 60 * 1000; // 10 min auto SOS
const IMPACT_THRESHOLD = 3.0; // G-force for impact detection
const IMPACT_SAMPLES_FOR_CONFIRM = 3; // Samples above threshold to confirm

// Emergency reason codes
export enum EmergencyReasonCode {
    MANUAL_SOS = 0x01,
    IMPACT_DETECTED = 0x02,
    INACTIVITY_TIMEOUT = 0x03,
    LOW_BATTERY_WARNING = 0x04,
    FAMILY_PANIC = 0x05,
    APP_TERMINATION = 0x06,
}

// Family member info
export interface FamilyMember {
    id: string;
    name: string;
    deviceIdHash?: string;
    lastKnownLocation?: { lat: number; lng: number };
    lastSeen?: number;
    status?: 'safe' | 'danger' | 'unknown';
}

// Emergency settings
export interface EmergencySettings {
    isEmergencyModeEnabled: boolean;
    autoLocationBroadcast: boolean;
    impactDetectionEnabled: boolean;
    inactivitySOSEnabled: boolean;
    familyPanicEnabled: boolean;
}

class MeshEmergencyService {
    private settings: EmergencySettings = {
        isEmergencyModeEnabled: false,
        autoLocationBroadcast: true,
        impactDetectionEnabled: true,
        inactivitySOSEnabled: true,
        familyPanicEnabled: true,
    };

    private familyMembers: FamilyMember[] = [];
    private isActive = false;
    private myDeviceId = '';
    private myName = '';

    // Timers
    private beaconTimer: NodeJS.Timeout | null = null;
    private inactivityTimer: NodeJS.Timeout | null = null;

    // Sensors
    private accelerometerSubscription: { remove: () => void } | null = null;
    private impactSamples: number[] = [];

    // State tracking
    private lastActivityTime = Date.now();
    private isInEmergencyMode = false;
    private lastLocation: { lat: number; lng: number } | null = null;

    // Listeners
    private sosCallbacks: ((reason: EmergencyReasonCode, location?: { lat: number; lng: number }) => void)[] = [];
    private familyFoundCallbacks: ((member: FamilyMember) => void)[] = [];

    // ===========================================================================
    // INITIALIZATION
    // ===========================================================================

    async initialize(deviceId: string): Promise<void> {
        this.myDeviceId = deviceId;

        try {
            const identity = identityService.getIdentity();
            this.myName = identity?.displayName || 'User';
        } catch {
            this.myName = 'User';
        }

        await Promise.all([
            this.loadSettings(),
            this.loadFamilyMembers(),
        ]);

        // Start monitoring
        this.setupAppStateListener();
        this.startActivityTracking();

        if (this.settings.impactDetectionEnabled) {
            this.startImpactDetection();
        }

        // Get initial location
        this.updateCurrentLocation();

        logger.info('Emergency Service initialized');
    }

    // ===========================================================================
    // EMERGENCY MODE
    // ===========================================================================

    /**
     * Activate emergency mode (manual SOS)
     */
    async activateEmergencyMode(reason: EmergencyReasonCode = EmergencyReasonCode.MANUAL_SOS): Promise<void> {
        if (this.isInEmergencyMode) {
            logger.debug('Already in emergency mode');
            return;
        }

        this.isInEmergencyMode = true;
        logger.warn(`🆘 EMERGENCY MODE ACTIVATED (reason: ${reason})`);

        // Update location
        await this.updateCurrentLocation();

        // Broadcast emergency beacon immediately
        await this.broadcastEmergencyBeacon(reason);

        // Start periodic beacon broadcast
        this.startEmergencyBeacon(reason);

        // Notify listeners
        this.sosCallbacks.forEach(cb => cb(reason, this.lastLocation || undefined));

        // Add to store
        const sosMessage: MeshMessage = {
            id: `sos-${Date.now()}`,
            senderId: 'ME',
            senderName: this.myName,
            to: 'broadcast',
            type: 'SOS',
            content: this.getReasonText(reason),
            timestamp: Date.now(),
            hops: 0,
            status: 'sending',
            ttl: 10, // Max TTL for SOS
            priority: 'critical',
            acks: [],
            retryCount: 0,
            location: this.lastLocation || undefined,
        };

        useMeshStore.getState().addMessage(sosMessage);
    }

    /**
     * Deactivate emergency mode
     */
    async deactivateEmergencyMode(): Promise<void> {
        if (!this.isInEmergencyMode) return;

        this.isInEmergencyMode = false;
        logger.info('Emergency mode deactivated');

        // Stop beacon
        if (this.beaconTimer) {
            clearInterval(this.beaconTimer);
            this.beaconTimer = null;
        }

        // Broadcast "safe" status
        await this.broadcastStatusUpdate('safe');
    }

    /**
     * Check if in emergency mode
     */
    isEmergencyActive(): boolean {
        return this.isInEmergencyMode;
    }

    // ===========================================================================
    // EMERGENCY BEACON
    // ===========================================================================

    private startEmergencyBeacon(reason: EmergencyReasonCode): void {
        if (this.beaconTimer) {
            clearInterval(this.beaconTimer);
        }

        this.beaconTimer = setInterval(async () => {
            await this.broadcastEmergencyBeacon(reason);
        }, EMERGENCY_BEACON_INTERVAL_MS);
    }

    private async broadcastEmergencyBeacon(reason: EmergencyReasonCode): Promise<void> {
        try {
            // Get current battery level
            // ELITE: Robust battery validation to prevent RangeError on simulators/edge cases
            let batteryLevel = 100;
            try {
                const rawBattery = await Battery.getBatteryLevelAsync();
                // Validate: must be a number between 0 and 1 (inclusive)
                if (rawBattery !== null && rawBattery !== undefined &&
                    typeof rawBattery === 'number' && !isNaN(rawBattery) &&
                    rawBattery >= 0 && rawBattery <= 1) {
                    batteryLevel = Math.floor(rawBattery * 100);
                }
                // Clamp to valid UInt8 range (0-100 for percentage)
                batteryLevel = Math.max(0, Math.min(100, batteryLevel));
            } catch {
                // Ignore battery errors - use default 100
            }

            // Create emergency payload
            const payload = MeshProtocol.createEmergencyBeaconPayload(
                this.lastLocation?.lat || 0,
                this.lastLocation?.lng || 0,
                batteryLevel,
                reason,
                this.myName
            );

            // Store for broadcast (with max TTL and critical priority)
            await meshStoreForwardService.storeForBroadcast(
                MeshMessageType.EMERGENCY_BEACON,
                payload,
                {
                    priority: MeshPriority.CRITICAL,
                    ttl: 10, // Max relay hops for emergency
                }
            );

            logger.debug('Emergency beacon broadcast');
        } catch (error) {
            logger.error('Failed to broadcast emergency beacon', error);
        }
    }

    // ===========================================================================
    // IMPACT DETECTION
    // ===========================================================================

    private startImpactDetection(): void {
        try {
            Accelerometer.setUpdateInterval(100); // 10 Hz

            this.accelerometerSubscription = Accelerometer.addListener((data: AccelerometerMeasurement) => {
                this.processAccelerometerData(data);
            });

            logger.debug('Impact detection started');
        } catch (error) {
            logger.warn('Failed to start impact detection', error);
        }
    }

    private stopImpactDetection(): void {
        if (this.accelerometerSubscription) {
            this.accelerometerSubscription.remove();
            this.accelerometerSubscription = null;
        }
    }

    private processAccelerometerData(data: AccelerometerMeasurement): void {
        // Calculate magnitude (G-force)
        const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

        if (magnitude > IMPACT_THRESHOLD) {
            this.impactSamples.push(magnitude);

            // If enough high-G samples, potential impact detected
            if (this.impactSamples.length >= IMPACT_SAMPLES_FOR_CONFIRM) {
                logger.warn('⚠️ High impact detected!');
                this.onPotentialImpact();
                this.impactSamples = [];
            }
        } else {
            // Reset if no sustained impact
            if (this.impactSamples.length > 0) {
                this.impactSamples = [];
            }
        }
    }

    private onPotentialImpact(): void {
        // Don't auto-trigger if already in emergency
        if (this.isInEmergencyMode) return;

        // For now, just log - could add confirmation dialog
        // In production: show modal asking "Are you okay?" with countdown
        logger.warn('Potential impact event - would show confirmation dialog');

        // Auto-trigger after 30 seconds if no response (in real implementation)
        // this.activateEmergencyMode(EmergencyReasonCode.IMPACT_DETECTED);
    }

    // ===========================================================================
    // INACTIVITY DETECTION
    // ===========================================================================

    private startActivityTracking(): void {
        this.lastActivityTime = Date.now();

        // Check inactivity periodically
        this.inactivityTimer = setInterval(() => {
            this.checkInactivity();
        }, 60 * 1000); // Check every minute
    }

    private checkInactivity(): void {
        if (!this.settings.inactivitySOSEnabled) return;
        if (this.isInEmergencyMode) return;

        const elapsed = Date.now() - this.lastActivityTime;

        if (elapsed > INACTIVITY_SOS_MS) {
            logger.warn('Inactivity timeout reached - activating emergency mode');
            this.activateEmergencyMode(EmergencyReasonCode.INACTIVITY_TIMEOUT);
        } else if (elapsed > INACTIVITY_WARNING_MS) {
            logger.debug('Inactivity warning - user may need help');
            // Could show notification asking if user is okay
        }
    }

    /**
     * Call this when user has activity (touch, message, etc.)
     */
    recordActivity(): void {
        this.lastActivityTime = Date.now();
    }

    // ===========================================================================
    // FAMILY SEARCH
    // ===========================================================================

    /**
     * Add family member to track
     */
    async addFamilyMember(member: FamilyMember): Promise<void> {
        const exists = this.familyMembers.find(m => m.id === member.id);
        if (!exists) {
            this.familyMembers.push(member);
            await this.saveFamilyMembers();
        }
    }

    /**
     * Remove family member
     */
    async removeFamilyMember(memberId: string): Promise<void> {
        this.familyMembers = this.familyMembers.filter(m => m.id !== memberId);
        await this.saveFamilyMembers();
    }

    /**
     * Broadcast search for family member
     */
    async searchForFamilyMember(memberId: string): Promise<void> {
        const member = this.familyMembers.find(m => m.id === memberId);
        if (!member) {
            logger.warn(`Family member ${memberId} not found`);
            return;
        }

        // Create search payload
        const payload = Buffer.from(JSON.stringify({
            searcherId: this.myDeviceId,
            searcherName: this.myName,
            targetName: member.name,
            targetDeviceHash: member.deviceIdHash,
        }), 'utf-8');

        await meshStoreForwardService.storeForBroadcast(
            MeshMessageType.FAMILY_SEARCH,
            payload,
            {
                priority: MeshPriority.HIGH,
                ttl: 5,
            }
        );

        logger.info(`Broadcasting search for ${member.name}`);
    }

    /**
     * Respond to family search (if we match)
     */
    async respondToFamilySearch(searchData: { searcherId: string; targetDeviceHash?: string }): Promise<FamilyMember | null> {
        // Check if we're the target
        const myDeviceHash = Buffer.from(this.myDeviceId).toString('hex').substring(0, 8);

        if (searchData.targetDeviceHash && searchData.targetDeviceHash !== myDeviceHash) {
            return null; // Not us
        }

        // Respond with our info
        await this.updateCurrentLocation();

        const response: FamilyMember = {
            id: this.myDeviceId,
            name: this.myName,
            deviceIdHash: myDeviceHash,
            lastKnownLocation: this.lastLocation || undefined,
            lastSeen: Date.now(),
            status: this.isInEmergencyMode ? 'danger' : 'safe',
        };

        return response;
    }

    /**
     * Update family member info when found in mesh
     */
    updateFamilyMemberFromMesh(peerId: string, location?: { lat: number; lng: number }, status?: 'safe' | 'danger' | 'unknown'): void {
        for (const member of this.familyMembers) {
            if (member.deviceIdHash && peerId.includes(member.deviceIdHash)) {
                member.lastSeen = Date.now();
                if (location) member.lastKnownLocation = location;
                if (status) member.status = status;

                this.familyFoundCallbacks.forEach(cb => cb(member));
                break;
            }
        }
    }

    /**
     * Get family members list
     */
    getFamilyMembers(): FamilyMember[] {
        return [...this.familyMembers];
    }

    // ===========================================================================
    // STATUS BROADCAST
    // ===========================================================================

    async broadcastStatusUpdate(status: 'safe' | 'danger' | 'unknown'): Promise<void> {
        await this.updateCurrentLocation();

        const payload = Buffer.from(JSON.stringify({
            status,
            name: this.myName,
            lat: this.lastLocation?.lat,
            lng: this.lastLocation?.lng,
            timestamp: Date.now(),
        }), 'utf-8');

        await meshStoreForwardService.storeForBroadcast(
            MeshMessageType.STATUS,
            payload,
            {
                priority: status === 'danger' ? MeshPriority.CRITICAL : MeshPriority.HIGH,
                ttl: 5,
            }
        );
    }

    // ===========================================================================
    // LOCATION
    // ===========================================================================

    private async updateCurrentLocation(): Promise<void> {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            this.lastLocation = {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            };
        } catch (error) {
            logger.debug('Failed to get location', error);
        }
    }

    getLastLocation(): { lat: number; lng: number } | null {
        return this.lastLocation;
    }

    // ===========================================================================
    // APP STATE
    // ===========================================================================

    private setupAppStateListener(): void {
        AppState.addEventListener('change', this.handleAppStateChange);
    }

    private handleAppStateChange = (nextState: AppStateStatus): void => {
        if (nextState === 'background' || nextState === 'inactive') {
            this.isActive = false;

            // In emergency mode, continue beacons
            if (this.isInEmergencyMode && this.settings.autoLocationBroadcast) {
                logger.debug('App background - emergency beacon continues');
            }
        } else if (nextState === 'active') {
            this.isActive = true;
            this.recordActivity();
        }
    };

    // ===========================================================================
    // CALLBACKS
    // ===========================================================================

    onSOS(callback: (reason: EmergencyReasonCode, location?: { lat: number; lng: number }) => void): () => void {
        this.sosCallbacks.push(callback);
        return () => {
            this.sosCallbacks = this.sosCallbacks.filter(cb => cb !== callback);
        };
    }

    onFamilyMemberFound(callback: (member: FamilyMember) => void): () => void {
        this.familyFoundCallbacks.push(callback);
        return () => {
            this.familyFoundCallbacks = this.familyFoundCallbacks.filter(cb => cb !== callback);
        };
    }

    // ===========================================================================
    // SETTINGS
    // ===========================================================================

    async updateSettings(newSettings: Partial<EmergencySettings>): Promise<void> {
        this.settings = { ...this.settings, ...newSettings };
        await this.saveSettings();

        // Apply changes
        if (newSettings.impactDetectionEnabled !== undefined) {
            if (newSettings.impactDetectionEnabled) {
                this.startImpactDetection();
            } else {
                this.stopImpactDetection();
            }
        }
    }

    getSettings(): EmergencySettings {
        return { ...this.settings };
    }

    // ===========================================================================
    // PERSISTENCE
    // ===========================================================================

    private async saveSettings(): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEY_EMERGENCY_SETTINGS, JSON.stringify(this.settings));
        } catch (error) {
            logger.error('Failed to save emergency settings', error);
        }
    }

    private async loadSettings(): Promise<void> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY_EMERGENCY_SETTINGS);
            if (data) {
                this.settings = { ...this.settings, ...JSON.parse(data) };
            }
        } catch (error) {
            logger.error('Failed to load emergency settings', error);
        }
    }

    private async saveFamilyMembers(): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEY_FAMILY_MEMBERS, JSON.stringify(this.familyMembers));
        } catch (error) {
            logger.error('Failed to save family members', error);
        }
    }

    private async loadFamilyMembers(): Promise<void> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY_FAMILY_MEMBERS);
            if (data) {
                this.familyMembers = JSON.parse(data);
            }
        } catch (error) {
            logger.error('Failed to load family members', error);
        }
    }

    // ===========================================================================
    // HELPERS
    // ===========================================================================

    private getReasonText(reason: EmergencyReasonCode): string {
        switch (reason) {
            case EmergencyReasonCode.MANUAL_SOS:
                return '🆘 Acil yardım istendi';
            case EmergencyReasonCode.IMPACT_DETECTED:
                return '⚠️ Darbe algılandı - otomatik SOS';
            case EmergencyReasonCode.INACTIVITY_TIMEOUT:
                return '⏰ Hareketsizlik - otomatik SOS';
            case EmergencyReasonCode.LOW_BATTERY_WARNING:
                return '🔋 Düşük pil - son konum paylaşıldı';
            case EmergencyReasonCode.FAMILY_PANIC:
                return '👨‍👩‍👧 Aile panik butonu';
            case EmergencyReasonCode.APP_TERMINATION:
                return '📱 Uygulama kapandı - son konum';
            default:
                return '🆘 Acil durum';
        }
    }

    // ===========================================================================
    // CLEANUP
    // ===========================================================================

    cleanup(): void {
        if (this.beaconTimer) {
            clearInterval(this.beaconTimer);
            this.beaconTimer = null;
        }
        if (this.inactivityTimer) {
            clearInterval(this.inactivityTimer);
            this.inactivityTimer = null;
        }
        this.stopImpactDetection();
    }
}

export const meshEmergencyService = new MeshEmergencyService();
export default meshEmergencyService;
