/**
 * ACCESSIBILITY SERVICE
 * Accessibility features - Large text, high contrast, screen reader support
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';
import * as Font from 'expo-font';

const logger = createLogger('AccessibilityService');

interface AccessibilitySettings {
  fontSize: 'small' | 'normal' | 'large' | 'extraLarge';
  highContrast: boolean;
  screenReader: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
}

class AccessibilityService {
  private settings: AccessibilitySettings = {
    fontSize: 'normal',
    highContrast: false,
    screenReader: false,
    reduceMotion: false,
    reduceTransparency: false,
  };

  private listeners: Array<(settings: AccessibilitySettings) => void> = [];

  /**
   * Initialize accessibility service
   */
  async initialize() {
    try {
      // Check system accessibility settings
      // In production, use AccessibilityInfo API
      
      if (__DEV__) {
        logger.info('Accessibility service initialized');
      }
    } catch (error) {
      logger.error('Accessibility initialization error:', error);
    }
  }

  /**
   * Get current accessibility settings
   */
  getSettings(): AccessibilitySettings {
    return { ...this.settings };
  }

  /**
   * Set font size
   */
  setFontSize(size: 'small' | 'normal' | 'large' | 'extraLarge') {
    this.settings.fontSize = size;
    this.notifyListeners();
    
    if (__DEV__) {
      logger.info('Font size changed to:', size);
    }
  }

  /**
   * Toggle high contrast mode
   */
  toggleHighContrast() {
    this.settings.highContrast = !this.settings.highContrast;
    this.notifyListeners();
    
    if (__DEV__) {
      logger.info('High contrast:', this.settings.highContrast);
    }
  }

  /**
   * Toggle screen reader support
   */
  toggleScreenReader() {
    this.settings.screenReader = !this.settings.screenReader;
    this.notifyListeners();
    
    if (__DEV__) {
      logger.info('Screen reader:', this.settings.screenReader);
    }
  }

  /**
   * Get font size multiplier
   */
  getFontSizeMultiplier(): number {
    switch (this.settings.fontSize) {
      case 'small': return 0.85;
      case 'normal': return 1.0;
      case 'large': return 1.25;
      case 'extraLarge': return 1.5;
      default: return 1.0;
    }
  }

  /**
   * Get accessibility-aware colors
   */
  getAccessibleColors() {
    if (this.settings.highContrast) {
      return {
        background: {
          primary: '#000000',
          secondary: '#1a1a1a',
          tertiary: '#333333',
        },
        text: {
          primary: '#ffffff',
          secondary: '#ffffff',
          tertiary: '#ffffff',
        },
        brand: {
          primary: '#ffffff',
          secondary: '#ffffff',
        },
        border: {
          primary: '#ffffff',
          secondary: '#ffffff',
        },
      };
    }
    return null; // Use default colors
  }

  /**
   * Subscribe to accessibility settings changes
   */
  onSettingsChange(callback: (settings: AccessibilitySettings) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.settings });
      } catch (error) {
        logger.error('Listener error:', error);
      }
    }
  }

  /**
   * Check if screen reader is enabled
   */
  async isScreenReaderEnabled(): Promise<boolean> {
    try {
      // In production, use AccessibilityInfo.isScreenReaderEnabled()
      return this.settings.screenReader;
    } catch (error) {
      logger.error('Screen reader check error:', error);
      return false;
    }
  }

  /**
   * Announce message to screen reader
   */
  async announce(message: string) {
    try {
      // In production, use AccessibilityInfo.announceForAccessibility()
      if (this.settings.screenReader) {
        if (__DEV__) {
          logger.info('Screen reader announce:', message);
        }
      }
    } catch (error) {
      logger.error('Announce error:', error);
    }
  }
}

export const accessibilityService = new AccessibilityService();


