/**
 * SOS STATE MANAGER - ELITE V4
 * Zustand store for unified SOS state management
 * 
 * FEATURES:
 * - Centralized SOS state
 * - Multi-channel tracking
 * - ACK management
 * - Persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SOSStateManager');

// ============================================================================
// TYPES
// ============================================================================

export enum EmergencyReason {
    MANUAL_SOS = 'MANUAL_SOS',
    IMPACT_DETECTED = 'IMPACT_DETECTED',
    INACTIVITY_TIMEOUT = 'INACTIVITY_TIMEOUT',
    LOW_BATTERY = 'LOW_BATTERY',
    FAMILY_PANIC = 'FAMILY_PANIC',
    TRAPPED_DETECTED = 'TRAPPED_DETECTED',
}

export type SOSStatus = 'idle' | 'countdown' | 'broadcasting' | 'acknowledged' | 'cancelled';

export type ChannelStatus = 'idle' | 'pending' | 'sending' | 'sent' | 'failed' | 'acked';

export interface SOSLocation {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
    source: 'gps' | 'network' | 'cached';
}

export interface SOSAck {
    id: string;
    receiverId: string;
    receiverName?: string;
    timestamp: number;
    type: 'received' | 'responding' | 'onsite';
    distance?: number;
}

export interface ChannelState {
    firebase: ChannelStatus;
    mesh: ChannelStatus;
    backend: ChannelStatus;
    push: ChannelStatus;
}

export interface DeviceStatus {
    batteryLevel: number;
    networkStatus: 'online' | 'mesh' | 'offline';
    meshPeers: number;
    locationEnabled: boolean;
}

export interface SOSSignal {
    id: string;
    userId: string;
    timestamp: number;
    location: SOSLocation | null;
    status: SOSStatus;
    reason: EmergencyReason;
    message: string;
    trapped: boolean;
    device: DeviceStatus;
    channels: ChannelState;
    acks: SOSAck[];
    beaconCount: number;
    lastBeaconAt: number | null;
}

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface SOSState {
    // Current Signal
    currentSignal: SOSSignal | null;
    isActive: boolean;

    // Countdown
    countdownSeconds: number;
    isCountingDown: boolean;

    // History
    signalHistory: SOSSignal[];

    // Stats
    stats: {
        totalSignals: number;
        totalAcks: number;
        avgResponseTime: number;
    };

    // Actions
    startCountdown: (reason: EmergencyReason, message?: string) => void;
    cancelCountdown: () => void;
    decrementCountdown: () => number;
    activateSOS: (signal: SOSSignal) => void;
    updateLocation: (location: SOSLocation) => void;
    updateChannelStatus: (channel: keyof ChannelState, status: ChannelStatus) => void;
    updateDeviceStatus: (device: Partial<DeviceStatus>) => void;
    addAck: (ack: SOSAck) => void;
    incrementBeaconCount: () => void;
    stopSOS: () => void;
    reset: () => void;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_COUNTDOWN = 3;

const createEmptySignal = (
    userId: string,
    reason: EmergencyReason,
    message: string
): SOSSignal => ({
    id: `sos_${Date.now()}_${userId}`,
    userId,
    timestamp: Date.now(),
    location: null,
    status: 'countdown',
    reason,
    message,
    trapped: reason === EmergencyReason.TRAPPED_DETECTED || reason === EmergencyReason.IMPACT_DETECTED,
    device: {
        batteryLevel: 100,
        networkStatus: 'offline',
        meshPeers: 0,
        locationEnabled: false,
    },
    channels: {
        firebase: 'idle',
        mesh: 'idle',
        backend: 'idle',
        push: 'idle',
    },
    acks: [],
    beaconCount: 0,
    lastBeaconAt: null,
});

// ============================================================================
// STORE
// ============================================================================

export const useSOSStore = create<SOSState>()(
    persist(
        (set, get) => ({
            // Initial State
            currentSignal: null,
            isActive: false,
            countdownSeconds: DEFAULT_COUNTDOWN,
            isCountingDown: false,
            signalHistory: [],
            stats: {
                totalSignals: 0,
                totalAcks: 0,
                avgResponseTime: 0,
            },

            // Start Countdown
            startCountdown: (reason, message = 'Acil yardım gerekiyor!') => {
                const userId = 'user'; // Will be set by controller
                const signal = createEmptySignal(userId, reason, message);

                set({
                    currentSignal: signal,
                    isCountingDown: true,
                    countdownSeconds: DEFAULT_COUNTDOWN,
                });

                logger.info(`🆘 SOS countdown started: ${reason}`);
            },

            // Cancel Countdown
            cancelCountdown: () => {
                const { currentSignal } = get();
                if (currentSignal && currentSignal.status === 'countdown') {
                    set({
                        currentSignal: { ...currentSignal, status: 'cancelled' },
                        isCountingDown: false,
                        countdownSeconds: DEFAULT_COUNTDOWN,
                    });

                    logger.info('SOS countdown cancelled');
                }
            },

            // Decrement Countdown
            decrementCountdown: () => {
                const { countdownSeconds } = get();
                const newCount = countdownSeconds - 1;
                set({ countdownSeconds: newCount });
                return newCount;
            },

            // Activate SOS
            activateSOS: (signal) => {
                set(state => ({
                    currentSignal: { ...signal, status: 'broadcasting' },
                    isActive: true,
                    isCountingDown: false,
                    stats: {
                        ...state.stats,
                        totalSignals: state.stats.totalSignals + 1,
                    },
                }));

                logger.warn(`🆘 SOS ACTIVATED: ${signal.id}`);
            },

            // Update Location
            updateLocation: (location) => {
                const { currentSignal } = get();
                if (currentSignal) {
                    set({
                        currentSignal: { ...currentSignal, location },
                    });
                }
            },

            // Update Channel Status
            updateChannelStatus: (channel, status) => {
                const { currentSignal } = get();
                if (currentSignal) {
                    set({
                        currentSignal: {
                            ...currentSignal,
                            channels: { ...currentSignal.channels, [channel]: status },
                        },
                    });

                    logger.debug(`Channel ${channel}: ${status}`);
                }
            },

            // Update Device Status
            updateDeviceStatus: (device) => {
                const { currentSignal } = get();
                if (currentSignal) {
                    set({
                        currentSignal: {
                            ...currentSignal,
                            device: { ...currentSignal.device, ...device },
                        },
                    });
                }
            },

            // Add ACK
            addAck: (ack) => {
                const { currentSignal } = get();
                if (currentSignal) {
                    const exists = currentSignal.acks.some(a => a.id === ack.id);
                    if (!exists) {
                        const responseTime = ack.timestamp - currentSignal.timestamp;

                        set(state => ({
                            currentSignal: {
                                ...currentSignal,
                                acks: [...currentSignal.acks, ack],
                                status: 'acknowledged',
                            },
                            stats: {
                                ...state.stats,
                                totalAcks: state.stats.totalAcks + 1,
                                avgResponseTime:
                                    (state.stats.avgResponseTime * state.stats.totalAcks + responseTime) /
                                    (state.stats.totalAcks + 1),
                            },
                        }));

                        logger.info(`✅ ACK received from ${ack.receiverName || ack.receiverId}`);
                    }
                }
            },

            // Increment Beacon Count
            incrementBeaconCount: () => {
                const { currentSignal } = get();
                if (currentSignal) {
                    set({
                        currentSignal: {
                            ...currentSignal,
                            beaconCount: currentSignal.beaconCount + 1,
                            lastBeaconAt: Date.now(),
                        },
                    });
                }
            },

            // Stop SOS
            stopSOS: () => {
                const { currentSignal, signalHistory } = get();

                if (currentSignal) {
                    const finalSignal = { ...currentSignal, status: 'cancelled' as SOSStatus };

                    set({
                        currentSignal: null,
                        isActive: false,
                        isCountingDown: false,
                        countdownSeconds: DEFAULT_COUNTDOWN,
                        signalHistory: [finalSignal, ...signalHistory].slice(0, 50),
                    });

                    logger.info('🛑 SOS stopped');
                }
            },

            // Reset
            reset: () => {
                set({
                    currentSignal: null,
                    isActive: false,
                    isCountingDown: false,
                    countdownSeconds: DEFAULT_COUNTDOWN,
                });
            },
        }),
        {
            name: 'afetnet-sos-store',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                signalHistory: state.signalHistory,
                stats: state.stats,
            }),
        }
    )
);

export default useSOSStore;
