/**
 * BIO STATUS SERVICE
 * Manages the "Live Lifeline" of the user.
 * Stores Heart Rate and Battery status to be shared with Family.
 */

import { createLogger } from '../utils/logger';
import { create } from 'zustand';

const logger = createLogger('BioStatusService');

interface BioState {
    heartRate: number | null; // bpm
    batteryLevel: number | null; // percentage
    lastUpdate: number; // timestamp
    isStressDetected: boolean; // if HR > 120bpm suddenly
}

interface BioStore extends BioState {
    update: (data: Partial<BioState>) => void;
}

export const useBioStore = create<BioStore>((set) => ({
  heartRate: null,
  batteryLevel: null,
  lastUpdate: 0,
  isStressDetected: false,
  update: (data) => set((state) => ({ ...state, ...data })),
}));

class BioStatusService {

  /**
     * Updates local bio-status (from Watch)
     */
  updateLocalStatus(heartRate: number, batteryLevel: number) {
    // High Stress Detection Logic
    // Simple heuristic: If HR > 110 (and user was previously lower), mark stress.
    const isStress = heartRate > 110;

    useBioStore.getState().update({
      heartRate,
      batteryLevel,
      lastUpdate: Date.now(),
      isStressDetected: isStress,
    });

    if (__DEV__) {
      logger.debug(`Bio-Status Updated: ❤️ ${heartRate}bpm | 🔋 ${batteryLevel}% | Stress: ${isStress}`);
    }

    // Push to Backend (FamilyTrackingService)
    // ELITE: Live sync of bio-metrics
    import('./FamilyTrackingService').then(({ familyTrackingService }) => {
      familyTrackingService.broadcastBioStatus({ hr: heartRate, battery: batteryLevel });
    }).catch(err => logger.warn('Failed to load FamilyTrackingService for bio-update', err));
  }

  getLatestStatus() {
    return useBioStore.getState();
  }
}

export const bioStatusService = new BioStatusService();
