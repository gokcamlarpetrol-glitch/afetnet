import { backendLogger } from '../utils/productionLogger';
import admin from 'firebase-admin';

let firebaseInitialized = false;

export const initializeFirebase = async () => {
  if (firebaseInitialized) {
    return;
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      backendLogger.warn('⚠️  Firebase credentials not configured. Push notifications will be disabled.');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    firebaseInitialized = true;
    backendLogger.debug('✅ Firebase Admin SDK initialized');
  } catch (error) {
    backendLogger.error('❌ Firebase initialization failed:', error);
  }
};

export const sendPushNotification = async (
  token: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
) => {
  if (!firebaseInitialized) {
    backendLogger.warn('Firebase not initialized. Skipping push notification.');
    return null;
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      token,
    };

    const response = await admin.messaging().send(message);
    backendLogger.debug('Push notification sent:', response);
    return response;
  } catch (error) {
    backendLogger.error('Push notification error:', error);
    throw error;
  }
};

export const sendMulticastNotification = async (
  tokens: string[],
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
) => {
  if (!firebaseInitialized || tokens.length === 0) {
    return null;
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    backendLogger.debug(`Multicast sent: ${response.successCount}/${tokens.length} successful`);
    return response;
  } catch (error) {
    backendLogger.error('Multicast notification error:', error);
    throw error;
  }
};

