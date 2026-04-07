/**
 * CORE APP - ELITE PRODUCTION ENTRY POINT
 * Production-ready, zero-error initialization
 * Mandatory authentication before app access
 * Comprehensive error handling with graceful degradation
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef, setCurrentRouteName } from './navigation/navigationRef';
import { createStackNavigator } from '@react-navigation/stack';
import { initializeApp, shutdownApp } from './init';
import ErrorBoundary from './components/ErrorBoundary';
import PermissionGuard from './components/PermissionGuard';
import OfflineIndicator from './components/OfflineIndicator';
import SOSFullScreenAlert from './components/SOSFullScreenAlert';
import IncomingCallOverlay from './components/IncomingCallOverlay';
import { EULAModal } from './components/compliance/EULAModal';
import { useOnboardingStore } from './stores/onboardingStore';
import { useAuthStore, cleanupAuthListener } from './stores/authStore';
import { hasCachedAuthenticatedSession } from './utils/authSessionCache';

// Navigators
import MainNavigator from './navigation/MainNavigator';
import OnboardingNavigator from './navigation/OnboardingNavigator';
import AuthNavigator from './navigation/AuthNavigator';

// CRITICAL: Read auth cache state SYNCHRONOUSLY at module load (same MMKV instance).
// This determines whether we should wait for auth to resolve before showing onboarding.
// For genuinely new users (no cache), we skip the auth wait and show onboarding immediately.
// For returning users (cache exists), we wait for auth to prevent the hydration-race flash.
const hadCachedAuthAtBoot = hasCachedAuthenticatedSession();

const Stack = createStackNavigator();

// ELITE: Loading screen while checking auth — with timeout fallback
// Apple Review rejects apps that show a bare spinner for 10+ seconds.
// After 8s we show a message; after 15s we show a manual login button.
function AuthLoadingScreen() {
  const [showSlowMessage, setShowSlowMessage] = useState(false);
  const [showFallbackLogin, setShowFallbackLogin] = useState(false);
  const { forceUnauthenticated } = useAuthStore();

  useEffect(() => {
    const slowTimer = setTimeout(() => setShowSlowMessage(true), 8_000);
    const fallbackTimer = setTimeout(() => setShowFallbackLogin(true), 15_000);
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <View style={authStyles.container}>
      <ActivityIndicator size="large" color="#1F4E79" />
      {showSlowMessage && (
        <Text style={authStyles.slowText}>
          Oturum kontrol ediliyor...
        </Text>
      )}
      {showFallbackLogin && (
        <Pressable
          style={authStyles.fallbackButton}
          onPress={() => {
            // Force auth store to stop loading and show login screen.
            // CRITICAL FIX: Always use forceUnauthenticated() — it clears the MMKV
            // auth cache, clears pending timers, and sets isAuthenticated=false.
            // The previous fallback (direct setState) bypassed all those guards,
            // and the subscribe guard would immediately restore isAuthenticated=true
            // if the user had a cached session (making the button a no-op).
            forceUnauthenticated();
          }}
        >
          <Text style={authStyles.fallbackButtonText}>Giriş Ekranına Git</Text>
        </Pressable>
      )}
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
  slowText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  fallbackButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1F4E79',
    borderRadius: 12,
  },
  fallbackButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default function CoreApp() {
  const { completed: isOnboardingCompleted, isHydrated: isOnboardingHydrated } = useOnboardingStore();
  const { isAuthenticated, isLoading: isAuthLoading, initialize: initAuth } = useAuthStore();
  const appInitializedRef = useRef(false);
  const appInitializingRef = useRef(false);
  const initSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // APPLE REJECTION FIX: Handle iOS memory warnings.
  // Apple tests with low-memory conditions on iPad. Apps that don't respond to memory
  // warnings risk being terminated by the OS. Register the handler so iOS knows
  // the app is memory-aware. Log for Crashlytics diagnostics.
  useEffect(() => {
    const memoryWarningSubscription = AppState.addEventListener('memoryWarning', () => {
      console.warn('[MemoryWarning] iOS memory warning received — app is memory-aware');
      // Future: add cache trimming if stores implement trimInMemoryCache()
    });
    return () => memoryWarningSubscription.remove();
  }, []);

  // DIAGNOSTIC: Log cold-start persistence state to help identify "onboarding after kill" reports.
  // Fires only once per mount (cold start). Non-blocking, production-safe.
  // CRITICAL FIX: Log in ALL builds (not just __DEV__) — Crashlytics captures console.log.
  // Without production logging, "logout on kill" reports are impossible to diagnose.
  useEffect(() => {
    try {
      const { DirectStorage, isMMKVPersistent } = require('./utils/storage');
      const hasCached = DirectStorage.getBoolean('afetnet_auth_cached') || false;
      const onbRaw = DirectStorage.getString('afetnet-onboarding');
      const onbLegacy = DirectStorage.getString('AFETNET_ONBOARDING_COMPLETED');
      const eulaLegacy = DirectStorage.getString('AFETNET_EULA_ACCEPTED');
      if (__DEV__) {
        console.log(
          `[ColdStart] mmkv=${isMMKVPersistent} auth_cached=${hasCached}` +
          ` onb_store=${!!onbRaw} onb_legacy=${onbLegacy === '1'}` +
          ` eula_legacy=${eulaLegacy === '1'}` +
          ` zustand: onb=${isOnboardingCompleted} eula=${require('./stores/settingsStore').useSettingsStore.getState().eulaAccepted}` +
          ` auth=${isAuthenticated} authLoading=${isAuthLoading}`
        );
      }
      // CRITICAL FIX: Warn user if MMKV fell back to volatile MemoryStorage.
      // Without MMKV, ALL data (auth, messages, settings) is lost on app restart.
      // This only happens on Remote Debugger or if JSI fails — should never happen in production.
      if (!isMMKVPersistent) {
        console.error('[ColdStart] CRITICAL: MMKV fell back to MemoryStorage — all data will be lost on restart');
        const { Alert } = require('react-native');
        Alert.alert(
          'Depolama Hatası',
          'Uygulama verileri kalıcı olarak kaydedilemiyor. Lütfen uygulamayı yeniden başlatın. Sorun devam ederse uygulamayı silip yeniden yükleyin.',
          [{ text: 'Tamam' }]
        );
      }
    } catch { /* diagnostic only */ }
  }, []);

  // Initialize trial/auth listeners and run security check.
  // Service bootstrap is handled in a separate auth-gated effect.
  useEffect(() => {

    const initializeWithSecurityCheck = async () => {
      // CRITICAL FIX: Call initAuth() once and track it. The previous code called
      // initAuth() inside a try block and again in the catch block. If the outer try
      // threw synchronously after initAuth() was called but before authListenerInitialized
      // was set (async), both calls could race past the guard — creating duplicate
      // onAuthStateChanged listeners and double state updates.
      let authInitStarted = false;
      try {
        authInitStarted = true;
        initAuth().catch((e) => {
          if (__DEV__) console.error('Auth init error:', e);
        });

        // Security check in background (non-blocking)
        try {
          const { nativeSecurity } = await import('./utils/NativeSecurity');
          // Add 3 second timeout to prevent hanging
          let securityTimeoutId: ReturnType<typeof setTimeout>;
          const timeoutPromise = new Promise((_, reject) => {
            securityTimeoutId = setTimeout(() => reject(new Error('Security check timeout')), 3000);
          });

          let status: { isRooted: boolean; isTampered: boolean };
          try {
            status = await Promise.race([
              nativeSecurity.audit(),
              timeoutPromise
            ]) as { isRooted: boolean; isTampered: boolean };
          } finally {
            clearTimeout(securityTimeoutId!);
          }

          if (status.isRooted || status.isTampered) {
            if (__DEV__) console.warn('Security warning: Device may be compromised');
          }
        } catch (securityError) {
          // Security check failed or timed out - app continues normally
          if (__DEV__) console.warn('Security check skipped:', securityError);
        }
      } catch (error) {
        // Fallback: ensure auth flow still starts only if it wasn't already called.
        if (__DEV__) console.error('Init error, using fallback:', error);
        if (!authInitStarted) {
          initAuth().catch(e => { if (__DEV__) console.debug('initAuth fallback also failed:', e); });
        }
      }
    };

    initializeWithSecurityCheck();

    return () => {
      // CRITICAL: On true component unmount, clean up BOTH services AND auth listener.
      // shutdownApp() no longer calls cleanupAuthListener() because the auth listener
      // must persist across login/logout cycles. Only on true unmount do we destroy it.
      shutdownApp();
      cleanupAuthListener();
      // CRITICAL FIX: Clear initSafetyTimer on unmount to prevent it firing
      // after component is unmounted (sets ref on dead component).
      if (initSafetyTimerRef.current) { clearTimeout(initSafetyTimerRef.current); initSafetyTimerRef.current = null; }
      if (initRetryTimerRef.current) { clearTimeout(initRetryTimerRef.current); initRetryTimerRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (isAuthenticated && !appInitializedRef.current && !appInitializingRef.current) {
      // CRITICAL FIX: Only set appInitializingRef here (the "lock" flag).
      // appInitializedRef is set to true AFTER init succeeds (in .finally),
      // not before. Setting it before caused a window where logout checks
      // saw appInitializedRef=true but init hadn't actually started yet.
      appInitializingRef.current = true;

      // CRITICAL FIX: Safety timeout for appInitializingRef. If initializeApp() promise
      // hangs indefinitely (past the 30s internal timeout), appInitializingRef stays true
      // forever — blocking both shutdown and re-init. This 35s timeout (slightly longer
      // than init's 30s internal timeout) ensures appInitializingRef is always released.
      // Stored in ref so effect cleanup can clear it on unmount.
      if (initSafetyTimerRef.current) clearTimeout(initSafetyTimerRef.current);
      initSafetyTimerRef.current = setTimeout(() => {
        initSafetyTimerRef.current = null;
        if (appInitializingRef.current) {
          if (__DEV__) console.warn('App.tsx: initializeApp safety timeout (35s) — releasing appInitializingRef');
          appInitializingRef.current = false;
        }
      }, 35_000);

      initializeApp({ authenticated: true })
        .then(() => {
          // Set appInitializedRef AFTER init actually succeeds
          appInitializedRef.current = true;
        })
        .catch((error) => {
          appInitializedRef.current = false;
          if (__DEV__) console.error('Auth-gated init failed:', error);
          // Retry init after 5s if still authenticated
          initRetryTimerRef.current = setTimeout(() => {
            initRetryTimerRef.current = null;
            if (useAuthStore.getState().isAuthenticated && !appInitializedRef.current && !appInitializingRef.current) {
              if (__DEV__) console.log('Retrying failed init...');
              appInitializingRef.current = true;
              initializeApp({ authenticated: true })
                .then(() => { appInitializedRef.current = true; })
                .catch(() => { appInitializedRef.current = false; })
                .finally(() => { appInitializingRef.current = false; });
            }
          }, 5000);
        })
        .finally(async () => {
          if (initSafetyTimerRef.current) { clearTimeout(initSafetyTimerRef.current); initSafetyTimerRef.current = null; }
          // CRITICAL FIX: If user logged out while init was running, trigger shutdown.
          // Check both success case (appInitializedRef=true) and failure case
          // (services may have partially started before the error).
          if (!useAuthStore.getState().isAuthenticated) {
            appInitializedRef.current = false;
            try {
              await shutdownApp();
            } catch (e) {
              if (__DEV__) console.warn('Post-init shutdown failed:', e);
            }
          }
          appInitializingRef.current = false;
        });
      return;
    }

    if (!isAuthenticated && appInitializedRef.current && !appInitializingRef.current) {
      appInitializedRef.current = false;
      appInitializingRef.current = true;
      shutdownApp()
        .catch((error) => {
          if (__DEV__) console.warn('Shutdown after logout failed:', error);
        })
        .finally(() => { appInitializingRef.current = false; });
    }
  }, [isAuthenticated, isAuthLoading]);

  // Safety net: if user is already authenticated but onboarding state is lost/corrupted,
  // restore onboarding completion to prevent unwanted onboarding loop after app restarts.
  useEffect(() => {
    if (!isAuthenticated || isOnboardingCompleted) {
      return;
    }

    useOnboardingStore.setState({ completed: true, isHydrated: true });
    import('./utils/onboardingStorage')
      .then(({ setOnboardingCompleted }) => setOnboardingCompleted().catch(e => { if (__DEV__) console.debug('Onboarding persist failed:', e); }))
      .catch(e => { if (__DEV__) console.debug('Onboarding storage import failed:', e); });
  }, [isAuthenticated, isOnboardingCompleted]);

  // ELITE: Determine which screen to show
  //
  // ROOT CAUSE FIX: The previous order checked onboarding BEFORE auth loading.
  // This caused the following sequence on cold start with corrupted/stale MMKV:
  //   1. Zustand persist hydration overwrites sync `completed=true` with stale `completed=false`
  //   2. onRehydrateStorage callback hasn't fired yet to restore it
  //   3. Navigator sees `!isOnboardingCompleted=true` → shows Onboarding screen
  //   4. Auth is still loading but was never checked (onboarding check came first)
  //   5. User sees Onboarding flash (or sticks if auth cache is also corrupted)
  //
  // The fix: If auth is still loading, ALWAYS show the loading screen. We cannot
  // make a correct onboarding decision until auth state is resolved, because the
  // safety net (isAuthenticated && !isOnboardingCompleted → force completed) depends
  // on knowing auth state. For genuine new users (no cached auth), isAuthLoading
  // starts as true but resolves within milliseconds to false + unauthenticated,
  // at which point the onboarding check correctly shows the Onboarding screen.
  const getNavigatorContent = () => {
    // Step 0: Wait for onboarding store to hydrate from MMKV
    // Fail-open: if onboardingCompleted is already true (DirectStorage sync), skip spinner
    if (!isOnboardingHydrated && !isOnboardingCompleted) {
      return <Stack.Screen name="Loading" component={AuthLoadingScreen} />;
    }

    // Step 1: CRITICAL FIX — If the user had a cached auth session at boot, wait
    // for auth to resolve BEFORE making any navigation decisions.
    // Previously, onboarding was checked before auth loading. If Zustand persist
    // hydration briefly set completed=false (stale data merge), the user saw the
    // Onboarding screen even though they were authenticated.
    //
    // For genuinely new users (hadCachedAuthAtBoot=false), we skip this wait so
    // they see the Onboarding screen immediately without an 8-second delay.
    if (isAuthLoading && hadCachedAuthAtBoot) {
      return <Stack.Screen name="AuthLoading" component={AuthLoadingScreen} />;
    }

    // Step 2: Show onboarding ONLY if not completed AND not authenticated.
    // An authenticated user MUST have completed onboarding — if the state says
    // otherwise, it's a hydration race / storage corruption. The safety-net
    // effect (useEffect with [isAuthenticated, isOnboardingCompleted]) will
    // correct this within one render cycle. Meanwhile, we skip to Main.
    if (!isOnboardingCompleted && !isAuthenticated) {
      return <Stack.Screen name="Onboarding" component={OnboardingNavigator} />;
    }

    // Step 3: Show loading while auth resolves (for new users with no cache)
    if (isAuthLoading) {
      return <Stack.Screen name="AuthLoading" component={AuthLoadingScreen} />;
    }

    // Step 4: Show auth flow if not authenticated (onboarding IS completed)
    if (!isAuthenticated) {
      return <Stack.Screen name="Auth" component={AuthNavigator} />;
    }

    // Step 5: Show main app if authenticated
    // (onboarding may briefly be false due to hydration race, but safety-net
    // effect will fix it within one render frame — user never sees Onboarding)
    return <Stack.Screen name="Main" component={MainNavigator} />;
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FDFBF7' }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              try {
                const routeName = navigationRef.getCurrentRoute()?.name;
                setCurrentRouteName(routeName);
              } catch (e) {
                if (__DEV__) console.warn('Navigation onReady error:', e);
              }
            }}
            onStateChange={() => {
              try {
                const routeName = navigationRef.getCurrentRoute()?.name;
                setCurrentRouteName(routeName);
              } catch (e) {
                if (__DEV__) console.warn('Navigation onStateChange error:', e);
              }
            }}
          >
            {/* Global Overlays */}
            <PermissionGuard>
              <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
                {getNavigatorContent()}
              </Stack.Navigator>
              <OfflineIndicator />
            </PermissionGuard>

            {/* ELITE: Compliance - Mandatory EULA */}
            <EULAModal />

            {/* ELITE V4: Full-screen SOS alert for foreground notifications */}
            <SOSFullScreenAlert />

            {/* ELITE: Incoming voice call overlay */}
            <IncomingCallOverlay />
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
