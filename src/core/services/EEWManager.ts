/**
 * EEW MANAGER - Unified EEW System Controller
 * 
 * ELITE: Central manager for all EEW (Early Earthquake Warning) subsystems
 * 
 * CONSOLIDATES:
 * - EEWService (AFAD polling, WebSocket)
 * - MultiSourceEEWService (AFAD + Kandilli + USGS + EMSC)
 * - OnDeviceEEWService (Device sensor P-wave)
 * - EEWFirebaseService (Crowdsourced consensus)
 * - EEWCountdownEngine (User-facing countdown)
 * 
 * @usage
 * import { eewManager } from '@/core/services/EEWManager';
 * await eewManager.initialize();
 * 
 * @version 1.0.0
 * @elite true
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('EEWManager');

// ============================================================
// TYPES
// ============================================================

export interface EEWManagerConfig {
    /** Enable multi-source data aggregation */
    enableMultiSource?: boolean;

    /** Enable on-device seismic detection */
    enableOnDevice?: boolean;

    /** Enable Firebase crowdsourced EEW */
    enableFirebase?: boolean;

    /** Minimum magnitude to trigger notifications */
    minMagnitude?: number;

    /** Auto-start on initialization */
    autoStart?: boolean;
}

export interface EEWManagerStatus {
    isInitialized: boolean;
    isRunning: boolean;
    services: {
        eewService: boolean;
        multiSource: boolean;
        onDevice: boolean;
        firebase: boolean;
        countdown: boolean;
    };
    lastEvent: {
        magnitude?: number;
        location?: string;
        timestamp?: number;
    } | null;
    stats: {
        eventsProcessed: number;
        alertsTriggered: number;
        uptime: number;
    };
}

// ============================================================
// DEFAULT CONFIG
// ============================================================

const DEFAULT_CONFIG: Required<EEWManagerConfig> = {
    enableMultiSource: true,
    enableOnDevice: true,
    enableFirebase: true,
    minMagnitude: 3.0,
    autoStart: false,
};

// ============================================================
// EEW MANAGER CLASS
// ============================================================

class EEWManager {
    private config: Required<EEWManagerConfig> = DEFAULT_CONFIG;
    private isInitialized = false;
    private isRunning = false;
    private startTime = 0;

    private eventsProcessed = 0;
    private alertsTriggered = 0;
    private lastEvent: EEWManagerStatus['lastEvent'] = null;

    // Service references (lazy loaded)
    private eewServiceRef: typeof import('./EEWService').eewService | null = null;
    private multiSourceRef: typeof import('./MultiSourceEEWService').multiSourceEEWService | null = null;
    private onDeviceRef: typeof import('./seismic/OnDeviceEEWService').onDeviceEEWService | null = null;
    private firebaseRef: typeof import('./firebase/EEWFirebaseService').eewFirebaseService | null = null;
    private countdownRef: typeof import('./EEWCountdownEngine').eewCountdownEngine | null = null;

    // ==================== INITIALIZATION ====================

    /**
     * Initialize the EEW Manager
     */
    async initialize(config?: EEWManagerConfig): Promise<void> {
        if (this.isInitialized) {
            logger.debug('EEW Manager already initialized');
            return;
        }

        logger.info('🚨 Initializing EEW Manager...');

        // Merge config
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Lazy load services
        await this.loadServices();

        this.isInitialized = true;
        logger.info('✅ EEW Manager initialized');

        // Auto-start if configured
        if (this.config.autoStart) {
            await this.start();
        }
    }

    /**
     * Load all EEW services
     */
    private async loadServices(): Promise<void> {
        try {
            // Core EEW Service
            const { eewService } = await import('./EEWService');
            this.eewServiceRef = eewService;

            // Multi-source (if enabled)
            if (this.config.enableMultiSource) {
                try {
                    const { multiSourceEEWService } = await import('./MultiSourceEEWService');
                    this.multiSourceRef = multiSourceEEWService;
                } catch (e) {
                    logger.debug('Multi-source service not available');
                }
            }

            // On-device detection (if enabled)
            if (this.config.enableOnDevice) {
                try {
                    const { onDeviceEEWService } = await import('./seismic/OnDeviceEEWService');
                    this.onDeviceRef = onDeviceEEWService;
                } catch (e) {
                    logger.debug('On-device service not available');
                }
            }

            // Firebase crowdsourcing (if enabled)
            if (this.config.enableFirebase) {
                try {
                    const { eewFirebaseService } = await import('./firebase/EEWFirebaseService');
                    this.firebaseRef = eewFirebaseService;
                } catch (e) {
                    logger.debug('Firebase EEW service not available');
                }
            }

            // Countdown engine
            try {
                const { eewCountdownEngine } = await import('./EEWCountdownEngine');
                this.countdownRef = eewCountdownEngine;
            } catch (e) {
                logger.debug('Countdown engine not available');
            }

        } catch (error) {
            logger.error('Failed to load EEW services:', error);
        }
    }

    // ==================== LIFECYCLE ====================

    /**
     * Start all EEW services
     */
    async start(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.isRunning) {
            logger.debug('EEW Manager already running');
            return;
        }

        logger.info('🚀 Starting EEW services...');
        this.startTime = Date.now();
        this.isRunning = true;

        // Start core EEW service
        if (this.eewServiceRef) {
            await this.eewServiceRef.start();
        }

        // Start multi-source
        if (this.multiSourceRef) {
            await this.multiSourceRef.start();
        }

        // Start on-device
        if (this.onDeviceRef) {
            await this.onDeviceRef.start();
        }

        // Start Firebase
        if (this.firebaseRef) {
            await this.firebaseRef.start();
        }

        logger.info('✅ All EEW services started');
    }

    /**
     * Stop all EEW services
     */
    stop(): void {
        if (!this.isRunning) return;

        logger.info('🛑 Stopping EEW services...');

        // Stop all services
        if (this.eewServiceRef) {
            this.eewServiceRef.stop();
        }

        if (this.multiSourceRef) {
            this.multiSourceRef.stop();
        }

        if (this.firebaseRef) {
            this.firebaseRef.stop();
        }

        if (this.countdownRef) {
            this.countdownRef.stopCountdown();
        }

        this.isRunning = false;
        logger.info('✅ All EEW services stopped');
    }

    // ==================== STATUS ====================

    /**
     * Get current EEW Manager status
     */
    getStatus(): EEWManagerStatus {
        const uptime = this.isRunning ? Date.now() - this.startTime : 0;

        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            services: {
                eewService: this.eewServiceRef !== null,
                multiSource: this.multiSourceRef !== null,
                onDevice: this.onDeviceRef !== null,
                firebase: this.firebaseRef !== null,
                countdown: this.countdownRef !== null,
            },
            lastEvent: this.lastEvent,
            stats: {
                eventsProcessed: this.eventsProcessed,
                alertsTriggered: this.alertsTriggered,
                uptime,
            },
        };
    }

    // ==================== HELPERS ====================

    /**
     * Track processed event
     */
    trackEvent(magnitude?: number, location?: string): void {
        this.eventsProcessed++;
        this.lastEvent = {
            magnitude,
            location,
            timestamp: Date.now(),
        };
    }

    /**
     * Track triggered alert
     */
    trackAlert(): void {
        this.alertsTriggered++;
    }

    /**
     * Get countdown engine reference
     */
    getCountdownEngine() {
        return this.countdownRef;
    }

    /**
     * Get core EEW service reference
     */
    getEEWService() {
        return this.eewServiceRef;
    }

    /**
     * Get multi-source service reference
     */
    getMultiSourceService() {
        return this.multiSourceRef;
    }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const eewManager = new EEWManager();
