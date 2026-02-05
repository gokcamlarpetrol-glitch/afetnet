/**
 * EMERGENCY HEALTH SHARING SERVICE
 * Broadcasts critical health data via BLE mesh when SOS is activated.
 * 
 * PRIVACY FIRST:
 * - Only broadcasts when SOS is active AND user has opted-in
 * - Minimal data: blood type, allergies, critical conditions
 * - No full name (only initials), no phone numbers, no insurance
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { MeshProtocol, MeshMessageType } from './mesh/MeshProtocol';
import { getDeviceId } from '../utils/device';

const SETTINGS_KEY = '@afetnet:health_sharing_enabled';

export interface HealthSOSData {
    initials: string;
    bloodType: string;
    allergies: string[];
    conditions: string[];
    medications: string[];
    deviceId: string;
    timestamp: number;
    distance?: number; // Estimated distance in meters
}

class EmergencyHealthSharingService {
    private isEnabled: boolean = false;
    private isBroadcasting: boolean = false;
    private broadcastInterval: NodeJS.Timeout | null = null;
    private deviceId: string = '';
    private meshService: any = null;

    // Listeners for received health SOS data
    private listeners: Set<(data: HealthSOSData) => void> = new Set();

    /**
     * Initialize the service
     */
    async initialize(): Promise<void> {
        try {
            // Load user preference
            const enabled = await AsyncStorage.getItem(SETTINGS_KEY);
            this.isEnabled = enabled === 'true';

            // Get device ID
            this.deviceId = await getDeviceId();

            // Try to get mesh service
            try {
                const { meshNetworkService } = await import('./mesh/MeshNetworkService');
                this.meshService = meshNetworkService;
            } catch {
                logger.debug('Mesh service not available for health sharing');
            }

            logger.info('EmergencyHealthSharingService initialized', { enabled: this.isEnabled });
        } catch (error) {
            logger.error('Failed to initialize EmergencyHealthSharingService:', error);
        }
    }

    /**
     * Check if health sharing is enabled by user
     */
    isHealthSharingEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Enable/disable health sharing
     */
    async setEnabled(enabled: boolean): Promise<void> {
        this.isEnabled = enabled;
        await AsyncStorage.setItem(SETTINGS_KEY, enabled ? 'true' : 'false');
        logger.info('Health sharing preference updated:', { enabled });
    }

    /**
     * Start broadcasting health data (called when SOS is activated)
     */
    async startBroadcast(): Promise<void> {
        if (!this.isEnabled) {
            logger.info('Health sharing disabled, skipping broadcast');
            return;
        }

        if (this.isBroadcasting) {
            logger.debug('Already broadcasting health data');
            return;
        }

        try {
            // Get health profile
            const { useHealthProfileStore } = await import('../stores/healthProfileStore');
            const profile = useHealthProfileStore.getState().profile;

            if (!profile) {
                logger.warn('No health profile to broadcast');
                return;
            }

            // Create initials from name
            const initials = this.createInitials(profile.firstName, profile.lastName);

            // Prepare minimal health data
            const healthData = {
                initials,
                bloodType: profile.bloodType || '',
                allergies: profile.allergies || [],
                conditions: profile.chronicConditions || [],
                medications: profile.medications || [],
            };

            this.isBroadcasting = true;

            // Broadcast immediately
            await this.broadcastHealthPacket(healthData);

            // Then broadcast every 30 seconds to ensure nearby devices receive it
            this.broadcastInterval = setInterval(async () => {
                await this.broadcastHealthPacket(healthData);
            }, 30000);

            logger.info('Started health data broadcast', {
                bloodType: healthData.bloodType,
                allergyCount: healthData.allergies.length
            });
        } catch (error) {
            logger.error('Failed to start health broadcast:', error);
        }
    }

    /**
     * Stop broadcasting health data (called when SOS is cancelled)
     */
    async stopBroadcast(): Promise<void> {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
        this.isBroadcasting = false;
        logger.info('Stopped health data broadcast');
    }

    /**
     * Check if currently broadcasting
     */
    isBroadcastingHealth(): boolean {
        return this.isBroadcasting;
    }

    /**
     * Add listener for received health SOS data
     */
    addListener(callback: (data: HealthSOSData) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Handle received HEALTH_SOS packet from mesh network
     */
    handleReceivedPacket(sourceId: string, payload: Buffer, rssi?: number): void {
        try {
            const parsed = MeshProtocol.parseHealthSOSPayload(payload);
            if (!parsed) {
                logger.warn('Failed to parse health SOS payload');
                return;
            }

            // Estimate distance from RSSI if available
            const distance = rssi ? this.estimateDistance(rssi) : undefined;

            const healthData: HealthSOSData = {
                ...parsed,
                deviceId: sourceId,
                timestamp: Date.now(),
                distance,
            };

            // Notify all listeners
            this.listeners.forEach(listener => {
                try {
                    listener(healthData);
                } catch (e) {
                    logger.error('Health listener error:', e);
                }
            });

            logger.info('Received health SOS data', {
                initials: parsed.initials,
                bloodType: parsed.bloodType,
                distance,
            });
        } catch (error) {
            logger.error('Error handling health SOS packet:', error);
        }
    }

    // =========================================================================
    // PRIVATE METHODS
    // =========================================================================

    private async broadcastHealthPacket(healthData: {
        initials: string;
        bloodType: string;
        allergies: string[];
        conditions: string[];
        medications: string[];
    }): Promise<void> {
        if (!this.meshService) {
            logger.debug('Mesh service not available for health broadcast');
            return;
        }

        try {
            const payload = MeshProtocol.createHealthSOSPayload(
                healthData.initials,
                healthData.bloodType,
                healthData.allergies,
                healthData.conditions,
                healthData.medications
            );

            const packet = MeshProtocol.serialize(
                MeshMessageType.HEALTH_SOS,
                this.deviceId,
                payload,
                3, // TTL: 3 hops
                100 // High Q-Score for emergency
            );

            // Send via mesh network
            if (this.meshService.broadcastPacket) {
                await this.meshService.broadcastPacket(packet);
            }

            logger.debug('Health SOS packet broadcasted');
        } catch (error) {
            logger.error('Failed to broadcast health packet:', error);
        }
    }

    private createInitials(firstName?: string, lastName?: string): string {
        const first = (firstName || 'X')[0].toUpperCase();
        const last = (lastName || 'X')[0].toUpperCase();
        return `${first}${last}`;
    }

    private estimateDistance(rssi: number): number {
        // Simple RSSI to distance estimation
        // RSSI at 1m is typically around -50 to -60 dBm
        const txPower = -59; // Assumed TX power at 1m
        const ratio = rssi / txPower;

        if (ratio < 1.0) {
            return Math.pow(ratio, 10);
        }

        const distance = 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
        return Math.round(distance);
    }
}

// Singleton instance
export const emergencyHealthSharingService = new EmergencyHealthSharingService();
