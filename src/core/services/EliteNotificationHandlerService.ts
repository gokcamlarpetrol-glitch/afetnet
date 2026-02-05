/**
 * ELITE NOTIFICATION HANDLER - PREMIUM UI INTEGRATION
 * 
 * Listens for all notification types and displays premium animated overlays
 * Integrates PremiumAnimatedNotification and EEWCountdownModal
 * 
 * FEATURES:
 * - Global notification listener
 * - Premium UI overlay management
 * - EEW countdown with cinematic effects
 * - Adaptive proximity-based alerts
 */

import { createLogger } from '../utils/logger';
import { DeviceEventEmitter, Platform, AppState, AppStateStatus } from 'react-native';

const logger = createLogger('EliteNotificationHandler');

// ============================================================
// TYPES
// ============================================================

interface EEWAlertData {
    type: 'EEW' | 'PWAVE' | 'TSUNAMI' | 'SOS' | 'FAMILY' | 'MESH';
    magnitude?: number;
    location?: string;
    warningSeconds?: number;
    source?: string;
    epicenter?: { latitude: number; longitude: number };
    epicentralDistance?: number;
}

interface NotificationUIState {
    visible: boolean;
    type: 'earthquake' | 'tsunami' | 'sos' | 'family_safe' | 'family_help' | 'mesh_message' | 'pwave' | 'countdown';
    title: string;
    message: string;
    countdown?: number;
    magnitude?: number;
}

// ============================================================
// ADAPTIVE PROXIMITY ALERT
// ============================================================

/**
 * ELITE: Calculate alert intensity based on proximity to epicenter
 * Closer = louder, more intense vibration
 */
function calculateAlertIntensity(epicentralDistance: number, magnitude: number): {
    volumeMultiplier: number;
    vibrationIntensity: 'critical' | 'high' | 'medium' | 'low';
    shouldBypassDND: boolean;
} {
    // Very close (0-50km) - Maximum intensity
    if (epicentralDistance <= 50) {
        return {
            volumeMultiplier: 1.0,
            vibrationIntensity: 'critical',
            shouldBypassDND: true,
        };
    }

    // Close (50-100km) - High intensity
    if (epicentralDistance <= 100) {
        return {
            volumeMultiplier: 0.9,
            vibrationIntensity: magnitude >= 5.0 ? 'critical' : 'high',
            shouldBypassDND: magnitude >= 5.0,
        };
    }

    // Medium (100-200km) - Medium intensity
    if (epicentralDistance <= 200) {
        return {
            volumeMultiplier: 0.7,
            vibrationIntensity: magnitude >= 5.5 ? 'high' : 'medium',
            shouldBypassDND: magnitude >= 5.5,
        };
    }

    // Far (200-500km) - Low intensity
    if (epicentralDistance <= 500) {
        return {
            volumeMultiplier: 0.5,
            vibrationIntensity: magnitude >= 6.0 ? 'high' : 'low',
            shouldBypassDND: magnitude >= 6.0,
        };
    }

    // Very far (500km+) - Minimal intensity
    return {
        volumeMultiplier: 0.3,
        vibrationIntensity: magnitude >= 6.5 ? 'medium' : 'low',
        shouldBypassDND: magnitude >= 7.0, // Only bypass for massive quakes
    };
}

// ============================================================
// ELITE NOTIFICATION HANDLER SERVICE
// ============================================================

class EliteNotificationHandlerService {
    private static instance: EliteNotificationHandlerService;
    private isInitialized = false;
    private currentUIState: NotificationUIState | null = null;
    private uiUpdateCallback: ((state: NotificationUIState | null) => void) | null = null;
    private appState: AppStateStatus = 'active';

    private constructor() { }

    static getInstance(): EliteNotificationHandlerService {
        if (!EliteNotificationHandlerService.instance) {
            EliteNotificationHandlerService.instance = new EliteNotificationHandlerService();
        }
        return EliteNotificationHandlerService.instance;
    }

    // ==================== INITIALIZATION ====================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Listen to app state changes
            AppState.addEventListener('change', this.handleAppStateChange);

            // Subscribe to EEW events from various sources
            this.subscribeToEEWEvents();

            // Subscribe to notification events
            this.subscribeToNotificationEvents();

            this.isInitialized = true;
            logger.info('✅ EliteNotificationHandler initialized');
        } catch (error) {
            logger.error('Failed to initialize EliteNotificationHandler:', error);
        }
    }

    // ==================== EVENT SUBSCRIPTIONS ====================

    private subscribeToEEWEvents(): void {
        // Listen to UltraFastEEW events
        DeviceEventEmitter.addListener('EEW_ALERT', (data: EEWAlertData) => {
            this.handleEEWAlert(data);
        });

        // Listen to countdown events
        DeviceEventEmitter.addListener('EEW_COUNTDOWN', (data: { seconds: number; magnitude: number }) => {
            this.showCountdownUI(data.seconds, data.magnitude);
        });

        // Listen to family alerts
        DeviceEventEmitter.addListener('FAMILY_ALERT', (data: { type: 'safe' | 'help'; memberName: string }) => {
            this.showFamilyAlert(data);
        });

        // Listen to mesh messages
        DeviceEventEmitter.addListener('MESH_MESSAGE', (data: { sender: string; message: string }) => {
            this.showMeshMessage(data);
        });
    }

    private subscribeToNotificationEvents(): void {
        // Listen to push notification received
        DeviceEventEmitter.addListener('PUSH_NOTIFICATION', async (notification: any) => {
            const data = notification.data || notification.request?.content?.data;
            if (data?.type === 'EEW') {
                this.handleEEWAlert({
                    type: 'EEW',
                    magnitude: parseFloat(data.magnitude) || 0,
                    location: data.location,
                    warningSeconds: parseInt(data.warningSeconds) || 0,
                    source: data.source,
                    epicentralDistance: parseFloat(data.epicentralDistance) || 0,
                });
            }
        });
    }

    // ==================== ALERT HANDLERS ====================

    private handleAppStateChange = (nextAppState: AppStateStatus): void => {
        this.appState = nextAppState;
    };

    private handleEEWAlert(data: EEWAlertData): void {
        const magnitude = data.magnitude || 0;
        const epicentralDistance = data.epicentralDistance || 100;

        // Calculate adaptive intensity
        const intensity = calculateAlertIntensity(epicentralDistance, magnitude);

        logger.info(`⚡ EEW Alert: M${magnitude.toFixed(1)}, ${epicentralDistance}km away, intensity: ${intensity.vibrationIntensity}`);

        // Show countdown if we have warning time
        if (data.warningSeconds && data.warningSeconds > 3) {
            this.showCountdownUI(data.warningSeconds, magnitude);
            return;
        }

        // Show immediate alert
        this.updateUIState({
            visible: true,
            type: data.type === 'TSUNAMI' ? 'tsunami' : data.type === 'PWAVE' ? 'pwave' : 'earthquake',
            title: magnitude >= 5.5 ? '🚨 ACİL DEPREM UYARISI!' : '⚠️ DEPREM UYARISI',
            message: `M${magnitude.toFixed(1)} - ${data.location || 'Türkiye'}\n${epicentralDistance.toFixed(0)}km uzaklıkta`,
            magnitude,
        });

        // Auto-dismiss after 15 seconds for non-countdown alerts
        setTimeout(() => {
            this.dismissUI();
        }, 15000);
    }

    private showCountdownUI(seconds: number, magnitude: number): void {
        this.updateUIState({
            visible: true,
            type: 'countdown',
            title: '🚨 DEPREM UYARISI!',
            message: 'ÇÖK - KAPAN - TUTUN!',
            countdown: seconds,
            magnitude,
        });
    }

    private showFamilyAlert(data: { type: 'safe' | 'help'; memberName: string }): void {
        this.updateUIState({
            visible: true,
            type: data.type === 'safe' ? 'family_safe' : 'family_help',
            title: data.type === 'safe' ? '✅ Aile Üyesi Güvende' : '🆘 Yardım İsteniyor',
            message: `${data.memberName} ${data.type === 'safe' ? 'güvende olduğunu bildirdi' : 'yardım istiyor!'}`,
        });

        // Auto-dismiss family safe after 10 seconds
        if (data.type === 'safe') {
            setTimeout(() => this.dismissUI(), 10000);
        }
    }

    private showMeshMessage(data: { sender: string; message: string }): void {
        this.updateUIState({
            visible: true,
            type: 'mesh_message',
            title: '📡 Mesh Mesajı',
            message: `${data.sender}: ${data.message}`,
        });

        // Auto-dismiss after 8 seconds
        setTimeout(() => this.dismissUI(), 8000);
    }

    // ==================== UI STATE MANAGEMENT ====================

    private updateUIState(state: NotificationUIState): void {
        this.currentUIState = state;
        if (this.uiUpdateCallback) {
            this.uiUpdateCallback(state);
        }

        // Also emit event for React components to listen
        DeviceEventEmitter.emit('PREMIUM_NOTIFICATION_STATE', state);
    }

    dismissUI(): void {
        this.currentUIState = null;
        if (this.uiUpdateCallback) {
            this.uiUpdateCallback(null);
        }
        DeviceEventEmitter.emit('PREMIUM_NOTIFICATION_STATE', null);
    }

    // ==================== PUBLIC API ====================

    /**
     * Register callback for UI state updates
     * Use this in your root component to show PremiumAnimatedNotification
     */
    onUIStateChange(callback: (state: NotificationUIState | null) => void): () => void {
        this.uiUpdateCallback = callback;

        // Return unsubscribe function
        return () => {
            this.uiUpdateCallback = null;
        };
    }

    /**
     * Get current UI state
     */
    getCurrentState(): NotificationUIState | null {
        return this.currentUIState;
    }

    /**
     * Manually trigger an alert (for testing)
     */
    triggerTestAlert(type: EEWAlertData['type'] = 'EEW'): void {
        this.handleEEWAlert({
            type,
            magnitude: 5.5,
            location: 'Test Lokasyonu',
            warningSeconds: 10,
            epicentralDistance: 75,
            source: 'TEST',
        });
    }

    /**
     * Calculate alert intensity for a given distance and magnitude
     */
    getAlertIntensity(epicentralDistance: number, magnitude: number) {
        return calculateAlertIntensity(epicentralDistance, magnitude);
    }
}

export const eliteNotificationHandler = EliteNotificationHandlerService.getInstance();
export { calculateAlertIntensity };
export type { EEWAlertData, NotificationUIState };
