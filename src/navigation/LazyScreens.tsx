/**
 * Lazy Loading for Screens - FIXED VERSION
 * No circular dependencies
 */

import React, { Suspense, lazy } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

/**
 * Loading fallback component
 */
const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
    <ActivityIndicator size="large" color="#3b82f6" />
    <Text style={{ color: '#ffffff', marginTop: 16, fontSize: 16 }}>
      Yükleniyor...
    </Text>
  </View>
);

/**
 * CRITICAL SCREENS - Load immediately (no lazy loading)
 */
export { default as HomeScreen } from '../screens/HomeSimple';
export { default as MapScreen } from '../screens/Map';
export { default as SOSScreen } from '../screens/SOSScreen';

/**
 * LAZY-LOADED SCREENS - Load on demand
 */

// Settings & Profile (low priority)
export const Settings = lazy(() => import('../screens/Settings/SettingsCore'));
export const Family = lazy(() => import('../screens/Family'));
export const Chat = lazy(() => import('../screens/ChatScreen'));

// Advanced Features (load when needed)
export const BlackBox = lazy(() => import('../screens/BlackBox'));
export const Diagnostics = lazy(() => import('../screens/Diagnostics'));
export const Health = lazy(() => import('../screens/Health'));
export const Groups = lazy(() => import('../screens/Groups'));

// Premium Features
export const EmergencyCard = lazy(() => import('../screens/EmergencyCard'));
export const TilePrefetch = lazy(() => import('../screens/TilePrefetch'));
export const AssemblyPoints = lazy(() => import('../screens/AssemblyPoints'));

// Onboarding (only load once)
export const Onboarding = lazy(() => import('../onboarding/Onboarding'));
export const PermissionsScreen = lazy(() => import('../onboarding/PermissionsScreen'));

/**
 * Wrap lazy component with Suspense
 */
export function withSuspense<P extends object>(
  Component: React.LazyExoticComponent<React.ComponentType<P>>,
  fallback?: React.ReactNode
) {
  return (props: P) => (
    <Suspense fallback={fallback || <LoadingScreen />}>
      <Component {...props} />
    </Suspense>
  );
}

/**
 * Preload screen for faster navigation
 */
export function preloadScreen(
  Component: React.LazyExoticComponent<React.ComponentType<any>>
) {
  // Trigger dynamic import
  (Component as any)._payload?._result;
}