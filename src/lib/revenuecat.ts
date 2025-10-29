// REVENUECAT CONFIGURATION & INITIALIZATION
// Elite-level RevenueCat implementation for AfetNet
import Purchases, { CustomerInfo, Offerings, PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';
import { Platform, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { logger } from '../utils/productionLogger';

// RevenueCat API Keys - MUST BE SET BEFORE BUILD
// Get these from RevenueCat Dashboard → API Keys
// Try both RC_IOS_KEY and REVENUECAT_API_KEY for compatibility
const RC_IOS_KEY = process.env.RC_IOS_KEY || process.env.REVENUECAT_API_KEY || '';
const RC_ANDROID_KEY = process.env.RC_ANDROID_KEY || '';

// Initialize RevenueCat
let isInitialized = false;
let currentCustomerInfo: CustomerInfo | null = null;
let currentOfferings: Offerings | null = null;

// Product ID mapping (fallback)
export const PRODUCT_IDS = {
  MONTHLY: 'org.afetnetapp.premium.monthly',
  YEARLY: 'org.afetnetapp.premium.yearly',
  LIFETIME: 'org.afetnetapp.premium.lifetime',
} as const;

export interface RevenueCatConfig {
  apiKey: string;
  appUserId?: string;
  debugLogs?: boolean;
}

/**
 * Initialize RevenueCat SDK
 * Call this once on app startup (in App.tsx)
 */
export async function initializeRevenueCat(appUserId?: string): Promise<boolean> {
  try {
    // Prevent multiple initializations
    if (isInitialized) {
      logger.info('✅ RevenueCat already initialized');
      return true;
    }

    // Check for API keys
    const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
    
    if (!apiKey) {
      logger.error('❌ RevenueCat API key not found');
      Alert.alert(
        '⚠️ Configuration Error',
        'RevenueCat API key is missing. Please set RC_IOS_KEY or RC_ANDROID_KEY in your environment variables.',
      );
      return false;
    }

    logger.info('🚀 Initializing RevenueCat...');
    
    // Enable debug logs in development
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    // Configure RevenueCat
    await Purchases.configure({
      apiKey,
      appUserID: appUserId,
    });

    isInitialized = true;
    logger.info('✅ RevenueCat initialized successfully');

    // Load initial customer info and offerings
    await Promise.all([
      fetchCustomerInfo(),
      fetchOfferings(),
    ]);

    // Customer info updates are handled by the purchaserInfoUpdateListener in usePremium hook

    return true;
  } catch (error) {
    logger.error('❌ Failed to initialize RevenueCat:', error);
    Alert.alert(
      '❌ Error',
      'Failed to initialize subscription service. Please try again later.',
    );
    return false;
  }
}

/**
 * Check network connectivity before making RevenueCat calls
 */
export async function checkNetworkConnection(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch (error) {
    logger.error('Network check failed:', error);
    return false;
  }
}

/**
 * Get customer info from RevenueCat
 */
export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    if (!isInitialized) {
      logger.warn('⚠️ RevenueCat not initialized');
      return null;
    }

    const info = await Purchases.getCustomerInfo();
    currentCustomerInfo = info;
    
    logger.info('✅ Customer info fetched');
    logger.info('📊 Active entitles:', Object.keys(info.entitlements.active));
    
    return info;
  } catch (error) {
    logger.error('❌ Failed to fetch customer info:', error);
    return null;
  }
}

/**
 * Get offerings from RevenueCat
 */
export async function fetchOfferings(): Promise<Offerings | null> {
  try {
    if (!isInitialized) {
      logger.warn('⚠️ RevenueCat not initialized');
      return null;
    }

    const offerings = await Purchases.getOfferings();
    currentOfferings = offerings;
    
    if (offerings.current) {
      logger.info('✅ Offerings fetched');
      logger.info('📦 Packages:', offerings.current.availablePackages.length);
    } else {
      logger.warn('⚠️ No current offering found');
    }
    
    return offerings;
  } catch (error) {
    logger.error('❌ Failed to fetch offerings:', error);
    return null;
  }
}

/**
 * Check if user has active Premium entitlement
 */
export function hasPremiumEntitlement(customerInfo?: CustomerInfo): boolean {
  const info = customerInfo || currentCustomerInfo;
  
  if (!info) {
    return false;
  }

  const premium = info.entitlements.active['Premium'];
  const isActive = premium?.isActive ?? false;

  if (isActive) {
    logger.info('✅ Premium active, expires:', premium?.expirationDate);
  }

  return isActive;
}

/**
 * Purchase a package
 */
export async function purchasePackage(
  packageToPurchase: PurchasesPackage,
  onSuccess?: () => void,
  onError?: (error: Error) => void,
): Promise<boolean> {
  try {
    // Check network connection
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      Alert.alert('⚠️ No Internet', 'Please check your internet connection and try again.');
      onError?.(new Error('No internet connection'));
      return false;
    }

    logger.info('🛒 Purchasing package:', packageToPurchase.identifier);

    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    
    logger.info('✅ Purchase successful');
    currentCustomerInfo = customerInfo;

    // Check if premium is now active
    if (hasPremiumEntitlement(customerInfo)) {
      logger.info('🎉 Premium activated!');
      onSuccess?.();
      return true;
    } else {
      logger.warn('⚠️ Purchase completed but premium not active');
      Alert.alert('⚠️ Purchase Incomplete', 'Purchase completed but could not activate Premium. Please contact support.');
      onError?.(new Error('Premium not activated'));
      return false;
    }
  } catch (error: any) {
    logger.error('❌ Purchase failed:', error);

    // Handle specific error types
    if (error.userCancelled) {
      Alert.alert('ℹ️ Cancelled', 'Purchase was cancelled.');
    } else if (error.purchaseAlreadyOwned) {
      Alert.alert('ℹ️ Already Owned', 'You already own this item.');
    } else {
      Alert.alert('❌ Purchase Failed', error.message || 'An error occurred during purchase.');
    }

    onError?.(error);
    return false;
  }
}

/**
 * Restore purchases
 */
export async function restorePurchases(): Promise<boolean> {
  try {
    logger.info('🔄 Restoring purchases...');

    const customerInfo = await Purchases.restorePurchases();
    currentCustomerInfo = customerInfo;

    if (hasPremiumEntitlement(customerInfo)) {
      logger.info('✅ Purchases restored, premium active');
      Alert.alert('✅ Restored', 'Your purchases have been restored.');
      return true;
    } else {
      logger.warn('⚠️ No active purchases found');
      Alert.alert('ℹ️ No Purchases', 'No active purchases found to restore.');
      return false;
    }
  } catch (error) {
    logger.error('❌ Restore failed:', error);
    Alert.alert('❌ Restore Failed', 'Failed to restore purchases. Please try again.');
    return false;
  }
}

/**
 * Get current offerings (cached or fetch new)
 */
export function getCurrentOfferings(): Offerings | null {
  return currentOfferings;
}

/**
 * Get current customer info (cached or fetch new)
 */
export function getCurrentCustomerInfo(): CustomerInfo | null {
  return currentCustomerInfo;
}

/**
 * Check if RevenueCat is initialized
 */
export function isRevenueCatInitialized(): boolean {
  return isInitialized;
}

// Export for use in other modules
export { Purchases, CustomerInfo, Offerings, PurchasesPackage };

