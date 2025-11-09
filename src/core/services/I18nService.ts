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
  en: {
    app: {
      name: 'AfetNet',
      subtitle: 'Life-Saving Technology',
    },
    common: {
      ok: 'OK',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      back: 'Back',
      next: 'Next',
      close: 'Close',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
    },
    home: {
      title: 'Home',
      offline: 'Offline',
      online: 'Online',
      lastEarthquake: 'Last Earthquake',
      activeDisasters: 'Active Disasters',
      familyStatus: 'Family Status',
    },
    earthquake: {
      title: 'Earthquakes',
      magnitude: 'Magnitude',
      depth: 'Depth',
      location: 'Location',
      time: 'Time',
      distance: 'Distance',
    },
    family: {
      title: 'Family',
      safe: 'Safe',
      needHelp: 'Need Help',
      unknown: 'Unknown',
      addMember: 'Add Member',
    },
    sos: {
      title: 'SOS',
      send: 'Send SOS',
      sent: 'SOS Sent',
      location: 'Share Location',
    },
    alerts: {
      earthquake: 'Earthquake Alert',
      critical: 'Critical',
      high: 'High',
      normal: 'Normal',
    },
    preparedness: {
      title: 'Preparedness',
      quiz: 'Preparedness Assessment',
      score: 'Preparedness Score',
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      notifications: 'Notifications',
      location: 'Location',
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
        if (deviceLocale === 'en') return 'en';
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
  setLocale(locale: 'tr' | 'en' | 'ar') {
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
      en: 'English',
      ar: 'العربية',
    };
    return names[locale] || locale;
  }
}

export const i18nService = new I18nService();

// Convenience function
export const t = (key: string, params?: Record<string, any>) => i18nService.t(key, params);

