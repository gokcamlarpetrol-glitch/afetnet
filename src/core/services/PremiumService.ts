/**
 * PREMIUM SERVICE - IAP Management with RevenueCat
 */

import Purchases, { PurchasesOffering } from 'react-native-purchases';
import { Alert, Platform } from 'react-native';
import { usePremiumStore } from '../stores/premiumStore';
import { useTrialStore } from '../stores/trialStore';
import { APP_CONFIG } from '../config/app';
import { ENV } from '../config/env';
import { createLogger } from '../utils/logger';

const logger = createLogger('PremiumService');

// RevenueCat API Keys from environment
const REVENUECAT_API_KEY_IOS = ENV.RC_IOS_KEY;
const REVENUECAT_API_KEY_ANDROID = ENV.RC_ANDROID_KEY;

// Product IDs and Entitlement
const PRODUCT_IDS = APP_CONFIG.iap.productIds;
const ENTITLEMENT_ID = APP_CONFIG.iap.entitlementId;

class PremiumService {
  private isInitialized = false;
  private hasRevenueCat = false;
  private revenueCatDisabledReason: string | null = null;

  async initialize() {
    if (this.isInitialized) return;

    if (__DEV__) logger.info('Initializing...');

    try {
      // Initialize trial first
      await useTrialStore.getState().initializeTrial();

      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
      
      if (!apiKey) {
        logger.info('RevenueCat API key not found. Using trial only.');
        this.hasRevenueCat = false;
        // Check trial status
        const isTrialActive = useTrialStore.getState().checkTrialStatus();
        usePremiumStore.getState().setPremium(isTrialActive);
        this.isInitialized = true;
        return;
      }

      // Configure RevenueCat
      Purchases.configure({ apiKey });
      this.hasRevenueCat = true;

      // Check current status (includes trial check)
      await this.checkPremiumStatus();

      this.isInitialized = true;
      logger.info('Initialized successfully');

    } catch (error) {
      logger.error('Initialization error:', error);
      this.disableRevenueCat('initialize', error);
      const isTrialActive = useTrialStore.getState().checkTrialStatus();
      usePremiumStore.getState().setPremium(isTrialActive);
    }
  }

  private disableRevenueCat(context: string, error?: unknown) {
    if (!this.hasRevenueCat) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    const isInvalidKey = message.toLowerCase().includes('invalid api key');

    if (!isInvalidKey) {
      // For transient issues keep RevenueCat enabled
      logger.error(`${context} error:`, error);
      return;
    }

    this.hasRevenueCat = false;
    this.revenueCatDisabledReason = message;
    logger.warn(`RevenueCat disabled (${context}) - falling back to trial only.`, { message });

    const isTrialActive = useTrialStore.getState().checkTrialStatus();
    usePremiumStore.getState().setPremium(isTrialActive);
  }

  async checkPremiumStatus(): Promise<boolean> {
    try {
      usePremiumStore.getState().setLoading(true);

      if (!this.hasRevenueCat) {
        const isTrialActive = useTrialStore.getState().checkTrialStatus();
        usePremiumStore.getState().setPremium(isTrialActive);
        return isTrialActive;
      }

      // First check if user has paid subscription
      const customerInfo = await Purchases.getCustomerInfo();
      const hasPaidSubscription = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';

      if (hasPaidSubscription) {
        const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
        const expiresAt = entitlement.expirationDate 
          ? new Date(entitlement.expirationDate).getTime()
          : null;

        usePremiumStore.getState().setPremium(true, 'monthly', expiresAt || undefined);
        return true;
      }

      // If no paid subscription, check trial
      const isTrialActive = useTrialStore.getState().checkTrialStatus();
      usePremiumStore.getState().setPremium(isTrialActive);

      return isTrialActive;

    } catch (error) {
      this.disableRevenueCat('checkPremiumStatus', error);

      const isTrialActive = useTrialStore.getState().checkTrialStatus();
      usePremiumStore.getState().setPremium(isTrialActive);
      
      return isTrialActive;
    } finally {
      usePremiumStore.getState().setLoading(false);
    }
  }

  async getOfferings(): Promise<PurchasesOffering | null> {
    try {
      if (!this.hasRevenueCat) {
        logger.info('RevenueCat not configured; returning null offerings.');
        return null;
      }

      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      this.disableRevenueCat('getOfferings', error);
      if (this.revenueCatDisabledReason) {
        logger.info('Returning null offerings - RevenueCat disabled.');
      }
      return null;
    }
  }

  async purchasePackage(packageId: string): Promise<boolean> {
    try {
      usePremiumStore.getState().setLoading(true);

      if (!this.hasRevenueCat) {
        logger.warn('Purchase attempted but RevenueCat is not configured.');
        Alert.alert('Abonelik Kullanılamıyor', 'Abonelik sistemi şu anda devre dışı. Lütfen destek ile iletişime geçin.');
        return false;
      }

      const offerings = await this.getOfferings();
      if (!offerings) return false;

      const packageToPurchase = offerings.availablePackages.find(
        pkg => pkg.identifier === packageId
      );

      if (!packageToPurchase) return false;

      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      const isPremium = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';

      if (isPremium) {
        const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
        const expiresAt = entitlement.expirationDate
          ? new Date(entitlement.expirationDate).getTime()
          : null;

        usePremiumStore.getState().setPremium(true, 'monthly', expiresAt || undefined);
      }

      return isPremium;

    } catch (error) {
      this.disableRevenueCat('purchasePackage', error);
      return false;
    } finally {
      usePremiumStore.getState().setLoading(false);
    }
  }

  async restorePurchases(): Promise<boolean> {
    try {
      usePremiumStore.getState().setLoading(true);

      if (!this.hasRevenueCat) {
        logger.warn('Restore attempted but RevenueCat is not configured.');
        Alert.alert('Abonelik Kullanılamıyor', 'Satın almalar şu anda geri yüklenemiyor. Lütfen destek ile iletişime geçin.');
        return false;
      }

      const customerInfo = await Purchases.restorePurchases();
      const isPremium = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';

      if (isPremium) {
        const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
        const expiresAt = entitlement.expirationDate
          ? new Date(entitlement.expirationDate).getTime()
          : null;

        usePremiumStore.getState().setPremium(true, 'monthly', expiresAt || undefined);
      } else {
        usePremiumStore.getState().setPremium(false);
      }

      return isPremium;

    } catch (error) {
      this.disableRevenueCat('restorePurchases', error);
      return false;
    } finally {
      usePremiumStore.getState().setLoading(false);
    }
  }
}

export const premiumService = new PremiumService();

