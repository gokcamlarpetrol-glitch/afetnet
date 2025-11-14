/**
 * EARTHQUAKE CACHE MANAGER - ELITE MODULAR
 * Manages caching of earthquake data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Earthquake } from '../../stores/earthquakeStore';
import { createLogger } from '../../utils/logger';

const logger = createLogger('EarthquakeCacheManager');

const CACHE_KEY = 'afetnet_earthquakes_cache';
const LAST_FETCH_KEY = 'afetnet_earthquakes_last_fetch';
const CACHE_EXPIRY_MINUTES = 5; // Cache expires after 5 minutes (for fresh data)
// CRITICAL: Offline mode - use cache even if older (up to 24 hours)
const OFFLINE_CACHE_MAX_AGE_HOURS = 24; // Maximum cache age for offline mode

/**
 * Save earthquakes to cache
 */
export async function saveToCache(earthquakes: Earthquake[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(earthquakes));
    await AsyncStorage.setItem(LAST_FETCH_KEY, String(Date.now()));
  } catch (error) {
    logger.error('Cache save error:', error);
  }
}

/**
 * Load earthquakes from cache
 */
export async function loadFromCache(): Promise<Earthquake[] | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    const lastFetch = await AsyncStorage.getItem(LAST_FETCH_KEY);
    
    if (!cached || !lastFetch) {
      return null;
    }
    
    // CRITICAL: Check cache age
    const cacheAge = Date.now() - parseInt(lastFetch, 10);
    const cacheAgeMinutes = cacheAge / (60 * 1000);
    const cacheAgeHours = cacheAgeMinutes / 60;
    
    // CRITICAL: For offline mode, use cache even if older (up to 24 hours)
    // This ensures app works WITHOUT internet connection
    if (cacheAgeHours > OFFLINE_CACHE_MAX_AGE_HOURS) {
      if (__DEV__) {
        logger.warn(`⚠️ Cache is ${cacheAgeHours.toFixed(1)} hours old (${OFFLINE_CACHE_MAX_AGE_HOURS}+ hours) - too old even for offline mode`);
      }
      // Clear very old cache
      await AsyncStorage.removeItem(CACHE_KEY);
      await AsyncStorage.removeItem(LAST_FETCH_KEY);
      return null;
    }
    
    // CRITICAL: If cache is older than 5 minutes but less than 24 hours, still use it for offline mode
    // This is CRITICAL for offline functionality - app MUST work without internet
    if (cacheAgeMinutes > CACHE_EXPIRY_MINUTES && cacheAgeHours <= OFFLINE_CACHE_MAX_AGE_HOURS) {
      if (__DEV__) {
        logger.info(`📡 OFFLINE MODE: Using cache data (${cacheAgeMinutes.toFixed(1)} minutes old) - app continues without internet`);
      }
      // Return cache for offline mode - DO NOT clear it
      const earthquakes = JSON.parse(cached);
      return earthquakes;
    }
    
    // CRITICAL: Even if cache is old (but < 5min), show it for instant display
    if (cacheAgeMinutes > 2 && __DEV__) {
      logger.info(`ℹ️ Cache is ${cacheAgeMinutes.toFixed(1)} minutes old - showing for instant display, fresh data loading...`);
    }
    
    const earthquakes = JSON.parse(cached);
    if (__DEV__) {
      logger.debug(`✅ Cache loaded: ${earthquakes.length} earthquakes (${cacheAgeMinutes.toFixed(1)} minutes old)`);
    }
    return earthquakes;
  } catch (error) {
    logger.error('Cache load error:', error);
    // Clear corrupted cache
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      await AsyncStorage.removeItem(LAST_FETCH_KEY);
    } catch (error) {
      // ELITE: Log cache errors but don't crash the app
      if (__DEV__) {
        logger.debug('Cache operation failed (non-critical):', error);
      }
    }
    return null;
  }
}

/**
 * Get cache age in minutes
 */
export async function getCacheAge(): Promise<number | null> {
  try {
    const lastFetch = await AsyncStorage.getItem(LAST_FETCH_KEY);
    if (!lastFetch) {
      return null;
    }
    const cacheAge = Date.now() - parseInt(lastFetch, 10);
    return cacheAge / (60 * 1000);
  } catch {
    return null;
  }
}

/**
 * Clear cache
 */
export async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(LAST_FETCH_KEY);
  } catch (error) {
    logger.error('Cache clear error:', error);
  }
}

