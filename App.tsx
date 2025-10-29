// GERÇEK AFETNET UYGULAMASI - MEVCUT TASARIM KORUNDU
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/ui/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import { startWatchdogs } from './src/watchdogs/core';
import { ensureCryptoReady } from './src/bootstrap/cryptoInit';
import { ensureQueueReady } from './src/bootstrap/queueInit';
import SettingsInitializer from './src/components/SettingsInitializer';
import NotificationInitializer from './src/components/NotificationInitializer';
import ComprehensiveFeaturesInitializer from './src/components/ComprehensiveFeaturesInitializer';
import EarthquakeWarningModal from './src/components/EarthquakeWarningModal';
import { premiumInitService } from './src/services/premiumInitService';
import { offlineSyncManager } from './src/services/OfflineSyncManager';
import { advancedBatteryManager } from './src/services/AdvancedBatteryManager';
import { militaryGradeSecurity } from './src/services/MilitaryGradeSecurity';
import { advancedLocationManager } from './src/services/AdvancedLocationManager';
import { networkIntelligenceEngine } from './src/services/NetworkIntelligenceEngine';
import { disasterRecoveryManager } from './src/services/DisasterRecoveryManager';
import { earthquakeWarningService } from './src/services/EarthquakeWarningService';
import { initializeRevenueCat } from './src/lib/revenuecat';

export default function App() {
  useEffect(() => {
    if (__DEV__) {
      try { 
        LogBox.ignoreAllLogs(true); 
      } catch {
        // Ignore
      }
    }
    
    // Initialize critical offline services
    (async () => {
      try {
        // Initialize crypto and queue systems
        await ensureCryptoReady();
        await ensureQueueReady();
        
        // Initialize RevenueCat (subscriptions)
        await initializeRevenueCat();
        
        // Initialize premium status (IAP check and restore)
        await premiumInitService.initialize();
        
        // Start watchdogs (BLE monitoring, location tracking, battery management)
        startWatchdogs();

        // Start offline sync manager
        await offlineSyncManager.start();

        // Start advanced battery manager
        await advancedBatteryManager.start();

        // Start military-grade security
        await militaryGradeSecurity.initialize();

        // Start advanced location manager
        await advancedLocationManager.start();

        // Start network intelligence engine
        await networkIntelligenceEngine.initialize();

        // Start disaster recovery manager
        await disasterRecoveryManager.initialize();

        if (__DEV__) {
          console.log('AfetNet - Sistemler başlatıldı');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('AfetNet - Servis başlatma hatası:', error);
        }
      }
    })();

    // Cleanup function
    return () => {
      Promise.all([
        offlineSyncManager.stop(),
        advancedBatteryManager.stop(),
        militaryGradeSecurity.stop?.(),
        advancedLocationManager.stop(),
        networkIntelligenceEngine.stop?.(),
        disasterRecoveryManager.stop?.(),
      ]).catch(error => {
        if (__DEV__) {
          console.error('Failed to stop services:', error);
        }
      });
    };
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SettingsInitializer />
          <NotificationInitializer />
          <ComprehensiveFeaturesInitializer />
          <EarthquakeWarningModal />
          <AppNavigator />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}