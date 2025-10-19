import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import trTranslations from './tr.json';
import enTranslations from './en.json';

const resources = {
  tr: {
    translation: trTranslations
  },
  en: {
    translation: enTranslations
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: Localization.getLocales()[0]?.languageCode || 'tr',
    fallbackLng: 'tr',
    
    interpolation: {
      escapeValue: false // React already escapes values
    },
    
    // React i18next options
    react: {
      useSuspense: false
    }
  });

export default i18n;
