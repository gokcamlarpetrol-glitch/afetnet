/**
 * CORE APP - ELITE PRODUCTION ENTRY POINT
 * Production-ready, zero-error initialization
 * Mandatory authentication before app access
 * Comprehensive error handling with graceful degradation
 */

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { initializeApp, shutdownApp } from './init';
import ErrorBoundary from './components/ErrorBoundary';
import PermissionGuard from './components/PermissionGuard';
import OfflineIndicator from './components/OfflineIndicator';
import { EULAModal } from './components/compliance/EULAModal';
import { useTrialStore } from './stores/trialStore';
import { useOnboardingStore } from './stores/onboardingStore';
import { useAuthStore, cleanupAuthListener } from './stores/authStore';

// Navigators
import MainNavigator from './navigation/MainNavigator';
import OnboardingNavigator from './navigation/OnboardingNavigator';
import AuthNavigator from './navigation/AuthNavigator';

const Stack = createStackNavigator();

// ELITE: Loading screen while checking auth
function AuthLoadingScreen() {
  return (
    <View style={authStyles.container}>
      <ActivityIndicator size="large" color="#1F4E79" />
    </View>
  );
}

const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDFBF7',
  },
});

export default function CoreApp() {
  const { completed: isOnboardingCompleted, isHydrated: isOnboardingHydrated } = useOnboardingStore();
  const { isAuthenticated, isLoading: isAuthLoading, initialize: initAuth } = useAuthStore();

  // Initialize app and auth
  useEffect(() => {

    // CRITICAL FIX: Always initialize app, security check should not block startup
    const initializeWithSecurityCheck = async () => {
      try {
        // Initialize trial and auth FIRST - don't wait for security
        useTrialStore.getState().initializeTrial();
        initAuth();

        // Start app initialization immediately
        initializeApp().catch((error) => {
          if (__DEV__) console.error('Init failed:', error);
        });

        // Security check in background (non-blocking)
        try {
          const { nativeSecurity } = await import('./utils/NativeSecurity');
          // Add 3 second timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Security check timeout')), 3000)
          );

          const status = await Promise.race([
            nativeSecurity.audit(),
            timeoutPromise
          ]) as { isRooted: boolean; isTampered: boolean };

          if (status.isRooted || status.isTampered) {
            if (__DEV__) console.warn('Security warning: Device may be compromised');
          }
        } catch (securityError) {
          // Security check failed or timed out - app continues normally
          if (__DEV__) console.warn('Security check skipped:', securityError);
        }
      } catch (error) {
        // Fallback: Initialize app even if everything fails
        if (__DEV__) console.error('Init error, using fallback:', error);
        useTrialStore.getState().initializeTrial();
        initAuth();
        initializeApp().catch(() => { });
      }
    };

    initializeWithSecurityCheck();

    return () => {
      cleanupAuthListener();
      shutdownApp();
    };
  }, []);

  // ELITE: Determine which screen to show
  const getNavigatorContent = () => {
    // Step 0: Wait for onboarding store to hydrate from AsyncStorage
    if (!isOnboardingHydrated) {
      return <Stack.Screen name="Loading" component={AuthLoadingScreen} />;
    }

    // Step 1: Show onboarding if not completed
    if (!isOnboardingCompleted) {
      return <Stack.Screen name="Onboarding" component={OnboardingNavigator} />;
    }

    // Step 2: Show loading while checking auth
    if (isAuthLoading) {
      return <Stack.Screen name="AuthLoading" component={AuthLoadingScreen} />;
    }

    // Step 3: Show auth flow if not authenticated
    if (!isAuthenticated) {
      return <Stack.Screen name="Auth" component={AuthNavigator} />;
    }

    // Step 4: Show main app if authenticated
    return <Stack.Screen name="Main" component={MainNavigator} />;
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FDFBF7' }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <NavigationContainer>
            {/* Global Overlays */}
            <PermissionGuard>
              <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
                {getNavigatorContent()}
              </Stack.Navigator>
              <OfflineIndicator />
            </PermissionGuard>

            {/* ELITE: Compliance - Mandatory EULA */}
            <EULAModal />
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
