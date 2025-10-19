import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useComprehensiveFeatures } from '../store/comprehensiveFeatures';

interface FeatureCategory {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  features: FeatureItem[];
}

interface FeatureItem {
  key: string;
  title: string;
  description: string;
  type: 'boolean' | 'number' | 'select';
  options?: { label: string; value: any }[];
  min?: number;
  max?: number;
  step?: number;
}

const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'emergency',
    title: 'Acil Durum & SOS',
    description: 'SOS, panik modu ve acil durum özellikleri',
    icon: 'warning-outline',
    color: '#EF4444',
    features: [
      { key: 'sosEnabled', title: 'SOS Aktif', description: 'SOS butonu ve acil yardım', type: 'boolean' },
      { key: 'panicModeEnabled', title: 'Panik Modu', description: 'Hızlı panik modu aktivasyonu', type: 'boolean' },
      { key: 'emergencyBroadcastEnabled', title: 'Acil Yayın', description: 'Acil durum yayını', type: 'boolean' },
      { key: 'criticalAlarmEnabled', title: 'Kritik Alarm', description: 'Kritik durum alarmları', type: 'boolean' },
      { key: 'autoHelpRequestEnabled', title: 'Otomatik Yardım', description: 'Otomatik yardım talebi', type: 'boolean' },
      { key: 'emergencyLocationSharingEnabled', title: 'Konum Paylaşımı', description: 'Acil durumda konum paylaşımı', type: 'boolean' },
      { key: 'emergencyContactsEnabled', title: 'Acil İletişim', description: 'Acil durum kişileri', type: 'boolean' },
      { key: 'emergencyMedicalInfoEnabled', title: 'Medikal Bilgi', description: 'Acil durum medikal bilgileri', type: 'boolean' },
      { key: 'sosSoundEnabled', title: 'SOS Sesi', description: 'SOS sesli uyarı', type: 'boolean' },
      { key: 'sosVibrationEnabled', title: 'SOS Titreşim', description: 'SOS titreşim uyarısı', type: 'boolean' },
      { key: 'sosFlashEnabled', title: 'SOS Flaş', description: 'SOS flaş uyarısı', type: 'boolean' },
    ]
  },
  {
    id: 'mapping',
    title: 'Harita & Konum',
    description: 'Harita, GPS ve konum özellikleri',
    icon: 'map-outline',
    color: '#3B82F6',
    features: [
      { key: 'onlineMapsEnabled', title: 'Online Harita', description: 'İnternet üzerinden harita', type: 'boolean' },
      { key: 'offlineMapsEnabled', title: 'Offline Harita', description: 'Çevrimdışı harita desteği', type: 'boolean' },
      { key: 'gpsTrackingEnabled', title: 'GPS Takibi', description: 'GPS konum takibi', type: 'boolean' },
      { key: 'backgroundLocationEnabled', title: 'Arka Plan Konum', description: 'Arka planda konum takibi', type: 'boolean' },
      { key: 'locationAccuracy', title: 'Konum Doğruluğu', description: 'GPS doğruluk seviyesi', type: 'select', options: [
        { label: 'Düşük', value: 'low' },
        { label: 'Orta', value: 'medium' },
        { label: 'Yüksek', value: 'high' },
        { label: 'En Yüksek', value: 'highest' }
      ]},
      { key: 'routePlanningEnabled', title: 'Rota Planlama', description: 'Rota planlama özelliği', type: 'boolean' },
      { key: 'navigationEnabled', title: 'Navigasyon', description: 'Yön tarifi özelliği', type: 'boolean' },
      { key: 'compassEnabled', title: 'Pusula', description: 'Dijital pusula', type: 'boolean' },
      { key: 'pdrEnabled', title: 'PDR', description: 'Pedestrian Dead Reckoning', type: 'boolean' },
    ]
  },
  {
    id: 'mesh',
    title: 'Mesh Ağ',
    description: 'Mesh ağ ve bağlantı özellikleri',
    icon: 'radio-outline',
    color: '#8B5CF6',
    features: [
      { key: 'bleMeshEnabled', title: 'BLE Mesh', description: 'Bluetooth Low Energy mesh', type: 'boolean' },
      { key: 'wifiDirectEnabled', title: 'WiFi Direct', description: 'WiFi Direct bağlantısı', type: 'boolean' },
      { key: 'loraEnabled', title: 'LoRa', description: 'LoRa uzun menzil iletişim', type: 'boolean' },
      { key: 'meshDiscoveryEnabled', title: 'Mesh Keşif', description: 'Otomatik mesh keşfi', type: 'boolean' },
      { key: 'meshRelayEnabled', title: 'Mesh Relay', description: 'Mesh röle özelliği', type: 'boolean' },
      { key: 'meshEncryptionEnabled', title: 'Mesh Şifreleme', description: 'Mesh ağ şifreleme', type: 'boolean' },
      { key: 'meshRange', title: 'Mesh Menzil', description: 'Mesh ağ menzili (metre)', type: 'number', min: 10, max: 1000, step: 10 },
      { key: 'meshPowerSavingEnabled', title: 'Güç Tasarrufu', description: 'Mesh güç tasarrufu', type: 'boolean' },
      { key: 'bridgeModeEnabled', title: 'Köprü Modu', description: 'Köprü modu özelliği', type: 'boolean' },
    ]
  },
  {
    id: 'communication',
    title: 'İletişim',
    description: 'Mesajlaşma ve iletişim özellikleri',
    icon: 'chatbubbles-outline',
    color: '#10B981',
    features: [
      { key: 'offlineMessagingEnabled', title: 'Offline Mesajlaşma', description: 'Çevrimdışı mesajlaşma', type: 'boolean' },
      { key: 'encryptedMessagingEnabled', title: 'Şifreli Mesajlaşma', description: 'End-to-end şifreleme', type: 'boolean' },
      { key: 'voiceMessagingEnabled', title: 'Sesli Mesaj', description: 'Sesli mesajlaşma', type: 'boolean' },
      { key: 'voiceCommandsEnabled', title: 'Ses Komutları', description: 'Sesli komut sistemi', type: 'boolean' },
      { key: 'morseCodeEnabled', title: 'Mors Kodu', description: 'Mors kodu iletişimi', type: 'boolean' },
      { key: 'ulbMessagingEnabled', title: 'ULB Mesajlaşma', description: 'Ultra düşük bant genişliği', type: 'boolean' },
      { key: 'whisperNavEnabled', title: 'Whisper Nav', description: 'Fısıltı navigasyonu', type: 'boolean' },
      { key: 'voicePingEnabled', title: 'Ses Ping', description: 'Sesli ping sistemi', type: 'boolean' },
      { key: 'translateEnabled', title: 'Çeviri', description: 'Dil çeviri özelliği', type: 'boolean' },
      { key: 'nearbyChatEnabled', title: 'Yakın Sohbet', description: 'Yakındaki kişilerle sohbet', type: 'boolean' },
      { key: 'familyChatEnabled', title: 'Aile Sohbeti', description: 'Aile üyeleriyle sohbet', type: 'boolean' },
      { key: 'groupChatEnabled', title: 'Grup Sohbeti', description: 'Grup sohbet özelliği', type: 'boolean' },
    ]
  },
  {
    id: 'earthquake',
    title: 'Deprem & Erken Uyarı',
    description: 'Deprem takibi ve erken uyarı sistemi',
    icon: 'pulse-outline',
    color: '#F59E0B',
    features: [
      { key: 'liveModeEnabled', title: 'Canlı Mod', description: 'Gerçek zamanlı deprem takibi', type: 'boolean' },
      { key: 'experimentalPWaveEnabled', title: 'P-dalgası', description: 'Deneysel P-dalgası algılama', type: 'boolean' },
      { key: 'magnitudeThreshold', title: 'Büyüklük Eşiği', description: 'Minimum deprem büyüklüğü', type: 'number', min: 2.0, max: 7.0, step: 0.1 },
      { key: 'alertRadius', title: 'Uyarı Yarıçapı', description: 'Uyarı yarıçapı (km)', type: 'number', min: 10, max: 1000, step: 10 },
      { key: 'dataSource', title: 'Veri Kaynağı', description: 'Deprem veri sağlayıcısı', type: 'select', options: [
        { label: 'AFAD', value: 'AFAD' },
        { label: 'Kandilli', value: 'KANDILLI' },
        { label: 'USGS', value: 'USGS' }
      ]},
      { key: 'eewAlarmEnabled', title: 'EEW Alarm', description: 'Erken uyarı alarmı', type: 'boolean' },
      { key: 'quakeNotificationsEnabled', title: 'Deprem Bildirimleri', description: 'Deprem bildirimleri', type: 'boolean' },
      { key: 'quakeSoundEnabled', title: 'Deprem Sesi', description: 'Deprem sesli uyarı', type: 'boolean' },
      { key: 'quakeVibrationEnabled', title: 'Deprem Titreşim', description: 'Deprem titreşim uyarısı', type: 'boolean' },
    ]
  },
  {
    id: 'family',
    title: 'Aile & Sosyal',
    description: 'Aile takibi ve sosyal özellikler',
    icon: 'people-outline',
    color: '#06B6D4',
    features: [
      { key: 'familyTrackingEnabled', title: 'Aile Takibi', description: 'Aile üyelerini takip et', type: 'boolean' },
      { key: 'familyProximityEnabled', title: 'Yakınlık Takibi', description: 'Aile yakınlık takibi', type: 'boolean' },
      { key: 'familyMapEnabled', title: 'Aile Haritası', description: 'Aile harita görünümü', type: 'boolean' },
      { key: 'familyLinkEnabled', title: 'Aile Bağlantısı', description: 'Aile bağlantı sistemi', type: 'boolean' },
      { key: 'familyChatEnabled', title: 'Aile Sohbeti', description: 'Aile sohbet özelliği', type: 'boolean' },
      { key: 'familyLocationSharingEnabled', title: 'Konum Paylaşımı', description: 'Aile konum paylaşımı', type: 'boolean' },
      { key: 'familyStatusSharingEnabled', title: 'Durum Paylaşımı', description: 'Aile durum paylaşımı', type: 'boolean' },
      { key: 'familyEmergencyAlertsEnabled', title: 'Acil Uyarılar', description: 'Aile acil uyarıları', type: 'boolean' },
      { key: 'familyHealthMonitoringEnabled', title: 'Sağlık Takibi', description: 'Aile sağlık takibi', type: 'boolean' },
      { key: 'familySafetyCheckEnabled', title: 'Güvenlik Kontrolü', description: 'Aile güvenlik kontrolü', type: 'boolean' },
    ]
  },
  {
    id: 'health',
    title: 'Sağlık & Medikal',
    description: 'Sağlık takibi ve medikal özellikler',
    icon: 'medical-outline',
    color: '#EF4444',
    features: [
      { key: 'selfCheckEnabled', title: 'Kendi Kendine Kontrol', description: 'Hızlı sağlık testi', type: 'boolean' },
      { key: 'healthMonitoringEnabled', title: 'Sağlık Takibi', description: 'Sağlık durumu takibi', type: 'boolean' },
      { key: 'medicalInfoEnabled', title: 'Medikal Bilgi', description: 'Medikal bilgi saklama', type: 'boolean' },
      { key: 'iceInfoEnabled', title: 'ICE Bilgisi', description: 'Acil durum bilgileri', type: 'boolean' },
      { key: 'emergencyMedicalSystemEnabled', title: 'Acil Medikal Sistem', description: 'Acil medikal sistem', type: 'boolean' },
      { key: 'healthDataSharingEnabled', title: 'Sağlık Verisi Paylaşımı', description: 'Sağlık verisi paylaşımı', type: 'boolean' },
      { key: 'medicalAlertEnabled', title: 'Medikal Uyarı', description: 'Medikal uyarı sistemi', type: 'boolean' },
      { key: 'healthReportEnabled', title: 'Sağlık Raporu', description: 'Sağlık raporu oluşturma', type: 'boolean' },
      { key: 'vitalSignsMonitoringEnabled', title: 'Vital Takip', description: 'Vital bulgular takibi', type: 'boolean' },
      { key: 'medicationReminderEnabled', title: 'İlaç Hatırlatıcısı', description: 'İlaç hatırlatma sistemi', type: 'boolean' },
    ]
  },
  {
    id: 'rescue',
    title: 'Kurtarma & Arama',
    description: 'Kurtarma ve arama operasyonları',
    icon: 'search-outline',
    color: '#F97316',
    features: [
      { key: 'sarModeEnabled', title: 'SAR Modu', description: 'Search and Rescue modu', type: 'boolean' },
      { key: 'rescueGuidanceEnabled', title: 'Kurtarma Rehberi', description: 'Kurtarma rehber sistemi', type: 'boolean' },
      { key: 'rescueScannerEnabled', title: 'Kurtarma Tarayıcısı', description: 'Kurtarma tarayıcı sistemi', type: 'boolean' },
      { key: 'rescueWizardEnabled', title: 'Kurtarma Sihirbazı', description: 'Kurtarma sihirbaz sistemi', type: 'boolean' },
      { key: 'survivorDetectionEnabled', title: 'Hayatta Kalan Algılama', description: 'Hayatta kalan algılama', type: 'boolean' },
      { key: 'victimDetectionEnabled', title: 'Kurban Algılama', description: 'Kurban algılama sistemi', type: 'boolean' },
      { key: 'rescueCoordinatorEnabled', title: 'Kurtarma Koordinatörü', description: 'Kurtarma koordinasyon sistemi', type: 'boolean' },
      { key: 'rescueAssistEnabled', title: 'Kurtarma Yardımcısı', description: 'Kurtarma yardım sistemi', type: 'boolean' },
      { key: 'rubbleModeEnabled', title: 'Enkaz Modu', description: 'Enkaz altı modu', type: 'boolean' },
      { key: 'trappedModeEnabled', title: 'Tuzağa Düşme Modu', description: 'Tuzağa düşme modu', type: 'boolean' },
      { key: 'sonarEnabled', title: 'Sonar', description: 'Sonar algılama sistemi', type: 'boolean' },
      { key: 'audioBeaconEnabled', title: 'Ses İşareti', description: 'Ses işareti sistemi', type: 'boolean' },
      { key: 'audioDetectEnabled', title: 'Ses Algılama', description: 'Ses algılama sistemi', type: 'boolean' },
    ]
  },
  {
    id: 'power',
    title: 'Güç & Pil',
    description: 'Güç yönetimi ve pil optimizasyonu',
    icon: 'battery-charging-outline',
    color: '#84CC16',
    features: [
      { key: 'emergencyPowerModeEnabled', title: 'Acil Güç Modu', description: 'Acil durum güç modu', type: 'boolean' },
      { key: 'powerSavingEnabled', title: 'Güç Tasarrufu', description: 'Güç tasarrufu modu', type: 'boolean' },
      { key: 'batteryOptimizationEnabled', title: 'Pil Optimizasyonu', description: 'Pil optimizasyon sistemi', type: 'boolean' },
      { key: 'powerProfileEnabled', title: 'Güç Profili', description: 'Güç profili yönetimi', type: 'boolean' },
      { key: 'lowBatteryAlertsEnabled', title: 'Düşük Pil Uyarısı', description: 'Düşük pil uyarı sistemi', type: 'boolean' },
      { key: 'powerMonitoringEnabled', title: 'Güç İzleme', description: 'Güç tüketimi izleme', type: 'boolean' },
      { key: 'chargingOptimizationEnabled', title: 'Şarj Optimizasyonu', description: 'Şarj optimizasyon sistemi', type: 'boolean' },
      { key: 'backgroundTaskOptimizationEnabled', title: 'Arka Plan Optimizasyonu', description: 'Arka plan görev optimizasyonu', type: 'boolean' },
    ]
  },
  {
    id: 'security',
    title: 'Güvenlik',
    description: 'Güvenlik ve şifreleme özellikleri',
    icon: 'shield-checkmark-outline',
    color: '#6366F1',
    features: [
      { key: 'biometricEnabled', title: 'Biyometrik', description: 'Biyometrik kimlik doğrulama', type: 'boolean' },
      { key: 'encryptionEnabled', title: 'Şifreleme', description: 'Veri şifreleme sistemi', type: 'boolean' },
      { key: 'screenLockEnabled', title: 'Ekran Kilidi', description: 'Ekran kilidi sistemi', type: 'boolean' },
      { key: 'appLockEnabled', title: 'Uygulama Kilidi', description: 'Uygulama kilidi sistemi', type: 'boolean' },
      { key: 'twoFactorAuthEnabled', title: 'İki Faktörlü Doğrulama', description: '2FA kimlik doğrulama', type: 'boolean' },
      { key: 'loginNotificationsEnabled', title: 'Giriş Bildirimleri', description: 'Giriş bildirim sistemi', type: 'boolean' },
      { key: 'suspiciousActivityAlertsEnabled', title: 'Şüpheli Aktivite', description: 'Şüpheli aktivite uyarıları', type: 'boolean' },
      { key: 'sessionTimeout', title: 'Oturum Zaman Aşımı', description: 'Oturum zaman aşımı (dakika)', type: 'number', min: 5, max: 120, step: 5 },
      { key: 'passwordComplexity', title: 'Şifre Karmaşıklığı', description: 'Şifre karmaşıklık seviyesi', type: 'select', options: [
        { label: 'Düşük', value: 'low' },
        { label: 'Orta', value: 'medium' },
        { label: 'Yüksek', value: 'high' }
      ]},
      { key: 'dataEncryptionEnabled', title: 'Veri Şifreleme', description: 'Veri şifreleme sistemi', type: 'boolean' },
      { key: 'secureStorageEnabled', title: 'Güvenli Depolama', description: 'Güvenli veri depolama', type: 'boolean' },
      { key: 'privacyAuditEnabled', title: 'Gizlilik Denetimi', description: 'Gizlilik denetim sistemi', type: 'boolean' },
    ]
  },
  {
    id: 'data',
    title: 'Veri & Yedekleme',
    description: 'Veri yönetimi ve yedekleme',
    icon: 'server-outline',
    color: '#84CC16',
    features: [
      { key: 'autoBackupEnabled', title: 'Otomatik Yedekleme', description: 'Otomatik veri yedekleme', type: 'boolean' },
      { key: 'cloudSyncEnabled', title: 'Bulut Senkronizasyonu', description: 'Bulut veri senkronizasyonu', type: 'boolean' },
      { key: 'syncWifiOnlyEnabled', title: 'Sadece WiFi', description: 'Sadece WiFi ile senkronizasyon', type: 'boolean' },
      { key: 'dataRetention', title: 'Veri Saklama', description: 'Veri saklama süresi (gün)', type: 'number', min: 30, max: 365, step: 30 },
      { key: 'localStorageSize', title: 'Yerel Depolama', description: 'Yerel depolama boyutu (MB)', type: 'number', min: 64, max: 1024, step: 64 },
      { key: 'compressionLevel', title: 'Sıkıştırma Seviyesi', description: 'Veri sıkıştırma seviyesi', type: 'select', options: [
        { label: 'Düşük', value: 'low' },
        { label: 'Orta', value: 'medium' },
        { label: 'Yüksek', value: 'high' }
      ]},
      { key: 'encryptionLevel', title: 'Şifreleme Seviyesi', description: 'Veri şifreleme seviyesi', type: 'select', options: [
        { label: 'Düşük', value: 'low' },
        { label: 'Orta', value: 'medium' },
        { label: 'Yüksek', value: 'high' }
      ]},
      { key: 'dataUsageLimit', title: 'Veri Kullanım Limiti', description: 'Veri kullanım limiti (MB)', type: 'number', min: 100, max: 2048, step: 100 },
      { key: 'cacheSize', title: 'Önbellek Boyutu', description: 'Önbellek boyutu (MB)', type: 'number', min: 50, max: 500, step: 50 },
      { key: 'logLevel', title: 'Log Seviyesi', description: 'Log kayıt seviyesi', type: 'select', options: [
        { label: 'Debug', value: 'debug' },
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warn' },
        { label: 'Error', value: 'error' }
      ]},
      { key: 'debugModeEnabled', title: 'Debug Modu', description: 'Geliştirici debug modu', type: 'boolean' },
      { key: 'analyticsEnabled', title: 'Analitik', description: 'Kullanım analitikleri', type: 'boolean' },
      { key: 'crashReportsEnabled', title: 'Çökme Raporları', description: 'Uygulama çökme raporları', type: 'boolean' },
    ]
  },
  {
    id: 'audio',
    title: 'Ses & Audio',
    description: 'Ses ve audio özellikleri',
    icon: 'volume-high-outline',
    color: '#EC4899',
    features: [
      { key: 'audioBeaconEnabled', title: 'Ses İşareti', description: 'Ses işareti sistemi', type: 'boolean' },
      { key: 'audioDetectionEnabled', title: 'Ses Algılama', description: 'Ses algılama sistemi', type: 'boolean' },
      { key: 'voiceCommandsEnabled', title: 'Ses Komutları', description: 'Sesli komut sistemi', type: 'boolean' },
      { key: 'voiceMessagingEnabled', title: 'Sesli Mesajlaşma', description: 'Sesli mesajlaşma sistemi', type: 'boolean' },
      { key: 'morseCodeEnabled', title: 'Mors Kodu', description: 'Mors kodu iletişimi', type: 'boolean' },
      { key: 'audioCompressionEnabled', title: 'Ses Sıkıştırma', description: 'Ses sıkıştırma sistemi', type: 'boolean' },
      { key: 'noiseCancellationEnabled', title: 'Gürültü Giderme', description: 'Gürültü giderme sistemi', type: 'boolean' },
      { key: 'audioQuality', title: 'Ses Kalitesi', description: 'Ses kalite seviyesi', type: 'select', options: [
        { label: 'Düşük', value: 'low' },
        { label: 'Orta', value: 'medium' },
        { label: 'Yüksek', value: 'high' }
      ]},
      { key: 'audioLatency', title: 'Ses Gecikmesi', description: 'Ses gecikme seviyesi', type: 'select', options: [
        { label: 'Düşük', value: 'low' },
        { label: 'Orta', value: 'medium' },
        { label: 'Yüksek', value: 'high' }
      ]},
    ]
  },
  {
    id: 'sensors',
    title: 'Sensörler',
    description: 'Sensör ve algılama özellikleri',
    icon: 'hardware-chip-outline',
    color: '#6B7280',
    features: [
      { key: 'accelerometerEnabled', title: 'Akselerometre', description: 'Akselerometre sensörü', type: 'boolean' },
      { key: 'gyroscopeEnabled', title: 'Jiroskop', description: 'Jiroskop sensörü', type: 'boolean' },
      { key: 'magnetometerEnabled', title: 'Manyetometre', description: 'Manyetometre sensörü', type: 'boolean' },
      { key: 'barometerEnabled', title: 'Barometre', description: 'Barometre sensörü', type: 'boolean' },
      { key: 'lightSensorEnabled', title: 'Işık Sensörü', description: 'Işık sensörü', type: 'boolean' },
      { key: 'proximitySensorEnabled', title: 'Yakınlık Sensörü', description: 'Yakınlık sensörü', type: 'boolean' },
      { key: 'temperatureSensorEnabled', title: 'Sıcaklık Sensörü', description: 'Sıcaklık sensörü', type: 'boolean' },
      { key: 'humiditySensorEnabled', title: 'Nem Sensörü', description: 'Nem sensörü', type: 'boolean' },
      { key: 'sensorFusionEnabled', title: 'Sensör Füzyonu', description: 'Sensör füzyon sistemi', type: 'boolean' },
      { key: 'sensorCalibrationEnabled', title: 'Sensör Kalibrasyonu', description: 'Sensör kalibrasyon sistemi', type: 'boolean' },
      { key: 'sensorDataLoggingEnabled', title: 'Sensör Veri Kaydı', description: 'Sensör veri kayıt sistemi', type: 'boolean' },
    ]
  },
  {
    id: 'ai',
    title: 'AI & Akıllı Sistemler',
    description: 'Yapay zeka ve akıllı sistemler',
    icon: 'bulb-outline',
    color: '#8B5CF6',
    features: [
      { key: 'aiDecisionSupportEnabled', title: 'AI Karar Desteği', description: 'AI karar destek sistemi', type: 'boolean' },
      { key: 'smartSituationAnalyzerEnabled', title: 'Akıllı Durum Analizi', description: 'Akıllı durum analiz sistemi', type: 'boolean' },
      { key: 'smartRecommendationEngineEnabled', title: 'Akıllı Öneri Motoru', description: 'Akıllı öneri sistemi', type: 'boolean' },
      { key: 'smartEmergencySystemEnabled', title: 'Akıllı Acil Sistem', description: 'Akıllı acil durum sistemi', type: 'boolean' },
      { key: 'aiHealthMonitoringEnabled', title: 'AI Sağlık Takibi', description: 'AI sağlık takip sistemi', type: 'boolean' },
      { key: 'aiRiskAssessmentEnabled', title: 'AI Risk Değerlendirmesi', description: 'AI risk değerlendirme sistemi', type: 'boolean' },
      { key: 'aiPredictiveAnalysisEnabled', title: 'AI Tahmin Analizi', description: 'AI tahmin analiz sistemi', type: 'boolean' },
      { key: 'aiLearningEnabled', title: 'AI Öğrenme', description: 'AI öğrenme sistemi', type: 'boolean' },
      { key: 'aiPersonalizationEnabled', title: 'AI Kişiselleştirme', description: 'AI kişiselleştirme sistemi', type: 'boolean' },
    ]
  },
  {
    id: 'drones',
    title: 'Drone & Uzaktan Kontrol',
    description: 'Drone koordinasyonu ve uzaktan kontrol',
    icon: 'airplane-outline',
    color: '#06B6D4',
    features: [
      { key: 'droneCoordinationEnabled', title: 'Drone Koordinasyonu', description: 'Drone koordinasyon sistemi', type: 'boolean' },
      { key: 'droneCommunicationEnabled', title: 'Drone İletişimi', description: 'Drone iletişim sistemi', type: 'boolean' },
      { key: 'droneMappingEnabled', title: 'Drone Haritalama', description: 'Drone haritalama sistemi', type: 'boolean' },
      { key: 'droneSearchEnabled', title: 'Drone Arama', description: 'Drone arama sistemi', type: 'boolean' },
      { key: 'droneDeliveryEnabled', title: 'Drone Teslimat', description: 'Drone teslimat sistemi', type: 'boolean' },
      { key: 'droneSurveillanceEnabled', title: 'Drone Gözetleme', description: 'Drone gözetleme sistemi', type: 'boolean' },
      { key: 'droneAutopilotEnabled', title: 'Drone Otopilot', description: 'Drone otopilot sistemi', type: 'boolean' },
      { key: 'droneEmergencyModeEnabled', title: 'Drone Acil Mod', description: 'Drone acil durum modu', type: 'boolean' },
    ]
  },
  {
    id: 'logistics',
    title: 'Lojistik & Tedarik',
    description: 'Lojistik ve tedarik yönetimi',
    icon: 'cube-outline',
    color: '#F59E0B',
    features: [
      { key: 'logisticsTrackingEnabled', title: 'Lojistik Takibi', description: 'Lojistik takip sistemi', type: 'boolean' },
      { key: 'inventoryManagementEnabled', title: 'Envanter Yönetimi', description: 'Envanter yönetim sistemi', type: 'boolean' },
      { key: 'supplyChainEnabled', title: 'Tedarik Zinciri', description: 'Tedarik zinciri sistemi', type: 'boolean' },
      { key: 'resourceAllocationEnabled', title: 'Kaynak Tahsisi', description: 'Kaynak tahsis sistemi', type: 'boolean' },
      { key: 'logisticsOptimizationEnabled', title: 'Lojistik Optimizasyonu', description: 'Lojistik optimizasyon sistemi', type: 'boolean' },
      { key: 'logisticsReportingEnabled', title: 'Lojistik Raporlama', description: 'Lojistik raporlama sistemi', type: 'boolean' },
      { key: 'logisticsAnalyticsEnabled', title: 'Lojistik Analitik', description: 'Lojistik analitik sistemi', type: 'boolean' },
    ]
  },
  {
    id: 'training',
    title: 'Eğitim & Simülasyon',
    description: 'Eğitim ve simülasyon özellikleri',
    icon: 'school-outline',
    color: '#10B981',
    features: [
      { key: 'trainingModeEnabled', title: 'Eğitim Modu', description: 'Eğitim modu sistemi', type: 'boolean' },
      { key: 'simulationEnabled', title: 'Simülasyon', description: 'Simülasyon sistemi', type: 'boolean' },
      { key: 'emergencySimulationEnabled', title: 'Acil Durum Simülasyonu', description: 'Acil durum simülasyon sistemi', type: 'boolean' },
      { key: 'trainingScenariosEnabled', title: 'Eğitim Senaryoları', description: 'Eğitim senaryo sistemi', type: 'boolean' },
      { key: 'skillAssessmentEnabled', title: 'Beceri Değerlendirmesi', description: 'Beceri değerlendirme sistemi', type: 'boolean' },
      { key: 'progressTrackingEnabled', title: 'İlerleme Takibi', description: 'İlerleme takip sistemi', type: 'boolean' },
      { key: 'certificationEnabled', title: 'Sertifikasyon', description: 'Sertifikasyon sistemi', type: 'boolean' },
    ]
  },
  {
    id: 'reporting',
    title: 'Raporlama & Analitik',
    description: 'Raporlama ve analitik özellikleri',
    icon: 'analytics-outline',
    color: '#8B5CF6',
    features: [
      { key: 'incidentReportingEnabled', title: 'Olay Raporlama', description: 'Olay raporlama sistemi', type: 'boolean' },
      { key: 'emergencyReportingEnabled', title: 'Acil Durum Raporlama', description: 'Acil durum raporlama sistemi', type: 'boolean' },
      { key: 'healthReportingEnabled', title: 'Sağlık Raporlama', description: 'Sağlık raporlama sistemi', type: 'boolean' },
      { key: 'systemReportingEnabled', title: 'Sistem Raporlama', description: 'Sistem raporlama sistemi', type: 'boolean' },
      { key: 'analyticsEnabled', title: 'Analitik', description: 'Analitik sistemi', type: 'boolean' },
      { key: 'dashboardEnabled', title: 'Dashboard', description: 'Dashboard sistemi', type: 'boolean' },
      { key: 'riskDashboardEnabled', title: 'Risk Dashboard', description: 'Risk dashboard sistemi', type: 'boolean' },
      { key: 'performanceMonitoringEnabled', title: 'Performans İzleme', description: 'Performans izleme sistemi', type: 'boolean' },
    ]
  },
  {
    id: 'accessibility',
    title: 'Erişilebilirlik',
    description: 'Erişilebilirlik özellikleri',
    icon: 'accessibility-outline',
    color: '#06B6D4',
    features: [
      { key: 'highContrastEnabled', title: 'Yüksek Kontrast', description: 'Yüksek kontrast modu', type: 'boolean' },
      { key: 'largeTextEnabled', title: 'Büyük Metin', description: 'Büyük metin modu', type: 'boolean' },
      { key: 'strongVibrationEnabled', title: 'Güçlü Titreşim', description: 'Güçlü titreşim modu', type: 'boolean' },
      { key: 'voiceOverEnabled', title: 'VoiceOver', description: 'VoiceOver desteği', type: 'boolean' },
      { key: 'screenReaderEnabled', title: 'Ekran Okuyucu', description: 'Ekran okuyucu desteği', type: 'boolean' },
      { key: 'hapticNavigationEnabled', title: 'Haptic Navigasyon', description: 'Haptic navigasyon sistemi', type: 'boolean' },
      { key: 'audioDescriptionEnabled', title: 'Ses Açıklaması', description: 'Ses açıklama sistemi', type: 'boolean' },
      { key: 'gestureNavigationEnabled', title: 'Jest Navigasyonu', description: 'Jest navigasyon sistemi', type: 'boolean' },
    ]
  },
];

export default function ComprehensiveFeaturesScreen() {
  const [activeCategory, setActiveCategory] = useState<string>('emergency');
  const [searchQuery, setSearchQuery] = useState('');
  
  const {
    updateFeatureSetting,
    updateCategorySettings,
    resetCategoryToDefaults,
    resetAllToDefaults,
    initializeSettings,
    getFeatureStatus,
    getFeatureValue,
  } = useComprehensiveFeatures();

  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  const handleFeatureChange = async (category: string, key: string, value: any) => {
    try {
      await updateFeatureSetting(category as any, key as any, value);
      Alert.alert('✅ Güncellendi', `${key} özelliği ${value ? 'aktif' : 'pasif'} edildi.`);
    } catch (error) {
      Alert.alert('❌ Hata', 'Özellik güncellenemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleResetCategory = async (category: string) => {
    Alert.alert(
      'Sıfırla',
      `${FEATURE_CATEGORIES.find(c => c.id === category)?.title} kategorisini varsayılan ayarlara sıfırlamak istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sıfırla', 
          style: 'destructive',
          onPress: async () => {
            await resetCategoryToDefaults(category as any);
            Alert.alert('✅ Sıfırlandı', 'Kategori varsayılan ayarlara sıfırlandı.');
          }
        }
      ]
    );
  };

  const handleResetAll = async () => {
    Alert.alert(
      'Tümünü Sıfırla',
      'Tüm özellikleri varsayılan ayarlara sıfırlamak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sıfırla', 
          style: 'destructive',
          onPress: async () => {
            await resetAllToDefaults();
            Alert.alert('✅ Sıfırlandı', 'Tüm özellikler varsayılan ayarlara sıfırlandı.');
          }
        }
      ]
    );
  };

  const filteredCategories = FEATURE_CATEGORIES.filter(category =>
    category.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFeatureItem = (category: string, feature: FeatureItem) => {
    const currentValue = getFeatureValue(category as any, feature.key);
    const isEnabled = getFeatureStatus(category as any, feature.key);

    return (
      <View key={feature.key} style={styles.featureItem}>
        <View style={styles.featureInfo}>
          <Text style={styles.featureTitle}>{feature.title}</Text>
          <Text style={styles.featureDescription}>{feature.description}</Text>
        </View>
        
        <View style={styles.featureControl}>
          {feature.type === 'boolean' && (
            <Switch
              value={isEnabled}
              onValueChange={(value) => handleFeatureChange(category, feature.key, value)}
              trackColor={{ false: '#374151', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          )}
          
          {feature.type === 'number' && (
            <View style={styles.numberControl}>
              <Pressable
                style={styles.numberButton}
                onPress={() => handleFeatureChange(category, feature.key, Math.max(feature.min || 0, currentValue - (feature.step || 1)))}
              >
                <Text style={styles.numberButtonText}>-</Text>
              </Pressable>
              <Text style={styles.numberValue}>{currentValue}</Text>
              <Pressable
                style={styles.numberButton}
                onPress={() => handleFeatureChange(category, feature.key, Math.min(feature.max || 100, currentValue + (feature.step || 1)))}
              >
                <Text style={styles.numberButtonText}>+</Text>
              </Pressable>
            </View>
          )}
          
          {feature.type === 'select' && (
            <Pressable
              style={styles.selectControl}
              onPress={() => {
                Alert.alert(
                  feature.title,
                  'Seçenek seçin:',
                  feature.options?.map(option => ({
                    text: option.label,
                    onPress: () => handleFeatureChange(category, feature.key, option.value)
                  })) || []
                );
              }}
            >
              <Text style={styles.selectValue}>
                {feature.options?.find(opt => opt.value === currentValue)?.label || 'Seçin'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#6B7280" />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const renderCategoryContent = () => {
    const category = FEATURE_CATEGORIES.find(c => c.id === activeCategory);
    if (!category) return null;

    return (
      <ScrollView style={styles.categoryContent} showsVerticalScrollIndicator={false}>
        <View style={styles.categoryHeader}>
          <View style={styles.categoryIconContainer}>
            <Ionicons name={category.icon} size={24} color={category.color} />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <Text style={styles.categoryDescription}>{category.description}</Text>
          </View>
          <Pressable
            style={styles.resetButton}
            onPress={() => handleResetCategory(activeCategory)}
          >
            <Ionicons name="refresh-outline" size={20} color="#EF4444" />
          </Pressable>
        </View>

        <View style={styles.featuresList}>
          {category.features.map(feature => renderFeatureItem(activeCategory, feature))}
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kapsamlı Özellik Ayarları</Text>
        <Text style={styles.headerSubtitle}>Tüm özellikleri premium şekilde yönetin</Text>
        
        <Pressable style={styles.resetAllButton} onPress={handleResetAll}>
          <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
          <Text style={styles.resetAllButtonText}>Tümünü Sıfırla</Text>
        </Pressable>
      </View>

      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {filteredCategories.map(category => (
            <Pressable
              key={category.id}
              style={[
                styles.categoryTab,
                activeCategory === category.id && styles.activeCategoryTab,
                { borderLeftColor: category.color }
              ]}
              onPress={() => setActiveCategory(category.id)}
            >
              <Ionicons 
                name={category.icon} 
                size={20} 
                color={activeCategory === category.id ? category.color : '#6B7280'} 
              />
              <Text style={[
                styles.categoryTabText,
                activeCategory === category.id && { color: category.color }
              ]}>
                {category.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {renderCategoryContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 12,
  },
  resetAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  resetAllButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
  },
  categoriesContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  categoriesScroll: {
    paddingHorizontal: 16,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6B7280',
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  activeCategoryTab: {
    backgroundColor: '#2D3A4B',
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },
  categoryContent: {
    flex: 1,
    padding: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
  featureControl: {
    marginLeft: 12,
  },
  numberControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 4,
  },
  numberButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  numberValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
    minWidth: 40,
    textAlign: 'center',
  },
  selectControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  selectValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
});
