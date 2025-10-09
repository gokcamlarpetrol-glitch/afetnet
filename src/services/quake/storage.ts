import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuakeItem } from './types';

const CACHE_KEY = 'quake_cache';

export async function cacheGet(): Promise<QuakeItem[] | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.warn('Cache get failed:', error);
    return null;
  }
}

export async function cacheSet(quakes: QuakeItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(quakes));
  } catch (error) {
    console.warn('Cache set failed:', error);
  }
}