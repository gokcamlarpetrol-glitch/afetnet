/**
 * ADVANCED SETTINGS SCREEN
 * Advanced configuration options for power users
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import * as haptics from '../../utils/haptics';
import { storageManagementService } from '../../services/StorageManagementService';
import { useRescueStore } from '../../stores/rescueStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AdvancedSettingsScreen({ navigation }: any) {
  const [debugMode, setDebugMode] = useState(false);
  const [verboseLogging, setVerboseLogging] = useState(false);
  const { beaconInterval, setBeaconInterval } = useRescueStore();

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
              `${(cleaned / 1024 / 1024).toFixed(2)}MB temizlendi`
            );
          },
        },
      ]
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
              `${(cleaned / 1024 / 1024).toFixed(2)}MB temizlendi`
            );
          },
        },
      ]
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
      ]
    );
  };

  const beaconIntervals = [
    { label: '5 saniye', value: 5 },
    { label: '10 saniye (Önerilen)', value: 10 },
    { label: '15 saniye', value: 15 },
    { label: '30 saniye', value: 30 },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Gelişmiş Ayarlar</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
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
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>İşaret Aralığı</Text>
              <Text style={styles.settingDescription}>
                SOS sinyali yayın sıklığı
              </Text>
            </View>
          </View>

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
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
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
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
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
          <Text style={styles.infoText}>AfetNet v1.0.2</Text>
          <Text style={styles.infoText}>Build 2025.11.05</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
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
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand.primary,
  },
  radioLabel: {
    fontSize: 15,
    color: colors.text.primary,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: colors.background.card,
    borderRadius: 12,
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
    color: colors.text.tertiary,
    marginBottom: 4,
  },
});


