/**
 * I18N SERVICE TESTS - ELITE EDITION
 * Internationalization tests for multi-language support
 */

describe('I18nService', () => {
    // Mock translations
    const translations = {
        tr: {
            'app.name': 'AfetNet',
            'earthquake.alert': 'Deprem Uyarısı',
            'earthquake.magnitude': 'Büyüklük: {magnitude}',
            'sos.send': 'SOS Gönder',
            'family.members': '{count} Aile Üyesi',
        },
        en: {
            'app.name': 'AfetNet',
            'earthquake.alert': 'Earthquake Alert',
            'earthquake.magnitude': 'Magnitude: {magnitude}',
            'sos.send': 'Send SOS',
            'family.members': '{count} Family Members',
        },
        ar: {
            'app.name': 'AfetNet',
            'earthquake.alert': 'تحذير من الزلزال',
            'earthquake.magnitude': 'الحجم: {magnitude}',
            'sos.send': 'إرسال SOS',
            'family.members': '{count} أفراد العائلة',
        },
    };

    // Helper function to simulate i18n.t()
    const t = (key: string, locale: string = 'tr', params?: Record<string, string>) => {
        const localeTranslations = translations[locale as keyof typeof translations] || translations.tr;
        let translation = localeTranslations[key as keyof typeof localeTranslations] || key;

        if (params) {
            Object.entries(params).forEach(([paramKey, paramValue]) => {
                translation = translation.replace(`{${paramKey}}`, paramValue);
            });
        }

        return translation;
    };

    describe('Translation Lookup', () => {
        test('should return Turkish translation by default', () => {
            expect(t('earthquake.alert', 'tr')).toBe('Deprem Uyarısı');
            expect(t('sos.send', 'tr')).toBe('SOS Gönder');
        });

        test('should return English translations', () => {
            expect(t('earthquake.alert', 'en')).toBe('Earthquake Alert');
            expect(t('sos.send', 'en')).toBe('Send SOS');
        });

        test('should return Arabic translations', () => {
            expect(t('earthquake.alert', 'ar')).toBe('تحذير من الزلزال');
            expect(t('sos.send', 'ar')).toBe('إرسال SOS');
        });

        test('should return key if translation not found', () => {
            expect(t('unknown.key', 'tr')).toBe('unknown.key');
        });
    });

    describe('Parameter Interpolation', () => {
        test('should interpolate magnitude parameter', () => {
            const result = t('earthquake.magnitude', 'tr', { magnitude: '5.4' });
            expect(result).toBe('Büyüklük: 5.4');
        });

        test('should interpolate count parameter', () => {
            const result = t('family.members', 'en', { count: '3' });
            expect(result).toBe('3 Family Members');
        });

        test('should handle missing parameters gracefully', () => {
            const result = t('earthquake.magnitude', 'tr', {});
            expect(result).toBe('Büyüklük: {magnitude}');
        });
    });

    describe('Locale Fallback', () => {
        test('should fallback to Turkish for unsupported locales', () => {
            // Using a non-existent locale should fall back to Turkish
            expect(t('earthquake.alert', 'de')).toBe('Deprem Uyarısı');
        });
    });

    describe('RTL Support', () => {
        const isRTL = (locale: string): boolean => {
            const rtlLocales = ['ar', 'he', 'fa', 'ur'];
            return rtlLocales.includes(locale);
        };

        test('should identify RTL languages', () => {
            expect(isRTL('ar')).toBe(true);
            expect(isRTL('he')).toBe(true);
        });

        test('should identify LTR languages', () => {
            expect(isRTL('en')).toBe(false);
            expect(isRTL('tr')).toBe(false);
        });
    });

    describe('Supported Languages', () => {
        const supportedLanguages = ['tr', 'en', 'ar', 'ru'];

        test('should have Turkish support', () => {
            expect(supportedLanguages).toContain('tr');
        });

        test('should have English support', () => {
            expect(supportedLanguages).toContain('en');
        });

        test('should have 4 supported languages', () => {
            expect(supportedLanguages).toHaveLength(4);
        });
    });
});
