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
import { eliteStorage } from '../../utils/storage';
import { createLogger } from '../../utils/logger';
import { secureId } from '../../utils/secureId';

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

// 'unconfirmed' = sent but no ACK received within timeout window.
// Distinguishes "fire-and-forget sent" from "rescue team actually acknowledged".
// Critical for life-safety transparency: user must know if SOS truly reached someone.
// F3: 'queued' = packet accepted by transport but no recipient yet (mesh with 0
// peers, or cloud while offline). Distinct from 'failed' so the UI can show
// "yardım çağrısı bekleniyor" rather than misleading "yardım gönderilemedi".
export type ChannelStatus = 'idle' | 'pending' | 'sending' | 'sent' | 'unconfirmed' | 'failed' | 'acked' | 'queued';

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
    isSilent: boolean;
    device: DeviceStatus;
    channels: ChannelState;
    acks: SOSAck[];
    beaconCount: number;
    lastBeaconAt: number | null;
}

/**
 * Incoming SOS alert from another user (received via SOSAlertListener).
 * Displayed as markers on DisasterMapScreen.
 */
export interface IncomingSOSAlert {
    id: string;
    signalId: string;
    senderDeviceId: string;
    senderUid?: string;
    senderName: string;
    latitude: number;
    longitude: number;
    timestamp: number;
    message: string;
    trapped: boolean;
    battery?: number;
    healthInfo?: {
        bloodType?: string;
        allergies?: string;
        chronicConditions?: string;
        emergencyNotes?: string;
    };
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
    countdownStartedAt: number | null; // FIX 18: absolute timestamp for background-safe countdown
    countdownTotalSeconds: number;     // P0-4: snapshot of the originally requested duration (5s manual / 30s auto)

    // History
    signalHistory: SOSSignal[];

    // Incoming SOS from other users
    incomingSOSAlerts: IncomingSOSAlert[];

    // Stats
    stats: {
        totalSignals: number;
        totalAcks: number;
        avgResponseTime: number;
    };

    // Actions
    // P0-4: countdownSeconds parameter — manual SOS = 5s (user-conscious),
    // automatic SOS (fall/crash) = 30s (Apple Watch standard, life-safety
    // best practice; user may be unconscious or disoriented and need a
    // longer cancel window). Defaults to DEFAULT_COUNTDOWN when omitted.
    startCountdown: (reason: EmergencyReason, userId: string, message?: string, isSilent?: boolean, countdownSeconds?: number) => void;
    cancelCountdown: () => void;
    setSilentMode: (isSilent: boolean) => void;
    decrementCountdown: () => number;
    recalculateCountdown: () => number; // FIX 18: recalculate from absolute timestamp
    activateSOS: (signal: SOSSignal) => void;
    updateLocation: (location: SOSLocation) => void;
    updateChannelStatus: (channel: keyof ChannelState, status: ChannelStatus) => void;
    updateDeviceStatus: (device: Partial<DeviceStatus>) => void;
    addAck: (ack: SOSAck) => void;
    incrementBeaconCount: () => void;
    addIncomingSOSAlert: (alert: IncomingSOSAlert) => void;
    removeIncomingSOSAlertBySignalId: (signalId: string) => void;
    clearIncomingSOSAlerts: () => void;
    stopSOS: () => void;
    reset: () => void;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

// P0-4: 5s for manual SOS — long enough to cancel an accidental tap but
// short enough that a genuine emergency is broadcast quickly.
// Automatic triggers (fall/crash) override this to 30s via startCountdown's
// optional `countdownSeconds` parameter.
const DEFAULT_COUNTDOWN = 5;
const AUTO_TRIGGER_COUNTDOWN = 30;

const createEmptySignal = (
    userId: string,
    reason: EmergencyReason,
    message: string,
    isSilent: boolean = false
): SOSSignal => ({
    // H5/H6: CSPRNG-backed ID prevents collisions when fall-detection fires
    // multiple SOS triggers within the same millisecond across devices.
    id: `sos_${Date.now()}_${userId}_${secureId(8)}`,
    userId,
    timestamp: Date.now(),
    location: null,
    status: 'countdown',
    reason,
    message,
    trapped: reason === EmergencyReason.TRAPPED_DETECTED || reason === EmergencyReason.IMPACT_DETECTED,
    isSilent,
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
            countdownStartedAt: null,
            countdownTotalSeconds: DEFAULT_COUNTDOWN,
            signalHistory: [],
            incomingSOSAlerts: [],
            stats: {
                totalSignals: 0,
                totalAcks: 0,
                avgResponseTime: 0,
            },

            // Start Countdown
            startCountdown: (reason, userId, message = 'Acil yardım gerekiyor!', isSilent = false, countdownSeconds) => {
                const signal = createEmptySignal(userId, reason, message, isSilent);

                // P0-4: Clamp explicit override; default to 5s manual / 30s auto.
                const isAutoTrigger =
                    reason === EmergencyReason.IMPACT_DETECTED ||
                    reason === EmergencyReason.INACTIVITY_TIMEOUT ||
                    reason === EmergencyReason.TRAPPED_DETECTED;
                const requestedSeconds = typeof countdownSeconds === 'number' && countdownSeconds > 0 && countdownSeconds <= 60
                    ? Math.round(countdownSeconds)
                    : (isAutoTrigger ? AUTO_TRIGGER_COUNTDOWN : DEFAULT_COUNTDOWN);

                set({
                    currentSignal: signal,
                    isCountingDown: true,
                    countdownSeconds: requestedSeconds,
                    countdownTotalSeconds: requestedSeconds, // P0-4: snapshot for decrement/recalculate
                    countdownStartedAt: Date.now(), // FIX 18: store absolute start time
                });

                logger.info(`🆘 SOS countdown started: ${reason} (${requestedSeconds}s)`);
            },

            // Cancel Countdown
            cancelCountdown: () => {
                const { currentSignal } = get();
                if (currentSignal && currentSignal.status === 'countdown') {
                    // CRITICAL FIX: Null out currentSignal to prevent stale cancelled
                    // signal from being persisted to MMKV via partialize().
                    // Previously kept { status: 'cancelled' } which persisted forever.
                    set({
                        currentSignal: null,
                        isCountingDown: false,
                        countdownSeconds: DEFAULT_COUNTDOWN,
                        countdownTotalSeconds: DEFAULT_COUNTDOWN, // P0-4: reset snapshot
                        countdownStartedAt: null,
                    });

                    logger.info('SOS countdown cancelled');
                }
            },

            // Set Silent Mode
            setSilentMode: (isSilent) => {
                const { currentSignal } = get();
                if (currentSignal && currentSignal.status === 'countdown') {
                    set({
                        currentSignal: { ...currentSignal, isSilent },
                    });
                }
            },

            // Decrement Countdown — FIX 18: Use absolute timestamp for background-safe accuracy
            // P0-4: derive from countdownTotalSeconds snapshot (5s manual / 30s auto)
            decrementCountdown: () => {
                const { countdownStartedAt, countdownTotalSeconds, isCountingDown } = get();
                // KRİTİK (görev #26): isCountingDown guard — savunma derinliği.
                // Geri sayım iptal/aktivasyon ile durdurulduktan sonra hâlâ çalışan
                // bir interval bu fonksiyonu çağırırsa countdownSeconds'i sıfıra
                // çekip durdurulmuş bir geri sayımı yanlışça canlandırmasın.
                if (!isCountingDown) {
                    return get().countdownSeconds;
                }
                const total = typeof countdownTotalSeconds === 'number' && countdownTotalSeconds > 0
                    ? countdownTotalSeconds
                    : DEFAULT_COUNTDOWN;
                if (countdownStartedAt && typeof countdownStartedAt === 'number' && countdownStartedAt > 0 && countdownStartedAt <= Date.now()) {
                    const elapsed = Math.floor((Date.now() - countdownStartedAt) / 1000);
                    const newCount = Math.max(0, total - elapsed);
                    set({ countdownSeconds: newCount });
                    return newCount;
                }
                // Fallback: relative decrement if no timestamp (shouldn't happen)
                const { countdownSeconds } = get();
                const newCount = Math.max(0, countdownSeconds - 1);
                set({ countdownSeconds: newCount });
                return newCount;
            },

            // FIX 18: Recalculate countdown from absolute timestamp (called on AppState 'active')
            recalculateCountdown: () => {
                const { countdownStartedAt, isCountingDown, countdownTotalSeconds } = get();
                if (!isCountingDown || !countdownStartedAt) return get().countdownSeconds;
                const total = typeof countdownTotalSeconds === 'number' && countdownTotalSeconds > 0
                    ? countdownTotalSeconds
                    : DEFAULT_COUNTDOWN;
                const elapsed = Math.floor((Date.now() - countdownStartedAt) / 1000);
                const newCount = Math.max(0, total - elapsed);
                set({ countdownSeconds: newCount });
                return newCount;
            },

            // Activate SOS
            activateSOS: (signal) => {
                set(state => ({
                    currentSignal: { ...signal, status: 'broadcasting' },
                    isActive: true,
                    isCountingDown: false,
                    countdownStartedAt: null,
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
            // CRITICAL FIX (SOS-C1): Functional update prevents last-write-wins race.
            // SOSChannelRouter calls updateChannelStatus in parallel from 6 channels.
            // Previously, each call read currentSignal at queue time and spread it,
            // so the second call's spread could overwrite the first's channel update.
            // set(state => ...) reads the latest state inside Zustand's internal lock.
            updateChannelStatus: (channel, status) => {
                set((state) => {
                    if (!state.currentSignal) return state;
                    return {
                        currentSignal: {
                            ...state.currentSignal,
                            channels: { ...state.currentSignal.channels, [channel]: status },
                        },
                    };
                });
                logger.debug(`Channel ${channel}: ${status}`);
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

            // Add or update incoming SOS alert from another user
            addIncomingSOSAlert: (alert) => {
                const { incomingSOSAlerts } = get();
                // Check if we already have this alert (by signalId or id)
                const existingIdx = incomingSOSAlerts.findIndex(
                    a => a.signalId === alert.signalId || a.id === alert.id
                );
                if (existingIdx >= 0) {
                    // UPDATE existing alert with new data (location, battery, status)
                    // This ensures rescuers see the latest info
                    const updated = [...incomingSOSAlerts];
                    updated[existingIdx] = { ...updated[existingIdx], ...alert };
                    set({ incomingSOSAlerts: updated });
                    return;
                }
                // Keep max 50, newest first
                set({
                    incomingSOSAlerts: [alert, ...incomingSOSAlerts].slice(0, 50),
                });
                logger.info(`Incoming SOS alert added: ${alert.senderName}`);
            },

            // Remove a single incoming SOS alert by signalId (used when SOS is cancelled)
            removeIncomingSOSAlertBySignalId: (signalId: string) => {
                const { incomingSOSAlerts } = get();
                const filtered = incomingSOSAlerts.filter(a => a.signalId !== signalId);
                if (filtered.length !== incomingSOSAlerts.length) {
                    set({ incomingSOSAlerts: filtered });
                    logger.info(`🗑️ Removed cancelled SOS alert: ${signalId}`);
                }
            },

            // Clear all incoming SOS alerts
            clearIncomingSOSAlerts: () => {
                set({ incomingSOSAlerts: [] });
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
                        countdownTotalSeconds: DEFAULT_COUNTDOWN, // P0-4: reset snapshot
                        countdownStartedAt: null,
                        signalHistory: [finalSignal, ...signalHistory].slice(0, 50),
                    });

                    logger.info('🛑 SOS stopped');
                } else {
                    // KRİTİK (görev #26): currentSignal null ise zombie state.
                    // Erken return isActive'i takılı true bırakıyordu — UI sonsuza
                    // dek aktif SOS gösteriyor, yeni SOS tetiklenemiyor. currentSignal
                    // olmasa bile isActive/isCountingDown bayraklarını temizle.
                    set({
                        isActive: false,
                        isCountingDown: false,
                        countdownSeconds: DEFAULT_COUNTDOWN,
                        countdownTotalSeconds: DEFAULT_COUNTDOWN,
                        countdownStartedAt: null,
                    });
                    logger.info('🛑 SOS stopped (zombie state cleared — currentSignal was null)');
                }
            },

            // Reset
            reset: () => {
                // HATA 2 FIX: Complete reset including history + incoming alerts for logout/account-switch.
                // Without this, User A's SOS history persists in MMKV under shared key,
                // User B sees old user's SOS events on first login → privacy breach.
                set({
                    currentSignal: null,
                    isActive: false,
                    isCountingDown: false,
                    countdownSeconds: DEFAULT_COUNTDOWN,
                    countdownTotalSeconds: DEFAULT_COUNTDOWN, // P0-4: reset snapshot
                    countdownStartedAt: null,
                    signalHistory: [],
                    incomingSOSAlerts: [],
                    stats: {
                        totalSignals: 0,
                        totalAcks: 0,
                        avgResponseTime: 0,
                    },
                });
                // Also clear the MMKV persistence backing store entirely.
                try {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const { eliteStorage } = require('../../utils/storage');
                    if (eliteStorage && typeof eliteStorage.removeItem === 'function') {
                        eliteStorage.removeItem('afetnet-sos-store');
                    }
                } catch { /* best-effort */ }
                logger.info('SOS store fully reset (history + incoming + stats cleared)');
            },
        }),
        {
            name: 'afetnet-sos-store',
            storage: createJSONStorage(() => eliteStorage),
            partialize: (state) => ({
                signalHistory: state.signalHistory,
                stats: state.stats,
                // CRITICAL: Persist active SOS so it survives app crash
                currentSignal: state.currentSignal,
                isActive: state.isActive,
                // CRITICAL FIX: Persist countdown state so it survives app crash/kill.
                // Without these, a crash during countdown loses the countdown entirely
                // and the user never gets SOS activated.
                countdownStartedAt: state.countdownStartedAt,
                isCountingDown: state.isCountingDown,
                countdownSeconds: state.countdownSeconds,
                countdownTotalSeconds: state.countdownTotalSeconds, // P0-4: must survive crash so resume uses correct duration
                // Persist incoming SOS alerts so rescuers don't lose map markers on restart
                incomingSOSAlerts: state.incomingSOSAlerts,
            }),
        }
    )
);

export default useSOSStore;
