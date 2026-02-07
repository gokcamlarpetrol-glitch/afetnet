/**
 * SOS CHANNEL ROUTER - ELITE V4
 * Routes SOS signals through multiple channels simultaneously
 * 
 * FEATURES:
 * - Firebase Realtime (online)
 * - BLE Mesh Broadcast (offline)
 * - Backend API (rescue coordination)
 * - Push Notifications (family alerts)
 * - Automatic failover
 */

import { createLogger } from '../../utils/logger';
import { SOSSignal, SOSLocation, ChannelStatus, useSOSStore } from './SOSStateManager';
import NetInfo from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';

const logger = createLogger('SOSChannelRouter');

// ============================================================================
// CHANNEL ROUTER CLASS
// ============================================================================

class SOSChannelRouter {
    private isInitialized = false;

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        this.isInitialized = true;
        logger.info('SOS Channel Router initialized');
    }

    // ============================================================================
    // MAIN BROADCAST
    // ============================================================================

    /**
     * Broadcast SOS through ALL available channels
     * CRITICAL: Maximum reach for life-saving alerts
     */
    async broadcastSOS(signal: SOSSignal): Promise<void> {
        logger.warn('📡 Broadcasting SOS through all channels...');

        const store = useSOSStore.getState();

        // Parallel broadcast through all channels
        await Promise.allSettled([
            this.broadcastViaMesh(signal, store.updateChannelStatus),
            this.broadcastViaFirebase(signal, store.updateChannelStatus),
            this.broadcastViaBackend(signal, store.updateChannelStatus),
            this.broadcastViaPush(signal, store.updateChannelStatus),
        ]);

        logger.info('✅ SOS broadcast completed on all channels');
    }

    // ============================================================================
    // MESH CHANNEL (OFFLINE GUARANTEED)
    // ============================================================================

    private async broadcastViaMesh(
        signal: SOSSignal,
        updateStatus: (channel: 'mesh', status: ChannelStatus) => void
    ): Promise<void> {
        updateStatus('mesh', 'sending');

        try {
            // Dynamic import to avoid circular dependencies
            const { meshNetworkService } = await import('../mesh');
            const { MeshMessageType } = await import('../mesh/MeshProtocol');

            // Ensure mesh is running
            if (!meshNetworkService.getIsRunning()) {
                await meshNetworkService.start();
            }

            // Create SOS payload
            const payload = JSON.stringify({
                type: 'SOS',
                id: signal.id,
                userId: signal.userId,
                timestamp: signal.timestamp,
                location: signal.location,
                message: signal.message,
                trapped: signal.trapped,
                reason: signal.reason,
                battery: signal.device.batteryLevel,
            });

            // Broadcast via mesh with max TTL
            await meshNetworkService.broadcastMessage(payload, MeshMessageType.SOS);

            updateStatus('mesh', 'sent');
            logger.info('✅ SOS sent via Mesh');
        } catch (error) {
            logger.error('❌ Mesh broadcast failed:', error);
            updateStatus('mesh', 'failed');
        }
    }

    // ============================================================================
    // FIREBASE CHANNEL (ONLINE)
    // ============================================================================

    private async broadcastViaFirebase(
        signal: SOSSignal,
        updateStatus: (channel: 'firebase', status: ChannelStatus) => void
    ): Promise<void> {
        updateStatus('firebase', 'pending');

        try {
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) {
                logger.debug('Firebase skipped: offline');
                updateStatus('firebase', 'idle');
                return;
            }

            updateStatus('firebase', 'sending');

            const { firebaseDataService } = await import('../FirebaseDataService');

            if (!firebaseDataService.isInitialized) {
                await firebaseDataService.initialize();
            }

            // Save SOS to Firebase
            await firebaseDataService.saveMessage(signal.userId, {
                id: signal.id,
                fromDeviceId: signal.userId,
                toDeviceId: 'emergency_broadcast',
                content: JSON.stringify({
                    type: 'SOS',
                    message: signal.message,
                    location: signal.location,
                    trapped: signal.trapped,
                    reason: signal.reason,
                    battery: signal.device.batteryLevel,
                }),
                timestamp: signal.timestamp,
                type: 'sos',
            });

            updateStatus('firebase', 'sent');
            logger.info('✅ SOS sent via Firebase');
        } catch (error) {
            logger.error('❌ Firebase broadcast failed:', error);
            updateStatus('firebase', 'failed');
        }
    }

    // ============================================================================
    // BACKEND CHANNEL (RESCUE COORDINATION)
    // ============================================================================

    private async broadcastViaBackend(
        signal: SOSSignal,
        updateStatus: (channel: 'backend', status: ChannelStatus) => void
    ): Promise<void> {
        updateStatus('backend', 'pending');

        try {
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) {
                logger.debug('Backend skipped: offline');
                updateStatus('backend', 'idle');
                return;
            }

            updateStatus('backend', 'sending');

            const { backendEmergencyService } = await import('../BackendEmergencyService');

            if (!backendEmergencyService.initialized) {
                await backendEmergencyService.initialize();
            }

            await backendEmergencyService.sendEmergencyMessage({
                messageId: signal.id,
                content: signal.message,
                timestamp: signal.timestamp,
                type: 'sos',
                priority: 'critical',
                location: signal.location ? {
                    latitude: signal.location.latitude,
                    longitude: signal.location.longitude,
                    accuracy: signal.location.accuracy,
                } : undefined,
            });

            updateStatus('backend', 'sent');
            logger.info('✅ SOS sent via Backend');
        } catch (error) {
            logger.error('❌ Backend broadcast failed:', error);
            updateStatus('backend', 'failed');
        }
    }

    // ============================================================================
    // PUSH NOTIFICATION CHANNEL (FAMILY ALERTS)
    // ============================================================================

    private async broadcastViaPush(
        signal: SOSSignal,
        updateStatus: (channel: 'push', status: ChannelStatus) => void
    ): Promise<void> {
        updateStatus('push', 'pending');

        try {
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) {
                logger.debug('Push skipped: offline');
                updateStatus('push', 'idle');
                return;
            }

            updateStatus('push', 'sending');

            const { multiChannelAlertService } = await import('../MultiChannelAlertService');

            await multiChannelAlertService.sendAlert({
                title: signal.trapped ? '🚨 ENKAZ ALTINDA - ACİL YARDIM!' : '🆘 ACİL YARDIM ÇAĞRISI',
                body: `${signal.message}\n${signal.location
                    ? `Konum: ${signal.location.latitude.toFixed(4)}, ${signal.location.longitude.toFixed(4)}`
                    : 'Konum bilgisi yok'
                    }`,
                priority: 'critical',
                sound: 'default',
                vibrationPattern: [0, 200, 100, 200, 100, 200, 100, 200],
                ttsText: signal.trapped
                    ? 'ACİL DURUM! Enkaz altında biri var! Acil yardım gerekiyor!'
                    : 'Acil yardım çağrısı alındı!',
                channels: {
                    pushNotification: true,
                    fullScreenAlert: true,
                    alarmSound: true,
                    vibration: true,
                    tts: true,
                    led: true,
                    bluetooth: false,
                },
                data: {
                    type: 'sos',
                    signalId: signal.id,
                    userId: signal.userId,
                    location: signal.location,
                    timestamp: signal.timestamp,
                    trapped: signal.trapped,
                },
            });

            updateStatus('push', 'sent');
            logger.info('✅ SOS sent via Push');
        } catch (error) {
            logger.error('❌ Push broadcast failed:', error);
            updateStatus('push', 'failed');
        }
    }

    // ============================================================================
    // STATUS CHECK
    // ============================================================================

    async getNetworkStatus(): Promise<'online' | 'mesh' | 'offline'> {
        try {
            const netInfo = await NetInfo.fetch();
            if (netInfo.isConnected) {
                return 'online';
            }

            // Check mesh peers
            try {
                const { useMeshStore } = await import('../mesh/MeshStore');
                const meshPeers = useMeshStore.getState().peers.length;
                if (meshPeers > 0) {
                    return 'mesh';
                }
            } catch {
                // Mesh not available
            }

            return 'offline';
        } catch {
            return 'offline';
        }
    }

    async getBatteryLevel(): Promise<number> {
        try {
            const level = await Battery.getBatteryLevelAsync();
            return Math.round(level * 100);
        } catch {
            return 100;
        }
    }
}

export const sosChannelRouter = new SOSChannelRouter();
export default sosChannelRouter;
