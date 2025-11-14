/**
 * BACKGROUND WAVE MONITORING TASK
 * CRITICAL: Continuous P and S wave monitoring in background
 * This ensures users receive early warnings even when app is closed
 * 
 * ELITE: Safe module loading with graceful fallbacks
 */

import { createLogger } from '../core/utils/logger';
import { useEarthquakeStore } from '../core/stores/earthquakeStore';
import { eliteWaveCalculationService } from '../core/services/EliteWaveCalculationService';
import { multiChannelAlertService } from '../core/services/MultiChannelAlertService';

const logger = createLogger('BgWaveMonitoring');
const TASK = 'BG_WAVE_MONITORING';

// CRITICAL: Store last alert times to prevent spam
const LAST_ALERT_KEY = '@afetnet:last_wave_alert';
const MIN_ALERT_INTERVAL = 30 * 1000; // 30 seconds minimum between alerts

interface LastAlertData {
  earthquakeId: string;
  timestamp: number;
}

// Module state
let modulesLoaded = false;
let taskDefined = false;

/**
 * ELITE: Load required modules dynamically
 * Prevents "Cannot find module" errors in some environments
 */
async function loadModules() {
  if (modulesLoaded) {
    return true;
  }

  try {
    // Try to load all required modules
    const [
      BackgroundFetchModule,
      TaskManagerModule,
      LocationModule,
      NetInfoModule,
      AsyncStorageModule,
    ] = await Promise.all([
      import('expo-background-fetch').catch(() => null),
      import('expo-task-manager').catch(() => null),
      import('expo-location').catch(() => null),
      import('@react-native-community/netinfo').catch(() => null),
      import('@react-native-async-storage/async-storage').catch(() => null),
    ]);

    // Check if all critical modules are available
    if (!TaskManagerModule || !BackgroundFetchModule) {
      logger.debug('Background task modules not available - skipping registration');
      return false;
    }

    // Store modules globally for task function
    (globalThis as any).__BG_WAVE_MODULES__ = {
      BackgroundFetch: BackgroundFetchModule,
      TaskManager: TaskManagerModule,
      Location: LocationModule,
      NetInfo: NetInfoModule?.default || NetInfoModule,
      AsyncStorage: AsyncStorageModule?.default || AsyncStorageModule,
    };

    modulesLoaded = true;
    return true;
  } catch (error) {
    logger.debug('Failed to load background task modules:', error);
    return false;
  }
}

/**
 * Background task handler
 * CRITICAL: This runs in background context
 */
async function backgroundTaskHandler() {
  try {
    const modules = (globalThis as any).__BG_WAVE_MODULES__;
    if (!modules) {
      return 'failed';
    }

    const { BackgroundFetch, NetInfo, Location, AsyncStorage } = modules;

    logger.info('Background wave monitoring task started');

    // Check network
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      logger.debug('No network - skipping wave monitoring');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Get user location
    let userLocation: { latitude: number; longitude: number } | null = null;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          maximumAge: 60000, // Accept location up to 1 minute old
        });
        userLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      }
    } catch (error) {
      logger.debug('Failed to get location in background:', error);
    }

    // If no location, try to get from cache
    if (!userLocation) {
      try {
        const cachedLocation = await AsyncStorage.getItem('@afetnet:last_location');
        if (cachedLocation) {
          userLocation = JSON.parse(cachedLocation);
        }
      } catch (error) {
        logger.debug('Failed to get cached location:', error);
      }
    }

    if (!userLocation) {
      logger.debug('No user location available - skipping wave monitoring');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Save location to cache for next time
    try {
      await AsyncStorage.setItem('@afetnet:last_location', JSON.stringify(userLocation));
    } catch (error) {
      logger.debug('Failed to cache location:', error);
    }

    // Get recent earthquakes (last 1 hour, magnitude >= 3.0)
    const now = Date.now();
    const earthquakes = useEarthquakeStore.getState().items;
    const recentEarthquakes = earthquakes
      .filter((eq) => {
        const age = now - eq.time;
        return age < 60 * 60 * 1000 && eq.magnitude >= 3.0; // Last 1 hour
      })
      .slice(0, 5); // Limit to 5 most recent

    if (recentEarthquakes.length === 0) {
      logger.debug('No recent earthquakes found');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Load last alert data
    let lastAlerts: Record<string, LastAlertData> = {};
    try {
      const stored = await AsyncStorage.getItem(LAST_ALERT_KEY);
      if (stored) {
        lastAlerts = JSON.parse(stored);
      }
    } catch (error) {
      logger.debug('Failed to load last alerts:', error);
    }

    let hasNewAlerts = false;

    // Calculate waves for each earthquake
    for (const earthquake of recentEarthquakes) {
      try {
        // Check if we already alerted for this earthquake recently
        const lastAlert = lastAlerts[earthquake.id];
        if (lastAlert && (now - lastAlert.timestamp) < MIN_ALERT_INTERVAL) {
          continue; // Skip - already alerted recently
        }

        // Calculate P and S wave arrival times
        const calculation = await eliteWaveCalculationService.calculateWaves(
          {
            latitude: earthquake.latitude,
            longitude: earthquake.longitude,
            depth: earthquake.depth,
            magnitude: earthquake.magnitude,
            originTime: earthquake.time,
            source: earthquake.source,
          },
          userLocation
        );

        if (!calculation) {
          continue;
        }

        // Calculate elapsed time since earthquake
        const elapsed = (now - earthquake.time) / 1000; // seconds
        const timeUntilSWave = calculation.sWaveArrivalTime - elapsed;
        const timeUntilPWave = calculation.pWaveArrivalTime - elapsed;

        // CRITICAL: Alert if S-wave is arriving soon (within 30 seconds) or has arrived
        if (timeUntilSWave <= 30 && timeUntilSWave >= -10) {
          // S-wave arriving or just arrived
          const urgency = timeUntilSWave > 0 ? 'critical' : 'high';
          
          // Send multi-channel alert
          try {
            await multiChannelAlertService.sendAlert({
              title: '🚨 S-DALGA UYARISI',
              body: timeUntilSWave > 0
                ? `S-dalga ${Math.round(timeUntilSWave)} saniye içinde gelecek!`
                : 'S-dalga geldi - Sarsıntı başladı!',
              priority: urgency,
              channels: {
                pushNotification: true,
                fullScreenAlert: true,
                alarmSound: true,
                vibration: true,
                tts: true,
              },
              data: {
                type: 's_wave_alert',
                earthquakeId: earthquake.id,
                timeUntilSWave: Math.round(timeUntilSWave),
                magnitude: earthquake.magnitude,
                location: earthquake.location,
              },
            });

            // Update last alert time
            lastAlerts[earthquake.id] = {
              earthquakeId: earthquake.id,
              timestamp: now,
            };
            hasNewAlerts = true;

            logger.info(`S-wave alert sent: ${Math.round(timeUntilSWave)}s until arrival`);
          } catch (alertError) {
            logger.error('Failed to send S-wave alert:', alertError);
          }
        }
        // CRITICAL: Alert if P-wave is arriving soon (within 10 seconds) and S-wave hasn't arrived yet
        else if (timeUntilPWave <= 10 && timeUntilPWave > 0 && timeUntilSWave > 5) {
          // P-wave arriving soon - early warning
          try {
            await multiChannelAlertService.sendAlert({
              title: '⚠️ P-DALGA TESPİT EDİLDİ',
              body: `P-dalga ${Math.round(timeUntilPWave)} saniye içinde gelecek. S-dalga ${Math.round(timeUntilSWave)} saniye sonra gelecek!`,
              priority: 'high',
              channels: {
                pushNotification: true,
                fullScreenAlert: false, // Don't interrupt for P-wave
                alarmSound: false,
                vibration: true,
                tts: true,
              },
              data: {
                type: 'p_wave_alert',
                earthquakeId: earthquake.id,
                timeUntilPWave: Math.round(timeUntilPWave),
                timeUntilSWave: Math.round(timeUntilSWave),
                magnitude: earthquake.magnitude,
                location: earthquake.location,
              },
            });

            // Update last alert time
            lastAlerts[earthquake.id] = {
              earthquakeId: earthquake.id,
              timestamp: now,
            };
            hasNewAlerts = true;

            logger.info(`P-wave alert sent: ${Math.round(timeUntilPWave)}s until arrival`);
          } catch (alertError) {
            logger.error('Failed to send P-wave alert:', alertError);
          }
        }
      } catch (error) {
        logger.error(`Failed to process earthquake ${earthquake.id}:`, error);
      }
    }

    // Save updated last alerts
    if (hasNewAlerts) {
      try {
        await AsyncStorage.setItem(LAST_ALERT_KEY, JSON.stringify(lastAlerts));
      } catch (error) {
        logger.debug('Failed to save last alerts:', error);
      }
    }

    // Clean up old alerts (older than 1 hour)
    const cleanedAlerts: Record<string, LastAlertData> = {};
    for (const [id, alert] of Object.entries(lastAlerts)) {
      if (now - alert.timestamp < 60 * 60 * 1000) {
        cleanedAlerts[id] = alert;
      }
    }
    if (Object.keys(cleanedAlerts).length !== Object.keys(lastAlerts).length) {
      try {
        await AsyncStorage.setItem(LAST_ALERT_KEY, JSON.stringify(cleanedAlerts));
      } catch (error) {
        logger.debug('Failed to clean old alerts:', error);
      }
    }

    logger.info('Background wave monitoring completed');
    return hasNewAlerts
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    logger.error('Background wave monitoring error:', error);
    const modules = (globalThis as any).__BG_WAVE_MODULES__;
    return modules?.BackgroundFetch?.BackgroundFetchResult?.Failed || 'failed';
  }
}

/**
 * Register background wave monitoring task
 * CRITICAL: This runs continuously in background
 */
export async function registerBgWaveMonitoring() {
  try {
    // Load modules first
    const loaded = await loadModules();
    if (!loaded) {
      logger.debug('Background wave monitoring modules not available - skipping registration');
      return;
    }

    const modules = (globalThis as any).__BG_WAVE_MODULES__;
    const { TaskManager, BackgroundFetch } = modules;

    // Define task if not already defined
    if (!taskDefined) {
      try {
        TaskManager.defineTask(TASK, backgroundTaskHandler);
        taskDefined = true;
        logger.debug('Background wave monitoring task defined');
      } catch (defineError: any) {
        const errorMsg = defineError?.message || String(defineError);
        if (errorMsg.includes('already defined')) {
          taskDefined = true;
          logger.debug('Background wave monitoring task already defined');
        } else {
          throw defineError;
        }
      }
    }

    // Check if task is already registered
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK);
      if (isRegistered) {
        logger.debug('Background wave monitoring already registered');
        return;
      }
    } catch (checkError) {
      // isTaskRegisteredAsync may not be available in all environments
      logger.debug('Could not check task registration status:', checkError);
    }

    // Register the task
    // CRITICAL: Minimum interval set to 5 seconds for continuous P/S wave monitoring
    // System may throttle to 15 seconds minimum, but we request 5s for maximum responsiveness
    await BackgroundFetch.registerTaskAsync(TASK, {
      minimumInterval: 5, // 5 seconds (system may throttle to minimum 15 seconds, but we request 5s)
      stopOnTerminate: false, // Continue after app termination - CRITICAL for continuous monitoring
      startOnBoot: true, // Start on device boot - CRITICAL for continuous monitoring
    });

    logger.info('✅ Background wave monitoring registered successfully');
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    // ELITE: Don't log as error - this is expected in some environments (Expo Go, etc.)
    if (errorMessage.includes('Cannot find module') || errorMessage.includes('not available')) {
      logger.debug('Background wave monitoring not available in this environment');
    } else {
      logger.warn('Failed to register background wave monitoring:', errorMessage);
    }
    // Don't throw - app continues without background monitoring
  }
}

/**
 * Unregister background wave monitoring task
 */
export async function unregisterBgWaveMonitoring() {
  try {
    const modules = (globalThis as any).__BG_WAVE_MODULES__;
    if (!modules) {
      return;
    }

    const { TaskManager, BackgroundFetch } = modules;

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK);
      if (!isRegistered) {
        return;
      }
    } catch (checkError) {
      // Continue anyway
    }

    await BackgroundFetch.unregisterTaskAsync(TASK);
    logger.info('Background wave monitoring unregistered');
  } catch (error) {
    logger.debug('Failed to unregister background wave monitoring:', error);
  }
}
