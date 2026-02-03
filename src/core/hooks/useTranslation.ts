/**
 * USE TRANSLATION HOOK - ELITE EDITION
 * React hook for i18n functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { i18n, t as translateFn, SupportedLocale } from '../i18n';

export interface UseTranslationReturn {
    t: (key: string, params?: Record<string, string | number>) => string;
    locale: SupportedLocale;
    setLocale: (locale: SupportedLocale) => Promise<void>;
    availableLocales: { code: SupportedLocale; name: string }[];
}

/**
 * ELITE: Hook for translations in React components
 * 
 * @example
 * const { t, locale, setLocale } = useTranslation();
 * 
 * return (
 *   <Text>{t('common.ok')}</Text>
 *   <Text>{t('time.minutes_ago', { count: 5 })}</Text>
 * );
 */
export function useTranslation(): UseTranslationReturn {
  const [locale, setLocaleState] = useState<SupportedLocale>(i18n.getLocale());

  useEffect(() => {
    // Subscribe to locale changes
    const unsubscribe = i18n.onLocaleChange((newLocale) => {
      setLocaleState(newLocale);
    });

    return unsubscribe;
  }, []);

  const setLocale = useCallback(async (newLocale: SupportedLocale) => {
    await i18n.setLocale(newLocale);
  }, []);

  // Memoized t function that updates when locale changes
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translateFn(key, params);
    },
    [locale], // Re-create when locale changes
  );

  return {
    t,
    locale,
    setLocale,
    availableLocales: i18n.getAvailableLocales(),
  };
}

/**
 * ELITE: Component for displaying translated text
 * 
 * @example
 * <Trans i18nKey="common.ok" />
 * <Trans i18nKey="time.minutes_ago" params={{ count: 5 }} />
 */
export interface TransProps {
    i18nKey: string;
    params?: Record<string, string | number>;
}

// Note: This is a function-based component pattern
// Use it with React.createElement or in JSX with Text wrapper
export function getTranslatedText(key: string, params?: Record<string, string | number>): string {
  return translateFn(key, params);
}
