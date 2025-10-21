// PREMIUM INITIALIZATION SERVICE
// Automatically checks premium status on app startup
import { iapService } from '../services/iapService';
import { logger } from '../utils/productionLogger';
import { logPremiumStatus } from '@shared/iap/products';

class PremiumInitializationService {
  private static instance: PremiumInitializationService;
  private isInitialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): PremiumInitializationService {
    if (!PremiumInitializationService.instance) {
      PremiumInitializationService.instance = new PremiumInitializationService();
    }
    return PremiumInitializationService.instance;
  }

  // Initialize premium status check on app startup
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        logger.info('Premium initialization already completed');
        return;
      }

      logger.info('🚀 Starting premium initialization...');

      // Initialize IAP service
      const iapInitialized = await iapService.initialize();
      if (!iapInitialized) {
        logger.warn('⚠️ IAP service initialization failed, continuing with local check');
      }

      // Check premium status
      const isPremium = await iapService.checkPremiumStatus();
      
      // Log final status
      logPremiumStatus(isPremium);

      // Perform automatic restore check (silent)
      if (!isPremium) {
        logger.info('🔄 No active premium found, attempting silent restore...');
        try {
          await iapService.restorePurchases();
          const restoredPremium = await iapService.checkPremiumStatus();
          if (restoredPremium) {
            logger.info('✅ Premium restored from previous purchases');
            logPremiumStatus(true);
          }
        } catch (error) {
          logger.warn('⚠️ Silent restore failed:', error);
          // Don't show error to user - this is background operation
        }
      }

      this.isInitialized = true;
      logger.info('✅ Premium initialization completed');

    } catch (error) {
      logger.error('❌ Premium initialization failed:', error);
      // Don't throw - app should continue to work
    }
  }

  // Force re-check premium status
  async recheckPremiumStatus(): Promise<boolean> {
    try {
      logger.info('🔄 Force re-checking premium status...');
      
      // Check current status
      const isPremium = await iapService.checkPremiumStatus();
      
      // If not premium, try restore
      if (!isPremium) {
        logger.info('🔄 Attempting restore...');
        await iapService.restorePurchases();
        const restoredPremium = await iapService.checkPremiumStatus();
        logPremiumStatus(restoredPremium);
        return restoredPremium;
      }

      logPremiumStatus(isPremium);
      return isPremium;

    } catch (error) {
      logger.error('❌ Premium re-check failed:', error);
      return false;
    }
  }

  // Get initialization status
  isInitializationComplete(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const premiumInitService = PremiumInitializationService.getInstance();
export default premiumInitService;
