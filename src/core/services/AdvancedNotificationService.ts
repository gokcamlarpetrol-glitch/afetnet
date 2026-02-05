/**
 * ADVANCED NOTIFICATION SERVICE - ELITE EDITION
 * 
 * Gelişmiş bildirim sistemi - Hayat kurtaran notifications
 * 
 * Features:
 * - Kritik deprem uyarıları (channel ayrımı)
 * - Aile durumu bildirimleri
 * - Bölgesel afet uyarıları
 * - Ses ve titreşim kontrolü
 * - Notification kategorileri
 * - Offline queue
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('AdvancedNotificationService');

const STORAGE_KEY = '@afetnet/notification_settings';

// Notification Categories
export type NotificationCategory =
    | 'earthquake'
    | 'tsunami'
    | 'family'
    | 'sos'
    | 'checkin'
    | 'system'
    | 'battery';

export interface NotificationSettings {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
    criticalAlerts: boolean;
    categories: Record<NotificationCategory, boolean>;
}

export interface EarthquakeNotificationData {
    magnitude: number;
    location: string;
    depth: number;
    distance?: number;
    estimatedArrival?: number; // seconds
    isEEW: boolean; // Early Earthquake Warning
}

export interface FamilyNotificationData {
    memberId: string;
    memberName: string;
    status: 'safe' | 'help' | 'trapped' | 'offline';
    location?: { latitude: number; longitude: number };
}

const DEFAULT_SETTINGS: NotificationSettings = {
    enabled: true,
    sound: true,
    vibration: true,
    criticalAlerts: true,
    categories: {
        earthquake: true,
        tsunami: true,
        family: true,
        sos: true,
        checkin: true,
        system: true,
        battery: true,
    },
};

// Vibration patterns
const VIBRATION_PATTERNS = {
    earthquake: [0, 500, 200, 500, 200, 500, 200, 500], // SOS pattern
    tsunami: [0, 1000, 200, 1000, 200, 1000],
    family_safe: [0, 200],
    family_help: [0, 500, 200, 500],
    sos: [0, 100, 100, 100, 100, 100, 300, 100, 100, 100, 100, 100, 300, 100, 100, 100, 100, 100], // Morse SOS
    checkin: [0, 200, 100, 200],
    critical: [0, 1000, 500, 1000, 500, 1000],
};

class AdvancedNotificationService {
    private settings: NotificationSettings = { ...DEFAULT_SETTINGS };
    private isInitialized = false;
    private expoPushToken: string | null = null;

    /**
     * Initialize notification service
     */
    async initialize(): Promise<void> {
        try {
            // Load settings
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
            }

            // Request permissions
            if (Device.isDevice) {
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;

                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }

                if (finalStatus !== 'granted') {
                    logger.warn('Notification permission not granted');
                    return;
                }

                // Get push token
                const token = await Notifications.getExpoPushTokenAsync();
                this.expoPushToken = token.data;
                logger.info('Expo push token:', this.expoPushToken);
            }

            Notifications.setNotificationHandler({
                handleNotification: async (notification) => {
                    const category = notification.request.content.data?.category as NotificationCategory;

                    return {
                        shouldShowAlert: true,
                        shouldPlaySound: this.settings.sound && this.settings.categories[category] !== false,
                        shouldSetBadge: true,
                        shouldShowBanner: true,
                        shouldShowList: true,
                    };
                },
            });

            // Set up Android channels
            if (Platform.OS === 'android') {
                await this.setupAndroidChannels();
            }

            this.isInitialized = true;
            logger.info('Advanced notification service initialized');
        } catch (error) {
            logger.error('Notification initialization failed:', error);
        }
    }

    /**
     * Setup Android notification channels
     */
    private async setupAndroidChannels(): Promise<void> {
        // Critical earthquake channel
        await Notifications.setNotificationChannelAsync('earthquake', {
            name: 'Deprem Uyarıları',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: VIBRATION_PATTERNS.earthquake,
            sound: 'earthquake_alarm.wav',
            bypassDnd: true, // Bypass Do Not Disturb
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            enableVibrate: true,
            enableLights: true,
            lightColor: '#FF0000',
        });

        // Tsunami channel
        await Notifications.setNotificationChannelAsync('tsunami', {
            name: 'Tsunami Uyarıları',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: VIBRATION_PATTERNS.tsunami,
            bypassDnd: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            enableVibrate: true,
            enableLights: true,
            lightColor: '#0000FF',
        });

        // Family status channel
        await Notifications.setNotificationChannelAsync('family', {
            name: 'Aile Bildirimleri',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: VIBRATION_PATTERNS.family_safe,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
        });

        // SOS channel
        await Notifications.setNotificationChannelAsync('sos', {
            name: 'SOS Uyarıları',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: VIBRATION_PATTERNS.sos,
            bypassDnd: true,
            enableVibrate: true,
        });

        // Check-in channel
        await Notifications.setNotificationChannelAsync('checkin', {
            name: 'Check-in Hatırlatmaları',
            importance: Notifications.AndroidImportance.DEFAULT,
        });

        logger.info('Android notification channels configured');
    }

    /**
     * EARTHQUAKE NOTIFICATION - CRITICAL
     */
    async sendEarthquakeAlert(data: EarthquakeNotificationData): Promise<string | null> {
        if (!this.settings.categories.earthquake) return null;

        // Generate urgency based on magnitude and distance
        const isUrgent = data.magnitude >= 5.0 || (data.distance && data.distance < 100);

        // Vibrate for critical alerts
        if (this.settings.vibration && isUrgent) {
            Vibration.vibrate(VIBRATION_PATTERNS.earthquake);
        }

        const title = data.isEEW
            ? `⚠️ ERKEN DEPREM UYARISI`
            : `🔴 ${data.magnitude.toFixed(1)} DEPREM`;

        let body = `📍 ${data.location}`;
        body += `\n📏 Derinlik: ${data.depth} km`;

        if (data.distance) {
            body += `\n📐 Size uzaklık: ${data.distance.toFixed(0)} km`;
        }

        if (data.isEEW && data.estimatedArrival) {
            body += `\n⏱️ Tahmini varış: ${data.estimatedArrival} saniye`;
            body += `\n\n🚨 ÇÖK, KAPAN, TUTUN!`;
        }

        return this.scheduleNotification({
            title,
            body,
            data: { category: 'earthquake', ...data },
            categoryIdentifier: 'earthquake',
            priority: 'max',
            sound: data.magnitude >= 5.0 ? 'earthquake_alarm.wav' : 'default',
        });
    }

    /**
     * TSUNAMI NOTIFICATION - CRITICAL
     */
    async sendTsunamiAlert(location: string, estimatedMinutes: number): Promise<string | null> {
        if (!this.settings.categories.tsunami) return null;

        if (this.settings.vibration) {
            Vibration.vibrate(VIBRATION_PATTERNS.tsunami);
        }

        return this.scheduleNotification({
            title: '🌊 TSUNAMİ UYARISI',
            body: `📍 ${location}\n⏱️ Tahmini varış: ${estimatedMinutes} dakika\n\n🏔️ YÜKSEK YERE ÇIKIN!`,
            data: { category: 'tsunami', location, estimatedMinutes },
            categoryIdentifier: 'tsunami',
            priority: 'max',
        });
    }

    /**
     * FAMILY STATUS NOTIFICATION
     */
    async sendFamilyStatusNotification(data: FamilyNotificationData): Promise<string | null> {
        if (!this.settings.categories.family) return null;

        let title: string;
        let body: string;
        let vibrationPattern: number[];

        switch (data.status) {
            case 'safe':
                title = '✅ Aile Üyesi Güvende';
                body = `${data.memberName} güvende olarak işaretlendi.`;
                vibrationPattern = VIBRATION_PATTERNS.family_safe;
                break;
            case 'help':
                title = '⚠️ Yardım Gerekiyor';
                body = `${data.memberName} yardım istiyor!`;
                vibrationPattern = VIBRATION_PATTERNS.family_help;
                break;
            case 'trapped':
                title = '🆘 Enkaz Altında';
                body = `${data.memberName} enkaz altında olduğunu bildirdi!`;
                vibrationPattern = VIBRATION_PATTERNS.sos;
                break;
            case 'offline':
                title = '❓ Cevap Yok';
                body = `${data.memberName} henüz cevap vermedi.`;
                vibrationPattern = VIBRATION_PATTERNS.checkin;
                break;
        }

        if (this.settings.vibration && data.status !== 'safe') {
            Vibration.vibrate(vibrationPattern);
        }

        return this.scheduleNotification({
            title,
            body,
            data: { category: 'family', ...data },
            categoryIdentifier: 'family',
            priority: data.status === 'safe' ? 'high' : 'max',
        });
    }

    /**
     * SOS RECEIVED NOTIFICATION
     */
    async sendSOSReceivedNotification(senderName: string, distance?: number): Promise<string | null> {
        if (!this.settings.categories.sos) return null;

        if (this.settings.vibration) {
            Vibration.vibrate(VIBRATION_PATTERNS.sos);
        }

        return this.scheduleNotification({
            title: '🆘 SOS SİNYALİ ALINDI',
            body: `${senderName} yardım istiyor!${distance ? `\n📐 Uzaklık: ${distance.toFixed(0)}m` : ''}`,
            data: { category: 'sos', senderName, distance },
            categoryIdentifier: 'sos',
            priority: 'max',
        });
    }

    /**
     * CHECK-IN REMINDER NOTIFICATION
     */
    async sendCheckinReminder(isEmergency = false): Promise<string | null> {
        if (!this.settings.categories.checkin) return null;

        return this.scheduleNotification({
            title: isEmergency ? '🚨 Acil Check-in Gerekiyor' : '✅ Check-in Zamanı',
            body: isEmergency
                ? 'Lütfen güvende olduğunuzu hemen bildirin!'
                : 'Ailenize güvende olduğunuzu bildirin.',
            data: { category: 'checkin', isEmergency },
            categoryIdentifier: 'checkin',
            priority: isEmergency ? 'max' : 'default',
        });
    }

    /**
     * BATTERY LOW NOTIFICATION
     */
    async sendBatteryNotification(level: number, isAutoSOS = false): Promise<string | null> {
        if (!this.settings.categories.battery) return null;

        return this.scheduleNotification({
            title: isAutoSOS ? '🔋 Otomatik SOS Gönderildi' : '🔋 Batarya Düşük',
            body: isAutoSOS
                ? `Batarya %${level} - Konumunuz aile ile paylaşıldı.`
                : `Batarya %${level} - Güç tasarrufu modu aktif.`,
            data: { category: 'battery', level, isAutoSOS },
            categoryIdentifier: 'system',
            priority: isAutoSOS ? 'high' : 'default',
        });
    }

    /**
     * Core notification scheduling
     */
    private async scheduleNotification(options: {
        title: string;
        body: string;
        data?: Record<string, unknown>;
        categoryIdentifier?: string;
        priority?: 'default' | 'high' | 'max';
        sound?: string;
        trigger?: Notifications.NotificationTriggerInput;
    }): Promise<string | null> {
        try {
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title: options.title,
                    body: options.body,
                    data: options.data,
                    categoryIdentifier: options.categoryIdentifier,
                    sound: options.sound || (this.settings.sound ? 'default' : undefined),
                    priority: options.priority === 'max'
                        ? Notifications.AndroidNotificationPriority.MAX
                        : options.priority === 'high'
                            ? Notifications.AndroidNotificationPriority.HIGH
                            : Notifications.AndroidNotificationPriority.DEFAULT,
                },
                trigger: options.trigger || null, // null = immediate
            });

            logger.info('Notification scheduled:', id, options.title);
            return id;
        } catch (error) {
            logger.error('Failed to schedule notification:', error);
            return null;
        }
    }

    /**
     * Cancel all notifications
     */
    async cancelAll(): Promise<void> {
        await Notifications.cancelAllScheduledNotificationsAsync();
        logger.info('All notifications cancelled');
    }

    /**
     * Update settings
     */
    async updateSettings(updates: Partial<NotificationSettings>): Promise<void> {
        this.settings = { ...this.settings, ...updates };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        logger.info('Notification settings updated');
    }

    /**
     * Get settings
     */
    getSettings(): NotificationSettings {
        return { ...this.settings };
    }

    /**
     * Get push token
     */
    getPushToken(): string | null {
        return this.expoPushToken;
    }

    /**
     * Test notification
     */
    async sendTestNotification(): Promise<string | null> {
        return this.scheduleNotification({
            title: '🧪 Test Bildirimi',
            body: 'AfetNet bildirim sistemi aktif ve çalışıyor!',
            data: { category: 'system', test: true },
        });
    }
}

export const advancedNotificationService = new AdvancedNotificationService();
