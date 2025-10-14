// EXPO GO COMPATIBLE VERSION
// Simplified notifications for Expo Go testing

/**
 * Push notification token alımı
 * Simplified for Expo Go
 */
export async function getPushToken(): Promise<string|null> {
  try {
    console.log('Push notification token requested (Expo Go compatible)');
    return 'demo-token-for-expo-go';
  } catch (error) {
    console.error('Failed to get push notification token', error);
    return null;
  }
}

/**
 * Notification handlers configuration
 * Simplified for Expo Go
 */
export function configureHandlers() {
  try {
    console.log('Notification handlers configured (Expo Go compatible)');
  } catch (error) {
    console.error('Failed to configure notification handlers', error);
  }
}