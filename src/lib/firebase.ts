import { initializeApp } from 'firebase/app';
import { logger } from '../utils/productionLogger';
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

function initializeFirebase() {
  if (app) return app; // Already initialized
  
  try {
    app = initializeApp(firebaseConfig);
    logger.info('Firebase app initialized successfully', { projectId: firebaseConfig.projectId });
    
    // Try to initialize messaging (may fail in non-device environments)
    try {
      messaging = getMessaging(app);
      logger.info('Firebase messaging initialized');
    } catch (msgError) {
      logger.warn('Firebase messaging initialization failed (this is OK in simulator):', msgError);
    }
    
    return app;
  } catch (error) {
    logger.warn('Firebase initialization failed, using fallback mode:', error);
    // Return null if initialization fails
    return null;
  }
}

// Initialize immediately
app = initializeFirebase();

// Get FCM token
export const getFCMToken = async (): Promise<string | null> => {
  if (!messaging) {
    logger.warn('Firebase messaging not available, returning null token');
    return null;
  }
  
  try {
    const token = await getToken(messaging, {
      vapidKey: (globalThis as any).process?.env?.EXPO_PUBLIC_FIREBASE_VAPID_KEY || 'demo-vapid-key',
    });
    return token;
  } catch (error) {
    logger.error('Error getting FCM token:', error);
    return null;
  }
};

// Handle foreground messages
export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) {
    logger.warn('Firebase messaging not available, cannot handle foreground messages');
    return () => {}; // Return empty unsubscribe function
  }
  
  try {
    return onMessage(messaging, callback);
  } catch (error) {
    logger.error('Error setting up foreground message handler:', error);
    return () => {};
  }
};

export default app;
