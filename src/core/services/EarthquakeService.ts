/**
 * EARTHQUAKE SERVICE - ELITE MODULAR IMPLEMENTATION
 * Fetches earthquake data from AFAD/USGS/Kandilli and updates store
 * Refactored into modular components for maintainability
 */

import { useEarthquakeStore, Earthquake } from '../stores/earthquakeStore';
import { createLogger } from '../utils/logger';
import { formatToTurkishDateTime, getTimeDifferenceTurkish } from '../utils/timeUtils';
import { earthquakeValidationService } from '../ai/services/EarthquakeValidationService';
import { parseAFADDate } from '../utils/timeUtils';
import { loadFromCache, saveToCache } from './earthquake/EarthquakeCacheManager';
import { fetchAllEarthquakes, fetchFromAFADAPI, fetchFromKandilliAPI } from './earthquake/EarthquakeFetcher';
import { filterByTurkeyBounds } from './earthquake/EarthquakeDataProcessor';
import { deduplicateEarthquakes } from './earthquake/EarthquakeDeduplicator';
import { useSettingsStore } from '../stores/settingsStore';
// import { processEarthquakeNotifications } from './earthquake/EarthquakeNotificationHandler'; // Removed to break circular dependency

const logger = createLogger('EarthquakeService');

// ELITE: Type-safe error helpers
const getErrorMessage = (e: unknown): string => e instanceof Error ? e.message : String(e);
const getErrorName = (e: unknown): string => e instanceof Error ? e.name : 'UnknownError';
const getErrorStack = (e: unknown): string | undefined => e instanceof Error ? e.stack : undefined;

// ELITE: 60 seconds polling - optimal balance between freshness and resource efficiency
// 5-second polling caused memory exhaustion (heap out of memory)
// 60-second interval still provides near-real-time data while preventing:
// - Memory leaks from overlapping fetch requests
// - Network saturation and timeouts
// - Battery drain on mobile devices
const POLL_INTERVAL = 60000; // 60 seconds
const LAST_CHECKED_KEY = 'last_checked_earthquake';

class EarthquakeService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isFetching = false; // Mutex to prevent concurrent fetches

  async start() {
    if (this.isRunning) return;

    const settings = useSettingsStore.getState();
    if (!settings.earthquakeMonitoringEnabled) {
      if (__DEV__) {
        logger.info('ℹ️ Earthquake monitoring is disabled in settings; service start skipped');
      }
      return;
    }

    // Initialize AI validation service for real-time data validation
    await earthquakeValidationService.initialize();

    this.isRunning = true;

    // ELITE: Load cache FIRST for instant display (0-1 second)
    const store = useEarthquakeStore.getState();
    const cached = await loadFromCache();
    if (cached && cached.length > 0) {
      store.setItems(cached);
      store.setLoading(false);
      if (__DEV__) {
        logger.info(`⚡ Başlangıç: Cache'den ${cached.length} deprem verisi anlık yüklendi (0-1 saniye)`);
      }
    }

    // ELITE: Immediate fetch (no delay) - get fresh data ASAP
    // CRITICAL: Fetch immediately without waiting - parallel execution
    // Initial fetch with error handling (runs in background, updates when ready)
    this.fetchEarthquakes().catch((error) => {
      logger.error('Initial earthquake fetch failed:', error);
      // Continue anyway - polling will retry
    });

    // ELITE: Start polling for real-time earthquake updates
    // Polls every 60 seconds (POLL_INTERVAL) to balance freshness and battery life
    this.intervalId = setInterval(() => {
      // CRITICAL: Handle async errors in interval callback
      this.fetchEarthquakes().catch((error) => {
        logger.error('Error in earthquake polling interval:', error);
      });
    }, POLL_INTERVAL);

    if (__DEV__) {
      logger.info(`✅ Earthquake polling started: ${POLL_INTERVAL}ms interval (${POLL_INTERVAL / 1000}s)`);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * ELITE: Public getter for isRunning status (used by init.ts health check)
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  async fetchEarthquakes() {
    // ELITE: Mutex lock to prevent concurrent fetches
    // This prevents memory buildup from overlapping requests
    if (this.isFetching) {
      if (__DEV__) {
        logger.debug('⏳ [FETCH] Zaten devam eden fetch var - atlanıyor');
      }
      return;
    }

    this.isFetching = true;

    const store = useEarthquakeStore.getState();
    const settings = useSettingsStore.getState();

    if (!settings.earthquakeMonitoringEnabled) {
      if (__DEV__) {
        logger.debug('Deprem izleme ayarlarda kapalı; fetch atlandı');
      }
      store.setLoading(false);
      this.isFetching = false;
      return;
    }

    // ELITE: Don't load cache here - already loaded in start() for instant display
    // This prevents duplicate cache loading and ensures fresh data is fetched
    // Only set loading state if no data is currently displayed
    if (store.items.length === 0) {
      store.setLoading(true);
    }

    store.setError(null); // Clear previous errors

    try {
      // ═══════════════════════════════════════════════════════════════════
      // ELITE BULLETPROOF DATA FETCH - STEP 1: FETCH FROM ALL SOURCES
      // ═══════════════════════════════════════════════════════════════════
      if (__DEV__) {
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.info(`🚀 [FETCH] Deprem verisi çekiliyor...`);
      }

      const fetchResult = await fetchAllEarthquakes(
        {
          sourceAFAD: settings.sourceAFAD,
          sourceKOERI: settings.sourceKOERI,
          sourceUSGS: settings.sourceUSGS,
          sourceEMSC: settings.sourceEMSC,
          sourceCommunity: settings.sourceCommunity,
          selectedObservatory: settings.selectedObservatory,
        },
        () => fetchFromAFADAPI(),
        () => fetchFromKandilliAPI(),
      );

      let earthquakes = fetchResult.earthquakes;

      if (__DEV__) {
        logger.info(`📊 [FETCH] Toplam: ${earthquakes.length} deprem alındı`);
        logger.info(`   ├─ Kaynak tercihi: ${settings.selectedObservatory}`);
        logger.info(`   ├─ AFAD HTML: ${fetchResult.sources.afadHTML ? '✅' : '❌'}`);
        logger.info(`   ├─ AFAD API: ${fetchResult.sources.afadAPI ? '✅' : '❌'}`);
        logger.info(`   ├─ Kandilli: ${fetchResult.sources.kandilliAPI ? '✅' : '❌'}`);
        logger.info(`   └─ Unified fallback: ${fetchResult.sources.unified ? '✅' : '❌'}`);
      }

      // ═══════════════════════════════════════════════════════════════════
      // FAIL-SAFE: If no data fetched, keep existing cache and return
      // ═══════════════════════════════════════════════════════════════════
      if (earthquakes.length === 0) {
        if (__DEV__) {
          logger.warn(`⚠️ [FETCH] Hiç veri alınamadı - mevcut cache korunuyor`);
        }
        // Don't clear existing data - keep what we have
        store.setLoading(false);
        return;
      }

      // ═══════════════════════════════════════════════════════════════════
      // STEP 2: FILTER & DEDUPLICATE
      // ═══════════════════════════════════════════════════════════════════
      const afadEarthquakes = earthquakes.filter(eq => eq.source === 'AFAD');
      const nonAfadEarthquakes = earthquakes.filter(eq => eq.source !== 'AFAD');
      const filteredNonAfad = filterByTurkeyBounds(nonAfadEarthquakes);
      const turkeyEarthquakes = [...afadEarthquakes, ...filteredNonAfad];
      const uniqueEarthquakes = deduplicateEarthquakes(turkeyEarthquakes);

      if (__DEV__) {
        logger.info(`📍 [FILTER] ${earthquakes.length} → ${uniqueEarthquakes.length} deprem (deduplicate sonrası)`);
      }

      // ═══════════════════════════════════════════════════════════════════
      // STEP 3: AI VALIDATION (WITH FAIL-SAFE)
      // ═══════════════════════════════════════════════════════════════════
      let finalEarthquakes = uniqueEarthquakes;

      if (uniqueEarthquakes.length > 0) {
        try {
          if (__DEV__) {
            logger.info(`🔍 [VALIDATE] AI doğrulama başlatılıyor: ${uniqueEarthquakes.length} deprem`);
          }

          const afadList = uniqueEarthquakes.filter(eq => eq.source === 'AFAD');
          const kandilliList = uniqueEarthquakes.filter(eq => eq.source === 'KANDILLI');

          const validationResult = await earthquakeValidationService.validateBatch(
            uniqueEarthquakes,
            { afad: afadList, kandilli: kandilliList },
          );

          if (__DEV__) {
            logger.info(`✅ [VALIDATE] ${validationResult.valid.length} geçerli, ${validationResult.invalid.length} geçersiz`);
          }

          // FAIL-SAFE: If validation returns empty, use raw data
          if (validationResult.valid.length > 0) {
            finalEarthquakes = validationResult.valid;
          } else {
            if (__DEV__) {
              logger.warn(`⚠️ [VALIDATE] AI tüm verileri reddetti - RAW veri kullanılıyor`);
            }
            // Keep uniqueEarthquakes as finalEarthquakes (already set)
          }
        } catch (validationError) {
          // FAIL-SAFE: If validation throws, use raw data
          if (__DEV__) {
            logger.warn(`⚠️ [VALIDATE] AI doğrulama hatası - RAW veri kullanılıyor:`, getErrorMessage(validationError));
          }
          // Keep uniqueEarthquakes as finalEarthquakes (already set)
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // STEP 4: SORT & UPDATE STORE
      // ═══════════════════════════════════════════════════════════════════
      finalEarthquakes.sort((a, b) => b.time - a.time);

      if (__DEV__) {
        logger.info(`🔄 [STORE] Güncelleniyor: ${finalEarthquakes.length} deprem`);
        if (finalEarthquakes.length > 0 && finalEarthquakes[0]) {
          const latest = finalEarthquakes[0];
          logger.info(`🔝 [STORE] En son: ${latest.location} - ${latest.magnitude} ML`);
        }
      }

      store.setItems(finalEarthquakes);
      await saveToCache(finalEarthquakes);
      store.setLoading(false);

      if (__DEV__) {
        logger.info(`✅ [STORE] Güncellendi: ${store.items.length} deprem mevcut`);
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      }

      // CRITICAL: Save earthquakes to Firebase and Backend for rescue coordination
      // ELITE: This ensures rescue teams can track earthquake events
      if (uniqueEarthquakes.length > 0) {
        try {
          const { firebaseDataService } = await import('./FirebaseDataService');
          const { backendEmergencyService } = await import('./BackendEmergencyService');

          // Save significant earthquakes (magnitude >= 4.0) to Firebase and Backend
          const significantEarthquakes = uniqueEarthquakes.filter(eq => eq.magnitude >= 4.0);

          for (const earthquake of significantEarthquakes) {
            // Save to Firebase
            if (firebaseDataService.isInitialized) {
              await firebaseDataService.saveEarthquake({
                id: earthquake.id,
                timestamp: earthquake.time,
                magnitude: earthquake.magnitude,
                depth: earthquake.depth,
                latitude: earthquake.latitude,
                longitude: earthquake.longitude,
                location: earthquake.location,
                source: earthquake.source,
              }).catch((error) => {
                if (__DEV__) {
                  logger.debug('Failed to save earthquake to Firebase:', error);
                }
              });
            }

            // Send to Backend
            if (backendEmergencyService.initialized) {
              await backendEmergencyService.sendEarthquakeData({
                id: earthquake.id,
                timestamp: earthquake.time,
                magnitude: earthquake.magnitude,
                depth: earthquake.depth,
                latitude: earthquake.latitude,
                longitude: earthquake.longitude,
                location: earthquake.location,
                source: earthquake.source,
              }).catch((error) => {
                if (__DEV__) {
                  logger.debug('Failed to send earthquake to backend:', error);
                }
              });
            }
          }
        } catch (error) {
          // ELITE: Don't block earthquake processing if Firebase/Backend save fails
          if (__DEV__) {
            logger.debug('Firebase/Backend save skipped:', error);
          }
        }
      }

      // CRITICAL: Verify lastUpdate was set (happens in setItems)
      if (__DEV__) {
        const storeState = useEarthquakeStore.getState();
        const updateTime = storeState.lastUpdate ? new Date(storeState.lastUpdate).toLocaleTimeString('tr-TR', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) : 'N/A';
        logger.debug(`🔄 Store lastUpdate timestamp: ${updateTime} (${uniqueEarthquakes.length} deprem)`);
      }

      // ELITE: Log latest earthquake for debugging
      if (__DEV__ && uniqueEarthquakes.length > 0) {
        const latest = uniqueEarthquakes[0];
        const latestTime = new Date(latest.time).toLocaleString('tr-TR', {
          timeZone: 'Europe/Istanbul',
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        logger.info(`🔄 Store updated: ${uniqueEarthquakes.length} deprem - En son: ${latest.magnitude} ${latest.magnitude >= 4.0 ? 'MW' : 'ML'} - ${latest.location} - ${latestTime}`);
      } else if (__DEV__) {
        logger.info(`🔄 Store updated: 0 deprem (veri yok veya filtrelendi)`);
      }

      // CRITICAL: Process notifications for new earthquakes
      // ELITE: This handles push notifications, sound alerts, and emergency mode activation
      if (uniqueEarthquakes.length > 0) {
        try {
          const { processEarthquakeNotifications } = await import('./earthquake/EarthquakeNotificationHandler');
          await processEarthquakeNotifications(uniqueEarthquakes, {
            minMagnitudeForNotification: settings.minMagnitudeForNotification,
            maxDistanceForNotification: settings.maxDistanceForNotification,
            criticalMagnitudeThreshold: settings.criticalMagnitudeThreshold,
            criticalDistanceThreshold: settings.criticalDistanceThreshold,
            eewMinMagnitude: settings.eewMinMagnitude,
            eewWarningTime: settings.eewWarningTime,
            priorityCritical: settings.priorityCritical,
            priorityHigh: settings.priorityHigh,
            priorityMedium: settings.priorityMedium,
            priorityLow: settings.priorityLow,
            notificationPush: settings.notificationPush,
          });
        } catch (notificationError) {
          logger.error('Failed to process earthquake notifications:', notificationError);
        }
      } else {
        // No new data - try cache as fallback
        if (__DEV__) {
          logger.warn('⚠️ No new data fetched, trying cache...');
        }
        const cached = await loadFromCache();
        if (cached && cached.length > 0) {
          const { getCacheAge } = await import('./earthquake/EarthquakeCacheManager');
          const cacheAgeMinutes = await getCacheAge();
          if (cacheAgeMinutes !== null) {
            if (__DEV__) {
              logger.warn(`⚠️ Using cache data (${cacheAgeMinutes.toFixed(1)} minutes old)`);
            }
            if (cacheAgeMinutes > 30) {
              store.setError(`Eski veriler gösteriliyor (${Math.floor(cacheAgeMinutes / 60)} saat önce). İnternet bağlantınızı kontrol edin.`);
            }
          }
          store.setItems(cached);
        } else {
          store.setError('Deprem verisi alınamadı. İnternet bağlantınızı kontrol edin.');
        }
      }
    } catch (error: unknown) {
      const errMsg = getErrorMessage(error);
      const errName = getErrorName(error);
      const errStack = getErrorStack(error);

      // Silent fail for network errors - expected in offline scenarios
      if (__DEV__) {
        logger.debug('Earthquake fetch skipped (network error - expected):', {
          error: errMsg,
          name: errName,
          stack: errStack,
        });
      }

      // CRITICAL: Try cache on error - OFFLINE MODE FALLBACK
      // This ensures app works WITHOUT internet connection
      const cached = await loadFromCache();
      if (cached && cached.length > 0) {
        store.setItems(cached);
        store.setLoading(false);
        const { getCacheAge } = await import('./earthquake/EarthquakeCacheManager');
        const cacheAge = await getCacheAge();
        const cacheAgeHours = cacheAge !== null ? cacheAge / 60 : null;
        if (cacheAgeHours !== null && cacheAgeHours > 1) {
          // CRITICAL: Don't show error in offline mode - this is expected behavior
          // Only show warning if cache is very old (> 6 hours)
          if (cacheAgeHours > 6) {
            store.setError(`Eski veriler gösteriliyor (${Math.floor(cacheAgeHours)} saat önce). İnternet bağlantısı yok - offline modda çalışıyorsunuz.`);
          } else {
            // Clear error - offline mode is working correctly
            store.setError(null);
          }
        } else {
          // Clear error - cache is fresh enough
          store.setError(null);
        }
      } else {
        // ELITE: Provide specific error messages
        let errorMessage = 'Deprem verisi alınamadı. Lütfen tekrar deneyin.';

        if (errName === 'AbortError' || errMsg.includes('timeout')) {
          errorMessage = 'Bağlantı zaman aşımına uğradı. İnternet bağlantınızı kontrol edin.';
        } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
          errorMessage = 'İnternet bağlantısı sorunu. Lütfen bağlantınızı kontrol edin.';
        } else if (errMsg.includes('JSON') || errMsg.includes('parse')) {
          errorMessage = 'Veri işleme hatası. Lütfen tekrar deneyin.';
        }

        store.setError(errorMessage);
      }
    } finally {
      store.setLoading(false);
      this.isFetching = false; // Release mutex
    }
  }


  /**
   * Fetch detailed earthquake data from AFAD API
   * Real-time data for Apple compliance
   */
  async fetchEarthquakeDetail(eventID: string): Promise<Earthquake | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Try AFAD API v2 event detail endpoint
      const url = `https://deprem.afad.gov.tr/apiv2/event/${eventID}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // If detail endpoint fails, try to find it in the list
        return await this.findEarthquakeInList(eventID);
      }

      const data = await response.json();

      if (!data) {
        return null;
      }

      // Parse AFAD detail response
      const earthquake: Earthquake = {
        id: `afad-${data.eventID || data.eventId || eventID}`,
        magnitude: parseFloat(data.mag || data.magnitude || data.ml || '0'),
        location: data.location || data.title || data.place || 'Türkiye',
        depth: parseFloat(data.depth || data.derinlik || '10'),
        time: data.eventDate ? parseAFADDate(data.eventDate) : Date.now(),
        latitude: parseFloat(data.geojson?.coordinates?.[1] || data.latitude || data.lat || '0'),
        longitude: parseFloat(data.geojson?.coordinates?.[0] || data.longitude || data.lng || '0'),
        source: 'AFAD' as const,
      };

      return earthquake;
    } catch (error) {
      logger.error('Earthquake detail fetch error:', error);
      // Fallback: Try to find in cached list
      return await this.findEarthquakeInList(eventID);
    }
  }

  /**
   * Find earthquake in cached list by eventID
   */
  private async findEarthquakeInList(eventID: string): Promise<Earthquake | null> {
    try {
      const cached = await loadFromCache();
      if (!cached) return null;

      // Find earthquake with matching eventID
      const earthquake = cached.find(eq => eq.id.includes(eventID));
      return earthquake || null;
    } catch (error) {
      return null;
    }
  }
}

export const earthquakeService = new EarthquakeService();
