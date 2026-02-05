/**
 * ACCESSIBILITY SERVICE - ELITE EDITION
 * 
 * WCAG 2.1 AA uyumlu erişilebilirlik servisi
 * 
 * FEATURES:
 * - Screen reader support (VoiceOver/TalkBack)
 * - Dynamic font scaling
 * - High contrast mode
 * - Reduced motion
 * - Reduced transparency
 * - Touch target optimization
 * - RTL (Right-to-Left) support
 * - Accessibility announcements
 * 
 * @version 2.0.0
 * @elite true
 * @wcag 2.1 AA
 */

import { AccessibilityInfo, Platform, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('AccessibilityServiceElite');

// ============================================================
// TYPES
// ============================================================

export interface AccessibilitySettings {
    // Text & Display
    fontSize: 'small' | 'normal' | 'large' | 'extraLarge';
    fontWeight: 'normal' | 'bold';
    lineHeight: 'normal' | 'relaxed' | 'loose';

    // Visual
    highContrast: boolean;
    darkMode: boolean;
    reduceTransparency: boolean;
    colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

    // Motion & Animation
    reduceMotion: boolean;
    autoplayVideos: boolean;

    // Interaction
    touchTargetSize: 'normal' | 'large' | 'extraLarge';
    hapticFeedback: boolean;

    // Screen Reader
    screenReaderEnabled: boolean;

    // Layout
    rtlEnabled: boolean;
}

export interface AccessibilityColors {
    background: {
        primary: string;
        secondary: string;
        tertiary: string;
        elevated: string;
    };
    text: {
        primary: string;
        secondary: string;
        tertiary: string;
        inverse: string;
    };
    brand: {
        primary: string;
        secondary: string;
        accent: string;
    };
    semantic: {
        success: string;
        warning: string;
        error: string;
        info: string;
    };
    border: {
        primary: string;
        secondary: string;
        focus: string;
    };
}

export interface AccessibilityMetrics {
    minTouchTarget: number;
    fontScale: number;
    lineHeightMultiplier: number;
    borderWidth: number;
    focusRingWidth: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const STORAGE_KEY = '@accessibility_settings';

const DEFAULT_SETTINGS: AccessibilitySettings = {
    fontSize: 'normal',
    fontWeight: 'normal',
    lineHeight: 'normal',
    highContrast: false,
    darkMode: false,
    reduceTransparency: false,
    colorBlindMode: 'none',
    reduceMotion: false,
    autoplayVideos: true,
    touchTargetSize: 'normal',
    hapticFeedback: true,
    screenReaderEnabled: false,
    rtlEnabled: false,
};

// WCAG 2.1 AA compliant color palettes
const NORMAL_COLORS: AccessibilityColors = {
    background: {
        primary: '#0f0f0f',
        secondary: '#1a1a1a',
        tertiary: '#252525',
        elevated: '#2a2a2a',
    },
    text: {
        primary: '#ffffff',
        secondary: '#a0a0a0',
        tertiary: '#707070',
        inverse: '#000000',
    },
    brand: {
        primary: '#ff4444',
        secondary: '#ff6b6b',
        accent: '#ffd700',
    },
    semantic: {
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
    },
    border: {
        primary: '#333333',
        secondary: '#444444',
        focus: '#ff4444',
    },
};

const HIGH_CONTRAST_COLORS: AccessibilityColors = {
    background: {
        primary: '#000000',
        secondary: '#0a0a0a',
        tertiary: '#141414',
        elevated: '#1a1a1a',
    },
    text: {
        primary: '#ffffff',
        secondary: '#ffffff',
        tertiary: '#e0e0e0',
        inverse: '#000000',
    },
    brand: {
        primary: '#ff6666',
        secondary: '#ff8888',
        accent: '#ffff00',
    },
    semantic: {
        success: '#00ff00',
        warning: '#ffff00',
        error: '#ff0000',
        info: '#00ffff',
    },
    border: {
        primary: '#ffffff',
        secondary: '#ffffff',
        focus: '#ffff00',
    },
};

// ============================================================
// ACCESSIBILITY SERVICE CLASS
// ============================================================

class AccessibilityServiceElite {
    private settings: AccessibilitySettings = { ...DEFAULT_SETTINGS };
    private listeners: Set<(settings: AccessibilitySettings) => void> = new Set();
    private isInitialized = false;

    // ==================== INITIALIZATION ====================

    /**
     * Initialize accessibility service
     * Loads saved settings and syncs with system preferences
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            logger.info('♿ Initializing AccessibilityServiceElite...');

            // Load saved settings
            await this.loadSettings();

            // Sync with system settings
            await this.syncWithSystemSettings();

            // Setup system listeners
            this.setupSystemListeners();

            this.isInitialized = true;
            logger.info('✅ AccessibilityServiceElite initialized');
        } catch (error) {
            logger.error('❌ AccessibilityServiceElite initialization failed:', error);
        }
    }

    /**
     * Load saved settings from storage
     */
    private async loadSettings(): Promise<void> {
        try {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (error) {
            logger.error('Failed to load accessibility settings:', error);
        }
    }

    /**
     * Save settings to storage
     */
    private async saveSettings(): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch (error) {
            logger.error('Failed to save accessibility settings:', error);
        }
    }

    /**
     * Sync with system accessibility settings
     */
    private async syncWithSystemSettings(): Promise<void> {
        try {
            // Check screen reader
            const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
            this.settings.screenReaderEnabled = screenReaderEnabled;

            // Check reduce motion
            const reduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
            this.settings.reduceMotion = reduceMotionEnabled;

            // Check RTL
            this.settings.rtlEnabled = I18nManager.isRTL;

            logger.debug('System settings synced', {
                screenReader: screenReaderEnabled,
                reduceMotion: reduceMotionEnabled,
                rtl: I18nManager.isRTL,
            });
        } catch (error) {
            logger.error('Failed to sync system settings:', error);
        }
    }

    /**
     * Setup listeners for system accessibility changes
     */
    private setupSystemListeners(): void {
        // Screen reader changes
        const screenReaderSubscription = AccessibilityInfo.addEventListener(
            'screenReaderChanged',
            (isEnabled) => {
                this.settings.screenReaderEnabled = isEnabled;
                this.notifyListeners();
                logger.info('Screen reader changed:', isEnabled);
            }
        );

        // Reduce motion changes
        const reduceMotionSubscription = AccessibilityInfo.addEventListener(
            'reduceMotionChanged',
            (isEnabled) => {
                this.settings.reduceMotion = isEnabled;
                this.notifyListeners();
                logger.info('Reduce motion changed:', isEnabled);
            }
        );
    }

    // ==================== SETTINGS MANAGEMENT ====================

    /**
     * Get current settings
     */
    getSettings(): AccessibilitySettings {
        return { ...this.settings };
    }

    /**
     * Update settings
     */
    async updateSettings(updates: Partial<AccessibilitySettings>): Promise<void> {
        this.settings = { ...this.settings, ...updates };
        await this.saveSettings();
        this.notifyListeners();

        // Apply RTL if changed
        if ('rtlEnabled' in updates && updates.rtlEnabled !== I18nManager.isRTL) {
            I18nManager.forceRTL(updates.rtlEnabled ?? false);
            logger.info('RTL mode changed:', updates.rtlEnabled);
        }
    }

    /**
     * Reset to defaults
     */
    async resetToDefaults(): Promise<void> {
        this.settings = { ...DEFAULT_SETTINGS };
        await this.saveSettings();
        this.notifyListeners();
        logger.info('Accessibility settings reset to defaults');
    }

    // ==================== FONT & TEXT ====================

    /**
     * Set font size
     */
    async setFontSize(size: AccessibilitySettings['fontSize']): Promise<void> {
        await this.updateSettings({ fontSize: size });
    }

    /**
     * Get font scale multiplier
     */
    getFontScale(): number {
        const scales = {
            small: 0.85,
            normal: 1.0,
            large: 1.25,
            extraLarge: 1.5,
        };
        return scales[this.settings.fontSize];
    }

    /**
     * Get line height multiplier
     */
    getLineHeightMultiplier(): number {
        const multipliers = {
            normal: 1.4,
            relaxed: 1.6,
            loose: 1.8,
        };
        return multipliers[this.settings.lineHeight];
    }

    /**
     * Get scaled font size
     */
    getScaledFontSize(baseFontSize: number): number {
        return Math.round(baseFontSize * this.getFontScale());
    }

    // ==================== COLORS ====================

    /**
     * Toggle high contrast mode
     */
    async toggleHighContrast(): Promise<void> {
        await this.updateSettings({ highContrast: !this.settings.highContrast });
    }

    /**
     * Get accessible color palette
     */
    getColors(): AccessibilityColors {
        if (this.settings.highContrast) {
            return HIGH_CONTRAST_COLORS;
        }
        return NORMAL_COLORS;
    }

    /**
     * Check color contrast ratio (WCAG)
     */
    checkContrastRatio(foreground: string, background: string): {
        ratio: number;
        passesAA: boolean;
        passesAAA: boolean;
    } {
        // Simplified luminance calculation
        const getLuminance = (hex: string): number => {
            const rgb = parseInt(hex.slice(1), 16);
            const r = ((rgb >> 16) & 0xff) / 255;
            const g = ((rgb >> 8) & 0xff) / 255;
            const b = (rgb & 0xff) / 255;

            const toLinear = (c: number) =>
                c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

            return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
        };

        const l1 = getLuminance(foreground);
        const l2 = getLuminance(background);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

        return {
            ratio,
            passesAA: ratio >= 4.5,
            passesAAA: ratio >= 7,
        };
    }

    // ==================== TOUCH & INTERACTION ====================

    /**
     * Get minimum touch target size (WCAG compliant)
     */
    getMinTouchTarget(): number {
        const sizes = {
            normal: 44, // WCAG AA minimum
            large: 48,
            extraLarge: 56,
        };
        return sizes[this.settings.touchTargetSize];
    }

    /**
     * Get accessibility metrics
     */
    getMetrics(): AccessibilityMetrics {
        return {
            minTouchTarget: this.getMinTouchTarget(),
            fontScale: this.getFontScale(),
            lineHeightMultiplier: this.getLineHeightMultiplier(),
            borderWidth: this.settings.highContrast ? 2 : 1,
            focusRingWidth: this.settings.highContrast ? 3 : 2,
        };
    }

    // ==================== MOTION ====================

    /**
     * Check if animations should be reduced
     */
    shouldReduceMotion(): boolean {
        return this.settings.reduceMotion;
    }

    /**
     * Get animation duration (respects reduce motion)
     */
    getAnimationDuration(baseDuration: number): number {
        if (this.settings.reduceMotion) {
            return 0; // Instant transitions
        }
        return baseDuration;
    }

    // ==================== SCREEN READER ====================

    /**
     * Check if screen reader is enabled
     */
    isScreenReaderEnabled(): boolean {
        return this.settings.screenReaderEnabled;
    }

    /**
     * Announce message to screen reader
     */
    announce(message: string, options?: { queue?: boolean }): void {
        if (this.settings.screenReaderEnabled) {
            AccessibilityInfo.announceForAccessibility(message);
            logger.debug('Announced to screen reader:', message);
        }
    }

    /**
     * Announce politely (doesn't interrupt current announcement)
     */
    announcePolite(message: string): void {
        if (this.settings.screenReaderEnabled) {
            // Queue the announcement
            setTimeout(() => {
                AccessibilityInfo.announceForAccessibility(message);
            }, 100);
        }
    }

    /**
     * Set focus to element
     */
    setAccessibilityFocus(reactTag: number): void {
        AccessibilityInfo.setAccessibilityFocus(reactTag);
    }

    // ==================== RTL SUPPORT ====================

    /**
     * Check if RTL is enabled
     */
    isRTL(): boolean {
        return this.settings.rtlEnabled || I18nManager.isRTL;
    }

    /**
     * Enable RTL mode
     */
    async enableRTL(enable: boolean): Promise<void> {
        await this.updateSettings({ rtlEnabled: enable });
        I18nManager.forceRTL(enable);
    }

    /**
     * Get text alignment based on RTL
     */
    getTextAlign(): 'left' | 'right' {
        return this.isRTL() ? 'right' : 'left';
    }

    /**
     * Get flex direction based on RTL
     */
    getFlexDirection(): 'row' | 'row-reverse' {
        return this.isRTL() ? 'row-reverse' : 'row';
    }

    // ==================== LISTENERS ====================

    /**
     * Subscribe to settings changes
     */
    subscribe(callback: (settings: AccessibilitySettings) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify all listeners
     */
    private notifyListeners(): void {
        const settings = this.getSettings();
        this.listeners.forEach((callback) => {
            try {
                callback(settings);
            } catch (error) {
                logger.error('Listener callback error:', error);
            }
        });
    }
}

// Export singleton instance
export const accessibilityServiceElite = new AccessibilityServiceElite();

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect } from 'react';

/**
 * Hook for accessing accessibility settings
 */
export function useAccessibility() {
    const [settings, setSettings] = useState<AccessibilitySettings>(
        accessibilityServiceElite.getSettings()
    );

    useEffect(() => {
        const unsubscribe = accessibilityServiceElite.subscribe(setSettings);
        return unsubscribe;
    }, []);

    return {
        settings,
        colors: accessibilityServiceElite.getColors(),
        metrics: accessibilityServiceElite.getMetrics(),
        fontScale: accessibilityServiceElite.getFontScale(),
        isRTL: accessibilityServiceElite.isRTL(),
        shouldReduceMotion: accessibilityServiceElite.shouldReduceMotion(),
        isScreenReaderEnabled: accessibilityServiceElite.isScreenReaderEnabled(),

        // Methods
        updateSettings: (updates: Partial<AccessibilitySettings>) =>
            accessibilityServiceElite.updateSettings(updates),
        setFontSize: (size: AccessibilitySettings['fontSize']) =>
            accessibilityServiceElite.setFontSize(size),
        toggleHighContrast: () => accessibilityServiceElite.toggleHighContrast(),
        resetToDefaults: () => accessibilityServiceElite.resetToDefaults(),
        announce: (message: string) => accessibilityServiceElite.announce(message),
        getScaledFontSize: (base: number) =>
            accessibilityServiceElite.getScaledFontSize(base),
        getAnimationDuration: (base: number) =>
            accessibilityServiceElite.getAnimationDuration(base),
    };
}
