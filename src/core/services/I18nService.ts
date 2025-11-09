/**
 * I18N SERVICE - ELITE PROFESSIONAL IMPLEMENTATION
 * Multi-language support with location-based auto-detection
 * Supports: English, Turkish, Arabic, German, French, Spanish, Russian, Chinese, Japanese, Korean
 */

import * as Localization from 'expo-localization';
import { createLogger } from '../utils/logger';
import { locationBasedLanguageService } from './LocationBasedLanguageService';

const logger = createLogger('I18nService');

// ELITE: Comprehensive translations for all supported languages
const translations = {
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
      yes: 'Yes',
      no: 'No',
      confirm: 'Confirm',
      retry: 'Retry',
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
      autoDetect: 'Auto-detect language',
    },
  },
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
      yes: 'Evet',
      no: 'Hayır',
      confirm: 'Onayla',
      retry: 'Tekrar Dene',
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
      autoDetect: 'Dili otomatik algıla',
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
      yes: 'نعم',
      no: 'لا',
      confirm: 'تأكيد',
      retry: 'إعادة المحاولة',
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
      autoDetect: 'الكشف التلقائي عن اللغة',
    },
  },
  de: {
    app: {
      name: 'AfetNet',
      subtitle: 'Lebensrettende Technologie',
    },
    common: {
      ok: 'OK',
      cancel: 'Abbrechen',
      save: 'Speichern',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      back: 'Zurück',
      next: 'Weiter',
      close: 'Schließen',
      loading: 'Wird geladen...',
      error: 'Fehler',
      success: 'Erfolg',
      yes: 'Ja',
      no: 'Nein',
      confirm: 'Bestätigen',
      retry: 'Wiederholen',
    },
    home: {
      title: 'Startseite',
      offline: 'Offline',
      online: 'Online',
      lastEarthquake: 'Letztes Erdbeben',
      activeDisasters: 'Aktive Katastrophen',
      familyStatus: 'Familienstatus',
    },
    earthquake: {
      title: 'Erdbeben',
      magnitude: 'Stärke',
      depth: 'Tiefe',
      location: 'Standort',
      time: 'Zeit',
      distance: 'Entfernung',
    },
    family: {
      title: 'Familie',
      safe: 'Sicher',
      needHelp: 'Braucht Hilfe',
      unknown: 'Unbekannt',
      addMember: 'Mitglied hinzufügen',
    },
    sos: {
      title: 'SOS',
      send: 'SOS senden',
      sent: 'SOS gesendet',
      location: 'Standort teilen',
    },
    alerts: {
      earthquake: 'Erdbebenwarnung',
      critical: 'Kritisch',
      high: 'Hoch',
      normal: 'Normal',
    },
    preparedness: {
      title: 'Vorbereitung',
      quiz: 'Vorbereitungsbewertung',
      score: 'Vorbereitungspunktzahl',
    },
    settings: {
      title: 'Einstellungen',
      language: 'Sprache',
      notifications: 'Benachrichtigungen',
      location: 'Standort',
      autoDetect: 'Sprache automatisch erkennen',
    },
  },
  fr: {
    app: {
      name: 'AfetNet',
      subtitle: 'Technologie de Sauvetage',
    },
    common: {
      ok: 'OK',
      cancel: 'Annuler',
      save: 'Enregistrer',
      delete: 'Supprimer',
      edit: 'Modifier',
      back: 'Retour',
      next: 'Suivant',
      close: 'Fermer',
      loading: 'Chargement...',
      error: 'Erreur',
      success: 'Succès',
      yes: 'Oui',
      no: 'Non',
      confirm: 'Confirmer',
      retry: 'Réessayer',
    },
    home: {
      title: 'Accueil',
      offline: 'Hors ligne',
      online: 'En ligne',
      lastEarthquake: 'Dernier tremblement',
      activeDisasters: 'Catastrophes actives',
      familyStatus: 'Statut familial',
    },
    earthquake: {
      title: 'Tremblements de terre',
      magnitude: 'Magnitude',
      depth: 'Profondeur',
      location: 'Emplacement',
      time: 'Heure',
      distance: 'Distance',
    },
    family: {
      title: 'Famille',
      safe: 'En sécurité',
      needHelp: 'Besoin d\'aide',
      unknown: 'Inconnu',
      addMember: 'Ajouter un membre',
    },
    sos: {
      title: 'SOS',
      send: 'Envoyer SOS',
      sent: 'SOS envoyé',
      location: 'Partager l\'emplacement',
    },
    alerts: {
      earthquake: 'Alerte sismique',
      critical: 'Critique',
      high: 'Élevé',
      normal: 'Normal',
    },
    preparedness: {
      title: 'Préparation',
      quiz: 'Évaluation de préparation',
      score: 'Score de préparation',
    },
    settings: {
      title: 'Paramètres',
      language: 'Langue',
      notifications: 'Notifications',
      location: 'Emplacement',
      autoDetect: 'Détection automatique de la langue',
    },
  },
  es: {
    app: {
      name: 'AfetNet',
      subtitle: 'Tecnología que Salva Vidas',
    },
    common: {
      ok: 'OK',
      cancel: 'Cancelar',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      back: 'Atrás',
      next: 'Siguiente',
      close: 'Cerrar',
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      yes: 'Sí',
      no: 'No',
      confirm: 'Confirmar',
      retry: 'Reintentar',
    },
    home: {
      title: 'Inicio',
      offline: 'Sin conexión',
      online: 'En línea',
      lastEarthquake: 'Último terremoto',
      activeDisasters: 'Desastres activos',
      familyStatus: 'Estado familiar',
    },
    earthquake: {
      title: 'Terremotos',
      magnitude: 'Magnitud',
      depth: 'Profundidad',
      location: 'Ubicación',
      time: 'Hora',
      distance: 'Distancia',
    },
    family: {
      title: 'Familia',
      safe: 'Seguro',
      needHelp: 'Necesita ayuda',
      unknown: 'Desconocido',
      addMember: 'Agregar miembro',
    },
    sos: {
      title: 'SOS',
      send: 'Enviar SOS',
      sent: 'SOS enviado',
      location: 'Compartir ubicación',
    },
    alerts: {
      earthquake: 'Alerta de terremoto',
      critical: 'Crítico',
      high: 'Alto',
      normal: 'Normal',
    },
    preparedness: {
      title: 'Preparación',
      quiz: 'Evaluación de preparación',
      score: 'Puntuación de preparación',
    },
    settings: {
      title: 'Configuración',
      language: 'Idioma',
      notifications: 'Notificaciones',
      location: 'Ubicación',
      autoDetect: 'Detectar idioma automáticamente',
    },
  },
  ru: {
    app: {
      name: 'AfetNet',
      subtitle: 'Технология Спасения Жизней',
    },
    common: {
      ok: 'ОК',
      cancel: 'Отмена',
      save: 'Сохранить',
      delete: 'Удалить',
      edit: 'Редактировать',
      back: 'Назад',
      next: 'Далее',
      close: 'Закрыть',
      loading: 'Загрузка...',
      error: 'Ошибка',
      success: 'Успех',
      yes: 'Да',
      no: 'Нет',
      confirm: 'Подтвердить',
      retry: 'Повторить',
    },
    home: {
      title: 'Главная',
      offline: 'Офлайн',
      online: 'Онлайн',
      lastEarthquake: 'Последнее землетрясение',
      activeDisasters: 'Активные катастрофы',
      familyStatus: 'Статус семьи',
    },
    earthquake: {
      title: 'Землетрясения',
      magnitude: 'Величина',
      depth: 'Глубина',
      location: 'Местоположение',
      time: 'Время',
      distance: 'Расстояние',
    },
    family: {
      title: 'Семья',
      safe: 'В безопасности',
      needHelp: 'Нужна помощь',
      unknown: 'Неизвестно',
      addMember: 'Добавить участника',
    },
    sos: {
      title: 'SOS',
      send: 'Отправить SOS',
      sent: 'SOS отправлен',
      location: 'Поделиться местоположением',
    },
    alerts: {
      earthquake: 'Предупреждение о землетрясении',
      critical: 'Критический',
      high: 'Высокий',
      normal: 'Нормальный',
    },
    preparedness: {
      title: 'Готовность',
      quiz: 'Оценка готовности',
      score: 'Оценка готовности',
    },
    settings: {
      title: 'Настройки',
      language: 'Язык',
      notifications: 'Уведомления',
      location: 'Местоположение',
      autoDetect: 'Автоматическое определение языка',
    },
  },
  zh: {
    app: {
      name: 'AfetNet',
      subtitle: '拯救生命的技术',
    },
    common: {
      ok: '确定',
      cancel: '取消',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      back: '返回',
      next: '下一步',
      close: '关闭',
      loading: '加载中...',
      error: '错误',
      success: '成功',
      yes: '是',
      no: '否',
      confirm: '确认',
      retry: '重试',
    },
    home: {
      title: '首页',
      offline: '离线',
      online: '在线',
      lastEarthquake: '最近地震',
      activeDisasters: '活跃灾害',
      familyStatus: '家庭状态',
    },
    earthquake: {
      title: '地震',
      magnitude: '震级',
      depth: '深度',
      location: '位置',
      time: '时间',
      distance: '距离',
    },
    family: {
      title: '家庭',
      safe: '安全',
      needHelp: '需要帮助',
      unknown: '未知',
      addMember: '添加成员',
    },
    sos: {
      title: 'SOS',
      send: '发送SOS',
      sent: 'SOS已发送',
      location: '分享位置',
    },
    alerts: {
      earthquake: '地震警报',
      critical: '严重',
      high: '高',
      normal: '正常',
    },
    preparedness: {
      title: '准备',
      quiz: '准备评估',
      score: '准备分数',
    },
    settings: {
      title: '设置',
      language: '语言',
      notifications: '通知',
      location: '位置',
      autoDetect: '自动检测语言',
    },
  },
  ja: {
    app: {
      name: 'AfetNet',
      subtitle: '命を救う技術',
    },
    common: {
      ok: 'OK',
      cancel: 'キャンセル',
      save: '保存',
      delete: '削除',
      edit: '編集',
      back: '戻る',
      next: '次へ',
      close: '閉じる',
      loading: '読み込み中...',
      error: 'エラー',
      success: '成功',
      yes: 'はい',
      no: 'いいえ',
      confirm: '確認',
      retry: '再試行',
    },
    home: {
      title: 'ホーム',
      offline: 'オフライン',
      online: 'オンライン',
      lastEarthquake: '最後の地震',
      activeDisasters: 'アクティブな災害',
      familyStatus: '家族の状態',
    },
    earthquake: {
      title: '地震',
      magnitude: 'マグニチュード',
      depth: '深度',
      location: '場所',
      time: '時間',
      distance: '距離',
    },
    family: {
      title: '家族',
      safe: '安全',
      needHelp: '助けが必要',
      unknown: '不明',
      addMember: 'メンバーを追加',
    },
    sos: {
      title: 'SOS',
      send: 'SOSを送信',
      sent: 'SOS送信済み',
      location: '場所を共有',
    },
    alerts: {
      earthquake: '地震警報',
      critical: '重大',
      high: '高',
      normal: '通常',
    },
    preparedness: {
      title: '準備',
      quiz: '準備評価',
      score: '準備スコア',
    },
    settings: {
      title: '設定',
      language: '言語',
      notifications: '通知',
      location: '場所',
      autoDetect: '言語を自動検出',
    },
  },
  ko: {
    app: {
      name: 'AfetNet',
      subtitle: '생명을 구하는 기술',
    },
    common: {
      ok: '확인',
      cancel: '취소',
      save: '저장',
      delete: '삭제',
      edit: '편집',
      back: '뒤로',
      next: '다음',
      close: '닫기',
      loading: '로딩 중...',
      error: '오류',
      success: '성공',
      yes: '예',
      no: '아니오',
      confirm: '확인',
      retry: '다시 시도',
    },
    home: {
      title: '홈',
      offline: '오프라인',
      online: '온라인',
      lastEarthquake: '최근 지진',
      activeDisasters: '활성 재난',
      familyStatus: '가족 상태',
    },
    earthquake: {
      title: '지진',
      magnitude: '규모',
      depth: '깊이',
      location: '위치',
      time: '시간',
      distance: '거리',
    },
    family: {
      title: '가족',
      safe: '안전',
      needHelp: '도움 필요',
      unknown: '알 수 없음',
      addMember: '멤버 추가',
    },
    sos: {
      title: 'SOS',
      send: 'SOS 보내기',
      sent: 'SOS 전송됨',
      location: '위치 공유',
    },
    alerts: {
      earthquake: '지진 경보',
      critical: '심각',
      high: '높음',
      normal: '정상',
    },
    preparedness: {
      title: '준비',
      quiz: '준비 평가',
      score: '준비 점수',
    },
    settings: {
      title: '설정',
      language: '언어',
      notifications: '알림',
      location: '위치',
      autoDetect: '언어 자동 감지',
    },
  },
};

class I18nService {
  private translations: Record<string, Record<string, any>>;
  private currentLocale: string = 'en'; // Default to English
  private autoDetectEnabled: boolean = true;

  constructor() {
    this.translations = translations;
    this.initialize();
  }

  /**
   * Initialize i18n service with auto-detection
   */
  async initialize(): Promise<void> {
    try {
      if (this.autoDetectEnabled) {
        // ELITE: Auto-detect language based on location and device
        const detectedLanguage = await locationBasedLanguageService.detectLanguage();
        this.currentLocale = detectedLanguage;
        logger.info('✅ I18n initialized with auto-detected language:', detectedLanguage);
      } else {
        // Fallback to device locale
        this.currentLocale = this.getDeviceLocale();
        logger.info('✅ I18n initialized with device locale:', this.currentLocale);
      }
    } catch (error) {
      logger.error('I18n initialization error:', error);
      this.currentLocale = 'en'; // Fallback to English
    }
  }

  /**
   * Get device locale (fallback method)
   */
  private getDeviceLocale(): string {
    try {
      const locales = Localization.getLocales();
      if (locales && locales.length > 0) {
        const languageCode = locales[0].languageCode || '';
        // Map to supported languages
        const supportedLanguages = Object.keys(translations);
        if (supportedLanguages.includes(languageCode)) {
          return languageCode;
        }
        // Handle language variants (e.g., en-US -> en)
        const baseLanguage = languageCode.split('-')[0];
        if (supportedLanguages.includes(baseLanguage)) {
          return baseLanguage;
        }
      }
      return 'en'; // Default to English
    } catch (error) {
      logger.error('Get device locale error:', error);
      return 'en';
    }
  }

  /**
   * Set current locale
   */
  setLocale(locale: 'en' | 'tr' | 'ar' | 'de' | 'fr' | 'es' | 'ru' | 'zh' | 'ja' | 'ko') {
    this.currentLocale = locale;
    this.autoDetectEnabled = false; // Disable auto-detect when manually set
    
    if (__DEV__) {
      logger.info('✅ Locale changed to:', locale);
    }
  }

  /**
   * Get current locale
   */
  getLocale(): string {
    return this.currentLocale;
  }

  /**
   * Enable/disable auto-detection
   */
  setAutoDetect(enabled: boolean): void {
    this.autoDetectEnabled = enabled;
    if (enabled) {
      this.initialize();
    }
  }

  /**
   * Check if auto-detection is enabled
   */
  isAutoDetectEnabled(): boolean {
    return this.autoDetectEnabled;
  }

  /**
   * Translate key with fallback chain
   */
  t(key: string, params?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = this.translations[this.currentLocale] || this.translations['en'];
    
    // Try current locale first
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        break;
      }
    }
    
    // Fallback to English if not found
    if (value === undefined || typeof value !== 'string') {
      value = this.translations['en'];
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) {
          return key; // Return key if translation not found
        }
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
   * ELITE: Explicitly filter out Kurdish (ku) if it exists
   * CRITICAL: Return only the 10 supported languages explicitly
   */
  getSupportedLocales(): string[] {
    // ELITE: Explicitly return only the 10 supported languages (no Kurdish)
    const supportedLocales: string[] = ['en', 'tr', 'ar', 'de', 'fr', 'es', 'ru', 'zh', 'ja', 'ko'];
    
    // Double-check: Filter translations keys and ensure they match
    const allLocales = Object.keys(translations);
    const validLocales = allLocales.filter(locale => 
      supportedLocales.includes(locale) && 
      locale !== 'ku' && 
      locale !== 'Kurdish'
    );
    
    // Return explicit list (most reliable)
    return supportedLocales;
  }

  /**
   * Get locale display name
   */
  getLocaleDisplayName(locale: string): string {
    const names: Record<string, string> = {
      en: 'English',
      tr: 'Türkçe',
      ar: 'العربية',
      de: 'Deutsch',
      fr: 'Français',
      es: 'Español',
      ru: 'Русский',
      zh: '中文',
      ja: '日本語',
      ko: '한국어',
    };
    // ELITE: Explicitly exclude Kurdish
    if (locale === 'ku' || locale === 'Kurdish' || locale === 'Kurdî') {
      return ''; // Return empty string to filter out
    }
    return names[locale] || locale;
  }

  /**
   * Get locale native name (for display in language selector)
   */
  getLocaleNativeName(locale: string): string {
    const names: Record<string, string> = {
      en: 'English',
      tr: 'Türkçe',
      ar: 'العربية',
      de: 'Deutsch',
      fr: 'Français',
      es: 'Español',
      ru: 'Русский',
      zh: '中文',
      ja: '日本語',
      ko: '한국어',
    };
    return names[locale] || locale;
  }
}

export const i18nService = new I18nService();

// Convenience function
export const t = (key: string, params?: Record<string, any>) => i18nService.t(key, params);
