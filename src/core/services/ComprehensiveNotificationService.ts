/**
 * COMPREHENSIVE NOTIFICATION SERVICE - ELITE EDITION
 * 
 * Tüm AfetNet özellikleri için bildirim sistemi
 * 
 * Categories:
 * 1. Emergency Alerts (deprem, tsunami, yangın, sel)
 * 2. Family & Social (aile durumu, mesh network)
 * 3. Location (tahliye, güvenli bölge, navigasyon)
 * 4. Health (ilk yardım, tıbbi hatırlatma)
 * 5. Resource (kaynak paylaşım, yardım talebi)
 * 6. System (batarya, offline, bağlantı)
 */

import * as Notifications from 'expo-notifications';
import { Platform, Vibration, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('ComprehensiveNotificationService');

// ========================
// TYPES & INTERFACES
// ========================

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export type EmergencyType =
    | 'earthquake'
    | 'tsunami'
    | 'fire'
    | 'flood'
    | 'landslide'
    | 'storm'
    | 'nuclear'
    | 'chemical';

export type FamilyStatus = 'safe' | 'help' | 'trapped' | 'injured' | 'evacuating' | 'offline';

export type ResourceType = 'water' | 'food' | 'shelter' | 'medical' | 'rescue' | 'transport';

export interface NotificationAction {
    id: string;
    title: string;
    options?: {
        opensAppToForeground?: boolean;
        isDestructive?: boolean;
        isAuthenticationRequired?: boolean;
    };
}

export interface RichNotification {
    title: string;
    body: string;
    subtitle?: string;
    imageUrl?: string;
    actions?: NotificationAction[];
    data?: Record<string, unknown>;
    sound?: string;
    badge?: number;
}

// ========================
// VIBRATION PATTERNS (Elite)
// ========================

const VIBRATION_PATTERNS = {
    // Emergency patterns
    earthquake: [0, 500, 200, 500, 200, 500, 200, 500, 200, 500],
    tsunami: [0, 1000, 300, 1000, 300, 1000],
    fire: [0, 200, 100, 200, 100, 200, 500, 200, 100, 200, 100, 200],
    flood: [0, 400, 200, 400, 200, 400, 200, 400],

    // SOS & urgent
    sos_morse: [0, 100, 100, 100, 100, 100, 300, 300, 300, 300, 300, 300, 100, 100, 100, 100, 100], // ... --- ...
    urgent: [0, 300, 100, 300, 100, 300],
    critical: [0, 1000, 500, 1000, 500, 1000],

    // Status patterns
    family_safe: [0, 200, 100, 200],
    family_help: [0, 400, 200, 400, 200, 400],
    nearby_sos: [0, 150, 75, 150, 75, 150, 75, 150],

    // Gentle patterns
    checkin: [0, 150, 100, 150],
    resource: [0, 100, 50, 100],
    info: [0, 100],
};

// ========================
// NOTIFICATION SOUNDS
// ========================

const NOTIFICATION_SOUNDS = {
    earthquake_alarm: 'earthquake_alarm.wav',
    tsunami_siren: 'tsunami_siren.wav',
    fire_alarm: 'fire_alarm.wav',
    emergency: 'emergency.wav',
    sos: 'sos.wav',
    family_alert: 'family_alert.wav',
    gentle: 'gentle.wav',
    success: 'success.wav',
    default: 'default',
};

// ========================
// NOTIFICATION CATEGORIES
// ========================

const NOTIFICATION_CATEGORIES = {
    emergency: {
        identifier: 'emergency',
        actions: [
            { id: 'view', title: 'Detay Gör' },
            { id: 'share_location', title: 'Konum Paylaş' },
            { id: 'call_112', title: '112 Ara' },
        ],
    },
    family: {
        identifier: 'family',
        actions: [
            { id: 'safe', title: 'Güvendeyim ✅' },
            { id: 'help', title: 'Yardım Gerek ⚠️' },
            { id: 'view', title: 'Haritada Gör' },
        ],
    },
    evacuation: {
        identifier: 'evacuation',
        actions: [
            { id: 'navigate', title: 'Yol Tarifi Al' },
            { id: 'share', title: 'Aile ile Paylaş' },
        ],
    },
    sos: {
        identifier: 'sos',
        actions: [
            { id: 'respond', title: 'Yardıma Git' },
            { id: 'call', title: 'Ara' },
            { id: 'view', title: 'Konumu Gör' },
        ],
    },
    resource: {
        identifier: 'resource',
        actions: [
            { id: 'claim', title: 'Talep Et' },
            { id: 'navigate', title: 'Git' },
        ],
    },
    checkin: {
        identifier: 'checkin',
        actions: [
            { id: 'safe', title: 'Güvendeyim ✅' },
            { id: 'help', title: 'Yardım Gerek ⚠️' },
            { id: 'trapped', title: 'Enkaz Altı 🆘' },
        ],
    },
};

// ========================
// ANDROID CHANNEL CONFIG
// ========================

interface AndroidChannelConfig {
    id: string;
    name: string;
    importance: Notifications.AndroidImportance;
    bypassDnd: boolean;
    vibrationPattern?: number[];
    lightColor?: string;
    sound?: string;
}

const ANDROID_CHANNELS: AndroidChannelConfig[] = [
    // Critical emergency channels
    {
        id: 'earthquake',
        name: 'Deprem Uyarıları',
        importance: Notifications.AndroidImportance.MAX,
        bypassDnd: true,
        vibrationPattern: VIBRATION_PATTERNS.earthquake,
        lightColor: '#FF0000',
        sound: NOTIFICATION_SOUNDS.earthquake_alarm,
    },
    {
        id: 'tsunami',
        name: 'Tsunami Uyarıları',
        importance: Notifications.AndroidImportance.MAX,
        bypassDnd: true,
        vibrationPattern: VIBRATION_PATTERNS.tsunami,
        lightColor: '#0000FF',
        sound: NOTIFICATION_SOUNDS.tsunami_siren,
    },
    {
        id: 'fire',
        name: 'Yangın Uyarıları',
        importance: Notifications.AndroidImportance.MAX,
        bypassDnd: true,
        vibrationPattern: VIBRATION_PATTERNS.fire,
        lightColor: '#FF4500',
        sound: NOTIFICATION_SOUNDS.fire_alarm,
    },
    {
        id: 'flood',
        name: 'Sel/Taşkın Uyarıları',
        importance: Notifications.AndroidImportance.MAX,
        bypassDnd: true,
        vibrationPattern: VIBRATION_PATTERNS.flood,
        lightColor: '#1E90FF',
    },
    // High priority channels
    {
        id: 'sos',
        name: 'SOS Uyarıları',
        importance: Notifications.AndroidImportance.MAX,
        bypassDnd: true,
        vibrationPattern: VIBRATION_PATTERNS.sos_morse,
        lightColor: '#FF0000',
        sound: NOTIFICATION_SOUNDS.sos,
    },
    {
        id: 'family',
        name: 'Aile Bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        bypassDnd: false,
        vibrationPattern: VIBRATION_PATTERNS.family_safe,
        sound: NOTIFICATION_SOUNDS.family_alert,
    },
    {
        id: 'evacuation',
        name: 'Tahliye Yönlendirme',
        importance: Notifications.AndroidImportance.HIGH,
        bypassDnd: true,
        vibrationPattern: VIBRATION_PATTERNS.urgent,
    },
    {
        id: 'mesh',
        name: 'Mesh Ağı',
        importance: Notifications.AndroidImportance.HIGH,
        bypassDnd: false,
        vibrationPattern: VIBRATION_PATTERNS.nearby_sos,
    },
    // Normal channels
    {
        id: 'resource',
        name: 'Kaynak Paylaşım',
        importance: Notifications.AndroidImportance.DEFAULT,
        bypassDnd: false,
        vibrationPattern: VIBRATION_PATTERNS.resource,
    },
    {
        id: 'checkin',
        name: 'Check-in Hatırlatma',
        importance: Notifications.AndroidImportance.DEFAULT,
        bypassDnd: false,
        vibrationPattern: VIBRATION_PATTERNS.checkin,
    },
    {
        id: 'firstaid',
        name: 'İlk Yardım Rehberi',
        importance: Notifications.AndroidImportance.DEFAULT,
        bypassDnd: false,
    },
    {
        id: 'system',
        name: 'Sistem Bildirimleri',
        importance: Notifications.AndroidImportance.LOW,
        bypassDnd: false,
    },
];

// ========================
// SERVICE CLASS
// ========================

class ComprehensiveNotificationService {
    private isInitialized = false;
    private expoPushToken: string | null = null;
    private subscribedTopics: Set<string> = new Set();

    /**
     * Initialize the notification service
     */
    async initialize(): Promise<void> {
        try {
            // Request permissions
            const { status } = await Notifications.requestPermissionsAsync({
                ios: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: true,
                    allowCriticalAlerts: true,
                    provideAppNotificationSettings: true,
                },
            });

            if (status !== 'granted') {
                logger.warn('Notification permission not granted');
                return;
            }

            // Get push token
            try {
                const token = await Notifications.getExpoPushTokenAsync();
                this.expoPushToken = token.data;
                logger.info('Push token:', this.expoPushToken);
            } catch (e) {
                logger.warn('Could not get push token:', e);
            }

            // Setup Android channels
            if (Platform.OS === 'android') {
                await this.setupAndroidChannels();
            }

            // Setup notification categories
            await this.setupCategories();

            // Setup notification handler
            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge: true,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });

            this.isInitialized = true;
            logger.info('Comprehensive notification service initialized');
        } catch (error) {
            logger.error('Notification service initialization failed:', error);
        }
    }

    /**
     * Setup Android notification channels
     */
    private async setupAndroidChannels(): Promise<void> {
        for (const channel of ANDROID_CHANNELS) {
            await Notifications.setNotificationChannelAsync(channel.id, {
                name: channel.name,
                importance: channel.importance,
                bypassDnd: channel.bypassDnd,
                vibrationPattern: channel.vibrationPattern,
                lightColor: channel.lightColor,
                sound: channel.sound,
                enableVibrate: true,
                enableLights: !!channel.lightColor,
                lockscreenVisibility: channel.bypassDnd
                    ? Notifications.AndroidNotificationVisibility.PUBLIC
                    : Notifications.AndroidNotificationVisibility.PRIVATE,
            });
        }
        logger.info(`${ANDROID_CHANNELS.length} Android channels configured`);
    }

    /**
     * Setup notification categories with actions
     */
    private async setupCategories(): Promise<void> {
        const categories = Object.values(NOTIFICATION_CATEGORIES).map(cat => ({
            identifier: cat.identifier,
            actions: cat.actions.map(action => ({
                identifier: action.id,
                buttonTitle: action.title,
                options: {
                    opensAppToForeground: true,
                },
            })),
        }));

        await Notifications.setNotificationCategoryAsync('emergency', categories[0].actions);
        await Notifications.setNotificationCategoryAsync('family', categories[1].actions);
        await Notifications.setNotificationCategoryAsync('evacuation', categories[2].actions);
        await Notifications.setNotificationCategoryAsync('sos', categories[3].actions);
        await Notifications.setNotificationCategoryAsync('resource', categories[4].actions);
        await Notifications.setNotificationCategoryAsync('checkin', categories[5].actions);

        logger.info('Notification categories configured');
    }

    // ========================
    // EMERGENCY NOTIFICATIONS
    // ========================

    /**
     * Send earthquake alert
     */
    async sendEarthquakeAlert(params: {
        magnitude: number;
        location: string;
        depth: number;
        distance?: number;
        estimatedArrival?: number;
        isEEW?: boolean;
    }): Promise<string | null> {
        const isUrgent = params.magnitude >= 5.0;

        if (isUrgent) {
            Vibration.vibrate(VIBRATION_PATTERNS.earthquake);
        }

        const title = params.isEEW
            ? `⚠️ ERKEN DEPREM UYARISI`
            : `🔴 ${params.magnitude.toFixed(1)} DEPREM`;

        let body = `📍 ${params.location}\n📏 Derinlik: ${params.depth} km`;

        if (params.distance) {
            body += `\n📐 Uzaklık: ${params.distance.toFixed(0)} km`;
        }

        if (params.isEEW && params.estimatedArrival) {
            body += `\n\n⏱️ ${params.estimatedArrival} SANİYE!\n🚨 ÇÖK, KAPAN, TUTUN!`;
        }

        return this.schedule({
            title,
            body,
            channelId: 'earthquake',
            categoryIdentifier: 'emergency',
            data: { type: 'earthquake', ...params },
            sound: isUrgent ? NOTIFICATION_SOUNDS.earthquake_alarm : NOTIFICATION_SOUNDS.emergency,
        });
    }

    /**
     * Send tsunami alert
     */
    async sendTsunamiAlert(params: {
        location: string;
        estimatedMinutes: number;
        waveHeight?: number;
    }): Promise<string | null> {
        Vibration.vibrate(VIBRATION_PATTERNS.tsunami);

        return this.schedule({
            title: '🌊 TSUNAMİ UYARISI',
            body: `📍 ${params.location}\n⏱️ Tahmini varış: ${params.estimatedMinutes} dakika${params.waveHeight ? `\n📊 Dalga yüksekliği: ~${params.waveHeight}m` : ''}\n\n🏔️ DERHAL YÜKSEK YERE ÇIKIN!`,
            channelId: 'tsunami',
            categoryIdentifier: 'emergency',
            data: { type: 'tsunami', ...params },
            sound: NOTIFICATION_SOUNDS.tsunami_siren,
        });
    }

    /**
     * Send fire alert
     */
    async sendFireAlert(params: {
        location: string;
        distance?: number;
        direction?: string;
    }): Promise<string | null> {
        Vibration.vibrate(VIBRATION_PATTERNS.fire);

        return this.schedule({
            title: '🔥 YANGIN UYARISI',
            body: `📍 ${params.location}${params.distance ? `\n📐 Uzaklık: ${params.distance.toFixed(0)} km` : ''}${params.direction ? `\n🧭 Yön: ${params.direction}` : ''}\n\n⚠️ Bölgeden uzaklaşın!`,
            channelId: 'fire',
            categoryIdentifier: 'emergency',
            data: { type: 'fire', ...params },
            sound: NOTIFICATION_SOUNDS.fire_alarm,
        });
    }

    /**
     * Send flood alert
     */
    async sendFloodAlert(params: {
        location: string;
        severity: 'low' | 'moderate' | 'high' | 'extreme';
        estimatedLevel?: number;
    }): Promise<string | null> {
        Vibration.vibrate(VIBRATION_PATTERNS.flood);

        const severityEmoji = {
            low: '🟡',
            moderate: '🟠',
            high: '🔴',
            extreme: '⛔',
        };

        return this.schedule({
            title: `${severityEmoji[params.severity]} SEL/TAŞKIN UYARISI`,
            body: `📍 ${params.location}${params.estimatedLevel ? `\n📊 Tahmini su seviyesi: ${params.estimatedLevel}m` : ''}\n\n💧 Yüksek yere çıkın, araçlardan uzak durun!`,
            channelId: 'flood',
            categoryIdentifier: 'emergency',
            data: { type: 'flood', ...params },
        });
    }

    // ========================
    // FAMILY & SOCIAL
    // ========================

    /**
     * Send family status notification
     */
    async sendFamilyStatus(params: {
        memberId: string;
        memberName: string;
        status: FamilyStatus;
        location?: { latitude: number; longitude: number };
        message?: string;
    }): Promise<string | null> {
        const statusConfig = {
            safe: { emoji: '✅', title: 'Güvende', pattern: VIBRATION_PATTERNS.family_safe },
            help: { emoji: '⚠️', title: 'Yardım Gerekiyor', pattern: VIBRATION_PATTERNS.family_help },
            trapped: { emoji: '🆘', title: 'Enkaz Altında', pattern: VIBRATION_PATTERNS.sos_morse },
            injured: { emoji: '🏥', title: 'Yaralı', pattern: VIBRATION_PATTERNS.urgent },
            evacuating: { emoji: '🚶', title: 'Tahliye Ediyor', pattern: VIBRATION_PATTERNS.info },
            offline: { emoji: '❓', title: 'Çevrimdışı', pattern: VIBRATION_PATTERNS.info },
        };

        const config = statusConfig[params.status];

        if (params.status !== 'safe' && params.status !== 'offline') {
            Vibration.vibrate(config.pattern);
        }

        return this.schedule({
            title: `${config.emoji} ${params.memberName} - ${config.title}`,
            body: params.message || `Aile üyenizin durumu güncellendi.${params.location ? '\n📍 Konum paylaşıldı.' : ''}`,
            channelId: 'family',
            categoryIdentifier: 'family',
            data: { type: 'family_status', ...params },
            sound: params.status === 'trapped' || params.status === 'injured'
                ? NOTIFICATION_SOUNDS.sos
                : NOTIFICATION_SOUNDS.family_alert,
        });
    }

    /**
     * Send mesh network SOS received
     */
    async sendMeshSOSReceived(params: {
        senderName: string;
        distance: number;
        message?: string;
        relayCount?: number;
    }): Promise<string | null> {
        Vibration.vibrate(VIBRATION_PATTERNS.nearby_sos);

        return this.schedule({
            title: '🆘 Yakında SOS Sinyali',
            body: `${params.senderName} yardım istiyor!\n📐 Uzaklık: ~${params.distance.toFixed(0)}m${params.message ? `\n💬 "${params.message}"` : ''}${params.relayCount ? `\n📡 ${params.relayCount} cihaz üzerinden` : ''}`,
            channelId: 'mesh',
            categoryIdentifier: 'sos',
            data: { type: 'mesh_sos', ...params },
            sound: NOTIFICATION_SOUNDS.sos,
        });
    }

    /**
     * Send mesh network discovery
     */
    async sendMeshDiscovery(params: {
        connectedDevices: number;
        newDevice?: string;
    }): Promise<string | null> {
        return this.schedule({
            title: '📡 Mesh Ağı Güncellendi',
            body: `${params.connectedDevices} cihaz bağlı${params.newDevice ? `\n🆕 Yeni: ${params.newDevice}` : ''}`,
            channelId: 'mesh',
            data: { type: 'mesh_discovery', ...params },
        });
    }

    // ========================
    // LOCATION & EVACUATION
    // ========================

    /**
     * Send evacuation guidance
     */
    async sendEvacuationGuidance(params: {
        destination: string;
        distance: number;
        estimatedTime: number;
        reason?: string;
    }): Promise<string | null> {
        Vibration.vibrate(VIBRATION_PATTERNS.urgent);

        return this.schedule({
            title: '🚶 TAHLİYE YÖNLENDİRMESİ',
            body: `📍 Hedef: ${params.destination}\n📐 Mesafe: ${(params.distance / 1000).toFixed(1)} km\n⏱️ Süre: ~${params.estimatedTime} dk${params.reason ? `\n\n⚠️ ${params.reason}` : ''}`,
            channelId: 'evacuation',
            categoryIdentifier: 'evacuation',
            data: { type: 'evacuation', ...params },
        });
    }

    /**
     * Send safe zone arrival
     */
    async sendSafeZoneArrival(params: {
        zoneName: string;
        capacity?: number;
        services?: string[];
    }): Promise<string | null> {
        return this.schedule({
            title: '✅ Güvenli Bölgeye Ulaştınız',
            body: `📍 ${params.zoneName}${params.capacity ? `\n👥 Kapasite: ${params.capacity} kişi` : ''}${params.services?.length ? `\n🏥 Hizmetler: ${params.services.join(', ')}` : ''}`,
            channelId: 'evacuation',
            data: { type: 'safe_zone_arrival', ...params },
            sound: NOTIFICATION_SOUNDS.success,
        });
    }

    // ========================
    // HEALTH & FIRST AID
    // ========================

    /**
     * Send first aid reminder
     */
    async sendFirstAidReminder(params: {
        title: string;
        instruction: string;
        urgency: 'critical' | 'high' | 'normal';
        timeElapsed?: number;
    }): Promise<string | null> {
        const urgencyConfig = {
            critical: { emoji: '🔴', pattern: VIBRATION_PATTERNS.critical },
            high: { emoji: '🟠', pattern: VIBRATION_PATTERNS.urgent },
            normal: { emoji: '🟢', pattern: VIBRATION_PATTERNS.info },
        };

        const config = urgencyConfig[params.urgency];

        if (params.urgency !== 'normal') {
            Vibration.vibrate(config.pattern);
        }

        return this.schedule({
            title: `${config.emoji} ${params.title}`,
            body: `${params.instruction}${params.timeElapsed ? `\n⏱️ ${params.timeElapsed} dakika geçti` : ''}`,
            channelId: 'firstaid',
            data: { type: 'first_aid', ...params },
        });
    }

    /**
     * Send CPR timer notification
     */
    async sendCPRTimer(params: {
        cycleNumber: number;
        instruction: '30 BASI' | '2 NEFES' | 'KONTROL';
    }): Promise<string | null> {
        Vibration.vibrate(VIBRATION_PATTERNS.urgent);

        const instructionEmoji = {
            '30 BASI': '💪',
            '2 NEFES': '💨',
            'KONTROL': '🔍',
        };

        return this.schedule({
            title: `${instructionEmoji[params.instruction]} CPR - ${params.instruction}`,
            body: `Döngü #${params.cycleNumber}`,
            channelId: 'firstaid',
            data: { type: 'cpr_timer', ...params },
        });
    }

    // ========================
    // RESOURCE SHARING
    // ========================

    /**
     * Send resource available notification
     */
    async sendResourceAvailable(params: {
        type: ResourceType;
        description: string;
        distance: number;
        quantity?: number;
        provider?: string;
    }): Promise<string | null> {
        const typeEmoji: Record<ResourceType, string> = {
            water: '💧',
            food: '🍞',
            shelter: '🏠',
            medical: '💊',
            rescue: '🚑',
            transport: '🚗',
        };

        return this.schedule({
            title: `${typeEmoji[params.type]} Yakında Kaynak: ${params.description}`,
            body: `📐 Uzaklık: ${(params.distance / 1000).toFixed(1)} km${params.quantity ? `\n📊 Miktar: ${params.quantity}` : ''}${params.provider ? `\n👤 Sağlayan: ${params.provider}` : ''}`,
            channelId: 'resource',
            categoryIdentifier: 'resource',
            data: { ...params, type: 'resource', resourceType: params.type },
        });
    }

    /**
     * Send help request nearby
     */
    async sendHelpRequestNearby(params: {
        requesterName: string;
        requestType: ResourceType;
        distance: number;
        urgency: 'critical' | 'high' | 'normal';
        message?: string;
    }): Promise<string | null> {
        const urgencyEmoji = {
            critical: '🆘',
            high: '⚠️',
            normal: '❓',
        };

        if (params.urgency === 'critical') {
            Vibration.vibrate(VIBRATION_PATTERNS.nearby_sos);
        }

        return this.schedule({
            title: `${urgencyEmoji[params.urgency]} Yakında Yardım Talebi`,
            body: `${params.requesterName} ${params.requestType} arıyor\n📐 Uzaklık: ${(params.distance / 1000).toFixed(1)} km${params.message ? `\n💬 "${params.message}"` : ''}`,
            channelId: 'resource',
            data: { type: 'help_request', ...params },
        });
    }

    // ========================
    // SYSTEM & CHECK-IN
    // ========================

    /**
     * Send check-in reminder
     */
    async sendCheckinReminder(params: {
        isEmergency: boolean;
        missedCount?: number;
    }): Promise<string | null> {
        return this.schedule({
            title: params.isEmergency ? '🚨 Acil Check-in Gerekiyor' : '✅ Check-in Zamanı',
            body: params.isEmergency
                ? `Lütfen güvende olduğunuzu hemen bildirin!${params.missedCount ? `\n⚠️ ${params.missedCount} check-in atlandı.` : ''}`
                : 'Ailenize durumunuzu bildirin.',
            channelId: 'checkin',
            categoryIdentifier: 'checkin',
            data: { type: 'checkin', ...params },
        });
    }

    /**
     * Send battery warning
     */
    async sendBatteryWarning(params: {
        level: number;
        estimatedTime?: number;
        autoSOSSent?: boolean;
    }): Promise<string | null> {
        return this.schedule({
            title: params.autoSOSSent ? '🔋 Otomatik SOS Gönderildi' : `🔋 Batarya Kritik: %${params.level}`,
            body: params.autoSOSSent
                ? `Batarya %${params.level} - Konumunuz aile ile paylaşıldı.`
                : `${params.estimatedTime ? `⏱️ Tahmini süre: ${params.estimatedTime} dk` : 'Güç tasarrufu modunu açın.'}`,
            channelId: 'system',
            data: { type: 'battery', ...params },
        });
    }

    /**
     * Send offline mode notification
     */
    async sendOfflineMode(isOffline: boolean): Promise<string | null> {
        return this.schedule({
            title: isOffline ? '📴 Çevrimdışı Mod Aktif' : '📶 Bağlantı Yeniden Kuruldu',
            body: isOffline
                ? 'İnternet bağlantısı yok. Mesh ağı aktif, offline haritalar kullanılıyor.'
                : 'İnternet bağlantısı yeniden kuruldu. Veriler senkronize ediliyor.',
            channelId: 'system',
            data: { type: 'offline_mode', isOffline },
        });
    }

    // ========================
    // DEBRIS & RESCUE (NEW)
    // ========================

    /**
     * ELITE: Send debris detection notification
     * Triggered when motion is detected after earthquake
     * CRITICAL for rescue operations!
     */
    async sendDebrisDetected(params: {
        detectionType: 'motion' | 'tapping' | 'voice';
        confidence: number;
        location?: { latitude: number; longitude: number };
        deviceId?: string;
    }): Promise<string | null> {
        Vibration.vibrate(VIBRATION_PATTERNS.sos_morse);

        const typeEmoji = {
            motion: '📳',
            tapping: '👆',
            voice: '🎤',
        };

        return this.schedule({
            title: `${typeEmoji[params.detectionType]} ENKAZ ALTI TESPİT`,
            body: `🆘 ${params.detectionType === 'motion' ? 'Hareket' : params.detectionType === 'tapping' ? 'Vurma sesi' : 'Ses'} algılandı!\n📊 Güven: %${Math.round(params.confidence * 100)}${params.location ? '\n📍 Konum bilgisi mevcut' : ''}`,
            channelId: 'sos',
            categoryIdentifier: 'sos',
            data: { type: 'debris_detection', ...params },
            sound: NOTIFICATION_SOUNDS.sos,
        });
    }

    /**
     * ELITE: Send debris mesh message received
     * When someone sends SOS from under rubble via BLE mesh
     */
    async sendDebrisMeshMessage(params: {
        senderName: string;
        messageType: 'sos' | 'trapped' | 'injured' | 'location';
        message?: string;
        hopCount: number;
        receivedAt: number;
    }): Promise<string | null> {
        Vibration.vibrate(VIBRATION_PATTERNS.sos_morse);

        const messageEmoji = {
            sos: '🆘',
            trapped: '🏚️',
            injured: '🏥',
            location: '📍',
        };

        return this.schedule({
            title: `${messageEmoji[params.messageType]} ENKAZ MESAJI ALINDI`,
            body: `${params.senderName} ${params.messageType === 'sos' ? 'yardım istiyor!' : params.messageType === 'trapped' ? 'enkaz altında!' : params.messageType === 'injured' ? 'yaralı!' : 'konum paylaştı.'}${params.message ? `\n💬 "${params.message}"` : ''}\n📡 ${params.hopCount} cihaz üzerinden`,
            channelId: 'mesh',
            categoryIdentifier: 'sos',
            data: { type: 'debris_mesh_message', ...params },
            sound: NOTIFICATION_SOUNDS.sos,
        });
    }

    // ========================
    // OFFICIAL (NEW)
    // ========================

    /**
     * ELITE: Send AFAD official announcement
     * For governmental disaster alerts and announcements
     */
    async sendAFADAlert(params: {
        title: string;
        body: string;
        urgency: 'critical' | 'high' | 'normal' | 'info';
        region?: string;
        actionUrl?: string;
    }): Promise<string | null> {
        if (params.urgency === 'critical') {
            Vibration.vibrate(VIBRATION_PATTERNS.critical);
        } else if (params.urgency === 'high') {
            Vibration.vibrate(VIBRATION_PATTERNS.urgent);
        }

        const urgencyEmoji = {
            critical: '🚨',
            high: '⚠️',
            normal: '📢',
            info: 'ℹ️',
        };

        return this.schedule({
            title: `${urgencyEmoji[params.urgency]} AFAD: ${params.title}`,
            body: params.body + (params.region ? `\n📍 Bölge: ${params.region}` : ''),
            channelId: params.urgency === 'critical' ? 'earthquake' : 'system',
            categoryIdentifier: params.urgency === 'critical' ? 'emergency' : undefined,
            data: { type: 'afad_alert', ...params },
            sound: params.urgency === 'critical' ? NOTIFICATION_SOUNDS.emergency : undefined,
        });
    }

    /**
     * ELITE: Send drill reminder notification
     * Weekly earthquake drill reminders
     */
    async sendDrillReminder(params: {
        drillType: 'earthquake' | 'evacuation' | 'first_aid';
        scheduledAt?: Date;
        isNow?: boolean;
    }): Promise<string | null> {
        const drillEmoji = {
            earthquake: '🏠',
            evacuation: '🚶',
            first_aid: '🩹',
        };

        const drillTitles = {
            earthquake: 'Deprem Tatbikatı',
            evacuation: 'Tahliye Tatbikatı',
            first_aid: 'İlk Yardım Tatbikatı',
        };

        if (params.isNow) {
            Vibration.vibrate(VIBRATION_PATTERNS.urgent);
        }

        return this.schedule({
            title: `${drillEmoji[params.drillType]} ${params.isNow ? 'TATBİKAT BAŞLADI!' : 'Tatbikat Hatırlatma'}`,
            body: params.isNow
                ? `${drillTitles[params.drillType]} başladı!\n💪 ÇÖK, KAPAN, TUTUN pozisyonunu alın!`
                : `${drillTitles[params.drillType]} ${params.scheduledAt ? params.scheduledAt.toLocaleDateString('tr-TR') : 'bugün'} için planlandı.`,
            channelId: 'checkin',
            data: { type: 'drill_reminder', ...params },
        });
    }

    /**
     * ELITE: Send injured status notification (Critical Health Alert)
     * Notifies family members or emergency responders about injury status
     */
    async sendInjuredStatus(params: {
        memberName: string;
        severity: 'minor' | 'moderate' | 'severe' | 'critical';
        location?: { latitude: number; longitude: number };
        notes?: string;
        needsEvacuation?: boolean;
    }): Promise<string | null> {
        const severityConfig = {
            minor: { emoji: '🩹', title: 'Hafif Yaralanma', vibration: 'mesh' as const },
            moderate: { emoji: '⚠️', title: 'Orta Yaralanma', vibration: 'urgent' as const },
            severe: { emoji: '🚑', title: 'Ağır Yaralanma', vibration: 'sos' as const },
            critical: { emoji: '🆘', title: 'KRİTİK DURUM', vibration: 'earthquake' as const },
        };

        const config = severityConfig[params.severity];

        // Critical and severe trigger immediate vibration
        if (params.severity === 'critical' || params.severity === 'severe') {
            Vibration.vibrate(VIBRATION_PATTERNS[config.vibration]);
        }

        const locationText = params.location
            ? `\n📍 Konum: ${params.location.latitude.toFixed(5)}, ${params.location.longitude.toFixed(5)}`
            : '';

        const evacuationText = params.needsEvacuation
            ? '\n🚨 TAŞIMA GEREKİYOR!'
            : '';

        return this.schedule({
            title: `${config.emoji} ${config.title}: ${params.memberName}`,
            body: `${params.notes || 'Yaralı bildirimi'}${locationText}${evacuationText}`,
            channelId: params.severity === 'critical' ? 'earthquake' : 'sos',
            data: {
                type: 'injured_status',
                ...params, // severity already included in params
            },
        });
    }

    // ========================
    // CORE SCHEDULING
    // ========================

    /**
     * Schedule a notification
     */
    private async schedule(params: {
        title: string;
        body: string;
        channelId?: string;
        categoryIdentifier?: string;
        data?: Record<string, unknown>;
        sound?: string;
        trigger?: Notifications.NotificationTriggerInput;
    }): Promise<string | null> {
        try {
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title: params.title,
                    body: params.body,
                    data: params.data,
                    categoryIdentifier: params.categoryIdentifier,
                    sound: params.sound || 'default',
                },
                trigger: params.trigger || null,
            });

            logger.info('Notification scheduled:', id, params.title);
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
    }

    /**
     * Get push token
     */
    getPushToken(): string | null {
        return this.expoPushToken;
    }

    /**
     * Subscribe to topic (for FCM)
     */
    async subscribeToTopic(topic: string): Promise<void> {
        this.subscribedTopics.add(topic);
        await AsyncStorage.setItem('@afetnet/notification_topics',
            JSON.stringify([...this.subscribedTopics]));
        logger.info('Subscribed to topic:', topic);
    }

    /**
     * Unsubscribe from topic
     */
    async unsubscribeFromTopic(topic: string): Promise<void> {
        this.subscribedTopics.delete(topic);
        await AsyncStorage.setItem('@afetnet/notification_topics',
            JSON.stringify([...this.subscribedTopics]));
        logger.info('Unsubscribed from topic:', topic);
    }

    /**
     * Test notification
     */
    async sendTest(): Promise<string | null> {
        return this.schedule({
            title: '🧪 Test Bildirimi',
            body: 'AfetNet bildirim sistemi aktif ve çalışıyor!',
            data: { type: 'test' },
        });
    }
}

export const comprehensiveNotificationService = new ComprehensiveNotificationService();
