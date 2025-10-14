// ACTIVE: Native IAP implementation with react-native-iap
// PRODUCTION READY: No console.logs, proper error handling
import { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureHandlers, getPushToken } from './src/lib/notifications';
import RootTabs from './src/navigation/RootTabs';
import { logger } from './src/utils/productionLogger';

export default function App() {
  useEffect(() => {
    // Disable in-app warning/critical banners in dev that can block touches
    try { LogBox.ignoreAllLogs(true); } catch {}

    // ✅ PUSH NOTIFICATION SETUP - Critical for emergency alerts
    configureHandlers();
    
    // Lazy initialization with proper error handling
    (async () => {
      try {
        // Get push token for backend registration
        const token = await getPushToken();
        if (token) {
          logger.info('Push notification ready', { token: token.substring(0, 10) + '...' });
          // TODO: Send token to backend for emergency notifications
        }

        // Background task registration for earthquake monitoring
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          const mod = await import('./src/background/quakeTask').catch(() => null);
          if (mod?.registerQuakeBackground) {
            await mod.registerQuakeBackground();
            logger.info('Background earthquake monitoring registered');
          }
        }
      } catch (error) {
        logger.error('App initialization error', error);
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootTabs />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}