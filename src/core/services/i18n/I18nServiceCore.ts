/**
 * I18N SERVICE CORE - ELITE MODULAR
 * Core translation logic separated from translations
 */

import * as Localization from 'expo-localization';
import { createLogger } from '../../utils/logger';
import { translations } from './I18nTranslations';
import type { Translations, TranslationObject, TranslationParams, TranslationValue } from '../../types/i18n';

const logger = createLogger('I18nService');

class I18nServiceCore {
  private translations: Translations;
  private currentLocale: string = 'tr';

  constructor() {
    this.translations = translations;
    this.currentLocale = this.getDeviceLocale();
  }

  private getDeviceLocale(): string {
    try {
      const locales = Localization.getLocales();
      if (locales && locales.length > 0) {
        const deviceLocale = locales[0].languageCode || 'tr';
        // Map device locale to supported languages
        if (deviceLocale === 'tr') return 'tr';
        if (deviceLocale === 'en') return 'en';
        if (deviceLocale === 'ar') return 'ar';
        if (deviceLocale === 'ru') return 'ru';
        return 'tr'; // Default
      }
      return 'tr';
    } catch (error) {
      logger.error('Get device locale error:', error);
      return 'tr';
    }
  }

  /**
   * Set current locale
   */
  setLocale(locale: 'tr' | 'en' | 'ar' | 'ru') {
    this.currentLocale = locale;
    
    if (__DEV__) {
      logger.info('Locale changed to:', locale);
    }
  }

  /**
   * Get current locale
   */
  getLocale(): string {
    return this.currentLocale;
  }

  /**
   * Translate key
   */
  t(key: string, params?: TranslationParams): string {
    const keys = key.split('.');
    let value: TranslationValue = this.translations[this.currentLocale] || this.translations['tr'];
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        // Fallback to Turkish
        value = this.translations['tr'];
        for (const k2 of keys) {
          value = value?.[k2];
        }
        break;
      }
    }
    
    if (typeof value !== 'string') {
      return key; // Return key if translation not found
    }
    
    // Simple parameter replacement
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        const paramValue = params[paramKey];
        return paramValue !== undefined ? String(paramValue) : match;
      });
    }
    
    return value;
  }

  /**
   * Get all supported locales
   */
  getSupportedLocales(): string[] {
    return Object.keys(translations);
  }

  /**
   * Get locale display name
   */
  getLocaleDisplayName(locale: string): string {
    const names: Record<string, string> = {
      tr: 'Türkçe',
      en: 'English',
      ar: 'العربية',
      ru: 'Русский',
    };
    return names[locale] || locale;
  }
}

export const i18nService = new I18nServiceCore();

// Convenience function
export const t = (key: string, params?: TranslationParams) => i18nService.t(key, params);

