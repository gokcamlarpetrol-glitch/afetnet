"use strict";
// SHARED IAP PRODUCTS MODULE - NEW BUNDLE ID (org.afetnet1.app)
// Single source of truth for all IAP product IDs across client and server
// IMPORTANT: These are NEW product IDs for the NEW App Store submission
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPremiumStatus = exports.logProductDetection = exports.PRODUCT_CONFIG = exports.isValidProduct = exports.isLifetimeProduct = exports.isSubscriptionProduct = exports.LIFETIME_PRODUCTS = exports.SUBSCRIPTION_PRODUCTS = exports.IAP_PRODUCT_IDS = exports.IAP_PRODUCTS = void 0;
exports.IAP_PRODUCTS = {
  monthly: 'org.afetnet1.premium.monthly',
  yearly: 'org.afetnet1.premium.yearly',
  lifetime: 'org.afetnet1.premium.lifetime',
};
exports.IAP_PRODUCT_IDS = Object.values(exports.IAP_PRODUCTS);
// Product categories
exports.SUBSCRIPTION_PRODUCTS = [
  exports.IAP_PRODUCTS.monthly,
  exports.IAP_PRODUCTS.yearly,
];
exports.LIFETIME_PRODUCTS = [
  exports.IAP_PRODUCTS.lifetime,
];
// Utility functions
const isSubscriptionProduct = (productId) => {
  return exports.SUBSCRIPTION_PRODUCTS.includes(productId);
};
exports.isSubscriptionProduct = isSubscriptionProduct;
const isLifetimeProduct = (productId) => {
  return exports.LIFETIME_PRODUCTS.includes(productId);
};
exports.isLifetimeProduct = isLifetimeProduct;
const isValidProduct = (productId) => {
  return exports.IAP_PRODUCT_IDS.includes(productId);
};
exports.isValidProduct = isValidProduct;
// Product configuration
exports.PRODUCT_CONFIG = {
  [exports.IAP_PRODUCTS.monthly]: {
    id: exports.IAP_PRODUCTS.monthly,
    title: 'Aylık Premium',
    description: 'Tüm premium özellikler 1 ay',
    price: 49.99,
    currency: 'TRY',
    type: 'subscription',
    duration: 'monthly',
  },
  [exports.IAP_PRODUCTS.yearly]: {
    id: exports.IAP_PRODUCTS.yearly,
    title: 'Yıllık Premium',
    description: 'Tüm premium özellikler 1 yıl (%17 indirim)',
    price: 499.99,
    currency: 'TRY',
    type: 'subscription',
    duration: 'yearly',
  },
  [exports.IAP_PRODUCTS.lifetime]: {
    id: exports.IAP_PRODUCTS.lifetime,
    title: 'Yaşam Boyu Premium',
    description: 'Tüm premium özellikler kalıcı (%50 indirim)',
    price: 999.99,
    currency: 'TRY',
    type: 'lifetime',
    duration: 'permanent',
  },
};
// Logging helpers
const logProductDetection = (productId) => {
  console.info(`✅ Premium product detected: ${productId}`);
};
exports.logProductDetection = logProductDetection;
const logPremiumStatus = (isPremium, productId) => {
  console.info(`📊 Premium Status: ${isPremium ? 'ACTIVE' : 'INACTIVE'}${productId ? ` (Product: ${productId})` : ''}`);
};
exports.logPremiumStatus = logPremiumStatus;
//# sourceMappingURL=products-new.js.map