/**
 * NOTIFICATION CENTER — Unified Gateway
 * 
 * The SINGLE entry point for ALL notifications in the entire app.
 * 
 * USAGE:
 *   import { notificationCenter } from './notifications/NotificationCenter';
 *   await notificationCenter.notify('earthquake', { magnitude: 5.2, location: 'İstanbul', ... });
 * 
 * ARCHITECTURE:
 *   Service → notify() → AI Intelligence → Formatter → Delivery Engine → Push/Sound/TTS
 * 
 * CATEGORIES:
 *   earthquake, eew, sos, sos_received, rescue, family, message, news, system, drill
 */

import { Platform, Alert, DeviceEventEmitter } from 'react-native';
import { createLogger } from '../../utils/logger';
import {
    evaluateNotification,
    resetAIState,
    getAIStats,
    type NotificationCategory,
    type NotificationPriority,
    type NotificationPayload,
    type AIDecision,
} from './NotificationAI';
import { scheduleNotification, cancelAllNotifications } from './NotificationScheduler';
import { initializeChannels, getChannelForType } from './NotificationChannelManager';
import { getPermissionStatus, getExpoPushToken } from './NotificationPermissionHandler';
import { getNotificationsAsync } from './NotificationModuleLoader';
import * as haptics from '../../utils/haptics';

const logger = createLogger('NotificationCenter');

const getNavigationRefModule = async () => {
    try {
        return require('../../navigation/navigationRef');
    } catch {
        return import('../../navigation/navigationRef');
    }
};

// ============================================================================
// TYPES
// ============================================================================

/** Data payload for earthquake notifications */
export interface EarthquakeNotifyData {
    magnitude: number;
    location: string;
    timestamp?: number;
    depth?: number;
    source?: string;
    latitude?: number;
    longitude?: number;
    isEEW?: boolean;
    isTest?: boolean;
    timeAdvance?: number;
    earthquakeId?: string;
}

/** Data payload for SOS notifications */
export interface SOSNotifyData {
    senderId?: string;
    senderUid?: string;
    senderDeviceId?: string;
    senderName?: string;
    from?: string;
    userId?: string;
    message?: string;
    location?: { latitude: number; longitude: number };
    signalId?: string;
    timestamp?: number;
    trapped?: boolean;
    battery?: number;
    healthInfo?: Record<string, string>;
}

/** Data payload for message notifications */
export interface MessageNotifyData {
    from?: string;
    senderName?: string;
    message: string;
    messageId?: string;
    senderId?: string;
    senderUid?: string;
    userId?: string;
    senderDeviceId?: string;
    conversationId?: string;
    isSOS?: boolean;
    isCritical?: boolean;
    isGroup?: boolean;
    showPreview?: boolean;
}

/** Data payload for family notifications */
export interface FamilyNotifyData {
    memberId?: string;
    memberName: string;
    userId?: string;
    type?: string;
    isSOS?: boolean;
    location?: { latitude: number; longitude: number };
    status?: string;
}

/** Data payload for news notifications */
export interface NewsNotifyData {
    title: string;
    summary?: string;
    source?: string;
    imageUrl?: string;
    url?: string;
    newsUrl?: string;
    articleId?: string;
    showPreview?: boolean;
}

/** Data payload for system notifications */
export interface SystemNotifyData {
    subtype: 'network' | 'battery' | 'checkin' | 'update' | 'generic';
    title?: string;
    message?: string;
    isConnected?: boolean;
    batteryLevel?: number;
    [key: string]: any;
}

/** Data payload for rescue notifications */
export interface RescueNotifyData {
    userId?: string;
    userName?: string;
    status?: string;
    distance?: number;
    message?: string;
    location?: { latitude: number; longitude: number };
}

/** Data payload for drill notifications */
export interface DrillNotifyData {
    drillType?: string;
    message?: string;
    title?: string;
}

/** Maps category to its data type */
export type NotifyDataMap = {
    earthquake: EarthquakeNotifyData;
    eew: EarthquakeNotifyData;
    sos: SOSNotifyData;
    sos_received: SOSNotifyData;
    family_sos: SOSNotifyData;
    rescue: RescueNotifyData;
    family: FamilyNotifyData;
    message: MessageNotifyData;
    news: NewsNotifyData;
    system: SystemNotifyData;
    drill: DrillNotifyData;
};

/** Result of a notify() call */
export interface NotifyResult {
    delivered: boolean;
    reason: string;
    notificationId?: string;
    priority: NotificationPriority;
}

// ============================================================================
// NOTIFICATION CENTER CLASS
// ============================================================================

class NotificationCenter {
    private isInitialized = false;
    private settingsCache: any = null;
    private responseListenerCleanup: (() => void) | null = null;
    private foregroundListenerCleanup: (() => void) | null = null;
    private coldStartTimers: ReturnType<typeof setTimeout>[] = [];
    // Track processedTapIds cleanup timers so destroy() can clear them
    private tapDedupTimers: ReturnType<typeof setTimeout>[] = [];
    private settingsCacheTime = 0;
    private readonly SETTINGS_CACHE_TTL = 5000; // 5s cache

    // FIX: Track currently active conversation to suppress OS banner.
    // WhatsApp/Telegram suppress notifications when viewing the same chat.
    public currentlyViewingConversationId: string | null = null;

    // ===========================================================================
    // INITIALIZATION
    // ===========================================================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // CRITICAL FIX: Clean up any stale listeners from a previous partial init.
            // Without this, if initialize() is called multiple times (e.g., after hot reload
            // or auth state change), listeners accumulate and fire duplicate handlers.
            if (this.foregroundListenerCleanup) {
                this.foregroundListenerCleanup();
                this.foregroundListenerCleanup = null;
            }
            if (this.responseListenerCleanup) {
                this.responseListenerCleanup();
                this.responseListenerCleanup = null;
            }
            // FIX: Clear stale cold-start retry timers from any previous partial init
            for (const t of this.coldStartTimers) clearTimeout(t);
            this.coldStartTimers = [];

            // Startup must not trigger the OS permission dialog.
            // Permission prompting is handled only by explicit user actions.
            const permissionStatus = await getPermissionStatus();
            if (permissionStatus.status !== 'granted') {
                logger.info(`Notification permission prompt deferred at startup (${permissionStatus.status})`);
            }

            // Initialize Android channels
            await initializeChannels();

            // Reset AI state on app start (prevents stale dedup from previous session)
            resetAIState();

            // Clear old non-critical notifications on app open.
            // LIFE-SAFETY: Do NOT dismiss SOS/EEW notifications — they must remain visible
            // until the user explicitly handles them. Only clear badge count.
            try {
                const Notifications = await getNotificationsAsync();
                if (Notifications) {
                    // Get all presented notifications and only dismiss non-SOS ones
                    if (typeof Notifications.getPresentedNotificationsAsync === 'function'
                        && typeof Notifications.dismissNotificationAsync === 'function') {
                        const presented = await Notifications.getPresentedNotificationsAsync();
                        for (const notif of presented) {
                            const nType = (notif?.request?.content?.data?.type || '').toLowerCase();
                            const isSosOrEew = nType.includes('sos') || nType === 'eew'
                                || nType === 'earthquake' || nType === 'family_sos';
                            if (!isSosOrEew) {
                                await Notifications.dismissNotificationAsync(notif.request.identifier);
                            }
                        }
                    }
                    if (typeof Notifications.setBadgeCountAsync === 'function') {
                        await Notifications.setBadgeCountAsync(0);
                    }
                }
            } catch (e) {
                logger.debug('Failed to clear old notifications:', e);
            }

            // Set notification handler — SINGLE authoritative handler
            // Consolidates EEW priority logic from FCMTokenService
            try {
                const Notifications = await getNotificationsAsync();
                if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
                    Notifications.setNotificationHandler({
                        handleNotification: async (notification: any) => {
                            const data = notification?.request?.content?.data;
                            const notifType = (data?.type || '').toLowerCase();

                            // EEW notifications get MAX priority — always show
                            if (notifType === 'eew') {
                                return {
                                    shouldShowAlert: true,
                                    shouldPlaySound: true,
                                    shouldSetBadge: true,
                                    shouldShowBanner: true,
                                    shouldShowList: true,
                                    priority: Notifications.AndroidNotificationPriority?.MAX,
                                };
                            }

                            // CRITICAL FIX: SOS alerts MUST always show alert in foreground.
                            // NOTE: sos_message is NOT included here — it's a regular chat message
                            // within an SOS conversation, not an SOS alert itself. Including it
                            // would bypass DND and set MAX priority for every reply message during
                            // rescue coordination, which is disruptive and incorrect.
                            // sos_message is handled below in the message type block instead.
                            if (notifType === 'sos' || notifType === 'sos_alert' || notifType === 'sos_received' || notifType === 'sos_family' || notifType === 'family_sos' || notifType === 'sos_proximity' || notifType === 'nearby_sos') {
                                return {
                                    shouldShowAlert: true,
                                    shouldPlaySound: true,
                                    shouldSetBadge: true,
                                    shouldShowBanner: true,
                                    shouldShowList: true,
                                    priority: Notifications.AndroidNotificationPriority?.MAX,
                                };
                            }

                            // FIX: Suppress OS banner when user is viewing the SAME conversation.
                            // WhatsApp/Telegram never show a banner for the active chat.
                            // NOTE: sos_message is a regular chat message within an SOS conversation.
                            // It should follow normal message suppression rules, not SOS alert rules.
                            if (notifType === 'message' || notifType === 'new_message' || notifType === 'message_received' || notifType === 'sos_message') {
                                const msgConvId = data?.conversationId;
                                const msgSenderUid = data?.senderUid || data?.userId || data?.senderId || '';
                                // CRITICAL FIX: Compare BOTH conversationId AND senderUid against
                                // currentlyViewingConversationId. ConversationScreen may set
                                // currentlyViewingConversationId to either a Firestore conversationId
                                // OR a userId (when conversationId isn't resolved yet). Without
                                // checking both, notifications are NOT suppressed when the user is
                                // viewing the conversation before the Firestore conversation is resolved.
                                const viewingId = this.currentlyViewingConversationId;
                                const isViewingSameChat = !!viewingId && (
                                    (!!msgConvId && msgConvId === viewingId) ||
                                    (!!msgSenderUid && msgSenderUid === viewingId)
                                );

                                if (isViewingSameChat) {
                                    return {
                                        shouldShowAlert: false,
                                        shouldPlaySound: false,
                                        shouldSetBadge: false,
                                        shouldShowBanner: false,
                                        shouldShowList: false,
                                    };
                                }
                                return {
                                    shouldShowAlert: true,
                                    shouldPlaySound: true,
                                    shouldSetBadge: true,
                                    shouldShowBanner: true,
                                    shouldShowList: true,
                                };
                            }

                            return {
                                shouldShowAlert: true,
                                shouldPlaySound: true,
                                shouldSetBadge: true,
                                shouldShowBanner: true,
                                shouldShowList: true,
                            };
                        },
                    });
                }
            } catch (e) {
                logger.debug('Failed to set notification handler:', e);
            }

            // CRITICAL: Foreground SOS alert — show prominent in-app alert when SOS arrives while app is open
            try {
                const NotifsForeground = await getNotificationsAsync();
                if (NotifsForeground && typeof NotifsForeground.addNotificationReceivedListener === 'function') {
                    const fgSub = NotifsForeground.addNotificationReceivedListener((notification: any) => {
                        try {
                            const fgData = notification?.request?.content?.data;
                            const fgType = (fgData?.type || '').toLowerCase();
                            // NOTE: sos_message is NOT an SOS alert — it's a regular chat message
                            // within an SOS conversation. Including it here would trigger full-screen
                            // emergency alerts for every reply message during rescue coordination.
                            const isSOS = fgType === 'sos' || fgType === 'sos_received' || fgType === 'sos_alert'
                                || fgType === 'sos_family' || fgType === 'family_sos'
                                || fgType === 'sos_proximity' || fgType === 'nearby_sos';

                            if (isSOS) {
                                // CRITICAL FIX: fgData.from is a reserved FCM key and gets stripped.
                                // CF sends fromName as backup. Must include it in fallback chain.
                                const senderName = fgData?.senderName || fgData?.fromName || fgData?.from || 'Aile Uyesi';
                                const message = fgData?.message || 'Acil yardim gerekiyor!';
                                const lat = fgData?.location?.latitude ?? fgData?.latitude;
                                const lng = fgData?.location?.longitude ?? fgData?.longitude;

                                // ELITE V4: Emit full-screen SOS alert via DeviceEventEmitter
                                // Works fully offline — no network dependency
                                DeviceEventEmitter.emit('SOS_FULLSCREEN_ALERT', {
                                    signalId: fgData?.signalId,
                                    senderUid: fgData?.senderUid || fgData?.userId,
                                    senderDeviceId: fgData?.senderDeviceId,
                                    senderName,
                                    message,
                                    latitude: lat ? Number(lat) : undefined,
                                    longitude: lng ? Number(lng) : undefined,
                                    trapped: fgData?.trapped === 'true' || fgData?.trapped === true,
                                    battery: fgData?.battery ? Number(fgData.battery) : undefined,
                                    healthInfo: fgData?.healthInfo && typeof fgData.healthInfo === 'object'
                                        ? fgData.healthInfo
                                        : undefined,
                                });
                            }

                            // === FOREGROUND FAMILY STATUS UPDATE ===
                            // Make family status updates highly visible when app is open
                            if (fgType === 'family_status_update') {
                                const status = fgData?.status;
                                // CRITICAL FIX: fgData.from is reserved FCM key (stripped). Use fromName fallback.
                                const senderName = fgData?.senderName || fgData?.fromName || fgData?.memberName || 'Aile Üyesi';
                                const lat = fgData?.location?.latitude ?? fgData?.latitude;
                                const lng = fgData?.location?.longitude ?? fgData?.longitude;

                                if (status === 'critical') {
                                    // Treat critical status updates the same as SOS
                                    DeviceEventEmitter.emit('SOS_FULLSCREEN_ALERT', {
                                        signalId: fgData?.signalId || `status_${Date.now()}`,
                                        senderUid: fgData?.senderUid || fgData?.userId,
                                        senderDeviceId: fgData?.senderDeviceId,
                                        senderName,
                                        message: `${senderName} acil durum bildirdi! Hemen kontrol edin.`,
                                        latitude: lat ? Number(lat) : undefined,
                                        longitude: lng ? Number(lng) : undefined,
                                    });
                                } else if (status === 'safe' || status === 'need-help') {
                                    const statusText = status === 'safe' ? 'Güvendeyim' : 'Yardıma İhtiyacım Var';
                                    const isNeedHelp = status === 'need-help';

                                    // Trigger a local multi-channel alert so it is highly noticeable in foreground
                                    import('../MultiChannelAlertService').then(({ multiChannelAlertService }) => {
                                        multiChannelAlertService.sendAlert({
                                            title: isNeedHelp ? '🆘 YARDIM ÇAĞRISI' : '✅ GÜVENDE',
                                            body: `${senderName}: ${statusText}`,
                                            priority: isNeedHelp ? 'high' : 'normal',
                                            channels: {
                                                pushNotification: false, // Already arrived as push
                                                fullScreenAlert: false,
                                                alarmSound: isNeedHelp,
                                                vibration: true,
                                                tts: true,
                                            },
                                            ttsText: `${senderName} ${status === 'safe' ? 'güvende olduğunu' : 'yardıma ihtiyacı olduğunu'} bildirdi.`,
                                            data: fgData,
                                        }).catch(e => logger.warn('Failed to play status alert:', e));
                                    }).catch(e => logger.warn('Failed to import MultiChannelAlertService:', e));
                                }
                            }


                            // === FOREGROUND VOICE CALL ===
                            if (fgType === 'voice_call') {
                                DeviceEventEmitter.emit('VOICE_CALL_INCOMING', {
                                    callId: fgData?.callId,
                                    callerUid: fgData?.callerUid,
                                    callerName: fgData?.callerName || 'Bilinmeyen',
                                });
                            }

                            // === FOREGROUND EEW ALERT ===
                            // When an EEW push arrives in foreground, trigger full-screen countdown,
                            // log to history, and activate emergency mode if threshold met.
                            // This replaces the duplicate listener that was in FCMTokenService.
                            const isEEW = fgType === 'eew';
                            if (isEEW) {
                                // Trigger EEW countdown engine for in-app full-screen alert
                                try {
                                    const eewMag = Number(fgData?.magnitude);
                                    const eewWarnSec = Number(fgData?.warningSeconds) || 0;
                                    if (Number.isFinite(eewMag) && eewMag >= 4.0) {
                                        import('../EEWCountdownEngine').then(({ eewCountdownEngine }) => {
                                            eewCountdownEngine.startCountdown({
                                                warningTime: eewWarnSec,
                                                magnitude: eewMag,
                                                estimatedIntensity: eewMag >= 7.0 ? 9 : eewMag >= 6.0 ? 7 : eewMag >= 5.0 ? 6 : 5,
                                                location: String(fgData?.location || ''),
                                                epicentralDistance: 0,
                                                pWaveArrivalTime: 0,
                                                sWaveArrivalTime: eewWarnSec,
                                                origin: {
                                                    latitude: Number(fgData?.latitude) || 0,
                                                    longitude: Number(fgData?.longitude) || 0,
                                                    depth: Number(fgData?.depth) || 10,
                                                },
                                            });
                                        }).catch((eewErr) => {
                                            // LIFE-SAFETY: EEW countdown failure MUST be logged — user may miss earthquake warning
                                            logger.error('🚨 CRITICAL: EEW countdown engine import/start FAILED:', eewErr);
                                        });
                                    }
                                } catch { /* non-critical */ }
                                try {
                                    const magnitude = Number(fgData?.magnitude);
                                    const location = String(fgData?.location || 'Unknown').trim() || 'Unknown';
                                    if (Number.isFinite(magnitude) && magnitude > 0) {
                                        // Log to EEW history
                                        import('../../stores/eewHistoryStore').then(({ useEEWHistoryStore }) => {
                                            useEEWHistoryStore.getState().addEvent({
                                                timestamp: Number(fgData?.timestamp) || Date.now(),
                                                magnitude,
                                                location,
                                                depth: Number(fgData?.depth) || 0,
                                                latitude: Number(fgData?.latitude) || 0,
                                                longitude: Number(fgData?.longitude) || 0,
                                                warningTime: 0,
                                                estimatedIntensity: magnitude >= 7.0 ? 9 : magnitude >= 6.0 ? 7 : magnitude >= 5.0 ? 6 : magnitude >= 4.0 ? 5 : 4,
                                                epicentralDistance: 0,
                                                source: (fgData?.source as any) || 'AFAD',
                                                wasNotified: true,
                                                confidence: 1.0,
                                                certainty: magnitude >= 6.0 ? 'high' : magnitude >= 5.0 ? 'medium' : 'low',
                                            });
                                        }).catch(e => { if (__DEV__) logger.debug('NotifCenter: EEW history store error:', e); });

                                        // Trigger emergency mode if threshold met
                                        import('../EmergencyModeService').then(({ emergencyModeService }) => {
                                            const earthquake = {
                                                id: String(fgData?.eventId || fgData?.id || `eew_${Date.now()}`),
                                                magnitude,
                                                location,
                                                latitude: Number(fgData?.latitude) || 0,
                                                longitude: Number(fgData?.longitude) || 0,
                                                depth: Number(fgData?.depth) || 0,
                                                time: Number(fgData?.timestamp) || Date.now(),
                                                source: (fgData?.source || 'AFAD') as any,
                                            };
                                            if (emergencyModeService.shouldTriggerEmergencyMode(earthquake)) {
                                                emergencyModeService.activateEmergencyMode(earthquake);
                                            }
                                        }).catch(e => { if (__DEV__) logger.debug('NotifCenter: emergency mode trigger error:', e); });
                                    }
                                } catch {
                                    // Non-critical — push is still displayed by OS
                                }
                            }

                            // === IN-APP MESSAGE NOTIFICATION BANNER ===
                            const isMessage = fgType === 'message' || fgType === 'new_message' || fgType === 'message_received' || fgType === 'sos_message';
                            if (isMessage) {
                                // CRITICAL FIX: fgData.from is a reserved FCM key and gets stripped.
                                // CF sends fromName as backup. Must include it in fallback chain.
                                const msgSenderName = fgData?.senderName || fgData?.fromName || fgData?.from || 'Yeni Mesaj';
                                const msgPreview = fgData?.message || 'Yeni mesaj geldi';
                                const msgConversationId = fgData?.conversationId;
                                const msgSenderId = fgData?.senderUid || fgData?.userId || fgData?.senderId;

                                // Suppress in-app alert if user is already viewing THIS conversation
                                try {
                                    const { getCurrentRouteName, navigationRef: navRef } = require('../../navigation/navigationRef');
                                    const currentRoute = getCurrentRouteName();
                                    if (currentRoute === 'Conversation' && msgSenderId) {
                                        // CRITICAL FIX: Only suppress if viewing the SAME conversation.
                                        // Previously suppressed for ALL conversations — messages from other
                                        // users had no haptic while viewing any conversation.
                                        const currentParams = navRef?.getCurrentRoute?.()?.params as any;
                                        const isViewingSameConversation =
                                            (msgConversationId && currentParams?.conversationId === msgConversationId) ||
                                            (msgSenderId && (currentParams?.userId === msgSenderId || currentParams?.recipientId === msgSenderId));
                                        if (isViewingSameConversation) {
                                            logger.debug(`Suppressing in-app alert: already viewing this conversation`);
                                            return;
                                        }
                                    }
                                    if (currentRoute === 'FamilyGroupChat' && msgConversationId) {
                                        const currentParams = navRef?.getCurrentRoute?.()?.params as any;
                                        // FIX: FamilyGroupChat uses param name 'groupId', not 'conversationId'
                                        if (currentParams?.groupId === msgConversationId) {
                                            logger.debug(`Suppressing in-app alert: already on FamilyGroupChat screen`);
                                            return;
                                        }
                                    }
                                    // Light haptic for message (Banner also triggers haptic, but keeping this light native haptic)
                                    haptics.impactLight();

                                    // ELITE V2 FIX: Removed disruptive React Native Alert
                                    // The OS System Banner (set to shouldShowBanner: true above) will handle the notification
                                    // elegantly from the top of the screen without interrupting user workflow.
                                    logger.debug(`Message notification received in foreground. OS Banner handling display.`);
                                } catch { /* navigation not ready — ignore error for background */ }
                            }
                        } catch (fgErr) {
                            logger.debug('Foreground SOS alert handler error:', fgErr);
                        }
                    });
                    this.foregroundListenerCleanup = () => fgSub.remove();
                }
            } catch (e) {
                logger.debug('Failed to register foreground SOS listener:', e);
            }

            // CRITICAL: Register tap listener — the SINGLE place for notification taps
            // Dedup: track processed notification IDs to prevent double handling
            // (getLastNotificationResponseAsync + addNotificationResponseReceivedListener can both fire)
            const processedTapIds = new Set<string>();
            const dedupAndHandle = (response: any) => {
                const notifId =
                    response?.notification?.request?.identifier
                    || response?.notification?.request?.content?.data?.messageId
                    || '';
                if (notifId && processedTapIds.has(notifId)) {
                    logger.debug(`Notification tap dedup: skipping already-handled ${notifId}`);
                    return;
                }
                if (notifId) processedTapIds.add(notifId);
                // Cleanup old entries after 60s to prevent memory leak
                if (notifId) {
                    const t = setTimeout(() => processedTapIds.delete(notifId), 60_000);
                    this.tapDedupTimers.push(t);
                }
                this.handleNotificationTap(response).catch(e =>
                    logger.debug('Tap handler error:', e)
                );
            };

            try {
                const Notifications = await getNotificationsAsync();
                if (Notifications) {
                    // Live tap listener (app is running)
                    if (typeof Notifications.addNotificationResponseReceivedListener === 'function') {
                        const subscription = Notifications.addNotificationResponseReceivedListener(
                            (response: any) => {
                                dedupAndHandle(response);
                            }
                        );
                        this.responseListenerCleanup = () => subscription.remove();
                    }

                    // Cold-start tap (app was killed, user tapped notification to open)
                    // CRITICAL FIX: Retry getLastNotificationResponseAsync with a delay.
                    // On some iOS versions, the response isn't available immediately after
                    // app launch — it needs a brief delay for the system to populate it.
                    if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
                        // CRITICAL FIX: Increased from 5 (2.5s) to 20 (10s).
                        // Auth resolution can take 8s (INITIAL_RESTORE_GRACE_MS) on cold start.
                        // Previous 2.5s window caused cold-start notification taps to be lost
                        // because the identity wasn't resolved yet when the handler fired.
                        const MAX_COLD_START_ATTEMPTS = 20; // 20 attempts × 500ms = 10s total window
                        const checkColdStartTap = async (attempt: number) => {
                            try {
                                const response = await Notifications.getLastNotificationResponseAsync();
                                if (response) {
                                    logger.info(`📱 Cold-start notification tap detected (attempt ${attempt + 1}/${MAX_COLD_START_ATTEMPTS})`);
                                    dedupAndHandle(response);
                                } else if (attempt < MAX_COLD_START_ATTEMPTS - 1) {
                                    // Retry after a short delay — iOS may not have the response ready yet
                                    const t = setTimeout(() => checkColdStartTap(attempt + 1), 500);
                                    this.coldStartTimers.push(t);
                                } else {
                                    logger.debug(`Cold-start tap check: no response after ${MAX_COLD_START_ATTEMPTS} attempts`);
                                }
                            } catch {
                                if (attempt < MAX_COLD_START_ATTEMPTS - 1) {
                                    const t = setTimeout(() => checkColdStartTap(attempt + 1), 500);
                                    this.coldStartTimers.push(t);
                                }
                            }
                        };
                        checkColdStartTap(0);
                    }
                }
            } catch (e) {
                logger.debug('Failed to register tap listener:', e);
            }

            this.isInitialized = true;
            logger.info('✅ NotificationCenter initialized (with tap listener)');
        } catch (error) {
            logger.error('NotificationCenter initialization failed:', error);
            // Non-fatal — app should work without notifications
            this.isInitialized = true;
        }
    }

    // ===========================================================================
    // MAIN API — The ONLY way to send a notification
    // ===========================================================================

    /**
     * Send a notification through the unified center.
     * 
     * @param category - Notification category (earthquake, sos, message, etc.)
     * @param data - Category-specific data payload
     * @param source - (Optional) Source service name for debugging
     * @returns NotifyResult with delivery status
     */
    async notify<K extends NotificationCategory>(
        category: K,
        data: NotifyDataMap[K],
        source?: string,
    ): Promise<NotifyResult> {
        try {
            // Build payload
            const payload: NotificationPayload = {
                category,
                data: data as Record<string, any>,
                source,
                eventTimestamp: (data as any).timestamp || (data as any).eventTimestamp,
            };

            // 1. AI DECIDES
            const decision = evaluateNotification(payload);

            if (!decision.deliver) {
                if (__DEV__) {
                    logger.debug(`🚫 [${category}] Blocked: ${decision.reason} (src: ${source || 'unknown'})`);
                }
                return { delivered: false, reason: decision.reason, priority: decision.priority };
            }

            // 2. CHECK USER SETTINGS
            // LIFE-SAFETY OVERRIDE: SOS and EEW notifications ALWAYS deliver regardless of user settings
            const LIFE_SAFETY_CATEGORIES = ['earthquake', 'eew', 'sos', 'sos_received', 'family_sos'];
            const isLifeSafety = LIFE_SAFETY_CATEGORIES.includes(category as string);
            const settings = await this.getSettings();
            if (!settings.notificationsEnabled && !isLifeSafety) {
                return { delivered: false, reason: 'Notifications disabled by user', priority: decision.priority };
            }

            // Critical notifications and life-safety categories bypass silent/critical-only mode
            if (decision.priority !== 'critical' && !isLifeSafety) {
                if (settings.notificationMode === 'silent') {
                    return { delivered: false, reason: 'Silent mode active', priority: decision.priority };
                }
                if (settings.notificationMode === 'critical-only' && decision.priority !== 'high') {
                    return { delivered: false, reason: 'Critical-only mode active', priority: decision.priority };
                }
            }

            // 3. FORMAT
            const formatted = this.formatNotification(category, data as Record<string, any>, decision);

            // 3.5. EMPTY GUARD — never deliver blank notifications
            if (!formatted.title?.trim() && !formatted.body?.trim()) {
                logger.debug(`🚫 [${category}] Blocked: empty title and body (src: ${source || 'unknown'})`);
                return { delivered: false, reason: 'Empty notification content', priority: decision.priority };
            }

            // 4. DELIVER
            const notificationId = await this.deliver(category, formatted, decision, settings, data as Record<string, any>);

            if (__DEV__) {
                logger.info(`✅ [${category}] Delivered: "${formatted.title}" (${decision.priority}) src: ${source || 'N/A'}`);
            }

            return {
                delivered: true,
                reason: decision.reason,
                notificationId: notificationId || undefined,
                priority: decision.priority,
            };
        } catch (error) {
            logger.error(`NotificationCenter.notify(${category}) error:`, error);
            return { delivered: false, reason: 'Internal error', priority: 'normal' };
        }
    }

    // ===========================================================================
    // FORMATTING
    // ===========================================================================

    private formatNotification(
        category: NotificationCategory,
        data: Record<string, any>,
        decision: AIDecision,
    ): { title: string; body: string; ttsText?: string; vibrationPattern?: number[] } {
        switch (category) {
            case 'earthquake':
                return this.formatEarthquake(data, decision);
            case 'eew':
                return this.formatEEW(data, decision);
            case 'sos':
            case 'sos_received':
            case 'family_sos':
                return this.formatSOS(data, category);
            case 'rescue':
                return this.formatRescue(data);
            case 'family':
                return this.formatFamily(data);
            case 'message':
                return this.formatMessage(data);
            case 'news':
                return this.formatNews(data);
            case 'system':
                return this.formatSystem(data);
            case 'drill':
                return this.formatDrill(data);
            default:
                return { title: data.title || 'AfetNet', body: data.message || data.body || '' };
        }
    }

    private formatEarthquake(data: Record<string, any>, decision: AIDecision) {
        const mag = typeof data.magnitude === 'number' ? data.magnitude : 0;
        const loc = data.location || 'Bilinmeyen konum';
        const isEEW = data.isEEW === true;
        const timeAdvance = data.timeAdvance;

        const emoji = mag >= 6.0 ? '🚨' : mag >= 5.0 ? '⚠️' : '🌍';
        const urgency = mag >= 6.0 ? 'BÜYÜK DEPREM! ' : mag >= 5.0 ? 'ÖNEMLİ DEPREM! ' : '';
        const aftershockNote = decision.isAftershock ? ' (Artçı)' : '';

        const title = isEEW && timeAdvance
            ? `${emoji} ERKEN UYARI: ${mag.toFixed(1)} Büyüklüğünde Deprem${aftershockNote}`
            : `${emoji}${urgency}${mag.toFixed(1)} Büyüklüğünde Deprem${aftershockNote}`;

        let body = `📍 ${loc}`;
        if (isEEW && timeAdvance && timeAdvance > 0) {
            body += `\n⏱️ ${Math.round(timeAdvance)} saniye içinde sallanma bekleniyor`;
        }
        if (mag >= 5.0) {
            body += `\n${mag >= 6.0 ? '🚨' : '⚠️'} ACİL DURUM MODU AKTİF`;
        }

        const ttsText = mag >= 6.0
            ? `ACİL DURUM! ${mag.toFixed(1)} büyüklüğünde deprem! ${loc}`
            : mag >= 5.0
                ? `ÖNEMLİ DEPREM! ${mag.toFixed(1)} büyüklüğünde deprem! ${loc}`
                : undefined;

        const vibrationPattern = decision.priority === 'critical'
            ? [0, 500, 200, 500, 200, 500, 200, 500]
            : decision.priority === 'high'
                ? [0, 300, 100, 300, 100, 300]
                : [0, 200];

        return { title, body, ttsText, vibrationPattern };
    }

    private formatEEW(data: Record<string, any>, decision: AIDecision) {
        const mag = typeof data.magnitude === 'number' ? data.magnitude : 0;
        const loc = data.location || 'Bilinmeyen konum';
        const timeAdvance = data.timeAdvance || data.warningSeconds || 0;

        const title = `🚨 ACİL DEPREM UYARISI! M${mag.toFixed(1)}`;
        const body = `📍 ${loc}\n⏱️ ~${Math.round(timeAdvance)} saniye içinde sallanma bekleniyor\n🚨 GÜVENLI YERE GEÇİN!`;

        const ttsText = `Dikkat! Deprem uyarısı. ${loc} bölgesinde ${mag.toFixed(1)} büyüklüğünde deprem bekleniyor. Güvenli yere geçin.`;

        return {
            title,
            body,
            ttsText,
            vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
        };
    }

    private formatSOS(data: Record<string, any>, category: NotificationCategory) {
        // CRITICAL FIX: data.from is a reserved FCM key and gets stripped by sanitizePushDataPayload.
        // CF sends fromName as backup. Must include it in fallback chain.
        const from = data.senderName || data.fromName || data.from || data.userName || 'Bilinmeyen';
        const message = data.message || 'Acil yardım çağrısı alındı.';
        const lat = data.location?.latitude ?? data.latitude;
        const lng = data.location?.longitude ?? data.longitude;
        const locationText = (lat && lng) ? '\n\u{1F4CD} Konum bilgisi mevcut \u{2014} bildirimi açarak konuma gidin.' : '';

        const isReceived = category === 'sos_received';
        const title = isReceived ? `\u{1F198} AC\u{0130}L DURUM: ${from}` : `\u{1F198} SOS G\u{00D6}NDER\u{0130}LD\u{0130}`;
        const body = `${message}${locationText}\nKonumu görmek ve yardıma gitmek için dokunun.`;
        const ttsText = `Acil durum çağrısı! ${from} yardım istiyor.`;

        return {
            title,
            body,
            ttsText,
            vibrationPattern: [0, 1000, 500, 1000],
        };
    }

    private formatRescue(data: Record<string, any>) {
        const name = data.userName || 'Bilinmeyen kişi';
        const distance = data.distance ? ` (${data.distance.toFixed(0)}m)` : '';
        const status = data.status === 'trapped' ? 'enkaz altında' : data.status === 'injured' ? 'yaralı' : '';

        return {
            title: `🆘 Kurtarma Sinyali${distance}`,
            body: `${name} ${status ? status + ' — ' : ''}yardım bekliyor`,
            ttsText: `Kurtarma sinyali alındı. ${name} yardım bekliyor.`,
            vibrationPattern: [0, 500, 300, 500],
        };
    }

    private formatFamily(data: Record<string, any>) {
        const name = data.memberName || 'Aile üyesi';
        const isSOS = data.isSOS === true;

        if (isSOS) {
            return {
                title: `🆘 ${name} ACİL DURUM!`,
                body: 'Aile üyeniz acil durum bildirdi. Konumunu görmek için dokunun.',
                ttsText: `${name} acil durum bildirdi!`,
                vibrationPattern: [0, 1000, 500, 1000],
            };
        }

        const status = data.status || 'konum güncelledi';
        return {
            title: `👨‍👩‍👧‍👦 ${name}`,
            body: `${name} ${status}`,
        };
    }

    private formatMessage(data: Record<string, any>) {
        // CRITICAL FIX: data.from is a reserved FCM key and gets stripped by sanitizePushDataPayload.
        // For local notifications, data.senderName is always set. Prioritize senderName first.
        const from = data.senderName || data.fromName || data.from || 'Bilinmeyen';
        const message = data.message || '';
        const isSOS = data.isSOS === true;
        const showPreview = data.showPreview !== false;

        const title = isSOS ? `🆘 ${from}` : `💬 ${from}`;
        const body = showPreview
            ? (message.length > 140 ? message.substring(0, 137) + '...' : message)
            : (isSOS ? 'Acil mesajı açmak için dokunun.' : 'Yeni mesajı açmak için dokunun.');

        return {
            title,
            body,
            ttsText: showPreview ? `${from} kişisinden yeni mesaj: ${body}` : `${from} kişisinden yeni mesaj var.`,
        };
    }

    private formatNews(data: Record<string, any>) {
        const title = data.title || 'Yeni haber';
        const summary = data.summary || '';
        const safeTitle = title.length > 90 ? title.substring(0, 87) + '...' : title;
        const safeSummary = data.showPreview !== false
            ? (summary.length > 120 ? summary.substring(0, 117) + '...' : summary)
            : 'Yeni haber detayları için dokunun.';

        return {
            title: `📰 ${safeTitle}`,
            body: safeSummary,
        };
    }

    private formatSystem(data: Record<string, any>) {
        switch (data.subtype) {
            case 'network':
                return {
                    title: data.isConnected ? '🌐 Bağlantı Kuruldu' : '📡 Bağlantı Kesildi',
                    body: data.isConnected ? 'İnternet bağlantısı yeniden kuruldu.' : 'İnternet bağlantısı kesildi. Çevrimdışı mod aktif.',
                };
            case 'battery':
                return {
                    title: `🔋 Düşük Pil: %${data.batteryLevel || 0}`,
                    body: 'Pil seviyesi düşük. Acil durum özelliklerini korumak için şarj edin.',
                };
            case 'checkin':
                return {
                    title: '✅ Otomatik Check-in',
                    body: data.message || 'Güvenli durumunuz aile üyelerinize bildirildi.',
                };
            default:
                return {
                    title: data.title || 'AfetNet',
                    body: data.message || '',
                };
        }
    }

    private formatDrill(data: Record<string, any>) {
        return {
            title: `🏋️ ${data.title || 'Tatbikat Modu'}`,
            body: data.message || 'Deprem tatbikatı başlatıldı. Bu bir test bildirimidir.',
            vibrationPattern: [0, 300, 100, 300],
        };
    }

    // ===========================================================================
    // DELIVERY ENGINE
    // ===========================================================================

    private async deliver(
        category: NotificationCategory,
        formatted: { title: string; body: string; ttsText?: string; vibrationPattern?: number[] },
        decision: AIDecision,
        settings: any,
        originalData?: Record<string, any>,
    ): Promise<string | null> {
        const deliveryPromises: Promise<any>[] = [];

        // === PUSH NOTIFICATION (always, unless push disabled) ===
        if (settings.notificationPush !== false) {
            const channelType = this.mapCategoryToChannel(category);
            const pushPriority = decision.priority === 'critical' ? 'max' as const
                : decision.priority === 'high' ? 'high' as const
                    : 'default' as const;

            // Build contextual data for tap navigation
            // CRITICAL FIX: Spread originalData FIRST, then set type/priority AFTER
            // to prevent originalData.type from overriding the category
            const tapData: Record<string, any> = {
                ...(originalData || {}),
                type: category,
                priority: decision.priority,
            };

            deliveryPromises.push(
                scheduleNotification(
                    {
                        title: formatted.title,
                        body: formatted.body,
                        sound: decision.priority === 'low' ? false : 'default',
                        priority: pushPriority,
                        data: tapData,
                        categoryIdentifier: category,
                    },
                    { channelType },
                ).catch(e => {
                    logger.debug('Push delivery failed:', e);
                    return null;
                }),
            );
        }

        // === MULTI-CHANNEL (sound/vibration/TTS for critical/high) ===
        if (decision.priority === 'critical' || decision.priority === 'high') {
            deliveryPromises.push(
                this.deliverMultiChannel(category, formatted, decision, settings).catch(e => {
                    logger.debug('Multi-channel delivery failed:', e);
                }),
            );
        }

        // === HAPTIC FEEDBACK ===
        this.deliverHaptic(decision.priority, category);

        // === EMERGENCY MODE (earthquake M5+) ===
        // NOTE: Skip for 'eew' category — the foreground notification listener already handles
        // EEW emergency mode activation (along with countdown engine + history logging).
        // Triggering here too would cause double emergency mode activation for the same event.
        if (category === 'earthquake') {
            const mag = originalData?.magnitude || (decision as any).magnitude || 0;
            if (mag >= 5.0 || decision.priority === 'critical') {
                this.triggerEmergencyMode(category, formatted, decision, originalData).catch(e => {
                    logger.debug('Emergency mode trigger failed:', e);
                });
            }
        }

        const results = await Promise.all(deliveryPromises);
        return typeof results[0] === 'string' ? results[0] : null;
    }

    private mapCategoryToChannel(category: NotificationCategory): 'earthquake' | 'eew' | 'sos' | 'family' | 'message' | 'news' | 'general' {
        switch (category) {
            case 'earthquake': return 'earthquake';
            case 'eew': return 'eew';
            case 'sos':
            case 'sos_received':
            case 'family_sos':
            case 'rescue': return 'sos';
            case 'family': return 'family';
            case 'message': return 'message';
            case 'news': return 'news';
            default: return 'general';
        }
    }

    private async deliverMultiChannel(
        category: NotificationCategory,
        formatted: { title: string; body: string; ttsText?: string; vibrationPattern?: number[] },
        decision: AIDecision,
        settings: any,
    ): Promise<void> {
        try {
            const { multiChannelAlertService } = await import('../MultiChannelAlertService');
            await multiChannelAlertService.sendAlert({
                title: formatted.title,
                body: formatted.body,
                priority: decision.priority === 'critical' ? 'critical' : 'high',
                sound: 'default',
                soundVolume: settings.notificationSoundVolume || 80,
                soundRepeat: settings.notificationSoundRepeat || 3,
                vibrationPattern: formatted.vibrationPattern,
                ttsText: formatted.ttsText,
                channels: {
                    pushNotification: false, // NEVER — push is handled above
                    fullScreenAlert: decision.priority === 'critical',
                    alarmSound: settings.notificationMode !== 'vibrate',
                    vibration: settings.notificationMode !== 'sound',
                    tts: !!formatted.ttsText,
                    led: Platform.OS === 'android',
                    bluetooth: false,
                },
                data: { type: category },
            });
        } catch (e) {
            logger.debug('MultiChannel alert failed:', e);
        }
    }

    private deliverHaptic(priority: NotificationPriority, category: NotificationCategory): void {
        try {
            if (priority === 'critical') {
                haptics.impactHeavy();
                haptics.impactHeavy();
                haptics.impactHeavy();
            } else if (priority === 'high') {
                haptics.impactMedium();
                haptics.impactMedium();
            } else if (category !== 'system') {
                haptics.impactLight();
            }
        } catch { /* non-critical */ }
    }

    private async triggerEmergencyMode(
        category: NotificationCategory,
        formatted: { title: string; body: string },
        decision: AIDecision,
        originalData?: Record<string, any>,
    ): Promise<void> {
        try {
            const { emergencyModeService } = await import('../EmergencyModeService');
            const earthquake = {
                id: `eq_${Date.now()}`,
                magnitude: originalData?.magnitude || 0,
                location: originalData?.location || '',
                latitude: originalData?.latitude || 0,
                longitude: originalData?.longitude || 0,
                depth: originalData?.depth || 10,
                time: originalData?.timestamp || Date.now(),
                source: (originalData?.source as 'AFAD' | 'KOERI' | 'USGS' | 'EMSC') || 'AFAD' as const,
            };

            if (emergencyModeService.shouldTriggerEmergencyMode(earthquake)) {
                await emergencyModeService.activateEmergencyMode(earthquake);
            }
        } catch (e) {
            logger.debug('Emergency mode failed:', e);
        }
    }

    // ===========================================================================
    // SETTINGS
    // ===========================================================================

    private async getSettings(): Promise<any> {
        const now = Date.now();
        if (this.settingsCache && now - this.settingsCacheTime < this.SETTINGS_CACHE_TTL) {
            return this.settingsCache;
        }

        try {
            const { useSettingsStore } = await import('../../stores/settingsStore');
            const s = useSettingsStore.getState();
            this.settingsCache = {
                notificationsEnabled: s.notificationsEnabled as boolean,
                notificationPush: s.notificationPush as boolean,
                notificationMode: s.notificationMode as string,
                notificationSoundVolume: (s.notificationSoundVolume as number) || 80,
                notificationSoundRepeat: (s.notificationSoundRepeat as number) || 3,
            };
            this.settingsCacheTime = now;
            return this.settingsCache;
        } catch {
            return {
                notificationsEnabled: true,
                notificationPush: true,
                notificationMode: 'sound+vibrate',
                notificationSoundVolume: 80,
                notificationSoundRepeat: 3,
            };
        }
    }

    // ===========================================================================
    // UTILITIES
    // ===========================================================================

    /** Cancel all pending and delivered notifications */
    async cancelAll(): Promise<void> {
        try {
            await cancelAllNotifications();
            const Notifications = await getNotificationsAsync();
            if (Notifications) {
                if (typeof Notifications.dismissAllNotificationsAsync === 'function') {
                    await Notifications.dismissAllNotificationsAsync();
                }
                if (typeof Notifications.setBadgeCountAsync === 'function') {
                    await Notifications.setBadgeCountAsync(0);
                }
            }
        } catch (e) {
            logger.debug('cancelAll failed:', e);
        }
    }

    /** Get push token */
    async getPushToken(): Promise<string | null> {
        return getExpoPushToken();
    }

    /** Get AI statistics for debugging */
    getStats() {
        return getAIStats();
    }

    /**
     * Handle notification tap — COMPREHENSIVE DEEP NAVIGATION
     * Routes user to the most relevant screen with contextual data.
     * Handles both live taps and cold-start taps.
     * 
     * Covers ALL notification types:
     * - Local: earthquake, eew, sos, message, news, family, system, drill, rescue
     * - Cloud Function push: new_message, family_status_update, sos_family, sos_proximity, nearby_sos, family_location
     */
    async handleNotificationTap(notification: any): Promise<void> {
        try {
            // PRODUCTION LOGGING: Log raw notification structure for delivery debugging
            const notifTitle = notification?.notification?.request?.content?.title
                || notification?.request?.content?.title
                || '';
            logger.info(`📱 handleNotificationTap: title="${notifTitle}"`);

            // Extract data from Expo notification response structure
            const rawData = notification?.notification?.request?.content?.data
                || notification?.request?.content?.data
                || notification?.data
                || {};
            const parseObjectLike = (value: unknown): Record<string, unknown> | null => {
                if (value && typeof value === 'object') {
                    return value as Record<string, unknown>;
                }
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                        try {
                            const parsed = JSON.parse(trimmed);
                            if (parsed && typeof parsed === 'object') {
                                return parsed as Record<string, unknown>;
                            }
                        } catch {
                            return null;
                        }
                    }
                }
                return null;
            };
            const baseData = parseObjectLike(rawData) || {};
            const nestedData =
                parseObjectLike(baseData.data)
                || parseObjectLike(baseData.payload)
                || parseObjectLike(baseData.notificationData)
                || parseObjectLike(baseData.notification)
                || parseObjectLike(baseData.body);
            const data = nestedData ? { ...baseData, ...nestedData } : baseData;

            // PRODUCTION LOGGING: Log parsed data for debugging notification routing
            const dataKeys = Object.keys(data);
            logger.info(`📱 handleNotificationTap: parsed data keys=[${dataKeys.join(',')}], type="${data.type}", signalId="${data.signalId || ''}", conversationId="${data.conversationId || ''}", senderUid="${data.senderUid || ''}", senderName="${data.senderName || ''}"`);

            const toNonEmptyString = (value: unknown): string | undefined => {
                if (typeof value !== 'string') return undefined;
                const trimmed = value.trim();
                return trimmed.length > 0 ? trimmed : undefined;
            };
            const rawType =
                toNonEmptyString(data.type)
                || toNonEmptyString(data.eventType)
                || toNonEmptyString(data.notificationType)
                || '';
            const type = rawType.toLowerCase();

            logger.info(`📱 handleNotificationTap: resolved type="${type}" (raw="${rawType}")`);

            const toFiniteNumber = (value: unknown): number | null => {
                if (typeof value === 'number' && Number.isFinite(value)) return value;
                if (typeof value === 'string' && value.trim().length > 0) {
                    const parsed = Number(value);
                    if (Number.isFinite(parsed)) return parsed;
                }
                return null;
            };

            const locationPayload = parseObjectLike(data.location) || {};

            if (!type) {
                // ELITE FIX: Infer type from available fields before falling back to Home.
                // Push notifications from Cloud Functions may lose the `type` field on some iOS versions.
                // CRITICAL: Check message fields FIRST — they are far more common than SOS.
                const hasMessageFields = data.conversationId || data.messageId;
                const hasSenderFields = data.senderUid || data.userId || data.senderId;
                const hasSosFields = data.signalId || data.senderDeviceId || data.trapped !== undefined;
                const titleHintsSos = (notification?.notification?.request?.content?.title || '').includes('SOS')
                    || (notification?.notification?.request?.content?.title || '').includes('ENKAZ')
                    || (notification?.notification?.request?.content?.title || '').includes('ACİL');

                if (hasSosFields || titleHintsSos) {
                    logger.info('Notification tap: no type but SOS fields detected — treating as sos_family');
                    const { navigateTo: nav } = await getNavigationRefModule();
                    // CRITICAL FIX: healthInfo arrives as JSON string from FCM push data
                    let healthInfoRawNoType: Record<string, string> | undefined;
                    if (data.healthInfo && typeof data.healthInfo === 'object') {
                        healthInfoRawNoType = data.healthInfo as Record<string, string>;
                    } else if (typeof data.healthInfo === 'string' && data.healthInfo.trim().startsWith('{')) {
                        try {
                            const parsed = JSON.parse(data.healthInfo);
                            if (parsed && typeof parsed === 'object') {
                                healthInfoRawNoType = parsed as Record<string, string>;
                            }
                        } catch { /* malformed JSON — skip */ }
                    }
                    nav('SOSHelp', {
                        signalId: toNonEmptyString(data.signalId),
                        senderUid: toNonEmptyString(data.senderUid) || toNonEmptyString(data.userId),
                        senderDeviceId: toNonEmptyString(data.senderDeviceId),
                        // CRITICAL FIX: data.from is reserved FCM key (stripped). Use fromName fallback.
                        senderName: toNonEmptyString(data.senderName) || toNonEmptyString(data.fromName) || toNonEmptyString(data.from) || 'SOS',
                        message: toNonEmptyString(data.message),
                        latitude: toFiniteNumber(locationPayload.latitude ?? data.latitude),
                        longitude: toFiniteNumber(locationPayload.longitude ?? data.longitude),
                        trapped: data.trapped === 'true' || data.trapped === true,
                        battery: toFiniteNumber(data.battery) ?? undefined,
                        healthInfo: healthInfoRawNoType,
                    });
                    return;
                }

                // CRITICAL FIX: If conversationId/messageId present OR any sender identity is present,
                // assume it's a chat message. This covers the common iOS cold-start case where `type`
                // is stripped from the APNS payload but conversationId/senderUid are preserved.
                if (hasMessageFields || hasSenderFields) {
                    logger.info(`Notification tap: no type but message/sender fields detected — treating as new_message (conv:${data.conversationId || ''} sender:${data.senderUid || data.userId || ''})`);
                    const { navigateTo: nav } = await getNavigationRefModule();

                    let resolvedConversationId = toNonEmptyString(data.conversationId);
                    const messageId = toNonEmptyString(data.messageId);
                    if (!resolvedConversationId && messageId) {
                        try {
                            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
                            const { collectionGroup, query, where, limit, getDocs, documentId } = await import('firebase/firestore');
                            const db = await getFirestoreInstanceAsync();
                            if (db) {
                                const byFieldQuery = query(
                                    collectionGroup(db, 'messages'),
                                    where('id', '==', messageId),
                                    limit(1),
                                );
                                let snap = await getDocs(byFieldQuery);
                                if (snap.empty) {
                                    const byDocIdQuery = query(
                                        collectionGroup(db, 'messages'),
                                        where(documentId(), '==', messageId),
                                        limit(1),
                                    );
                                    snap = await getDocs(byDocIdQuery);
                                }
                                const first = snap.docs[0];
                                if (first?.ref?.parent?.parent) {
                                    resolvedConversationId = first.ref.parent.parent.id;
                                    logger.info(`Notification tap (no-type): resolved conversationId=${resolvedConversationId} from messageId=${messageId}`);
                                }
                            }
                        } catch (resolveErr) {
                            logger.warn('Notification tap (no-type): conversationId lookup by messageId failed:', resolveErr);
                        }
                    }

                    const resolvedUserId = toNonEmptyString(data.senderUid)
                        || toNonEmptyString(data.userId)
                        || toNonEmptyString(data.senderId)
                        || toNonEmptyString(data.senderDeviceId);

                    const isGroupConversation =
                        (resolvedConversationId?.startsWith('grp_') ?? false)
                        || toNonEmptyString(data.conversationType) === 'group'
                        || toNonEmptyString(data.chatType) === 'group'
                        || data.isGroup === true
                        || data.isGroup === 'true';

                    if (resolvedConversationId && isGroupConversation) {
                        nav('FamilyGroupChat', { groupId: resolvedConversationId });
                        return;
                    }

                    if (resolvedUserId) {
                        nav('Conversation', {
                            userId: resolvedUserId,
                            userName: toNonEmptyString(data.senderName) || toNonEmptyString(data.fromName) || toNonEmptyString(data.from),
                            conversationId: resolvedConversationId,
                        });
                        return;
                    }

                    if (resolvedConversationId) {
                        try {
                            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
                            const { doc, getDoc } = await import('firebase/firestore');
                            const { identityService } = await import('../IdentityService');
                            const db = await getFirestoreInstanceAsync();
                            if (db) {
                                const convDoc = await getDoc(doc(db, 'conversations', resolvedConversationId));
                                if (convDoc.exists()) {
                                    const convData = convDoc.data();
                                    const myUid = identityService.getUid();
                                    const participants = Array.isArray(convData.participants) ? convData.participants : [];
                                    const otherUid = participants.find((p: string) => p !== myUid);
                                    if (otherUid) {
                                        nav('Conversation', {
                                            userId: otherUid,
                                            conversationId: resolvedConversationId,
                                        });
                                        return;
                                    }
                                }
                            }
                        } catch (lookupErr) {
                            logger.warn('Notification tap (no-type): participant lookup failed:', lookupErr);
                        }
                    }

                    nav('MainTabs', { screen: 'Messages' });
                    return;
                }

                logger.debug('Notification tap: no type and no recognizable fields — navigating to Messages list');
                const { navigateTo } = await getNavigationRefModule();
                // CRITICAL FIX: Navigate to Messages list (not Home) so user can find their conversations
                navigateTo('MainTabs', { screen: 'Messages' });
                return;
            }

            const { navigateTo } = await getNavigationRefModule();

            logger.info(`📱 Notification tap: ${rawType}`, data);

            switch (type) {

                // ═══ EARTHQUAKE ═══
                case 'earthquake': {
                    if (data.magnitude && data.location) {
                        navigateTo('EarthquakeDetail', {
                            earthquake: {
                                id: data.earthquakeId || data.eventId || `eq_${data.timestamp || Date.now()}`,
                                magnitude: data.magnitude,
                                location: data.location,
                                latitude: data.latitude || 0,
                                longitude: data.longitude || 0,
                                depth: data.depth || 0,
                                time: data.timestamp || Date.now(),
                                source: data.source || 'AFAD',
                            },
                        });
                    } else if (data.eventId) {
                        navigateTo('EarthquakeDetail', { id: data.eventId });
                    } else {
                        navigateTo('AllEarthquakes');
                    }
                    break;
                }

                case 'eew':
                case 'turkey_earthquake_detection':
                case 'global_early_warning': {
                    // If the push payload has earthquake details, navigate to detail
                    const eewMag = toFiniteNumber(data.magnitude);
                    const eewLoc = toNonEmptyString(data.location);
                    if (eewMag !== null && eewLoc) {
                        navigateTo('EarthquakeDetail', {
                            earthquake: {
                                id: toNonEmptyString(data.eventId) || toNonEmptyString(data.earthquakeId) || `eew_${data.timestamp || Date.now()}`,
                                magnitude: eewMag,
                                location: eewLoc,
                                latitude: toFiniteNumber(data.latitude) ?? 0,
                                longitude: toFiniteNumber(data.longitude) ?? 0,
                                depth: toFiniteNumber(data.depth) ?? 0,
                                time: toFiniteNumber(data.timestamp) ?? Date.now(),
                                source: toNonEmptyString(data.source) || 'AFAD',
                            },
                        });
                    } else {
                        // Fallback: EEW shows full-screen alert on Home
                        navigateTo('MainTabs', { screen: 'Home' });
                    }
                    break;
                }

                // ═══ SOS — All variants ═══
                case 'sos':
                case 'sos_received':
                case 'sos_alert':
                case 'sos_family':
                case 'family_sos':
                case 'sos_proximity':
                case 'nearby_sos': {
                    // Store SOS alert for map marker display (proximity alerts)
                    const pLat = toFiniteNumber(locationPayload.latitude ?? data.latitude ?? data.lat);
                    const pLng = toFiniteNumber(locationPayload.longitude ?? data.longitude ?? data.lng);

                    if (type === 'sos_proximity' || type === 'nearby_sos' || type === 'sos_family' || type === 'family_sos') {
                        try {
                            const { useSOSStore } = await import('../sos/SOSStateManager');
                            if (pLat !== null && pLng !== null) {
                                const senderDeviceId = toNonEmptyString(data.senderDeviceId) || '';
                                const senderUid =
                                    toNonEmptyString(data.senderUid)
                                    || toNonEmptyString(data.userId)
                                    || undefined;
                                const signalId = toNonEmptyString(data.signalId) || '';
                                // CRITICAL FIX: data.from is reserved FCM key (stripped). Use fromName fallback.
                                const senderName = toNonEmptyString(data.senderName)
                                    || toNonEmptyString(data.fromName)
                                    || toNonEmptyString(data.from)
                                    || 'SOS';
                                const messageText = toNonEmptyString(data.message) || 'Acil yardım gerekiyor!';
                                useSOSStore.getState().addIncomingSOSAlert({
                                    id: signalId || `push_${Date.now()}`,
                                    signalId,
                                    senderDeviceId,
                                    senderUid,
                                    senderName,
                                    latitude: pLat,
                                    longitude: pLng,
                                    timestamp: toFiniteNumber(data.timestamp) ?? Date.now(),
                                    message: messageText,
                                    trapped: data.trapped === 'true' || data.trapped === true,
                                });
                            }
                        } catch { /* non-critical */ }
                    }

                    // CRITICAL: Navigate to SOSHelp page — the dedicated rescue response screen
                    // with live location tracking, rescue ACK, and emergency actions.
                    // CRITICAL FIX: healthInfo arrives as JSON string from FCM push data
                    // (all FCM data values are strings). Parse it back to object.
                    let healthInfoRaw: Record<string, string> | undefined;
                    if (data.healthInfo && typeof data.healthInfo === 'object') {
                        healthInfoRaw = data.healthInfo as Record<string, string>;
                    } else if (typeof data.healthInfo === 'string' && data.healthInfo.trim().startsWith('{')) {
                        try {
                            const parsed = JSON.parse(data.healthInfo);
                            if (parsed && typeof parsed === 'object') {
                                healthInfoRaw = parsed as Record<string, string>;
                            }
                        } catch { /* malformed JSON — skip */ }
                    }

                    const sosParams = {
                        signalId: toNonEmptyString(data.signalId),
                        senderUid: toNonEmptyString(data.senderUid) || toNonEmptyString(data.userId),
                        senderDeviceId: toNonEmptyString(data.senderDeviceId),
                        // CRITICAL FIX: data.from is reserved FCM key (stripped). Use fromName fallback.
                        senderName: toNonEmptyString(data.senderName) || toNonEmptyString(data.fromName) || toNonEmptyString(data.from) || 'SOS',
                        latitude: pLat ?? undefined,
                        longitude: pLng ?? undefined,
                        message: toNonEmptyString(data.message),
                        trapped: data.trapped === 'true' || data.trapped === true,
                        battery: toFiniteNumber(data.battery) ?? undefined,
                        healthInfo: healthInfoRaw,
                    };
                    logger.info(`🚨 SOS notification tap → navigating to SOSHelp`, {
                        signalId: sosParams.signalId,
                        senderName: sosParams.senderName,
                        senderUid: sosParams.senderUid,
                        lat: sosParams.latitude,
                        lng: sosParams.longitude,
                    });
                    navigateTo('SOSHelp', sosParams);
                    break;
                }

                case 'rescue':
                    navigateTo('DisasterMap');
                    break;

                // ═══ SOS MESSAGE — Chat within SOS conversation ═══
                // CRITICAL FIX: sos_message is a chat message within an SOS conversation.
                // It must navigate to SOSConversation (dedicated SOS chat screen with
                // location tracking + rescue actions), NOT the regular Conversation screen.
                // Previously fell through to the generic message handler, losing the SOS context.
                case 'sos_message': {
                    const sosMsgSenderUid = toNonEmptyString(data.senderUid)
                        || toNonEmptyString(data.userId)
                        || toNonEmptyString(data.senderId);
                    const sosMsgSenderName = toNonEmptyString(data.senderName)
                        || toNonEmptyString(data.fromName)
                        || toNonEmptyString(data.from)
                        || 'SOS';
                    const sosMsgConversationId = toNonEmptyString(data.conversationId);

                    if (sosMsgSenderUid) {
                        navigateTo('SOSConversation', {
                            sosUserId: sosMsgSenderUid,
                            sosUserName: sosMsgSenderName,
                            sosSenderUid: sosMsgSenderUid,
                            sosMessage: toNonEmptyString(data.message),
                        });
                    } else if (sosMsgConversationId) {
                        // Fallback: try to resolve sender from conversation doc
                        try {
                            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
                            const { doc, getDoc } = await import('firebase/firestore');
                            const { identityService } = await import('../IdentityService');
                            const db = await getFirestoreInstanceAsync();
                            if (db) {
                                const convDoc = await getDoc(doc(db, 'conversations', sosMsgConversationId));
                                if (convDoc.exists()) {
                                    const convData = convDoc.data();
                                    const myUid = identityService.getUid();
                                    const participants = Array.isArray(convData.participants) ? convData.participants : [];
                                    const otherUid = participants.find((p: string) => p !== myUid);
                                    if (otherUid) {
                                        navigateTo('SOSConversation', {
                                            sosUserId: otherUid,
                                            sosUserName: sosMsgSenderName,
                                            sosSenderUid: otherUid,
                                        });
                                        break;
                                    }
                                }
                            }
                        } catch (e) {
                            logger.warn('sos_message tap: conversation lookup failed:', e);
                        }
                        // Ultimate fallback: Messages list
                        navigateTo('MainTabs', { screen: 'Messages' });
                    } else {
                        navigateTo('MainTabs', { screen: 'Messages' });
                    }
                    break;
                }

                // ═══ MESSAGES — Local + Cloud Function push ═══
                case 'message':
                case 'new_message':
                case 'message_received': {
                    let conversationId = toNonEmptyString(data.conversationId);
                    const messageId = toNonEmptyString(data.messageId);

                    // CRITICAL FIX: If convId is missing but messageId is present, resolve from Firestore before navigation.
                    if (!conversationId && messageId) {
                        try {
                            const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
                            const { collectionGroup, query, where, limit, getDocs, documentId } = await import('firebase/firestore');
                            const db = await getFirestoreInstanceAsync();
                            if (db) {
                                const byFieldQuery = query(
                                    collectionGroup(db, 'messages'),
                                    where('id', '==', messageId),
                                    limit(1),
                                );
                                let snap = await getDocs(byFieldQuery);
                                if (snap.empty) {
                                    const byDocIdQuery = query(
                                        collectionGroup(db, 'messages'),
                                        where(documentId(), '==', messageId),
                                        limit(1),
                                    );
                                    snap = await getDocs(byDocIdQuery);
                                }
                                const first = snap.docs[0];
                                if (first?.ref?.parent?.parent) {
                                    conversationId = first.ref.parent.parent.id;
                                    logger.info(`Notification tap: resolved conversationId=${conversationId} from messageId=${messageId}`);
                                }
                            }
                        } catch (resolveErr) {
                            logger.warn('Notification tap: conversationId lookup by messageId failed:', resolveErr);
                        }
                    }
                    const isGroupConversation =
                        (conversationId?.startsWith('grp_') ?? false)
                        || toNonEmptyString(data.conversationType) === 'group'
                        || toNonEmptyString(data.chatType) === 'group'
                        || data.isGroup === true
                        || data.isGroup === 'true';

                    if (conversationId && isGroupConversation) {
                        navigateTo('FamilyGroupChat', { groupId: conversationId });
                        break;
                    }
                    const userId =
                        toNonEmptyString(data.senderUid)
                        || toNonEmptyString(data.userId)
                        || toNonEmptyString(data.senderId)
                        || toNonEmptyString(data.senderDeviceId);

                    if (userId) {
                        // CRITICAL FIX: Always pass conversationId alongside userId.
                        // ConversationScreen will use conversationId directly (no pairKey
                        // lookup needed) — prevents opening a wrong/empty conversation on
                        // cold-start or when the Firestore composite index query fails.
                        navigateTo('Conversation', {
                            userId,
                            // CRITICAL FIX: Add data.fromName to fallback chain.
                            // CF push payload sends both senderName and fromName.
                            // data.from is stripped by FCM sanitization (reserved key).
                            // Without fromName fallback, native FCM token taps may
                            // show undefined userName when senderName is missing.
                            userName: data.senderName || data.fromName || data.userName || data.from,
                            conversationId,
                        });
                    } else {
                        if (conversationId) {
                            logger.warn('Notification tap message payload has conversationId but no sender identity. Looking up from Firestore...', {
                                type,
                                conversationId,
                            });
                            try {
                                const { getFirestoreInstanceAsync } = await import('../firebase/FirebaseInstanceManager');
                                const { doc, getDoc } = await import('firebase/firestore');
                                const { identityService } = await import('../IdentityService');
                                const db = await getFirestoreInstanceAsync();
                                if (db) {
                                    const convDoc = await getDoc(doc(db, 'conversations', conversationId));
                                    if (convDoc.exists()) {
                                        const convData = convDoc.data();
                                        const myUid = identityService.getUid();
                                        const participants = convData.participants || [];
                                        const otherUid = participants.find((p: string) => p !== myUid);
                                        if (otherUid) {
                                            logger.info(`Resolved notification missing senderUid to the correct participant: ${otherUid}`);
                                            navigateTo('Conversation', {
                                                userId: otherUid,
                                                conversationId: conversationId,
                                            });
                                            break;
                                        }
                                    }
                                }
                            } catch (e) {
                                logger.error('Failed to lookup conversation participants for notification tap:', e);
                            }

                            // CRITICAL FIX: If Firestore lookup fails, navigate to Conversation
                            // with conversationId directly. ConversationScreen can resolve the
                            // other participant from the conversation document. Routing to Messages
                            // list is a worse UX — user tapped a specific conversation notification.
                            logger.warn('Firestore lookup failed — navigating to Conversation with conversationId only');
                            navigateTo('Conversation', {
                                conversationId,
                                userName: data.senderName || data.fromName || data.userName,
                            });
                            break;
                        }
                        navigateTo('MainTabs', { screen: 'Messages' });
                    }
                    break;
                }

                // ═══ VOICE CALL — Navigate to call screen ═══
                case 'voice_call': {
                    const callerUid = toNonEmptyString(data.callerUid);
                    const callerName = data.callerName || 'Bilinmeyen';
                    const tapCallId = toNonEmptyString(data.callId);
                    if (callerUid && tapCallId) {
                        // CRITICAL FIX: On cold start, DeviceEventEmitter.emit('VOICE_CALL_INCOMING')
                        // fires before IncomingCallOverlay is mounted, so the event is permanently lost.
                        // Navigate to VoiceCall screen directly (which IS in MAIN_ONLY_SCREENS),
                        // and ALSO emit the event for the case where the overlay IS mounted (warm start).
                        navigateTo('VoiceCall', {
                            callId: tapCallId,
                            callerUid,
                            callerName,
                            isIncoming: true,
                        });
                        DeviceEventEmitter.emit('VOICE_CALL_INCOMING', {
                            callId: tapCallId,
                            callerUid,
                            callerName,
                        });
                    } else {
                        // FIX: Fallback when callId or callerUid is missing from push payload.
                        // Without this, tapping a voice call notification with incomplete data
                        // does nothing — the user sees the notification, taps, and nothing happens.
                        logger.warn('voice_call tap: missing callId or callerUid, navigating to Home');
                        navigateTo('MainTabs', { screen: 'Home' });
                    }
                    break;
                }

                // ═══ FAMILY — Status + Location ═══
                case 'family':
                case 'family_status_update':
                case 'family_location_update':
                case 'family_location': {
                    // If location data present, navigate to map focused on family member
                    const memberLat = toFiniteNumber(locationPayload.latitude ?? data.latitude ?? data.lat);
                    const memberLng = toFiniteNumber(locationPayload.longitude ?? data.longitude ?? data.lng);
                    if ((type === 'family_location' || type === 'family_location_update' || type === 'family_status_update') && memberLat !== null && memberLng !== null) {
                        navigateTo('DisasterMap', {
                            focusOnFamily: true,
                            familyLatitude: memberLat,
                            familyLongitude: memberLng,
                            // CRITICAL FIX: data.from is reserved FCM key (stripped). Use fromName fallback.
                        familyMemberName: data.memberName || data.senderName || data.fromName || data.from,
                        });
                    } else {
                        navigateTo('MainTabs', { screen: 'Family' });
                    }
                    break;
                }

                // ═══ NEWS ═══
                case 'news': {
                    if (data.url || data.newsUrl || data.articleId) {
                        navigateTo('NewsDetail', {
                            article: {
                                title: data.title || data.newsTitle || '',
                                url: data.url || data.newsUrl,
                                source: data.source,
                                imageUrl: data.imageUrl,
                                id: data.articleId,
                            },
                        });
                    } else {
                        navigateTo('AllNews');
                    }
                    break;
                }

                // ═══ SYSTEM ═══
                case 'system':
                case 'battery':
                case 'network':
                case 'critical':
                    navigateTo('MainTabs', { screen: 'Home' });
                    break;

                case 'drill':
                    navigateTo('DrillMode');
                    break;

                // ═══ CONTACT REQUEST ═══
                case 'contact_request':
                    navigateTo('MainTabs', { screen: 'Family' });
                    break;

                default:
                    logger.debug(`Unknown notification type: ${type}`);
                    navigateTo('MainTabs', { screen: 'Home' });
                    break;
            }
        } catch (e) {
            logger.error('handleNotificationTap failed:', e);
        }
    }

    // ===========================================================================
    // DESTROY — Clean up listeners on app shutdown
    // ===========================================================================

    destroy(): void {
        if (this.foregroundListenerCleanup) {
            this.foregroundListenerCleanup();
            this.foregroundListenerCleanup = null;
        }
        if (this.responseListenerCleanup) {
            this.responseListenerCleanup();
            this.responseListenerCleanup = null;
        }
        // Cancel pending cold-start retry timers to prevent stale tap handlers
        for (const t of this.coldStartTimers) clearTimeout(t);
        this.coldStartTimers = [];
        // Cancel processedTapIds cleanup timers to prevent leaks after logout
        for (const t of this.tapDedupTimers) clearTimeout(t);
        this.tapDedupTimers = [];
        // Reset stale conversation ID to prevent notification suppression after account switch
        this.currentlyViewingConversationId = null;
        this.isInitialized = false;
        this.settingsCache = null;
        this.settingsCacheTime = 0;
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const notificationCenter = new NotificationCenter();

// ============================================================================
// BACKWARD COMPATIBILITY — Convenience wrapper functions
// These match the old NotificationService API so services can migrate gradually.
// They all route through the single gateway.
// ============================================================================

export function shouldDeliverNotification(
    magnitude: number,
    location: string,
    timestamp?: number,
    source?: string,
): boolean {
    const payload: NotificationPayload = {
        category: 'earthquake',
        data: { magnitude, location, timestamp },
        source,
        eventTimestamp: timestamp,
    };
    const decision = evaluateNotification(payload);
    return decision.deliver;
}

export { getNotificationsAsync } from './NotificationModuleLoader';
export type { NotificationCategory, NotificationPriority, NotificationPayload };
