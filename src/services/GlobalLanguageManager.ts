import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from '../i18n';
import { setLang } from '../i18n/runtime';

// Global language and region management
class GlobalLanguageManager {
  private static instance: GlobalLanguageManager;
  private currentLanguage: string = 'tr';
  private currentRegion: string = 'TR';
  private listeners: Array<(lang: string, region: string) => void> = [];

  static getInstance(): GlobalLanguageManager {
    if (!GlobalLanguageManager.instance) {
      GlobalLanguageManager.instance = new GlobalLanguageManager();
    }
    return GlobalLanguageManager.instance;
  }

  async initialize() {
    try {
      // Load saved settings
      const savedLanguage = await AsyncStorage.getItem('afn/language');
      const savedRegion = await AsyncStorage.getItem('afn/region');
      
      if (savedLanguage) {
        this.currentLanguage = savedLanguage;
      } else {
        // Auto-detect from device
        const deviceLanguage = Localization.getLocales()[0]?.languageCode || 'tr';
        this.currentLanguage = this.isLanguageSupported(deviceLanguage) ? deviceLanguage : 'tr';
      }
      
      if (savedRegion) {
        this.currentRegion = savedRegion;
      } else {
        // Auto-detect from device
        const deviceRegion = Localization.getLocales()[0]?.regionCode || 'TR';
        this.currentRegion = this.isRegionSupported(deviceRegion) ? deviceRegion : 'TR';
      }

      // Apply settings
      await this.applyLanguage(this.currentLanguage);
      await this.applyRegion(this.currentRegion);
      
    } catch (error) {
      console.warn('Failed to initialize language manager:', error);
    }
  }

  private isLanguageSupported(lang: string): boolean {
    const supportedLanguages = ['tr', 'en', 'ar', 'de', 'fr', 'es', 'ru', 'zh', 'ja', 'ko'];
    return supportedLanguages.includes(lang);
  }

  private isRegionSupported(region: string): boolean {
    const supportedRegions = ['TR', 'US', 'EU', 'MENA', 'ASIA', 'LATAM'];
    return supportedRegions.includes(region);
  }

  async setLanguage(language: string): Promise<void> {
    if (!this.isLanguageSupported(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    this.currentLanguage = language;
    await AsyncStorage.setItem('afn/language', language);
    await this.applyLanguage(language);
    this.notifyListeners();
  }

  async setRegion(region: string): Promise<void> {
    if (!this.isRegionSupported(region)) {
      throw new Error(`Unsupported region: ${region}`);
    }

    this.currentRegion = region;
    await AsyncStorage.setItem('afn/region', region);
    await this.applyRegion(region);
    this.notifyListeners();
  }

  private async applyLanguage(language: string): Promise<void> {
    try {
      // Update i18n
      await i18n.changeLanguage(language);
      
      // Update runtime language
      await setLang(language);
      
      // Update device locale if possible
      // Note: This is a simplified approach. In production, you might want to
      // use more sophisticated locale management
      
    } catch (error) {
      console.warn('Failed to apply language:', error);
    }
  }

  private async applyRegion(region: string): Promise<void> {
    try {
      // Update timezone based on region
      const timezoneMap: Record<string, string> = {
        'TR': 'Europe/Istanbul',
        'US': 'America/New_York',
        'EU': 'Europe/London',
        'MENA': 'Asia/Dubai',
        'ASIA': 'Asia/Tokyo',
        'LATAM': 'America/Sao_Paulo'
      };

      const timezone = timezoneMap[region] || 'Europe/Istanbul';
      await AsyncStorage.setItem('afn/timezone', timezone);
      
      // Update earthquake data source based on region
      const dataSourceMap: Record<string, string> = {
        'TR': 'AFAD',
        'US': 'USGS',
        'EU': 'USGS',
        'MENA': 'USGS',
        'ASIA': 'USGS',
        'LATAM': 'USGS'
      };

      const dataSource = dataSourceMap[region] || 'AFAD';
      await AsyncStorage.setItem('afn/earthquakeDataSource', dataSource);
      
    } catch (error) {
      console.warn('Failed to apply region:', error);
    }
  }

  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  getCurrentRegion(): string {
    return this.currentRegion;
  }

  addListener(listener: (lang: string, region: string) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentLanguage, this.currentRegion);
      } catch (error) {
        console.warn('Error in language listener:', error);
      }
    });
  }

  // Get localized text with fallback
  async getText(key: string, variables?: Record<string, string | number>): Promise<string> {
    try {
      // Try current language first
      const currentLangText = await this.getTextForLanguage(key, this.currentLanguage, variables);
      if (currentLangText && currentLangText !== key) {
        return currentLangText;
      }

      // Fallback to Turkish
      if (this.currentLanguage !== 'tr') {
        const fallbackText = await this.getTextForLanguage(key, 'tr', variables);
        if (fallbackText && fallbackText !== key) {
          return fallbackText;
        }
      }

      // Return key as last resort
      return key;
    } catch (error) {
      console.warn('Failed to get localized text:', error);
      return key;
    }
  }

  private async getTextForLanguage(key: string, language: string, variables?: Record<string, string | number>): Promise<string> {
    try {
      // This would integrate with your existing i18n system
      // For now, return the key as a placeholder
      return key;
    } catch (error) {
      return key;
    }
  }
}

// Export singleton instance
export const globalLanguageManager = GlobalLanguageManager.getInstance();

// React hook for language management
export function useGlobalLanguage() {
  const [language, setLanguage] = useState(globalLanguageManager.getCurrentLanguage());
  const [region, setRegion] = useState(globalLanguageManager.getCurrentRegion());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize on mount
    globalLanguageManager.initialize();

    // Listen for changes
    const unsubscribe = globalLanguageManager.addListener((newLang, newRegion) => {
      setLanguage(newLang);
      setRegion(newRegion);
    });

    return unsubscribe;
  }, []);

  const changeLanguage = async (newLanguage: string) => {
    setIsLoading(true);
    try {
      await globalLanguageManager.setLanguage(newLanguage);
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const changeRegion = async (newRegion: string) => {
    setIsLoading(true);
    try {
      await globalLanguageManager.setRegion(newRegion);
    } catch (error) {
      console.error('Failed to change region:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getText = async (key: string, variables?: Record<string, string | number>) => {
    return await globalLanguageManager.getText(key, variables);
  };

  return {
    language,
    region,
    isLoading,
    changeLanguage,
    changeRegion,
    getText
  };
}

// Auto-initialize on app start
globalLanguageManager.initialize();

