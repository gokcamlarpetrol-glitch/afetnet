/**
 * FIREBASE FAMILY OPERATIONS - ELITE MODULAR
 * Handles family member Firestore operations
 * ELITE: Includes retry mechanism, timeout protection, and Turkish localization
 */

import { doc, setDoc, getDocs, deleteDoc, collection, onSnapshot, FirestoreError } from 'firebase/firestore';
import { FamilyMember } from '../../types/family';
import { createLogger } from '../../utils/logger';
import { retryWithBackoff } from '../../utils/retry';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';

const logger = createLogger('FirebaseFamilyOperations');
const TIMEOUT_MS = 10000; // 10 seconds
const RETRY_CONFIG = { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 5000 };

// ELITE: Type-safe error helpers
const getErrorMessage = (e: unknown): string => e instanceof Error ? e.message : String(e);
const getErrorCode = (e: unknown): string | undefined =>
  e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : undefined;

/**
 * Execute Firestore operation with timeout protection
 */
async function withTimeout<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operationName} timeout`)), TIMEOUT_MS),
  );

  return Promise.race([operation(), timeoutPromise]);
}

/**
 * Handle Firestore errors gracefully
 */
function handleFirestoreError(error: unknown, operationName: string): boolean {
  const firestoreError = error as FirestoreError & { message?: string };
  const errorMessage = firestoreError?.message || String(error);

  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    if (__DEV__) {
      logger.debug(`${operationName} zaman aşımı (zayıf ağ koşullarında beklenir)`);
    }
    return false;
  }

  if (firestoreError?.code === 'permission-denied' || errorMessage.includes('permission') || errorMessage.includes('Missing or insufficient permissions')) {
    if (__DEV__) {
      logger.debug(`${operationName} atlandı (izin reddedildi - yerel depolama ile devam)`);
    }
    return false;
  }

  logger.error(`${operationName} başarısız:`, error);
  return false;
}

/**
 * Save family member to Firestore with retry
 */
export async function saveFamilyMember(
  userDeviceId: string,
  member: FamilyMember,
  isInitialized: boolean,
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('Firebase başlatılmadı, aile üdyesi kaydetme atlanıyor');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore kullanılamıyor');
      return false;
    }

    const memberRef = doc(db, 'devices', userDeviceId, 'familyMembers', member.id);

    await retryWithBackoff(
      () => withTimeout(
        () => setDoc(memberRef, {
          ...member,
          updatedAt: new Date().toISOString(),
        }, { merge: true }),
        'Aile üyesi kaydetme',
      ),
      RETRY_CONFIG,
    );

    if (__DEV__) {
      logger.info(`Aile üyesi ${member.id} Firestore'a kaydedildi`);
    }
    return true;
  } catch (error: unknown) {
    return handleFirestoreError(error, 'saveFamilyMember');
  }
}

/**
 * Load family members from Firestore with retry
 */
export async function loadFamilyMembers(
  userDeviceId: string,
  isInitialized: boolean,
): Promise<FamilyMember[]> {
  if (!isInitialized) {
    logger.warn('Firebase başlatılmadı, aile üyeleri yüklenemiyor');
    return [];
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore kullanılamıyor');
      return [];
    }

    const membersRef = collection(db, 'devices', userDeviceId, 'familyMembers');

    const snapshot = await retryWithBackoff(
      () => withTimeout(
        () => getDocs(membersRef),
        'Aile üyeleri yükleme',
      ),
      RETRY_CONFIG,
    );

    const members: FamilyMember[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      members.push(data as FamilyMember);
    });

    if (__DEV__) {
      logger.info(`Firestore'dan ${members.length} aile üyesi yüklendi`);
    }
    return members;
  } catch (error: unknown) {
    handleFirestoreError(error, 'loadFamilyMembers');
    return [];
  }
}

/**
 * Delete family member from Firestore with retry
 */
export async function deleteFamilyMember(
  userDeviceId: string,
  memberId: string,
  isInitialized: boolean,
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('Firebase başlatılmadı, aile üyesi silme atlanıyor');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore kullanılamıyor');
      return false;
    }

    const memberRef = doc(db, 'devices', userDeviceId, 'familyMembers', memberId);

    await retryWithBackoff(
      () => withTimeout(
        () => deleteDoc(memberRef),
        'Aile üyesi silme',
      ),
      RETRY_CONFIG,
    );

    if (__DEV__) {
      logger.info(`Aile üyesi ${memberId} Firestore'dan silindi`);
    }
    return true;
  } catch (error: unknown) {
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
  isInitialized: boolean = false,
): Promise<() => void> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot subscribe to family members');
    return () => { };
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available for family members subscription');
      return () => { };
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
      },
    );

    if (__DEV__) {
      logger.info(`✅ Subscribed to real-time family members for device: ${userDeviceId}`);
    }

    return unsubscribe;
  } catch (error: unknown) {
    const errCode = getErrorCode(error);
    const errMsg = getErrorMessage(error);
    if (errCode === 'permission-denied' || errMsg.includes('permission') || errMsg.includes('Missing or insufficient permissions')) {
      if (__DEV__) {
        logger.debug('Family members subscription setup skipped (permission denied - app continues with local storage)');
      }
      return () => { };
    }
    logger.error('Failed to subscribe to family members:', error);
    if (onError) {
      onError(error);
    }
    return () => { };
  }
}

