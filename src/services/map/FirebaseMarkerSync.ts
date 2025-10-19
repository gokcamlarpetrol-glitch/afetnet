import { logger } from '../../utils/productionLogger';
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot, type Firestore } from 'firebase/firestore';
import { getMapMarkerSync } from './MapMarkerSync';
import type { Pin } from '../../map/pins';

/**
 * FirebaseMarkerSync - Syncs map markers with Firebase Firestore
 * Real-time synchronization with offline support
 */
class FirebaseMarkerSync {
  private db: Firestore | null = null;
  private unsubscribe: (() => void) | null = null;
  private userId: string | null = null;

  constructor() {
    this.initFirestore();
  }

  /**
   * Initialize Firestore
   */
  private async initFirestore() {
    try {
      const firebase = await import('../../lib/firebase');
      if (firebase.default) {
        this.db = getFirestore(firebase.default);
        logger.info('Firestore initialized');
      } else {
        logger.warn('Firebase not initialized, using fallback mode');
      }
    } catch (error) {
      logger.error('Failed to initialize Firestore:', error);
    }
  }

  /**
   * Set user ID for syncing
   */
  setUserId(userId: string) {
    this.userId = userId;
    logger.info('User ID set for marker sync:', userId);
  }

  /**
   * Sync marker to Firebase
   */
  async syncMarker(pin: Pin): Promise<void> {
    if (!this.db || !this.userId) {
      logger.warn('Firestore not initialized or user ID not set');
      return;
    }

    try {
      const markersRef = collection(this.db, `users/${this.userId}/markers`);
      const markerDoc = doc(markersRef, pin.id);
      
      await setDoc(markerDoc, {
        id: pin.id,
        kind: pin.kind,
        title: pin.title,
        lat: pin.lat,
        lon: pin.lon,
        status: pin.status,
        ref: pin.ref,
        ts: pin.ts,
        syncedAt: Date.now(),
      }, { merge: true });

      logger.info('Marker synced to Firebase:', pin.id);
    } catch (error) {
      logger.error('Failed to sync marker to Firebase:', error);
      throw error;
    }
  }

  /**
   * Delete marker from Firebase
   */
  async deleteMarker(markerId: string): Promise<void> {
    if (!this.db || !this.userId) {
      logger.warn('Firestore not initialized or user ID not set');
      return;
    }

    try {
      const markersRef = collection(this.db, `users/${this.userId}/markers`);
      const markerDoc = doc(markersRef, markerId);
      
      await deleteDoc(markerDoc);
      logger.info('Marker deleted from Firebase:', markerId);
    } catch (error) {
      logger.error('Failed to delete marker from Firebase:', error);
      throw error;
    }
  }

  /**
   * Fetch all markers from Firebase
   */
  async fetchMarkers(): Promise<Pin[]> {
    if (!this.db || !this.userId) {
      logger.warn('Firestore not initialized or user ID not set');
      return [];
    }

    try {
      const markersRef = collection(this.db, `users/${this.userId}/markers`);
      const snapshot = await getDocs(markersRef);
      
      const markers: Pin[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        markers.push({
          id: data.id,
          kind: data.kind,
          title: data.title,
          lat: data.lat,
          lon: data.lon,
          status: data.status,
          ref: data.ref,
          ts: data.ts,
        });
      });

      logger.info('Fetched markers from Firebase:', markers.length);
      return markers;
    } catch (error) {
      logger.error('Failed to fetch markers from Firebase:', error);
      return [];
    }
  }

  /**
   * Start real-time sync from Firebase
   */
  startRealtimeSync(onMarkerUpdate: (pin: Pin) => void, onMarkerDelete: (id: string) => void) {
    if (!this.db || !this.userId) {
      logger.warn('Firestore not initialized or user ID not set');
      return;
    }

    try {
      const markersRef = collection(this.db, `users/${this.userId}/markers`);
      
      this.unsubscribe = onSnapshot(markersRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            const pin: Pin = {
              id: data.id,
              kind: data.kind,
              title: data.title,
              lat: data.lat,
              lon: data.lon,
              status: data.status,
              ref: data.ref,
              ts: data.ts,
            };
            onMarkerUpdate(pin);
          } else if (change.type === 'removed') {
            onMarkerDelete(change.doc.id);
          }
        });
      });

      logger.info('Real-time sync started');
    } catch (error) {
      logger.error('Failed to start real-time sync:', error);
    }
  }

  /**
   * Stop real-time sync
   */
  stopRealtimeSync() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      logger.info('Real-time sync stopped');
    }
  }

  /**
   * Sync all local markers to Firebase
   */
  async syncAllLocalMarkers(): Promise<void> {
    if (!this.db || !this.userId) {
      logger.warn('Firestore not initialized or user ID not set');
      return;
    }

    try {
      const { listPins } = await import('../../map/pins');
      const localPins = await listPins();

      logger.info('Syncing all local markers to Firebase:', localPins.length);

      for (const pin of localPins) {
        await this.syncMarker(pin);
      }

      logger.info('All local markers synced to Firebase');
    } catch (error) {
      logger.error('Failed to sync all local markers:', error);
      throw error;
    }
  }

  /**
   * Pull all markers from Firebase and merge with local
   */
  async pullAndMergeMarkers(): Promise<void> {
    if (!this.db || !this.userId) {
      logger.warn('Firestore not initialized or user ID not set');
      return;
    }

    try {
      const firebaseMarkers = await this.fetchMarkers();
      const { upsertPin } = await import('../../map/pins');

      logger.info('Pulling markers from Firebase:', firebaseMarkers.length);

      for (const pin of firebaseMarkers) {
        await upsertPin(pin);
      }

      logger.info('Markers pulled and merged with local database');
    } catch (error) {
      logger.error('Failed to pull and merge markers:', error);
      throw error;
    }
  }
}

// Singleton instance
let firebaseSyncInstance: FirebaseMarkerSync | null = null;

export function getFirebaseMarkerSync(): FirebaseMarkerSync {
  if (!firebaseSyncInstance) {
    firebaseSyncInstance = new FirebaseMarkerSync();
  }
  return firebaseSyncInstance;
}

export default getFirebaseMarkerSync;


