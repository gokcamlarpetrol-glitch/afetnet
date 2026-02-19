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
import { requestPermissions, getExpoPushToken } from './NotificationPermissionHandler';
import { getNotificationsAsync } from './NotificationModuleLoader';
import * as haptics from '../../utils/haptics';

const logger = createLogger('NotificationCenter');

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
    timeAdvance?: number;
    earthquakeId?: string;
}

/** Data payload for SOS notifications */
export interface SOSNotifyData {
    senderId?: string;
    senderName?: string;
    from?: string;
    userId?: string;
    message?: string;
    location?: { latitude: number; longitude: number };
    signalId?: string;
    timestamp?: number;
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
    private settingsCacheTime = 0;
    private readonly SETTINGS_CACHE_TTL = 5000; // 5s cache

    // ===========================================================================
    // INITIALIZATION
    // ===========================================================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Request permissions
            await requestPermissions();

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

                            // DUPLICATE-NOTIFICATION FIX: Suppress OS banner for ALL message
                            // notifications in foreground. The foreground listener below shows
                            // an in-app Alert.alert instead — showing BOTH the OS banner AND
                            // the Alert.alert was causing double notifications while app is open.
                            if (notifType === 'message' || notifType === 'new_message' || notifType === 'message_received' || notifType === 'sos_message') {
                                return {
                                    shouldShowAlert: false,
                                    shouldPlaySound: true,
                                    shouldSetBadge: true,
                                    shouldShowBanner: false,
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
                            const isSOS = fgType === 'sos' || fgType === 'sos_received' || fgType === 'sos_alert'
                                || fgType === 'sos_family' || fgType === 'family_sos'
                                || fgType === 'sos_proximity' || fgType === 'nearby_sos';

                            if (isSOS) {
                                const senderName = fgData?.senderName || fgData?.from || 'Aile Uyesi';
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
                                        }).catch(() => {});
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
                                        }).catch(() => {});

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
                                        }).catch(() => {});
                                    }
                                } catch {
                                    // Non-critical — push is still displayed by OS
                                }
                            }

                            // === IN-APP MESSAGE NOTIFICATION BANNER ===
                            const isMessage = fgType === 'message' || fgType === 'new_message' || fgType === 'message_received' || fgType === 'sos_message';
                            if (isMessage) {
                                const msgSenderName = fgData?.senderName || fgData?.from || 'Yeni Mesaj';
                                const msgPreview = fgData?.message || 'Yeni mesaj geldi';
                                const msgConversationId = fgData?.conversationId;
                                const msgSenderId = fgData?.senderUid || fgData?.userId || fgData?.senderId;

                                // Suppress in-app alert if user is already viewing this conversation
                                try {
                                    const { getCurrentRouteName } = require('../../navigation/navigationRef');
                                    const currentRoute = getCurrentRouteName();
                                    if (currentRoute === 'Conversation' && msgSenderId) {
                                        // User is already on a conversation screen — skip disruptive alert
                                        // OS banner still shows in notification tray for later
                                        logger.debug(`Suppressing in-app alert: already on Conversation screen`);
                                        return;
                                    }
                                    if (currentRoute === 'FamilyGroupChat' && msgConversationId) {
                                        logger.debug(`Suppressing in-app alert: already on FamilyGroupChat screen`);
                                        return;
                                    }
                                } catch { /* navigation not ready — show alert */ }

                                // Light haptic for message
                                haptics.impactLight();

                                Alert.alert(
                                    `\u{1F4AC} ${msgSenderName}`,
                                    msgPreview.length > 100 ? msgPreview.substring(0, 97) + '...' : msgPreview,
                                    [
                                        {
                                            text: 'Mesaja Git',
                                            onPress: () => {
                                                import('../../navigation/navigationRef').then(({ navigateTo }) => {
                                                    if (msgConversationId?.startsWith('grp_') || fgData?.isGroup === true || fgData?.isGroup === 'true') {
                                                        navigateTo('FamilyGroupChat', { groupId: msgConversationId });
                                                    } else if (msgSenderId) {
                                                        navigateTo('Conversation', {
                                                            userId: msgSenderId,
                                                            userName: msgSenderName,
                                                            conversationId: msgConversationId,
                                                        });
                                                    } else {
                                                        navigateTo('MainTabs', { screen: 'Messages' });
                                                    }
                                                }).catch(() => {});
                                            },
                                        },
                                        { text: 'Tamam', style: 'cancel' },
                                    ],
                                    { cancelable: true },
                                );
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
                if (notifId) setTimeout(() => processedTapIds.delete(notifId), 60_000);
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
                        const MAX_COLD_START_ATTEMPTS = 5; // 5 attempts × 500ms = 2.5s total window
                        const checkColdStartTap = async (attempt: number) => {
                            try {
                                const response = await Notifications.getLastNotificationResponseAsync();
                                if (response) {
                                    logger.info(`📱 Cold-start notification tap detected (attempt ${attempt + 1}/${MAX_COLD_START_ATTEMPTS})`);
                                    dedupAndHandle(response);
                                } else if (attempt < MAX_COLD_START_ATTEMPTS - 1) {
                                    // Retry after a short delay — iOS may not have the response ready yet
                                    setTimeout(() => checkColdStartTap(attempt + 1), 500);
                                } else {
                                    logger.debug(`Cold-start tap check: no response after ${MAX_COLD_START_ATTEMPTS} attempts`);
                                }
                            } catch {
                                if (attempt < MAX_COLD_START_ATTEMPTS - 1) {
                                    setTimeout(() => checkColdStartTap(attempt + 1), 500);
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
        const from = data.senderName || data.from || data.userName || 'Bilinmeyen';
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
        const from = data.from || data.senderName || 'Bilinmeyen';
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
        if (category === 'earthquake' || category === 'eew') {
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
            case 'sos_received': return 'sos';
            case 'family': return 'family';
            case 'message': return 'message';
            case 'news': return 'news';
            case 'rescue': return 'sos';
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
                // ELITE FIX: Infer type from SOS-specific fields before falling back to Home.
                // Push notifications from Cloud Functions may lose the `type` field on some iOS versions.
                const hasSosFields = data.signalId || data.senderDeviceId || data.trapped !== undefined;
                const titleHintsSos = (notification?.notification?.request?.content?.title || '').includes('SOS')
                    || (notification?.notification?.request?.content?.title || '').includes('ENKAZ')
                    || (notification?.notification?.request?.content?.title || '').includes('ACİL');
                const hasMessageFields = data.conversationId || data.messageId;

                if (hasSosFields || titleHintsSos) {
                    logger.info('Notification tap: no type but SOS fields detected — treating as sos_family');
                    // Fall through to the SOS case by assigning type
                    const { navigateTo: nav } = await import('../../navigation/navigationRef');
                    const healthInfoRaw = data.healthInfo && typeof data.healthInfo === 'object'
                        ? data.healthInfo as Record<string, string>
                        : undefined;
                    nav('SOSHelp', {
                        signalId: toNonEmptyString(data.signalId),
                        senderUid: toNonEmptyString(data.senderUid) || toNonEmptyString(data.userId),
                        senderDeviceId: toNonEmptyString(data.senderDeviceId),
                        senderName: toNonEmptyString(data.senderName) || toNonEmptyString(data.from) || 'SOS',
                        message: toNonEmptyString(data.message),
                        latitude: toFiniteNumber(locationPayload.latitude ?? data.latitude),
                        longitude: toFiniteNumber(locationPayload.longitude ?? data.longitude),
                        trapped: data.trapped === 'true' || data.trapped === true,
                        healthInfo: healthInfoRaw,
                    });
                    return;
                }

                if (hasMessageFields) {
                    logger.info('Notification tap: no type but message fields detected — treating as new_message');
                    const { navigateTo: nav } = await import('../../navigation/navigationRef');
                    nav('Conversation', {
                        userId: toNonEmptyString(data.senderUid) || toNonEmptyString(data.senderId),
                        userName: toNonEmptyString(data.senderName) || toNonEmptyString(data.from),
                        conversationId: toNonEmptyString(data.conversationId),
                    });
                    return;
                }

                logger.debug('Notification tap: no type and no recognizable fields — navigating to Home');
                const { navigateTo } = await import('../../navigation/navigationRef');
                navigateTo('MainTabs', { screen: 'Home' });
                return;
            }

            const { navigateTo } = await import('../../navigation/navigationRef');

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
                                const senderName = toNonEmptyString(data.senderName)
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
                    const healthInfoRaw = data.healthInfo && typeof data.healthInfo === 'object'
                        ? data.healthInfo as Record<string, string>
                        : undefined;

                    const sosParams = {
                        signalId: toNonEmptyString(data.signalId),
                        senderUid: toNonEmptyString(data.senderUid) || toNonEmptyString(data.userId),
                        senderDeviceId: toNonEmptyString(data.senderDeviceId),
                        senderName: toNonEmptyString(data.senderName) || toNonEmptyString(data.from) || 'SOS',
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

                // ═══ MESSAGES — Local + Cloud Function push ═══
                case 'message':
                case 'new_message':
                case 'message_received':
                case 'sos_message': {
                    const conversationId = toNonEmptyString(data.conversationId);
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
                            userName: data.senderName || data.userName || data.from,
                            conversationId: toNonEmptyString(data.conversationId),
                        });
                    } else {
                        if (conversationId) {
                            logger.warn('Notification tap message payload has conversationId but no sender identity', {
                                type,
                                conversationId,
                            });
                            navigateTo('Conversation', { userId: conversationId });
                            break;
                        }
                        navigateTo('MainTabs', { screen: 'Messages' });
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
                            familyMemberName: data.memberName || data.senderName || data.from,
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
