/**
 * I18N SERVICE
 * Multi-language support - Turkish, Kurdish, Arabic
 */

import * as Localization from 'expo-localization';
import { createLogger } from '../utils/logger';

const logger = createLogger('I18nService');

// Translations
const translations = {
  tr: {
    app: {
      name: 'AfetNet',
      subtitle: 'Hayat Kurtaran Teknoloji',
    },
    common: {
      ok: 'Tamam',
      cancel: 'İptal',
      save: 'Kaydet',
      delete: 'Sil',
      edit: 'Düzenle',
      back: 'Geri',
      next: 'İleri',
      close: 'Kapat',
      loading: 'Yükleniyor...',
      error: 'Hata',
      success: 'Başarılı',
    },
    home: {
      title: 'Ana Sayfa',
      offline: 'Çevrimdışı',
      online: 'Çevrimiçi',
      lastEarthquake: 'Son Deprem',
      activeDisasters: 'Aktif Afetler',
      familyStatus: 'Aile Durumu',
    },
    earthquake: {
      title: 'Depremler',
      magnitude: 'Büyüklük',
      depth: 'Derinlik',
      location: 'Konum',
      time: 'Zaman',
      distance: 'Mesafe',
    },
    family: {
      title: 'Aile',
      safe: 'Güvende',
      needHelp: 'Yardım Gerekiyor',
      unknown: 'Bilinmiyor',
      addMember: 'Üye Ekle',
    },
    sos: {
      title: 'SOS',
      send: 'SOS Gönder',
      sent: 'SOS Gönderildi',
      location: 'Konum Paylaş',
    },
    alerts: {
      earthquake: 'Deprem Uyarısı',
      critical: 'Kritik',
      high: 'Yüksek',
      normal: 'Normal',
    },
    preparedness: {
      title: 'Hazırlık',
      quiz: 'Hazırlık Değerlendirmesi',
      score: 'Hazırlık Puanı',
    },
    settings: {
      title: 'Ayarlar',
      language: 'Dil',
      notifications: 'Bildirimler',
      location: 'Konum',
    },
  },
  ku: {
    app: {
      name: 'AfetNet',
      subtitle: 'Teknolojiya Jiyanxweş',
    },
    common: {
      ok: 'Erê',
      cancel: 'Betal',
      save: 'Tomar Bike',
      delete: 'Jêbirin',
      edit: 'Guhertin',
      back: 'Paş',
      next: 'Pêş',
      close: 'Bigre',
      loading: 'Tê barkirin...',
      error: 'Çewtî',
      success: 'Serkeftin',
    },
    home: {
      title: 'Rûpelê Sereke',
      offline: 'Bê Înternet',
      online: 'Bi Înternet',
      lastEarthquake: 'Erdheja Dawî',
      activeDisasters: 'Afetên Çalak',
      familyStatus: 'Rewşa Malbatê',
    },
    earthquake: {
      title: 'Erdhej',
      magnitude: 'Mezinahî',
      depth: 'Kûrî',
      location: 'Cih',
      time: 'Dem',
      distance: 'Dûrî',
    },
    family: {
      title: 'Malbat',
      safe: 'Emin',
      needHelp: 'Alîkarî Divê',
      unknown: 'Nenas',
      addMember: 'Endam Zêde Bike',
    },
    sos: {
      title: 'SOS',
      send: 'SOS Bişîne',
      sent: 'SOS Hate Şandin',
      location: 'Cih Parve Bike',
    },
    alerts: {
      earthquake: 'Hişyariya Erdhejê',
      critical: 'Girîng',
      high: 'Bilind',
      normal: 'Normal',
    },
    preparedness: {
      title: 'Amadebûn',
      quiz: 'Nirxandina Amadebûnê',
      score: 'Pûana Amadebûnê',
    },
    settings: {
      title: 'Mîheng',
      language: 'Ziman',
      notifications: 'Agahdariyên',
      location: 'Cih',
    },
  },
  ar: {
    app: {
      name: 'AfetNet',
      subtitle: 'التكنولوجيا المنقذة للحياة',
    },
    common: {
      ok: 'موافق',
      cancel: 'إلغاء',
      save: 'حفظ',
      delete: 'حذف',
      edit: 'تعديل',
      back: 'رجوع',
      next: 'التالي',
      close: 'إغلاق',
      loading: 'جاري التحميل...',
      error: 'خطأ',
      success: 'نجاح',
    },
    home: {
      title: 'الصفحة الرئيسية',
      offline: 'غير متصل',
      online: 'متصل',
      lastEarthquake: 'آخر زلزال',
      activeDisasters: 'الكوارث النشطة',
      familyStatus: 'حالة الأسرة',
    },
    earthquake: {
      title: 'الزلازل',
      magnitude: 'القوة',
      depth: 'العمق',
      location: 'الموقع',
      time: 'الوقت',
      distance: 'المسافة',
    },
    family: {
      title: 'الأسرة',
      safe: 'آمن',
      needHelp: 'يحتاج مساعدة',
      unknown: 'غير معروف',
      addMember: 'إضافة عضو',
    },
    sos: {
      title: 'SOS',
      send: 'إرسال SOS',
      sent: 'تم إرسال SOS',
      location: 'مشاركة الموقع',
    },
    alerts: {
      earthquake: 'تحذير زلزال',
      critical: 'حرج',
      high: 'عالٍ',
      normal: 'عادي',
    },
    preparedness: {
      title: 'التأهب',
      quiz: 'تقييم التأهب',
      score: 'نقاط التأهب',
    },
    settings: {
      title: 'الإعدادات',
      language: 'اللغة',
      notifications: 'الإشعارات',
      location: 'الموقع',
    },
  },
};

class I18nService {
  private translations: Record<string, Record<string, any>>;
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
        if (deviceLocale === 'ku') return 'ku';
        if (deviceLocale === 'ar') return 'ar';
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
  setLocale(locale: 'tr' | 'ku' | 'ar') {
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
  t(key: string, params?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = this.translations[this.currentLocale] || this.translations['tr'];
    
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
        return params[paramKey] || match;
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
      ku: 'Kurdî',
      ar: 'العربية',
    };
    return names[locale] || locale;
  }
}

export const i18nService = new I18nService();

// Convenience function
export const t = (key: string, params?: Record<string, any>) => i18nService.t(key, params);

