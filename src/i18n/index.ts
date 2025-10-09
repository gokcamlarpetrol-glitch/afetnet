import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

const resources = {
  tr: {
    translation: {
      // Emergency
      sos: {
        help: 'YARDIM İSTE',
        active: 'SOS AKTİF',
        cancel: 'İPTAL',
        helpOnWay: 'Yardım yolda',
        tapSOS: 'Vuruş SOS'
      },
      
      // Map
      map: {
        offline: 'Çevrimdışı Harita',
        prefetch: 'Ön Belleğe Al (2 km)',
        downloading: 'İndiriliyor',
        cache: 'Önbellek',
        pdr: 'PDR',
        ble: 'BLE',
        compass: 'Pusula',
        direction: 'Yön Bulma',
        distance: 'Mesafe',
        bearing: 'Kuzeyden Açı',
        currentHeading: 'Mevcut Yön',
        close: 'Kapat'
      },
      
      // Navigation
      nav: {
        home: 'Ana Sayfa',
        map: 'Harita',
        family: 'Aile',
        settings: 'Ayarlar'
      },
      
      // Diagnostics
      diag: {
        runAll: 'TÜM TESTLERİ ÇALIŞTIR',
        running: 'Çalışıyor…',
        network: 'Ağ durumu',
        storage: 'AsyncStorage R/W',
        notifications: 'Bildirim izni',
        backgroundFetch: 'BackgroundFetch kayıtlı mı',
        location: 'Konum izni',
        sensors: 'Sensörler (Accel+Magneto)',
        quake: 'Deprem beslemesi (USGS)',
        quakeCache: 'Deprem cache',
        tiles: 'Harita önbellek boyutu',
        queue: 'Kuyruk persist',
        family: 'Aile persist',
        compass: 'Pusula heading',
        bleRelay: 'BLE Relay',
        pdrFuse: 'PDR Fusion'
      },
      
      // Emergency Mode
      emergency: {
        mode: 'Acil Durum Modu',
        enabled: 'Aktif',
        disabled: 'Pasif',
        batterySaver: 'Batarya Tasarrufu',
        aggressiveBeacon: 'Agresif Beacon',
        highContrast: 'Yüksek Kontrast'
      },
      
      // Settings
      settings: {
        title: 'Ayarlar',
        quakeData: 'Deprem Verisi',
        provider: 'Sağlayıcı',
        threshold: 'Büyüklük Eşiği',
        pollInterval: 'Sorgulama Aralığı',
        relayTTL: 'Relay TTL',
        privacy: 'Gizlilik',
        safety: 'Güvenlik',
        about: 'Hakkında',
        diagnostics: 'Tanı / Aktivasyon',
        developerLogs: 'Geliştirici Günlükleri'
      },
      
      // Family
      family: {
        title: 'Aile',
        addMember: 'Üye Ekle',
        shareLocation: 'Konum Paylaş',
        requestLocation: 'Konum İste',
        lastSeen: 'Son Görülme',
        bulkQR: 'Toplu QR Paylaş'
      },
      
      // Helper
      helper: {
        sosReceived: 'SOS Sinyali Alındı',
        helpNeeded: 'Yardıma ihtiyacı olan biri var. Ne yapmak istiyorsunuz?',
        showDirection: 'Yön Göster',
        going: 'GİDİYORUM',
        cancel: 'İptal',
        responseSent: 'Yanıt Gönderildi',
        goingMessage: 'Yardıma gidiyorum mesajı gönderildi'
      },
      
      // Common
      common: {
        active: 'Aktif',
        passive: 'Pasif',
        steps: 'adım',
        messages: 'mesaj',
        recent: 'son',
        position: 'Konum',
        accuracy: 'Doğruluk',
        confidence: 'Güven',
        samples: 'örnek',
        online: 'online',
        offline: 'offline',
        granted: 'granted',
        denied: 'denied',
        none: 'yok',
        loading: 'Yükleniyor...',
        error: 'Hata',
        success: 'Başarılı',
        cancel: 'İptal',
        ok: 'Tamam',
        send: 'Gönder',
        share: 'Paylaş',
        export: 'Dışa Aktar',
        clear: 'Temizle'
      }
    }
  },
  en: {
    translation: {
      // Emergency
      sos: {
        help: 'REQUEST HELP',
        active: 'SOS ACTIVE',
        cancel: 'CANCEL',
        helpOnWay: 'Help on the way',
        tapSOS: 'Tap SOS'
      },
      
      // Map
      map: {
        offline: 'Offline Map',
        prefetch: 'Prefetch (2 km)',
        downloading: 'Downloading',
        cache: 'Cache',
        pdr: 'PDR',
        ble: 'BLE',
        compass: 'Compass',
        direction: 'Direction Finding',
        distance: 'Distance',
        bearing: 'Bearing from North',
        currentHeading: 'Current Heading',
        close: 'Close'
      },
      
      // Navigation
      nav: {
        home: 'Home',
        map: 'Map',
        family: 'Family',
        settings: 'Settings'
      },
      
      // Diagnostics
      diag: {
        runAll: 'RUN ALL TESTS',
        running: 'Running…',
        network: 'Network status',
        storage: 'AsyncStorage R/W',
        notifications: 'Notification permission',
        backgroundFetch: 'BackgroundFetch registered',
        location: 'Location permission',
        sensors: 'Sensors (Accel+Magneto)',
        quake: 'Quake feed (USGS)',
        quakeCache: 'Quake cache',
        tiles: 'Map cache size',
        queue: 'Queue persist',
        family: 'Family persist',
        compass: 'Compass heading',
        bleRelay: 'BLE Relay',
        pdrFuse: 'PDR Fusion'
      },
      
      // Emergency Mode
      emergency: {
        mode: 'Emergency Mode',
        enabled: 'Active',
        disabled: 'Passive',
        batterySaver: 'Battery Saver',
        aggressiveBeacon: 'Aggressive Beacon',
        highContrast: 'High Contrast'
      },
      
      // Settings
      settings: {
        title: 'Settings',
        quakeData: 'Quake Data',
        provider: 'Provider',
        threshold: 'Magnitude Threshold',
        pollInterval: 'Poll Interval',
        relayTTL: 'Relay TTL',
        privacy: 'Privacy',
        safety: 'Safety',
        about: 'About',
        diagnostics: 'Diagnostics & Activation',
        developerLogs: 'Developer Logs'
      },
      
      // Family
      family: {
        title: 'Family',
        addMember: 'Add Member',
        shareLocation: 'Share Location',
        requestLocation: 'Request Location',
        lastSeen: 'Last Seen',
        bulkQR: 'Bulk QR Share'
      },
      
      // Helper
      helper: {
        sosReceived: 'SOS Signal Received',
        helpNeeded: 'Someone needs help. What would you like to do?',
        showDirection: 'Show Direction',
        going: 'GOING',
        cancel: 'Cancel',
        responseSent: 'Response Sent',
        goingMessage: 'Going to help message sent'
      },
      
      // Common
      common: {
        active: 'Active',
        passive: 'Passive',
        steps: 'steps',
        messages: 'messages',
        recent: 'recent',
        position: 'Position',
        accuracy: 'Accuracy',
        confidence: 'Confidence',
        samples: 'samples',
        online: 'online',
        offline: 'offline',
        granted: 'granted',
        denied: 'denied',
        none: 'none',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        cancel: 'Cancel',
        ok: 'OK',
        send: 'Send',
        share: 'Share',
        export: 'Export',
        clear: 'Clear'
      }
    }
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
