/**
 * PREMIUM ALERT MANAGER
 * 
 * ELITE: Premium bildirim yönetimi ve geri sayım modal entegrasyonu
 * Modern, lüks ve zarif bildirimler için merkezi yönetim
 */

import { createLogger } from '../utils/logger';
import { PremiumCountdownData } from '../components/PremiumCountdownModal';

const logger = createLogger('PremiumAlertManager');

class PremiumAlertManager {
  private static instance: PremiumAlertManager | null = null;
  private countdownModalRef: React.RefObject<any> | null = null;
  private onShowCallback: ((data: PremiumCountdownData) => void) | null = null;
  private onDismissCallback: (() => void) | null = null;
  private currentAlert: PremiumCountdownData | null = null;
  private isShowing = false;

  static getInstance(): PremiumAlertManager {
    if (!PremiumAlertManager.instance) {
      PremiumAlertManager.instance = new PremiumAlertManager();
    }
    return PremiumAlertManager.instance;
  }

  /**
   * Set countdown modal ref
   */
  setModalRef(ref: React.RefObject<any>) {
    this.countdownModalRef = ref;
  }

  /**
   * Set callback for showing countdown
   */
  setOnShowCallback(callback: (data: PremiumCountdownData) => void) {
    this.onShowCallback = callback;
  }

  /**
   * Set callback for dismissing countdown
   */
  setOnDismissCallback(callback: () => void) {
    this.onDismissCallback = callback;
  }

  /**
   * ELITE: Show premium countdown modal
   */
  showCountdown(data: PremiumCountdownData) {
    try {
      this.currentAlert = data;
      this.isShowing = true;
      
      // Use callback if available (React Native compatible)
      if (this.onShowCallback) {
        this.onShowCallback(data);
      } else if (this.countdownModalRef?.current) {
        // Fallback: Use ref directly
        this.countdownModalRef.current.show(data);
      }
      
      logger.info(`✅ Premium countdown modal shown: ${data.magnitude.toFixed(1)} magnitude, ${data.secondsRemaining}s remaining`);
    } catch (error) {
      logger.error('Failed to show premium countdown:', error);
    }
  }

  /**
   * Dismiss countdown modal
   */
  dismissCountdown() {
    try {
      this.isShowing = false;
      this.currentAlert = null;
      
      // Use callback if available (React Native compatible)
      if (this.onDismissCallback) {
        this.onDismissCallback();
      } else if (this.countdownModalRef?.current) {
        // Fallback: Use ref directly
        this.countdownModalRef.current.dismiss();
      }
      
      logger.info('Premium countdown modal dismissed');
    } catch (error) {
      logger.error('Failed to dismiss premium countdown:', error);
    }
  }

  /**
   * Get current alert
   */
  getCurrentAlert(): PremiumCountdownData | null {
    return this.currentAlert;
  }

  /**
   * Check if showing
   */
  isShowingAlert(): boolean {
    return this.isShowing;
  }
}

export const premiumAlertManager = PremiumAlertManager.getInstance();

