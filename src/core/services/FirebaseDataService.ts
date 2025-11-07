/**
 * FIREBASE DATA SERVICE - Firestore Integration
 * Stores device IDs and family members in Firebase Firestore
 * Provides persistent cloud storage with offline sync
 */

import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, deleteDoc } from 'firebase/firestore';
import { getDeviceId } from '../../lib/device';
import { FamilyMember } from '../types/family';
import { createLogger } from '../utils/logger';

const logger = createLogger('FirebaseDataService');

const DEFAULT_NEWS_SUMMARY_TTL_MS = 12 * 60 * 60 * 1000; // 12 saat

export interface NewsSummaryRecord {
  articleId: string;
  summary: string;
  source?: string | null;
  title?: string | null;
  url?: string | null;
  publishedAt?: number | null;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  ttlMs?: number;
  version?: number;
  createdByDeviceId?: string | null;
}

// Import Firebase app getter function
import getFirebaseApp from '../../lib/firebase';

let firestore: any = null;

function getFirestoreInstance() {
  if (!firestore) {
    try {
      // Call getFirebaseApp() to get the app instance
      const firebaseApp = getFirebaseApp();
      if (!firebaseApp) {
        logger.warn('Firebase app not initialized');
        return null;
      }
      firestore = getFirestore(firebaseApp);
      logger.info('Firestore instance created');
    } catch (error) {
      logger.error('Firestore initialization error:', error);
    }
  }
  return firestore;
}

class FirebaseDataService {
  private _isInitialized = false;
  
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize() {
    if (this._isInitialized) return;

    try {
      // Ensure Firebase app is initialized
      const firebaseApp = getFirebaseApp();
      if (!firebaseApp) {
        logger.warn('Firebase app not initialized - Firestore disabled');
        return;
      }

      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available - using AsyncStorage fallback');
        return;
      }

      this._isInitialized = true;
      logger.info('FirebaseDataService initialized successfully');
    } catch (error) {
      logger.error('FirebaseDataService init error:', error);
    }
  }

  /**
   * Save device ID to Firestore
   */
  async saveDeviceId(deviceId: string): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveDeviceId');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      await setDoc(doc(db, 'devices', deviceId), {
        deviceId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`Device ID saved to Firestore: ${deviceId}`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save device ID:', error);
      return false;
    }
  }

  /**
   * Save family member to Firestore
   */
  async saveFamilyMember(userDeviceId: string, member: FamilyMember): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveFamilyMember');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      const memberRef = doc(db, 'devices', userDeviceId, 'familyMembers', member.id);
      await setDoc(memberRef, {
        ...member,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`Family member ${member.id} saved to Firestore`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save family member:', error);
      return false;
    }
  }

  /**
   * Load family members from Firestore
   */
  async loadFamilyMembers(userDeviceId: string): Promise<FamilyMember[]> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, cannot load family members');
      return [];
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return [];
      }

      const membersRef = collection(db, 'devices', userDeviceId, 'familyMembers');
      const snapshot = await getDocs(membersRef);
      
      const members: FamilyMember[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        members.push(data as FamilyMember);
      });

      if (__DEV__) {
        logger.info(`Loaded ${members.length} family members from Firestore`);
      }
      return members;
    } catch (error) {
      logger.error('Failed to load family members:', error);
      return [];
    }
  }

  /**
   * Delete family member from Firestore
   */
  async deleteFamilyMember(userDeviceId: string, memberId: string): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping deleteFamilyMember');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      const memberRef = doc(db, 'devices', userDeviceId, 'familyMembers', memberId);
      await deleteDoc(memberRef);

      if (__DEV__) {
        logger.info(`Family member ${memberId} deleted from Firestore`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to delete family member:', error);
      return false;
    }
  }

  /**
   * Subscribe to family members changes (real-time sync)
   */
  subscribeToFamilyMembers(userDeviceId: string, callback: (members: FamilyMember[]) => void): () => void {
    try {
      const db = getFirestoreInstance();
      if (!db) return () => {};

      const membersRef = collection(db, 'devices', userDeviceId, 'familyMembers');
      const unsubscribe = onSnapshot(membersRef, (snapshot) => {
        const members: FamilyMember[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          members.push(data as FamilyMember);
        });
        callback(members);
      });

      return unsubscribe;
    } catch (error) {
      logger.error('Failed to subscribe to family members:', error);
      return () => {};
    }
  }

  /**
   * Save message to Firestore (BLE mesh backup)
   */
  async saveMessage(message: {
    id: string;
    from: string;
    to?: string;
    content: string;
    type: 'text' | 'sos' | 'status' | 'location';
    timestamp: number;
    priority?: 'low' | 'normal' | 'high' | 'critical';
  }): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveMessage');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      const messageRef = doc(db, 'messages', message.id);
      await setDoc(messageRef, {
        ...message,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`Message ${message.id} saved to Firestore`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save message:', error);
      return false;
    }
  }

  /**
   * Save SOS signal to Firestore
   */
  async saveSOS(sos: {
    id: string;
    deviceId: string;
    timestamp: number;
    location?: { latitude: number; longitude: number; accuracy: number } | null;
    message: string;
    status?: 'active' | 'resolved';
  }): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveSOS');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      const sosRef = doc(db, 'sos', sos.id);
      await setDoc(sosRef, {
        ...sos,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`SOS ${sos.id} saved to Firestore`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save SOS:', error);
      return false;
    }
  }

  /**
   * Save health profile to Firestore
   */
  async saveHealthProfile(userDeviceId: string, profile: any): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveHealthProfile');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      const profileRef = doc(db, 'devices', userDeviceId, 'healthProfile', 'main');
      await setDoc(profileRef, {
        ...profile,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`Health profile saved to Firestore for ${userDeviceId}`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save health profile:', error);
      return false;
    }
  }

  /**
   * Load health profile from Firestore
   */
  async loadHealthProfile(userDeviceId: string): Promise<any | null> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, cannot load health profile');
      return null;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return null;
      }

      const profileRef = doc(db, 'devices', userDeviceId, 'healthProfile', 'main');
      const snapshot = await getDoc(profileRef);
      
      if (snapshot.exists()) {
        return snapshot.data();
      }
      return null;
    } catch (error) {
      logger.error('Failed to load health profile:', error);
      return null;
    }
  }

  /**
   * Save ICE (In Case of Emergency) information to Firestore
   */
  async saveICE(userDeviceId: string, ice: any): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveICE');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      const iceRef = doc(db, 'devices', userDeviceId, 'ice', 'main');
      await setDoc(iceRef, {
        ...ice,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`ICE information saved to Firestore for ${userDeviceId}`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save ICE:', error);
      return false;
    }
  }

  /**
   * Load ICE information from Firestore
   */
  async loadICE(userDeviceId: string): Promise<any | null> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, cannot load ICE');
      return null;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return null;
      }

      const iceRef = doc(db, 'devices', userDeviceId, 'ice', 'main');
      const snapshot = await getDoc(iceRef);
      
      if (snapshot.exists()) {
        return snapshot.data();
      }
      return null;
    } catch (error) {
      logger.error('Failed to load ICE:', error);
      return null;
    }
  }

  /**
   * Save location update to Firestore
   */
  async saveLocationUpdate(userDeviceId: string, location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: number;
  }): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveLocationUpdate');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      // Save to locationUpdates subcollection
      const locationRef = doc(db, 'devices', userDeviceId, 'locationUpdates', `loc_${location.timestamp}`);
      await setDoc(locationRef, {
        ...location,
        deviceId: userDeviceId,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      // Also update device's last known location
      const deviceRef = doc(db, 'devices', userDeviceId);
      await setDoc(deviceRef, {
        lastLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
        },
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`Location update saved to Firestore for ${userDeviceId}`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save location update:', error);
      return false;
    }
  }

  /**
   * Save status update to Firestore
   */
  async saveStatusUpdate(userDeviceId: string, status: {
    status: string;
    location?: { latitude: number; longitude: number } | null;
    timestamp: number;
  }): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveStatusUpdate');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      // Save to statusUpdates subcollection
      const statusRef = doc(db, 'devices', userDeviceId, 'statusUpdates', `status_${status.timestamp}`);
      await setDoc(statusRef, {
        ...status,
        deviceId: userDeviceId,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      // Also update device's current status
      const deviceRef = doc(db, 'devices', userDeviceId);
      await setDoc(deviceRef, {
        currentStatus: status.status,
        lastStatusUpdate: status.timestamp,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`Status update saved to Firestore for ${userDeviceId}`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save status update:', error);
      return false;
    }
  }

  /**
   * Save earthquake data to Firestore (for critical earthquakes >= 4.0)
   */
  async saveEarthquake(earthquake: {
    id: string;
    location: string;
    magnitude: number;
    depth: number;
    time: number;
    latitude: number;
    longitude: number;
  }): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveEarthquake');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      const earthquakeRef = doc(db, 'earthquakes', earthquake.id);
      await setDoc(earthquakeRef, {
        ...earthquake,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`Earthquake ${earthquake.id} saved to Firestore`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save earthquake:', error);
      return false;
    }
  }

  /**
   * Save earthquake alert for user (notification tracking)
   */
  async saveEarthquakeAlert(userDeviceId: string, earthquakeId: string, alert: {
    earthquakeId: string;
    magnitude: number;
    location: string;
    timestamp: number;
    notified: boolean;
  }): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveEarthquakeAlert');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      const alertRef = doc(db, 'devices', userDeviceId, 'earthquakeAlerts', alert.earthquakeId);
      await setDoc(alertRef, {
        ...alert,
        deviceId: userDeviceId,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`Earthquake alert saved for ${userDeviceId}`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save earthquake alert:', error);
      return false;
    }
  }

  /**
   * Save earthquake analysis to Firestore (shared across all users)
   * This ensures analysis is done once and shared with all users
   */
  async saveEarthquakeAnalysis(earthquakeId: string, analysis: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    userMessage: string;
    recommendations: string[];
    verified: boolean;
    sources: string[];
    confidence: number;
    earthquakeId: string;
    magnitude: number;
    location: string;
    timestamp: number;
  }): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveEarthquakeAnalysis');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      const analysisRef = doc(db, 'earthquake_analyses', earthquakeId);
      await setDoc(analysisRef, {
        ...analysis,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`Earthquake analysis saved to Firestore: ${earthquakeId}`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save earthquake analysis:', error);
      return false;
    }
  }

  /**
   * Get earthquake analysis from Firestore (shared analysis)
   * Returns null if analysis doesn't exist or is expired
   */
  async getEarthquakeAnalysis(earthquakeId: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    userMessage: string;
    recommendations: string[];
    verified: boolean;
    sources: string[];
    confidence: number;
    createdAt: string;
  } | null> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, cannot get earthquake analysis');
      return null;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return null;
      }

      const analysisRef = doc(db, 'earthquake_analyses', earthquakeId);
      const snapshot = await getDoc(analysisRef);
      
      if (snapshot.exists()) {
        const data = snapshot.data();
        // Analysis is valid for 24 hours
        const createdAt = new Date(data.createdAt).getTime();
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (now - createdAt > maxAge) {
          logger.info(`Earthquake analysis expired for ${earthquakeId}`);
          return null;
        }
        
        return {
          riskLevel: data.riskLevel,
          userMessage: data.userMessage,
          recommendations: data.recommendations || [],
          verified: data.verified,
          sources: data.sources || [],
          confidence: data.confidence,
          createdAt: data.createdAt,
        };
      }
      return null;
    } catch (error) {
      logger.error('Failed to get earthquake analysis:', error);
      return null;
    }
  }

  /**
   * Save AI generated news summary so it can be reused by other clients
   */
  async saveNewsSummary(articleId: string, payload: {
    summary: string;
    source?: string;
    title?: string;
    url?: string;
    publishedAt?: number;
    createdByDeviceId: string;
    ttlMs?: number;
  }): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveNewsSummary');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      const summaryRef = doc(db, 'news_summaries', articleId);
      const ttlMs = payload.ttlMs ?? DEFAULT_NEWS_SUMMARY_TTL_MS;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlMs);

      let createdAtIso = now.toISOString();
      try {
        const existing = await getDoc(summaryRef);
        if (existing.exists()) {
          const data = existing.data() as NewsSummaryRecord;
          if (data?.createdAt) {
            createdAtIso = data.createdAt;
          }
        }
      } catch (error) {
        logger.warn('Failed to read existing news summary metadata:', error);
      }

      await setDoc(summaryRef, {
        articleId,
        summary: payload.summary,
        source: payload.source ?? null,
        title: payload.title ?? null,
        url: payload.url ?? null,
        publishedAt: payload.publishedAt ?? null,
        ttlMs,
        createdByDeviceId: payload.createdByDeviceId,
        updatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        createdAt: createdAtIso,
        version: 1,
      }, { merge: true });

      if (__DEV__) {
        logger.info(`News summary saved to Firestore: ${articleId}`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save news summary:', error);
      return false;
    }
  }

  /**
   * Load cached news summary from Firestore
   */
  async getNewsSummary(articleId: string): Promise<NewsSummaryRecord | null> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, cannot get news summary');
      return null;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return null;
      }

      const summaryRef = doc(db, 'news_summaries', articleId);
      const snapshot = await getDoc(summaryRef);
      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data() as NewsSummaryRecord;
      if (!data?.summary) {
        return null;
      }

      if (data.expiresAt) {
        const expiresMs = new Date(data.expiresAt).getTime();
        if (!Number.isNaN(expiresMs) && expiresMs < Date.now()) {
          logger.info(`News summary expired in Firestore: ${articleId}`);
          return null;
        }
      }

      return {
        articleId,
        summary: data.summary,
        source: data.source ?? null,
        title: data.title ?? null,
        url: data.url ?? null,
        publishedAt: data.publishedAt ?? null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        expiresAt: data.expiresAt,
        ttlMs: data.ttlMs ?? DEFAULT_NEWS_SUMMARY_TTL_MS,
        version: data.version ?? 1,
        createdByDeviceId: data.createdByDeviceId ?? null,
      };
    } catch (error) {
      logger.error('Failed to load news summary:', error);
      return null;
    }
  }

  /**
   * Subscribe to location updates for a family member (real-time sync)
   */
  subscribeToLocationUpdates(userDeviceId: string, callback: (location: any) => void): () => void {
    try {
      const db = getFirestoreInstance();
      if (!db) return () => {};

      const locationsRef = collection(db, 'devices', userDeviceId, 'locationUpdates');
      const q = query(locationsRef, where('timestamp', '>', Date.now() - 3600000)); // Last hour
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.forEach((doc) => {
          callback(doc.data());
        });
      });

      return unsubscribe;
    } catch (error) {
      logger.error('Failed to subscribe to location updates:', error);
      return () => {};
    }
  }

  /**
   * Subscribe to status updates for a family member (real-time sync)
   */
  subscribeToStatusUpdates(userDeviceId: string, callback: (status: any) => void): () => void {
    try {
      const db = getFirestoreInstance();
      if (!db) return () => {};

      const statusesRef = collection(db, 'devices', userDeviceId, 'statusUpdates');
      const q = query(statusesRef, where('timestamp', '>', Date.now() - 3600000)); // Last hour
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.forEach((doc) => {
          callback(doc.data());
        });
      });

      return unsubscribe;
    } catch (error) {
      logger.error('Failed to subscribe to status updates:', error);
      return () => {};
    }
  }
}

export const firebaseDataService = new FirebaseDataService();

