/**
 * PERMISSION RE-PROMPT SERVICE
 *
 * Kullanıcı bildirim iznini reddettiyse, hayat-güvenliği gereği (EEW + SOS)
 * 24 saat sonra yeniden istemek mantıklı — ama saldırgan değil. Pattern:
 *
 *   1. İlk red sonrası: 24h sessizlik
 *   2. 24h sonra eğitici pre-prompt göster: "Deprem uyarısı için bildirim gerekli"
 *      Kullanıcı kabul ederse system permission dialogue tekrar gösterilir.
 *   3. Tekrar reddederse: 7 gün sessizlik
 *   4. Toplamda 3 reddi geçince: Settings'e yönlendir (sistem dialog'u kapalı)
 *
 * Apple/Play Store policy:
 *   - Bir kez reddedildikten sonra system dialog tekrar gösterilemez (iOS).
 *   - Android'de yeniden gösterilebilir ama kullanıcı taciz edilmez.
 *   - O yüzden eğitici pre-prompt → kullanıcı "Tamam" der → settings link açılır.
 */

import { Linking, Platform } from 'react-native';
import { DirectStorage } from '../utils/storage';
import { createLogger } from '../utils/logger';
import { getFirebaseAuth } from '../../lib/firebase';
import {
  getPermissionStatus,
  requestPermissions,
} from './notifications/NotificationPermissionHandler';

const logger = createLogger('PermissionRePromptService');

const STORAGE_KEY_BASE = '@afetnet:permission_prompt_state';

// CRITICAL FIX (N9): User-scoped storage key.
// Without scoping, User A's "denied 3 times" state blocks User B on same device
// from ever seeing the re-prompt → User B never gets notification permission.
function getScopedKey(): string {
  try {
    const uid = getFirebaseAuth()?.currentUser?.uid;
    return uid ? `${STORAGE_KEY_BASE}:${uid}` : `${STORAGE_KEY_BASE}:guest`;
  } catch {
    return `${STORAGE_KEY_BASE}:guest`;
  }
}
const MIN_REPROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SECONDARY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days after 2+ denials
const MAX_PROMPTS = 3;

interface PromptState {
  lastPromptedAt: number;
  promptCount: number;
  permanentlyDenied: boolean;
}

class PermissionRePromptService {
  /**
   * Returns true if a notification permission re-prompt is appropriate right now.
   * The UI layer should call this on app foreground and, if true, show an educational
   * pre-prompt before calling `triggerPrompt()`.
   */
  async shouldRePrompt(): Promise<boolean> {
    try {
      const status = await getPermissionStatus();
      if (status.status === 'granted') return false;
      if (status.status === 'unavailable') return false;

      const state = this.loadState();
      if (state.permanentlyDenied) return false;
      if (state.promptCount >= MAX_PROMPTS) return false;

      // iOS: cannot re-show system dialog after first denial. Show settings link instead.
      // We still re-prompt the EDUCATIONAL pre-prompt to nudge user to Settings.
      const intervalMs = state.promptCount >= 2 ? SECONDARY_INTERVAL_MS : MIN_REPROMPT_INTERVAL_MS;
      const sinceLastPrompt = Date.now() - state.lastPromptedAt;
      if (sinceLastPrompt < intervalMs) return false;

      return true;
    } catch (error) {
      logger.error('shouldRePrompt failed:', error);
      return false;
    }
  }

  /**
   * Trigger the system permission prompt (or settings redirect on iOS).
   * Records the attempt; idempotent within MIN_REPROMPT_INTERVAL_MS.
   */
  async triggerPrompt(): Promise<'granted' | 'denied' | 'opened-settings'> {
    const state = this.loadState();
    const status = await getPermissionStatus();

    // iOS: if canAskAgain is false, system dialog won't appear — open Settings.
    if (Platform.OS === 'ios' && !status.canAskAgain) {
      try {
        await Linking.openURL('app-settings:');
      } catch {
        try {
          await Linking.openSettings();
        } catch {
          /* no-op */
        }
      }
      this.saveState({
        lastPromptedAt: Date.now(),
        promptCount: state.promptCount + 1,
        permanentlyDenied: state.promptCount + 1 >= MAX_PROMPTS,
      });
      logger.info('Opened iOS Settings (system dialog unavailable)');
      return 'opened-settings';
    }

    // Otherwise: trigger system permission dialog
    const result = await requestPermissions();
    const newState: PromptState = {
      lastPromptedAt: Date.now(),
      promptCount: state.promptCount + 1,
      permanentlyDenied:
        result.status === 'denied' && state.promptCount + 1 >= MAX_PROMPTS,
    };
    this.saveState(newState);

    if (result.status === 'granted') {
      logger.info('Notification permission GRANTED via re-prompt');
      return 'granted';
    }

    logger.info('Notification permission denied via re-prompt', {
      count: newState.promptCount,
      permanent: newState.permanentlyDenied,
    });
    return 'denied';
  }

  /**
   * Reset on logout — new user might have different preferences.
   */
  reset(): void {
    DirectStorage.delete(getScopedKey());
    logger.info('Permission prompt state reset');
  }

  // =========================================================================
  // PRIVATE
  // =========================================================================

  private loadState(): PromptState {
    try {
      const raw = DirectStorage.getString(getScopedKey());
      if (!raw) return { lastPromptedAt: 0, promptCount: 0, permanentlyDenied: false };
      const parsed = JSON.parse(raw);
      return {
        lastPromptedAt: typeof parsed.lastPromptedAt === 'number' ? parsed.lastPromptedAt : 0,
        promptCount: typeof parsed.promptCount === 'number' ? parsed.promptCount : 0,
        permanentlyDenied: parsed.permanentlyDenied === true,
      };
    } catch {
      return { lastPromptedAt: 0, promptCount: 0, permanentlyDenied: false };
    }
  }

  private saveState(state: PromptState): void {
    try {
      DirectStorage.setString(getScopedKey(), JSON.stringify(state));
    } catch (error) {
      logger.warn('saveState failed:', error);
    }
  }
}

export const permissionRePromptService = new PermissionRePromptService();
