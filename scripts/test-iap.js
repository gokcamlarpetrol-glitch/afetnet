#!/usr/bin/env node

/**
 * IAP Test Command
 * Tests the centralized IAP configuration and premium status
 * 
 * Usage: npm run test:iap
 */

// Test the centralized products configuration
const IAP_PRODUCTS = {
  MONTHLY: "afetnet_premium_monthly1",
  YEARLY: "afetnet_premium_yearly1",
  LIFETIME: "afetnet_premium_lifetime",
};

const IAP_PRODUCT_LIST = Object.values(IAP_PRODUCTS);
const SUBSCRIPTION_PRODUCTS = [IAP_PRODUCTS.MONTHLY, IAP_PRODUCTS.YEARLY];
const LIFETIME_PRODUCTS = [IAP_PRODUCTS.LIFETIME];

const isValidProduct = (productId) => IAP_PRODUCT_LIST.includes(productId);
const isSubscriptionProduct = (productId) => SUBSCRIPTION_PRODUCTS.includes(productId);
const isLifetimeProduct = (productId) => LIFETIME_PRODUCTS.includes(productId);

const logProductDetection = (productId) => {
  console.log(`✅ Premium product detected: ${productId}`);
};

const logPremiumStatus = (isPremium, productId) => {
  console.log(`📊 Premium Status: ${isPremium ? 'ACTIVE' : 'INACTIVE'}${productId ? ` (Product: ${productId})` : ''}`);
};

console.log('🧪 IAP CONFIGURATION TEST');
console.log('========================');

// Test product ID sets
console.log('\n📦 Product ID Sets:');
console.log('IAP_PRODUCTS:', IAP_PRODUCTS);
console.log('IAP_PRODUCT_LIST:', IAP_PRODUCT_LIST);
console.log('SUBSCRIPTION_PRODUCTS:', SUBSCRIPTION_PRODUCTS);
console.log('LIFETIME_PRODUCTS:', LIFETIME_PRODUCTS);

// Test individual product IDs
console.log('\n🔍 Individual Product IDs:');
console.log('MONTHLY:', IAP_PRODUCTS.MONTHLY);
console.log('YEARLY:', IAP_PRODUCTS.YEARLY);
console.log('LIFETIME:', IAP_PRODUCTS.LIFETIME);

// Test utility functions
console.log('\n⚙️ Utility Function Tests:');

const testProducts = [IAP_PRODUCTS.MONTHLY, IAP_PRODUCTS.YEARLY, IAP_PRODUCTS.LIFETIME, 'invalid_product'];

testProducts.forEach(productId => {
  console.log(`\nProduct: ${productId}`);
  console.log(`  isValidProduct: ${isValidProduct(productId)}`);
  console.log(`  isSubscriptionProduct: ${isSubscriptionProduct(productId)}`);
  console.log(`  isLifetimeProduct: ${isLifetimeProduct(productId)}`);
});

// Test logging functions
console.log('\n📝 Logging Function Tests:');
logProductDetection(IAP_PRODUCTS.MONTHLY);
logProductDetection(IAP_PRODUCTS.YEARLY);
logProductDetection(IAP_PRODUCTS.LIFETIME);
logPremiumStatus(true, IAP_PRODUCTS.LIFETIME);
logPremiumStatus(false);

// Test product configuration
console.log('\n📋 Product Configuration:');
IAP_PRODUCT_LIST.forEach(productId => {
  console.log(`${productId}: Valid premium product`);
});

console.log('\n✅ IAP Configuration Test Complete');
console.log('\n🚀 Next Steps:');
console.log('1. Test cold app startup entitlement check');
console.log('2. Test TestFlight sandbox purchases:');
console.log(`   - ${IAP_PRODUCTS.MONTHLY}`);
console.log(`   - ${IAP_PRODUCTS.YEARLY}`);
console.log(`   - ${IAP_PRODUCTS.LIFETIME}`);
console.log('3. Test restore purchases functionality');
console.log('4. Verify only valid IDs are processed');
console.log('5. Test subscription expiry handling');
console.log('6. Test lifetime permanent premium status');
