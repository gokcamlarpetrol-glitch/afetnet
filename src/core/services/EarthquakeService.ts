/**
 * EARTHQUAKE SERVICE - Clean Implementation
 * Fetches earthquake data from AFAD/USGS/Kandilli and updates store
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { useEarthquakeStore, Earthquake } from '../stores/earthquakeStore';
import { createLogger } from '../utils/logger';
import { autoCheckinService } from './AutoCheckinService';
import { emergencyModeService } from './EmergencyModeService';
import { notificationService } from './NotificationService';
import { seismicSensorService } from './SeismicSensorService';

const logger = createLogger('EarthquakeService');

const CACHE_KEY = 'afetnet_earthquakes_cache';
const LAST_FETCH_KEY = 'afetnet_earthquakes_last_fetch';
// Elite: ULTRA-FAST polling for REAL early warning (deprem olurken yakalama)
const POLL_INTERVAL = 3000; // 3 seconds - Catch earthquakes AS THEY HAPPEN
const CRITICAL_POLL_INTERVAL = 1000; // 1 second for critical earthquakes (6.0+) - MAXIMUM SPEED
const parseAfadDate = (raw?: string): number | null => {
  if (!raw) return null;
  let normalized = raw.trim();
  if (!normalized) return null;

  if (normalized.includes(' ') && !normalized.includes('T')) {
    normalized = normalized.replace(' ', 'T');
  }

  if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }

  let parsed = Date.parse(normalized);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  parsed = Date.parse(`${normalized.replace(/Z$/, '')}+03:00`);
  return Number.isNaN(parsed) ? null : parsed;
};

class EarthquakeService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isFetching = false;
  private lastFetchedAt: number | null = null;
  private appStateListener?: NativeEventSubscription;
  private lastCriticalEarthquakeTime: number = 0;
  private currentPollInterval: number = POLL_INTERVAL;

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // ELITE: Integrate with SeismicSensorService for FIRST-TO-ALERT
    // CRITICAL: Listen to seismic sensor detections - they alert BEFORE API
    this.setupSeismicSensorIntegration();
    
    // Initial fetch - IMMEDIATE
    await this.fetchEarthquakes({ reason: 'initial-start', force: true });
    this.setupAppStateListener();
    
    // Elite: Dynamic polling - faster for critical earthquakes
    void this.startDynamicPolling();
  }
  
  /**
   * ELITE: Integrate with SeismicSensorService for FIRST-TO-ALERT
   * CRITICAL: Seismic sensor detects earthquakes BEFORE API (P-wave detection)
   * This ensures we are FIRST to alert users
   */
  private setupSeismicSensorIntegration() {
    try {
      // Listen to seismic sensor detections
      seismicSensorService.onDetection(async (seismicEvent) => {
        logger.info('🔝 Seismic sensor detected earthquake - FIRST-TO-ALERT integration', {
          magnitude: seismicEvent.estimatedMagnitude,
          confidence: seismicEvent.confidence,
          location: seismicEvent.location,
        });
        
        // CRITICAL: Seismic sensor already sent notification via triggerEEW()
        // But we should also verify with API and update store
        // This ensures users see the earthquake in the list even if API is delayed
        
        if (seismicEvent.location && seismicEvent.confidence > 40) {
          // Create earthquake object from seismic detection
          const earthquake: Earthquake = {
            id: `seismic-${seismicEvent.id}`,
            location: seismicEvent.location 
              ? `${seismicEvent.location.latitude.toFixed(2)}, ${seismicEvent.location.longitude.toFixed(2)}`
              : 'Sensör Algılaması',
            magnitude: seismicEvent.estimatedMagnitude,
            depth: 10, // Estimated
            time: seismicEvent.startTime,
            latitude: seismicEvent.location?.latitude || 0,
            longitude: seismicEvent.location?.longitude || 0,
            source: 'SEISMIC_SENSOR',
          };
          
          // Add to store (for UI display) - safe access
          const store = useEarthquakeStore?.getState?.();
          if (store) {
            const currentEarthquakes = store.items || [];
            
            // Check if already exists (avoid duplicates)
            const exists = currentEarthquakes.find(eq => eq.id === earthquake.id);
            if (!exists) {
              const updated = [earthquake, ...currentEarthquakes].slice(0, 100); // Keep latest 100
              store.setItems(updated);
              logger.info('✅ Seismic detection added to earthquake store');
            }
          } else {
            logger.warn('⚠️ EarthquakeStore not available for seismic detection');
          }
          
          // CRITICAL: Mark as first-to-alert in Firebase
          // This helps backend verify and send to other users
          try {
            const { firebaseDataService } = await import('./FirebaseDataService');
            if (firebaseDataService.isInitialized) {
              // CRITICAL: Save with additional metadata (firstToAlert, confidence)
              // These are not part of Earthquake type but are stored in Firebase
              firebaseDataService.saveEarthquake({
                ...earthquake,
                // @ts-ignore - Additional metadata for Firebase (not part of Earthquake type)
                firstToAlert: true,
                // @ts-ignore
                confidence: seismicEvent.confidence,
              }).catch((error: any) => {
                logger.error('Failed to save seismic detection to Firebase:', error);
              });
            }
          } catch (error) {
            logger.error('Firebase save error:', error);
          }
        }
      });
      
      logger.info('✅ SeismicSensorService integration enabled - FIRST-TO-ALERT active');
    } catch (error) {
      logger.error('Failed to setup seismic sensor integration:', error);
      // Continue without integration - API polling will still work
    }
  }

  /**
   * ELITE: Dynamic polling that adjusts based on recent earthquake activity and battery level
   */
  private async startDynamicPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Check if we had a critical earthquake recently (within last 10 minutes)
    const timeSinceCritical = Date.now() - this.lastCriticalEarthquakeTime;
    const isCriticalPeriod = timeSinceCritical < 10 * 60 * 1000; // 10 minutes

    // Base polling interval based on critical period
    let baseInterval = isCriticalPeriod ? CRITICAL_POLL_INTERVAL : POLL_INTERVAL;
    
    // ELITE: Apply battery-aware multiplier (lazy import to avoid circular dependency)
    try {
      const batteryModule = await import('./BatteryMonitoringService');
      if (batteryModule?.batteryMonitoringService) {
        const multiplier = batteryModule.batteryMonitoringService.getPollingIntervalMultiplier();
        baseInterval = Math.round(baseInterval * multiplier);
        
        // CRITICAL: Never go below 1 second even when charging (safety limit for critical earthquakes)
        baseInterval = Math.max(baseInterval, isCriticalPeriod ? 1000 : 2000);
      }
    } catch {
      // BatteryMonitoringService not available - use base interval
    }
    
    this.currentPollInterval = baseInterval;

    this.intervalId = setInterval(() => {
      // CRITICAL: Always handle errors - never use void for critical operations
      this.fetchEarthquakes({ reason: 'interval' }).catch((error) => {
        logger.error('❌ CRITICAL: Earthquake fetch failed:', error);
        // CRITICAL: Even on error, continue polling - we MUST keep trying
      });
      // Re-evaluate polling interval (check battery changes) - fire and forget
      void this.startDynamicPolling();
    }, this.currentPollInterval);

    if (__DEV__) {
      logger.info(`📡 Polling interval: ${this.currentPollInterval}ms ${isCriticalPeriod ? '(CRITICAL MODE)' : ''}`);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.teardownAppStateListener();
  }

  private setupAppStateListener() {
    this.teardownAppStateListener();
    this.appStateListener = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        // CRITICAL: Always handle errors - never use void for critical operations
        this.fetchEarthquakes({ reason: 'app-foreground', force: true }).catch((error) => {
          logger.error('❌ CRITICAL: Earthquake fetch on foreground failed:', error);
        });
      }
    });
  }

  private teardownAppStateListener() {
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = undefined;
    }
  }

  async fetchEarthquakes(options: { reason?: string; force?: boolean } = {}) {
    // Elite: Allow concurrent fetches during critical periods for faster response
    const isCriticalPeriod = Date.now() - this.lastCriticalEarthquakeTime < 10 * 60 * 1000;
    
    if (this.isFetching && !options.force && !isCriticalPeriod) {
      logger.debug('⏳ Deprem verisi isteği atlandı (önceki istek devam ediyor)', options);
      return;
    }

    const now = Date.now();
    // Elite: More aggressive fetching during critical periods
    const minInterval = isCriticalPeriod ? CRITICAL_POLL_INTERVAL / 2 : POLL_INTERVAL / 2;
    if (!options.force && this.lastFetchedAt && now - this.lastFetchedAt < minInterval) {
      logger.debug('🔁 Deprem verisi yeterince yeni, sorgu atlandı', {
        reason: options.reason,
        lastFetchedAgo: now - this.lastFetchedAt,
        isCriticalPeriod,
      });
      return;
    }

    this.isFetching = true;
    // CRITICAL: Safe store access - check if store exists
    const store = useEarthquakeStore?.getState?.();
    if (!store) {
      logger.error('❌ CRITICAL: EarthquakeStore not available');
      this.isFetching = false; // CRITICAL: Reset flag before returning
      return;
    }
    
    store.setLoading(true);
    store.setError(null); // Clear previous errors

    try {
      logger.info('🌍 Deprem verisi yenileniyor', {
        reason: options.reason ?? 'manual',
      });
      let earthquakes: Earthquake[] = [];

      // ELITE: MULTI-SOURCE VERIFICATION - 6 Kaynak Kontrolü
      // Hayat kurtarmak için en doğru ve en hızlı bilgiyi kullanıcılara veriyoruz

      // 1. AFAD (Turkey - Primary source)
      const afadData = await this.fetchFromAFAD();
      if (afadData.length > 0) {
        earthquakes.push(...afadData);
      }

      // 2. USGS - ACTIVE (Global earthquakes - ücretsiz API, maliyet yok)
      // Türkiye çevresindeki depremler için de önemli (Yunanistan, İran, vb.)
      try {
        const usgsData = await this.fetchFromUSGS();
        if (usgsData.length > 0) {
          // Filter for Turkey region (25-45°N, 25-45°E) or nearby
          const turkeyRegionData = usgsData.filter(eq => 
            eq.latitude >= 25 && eq.latitude <= 45 && 
            eq.longitude >= 25 && eq.longitude <= 45
          );
          if (turkeyRegionData.length > 0) {
            earthquakes.push(...turkeyRegionData);
          }
        }
      } catch (error) {
        logger.warn('USGS fetch failed (non-critical):', error);
        // Continue without USGS - other sources will handle it
      }
      
      // 3. Backend Sources (EMSC + KOERI) - Backend'den al
      // Backend zaten EMSC ve KOERI'yi çekiyor, frontend'e entegre et
      try {
        const backendData = await this.fetchFromBackend();
        if (backendData.length > 0) {
          earthquakes.push(...backendData);
        }
      } catch (error) {
        logger.warn('Backend sources fetch failed (non-critical):', error);
        // Continue without backend sources - other sources will handle it
      }

      // Deduplicate based on similar location and time (within 5 minutes and 10km)
      const uniqueEarthquakes = this.deduplicateEarthquakes(earthquakes);

      // Sort by time (newest first)
      uniqueEarthquakes.sort((a, b) => b.time - a.time);

      if (uniqueEarthquakes.length > 0) {
        // CRITICAL FIX: Use API fetch time for detection, NOT earthquake time
        // AFAD API sometimes delays by 30-60 minutes, so we need to track by API fetch time
        const now = Date.now();
        const lastCheckedEq = await AsyncStorage.getItem('last_checked_earthquake');
        const lastCheckedTime = await AsyncStorage.getItem('last_checked_earthquake_time');
        const lastCheckedTimestamp = lastCheckedTime ? parseInt(lastCheckedTime, 10) : 0;
        
        // CRITICAL: Track seen earthquakes by unique signature (time + location + magnitude)
        // AFAD API returns different IDs for the same earthquake on each fetch, so we use a stable signature
        const seenEarthquakesKey = 'seen_earthquake_signatures';
        const seenSignaturesJson = await AsyncStorage.getItem(seenEarthquakesKey);
        const seenSignatures = seenSignaturesJson ? new Set<string>(JSON.parse(seenSignaturesJson)) : new Set<string>();
        
        // Helper function to create unique signature for an earthquake (same as deduplicateEarthquakes)
        const createEarthquakeSignature = (eq: Earthquake): string => {
          const timeKey = Math.floor(eq.time / (5 * 60 * 1000)); // 5 minute buckets
          const latKey = Math.round(eq.latitude * 100); // ~1km precision
          const lonKey = Math.round(eq.longitude * 100);
          return `${timeKey}-${latKey}-${lonKey}-${Math.round(eq.magnitude * 10)}`;
        };
        
        // CRITICAL: Accept earthquakes that:
        // 1. Have not been seen before (by signature) - PRIMARY CHECK
        // 2. Were fetched AFTER our last API fetch time (catches delayed API responses)
        // 3. OR happened in the last 2 hours (safety net for very delayed responses, but only for first-time detection)
        const RECENT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours window
        const recentThreshold = now - RECENT_WINDOW_MS;
        
        // ELITE: MULTI-SOURCE VERIFICATION - 6 Kaynak Doğrulama
        // Hayat kurtarmak için en doğru bilgiyi kullanıcılara veriyoruz
        // Multi-source verification için tüm kaynakları topla
        
        // Find all NEW earthquakes (not seen before)
        const newEarthquakes = uniqueEarthquakes.filter(eq => {
          // CRITICAL: PRIMARY CHECK - Skip if already seen (by signature, not ID)
          const signature = createEarthquakeSignature(eq);
          if (seenSignatures.has(signature)) {
            // ELITE: Silent skip - don't spam logs for already notified earthquakes
            // Only log in dev mode if magnitude is significant (> 4.0)
            if (__DEV__ && eq.magnitude > 4.0) {
              logger.debug(`⏭️ Deprem zaten bildirildi (atlandı): ${eq.id} - ${eq.magnitude} - ${eq.location}`);
            }
            return false; // Already notified - skip
          }
          
          // ELITE: Check if EEW already sent early warning for this earthquake
          // This prevents duplicate notifications
          try {
            const earlyWarningKey = `early_warning_${signature}`;
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            AsyncStorage.getItem(earlyWarningKey).then((value: string | null) => {
              if (value === 'true') {
                if (__DEV__ && eq.magnitude > 4.0) {
                  logger.debug(`⏭️ EEW zaten erken uyarı gönderdi (atlandı): ${eq.id} - ${eq.magnitude} - ${eq.location}`);
                }
              }
            }).catch(() => {
              // Ignore storage errors
            });
          } catch {
            // Ignore errors - continue with normal processing
          }
          
          // CRITICAL: Only accept if:
          // 1. This is our first fetch (lastCheckedTimestamp === 0) - allow all recent earthquakes
          // 2. OR earthquake happened in last 2 hours AND we haven't seen it before (catches delayed API responses)
          const isFirstFetch = lastCheckedTimestamp === 0;
          const isRecent = eq.time > recentThreshold;
          
          // Only accept if first fetch OR (recent AND not seen before)
          const shouldNotify = isFirstFetch || isRecent;
          
          // ELITE: Silent skip - don't spam logs for old earthquakes
          // Only log in dev mode if magnitude is significant (> 4.0)
          if (!shouldNotify && __DEV__ && eq.magnitude > 4.0) {
            logger.debug(`⏭️ Deprem çok eski (atlandı): ${eq.id} - ${eq.magnitude} - ${eq.location} (${Math.round((now - eq.time) / 1000 / 60)} dakika önce)`);
          }
          
          return shouldNotify;
        });
        
        // Update seen signatures (keep last 2000 to prevent memory issues)
        newEarthquakes.forEach(eq => {
          const signature = createEarthquakeSignature(eq);
          seenSignatures.add(signature);
        });
        const seenSignaturesArray = Array.from(seenSignatures).slice(-2000);
        await AsyncStorage.setItem(seenEarthquakesKey, JSON.stringify(seenSignaturesArray));
        
        // Process all new earthquakes IMMEDIATELY
        for (const eq of newEarthquakes) {
          // ELITE: Check user settings for notification filters
          const { useSettingsStore } = await import('../stores/settingsStore');
          const settings = useSettingsStore.getState();
          
          // Check magnitude threshold
          if (eq.magnitude < settings.minMagnitudeForNotification) {
            if (__DEV__) {
              logger.debug(`⏭️ Deprem minimum büyüklük eşiğinin altında (${eq.magnitude.toFixed(1)} < ${settings.minMagnitudeForNotification.toFixed(1)}): ${eq.location}`);
            }
            continue; // Skip notification - below user's minimum threshold
          }
          
          // Check distance threshold (if user location is available)
          if (settings.maxDistanceForNotification > 0) {
            try {
              const { calculateDistance } = await import('../utils/mapUtils');
              const { useUserStatusStore } = await import('../stores/userStatusStore');
              const userStatus = useUserStatusStore.getState();
              
              if (userStatus.location) {
                const distance = calculateDistance(
                  userStatus.location.latitude,
                  userStatus.location.longitude,
                  eq.latitude,
                  eq.longitude
                );
                
                if (distance > settings.maxDistanceForNotification) {
                  if (__DEV__) {
                    logger.debug(`⏭️ Deprem maksimum mesafe eşiğinin dışında (${distance.toFixed(0)}km > ${settings.maxDistanceForNotification}km): ${eq.location}`);
                  }
                  continue; // Skip notification - outside user's distance threshold
                }
              }
            } catch (error) {
              // If distance calculation fails, continue with notification (better safe than sorry)
              logger.warn('Distance calculation failed, continuing with notification:', error);
            }
          }
          
          // Check source selection
          const sourceEnabled = 
            (eq.source === 'AFAD' && settings.sourceAFAD) ||
            (eq.source === 'USGS' && settings.sourceUSGS) ||
            (eq.source === 'EMSC' && settings.sourceEMSC) ||
            (eq.source === 'KOERI' && settings.sourceKOERI) ||
            (eq.source === 'SEISMIC_SENSOR' && settings.sourceCommunity);
          
          if (!sourceEnabled) {
            if (__DEV__) {
              logger.debug(`⏭️ Deprem kaynağı kullanıcı tarafından devre dışı bırakılmış (${eq.source}): ${eq.location}`);
            }
            continue; // Skip notification - source disabled by user
          }
          
          const detectionDelay = Math.round((Date.now() - eq.time) / 1000);
          const apiDelay = lastCheckedTimestamp > 0 ? Math.round((now - lastCheckedTimestamp) / 1000) : 0;
          
          logger.info('🔝 Yeni deprem tespit edildi', {
            location: eq.location,
            magnitude: eq.magnitude,
            time: new Date(eq.time).toLocaleString('tr-TR'),
            secondsAgo: detectionDelay,
            detectionDelaySeconds: detectionDelay,
            apiDelaySeconds: apiDelay,
          });
          
          // CRITICAL: Only warn if API delay is significant (> 5 minutes)
          // This indicates AFAD API is slow, not our detection
          if (apiDelay > 300 && detectionDelay > 300) {
            logger.warn(`⚠️ AFAD API gecikmesi: ${Math.round(apiDelay / 60)} dakika (deprem ${Math.round(detectionDelay / 60)} dakika önce olmuş)`, {
              earthquakeTime: new Date(eq.time).toISOString(),
              detectionTime: new Date().toISOString(),
              apiDelayMinutes: Math.round(apiDelay / 60),
              delayMinutes: Math.round(detectionDelay / 60),
            });
          }
          
          // Track critical earthquakes for dynamic polling
          if (eq.magnitude >= 6.0) {
            this.lastCriticalEarthquakeTime = Date.now();
            void this.startDynamicPolling(); // Switch to faster polling
          }
          
          // CRITICAL: Check if early warning was already sent by SeismicSensorService or EEWService
          // If early warning was sent, this is just a confirmation (AFAD API data comes AFTER earthquake)
          // We should still notify but with lower priority/less aggressive alert
          const earlyWarningKey = `early_warning_${createEarthquakeSignature(eq)}`;
          const earlyWarningSent = await AsyncStorage.getItem(earlyWarningKey);
          const wasEarlyWarning = earlyWarningSent === 'true';
          
          if (wasEarlyWarning) {
            // Early warning was already sent - this is just confirmation
            // Log but don't send aggressive notification (user already got early warning)
            logger.info(`✅ Erken uyarı zaten gönderilmişti - AFAD onayı: ${eq.magnitude.toFixed(1)} - ${eq.location}`);
            // Still update store for data consistency
            continue; // Skip notification - user already got early warning
          }
          
          // ELITE: Premium check for earthquake notifications
          const { premiumService } = await import('./PremiumService');
          if (!premiumService.hasAccess('earthquake')) {
            if (__DEV__) {
              logger.debug('⏭️ Deprem bildirimi premium gerektiriyor - atlandı');
            }
            continue; // Skip notification - premium required
          }
          
          // CRITICAL: INSTANT notification for earthquakes WITHOUT early warning
          // This is life-saving - wrap in try-catch to ensure it always attempts
          const notificationStartTime = Date.now();
          try {
            await this.sendInstantEarthquakeNotification(eq, settings);
            const notificationDelay = Date.now() - notificationStartTime;
            
            // ELITE: Track notification performance
            try {
              const { firebaseAnalyticsService } = await import('./FirebaseAnalyticsService');
              firebaseAnalyticsService.logEvent('earthquake_notification_sent', {
                magnitude: String(eq.magnitude),
                detectionDelaySeconds: String(detectionDelay),
                notificationDelayMs: String(notificationDelay),
                location: eq.location.substring(0, 50),
              });
            } catch {
              // Ignore analytics errors
            }
            
            if (notificationDelay > 1000) {
              logger.warn(`⚠️ Bildirim gönderimi ${notificationDelay}ms sürdü (beklenenden yavaş)`);
            }
          } catch (notifError) {
            // CRITICAL: If notification fails, try again with basic notification
            logger.error('❌ CRITICAL: Instant notification failed, retrying with basic:', notifError);
            try {
              const { notificationService } = await import('./NotificationService');
              await notificationService.showEarthquakeNotification(eq.magnitude, eq.location);
            } catch (retryError) {
              logger.error('❌ CRITICAL: Basic notification also failed:', retryError);
              // Last resort: Log critical error but continue processing
            }
          }
          
          // ELITE: MULTI-SOURCE VERIFICATION - 6 Kaynak Doğrulama
          // Hayat kurtarmak için en doğru bilgiyi kullanıcılara veriyoruz
          let verificationResult: any = null;
          if (eq.magnitude >= 4.0) {
            try {
              const multiSourceModule = await import('./MultiSourceVerificationService');
              const multiSourceVerificationService = multiSourceModule.multiSourceVerificationService;
              
              // Tüm kaynaklardan veri topla (uniqueEarthquakes listesinden)
              // Define VerificationSource type inline to match the interface
              type VerificationSource = {
                source: 'sensor' | 'afad' | 'usgs' | 'kandilli' | 'emsc' | 'community';
                magnitude: number;
                location: { latitude: number; longitude: number };
                timestamp: number;
                confidence: number;
              };
              const verificationSources: VerificationSource[] = [];
              
              // 1. Mevcut deprem (AFAD, USGS, EMSC, KOERI)
              verificationSources.push({
                source: eq.source.toLowerCase() as any,
                magnitude: eq.magnitude,
                location: { latitude: eq.latitude, longitude: eq.longitude },
                timestamp: eq.time,
                confidence: eq.source === 'USGS' ? 85 : eq.source === 'AFAD' ? 80 : 80,
              });
              
              // 2. Aynı deprem için diğer kaynakları bul
              const matchingSources = uniqueEarthquakes.filter(e => 
                e.id !== eq.id && // Farklı kaynak
                Math.abs(e.latitude - eq.latitude) < 0.5 && // 50km içinde
                Math.abs(e.longitude - eq.longitude) < 0.5 &&
                Math.abs(e.time - eq.time) < 5 * 60 * 1000 // 5 dakika içinde
              );
              
              for (const match of matchingSources) {
                verificationSources.push({
                  source: match.source.toLowerCase() as any,
                  magnitude: match.magnitude,
                  location: { latitude: match.latitude, longitude: match.longitude },
                  timestamp: match.time,
                  confidence: match.source === 'USGS' ? 85 : match.source === 'AFAD' ? 80 : 80,
                });
              }
              
              // Multi-source verification yap (minimum 2 kaynak gerekli)
              if (verificationSources.length >= 2) {
                verificationResult = multiSourceVerificationService.verify(verificationSources);
                
                if (verificationResult.verified && verificationResult.confidence > 75) {
                  logger.info(`✅ MULTI-SOURCE VERIFIED: ${verificationResult.sourceCount} kaynak onayladı - ${verificationResult.confidence.toFixed(1)}% güven, ${verificationResult.consensusMagnitude.toFixed(1)} büyüklük`);
                  
                  // Verified magnitude ve location kullan (daha doğru)
                  eq.magnitude = verificationResult.consensusMagnitude;
                  eq.latitude = verificationResult.consensusLocation.latitude;
                  eq.longitude = verificationResult.consensusLocation.longitude;
                } else {
                  logger.debug(`ℹ️ MULTI-SOURCE VERIFICATION: ${verificationSources.length} kaynak bulundu, ${verificationResult.confidence.toFixed(1)}% güven (minimum 75% gerekli)`);
                }
              } else {
                logger.debug(`ℹ️ MULTI-SOURCE VERIFICATION SKIPPED: Sadece ${verificationSources.length} kaynak bulundu (minimum 2 gerekli)`);
              }
            } catch (error) {
              logger.error('Multi-source verification error (non-critical):', error);
              // Continue without verification - single source is still valid
            }
          }
          
          // CRITICAL: Trigger auto check-in for significant earthquakes (magnitude >= 4.0)
          if (eq.magnitude >= 4.0) {
            try {
              logger.info(`Triggering AutoCheckin for magnitude ${eq.magnitude} earthquake`);
              await autoCheckinService.startCheckIn(eq.magnitude).catch((checkinError) => {
                logger.error('❌ AutoCheckin failed (non-critical):', checkinError);
                // Non-critical - continue processing
              });
            } catch (checkinError) {
              logger.error('❌ AutoCheckin error (non-critical):', checkinError);
              // Non-critical - continue processing
            }
          }
          
          // ELITE COST OPTIMIZATION: Use backend centralized AI analysis
          // Backend performs single AI analysis and broadcasts to all users
          // Frontend only checks Firebase for shared analysis (no AI calls)
          if (eq.magnitude >= 4.0) {
            // 🤖 AI ANALIZI: Backend'den gelen merkezi analizi kullan (maliyet optimizasyonu)
            try {
              const { firebaseDataService } = await import('./FirebaseDataService');
              
              // Backend'den gelen paylaşılan analizi kontrol et (merkezi AI analizi)
              // Backend tek bir AI çağrısı yapıp tüm kullanıcılara push notification gönderiyor
              // Frontend sadece Firebase'den analizi okuyor (AI maliyeti yok)
              let analysis = await firebaseDataService.getEarthquakeAnalysis(eq.id);
              
              if (!analysis) {
                // ELITE: Backend henüz analiz yapmadıysa, backend'e analiz isteği gönder
                // Ancak frontend'de AI çağrısı yapmıyoruz (maliyet optimizasyonu)
                logger.info(`📊 Backend merkezi AI analizi bekleniyor: ${eq.id}`);
                
                // Backend push notification'dan gelen analizi bekliyoruz
                // Kullanıcı push notification aldığında analiz Firebase'e kaydedilir
                // Bu sayede her kullanıcı için ayrı AI çağrısı yapılmıyor
                
                // Fallback: Eğer backend analiz yapmadıysa, basit bir analiz göster
                // (AI kullanmadan, sadece magnitude'a göre)
                analysis = {
                  riskLevel: eq.magnitude >= 7.0 ? 'critical' : eq.magnitude >= 6.0 ? 'high' : eq.magnitude >= 5.0 ? 'medium' : 'low',
                  userMessage: `${eq.magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi.`,
                  recommendations: [
                    'Sakin kalın ve güvenli bir yere geçin',
                    'Acil durum çantanızı hazır tutun',
                    'Aile üyelerinizle iletişimde kalın',
                  ],
                  verified: false,
                  sources: [eq.source],
                  confidence: 70,
                  createdAt: new Date().toISOString(),
                };
              } else {
                logger.info(`✅ Paylaşılan analiz kullanılıyor: ${eq.id} (${analysis.createdAt})`);
              }

              if (analysis) {
                // Elite: AI analizi ile ENHANCED bildirim gönder
              const { multiChannelAlertService } = await import('./MultiChannelAlertService');
                const alertConfig = this.getAlertConfigForMagnitude(eq.magnitude, settings);
                
                // ELITE: Use user settings for notification channels
                const channels = {
                  pushNotification: settings.notificationPush && alertConfig.channels.pushNotification,
                  fullScreenAlert: settings.notificationFullScreen && alertConfig.channels.fullScreenAlert,
                  alarmSound: settings.notificationSound && alertConfig.channels.alarmSound,
                  vibration: settings.notificationVibration && alertConfig.channels.vibration,
                  tts: settings.notificationTTS && alertConfig.channels.tts,
                };
                
                // Determine priority based on user settings
                let priority = alertConfig.priority;
                if (eq.magnitude >= settings.criticalMagnitudeThreshold) {
                  priority = settings.priorityCritical;
                } else if (eq.magnitude >= 5.0) {
                  priority = settings.priorityHigh;
                } else if (eq.magnitude >= 4.0) {
                  priority = settings.priorityMedium;
                } else {
                  priority = settings.priorityLow;
                }
                
              await multiChannelAlertService.sendAlert({
                  title: `${eq.magnitude.toFixed(1)} Deprem${analysis.verified ? ' ✓ Doğrulandı' : ''} - ${alertConfig.titleSuffix}`,
                body: analysis.userMessage,
                  priority: priority as any,
                  channels: channels as any,
                  vibrationPattern: settings.notificationVibration ? alertConfig.vibrationPattern : undefined,
                  sound: settings.notificationSound ? alertConfig.sound : undefined,
                  ttsText: settings.notificationTTS ? `Dikkat! ${eq.magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi. ${eq.location}. ${analysis.userMessage}` : undefined,
                  duration: alertConfig.duration,
                data: {
                    earthquake: eq,
                  analysis,
                  verified: analysis.verified,
                  sources: analysis.sources,
                },
              });
            }
          } catch (aiError) {
            logger.error('AI analysis failed:', aiError);
            // AI hatası durumunda normal akışa devam et
          }
          
          // Save to Firebase (for critical earthquakes >= 4.0)
          try {
            const { firebaseDataService } = await import('./FirebaseDataService');
            if (firebaseDataService.isInitialized) {
              await firebaseDataService.saveEarthquake({
                  id: eq.id,
                  location: eq.location,
                  magnitude: eq.magnitude,
                  depth: eq.depth,
                  time: eq.time,
                  latitude: eq.latitude,
                  longitude: eq.longitude,
              });
              
              // Save alert for current user
              const { getDeviceId } = await import('../../lib/device');
              const deviceId = await getDeviceId();
              if (deviceId) {
                  await firebaseDataService.saveEarthquakeAlert(deviceId, eq.id, {
                    earthquakeId: eq.id,
                    magnitude: eq.magnitude,
                    location: eq.location,
                    timestamp: eq.time,
                  notified: true,
                });
              }
            }
          } catch (error) {
            logger.error('Failed to save earthquake to Firebase:', error);
          }
          
          // 🚨 CRITICAL: Trigger emergency mode for major earthquakes (6.0+)
            // MUST NOT FAIL - This is life-saving functionality
            if (emergencyModeService.shouldTriggerEmergencyMode(eq)) {
              logger.info(`🚨 CRITICAL EARTHQUAKE DETECTED: ${eq.magnitude} - Activating emergency mode`);
              try {
                await emergencyModeService.activateEmergencyMode(eq);
              } catch (emergencyError) {
                // CRITICAL: Emergency mode activation failed - log but continue
                logger.error('❌ CRITICAL: Emergency mode activation failed:', emergencyError);
                // Try to at least send a critical notification
                try {
                  const { multiChannelAlertService } = await import('./MultiChannelAlertService');
                  await multiChannelAlertService.sendAlert({
                    title: '🚨🚨🚨 KRİTİK DEPREM 🚨🚨🚨',
                    body: `${eq.magnitude.toFixed(1)} büyüklüğünde kritik deprem! Acil önlemler alın!`,
                    priority: 'critical',
                    channels: {
                      pushNotification: true,
                      fullScreenAlert: true,
                      alarmSound: true,
                      vibration: true,
                      tts: true,
                    },
                  });
                } catch (fallbackError) {
                  logger.error('❌ CRITICAL: Emergency fallback notification also failed:', fallbackError);
                }
              }
            }
          }
        }
        
        // CRITICAL FIX: Update last checked timestamp to NOW (API fetch time), not earthquake time
        // This ensures we catch delayed API responses in next fetch
        if (newEarthquakes.length > 0) {
          const latestEq = newEarthquakes[0]; // Already sorted by time (newest first)
          const now = Date.now();
          await AsyncStorage.setItem('last_checked_earthquake', latestEq.id);
          // CRITICAL: Store API fetch time, not earthquake time (catches delayed responses)
          await AsyncStorage.setItem('last_checked_earthquake_time', String(now));
          
          logger.info(`✅ Last checked updated: EQ time=${new Date(latestEq.time).toISOString()}, API fetch time=${new Date(now).toISOString()}`);
        }
        
        // CRITICAL: Safe store access - check if store still exists
        if (store && typeof store.setItems === 'function') {
        store.setItems(uniqueEarthquakes);
        logger.info(`✅ Store güncellendi`, { count: uniqueEarthquakes.length });
        }
        this.lastFetchedAt = Date.now();
        await AsyncStorage.setItem(LAST_FETCH_KEY, String(this.lastFetchedAt));
        await this.saveToCache(uniqueEarthquakes);
      } else {
        // Try cache if no new data
        const cached = await this.loadFromCache();
        if (cached && cached.length > 0 && store && typeof store.setItems === 'function') {
          store.setItems(cached);
          const lastFetchValue = await AsyncStorage.getItem(LAST_FETCH_KEY);
          this.lastFetchedAt = lastFetchValue ? Number(lastFetchValue) : this.lastFetchedAt;
        } else if (store && typeof store.setError === 'function') {
          store.setError('Deprem verisi alınamadı. İnternet bağlantınızı kontrol edin.');
        }
      }
    } catch (error) {
      logger.error('❌ CRITICAL: Earthquake fetch error:', error);
      // Try cache on error
      const cached = await this.loadFromCache();
      if (cached && cached.length > 0 && store && typeof store.setItems === 'function') {
        store.setItems(cached);
        const lastFetchValue = await AsyncStorage.getItem(LAST_FETCH_KEY);
        this.lastFetchedAt = lastFetchValue ? Number(lastFetchValue) : this.lastFetchedAt;
      } else if (store && typeof store.setError === 'function') {
        store.setError('Deprem verisi alınamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      this.isFetching = false;
      // CRITICAL: Safe store access in finally block
      if (store && typeof store.setLoading === 'function') {
      store.setLoading(false);
      }
    }
  }

  private deduplicateEarthquakes(earthquakes: Earthquake[]): Earthquake[] {
    const unique: Earthquake[] = [];
    const seen = new Set<string>();

    for (const eq of earthquakes) {
      // Create a key based on rounded location and time
      const timeKey = Math.floor(eq.time / (5 * 60 * 1000)); // 5 minute buckets
      const latKey = Math.round(eq.latitude * 100); // ~1km precision
      const lonKey = Math.round(eq.longitude * 100);
      const key = `${timeKey}-${latKey}-${lonKey}-${Math.round(eq.magnitude * 10)}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(eq);
      }
    }

    return unique;
  }

  private async fetchFromAFAD(): Promise<Earthquake[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      // CRITICAL FIX: Use shorter time window for faster API response
      // Last 2 hours for real-time detection (was 7 days - too slow!)
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      const startDate = twoHoursAgo.toISOString().split('T')[0];
      const startTime = twoHoursAgo.toISOString().split('T')[1]?.split('.')[0] || '00:00:00';

      // AFAD filter endpoint includes events up to the start of the "end" day.
      // Add one extra day so we always capture the current day's events.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = tomorrow.toISOString().split('T')[0];
      
      // ELITE: Use user's magnitude threshold setting for API call
      // This reduces unnecessary data transfer and improves performance
      const { useSettingsStore } = await import('../stores/settingsStore');
      const settings = useSettingsStore.getState();
      const minMag = Math.max(1, Math.floor(settings.minMagnitudeForNotification)); // AFAD API requires integer, minimum 1
      
      // CRITICAL: Use time-precise URL for faster response (last 2 hours only)
      // Use user's magnitude threshold setting
      const url = `https://deprem.afad.gov.tr/apiv2/event/filter?start=${startDate}&end=${endDate}&minmag=${minMag}`;
      
      // Fallback: If no results, try last 24 hours (wider window)
      // But prioritize 2-hour window for speed
      
      // Alternative fallback URL (last 500 events)
      const fallbackUrl = 'https://deprem.afad.gov.tr/apiv2/event/latest?limit=500';
      
      logger.debug('📡 AFAD API çağrılıyor', { url, startDate, endDate });

      // ELITE: Check cache first
      const { httpCacheService } = await import('./HTTPCacheService');
      const cachedData = await httpCacheService.getCachedResponse(url);
      
      if (cachedData) {
        logger.info('📦 Using cached AFAD data');
        return this.parseAFADResponse(cachedData);
      }

      const apiStartTime = Date.now();
      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0',
        },
        signal: controller.signal,
      });
      const apiResponseTime = Date.now() - apiStartTime;

      // ELITE: Track API performance
      try {
        const { firebaseAnalyticsService } = await import('./FirebaseAnalyticsService');
        firebaseAnalyticsService.trackAPIResponseTime('afad_api', apiResponseTime, response.ok);
      } catch {
        // Ignore analytics errors
      }

      if (!response.ok) {
        throw new Error(`AFAD API error: ${response.status}`);
      }

      const responseData = await response.json();
      
      // ELITE: Cache successful response (5 minutes TTL)
      await httpCacheService.cacheResponse(url, responseData, 5 * 60 * 1000, {
        'content-type': response.headers.get('content-type') || 'application/json',
      });

      clearTimeout(timeoutId);

      return this.parseAFADResponse(responseData);
      
    } catch (error) {
      // Silent fail - return empty array, cache will be used
          return [];
        }
  }

  /**
   * ELITE: Parse AFAD response (used for cached data)
   */
  private parseAFADResponse(data: any): Earthquake[] {
      // AFAD apiv2 returns array directly OR object with data property
      let events: any[] = [];
      if (Array.isArray(data)) {
        events = data;
      } else if (data && Array.isArray(data.data)) {
        events = data.data;
      } else if (data && Array.isArray(data.events)) {
        events = data.events;
      } else if (data && Array.isArray(data.results)) {
        events = data.results;
      }
      
      if (events.length === 0) {
        return [];
      }
      
      const earthquakes = events
        .map((item: any) => {
          const eventDate = item.eventDate || item.date || item.originTime || item.tarih || item.time;
          const magnitude = parseFloat(item.mag || item.magnitude || item.ml || item.richter || '0');
          
          const locationParts = [
            item.location,
            item.yer || item.placeName,
            item.ilce,
            item.sehir || item.city,
            item.title,
            item.place,
            item.epicenter,
          ].filter(Boolean);
          
          const location = locationParts.length > 0 
            ? locationParts.join(', ') 
            : 'Türkiye';
          
          let latitude = 0;
          let longitude = 0;
          
          if (item.geojson?.coordinates && Array.isArray(item.geojson.coordinates)) {
            longitude = parseFloat(item.geojson.coordinates[0]) || 0;
            latitude = parseFloat(item.geojson.coordinates[1]) || 0;
        } else if (item.latitude && item.longitude) {
            latitude = parseFloat(item.latitude) || 0;
            longitude = parseFloat(item.longitude) || 0;
        } else if (item.lat && item.lng) {
            latitude = parseFloat(item.lat) || 0;
            longitude = parseFloat(item.lng) || 0;
        } else if (item.enlem && item.boylam) {
            latitude = parseFloat(item.enlem) || 0;
            longitude = parseFloat(item.boylam) || 0;
          }
          
          const depth = parseFloat(item.depth || item.derinlik || item.derinlikKm || '10') || 10;
          
          let time = Date.now();
          const parsedTime = parseAfadDate(eventDate);
          if (parsedTime) {
            time = parsedTime;
          }
          
          return {
            id: `afad-${item.eventID || item.eventId || item.id || item.earthquakeId || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            magnitude,
            location,
            depth,
            time,
            latitude,
            longitude,
            source: 'AFAD' as const,
          };
        })
        .filter((eq: Earthquake) => {
          const isValid = 
            eq.latitude !== 0 && 
            eq.longitude !== 0 &&
            !isNaN(eq.latitude) &&
            !isNaN(eq.longitude) &&
            eq.latitude >= -90 && eq.latitude <= 90 &&
            eq.longitude >= -180 && eq.longitude <= 180 &&
          eq.magnitude >= 1.0 &&
          eq.magnitude <= 10.0 &&
            !isNaN(eq.time) &&
            eq.time > 0;
          
          return isValid;
        })
      .sort((a, b) => b.time - a.time)
      .slice(0, 100);

      return earthquakes;
  }

  private async fetchFromUSGS(): Promise<Earthquake[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // ELITE: Use user's magnitude threshold setting
      const { useSettingsStore } = await import('../stores/settingsStore');
      const settings = useSettingsStore.getState();
      const minMagnitude = Math.max(3.0, settings.minMagnitudeForNotification); // USGS minimum is 3.0
      
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const startTime = new Date(oneDayAgo).toISOString();
      
      const response = await fetch(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&minmagnitude=${minMagnitude.toFixed(1)}&orderby=time&limit=500`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AfetNet/1.0',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      
      return (data.features || []).map((feature: any) => ({
        id: `usgs-${feature.id}`,
        magnitude: feature.properties.mag || 0,
        location: feature.properties.place || 'Unknown',
        depth: feature.geometry.coordinates[2] || 0,
        time: feature.properties.time || Date.now(),
        latitude: feature.geometry.coordinates[1] || 0,
        longitude: feature.geometry.coordinates[0] || 0,
        source: 'USGS' as const,
      })).filter((eq: Earthquake) => eq.magnitude >= minMagnitude);
      
    } catch (error) {
      return [];
    }
  }

  /**
   * ELITE: Fetch from backend proxy (Kandilli + EMSC + KOERI)
   * Backend'de çalıştığı için React Native sorunları yok
   * Maliyet yok - backend zaten bu kaynakları çekiyor
   */
  private async fetchFromBackend(): Promise<Earthquake[]> {
    try {
      // Backend URL from environment or use default
      const Constants = require('expo-constants');
      const baseUrl = 
        process.env.BACKEND_URL || 
        Constants?.expoConfig?.extra?.backendUrl ||
        'https://afetnet-backend.onrender.com';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      // ELITE: Use user's magnitude threshold setting
      const { useSettingsStore } = await import('../stores/settingsStore');
      const settings = useSettingsStore.getState();
      const minMagnitude = Math.max(3.0, settings.minMagnitudeForNotification); // Backend minimum is 3.0
      
      // Backend'den son 2 saatteki depremleri al
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const response = await fetch(
        `${baseUrl}/api/earthquakes?since=${twoHoursAgo}&minmagnitude=${minMagnitude.toFixed(1)}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AfetNet/1.0',
          },
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      
      // Backend format: { earthquakes: [...], sources: ['emsc', 'koeri'] }
      const backendEarthquakes = (data.earthquakes || []).map((item: any) => ({
        id: `backend-${item.source}-${item.id || Date.now()}`,
        magnitude: item.magnitude || 0,
        location: item.region || item.location || 'Unknown',
        depth: item.depth || item.depthKm || 10,
        time: item.timestamp || item.issuedAt || Date.now(),
        latitude: item.lat || item.latitude || 0,
        longitude: item.lon || item.longitude || 0,
        source: (item.source || 'backend').toUpperCase() as 'EMSC' | 'KOERI' | 'AFAD',
      })).filter((eq: Earthquake) => eq.magnitude >= minMagnitude);
      
      return backendEarthquakes;
    } catch (error) {
      // Silent fail - backend may be unavailable
      return [];
    }
  }

  private async fetchFromKandilli(): Promise<Earthquake[]> {
    // Backend proxy kullanılıyor (fetchFromBackend)
    return [];
  }

  private async saveToCache(earthquakes: Earthquake[]) {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(earthquakes));
      await AsyncStorage.setItem(LAST_FETCH_KEY, String(Date.now()));
    } catch (error) {
      logger.error('Cache save error:', error);
    }
  }

  private async loadFromCache(): Promise<Earthquake[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Cache load error:', error);
      return null;
    }
  }

  /**
   * Elite: Send instant earthquake notification based on magnitude
   * Optimized for zero-delay notifications
   * Uses user settings for notification types and priorities
   */
  private async sendInstantEarthquakeNotification(earthquake: Earthquake, settings?: any) {
    // Get settings if not provided
    if (!settings) {
      const { useSettingsStore } = await import('../stores/settingsStore');
      settings = useSettingsStore.getState();
    }
    // CRITICAL: This is life-saving - MUST attempt all notification methods
    // Even if one fails, others must still be attempted
    
    const notificationStartTime = Date.now();
    const earthquakeAgeSeconds = Math.round((Date.now() - earthquake.time) / 1000);
    
    // CRITICAL: Log notification timing for debugging
    logger.info(`📢 Bildirim gönderiliyor: ${earthquake.magnitude.toFixed(1)} - ${earthquake.location} (${earthquakeAgeSeconds}s önce)`);
    
    // Step 1: IMMEDIATE basic notification (fastest, most reliable)
    // CRITICAL: Use Promise.race to prevent blocking if notification is slow
    try {
      const { notificationService } = await import('./NotificationService');
      const notificationPromise = notificationService.showEarthquakeNotification(earthquake.magnitude, earthquake.location);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Notification timeout')), 2000) // 2 second timeout
      );
      
      await Promise.race([notificationPromise, timeoutPromise]);
      const basicNotificationDelay = Date.now() - notificationStartTime;
      logger.info(`✅ Basic notification sent in ${basicNotificationDelay}ms`);
      
      // Warn if notification is slow (> 1 second)
      if (basicNotificationDelay > 1000) {
        logger.warn(`⚠️ Bildirim gönderimi ${basicNotificationDelay}ms sürdü (beklenenden yavaş)`);
      }
    } catch (basicError) {
      logger.error('❌ CRITICAL: Basic notification failed:', basicError);
      // Continue - try multi-channel alert
    }
    
    // Step 2: Enhanced multi-channel alert for significant earthquakes (>= 3.0)
    if (earthquake.magnitude >= 3.0) {
      try {
        const { multiChannelAlertService } = await import('./MultiChannelAlertService');
        const alertConfig = this.getAlertConfigForMagnitude(earthquake.magnitude, settings);
        
        // ELITE: Use user settings for notification channels
        const channels = {
          pushNotification: settings.notificationPush && alertConfig.channels.pushNotification,
          fullScreenAlert: settings.notificationFullScreen && alertConfig.channels.fullScreenAlert,
          alarmSound: settings.notificationSound && alertConfig.channels.alarmSound,
          vibration: settings.notificationVibration && alertConfig.channels.vibration,
          tts: settings.notificationTTS && alertConfig.channels.tts,
        };
        
        // Determine priority based on user settings
        let priority = alertConfig.priority;
        if (earthquake.magnitude >= settings.criticalMagnitudeThreshold) {
          priority = settings.priorityCritical;
        } else if (earthquake.magnitude >= 5.0) {
          priority = settings.priorityHigh;
        } else if (earthquake.magnitude >= 4.0) {
          priority = settings.priorityMedium;
        } else {
          priority = settings.priorityLow;
        }
        
        // CRITICAL: AFAD API provides data AFTER earthquake happens
        // This is NOT an early warning - it's a confirmation/notification
        // Message should reflect that earthquake already happened
        const earthquakeAgeMinutes = Math.round((Date.now() - earthquake.time) / 1000 / 60);
        const ageText = earthquakeAgeMinutes > 0 
          ? `${earthquakeAgeMinutes} dakika önce`
          : 'Az önce';
        
        await multiChannelAlertService.sendAlert({
          title: `📢 ${earthquake.magnitude.toFixed(1)} Deprem - ${alertConfig.titleSuffix}`,
          body: `${earthquake.location} - ${earthquake.magnitude.toFixed(1)} büyüklüğünde deprem oldu (${ageText}).`,
          priority: priority as any,
          channels: channels as any,
          vibrationPattern: settings.notificationVibration ? alertConfig.vibrationPattern : undefined,
          sound: settings.notificationSound ? alertConfig.sound : undefined,
          ttsText: settings.notificationTTS ? `Dikkat! ${earthquake.magnitude.toFixed(1)} büyüklüğünde deprem oldu. ${earthquake.location}. ${ageText}.` : undefined,
          duration: alertConfig.duration,
          data: {
            earthquake,
            type: 'earthquake_confirmation', // Changed from 'earthquake_instant' to indicate this is AFTER earthquake
            magnitude: earthquake.magnitude,
            location: earthquake.location,
            isEarlyWarning: false, // CRITICAL: This is NOT an early warning
            earthquakeAgeMinutes,
          },
        });
      } catch (multiChannelError) {
        logger.error('❌ CRITICAL: Multi-channel alert failed:', multiChannelError);
        // At least basic notification was sent (if it succeeded)
      }
    }
  }

  /**
   * Elite: Get alert configuration based on earthquake magnitude
   * More aggressive alerts for larger earthquakes
   */
  private getAlertConfigForMagnitude(magnitude: number, settings?: any): {
    priority: 'low' | 'normal' | 'high' | 'critical';
    titleSuffix: string;
    channels: any;
    vibrationPattern: number[];
    sound?: string;
    duration: number;
  } {
    if (magnitude >= 7.0) {
      // MEGA EARTHQUAKE - Maximum alert
      return {
        priority: 'critical',
        titleSuffix: 'MEGA DEPREM',
        channels: {
          pushNotification: true,
          fullScreenAlert: true,
          alarmSound: true,
          vibration: true,
          tts: true,
          bluetooth: true, // Broadcast via BLE
        },
        vibrationPattern: [0, 500, 200, 500, 200, 500, 200, 1000, 200, 500, 200, 500], // SOS pattern
        sound: 'emergency',
        duration: 0, // Stay until dismissed
      };
    } else if (magnitude >= 6.0) {
      // MAJOR EARTHQUAKE - Critical alert
      return {
        priority: 'critical',
        titleSuffix: 'BÜYÜK DEPREM',
        channels: {
          pushNotification: true,
          fullScreenAlert: true,
          alarmSound: true,
          vibration: true,
          tts: true,
          bluetooth: true,
        },
        vibrationPattern: [0, 400, 150, 400, 150, 400, 150, 800, 150, 400, 150, 400],
        sound: 'emergency',
        duration: 0,
      };
    } else if (magnitude >= 5.0) {
      // SIGNIFICANT EARTHQUAKE - High alert
      return {
        priority: 'critical',
        titleSuffix: 'ÖNEMLİ DEPREM',
        channels: {
          pushNotification: true,
          fullScreenAlert: true,
          alarmSound: true,
          vibration: true,
          tts: true,
        },
        vibrationPattern: [0, 300, 100, 300, 100, 300, 100, 600, 100, 300],
        sound: 'default',
        duration: 45,
      };
    } else if (magnitude >= 4.5) {
      // MODERATE EARTHQUAKE - High priority
      return {
        priority: 'high',
        titleSuffix: 'ORTA DEPREM',
        channels: {
          pushNotification: true,
          fullScreenAlert: false,
          alarmSound: true,
          vibration: true,
          tts: true,
        },
        vibrationPattern: [0, 250, 100, 250, 100, 250, 100, 500],
        duration: 30,
      };
    } else if (magnitude >= 4.0) {
      // NOTABLE EARTHQUAKE - High priority
      return {
        priority: 'high',
        titleSuffix: 'FARK EDİLİR DEPREM',
        channels: {
          pushNotification: true,
          fullScreenAlert: false,
          alarmSound: false,
          vibration: true,
          tts: true,
        },
        vibrationPattern: [0, 200, 100, 200, 100, 200],
        duration: 20,
      };
    } else if (magnitude >= 3.0) {
      // MINOR EARTHQUAKE - Normal priority
      return {
        priority: 'normal',
        titleSuffix: 'KÜÇÜK DEPREM',
        channels: {
          pushNotification: true,
          fullScreenAlert: false,
          alarmSound: false,
          vibration: true,
          tts: false,
        },
        vibrationPattern: [0, 150, 100, 150],
        duration: 15,
      };
    } else {
      // VERY MINOR EARTHQUAKE - Low priority
      return {
        priority: 'normal',
        titleSuffix: 'ÇOK KÜÇÜK DEPREM',
        channels: {
          pushNotification: true,
          fullScreenAlert: false,
          alarmSound: false,
          vibration: false,
          tts: false,
        },
        vibrationPattern: [],
        duration: 10,
      };
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
        time: parseAfadDate(data.eventDate) ?? Date.now(),
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
      const cached = await this.loadFromCache();
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

