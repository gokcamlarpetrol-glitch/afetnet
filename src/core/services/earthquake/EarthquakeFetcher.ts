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

// ELITE: Type-safe error message extraction
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function getErrorName(error: unknown): string {
  return error instanceof Error ? getErrorName(error) : 'UnknownError';
}

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
  fetchFromKandilli: () => Promise<Earthquake[]>,
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
  // ELITE: Multi-tier strategy for fastest and most reliable data
  // Fetch from ALL sources in parallel for cross-verification
  const [unifiedData, afadHTMLData, afadAPIData, kandilliAPIData] = await Promise.allSettled([
    unifiedEarthquakeAPI.fetchRecent(), // Tier 1: Unified API
    sourceAFAD ? afadHTMLProvider.fetchRecent() : Promise.resolve([]), // Tier 2: AFAD HTML
    sourceAFAD ? fetchFromAFAD() : Promise.resolve([]), // Tier 3: Direct AFAD API
    fetchFromKandilli(), // Tier 4: Kandilli API (Now Enabled)
  ]);

  let afadList: Earthquake[] = [];
  let kandilliList: Earthquake[] = [];

  // --- 1. PROCESS AFAD DATA ---
  // Priority: HTML > API > Unified(AFAD)
  if (afadHTMLData.status === 'fulfilled' && afadHTMLData.value.length > 0) {
    afadList = afadHTMLData.value;
    result.sources.afadHTML = true;
    if (__DEV__) logger.info(`✅ AFAD (HTML): ${afadList.length} veri`);
  }
  else if (afadAPIData.status === 'fulfilled' && afadAPIData.value.length > 0) {
    // API fallback
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recent = afadAPIData.value.filter(eq => eq.time >= oneDayAgo);
    if (recent.length > 0) {
      afadList = recent;
      result.sources.afadAPI = true;
      if (__DEV__) logger.info(`✅ AFAD (API): ${afadList.length} veri`);
    }
  }

  // --- 2. PROCESS KANDILLI DATA ---
  if (kandilliAPIData.status === 'fulfilled' && kandilliAPIData.value.length > 0) {
    kandilliList = kandilliAPIData.value;
    result.sources.kandilliAPI = true;
    if (__DEV__) logger.info(`✅ Kandilli: ${kandilliList.length} veri`);
  }

  // --- 3. FUSION & VERIFICATION ---
  // Lazy import to avoid circular dependency issues if any
  const { earthquakeFusionService } = require('./EarthquakeFusionService');

  // Fuse the lists!
  result.earthquakes = earthquakeFusionService.fuse(afadList, kandilliList);

  if (__DEV__) {
    logger.info(`🧬 FÜZYON SONUCU: ${afadList.length} AFAD + ${kandilliList.length} Kandilli -> ${result.earthquakes.length} Birleştirilmiş Deprem`);
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
          } catch (fetchError: unknown) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              throw new Error('Request timeout');
            }
            throw fetchError;
          }
        },
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
    } catch (resilienceError: unknown) {
      if (__DEV__) {
        logger.warn('⚠️ Primary AFAD endpoint failed with resilience, trying fallback...');
      }

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
          } catch (fetchError: unknown) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              throw new Error('Request timeout');
            }
            throw fetchError;
          }
        },
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
    }
  } catch (error: unknown) {
    const errMsg = getErrorMessage(error);
    const errName = getErrorName(error);

    const isNetworkError =
      errMsg.includes('Network request failed') ||
      errMsg.includes('network') ||
      errName === 'TypeError' ||
      errName === 'NetworkError';

    const isTimeout =
      errName === 'AbortError' ||
      errMsg.includes('aborted') ||
      errMsg.includes('timeout') ||
      errMsg === 'Request timeout' ||
      errMsg === 'Fallback request timeout';

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
  } catch (error: unknown) {
    if (__DEV__) {
      logger.debug('Kandilli fetch error:', getErrorMessage(error));
    }
    return [];
  }
}

