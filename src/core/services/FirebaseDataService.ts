/**
 * FIREBASE DATA SERVICE - ELITE MODULAR IMPLEMENTATION
 * Stores device IDs and family members in Firebase Firestore
 * Refactored into modular components for maintainability
 * PRODUCTION-READY: Comprehensive error handling with graceful degradation
 */

import { createLogger } from '../utils/logger';
import { FamilyMember } from '../types/family';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import type {
  MessageData,
  ConversationData,
  HealthProfileData,
  ICEData,
  LocationUpdateData,
  StatusUpdateData,
  EarthquakeFirebaseData,
  FeltEarthquakeReportData,
} from '../types/firebase';
import { saveDeviceId as saveDeviceIdOp } from './firebase/FirebaseDeviceOperations';
import { saveFamilyMember as saveFamilyMemberOp, loadFamilyMembers as loadFamilyMembersOp, deleteFamilyMember as deleteFamilyMemberOp, subscribeToFamilyMembers as subscribeToFamilyMembersOp } from './firebase/FirebaseFamilyOperations';
import { saveMessage as saveMessageOp, loadMessages as loadMessagesOp, subscribeToMessages as subscribeToMessagesOp, saveConversation as saveConversationOp, loadConversations as loadConversationsOp, deleteConversation as deleteConversationOp } from './firebase/FirebaseMessageOperations';
import { saveNewsSummary as saveNewsSummaryOp, getNewsSummary as getNewsSummaryOp, NewsSummaryRecord } from './firebase/FirebaseNewsOperations';
import { saveHealthProfile as saveHealthProfileOp, loadHealthProfile as loadHealthProfileOp, saveICE as saveICEOp, loadICE as loadICEOp } from './firebase/FirebaseHealthOperations';
import { saveEarthquake as saveEarthquakeOp, saveFeltEarthquakeReport as saveFeltEarthquakeReportOp, getIntensityData as getIntensityDataOp } from './firebase/FirebaseEarthquakeOperations';
import { saveLocationUpdate as saveLocationUpdateOp } from './firebase/FirebaseLocationOperations';
import { saveStatusUpdate as saveStatusUpdateOp } from './firebase/FirebaseStatusOperations';

const logger = createLogger('FirebaseDataService');

// Re-export NewsSummaryRecord for backward compatibility
export type { NewsSummaryRecord } from './firebase/FirebaseNewsOperations';

class FirebaseDataService {
  private _isInitialized = false;
  
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize() {
    if (this._isInitialized) {
      if (__DEV__) {
        logger.debug('FirebaseDataService already initialized');
      }
      return;
    }

    try {
      // ELITE: Ensure Firebase app is initialized with async getter
      const firebaseModule = await import('../../lib/firebase');
      
      // ELITE: Check for named export
      const getFirebaseAppAsync = firebaseModule.getFirebaseAppAsync;
      
      if (!getFirebaseAppAsync || typeof getFirebaseAppAsync !== 'function') {
        if (__DEV__) {
          logger.debug('getFirebaseAppAsync is not available in firebase module - Firestore disabled');
        }
        return;
      }
      
      // ELITE: Initialize Firebase app with timeout protection
      const initPromise = getFirebaseAppAsync();
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 8000) // 8 second timeout
      );
      
      const firebaseApp = await Promise.race([initPromise, timeoutPromise]);
      
      if (!firebaseApp) {
        if (__DEV__) {
          logger.debug('Firebase app not initialized - Firestore disabled (app continues with AsyncStorage)');
        }
        return;
      }

      // ELITE: Get Firestore instance with async initialization and timeout
      const dbPromise = getFirestoreInstanceAsync();
      const dbTimeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 5000) // 5 second timeout
      );
      
      const db = await Promise.race([dbPromise, dbTimeoutPromise]);
      
      if (!db) {
        if (__DEV__) {
          logger.debug('Firestore not available - using AsyncStorage fallback');
        }
        return;
      }

      this._isInitialized = true;
      if (__DEV__) {
        logger.info('✅ FirebaseDataService initialized successfully');
      }
    } catch (error: any) {
      // CRITICAL: Handle LoadBundleFromServerRequestError gracefully
      const errorMessage = error?.message || String(error);
      const errorType = error?.name || typeof error;
      
      // ELITE: Don't log bundle errors as errors - they're expected in some environments
      if (errorMessage.includes('LoadBundleFromServerRequestError') || 
          errorMessage.includes('Could not load bundle')) {
        if (__DEV__) {
          logger.debug('FirebaseDataService init skipped (bundle load error - expected in some environments)');
        }
      } else {
        logger.error('FirebaseDataService init error:', {
          error: errorMessage,
          errorType,
        });
      }
      // ELITE: Don't throw - app continues with AsyncStorage fallback
    }
  }

  /**
   * Save device ID to Firestore
   */
  async saveDeviceId(deviceId: string): Promise<boolean> {
    return saveDeviceIdOp(deviceId, this._isInitialized);
  }

  /**
   * Save family member to Firestore
   */
  async saveFamilyMember(userDeviceId: string, member: FamilyMember): Promise<boolean> {
    return saveFamilyMemberOp(userDeviceId, member, this._isInitialized);
  }

  /**
   * Load family members from Firestore
   */
  async loadFamilyMembers(userDeviceId: string): Promise<FamilyMember[]> {
    return loadFamilyMembersOp(userDeviceId, this._isInitialized);
  }

  /**
   * Delete family member from Firestore
   */
  async deleteFamilyMember(userDeviceId: string, memberId: string): Promise<boolean> {
    return deleteFamilyMemberOp(userDeviceId, memberId, this._isInitialized);
  }

  /**
   * Subscribe to family members changes (real-time sync)
   */
  async subscribeToFamilyMembers(
    userDeviceId: string, 
    callback: (members: FamilyMember[]) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    return subscribeToFamilyMembersOp(userDeviceId, callback, onError, this._isInitialized);
  }

  /**
   * Save news summary to Firestore
   */
  async saveNewsSummary(summary: NewsSummaryRecord): Promise<boolean> {
    return saveNewsSummaryOp(summary, this._isInitialized);
  }

  /**
   * Get news summary from Firestore
   */
  async getNewsSummary(articleId: string): Promise<NewsSummaryRecord | null> {
    return getNewsSummaryOp(articleId, this._isInitialized);
  }

  /**
   * Save message to Firestore
   */
  async saveMessage(userDeviceId: string, message: MessageData): Promise<boolean> {
    return saveMessageOp(userDeviceId, message, this._isInitialized);
  }

  /**
   * Load messages from Firestore
   */
  async loadMessages(userDeviceId: string): Promise<MessageData[]> {
    return loadMessagesOp(userDeviceId, this._isInitialized);
  }

  /**
   * Subscribe to real-time message updates
   */
  async subscribeToMessages(
    userDeviceId: string,
    callback: (messages: MessageData[]) => void,
    onError?: (error: Error) => void
  ): Promise<(() => void) | null> {
    return subscribeToMessagesOp(userDeviceId, callback, onError, this._isInitialized);
  }

  /**
   * Save conversation to Firestore
   */
  async saveConversation(userDeviceId: string, conversation: ConversationData): Promise<boolean> {
    return saveConversationOp(userDeviceId, conversation, this._isInitialized);
  }

  /**
   * Load conversations from Firestore
   */
  async loadConversations(userDeviceId: string): Promise<ConversationData[]> {
    return loadConversationsOp(userDeviceId, this._isInitialized);
  }

  /**
   * Delete conversation from Firestore
   */
  async deleteConversation(userDeviceId: string, userId: string): Promise<boolean> {
    return deleteConversationOp(userDeviceId, userId, this._isInitialized);
  }

  /**
   * Save health profile to Firestore
   */
  async saveHealthProfile(userDeviceId: string, profile: any): Promise<boolean> {
    return saveHealthProfileOp(userDeviceId, profile, this._isInitialized);
  }

  /**
   * Load health profile from Firestore
   */
  async loadHealthProfile(userDeviceId: string): Promise<any | null> {
    return loadHealthProfileOp(userDeviceId, this._isInitialized);
  }

  /**
   * Save earthquake to Firestore
   */
  async saveEarthquake(earthquake: any): Promise<boolean> {
    return saveEarthquakeOp(earthquake, this._isInitialized);
  }

  /**
   * Save felt earthquake report to Firestore
   */
  async saveFeltEarthquakeReport(report: any): Promise<boolean> {
    return saveFeltEarthquakeReportOp(report, this._isInitialized);
  }

  /**
   * Get intensity data from Firestore
   */
  async getIntensityData(earthquakeId: string): Promise<any | null> {
    return getIntensityDataOp(earthquakeId, this._isInitialized);
  }

  /**
   * Save location update to Firestore
   */
  async saveLocationUpdate(userDeviceId: string, location: any): Promise<boolean> {
    return saveLocationUpdateOp(userDeviceId, location, this._isInitialized);
  }

  /**
   * Save ICE (In Case of Emergency) data to Firestore
   */
  async saveICE(userDeviceId: string, iceData: any): Promise<boolean> {
    return saveICEOp(userDeviceId, iceData, this._isInitialized);
  }

  /**
   * Load ICE (In Case of Emergency) data from Firestore
   */
  async loadICE(userDeviceId: string): Promise<any | null> {
    return loadICEOp(userDeviceId, this._isInitialized);
  }

  /**
   * Save status update to Firestore
   */
  async saveStatusUpdate(userDeviceId: string, statusData: any): Promise<boolean> {
    return saveStatusUpdateOp(userDeviceId, statusData, this._isInitialized);
  }

  /**
   * ELITE: Save seismic detection to Firestore for crowdsourcing and verification
   */
  async saveSeismicDetection(detection: {
    id: string;
    deviceId: string;
    timestamp: number;
    latitude: number;
    longitude: number;
    magnitude: number;
    depth: number;
    pWaveDetected: boolean;
    sWaveDetected: boolean;
    confidence: number;
    warningTime: number;
    waveCalculation?: any;
    source: string;
  }): Promise<boolean> {
    if (!this._isInitialized) {
      if (__DEV__) {
        logger.debug('FirebaseDataService not initialized, skipping saveSeismicDetection');
      }
      return false;
    }

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) {
        if (__DEV__) {
          logger.debug('Firestore not available');
        }
        return false;
      }

      const { doc, setDoc } = await import('firebase/firestore');
      
      // ELITE: Timeout protection for seismic detection save
      const TIMEOUT_MS = 10000; // 10 seconds
      const savePromise = setDoc(doc(db, 'seismicDetections', detection.id), {
        ...detection,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Seismic detection save timeout')), TIMEOUT_MS)
      );
      
      await Promise.race([savePromise, timeoutPromise]);

      if (__DEV__) {
        logger.info('Seismic detection saved to Firestore:', detection.id);
      }
      return true;
    } catch (error: unknown) {
      const errorObj = error as { code?: string; message?: string };
      const errorMessage = errorObj?.message || String(error);
      
      // ELITE: Handle permission errors gracefully
      if (errorObj?.code === 'permission-denied' || errorMessage.includes('permission') || errorMessage.includes('Missing or insufficient permissions')) {
        if (__DEV__) {
          logger.debug('Seismic detection save skipped (permission denied - this is OK)');
        }
        return false;
      }
      
      // ELITE: Handle bundle errors gracefully
      if (errorMessage.includes('LoadBundleFromServerRequestError') || 
          errorMessage.includes('Could not load bundle')) {
        if (__DEV__) {
          logger.debug('Seismic detection save skipped (bundle error - expected in some environments)');
        }
        return false;
      }
      
      logger.error('Failed to save seismic detection:', error);
      return false;
    }
  }
}

export const firebaseDataService = new FirebaseDataService();
