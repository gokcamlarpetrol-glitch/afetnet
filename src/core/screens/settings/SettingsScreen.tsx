/**
 * SETTINGS SCREEN - Comprehensive Settings
 * All app features and services settings
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Switch,
  StatusBar,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { usePremiumStore } from '../../stores/premiumStore';
import { useTrialStore } from '../../stores/trialStore';
import { useMeshStore } from '../../stores/meshStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { premiumService } from '../../services/PremiumService';
import { i18nService } from '../../services/I18nService';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { SettingItem as SettingItemRow } from '../../components/settings/SettingItem';
import * as haptics from '../../utils/haptics';
import { batterySaverService } from '../../services/BatterySaverService';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SettingsScreen');
import { aiFeatureToggle } from '../../ai/services/AIFeatureToggle';
import { ENV } from '../../config/env';

interface SettingOption {
  icon: string;
  title: string;
  subtitle?: string;
  value?: string | boolean;
  onPress?: () => void;
  rightComponent?: React.ReactNode;
  type?: 'switch' | 'arrow' | 'text';
}

import type { ReactElement } from 'react';

export default function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [isPremium, setIsPremium] = useState(false);
  const [meshStats, setMeshStats] = useState({ messagesSent: 0, messagesReceived: 0, peersDiscovered: 0 });
  
  // Use settings store for persistent settings
  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled);
  const locationEnabled = useSettingsStore((state) => state.locationEnabled);
  const bleMeshEnabled = useSettingsStore((state) => state.bleMeshEnabled);
  const eewEnabled = useSettingsStore((state) => state.eewEnabled);
  const seismicSensorEnabled = useSettingsStore((state) => state.seismicSensorEnabled);
  const alarmSoundEnabled = useSettingsStore((state) => state.alarmSoundEnabled);
  const vibrationEnabled = useSettingsStore((state) => state.vibrationEnabled);
  const batterySaverEnabled = useSettingsStore((state) => state.batterySaverEnabled);
  const currentLanguage = useSettingsStore((state) => state.language);
  
  // AI Features State
  const [aiFeaturesEnabled, setAiFeaturesEnabled] = useState(true);
  const newsEnabled = useSettingsStore((state) => state.newsEnabled);
  
  const setNotificationsEnabled = useSettingsStore((state) => state.setNotifications);
  const setLocationEnabled = useSettingsStore((state) => state.setLocation);
  const setBleMeshEnabled = useSettingsStore((state) => state.setBleMesh);
  const setEewEnabled = useSettingsStore((state) => state.setEew);
  const setSeismicSensorEnabled = useSettingsStore((state) => state.setSeismicSensor);
  const setAlarmSoundEnabled = useSettingsStore((state) => state.setAlarmSound);
  const setVibrationEnabled = useSettingsStore((state) => state.setVibration);
  const setBatterySaverEnabled = useSettingsStore((state) => state.setBatterySaver);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const setNewsEnabled = useSettingsStore((state) => state.setNews);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsPremium(usePremiumStore.getState().isPremium);
      setMeshStats(useMeshStore.getState().stats);
    }, 500);

    // AI features durumunu yükle
    const loadAIFeatures = async () => {
      try {
        await aiFeatureToggle.initialize();
        setAiFeaturesEnabled(aiFeatureToggle.isFeatureEnabled());
      } catch (error) {
        logger.error('Failed to load AI features state:', error);
      }
    };
    loadAIFeatures();

    return () => clearInterval(interval);
  }, []);

  const handleRestorePurchases = async () => {
    haptics.impactMedium();
    Alert.alert('Satın Alımları Geri Yükle', 'Önceki satın alımlarınız kontrol ediliyor...');
    const restored = await premiumService.restorePurchases();
    if (restored) {
      Alert.alert('Başarılı', 'Premium üyeliğiniz geri yüklendi!');
    } else {
      Alert.alert('Bilgi', 'Geri yüklenecek satın alım bulunamadı.');
    }
  };

  const handleLanguageChange = () => {
    haptics.impactMedium();
    
    // ELITE: Professional language selection with all supported languages
    // CRITICAL: Explicitly use only the 10 supported languages (NO Kurdish)
    // ELITE: Hardcode the list to ensure Kurdish never appears
    const supportedLanguages: string[] = ['en', 'tr', 'ar', 'de', 'fr', 'es', 'ru', 'zh', 'ja', 'ko'];
    
    const languageOptions = supportedLanguages
      .map((lang) => {
        const displayName = i18nService.getLocaleDisplayName(lang);
        // ELITE: Skip if display name is empty (should not happen with explicit list)
        if (!displayName) return null;
        
        return {
          text: displayName,
          onPress: () => {
            i18nService.setLocale(lang as any);
            setLanguage(lang as any);
            haptics.notificationSuccess();
            // Force app reload to apply language changes
            setTimeout(() => {
              Alert.alert(
                i18nService.t('common.success'),
                i18nService.t('settings.language') + ' ' + i18nService.t('common.success'),
                [{ text: i18nService.t('common.ok') }]
              );
            }, 100);
          },
        };
      })
      .filter((option) => option !== null) as Array<{ text: string; onPress: () => void }>; // Remove null entries

    Alert.alert(
      i18nService.t('settings.language'),
      i18nService.t('settings.autoDetect') || 'Select your preferred language',
      [
        ...languageOptions,
        { text: i18nService.t('common.cancel'), style: 'cancel' },
      ]
    );
  };
  
  const renderSection = (title: string, items: SettingOption[], sectionIndex: number) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {items.map((item, itemIndex) => (
          <SettingItemRow
            key={item.title}
            index={sectionIndex * 10 + itemIndex} // Unique index for animation delay
            icon={item.icon as any}
            title={item.title}
            subtitle={item.subtitle}
            type={item.type}
            value={item.value}
            onPress={item.onPress}
          />
        ))}
      </View>
    </View>
  );

  const premiumSettings: SettingOption[] = [
    {
      icon: 'star',
      title: 'Premium Üyelik',
      subtitle: isPremium ? 'Aktif' : 'Ücretsiz Plan',
      type: 'arrow',
      onPress: () => navigation.navigate('Paywall'),
    },
    {
      icon: 'refresh',
      title: 'Satın Alımları Geri Yükle',
      subtitle: 'Önceki satın alımlarınızı geri yükleyin',
      type: 'arrow',
      onPress: handleRestorePurchases,
    },
    {
      icon: 'settings',
      title: 'Abonelik Yönetimi',
      subtitle: 'Aboneliklerinizi yönetin',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        navigation.navigate('SubscriptionManagement');
      },
    },
  ];

  const notificationSettings: SettingOption[] = [
    {
      icon: 'notifications',
      title: 'Bildirimler',
      subtitle: 'Deprem uyarıları ve bildirimler',
      type: 'switch',
      value: notificationsEnabled,
      onPress: () => setNotificationsEnabled(!notificationsEnabled),
    },
    {
      icon: 'volume-high',
      title: 'Alarm Sesi',
      subtitle: 'Sesli uyarılar',
      type: 'switch',
      value: alarmSoundEnabled,
      onPress: () => setAlarmSoundEnabled(!alarmSoundEnabled),
    },
    {
      icon: 'phone-portrait',
      title: 'Titreşim',
      subtitle: 'Vibrasyon uyarıları',
      type: 'switch',
      value: vibrationEnabled,
      onPress: () => setVibrationEnabled(!vibrationEnabled),
    },
    {
      icon: 'flash',
      title: 'LED Uyarısı',
      subtitle: 'Fener ve düdük araçları',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('FlashlightWhistle');
      },
    },
  ];

  const locationSettings: SettingOption[] = [
    {
      icon: 'location',
      title: 'Konum Servisi',
      subtitle: 'Konum izleme ve paylaşımı',
      type: 'switch',
      value: locationEnabled,
      onPress: () => setLocationEnabled(!locationEnabled),
    },
    {
      icon: 'map',
      title: 'Harita Ayarları',
      subtitle: 'Harita görünümü ve filtreler',
      type: 'arrow',
      onPress: () => navigation.navigate('Map'),
    },
  ];

  const aiSettings: SettingOption[] = [
    {
      icon: 'sparkles',
      title: 'AI Asistan',
      subtitle: 'Risk skoru, hazırlık planı ve afet anı rehberi',
      type: 'switch',
      value: aiFeaturesEnabled,
      onPress: async () => {
        haptics.impactLight();
        const newValue = !aiFeaturesEnabled;
        setAiFeaturesEnabled(newValue);
        if (newValue) {
          await aiFeatureToggle.enable();
        } else {
          await aiFeatureToggle.disable();
        }
        Alert.alert(
          'AI Asistan',
          newValue 
            ? 'AI Asistan özellikleri aktif edildi. Ana ekranda AI kartları görünecek.'
            : 'AI Asistan özellikleri kapatıldı.',
          [{ text: 'Tamam' }]
        );
      },
    },
    {
      icon: 'newspaper',
      title: 'Son Dakika Haberler',
      subtitle: 'Deprem ve afet haberleri',
      type: 'switch',
      value: newsEnabled,
      onPress: () => {
        haptics.impactLight();
        const newValue = !newsEnabled;
        setNewsEnabled(newValue);
        Alert.alert(
          'Haber Sistemi',
          newValue 
            ? 'Haber sistemi aktif edildi. Ana ekranda haber kartları görünecek.'
            : 'Haber sistemi kapatıldı.',
          [{ text: 'Tamam' }]
        );
      },
    },
    {
      icon: 'analytics',
      title: 'Risk Skorum',
      subtitle: 'Kişisel risk analizi',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        if (!aiFeaturesEnabled) {
          Alert.alert(
            'AI Asistan Gerekli',
            'Risk skoru özelliğini kullanmak için AI Asistan aktif olmalı.',
            [{ text: 'Tamam' }]
          );
          return;
        }
        navigation.navigate('RiskScore');
      },
    },
    {
      icon: 'list',
      title: 'Hazırlık Planı',
      subtitle: 'Kişiselleştirilmiş hazırlık planı',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        if (!aiFeaturesEnabled) {
          Alert.alert(
            'AI Asistan Gerekli',
            'Hazırlık planı özelliğini kullanmak için AI Asistan aktif olmalı.',
            [{ text: 'Tamam' }]
          );
          return;
        }
        navigation.navigate('PreparednessPlan');
      },
    },
    {
      icon: 'shield-checkmark',
      title: 'Afet Anı Rehberi',
      subtitle: 'Acil durum aksiyonları',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        if (!aiFeaturesEnabled) {
          Alert.alert(
            'AI Asistan Gerekli',
            'Afet anı rehberi özelliğini kullanmak için AI Asistan aktif olmalı.',
            [{ text: 'Tamam' }]
          );
          return;
        }
        navigation.navigate('PanicAssistant');
      },
    },
  ];

  const meshSettings: SettingOption[] = [
    {
      icon: 'bluetooth',
      title: 'BLE Mesh Ağı',
      subtitle: 'Bluetooth mesh iletişimi',
      type: 'switch',
      value: bleMeshEnabled,
      onPress: async () => {
        haptics.impactLight();
        const newValue = !bleMeshEnabled;
        setBleMeshEnabled(newValue);
        
        // Start/stop BLE Mesh service based on setting
        const { bleMeshService } = await import('../../services/BLEMeshService');
        if (newValue) {
          await bleMeshService.start();
          Alert.alert('BLE Mesh', 'Bluetooth mesh ağı başlatıldı.');
        } else {
          bleMeshService.stop();
          Alert.alert('BLE Mesh', 'Bluetooth mesh ağı durduruldu.');
        }
      },
    },
    {
      icon: 'chatbubbles',
      title: 'Offline Mesajlaşma',
      subtitle: 'Mesh ağı üzerinden mesajlaşma',
      type: 'arrow',
      onPress: () => navigation.navigate('Messages'),
    },
    {
      icon: 'people',
      title: 'Aile Takibi',
      subtitle: 'Aile üyeleri ile iletişim',
      type: 'arrow',
      onPress: () => navigation.navigate('Family'),
    },
    {
      icon: 'battery-charging',
      title: 'Pil Tasarrufu',
      subtitle: 'Enkaz modunda otomatik aktif (ekran parlaklığı %10)',
      type: 'switch',
      value: batterySaverEnabled,
      onPress: async () => {
        const newValue = !batterySaverEnabled;
        setBatterySaverEnabled(newValue);
        if (newValue) {
          await batterySaverService.enable();
        } else {
          await batterySaverService.disable();
        }
      },
    },
  ];

  const earthquakeSettings: SettingOption[] = [
    {
      icon: 'pulse',
      title: 'Deprem İzleme',
      subtitle: 'AFAD ve Kandilli verileri',
      type: 'switch',
      value: true,
      onPress: () => {
        haptics.impactLight();
        Alert.alert(
          'Deprem İzleme',
          'Deprem izleme sistemi her zaman aktif durumda. AFAD ve Kandilli verileri otomatik olarak çekiliyor.',
          [{ text: 'Tamam' }]
        );
      },
    },
        {
          icon: 'warning',
          title: 'AI Destekli Erken Uyarı',
          subtitle: isPremium || useTrialStore.getState().checkTrialStatus() 
            ? '6 kaynak doğrulama + AI onayı ile deprem olmadan önce uyarı' 
            : 'Premium gerekiyor',
          type: 'switch',
          value: eewEnabled,
          onPress: async () => {
            haptics.impactLight();
            if (!isPremium && !useTrialStore.getState().checkTrialStatus()) {
              Alert.alert(
                'Premium Gerekli',
                'AI destekli erken uyarı sistemi premium özelliğidir. 6 farklı kaynaktan gelen veriler yapay zeka ile analiz edilir ve deprem olmadan önce size bildirim gönderilir. İlk 3 gün ücretsiz deneyebilirsiniz.',
                [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Premium\'a Geç', onPress: () => navigation.navigate('Paywall') },
                ]
              );
              return;
            }
            const newValue = !eewEnabled;
            setEewEnabled(newValue);
            
            // Start/stop EEW service based on setting
            const { eewService } = await import('../../services/EEWService');
            if (newValue) {
              await eewService.start();
              Alert.alert(
                'AI Destekli Erken Uyarı Aktif', 
                'Erken uyarı sistemi aktif edildi. Deprem olmadan önce AI destekli analiz ile bildirim alacaksınız. Sistem 6 farklı kaynaktan gelen verileri yapay zeka ile onaylayarak size en doğru bilgiyi sunar.'
              );
            } else {
              eewService.stop();
              Alert.alert('Erken Uyarı', 'Erken uyarı sistemi kapatıldı.');
            }
          },
        },
    {
      icon: 'phone-portrait',
      title: 'Sensör Tabanlı Algılama',
      subtitle: isPremium || useTrialStore.getState().checkTrialStatus() ? 'Telefon sensörleri ile deprem algılama' : 'Premium gerekiyor',
      type: 'switch',
      value: seismicSensorEnabled,
      onPress: () => {
        haptics.impactLight();
        if (!isPremium && !useTrialStore.getState().checkTrialStatus()) {
          Alert.alert(
            'Premium Gerekli',
            'Sensör algılama premium özelliğidir. İlk 3 gün ücretsiz deneyebilirsiniz.',
            [
              { text: 'İptal', style: 'cancel' },
              { text: 'Premium\'a Geç', onPress: () => navigation.navigate('Paywall') },
            ]
          );
          return;
        }
        setSeismicSensorEnabled(!seismicSensorEnabled);
      },
    },
    {
      icon: 'settings',
      title: 'Deprem Ayarları',
      subtitle: 'Kapsamlı deprem bildirim ayarları',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('EarthquakeSettings');
      },
    },
    {
      icon: 'filter',
      title: 'Deprem Listesi',
      subtitle: 'Tüm depremleri görüntüle',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('AllEarthquakes');
      },
    },
  ];

  const medicalSettings: SettingOption[] = [
    {
      icon: 'heart',
      title: 'Sağlık Profili',
      subtitle: 'Tıbbi bilgilerinizi güvenle saklayın',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('HealthProfile');
      },
    },
    {
      icon: 'document',
      title: 'ICE Bilgileri',
      subtitle: 'Acil durum kişileri ve tıbbi bilgiler',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('HealthProfile');
      },
    },
    {
      icon: 'medical',
      title: 'Triage Sistemi',
      subtitle: 'Hızlı yaralı sınıflandırma ve önceliklendirme',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('MedicalInformation');
      },
    },
  ];

  const rescueSettings: SettingOption[] = [
    {
      icon: 'home',
      title: 'Enkaz Modu',
      subtitle: 'Enkaz altı otomatik SOS ve konum paylaşımı',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('DrillMode');
      },
    },
    {
      icon: 'search',
      title: 'SAR Modu',
      subtitle: 'Arama kurtarma operasyonları için özel araçlar',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('RescueTeam');
      },
    },
    {
      icon: 'warning',
      title: 'Tehlike Bölgeleri',
      subtitle: 'Risk alanlarını işaretle ve paylaş',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('DisasterMap');
      },
    },
    {
      icon: 'cube',
      title: 'Lojistik Yönetimi',
      subtitle: 'Malzeme talep ve teklif sistemi',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('VolunteerModule');
      },
    },
  ];

  const generalSettings = useMemo<SettingOption[]>(() => {
    const items: SettingOption[] = [
      {
        icon: 'language',
        title: 'Dil',
        subtitle: i18nService.getLocaleDisplayName(currentLanguage),
        type: 'arrow',
        onPress: handleLanguageChange,
      },
      // Karanlık Mod kaldırıldı - uygulama zaten karanlık modda çalışıyor
      {
        icon: 'map',
        title: 'Çevrimdışı Haritalar',
        subtitle: 'Harita bölgelerini indir ve yönet',
        type: 'arrow',
        onPress: () => {
          haptics.impactLight();
          const parentNavigator = navigation.getParent?.() || navigation;
          parentNavigator.navigate('OfflineMapSettings');
        },
      },
      {
        icon: 'settings',
        title: 'Gelişmiş Ayarlar',
        subtitle: 'Geliştirici seçenekleri ve depolama',
        type: 'arrow',
        onPress: () => {
          haptics.impactLight();
          const parentNavigator = navigation.getParent?.() || navigation;
          parentNavigator.navigate('AdvancedSettings');
        },
      },
      {
        icon: 'refresh',
        title: 'Ayarları Sıfırla',
        subtitle: 'Tüm ayarları varsayılan değerlere döndür',
        type: 'arrow',
        onPress: () => {
          haptics.impactMedium();
          Alert.alert(
            'Ayarları Sıfırla',
            'Tüm ayarlar varsayılan değerlere döndürülecek. Devam etmek istiyor musunuz?',
            [
              { text: 'İptal', style: 'cancel' },
              {
                text: 'Sıfırla',
                style: 'destructive',
                onPress: () => {
                  useSettingsStore.getState().resetToDefaults();
                  Alert.alert('Başarılı', 'Ayarlar varsayılan değerlere döndürüldü.');
                },
              },
            ]
          );
        },
      },
    ];

    if (__DEV__) {
      items.push(
        {
          icon: 'text',
          title: 'Yazı Boyutu',
          subtitle: 'Erişilebilirlik ayarları (dev)',
          type: 'arrow',
          onPress: () => {
            Alert.alert(
              'Yazı Boyutu',
              'Bu özellik geliştirme modunda test ediliyor.',
              [{ text: 'Tamam' }]
            );
          },
        },
        {
          icon: 'contrast',
          title: 'Yüksek Kontrast',
          subtitle: 'Görünürlüğü artır (dev)',
          type: 'switch',
          value: false,
          onPress: () => {
            Alert.alert(
              'Yüksek Kontrast',
              'Bu özellik geliştirme modunda test ediliyor.',
              [{ text: 'Tamam' }]
            );
          },
        }
      );
    }

    return items;
  }, [currentLanguage, navigation]);

  const aboutSettings: SettingOption[] = [
    {
      icon: 'information-circle',
      title: 'Hakkında',
      subtitle: 'AfetNet v1.0.0',
      type: 'arrow',
      onPress: () => {
        Alert.alert(
          'AfetNet',
          'AfetNet v1.0.0\n\nAfet durumlarında offline iletişim için tasarlanmış acil durum uygulaması.',
          [{ text: 'Tamam' }]
        );
      },
    },
    {
      icon: 'document-text',
      title: 'Gizlilik Politikası',
      subtitle: 'Politikayı görüntüle',
      type: 'arrow',
      onPress: async () => {
        haptics.impactLight();
        try {
          const url = ENV.PRIVACY_POLICY_URL;
          if (!url) {
            throw new Error('URL tanımlı değil');
          }
          const canOpen = await Linking.canOpenURL(url);
          if (!canOpen) {
            throw new Error('URL açılamıyor');
          }
          await Linking.openURL(url);
        } catch (error) {
          logger.error('Gizlilik politikası açma hatası:', error);
          Alert.alert(
            'Gizlilik Politikası',
            'Gizlilik politikası şu anda açılamıyor. Lütfen https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html adresini ziyaret edin.',
            [{ text: 'Tamam' }]
          );
        }
      },
    },
    {
      icon: 'document',
      title: 'Kullanım Koşulları',
      subtitle: 'Koşulları görüntüle',
      type: 'arrow',
      onPress: async () => {
        haptics.impactLight();
        try {
          const url = ENV.TERMS_OF_SERVICE_URL;
          if (!url) {
            throw new Error('URL tanımlı değil');
          }
          const canOpen = await Linking.canOpenURL(url);
          if (!canOpen) {
            throw new Error('URL açılamıyor');
          }
          await Linking.openURL(url);
        } catch (error) {
          logger.error('Kullanım koşulları açma hatası:', error);
          Alert.alert(
            'Kullanım Koşulları',
            'Kullanım koşulları şu anda açılamıyor. Lütfen https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html adresini ziyaret edin.',
            [{ text: 'Tamam' }]
          );
        }
      },
    },
    {
      icon: 'shield-checkmark',
      title: 'Güvenlik',
      subtitle: 'Güvenlik ve şifreleme',
      type: 'arrow',
      onPress: () => {
        Alert.alert(
          'Güvenlik',
          'Tüm verileriniz şifrelenmiş olarak saklanmaktadır. E2E encryption aktif.',
          [{ text: 'Tamam' }]
        );
      },
    },
    {
      icon: 'help-circle',
      title: 'Yardım ve Destek',
      subtitle: 'SSS ve destek',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('PsychologicalSupport');
      },
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: colors.background.primary }]}>
        <Text style={styles.headerTitle}>Ayarlar</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderSection('Premium Durum', premiumSettings, 0)}
        
        {/* BLE Mesh Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BLE Mesh İstatistikleri</Text>
          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <Ionicons name="send" size={20} color={colors.text.tertiary} />
              <Text style={styles.statLabel}>Gönderilen Mesajlar</Text>
              <Text style={styles.statValue}>{meshStats.messagesSent}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statRow}>
              <Ionicons name="download" size={20} color={colors.text.tertiary} />
              <Text style={styles.statLabel}>Alınan Mesajlar</Text>
              <Text style={styles.statValue}>{meshStats.messagesReceived}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statRow}>
              <Ionicons name="radio" size={20} color={colors.text.tertiary} />
              <Text style={styles.statLabel}>Keşfedilen Cihazlar</Text>
              <Text style={styles.statValue}>{meshStats.peersDiscovered}</Text>
            </View>
          </View>
        </View>

        {renderSection('AI Özellikleri', aiSettings, 1)}
        {renderSection('Bildirimler ve Uyarılar', notificationSettings, 2)}
        {renderSection('Konum ve Harita', locationSettings, 3)}
        {renderSection('Mesh Ağı ve İletişim', meshSettings, 4)}
        {renderSection('Deprem İzleme', earthquakeSettings, 5)}
        {renderSection('Sağlık ve Tıbbi', medicalSettings, 6)}
        {renderSection('Kurtarma ve Operasyon', rescueSettings, 7)}
        {renderSection('Genel', generalSettings, 8)}
        {renderSection('Hakkında', aboutSettings, 9)}
        
        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>AfetNet v1.0.0</Text>
          <Text style={styles.versionSubtext}>
            Afet durumlarında offline iletişim için tasarlanmış acil durum uygulaması
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: colors.background.primary,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingIconGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.brand.primary + '30',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand.primary,
    marginRight: 8,
  },
  statsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  statDivider: {
    height: 1,
    backgroundColor: '#334155',
  },
  statLabel: {
    flex: 1,
    fontSize: 15,
    color: '#94a3b8',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 16,
  },
  versionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  versionSubtext: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
});
