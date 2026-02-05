/**
 * FIREBASE EEW MODULE - BARREL EXPORTS
 * 
 * Central export point for Firebase EEW services
 * 
 * @example
 * import { eewFirebaseService, savePWaveDetection } from '@/core/services/firebase/eew';
 * 
 * @version 1.0.0
 * @elite true
 */

// ============================================================
// EEW FIREBASE SERVICE
// ============================================================

export { eewFirebaseService } from './EEWFirebaseService';

// ============================================================
// EEW FIREBASE OPERATIONS
// ============================================================

export {
    // P-wave operations
    savePWaveDetection,
    getRecentPWaveDetections,
    subscribeToPWaveDetections,

    // Broadcast operations
    createEEWBroadcast,
    getActiveEEWBroadcasts,
    subscribeToEEWBroadcasts,
    deactivateEEWBroadcast,

    // History operations
    saveEEWHistoryEntry,
    getEEWHistory,
    syncEEWHistory,

    // Consensus operations
    updatePWaveConsensus,
    getActivePWaveConsensus,

    // Analytics
    logEEWAnalytics,

    // Types
    type PWaveDetection,
    type EEWBroadcast,
    type EEWHistoryEntry,
    type PWaveConsensus,
} from './FirebaseEEWOperations';
