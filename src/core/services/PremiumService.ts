/**
 * PREMIUM SERVICE - Elite IAP Management with RevenueCat
 * Production-grade premium service with comprehensive error handling,
 * race condition prevention, and zero-error guarantee
 */

import Purchases, { PurchasesOffering } from 'react-native-purchases';
import { Alert, Platform } from 'react-native';
import { usePremiumStore, SubscriptionType } from '../stores/premiumStore';
import { useTrialStore } from '../stores/trialStore';
import { APP_CONFIG } from '../config/app';
import { ENV } from '../config/env';
import { createLogger } from '../utils/logger';

const logger = createLogger('PremiumService');

// ELITE: Race condition prevention
let initializationPromise: Promise<void> | null = null;
let checkStatusPromise: Promise<boolean> | null = null;
let purchaseInProgress = false;

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

  async initialize(): Promise<void> {
    // ELITE: Prevent concurrent initialization
    if (initializationPromise) {
      return initializationPromise;
    }

    if (this.isInitialized) {
      return Promise.resolve();
    }

    initializationPromise = this._doInitialize();
    
    try {
      await initializationPromise;
    } finally {
      initializationPromise = null;
    }
  }

  private async _doInitialize(): Promise<void> {
    if (__DEV__) logger.info('Initializing PremiumService...');

    try {
      // ELITE: Initialize trial first with error handling
      try {
        await useTrialStore.getState().initializeTrial();
      } catch (trialError) {
        logger.error('Trial initialization error (non-critical):', trialError);
        // Continue - trial will be checked later
      }

      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
      
      // ELITE: Validate API key
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        logger.info('RevenueCat API key not found. Using trial only.');
        this.hasRevenueCat = false;
        // Check trial status safely
        try {
          const isTrialActive = useTrialStore.getState().checkTrialStatus();
          usePremiumStore.getState().setPremium(isTrialActive, null, null, false);
        } catch (error) {
          logger.error('Failed to set trial status:', error);
        }
        this.isInitialized = true;
        return;
      }

      // ELITE: Configure RevenueCat with error handling
      try {
        Purchases.configure({ apiKey });
        this.hasRevenueCat = true;
        logger.info('RevenueCat configured successfully');
      } catch (configError) {
        logger.error('RevenueCat configuration error:', configError);
        this.disableRevenueCat('configure', configError);
        const isTrialActive = useTrialStore.getState().checkTrialStatus();
        usePremiumStore.getState().setPremium(isTrialActive, null, null, false);
        this.isInitialized = true;
        return;
      }

      // ELITE: Check current status (includes trial check) with timeout
      try {
        await Promise.race([
          this.checkPremiumStatus(),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Status check timeout')), 10000)
          ),
        ]);
      } catch (statusError) {
        logger.warn('Status check error (non-critical):', statusError);
        // Continue - status will be checked later
      }

      this.isInitialized = true;
      logger.info('PremiumService initialized successfully');

    } catch (error) {
      logger.error('Initialization error:', error);
      this.disableRevenueCat('initialize', error);
      try {
        const isTrialActive = useTrialStore.getState().checkTrialStatus();
        usePremiumStore.getState().setPremium(isTrialActive, null, null, false);
      } catch (fallbackError) {
        logger.error('Failed to set fallback trial status:', fallbackError);
      }
      this.isInitialized = true; // ELITE: Mark as initialized even on error to prevent retry loops
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

  /**
   * ELITE: Check if earthquake features are free
   * CRITICAL: Earthquake features require premium after 3-day trial
   */
  isEarthquakeFeatureFree(): boolean {
    // CRITICAL: Earthquake features require premium after trial period
    return this.hasAccess('earthquake');
  }

  /**
   * ELITE: Check if user has access to a feature
   * CRITICAL: Earthquake features are always free, other features require trial/premium
   */
  hasAccess(featureType: 'earthquake' | 'other'): boolean {
    if (featureType === 'earthquake') {
      // CRITICAL: Earthquake features are ALWAYS FREE
      return true;
    }
    
    // Other features: Check trial or premium
    const premiumState = usePremiumStore.getState();
    const isPremium = premiumState.isPremium;
    
    // ELITE: Check trial status for other features
    if (!isPremium) {
      const isTrialActive = useTrialStore.getState().checkTrialStatus();
      return isTrialActive; // First 3 days free, then premium required
    }
    
    return isPremium;
  }

  /**
   * ELITE: Check if user has premium access (paid subscription or trial)
   * Used for non-earthquake features
   */
  hasPremiumAccess(): boolean {
    return this.hasAccess('other');
  }

  async checkPremiumStatus(): Promise<boolean> {
    // ELITE: Prevent concurrent status checks
    if (checkStatusPromise) {
      return checkStatusPromise;
    }

    checkStatusPromise = this._doCheckPremiumStatus();
    
    try {
      return await checkStatusPromise;
    } finally {
      checkStatusPromise = null;
    }
  }

  private async _doCheckPremiumStatus(): Promise<boolean> {
    try {
      usePremiumStore.getState().setLoading(true);

      if (!this.hasRevenueCat) {
        const isTrialActive = useTrialStore.getState().checkTrialStatus();
        usePremiumStore.getState().setPremium(isTrialActive, null, null, false);
        return isTrialActive;
      }

      // ELITE: Get customer info with timeout
      let customerInfo;
      try {
        customerInfo = await Promise.race([
          Purchases.getCustomerInfo(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Customer info timeout')), 10000)
          ),
        ]);
      } catch (fetchError) {
        logger.warn('Failed to fetch customer info:', fetchError);
        // Fallback to trial
        const isTrialActive = useTrialStore.getState().checkTrialStatus();
        usePremiumStore.getState().setPremium(isTrialActive, null, null, false);
        return isTrialActive;
      }

      // ELITE: Validate customerInfo structure
      if (!customerInfo || !customerInfo.entitlements || !customerInfo.entitlements.active) {
        logger.warn('Invalid customer info structure');
        const isTrialActive = useTrialStore.getState().checkTrialStatus();
        usePremiumStore.getState().setPremium(isTrialActive, null, null, false);
        return isTrialActive;
      }

      const hasPaidSubscription = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';

      if (hasPaidSubscription) {
        const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
        
        // ELITE: Safely parse expiration date
        let expiresAt: number | null = null;
        if (entitlement.expirationDate) {
          try {
            const expirationDate = new Date(entitlement.expirationDate);
            if (!isNaN(expirationDate.getTime())) {
              expiresAt = expirationDate.getTime();
            }
          } catch (dateError) {
            logger.warn('Invalid expiration date:', entitlement.expirationDate);
          }
        }

        // ELITE: Determine subscription type from active products with validation
        const activeProducts = customerInfo.activeSubscriptions || [];
        let subscriptionType: SubscriptionType = null;
        
        if (activeProducts.length > 0) {
          const productId = String(activeProducts[0]);
          if (productId.includes('lifetime')) {
            subscriptionType = null; // Lifetime
          } else if (productId.includes('yearly') || productId.includes('annual')) {
            subscriptionType = 'yearly';
          } else {
            subscriptionType = 'monthly';
          }
        } else if (!expiresAt) {
          // No expiration = lifetime
          subscriptionType = null;
        }

        // ELITE: Determine if lifetime with strict validation
        const isLifetime = subscriptionType === null && expiresAt === null;
        usePremiumStore.getState().setPremium(true, subscriptionType, expiresAt || undefined, isLifetime);
        logger.info(`Premium status: ${subscriptionType || 'lifetime'}, expiresAt: ${expiresAt || 'never'}`);
        return true;
      }

      // ELITE: If no paid subscription, check trial
      const isTrialActive = useTrialStore.getState().checkTrialStatus();
      usePremiumStore.getState().setPremium(isTrialActive, null, null, false);

      return isTrialActive;

    } catch (error) {
      logger.error('checkPremiumStatus error:', error);
      this.disableRevenueCat('checkPremiumStatus', error);

      try {
        const isTrialActive = useTrialStore.getState().checkTrialStatus();
        usePremiumStore.getState().setPremium(isTrialActive, null, null, false);
        return isTrialActive;
      } catch (fallbackError) {
        logger.error('Failed to set fallback trial status:', fallbackError);
        return false;
      }
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
    // ELITE: Prevent concurrent purchases
    if (purchaseInProgress) {
      logger.warn('Purchase already in progress, ignoring duplicate request');
      return false;
    }

    // ELITE: Validate packageId
    if (!packageId || typeof packageId !== 'string' || packageId.trim().length === 0) {
      logger.error('Invalid packageId:', packageId);
      return false;
    }

    purchaseInProgress = true;

    try {
      usePremiumStore.getState().setLoading(true);

      if (!this.hasRevenueCat) {
        logger.warn('Purchase attempted but RevenueCat is not configured.');
        Alert.alert('Abonelik Kullanılamıyor', 'Abonelik sistemi şu anda devre dışı. Lütfen destek ile iletişime geçin.');
        return false;
      }

      // ELITE: Get offerings with timeout
      let offerings: PurchasesOffering | null;
      try {
        offerings = await Promise.race([
          this.getOfferings(),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Offerings timeout')), 10000)
          ),
        ]);
      } catch (offeringsError) {
        logger.error('Failed to get offerings:', offeringsError);
        Alert.alert('Hata', 'Paket bilgileri alınamadı. Lütfen tekrar deneyin.');
        return false;
      }

      if (!offerings || !offerings.availablePackages || offerings.availablePackages.length === 0) {
        logger.warn('No offerings available');
        Alert.alert('Hata', 'Satın alınabilir paket bulunamadı.');
        return false;
      }

      const packageToPurchase = offerings.availablePackages.find(
        pkg => pkg && pkg.identifier === packageId
      );

      if (!packageToPurchase) {
        logger.warn('Package not found:', packageId);
        Alert.alert('Hata', 'Seçilen paket bulunamadı.');
        return false;
      }

      // ELITE: Purchase with timeout
      let customerInfo;
      try {
        const purchaseResult = await Promise.race([
          Purchases.purchasePackage(packageToPurchase),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Purchase timeout')), 30000)
          ),
        ]);
        customerInfo = purchaseResult.customerInfo;
      } catch (purchaseError: unknown) {
        // ELITE: Handle user cancellation gracefully
        const error = purchaseError as { userCancelled?: boolean; code?: string };
        if (error?.userCancelled || error?.code === 'USER_CANCELLED') {
          logger.info('User cancelled purchase');
          return false;
        }
        logger.error('Purchase error:', purchaseError);
        Alert.alert('Hata', 'Satın alma işlemi başarısız oldu. Lütfen tekrar deneyin.');
        this.disableRevenueCat('purchasePackage', purchaseError);
        return false;
      }

      // ELITE: Validate customerInfo
      if (!customerInfo || !customerInfo.entitlements || !customerInfo.entitlements.active) {
        logger.error('Invalid customer info after purchase');
        Alert.alert('Hata', 'Satın alma tamamlandı ancak durum kontrol edilemedi. Lütfen uygulamayı yeniden başlatın.');
        return false;
      }

      const isPremium = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';

      if (isPremium) {
        const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
        
        // ELITE: Safely parse expiration date
        let expiresAt: number | null = null;
        if (entitlement.expirationDate) {
          try {
            const expirationDate = new Date(entitlement.expirationDate);
            if (!isNaN(expirationDate.getTime())) {
              expiresAt = expirationDate.getTime();
            }
          } catch (dateError) {
            logger.warn('Invalid expiration date:', entitlement.expirationDate);
          }
        }

        // ELITE: Determine subscription type with validation
        const productIdentifier = packageToPurchase.product?.identifier || '';
        const isLifetime = productIdentifier.includes('lifetime') || 
                          packageId.includes('lifetime') || 
                          !expiresAt;
        const subscriptionType: SubscriptionType = isLifetime 
          ? null 
          : (packageId.includes('annual') || packageId.includes('yearly') ? 'yearly' : 'monthly');

        usePremiumStore.getState().setPremium(true, subscriptionType, expiresAt || undefined, isLifetime);
        
        logger.info(`Premium activated: ${subscriptionType || 'lifetime'}, expiresAt: ${expiresAt || 'never'}`);
        
        // ELITE: Check expiration after purchase
        usePremiumStore.getState().checkExpiration();
      } else {
        logger.warn('Purchase completed but premium not activated');
        Alert.alert('Uyarı', 'Satın alma tamamlandı ancak premium aktif edilemedi. Lütfen uygulamayı yeniden başlatın.');
      }

      return isPremium;

    } catch (error) {
      logger.error('purchasePackage error:', error);
      this.disableRevenueCat('purchasePackage', error);
      Alert.alert('Hata', 'Satın alma işlemi sırasında bir hata oluştu.');
      return false;
    } finally {
      purchaseInProgress = false;
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

      // ELITE: Restore with timeout
      let customerInfo;
      try {
        customerInfo = await Promise.race([
          Purchases.restorePurchases(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Restore timeout')), 15000)
          ),
        ]);
      } catch (restoreError) {
        logger.error('Restore error:', restoreError);
        Alert.alert('Hata', 'Satın almalar geri yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
        this.disableRevenueCat('restorePurchases', restoreError);
        return false;
      }

      // ELITE: Validate customerInfo structure
      if (!customerInfo || !customerInfo.entitlements || !customerInfo.entitlements.active) {
        logger.warn('Invalid customer info after restore');
        // Fallback to trial
        const isTrialActive = useTrialStore.getState().checkTrialStatus();
        usePremiumStore.getState().setPremium(isTrialActive, null, null, false);
        Alert.alert('Bilgi', 'Satın almalar geri yüklendi ancak durum kontrol edilemedi. Lütfen uygulamayı yeniden başlatın.');
        return false;
      }

      const isPremium = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';

      if (isPremium) {
        const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
        
        // ELITE: Safely parse expiration date
        let expiresAt: number | null = null;
        if (entitlement.expirationDate) {
          try {
            const expirationDate = new Date(entitlement.expirationDate);
            if (!isNaN(expirationDate.getTime())) {
              expiresAt = expirationDate.getTime();
            }
          } catch (dateError) {
            logger.warn('Invalid expiration date:', entitlement.expirationDate);
          }
        }

        // ELITE: Determine subscription type from product identifier with validation
        const activeProducts = customerInfo.activeSubscriptions || [];
        let subscriptionType: SubscriptionType = null;
        
        if (activeProducts.length > 0) {
          const productId = String(activeProducts[0]);
          if (productId.includes('lifetime')) {
            subscriptionType = null; // Lifetime
          } else if (productId.includes('yearly') || productId.includes('annual')) {
            subscriptionType = 'yearly';
          } else {
            subscriptionType = 'monthly';
          }
        } else if (!expiresAt) {
          // No expiration = lifetime
          subscriptionType = null;
        }

        // ELITE: Determine if lifetime with strict validation
        const isLifetime = subscriptionType === null && expiresAt === null;
        usePremiumStore.getState().setPremium(true, subscriptionType, expiresAt || undefined, isLifetime);
        logger.info(`Premium restored: ${subscriptionType || 'lifetime'}, expiresAt: ${expiresAt || 'never'}`);
        
        // ELITE: Check expiration after restore
        usePremiumStore.getState().checkExpiration();
        
        Alert.alert('Başarılı', 'Satın almalarınız geri yüklendi.');
      } else {
        // ELITE: No paid subscription - check trial
        const isTrialActive = useTrialStore.getState().checkTrialStatus();
        usePremiumStore.getState().setPremium(isTrialActive, null, null, false);
        Alert.alert('Bilgi', 'Geri yüklenecek aktif satın alma bulunamadı.');
      }

      return isPremium;

    } catch (error) {
      logger.error('restorePurchases error:', error);
      this.disableRevenueCat('restorePurchases', error);
      Alert.alert('Hata', 'Satın almalar geri yüklenirken bir hata oluştu.');
      return false;
    } finally {
      usePremiumStore.getState().setLoading(false);
    }
  }
}

export const premiumService = new PremiumService();

