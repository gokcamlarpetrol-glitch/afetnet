/**
 * APP CONFIGURATION
 * Central configuration for the entire app
 */

export const APP_CONFIG = {
  // App Identity
  name: 'AfetNet',
  version: '1.0.2',
  bundleId: 'com.gokhancamci.afetnetapp',
  
  // EAS
  easProjectId: '072f1217-172a-40ce-af23-3fc0ad3f7f09',
  owner: 'gokhancamci1',
  
  // RevenueCat Product IDs
  iap: {
    productIds: {
      monthly: 'org.afetapp.premium.monthly',
      yearly: 'org.afetapp.premium.yearly',
      lifetime: 'org.afetapp.premium.lifetime',
    },
    entitlementId: 'Premium',
  },
  
  // URLs
  urls: {
    privacyPolicy: 'https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html',
    termsOfService: 'https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html',
    support: 'support@afetnet.app',
  },
  
  // Feature Flags
  features: {
    eewEnabled: false, // Earthquake Early Warning (disabled for now)
    eewNativeAlarm: false,
  },
};

