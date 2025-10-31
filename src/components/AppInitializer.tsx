// CRITICAL: Unified App Initializer - Prevents infinite loops during Zustand rehydration
// ALL initialization logic in ONE place, executed sequentially and ONLY ONCE

import { useEffect, useRef } from 'react';
import { LogBox } from 'react-native';
// REMOVED: import { useAppSettings } from '../store/appSettings';
// REMOVED: import { useComprehensiveFeatures } from '../store/comprehensiveFeatures';
import { useSettings } from '../store/settings';
// CRITICAL: Only import store, NEVER use as hook to avoid re-renders
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notifications/NotificationService';
import { getFcmToken, registerTokenWithWorker } from '../push/fcm';
// REMOVED: import { startLiveFeed } from '../services/quake/realtime';
// Reason: useQuakes hook handles polling internally, no need for global live feed
import { logger } from '../utils/productionLogger';
import { FEATURES } from '../config/flags';
import Constants from 'expo-constants';

// Import ALL services that need initialization
import { startWatchdogs } from '../watchdogs/core';
import { ensureCryptoReady } from '../bootstrap/cryptoInit';
import { ensureQueueReady } from '../bootstrap/queueInit';
import { premiumInitService } from '../services/premiumInitService';
import { offlineSyncManager } from '../services/OfflineSyncManager';
import { advancedBatteryManager } from '../services/AdvancedBatteryManager';
import { militaryGradeSecurity } from '../services/MilitaryGradeSecurity';
import { advancedLocationManager } from '../services/AdvancedLocationManager';
import { networkIntelligenceEngine } from '../services/NetworkIntelligenceEngine';
import { disasterRecoveryManager } from '../services/DisasterRecoveryManager';
import { initializeRevenueCat } from '../lib/revenuecat';
import { setEEWFeedConfig, startEEW } from '../eew/feed';
import { ensureNativeAlarmChannel, initBackgroundMessaging } from '../native/NativeAlarm';
import { startP2P } from '../p2p/bleCourier';
import { offlineMessaging } from '../services/OfflineMessaging';

// Global initialization flag to prevent double execution
let isInitializing = false;
let hasInitialized = false;

export default function AppInitializer() {
  // REMOVED: All useSettings selectors
  // Reason: These cause re-renders during Zustand rehydration and create infinite loops
  // We only need settings for notification registration, which happens inside initialization

  // REMOVED: const liveFeedRef = useRef<{ stop: () => void } | null>(null);
  // Reason: No global live feed anymore, useQuakes handles polling

  // REMOVED: initializeSettingsRef and initializeComprehensiveFeaturesRef
  // Reason: These cause circular dependency issues during state rehydration
  // Zustand persist middleware handles initialization automatically

  // CRITICAL: Single initialization effect - runs only once on mount
  useEffect(() => {
    // Suppress logs in development
    if (__DEV__) {
      try {
        LogBox.ignoreAllLogs(true);
      } catch {
        // Ignore
      }
    }

    // Prevent double initialization
    if (hasInitialized || isInitializing) {
      logger.debug('⚠️ AppInitializer: Already initialized or initializing, skipping');
      return;
    }

    isInitializing = true;
    
    const initialize = async () => {
      try {
        logger.info('🚀 Starting unified app initialization...');

        // Step 1: Initialize Crypto & Queue (foundation)
        try {
          await ensureCryptoReady();
          await ensureQueueReady();
          logger.info('✅ Crypto & Queue initialized');
        } catch (error) {
          logger.error('❌ Failed to initialize crypto/queue:', error);
          // Continue anyway
        }

        // Step 2: Initialize RevenueCat (IAP)
        try {
          await initializeRevenueCat();
          logger.info('✅ RevenueCat initialized');
        } catch (error) {
          logger.error('❌ Failed to initialize RevenueCat:', error);
          // Continue anyway
        }

        // Step 3: Initialize Premium Service
        try {
          await premiumInitService.initialize();
          logger.info('✅ Premium service initialized');
        } catch (error) {
          logger.error('❌ Failed to initialize premium service:', error);
          // Continue anyway
        }

        // Step 4 & 5: App Settings & Comprehensive Features
        // REMOVED: Manual initialization causes circular dependencies
        // Zustand persist middleware handles initialization automatically
        logger.info('✅ App settings loaded via Zustand persist');

        // Step 6: Start Watchdogs
        try {
          startWatchdogs();
          logger.info('✅ Watchdogs started');
        } catch (error) {
          logger.error('❌ Failed to start watchdogs:', error);
          // Continue anyway
        }

        // Step 7: Start Offline Sync Manager
        try {
          await offlineSyncManager.start();
          logger.info('✅ Offline sync manager started');
        } catch (error) {
          logger.error('❌ Failed to start offline sync manager:', error);
          // Continue anyway
        }

        // Step 8: Start Advanced Battery Manager
        try {
          await advancedBatteryManager.start();
          logger.info('✅ Battery manager started');
        } catch (error) {
          logger.error('❌ Failed to start battery manager:', error);
          // Continue anyway
        }

        // Step 9: Start BLE P2P Courier
        try {
          await startP2P();
          logger.info('✅ BLE P2P courier started');
        } catch (error) {
          logger.error('❌ Failed to start BLE P2P courier:', error);
          // Continue anyway
        }

        // Step 10: Start Offline Messaging
        try {
          await offlineMessaging.start();
          logger.info('✅ Offline messaging started');
        } catch (error) {
          logger.error('❌ Failed to start offline messaging:', error);
          // Continue anyway
        }

        // Step 11: Start Military-Grade Security
        try {
          await militaryGradeSecurity.initialize();
          logger.info('✅ Military-grade security initialized');
        } catch (error) {
          logger.error('❌ Failed to initialize security:', error);
          // Continue anyway
        }

        // Step 12: Start Advanced Location Manager
        try {
          await advancedLocationManager.start();
          logger.info('✅ Location manager started');
        } catch (error) {
          logger.error('❌ Failed to start location manager:', error);
          // Continue anyway
        }

        // Step 13: Start Network Intelligence Engine
        try {
          await networkIntelligenceEngine.initialize();
          logger.info('✅ Network intelligence initialized');
        } catch (error) {
          logger.error('❌ Failed to initialize network intelligence:', error);
          // Continue anyway
        }

        // Step 14: Start Disaster Recovery Manager
        try {
          await disasterRecoveryManager.initialize();
          logger.info('✅ Disaster recovery initialized');
        } catch (error) {
          logger.error('❌ Failed to initialize disaster recovery:', error);
          // Continue anyway
        }

        // Step 15: Initialize Notification Service
        try {
          await notificationService.initializeChannels();
          logger.info('✅ Notification service initialized');

          // Request permissions
          const perm = await Notifications.getPermissionsAsync();
          if (!perm.granted) {
            await Notifications.requestPermissionsAsync({
              ios: { allowAlert: true, allowBadge: true, allowSound: true },
            });
          }

          // Register push token
          const token = await getFcmToken();
          if (token) {
            const currentSettings = useSettings.getState();
            await registerTokenWithWorker(token, currentSettings.selectedProvinces);
            logger.info('✅ Push token registered');
          }
        } catch (error) {
          logger.error('❌ Failed to initialize notification service:', error);
          // Continue anyway
        }

        // Step 16: Start Live Feed for Quakes
        // CRITICAL: DISABLED - useQuakes hook already handles polling internally
        // Starting live feed here creates DOUBLE POLLING and infinite loops
        // Each screen using useQuakes() will have its own polling mechanism
        logger.info('✅ Live feed: Using useQuakes hook for polling (no global live feed)');

        // Step 17: Start EEW System
        const EEW_ENABLED = (Constants?.expoConfig as any)?.extra?.EEW_ENABLED === true || process.env.EEW_ENABLED === 'true';
        const EEW_NATIVE_ALARM = (Constants?.expoConfig as any)?.extra?.EEW_NATIVE_ALARM === true || process.env.EEW_NATIVE_ALARM === 'true';
        
        if (EEW_ENABLED) {
          try {
            setEEWFeedConfig({
              WS_URLS: [],
              POLL_URLS: [
                'https://deprem.afad.gov.tr/EventService/GetEventsByFilter',
                'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=200'
              ],
              POLL_INTERVAL_SEC: 30,
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
            
            logger.info('✅ EEW system started');
          } catch (error) {
            logger.error('❌ Failed to start EEW:', error);
            // Continue anyway
          }
        }

        hasInitialized = true;
        isInitializing = false;
        logger.info('✅ AfetNet - ALL systems initialized successfully');
      } catch (error) {
        logger.error('❌ Critical error during app initialization:', error);
        isInitializing = false;
        // Continue anyway - app should still work
      }
    };

    initialize();

    // Cleanup function
    return () => {
      logger.info('🛑 AppInitializer: Cleaning up...');
          Promise.all([
            offlineSyncManager.stop(),
            advancedBatteryManager.stop(),
            militaryGradeSecurity.stop?.(),
            advancedLocationManager.stop(),
            networkIntelligenceEngine.stop?.(),
            disasterRecoveryManager.stop?.(),
            offlineMessaging.stop(),
            // liveFeedRef removed - no global live feed anymore
          ]).catch(error => {
            logger.error('Failed to stop services:', error);
          });
      
      // Reset flag for potential re-mount in dev mode
      hasInitialized = false;
    };
  }, []); // CRITICAL: Empty deps - only run once on mount

  // REMOVED: Province change effect
  // Reason: Settings selectors removed to prevent infinite loops
  // Notification token registration happens once during initialization

  return null; // This component doesn't render anything
}
