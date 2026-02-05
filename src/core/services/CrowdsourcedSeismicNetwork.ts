/**
 * CROWDSOURCED SEISMIC NETWORK - TÜRKIYE ÇAPINDA AĞLA
 * 
 * 🌐 MİLYONLARCA TELEFON = DEV SİSMOMETRE AĞI
 * 
 * Firebase Realtime Database ile kullanıcıların algılamalarını
 * birleştirerek daha güvenilir ve hızlı deprem tespiti.
 * 
 * ELITE FEATURES:
 * - Real-time user detection pooling
 * - Geographic cluster detection
 * - Cross-device verification
 * - False positive filtering
 * - Magnitude estimation from network data
 * 
 * WORKFLOW:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  User Device → Firebase → Cloud Function → FCM → All Users  │
 * └──────────────────────────────────────────────────────────────┘
 * 
 * @version 1.0.0
 * @elite true
 * @lifesaving true
 */

import { Platform } from 'react-native';
import { getDatabase, ref, push, onValue, serverTimestamp, query, orderByChild, limitToLast, off } from 'firebase/database';
import { getApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';
import { firebaseAnalyticsService } from './FirebaseAnalyticsService';
import { ultraFastEEWNotification } from './UltraFastEEWNotification';
import { SeismicWaveCalculator } from '../utils/SeismicWaveCalculator';

const logger = createLogger('CrowdsourcedSeismicNetwork');

// ============================================================
// TYPES
// ============================================================

export interface SeismicReport {
    id?: string;
    userId: string;
    timestamp: number;
    location: {
        latitude: number;
        longitude: number;
        accuracy: number;
    };
    detection: {
        peakAcceleration: number;
        confidence: number;
        duration: number;
    };
    deviceInfo: {
        platform: string;
        model?: string;
    };
    serverTimestamp?: object;
}

export interface ClusterEvent {
    id: string;
    epicenter: {
        latitude: number;
        longitude: number;
    };
    reports: SeismicReport[];
    estimatedMagnitude: number;
    confidence: number;
    firstReportTime: number;
    lastUpdateTime: number;
    status: 'pending' | 'confirmed' | 'dismissed';
}

interface NetworkConfig {
    /** Minimum reports to form a cluster */
    minReportsForCluster: number;
    /** Maximum distance (km) for same cluster */
    maxClusterRadius: number;
    /** Time window for clustering (ms) */
    clusterTimeWindow: number;
    /** Minimum confidence to report */
    minReportConfidence: number;
    /** Minimum confidence to alert */
    minAlertConfidence: number;
}

// ============================================================
// CONSTANTS
// ============================================================

// ELITE: Optimized for Deprem Ağı-level speed!
// Lower thresholds = faster alerts = more lives saved
const DEFAULT_CONFIG: NetworkConfig = {
    minReportsForCluster: 2,       // ELITE: Need only 2 phones to confirm (was 3)
    maxClusterRadius: 150,         // 150km radius (wider for rural areas)
    clusterTimeWindow: 30000,      // ELITE: 30 second window (was 60s) - faster detection!
    minReportConfidence: 0.4,      // ELITE: 40% to report (was 50%) - catch more events
    minAlertConfidence: 0.6,       // ELITE: 60% to alert users (was 70%) - faster alerts!
};

const STORAGE_KEYS = {
    USER_ID: '@afetnet_crowdsource_uid',
    CONFIG: '@afetnet_crowdsource_config',
};

const DB_PATHS = {
    REPORTS: 'seismic_reports',
    CLUSTERS: 'earthquake_clusters',
    ACTIVE_EVENTS: 'active_events',
};

// ============================================================
// CROWDSOURCED SEISMIC NETWORK CLASS
// ============================================================

class CrowdsourcedSeismicNetworkService {
    private isRunning = false;
    private config: NetworkConfig = DEFAULT_CONFIG;
    private userId: string = '';
    private userLocation: { latitude: number; longitude: number } | null = null;
    private reportsListener: (() => void) | null = null;
    private clustersListener: (() => void) | null = null;
    private recentClusters: Map<string, ClusterEvent> = new Map();
    private alertedClusters: Set<string> = new Set();

    // ==================== INITIALIZATION ====================

    /**
     * Initialize the crowdsourced network
     */
    async initialize(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Network already running');
            return;
        }

        logger.info('🌐 Initializing Crowdsourced Seismic Network...');

        // Load or generate user ID
        await this.ensureUserId();

        // Get user location
        await this.updateUserLocation();

        // Start listening for cluster events
        this.startListeningForEvents();

        this.isRunning = true;
        logger.info('✅ Crowdsourced Seismic Network initialized');

        firebaseAnalyticsService.logEvent('crowdsource_network_initialized', {
            user_id: this.userId.substring(0, 8),
        });
    }

    /**
     * Stop the network
     */
    stop(): void {
        if (!this.isRunning) return;

        // Remove listeners
        if (this.reportsListener) {
            this.reportsListener();
            this.reportsListener = null;
        }
        if (this.clustersListener) {
            this.clustersListener();
            this.clustersListener = null;
        }

        this.isRunning = false;
        logger.info('Crowdsourced network stopped');
    }

    // ==================== REPORT SUBMISSION ====================

    /**
     * Report a detected seismic event to the network
     * Called when OnDeviceSeismicDetector triggers
     */
    async reportDetection(
        peakAcceleration: number,
        confidence: number,
        duration: number
    ): Promise<boolean> {
        if (!this.isRunning) {
            logger.warn('Network not initialized');
            return false;
        }

        // Skip low confidence detections
        if (confidence < this.config.minReportConfidence) {
            logger.debug(`Skipping low confidence report: ${(confidence * 100).toFixed(1)}%`);
            return false;
        }

        // Ensure we have location
        if (!this.userLocation) {
            await this.updateUserLocation();
            if (!this.userLocation) {
                logger.warn('Cannot report without location');
                return false;
            }
        }

        try {
            const db = getDatabase(getApp(), 'https://afetnet-4a6b6-default-rtdb.europe-west1.firebasedatabase.app');
            const reportsRef = ref(db, DB_PATHS.REPORTS);

            const report: SeismicReport = {
                userId: this.userId,
                timestamp: Date.now(),
                location: {
                    latitude: this.userLocation.latitude,
                    longitude: this.userLocation.longitude,
                    accuracy: 50, // Approximate
                },
                detection: {
                    peakAcceleration,
                    confidence,
                    duration,
                },
                deviceInfo: {
                    platform: Platform.OS,
                },
                serverTimestamp: serverTimestamp(),
            };

            await push(reportsRef, report);

            logger.info(`📤 Seismic report submitted: ${(confidence * 100).toFixed(1)}% confidence`);

            firebaseAnalyticsService.logEvent('seismic_report_submitted', {
                confidence,
                peak_acceleration: peakAcceleration,
            });

            return true;
        } catch (error) {
            logger.error('Failed to submit report:', error);
            return false;
        }
    }

    // ==================== EVENT LISTENING ====================

    /**
     * Start listening for earthquake cluster events
     */
    private startListeningForEvents(): void {
        try {
            const db = getDatabase(getApp(), 'https://afetnet-4a6b6-default-rtdb.europe-west1.firebasedatabase.app');

            // Listen for active earthquake events
            const activeEventsRef = ref(db, DB_PATHS.ACTIVE_EVENTS);
            const activeQuery = query(activeEventsRef, orderByChild('lastUpdateTime'), limitToLast(10));

            this.clustersListener = onValue(activeQuery, (snapshot) => {
                if (!snapshot.exists()) return;

                snapshot.forEach((child) => {
                    const event = child.val() as ClusterEvent;
                    event.id = child.key || '';
                    this.handleClusterEvent(event);
                });
            }, (error) => {
                logger.error('Error listening to events:', error);
            }) as unknown as () => void;

            logger.debug('Started listening for earthquake events');
        } catch (error) {
            logger.error('Failed to start event listener:', error);
        }
    }

    /**
     * Handle incoming cluster event
     */
    private async handleClusterEvent(event: ClusterEvent): Promise<void> {
        // Skip if already alerted
        if (this.alertedClusters.has(event.id)) {
            return;
        }

        // Skip if not confirmed or low confidence
        if (event.status !== 'confirmed' || event.confidence < this.config.minAlertConfidence) {
            return;
        }

        // Skip old events (> 5 minutes)
        if (Date.now() - event.firstReportTime > 5 * 60 * 1000) {
            return;
        }

        logger.warn(`🚨 CROWDSOURCED EARTHQUAKE DETECTED: M${event.estimatedMagnitude.toFixed(1)}`);

        // Mark as alerted
        this.alertedClusters.add(event.id);

        // Calculate warning time if we have location
        let warningSeconds = 0;
        let distance = 0;

        if (this.userLocation) {
            distance = SeismicWaveCalculator.calculateDistance(
                event.epicenter.latitude,
                event.epicenter.longitude,
                this.userLocation.latitude,
                this.userLocation.longitude
            );

            // S-wave at 3.5 km/s
            const elapsed = (Date.now() - event.firstReportTime) / 1000;
            warningSeconds = Math.max(0, Math.round((distance / 3.5) - elapsed));
        }

        // Send notification
        await ultraFastEEWNotification.sendEEWNotification({
            magnitude: event.estimatedMagnitude,
            location: `Crowdsourced (${event.reports.length} rapor)`,
            warningSeconds,
            estimatedIntensity: SeismicWaveCalculator.calculateIntensity(event.estimatedMagnitude, distance),
            epicentralDistance: distance,
            source: 'CROWDSOURCED' as any,
            epicenter: event.epicenter,
        });

        firebaseAnalyticsService.logEvent('crowdsourced_alert_triggered', {
            event_id: event.id,
            report_count: event.reports.length,
            estimated_magnitude: event.estimatedMagnitude,
            confidence: event.confidence,
        });
    }

    // ==================== CLUSTER DETECTION (LOCAL) ====================

    /**
     * Local cluster detection for when Cloud Functions are unavailable
     * This runs on-device as a backup
     */
    detectLocalCluster(reports: SeismicReport[]): ClusterEvent | null {
        if (reports.length < this.config.minReportsForCluster) {
            return null;
        }

        // Filter recent reports
        const now = Date.now();
        const recentReports = reports.filter(
            r => now - r.timestamp < this.config.clusterTimeWindow
        );

        if (recentReports.length < this.config.minReportsForCluster) {
            return null;
        }

        // Calculate centroid
        const avgLat = recentReports.reduce((sum, r) => sum + r.location.latitude, 0) / recentReports.length;
        const avgLon = recentReports.reduce((sum, r) => sum + r.location.longitude, 0) / recentReports.length;

        // Check if all reports are within cluster radius
        const allWithinRadius = recentReports.every(r => {
            const dist = SeismicWaveCalculator.calculateDistance(
                avgLat, avgLon,
                r.location.latitude, r.location.longitude
            );
            return dist <= this.config.maxClusterRadius;
        });

        if (!allWithinRadius) {
            return null;
        }

        // Calculate average metrics
        const avgConfidence = recentReports.reduce((sum, r) => sum + r.detection.confidence, 0) / recentReports.length;
        const maxAccel = Math.max(...recentReports.map(r => r.detection.peakAcceleration));

        // Estimate magnitude from peak acceleration
        const estimatedMagnitude = this.estimateMagnitudeFromNetwork(maxAccel, recentReports.length);

        const cluster: ClusterEvent = {
            id: `local_${Date.now()}`,
            epicenter: { latitude: avgLat, longitude: avgLon },
            reports: recentReports,
            estimatedMagnitude,
            confidence: avgConfidence,
            firstReportTime: Math.min(...recentReports.map(r => r.timestamp)),
            lastUpdateTime: now,
            status: avgConfidence >= this.config.minAlertConfidence ? 'confirmed' : 'pending',
        };

        return cluster;
    }

    /**
     * Estimate magnitude from network data
     */
    private estimateMagnitudeFromNetwork(maxAccelG: number, reportCount: number): number {
        // Base estimate from acceleration
        const pgaCmS2 = maxAccelG * 980.665;
        let magnitude = Math.log10(Math.max(1, pgaCmS2)) + 2.5;

        // Boost confidence with more reports
        if (reportCount >= 10) magnitude += 0.3;
        else if (reportCount >= 5) magnitude += 0.2;

        return Math.max(3.0, Math.min(8.0, magnitude));
    }

    // ==================== HELPERS ====================

    private async ensureUserId(): Promise<void> {
        try {
            let saved = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
            if (!saved) {
                saved = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, saved);
            }
            this.userId = saved;
        } catch (e) {
            this.userId = `temp_${Date.now()}`;
        }
    }

    private async updateUserLocation(): Promise<void> {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            this.userLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };
        } catch (e) {
            logger.debug('Failed to get location');
        }
    }

    // ==================== PUBLIC API ====================

    /**
     * Set user location manually
     */
    setUserLocation(latitude: number, longitude: number): void {
        this.userLocation = { latitude, longitude };
    }

    /**
     * Check if network is running
     */
    getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Get recent cluster events
     */
    getRecentClusters(): ClusterEvent[] {
        return Array.from(this.recentClusters.values());
    }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const crowdsourcedSeismicNetwork = new CrowdsourcedSeismicNetworkService();

// ============================================================
// REACT HOOK
// ============================================================

import { useEffect, useState } from 'react';

export function useCrowdsourcedSeismicNetwork() {
    const [isRunning, setIsRunning] = useState(false);
    const [clusters, setClusters] = useState<ClusterEvent[]>([]);

    useEffect(() => {
        crowdsourcedSeismicNetwork.initialize().then(() => {
            setIsRunning(true);
        });

        // Update clusters periodically
        const interval = setInterval(() => {
            setClusters(crowdsourcedSeismicNetwork.getRecentClusters());
        }, 5000);

        return () => {
            clearInterval(interval);
        };
    }, []);

    return {
        isRunning,
        clusters,
        reportDetection: (accel: number, conf: number, dur: number) =>
            crowdsourcedSeismicNetwork.reportDetection(accel, conf, dur),
    };
}
