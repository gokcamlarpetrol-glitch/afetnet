/**
 * I18N SERVICE - ELITE EDITION
 * Internationalization service for AfetNet
 * 
 * Supports Turkish and English with automatic device locale detection.
 * Uses AsyncStorage for persisting language preference.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { createLogger } from '../utils/logger';

// Import translations
import trTranslations from './locales/tr.json';
import enTranslations from './locales/en.json';

const logger = createLogger('I18nService');

// Types
export type SupportedLocale = 'tr' | 'en';

type TranslationKeys = typeof trTranslations;
type NestedKeyOf<T> = T extends object
  ? { [K in keyof T]: K extends string
    ? T[K] extends object
    ? `${K}.${NestedKeyOf<T[K]>}` | K
    : K
    : never
  }[keyof T]
  : never;

export type TranslationKey = NestedKeyOf<TranslationKeys>;

// Constants
const STORAGE_KEY = '@afetnet/language';
const DEFAULT_LOCALE: SupportedLocale = 'tr';

// Translations map
const translations: Record<SupportedLocale, typeof trTranslations> = {
  tr: trTranslations,
  en: enTranslations,
};

// State
let currentLocale: SupportedLocale = DEFAULT_LOCALE;
let isInitialized = false;
const listeners = new Set<(locale: SupportedLocale) => void>();

/**
 * ELITE: Get device locale
 */
function getDeviceLocale(): SupportedLocale {
  try {
    let deviceLocale: string = 'tr';

    if (Platform.OS === 'ios') {
      deviceLocale =
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        'tr';
    } else if (Platform.OS === 'android') {
      deviceLocale = NativeModules.I18nManager?.localeIdentifier || 'tr';
    }

    // Extract language code
    const langCode = deviceLocale.split(/[-_]/)[0].toLowerCase();

    // Map to supported locales
    if (langCode === 'en') return 'en';
    return 'tr'; // Default to Turkish
  } catch (error) {
    logger.debug('Failed to get device locale, using default');
    return DEFAULT_LOCALE;
  }
}

/**
 * ELITE: Initialize i18n service
 */
async function initialize(): Promise<void> {
  if (isInitialized) return;

  try {
    // Check for stored preference
    const storedLocale = await AsyncStorage.getItem(STORAGE_KEY);

    if (storedLocale && (storedLocale === 'tr' || storedLocale === 'en')) {
      currentLocale = storedLocale as SupportedLocale;
    } else {
      // Use device locale
      currentLocale = getDeviceLocale();
    }

    isInitialized = true;

    if (__DEV__) {
      logger.debug(`✅ I18n initialized with locale: ${currentLocale}`);
    }
  } catch (error) {
    logger.error('Failed to initialize i18n:', error);
    currentLocale = DEFAULT_LOCALE;
    isInitialized = true;
  }
}

/**
 * ELITE: Get nested value from object by path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * ELITE: Translate a key with optional interpolation
 */
function t(key: string, params?: Record<string, string | number>): string {
  // Get translation
  let translation = getNestedValue(translations[currentLocale], key);

  // Fallback to English
  if (!translation && currentLocale !== 'en') {
    translation = getNestedValue(translations['en'], key);
  }

  // Fallback to key
  if (!translation) {
    if (__DEV__) {
      logger.debug(`Missing translation: ${key}`);
    }
    return key;
  }

  // Interpolation
  if (params) {
    return translation.replace(/\{\{(\w+)\}\}/g, (_, paramKey) => {
      const value = params[paramKey];
      return value !== undefined ? String(value) : `{{${paramKey}}}`;
    });
  }

  return translation;
}

/**
 * ELITE: Get current locale
 */
function getLocale(): SupportedLocale {
  return currentLocale;
}

/**
 * ELITE: Set locale
 */
async function setLocale(locale: SupportedLocale): Promise<void> {
  if (locale === currentLocale) return;

  try {
    currentLocale = locale;
    await AsyncStorage.setItem(STORAGE_KEY, locale);

    // Notify listeners
    listeners.forEach(listener => {
      try {
        listener(locale);
      } catch (e) {
        // ELITE: Listener error is non-critical
      }
    });

    if (__DEV__) {
      logger.debug(`Locale changed to: ${locale}`);
    }
  } catch (error) {
    logger.error('Failed to set locale:', error);
  }
}

/**
 * ELITE: Subscribe to locale changes
 */
function onLocaleChange(callback: (locale: SupportedLocale) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * ELITE: Check if a key exists
 */
function hasKey(key: string): boolean {
  return getNestedValue(translations[currentLocale], key) !== undefined;
}

/**
 * ELITE: Get all available locales
 */
function getAvailableLocales(): { code: SupportedLocale; name: string }[] {
  return [
    { code: 'tr', name: 'Türkçe' },
    { code: 'en', name: 'English' },
  ];
}

// Export service
export const i18n = {
  initialize,
  t,
  getLocale,
  setLocale,
  onLocaleChange,
  hasKey,
  getAvailableLocales,
};

// Also export t as a standalone function for convenience
export { t };

// Auto-initialize
initialize().catch(() => {
  // Silent fail - will use defaults
});
