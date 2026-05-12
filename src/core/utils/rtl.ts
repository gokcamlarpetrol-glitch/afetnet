/**
 * RTL UTILITIES
 *
 * AfetNet'in Arapca, Farsca, Ibranice gibi sagdan-sola dilleri destegi icin
 * yardimci fonksiyonlar. React Native'in I18nManager API'sini kullanir.
 *
 * KRITIK: I18nManager.forceRTL/allowRTL cagrildiginda app restart gerekir.
 * React Native bu state'i hot-reload yapmaz. configureRTL() restart needed
 * flag'i doner — caller bu durumda RNRestart.Restart() veya Updates.reloadAsync()
 * tetiklemelidir.
 *
 * Stylesheet'lerde marginLeft/Right yerine marginStart/End kullanin (logical
 * properties — otomatik RTL flip). Bu utility helper'lari sadece exception
 * durumlar icin (ikon yon flip, vs).
 */

import { I18nManager, Platform } from 'react-native';

/** RTL diller — yeni dil eklerken bu listeyi guncelle. */
const RTL_LOCALES = new Set([
  'ar',  // Arabic
  'fa',  // Persian/Farsi
  'he',  // Hebrew
  'ur',  // Urdu
  'ku',  // Kurdish (Sorani only — Kurmanji is LTR)
  'ps',  // Pashto
  'sd',  // Sindhi
]);

/**
 * Verilen locale kodu RTL mi?
 * Locale 'tr', 'en-US', 'ar-EG' gibi formatlardir; ilk 2 karakter dil kodu.
 */
export function isRTLLocale(locale: string): boolean {
  if (!locale || typeof locale !== 'string') return false;
  const langCode = locale.toLowerCase().split(/[-_]/)[0];
  return RTL_LOCALES.has(langCode);
}

/** Su an aktif RTL mode'da miyiz? */
export function isRTL(): boolean {
  return I18nManager.isRTL;
}

/**
 * RTL mode'u kullanicinin tercih ettigi dile gore yapilandir.
 * Cagiran restart gerekiyorsa restart icin reload tetiklemelidir.
 *
 * @param preferredLocale 'tr', 'ar', 'en' vs.
 * @returns { restartRequired: boolean } — true ise app reload edilmeli
 */
export function configureRTL(preferredLocale: string): { restartRequired: boolean } {
  const shouldBeRTL = isRTLLocale(preferredLocale);
  if (I18nManager.isRTL === shouldBeRTL) {
    return { restartRequired: false };
  }
  try {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    return { restartRequired: true };
  } catch {
    // Bazi platformlarda forceRTL throw edebilir
    return { restartRequired: false };
  }
}

/**
 * Yon-bazli stil degeri secimi.
 * Kullanim:
 *   transform: [{ scaleX: dirValue(1, -1) }]  // LTR=1, RTL=-1 (ikon flip)
 *   marginLeft: dirValue(16, 0)               // LTR=16, RTL=0
 */
export function dirValue<T>(ltrValue: T, rtlValue: T): T {
  return I18nManager.isRTL ? rtlValue : ltrValue;
}

/**
 * Chevron / arrow ikonlari icin yon flip helper.
 * Kullanim: `<Ionicons name="chevron-forward" style={{ transform: [{ scaleX: rtlIconScale() }] }} />`
 */
export function rtlIconScale(): number {
  return I18nManager.isRTL ? -1 : 1;
}

/**
 * iOS keyboard layout'unun RTL diller icin dogru ayarlandigindan emin ol.
 * (Apple genelde otomatik yapar; bu sadece edge case'ler icin.)
 */
export function ensureRTLKeyboard(): void {
  if (Platform.OS === 'ios' && I18nManager.isRTL) {
    // iOS otomatik. No-op.
  }
}

/**
 * Logical-flow stil donusum yardimi.
 * Stylesheet'te `marginLeft: 16` yazdiysaniz `applyDirectionalSpacing({marginLeft: 16})`
 * cagirarak otomatik `marginStart: 16` donusumu yapilir.
 * RN >= 0.71 logical properties zaten otomatik islenir — bu sadece legacy code icin.
 */
export function applyDirectionalSpacing(style: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...style };
  const map: Record<string, string> = {
    marginLeft: 'marginStart',
    marginRight: 'marginEnd',
    paddingLeft: 'paddingStart',
    paddingRight: 'paddingEnd',
    left: 'start',
    right: 'end',
    borderLeftWidth: 'borderStartWidth',
    borderRightWidth: 'borderEndWidth',
    borderLeftColor: 'borderStartColor',
    borderRightColor: 'borderEndColor',
  };
  for (const [legacy, logical] of Object.entries(map)) {
    if (legacy in result && !(logical in result)) {
      result[logical] = result[legacy];
      delete result[legacy];
    }
  }
  return result;
}
