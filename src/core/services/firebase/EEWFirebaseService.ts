/**
 * EEW FIREBASE SERVICE - ELITE EDITION
 * 
 * Ana EEW Firebase servisi - tüm EEW Firebase operasyonlarını yönetir
 * 
 * FEATURES:
 * - Real-time P-wave crowdsourcing
 * - EEW broadcast subscription
 * - History cloud sync
 * - Consensus building
 * - Analytics
 * 
 * @version 1.0.0
 * @elite true
 */

import { createLogger } from '../../utils/logger';
import { firebaseDataService } from '../FirebaseDataService';
import { seismicSensorService } from '../SeismicSensorService';
import { useEEWHistoryStore } from '../../stores/eewHistoryStore';
import * as Location from 'expo-location';
import {
    savePWaveDetection,
    subscribeToPWaveDetections,
    createEEWBroadcast,
    subscribeToEEWBroadcasts,
    saveEEWHistoryEntry,
    syncEEWHistory,
    updatePWaveConsensus,
    getActivePWaveConsensus,
    logEEWAnalytics,
    type PWaveDetection,
    type EEWBroadcast,
    type PWaveConsensus,
} from './FirebaseEEWOperations';

const logger = createLogger('EEWFirebaseService');

// ============================================================
// EEW FIREBASE SERVICE
// ============================================================

class EEWFirebaseService {
    private isRunning = false;
    private pWaveUnsubscribe: (() => void) | null = null;
    private broadcastUnsubscribe: (() => void) | null = null;
    private detectionUnsubscribe: (() => void) | null = null;
    private syncInterval: NodeJS.Timeout | null = null;
    private consensusInterval: NodeJS.Timeout | null = null;

    private userLocation: { latitude: number; longitude: number } | null = null;
    private deviceId: string = '';

    private pendingDetections: PWaveDetection[] = [];
    private consensusThreshold = 3; // Minimum device count for consensus

    private onEEWBroadcastCallbacks: ((broadcast: EEWBroadcast) => void)[] = [];

    // ==================== LIFECYCLE ====================

    /**
     * Start EEW Firebase service
     */
    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        logger.info('🔥 Starting EEW Firebase Service');

        // Get device ID
        try {
            const Constants = require('expo-constants');
            this.deviceId = Constants.installationId || `device-${Date.now()}`;
        } catch {
            this.deviceId = `device-${Date.now()}`;
        }

        // Get user location
        await this.updateUserLocation();

        // Wait for Firebase initialization
        await this.waitForFirebase();

        // Start subscriptions
        this.startPWaveSubscription();
        this.startBroadcastSubscription();
        this.startSeismicDetectionListener();
        this.startHistorySync();
        this.startConsensusCheck();

        logger.info('✅ EEW Firebase Service started');
    }

    /**
     * Stop EEW Firebase service
     */
    stop(): void {
        if (!this.isRunning) return;
        this.isRunning = false;

        logger.info('🛑 Stopping EEW Firebase Service');

        // Unsubscribe from all listeners
        if (this.pWaveUnsubscribe) {
            this.pWaveUnsubscribe();
            this.pWaveUnsubscribe = null;
        }

        if (this.broadcastUnsubscribe) {
            this.broadcastUnsubscribe();
            this.broadcastUnsubscribe = null;
        }

        if (this.detectionUnsubscribe) {
            this.detectionUnsubscribe();
            this.detectionUnsubscribe = null;
        }

        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        if (this.consensusInterval) {
            clearInterval(this.consensusInterval);
            this.consensusInterval = null;
        }
    }

    /**
     * Subscribe to EEW broadcasts
     */
    onEEWBroadcast(callback: (broadcast: EEWBroadcast) => void): () => void {
        this.onEEWBroadcastCallbacks.push(callback);
        return () => {
            const index = this.onEEWBroadcastCallbacks.indexOf(callback);
            if (index > -1) this.onEEWBroadcastCallbacks.splice(index, 1);
        };
    }

    // ==================== PRIVATE METHODS ====================

    private async waitForFirebase(): Promise<void> {
        // Wait up to 10 seconds for Firebase to initialize
        for (let i = 0; i < 20; i++) {
            if (firebaseDataService.isInitialized) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        logger.warn('Firebase not initialized after 10s, continuing anyway');
    }

    private async updateUserLocation(): Promise<void> {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                logger.warn('Location permission not granted');
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            this.userLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            logger.debug(`User location: ${this.userLocation.latitude}, ${this.userLocation.longitude}`);
        } catch (error) {
            logger.warn('Failed to get user location:', error);
        }
    }

    /**
     * Subscribe to nearby P-wave detections
     */
    private startPWaveSubscription(): void {
        if (!this.userLocation) {
            logger.debug('No user location, skipping P-wave subscription');
            return;
        }

        this.pWaveUnsubscribe = subscribeToPWaveDetections(
            this.userLocation.latitude,
            this.userLocation.longitude,
            150, // 150km radius
            (detections) => this.handleNearbyPWaveDetections(detections),
            firebaseDataService.isInitialized,
        ) || null;

        logger.info('📡 Subscribed to nearby P-wave detections');
    }

    /**
     * Subscribe to EEW broadcasts
     */
    private startBroadcastSubscription(): void {
        this.broadcastUnsubscribe = subscribeToEEWBroadcasts(
            (broadcasts) => this.handleEEWBroadcasts(broadcasts),
            firebaseDataService.isInitialized,
        ) || null;

        logger.info('🚨 Subscribed to EEW broadcasts');
    }

    /**
     * Listen to local seismic detections and upload to Firebase
     */
    private startSeismicDetectionListener(): void {
        this.detectionUnsubscribe = seismicSensorService.onDetection(async (event) => {
            // Only upload high-confidence P-wave detections
            if (event.type === 'P-WAVE' && event.confidence > 75 && this.userLocation) {
                const detection: PWaveDetection = {
                    deviceId: this.deviceId,
                    timestamp: event.timestamp,
                    latitude: this.userLocation.latitude,
                    longitude: this.userLocation.longitude,
                    accuracy: 100, // meters
                    magnitude: event.magnitude,
                    frequency: event.frequency,
                    confidence: event.confidence,
                    staltaRatio: event.stalta,
                };

                // Save to Firebase
                await savePWaveDetection(detection, firebaseDataService.isInitialized);

                // Add to pending for consensus
                this.pendingDetections.push(detection);

                // Log analytics
                await logEEWAnalytics('detection', {
                    type: 'P-WAVE',
                    magnitude: event.magnitude,
                    confidence: event.confidence,
                }, firebaseDataService.isInitialized);
            }
        });

        logger.info('🌊 Listening to local seismic detections');
    }

    /**
     * Periodically sync EEW history to cloud
     */
    private startHistorySync(): void {
        // Sync every 5 minutes
        this.syncInterval = setInterval(async () => {
            try {
                const userId = await this.getUserId();
                if (!userId) return;

                const localEvents = useEEWHistoryStore.getState().events;
                const eewEntries = localEvents.map(e => ({
                    userId,
                    magnitude: e.magnitude,
                    location: e.location,
                    latitude: e.latitude,
                    longitude: e.longitude,
                    depth: e.depth,
                    warningTime: e.warningTime,
                    estimatedIntensity: e.estimatedIntensity,
                    epicentralDistance: e.epicentralDistance,
                    source: e.source,
                    wasNotified: e.wasNotified,
                    timestamp: e.timestamp,
                }));

                await syncEEWHistory(userId, eewEntries, firebaseDataService.isInitialized);
            } catch (error) {
                logger.debug('History sync error:', error);
            }
        }, 5 * 60 * 1000);

        logger.info('📤 EEW history sync scheduled');
    }

    /**
     * Check for P-wave consensus periodically
     */
    private startConsensusCheck(): void {
        this.consensusInterval = setInterval(async () => {
            await this.checkAndBuildConsensus();
        }, 5000); // Check every 5 seconds

        logger.info('🎯 Consensus check scheduled');
    }

    /**
     * Handle nearby P-wave detections from other devices
     */
    private handleNearbyPWaveDetections(detections: PWaveDetection[]): void {
        logger.info(`📡 Received ${detections.length} P-wave detections from nearby devices`);

        // Check if we have enough for consensus
        if (detections.length >= this.consensusThreshold) {
            logger.warn(`⚠️ CROWDSOURCED ALERT: ${detections.length} devices detected P-waves!`);

            // Calculate center and average
            const avgLat = detections.reduce((sum, d) => sum + d.latitude, 0) / detections.length;
            const avgLon = detections.reduce((sum, d) => sum + d.longitude, 0) / detections.length;
            const avgConfidence = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;
            const avgMagnitude = detections.reduce((sum, d) => sum + d.magnitude, 0) / detections.length;

            // Create consensus
            const consensus: Omit<PWaveConsensus, 'id' | 'createdAt' | 'updatedAt'> = {
                centerLatitude: avgLat,
                centerLongitude: avgLon,
                radiusKm: 100,
                detectionCount: detections.length,
                deviceIds: detections.map(d => d.deviceId),
                avgConfidence,
                avgMagnitude,
                firstDetectionAt: Math.min(...detections.map(d => d.timestamp)),
                lastDetectionAt: Math.max(...detections.map(d => d.timestamp)),
                isConfirmed: avgConfidence > 80,
            };

            // Update consensus in Firebase
            updatePWaveConsensus(consensus, firebaseDataService.isInitialized);

            // If high confidence, create a crowdsourced EEW broadcast
            if (avgConfidence > 85 && detections.length >= 5) {
                this.createCrowdsourcedBroadcast(consensus);
            }
        }
    }

    /**
     * Handle EEW broadcasts
     */
    private handleEEWBroadcasts(broadcasts: EEWBroadcast[]): void {
        for (const broadcast of broadcasts) {
            logger.warn(`🚨 EEW BROADCAST: M${broadcast.magnitude} ${broadcast.location}`);

            // Notify callbacks
            for (const callback of this.onEEWBroadcastCallbacks) {
                try {
                    callback(broadcast);
                } catch (error) {
                    logger.error('EEW broadcast callback error:', error);
                }
            }

            // Log analytics
            logEEWAnalytics('broadcast_received', {
                magnitude: broadcast.magnitude,
                source: broadcast.source,
                severity: broadcast.severity,
            }, firebaseDataService.isInitialized);
        }
    }

    /**
     * Check and build consensus from pending detections
     */
    private async checkAndBuildConsensus(): Promise<void> {
        // Clean old detections (older than 30 seconds)
        const now = Date.now();
        this.pendingDetections = this.pendingDetections.filter(
            d => now - d.timestamp < 30000
        );

        // Check for active consensus clusters
        const consensusList = await getActivePWaveConsensus(firebaseDataService.isInitialized);

        for (const consensus of consensusList) {
            if (consensus.detectionCount >= this.consensusThreshold && !consensus.isConfirmed) {
                logger.info(`🎯 Found active consensus with ${consensus.detectionCount} devices`);
            }
        }
    }

    /**
     * Create a crowdsourced EEW broadcast
     */
    private async createCrowdsourcedBroadcast(
        consensus: Omit<PWaveConsensus, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<void> {
        logger.warn('🌐 Creating crowdsourced EEW broadcast!');

        // Estimate magnitude from G-force (rough approximation)
        const estimatedMagnitude = Math.min(7.0, 4.0 + Math.log10(consensus.avgMagnitude * 100));

        const broadcast: Omit<EEWBroadcast, 'id' | 'createdAt' | 'updatedAt'> = {
            magnitude: estimatedMagnitude,
            latitude: consensus.centerLatitude,
            longitude: consensus.centerLongitude,
            depth: 10, // Assumed
            location: 'Crowdsourced Detection',
            originTime: consensus.firstDetectionAt,
            detectedAt: Date.now(),
            source: 'CROWDSOURCED',
            isActive: true,
            severity: estimatedMagnitude >= 6 ? 'critical' : estimatedMagnitude >= 5 ? 'high' : 'medium',
        };

        await createEEWBroadcast(broadcast, firebaseDataService.isInitialized);
    }

    /**
     * Get current user ID
     */
    private async getUserId(): Promise<string | null> {
        try {
            const { getAuth } = await import('firebase/auth');
            const auth = getAuth();
            return auth.currentUser?.uid || null;
        } catch {
            return null;
        }
    }
}

// Export singleton
export const eewFirebaseService = new EEWFirebaseService();
