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
import { SOSSignal, ChannelStatus, useSOSStore } from './SOSStateManager';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';
import { isApprovedFamilyMember } from '../../utils/familyApproval';
import { DirectStorage } from '../../utils/storage';

const logger = createLogger('SOSChannelRouter');

type SOSBroadcastChannel = 'mesh' | 'firebase' | 'backend' | 'push' | 'family' | 'nearbyUsers';
type CloudRetryChannel = Extract<SOSBroadcastChannel, 'firebase' | 'backend' | 'family' | 'nearbyUsers'>;
type SOSCloudOutboxItem = {
    signal: SOSSignal;
    pendingChannels: CloudRetryChannel[];
    createdAt: number;
    lastAttemptAt: number;
    retryCount: number;
};

const SOS_CLOUD_OUTBOX_KEY = '@afetnet:sos_cloud_outbox:v1';
const SOS_CLOUD_OUTBOX_TTL_MS = 30 * 60 * 1000;
const SOS_CLOUD_OUTBOX_MAX_ITEMS = 10;

// P0-1: Separate outbox for SOS cancellations. We don't need to re-broadcast
// a cancelled signal — we only need to flip `status` on existing Firestore
// docs (sos_broadcasts/{id}, sos_signals/{id}, sos_alerts/{member}/items/{id},
// devices/{member}/sos_alerts/{id}) once connectivity returns. Stored
// per-uid so a logout doesn't replay another user's cancellations.
const SOS_CANCEL_OUTBOX_KEY_PREFIX = '@afetnet:sos_cancel_outbox';
const SOS_CANCEL_OUTBOX_TTL_MS = 24 * 60 * 60 * 1000; // 24h — cancel can wait
const SOS_CANCEL_OUTBOX_MAX_ITEMS = 25;

type SOSCancelOutboxItem = {
    signalId: string;
    queuedAt: number;
    lastAttemptAt: number;
    retryCount: number;
};

type MeshDependencies = {
    meshNetworkService: {
        getIsRunning: () => boolean;
        start: () => Promise<void>;
        broadcastMessage: (payload: string, type: unknown, metadata?: Record<string, unknown>) => Promise<void>;
    };
    MeshMessageType: {
        SOS: unknown;
    };
    getInstallationId: () => Promise<string>;
    getDisplayName: () => string;
};

// ============================================================================
// AUTH POLLING HELPER
// ============================================================================

/**
 * Wait up to 2s for Firebase Auth to restore from MMKV persistence (cold start).
 * SOS is life-critical — MUST NOT silently fail due to auth race condition.
 * Returns the authenticated UID or null if auth never restores.
 */
async function waitForAuthUid(label: string): Promise<string | null> {
    const { getFirebaseAuth } = await import('../../../lib/firebase');
    let uid = getFirebaseAuth()?.currentUser?.uid ?? null;
    if (uid) return uid;

    // CRITICAL FIX: Wait up to 8s for auth restoration. Cold-start auth restoration
    // can take up to INITIAL_RESTORE_GRACE_MS (8s). Shorter waits caused family/nearby
    // SOS channels to silently fail because senderUid was null (Firestore rules reject).
    logger.warn(`⏳ ${label}: No auth yet — waiting up to 8s for auth restoration...`);
    const start = Date.now();
    while (!uid && Date.now() - start < 8000) {
        await new Promise(r => setTimeout(r, 250));
        uid = getFirebaseAuth()?.currentUser?.uid ?? null;
    }
    if (uid) {
        logger.info(`✅ ${label}: Auth restored after ${Date.now() - start}ms (uid: ${uid.substring(0, 8)}...)`);
    }
    return uid;
}

// ============================================================================
// CHANNEL ROUTER CLASS
// ============================================================================

class SOSChannelRouter {
    private isInitialized = false;
    private connectivityRetryUnsubscribe: NetInfoSubscription | null = null;
    private outboxNetInfoUnsubscribe: NetInfoSubscription | null = null;
    private connectivityRetryInFlight = false;
    private cloudOutboxInFlight = false;
    private pendingConnectivitySignalId: string | null = null;

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        this.isInitialized = true;
        this.ensureCloudOutboxNetInfoListener();
        this.processCloudOutbox('initialize').catch(err => {
            logger.warn('SOS cloud outbox initial sync failed:', err);
        });
        // P0-1: Drain queued cancellations on app start in case the user
        // cancelled SOS while offline and then killed the app.
        this.processCancelOutbox('initialize').catch(err => {
            logger.warn('SOS cancel outbox initial sync failed:', err);
        });
        logger.info('SOS Channel Router initialized');
    }

    /**
     * Tear down all subscriptions and timers. Called from shutdownApp to allow
     * a clean re-initialize() on next launch / account switch without leaking
     * NetInfo listeners or retry timers across sessions.
     */
    destroy(): void {
        if (!this.isInitialized) return;
        if (this.outboxNetInfoUnsubscribe) {
            try { this.outboxNetInfoUnsubscribe(); } catch { /* best-effort */ }
            this.outboxNetInfoUnsubscribe = null;
        }
        if (this.connectivityRetryUnsubscribe) {
            try { this.connectivityRetryUnsubscribe(); } catch { /* best-effort */ }
            this.connectivityRetryUnsubscribe = null;
        }
        if (this.channelRetryTimer) {
            clearTimeout(this.channelRetryTimer);
            this.channelRetryTimer = null;
        }
        this.channelRetryRound = 0;
        this.connectivityRetryInFlight = false;
        this.cloudOutboxInFlight = false;
        this.pendingConnectivitySignalId = null;
        this.isInitialized = false;
        logger.info('SOS Channel Router destroyed');
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
        logger.debug(`[SOS] Signal: id=${signal.id}, timestamp=${signal.timestamp}, location=${signal.location ? 'YES' : 'NO'}`);

        // KRİTİK (görev #17): Yeni SOS yayını başlıyor — kanal-retry tur sayacını
        // sıfırla. Önceki kod channelRetryRound'u yalnızca başarı/iptal/destroy'da
        // sıfırlıyordu; bir önceki SOS 3 retry turunu tükettiyse, aynı oturumda
        // tetiklenen İKİNCİ SOS hiç otomatik kanal-retry alamıyordu.
        this.channelRetryRound = 0;

        // LIFE-SAFETY: Check for airplane mode — warn user if ALL channels are blocked
        try {
            const netState = await NetInfo.fetch();
            if (!netState.isConnected && netState.type === 'none') {
                logger.error('🚨 AIRPLANE MODE DETECTED — SOS channels severely limited!');
                // Notify user via notification center
                try {
                    const { notificationCenter } = await import('../notifications/NotificationCenter');
                    await notificationCenter.notify('system', {
                        title: 'Uçak Modu Aktif!',
                        message: 'SOS sinyaliniz gönderilemeyebilir. Bluetooth\'u açarak mesh ağına bağlanabilirsiniz.',
                        subtype: 'network'
                    }, 'SOSChannelRouter');
                } catch { /* best-effort notification */ }
            }
        } catch { /* NetInfo check is best-effort */ }

        const store = useSOSStore.getState();

        const channelNames: SOSBroadcastChannel[] = ['mesh', 'firebase', 'backend', 'push', 'family', 'nearbyUsers'];

        // Parallel broadcast through all channels
        const results = await Promise.allSettled([
            this.broadcastViaMesh(signal, store.updateChannelStatus),
            this.broadcastViaFirebase(signal, store.updateChannelStatus),
            this.broadcastViaBackend(signal, store.updateChannelStatus),
            this.broadcastViaPush(signal, store.updateChannelStatus),
            this.broadcastToFamily(signal),
            this.broadcastToNearbyUsers(signal),
        ]);

        // Log results of each channel
        const succeededChannels: string[] = [];
        const failedChannels: string[] = [];
        results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                logger.debug(`[SOS] Channel ${channelNames[i]}: ✅ OK`);
                succeededChannels.push(channelNames[i]);
            } else {
                logger.warn(`[SOS] Channel ${channelNames[i]}: ❌ FAILED: ${result.reason}`);
                failedChannels.push(channelNames[i]);
            }
        });

        if (failedChannels.length === channelNames.length) {
            logger.error(`🆘 SOS broadcast FAILED on ALL channels: ${failedChannels.join(', ')}`);
            this.enqueueCloudOutbox(signal, failedChannels);
            // LIFE-SAFETY: Notify user that SOS was not delivered — they must take manual action
            try {
                const { notificationCenter } = await import('../notifications/NotificationCenter');
                await notificationCenter.notify('system', {
                    subtype: 'network',
                    title: '⚠️ SOS GÖNDERİLEMEDİ!',
                    message: 'Tüm kanallar başarısız oldu. İnternet bağlantısını veya Bluetooth\'u kontrol edin, ardından tekrar deneyin.',
                } as any, 'SOSChannelRouter-all-fail');
            } catch { /* best-effort — alert not critical vs SOS not delivered */ }

            // FIX 10: Emit DeviceEventEmitter event so UI can show an in-app alert
            // (NotificationCenter may be suppressed or unavailable — this provides a secondary path)
            try {
                const { DeviceEventEmitter } = require('react-native');
                DeviceEventEmitter.emit('SOS_ALL_CHANNELS_FAILED', {
                    failedChannels: failedChannels,
                    timestamp: Date.now(),
                });
            } catch { /* best-effort */ }

            this.scheduleChannelRetry(signal, failedChannels);
            this.armConnectivityRetry(signal, failedChannels);
        } else if (failedChannels.length > 0) {
            logger.warn(`⚠️ SOS broadcast partial: ✅ ${succeededChannels.join(', ')} | ❌ ${failedChannels.join(', ')}`);
            this.enqueueCloudOutbox(signal, failedChannels);

            // Sprint Audit FIX A7: Auto-retry transient channel failures after 30s.
            // SOS is life-safety; brief network blips should not leave channels permanently 'failed'.
            // Only retry if SOS is STILL active when the timeout fires (user did not cancel).
            this.scheduleChannelRetry(signal, failedChannels);
            this.armConnectivityRetry(signal, failedChannels);
        } else {
            this.removeCloudOutbox(signal.id);
            this.clearConnectivityRetryIfResolved(signal.id);
            logger.info('✅ SOS broadcast completed on all channels');
        }
    }

    /**
     * Sprint Audit FIX A7: Schedule retry for transient channel failures.
     * Retries Firebase + push + backend channels after 30s, max 3 retry rounds.
     * Mesh is fire-and-forget (no retry needed — packet sits in queue).
     */
    private channelRetryRound = 0;
    private static readonly MAX_CHANNEL_RETRY_ROUNDS = 3;
    private static readonly CHANNEL_RETRY_DELAY_MS = 30_000;
    private channelRetryTimer: ReturnType<typeof setTimeout> | null = null;

    private scheduleChannelRetry(signal: SOSSignal, failedChannels: string[]): void {
        const retryableChannels = failedChannels.filter((ch): ch is SOSBroadcastChannel =>
            ch === 'mesh' || ch === 'firebase' || ch === 'backend' || ch === 'family' || ch === 'nearbyUsers'
        );
        if (retryableChannels.length === 0) return;

        if (this.channelRetryRound >= SOSChannelRouter.MAX_CHANNEL_RETRY_ROUNDS) {
            logger.warn('SOS channel retry: max rounds reached');
            this.channelRetryRound = 0;
            return;
        }
        if (this.channelRetryTimer) {
            clearTimeout(this.channelRetryTimer);
            this.channelRetryTimer = null;
        }
        this.channelRetryRound++;
        const round = this.channelRetryRound;
        logger.info(`SOS channel retry scheduled (round ${round}/${SOSChannelRouter.MAX_CHANNEL_RETRY_ROUNDS}): ${retryableChannels.join(', ')}`);
        this.channelRetryTimer = setTimeout(async () => {
            // Timer has fired — clear handle so cancelChannelRetry() / scheduleChannelRetry()
            // see a consistent state (no dangling reference to a non-pending timer).
            this.channelRetryTimer = null;
            // Verify SOS is still active before retrying
            const store = useSOSStore.getState();
            if (!store.isActive || !store.currentSignal) {
                logger.info('SOS no longer active — skipping channel retry');
                this.channelRetryRound = 0;
                return;
            }
            logger.warn(`🔄 SOS channel retry round ${round}: ${retryableChannels.join(', ')}`);
            const retryTasks: Array<{ channel: SOSBroadcastChannel; promise: Promise<unknown> }> = [];
            for (const ch of retryableChannels) {
                switch (ch) {
                    case 'mesh':
                        retryTasks.push({ channel: ch, promise: this.broadcastViaMesh(signal, store.updateChannelStatus) });
                        break;
                    case 'firebase':
                        retryTasks.push({ channel: ch, promise: this.broadcastViaFirebase(signal, store.updateChannelStatus) });
                        break;
                    case 'backend':
                        retryTasks.push({ channel: ch, promise: this.broadcastViaBackend(signal, store.updateChannelStatus) });
                        break;
                    case 'family':
                        retryTasks.push({ channel: ch, promise: this.broadcastToFamily(signal) });
                        break;
                    case 'nearbyUsers':
                        retryTasks.push({ channel: ch, promise: this.broadcastToNearbyUsers(signal) });
                        break;
                    case 'push':
                        break;
                }
            }
            const retryResults = await Promise.allSettled(retryTasks.map(task => task.promise));
            // Check if still failures and schedule next round
            const updatedSignal = useSOSStore.getState().currentSignal;
            if (updatedSignal) {
                const rejectedChannels = retryResults
                    .map((result, index) => ({ result, channel: retryTasks[index]?.channel }))
                    .filter((entry): entry is { result: PromiseRejectedResult; channel: SOSBroadcastChannel } =>
                        entry.result.status === 'rejected' && !!entry.channel
                    )
                    .map(entry => entry.channel);
                const failedStateChannels = Object.entries(updatedSignal.channels)
                    .filter(([, status]) => status === 'failed')
                    .map(([ch]) => ch);
                const stillFailed = Array.from(new Set([...rejectedChannels, ...failedStateChannels]));
                if (stillFailed.length > 0) {
                    this.scheduleChannelRetry(updatedSignal, stillFailed);
                } else {
                    this.channelRetryRound = 0;
                    this.clearConnectivityRetryIfResolved(updatedSignal.id);
                }
            }
        }, SOSChannelRouter.CHANNEL_RETRY_DELAY_MS);
    }

    /** Cancel any pending channel retry — called when SOS deactivated. */
    cancelChannelRetry(): void {
        if (this.channelRetryTimer) {
            clearTimeout(this.channelRetryTimer);
            this.channelRetryTimer = null;
        }
        this.channelRetryRound = 0;
        const signalId = useSOSStore.getState().currentSignal?.id;
        this.removeCloudOutbox(signalId);
        this.clearConnectivityRetryIfResolved();
    }

    private isCloudRetryChannel(channel: string): channel is CloudRetryChannel {
        return channel === 'firebase' || channel === 'backend' || channel === 'family' || channel === 'nearbyUsers';
    }

    private isOnlineNetState(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
        return !!state.isConnected && state.isInternetReachable !== false;
    }

    private readCloudOutbox(): SOSCloudOutboxItem[] {
        try {
            const raw = DirectStorage.getString(SOS_CLOUD_OUTBOX_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            const now = Date.now();
            return parsed
                .filter((item): item is SOSCloudOutboxItem => {
                    if (!item || typeof item !== 'object') return false;
                    if (!item.signal || typeof item.signal.id !== 'string') return false;
                    if (!Array.isArray(item.pendingChannels) || item.pendingChannels.length === 0) return false;
                    if (typeof item.createdAt !== 'number') return false;
                    return now - item.createdAt <= SOS_CLOUD_OUTBOX_TTL_MS;
                })
                .slice(0, SOS_CLOUD_OUTBOX_MAX_ITEMS);
        } catch (error) {
            logger.warn('SOS cloud outbox unreadable, clearing corrupted payload:', error);
            try { DirectStorage.delete(SOS_CLOUD_OUTBOX_KEY); } catch { /* best-effort */ }
            return [];
        }
    }

    private writeCloudOutbox(items: SOSCloudOutboxItem[]): void {
        const now = Date.now();
        const validItems = items
            .filter(item => now - item.createdAt <= SOS_CLOUD_OUTBOX_TTL_MS)
            .slice(-SOS_CLOUD_OUTBOX_MAX_ITEMS);

        try {
            if (validItems.length === 0) {
                DirectStorage.delete(SOS_CLOUD_OUTBOX_KEY);
            } else {
                DirectStorage.setString(SOS_CLOUD_OUTBOX_KEY, JSON.stringify(validItems));
            }
        } catch (error) {
            logger.warn('SOS cloud outbox write failed:', error);
        }
    }

    private enqueueCloudOutbox(signal: SOSSignal, failedChannels: string[]): void {
        const pendingChannels = failedChannels.filter((ch): ch is CloudRetryChannel => this.isCloudRetryChannel(ch));
        if (pendingChannels.length === 0) return;

        const existing = this.readCloudOutbox();
        const existingIndex = existing.findIndex(item => item.signal.id === signal.id);
        const now = Date.now();
        const nextItem: SOSCloudOutboxItem = existingIndex >= 0
            ? {
                ...existing[existingIndex],
                signal,
                pendingChannels: Array.from(new Set([...existing[existingIndex].pendingChannels, ...pendingChannels])),
            }
            : {
                signal,
                pendingChannels: Array.from(new Set(pendingChannels)),
                createdAt: now,
                lastAttemptAt: 0,
                retryCount: 0,
            };

        if (existingIndex >= 0) {
            existing[existingIndex] = nextItem;
        } else {
            existing.push(nextItem);
        }

        this.writeCloudOutbox(existing);
        logger.warn(`SOS cloud outbox persisted for ${signal.id}: ${nextItem.pendingChannels.join(', ')}`);
    }

    private removeCloudOutbox(signalId?: string): void {
        if (!signalId) return;
        const remaining = this.readCloudOutbox().filter(item => item.signal.id !== signalId);
        this.writeCloudOutbox(remaining);
    }

    private ensureCloudOutboxNetInfoListener(): void {
        if (this.outboxNetInfoUnsubscribe) return;

        const addEventListener = (NetInfo as unknown as {
            addEventListener?: (listener: (state: NetInfoState) => void) => NetInfoSubscription;
        }).addEventListener;
        if (typeof addEventListener !== 'function') return;

        this.outboxNetInfoUnsubscribe = addEventListener((state: NetInfoState) => {
            if (this.isOnlineNetState(state)) {
                this.processCloudOutbox('connectivity-restored').catch(err => {
                    logger.warn('SOS cloud outbox connectivity sync failed:', err);
                });
                // P0-1: Drain queued cancellations alongside the signal outbox.
                this.processCancelOutbox('connectivity-restored').catch(err => {
                    logger.warn('SOS cancel outbox connectivity sync failed:', err);
                });
            }
        });
    }

    // ============================================================================
    // P0-1: SOS CANCEL OUTBOX (offline persist for cancellations)
    // ============================================================================

    private async getCancelOutboxKey(): Promise<string> {
        // Scope per-user so a logout/account-switch never replays the wrong
        // user's cancellations. Falls back to a global key for offline-only
        // users (no auth) — still keeps cancellations on the same device.
        try {
            const { getFirebaseAuth } = await import('../../../lib/firebase');
            const uid = getFirebaseAuth()?.currentUser?.uid;
            if (uid) return `${SOS_CANCEL_OUTBOX_KEY_PREFIX}:${uid}`;
        } catch { /* fall through to global */ }
        return SOS_CANCEL_OUTBOX_KEY_PREFIX;
    }

    private async readCancelOutbox(): Promise<SOSCancelOutboxItem[]> {
        try {
            const key = await this.getCancelOutboxKey();
            const raw = DirectStorage.getString(key);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            const now = Date.now();
            return parsed
                .filter((item): item is SOSCancelOutboxItem => {
                    if (!item || typeof item !== 'object') return false;
                    if (typeof item.signalId !== 'string' || item.signalId.length === 0) return false;
                    if (typeof item.queuedAt !== 'number') return false;
                    return now - item.queuedAt <= SOS_CANCEL_OUTBOX_TTL_MS;
                })
                .slice(0, SOS_CANCEL_OUTBOX_MAX_ITEMS);
        } catch (error) {
            logger.warn('SOS cancel outbox unreadable, clearing:', error);
            try {
                const key = await this.getCancelOutboxKey();
                DirectStorage.delete(key);
            } catch { /* best-effort */ }
            return [];
        }
    }

    private async writeCancelOutbox(items: SOSCancelOutboxItem[]): Promise<void> {
        try {
            const key = await this.getCancelOutboxKey();
            const now = Date.now();
            const valid = items
                .filter(i => now - i.queuedAt <= SOS_CANCEL_OUTBOX_TTL_MS)
                .slice(-SOS_CANCEL_OUTBOX_MAX_ITEMS);
            if (valid.length === 0) {
                DirectStorage.delete(key);
            } else {
                DirectStorage.setString(key, JSON.stringify(valid));
            }
        } catch (error) {
            logger.warn('SOS cancel outbox write failed:', error);
        }
    }

    /**
     * P0-1: Public API. Enqueue an SOS cancellation for later cloud sync.
     * Safe to call from anywhere — duplicates by signalId are merged.
     */
    async queueCancelToOutbox(signalId: string): Promise<void> {
        const id = (signalId || '').trim();
        if (!id) return;
        const existing = await this.readCancelOutbox();
        if (existing.some(it => it.signalId === id)) {
            // Already queued — refresh queuedAt so TTL doesn't expire mid-retry.
            const refreshed = existing.map(it => it.signalId === id ? { ...it, queuedAt: Date.now() } : it);
            await this.writeCancelOutbox(refreshed);
            return;
        }
        existing.push({ signalId: id, queuedAt: Date.now(), lastAttemptAt: 0, retryCount: 0 });
        await this.writeCancelOutbox(existing);
        logger.warn(`SOS cancel queued to outbox: ${id}`);

        // Best-effort: if we happen to be online right now, drain immediately.
        try {
            const state = await NetInfo.fetch();
            if (this.isOnlineNetState(state)) {
                void this.processCancelOutbox('queued-while-online');
            }
        } catch { /* non-critical */ }
    }

    /**
     * P0-1: Drain queued cancellations to Firestore. Idempotent: applying
     * `status: 'cancelled'` to an already-cancelled doc is a harmless no-op.
     */
    private async processCancelOutbox(reason: string): Promise<void> {
        if (!this.isInitialized) return;
        const items = await this.readCancelOutbox();
        if (items.length === 0) return;

        let db: Awaited<ReturnType<typeof import('../firebase/FirebaseInstanceManager').getFirestoreInstanceAsync>> | null = null;
        try {
            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
            db = await getFirestoreInstanceAsync();
        } catch (e) {
            logger.warn(`SOS cancel outbox (${reason}): firestore unavailable, will retry later`, e);
            return;
        }
        if (!db) return;

        const { doc, updateDoc } = await import('firebase/firestore');
        const remaining: SOSCancelOutboxItem[] = [];

        // Pre-fetch family member ids once per drain pass.
        let memberIds: string[] = [];
        try {
            const { useFamilyStore } = await import('../../stores/familyStore');
            memberIds = useFamilyStore.getState().members
                .filter(isApprovedFamilyMember)
                .flatMap(m => [m.uid, m.deviceId])
                .filter((v): v is string => !!v && v.length > 0);
        } catch { /* best-effort */ }

        for (const item of items) {
            const cancelData = { status: 'cancelled', cancelledAt: Date.now() };
            try {
                await Promise.allSettled([
                    updateDoc(doc(db, 'sos_broadcasts', item.signalId), cancelData),
                    updateDoc(doc(db, 'sos_signals', item.signalId), cancelData),
                    ...memberIds.flatMap(id => [
                        updateDoc(doc(db, 'sos_alerts', id, 'items', item.signalId), cancelData),
                        updateDoc(doc(db, 'devices', id, 'sos_alerts', item.signalId), cancelData),
                    ]),
                ]);
                logger.info(`✅ SOS cancel outbox: drained ${item.signalId}`);
                // Success: do NOT re-enqueue.
            } catch (e) {
                const next: SOSCancelOutboxItem = {
                    ...item,
                    lastAttemptAt: Date.now(),
                    retryCount: item.retryCount + 1,
                };
                // Cap retries — at some point the doc just doesn't exist.
                if (next.retryCount <= 8) {
                    remaining.push(next);
                } else {
                    logger.warn(`SOS cancel outbox: giving up on ${item.signalId} after ${next.retryCount} retries`);
                }
                if (__DEV__) logger.debug('SOS cancel drain attempt failed', e);
            }
        }

        await this.writeCancelOutbox(remaining);
    }

    private async retryCloudChannelsForSignal(
        signal: SOSSignal,
        channels: CloudRetryChannel[],
        reason: string,
    ): Promise<CloudRetryChannel[]> {
        const updateIfCurrent = (channel: 'firebase' | 'backend', status: ChannelStatus) => {
            const latest = useSOSStore.getState();
            if (latest.currentSignal?.id === signal.id) {
                latest.updateChannelStatus(channel, status);
            }
        };

        const tasks: Array<{ channel: CloudRetryChannel; promise: Promise<unknown> }> = [];
        for (const channel of channels) {
            switch (channel) {
                case 'firebase':
                    tasks.push({ channel, promise: this.broadcastViaFirebase(signal, updateIfCurrent) });
                    break;
                case 'backend':
                    tasks.push({ channel, promise: this.broadcastViaBackend(signal, updateIfCurrent) });
                    break;
                case 'family':
                    tasks.push({ channel, promise: this.broadcastToFamily(signal) });
                    break;
                case 'nearbyUsers':
                    tasks.push({ channel, promise: this.broadcastToNearbyUsers(signal) });
                    break;
            }
        }

        if (tasks.length === 0) return [];

        logger.warn(`SOS cloud retry (${reason}) started for ${signal.id}: ${tasks.map(t => t.channel).join(', ')}`);
        const results = await Promise.allSettled(tasks.map(task => task.promise));
        const rejected = results
            .map((result, index) => ({ result, channel: tasks[index]?.channel }))
            .filter((entry): entry is { result: PromiseRejectedResult; channel: CloudRetryChannel } =>
                entry.result.status === 'rejected' && !!entry.channel
            )
            .map(entry => entry.channel);

        const latestStore = useSOSStore.getState();
        const latest = latestStore.currentSignal?.id === signal.id ? latestStore.currentSignal : null;
        const failedStateChannels = latest
            ? Object.entries(latest.channels)
                .filter(([channel, status]) =>
                    (channel === 'firebase' || channel === 'backend') && status === 'failed'
                )
                .map(([channel]) => channel as CloudRetryChannel)
            : [];

        return Array.from(new Set([...rejected, ...failedStateChannels]));
    }

    private async processCloudOutbox(reason: string): Promise<void> {
        if (this.cloudOutboxInFlight) return;

        const netState = await NetInfo.fetch();
        if (!this.isOnlineNetState(netState)) return;

        const items = this.readCloudOutbox();
        if (items.length === 0) return;

        this.cloudOutboxInFlight = true;
        const remaining: SOSCloudOutboxItem[] = [];
        try {
            for (const item of items) {
                const ageMs = Date.now() - item.createdAt;
                if (ageMs > SOS_CLOUD_OUTBOX_TTL_MS || item.signal.status === 'cancelled') {
                    logger.warn(`Dropping stale/cancelled SOS cloud outbox item: ${item.signal.id}`);
                    continue;
                }

                const stillFailed = await this.retryCloudChannelsForSignal(item.signal, item.pendingChannels, reason);
                if (stillFailed.length > 0) {
                    remaining.push({
                        ...item,
                        pendingChannels: stillFailed,
                        lastAttemptAt: Date.now(),
                        retryCount: item.retryCount + 1,
                    });
                } else {
                    logger.info(`✅ SOS cloud outbox delivered for ${item.signal.id}`);
                }
            }
        } finally {
            this.cloudOutboxInFlight = false;
            this.writeCloudOutbox(remaining);
        }
    }

    private armConnectivityRetry(signal: SOSSignal, failedChannels: string[]): void {
        const cloudFailures = failedChannels.filter((ch): ch is CloudRetryChannel => this.isCloudRetryChannel(ch));
        if (cloudFailures.length === 0) return;

        this.enqueueCloudOutbox(signal, cloudFailures);
        this.pendingConnectivitySignalId = signal.id;
        if (this.connectivityRetryUnsubscribe) {
            logger.debug(`SOS cloud retry already armed for ${this.pendingConnectivitySignalId}`);
            return;
        }

        const addEventListener = (NetInfo as unknown as {
            addEventListener?: (listener: (state: NetInfoState) => void) => NetInfoSubscription;
        }).addEventListener;
        if (typeof addEventListener !== 'function') {
            logger.warn('SOS cloud retry could not subscribe to NetInfo; timed retries remain active');
            return;
        }

        logger.warn(`SOS cloud retry armed until connectivity returns: ${cloudFailures.join(', ')}`);
        this.connectivityRetryUnsubscribe = addEventListener((state: NetInfoState) => {
            if (this.isOnlineNetState(state)) {
                this.retryPendingCloudChannels('connectivity-restored').catch(err => {
                    logger.warn('SOS cloud retry on connectivity restore failed:', err);
                });
            }
        });

        NetInfo.fetch()
            .then(state => {
                if (this.isOnlineNetState(state)) {
                    this.retryPendingCloudChannels('connectivity-currently-online').catch(err => {
                        logger.warn('SOS immediate cloud retry failed:', err);
                    });
                }
            })
            .catch(() => { /* best-effort */ });
    }

    private async retryPendingCloudChannels(reason: string): Promise<void> {
        if (this.connectivityRetryInFlight) return;

        const store = useSOSStore.getState();
        const signal = store.currentSignal;
        if (!store.isActive || !signal || (this.pendingConnectivitySignalId && signal.id !== this.pendingConnectivitySignalId)) {
            this.clearConnectivityRetryIfResolved();
            return;
        }

        const netState = await NetInfo.fetch();
        if (!this.isOnlineNetState(netState)) return;

        this.connectivityRetryInFlight = true;
        try {
            logger.warn(`🔄 SOS cloud retry started (${reason}) for ${signal.id}`);
            const tasks: Array<{ channel: CloudRetryChannel; promise: Promise<unknown> }> = [
                { channel: 'firebase', promise: this.broadcastViaFirebase(signal, store.updateChannelStatus) },
                { channel: 'backend', promise: this.broadcastViaBackend(signal, store.updateChannelStatus) },
                { channel: 'family', promise: this.broadcastToFamily(signal) },
                { channel: 'nearbyUsers', promise: this.broadcastToNearbyUsers(signal) },
            ];
            const results = await Promise.allSettled(tasks.map(task => task.promise));
            const rejectedChannels = results
                .map((result, index) => ({ result, channel: tasks[index]?.channel }))
                .filter((entry): entry is { result: PromiseRejectedResult; channel: CloudRetryChannel } =>
                    entry.result.status === 'rejected' && !!entry.channel
                )
                .map(entry => entry.channel);
            const latest = useSOSStore.getState().currentSignal;
            const failedStateChannels = latest
                ? Object.entries(latest.channels)
                    .filter(([channel, status]) =>
                        (channel === 'firebase' || channel === 'backend') && status === 'failed'
                    )
                    .map(([channel]) => channel)
                : [];
            const stillFailed = Array.from(new Set([...rejectedChannels, ...failedStateChannels]));
            if (stillFailed.length === 0) {
                logger.info(`✅ SOS cloud retry resolved for ${signal.id}`);
                this.removeCloudOutbox(signal.id);
                this.channelRetryRound = 0;
                this.clearConnectivityRetryIfResolved(signal.id);
            } else {
                this.enqueueCloudOutbox(signal, stillFailed);
                logger.warn(`SOS cloud retry still failing: ${stillFailed.join(', ')}`);
            }
        } finally {
            this.connectivityRetryInFlight = false;
        }
    }

    private clearConnectivityRetryIfResolved(signalId?: string): void {
        if (signalId && this.pendingConnectivitySignalId && this.pendingConnectivitySignalId !== signalId) return;
        if (this.connectivityRetryUnsubscribe) {
            try {
                this.connectivityRetryUnsubscribe();
            } catch { /* no-op */ }
            this.connectivityRetryUnsubscribe = null;
        }
        this.pendingConnectivitySignalId = null;
    }

    // ============================================================================
    // MESH CHANNEL (OFFLINE GUARANTEED)
    // ============================================================================

    private async loadMeshDependencies(): Promise<MeshDependencies> {
        const { meshNetworkService } = await import('../mesh');
        const { MeshMessageType } = await import('../mesh/MeshProtocol');
        const { getInstallationId } = await import('../../../lib/installationId');

        let getDisplayName = () => 'Acil Yardım';
        try {
            const { identityService } = await import('../IdentityService');
            getDisplayName = () => identityService.getDisplayName?.() || 'Acil Yardım';
        } catch {
            // best effort
        }

        return {
            meshNetworkService,
            MeshMessageType,
            getInstallationId,
            getDisplayName,
        };
    }

    private async getVisibleMeshPeerCount(): Promise<number | null> {
        try {
            const { useMeshStore } = await import('../mesh/MeshStore');
            const peers = useMeshStore.getState().peers;
            return Array.isArray(peers) ? peers.length : null;
        } catch {
            return null;
        }
    }

    private async broadcastViaMesh(
        signal: SOSSignal,
        updateStatus: (channel: 'mesh', status: ChannelStatus) => void
    ): Promise<void> {
        updateStatus('mesh', 'sending');

        try {
            const { meshNetworkService, MeshMessageType, getInstallationId, getDisplayName } = await this.loadMeshDependencies();

            // CRITICAL: Mesh sender identity must be installation-scoped, not account UID.
            // If two nearby devices are logged in with the same account, UID-based sender IDs
            // make receivers classify incoming SOS as self-originated and drop the alert.
            const installationId = await getInstallationId().catch((err) => {
                logger.warn('getInstallationId failed for mesh SOS identity:', err);
                return '';
            });
            const meshSenderId = (installationId && installationId.length > 0)
                ? installationId
                : `device-${signal.userId}`;

            const senderName = getDisplayName();

            // Ensure mesh is running — with timeout to prevent hanging SOS activation
            if (!meshNetworkService.getIsRunning()) {
                await Promise.race([
                    meshNetworkService.start(),
                    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Mesh start timeout')), 5000)),
                ]).catch(e => logger.warn('Mesh start failed/timeout, continuing with broadcast:', e));
            }

            // K3: If start() found BLE unavailable (permission/off/unsupported),
            // mesh is still not running. Fail this channel fast so the user
            // gets actionable UX (via OfflineIndicator banner) instead of a
            // hanging "sending..." spinner.
            if (!meshNetworkService.getIsRunning()) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const { useMeshStore } = require('../mesh/MeshStore');
                    const reason = useMeshStore.getState().meshUnavailableReason;
                    logger.warn(`Mesh SOS aborted — mesh not running (reason: ${reason ?? 'unknown'})`);
                } catch {
                    // best-effort logging
                }
                updateStatus('mesh', 'failed');
                throw new Error('Mesh unavailable (BLE off or permission denied)');
            }

            // Create SOS payload
            // CRITICAL FIX: Include signal.status so receivers can distinguish active vs cancelled SOS.
            // Without this, a cancelled SOS broadcast via mesh is indistinguishable from a new SOS.
            const payload = JSON.stringify({
                type: 'SOS',
                id: signal.id,
                from: meshSenderId,
                userId: signal.userId,
                senderUid: signal.userId,
                senderName,
                timestamp: signal.timestamp,
                location: signal.location,
                message: signal.message,
                trapped: signal.trapped,
                reason: signal.reason,
                battery: signal.device.batteryLevel,
                status: signal.status,
            });

            // Check BLE + peer status — log actionable info for debugging
            try {
                const { default: highPerformanceBle } = await import('../../ble/HighPerformanceBle');
                const bleReady = await highPerformanceBle.isBluetoothPoweredOn();
                if (!bleReady) {
                    logger.error('🚨 SOS mesh broadcast: Bluetooth is OFF — mesh packets will be deferred until Bluetooth is enabled');
                }
                const peerCount = await this.getVisibleMeshPeerCount();
                if (peerCount === 0) {
                    logger.warn('⚠️ SOS mesh broadcast: 0 peers discovered — signal queued, will auto-send when peers appear (BLE scan active)');
                } else if (peerCount !== null) {
                    logger.info(`✅ SOS mesh broadcast: ${peerCount} peer(s) visible — signal will be delivered`);
                }
            } catch { /* best-effort status check */ }

            // Broadcast via mesh with max TTL — timeout prevents hanging SOS activation
            await Promise.race([
                meshNetworkService.broadcastMessage(payload, MeshMessageType.SOS, {
                    from: meshSenderId,
                    messageId: signal.id,
                }),
                new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Mesh broadcast timeout')), 8000)),
            ]);

            // CRITICAL FIX: Check actual peer count AFTER broadcast.
            // broadcastMessage() queues the packet and returns success even with 0 peers.
            // If 0 peers → message sits in queue and may NEVER be delivered.
            // User should NOT see "SOS sent via mesh" when nobody can receive it.
            let postPeerCount: number | null = null;
            postPeerCount = await this.getVisibleMeshPeerCount();
            if (postPeerCount === null) {
                // Fallback: mark as sent if we cannot inspect peer count.
                updateStatus('mesh', 'sent');
                logger.info('✅ SOS sent via Mesh');
                return;
            }

            if (postPeerCount === 0) {
                // F3: 'queued' (not 'failed') — packet is in mesh queue, will auto-flush
                // when a peer comes into range. Distinct from "failed" so the UI shows
                // "yardım çağrısı bekleniyor" instead of "gönderilemedi".
                updateStatus('mesh', 'queued');
                logger.warn('⚠️ Mesh SOS queued, 0 peers visible — auto-delivery when peer enters range');
                // Still throw to trigger retry scheduler — but UI now shows correct state.
                throw new Error('Mesh SOS queued — waiting for peer');
            }

            // FIX 11: Status is 'sent' because peers were visible, but this means
            // "queued to peers" — NOT confirmed delivery. BLE broadcast is fire-and-forget;
            // actual receipt depends on peers' BLE scan being active.
            updateStatus('mesh', 'sent');
            logger.info(`✅ SOS queued to ${postPeerCount} visible mesh peer(s) — delivery not confirmed (BLE fire-and-forget)`);
        } catch (error) {
            logger.error('❌ Mesh broadcast failed:', error);
            // F3: 0-peer state already set 'queued' via the explicit guard above.
            // Don't overwrite it with 'failed' — the message IS queued, just no
            // visible peer to deliver to yet. Other errors still mark 'failed'.
            const msg = error instanceof Error ? error.message : String(error ?? '');
            if (!/queued|waiting for peer/i.test(msg)) {
                updateStatus('mesh', 'failed');
            }
            throw error;
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
            // Firestore on React Native has memory-only cache in this setup, not a
            // reliable disk-backed emergency outbox. Do not claim "sent" while offline;
            // mark failed and let the SOS cloud retry listener send it when internet returns.
            updateStatus('firebase', 'sending');

            const netInfoPre = await NetInfo.fetch();
            if (!this.isOnlineNetState(netInfoPre)) {
                updateStatus('firebase', 'failed');
                logger.warn('⚠️ Firebase SOS deferred — offline (mesh remains active, cloud retry armed)');
                throw new Error('Firebase SOS deferred while offline');
            }

            // CRITICAL FIX: Write SOS to a GLOBAL sos_signals collection,
            // NOT to the sender's own message inbox.
            // broadcastToFamily handles per-member delivery.
            // broadcastToNearbyUsers handles proximity-based delivery.
            // This channel saves the SOS signal as a global record.
            // CRITICAL: Validate auth FIRST — Firestore rules require creatorUid == request.auth.uid.
            // If auth is null, the write WILL be rejected. Don't mark as "sent" in that case.
            // LIFE-SAFETY: Auth may still be restoring from MMKV on cold start. Wait briefly
            // before giving up — SOS is life-critical and MUST NOT silently fail.
            const currentUid = await waitForAuthUid('Firebase SOS');
            if (!currentUid) {
                logger.error('❌ Firebase SOS broadcast FAILED: No authenticated user after 8s wait — Firestore rules will reject. Mesh channel is the fallback.');
                updateStatus('firebase', 'failed');
                throw new Error('Firebase SOS failed: no authenticated user');
            }

            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
            const db = await getFirestoreInstanceAsync();
            if (!db) {
                updateStatus('firebase', 'failed');
                throw new Error('Firebase SOS failed: Firestore unavailable');
            }

            const { doc, setDoc } = await import('firebase/firestore');

            // CRITICAL FIX: Include healthInfo in sos_signals so rescue teams
            // querying this global collection see blood type, allergies, medications.
            // Previously only broadcastToFamily and broadcastToNearbyUsers included it.
            const healthInfo = await this.loadHealthProfile();

            const sosRef = doc(db, 'sos_signals', signal.id);
            await setDoc(sosRef, {
                id: signal.id,
                userId: signal.userId,
                creatorUid: currentUid,
                message: signal.message,
                location: signal.location,
                trapped: signal.trapped,
                reason: signal.reason,
                battery: signal.device.batteryLevel,
                // KRİTİK (görev #1): `timestamp` YAYIN zamanıdır, olay zamanı değil.
                // Firestore kuralı isRecentClientTimestamp bunu ±5dk pencerede ister.
                // SOS offline tetiklenip bağlantı 5dk+ sonra dönerse retry bir CREATE
                // olur; signal.timestamp (orijinal olay zamanı) bayat → kural reddeder
                // ve offline-kurtulan için yazılan tüm retry sistemi sessizce çöker.
                // Date.now() her (yeniden) yazımda taze damga verir; orijinal olay
                // zamanı signalCreatedAt alanında korunur.
                timestamp: Date.now(),
                signalCreatedAt: signal.timestamp,
                status: signal.status === 'cancelled' ? 'cancelled' : 'active',
                healthInfo,
            });

            updateStatus('firebase', 'sent');
            logger.info('✅ SOS saved to global sos_signals collection');
        } catch (error) {
            logger.error('❌ Firebase broadcast failed:', error);
            updateStatus('firebase', 'failed');
            throw error;
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
            if (!this.isOnlineNetState(netInfo)) {
                logger.debug('Backend deferred: offline');
                updateStatus('backend', 'failed');
                throw new Error('Backend SOS deferred while offline');
            }

            const { backendEmergencyService } = await import('../BackendEmergencyService');

            if (!backendEmergencyService.initialized) {
                await backendEmergencyService.initialize();
            }

            // SOS-BUG 1 FIX: If backend still not initialized after init attempt
            // (e.g. no API_BASE_URL configured), gracefully skip instead of failing
            if (!backendEmergencyService.initialized) {
                logger.debug('Backend channel skipped: API not configured (Firebase channels active)');
                updateStatus('backend', 'idle');
                return;
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
            throw error;
        }
    }

    // ============================================================================
    // PUSH NOTIFICATION CHANNEL (FAMILY ALERTS)
    // ============================================================================

    private async broadcastViaPush(
        _signal: SOSSignal,
        updateStatus: (channel: 'push', status: ChannelStatus) => void
    ): Promise<void> {
        // CRITICAL FIX: Do NOT send a push notification to the SENDER's own phone.
        // The sender already sees the SOSModal UI confirming their SOS is active.
        // Remote family/nearby alerts are delivered via broadcastToFamily and broadcastToNearbyUsers.
        // Sending a push to self was confusing — the user thought their own phone was receiving
        // someone else's SOS when in reality it was their own confirmation.
        // KRİTİK (görev #17): 'sent' DEĞİL 'idle'. Bu kanal kasıtlı hiçbir şey
        // yapmıyor (gönderene self-push atılmaz). 'sent' işaretlenince SOSModal
        // dürüstlük banner'ı bunu "ulaşıldı" sayıyor ve diğer TÜM kanallar
        // başarısız olsa bile kritik "hiçbir kanaldan ulaşılamıyor — 112'yi
        // arayın" uyarısını susturuyordu. 'idle' bu kanalı "reached" hesabının
        // dışında tutar (broadcastViaBackend'in yapılandırılmamış dalı ile aynı).
        updateStatus('push', 'idle');
        logger.info('Push channel idle: self-notification skipped (sender sees SOSModal UI)');
    }

    // ============================================================================
    // FAMILY MEMBER CHANNEL (CRITICAL: Notify family on their devices)
    // ============================================================================

    /**
     * Write SOS alert to each family member's Firebase path
     * Family members' apps listen to these paths via real-time subscriptions
     */
    private async broadcastToFamily(signal: SOSSignal): Promise<void> {
        try {
            // Get family members from store
            const { useFamilyStore } = await import('../../stores/familyStore');
            let members = useFamilyStore.getState().members.filter(isApprovedFamilyMember);

            // If members empty (cold-start recovery), wait briefly for hydration
            if (members.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                members = useFamilyStore.getState().members.filter(isApprovedFamilyMember);
            }

            if (members.length === 0) {
                logger.warn('Family broadcast skipped: no family members after hydration wait');
                return;
            }

            // Resolve human-readable sender name
            let senderName = 'Bilinmeyen';
            try {
                const { identityService } = await import('../IdentityService');
                const identity = identityService.getIdentity();
                senderName = identity?.displayName || 'Aile Üyesi';
            } catch {
                senderName = 'Aile Üyesi';
            }

            const { getDeviceId } = await import('../../../lib/device');
            const senderDeviceId = await getDeviceId();

            // ELITE: Load health profile for life-saving info
            const healthInfo = await this.loadHealthProfile();
            let familyCloudError: Error | null = null;

            // CRITICAL FIX: Use the ACTUAL Firebase Auth UID for senderUid, not signal.userId.
            // signal.userId may have fallen back to a device ID (AFN-XXXX) during cold start.
            // Firestore rules require senderUid == request.auth.uid for CREATE.
            // Without this, ALL family SOS writes are SILENTLY REJECTED.
            // LIFE-SAFETY: Wait briefly for auth to restore if not ready yet.
            let resolvedSenderUid = signal.userId;
            try {
                const authUid = await waitForAuthUid('Family SOS');
                if (!authUid) {
                    familyCloudError = new Error('Family SOS failed: no authenticated user');
                    logger.error('❌ Family SOS: Auth still unavailable after 8s — Firestore writes will be rejected');
                }
                if (authUid) resolvedSenderUid = authUid;
            } catch (e) { logger.error('SOS auth UID resolution failed:', e); }

            const sosAlert = {
                signalId: signal.id,
                senderDeviceId: senderDeviceId || signal.userId,
                senderUid: resolvedSenderUid,
                senderName,
                message: signal.message,
                reason: signal.reason,
                location: signal.location ? {
                    latitude: signal.location.latitude,
                    longitude: signal.location.longitude,
                    accuracy: signal.location.accuracy,
                } : null,
                trapped: signal.trapped,
                battery: signal.device.batteryLevel,
                // KRİTİK (görev #1): `timestamp` = YAYIN zamanı. devices/{id}/sos_alerts
                // ve sos_alerts/{uid}/items create kuralları isRecentClientTimestamp ile
                // ±5dk ister; SOS offline tetiklenip geç dönen retry CREATE olur, bayat
                // signal.timestamp reddedilir. Orijinal olay zamanı signalCreatedAt'te.
                timestamp: Date.now(),
                signalCreatedAt: signal.timestamp,
                status: signal.status === 'cancelled' ? 'cancelled' : 'active',
                healthInfo,
            };

            if (!familyCloudError) {
                try {
                    logger.info(`📨 Broadcasting SOS to ${members.length} family members via Firestore...`);

                    const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
                    let db = await getFirestoreInstanceAsync();
                    if (!db) {
                        // RETRY: Firestore may be initializing during cold start — wait 2s and retry once
                        logger.warn('Family Firestore broadcast: Firestore unavailable, retrying in 2s...');
                        await new Promise(r => setTimeout(r, 2000));
                        db = await getFirestoreInstanceAsync();
                    }
                    if (!db) {
                        familyCloudError = new Error('Family SOS failed: Firestore unavailable');
                        logger.error('❌ Family Firestore broadcast FAILED: Firestore unavailable after retry');
                    } else {
                        const { doc, setDoc } = await import('firebase/firestore');

                        // Resolve ALL sender identity forms for robust self-exclusion
                        const senderSelfIds = new Set<string>();
                        try {
                            // CRITICAL FIX: Use getFirebaseAuth() singleton instead of raw getAuth()
                            // Raw getAuth() creates new instance without MMKV persistence → null currentUser
                            const { getFirebaseAuth } = await import('../../../lib/firebase');
                            const authUid = getFirebaseAuth()?.currentUser?.uid;
                            if (authUid) senderSelfIds.add(authUid);
                        } catch (e) { logger.error('SOS family self-ID auth check failed:', e); }
                        if (signal.userId) senderSelfIds.add(signal.userId);
                        if (senderDeviceId) senderSelfIds.add(senderDeviceId);
                        try {
                            const { identityService: idSvc } = await import('../IdentityService');
                            const publicCode = idSvc.getPublicUserCode?.();
                            if (publicCode) senderSelfIds.add(publicCode);
                        } catch (e) { logger.error('SOS family publicCode resolution failed:', e); }

                        const writePromises = members.flatMap((member) => {
                            // Skip self — check all known IDs for the sender
                            if ((member.uid && senderSelfIds.has(member.uid)) ||
                                (member.deviceId && senderSelfIds.has(member.deviceId))) {
                                return [];
                            }
                            // Write to ALL known IDs for this member
                            // SOSAlertListener may listen on physical deviceId, QR id, OR UID
                            const targetIds = new Set<string>();
                            if (member.deviceId) targetIds.add(member.deviceId);
                            if (member.uid) targetIds.add(member.uid);

                            return Array.from(targetIds).map(async (targetId) => {
                                try {
                                    const legacyRef = doc(db, 'devices', targetId, 'sos_alerts', signal.id);
                                    const v3Ref = doc(db, 'sos_alerts', targetId, 'items', signal.id);

                                    const writes = await Promise.allSettled([
                                        setDoc(legacyRef, sosAlert),
                                        setDoc(v3Ref, sosAlert),
                                    ]);

                                    const hasSuccess = writes.some((result) => result.status === 'fulfilled');
                                    if (!hasSuccess) {
                                        // RETRY: Single retry with 1s delay for transient Firestore errors
                                        logger.warn(`⚠️ SOS family write failed for ${member.name} (${targetId}), retrying in 1s...`);
                                        await new Promise(r => setTimeout(r, 1000));
                                        const retryWrites = await Promise.allSettled([
                                            setDoc(legacyRef, sosAlert),
                                            setDoc(v3Ref, sosAlert),
                                        ]);
                                        const retrySuccess = retryWrites.some((r) => r.status === 'fulfilled');
                                        if (!retrySuccess) {
                                            throw new Error('No SOS family write path succeeded after retry');
                                        }
                                    }

                                    logger.info(`✅ SOS alert sent to family member: ${member.name} (${targetId})`);
                                } catch (err) {
                                    logger.error(`❌ Failed to send SOS to family member ${member.name} (${targetId}):`, err);
                                    throw err; // Re-throw so Promise.allSettled counts it as rejected
                                }
                            });
                        });

                        const familyResults = await Promise.allSettled(writePromises);
                        const familySuccessCount = familyResults.filter(r => r.status === 'fulfilled').length;
                        logger.info(`✅ Family SOS Firestore broadcast: ${familySuccessCount}/${members.length} members`);
                        if (familySuccessCount === 0 && writePromises.length > 0) {
                            familyCloudError = new Error(`All ${members.length} family SOS writes failed`);
                        }
                    }
                } catch (cloudErr) {
                    familyCloudError = cloudErr instanceof Error ? cloudErr : new Error(String(cloudErr));
                }
            } else {
                logger.warn('Family Firestore broadcast deferred; mesh backup will still be attempted');
            }

            // OFFLINE: Also broadcast via BLE Mesh with family tag (mesh always runs)
            try {
                const { meshNetworkService } = await import('../mesh');
                const { MeshMessageType } = await import('../mesh/MeshProtocol');
                const { getInstallationId } = await import('../../../lib/installationId');
                const installationId = await getInstallationId().catch(() => '');
                const meshSenderId = installationId || senderDeviceId || signal.userId;

                const familySOSPayload = JSON.stringify({
                    type: 'FAMILY_SOS',
                    from: meshSenderId,
                    ...sosAlert,
                });

                await Promise.race([
                    meshNetworkService.broadcastMessage(familySOSPayload, MeshMessageType.SOS, {
                        from: meshSenderId,
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Mesh family SOS timeout')), 8000)),
                ]);
                logger.info('✅ Family SOS sent via Mesh (offline backup)');
            } catch (meshErr) {
                logger.warn('Mesh family SOS broadcast failed:', meshErr);
            }

            if (familyCloudError) {
                throw familyCloudError;
            }
        } catch (error) {
            logger.error('❌ Family broadcast failed:', error);
            throw error;
        }
    }

    // ============================================================================
    // NEARBY USERS CHANNEL (CRITICAL: Alert ALL nearby users, not just family)
    // ============================================================================

    /**
     * Write SOS to global sos_broadcasts collection for proximity-based alerting.
     * Cloud Function picks this up and sends FCM push to all users within radius.
     * This is the ONLY channel that reaches non-family users online.
     */
    private async broadcastToNearbyUsers(signal: SOSSignal): Promise<void> {
        try {
            // Firestore write is attempted only when internet is reachable; otherwise
            // SOS cloud retry sends this when connectivity returns.
            // STEP 1: Firestore instance
            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
            let db = await getFirestoreInstanceAsync();
            if (!db) {
                // CRITICAL FIX: Retry after 2s — Firestore may still be initializing during cold start.
                // Without retry, nearby users get NO notification if SOS triggers before Firestore is ready.
                // broadcastToFamily already has this pattern (lines 423-426).
                logger.warn('Nearby SOS broadcast: Firestore unavailable, retrying in 2s...');
                await new Promise(r => setTimeout(r, 2000));
                db = await getFirestoreInstanceAsync();
            }
            if (!db) {
                logger.error('❌ Nearby SOS broadcast FAILED: Firestore unavailable after retry');
                throw new Error('Nearby SOS failed: Firestore unavailable');
            }

            // STEP 3: Check auth state — resolve auth UID for Firestore rules compliance
            // LIFE-SAFETY: Wait briefly for auth to restore if not ready (cold start race)
            let authUid: string | null = null;
            try {
                authUid = await waitForAuthUid('Nearby SOS broadcast');
                logger.debug(`[SOS] Step 3 - Auth: uid=${authUid || 'NOT LOGGED IN'}`);
                if (!authUid) {
                    logger.error('[SOS] No authenticated user after 2s wait — skipping Firestore broadcast (will be rejected by rules). Mesh channel is the fallback.');
                    throw new Error('No auth for nearby broadcast');
                }
            } catch (authErr) {
                logger.error(`[SOS] Auth check failed — skipping Firestore broadcast:`, authErr);
                throw authErr;
            }

            // STEP 4: Get device ID + identity + health data
            const { doc, setDoc } = await import('firebase/firestore');
            const { getDeviceId } = await import('../../../lib/device');
            const senderDeviceId = await getDeviceId();
            logger.debug(`[SOS] Step 4 - DeviceId: ${senderDeviceId}`);

            // STEP 4.5: Resolve sender name for rescuers
            let senderName = 'Bilinmeyen';
            try {
                const { identityService } = await import('../IdentityService');
                const identity = identityService.getIdentity();
                senderName = identity?.displayName || 'Kullanıcı';
            } catch {
                senderName = 'Kullanıcı';
            }

            // STEP 5: Build document
            const hasLocation = signal.location != null;
            if (!hasLocation) {
                logger.warn('Global SOS broadcast: NO location — public proximity broadcast will rely on family/backend/mesh fallbacks');
            }

            // CRITICAL FIX: Use the ACTUAL Firebase Auth UID for senderUid, not signal.userId.
            // signal.userId may have fallen back to a device ID (AFN-XXXX) during cold start
            // when auth wasn't ready yet. Firestore rules require senderUid == request.auth.uid.
            // If we use the device ID, the write is SILENTLY REJECTED by Firestore rules.
            const broadcastData = {
                signalId: signal.id,
                senderDeviceId: senderDeviceId || signal.userId,
                senderUid: authUid!,
                userId: signal.userId,
                senderName,
                message: signal.message,
                reason: signal.reason,
                latitude: hasLocation ? (signal.location?.latitude ?? null) : null,
                longitude: hasLocation ? (signal.location?.longitude ?? null) : null,
                accuracy: hasLocation ? (signal.location?.accuracy || 0) : null,
                hasLocation: hasLocation,
                trapped: signal.trapped,
                battery: signal.device.batteryLevel,
                // KRİTİK (görev #1): `timestamp` = YAYIN zamanı. sos_broadcasts create
                // kuralı isRecentClientTimestamp ile ±5dk ister; SOS offline tetiklenip
                // geç dönen retry bir CREATE olur ve bayat signal.timestamp reddedilir.
                // Orijinal olay zamanı signalCreatedAt'te korunur.
                timestamp: Date.now(),
                signalCreatedAt: signal.timestamp,
                status: signal.status === 'cancelled' ? 'cancelled' : 'active',
            };

            logger.debug(`[SOS] Step 5 - Document data:`, JSON.stringify({
                signalId: broadcastData.signalId,
                latitude: broadcastData.latitude,
                longitude: broadcastData.longitude,
                timestamp: broadcastData.timestamp,
                hasLocation: broadcastData.hasLocation,
                typeOfTimestamp: typeof broadcastData.timestamp,
                typeOfLatitude: typeof broadcastData.latitude,
            }));

            const netState = await NetInfo.fetch();
            if (!this.isOnlineNetState(netState)) {
                logger.warn('⚠️ Nearby SOS deferred — offline (cloud retry will write sos_broadcasts when internet returns)');
                throw new Error('Nearby SOS deferred while offline');
            }

            // STEP 6: Write to Firestore
            const broadcastRef = doc(db, 'sos_broadcasts', signal.id);
            logger.debug(`[SOS] Step 6 - Writing to: sos_broadcasts/${signal.id}`);

            await setDoc(broadcastRef, broadcastData);

            logger.debug('[SOS] Step 7 - ✅ WRITE SUCCESSFUL — Cloud Function should trigger now');
            logger.info('✅ Global SOS broadcast sent — Cloud Function will push to nearby users');
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.debug(`[SOS] ❌ WRITE FAILED: ${errMsg}`);
            logger.error('❌ Global SOS broadcast failed:', error);
            throw error;
        }
    }

    // ============================================================================
    // RESCUE ACK — Rescuer acknowledges they are on the way
    // ============================================================================

    /**
     * Send rescue acknowledgment to SOS sender.
     * Writes to Firestore so the trapped person can see help is coming.
     */
    async sendRescueACK(
        signalId: string,
        sosDeviceId: string,
        options?: { sosSenderUid?: string }
    ): Promise<void> {
        // CRITICAL FIX: Validate signalId is non-empty.
        // Empty signalId creates invalid Firestore paths like 'sos_broadcasts//acks/...'
        // which causes Firestore write errors and ACK never reaches the SOS sender.
        if (!signalId || signalId.trim().length === 0) {
            logger.error('❌ Cannot send rescue ACK: signalId is empty');
            throw new Error('Kurtarma mesajı gönderilemedi: Sinyal kimliği bulunamadı.');
        }

        try {
            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
            const db = await getFirestoreInstanceAsync();
            if (!db) {
                logger.warn('Cannot send ACK: Firestore unavailable');
                throw new Error('Kurtarma mesajı gönderilemedi: Firestore bağlantısı hazır değil.');
            }

            const { doc, setDoc } = await import('firebase/firestore');
            const { getDeviceId } = await import('../../../lib/device');
            const rescuerDeviceId = await getDeviceId();

            let rescuerName = 'Gönüllü';
            try {
                const { identityService } = await import('../IdentityService');
                const identity = identityService.getIdentity();
                rescuerName = identity?.displayName || 'Gönüllü';
            } catch { /* fallback */ }

            // Get rescuer's location
            let rescuerLocation: { latitude: number; longitude: number } | null = null;
            try {
                const Location = await import('expo-location');
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                rescuerLocation = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                };
            } catch { /* location optional */ }

            // CRITICAL: Get auth UID for sos_broadcasts/acks rule (requires userId == auth.uid)
            let userId: string | undefined;
            try {
                const { getFirebaseAuth } = await import('../../../lib/firebase');
                userId = getFirebaseAuth()?.currentUser?.uid;
            } catch (e) { logger.error('SOS ACK auth fallback failed:', e); }
            if (!userId) {
                try {
                    const { identityService } = await import('../IdentityService');
                    userId = identityService.getUid() || undefined;
                } catch (e) {
                    logger.error('SOS ACK identity fallback failed:', e);
                }
            }

            // CRITICAL FIX: userId is REQUIRED by sos_broadcasts/acks security rule
            // (request.resource.data.userId == request.auth.uid)
            // If userId is empty string '' → rule check '' == auth.uid → ALWAYS FALSE
            // → ACK write SILENTLY REJECTED → trapped person never sees rescue coming.
            // Ensure auth UID as last resort, and ABORT if truly unavailable.
            if (!userId || userId.trim().length === 0) {
                try {
                    const { getFirebaseAuth: getAuth2 } = await import('../../../lib/firebase');
                    userId = getAuth2()?.currentUser?.uid || undefined;
                } catch (e) { logger.error('SOS ACK last-resort auth failed:', e); }
            }
            if (!userId || userId.trim().length === 0) {
                logger.error('❌ Cannot send rescue ACK: no valid userId — Firestore rules will reject');
                throw new Error('Kurtarma mesajı gönderilemedi: Kimlik doğrulama hatası');
            }
            const ackData: Record<string, any> = {
                rescuerDeviceId,
                rescuerUid: userId, // CRITICAL FIX: SOSAckListener reads rescuerUid first
                rescuerName,
                rescuerLocation,
                timestamp: Date.now(),
                type: 'on_the_way',
                userId,
            };

            const ackDocId = `${signalId}_${rescuerDeviceId || userId || Date.now().toString(36)}`;
            const targetIds = new Set<string>();
            if (sosDeviceId?.trim()) {
                targetIds.add(sosDeviceId.trim());
            }
            if (options?.sosSenderUid?.trim()) {
                targetIds.add(options.sosSenderUid.trim());
            }
            // LIFE-SAFETY: Validate we have at least one target before attempting delivery
            if (targetIds.size === 0) {
                logger.error(`❌ Rescue ACK has NO targets for signal ${signalId} — trapped person will NOT be notified`);
                throw new Error('Kurtarma mesajı gönderilemedi: Hedef bulunamadı. Lütfen tekrar deneyin.');
            }
            let deliveredTargetCount = 0;
            for (const targetId of targetIds) {
                const writes = await Promise.allSettled([
                    setDoc(doc(db, 'devices', targetId, 'sos_acks', ackDocId), ackData),
                    setDoc(doc(db, 'sos_alerts', targetId, 'acks', ackDocId), ackData),
                ]);
                if (writes.some((result) => result.status === 'fulfilled')) {
                    deliveredTargetCount += 1;
                }
            }
            if (deliveredTargetCount === 0) {
                logger.error(`❌ Rescue ACK delivery FAILED for signal ${signalId} — all write paths rejected`);
                throw new Error('Kurtarma mesajı gönderilemedi: Bağlantı hatası. Lütfen tekrar deneyin.');
            }

            // Also write to sos_broadcasts sub-collection for global visibility
            // CRITICAL FIX: Only attempt if userId is valid — rule requires userId == auth.uid
            // Writing with empty userId causes silent permission-denied rejection
            if (userId && userId.trim().length > 0) {
                try {
                    const broadcastAckRef = doc(db, 'sos_broadcasts', signalId, 'acks', rescuerDeviceId || userId);
                    await setDoc(broadcastAckRef, ackData);
                } catch (ackErr) {
                    logger.warn('Broadcast ACK write failed (non-critical):', ackErr);
                }
            } else {
                logger.warn('Broadcast ACK skipped: no valid userId for sos_broadcasts/acks rule');
            }

            logger.info(`✅ Rescue ACK sent for signal ${signalId} by ${rescuerName} (targets: ${deliveredTargetCount})`);

            // ENHANCEMENT: Also broadcast ACK via BLE Mesh for offline SOS senders
            try {
                const { meshNetworkService } = await import('../mesh');
                const { MeshMessageType } = await import('../mesh/MeshProtocol');
                const { getInstallationId } = await import('../../../lib/installationId');
                const installationId = await getInstallationId().catch(() => '');
                const meshSenderId = installationId || rescuerDeviceId || userId || 'anon';

                const meshAckPayload = JSON.stringify({
                    type: 'RESCUE_ACK',
                    signalId,
                    from: meshSenderId,
                    rescuerDeviceId,
                    rescuerUid: userId,
                    rescuerName,
                    rescuerLocation,
                    timestamp: Date.now(),
                });

                // Use SOS type for rescue ACK to get priority relay treatment
                await meshNetworkService.broadcastMessage(meshAckPayload, MeshMessageType.SOS, {
                    from: meshSenderId,
                });
                logger.info('✅ Rescue ACK also sent via BLE Mesh (offline backup)');
            } catch (meshErr) {
                logger.warn('Mesh ACK broadcast failed (non-critical):', meshErr);
            }
        } catch (error) {
            logger.error('Failed to send rescue ACK:', error);
            // CRITICAL FIX: Re-throw so SOSHelpScreen can show error to rescuer.
            // Previously this catch swallowed all errors including validation throws
            // (no userId, no targets, all writes failed) → UI showed "Bildirildi" (success)
            // when the ACK was NEVER delivered → trapped person never knew help was coming.
            throw error;
        }
    }

    // ============================================================================
    // HEALTH PROFILE
    // ============================================================================

    /**
     * Load user's health profile from AsyncStorage for SOS broadcast.
     * Returns null if no health profile exists.
     */
    /**
     * Public accessor for health profile — used by SOSBeaconService to include
     * health data in periodic beacon payloads.
     */
    async loadHealthProfileForBeacon(): Promise<{
        bloodType?: string;
        allergies?: string;
        chronicConditions?: string;
        emergencyNotes?: string;
    } | null> {
        return this.loadHealthProfile();
    }

    private async loadHealthProfile(): Promise<{
        bloodType?: string;
        allergies?: string;
        chronicConditions?: string;
        emergencyNotes?: string;
    } | null> {
        try {
            try {
                const { emergencyHealthSharingService } = await import('../EmergencyHealthSharingService');
                if (!emergencyHealthSharingService.isHealthSharingEnabled()) {
                    return null;
                }
            } catch {
                return null;
            }

            const { DirectStorage } = await import('../../utils/storage');

            // CRITICAL FIX: healthProfileStore uses scoped key '@afetnet:health_profile:user:{uid}'
            // (NOT '@health_profile'). The old key NEVER matched, so SOS broadcasts NEVER
            // included health data — rescuers had no blood type, allergies, or medications info.
            // Try scoped key first (normal case), then unscoped fallback.
            let raw: string | undefined;
            try {
                const { getFirebaseAuth } = await import('../../../lib/firebase');
                const uid = getFirebaseAuth()?.currentUser?.uid;
                if (uid) {
                    raw = DirectStorage.getString(`@afetnet:health_profile:user:${uid}`);
                }
            } catch { /* auth not ready */ }

            // Fallback: try unscoped key (guest mode or migration)
            if (!raw) {
                raw = DirectStorage.getString('@afetnet:health_profile');
            }

            if (!raw) return null;
            const profile = JSON.parse(raw);

            // Format arrays into human-readable strings for rescuers
            const allergiesStr = Array.isArray(profile.allergies) && profile.allergies.length > 0
                ? profile.allergies.join(', ')
                : (typeof profile.allergies === 'string' ? profile.allergies : undefined);

            const conditionsStr = Array.isArray(profile.chronicConditions) && profile.chronicConditions.length > 0
                ? profile.chronicConditions.join(', ')
                : (typeof profile.chronicConditions === 'string' ? profile.chronicConditions : undefined);

            const medicationsStr = Array.isArray(profile.medications) && profile.medications.length > 0
                ? profile.medications.join(', ')
                : undefined;

            return {
                bloodType: profile.bloodType || undefined,
                allergies: allergiesStr || undefined,
                chronicConditions: conditionsStr || undefined,
                emergencyNotes: profile.notes || profile.emergencyNotes || (medicationsStr ? `İlaçlar: ${medicationsStr}` : undefined),
            };
        } catch {
            return null;
        }
    }

    // ============================================================================
    // STATUS CHECK
    // ============================================================================

    async getNetworkStatus(): Promise<'online' | 'mesh' | 'offline'> {
        try {
            const netInfo = await NetInfo.fetch();
            if (this.isOnlineNetState(netInfo)) {
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

    // CRITICAL FIX: Cache last known battery level. Fallback 100% is dangerous —
    // rescuers see full battery when phone may actually be dying.
    private lastKnownBatteryLevel = -1;

    async getBatteryLevel(): Promise<number> {
        try {
            const level = await Battery.getBatteryLevelAsync();
            const percent = Math.round(level * 100);
            this.lastKnownBatteryLevel = percent;
            return percent;
        } catch {
            // Return last known level if available, otherwise -1 to indicate unknown
            return this.lastKnownBatteryLevel >= 0 ? this.lastKnownBatteryLevel : -1;
        }
    }
}

export const sosChannelRouter = new SOSChannelRouter();
export default sosChannelRouter;
