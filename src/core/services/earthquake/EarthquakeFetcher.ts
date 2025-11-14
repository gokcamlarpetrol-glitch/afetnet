/**
 * EARTHQUAKE FETCHER - ELITE MODULAR
 * Fetches earthquake data from various sources
 */

import { Earthquake } from '../../stores/earthquakeStore';
import { createLogger } from '../../utils/logger';
import { unifiedEarthquakeAPI } from '../providers/UnifiedEarthquakeAPI';
import { afadHTMLProvider } from '../providers/AFADHTMLProvider';
import { kandilliHTMLProvider } from '../providers/KandilliHTMLProvider';
import { networkResilienceService } from '../NetworkResilienceService';
import { processAFADEvents } from './EarthquakeDataProcessor';

const logger = createLogger('EarthquakeFetcher');

export interface FetchResult {
  earthquakes: Earthquake[];
  sources: {
    unified: boolean;
    afadHTML: boolean;
    kandilliHTML: boolean;
    afadAPI: boolean;
    kandilliAPI: boolean;
  };
}

/**
 * Fetch earthquakes from all sources using multi-tier strategy
 */
export async function fetchAllEarthquakes(
  sourceAFAD: boolean,
  fetchFromAFAD: () => Promise<Earthquake[]>,
  fetchFromKandilli: () => Promise<Earthquake[]>
): Promise<FetchResult> {
  const result: FetchResult = {
    earthquakes: [],
    sources: {
      unified: false,
      afadHTML: false,
      kandilliHTML: false,
      afadAPI: false,
      kandilliAPI: false,
    },
  };

  // ELITE: Multi-tier strategy for fastest and most reliable AFAD data only
  // CRITICAL: Only fetch AFAD data - Kandilli removed per user request
  // Use Promise.allSettled with shorter timeouts for faster initial load
  const [unifiedData, afadHTMLData, afadAPIData] = await Promise.allSettled([
    unifiedEarthquakeAPI.fetchRecent(), // Tier 1: Unified API (fastest, may include AFAD)
    sourceAFAD ? afadHTMLProvider.fetchRecent() : Promise.resolve([]), // Tier 2: AFAD HTML (MOST RELIABLE)
    sourceAFAD ? fetchFromAFAD() : Promise.resolve([]), // Tier 3: Direct AFAD API
  ]);

  // Process AFAD HTML first (MOST RELIABLE)
  if (afadHTMLData.status === 'fulfilled' && afadHTMLData.value.length > 0) {
    result.earthquakes.push(...afadHTMLData.value);
    result.sources.afadHTML = true;
    if (__DEV__) {
      const latest = afadHTMLData.value[0];
      const latestTime = new Date(latest.time).toLocaleString('tr-TR', { 
        timeZone: 'Europe/Istanbul',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      logger.info(`✅ AFAD HTML: ${afadHTMLData.value.length} deprem verisi alındı - EN GÜVENİLİR (En son: ${latest.magnitude} ML - ${latestTime})`);
    }
  } else if (afadHTMLData.status === 'rejected' && __DEV__) {
    logger.warn('⚠️ AFAD HTML başarısız:', afadHTMLData.reason?.message);
  }

  // Process unified API data (filter to only AFAD)
  if (unifiedData.status === 'fulfilled' && unifiedData.value.length > 0) {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    // CRITICAL: Only include AFAD earthquakes from unified API
    const afadOnlyUnifiedData = unifiedData.value.filter(eq => eq.source === 'AFAD' && eq.time >= oneDayAgo);
    
    if (afadOnlyUnifiedData.length > 0) {
      result.earthquakes.push(...afadOnlyUnifiedData);
      result.sources.unified = true;
      if (__DEV__) {
        logger.info(`✅ Unified API: ${afadOnlyUnifiedData.length} güncel AFAD deprem verisi alındı - EN HIZLI`);
      }
    } else if (__DEV__) {
      logger.debug(`⚠️ Unified API: ${unifiedData.value.length} deprem var ama AFAD verisi yok veya eski`);
    }
  } else if (unifiedData.status === 'rejected' && __DEV__) {
    logger.debug('⚠️ Unified API başarısız:', unifiedData.reason?.message);
  }

  // Process AFAD API data
  if (afadAPIData.status === 'fulfilled' && afadAPIData.value.length > 0) {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recentAPIData = afadAPIData.value.filter(eq => eq.time >= oneDayAgo);
    
    if (recentAPIData.length > 0) {
      result.earthquakes.push(...recentAPIData);
      result.sources.afadAPI = true;
      if (__DEV__) {
        logger.info(`✅ AFAD API: ${recentAPIData.length} güncel deprem verisi alındı (son 24 saat)`);
      }
    } else if (__DEV__) {
      // ELITE: Reduce log noise - this is expected behavior (HTML fallback is used)
      // Only log at debug level to avoid production noise
      const oldestTime = afadAPIData.value.length > 0 
        ? new Date(afadAPIData.value[afadAPIData.value.length - 1].time).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
        : 'N/A';
      logger.debug(`ℹ️ AFAD API: ${afadAPIData.value.length} deprem var ama hepsi 24 saatten eski (HTML fallback kullanılıyor). En eski: ${oldestTime}`);
    }
  } else if (afadAPIData.status === 'rejected' && __DEV__) {
    logger.debug('AFAD API fetch failed:', afadAPIData.reason?.message);
  }

  // CRITICAL: Kandilli removed per user request - only AFAD data is shown
  
  // CRITICAL: Filter to only AFAD earthquakes
  result.earthquakes = result.earthquakes.filter(eq => eq.source === 'AFAD');
  
  if (__DEV__ && result.earthquakes.length > 0) {
    logger.info(`📊 Toplam ${result.earthquakes.length} AFAD deprem verisi alındı (sadece AFAD)`);
  }

  return result;
}

/**
 * Fetch from AFAD API with fallback
 */
export async function fetchFromAFADAPI(): Promise<Earthquake[]> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    const url = `https://deprem.afad.gov.tr/apiv2/event/filter?start=${startDate}&end=${endDate}&minmag=1&limit=500`;
    
    const fallbackUrl = 'https://deprem.afad.gov.tr/apiv2/event/latest?limit=500';
    
    if (__DEV__) {
      logger.debug('📡 AFAD API çağrılıyor:', url);
    }

    const endpoint = 'AFAD';
    
    try {
      const data = await networkResilienceService.executeWithResilience<Earthquake[]>(
        endpoint,
        url,
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);
          
          try {
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'User-Agent': 'AfetNet/1.0',
              },
              signal: controller.signal,
              cache: 'no-store',
            });
            clearTimeout(timeoutId);
            return response;
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError?.name === 'AbortError') {
              throw new Error('Request timeout');
            }
            throw fetchError;
          }
        }
      );

      let events: any[] = Array.isArray(data) ? data : [];
      events = events.sort((a: any, b: any) => {
        const dateA = a.eventDate || a.date || a.originTime || '';
        const dateB = b.eventDate || b.date || b.originTime || '';
        return dateB.localeCompare(dateA);
      });

      if (events.length === 0) {
        if (__DEV__) {
          logger.warn('⚠️ AFAD API boş veri döndü!');
        }
        return [];
      }

      return processAFADEvents(events);
    } catch (resilienceError: any) {
      if (__DEV__) {
        logger.warn('⚠️ Primary AFAD endpoint failed with resilience, trying fallback...');
      }
      
      // Try fallback endpoint
      try {
        const fallbackData = await networkResilienceService.executeWithResilience<Earthquake[]>(
          endpoint,
          fallbackUrl,
          async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            
            try {
              const response = await fetch(fallbackUrl, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache',
                  'User-Agent': 'AfetNet/1.0',
                },
                signal: controller.signal,
                cache: 'no-store',
              });
              clearTimeout(timeoutId);
              return response;
            } catch (fetchError: any) {
              clearTimeout(timeoutId);
              if (fetchError?.name === 'AbortError') {
                throw new Error('Request timeout');
              }
              throw fetchError;
            }
          }
        );

        let events: any[] = Array.isArray(fallbackData) ? fallbackData : [];
        events = events.sort((a: any, b: any) => {
          const dateA = a.eventDate || a.date || a.originTime || '';
          const dateB = b.eventDate || b.date || b.originTime || '';
          return dateB.localeCompare(dateA);
        });

        if (events.length === 0) {
          throw new Error('Both AFAD endpoints returned empty data');
        }

        return processAFADEvents(events);
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
  } catch (error: any) {
    const isNetworkError = 
      error?.message?.includes('Network request failed') ||
      error?.message?.includes('network') ||
      error?.name === 'TypeError' ||
      error?.name === 'NetworkError';
    
    const isTimeout = 
      error?.name === 'AbortError' || 
      error?.message?.includes('aborted') ||
      error?.message?.includes('timeout') ||
      error?.message === 'Request timeout' ||
      error?.message === 'Fallback request timeout';
    
    if (__DEV__) {
      logger.warn('⚠️ AFAD API başarısız, HTML fallback deneniyor...');
    }
    
    try {
      const htmlData = await afadHTMLProvider.fetchRecent();
      if (htmlData.length > 0) {
        if (__DEV__) {
          logger.info(`✅ AFAD HTML fallback başarılı: ${htmlData.length} deprem alındı`);
        }
        return htmlData;
      }
    } catch (htmlError) {
      if (__DEV__) {
        logger.debug('AFAD HTML fallback başarısız:', htmlError);
      }
    }
    
    return [];
  }
}

/**
 * Fetch from Kandilli API
 */
export async function fetchFromKandilliAPI(): Promise<Earthquake[]> {
  try {
    const { kandilliProvider } = await import('../providers/KandilliProvider');
    const earthquakes = await kandilliProvider.fetchRecent();
    
    if (__DEV__ && earthquakes.length > 0) {
      logger.info(`✅ Kandilli'den ${earthquakes.length} deprem verisi alındı`);
    }
    
    return earthquakes;
  } catch (error: any) {
    if (__DEV__) {
      logger.debug('Kandilli fetch error:', error?.message || String(error));
    }
    return [];
  }
}

