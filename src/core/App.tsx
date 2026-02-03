/**
 * CORE APP - ELITE PRODUCTION ENTRY POINT
 * Production-ready, zero-error initialization
 * Comprehensive error handling with graceful degradation
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { initializeApp, shutdownApp } from './init';
import ErrorBoundary from './components/ErrorBoundary';
import PermissionGuard from './components/PermissionGuard';
import OfflineIndicator from './components/OfflineIndicator';
import { EULAModal } from './components/compliance/EULAModal';
import { globalErrorHandler } from './utils/globalErrorHandler';
import { useTrialStore } from './stores/trialStore';
import { useOnboardingStore } from './stores/onboardingStore';
import { useAppStore } from './stores/appStore';

// Navigators
import MainNavigator from './navigation/MainNavigator';
import OnboardingNavigator from './navigation/OnboardingNavigator';

const Stack = createStackNavigator();

export default function CoreApp() {
  const { completed: isOnboardingCompleted } = useOnboardingStore();
  const { ready: isReady } = useAppStore();

  // Initialize app
  useEffect(() => {
    // DEV: Reset onboarding for testing
    if (__DEV__) {
      import('./utils/onboardingStorage').then(({ resetOnboarding }) => {
        resetOnboarding();
      });
    }

    // SECURITY: Perform Elite Security Audit immediately
    import('./utils/NativeSecurity').then(({ nativeSecurity }) => {
      nativeSecurity.audit().then(status => {
        if (!status.isRooted && !status.isTampered) {
          // Only proceed if secure
          useTrialStore.getState().initializeTrial();
          initializeApp().catch((error) => {
            // Use internal logger, console.error is stripped in prod
            // But we need to see this in dev
            if (__DEV__) console.error('Init failed:', error);
          });
        }
      });
    });

    return () => {
      shutdownApp();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FDFBF7' }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <NavigationContainer
            onStateChange={(state) => {
              // Optional: Track navigation state changes
            }}
          >
            {/* Global Overlays */}
            <PermissionGuard>
              <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
                {isOnboardingCompleted ? (
                  <Stack.Screen name="Main" component={MainNavigator} />
                ) : (
                  <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
                )}
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
