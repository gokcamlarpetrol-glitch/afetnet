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

class FCMTokenService {
    private token: string | null = null;
    private isInitialized = false;
    private tokenRefreshListener: (() => void) | null = null;

    // ==================== INITIALIZATION ====================

    /**
     * Initialize FCM and get token
     */
    async initialize(): Promise<string | null> {
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

            // Request permissions — CRITICAL: Actually ASK for permission if not granted
            const { status: existingStatus } = await Notif.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                logger.info('Requesting notification permission...');
                const { status } = await Notif.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                logger.warn('❌ Notification permission DENIED — push notifications will NOT work');
                return null;
            }

            // Get FCM token
            const tokenData = await Notif.getExpoPushTokenAsync({
                projectId: '072f1217-172a-40ce-af23-3fc0ad3f7f09', // From EAS_PROJECT_ID
            });

            this.token = tokenData.data;
            logger.info(`✅ FCM Token: ${this.token.substring(0, 20)}...`);

            // Setup Android notification channels
            if (Platform.OS === 'android') {
                await this.setupAndroidChannels();
            }

            // Listen for token refresh
            this.tokenRefreshListener = Notif.addPushTokenListener((token) => {
                this.token = token.data;
                this.registerTokenWithServer();
            }).remove;

            // Register with server
            await this.registerTokenWithServer();

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
            sound: 'earthquake_alarm.wav',
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

        await Notif.setNotificationChannelAsync('messages', {
            name: 'Mesajlar',
            description: 'Kişi ve grup mesaj bildirimleri',
            importance: Notif.AndroidImportance.HIGH,
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

    /**
     * Register token with Firebase server
     */
    async registerTokenWithServer(): Promise<void> {
        if (!this.token) {
            logger.debug('No token to register');
            return;
        }

        try {
            // Get current location
            let location: { latitude: number; longitude: number } | undefined;
            try {
                const Location = await import('expo-location');
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    location = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                    };
                }
            } catch {
                // Location not available
            }

            // Call Firebase Function
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const { getApp } = await import('firebase/app');
            const functions = getFunctions(getApp(), 'europe-west1'); // Match deployed region
            const registerFCM = httpsCallable(functions, 'registerFCMToken');

            await registerFCM({
                token: this.token,
                platform: Platform.OS,
                latitude: location?.latitude,
                longitude: location?.longitude,
            });

            logger.info('✅ FCM token registered with server');
        } catch (error) {
            logger.error('Failed to register token with server:', error);
        }

        // CRITICAL BACKUP: Write directly to BOTH V3 push_tokens AND legacy fcm_tokens.
        // The registerFCMToken CF call above may silently fail (network, CF not deployed, etc.)
        // CFs now read from push_tokens first, then fcm_tokens — both must have the token.
        try {
            const { getAuth } = await import('firebase/auth');
            const { getApp } = await import('firebase/app');
            const auth = getAuth(getApp());
            const uid = auth.currentUser?.uid;
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
                }
            }
        } catch (backupError) {
            // Non-blocking — CF registration may have succeeded
            logger.debug('FCM token direct backup write failed (non-blocking):', backupError);
        }
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

    /**
     * Handle incoming EEW notification
     */
    private async handleEEWNotification(data: Record<string, unknown>): Promise<void> {
        logger.warn('🚨 EEW NOTIFICATION RECEIVED:', data);

        try {
            const magnitude = Number(data.magnitude);
            const location = String(data.location || 'Unknown').trim() || 'Unknown';
            const latitude = Number(data.latitude);
            const longitude = Number(data.longitude);
            const depth = Number(data.depth);
            const rawSource = String(data.source || 'AFAD').trim().toUpperCase();
            const source =
                rawSource === 'AFAD' || rawSource === 'USGS' || rawSource === 'KANDILLI' || rawSource === 'EMSC' || rawSource === 'KOERI'
                    ? rawSource
                    : 'AFAD';
            const timestampRaw = Number(data.timestamp);
            const eventTimestamp = Number.isFinite(timestampRaw) ? timestampRaw : Date.now();

            if (!Number.isFinite(magnitude) || magnitude <= 0) {
                logger.warn('Skipping EEW foreground handling: invalid magnitude', data);
                return;
            }

            // IMPORTANT: do NOT call notificationCenter.notify('eew') here.
            // The push itself is already displayed by OS/NotificationCenter handler.
            // Calling notify() here created duplicate EEW notifications in foreground.

            // Persist to local EEW history for user-facing traceability.
            try {
                const { useEEWHistoryStore } = await import('../stores/eewHistoryStore');
                useEEWHistoryStore.getState().addEvent({
                    timestamp: eventTimestamp,
                    magnitude,
                    location,
                    depth: Number.isFinite(depth) ? depth : 0,
                    latitude: Number.isFinite(latitude) ? latitude : 0,
                    longitude: Number.isFinite(longitude) ? longitude : 0,
                    warningTime: 0,
                    estimatedIntensity: this.estimateIntensity(magnitude),
                    epicentralDistance: 0,
                    source: source as 'AFAD' | 'KANDILLI' | 'USGS' | 'EMSC' | 'CROWDSOURCED' | 'DEVICE_SENSOR',
                    wasNotified: true,
                    confidence: 1.0,
                    certainty: magnitude >= 6.0 ? 'high' : magnitude >= 5.0 ? 'medium' : 'low',
                });
            } catch (historyError) {
                logger.debug('EEW history write skipped:', historyError);
            }

            // Trigger emergency mode if threshold met.
            try {
                const { emergencyModeService } = await import('./EmergencyModeService');
                const earthquake = {
                    id: String(data.eventId || data.id || `eew_${eventTimestamp}`),
                    magnitude,
                    location,
                    latitude: Number.isFinite(latitude) ? latitude : 0,
                    longitude: Number.isFinite(longitude) ? longitude : 0,
                    depth: Number.isFinite(depth) ? depth : 0,
                    time: eventTimestamp,
                    source: source as 'AFAD' | 'USGS' | 'KANDILLI' | 'EMSC' | 'KOERI' | 'SEISMIC_SENSOR',
                };

                if (emergencyModeService.shouldTriggerEmergencyMode(earthquake)) {
                    await emergencyModeService.activateEmergencyMode(earthquake);
                }
            } catch (emergencyError) {
                logger.debug('EEW emergency mode trigger skipped:', emergencyError);
            }
        } catch (error) {
            logger.error('Failed to handle EEW notification:', error);
        }
    }

    /**
     * Estimate intensity from magnitude
     */
    private estimateIntensity(magnitude: number): number {
        if (magnitude >= 7.0) return 9;
        if (magnitude >= 6.0) return 7;
        if (magnitude >= 5.0) return 6;
        if (magnitude >= 4.0) return 5;
        return 4;
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
     * Cleanup
     */
    cleanup(): void {
        if (this.tokenRefreshListener) {
            this.tokenRefreshListener();
            this.tokenRefreshListener = null;
        }
    }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const fcmTokenService = new FCMTokenService();
