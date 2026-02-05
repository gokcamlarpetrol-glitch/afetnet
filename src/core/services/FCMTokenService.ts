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
import { firebaseDataService } from './FirebaseDataService';

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

            // Request permissions
            const { status: existingStatus } = await Notif.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notif.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                logger.warn('Notification permission not granted');
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
    }

    // ==================== NOTIFICATION HANDLERS ====================

    /**
     * Setup notification handlers
     */
    private async setupNotificationHandlers(): Promise<void> {
        const Notif = await getNotifications();

        // Foreground handler
        Notif.setNotificationHandler({
            handleNotification: async (notification) => {
                const data = notification.request.content.data;

                // Always show EEW notifications
                if (data?.type === 'EEW') {
                    // Trigger ultra-fast notification system
                    this.handleEEWNotification(data);

                    return {
                        shouldShowAlert: true,
                        shouldPlaySound: true,
                        shouldSetBadge: true,
                        shouldShowBanner: true,
                        shouldShowList: true,
                        priority: Notif.AndroidNotificationPriority.MAX,
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

        // Background/killed handler
        Notif.addNotificationReceivedListener((notification) => {
            const data = notification.request.content.data;
            if (data?.type === 'EEW') {
                this.handleEEWNotification(data);
            }
        });

        // Notification response handler
        Notif.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data;
            if (data?.type === 'EEW') {
                // Navigate to EEW detail screen
                logger.info('User tapped EEW notification:', data);
            }
        });

        logger.info('✅ Notification handlers setup');
    }

    /**
     * Handle incoming EEW notification
     */
    private async handleEEWNotification(data: Record<string, unknown>): Promise<void> {
        logger.warn('🚨 EEW NOTIFICATION RECEIVED:', data);

        try {
            // Import ultra-fast notification service
            const { ultraFastEEWNotification } = await import('./UltraFastEEWNotification');

            // Trigger full alert chain
            await ultraFastEEWNotification.sendEEWNotification({
                magnitude: Number(data.magnitude) || 0,
                location: String(data.location) || 'Unknown',
                warningSeconds: 30, // Estimated
                estimatedIntensity: this.estimateIntensity(Number(data.magnitude) || 0),
                epicentralDistance: 100, // Will be calculated
                source: (data.source as 'AFAD') || 'AFAD',
                epicenter: {
                    latitude: Number(data.latitude) || 0,
                    longitude: Number(data.longitude) || 0,
                },
            });
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
