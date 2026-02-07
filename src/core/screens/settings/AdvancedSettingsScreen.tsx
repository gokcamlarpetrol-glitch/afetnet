/**
 * ADVANCED SETTINGS SCREEN
 * Advanced configuration options for power users
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  ImageBackground,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme';
import * as haptics from '../../utils/haptics';
import { storageManagementService } from '../../services/StorageManagementService';
import { useRescueStore } from '../../stores/rescueStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { ENV } from '../../config/env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StackNavigationProp } from '@react-navigation/stack';

// ELITE: Proper navigation typing for type safety
interface AdvancedSettingsScreenProps {
  navigation?: StackNavigationProp<Record<string, undefined>>;
}

export default function AdvancedSettingsScreen({ navigation }: AdvancedSettingsScreenProps) {
  const { beaconInterval, setBeaconInterval } = useRescueStore();

  // Store Settings
  const sensorSensitivity = useSettingsStore((state) => state.sensorSensitivity);
  const setSensorSensitivity = useSettingsStore((state) => state.setSensorSensitivity);
  const sensorFalsePositiveFilter = useSettingsStore((state) => state.sensorFalsePositiveFilter);
  const setSensorFalsePositiveFilter = useSettingsStore((state) => state.setSensorFalsePositiveFilter);
  const debugMode = useSettingsStore((state) => state.debugModeEnabled);
  const setDebugMode = useSettingsStore((state) => state.setDebugMode);
  const verboseLogging = useSettingsStore((state) => state.verboseLoggingEnabled);
  const setVerboseLogging = useSettingsStore((state) => state.setVerboseLogging);

  const handleClearAICache = async () => {
    haptics.impactMedium();
    Alert.alert(
      'AI Önbelleğini Temizle',
      'Tüm AI yanıtları silinecek. Devam etmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            const cleaned = await storageManagementService.cleanupLowPriorityData();
            Alert.alert(
              'Başarılı',
              `${(cleaned / 1024 / 1024).toFixed(2)}MB temizlendi`,
            );
          },
        },
      ],
    );
  };

  const handleClearAllCache = async () => {
    haptics.impactMedium();
    Alert.alert(
      'Tüm Önbelleği Temizle',
      'Tüm önbellek verileri silinecek. Devam etmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            const cleaned = await storageManagementService.clearAllNonCriticalData();
            Alert.alert(
              'Başarılı',
              `${(cleaned / 1024 / 1024).toFixed(2)}MB temizlendi`,
            );
          },
        },
      ],
    );
  };

  const handleResetApp = async () => {
    haptics.impactHeavy();
    Alert.alert(
      'Uygulamayı Sıfırla',
      'TÜM veriler silinecek ve uygulama ilk kurulum haline gelecek. Bu işlem geri alınamaz!',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert('Başarılı', 'Uygulama sıfırlandı. Lütfen yeniden başlatın.');
          },
        },
      ],
    );
  };

  const beaconIntervals = [
    { label: '5 saniye', value: 5 },
    { label: '10 saniye (Önerilen)', value: 10 },
    { label: '15 saniye', value: 15 },
    { label: '30 saniye', value: 30 },
  ];

  const sensitivityOptions: { label: string; value: 'low' | 'medium' | 'high'; desc: string }[] = [
    { label: 'Yüksek Hassasiyet', value: 'high', desc: 'En ufak sarsıntıda tetiklenir' },
    { label: 'Orta (Önerilen)', value: 'medium', desc: 'Dengeli algılama' },
    { label: 'Düşük Hassasiyet', value: 'low', desc: 'Sadece güçlü sarsıntılar' },
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

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation?.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#334155" />
          </Pressable>
          <Text style={styles.title}>Gelişmiş Ayarlar</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

          {/* Sensor Settings - ELITE FEATURES */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sensör & Algılama (Elite)</Text>

            <View style={styles.settingCard}>
              <Text style={styles.cardHeaderLabel}>Algılama Hassasiyeti</Text>
              {sensitivityOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={styles.radioRow}
                  onPress={() => {
                    haptics.impactLight();
                    setSensorSensitivity(opt.value);
                  }}
                >
                  <View style={styles.radioCircle}>
                    {sensorSensitivity === opt.value && (
                      <View style={styles.radioFill} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radioLabel}>{opt.label}</Text>
                    <Text style={styles.radioDesc}>{opt.desc}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={[styles.settingRow, { marginTop: 8 }]}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Yapay Zeka Filtresi</Text>
                <Text style={styles.settingDescription}>
                  Yanlış alarmları (zıplama, düşme) engelle
                </Text>
              </View>
              <Switch
                value={sensorFalsePositiveFilter}
                onValueChange={(value) => {
                  haptics.impactLight();
                  setSensorFalsePositiveFilter(value);
                }}
                trackColor={{ false: '#cbd5e1', true: colors.brand.primary }}
              />
            </View>
          </View>

          {/* Storage Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Depolama Yönetimi</Text>

            <Pressable style={styles.settingRow} onPress={handleClearAICache}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>AI Önbelleğini Temizle</Text>
                <Text style={styles.settingDescription}>
                  AI yanıtlarını sil, alan kazan
                </Text>
              </View>
              <Ionicons name="trash-outline" size={20} color={colors.text.secondary} />
            </Pressable>

            <Pressable style={styles.settingRow} onPress={handleClearAllCache}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Tüm Önbelleği Temizle</Text>
                <Text style={styles.settingDescription}>
                  Haberler, AI, eski depremler
                </Text>
              </View>
              <Ionicons name="trash-outline" size={20} color={colors.text.secondary} />
            </Pressable>
          </View>

          {/* Rescue Beacon Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kurtarma İşareti</Text>

            <View style={styles.settingCard}>
              <Text style={[styles.cardHeaderLabel, { marginBottom: 8 }]}>Sinyal Aralığı (SOS)</Text>
              {beaconIntervals.map((interval) => (
                <Pressable
                  key={interval.value}
                  style={styles.radioRow}
                  onPress={() => {
                    haptics.impactLight();
                    setBeaconInterval(interval.value);
                  }}
                >
                  <View style={styles.radioCircle}>
                    {beaconInterval === interval.value && (
                      <View style={styles.radioFill} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>{interval.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Developer Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Geliştirici Seçenekleri</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Debug Modu</Text>
                <Text style={styles.settingDescription}>
                  Detaylı hata ayıklama bilgileri
                </Text>
              </View>
              <Switch
                value={debugMode}
                onValueChange={(value) => {
                  haptics.impactLight();
                  setDebugMode(value);
                }}
                trackColor={{ false: '#cbd5e1', true: colors.brand.primary }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Verbose Logging</Text>
                <Text style={styles.settingDescription}>
                  Tüm logları kaydet
                </Text>
              </View>
              <Switch
                value={verboseLogging}
                onValueChange={(value) => {
                  haptics.impactLight();
                  setVerboseLogging(value);
                }}
                trackColor={{ false: '#cbd5e1', true: colors.brand.primary }}
              />
            </View>
          </View>

          {/* Danger Zone */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Tehlikeli Bölge</Text>

            <Pressable style={styles.dangerButton} onPress={handleResetApp}>
              <Ionicons name="warning" size={20} color="#ef4444" />
              <Text style={styles.dangerButtonText}>Uygulamayı Sıfırla</Text>
            </Pressable>
          </View>

          {/* App Info */}
          <View style={styles.infoSection}>
            <Text style={styles.infoText}>AfetNet v{ENV.APP_VERSION}</Text>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  settingCard: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeaderLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#64748b',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  radioDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ef4444',
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },
  infoSection: {
    marginTop: 32,
    marginBottom: 32,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
});
