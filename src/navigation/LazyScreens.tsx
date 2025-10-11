/**
 * Lazy Loading for Screens
 * Elite Performance Optimization
 * 
 * Benefits:
 * - Smaller initial bundle
 * - Faster app startup
 * - Better memory usage
 * - On-demand loading
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
export const Settings = lazy(() => import('../screens/Settings'));
export const Family = lazy(() => import('../screens/Family'));
export const Chat = lazy(() => import('../screens/ChatScreen'));

// Advanced Features (load when needed)
export const BlackBox = lazy(() => import('../screens/BlackBox'));
export const Diagnostics = lazy(() => import('../screens/DiagnosticsScreen'));
export const Health = lazy(() => import('../screens/Health'));
export const Groups = lazy(() => import('../screens/Groups'));

// Premium Features
export const EmergencyCard = lazy(() => import('../screens/EmergencyCard'));
export const TilePrefetch = lazy(() => import('../screens/TilePrefetch'));
export const AssemblyPoints = lazy(() => import('../screens/AssemblyPoints'));

// Onboarding (only load once)
export const Onboarding = lazy(() => import('../onboarding/Onboarding'));
export const PermissionsScreen = lazy(() => import('../onboarding/PermissionsScreen'));

// Testing & Debug (development only)
export const TestSuite = lazy(() => import('../screens/TestSuiteScreen'));
export const DiagnosticsScreen = lazy(() => import('../screens/DiagnosticsScreen'));

/**
 * Wrap lazy component with Suspense
 * 
 * @param Component - Lazy-loaded component
 * @param fallback - Loading component (optional)
 * 
 * @example
 * ```tsx
 * const LazySettings = withSuspense(Settings);
 * <LazySettings />
 * ```
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
 * 
 * @param Component - Lazy component to preload
 * 
 * @example
 * ```typescript
 * // Preload Settings when user opens menu
 * preloadScreen(Settings);
 * ```
 */
export function preloadScreen(
  Component: React.LazyExoticComponent<React.ComponentType<any>>
) {
  // Trigger dynamic import
  (Component as any)._payload?._result;
}

/**
 * USAGE IN NAVIGATION:
 * 
 * ```tsx
 * import { HomeScreen, Settings, withSuspense } from './navigation/LazyScreens';
 * 
 * const LazySettings = withSuspense(Settings);
 * 
 * <Tab.Screen name="Home" component={HomeScreen} /> // Critical - no lazy
 * <Tab.Screen name="Settings" component={LazySettings} /> // Lazy-loaded
 * ```
 */

