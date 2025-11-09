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

export interface NewsSummaryRecord {
  id: string;
  articleId: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  ttlMs?: number;
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
   * Save news summary to Firestore
   */
  async saveNewsSummary(summary: NewsSummaryRecord): Promise<boolean> {
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

      await setDoc(doc(db, 'newsSummaries', summary.id), {
        ...summary,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info(`News summary saved to Firestore: ${summary.id}`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save news summary:', error);
      return false;
    }
  }

  /**
   * Get news summary from Firestore
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

      const q = query(collection(db, 'newsSummaries'), where('articleId', '==', articleId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs[0].data() as NewsSummaryRecord;
    } catch (error) {
      logger.error('Failed to get news summary:', error);
      return null;
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

      await setDoc(doc(db, 'devices', userDeviceId, 'healthProfile', 'current'), {
        ...profile,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info('Health profile saved to Firestore');
      }
      return true;
    } catch (error) {
      logger.error('Failed to save health profile:', error);
      return false;
    }
  }

  /**
   * Save earthquake to Firestore
   */
  async saveEarthquake(earthquake: any): Promise<boolean> {
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

      const earthquakeId = earthquake.id || `${earthquake.timestamp}_${earthquake.magnitude}`;
      await setDoc(doc(db, 'earthquakes', earthquakeId), {
        ...earthquake,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info('Earthquake saved to Firestore:', earthquakeId);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save earthquake:', error);
      return false;
    }
  }

  /**
   * Save felt earthquake report to Firestore
   */
  async saveFeltEarthquakeReport(report: any): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, skipping saveFeltEarthquakeReport');
      return false;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return false;
      }

      const reportId = report.id || `${report.earthquakeId}_${Date.now()}`;
      await setDoc(doc(db, 'feltEarthquakes', reportId), {
        ...report,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info('Felt earthquake report saved to Firestore:', reportId);
      }
      return true;
    } catch (error) {
      logger.error('Failed to save felt earthquake report:', error);
      return false;
    }
  }

  /**
   * Get intensity data from Firestore
   */
  async getIntensityData(earthquakeId: string): Promise<any | null> {
    if (!this._isInitialized) {
      logger.warn('FirebaseDataService not initialized, cannot get intensity data');
      return null;
    }

    try {
      const db = getFirestoreInstance();
      if (!db) {
        logger.warn('Firestore not available');
        return null;
      }

      const q = query(collection(db, 'feltEarthquakes'), where('earthquakeId', '==', earthquakeId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs.map(doc => doc.data());
    } catch (error) {
      logger.error('Failed to get intensity data:', error);
      return null;
    }
  }

  /**
   * Save location update to Firestore
   */
  async saveLocationUpdate(userDeviceId: string, location: any): Promise<boolean> {
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

      await setDoc(doc(db, 'devices', userDeviceId, 'locations', Date.now().toString()), {
        ...location,
        timestamp: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info('Location update saved to Firestore');
      }
      return true;
    } catch (error) {
      logger.error('Failed to save location update:', error);
      return false;
    }
  }

  /**
   * Save ICE (In Case of Emergency) data to Firestore
   */
  async saveICE(userDeviceId: string, iceData: any): Promise<boolean> {
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

      await setDoc(doc(db, 'devices', userDeviceId, 'ice', 'current'), {
        ...iceData,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (__DEV__) {
        logger.info('ICE data saved to Firestore');
      }
      return true;
    } catch (error) {
      logger.error('Failed to save ICE data:', error);
      return false;
    }
  }

  /**
   * Load ICE (In Case of Emergency) data from Firestore
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

      const iceRef = doc(db, 'devices', userDeviceId, 'ice', 'current');
      const snapshot = await getDoc(iceRef);
      
      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.data();
    } catch (error) {
      logger.error('Failed to load ICE data:', error);
      return null;
    }
  }
}

export const firebaseDataService = new FirebaseDataService();

