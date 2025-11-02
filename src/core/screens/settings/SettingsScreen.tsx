/**
 * SETTINGS SCREEN - Comprehensive Settings
 * All app features and services settings
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Switch,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { usePremiumStore } from '../../stores/premiumStore';
import { useMeshStore } from '../../stores/meshStore';
import { premiumService } from '../../services/PremiumService';
import { i18nService } from '../../services/I18nService';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { SettingItem } from '../../components/settings/SettingItem';
import * as haptics from '../../utils/haptics';
import { voiceCommandService } from '../../services/VoiceCommandService';
import { batterySaverService } from '../../services/BatterySaverService';

interface SettingItem {
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [bleMeshEnabled, setBleMeshEnabled] = useState(true);
  const [eewEnabled, setEewEnabled] = useState(true);
  const [seismicSensorEnabled, setSeismicSensorEnabled] = useState(true);
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [voiceCommandEnabled, setVoiceCommandEnabled] = useState(false);
  const [batterySaverEnabled, setBatterySaverEnabled] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('tr');

  useEffect(() => {
    const interval = setInterval(() => {
      setIsPremium(usePremiumStore.getState().isPremium);
      setMeshStats(useMeshStore.getState().stats);
      setCurrentLanguage(i18nService.getLocale());
    }, 500);

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
    Alert.alert(
      'Dil Seç',
      'Kullanmak istediğiniz dili seçin',
      [
        { text: 'Türkçe', onPress: () => { i18nService.setLocale('tr'); setCurrentLanguage('tr'); } },
        { text: 'Kurdî', onPress: () => { i18nService.setLocale('ku'); setCurrentLanguage('ku'); } },
        { text: 'العربية', onPress: () => { i18nService.setLocale('ar'); setCurrentLanguage('ar'); } },
        { text: 'İptal', style: 'cancel' },
      ]
    );
  };
  
  const renderSection = (title: string, items: any[], sectionIndex: number) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {items.map((item, itemIndex) => (
          <SettingItem
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

  const premiumSettings: SettingItem[] = [
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
  ];

  const notificationSettings: SettingItem[] = [
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
      subtitle: 'LED ışık uyarıları',
      type: 'switch',
      value: false,
      onPress: () => {},
    },
    {
      icon: 'notifications-outline',
      title: 'Tam Ekran Uyarı',
      subtitle: 'Tam ekran acil durum uyarıları',
      type: 'switch',
      value: true,
      onPress: () => {},
    },
  ];

  const locationSettings: SettingItem[] = [
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
      onPress: () => {},
    },
  ];

  const meshSettings: SettingItem[] = [
    {
      icon: 'bluetooth',
      title: 'BLE Mesh Ağı',
      subtitle: 'Bluetooth mesh iletişimi',
      type: 'switch',
      value: bleMeshEnabled,
      onPress: () => setBleMeshEnabled(!bleMeshEnabled),
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
      icon: 'mic',
      title: 'Sesli Komutlar',
      subtitle: 'Eller serbest kontrol (Yardım, Konum, Düdük, SOS)',
      type: 'switch',
      value: voiceCommandEnabled,
      onPress: async () => {
        const newValue = !voiceCommandEnabled;
        setVoiceCommandEnabled(newValue);
        if (newValue) {
          await voiceCommandService.startListening();
        } else {
          await voiceCommandService.stopListening();
        }
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

  const earthquakeSettings: SettingItem[] = [
    {
      icon: 'pulse',
      title: 'Deprem İzleme',
      subtitle: 'AFAD ve Kandilli verileri',
      type: 'switch',
      value: true,
      onPress: () => {},
    },
    {
      icon: 'warning',
      title: 'Erken Uyarı Sistemi',
      subtitle: 'Deprem erken uyarı bildirimleri',
      type: 'switch',
      value: eewEnabled,
      onPress: () => setEewEnabled(!eewEnabled),
    },
    {
      icon: 'phone-portrait',
      title: 'Sensör Tabanlı Algılama',
      subtitle: 'Telefon sensörleri ile deprem algılama',
      type: 'switch',
      value: seismicSensorEnabled,
      onPress: () => setSeismicSensorEnabled(!seismicSensorEnabled),
    },
    {
      icon: 'filter',
      title: 'Büyüklük Filtresi',
      subtitle: 'Minimum deprem büyüklüğü',
      type: 'arrow',
      onPress: () => {},
    },
  ];

  const generalSettings: SettingItem[] = [
    {
      icon: 'language',
      title: 'Dil',
      subtitle: i18nService.getLocaleDisplayName(currentLanguage),
      type: 'arrow',
      onPress: handleLanguageChange,
    },
    {
      icon: 'text',
      title: 'Yazı Boyutu',
      subtitle: 'Erişilebilirlik ayarları',
      type: 'arrow',
      onPress: () => {},
    },
    {
      icon: 'contrast',
      title: 'Yüksek Kontrast',
      subtitle: 'Görünürlüğü artır',
      type: 'switch',
      value: false,
      onPress: () => {},
    },
    {
      icon: 'moon',
      title: 'Karanlık Mod',
      subtitle: 'Tema ayarları',
      type: 'switch',
      value: true,
      onPress: () => {},
    },
  ];

  const aboutSettings: SettingItem[] = [
    {
      icon: 'information-circle',
      title: 'Hakkında',
      subtitle: 'AfetNet v1.0.0',
      type: 'arrow',
      onPress: () => {},
    },
    {
      icon: 'document-text',
      title: 'Gizlilik Politikası',
      subtitle: 'Kullanım koşulları',
      type: 'arrow',
      onPress: () => {},
    },
    {
      icon: 'shield-checkmark',
      title: 'Güvenlik',
      subtitle: 'Güvenlik ve şifreleme',
      type: 'arrow',
      onPress: () => {},
    },
    {
      icon: 'help-circle',
      title: 'Yardım ve Destek',
      subtitle: 'SSS ve destek',
      type: 'arrow',
      onPress: () => {},
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
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

        {renderSection('Bildirimler ve Uyarılar', notificationSettings, 1)}
        {renderSection('Konum ve Harita', locationSettings, 2)}
        {renderSection('Mesh Ağı ve İletişim', meshSettings, 3)}
        {renderSection('Deprem İzleme', earthquakeSettings, 4)}
        {renderSection('Genel', generalSettings, 5)}
        {renderSection('Hakkında', aboutSettings, 6)}
        
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
