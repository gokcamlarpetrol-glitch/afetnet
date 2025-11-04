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

