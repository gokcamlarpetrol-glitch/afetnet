// ACTIVE: Native IAP implementation with react-native-iap
import { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureHandlers, getPushToken } from './src/lib/notifications';
import RootTabs from './src/navigation/RootTabs';

// ACTIVE: Native IAP implementation ready

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootTabs />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}