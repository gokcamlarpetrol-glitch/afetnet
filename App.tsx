// GERÇEK AFETNET UYGULAMASI - MEVCUT TASARIM KORUNDU
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { startWatchdogs } from './src/watchdogs/core';
import { ensureCryptoReady } from './src/bootstrap/cryptoInit';
import { ensureQueueReady } from './src/bootstrap/queueInit';
import SettingsInitializer from './src/components/SettingsInitializer';
import NotificationInitializer from './src/components/NotificationInitializer';
import ComprehensiveFeaturesInitializer from './src/components/ComprehensiveFeaturesInitializer';
import { premiumInitService } from './src/services/premiumInitService';

export default function App() {
  useEffect(() => {
    try { 
      LogBox.ignoreAllLogs(true); 
    } catch (e) {
      console.warn('Could not disable logs');
    }
    
    // Initialize critical offline services
    (async () => {
      try {
        // Initialize crypto and queue systems
        await ensureCryptoReady();
        await ensureQueueReady();
        
        // Initialize premium status (IAP check and restore)
        await premiumInitService.initialize();
        
        // Start watchdogs (BLE monitoring, location tracking, battery management)
        startWatchdogs();
        
        console.log('AfetNet - Kritik servisler başlatıldı (offline mesajlaşma, BLE, konum takibi, premium)');
      } catch (error) {
        console.error('AfetNet - Servis başlatma hatası:', error);
      }
    })();
    
    console.log('AfetNet - Mevcut tasarım korundu, stack overflow çözüldü');
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsInitializer />
        <NotificationInitializer />
        <ComprehensiveFeaturesInitializer />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}