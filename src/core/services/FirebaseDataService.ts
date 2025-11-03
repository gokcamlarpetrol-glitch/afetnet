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

// Import Firebase app
import firebaseApp from '../../lib/firebase';

let firestore: any = null;

function getFirestoreInstance() {
  if (!firestore && firebaseApp) {
    try {
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
}

export const firebaseDataService = new FirebaseDataService();

