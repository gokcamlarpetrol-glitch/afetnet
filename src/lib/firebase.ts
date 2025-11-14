/**
 * FIREBASE MODULE - ELITE PRODUCTION CONFIGURATION
 * Zero-error Firebase initialization with comprehensive error handling
 * CRITICAL: Lazy imports to prevent Metro bundler errors
 * PRODUCTION-READY: Graceful degradation when Firebase is unavailable
 */

// CRITICAL: Lazy imports to prevent module loading errors
// Firebase modules are loaded dynamically to handle missing dependencies gracefully
let firebaseApp: any = null;
let firebaseMessaging: any = null;
let firebaseConfigCache: any = null;

// CRITICAL: Lazy load Firebase config to prevent module loading errors
async function loadFirebaseConfig() {
  if (firebaseConfigCache) {
    return firebaseConfigCache;
  }
  
  try {
    // CRITICAL: Dynamic import to prevent module loading errors
    const { FIREBASE_CONFIG } = await import('../core/config/firebase');
    const { Platform } = await import('react-native');
    
    const config = Platform.OS === 'ios' ? FIREBASE_CONFIG.ios : FIREBASE_CONFIG.android;
    
    // ELITE: Validate config before caching
    if (!config || !config.apiKey || !config.projectId) {
      // ELITE: Only warn if config exists but is invalid (not if it's intentionally empty)
      if (__DEV__ && config && (config.apiKey === '' || config.projectId === '')) {
        console.debug('[Firebase] Missing required config (apiKey or projectId) - Firebase disabled');
      }
      return {
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
      };
    }
    
    firebaseConfigCache = {
      apiKey: config.apiKey,
      authDomain: `${config.projectId}.firebaseapp.com`,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    };
    return firebaseConfigCache;
  } catch (error: any) {
    // CRITICAL: Handle LoadBundleFromServerRequestError gracefully
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('LoadBundleFromServerRequestError') || 
        errorMessage.includes('Could not load bundle')) {
      if (__DEV__) {
        console.debug('[Firebase] Bundle load error (expected in some environments):', errorMessage);
      }
    } else if (__DEV__) {
      console.warn('[Firebase] Failed to load Firebase config:', errorMessage);
    }
    
    // Return empty config if loading fails
    return {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
    };
  }
}

// Lazy load Firebase modules with comprehensive error handling
async function loadFirebaseModules() {
  if (firebaseApp && firebaseMessaging) {
    return { 
      initializeApp: firebaseApp.initializeApp, 
      getMessaging: firebaseMessaging.getMessaging, 
      getToken: firebaseMessaging.getToken, 
      onMessage: firebaseMessaging.onMessage 
    };
  }
  
  try {
    // CRITICAL: Dynamic import with timeout protection
    const importPromise = Promise.all([
      import('firebase/app'),
      import('firebase/messaging')
    ]);
    
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase module import timeout')), 10000)
    );
    
    const [appModule, messagingModule] = await Promise.race([
      importPromise,
      timeoutPromise
    ]);
    
    firebaseApp = appModule;
    firebaseMessaging = messagingModule;
    
    return {
      initializeApp: firebaseApp.initializeApp,
      getMessaging: firebaseMessaging.getMessaging,
      getToken: firebaseMessaging.getToken,
      onMessage: firebaseMessaging.onMessage,
    };
  } catch (error: any) {
    // CRITICAL: Handle LoadBundleFromServerRequestError gracefully
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('LoadBundleFromServerRequestError') || 
        errorMessage.includes('Could not load bundle') ||
        errorMessage.includes('timeout')) {
      if (__DEV__) {
        console.debug('[Firebase] Module load error (expected in some environments):', errorMessage);
      }
    } else if (__DEV__) {
      console.warn('[Firebase] Failed to load Firebase modules:', errorMessage);
    }
    
    // Return no-op functions if Firebase fails to load
    return {
      initializeApp: () => null,
      getMessaging: () => null,
      getToken: () => Promise.resolve(null),
      onMessage: () => () => {},
    };
  }
}

// ELITE: Initialize Firebase with comprehensive error handling and retry mechanism
let app: any = null;
let messaging: any = null;
let initializationAttempted = false;
let initializationPromise: Promise<any> | null = null;
const MAX_RETRY_ATTEMPTS = 2; // Reduced retries to fail faster
const RETRY_DELAY_MS = 1000;

async function initializeFirebaseWithRetry(attempt: number = 1): Promise<any> {
  if (app) return app; // Already initialized
  
  // Return existing promise if initialization is in progress
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    try {
      // CRITICAL: Load Firebase config dynamically (prevents module loading errors)
      const firebaseConfig = await loadFirebaseConfig();
      
      // ELITE: Validate config before attempting initialization
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId || 
          firebaseConfig.apiKey === '' || firebaseConfig.projectId === '') {
        if (__DEV__) {
          console.debug('[Firebase] Missing required config (apiKey or projectId) - Firebase disabled');
        }
        initializationAttempted = true;
        return null;
      }
      
      // CRITICAL: Load Firebase modules dynamically with error handling
      const { initializeApp: firebaseInitializeApp } = await loadFirebaseModules();
      
      // ELITE: Check if initializeApp is available (may be no-op if modules failed to load)
      if (!firebaseInitializeApp || typeof firebaseInitializeApp !== 'function') {
        if (__DEV__) {
          console.debug('[Firebase] Firebase modules not available - Firebase disabled');
        }
        initializationAttempted = true;
        return null;
      }

      // ELITE: Initialize Firebase app with timeout protection
      const initPromise = Promise.resolve(firebaseInitializeApp(firebaseConfig));
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 5000)
      );
      
      app = await Promise.race([initPromise, timeoutPromise]);
      
      // ELITE: Verify app initialization
      if (!app) {
        if (__DEV__) {
          console.debug('[Firebase] Firebase app initialization returned null or timed out');
        }
        initializationAttempted = true;
        return null;
      }
      
      // Use console.log instead of logger to avoid circular dependency
      if (__DEV__) {
        console.log('[Firebase] ✅ App initialized successfully', { 
          projectId: firebaseConfig.projectId,
          attempt 
        });
      }
      
      // Try to initialize messaging (may fail in non-device environments)
      try {
        const { getMessaging: firebaseGetMessaging } = await loadFirebaseModules();
        if (firebaseGetMessaging && typeof firebaseGetMessaging === 'function') {
          // ELITE: Check if app is valid before initializing messaging
          if (app && typeof app === 'object') {
            messaging = firebaseGetMessaging(app);
            if (__DEV__) {
              console.log('[Firebase] ✅ Messaging initialized');
            }
          } else {
            throw new Error('Firebase app instance is invalid');
          }
        } else {
          throw new Error('getMessaging is not available');
        }
      } catch (msgError: any) {
        // ELITE: Messaging failure is non-critical - app continues without FCM
        const errorMessage = msgError?.message || String(msgError);
        // ELITE: Better error message for common cases
        if (errorMessage.includes('addEventListener') || errorMessage.includes('undefined')) {
          if (__DEV__) {
            console.debug('[Firebase] Messaging initialization skipped: Messaging module not available in this environment (non-critical, app continues)');
          }
        } else {
          if (__DEV__) {
            console.debug('[Firebase] Messaging initialization failed (non-critical, app continues):', errorMessage);
          }
        }
        // Don't throw - messaging is optional
      }
      
      initializationAttempted = true;
      return app;
    } catch (error: any) {
      // CRITICAL: Handle LoadBundleFromServerRequestError specifically
      const errorMessage = error?.message || String(error);
      const isBundleError = errorMessage.includes('LoadBundleFromServerRequestError') || 
                           errorMessage.includes('Could not load bundle');
      
      // ELITE: Retry mechanism for transient failures (but not bundle errors)
      if (!isBundleError && attempt < MAX_RETRY_ATTEMPTS) {
        if (__DEV__) {
          console.debug(`[Firebase] Initialization attempt ${attempt} failed, retrying...`, errorMessage);
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        initializationPromise = null; // Reset promise for retry
        return initializeFirebaseWithRetry(attempt + 1);
      }
      
      // Max retries reached or bundle error - fail gracefully
      if (__DEV__) {
        if (isBundleError) {
          console.debug('[Firebase] Bundle load error - Firebase disabled (app continues normally)');
        } else {
          console.debug('[Firebase] ⚠️ Initialization failed after max retries, using fallback mode:', errorMessage);
        }
      }
      initializationAttempted = true;
      return null;
    } finally {
      initializationPromise = null;
    }
  })();
  
  return initializationPromise;
}

function initializeFirebase() {
  if (app) return app; // Already initialized
  if (initializationAttempted && !app) return null; // Failed initialization
  
  // ELITE: Start async initialization (fire and forget for sync call)
  // CRITICAL: Ensure errors are caught to prevent unhandled promise rejections
  initializeFirebaseWithRetry().catch((error) => {
    // Error already handled in initializeFirebaseWithRetry
    // This catch is just to prevent unhandled promise rejection warnings
    if (__DEV__) {
      console.debug('[Firebase] Initialization error caught (already handled):', error?.message);
    }
  });
  
  return app; // May be null if initialization is still in progress
}

// Lazy initialization - don't initialize at module load time
// Initialize on first access instead

// ELITE: Initialize Firebase on first access with async support
export function getFirebaseApp() {
  if (!app && !initializationAttempted) {
    initializeFirebase();
  }
  return app;
}

// ELITE: Async getter for Firebase app (ensures initialization completes)
// CRITICAL: Safe Firebase export - handle module loading errors gracefully
export async function getFirebaseAppAsync(): Promise<any> {
  try {
    if (app) return app;
    if (initializationPromise) return initializationPromise;
    return await initializeFirebaseWithRetry();
  } catch (error: any) {
    // CRITICAL: Graceful degradation - return null if Firebase fails
    const errorMessage = error?.message || String(error);
    if (__DEV__ && !errorMessage.includes('LoadBundleFromServerRequestError')) {
      console.debug('[Firebase] getFirebaseAppAsync failed:', errorMessage);
    }
    return null;
  }
}

// Get FCM token
export const getFCMToken = async (): Promise<string | null> => {
  try {
    // ELITE: Ensure Firebase is fully initialized before getting token
    if (!app) {
      await initializeFirebaseWithRetry();
    }
    
    if (!app) {
      if (__DEV__) {
        console.debug('[Firebase] Firebase app not initialized, returning null token');
      }
      return null;
    }
    
    // CRITICAL: Load Firebase messaging module dynamically
    const { getMessaging: firebaseGetMessaging, getToken: firebaseGetToken } = await loadFirebaseModules();
    
    // ELITE: Wait for messaging to be available (may take time)
    if (!messaging) {
      // Try to initialize messaging if app exists but messaging doesn't
      if (app && firebaseGetMessaging && typeof firebaseGetMessaging === 'function') {
        try {
          messaging = firebaseGetMessaging(app);
        } catch (msgError: any) {
          if (__DEV__) {
            console.debug('[Firebase] Messaging not available for token:', msgError?.message);
          }
          return null;
        }
      } else {
        if (__DEV__) {
          console.debug('[Firebase] Firebase app not initialized, returning null token');
        }
        return null;
      }
    }
    
    if (!messaging || !firebaseGetToken || typeof firebaseGetToken !== 'function') {
      if (__DEV__) {
        console.debug('[Firebase] Messaging or getToken not available');
      }
      return null;
    }
    
    // ELITE: Get VAPID key from environment (required for web, optional for native)
    const Constants = require('expo-constants');
    const vapidKey = 
      Constants?.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_VAPID_KEY ||
      (globalThis as any).process?.env?.EXPO_PUBLIC_FIREBASE_VAPID_KEY ||
      null;
    
    // ELITE: For React Native, vapidKey is optional (not required)
    // For web, it's required
    const tokenOptions: any = {};
    if (vapidKey && vapidKey !== 'demo-vapid-key') {
      tokenOptions.vapidKey = vapidKey;
    }
    
    // ELITE: Get token with timeout protection
    const tokenPromise = firebaseGetToken(messaging, tokenOptions);
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), 10000) // 10 second timeout
    );
    
    const token = await Promise.race([tokenPromise, timeoutPromise]);
    
    if (!token) {
      if (__DEV__) {
        console.debug('[Firebase] Token request timed out or returned null');
      }
      return null;
    }
    
    if (typeof token !== 'string' || token.length === 0) {
      if (__DEV__) {
        console.warn('[Firebase] Invalid token received');
      }
      return null;
    }
    
    return token;
  } catch (error: any) {
    // ELITE: Handle specific error types
    const errorMessage = error?.message || String(error);
    
    // ELITE: Some errors are expected and should be handled gracefully
    if (errorMessage.includes('messaging/unsupported-browser') || 
        errorMessage.includes('messaging/registration-token-not-found') ||
        errorMessage.includes('messaging/permission-blocked') ||
        errorMessage.includes('LoadBundleFromServerRequestError') ||
        errorMessage.includes('Could not load bundle')) {
      if (__DEV__) {
        console.debug('[Firebase] FCM token not available (expected in some environments):', errorMessage);
      }
      return null;
    }
    
    if (__DEV__) {
      console.error('[Firebase] Error getting FCM token:', error);
    }
    return null;
  }
};

// Handle foreground messages
export const onForegroundMessage = async (callback: (payload: any) => Promise<void> | void): Promise<() => void> => {
  try {
    // CRITICAL: Load Firebase messaging module dynamically
    const { onMessage: firebaseOnMessage, getMessaging: firebaseGetMessaging } = await loadFirebaseModules();
    
    // ELITE: Ensure Firebase is initialized before setting up handler
    if (!app) {
      await initializeFirebaseWithRetry();
    }
    
    if (!app || !firebaseOnMessage || typeof firebaseOnMessage !== 'function') {
      if (__DEV__) {
        console.debug('[Firebase] Messaging not available, cannot handle foreground messages');
      }
      return () => {}; // Return empty unsubscribe function
    }
    
    // Ensure messaging is initialized
    if (!messaging && app && firebaseGetMessaging && typeof firebaseGetMessaging === 'function') {
      try {
        messaging = firebaseGetMessaging(app);
      } catch (msgError: any) {
        if (__DEV__) {
          console.debug('[Firebase] Messaging not available, cannot handle foreground messages:', msgError?.message);
        }
        return () => {}; // Return empty unsubscribe function
      }
    }
    
    if (!messaging) {
      if (__DEV__) {
        console.debug('[Firebase] Messaging not available, cannot handle foreground messages');
      }
      return () => {}; // Return empty unsubscribe function
    }
    
    // ELITE: Wrap callback to handle both sync and async callbacks
    const wrappedCallback = async (payload: any) => {
      try {
        await Promise.resolve(callback(payload));
      } catch (error) {
        if (__DEV__) {
          console.error('[Firebase] Error in foreground message callback:', error);
        }
      }
    };
    
    return firebaseOnMessage(messaging, wrappedCallback);
  } catch (error) {
    if (__DEV__) {
      console.error('[Firebase] Error setting up foreground message handler:', error);
    }
    return () => {};
  }
};

// ELITE: Get messaging instance (for background message handler)
export const getMessagingInstance = async (): Promise<any> => {
  if (!app) {
    await initializeFirebaseWithRetry();
  }
  return messaging;
};

// ELITE: Background message handler (must be called at module level for React Native)
// This is registered in index.ts or App.tsx
export const setBackgroundMessageHandler = async (handler: (payload: any) => Promise<void>) => {
  try {
    const messagingInstance = await getMessagingInstance();
    if (!messagingInstance) {
      if (__DEV__) {
        console.debug('[Firebase] Messaging not available for background handler');
      }
      return;
    }
    
    // ELITE: Background message handler for React Native Firebase
    // Note: This requires @react-native-firebase/messaging
    // For Expo, background messages are handled differently
    if (typeof messagingInstance.setBackgroundMessageHandler === 'function') {
      messagingInstance.setBackgroundMessageHandler(handler);
      if (__DEV__) {
        console.log('[Firebase] ✅ Background message handler registered');
      }
    } else {
      if (__DEV__) {
        console.debug('[Firebase] Background message handler not available (using Expo push notifications)');
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[Firebase] Error setting background message handler:', error);
    }
  }
};

// Export lazy getter - don't initialize at module load
export default getFirebaseApp;
