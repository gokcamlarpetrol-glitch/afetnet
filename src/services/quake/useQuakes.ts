import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';
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

export function useQuakes() {
  const [state, setState] = useState<QuakeState>({
    items: [],
    loading: false,
    error: null,
    lastFetch: null,
    source: '',
    fallbackUsed: false
  });

  const { quakeProvider, pollMs } = useSettings();

  // Load cache on mount
  useEffect(() => {
    loadCache();
  }, []);

  // Auto-refresh based on polling interval
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, pollMs);

    return () => clearInterval(interval);
  }, [pollMs, quakeProvider]);

  const loadCache = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      const lastFetch = await AsyncStorage.getItem(LAST_FETCH_KEY);
      
      if (cached) {
        const items = JSON.parse(cached);
        setState(prev => ({
          ...prev,
          items,
          lastFetch: lastFetch ? parseInt(lastFetch) : null,
          source: 'cache'
        }));
      }
    } catch (error) {
      console.warn('Failed to load quake cache:', error);
    }
  };

  const saveCache = async (items: QuakeItem[]) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items));
      await AsyncStorage.setItem(LAST_FETCH_KEY, Date.now().toString());
    } catch (error) {
      console.warn('Failed to save quake cache:', error);
    }
  };

  const fetchWithProvider = async (provider: QuakeProvider): Promise<QuakeItem[]> => {
    try {
      const items = await provider.fetchRecent();
      return items;
    } catch (error) {
      console.warn(`Provider ${provider.name} failed:`, error);
      throw error;
    }
  };

  const pull = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        // Offline - use cache only
        await loadCache();
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: 'Çevrimdışı - önbellek kullanılıyor',
          source: 'cache'
        }));
        return;
      }

      // Try chosen provider first
      const provider = providerRegistry[quakeProvider];
      let items: QuakeItem[] = [];
      let source = quakeProvider;
      let fallbackUsed = false;

      try {
        items = await fetchWithProvider(provider);
        await saveCache(items);
      } catch (providerError) {
        console.warn(`${quakeProvider} provider failed, trying fallback:`, providerError);
        
        // Try cache first
        await loadCache();
        if (state.items.length > 0) {
          items = state.items;
          source = 'cache' as any;
        } else {
          // Try USGS as fallback
          try {
            const usgsProvider = providerRegistry['USGS'];
            items = await fetchWithProvider(usgsProvider);
            source = 'USGS (fallback)' as any;
            fallbackUsed = true;
            await saveCache(items);
          } catch (usgsError) {
            console.warn('USGS fallback also failed:', usgsError);
            throw new Error('Tüm sağlayıcılar başarısız');
          }
        }
      }

      setState(prev => ({
        ...prev,
        items,
        loading: false,
        error: null,
        lastFetch: Date.now(),
        source,
        fallbackUsed
      }));

    } catch (error) {
      console.error('Quake fetch failed:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Deprem verisi alınamadı'
      }));
    }
  }, [quakeProvider, state.items.length]);

  const refresh = useCallback(async () => {
    await pull();
  }, [pull]);

  return {
    ...state,
    refresh,
    pull
  };
}