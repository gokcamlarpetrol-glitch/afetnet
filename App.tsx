// APPLE COMPLIANCE: Stripe temporarily disabled for App Store review
// Will be replaced with Apple In-App Purchase in future update
// import { StripeProvider } from '@stripe/stripe-react-native';
import { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureHandlers, getPushToken } from './src/lib/notifications';
import RootTabs from './src/navigation/RootTabs';

// APPLE COMPLIANCE: Payment disabled for initial App Store submission
// const STRIPE_PUBLISHABLE_KEY = process.env['EXPO_PUBLIC_STRIPE_KEY'] || '';

export default function App() {
  useEffect(() => {
    // Disable in-app warning/critical banners in dev that can block touches
    try { LogBox.ignoreAllLogs(true); } catch {}

    // ✅ PUSH NOTIFICATION SETUP - Kritik!
    configureHandlers();
    
    // Lazy initialization
    (async () => {
      try {
        // Push token al ve logla (backend'e göndermek için)
        const token = await getPushToken();
        if (token) {
          console.log("✅ AfetNet: Push notification hazır");
          // TODO: Token'ı backend'e kaydet (gelecek özellik)
        }

        // Background task kayıt
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          const mod = await import('./src/background/quakeTask').catch(() => null);
          if (mod?.registerQuakeBackground) {
            await mod.registerQuakeBackground();
          }
        }
      } catch (error) {
        console.error("AfetNet: Başlatma hatası:", error);
      }
    })();
  }, []);

  return (
    // APPLE COMPLIANCE: StripeProvider removed for App Store compliance
    // <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <RootTabs />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    // </StripeProvider>
  );
}