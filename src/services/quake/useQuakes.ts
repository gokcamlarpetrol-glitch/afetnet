import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useSettings } from '../../store/settings';
import { providerRegistry } from './providers';
import { QuakeItem, QuakeProvider } from './types';

const CACHE_KEY = 'afn/quakes/cache/v1';
const LAST_FETCH_KEY = 'afn/quakes/lastFetch/v1';

interface QuakeState {
  items: QuakeItem[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  source: string;
  fallbackUsed: boolean;
}

/**
 * CRITICAL: Completely rewritten to eliminate ALL infinite loop possibilities
 * 
 * Key changes:
 * 1. getState() pattern instead of selectors to prevent re-renders
 * 2. All settings accessed directly from store getState()
 * 3. No callback depends on another callback
 * 4. Polling interval managed entirely via refs
 */
export function useQuakes() {
  const [state, setState] = useState<QuakeState>({
    items: [],
    loading: false,
    error: null,
    lastFetch: null,
    source: '',
    fallbackUsed: false,
  });

  // CRITICAL: Internal fetch function - NO dependencies, NO selectors, uses getState() directly
  const fetchQuakesInternal = useRef(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        // Offline - load from cache
        try {
          const cached = await AsyncStorage.getItem(CACHE_KEY);
          const lastFetch = await AsyncStorage.getItem(LAST_FETCH_KEY);
          
          if (cached) {
            const items = JSON.parse(cached);
            setState({
              items,
              loading: false,
              error: 'Çevrimdışı - önbellek kullanılıyor',
              lastFetch: lastFetch ? parseInt(lastFetch) : null,
              source: 'cache' as any,
              fallbackUsed: false,
            });
            return;
          }
        } catch (cacheError) {
          logger.warn('Failed to load cache:', cacheError);
        }
        
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: 'Çevrimdışı ve önbellek yok',
        }));
        return;
      }

      // Online - fetch from provider
      // CRITICAL: Get settings directly from store, NOT via selector
      const settings = useSettings.getState();
      const currentProvider = settings.quakeProvider;
      const provider = providerRegistry[currentProvider];
      let items: QuakeItem[] = [];
      let source = currentProvider;
      let fallbackUsed = false;

      try {
        items = await provider.fetchRecent();
        
        // Save to cache
        try {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items));
          await AsyncStorage.setItem(LAST_FETCH_KEY, Date.now().toString());
        } catch (cacheError) {
          logger.warn('Failed to save cache:', cacheError);
        }
      } catch (providerError) {
        logger.warn(`${currentProvider} provider failed, trying fallback:`, providerError);
        
        // Try cache first
        try {
          const cached = await AsyncStorage.getItem(CACHE_KEY);
          if (cached) {
            items = JSON.parse(cached);
            source = 'cache' as any;
          }
        } catch (cacheError) {
          logger.warn('Failed to load cache:', cacheError);
        }
        
        // If cache empty, try USGS fallback
        if (items.length === 0) {
          try {
            const usgsProvider = providerRegistry['USGS'];
            items = await usgsProvider.fetchRecent();
            source = 'USGS (fallback)' as any;
            fallbackUsed = true;
            
            // Save fallback to cache
            try {
              await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items));
              await AsyncStorage.setItem(LAST_FETCH_KEY, Date.now().toString());
            } catch (cacheError) {
              logger.warn('Failed to save fallback cache:', cacheError);
            }
          } catch (fallbackError) {
            logger.error('All providers failed:', fallbackError);
            setState(prev => ({
              ...prev,
              loading: false,
              error: 'Tüm veri kaynakları başarısız oldu',
            }));
            return;
          }
        }
      }

      // Sort by time (newest first)
      items.sort((a, b) => b.time - a.time);

      setState({
        items,
        loading: false,
        error: null,
        lastFetch: Date.now(),
        source,
        fallbackUsed,
      });
    } catch (error) {
      logger.error('Fatal error in fetchQuakesInternal:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Deprem verisi alınamadı',
      }));
    }
  });

  // CRITICAL: Load cache on mount ONCE
  useEffect(() => {
    const loadInitialCache = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        const lastFetch = await AsyncStorage.getItem(LAST_FETCH_KEY);
        
        if (cached) {
          const items = JSON.parse(cached);
          setState(prev => ({
            ...prev,
            items,
            lastFetch: lastFetch ? parseInt(lastFetch) : null,
            source: 'cache',
          }));
        }
      } catch (error) {
        logger.warn('Failed to load initial cache:', error);
      }
    };

    loadInitialCache();
  }, []); // CRITICAL: Empty deps - run ONCE on mount

  // CRITICAL: Set up polling interval ONCE - get pollMs from store getState()
  useEffect(() => {
    // Initial fetch
    fetchQuakesInternal.current();

    // Get polling interval from store (CRITICAL: use getState() not selector)
    const settings = useSettings.getState();
    const pollInterval = settings.pollMs || 90000; // Default 90 seconds

    // Set up interval
    const interval = (globalThis as any).setInterval(() => {
      fetchQuakesInternal.current();
    }, pollInterval);

    return () => (globalThis as any).clearInterval(interval);
  }, []); // CRITICAL: Empty deps - run ONCE on mount, uses getState() for settings

  // CRITICAL: Stable refresh function - NEVER changes
  const refresh = useCallback(() => {
    return fetchQuakesInternal.current();
  }, []); // CRITICAL: Empty deps - function NEVER changes

  // CRITICAL: Stable pull function - NEVER changes
  const pull = useCallback(() => {
    return fetchQuakesInternal.current();
  }, []); // CRITICAL: Empty deps - function NEVER changes

  return {
    ...state,
    refresh,
    pull,
  };
}
