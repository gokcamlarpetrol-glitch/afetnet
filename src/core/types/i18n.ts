/**
 * I18N TYPES - ELITE TYPE DEFINITIONS
 * Proper type definitions for i18n system
 */

/**
 * Translation value can be a string or nested object
 */
export type TranslationValue = string | TranslationObject;

/**
 * Translation object structure
 */
export interface TranslationObject {
  [key: string]: TranslationValue;
}

/**
 * Translations structure for all locales
 */
export interface Translations {
  tr: TranslationObject;
  en: TranslationObject;
  ar: TranslationObject;
  ru: TranslationObject;
}

/**
 * Translation parameters for interpolation
 */
export interface TranslationParams {
  [key: string]: string | number | boolean;
}









