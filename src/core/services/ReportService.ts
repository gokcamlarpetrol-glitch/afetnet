/**
 * REPORT SERVICE - UGC Moderation & Content Reporting
 * Handles user reports for chat messages, user profiles, and community content.
 * Writes to Firestore `reports` collection for moderation review.
 * Required for Apple Guideline 1.2 compliance.
 */

import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import { getFirebaseAuth } from '../../lib/firebase';
import { createLogger } from '../utils/logger';

const logger = createLogger('ReportService');

// ============================================================
// TYPES
// ============================================================

export type ReportType = 'chat_message' | 'user_profile' | 'community_report' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'action_taken' | 'dismissed';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate_content'
  | 'fake_account'
  | 'misinformation'
  | 'other';

export interface ReportData {
  reporterId: string;
  reportedUserId?: string;
  reportedContentId?: string;
  reportType: ReportType;
  reason: ReportReason;
  reasonLabel: string;
  description?: string;
  status: ReportStatus;
  createdAt: number;
  metadata?: {
    conversationId?: string;
    messageContent?: string;
    screenshots?: string[];
    location?: {
      latitude: number;
      longitude: number;
    };
  };
}

export interface UserReport {
  id: string;
  reportType: ReportType;
  reasonLabel: string;
  status: ReportStatus;
  createdAt: number;
  description?: string;
}

// ============================================================
// REASON LABELS (Turkish)
// ============================================================

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Taciz' },
  { key: 'inappropriate_content', label: 'Uygunsuz İçerik' },
  { key: 'fake_account', label: 'Sahte Hesap' },
  { key: 'misinformation', label: 'Yanıltıcı Bilgi' },
  { key: 'other', label: 'Diğer' },
];

// ============================================================
// SERVICE
// ============================================================

class ReportServiceImpl {
  /**
   * Submit a report to Firestore `reports` collection.
   * Returns the report document ID on success.
   */
  async submitReport(params: {
    reportedUserId?: string;
    reportedContentId?: string;
    reportType: ReportType;
    reason: ReportReason;
    reasonLabel: string;
    description?: string;
    metadata?: ReportData['metadata'];
  }): Promise<string> {
    const auth = getFirebaseAuth();
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      throw new Error('Rapor göndermek için giriş yapmanız gerekiyor.');
    }

    const db = await getFirestoreInstanceAsync();
    if (!db) {
      throw new Error('Veritabanı bağlantısı kurulamadı.');
    }

    const reportData: ReportData = {
      reporterId: currentUser.uid,
      reportedUserId: params.reportedUserId || undefined,
      reportedContentId: params.reportedContentId || undefined,
      reportType: params.reportType,
      reason: params.reason,
      reasonLabel: params.reasonLabel,
      description: params.description?.trim() || undefined,
      status: 'pending',
      createdAt: Date.now(),
      metadata: params.metadata || undefined,
    };

    // Clean undefined fields to avoid Firestore issues
    const cleanData = JSON.parse(JSON.stringify(reportData));

    try {
      const reportsRef = collection(db, 'reports');
      const docRef = await addDoc(reportsRef, cleanData);
      logger.info(`Report submitted: ${docRef.id} (type: ${params.reportType}, reason: ${params.reason})`);
      return docRef.id;
    } catch (error) {
      logger.error('Failed to submit report:', error);
      throw new Error('Rapor gönderilemedi. Lütfen tekrar deneyin.');
    }
  }

  /**
   * Submit a chat message report (convenience method).
   */
  async reportChatMessage(params: {
    reportedUserId: string;
    conversationId: string;
    messageId?: string;
    messageContent?: string;
    reason: ReportReason;
    reasonLabel: string;
    description?: string;
  }): Promise<string> {
    return this.submitReport({
      reportedUserId: params.reportedUserId,
      reportedContentId: params.messageId,
      reportType: 'chat_message',
      reason: params.reason,
      reasonLabel: params.reasonLabel,
      description: params.description,
      metadata: {
        conversationId: params.conversationId,
        messageContent: params.messageContent,
      },
    });
  }

  /**
   * Submit a community content report (map events, etc.).
   */
  async reportCommunityContent(params: {
    contentId?: string;
    reason: ReportReason;
    reasonLabel: string;
    description?: string;
    location?: { latitude: number; longitude: number };
  }): Promise<string> {
    return this.submitReport({
      reportedContentId: params.contentId,
      reportType: 'community_report',
      reason: params.reason,
      reasonLabel: params.reasonLabel,
      description: params.description,
      metadata: {
        location: params.location,
      },
    });
  }

  /**
   * Fetch the current user's own reports (to check status).
   * Returns up to 20 most recent reports.
   */
  async getMyReports(): Promise<UserReport[]> {
    const auth = getFirebaseAuth();
    const currentUser = auth?.currentUser;
    if (!currentUser) return [];

    const db = await getFirestoreInstanceAsync();
    if (!db) return [];

    try {
      const reportsRef = collection(db, 'reports');
      const q = query(
        reportsRef,
        where('reporterId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(20),
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          reportType: data.reportType,
          reasonLabel: data.reasonLabel,
          status: data.status,
          createdAt: data.createdAt,
          description: data.description,
        } as UserReport;
      });
    } catch (error) {
      logger.error('Failed to fetch my reports:', error);
      return [];
    }
  }
}

export const reportService = new ReportServiceImpl();
