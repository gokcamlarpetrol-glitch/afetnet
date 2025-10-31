/**
 * PREMIUM SERVICE - IAP Management with RevenueCat
 */

import Purchases, { PurchasesOffering } from 'react-native-purchases';
import { Platform } from 'react-native';
import { usePremiumStore } from '../stores/premiumStore';
import { APP_CONFIG } from '../config/app';
import { ENV } from '../config/env';

// RevenueCat API Keys from environment
const REVENUECAT_API_KEY_IOS = ENV.RC_IOS_KEY;
const REVENUECAT_API_KEY_ANDROID = ENV.RC_ANDROID_KEY;

// Product IDs and Entitlement
const PRODUCT_IDS = APP_CONFIG.iap.productIds;
const ENTITLEMENT_ID = APP_CONFIG.iap.entitlementId;

class PremiumService {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    console.log('[PremiumService] Initializing...');

    try {
      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
      
      if (!apiKey) {
        console.warn('[PremiumService] RevenueCat API key not found. Premium features disabled.');
        usePremiumStore.getState().setPremium(false);
        return;
      }

      // Configure RevenueCat
      Purchases.configure({ apiKey });

      // Check current status
      await this.checkPremiumStatus();

      this.isInitialized = true;
      console.log('[PremiumService] Initialized successfully');

    } catch (error) {
      console.error('[PremiumService] Initialization error:', error);
      // Set as free user on error
      usePremiumStore.getState().setPremium(false);
    }
  }

  async checkPremiumStatus(): Promise<boolean> {
    try {
      usePremiumStore.getState().setLoading(true);

      const customerInfo = await Purchases.getCustomerInfo();
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
      console.error('[PremiumService] Status check error:', error);
      usePremiumStore.getState().setPremium(false);
      return false;
    } finally {
      usePremiumStore.getState().setLoading(false);
    }
  }

  async getOfferings(): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error('[PremiumService] Get offerings error:', error);
      return null;
    }
  }

  async purchasePackage(packageId: string): Promise<boolean> {
    try {
      usePremiumStore.getState().setLoading(true);

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
      console.error('[PremiumService] Purchase error:', error);
      return false;
    } finally {
      usePremiumStore.getState().setLoading(false);
    }
  }

  async restorePurchases(): Promise<boolean> {
    try {
      usePremiumStore.getState().setLoading(true);

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
      console.error('[PremiumService] Restore error:', error);
      return false;
    } finally {
      usePremiumStore.getState().setLoading(false);
    }
  }
}

export const premiumService = new PremiumService();

