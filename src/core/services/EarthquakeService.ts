/**
 * EARTHQUAKE SERVICE - Clean Implementation
 * Fetches earthquake data from AFAD/USGS/Kandilli and updates store
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useEarthquakeStore, Earthquake } from '../stores/earthquakeStore';
import { createLogger } from '../utils/logger';
import { autoCheckinService } from './AutoCheckinService';
import { emergencyModeService } from './EmergencyModeService';
import { formatToTurkishDateTime, getTimeDifferenceTurkish, parseAFADDate } from '../utils/timeUtils';

const logger = createLogger('EarthquakeService');

const CACHE_KEY = 'afetnet_earthquakes_cache';
const LAST_FETCH_KEY = 'afetnet_earthquakes_last_fetch';
const POLL_INTERVAL = 10000; // 10 seconds - CRITICAL: Ultra-fast polling for early warnings (was 30s - TOO SLOW!)

class EarthquakeService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Initial fetch
    await this.fetchEarthquakes();
    
    // Start polling
    this.intervalId = setInterval(() => {
      this.fetchEarthquakes();
    }, POLL_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  async fetchEarthquakes() {
    const store = useEarthquakeStore.getState();
    store.setLoading(true);
    store.setError(null); // Clear previous errors

    try {
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
        const latestEq = uniqueEarthquakes[0];
        const lastCheckedEq = await AsyncStorage.getItem('last_checked_earthquake');
        
        if (__DEV__) {
          logger.info('🔝 EN SON DEPREM:', {
            location: latestEq.location,
            magnitude: latestEq.magnitude,
            time: formatToTurkishDateTime(latestEq.time),
            zamanFarki: getTimeDifferenceTurkish(latestEq.time)
          });
        }
        
        // CRITICAL: Check if this is a new earthquake and send notification
        if (latestEq.id !== lastCheckedEq) {
          await AsyncStorage.setItem('last_checked_earthquake', latestEq.id);
          
          // Get settings to check notification thresholds
          const { useSettingsStore } = await import('../stores/settingsStore');
          const settings = useSettingsStore.getState();
          
          // Send notification if magnitude meets threshold
          if (latestEq.magnitude >= settings.minMagnitudeForNotification) {
            // Check distance filter if set
            let shouldNotify = true;
            if (settings.maxDistanceForNotification > 0) {
              // Distance check would require user location - for now, notify if distance filter is not critical
              // In production, calculate distance and filter accordingly
              shouldNotify = true; // Will be enhanced with location-based filtering
            }
            
            if (shouldNotify && settings.notificationPush) {
              const { notificationService } = await import('./NotificationService');
              await notificationService.showEarthquakeNotification(
                latestEq.magnitude,
                latestEq.location
              );
              logger.info(`📢 Notification sent: ${latestEq.magnitude.toFixed(1)}M - ${latestEq.location}`);
            }
          }
          
          // Trigger auto check-in for new significant earthquakes (magnitude >= 4.0)
          if (latestEq.magnitude >= 4.0) {
            logger.info(`Triggering AutoCheckin for magnitude ${latestEq.magnitude} earthquake`);
            autoCheckinService.startCheckIn(latestEq.magnitude);
            
            // 🚨 CRITICAL: Trigger emergency mode for major earthquakes (6.0+)
            if (emergencyModeService.shouldTriggerEmergencyMode(latestEq)) {
              logger.info(`🚨 CRITICAL EARTHQUAKE DETECTED: ${latestEq.magnitude} - Activating emergency mode`);
              await emergencyModeService.activateEmergencyMode(latestEq);
            }
          }
        }
        
        store.setItems(uniqueEarthquakes);
        if (__DEV__) {
          logger.info(`✅ Store güncellendi: ${uniqueEarthquakes.length} deprem`);
        }
        await this.saveToCache(uniqueEarthquakes);
      } else {
        // Try cache if no new data
        const cached = await this.loadFromCache();
        if (cached && cached.length > 0) {
          store.setItems(cached);
        } else {
          store.setError('Deprem verisi alınamadı. İnternet bağlantınızı kontrol edin.');
        }
      }
    } catch (error: any) {
      logger.error('❌ Failed to fetch earthquakes:', {
        error: error?.message,
        name: error?.name,
        stack: error?.stack
      });
      
      // ELITE: Try cache on error with detailed error handling
      const cached = await this.loadFromCache();
      if (cached && cached.length > 0) {
        store.setItems(cached);
        // ELITE: Set a warning instead of error if cache is available
        const cacheAge = await AsyncStorage.getItem(LAST_FETCH_KEY);
        if (cacheAge) {
          const ageMs = Date.now() - parseInt(cacheAge, 10);
          const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
          if (ageHours > 1) {
            store.setError(`Eski veriler gösteriliyor (${ageHours} saat önce). İnternet bağlantınızı kontrol edin.`);
          } else {
            store.setError(null); // Clear error if cache is fresh
          }
        }
      } else {
        // ELITE: Provide specific error messages based on error type
        let errorMessage = 'Deprem verisi alınamadı. Lütfen tekrar deneyin.';
        
        if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
          errorMessage = 'Bağlantı zaman aşımına uğradı. İnternet bağlantınızı kontrol edin.';
        } else if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
          errorMessage = 'İnternet bağlantısı sorunu. Lütfen bağlantınızı kontrol edin.';
        } else if (error?.message?.includes('JSON') || error?.message?.includes('parse')) {
          errorMessage = 'Veri işleme hatası. Lütfen tekrar deneyin.';
        }
        
        store.setError(errorMessage);
      }
    } finally {
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

      // AFAD API v2 - Son 7 gün (Daha geniş aralık - Apple şartı)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const startDate = sevenDaysAgo.toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];
      
      const url = `https://deprem.afad.gov.tr/apiv2/event/filter?start=${startDate}&end=${endDate}&minmag=1`;
      
      // Alternative fallback URL (last 500 events)
      const fallbackUrl = 'https://deprem.afad.gov.tr/apiv2/event/latest?limit=500';
      
      if (__DEV__) {
        logger.debug('📡 AFAD API çağrılıyor:', url);
        logger.debug('📅 Tarih aralığı:', startDate, 'dan', endDate, 'a kadar');
      }

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
        if (__DEV__) {
          logger.warn('⚠️ Primary AFAD endpoint failed, trying fallback...');
        }
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
          logger.error('❌ Both AFAD endpoints failed');
          return [];
        }
        
        if (__DEV__) {
          logger.info('✅ Fallback endpoint successful');
        }
      }

      const data = await response.json();
      
      // AFAD apiv2 returns array directly
      const events = Array.isArray(data) ? data : [];
      
      if (__DEV__) {
        logger.info(`✅ AFAD'dan ${events.length} deprem verisi alındı`);
      }
      
      if (events.length === 0) {
        if (__DEV__) {
          logger.warn('⚠️ AFAD API boş veri döndü!');
        }
        return [];
      }
      
      // İlk 3 depremi logla (sadece development'ta)
      if (__DEV__) {
        logger.debug('📊 İlk 3 deprem:');
        events.slice(0, 3).forEach((eq: any, i: number) => {
          const mag = eq.mag || eq.magnitude || eq.ml || 'N/A';
          const date = eq.eventDate || eq.date || eq.originTime || 'N/A';
          const loc = eq.location || eq.ilce || eq.sehir || 'N/A';
          logger.debug(`  ${i + 1}. ${loc} - Büyüklük: ${mag} - Tarih: ${date}`);
        });
      }
      
      // ELITE: Validate and transform earthquake data with comprehensive error handling
      const earthquakes = events
        .map((item: any) => {
          try {
            // AFAD apiv2 format
            const eventDate = item.eventDate || item.date || item.originTime;
            const magnitude = parseFloat(item.mag || item.magnitude || item.ml || '0');
            
            // ELITE: Validate magnitude
            if (isNaN(magnitude) || magnitude < 0 || magnitude > 10) {
              if (__DEV__) {
                logger.warn('Invalid magnitude detected:', magnitude, item);
              }
              return null;
            }
            
            // Location parsing with validation
            const locationParts = [
              item.location,
              item.ilce,
              item.sehir,
              item.title,
              item.place
            ].filter(Boolean);
            
            const location = locationParts.length > 0 
              ? locationParts.join(', ').trim()
              : 'Türkiye';
            
            // ELITE: Validate location is not empty
            if (!location || location.length === 0) {
              if (__DEV__) {
                logger.warn('Empty location detected:', item);
              }
              return null;
            }
            
            // ELITE: Parse coordinates with validation
            const latitude = parseFloat(item.geojson?.coordinates?.[1] || item.latitude || item.lat || '0');
            const longitude = parseFloat(item.geojson?.coordinates?.[0] || item.longitude || item.lng || '0');
            
            // ELITE: Validate coordinates (Turkey bounds: 35-43N, 25-45E)
            if (isNaN(latitude) || isNaN(longitude) || 
                latitude < 35 || latitude > 43 || 
                longitude < 25 || longitude > 45) {
              if (__DEV__) {
                // Filter out earthquakes outside Turkey bounds (this is expected, not an error)
                if (__DEV__) {
                  logger.debug('Filtered earthquake outside Turkey bounds:', { latitude, longitude, location: item.location });
                }
              }
              return null;
            }
            
            // ELITE: Parse depth with validation
            const depth = parseFloat(item.depth || item.derinlik || '10');
            if (isNaN(depth) || depth < 0 || depth > 1000) {
              if (__DEV__) {
                logger.warn('Invalid depth detected:', depth, item);
              }
            }
            
            // ELITE: Parse time with validation and timezone conversion
            // AFAD API returns dates in Turkey timezone - parse correctly
            let time: number;
            if (eventDate) {
              // Use specialized AFAD date parser that handles timezone correctly
              time = parseAFADDate(eventDate);
              
              // Validate parsed time is reasonable (not in future, not too old)
              const now = Date.now();
              const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
              if (time > now || time < now - maxAge) {
                if (__DEV__) {
                  logger.warn('Parsed time out of range, using current time:', {
                    parsed: time,
                    now,
                    eventDate
                  });
                }
                time = Date.now();
              }
            } else {
              time = Date.now();
              if (__DEV__) {
                logger.warn('Missing date, using current time:', item);
              }
            }
            
            // ELITE: Generate stable ID
            const eventId = item.eventID || item.eventId || item.id;
            const id = eventId 
              ? `afad-${eventId}`
              : `afad-${Math.round(latitude * 1000)}-${Math.round(longitude * 1000)}-${time}`;
            
            return {
              id,
              magnitude,
              location,
              depth: isNaN(depth) ? 10 : Math.max(0, Math.min(1000, depth)),
              time,
              latitude,
              longitude,
              source: 'AFAD' as const,
            };
          } catch (parseError: any) {
            // ELITE: Log parse errors but continue processing other items
            if (__DEV__) {
              logger.warn('Error parsing earthquake item:', parseError?.message, item);
            }
            return null;
          }
        })
        .filter((eq: Earthquake | null): eq is Earthquake => 
          eq !== null &&
          eq.latitude >= 35 && eq.latitude <= 43 &&
          eq.longitude >= 25 && eq.longitude <= 45 &&
          eq.magnitude >= 1.0 && eq.magnitude <= 10 &&
          eq.location && eq.location.length > 0
        )
        .sort((a, b) => b.time - a.time) // Newest first
        .slice(0, 100); // Max 100

      if (__DEV__) {
        logger.info(`✅ Validated ${earthquakes.length} earthquakes from ${events.length} raw events`);
      }

      return earthquakes;
      
    } catch (error: any) {
      // ELITE: Log error details instead of silent fail
      logger.error('❌ Failed to fetch from AFAD:', {
        error: error?.message,
        name: error?.name,
        url: error?.url || 'unknown'
      });
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
        time: data.eventDate ? new Date(data.eventDate).getTime() : Date.now(),
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

