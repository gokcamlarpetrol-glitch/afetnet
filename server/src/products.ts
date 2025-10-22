// SHARED IAP PRODUCTS MODULE - NEW BUNDLE ID (org.afetnet1.app)
// Single source of truth for all IAP product IDs across client and server
// IMPORTANT: These are NEW product IDs for the NEW App Store submission

export const IAP_PRODUCTS = {
  monthly: 'org.afetnet1.premium.monthly',
  yearly: 'org.afetnet1.premium.yearly',
  lifetime: 'org.afetnet1.premium.lifetime',
} as const;

export type ProductKey = keyof typeof IAP_PRODUCTS;
export type ProductId = typeof IAP_PRODUCTS[ProductKey];
export const IAP_PRODUCT_IDS: ProductId[] = Object.values(IAP_PRODUCTS);

// Product categories
export const SUBSCRIPTION_PRODUCTS: ProductId[] = [
  IAP_PRODUCTS.monthly,
  IAP_PRODUCTS.yearly,
];

export const LIFETIME_PRODUCTS: ProductId[] = [
  IAP_PRODUCTS.lifetime,
];

// Utility functions
export const isSubscriptionProduct = (productId: string): boolean => {
  return SUBSCRIPTION_PRODUCTS.includes(productId as ProductId);
};

export const isLifetimeProduct = (productId: string): boolean => {
  return LIFETIME_PRODUCTS.includes(productId as ProductId);
};

export const isValidProduct = (productId: string): boolean => {
  return IAP_PRODUCT_IDS.includes(productId as ProductId);
};

// Product configuration
export const PRODUCT_CONFIG = {
  [IAP_PRODUCTS.monthly]: {
    id: IAP_PRODUCTS.monthly,
    title: 'Aylık Premium',
    description: 'Tüm premium özellikler 1 ay',
    price: 49.99,
    currency: 'TRY',
    type: 'subscription' as const,
    duration: 'monthly' as const,
  },
  [IAP_PRODUCTS.yearly]: {
    id: IAP_PRODUCTS.yearly,
    title: 'Yıllık Premium',
    description: 'Tüm premium özellikler 1 yıl (%17 indirim)',
    price: 499.99,
    currency: 'TRY',
    type: 'subscription' as const,
    duration: 'yearly' as const,
  },
  [IAP_PRODUCTS.lifetime]: {
    id: IAP_PRODUCTS.lifetime,
    title: 'Yaşam Boyu Premium',
    description: 'Tüm premium özellikler kalıcı (%50 indirim)',
    price: 999.99,
    currency: 'TRY',
    type: 'lifetime' as const,
    duration: 'permanent' as const,
  },
} as const;

// Type definitions
export type ProductType = 'subscription' | 'lifetime';
export type SubscriptionDuration = 'monthly' | 'yearly' | 'permanent';

export interface ProductInfo {
  id: ProductId;
  title: string;
  description: string;
  price: number;
  currency: string;
  type: ProductType;
  duration: SubscriptionDuration;
}

// Logging helpers
export const logProductDetection = (productId: string): void => {
  console.info(`✅ Premium product detected: ${productId}`);
};

export const logPremiumStatus = (isPremium: boolean, productId?: string): void => {
  console.info(`📊 Premium Status: ${isPremium ? 'ACTIVE' : 'INACTIVE'}${productId ? ` (Product: ${productId})` : ''}`);
};
