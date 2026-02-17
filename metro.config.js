/**
 * METRO CONFIG - PRODUCTION-SAFE CONFIGURATION
 * Only intercepts the specific PushNotificationIOS module that doesn't exist in Expo
 * All other resolution delegated to Metro's default resolver
 */

const projectRoot = __dirname;
const config = require('@expo/metro-config').getDefaultConfig(projectRoot);

// ============================================================================
// ASSET EXTENSIONS
// ============================================================================
config.resolver.assetExts.push('mp4', 'mov', 'avi', 'mkv');

// ============================================================================
// RESOLVE REQUEST - ONLY INTERCEPT PushNotificationIOS
// ============================================================================
// React Native's index.js tries to require('./Libraries/PushNotificationIOS/PushNotificationIOS')
// which doesn't exist in Expo builds. We return an empty module ONLY for this specific case.
// All other modules use Metro's default resolution - never silently swallow errors.

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Only intercept the exact PushNotificationIOS requires from React Native internals
  if (
    typeof moduleName === 'string' &&
    (
      moduleName === './Libraries/PushNotificationIOS/PushNotificationIOS' ||
      moduleName === 'react-native/Libraries/PushNotificationIOS/PushNotificationIOS' ||
      moduleName === '@react-native-community/push-notification-ios'
    )
  ) {
    return { type: 'empty' };
  }

  // For ALL other modules: use Metro's standard resolution
  // Do NOT catch errors - let Metro report missing modules so we can fix them
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
