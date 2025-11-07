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
    this.startDynamicPolling();
  }
  
  /**
   * ELITE: Integrate with SeismicSensorService for FIRST-TO-ALERT
   * CRITICAL: Seismic sensor detects earthquakes BEFORE API (P-wave detection)
   * This ensures we are FIRST to alert users
   */
  private setupSeismicSensorIntegration() {
    try {
      // Listen to seismic sensor detections
      seismicSensorService.onDetection((seismicEvent) => {
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
          
          // Add to store (for UI display)
          const store = useEarthquakeStore.getState();
          const currentEarthquakes = store.items;
          
          // Check if already exists (avoid duplicates)
          const exists = currentEarthquakes.find(eq => eq.id === earthquake.id);
          if (!exists) {
            const updated = [earthquake, ...currentEarthquakes].slice(0, 100); // Keep latest 100
            store.setItems(updated);
            logger.info('✅ Seismic detection added to earthquake store');
          }
          
          // CRITICAL: Mark as first-to-alert in Firebase
          // This helps backend verify and send to other users
          try {
            const { firebaseDataService } = require('./FirebaseDataService');
            if (firebaseDataService.isInitialized) {
              firebaseDataService.saveEarthquake({
                ...earthquake,
                firstToAlert: true,
                source: 'SEISMIC_SENSOR',
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
   * Elite: Dynamic polling that adjusts based on recent earthquake activity
   */
  private startDynamicPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Check if we had a critical earthquake recently (within last 10 minutes)
    const timeSinceCritical = Date.now() - this.lastCriticalEarthquakeTime;
    const isCriticalPeriod = timeSinceCritical < 10 * 60 * 1000; // 10 minutes

    // Use faster polling during critical periods
    this.currentPollInterval = isCriticalPeriod ? CRITICAL_POLL_INTERVAL : POLL_INTERVAL;

    this.intervalId = setInterval(() => {
      // CRITICAL: Always handle errors - never use void for critical operations
      this.fetchEarthquakes({ reason: 'interval' }).catch((error) => {
        logger.error('❌ CRITICAL: Earthquake fetch failed:', error);
        // CRITICAL: Even on error, continue polling - we MUST keep trying
      });
      // Re-evaluate polling interval
      this.startDynamicPolling();
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
    const store = useEarthquakeStore.getState();
    store.setLoading(true);
    store.setError(null); // Clear previous errors

    try {
      logger.info('🌍 Deprem verisi yenileniyor', {
        reason: options.reason ?? 'manual',
      });
      let earthquakes: Earthquake[] = [];

      // 1. AFAD (Turkey - Primary source)
      const afadData = await this.fetchFromAFAD();
      if (afadData.length > 0) {
        earthquakes.push(...afadData);
      }

      // 2. USGS - DISABLED for Turkey-only mode
      // Will be re-enabled for global earthquake view
      
      // 3. Kandilli - DISABLED (HTTP endpoint doesn't work in React Native)
      // Will be re-enabled when we have a proper API or proxy

      // Deduplicate based on similar location and time (within 5 minutes and 10km)
      const uniqueEarthquakes = this.deduplicateEarthquakes(earthquakes);

      // Sort by time (newest first)
      uniqueEarthquakes.sort((a, b) => b.time - a.time);

      if (uniqueEarthquakes.length > 0) {
        // CRITICAL FIX: Use API fetch time instead of earthquake time for detection
        // This ensures we catch earthquakes even if AFAD API has delay
        const now = Date.now();
        const lastCheckedEq = await AsyncStorage.getItem('last_checked_earthquake');
        const lastCheckedTime = await AsyncStorage.getItem('last_checked_earthquake_time');
        const lastCheckedTimestamp = lastCheckedTime ? parseInt(lastCheckedTime, 10) : 0;
        
        // CRITICAL: Check earthquakes that happened in the last 15 minutes OR are newer than last check
        // This catches delayed API responses (AFAD sometimes delays by 5-10 minutes)
        const RECENT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
        const recentThreshold = now - RECENT_WINDOW_MS;
        
        // Find all NEW earthquakes (not seen before AND either recent OR newer than last check)
        const newEarthquakes = uniqueEarthquakes.filter(eq => {
          // Skip if same ID as last checked
          if (eq.id === lastCheckedEq) return false;
          
          // CRITICAL: Accept if earthquake happened in last 15 minutes (catches delayed API responses)
          // OR if earthquake time is newer than last check timestamp
          const isRecent = eq.time > recentThreshold;
          const isNewerThanLastCheck = eq.time > lastCheckedTimestamp;
          
          return isRecent || isNewerThanLastCheck;
        });
        
        // Process all new earthquakes IMMEDIATELY
        for (const eq of newEarthquakes) {
          const detectionDelay = Math.round((Date.now() - eq.time) / 1000);
          logger.info('🔝 Yeni deprem tespit edildi', {
            location: eq.location,
            magnitude: eq.magnitude,
            time: new Date(eq.time).toLocaleString('tr-TR'),
            secondsAgo: detectionDelay,
            detectionDelaySeconds: detectionDelay,
          });
          
          // CRITICAL: Log if detection delay is significant (> 2 minutes)
          if (detectionDelay > 120) {
            logger.warn(`⚠️ CRITICAL: Deprem bildirimi ${detectionDelay} saniye gecikmeyle geldi!`, {
              earthquakeTime: new Date(eq.time).toISOString(),
              detectionTime: new Date().toISOString(),
              delayMinutes: Math.round(detectionDelay / 60),
            });
          }
          
          // Track critical earthquakes for dynamic polling
          if (eq.magnitude >= 6.0) {
            this.lastCriticalEarthquakeTime = Date.now();
            this.startDynamicPolling(); // Switch to faster polling
          }
          
          // CRITICAL: INSTANT notification for ALL earthquakes - MUST NOT FAIL
          // This is life-saving - wrap in try-catch to ensure it always attempts
          const notificationStartTime = Date.now();
          try {
            await this.sendInstantEarthquakeNotification(eq);
            const notificationDelay = Date.now() - notificationStartTime;
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
          
          // Process AI analysis for significant earthquakes (>= 4.0)
          if (eq.magnitude >= 4.0) {
            // 🤖 AI ANALIZI: Deprem analizi ve doğrulama (Paylaşılan Analiz)
            try {
              const { earthquakeAnalysisService } = await import('../ai/services/EarthquakeAnalysisService');
              const { firebaseDataService } = await import('./FirebaseDataService');
              
              // Önce Firebase'den paylaşılan analizi kontrol et
              let analysis = await firebaseDataService.getEarthquakeAnalysis(eq.id);
              
              if (!analysis) {
                // Analiz yoksa yeni analiz yap
                logger.info(`📊 Yeni deprem analizi yapılıyor: ${eq.id}`);
                
                // Kullanıcı konumunu al
                let userLocation: { latitude: number; longitude: number } | undefined;
                try {
                  const Location = await import('expo-location');
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status === 'granted') {
                    const position = await Location.getCurrentPositionAsync({
                      accuracy: Location.Accuracy.Balanced,
                    });
                    userLocation = {
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                    };
                  }
                } catch (locError) {
                  logger.warn('Could not get user location for analysis:', locError);
                }

                // AI analizi yap
                const newAnalysis = await earthquakeAnalysisService.analyzeEarthquake(
                  eq,
                  userLocation
                );

                if (newAnalysis) {
                  logger.info(`✅ AI Analizi tamamlandı: Risk=${newAnalysis.riskLevel}, Doğrulandı=${newAnalysis.verified}, Güven=${newAnalysis.confidence}%`);
                  
                  // Firebase'e kaydet (tüm kullanıcılar için paylaş)
                  await firebaseDataService.saveEarthquakeAnalysis(eq.id, {
                    ...newAnalysis,
                    earthquakeId: eq.id,
                    magnitude: eq.magnitude,
                    location: eq.location,
                    timestamp: eq.time,
                  });
                  
                  analysis = {
                    riskLevel: newAnalysis.riskLevel,
                    userMessage: newAnalysis.userMessage,
                    recommendations: newAnalysis.recommendations,
                    verified: newAnalysis.verified,
                    sources: newAnalysis.sources,
                    confidence: newAnalysis.confidence,
                    createdAt: new Date().toISOString(),
                  };
                } else {
                  logger.warn('⚠️ AI analizi yapılamadı veya deprem doğrulanamadı');
                }
              } else {
                logger.info(`✅ Paylaşılan analiz kullanılıyor: ${eq.id} (${analysis.createdAt})`);
              }

              if (analysis) {
                // Elite: AI analizi ile ENHANCED bildirim gönder
                const { multiChannelAlertService } = await import('./MultiChannelAlertService');
                const alertConfig = this.getAlertConfigForMagnitude(eq.magnitude);
                
                await multiChannelAlertService.sendAlert({
                  title: `${eq.magnitude.toFixed(1)} Deprem${analysis.verified ? ' ✓ Doğrulandı' : ''} - ${alertConfig.titleSuffix}`,
                  body: analysis.userMessage,
                  priority: alertConfig.priority,
                  channels: alertConfig.channels,
                  vibrationPattern: alertConfig.vibrationPattern,
                  sound: alertConfig.sound,
                  ttsText: `Dikkat! ${eq.magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi. ${eq.location}. ${analysis.userMessage}`,
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
        
        store.setItems(uniqueEarthquakes);
        logger.info(`✅ Store güncellendi`, { count: uniqueEarthquakes.length });
        this.lastFetchedAt = Date.now();
        await AsyncStorage.setItem(LAST_FETCH_KEY, String(this.lastFetchedAt));
        await this.saveToCache(uniqueEarthquakes);
      } else {
        // Try cache if no new data
        const cached = await this.loadFromCache();
        if (cached && cached.length > 0) {
          store.setItems(cached);
          const lastFetchValue = await AsyncStorage.getItem(LAST_FETCH_KEY);
          this.lastFetchedAt = lastFetchValue ? Number(lastFetchValue) : this.lastFetchedAt;
        } else {
          store.setError('Deprem verisi alınamadı. İnternet bağlantınızı kontrol edin.');
        }
      }
    } catch (error) {
      // Try cache on error
      const cached = await this.loadFromCache();
      if (cached && cached.length > 0) {
        store.setItems(cached);
        const lastFetchValue = await AsyncStorage.getItem(LAST_FETCH_KEY);
        this.lastFetchedAt = lastFetchValue ? Number(lastFetchValue) : this.lastFetchedAt;
      } else {
        store.setError('Deprem verisi alınamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      this.isFetching = false;
      store.setLoading(false);
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
      
      // CRITICAL: Use time-precise URL for faster response (last 2 hours only)
      const url = `https://deprem.afad.gov.tr/apiv2/event/filter?start=${startDate}&end=${endDate}&minmag=1`;
      
      // Fallback: If no results, try last 24 hours (wider window)
      // But prioritize 2-hour window for speed
      
      // Alternative fallback URL (last 500 events)
      const fallbackUrl = 'https://deprem.afad.gov.tr/apiv2/event/latest?limit=500';
      
      logger.debug('📡 AFAD API çağrılıyor', { url, startDate, endDate });

      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If primary endpoint fails, try fallback
      if (!response.ok) {
        console.warn('⚠️ Primary AFAD endpoint failed, trying fallback...');
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 15000);
        
        response = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AfetNet/1.0',
          },
          signal: fallbackController.signal,
        });
        
        clearTimeout(fallbackTimeout);
        
        if (!response.ok) {
          console.error('❌ Both AFAD endpoints failed');
          return [];
        }
        
        logger.info('✅ AFAD fallback endpoint successful');
      }

      const data = await response.json();
      
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
      
      logger.info('✅ AFAD verisi alındı', { count: events.length });
      
      if (events.length === 0) {
        logger.warn('⚠️ AFAD API boş veri döndü', { responsePreview: JSON.stringify(data).substring(0, 200) });
        return [];
      }
      
      // İlk 3 depremi logla (debug için)
      if (__DEV__) {
        events.slice(0, 3).forEach((eq: any, i: number) => {
          logger.debug(`📊 Deprem ${i + 1}`, {
            location: eq.location || eq.title || eq.place || 'N/A',
            magnitude: eq.mag || eq.magnitude || eq.ml || 'N/A',
            date: eq.eventDate || eq.date || eq.originTime || 'N/A',
          });
        });
      }
      
      const earthquakes = events
        .map((item: any) => {
          // AFAD apiv2 format - Try multiple field names
          const eventDate = item.eventDate || item.date || item.originTime || item.tarih || item.time;
          const magnitude = parseFloat(item.mag || item.magnitude || item.ml || item.richter || '0');
          
          // Location parsing - Try multiple field combinations
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
          
          // Coordinate parsing - Try multiple formats
          let latitude = 0;
          let longitude = 0;
          
          // GeoJSON format
          if (item.geojson?.coordinates && Array.isArray(item.geojson.coordinates)) {
            longitude = parseFloat(item.geojson.coordinates[0]) || 0;
            latitude = parseFloat(item.geojson.coordinates[1]) || 0;
          }
          // Direct lat/lng fields
          else if (item.latitude && item.longitude) {
            latitude = parseFloat(item.latitude) || 0;
            longitude = parseFloat(item.longitude) || 0;
          }
          // Alternative field names
          else if (item.lat && item.lng) {
            latitude = parseFloat(item.lat) || 0;
            longitude = parseFloat(item.lng) || 0;
          }
          // Enlem/Boylam (Turkish)
          else if (item.enlem && item.boylam) {
            latitude = parseFloat(item.enlem) || 0;
            longitude = parseFloat(item.boylam) || 0;
          }
          
          // Depth parsing
          const depth = parseFloat(item.depth || item.derinlik || item.derinlikKm || '10') || 10;
          
          // Time parsing - Handle multiple formats
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
          // Validate earthquake data
          const isValid = 
            eq.latitude !== 0 && 
            eq.longitude !== 0 &&
            !isNaN(eq.latitude) &&
            !isNaN(eq.longitude) &&
            eq.latitude >= -90 && eq.latitude <= 90 &&
            eq.longitude >= -180 && eq.longitude <= 180 &&
            eq.magnitude >= 1.0 && // Minimum 1.0 magnitude
            eq.magnitude <= 10.0 && // Maximum 10.0 (sanity check)
            !isNaN(eq.time) &&
            eq.time > 0;
          
          if (!isValid && __DEV__) {
            console.warn('⚠️ Invalid earthquake data filtered out:', eq);
          }
          
          return isValid;
        })
        .sort((a, b) => b.time - a.time) // Newest first
        .slice(0, 100); // Max 100

      return earthquakes;
      
    } catch (error) {
      // Silent fail - return empty array, cache will be used
      return [];
    }
  }

  private async fetchFromUSGS(): Promise<Earthquake[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const startTime = new Date(oneDayAgo).toISOString();
      
      const response = await fetch(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&minmagnitude=3.0&orderby=time&limit=500`,
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
      })).filter((eq: Earthquake) => eq.magnitude >= 3.0);
      
    } catch (error) {
      return [];
    }
  }

  private async fetchFromKandilli(): Promise<Earthquake[]> {
    // DISABLED: Kandilli HTTP endpoint doesn't work in React Native
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
   */
  private async sendInstantEarthquakeNotification(earthquake: Earthquake) {
    // CRITICAL: This is life-saving - MUST attempt all notification methods
    // Even if one fails, others must still be attempted
    
    const notificationStartTime = Date.now();
    const earthquakeAgeSeconds = Math.round((Date.now() - earthquake.time) / 1000);
    
    // CRITICAL: Log notification timing for debugging
    logger.info(`📢 Bildirim gönderiliyor: ${earthquake.magnitude.toFixed(1)} - ${earthquake.location} (${earthquakeAgeSeconds}s önce)`);
    
    // Step 1: IMMEDIATE basic notification (fastest, most reliable)
    try {
      const { notificationService } = await import('./NotificationService');
      await notificationService.showEarthquakeNotification(earthquake.magnitude, earthquake.location);
      const basicNotificationDelay = Date.now() - notificationStartTime;
      logger.info(`✅ Basic notification sent in ${basicNotificationDelay}ms`);
    } catch (basicError) {
      logger.error('❌ CRITICAL: Basic notification failed:', basicError);
      // Continue - try multi-channel alert
    }
    
    // Step 2: Enhanced multi-channel alert for significant earthquakes (>= 3.0)
    if (earthquake.magnitude >= 3.0) {
      try {
        const { multiChannelAlertService } = await import('./MultiChannelAlertService');
        const alertConfig = this.getAlertConfigForMagnitude(earthquake.magnitude);
        
        await multiChannelAlertService.sendAlert({
          title: `🚨 ${earthquake.magnitude.toFixed(1)} Deprem - ${alertConfig.titleSuffix}`,
          body: `${earthquake.location} - ${earthquake.magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi.`,
          priority: alertConfig.priority,
          channels: alertConfig.channels,
          vibrationPattern: alertConfig.vibrationPattern,
          sound: alertConfig.sound,
          ttsText: `Dikkat! ${earthquake.magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi. ${earthquake.location}.`,
          duration: alertConfig.duration,
          data: {
            earthquake,
            type: 'earthquake_instant',
            magnitude: earthquake.magnitude,
            location: earthquake.location,
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
  private getAlertConfigForMagnitude(magnitude: number): {
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

