/**
 * PLUM EEW SERVICE - ELITE EDITION
 * 
 * Propagation of Local Undamped Motion (PLUM) Algorithm
 * Based on JMA's 2024 methodology
 * 
 * FEATURES:
 * - Direct intensity estimation from nearby stations
 * - Distance-weighted intensity averaging
 * - Real-time peer intensity sharing
 * - No epicenter estimation required
 * - Works better for large/complex earthquakes
 * 
 * METHODOLOGY:
 * Instead of estimating epicenter + magnitude → intensity,
 * PLUM directly uses observed intensity at nearby points
 * to predict intensity at the target location.
 * 
 * @version 1.0.0
 * @elite true
 * @lifesaving true
 */

import { createLogger } from '../utils/logger';
import { calculateDistance } from '../utils/locationUtils';
import { firebaseDataService } from './FirebaseDataService';

const logger = createLogger('PLUMEEWService');

// ============================================================
// TYPES
// ============================================================

export interface PLUMObservation {
    deviceId: string;
    latitude: number;
    longitude: number;
    timestamp: number;
    intensity: number; // MMI scale
    peakAcceleration: number; // g
    peakVelocity: number; // cm/s
    confidence: number; // 0-100
}

export interface PLUMPrediction {
    targetLatitude: number;
    targetLongitude: number;
    predictedIntensity: number;
    confidence: number;
    usedObservations: number;
    estimatedArrivalSeconds: number;
    warningTime: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const PLUM_RADIUS_KM = 30; // JMA uses 30km radius
const S_WAVE_VELOCITY = 3.5; // km/s (average S-wave velocity)
const P_WAVE_VELOCITY = 6.0; // km/s (average P-wave velocity)
const MIN_OBSERVATIONS = 2; // Minimum observations for prediction
const MAX_OBSERVATION_AGE_MS = 60000; // 60 seconds
const MAX_OBSERVATIONS = 50; // Firestore + in-memory cap to control burst load

// Intensity attenuation coefficients (simplified)
const ATTENUATION_A = 0.0; // Geometric spreading
const ATTENUATION_B = 0.005; // Anelastic attenuation

// ============================================================
// PLUM EEW SERVICE
// ============================================================

class PLUMEEWService {
    private isRunning = false;
    private observations: Map<string, PLUMObservation> = new Map();
    private userLocation: { latitude: number; longitude: number } | null = null;
    private predictionCallbacks: ((prediction: PLUMPrediction) => void)[] = [];
    private firestoreUnsubscribe: (() => void) | null = null;
    private queryRefreshTimer: ReturnType<typeof setInterval> | null = null;
    private retryCount = 0;
    private pendingRetryTimer: ReturnType<typeof setTimeout> | null = null;

    // ==================== LIFECYCLE ====================

    /**
     * Start PLUM service
     */
    async start(userLocation: { latitude: number; longitude: number }): Promise<void> {
        if (this.isRunning) return;

        logger.info('🌊 Starting PLUM EEW Service...');

        this.isRunning = true;
        this.userLocation = userLocation;

        // Subscribe to nearby intensity observations
        await this.subscribeToNearbyObservations();

        // ELITE: Periodically refresh query to avoid stale timestamp filter.
        // Firestore query uses Date.now() at subscription time — becomes stale after MAX_OBSERVATION_AGE_MS.
        // Re-subscribe every 45s to keep the query window fresh.
        if (this.queryRefreshTimer) clearInterval(this.queryRefreshTimer);
        this.queryRefreshTimer = setInterval(() => {
            try {
                if (this.isRunning) {
                    // Only re-subscribe if current subscription is alive AND no pending retry
                    if (this.firestoreUnsubscribe && !this.pendingRetryTimer) {
                        try { this.firestoreUnsubscribe(); } catch { /* */ }
                        this.firestoreUnsubscribe = null;
                        this.subscribeToNearbyObservations().catch(e => {
                            if (__DEV__) logger.debug('PLUM query refresh failed:', e);
                        });
                    }
                }
            } catch (e) {
                if (__DEV__) logger.debug('PLUM query refresh error:', e);
            }
        }, 45_000);

        logger.info('✅ PLUM EEW Service started');
    }

    /**
     * Stop PLUM service
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;

        // ELITE: Clear query refresh timer
        if (this.queryRefreshTimer) {
            clearInterval(this.queryRefreshTimer);
            this.queryRefreshTimer = null;
        }

        // Clear pending retry timer
        if (this.pendingRetryTimer) {
            clearTimeout(this.pendingRetryTimer);
            this.pendingRetryTimer = null;
        }
        this.retryCount = 0;

        if (this.firestoreUnsubscribe) {
            this.firestoreUnsubscribe();
            this.firestoreUnsubscribe = null;
        }

        this.observations.clear();
        logger.info('🛑 PLUM EEW Service stopped');
    }

    // ==================== OBSERVATION HANDLING ====================

    /**
     * Subscribe to nearby intensity observations from Firestore
     */
    private async subscribeToNearbyObservations(): Promise<void> {
        if (!this.userLocation) {
            logger.debug('Cannot subscribe: no location');
            return;
        }

        try {
            const { collection, query, where, orderBy, limit, onSnapshot } = await import('firebase/firestore');
            const { getFirestoreInstanceAsync } = await import('./firebase/FirebaseInstanceManager');
            const db = await getFirestoreInstanceAsync();
            if (!db) return;

            // Query nearby observations (simplified - in production use geohash)
            const obsQuery = query(
                collection(db, 'plum_observations'),
                where('timestamp', '>', Date.now() - MAX_OBSERVATION_AGE_MS),
                orderBy('timestamp', 'desc'),
                limit(MAX_OBSERVATIONS),
            );

            this.firestoreUnsubscribe = onSnapshot(obsQuery, (snapshot) => {
                // Reset retry count on successful snapshot
                this.retryCount = 0;

                snapshot.docChanges().forEach((change) => {
                    const obs = change.doc.data() as PLUMObservation;
                    if (change.type === 'removed') {
                        this.observations.delete(obs.deviceId);
                        return;
                    }

                    if (change.type === 'added' || change.type === 'modified') {
                        // Filter by distance
                        const userLoc = this.userLocation;
                        if (!userLoc) return;
                        const distance = calculateDistance(
                            userLoc.latitude,
                            userLoc.longitude,
                            obs.latitude,
                            obs.longitude
                        );

                        if (distance <= PLUM_RADIUS_KM) {
                            this.observations.set(obs.deviceId, obs);
                        } else {
                            this.observations.delete(obs.deviceId);
                        }
                    }
                });
                this.pruneObservations();
                this.evaluatePLUM();
            }, (error) => {
                const backoffMs = Math.min(3000 * Math.pow(2, this.retryCount), 60000);
                this.retryCount++;
                logger.warn(`PLUM observations listener error (retry #${this.retryCount}, backoff ${backoffMs}ms):`, error);

                // Dead subscription: clean up and re-subscribe after exponential backoff
                if (this.firestoreUnsubscribe) {
                    try { this.firestoreUnsubscribe(); } catch { /* already dead */ }
                    this.firestoreUnsubscribe = null;
                }
                if (this.isRunning) {
                    // Clear any existing pending retry to prevent cascading
                    if (this.pendingRetryTimer) {
                        clearTimeout(this.pendingRetryTimer);
                    }
                    this.pendingRetryTimer = setTimeout(() => {
                        this.pendingRetryTimer = null;
                        if (this.isRunning) {
                            this.subscribeToNearbyObservations().catch(e =>
                                logger.error('PLUM re-subscribe failed:', e),
                            );
                        }
                    }, backoffMs);
                }
            });

            logger.info('Subscribed to nearby PLUM observations');
        } catch (error) {
            logger.error('Failed to subscribe to observations:', error);
        }
    }

    /**
     * Add local observation (from this device's sensor)
     */
    async addLocalObservation(
        peakAcceleration: number,
        peakVelocity: number
    ): Promise<void> {
        if (!this.userLocation) return;

        const intensity = this.accelerationToIntensity(peakAcceleration);

        const observation: PLUMObservation = {
            deviceId: 'local',
            latitude: this.userLocation.latitude,
            longitude: this.userLocation.longitude,
            timestamp: Date.now(),
            intensity,
            peakAcceleration,
            peakVelocity,
            confidence: 90,
        };

        this.observations.set('local', observation);
        this.pruneObservations();

        // Share to Firebase for other devices
        await this.shareObservation(observation);

        // Evaluate PLUM
        this.evaluatePLUM();
    }

    /**
     * Share observation to Firebase
     */
    private async shareObservation(obs: PLUMObservation): Promise<void> {
        try {
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
            const { getFirestoreInstanceAsync } = await import('./firebase/FirebaseInstanceManager');
            const db = await getFirestoreInstanceAsync();
            if (!db) return;

            await addDoc(collection(db, 'plum_observations'), {
                ...obs,
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            logger.debug('Failed to share observation:', error);
        }
    }

    // ==================== PLUM ALGORITHM ====================

    /**
     * Evaluate PLUM and make prediction
     */
    private evaluatePLUM(): void {
        // CRITICAL FIX (EEW-H3): Take local snapshot of userLocation.
        // Without this, if stop() runs during the long for-loop below,
        // `this.userLocation = null` causes null-deref crash mid-evaluation.
        const userLoc = this.userLocation;
        if (!userLoc || this.observations.size < MIN_OBSERVATIONS) {
            return;
        }

        this.pruneObservations();

        if (this.observations.size < MIN_OBSERVATIONS) return;

        // Calculate distance-weighted intensity
        let weightedIntensitySum = 0;
        let weightSum = 0;
        let minDistance = Infinity;
        let maxIntensity = 0;
        let latestTimestamp = 0;

        for (const obs of this.observations.values()) {
            const distance = calculateDistance(
                userLoc.latitude,
                userLoc.longitude,
                obs.latitude,
                obs.longitude
            );

            // Weight by inverse distance squared
            const weight = 1 / Math.max(distance * distance, 1);

            // Apply attenuation for distance
            const attenuatedIntensity = this.applyAttenuation(obs.intensity, distance);

            weightedIntensitySum += attenuatedIntensity * weight;
            weightSum += weight;

            if (distance < minDistance) {
                minDistance = distance;
            }
            if (obs.intensity > maxIntensity) {
                maxIntensity = obs.intensity;
            }
            if (obs.timestamp > latestTimestamp) {
                latestTimestamp = obs.timestamp;
            }
        }

        const predictedIntensity = weightedIntensitySum / weightSum;

        // Estimate arrival time based on closest observation
        const travelTime = minDistance / S_WAVE_VELOCITY;
        const elapsedSinceDetection = (Date.now() - latestTimestamp) / 1000;
        const estimatedArrivalSeconds = Math.max(0, travelTime - elapsedSinceDetection);

        // Calculate confidence based on number of observations and consistency
        const confidence = Math.min(100, 50 + this.observations.size * 10);

        // userLoc snapshot taken at top of evaluatePLUM — safe even if userLocation cleared during stop()
        const prediction: PLUMPrediction = {
            targetLatitude: userLoc.latitude,
            targetLongitude: userLoc.longitude,
            predictedIntensity,
            confidence,
            usedObservations: this.observations.size,
            estimatedArrivalSeconds,
            warningTime: estimatedArrivalSeconds,
        };

        logger.warn(`🌊 PLUM Prediction: Intensity ${predictedIntensity.toFixed(1)}, ${estimatedArrivalSeconds.toFixed(1)}s warning`);

        // Notify callbacks
        this.notifyPrediction(prediction);
    }

    /**
     * Apply attenuation to intensity based on distance
     */
    private applyAttenuation(intensity: number, distanceKm: number): number {
        // Simplified attenuation model
        // I = I0 - A * log10(r) - B * r
        const attenuation = ATTENUATION_A * Math.log10(Math.max(1, distanceKm)) + ATTENUATION_B * distanceKm;
        return Math.max(0, intensity - attenuation);
    }

    /**
     * Convert peak acceleration (g) to intensity (MMI)
     */
    private accelerationToIntensity(acceleration: number): number {
        // Using Wald et al. (1999) relationship
        // log(PGA) = a * MMI + b
        const pga = acceleration * 980; // Convert g to cm/s²
        const logPGA = Math.log10(Math.max(0.1, pga));

        // Approximate MMI = 3.66 * log(PGA) - 1.66
        return Math.max(1, Math.min(12, 3.66 * logPGA - 1.66));
    }

    // calculateDistance imported from utils/locationUtils

    private pruneObservations(): void {
        const now = Date.now();

        // Remove stale entries first.
        for (const [key, obs] of this.observations.entries()) {
            if (now - obs.timestamp > MAX_OBSERVATION_AGE_MS) {
                this.observations.delete(key);
            }
        }

        // Enforce hard cap by keeping most recent observations.
        if (this.observations.size > MAX_OBSERVATIONS) {
            const sorted = Array.from(this.observations.entries())
                .sort((a, b) => b[1].timestamp - a[1].timestamp)
                .slice(0, MAX_OBSERVATIONS);
            this.observations = new Map(sorted);
        }
    }

    // ==================== CALLBACKS ====================

    /**
     * Subscribe to PLUM predictions
     */
    onPrediction(callback: (prediction: PLUMPrediction) => void): () => void {
        this.predictionCallbacks.push(callback);
        return () => {
            const idx = this.predictionCallbacks.indexOf(callback);
            if (idx > -1) this.predictionCallbacks.splice(idx, 1);
        };
    }

    /**
     * Notify all callbacks
     */
    private notifyPrediction(prediction: PLUMPrediction): void {
        for (const callback of [...this.predictionCallbacks]) {
            try {
                callback(prediction);
            } catch (error) {
                logger.error('Prediction callback error:', error);
            }
        }
    }

    // ==================== STATUS ====================

    /**
     * Get service status
     */
    getStatus(): {
        isRunning: boolean;
        observationCount: number;
        hasLocation: boolean;
    } {
        return {
            isRunning: this.isRunning,
            observationCount: this.observations.size,
            hasLocation: this.userLocation !== null,
        };
    }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const plumEEWService = new PLUMEEWService();
