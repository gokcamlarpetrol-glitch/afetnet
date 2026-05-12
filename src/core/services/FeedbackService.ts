/**
 * FEEDBACK SERVICE
 *
 * Kullanıcı geri bildirimini Firestore `feedback/{uid}_{timestamp}` koleksiyonuna
 * yazar. Backend Cloud Function dosyaları işler (gelecek sprint'te) — şimdilik
 * dashboard veya manuel inceleme için saklanır.
 *
 * PII redaction:
 *   - Email otomatik dahil (Firebase Auth'tan), kullanıcı görür
 *   - displayName otomatik dahil
 *   - Mesaj içeriği RAW — sanitization yok (kullanıcı bilinçli yazıyor)
 *
 * Türler:
 *   - bug: Hata raporu
 *   - feature: Özellik isteği
 *   - praise: Pozitif geri bildirim
 *   - other: Diğer
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth } from '../../lib/firebase';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import { createLogger } from '../utils/logger';
import { Platform } from 'react-native';

const logger = createLogger('FeedbackService');

export type FeedbackType = 'bug' | 'feature' | 'praise' | 'other';

export interface FeedbackSubmission {
  type: FeedbackType;
  rating?: number; // 1-5 stars (optional)
  message: string;
  screen?: string; // Where in the app
  contactEmail?: string;
}

interface FeedbackContext {
  uid: string | null;
  email: string | null;
  displayName: string | null;
  appVersion: string;
  platform: string;
  osVersion: string | number;
  locale?: string;
  timestamp: number;
}

class FeedbackService {
  /**
   * Submit user feedback. Returns true on success.
   */
  async submit(submission: FeedbackSubmission): Promise<boolean> {
    const trimmedMsg = submission.message?.trim();
    if (!trimmedMsg || trimmedMsg.length < 3) {
      throw new Error('Mesaj çok kısa');
    }
    if (trimmedMsg.length > 5000) {
      throw new Error('Mesaj 5000 karakteri aşamaz');
    }

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) {
        logger.warn('Firestore not available — feedback not saved');
        return false;
      }

      const ctx = await this.collectContext();
      const docData = {
        type: submission.type,
        rating: typeof submission.rating === 'number' ? submission.rating : null,
        message: trimmedMsg.substring(0, 5000),
        screen: submission.screen || null,
        contactEmail: submission.contactEmail || ctx.email || null,
        ...ctx,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'feedback'), docData);
      logger.info('Feedback submitted', { type: submission.type, screen: submission.screen });
      return true;
    } catch (error) {
      logger.error('Failed to submit feedback:', error);
      throw new Error('Geri bildirim gönderilemedi. İnternet bağlantınızı kontrol edin.');
    }
  }

  private async collectContext(): Promise<FeedbackContext> {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser ?? null;

    let appVersion = 'unknown';
    let osVersion: string | number = 'unknown';
    let locale = 'tr';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Constants = require('expo-constants').default;
      appVersion = Constants?.expoConfig?.version || 'unknown';
    } catch {
      /* ignore */
    }
    try {
      osVersion = Platform.Version;
    } catch {
      /* ignore */
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Localization = require('expo-localization');
      locale = Localization?.locale || 'tr';
    } catch {
      /* ignore */
    }

    return {
      uid: user?.uid ?? null,
      email: user?.email ?? null,
      displayName: user?.displayName ?? null,
      appVersion,
      platform: Platform.OS,
      osVersion,
      locale,
      timestamp: Date.now(),
    };
  }
}

export const feedbackService = new FeedbackService();
