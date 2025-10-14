import { initializeApp } from 'firebase/app';
import { logger } from '../utils/productionLogger';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase configuration with fallbacks
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "afetnet-app.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "afetnet-app",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "afetnet-app.appspot.com",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:123456789:ios:abcdef123456",
};

// Initialize Firebase with error handling
let app: any = null;
let messaging: any = null;

try {
  app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
  logger.info('Firebase initialized successfully');
} catch (error) {
  logger.warn('Firebase initialization failed, using fallback mode:', error);
  // Graceful degradation - Firebase will be disabled
}

// Get FCM token
export const getFCMToken = async (): Promise<string | null> => {
  if (!messaging) {
    logger.warn('Firebase messaging not available, returning null token');
    return null;
  }
  
  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY || "demo-vapid-key",
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
