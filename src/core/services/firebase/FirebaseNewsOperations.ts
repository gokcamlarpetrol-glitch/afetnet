/**
 * FIREBASE NEWS OPERATIONS - ELITE MODULAR
 * Handles news summary Firestore operations
 */

import { doc, setDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';

const logger = createLogger('FirebaseNewsOperations');
const TIMEOUT_MS = 10000; // 10 seconds

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

/**
 * Save news summary to Firestore
 */
export async function saveNewsSummary(
  summary: NewsSummaryRecord,
  isInitialized: boolean,
): Promise<boolean> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, skipping saveNewsSummary');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    // CRITICAL: Use articleId as document ID (not deviceId) - shared across all users
    await withTimeout(
      () => setDoc(doc(db, 'news_summaries', summary.id), {
        ...summary,
        updatedAt: new Date().toISOString(),
      }, { merge: true }),
      'News summary save',
    );

    if (__DEV__) {
      logger.info(`✅ Shared news summary saved to Firestore (articleId: ${summary.id}) - all users will use this`);
    }
    return true;
  } catch (error: unknown) {
    const errCode = getErrorCode(error);
    const errMsg = getErrorMessage(error);
    if (errCode === 'permission-denied' || errMsg.includes('permission')) {
      if (__DEV__) {
        logger.debug('News summary skipped (permission denied - this is OK)');
      }
    } else {
      logger.warn('Failed to save news summary:', error);
    }
    return false;
  }
}

/**
 * Get news summary from Firestore
 */
export async function getNewsSummary(
  articleId: string,
  isInitialized: boolean,
): Promise<NewsSummaryRecord | null> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot get news summary');
    return null;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return null;
    }

    const q = query(collection(db, 'news_summaries'), where('articleId', '==', articleId));

    const snapshot = await withTimeout(
      () => getDocs(q),
      'News summary load',
    );

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as NewsSummaryRecord;
  } catch (error: unknown) {
    const errCode = getErrorCode(error);
    const errMsg = getErrorMessage(error);
    if (errCode === 'permission-denied' || errMsg.includes('permission')) {
      if (__DEV__) {
        logger.debug('News summary read skipped (permission denied - this is OK)');
      }
    } else {
      logger.warn('Failed to get news summary:', error);
    }
    return null;
  }
}

