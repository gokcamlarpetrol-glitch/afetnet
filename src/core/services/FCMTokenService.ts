/**
 * FCM TOKEN SERVICE - ELITE EDITION
 * 
 * Firebase Cloud Messaging token yönetimi
 * 
 * FEATURES:
 * - Token registration with location
 * - Automatic token refresh
 * - Background message handling
 * - High-priority notification bypass
 * 
 * @version 1.0.0
 * @elite true
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { createLogger } from '../utils/logger';
// firebaseDataService import removed — direct Firestore ops used instead

const logger = createLogger('FCMTokenService');

// Lazy load expo-notifications
let Notifications: typeof import('expo-notifications') | null = null;

async function getNotifications() {
    if (!Notifications) {
        Notifications = await import('expo-notifications');
    }
    return Notifications;
}

// ============================================================
// FCM TOKEN SERVICE
// ============================================================

// FCM Topics for mass broadcast notifications (EEW, earthquake alerts, SOS broadcast).
// Subscribing native device tokens to these topics allows O(1) server-side sends
// instead of iterating all tokens (which won't scale past ~10K users).
const FCM_TOPICS = ['eew-turkey', 'sos-broadcast', 'earthquake-alerts'] as const;

class FCMTokenService {
    private token: string | null = null;
    private nativeToken: string | null = null;
    private isInitialized = false;
    private tokenRefreshListener: (() => void) | null = null;
    private tokenRegisterRetryTimer: ReturnType<typeof setTimeout> | null = null;
    private tokenRegisterRetryCount = 0;
    private readonly MAX_TOKEN_REGISTER_RETRIES = 8;
    private readonly TOKEN_REGISTER_RETRY_BASE_MS = 1500;

    // ==================== INITIALIZATION ====================

    /**
     * Initialize FCM and get token
     */
    async initialize(options: { allowPermissionPrompt?: boolean } = {}): Promise<string | null> {
        if (this.isInitialized) {
            return this.token;
        }

        logger.info('🔔 Initializing FCM Token Service...');

        try {
            // Check if physical device
            if (!Device.isDevice) {
                logger.warn('FCM not available on simulator');
                return null;
            }

            const Notif = await getNotifications();

            // Startup/auth-restore must not trigger the OS notification prompt.
            // Only explicit user actions may set allowPermissionPrompt=true.
            const { status: existingStatus } = await Notif.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted' && options.allowPermissionPrompt === true) {
                logger.info('Requesting notification permission...');
                const { status } = await Notif.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                logger.info(`Notification permission not granted (${finalStatus}) — Expo push token registration deferred`);
                return null;
            }

            // Get FCM token
            const { APP_CONFIG } = await import('../config/app');
            const tokenData = await Notif.getExpoPushTokenAsync({
                projectId: APP_CONFIG.easProjectId,
            });

            this.token = tokenData.data;
            logger.info(`✅ FCM Token: ${this.token.substring(0, 20)}...`);

            // Setup Android notification channels
            if (Platform.OS === 'android') {
                await this.setupAndroidChannels();
            }

            // Listen for token refresh
            // CRITICAL FIX: Store the subscription object and call .remove() on it in cleanup.
            // Previously `.remove` was extracted as a bare function reference, which loses
            // the subscription's `this` context and may fail silently on some RN versions.
            // FIX: Clean up any previous listener before registering a new one to prevent
            // accumulation on re-initialization (e.g., after auth changes).
            if (this.tokenRefreshListener) {
                this.tokenRefreshListener();
                this.tokenRefreshListener = null;
            }
            const tokenRefreshSubscription = Notif.addPushTokenListener((token) => {
                this.token = token.data;
                this.registerTokenWithServer();
            });
            this.tokenRefreshListener = () => tokenRefreshSubscription.remove();

            // Register with server
            await this.registerTokenWithServer();

            // Get native device push token and subscribe to FCM topics.
            // Expo Push Tokens (ExponentPushToken[xxx]) can NOT be used for FCM
            // topic subscriptions — only native FCM/APNS tokens work.
            // We retrieve the native token and send it to the server, which
            // subscribes it to broadcast topics (eew-turkey, earthquake-alerts, etc.).
            // This enables O(1) topic sends instead of iterating all tokens.
            await this.registerNativeTokenAndSubscribeTopics();

            // Setup notification handlers
            await this.setupNotificationHandlers();

            this.isInitialized = true;
            return this.token;

        } catch (error) {
            logger.error('FCM initialization failed:', error);
            return null;
        }
    }

    // ==================== ANDROID CHANNELS ====================

    /**
     * Setup Android notification channels
     */
    private async setupAndroidChannels(): Promise<void> {
        const Notif = await getNotifications();

        // Critical earthquake channel (bypasses DND)
        await Notif.setNotificationChannelAsync('earthquake-critical', {
            name: 'Kritik Deprem Uyarıları',
            description: 'Hayati önem taşıyan deprem erken uyarıları',
            importance: Notif.AndroidImportance.MAX,
            bypassDnd: true,
            enableVibrate: true,
            vibrationPattern: [0, 500, 100, 500, 100, 500],
            enableLights: true,
            lightColor: '#FF0000',
            lockscreenVisibility: Notif.AndroidNotificationVisibility.PUBLIC,
            // CRITICAL FIX: earthquake_alarm.wav dosyasi assets/sounds/ veya android/res/raw/'da YOK.
            // Android channel WAV bulamayinca sessize duser → M6+ deprem sessiz! 'default' OS alarmiyla calar.
            // ileride profesyonel alarm sesi assets'e eklenince burayi guncellenmeli.
            sound: 'default',
        });

        // Normal earthquake channel
        await Notif.setNotificationChannelAsync('earthquake-normal', {
            name: 'Deprem Bildirimleri',
            description: 'Genel deprem bildirimleri',
            importance: Notif.AndroidImportance.HIGH,
            enableVibrate: true,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
        });

        // EEW countdown channel
        await Notif.setNotificationChannelAsync('earthquake-countdown', {
            name: 'Deprem Geri Sayım',
            description: 'Deprem varış geri sayımı',
            importance: Notif.AndroidImportance.MAX,
            bypassDnd: true,
            enableVibrate: true,
            lockscreenVisibility: Notif.AndroidNotificationVisibility.PUBLIC,
        });

        // V3 channel set (aligned with NotificationChannelManager + backend resolveAndroidChannelId)
        await Notif.setNotificationChannelAsync('eew_critical', {
            name: 'Erken Uyarı (Kritik)',
            description: 'P-Dalga tespit kritik uyarıları',
            importance: Notif.AndroidImportance.MAX,
            bypassDnd: true,
            enableVibrate: true,
            vibrationPattern: [0, 1000, 500, 1000],
            lockscreenVisibility: Notif.AndroidNotificationVisibility.PUBLIC,
            sound: 'default',
        });

        await Notif.setNotificationChannelAsync('earthquake_alerts', {
            name: 'Deprem Uyarıları',
            description: 'Acil deprem uyarı bildirimleri',
            importance: Notif.AndroidImportance.MAX,
            bypassDnd: true,
            enableVibrate: true,
            vibrationPattern: [0, 500, 200, 500, 200, 500],
            sound: 'default',
        });

        await Notif.setNotificationChannelAsync('sos_alerts', {
            name: 'SOS Bildirimleri',
            description: 'Aile üyelerinden SOS bildirimleri',
            importance: Notif.AndroidImportance.MAX,
            bypassDnd: true,
            enableVibrate: true,
            vibrationPattern: [0, 500, 200, 500, 200, 500],
            enableLights: true,
            lightColor: '#FF0000',
            lockscreenVisibility: Notif.AndroidNotificationVisibility.PUBLIC,
            sound: 'default',
        });

        await Notif.setNotificationChannelAsync('family_updates', {
            name: 'Aile Güncellemeleri',
            description: 'Aile konum ve durum güncellemeleri',
            importance: Notif.AndroidImportance.HIGH,
            sound: 'default',
        });

        await Notif.setNotificationChannelAsync('calls', {
            name: 'Gelen Aramalar',
            description: 'Sesli arama bildirimleri',
            importance: Notif.AndroidImportance.MAX,
            bypassDnd: true,
            enableVibrate: true,
            vibrationPattern: [0, 500, 200, 500, 200, 500],
            lockscreenVisibility: Notif.AndroidNotificationVisibility.PUBLIC,
            sound: 'default',
        });

        await Notif.setNotificationChannelAsync('messages', {
            name: 'Mesajlar',
            description: 'Kişi ve grup mesaj bildirimleri',
            importance: Notif.AndroidImportance.HIGH,
            sound: 'default',
        });

        // CRITICAL FIX: Missing news_updates channel — CF resolveAndroidChannelId maps 'news'
        // to 'news_updates', but this channel was never created. News notifications on Android
        // silently fell back to default importance, making them nearly invisible.
        await Notif.setNotificationChannelAsync('news_updates', {
            name: 'Haberler',
            description: 'Afet haberleri ve güncellemeleri',
            importance: Notif.AndroidImportance.DEFAULT,
            sound: 'default',
        });

        await Notif.setNotificationChannelAsync('default', {
            name: 'Genel Bildirimler',
            description: 'Genel uygulama bildirimleri',
            importance: Notif.AndroidImportance.DEFAULT,
            sound: 'default',
        });

        logger.info('✅ Android notification channels created');
    }

    // ==================== TOKEN REGISTRATION ====================

    private async resolveCurrentUid(): Promise<string> {
        try {
            const { getFirebaseAuth } = await import('../../lib/firebase');
            const authUid = getFirebaseAuth()?.currentUser?.uid;
            if (authUid) return authUid;
        } catch {
            // best effort
        }

        try {
            const { identityService } = await import('./IdentityService');
            const identityUid = identityService.getUid?.();
            if (identityUid) return identityUid;
        } catch {
            // best effort
        }

        try {
            const { useAuthStore } = await import('../stores/authStore');
            const storeUid = useAuthStore.getState().firebaseUser?.uid;
            if (storeUid) return storeUid;
        } catch {
            // best effort
        }

        return '';
    }

    private scheduleTokenRegistrationRetry(reason: string): void {
        if (this.tokenRegisterRetryCount >= this.MAX_TOKEN_REGISTER_RETRIES) {
            logger.warn(`FCM token registration retries exhausted (${reason})`);
            return;
        }

        if (this.tokenRegisterRetryTimer) {
            clearTimeout(this.tokenRegisterRetryTimer);
            this.tokenRegisterRetryTimer = null;
        }

        this.tokenRegisterRetryCount += 1;
        const delay = Math.min(
            this.TOKEN_REGISTER_RETRY_BASE_MS * Math.pow(2, this.tokenRegisterRetryCount - 1),
            30000,
        );

        logger.warn(`FCM token registration postponed (${reason}), retry ${this.tokenRegisterRetryCount}/${this.MAX_TOKEN_REGISTER_RETRIES} in ${delay}ms`);
        this.tokenRegisterRetryTimer = setTimeout(() => {
            this.tokenRegisterRetryTimer = null;
            this.registerTokenWithServer().catch((err) => {
                logger.debug('Deferred FCM token registration failed:', err);
            });
        }, delay);
    }

    private clearTokenRegistrationRetryState(): void {
        this.tokenRegisterRetryCount = 0;
        if (this.tokenRegisterRetryTimer) {
            clearTimeout(this.tokenRegisterRetryTimer);
            this.tokenRegisterRetryTimer = null;
        }
    }

    /**
     * Register token with Firebase server
     */
    async registerTokenWithServer(): Promise<void> {
        if (!this.token) {
            logger.debug('No token to register');
            return;
        }

        const uid = await this.resolveCurrentUid();
        if (!uid) {
            this.scheduleTokenRegistrationRetry('uid-unavailable');
            return;
        }

        try {
            // Get current location with timeout to prevent GPS blocking token registration
            let location: { latitude: number; longitude: number } | undefined;
            try {
                const Location = await import('expo-location');
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status === 'granted') {
                    const locPromise = Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    const locTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
                    const loc = await Promise.race([locPromise, locTimeout]);
                    if (loc && 'coords' in loc) {
                        location = {
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                        };
                    }
                }
            } catch {
                // Location is optional for token registration
            }

            // Call Firebase Function
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const { getApp } = await import('firebase/app');
            const functions = getFunctions(getApp(), 'europe-west1'); // Match deployed region
            const registerFCM = httpsCallable(functions, 'registerFCMToken');

            // CANONICAL: Send installationId to CF so it uses the same device key
            // as the client-side direct Firestore write (push_tokens/{uid}/devices/{installationId}).
            // This eliminates the dual-key problem (installationId vs tokenHash).
            let cfInstallationId: string | undefined;
            try {
                const { getInstallationId: getInstId } = await import('../../lib/installationId');
                cfInstallationId = await getInstId();
            } catch {
                // installationId unavailable — CF will fall back to tokenHash
            }

            await registerFCM({
                token: this.token,
                platform: Platform.OS,
                latitude: location?.latitude,
                longitude: location?.longitude,
                ...(cfInstallationId ? { installationId: cfInstallationId } : {}),
            });

            logger.info('✅ FCM token registered with server');
            // CRITICAL FIX: Clear retry state on CF success, not just on Firestore backup success.
            // Previously, if CF succeeded but Firestore backup failed, retries were never cleared,
            // causing the counter to be exhausted prematurely.
            this.clearTokenRegistrationRetryState();
        } catch (error) {
            logger.error('Failed to register token with server:', error);
            this.scheduleTokenRegistrationRetry('callable-failed');
        }

        // CRITICAL BACKUP: Write directly to BOTH V3 push_tokens AND legacy fcm_tokens.
        // The registerFCMToken CF call above may silently fail (network, CF not deployed, etc.)
        // CFs now read from push_tokens first, then fcm_tokens — both must have the token.
        try {
            if (uid && this.token) {
                const { getFirestoreInstanceAsync } = await import('./firebase/FirebaseInstanceManager');
                const db = await getFirestoreInstanceAsync();
                if (db) {
                    const { doc, setDoc } = await import('firebase/firestore');

                    // V3: push_tokens/{uid}/devices/{installationId} (PRIMARY)
                    try {
                        const { getInstallationId } = await import('../../lib/installationId');
                        const installationId = await getInstallationId();
                        const v3Ref = doc(db, 'push_tokens', uid, 'devices', installationId);
                        await setDoc(v3Ref, {
                            token: this.token,
                            userId: uid,
                            platform: Platform.OS,
                            lastUpdated: Date.now(),
                            installationId,
                        }, { merge: true });
                        logger.info('✅ Push token written to push_tokens/' + uid + '/devices/' + installationId);
                    } catch {
                        // installationId may not be available — non-blocking
                    }

                    // Legacy: fcm_tokens/{uid} (BACKWARD COMPAT)
                    const legacyRef = doc(db, 'fcm_tokens', uid);
                    await setDoc(legacyRef, {
                        token: this.token,
                        userId: uid,
                        platform: Platform.OS,
                        lastUpdated: Date.now(),
                    }, { merge: true });
                    logger.info('✅ FCM token backup written to fcm_tokens/' + uid);
                    this.clearTokenRegistrationRetryState();
                } else {
                    this.scheduleTokenRegistrationRetry('firestore-unavailable');
                }
            }
        } catch (backupError) {
            // Non-blocking — CF registration may have succeeded
            logger.debug('FCM token direct backup write failed (non-blocking):', backupError);
            this.scheduleTokenRegistrationRetry('backup-write-failed');
        }
    }

    // ==================== FCM TOPIC SUBSCRIPTION ====================

    /**
     * Get native device push token (FCM on Android, APNS on iOS) and
     * subscribe it to FCM broadcast topics via the server.
     *
     * WHY SERVER-SIDE: Expo SDK does not expose `messaging().subscribeToTopic()`.
     * Only @react-native-firebase/messaging provides that API, and this project
     * uses expo-notifications instead. So we send the native token to the
     * server and let Firebase Admin SDK do the topic subscription.
     *
     * This is NON-BLOCKING — failure here does not affect normal push delivery.
     * The per-token send path remains as fallback.
     */
    private async registerNativeTokenAndSubscribeTopics(): Promise<void> {
        try {
            const Notif = await getNotifications();

            // getDevicePushTokenAsync() returns the RAW platform token:
            //   Android → native FCM registration token
            //   iOS → native APNS device token
            // Both can be subscribed to FCM topics via Admin SDK.
            const deviceTokenData = await Notif.getDevicePushTokenAsync();
            const nativeToken = deviceTokenData.data;

            if (!nativeToken || typeof nativeToken !== 'string' || nativeToken.length < 10) {
                logger.debug('No valid native device token available for topic subscription');
                return;
            }

            this.nativeToken = nativeToken;
            logger.info(`Native device token retrieved: ${nativeToken.substring(0, 20)}...`);

            // Call server-side Cloud Function to subscribe this native token to topics.
            // The CF will call admin.messaging().subscribeToTopic() for each topic.
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const { getApp } = await import('firebase/app');
            const funcs = getFunctions(getApp(), 'europe-west1');
            const subscribeTopics = httpsCallable(funcs, 'subscribeToTopics');

            await subscribeTopics({
                nativeToken,
                platform: Platform.OS,
                topics: [...FCM_TOPICS],
            });

            logger.info(`FCM topic subscription successful: ${FCM_TOPICS.join(', ')}`);
        } catch (error) {
            // NON-BLOCKING: Topic subscription failure must not break push functionality.
            // The per-token send path in Cloud Functions remains as fallback.
            logger.debug('FCM topic subscription failed (non-blocking, per-token fallback active):', error);
        }
    }

    /**
     * Get native device push token (for external use if needed)
     */
    getNativeToken(): string | null {
        return this.nativeToken;
    }

    // ==================== NOTIFICATION HANDLERS ====================

    /**
     * Setup notification handlers
     *
     * IMPORTANT: Foreground notification display and tap handling are both
     * centralized in NotificationCenter.initialize(). We only set up an
     * EEW-specific handler here for emergency mode / history logging.
     * We must NOT add a duplicate addNotificationReceivedListener since
     * NotificationCenter already registers one — adding a second would
     * cause double processing on some devices.
     */
    private async setupNotificationHandlers(): Promise<void> {
        // Foreground notification display: handled by NotificationCenter.setNotificationHandler
        // Foreground SOS/message alerts: handled by NotificationCenter.addNotificationReceivedListener
        // Notification tap navigation: handled by NotificationCenter.addNotificationResponseReceivedListener
        //
        // The only thing we need is to process incoming EEW push data for
        // emergency mode and history logging. We use the NotificationCenter's
        // foreground listener for this — see the 'eew' type check in
        // NotificationCenter's foreground handler.
        //
        // Previously this method added its own addNotificationReceivedListener
        // which caused duplicate processing on some devices.

        logger.info('✅ Notification handlers setup (delegated to NotificationCenter)');
    }

    // ==================== GETTERS ====================

    /**
     * Get current FCM token
     */
    getToken(): string | null {
        return this.token;
    }

    /**
     * Check if initialized
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Cleanup — removes local state and deletes push tokens from Firestore
     * to prevent cross-account notification delivery after account switch.
     */
    cleanup(): void {
        if (this.tokenRefreshListener) {
            this.tokenRefreshListener();
            this.tokenRefreshListener = null;
        }
        if (this.tokenRegisterRetryTimer) {
            clearTimeout(this.tokenRegisterRetryTimer);
            this.tokenRegisterRetryTimer = null;
        }

        // CRITICAL FIX: Delete token from Firestore for the current user
        // to prevent the next user on this device from receiving the previous user's notifications.
        // Capture token AND UID before nulling — signOut() may clear currentUser before
        // the async deleteTokenFromFirestore reads it, causing silent deletion failure.
        const tokenForCleanup = this.token;
        let uidForCleanup: string | undefined;
        try {
            const { getFirebaseAuth } = require('../../lib/firebase');
            uidForCleanup = getFirebaseAuth()?.currentUser?.uid;
        } catch { /* best effort */ }
        this.deleteTokenFromFirestore(tokenForCleanup, uidForCleanup).catch(e => { if (__DEV__) logger.debug('FCM token Firestore delete failed:', e); });

        // CRITICAL FIX: Clear token references so re-init registers under new user
        this.token = null;
        this.nativeToken = null;
        this.isInitialized = false;
        this.tokenRegisterRetryCount = 0;
    }

    /**
     * Delete push token documents from Firestore for the current user.
     * Prevents cross-account notification delivery after logout/account switch.
     */
    private async deleteTokenFromFirestore(capturedToken?: string | null, capturedUid?: string): Promise<void> {
        try {
            // CRITICAL FIX: Use pre-captured UID (from cleanup()) if available.
            // During logout, signOut() races with this async method. By the time we
            // reach here, currentUser may already be null → deletion silently fails
            // → stale token survives → old user gets new user's notifications.
            let uid = capturedUid;
            if (!uid) {
                const { getFirebaseAuth } = await import('../../lib/firebase');
                const auth = getFirebaseAuth();
                uid = auth?.currentUser?.uid;
            }
            if (!uid) return;

            const { getFirestoreInstanceAsync } = await import('./firebase/FirebaseInstanceManager');
            const db = await getFirestoreInstanceAsync();
            if (!db) return;

            const { doc, deleteDoc } = await import('firebase/firestore');

            // Delete V3 push_tokens/{uid}/devices/{installationId}
            try {
                const { getInstallationId } = await import('../../lib/installationId');
                const installationId = await getInstallationId();
                const v3Ref = doc(db, 'push_tokens', uid, 'devices', installationId);
                await deleteDoc(v3Ref);
                logger.info('Push token deleted from push_tokens/' + uid + '/devices/' + installationId);
            } catch {
                // installationId may not be available
            }

            // BACKWARD COMPAT: Also delete the tokenHash-keyed document that may have been
            // written by older versions of registerFCMToken CF (before installationId unification).
            // New CF versions use installationId (same as above), but stale tokenHash docs
            // from before the fix must still be cleaned up.
            const tokenToUse = capturedToken || this.token;
            if (tokenToUse && tokenToUse.length >= 16) {
                try {
                    const tokenHash = tokenToUse.substring(tokenToUse.length - 16);
                    const tokenHashRef = doc(db, 'push_tokens', uid, 'devices', tokenHash);
                    await deleteDoc(tokenHashRef);
                    logger.info('Push token deleted from push_tokens/' + uid + '/devices/' + tokenHash + ' (CF hash key)');
                } catch {
                    // non-blocking
                }
            }

            // Delete legacy fcm_tokens/{uid}
            try {
                const legacyRef = doc(db, 'fcm_tokens', uid);
                await deleteDoc(legacyRef);
                logger.info('FCM token deleted from fcm_tokens/' + uid);
            } catch {
                // non-blocking
            }
        } catch (error) {
            logger.debug('Token Firestore cleanup failed (non-blocking):', error);
        }
    }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const fcmTokenService = new FCMTokenService();
