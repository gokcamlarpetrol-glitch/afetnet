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
import { setEEWFeedConfig, startEEW } from './src/eew/feed';
import CountdownModal from './src/eew/CountdownModal';
import { useEEWListener } from './src/eew/useEEW';
import Constants from 'expo-constants';
import { ensureNativeAlarmChannel, initBackgroundMessaging } from './src/native/NativeAlarm';
import { FEATURES } from './src/config/flags';

export default function App() {
  const EEW_ENABLED = (Constants?.expoConfig as any)?.extra?.EEW_ENABLED === true || process.env.EEW_ENABLED === 'true';
  const EEW_NATIVE_ALARM = (Constants?.expoConfig as any)?.extra?.EEW_NATIVE_ALARM === true || process.env.EEW_NATIVE_ALARM === 'true';
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

        if (EEW_ENABLED) {
          // Configure and start Early Earthquake Warning (EEW) feeds
          // Auto-detection of region-based WS will happen in startEEW()
          setEEWFeedConfig({
            WS_URLS: [], // Manual WS URLs (if any)
            POLL_URLS: [
              'https://deprem.afad.gov.tr/EventService/GetEventsByFilter',
              'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=200'
            ],
            POLL_INTERVAL_SEC: 30,
            // Region-based WS URLs (will be auto-selected based on user location)
            EEW_WS_TR_PRIMARY: process.env.EEW_WS_TR_PRIMARY || (Constants?.expoConfig as any)?.extra?.EEW_WS_TR_PRIMARY,
            EEW_WS_TR_FALLBACK: process.env.EEW_WS_TR_FALLBACK || (Constants?.expoConfig as any)?.extra?.EEW_WS_TR_FALLBACK,
            EEW_WS_GLOBAL_PRIMARY: process.env.EEW_WS_GLOBAL_PRIMARY || (Constants?.expoConfig as any)?.extra?.EEW_WS_GLOBAL_PRIMARY,
            EEW_WS_GLOBAL_FALLBACK: process.env.EEW_WS_GLOBAL_FALLBACK || (Constants?.expoConfig as any)?.extra?.EEW_WS_GLOBAL_FALLBACK,
            EEW_PROXY_WS: process.env.EEW_PROXY_WS || (Constants?.expoConfig as any)?.extra?.EEW_PROXY_WS,
          });
          await startEEW();
          if (EEW_NATIVE_ALARM) {
            await ensureNativeAlarmChannel();
            initBackgroundMessaging();
          }
        }

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
  // EEW push listener only if enabled
  if (EEW_ENABLED) { useEEWListener(); }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SettingsInitializer />
          <NotificationInitializer />
          {FEATURES.comprehensiveFeatures ? <ComprehensiveFeaturesInitializer /> : null}
          <EarthquakeWarningModal />
          {EEW_ENABLED ? <CountdownModal /> : null}
          <AppNavigator />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}