'use strict';

const IAP_PRODUCTS = {
  monthly: 'org.afetapp.premium.monthly.v2',
  yearly: 'org.afetapp.premium.yearly.v2',
  lifetime: 'org.afetapp.premium.lifetime.v2',
};

const IAP_PRODUCT_IDS = Object.values(IAP_PRODUCTS);

const SUBSCRIPTION_PRODUCTS = [IAP_PRODUCTS.monthly, IAP_PRODUCTS.yearly];
const LIFETIME_PRODUCTS = [IAP_PRODUCTS.lifetime];

const isSubscriptionProduct = (productId) => SUBSCRIPTION_PRODUCTS.includes(productId);
const isLifetimeProduct = (productId) => LIFETIME_PRODUCTS.includes(productId);
const isValidProduct = (productId) => IAP_PRODUCT_IDS.includes(productId);

const PRODUCT_CONFIG = {
  [IAP_PRODUCTS.monthly]: {
    id: IAP_PRODUCTS.monthly,
    title: 'Aylık Premium',
    description: 'Tüm premium özellikler 1 ay',
    price: 49.99,
    currency: 'TRY',
    type: 'subscription',
    duration: 'monthly',
  },
  [IAP_PRODUCTS.yearly]: {
    id: IAP_PRODUCTS.yearly,
    title: 'Yıllık Premium',
    description: 'Tüm premium özellikler 1 yıl (%17 indirim)',
    price: 499.99,
    currency: 'TRY',
    type: 'subscription',
    duration: 'yearly',
  },
  [IAP_PRODUCTS.lifetime]: {
    id: IAP_PRODUCTS.lifetime,
    title: 'Yaşam Boyu Premium',
    description: 'Tüm premium özellikler kalıcı (%50 indirim)',
    price: 999.99,
    currency: 'TRY',
    type: 'lifetime',
    duration: 'permanent',
  },
};

const logProductDetection = (productId) => {
  console.info(`✅ Premium product detected: ${productId}`);
};

const logPremiumStatus = (isPremium, productId) => {
  console.info(`📊 Premium Status: ${isPremium ? 'ACTIVE' : 'INACTIVE'}${productId ? ` (Product: ${productId})` : ''}`);
};

module.exports = {
  IAP_PRODUCTS,
  IAP_PRODUCT_IDS,
  SUBSCRIPTION_PRODUCTS,
  LIFETIME_PRODUCTS,
  isSubscriptionProduct,
  isLifetimeProduct,
  isValidProduct,
  PRODUCT_CONFIG,
  logProductDetection,
  logPremiumStatus,
};
