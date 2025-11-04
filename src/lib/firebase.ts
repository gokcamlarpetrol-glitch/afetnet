import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { FIREBASE_CONFIG } from '../core/config/firebase';
import { Platform } from 'react-native';

// Firebase configuration - use real config from firebase.ts
const firebaseConfig = (() => {
  const config = Platform.OS === 'ios' ? FIREBASE_CONFIG.ios : FIREBASE_CONFIG.android;
  return {
    apiKey: config.apiKey,
    authDomain: `${config.projectId}.firebaseapp.com`,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  };
})();

// Initialize Firebase with error handling
let app: any = null;
let messaging: any = null;
let initializationAttempted = false;

function initializeFirebase() {
  if (app) return app; // Already initialized
  if (initializationAttempted) return app; // Prevent re-initialization attempts
  
  initializationAttempted = true;
  
  try {
    app = initializeApp(firebaseConfig);
    // Use console.log instead of logger to avoid circular dependency
    if (__DEV__) {
      console.log('[Firebase] App initialized successfully', { projectId: firebaseConfig.projectId });
    }
    
    // Firebase messaging is web-only - skip for React Native
    // React Native uses expo-notifications instead
    if (Platform.OS === 'web') {
      try {
        messaging = getMessaging(app);
        if (__DEV__) {
          console.log('[Firebase] Messaging initialized (web only)');
        }
      } catch (msgError) {
        if (__DEV__) {
          console.warn('[Firebase] Messaging initialization failed:', msgError);
        }
      }
    } else {
      if (__DEV__) {
        console.log('[Firebase] Skipping messaging (React Native - using expo-notifications)');
      }
      messaging = null;
    }
    
    return app;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Firebase] Initialization failed, using fallback mode:', error);
    }
    // Return null if initialization fails
    return null;
  }
}

// Lazy initialization - don't initialize at module load time
// Initialize on first access instead

// Initialize Firebase on first access
export function getFirebaseApp() {
  if (!app) {
    initializeFirebase();
  }
  return app;
}

// Get FCM token
export const getFCMToken = async (): Promise<string | null> => {
  // Ensure Firebase is initialized
  if (!app) {
    initializeFirebase();
  }
  
  if (!messaging) {
    if (__DEV__) {
      console.warn('[Firebase] Messaging not available, returning null token');
    }
    return null;
  }
  
  try {
    const token = await getToken(messaging, {
      vapidKey: (globalThis as any).process?.env?.EXPO_PUBLIC_FIREBASE_VAPID_KEY || 'demo-vapid-key',
    });
    return token;
  } catch (error) {
    if (__DEV__) {
      console.error('[Firebase] Error getting FCM token:', error);
    }
    return null;
  }
};

// Handle foreground messages
export const onForegroundMessage = (callback: (payload: any) => void) => {
  // Ensure Firebase is initialized
  if (!app) {
    initializeFirebase();
  }
  
  if (!messaging) {
    if (__DEV__) {
      console.warn('[Firebase] Messaging not available, cannot handle foreground messages');
    }
    return () => {}; // Return empty unsubscribe function
  }
  
  try {
    return onMessage(messaging, callback);
  } catch (error) {
    if (__DEV__) {
      console.error('[Firebase] Error setting up foreground message handler:', error);
    }
    return () => {};
  }
};

// Export lazy getter - don't initialize at module load
export default getFirebaseApp;
