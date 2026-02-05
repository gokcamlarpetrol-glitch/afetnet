/**
 * FIREBASE EEW OPERATIONS - ELITE EDITION
 * 
 * EEW (Early Earthquake Warning) için Firebase operasyonları
 * 
 * FEATURES:
 * - Crowdsourced P-wave detection
 * - Real-time EEW broadcasts
 * - EEW history cloud sync
 * - Multi-device consensus
 * - Analytics and metrics
 * 
 * COLLECTIONS:
 * - eew_pwave_detections: Crowdsourced P-wave algılamaları
 * - eew_broadcasts: Real-time EEW yayınları
 * - eew_history: Kullanıcı EEW geçmişi (sync)
 * - eew_consensus: Multi-device consensus verileri
 * 
 * @version 1.0.0
 * @elite true
 */

import {
    doc,
    setDoc,
    getDocs,
    getDoc,
    query,
    collection,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    addDoc,
    updateDoc,
    deleteDoc,
    type Unsubscribe,
} from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';

const logger = createLogger('FirebaseEEWOperations');
const TIMEOUT_MS = 10000;

// ============================================================
// TYPES
// ============================================================

/**
 * Crowdsourced P-wave detection from a device
 */
export interface PWaveDetection {
    id?: string;
    deviceId: string;
    userId?: string;

    // Detection data
    timestamp: number;
    latitude: number;
    longitude: number;
    accuracy: number; // meters

    // Seismic data
    magnitude: number; // g-force
    frequency: number; // Hz
    confidence: number; // 0-100
    staltaRatio: number;

    // Device info
    deviceModel?: string;
    sensorType?: string;

    // Flags
    isVerified?: boolean;
    consensusCount?: number;

    createdAt?: Date | Timestamp;
    expiresAt?: Date | Timestamp;
}

/**
 * EEW Broadcast event (from official sources or consensus)
 */
export interface EEWBroadcast {
    id?: string;

    // Earthquake info
    magnitude: number;
    latitude: number;
    longitude: number;
    depth: number;
    location: string;

    // Timing
    originTime: number;
    detectedAt: number;
    broadcastAt?: number;

    // Source
    source: 'AFAD' | 'KANDILLI' | 'USGS' | 'EMSC' | 'CROWDSOURCED';
    sourceEventId?: string;

    // Affected area
    affectedRegions?: string[];
    estimatedIntensityMap?: Record<string, number>; // region -> MMI

    // Status
    isActive: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';

    createdAt?: Date | Timestamp;
    updatedAt?: Date | Timestamp;
}

/**
 * User's EEW history entry (for cloud sync)
 */
export interface EEWHistoryEntry {
    id?: string;
    userId: string;

    // Earthquake
    magnitude: number;
    location: string;
    latitude: number;
    longitude: number;
    depth: number;

    // EEW metrics
    warningTime: number; // seconds
    estimatedIntensity: number;
    epicentralDistance: number;

    // Source
    source: string;
    sourceEventId?: string;

    // User response
    wasNotified: boolean;
    didTakeAction?: boolean;
    responseTimeMs?: number;

    // Timestamps
    timestamp: number;
    createdAt?: Date | Timestamp;
}

/**
 * Consensus data for validating P-wave detections
 */
export interface PWaveConsensus {
    id?: string;

    // Geographic cluster
    centerLatitude: number;
    centerLongitude: number;
    radiusKm: number;

    // Detections
    detectionCount: number;
    deviceIds: string[];
    avgConfidence: number;
    avgMagnitude: number;

    // Timing
    firstDetectionAt: number;
    lastDetectionAt: number;

    // Status
    isConfirmed: boolean;
    linkedBroadcastId?: string;

    createdAt?: Date | Timestamp;
    updatedAt?: Date | Timestamp;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

async function withTimeout<T>(
    operation: () => Promise<T>,
    operationName: string,
): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${operationName} timeout`)), TIMEOUT_MS),
    );
    return Promise.race([operation(), timeoutPromise]);
}

function handleFirebaseError(error: unknown, operationName: string): void {
    const errorObj = error as { code?: string; message?: string };
    const errorMessage = errorObj?.message || String(error);

    // Handle permission errors gracefully
    if (errorObj?.code === 'permission-denied' ||
        errorMessage.includes('permission') ||
        errorMessage.includes('Missing or insufficient permissions')) {
        if (__DEV__) {
            logger.debug(`${operationName} skipped (permission denied)`);
        }
        return;
    }

    logger.error(`${operationName} failed:`, error);
}

// ============================================================
// P-WAVE DETECTION OPERATIONS
// ============================================================

/**
 * Save P-wave detection to Firebase
 * Used for crowdsourced early warning
 */
export async function savePWaveDetection(
    detection: PWaveDetection,
    isInitialized: boolean,
): Promise<string | null> {
    if (!isInitialized) {
        logger.debug('Firebase not initialized, skipping P-wave save');
        return null;
    }

    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return null;

        // Set expiration (5 minutes from now)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const docData = {
            ...detection,
            createdAt: serverTimestamp(),
            expiresAt: Timestamp.fromDate(expiresAt),
        };

        const docRef = await withTimeout(
            () => addDoc(collection(db, 'eew_pwave_detections'), docData),
            'P-wave detection save',
        );

        logger.info(`📡 P-wave detection saved: ${docRef.id}`);
        return docRef.id;
    } catch (error) {
        handleFirebaseError(error, 'P-wave detection save');
        return null;
    }
}

/**
 * Get recent P-wave detections in a geographic area
 */
export async function getRecentPWaveDetections(
    latitude: number,
    longitude: number,
    radiusKm: number = 100,
    maxAgeSeconds: number = 30,
    isInitialized: boolean,
): Promise<PWaveDetection[]> {
    if (!isInitialized) return [];

    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return [];

        const minTime = Date.now() - maxAgeSeconds * 1000;

        // Note: Firestore doesn't support geospatial queries natively
        // We fetch recent detections and filter client-side
        const q = query(
            collection(db, 'eew_pwave_detections'),
            where('timestamp', '>', minTime),
            orderBy('timestamp', 'desc'),
            limit(50),
        );

        const snapshot = await withTimeout(() => getDocs(q), 'P-wave detections load');

        const detections: PWaveDetection[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data() as PWaveDetection;

            // Calculate distance (simplified haversine)
            const dLat = Math.abs(data.latitude - latitude);
            const dLon = Math.abs(data.longitude - longitude);
            const approxDistanceKm = Math.sqrt(dLat * dLat + dLon * dLon) * 111; // 1 degree ≈ 111km

            if (approxDistanceKm <= radiusKm) {
                detections.push({ ...data, id: doc.id });
            }
        });

        return detections;
    } catch (error) {
        handleFirebaseError(error, 'P-wave detections load');
        return [];
    }
}

/**
 * Subscribe to real-time P-wave detections in an area
 */
export function subscribeToPWaveDetections(
    latitude: number,
    longitude: number,
    radiusKm: number = 100,
    onDetection: (detections: PWaveDetection[]) => void,
    isInitialized: boolean,
): Unsubscribe | null {
    if (!isInitialized) {
        logger.debug('Firebase not initialized, cannot subscribe to P-waves');
        return null;
    }

    try {
        // Synchronous call - we need the db instance immediately for onSnapshot
        const getDb = async () => {
            const db = await getFirestoreInstanceAsync();
            if (!db) return null;

            const minTime = Date.now() - 60000; // Last 60 seconds

            const q = query(
                collection(db, 'eew_pwave_detections'),
                where('timestamp', '>', minTime),
                orderBy('timestamp', 'desc'),
                limit(20),
            );

            return onSnapshot(q, (snapshot) => {
                const detections: PWaveDetection[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data() as PWaveDetection;

                    // Filter by distance
                    const dLat = Math.abs(data.latitude - latitude);
                    const dLon = Math.abs(data.longitude - longitude);
                    const approxDistanceKm = Math.sqrt(dLat * dLat + dLon * dLon) * 111;

                    if (approxDistanceKm <= radiusKm) {
                        detections.push({ ...data, id: doc.id });
                    }
                });

                if (detections.length > 0) {
                    logger.info(`📡 ${detections.length} P-wave detections in area`);
                    onDetection(detections);
                }
            });
        };

        // Start async subscription
        let unsubscribe: Unsubscribe | null = null;
        getDb().then((unsub) => {
            unsubscribe = unsub;
        });

        // Return a function that will unsubscribe when called
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    } catch (error) {
        handleFirebaseError(error, 'P-wave subscription');
        return null;
    }
}

// ============================================================
// EEW BROADCAST OPERATIONS
// ============================================================

/**
 * Create a new EEW broadcast
 */
export async function createEEWBroadcast(
    broadcast: Omit<EEWBroadcast, 'id' | 'createdAt' | 'updatedAt'>,
    isInitialized: boolean,
): Promise<string | null> {
    if (!isInitialized) {
        logger.debug('Firebase not initialized, skipping EEW broadcast');
        return null;
    }

    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return null;

        const docData = {
            ...broadcast,
            broadcastAt: Date.now(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const docRef = await withTimeout(
            () => addDoc(collection(db, 'eew_broadcasts'), docData),
            'EEW broadcast create',
        );

        logger.info(`🚨 EEW broadcast created: ${docRef.id}`);
        return docRef.id;
    } catch (error) {
        handleFirebaseError(error, 'EEW broadcast create');
        return null;
    }
}

/**
 * Get active EEW broadcasts
 */
export async function getActiveEEWBroadcasts(
    isInitialized: boolean,
): Promise<EEWBroadcast[]> {
    if (!isInitialized) return [];

    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return [];

        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

        const q = query(
            collection(db, 'eew_broadcasts'),
            where('isActive', '==', true),
            where('broadcastAt', '>', fiveMinutesAgo),
            orderBy('broadcastAt', 'desc'),
            limit(10),
        );

        const snapshot = await withTimeout(() => getDocs(q), 'EEW broadcasts load');

        const broadcasts: EEWBroadcast[] = [];
        snapshot.forEach((doc) => {
            broadcasts.push({ ...doc.data() as EEWBroadcast, id: doc.id });
        });

        return broadcasts;
    } catch (error) {
        handleFirebaseError(error, 'EEW broadcasts load');
        return [];
    }
}

/**
 * Subscribe to active EEW broadcasts (real-time)
 */
export function subscribeToEEWBroadcasts(
    onBroadcast: (broadcasts: EEWBroadcast[]) => void,
    isInitialized: boolean,
): Unsubscribe | null {
    if (!isInitialized) {
        logger.debug('Firebase not initialized, cannot subscribe to EEW broadcasts');
        return null;
    }

    try {
        let unsubscribe: Unsubscribe | null = null;

        const setupSubscription = async () => {
            const db = await getFirestoreInstanceAsync();
            if (!db) return;

            const q = query(
                collection(db, 'eew_broadcasts'),
                where('isActive', '==', true),
                orderBy('broadcastAt', 'desc'),
                limit(5),
            );

            unsubscribe = onSnapshot(q, (snapshot) => {
                const broadcasts: EEWBroadcast[] = [];
                snapshot.forEach((doc) => {
                    broadcasts.push({ ...doc.data() as EEWBroadcast, id: doc.id });
                });

                if (broadcasts.length > 0) {
                    logger.info(`🚨 ${broadcasts.length} active EEW broadcasts`);
                    onBroadcast(broadcasts);
                }
            });
        };

        setupSubscription();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    } catch (error) {
        handleFirebaseError(error, 'EEW broadcast subscription');
        return null;
    }
}

/**
 * Deactivate an EEW broadcast
 */
export async function deactivateEEWBroadcast(
    broadcastId: string,
    isInitialized: boolean,
): Promise<boolean> {
    if (!isInitialized) return false;

    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return false;

        await withTimeout(
            () => updateDoc(doc(db, 'eew_broadcasts', broadcastId), {
                isActive: false,
                updatedAt: serverTimestamp(),
            }),
            'EEW broadcast deactivate',
        );

        logger.info(`EEW broadcast deactivated: ${broadcastId}`);
        return true;
    } catch (error) {
        handleFirebaseError(error, 'EEW broadcast deactivate');
        return false;
    }
}

// ============================================================
// EEW HISTORY OPERATIONS
// ============================================================

/**
 * Save EEW history entry for a user
 */
export async function saveEEWHistoryEntry(
    entry: Omit<EEWHistoryEntry, 'id' | 'createdAt'>,
    isInitialized: boolean,
): Promise<string | null> {
    if (!isInitialized) return null;

    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return null;

        const docData = {
            ...entry,
            createdAt: serverTimestamp(),
        };

        const docRef = await withTimeout(
            () => addDoc(collection(db, 'eew_history'), docData),
            'EEW history save',
        );

        logger.debug(`EEW history saved: ${docRef.id}`);
        return docRef.id;
    } catch (error) {
        handleFirebaseError(error, 'EEW history save');
        return null;
    }
}

/**
 * Get EEW history for a user
 */
export async function getEEWHistory(
    userId: string,
    limitCount: number = 50,
    isInitialized: boolean,
): Promise<EEWHistoryEntry[]> {
    if (!isInitialized) return [];

    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return [];

        const q = query(
            collection(db, 'eew_history'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(limitCount),
        );

        const snapshot = await withTimeout(() => getDocs(q), 'EEW history load');

        const entries: EEWHistoryEntry[] = [];
        snapshot.forEach((doc) => {
            entries.push({ ...doc.data() as EEWHistoryEntry, id: doc.id });
        });

        return entries;
    } catch (error) {
        handleFirebaseError(error, 'EEW history load');
        return [];
    }
}

/**
 * Sync local EEW history with cloud
 */
export async function syncEEWHistory(
    userId: string,
    localEntries: EEWHistoryEntry[],
    isInitialized: boolean,
): Promise<number> {
    if (!isInitialized) return 0;

    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return 0;

        // Get existing cloud entries
        const cloudEntries = await getEEWHistory(userId, 100, isInitialized);
        const cloudTimestamps = new Set(cloudEntries.map(e => e.timestamp));

        // Find new local entries
        const newEntries = localEntries.filter(e => !cloudTimestamps.has(e.timestamp));

        // Upload new entries
        let syncedCount = 0;
        for (const entry of newEntries) {
            const result = await saveEEWHistoryEntry({ ...entry, userId }, isInitialized);
            if (result) syncedCount++;
        }

        if (syncedCount > 0) {
            logger.info(`📤 Synced ${syncedCount} EEW history entries to cloud`);
        }

        return syncedCount;
    } catch (error) {
        handleFirebaseError(error, 'EEW history sync');
        return 0;
    }
}

// ============================================================
// CONSENSUS OPERATIONS
// ============================================================

/**
 * Create or update P-wave consensus
 */
export async function updatePWaveConsensus(
    consensus: Omit<PWaveConsensus, 'id' | 'createdAt' | 'updatedAt'>,
    isInitialized: boolean,
): Promise<string | null> {
    if (!isInitialized) return null;

    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return null;

        // Generate consensus ID based on geographic cluster
        const consensusId = `${Math.round(consensus.centerLatitude * 10)}_${Math.round(consensus.centerLongitude * 10)}`;

        await withTimeout(
            () => setDoc(doc(db, 'eew_consensus', consensusId), {
                ...consensus,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(), // Will be ignored on update if using merge
            }, { merge: true }),
            'P-wave consensus update',
        );

        logger.info(`🎯 P-wave consensus updated: ${consensusId} (${consensus.detectionCount} devices)`);
        return consensusId;
    } catch (error) {
        handleFirebaseError(error, 'P-wave consensus update');
        return null;
    }
}

/**
 * Get active consensus clusters
 */
export async function getActivePWaveConsensus(
    isInitialized: boolean,
): Promise<PWaveConsensus[]> {
    if (!isInitialized) return [];

    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return [];

        const thirtySecondsAgo = Date.now() - 30000;

        const q = query(
            collection(db, 'eew_consensus'),
            where('lastDetectionAt', '>', thirtySecondsAgo),
            where('isConfirmed', '==', false),
            orderBy('lastDetectionAt', 'desc'),
            limit(10),
        );

        const snapshot = await withTimeout(() => getDocs(q), 'P-wave consensus load');

        const consensusList: PWaveConsensus[] = [];
        snapshot.forEach((doc) => {
            consensusList.push({ ...doc.data() as PWaveConsensus, id: doc.id });
        });

        return consensusList;
    } catch (error) {
        handleFirebaseError(error, 'P-wave consensus load');
        return [];
    }
}

// ============================================================
// ANALYTICS OPERATIONS
// ============================================================

/**
 * Log EEW analytics event
 */
export async function logEEWAnalytics(
    eventType: 'detection' | 'broadcast_received' | 'notification_shown' | 'user_action',
    data: Record<string, unknown>,
    isInitialized: boolean,
): Promise<void> {
    if (!isInitialized) return;

    try {
        const db = await getFirestoreInstanceAsync();
        if (!db) return;

        await addDoc(collection(db, 'eew_analytics'), {
            eventType,
            ...data,
            timestamp: Date.now(),
            createdAt: serverTimestamp(),
        });

    } catch (error) {
        // Silent fail for analytics
        if (__DEV__) {
            logger.debug('EEW analytics log failed:', error);
        }
    }
}
