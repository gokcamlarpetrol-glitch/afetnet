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

        logger.info('✅ PLUM EEW Service started');
    }

    /**
     * Stop PLUM service
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;

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
        if (!this.userLocation || !firebaseDataService.isInitialized) {
            logger.debug('Cannot subscribe: no location or Firebase');
            return;
        }

        try {
            const { getFirestore, collection, query, where, onSnapshot } = await import('firebase/firestore');
            const db = getFirestore();

            // Query nearby observations (simplified - in production use geohash)
            const obsQuery = query(
                collection(db, 'plum_observations'),
                where('timestamp', '>', Date.now() - MAX_OBSERVATION_AGE_MS)
            );

            this.firestoreUnsubscribe = onSnapshot(obsQuery, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        const obs = change.doc.data() as PLUMObservation;

                        // Filter by distance
                        const distance = this.calculateDistance(
                            this.userLocation!.latitude,
                            this.userLocation!.longitude,
                            obs.latitude,
                            obs.longitude
                        );

                        if (distance <= PLUM_RADIUS_KM) {
                            this.observations.set(obs.deviceId, obs);
                            this.evaluatePLUM();
                        }
                    }
                });
            });

            logger.info('📡 Subscribed to nearby PLUM observations');
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

        // Share to Firebase for other devices
        await this.shareObservation(observation);

        // Evaluate PLUM
        this.evaluatePLUM();
    }

    /**
     * Share observation to Firebase
     */
    private async shareObservation(obs: PLUMObservation): Promise<void> {
        if (!firebaseDataService.isInitialized) return;

        try {
            const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
            const db = getFirestore();

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
        if (!this.userLocation || this.observations.size < MIN_OBSERVATIONS) {
            return;
        }

        // Clean old observations
        const now = Date.now();
        for (const [key, obs] of this.observations.entries()) {
            if (now - obs.timestamp > MAX_OBSERVATION_AGE_MS) {
                this.observations.delete(key);
            }
        }

        if (this.observations.size < MIN_OBSERVATIONS) return;

        // Calculate distance-weighted intensity
        let weightedIntensitySum = 0;
        let weightSum = 0;
        let minDistance = Infinity;
        let maxIntensity = 0;
        let latestTimestamp = 0;

        for (const obs of this.observations.values()) {
            const distance = this.calculateDistance(
                this.userLocation.latitude,
                this.userLocation.longitude,
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

        const prediction: PLUMPrediction = {
            targetLatitude: this.userLocation.latitude,
            targetLongitude: this.userLocation.longitude,
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

    /**
     * Calculate distance between two points (Haversine)
     */
    private calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371;
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
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
        for (const callback of this.predictionCallbacks) {
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
