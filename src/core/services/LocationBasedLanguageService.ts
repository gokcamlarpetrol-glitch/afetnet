/**
 * LOCATION-BASED LANGUAGE SERVICE
 * Automatically detects language based on user's location
 * Elite professional implementation
 */

import * as Location from 'expo-location';
import * as Localization from 'expo-localization';
import { createLogger } from '../utils/logger';

const logger = createLogger('LocationBasedLanguageService');

// Country code to language mapping
const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  // Turkish-speaking countries
  TR: 'tr', // Turkey
  CY: 'tr', // Cyprus (Turkish side)
  
  // English-speaking countries
  US: 'en', // United States
  GB: 'en', // United Kingdom
  CA: 'en', // Canada
  AU: 'en', // Australia
  NZ: 'en', // New Zealand
  IE: 'en', // Ireland
  ZA: 'en', // South Africa
  SG: 'en', // Singapore
  MY: 'en', // Malaysia
  PH: 'en', // Philippines
  IN: 'en', // India (English widely spoken)
  
  // Arabic-speaking countries
  SA: 'ar', // Saudi Arabia
  AE: 'ar', // UAE
  EG: 'ar', // Egypt
  IQ: 'ar', // Iraq
  JO: 'ar', // Jordan
  LB: 'ar', // Lebanon
  SY: 'ar', // Syria
  YE: 'ar', // Yemen
  OM: 'ar', // Oman
  KW: 'ar', // Kuwait
  QA: 'ar', // Qatar
  BH: 'ar', // Bahrain
  MA: 'ar', // Morocco
  DZ: 'ar', // Algeria
  TN: 'ar', // Tunisia
  LY: 'ar', // Libya
  SD: 'ar', // Sudan
  
  // German-speaking countries
  DE: 'de', // Germany
  AT: 'de', // Austria
  CH: 'de', // Switzerland (German)
  LI: 'de', // Liechtenstein
  LU: 'de', // Luxembourg
  
  // French-speaking countries
  FR: 'fr', // France
  BE: 'fr', // Belgium (French)
  CH: 'fr', // Switzerland (French)
  CA: 'fr', // Canada (French)
  MC: 'fr', // Monaco
  
  // Spanish-speaking countries
  ES: 'es', // Spain
  MX: 'es', // Mexico
  AR: 'es', // Argentina
  CO: 'es', // Colombia
  CL: 'es', // Chile
  PE: 'es', // Peru
  VE: 'es', // Venezuela
  EC: 'es', // Ecuador
  GT: 'es', // Guatemala
  CU: 'es', // Cuba
  BO: 'es', // Bolivia
  DO: 'es', // Dominican Republic
  HN: 'es', // Honduras
  PY: 'es', // Paraguay
  SV: 'es', // El Salvador
  NI: 'es', // Nicaragua
  CR: 'es', // Costa Rica
  PA: 'es', // Panama
  UY: 'es', // Uruguay
  
  // Russian-speaking countries
  RU: 'ru', // Russia
  BY: 'ru', // Belarus
  KZ: 'ru', // Kazakhstan
  KG: 'ru', // Kyrgyzstan
  
  // Chinese-speaking countries
  CN: 'zh', // China
  TW: 'zh', // Taiwan
  HK: 'zh', // Hong Kong
  MO: 'zh', // Macau
  SG: 'zh', // Singapore (Chinese)
  
  // Japanese-speaking countries
  JP: 'ja', // Japan
  
  // Korean-speaking countries
  KR: 'ko', // South Korea
  KP: 'ko', // North Korea
};

// Supported languages (priority order)
const SUPPORTED_LANGUAGES = ['en', 'tr', 'ar', 'de', 'fr', 'es', 'ru', 'zh', 'ja', 'ko'];

class LocationBasedLanguageService {
  private detectedLanguage: string | null = null;
  private isDetecting: boolean = false;

  /**
   * Detect language based on user's location
   * ELITE: Professional implementation with fallback chain
   */
  async detectLanguage(): Promise<string> {
    if (this.isDetecting) {
      return this.detectedLanguage || 'en';
    }

    this.isDetecting = true;

    try {
      // Step 1: Check device locale first (fastest)
      const deviceLanguage = this.getDeviceLanguage();
      if (deviceLanguage && SUPPORTED_LANGUAGES.includes(deviceLanguage)) {
        logger.info('✅ Language detected from device:', deviceLanguage);
        this.detectedLanguage = deviceLanguage;
        this.isDetecting = false;
        return deviceLanguage;
      }

      // Step 2: Check location-based detection
      const locationLanguage = await this.getLocationBasedLanguage();
      if (locationLanguage && SUPPORTED_LANGUAGES.includes(locationLanguage)) {
        logger.info('✅ Language detected from location:', locationLanguage);
        this.detectedLanguage = locationLanguage;
        this.isDetecting = false;
        return locationLanguage;
      }

      // Step 3: Fallback to English (most widely spoken)
      logger.info('✅ Using default language: English');
      this.detectedLanguage = 'en';
      this.isDetecting = false;
      return 'en';
    } catch (error) {
      logger.error('Language detection error:', error);
      this.detectedLanguage = 'en';
      this.isDetecting = false;
      return 'en';
    }
  }

  /**
   * Get language from device locale
   */
  private getDeviceLanguage(): string | null {
    try {
      const locales = Localization.getLocales();
      if (locales && locales.length > 0) {
        const languageCode = locales[0].languageCode || '';
        // Map to supported languages
        if (SUPPORTED_LANGUAGES.includes(languageCode)) {
          return languageCode;
        }
        // Handle language variants (e.g., en-US -> en)
        const baseLanguage = languageCode.split('-')[0];
        if (SUPPORTED_LANGUAGES.includes(baseLanguage)) {
          return baseLanguage;
        }
      }
      return null;
    } catch (error) {
      logger.error('Get device language error:', error);
      return null;
    }
  }

  /**
   * Get language based on user's location
   */
  private async getLocationBasedLanguage(): Promise<string | null> {
    try {
      // Check location permission
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        logger.warn('Location permission not granted, skipping location-based detection');
        return null;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low, // Low accuracy is enough for country detection
        timeout: 5000,
      });

      // Reverse geocode to get country code
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (geocode && geocode.length > 0) {
        const countryCode = geocode[0].isoCountryCode;
        if (countryCode) {
          const language = COUNTRY_TO_LANGUAGE[countryCode.toUpperCase()];
          if (language && SUPPORTED_LANGUAGES.includes(language)) {
            logger.info(`✅ Country detected: ${countryCode}, Language: ${language}`);
            return language;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Location-based language detection error:', error);
      return null;
    }
  }

  /**
   * Get detected language (cached)
   */
  getDetectedLanguage(): string {
    return this.detectedLanguage || 'en';
  }

  /**
   * Reset detection (for testing or manual override)
   */
  reset(): void {
    this.detectedLanguage = null;
    this.isDetecting = false;
  }
}

export const locationBasedLanguageService = new LocationBasedLanguageService();

