/**
 * FIREBASE NEWS OPERATIONS - ELITE MODULAR
 * Handles news summary Firestore operations
 */

import { doc, setDoc, getDoc, getDocs, query, collection, where, runTransaction } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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
  createdBy?: string;
  model?: string;
  promptVersion?: number;
  sourceHash?: string;
  isFallback?: boolean;
}

export interface NewsSummaryJobClaimResult {
  acquired: boolean;
  reason: 'acquired' | 'summary_exists' | 'lock_held' | 'not_initialized' | 'no_auth' | 'firestore_unavailable' | 'error';
  waitMs?: number;
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
    // ELITE: createdBy alanı ile Firestore ownership kuralını karşıla
    const currentUid = getAuth().currentUser?.uid;
    if (!currentUid) {
      logger.warn('News summary save skipped: no authenticated user');
      return false;
    }
    const ttlMs = Math.max(5 * 60 * 1000, Math.floor(summary.ttlMs || 12 * 60 * 60 * 1000));
    const nowIso = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + ttlMs).toISOString();
    const docId = (summary.articleId || summary.id || '').trim();
    if (!docId) {
      logger.warn('News summary save skipped: missing articleId/id');
      return false;
    }

    await withTimeout(
      () => setDoc(doc(db, 'news_summaries', docId), {
        ...summary,
        id: docId,
        articleId: docId,
        updatedAt: nowIso,
        createdAt: summary.createdAt || nowIso,
        ttlMs,
        expiresAt: expiresAtIso,
        createdBy: currentUid,
      }, { merge: true }),
      'News summary save',
    );

    if (__DEV__) {
      logger.info(`✅ Shared news summary saved to Firestore (articleId: ${docId}) - all users will use this`);
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

    const directRef = doc(db, 'news_summaries', articleId);
    const directSnap = await withTimeout(
      () => getDoc(directRef),
      'News summary direct load',
    );
    if (directSnap.exists()) {
      return directSnap.data() as NewsSummaryRecord;
    }

    // Legacy fallback for records written with non-article doc IDs.
    const q = query(collection(db, 'news_summaries'), where('articleId', '==', articleId));
    const snapshot = await withTimeout(
      () => getDocs(q),
      'News summary fallback query load',
    );
    return snapshot.empty ? null : snapshot.docs[0].data() as NewsSummaryRecord;
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

export async function claimNewsSummaryJob(
  articleId: string,
  leaseMs: number,
  isInitialized: boolean,
): Promise<NewsSummaryJobClaimResult> {
  if (!isInitialized) {
    logger.warn('FirebaseDataService not initialized, cannot claim news summary job');
    return { acquired: false, reason: 'not_initialized' };
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return { acquired: false, reason: 'firestore_unavailable' };
    }

    const currentUid = getAuth().currentUser?.uid;
    if (!currentUid) {
      logger.warn('Cannot claim news summary job: user not authenticated');
      return { acquired: false, reason: 'no_auth' };
    }

    const normalizedLeaseMs = Math.max(15_000, Math.min(120_000, Math.floor(leaseMs)));
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const summaryRef = doc(db, 'news_summaries', articleId);
    const jobRef = doc(db, 'news_summary_jobs', articleId);

    return await withTimeout(
      () => runTransaction(db, async (tx) => {
        const summarySnap = await tx.get(summaryRef);
        if (summarySnap.exists()) {
          const summaryData = summarySnap.data();
          if (typeof summaryData?.summary === 'string' && summaryData.summary.trim().length > 0) {
            return { acquired: false, reason: 'summary_exists' } as NewsSummaryJobClaimResult;
          }
        }

        const jobSnap = await tx.get(jobRef);
        if (jobSnap.exists()) {
          const jobData = jobSnap.data() as Record<string, unknown>;
          const ownerUid = typeof jobData.ownerUid === 'string' ? jobData.ownerUid : '';
          const status = typeof jobData.status === 'string' ? jobData.status : '';
          const leaseUntil = typeof jobData.leaseUntil === 'number' ? jobData.leaseUntil : 0;
          const activeLock = status === 'processing' && leaseUntil > now && ownerUid !== '' && ownerUid !== currentUid;
          if (activeLock) {
            return {
              acquired: false,
              reason: 'lock_held',
              waitMs: Math.max(500, leaseUntil - now),
            } as NewsSummaryJobClaimResult;
          }
        }

        tx.set(jobRef, {
          articleId,
          ownerUid: currentUid,
          status: 'processing',
          leaseUntil: now + normalizedLeaseMs,
          updatedAt: nowIso,
          createdAt: jobSnap.exists() ? (jobSnap.data()?.createdAt || nowIso) : nowIso,
        }, { merge: true });

        return {
          acquired: true,
          reason: 'acquired',
          waitMs: normalizedLeaseMs,
        } as NewsSummaryJobClaimResult;
      }),
      'News summary job claim',
    );
  } catch (error: unknown) {
    const errCode = getErrorCode(error);
    const errMsg = getErrorMessage(error);
    if (errCode === 'permission-denied' || errMsg.includes('permission')) {
      if (__DEV__) {
        logger.debug('News summary job claim denied by rules');
      }
    } else {
      logger.warn('Failed to claim news summary job:', error);
    }
    return { acquired: false, reason: 'error' };
  }
}

export async function finalizeNewsSummaryJob(
  articleId: string,
  status: 'completed' | 'failed',
  isInitialized: boolean,
  errorMessage?: string,
): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return;

    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      articleId,
      status,
      leaseUntil: Date.now(),
      updatedAt: now,
    };

    if (status === 'completed') {
      payload.completedAt = now;
      payload.lastError = null;
    } else if (errorMessage) {
      payload.lastError = errorMessage.substring(0, 300);
      payload.failedAt = now;
    }

    await withTimeout(
      () => setDoc(doc(db, 'news_summary_jobs', articleId), payload, { merge: true }),
      'News summary job finalize',
    );
  } catch (error) {
    if (__DEV__) {
      logger.debug('Failed to finalize news summary job:', error);
    }
  }
}
