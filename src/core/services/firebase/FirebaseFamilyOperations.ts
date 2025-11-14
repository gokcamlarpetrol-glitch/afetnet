/**
 * FIREBASE FAMILY OPERATIONS - ELITE MODULAR
 * Handles family member Firestore operations
 */

import { doc, setDoc, getDocs, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { FamilyMember } from '../../types/family';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';

const logger = createLogger('FirebaseFamilyOperations');
const TIMEOUT_MS = 10000; // 10 seconds

/**
 * Execute Firestore operation with timeout protection
 */
async function withTimeout<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operationName} timeout`)), TIMEOUT_MS)
  );
  
  return Promise.race([operation(), timeoutPromise]);
}

/**
 * Handle Firestore errors gracefully
 */
function handleFirestoreError(error: any, operationName: string): boolean {
  const errorMessage = error?.message || String(error);
  
  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    if (__DEV__) {
      logger.debug(`${operationName} timed out (expected in poor network conditions)`);
    }
    return false;
  }
  
  if (error?.code === 'permission-denied' || errorMessage.includes('permission') || errorMessage.includes('Missing or insufficient permissions')) {
    if (__DEV__) {
      logger.debug(`${operationName} skipped (permission denied - app continues with local storage)`);
    }
    return false;
  }
  
  logger.error(`Failed ${operationName}:`, error);
  return false;
}

/**
 * Save family member to Firestore
 */
export async function saveFamilyMember(
  userDeviceId: string,
  member: FamilyMember,
  isInitialized: boolean
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping saveFamilyMember');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    const memberRef = doc(db, 'devices', userDeviceId, 'familyMembers', member.id);
    
    await withTimeout(
      () => setDoc(memberRef, {
        ...member,
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'Family member save'
    );

    if (__DEV__) {
      logger.info(`Family member ${member.id} saved to Firestore`);
    }
    return true;
  } catch (error: any) {
    return handleFirestoreError(error, 'saveFamilyMember');
  }
}

/**
 * Load family members from Firestore
 */
export async function loadFamilyMembers(
  userDeviceId: string,
  isInitialized: boolean
): Promise<FamilyMember[]> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot load family members');
    return [];
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return [];
    }

    const membersRef = collection(db, 'devices', userDeviceId, 'familyMembers');
    
    const snapshot = await withTimeout(
      () => getDocs(membersRef),
      'Family members load'
    );
    
    const members: FamilyMember[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      members.push(data as FamilyMember);
    });

    if (__DEV__) {
      logger.info(`Loaded ${members.length} family members from Firestore`);
    }
    return members;
  } catch (error: any) {
    handleFirestoreError(error, 'loadFamilyMembers');
    return [];
  }
}

/**
 * Delete family member from Firestore
 */
export async function deleteFamilyMember(
  userDeviceId: string,
  memberId: string,
  isInitialized: boolean
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping deleteFamilyMember');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    const memberRef = doc(db, 'devices', userDeviceId, 'familyMembers', memberId);
    
    await withTimeout(
      () => deleteDoc(memberRef),
      'Family member delete'
    );

    if (__DEV__) {
      logger.info(`Family member ${memberId} deleted from Firestore`);
    }
    return true;
  } catch (error: any) {
    return handleFirestoreError(error, 'deleteFamilyMember');
  }
}

/**
 * Subscribe to family members changes (real-time sync)
 */
export async function subscribeToFamilyMembers(
  userDeviceId: string,
  callback: (members: FamilyMember[]) => void,
  onError?: (error: any) => void,
  isInitialized: boolean = false
): Promise<() => void> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot subscribe to family members');
    return () => {};
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available for family members subscription');
      return () => {};
    }

    const membersRef = collection(db, 'devices', userDeviceId, 'familyMembers');
    
    const unsubscribe = onSnapshot(
      membersRef,
      (snapshot) => {
        try {
          const members: FamilyMember[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            members.push(data as FamilyMember);
          });
          callback(members);
        } catch (error) {
          logger.error('Error processing family members snapshot:', error);
          if (onError) {
            onError(error);
          }
        }
      },
      (error: any) => {
        if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Missing or insufficient permissions')) {
          if (__DEV__) {
            logger.debug('Family members subscription skipped (permission denied - Firebase rules may restrict access, app continues with local storage)');
          }
          return;
        }
        logger.error('Family members subscription error:', error);
        if (onError) {
          onError(error);
        }
      }
    );

    if (__DEV__) {
      logger.info(`✅ Subscribed to real-time family members for device: ${userDeviceId}`);
    }

    return unsubscribe;
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Missing or insufficient permissions')) {
      if (__DEV__) {
        logger.debug('Family members subscription setup skipped (permission denied - app continues with local storage)');
      }
      return () => {};
    }
    logger.error('Failed to subscribe to family members:', error);
    if (onError) {
      onError(error);
    }
    return () => {};
  }
}

