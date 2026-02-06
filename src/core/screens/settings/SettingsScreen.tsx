/**
 * SETTINGS SCREEN - Comprehensive Settings
 * All app features and services settings
 */

import { getErrorMessage } from '../../utils/errorUtils';
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
  Platform,
  BackHandler,
  Modal,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useSettingsStore } from '../../stores/settingsStore';

import { i18nService } from '../../services/I18nService';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { SettingItem as SettingItemRow } from '../../components/settings/SettingItem';
import * as haptics from '../../utils/haptics';
import { batterySaverService } from '../../services/BatterySaverService';
import { createLogger } from '../../utils/logger';
import { accountDeletionService } from '../../services/AccountDeletionService';
import { EmailAuthService } from '../../services/EmailAuthService';
import { getDeviceId } from '../../utils/device';
import { ActivityIndicator } from 'react-native';

const logger = createLogger('SettingsScreen');
// AI Feature Toggle import kaldırıldı - AI Asistan her zaman aktif
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
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';

// ELITE: Properly typed navigation prop for Settings screen
type SettingsScreenNavigationProp = StackNavigationProp<ParamListBase>;

interface SettingsScreenProps {
  navigation: SettingsScreenNavigationProp;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState<{ step: string; progress: number; total: number } | null>(null);

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

  // AI Features State - Her zaman aktif
  const [aiFeaturesEnabled] = useState(true);
  const [deviceId, setDeviceId] = useState<string>('...');
  const newsEnabled = useSettingsStore((state) => state.newsEnabled);

  // ELITE: New Features (previously 'Yakında' - now ACTIVE!)
  const pdrEnabled = useSettingsStore((state) => state.pdrEnabled);
  const proximityAlertsEnabled = useSettingsStore((state) => state.proximityAlertsEnabled);
  const aiHazardEnabled = useSettingsStore((state) => state.aiHazardEnabled);

  // Health Sharing State
  const [healthSharingEnabled, setHealthSharingEnabled] = useState(false);

  // Load health sharing preference on mount
  useEffect(() => {
    const loadHealthSharingPref = async () => {
      const { emergencyHealthSharingService } = await import('../../services/EmergencyHealthSharingService');
      await emergencyHealthSharingService.initialize();
      setHealthSharingEnabled(emergencyHealthSharingService.isHealthSharingEnabled());
    };
    loadHealthSharingPref();
  }, []);

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

  // ELITE: New Features Setters
  const setPdrEnabled = useSettingsStore((state) => state.setPdr);
  const setProximityAlertsEnabled = useSettingsStore((state) => state.setProximityAlerts);
  const setAiHazardEnabled = useSettingsStore((state) => state.setAiHazard);


  useEffect(() => {
    // AI Asistan her zaman aktif - feature toggle kontrolü kaldırıldı

    // CRITICAL FIX: Load device ID asynchronously
    getDeviceId().then(id => {
      setDeviceId(id ? id.substring(0, 8) : 'N/A');
    }).catch(() => {
      setDeviceId('N/A');
    });
  }, []);

  const handleLanguageChange = () => {
    haptics.impactMedium();
    Alert.alert(
      i18nService.t('settings.languageSelect'),
      i18nService.t('settings.languageDescription'),
      [
        { text: i18nService.getLocaleDisplayName('tr'), onPress: () => { i18nService.setLocale('tr'); setLanguage('tr'); } },
        { text: i18nService.getLocaleDisplayName('en'), onPress: () => { i18nService.setLocale('en'); setLanguage('en'); } },
        { text: i18nService.getLocaleDisplayName('ar'), onPress: () => { i18nService.setLocale('ar'); setLanguage('ar'); } },
        { text: i18nService.getLocaleDisplayName('ru'), onPress: () => { i18nService.setLocale('ru'); setLanguage('ru'); } },
        { text: i18nService.t('common.cancel'), style: 'cancel' },
      ],
    );
  };

  // ELITE: Şifre Değiştirme
  const handleChangePassword = () => {
    haptics.impactMedium();

    Alert.prompt(
      'Şifre Değiştir',
      'Mevcut şifrenizi girin:',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Devam',
          onPress: (currentPassword) => {
            if (!currentPassword || currentPassword.length < 8) {
              Alert.alert('Hata', 'Geçerli bir şifre girin.');
              return;
            }

            Alert.prompt(
              'Yeni Şifre',
              'Yeni şifrenizi girin (en az 8 karakter):',
              [
                { text: 'İptal', style: 'cancel' },
                {
                  text: 'Değiştir',
                  onPress: async (newPassword) => {
                    if (!newPassword || newPassword.length < 8) {
                      Alert.alert('Hata', 'Şifre en az 8 karakter olmalıdır.');
                      return;
                    }

                    try {
                      await EmailAuthService.changePassword(currentPassword!, newPassword);
                      Alert.alert('Başarılı', 'Şifreniz başarıyla değiştirildi.');
                    } catch (error: any) {
                      Alert.alert('Hata', error.message);
                    }
                  },
                },
              ],
              'secure-text',
            );
          },
        },
      ],
      'secure-text',
    );
  };

  const handleDeleteAccount = async () => {
    haptics.impactMedium();

    Alert.alert(
      'Hesabı Sil',
      'Hesabınızı silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz ve şunlar silinecektir:\n\n• Tüm kişisel verileriniz\n• Aile üyeleri bilgileri\n• Mesajlar ve konuşmalar\n• Konum geçmişi\n• Sağlık profili\n• Tüm ayarlar\n\nBu işlem kalıcıdır ve geri alınamaz!',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Evet, Sil',
          style: 'destructive',
          onPress: async () => {
            // Final confirmation
            Alert.alert(
              'Son Onay',
              'Hesabınızı kalıcı olarak silmek istediğinizden kesinlikle emin misiniz? Bu işlem geri alınamaz!',
              [
                {
                  text: 'Hayır, İptal',
                  style: 'cancel',
                },
                {
                  text: 'Evet, Kesinlikle Sil',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setIsDeletingAccount(true);
                      const deviceId = await getDeviceId();

                      const result = await accountDeletionService.deleteAccount(
                        deviceId,
                        (progress) => {
                          setDeletionProgress(progress);
                        },
                      );

                      setIsDeletingAccount(false);
                      setDeletionProgress(null);

                      if (result.success) {
                        Alert.alert(
                          'Hesap Silindi',
                          'Hesabınız ve tüm verileriniz başarıyla silindi. Uygulama kapatılacak.',
                          [
                            {
                              text: 'Tamam',
                              onPress: () => {
                                // Exit app (platform specific)
                                if (Platform.OS === 'ios') {
                                  // iOS doesn't allow programmatic exit, but we can clear everything
                                } else {
                                  // Android
                                  BackHandler.exitApp();
                                }
                              },
                            },
                          ],
                        );
                      } else {
                        Alert.alert(
                          'Hesap Silme Hatası',
                          `Hesap silinirken bazı hatalar oluştu:\n\n${result.errors.join('\n')}\n\nLütfen tekrar deneyin veya destek ekibiyle iletişime geçin.`,
                          [{ text: 'Tamam' }],
                        );
                      }
                    } catch (error: unknown) {
                      setIsDeletingAccount(false);
                      setDeletionProgress(null);
                      logger.error('Account deletion error:', error);
                      Alert.alert(
                        'Hata',
                        `Hesap silinirken bir hata oluştu: ${getErrorMessage(error) || 'Bilinmeyen hata'}`,
                        [{ text: 'Tamam' }],
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
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
            isLast={itemIndex === items.length - 1} // Hide border for last item
          />
        ))}
      </View>
    </View>
  );



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
      icon: 'settings',
      title: 'Detaylı Bildirim Ayarları',
      subtitle: 'Ses tonları, modlar ve şiddet bazlı ayarlar',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('NotificationSettings');
      },
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
    // AI Asistan toggle kaldırıldı - her zaman aktif
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
          [{ text: 'Tamam' }],
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
        // AI Asistan her zaman aktif - kontrol kaldırıldı
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
        // AI Asistan her zaman aktif - kontrol kaldırıldı
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
        // AI Asistan her zaman aktif - kontrol kaldırıldı
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
      icon: 'navigate',
      title: 'PDR Konum Takibi',
      subtitle: 'GPS olmadan adım sayarak konum belirleme',
      type: 'switch',
      value: pdrEnabled,
      onPress: () => {
        haptics.impactLight();
        const newValue = !pdrEnabled;
        setPdrEnabled(newValue);
        Alert.alert(
          'PDR Konum Takibi',
          newValue
            ? 'PDR aktif edildi. GPS olmadan adım sensörü ile konum takibi yapılacak.'
            : 'PDR kapatıldı.',
          [{ text: 'Tamam' }]
        );
      },
    },
    {
      icon: 'location',
      title: 'Yakınlık Uyarıları',
      subtitle: 'Yakındaki acil durumlar için otomatik bildirim',
      type: 'switch',
      value: proximityAlertsEnabled,
      onPress: () => {
        haptics.impactLight();
        const newValue = !proximityAlertsEnabled;
        setProximityAlertsEnabled(newValue);
        Alert.alert(
          'Yakınlık Uyarıları',
          newValue
            ? 'Yakınlık uyarıları aktif edildi. Çevrenizdeki acil durumlar için bildirim alacaksınız.'
            : 'Yakınlık uyarıları kapatıldı.',
          [{ text: 'Tamam' }]
        );
      },
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
          [{ text: 'Tamam' }],
        );
      },
    },
    {
      icon: 'warning',
      title: 'Erken Uyarı Sistemi',
      subtitle: 'Deprem erken uyarı bildirimleri',
      type: 'switch',
      value: eewEnabled,
      onPress: async () => {
        haptics.impactLight();
        const newValue = !eewEnabled;
        setEewEnabled(newValue);

        // Start/stop EEW service based on setting
        const { eewService } = await import('../../services/EEWService');
        if (newValue) {
          await eewService.start();
          Alert.alert('Erken Uyarı', 'Erken uyarı sistemi aktif edildi.');
        } else {
          eewService.stop();
          Alert.alert('Erken Uyarı', 'Erken uyarı sistemi kapatıldı.');
        }
      },
    },
    {
      icon: 'phone-portrait',
      title: 'Sensör Tabanlı Algılama',
      subtitle: 'Telefon sensörleri ile deprem algılama',
      type: 'switch',
      value: seismicSensorEnabled,
      onPress: async () => {
        haptics.impactLight();
        const newValue = !seismicSensorEnabled;
        setSeismicSensorEnabled(newValue);

        // Start/stop seismic sensor based on setting
        const { onDeviceSeismicDetector } = await import('../../services/OnDeviceSeismicDetector');
        if (newValue) {
          await onDeviceSeismicDetector.start();
          Alert.alert('Sensör Algılama', 'P-dalga sensör algılama aktif edildi.');
        } else {
          onDeviceSeismicDetector.stop();
          Alert.alert('Sensör Algılama', 'Sensör tabanlı algılama kapatıldı.');
        }
      },
    },
    {
      icon: 'alert-circle',
      title: 'Tehlike Çıkarımı',
      subtitle: 'AI ile otomatik tehlike bölgesi tespiti',
      type: 'switch',
      value: aiHazardEnabled,
      onPress: () => {
        haptics.impactLight();
        const newValue = !aiHazardEnabled;
        setAiHazardEnabled(newValue);
        Alert.alert(
          'AI Tehlike Çıkarımı',
          newValue
            ? 'AI tehlike algılama aktif edildi. Deprem sonrası potansiyel tehlike bölgeleri otomatik tespit edilecek.'
            : 'AI tehlike algılama kapatıldı.',
          [{ text: 'Tamam' }]
        );
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
    {
      icon: 'shield-checkmark',
      title: '⚡ Erken Uyarı ELITE',
      subtitle: '24/7 koruma, hassasiyet, test modu',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('EEWSettings');
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
      icon: 'share-social',
      title: 'Acil Sağlık Paylaşımı',
      subtitle: 'SOS sırasında kritik sağlık bilgilerinizi paylaş',
      type: 'switch',
      value: healthSharingEnabled,
      onPress: async () => {
        haptics.impactLight();
        const newValue = !healthSharingEnabled;
        setHealthSharingEnabled(newValue);

        // Update the service
        const { emergencyHealthSharingService } = await import('../../services/EmergencyHealthSharingService');
        await emergencyHealthSharingService.setEnabled(newValue);

        if (newValue) {
          Alert.alert(
            'Acil Sağlık Paylaşımı',
            'SOS aktif olduğunda, yakındaki AfetNet kullanıcılarına kan grubunuz, alerjileriniz ve kritik hastalıklarınız paylaşılacak.\n\n✅ Sadece SOS sırasında paylaşılır\n✅ Tam isminiz ve telefon numaranız paylaşılmaz\n✅ Hayat kurtarıcı bilgiler',
            [{ text: 'Anladım' }]
          );
        } else {
          Alert.alert(
            'Acil Sağlık Paylaşımı',
            'SOS sırasında sağlık bilgileri paylaşılmayacak.',
            [{ text: 'Tamam' }]
          );
        }
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
    // Get store values for accessibility
    const fontScale = useSettingsStore.getState().fontScale;
    const highContrastEnabled = useSettingsStore.getState().highContrastEnabled;
    const setFontScale = useSettingsStore.getState().setFontScale;
    const setHighContrast = useSettingsStore.getState().setHighContrast;

    const items: SettingOption[] = [
      {
        icon: 'language',
        title: i18nService.t('settings.language'),
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
            ],
          );
        },
      },
      // ELITE: Accessibility Features - Always visible (production ready)
      {
        icon: 'text',
        title: 'Yazı Boyutu',
        subtitle: `Mevcut: %${Math.round(fontScale * 100)}`,
        type: 'arrow',
        onPress: () => {
          haptics.impactLight();
          Alert.alert(
            'Yazı Boyutu',
            'Metin boyutunu seçin:',
            [
              { text: 'Normal (%100)', onPress: () => setFontScale(1.0) },
              { text: 'Orta (%115)', onPress: () => setFontScale(1.15) },
              { text: 'Büyük (%130)', onPress: () => setFontScale(1.3) },
              { text: 'Çok Büyük (%150)', onPress: () => setFontScale(1.5) },
              { text: 'İptal', style: 'cancel' },
            ],
          );
        },
      },
      {
        icon: 'contrast',
        title: 'Yüksek Kontrast',
        subtitle: 'Görme güçlüğü olanlar için yüksek kontrast modu',
        type: 'switch',
        value: highContrastEnabled,
        onPress: () => {
          haptics.impactLight();
          const newValue = !highContrastEnabled;
          setHighContrast(newValue);
          Alert.alert(
            'Yüksek Kontrast',
            newValue ? 'Yüksek kontrast modu aktif edildi.' : 'Yüksek kontrast modu kapatıldı.',
            [{ text: 'Tamam' }],
          );
        },
      },
    ];

    return items;
  }, [currentLanguage, navigation]);

  const aboutSettings: SettingOption[] = [
    {
      icon: 'information-circle',
      title: 'Hakkında',
      subtitle: 'Uygulama bilgileri ve özellikler',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('About');
      },
    },
    {
      icon: 'document-text',
      title: 'Gizlilik Politikası',
      subtitle: 'Detaylı gizlilik politikası',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('PrivacyPolicy');
      },
    },
    {
      icon: 'document',
      title: 'Kullanım Koşulları',
      subtitle: 'Detaylı kullanım koşulları',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('TermsOfService');
      },
    },
    {
      icon: 'shield-checkmark',
      title: 'Güvenlik',
      subtitle: 'Güvenlik ve şifreleme detayları',
      type: 'arrow',
      onPress: () => {
        haptics.impactLight();
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate('Security');
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
    // ELITE: Şifre Değiştirme
    {
      icon: 'key',
      title: 'Şifre Değiştir',
      subtitle: 'Hesap şifrenizi güncelleyin',
      type: 'arrow',
      onPress: handleChangePassword,
    },
    {
      icon: 'trash',
      title: 'Hesabı Sil',
      subtitle: 'Tüm verilerinizi kalıcı olarak silin',
      type: 'arrow',
      onPress: handleDeleteAccount,
    },
  ];

  return (
    <ImageBackground
      source={require('../../../assets/images/premium/family_soft_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.7)']}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#334155" />
        </Pressable>
        <Text style={styles.headerTitle}>{i18nService.t('settings.title')}</Text>
        <View style={styles.placeholderButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Upgrade Banner */}


        {/* Sections */}
        {renderSection('Bildirimler', notificationSettings, 0)}
        {renderSection('Konum & Harita', locationSettings, 1)}
        {renderSection('AI & Güvenlik', aiSettings, 2)}
        {renderSection('Mesh Ağı & İletişim', meshSettings, 3)}
        {renderSection('Deprem & Sensörler', earthquakeSettings, 4)}
        {renderSection('Medikal & Acil Durum', medicalSettings, 5)}
        {renderSection('Arama Kurtarma (SAR)', rescueSettings, 6)}
        {renderSection('Genel Ayarlar', generalSettings, 7)}
        {renderSection('Hakkında & Destek', aboutSettings, 8)}

        <Text style={styles.versionText}>v{ENV.APP_VERSION}</Text>
        <Text style={styles.userIdText}>ID: {deviceId}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  placeholderButton: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 12,
    marginLeft: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  premiumBanner: {
    marginBottom: 24,
    borderRadius: 24,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  premiumGradient: {
    borderRadius: 24,
    padding: 2,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'transparent',
  },
  premiumIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  premiumTextContainer: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  premiumSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  versionText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
  },
  userIdText: {
    textAlign: 'center',
    color: '#cbd5e1',
    fontSize: 10,
    marginTop: 4,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Saved for complex stats card if needed later, but removing mostly for now
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
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
  versionSubtext: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  modalStep: {
    fontSize: 14,
    color: '#cbd5e1',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  modalProgress: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16,
  },
  modalNote: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
});
