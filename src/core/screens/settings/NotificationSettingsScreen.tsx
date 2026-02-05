/**
 * NOTIFICATION SETTINGS SCREEN
 * 
 * ELITE: Kapsamlı ve detaylı bildirim ayarları
 * Kullanıcılar bildirimlerle ilgili her şeyi değiştirebilir
 * Ses tonları, bildirim modları, deprem şiddeti bazlı ayarlar
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography } from '../../theme';
import * as haptics from '../../utils/haptics';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEarthquakeAlert } from '../../hooks/useEarthquakeAlert';
import type { StackNavigationProp } from '@react-navigation/stack';

const SOUND_TYPES = [
  { value: 'default', label: 'Varsayılan', icon: 'notifications', description: 'Sistem varsayılan sesi' },
  { value: 'alarm', label: 'Alarm', icon: 'warning', description: 'Yüksek sesli alarm tonu' },
  { value: 'sos', label: 'SOS', icon: 'help-circle', description: 'SOS sinyal tonu' },
  { value: 'beep', label: 'Bip', icon: 'radio', description: 'Kısa bip sesi' },
  { value: 'chime', label: 'Çan', icon: 'musical-notes', description: 'Yumuşak çan sesi' },
  { value: 'siren', label: 'Siren', icon: 'alert-circle', description: 'Acil durum siren sesi' },
  { value: 'custom', label: 'Özel', icon: 'settings', description: 'Özel ses dosyası' },
] as const;

const NOTIFICATION_MODES = [
  { value: 'silent', label: 'Sessiz', icon: 'volume-mute', description: 'Sadece görsel bildirimler' },
  { value: 'vibrate', label: 'Titreşim', icon: 'phone-portrait', description: 'Sadece titreşim' },
  { value: 'sound', label: 'Sesli', icon: 'volume-high', description: 'Sadece ses' },
  { value: 'sound+vibrate', label: 'Ses + Titreşim', icon: 'notifications', description: 'Ses ve titreşim birlikte' },
  { value: 'critical-only', label: 'Sadece Kritik', icon: 'alert-circle', description: 'Sadece kritik depremler için bildirim' },
] as const;

// ELITE: Proper navigation typing for type safety
interface NotificationSettingsScreenProps {
  navigation?: StackNavigationProp<Record<string, undefined>>;
}

export default function NotificationSettingsScreen({ navigation }: NotificationSettingsScreenProps) {
  // Get all notification settings from store
  const {
    notificationsEnabled,
    notificationSound,
    notificationVibration,
    notificationTTS,
    notificationPush,
    notificationFullScreen,
    notificationSoundType,
    notificationSoundVolume,
    notificationSoundRepeat,
    notificationMode,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    quietHoursCriticalOnly,
    magnitudeBasedSound,
    magnitudeBasedVibration,
    notificationShowOnLockScreen,
    notificationShowPreview,
    notificationGroupByMagnitude,
    minMagnitudeForNotification,
    criticalMagnitudeThreshold,
    // Actions
    setNotifications,
    setNotificationSound,
    setNotificationVibration,
    setNotificationTTS,
    setNotificationPush,
    setNotificationFullScreen,
    setNotificationSoundType,
    setNotificationSoundVolume,
    setNotificationSoundRepeat,
    setNotificationMode,
    setQuietHoursEnabled,
    setQuietHoursStart,
    setQuietHoursEnd,
    setQuietHoursCriticalOnly,
    setMagnitudeBasedSound,
    setMagnitudeBasedVibration,
    setNotificationShowOnLockScreen,
    setNotificationShowPreview,
    setNotificationGroupByMagnitude,
  } = useSettingsStore();

  // ELITE: Earthquake alert hook for test functionality
  const { testAlert, alertCount, isMonitoring } = useEarthquakeAlert();
  const [isTestingAlert, setIsTestingAlert] = useState(false);

  const handleTestAlert = async () => {
    haptics.notificationWarning();
    setIsTestingAlert(true);
    try {
      await testAlert();
      Alert.alert('✅ Test Başarılı', 'Deprem uyarısı test bildirimi gönderildi.');
    } catch (e) {
      Alert.alert('❌ Hata', 'Test bildirimi gönderilemedi.');
    } finally {
      setIsTestingAlert(false);
    }
  };

  const [quietStartInput, setQuietStartInput] = useState(quietHoursStart);
  const [quietEndInput, setQuietEndInput] = useState(quietHoursEnd);
  const [volumeInput, setVolumeInput] = useState(notificationSoundVolume.toString());
  const [repeatInput, setRepeatInput] = useState(notificationSoundRepeat.toString());

  // Sync local state with store values
  useEffect(() => {
    setVolumeInput(notificationSoundVolume.toString());
  }, [notificationSoundVolume]);

  useEffect(() => {
    setRepeatInput(notificationSoundRepeat.toString());
  }, [notificationSoundRepeat]);

  useEffect(() => {
    setQuietStartInput(quietHoursStart);
  }, [quietHoursStart]);

  useEffect(() => {
    setQuietEndInput(quietHoursEnd);
  }, [quietHoursEnd]);

  const handleQuietHoursStartChange = (value: string) => {
    setQuietStartInput(value);
    // Validate HH:mm format
    if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      setQuietHoursStart(value);
    }
  };

  const handleQuietHoursEndChange = (value: string) => {
    setQuietEndInput(value);
    // Validate HH:mm format
    if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      setQuietHoursEnd(value);
    }
  };

  const renderSettingRow = (
    icon: string,
    title: string,
    subtitle: string,
    rightComponent: React.ReactNode,
  ) => (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon as any} size={24} color={colors.brand.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.settingRight}>
        {rightComponent}
      </View>
    </View>
  );

  const renderSoundTypeSelector = () => {
    return (
      <View style={styles.soundGrid}>
        {SOUND_TYPES.map((sound) => (
          <Pressable
            key={sound.value}
            style={[
              styles.soundCard,
              notificationSoundType === sound.value && styles.soundCardActive,
            ]}
            onPress={async () => {
              haptics.impactLight();
              if (sound.value === 'custom') {
                // Allow user to pick custom sound file
                try {
                  const result = await DocumentPicker.getDocumentAsync({
                    type: Platform.OS === 'ios' ? 'public.audio' : 'audio/*',
                    copyToCacheDirectory: true,
                  });

                  if (!result.canceled && result.assets && result.assets.length > 0) {
                    const soundUri = result.assets[0].uri;
                    await AsyncStorage.setItem('customNotificationSoundUri', soundUri);
                    setNotificationSoundType('custom');
                    Alert.alert('Başarılı', 'Özel ses dosyası seçildi');
                  }
                } catch (error) {
                  Alert.alert('Hata', 'Ses dosyası seçilemedi');
                }
              } else {
                setNotificationSoundType(sound.value as any);
              }
            }}
          >
            <LinearGradient
              colors={
                notificationSoundType === sound.value
                  ? [colors.brand.primary + '30', colors.brand.primary + '10']
                  : [colors.background.tertiary, colors.background.tertiary]
              }
              style={styles.soundCardGradient}
            >
              <Ionicons
                name={sound.icon as any}
                size={32}
                color={
                  notificationSoundType === sound.value
                    ? colors.brand.primary
                    : colors.text.secondary
                }
              />
              <Text
                style={[
                  styles.soundCardLabel,
                  notificationSoundType === sound.value && styles.soundCardLabelActive,
                ]}
              >
                {sound.label}
              </Text>
              <Text style={styles.soundCardDescription}>{sound.description}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderModeSelector = () => {
    return (
      <View style={styles.modeContainer}>
        {NOTIFICATION_MODES.map((mode) => (
          <Pressable
            key={mode.value}
            style={[
              styles.modeChip,
              notificationMode === mode.value && styles.modeChipActive,
            ]}
            onPress={() => {
              haptics.impactLight();
              setNotificationMode(mode.value as any);
            }}
          >
            <Ionicons
              name={mode.icon as any}
              size={20}
              color={
                notificationMode === mode.value
                  ? colors.brand.primary
                  : colors.text.secondary
              }
            />
            <Text
              style={[
                styles.modeChipText,
                notificationMode === mode.value && styles.modeChipTextActive,
              ]}
            >
              {mode.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderSliderRow = (
    icon: string,
    title: string,
    subtitle: string,
    value: number,
    min: number,
    max: number,
    onValueChange: (value: number) => void,
    inputValue: string,
    setInputValue: (value: string) => void,
    suffix?: string,
  ) => {
    return (
      <View style={styles.sliderRow}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon as any} size={24} color={colors.brand.primary} />
        </View>
        <View style={styles.sliderContent}>
          <View style={styles.sliderHeader}>
            <Text style={styles.settingTitle}>{title}</Text>
            <View style={styles.valueInputContainer}>
              <TextInput
                style={styles.valueInput}
                value={inputValue}
                onChangeText={(text) => {
                  setInputValue(text);
                  const num = parseFloat(text);
                  if (!isNaN(num) && num >= min && num <= max) {
                    onValueChange(num);
                  }
                }}
                keyboardType="numeric"
                placeholder={value.toString()}
                placeholderTextColor={colors.text.tertiary}
              />
              {suffix && <Text style={styles.valueSuffix}>{suffix}</Text>}
            </View>
          </View>
          <Text style={styles.settingSubtitle}>{subtitle} ({min}-{max}{suffix})</Text>
          <View style={styles.quickButtons}>
            {[min, Math.round((min + max) / 2), max].map((val) => (
              <Pressable
                key={val}
                style={[
                  styles.quickButton,
                  Math.abs(value - val) < 0.1 && styles.quickButtonActive,
                ]}
                onPress={() => {
                  haptics.impactLight();
                  setInputValue(val.toString());
                  onValueChange(val);
                }}
              >
                <Text
                  style={[
                    styles.quickButtonText,
                    Math.abs(value - val) < 0.1 && styles.quickButtonTextActive,
                  ]}
                >
                  {val}{suffix}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Bildirim Ayarları</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Genel Bildirim Ayarları */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Genel Bildirim Ayarları</Text>

          {renderSettingRow(
            'notifications',
            'Bildirimler',
            'Tüm bildirimleri aç/kapat',
            <Switch
              value={notificationsEnabled}
              onValueChange={(value) => {
                haptics.impactLight();
                setNotifications(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}

          {renderSettingRow(
            'notifications-outline',
            'Push Bildirimleri',
            'Standart push bildirimleri',
            <Switch
              value={notificationPush}
              onValueChange={(value) => {
                haptics.impactLight();
                setNotificationPush(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}

          {renderSettingRow(
            'phone-portrait',
            'Tam Ekran Uyarı',
            'Kritik depremler için tam ekran uyarı',
            <Switch
              value={notificationFullScreen}
              onValueChange={(value) => {
                haptics.impactLight();
                setNotificationFullScreen(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}
        </View>

        {/* Bildirim Modu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirim Modu</Text>
          <Text style={styles.sectionDescription}>
            Bildirimlerin nasıl gösterileceğini seçin
          </Text>
          {renderModeSelector()}
        </View>

        {/* Ses Ayarları */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ses Ayarları</Text>

          {renderSettingRow(
            'volume-high',
            'Alarm Sesi',
            'Sesli uyarıları aç/kapat',
            <Switch
              value={notificationSound}
              onValueChange={(value) => {
                haptics.impactLight();
                setNotificationSound(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}

          {notificationSound && (
            <>
              <View style={styles.sectionSubtitle}>
                <Text style={styles.sectionSubtitleText}>Ses Tonu Seçimi</Text>
              </View>
              {renderSoundTypeSelector()}

              {renderSliderRow(
                'volume-high',
                'Ses Seviyesi',
                'Bildirim sesinin yüksekliği',
                notificationSoundVolume,
                0,
                100,
                (value) => {
                  haptics.impactLight();
                  setNotificationSoundVolume(value);
                },
                volumeInput,
                setVolumeInput,
                '%',
              )}

              {renderSliderRow(
                'repeat',
                'Tekrar Sayısı',
                'Bildirim sesinin kaç kez tekrarlanacağı',
                notificationSoundRepeat,
                1,
                10,
                (value) => {
                  haptics.impactLight();
                  setNotificationSoundRepeat(Math.round(value));
                },
                repeatInput,
                setRepeatInput,
                ' kez',
              )}
            </>
          )}

          {renderSettingRow(
            'phone-portrait',
            'Titreşim',
            'Vibrasyon uyarıları',
            <Switch
              value={notificationVibration}
              onValueChange={(value) => {
                haptics.impactLight();
                setNotificationVibration(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}

          {renderSettingRow(
            'mic',
            'Sesli Anons',
            'Text-to-Speech bildirimleri',
            <Switch
              value={notificationTTS}
              onValueChange={(value) => {
                haptics.impactLight();
                setNotificationTTS(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}
        </View>

        {/* Deprem Şiddeti Bazlı Ayarlar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deprem Şiddeti Bazlı Ayarlar</Text>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={colors.status.info} />
            <Text style={styles.infoBoxText}>
              Minimum bildirim büyüklüğü: {minMagnitudeForNotification.toFixed(1)} M{'\n'}
              Kritik büyüklük eşiği: {criticalMagnitudeThreshold.toFixed(1)} M
            </Text>
          </View>

          {renderSettingRow(
            'musical-notes',
            'Şiddete Göre Ses',
            'Farklı şiddetlerde farklı sesler çal',
            <Switch
              value={magnitudeBasedSound}
              onValueChange={(value) => {
                haptics.impactLight();
                setMagnitudeBasedSound(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}

          {renderSettingRow(
            'phone-portrait',
            'Şiddete Göre Titreşim',
            'Farklı şiddetlerde farklı titreşim desenleri',
            <Switch
              value={magnitudeBasedVibration}
              onValueChange={(value) => {
                haptics.impactLight();
                setMagnitudeBasedVibration(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}

          <View style={styles.magnitudeInfo}>
            <Text style={styles.magnitudeInfoTitle}>Şiddet Bazlı Ayarlar:</Text>
            <View style={styles.magnitudeInfoRow}>
              <Text style={styles.magnitudeInfoText}>
                🔴 Kritik ({criticalMagnitudeThreshold.toFixed(1)}+ M): Yüksek sesli alarm + Güçlü titreşim
              </Text>
            </View>
            <View style={styles.magnitudeInfoRow}>
              <Text style={styles.magnitudeInfoText}>
                🟠 Büyük (5.0-6.0 M): Orta sesli alarm + Orta titreşim
              </Text>
            </View>
            <View style={styles.magnitudeInfoRow}>
              <Text style={styles.magnitudeInfoText}>
                🟡 Orta (4.0-5.0 M): Düşük sesli alarm + Hafif titreşim
              </Text>
            </View>
            <View style={styles.magnitudeInfoRow}>
              <Text style={styles.magnitudeInfoText}>
                🟢 Küçük (3.0-4.0 M): Yumuşak ses + Hafif titreşim
              </Text>
            </View>
          </View>
        </View>

        {/* Zaman Bazlı Ayarlar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zaman Bazlı Ayarlar</Text>

          {renderSettingRow(
            'moon',
            'Sessiz Saatler',
            'Belirli saatlerde bildirimleri azalt',
            <Switch
              value={quietHoursEnabled}
              onValueChange={(value) => {
                haptics.impactLight();
                setQuietHoursEnabled(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}

          {quietHoursEnabled && (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name="time" size={24} color={colors.brand.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Başlangıç Saati</Text>
                  <Text style={styles.settingSubtitle}>Sessiz saatlerin başlangıcı</Text>
                </View>
                <View style={styles.timeInputContainer}>
                  <TextInput
                    style={styles.timeInput}
                    value={quietStartInput}
                    onChangeText={handleQuietHoursStartChange}
                    placeholder="22:00"
                    placeholderTextColor={colors.text.tertiary}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name="time-outline" size={24} color={colors.brand.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Bitiş Saati</Text>
                  <Text style={styles.settingSubtitle}>Sessiz saatlerin bitişi</Text>
                </View>
                <View style={styles.timeInputContainer}>
                  <TextInput
                    style={styles.timeInput}
                    value={quietEndInput}
                    onChangeText={handleQuietHoursEndChange}
                    placeholder="07:00"
                    placeholderTextColor={colors.text.tertiary}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>

              {renderSettingRow(
                'alert-circle',
                'Sadece Kritik Depremler',
                'Sessiz saatlerde sadece kritik depremler için bildirim',
                <Switch
                  value={quietHoursCriticalOnly}
                  onValueChange={(value) => {
                    haptics.impactLight();
                    setQuietHoursCriticalOnly(value);
                  }}
                  trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
                />,
              )}
            </>
          )}
        </View>

        {/* Görünüm Ayarları */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Görünüm Ayarları</Text>

          {renderSettingRow(
            'lock-closed',
            'Kilit Ekranında Göster',
            'Bildirimleri kilit ekranında göster',
            <Switch
              value={notificationShowOnLockScreen}
              onValueChange={(value) => {
                haptics.impactLight();
                setNotificationShowOnLockScreen(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}

          {renderSettingRow(
            'eye',
            'Önizleme Göster',
            'Bildirimlerde önizleme metni göster',
            <Switch
              value={notificationShowPreview}
              onValueChange={(value) => {
                haptics.impactLight();
                setNotificationShowPreview(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}

          {renderSettingRow(
            'layers',
            'Şiddete Göre Grupla',
            'Bildirimleri deprem şiddetine göre grupla',
            <Switch
              value={notificationGroupByMagnitude}
              onValueChange={(value) => {
                haptics.impactLight();
                setNotificationGroupByMagnitude(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />,
          )}
        </View>

        {/* ELITE: Test Notification Button */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirim Testi</Text>

          <View style={styles.testAlertCard}>
            <View style={styles.testAlertHeader}>
              <View style={styles.testAlertIconContainer}>
                <Ionicons name="flash" size={24} color="#fff" />
              </View>
              <View style={styles.testAlertInfo}>
                <Text style={styles.testAlertTitle}>Uyarı Testi</Text>
                <Text style={styles.testAlertSubtitle}>
                  Deprem bildirimi nasıl görüneceğini test edin
                </Text>
              </View>
            </View>

            <Pressable
              style={[styles.testAlertButton, isTestingAlert && styles.testAlertButtonDisabled]}
              onPress={handleTestAlert}
              disabled={isTestingAlert}
            >
              <LinearGradient
                colors={isTestingAlert ? ['#9ca3af', '#6b7280'] : ['#f43f5e', '#e11d48']}
                style={styles.testAlertButtonGradient}
              >
                {isTestingAlert ? (
                  <Text style={styles.testAlertButtonText}>Test Gönderiliyor...</Text>
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.testAlertButtonText}>Test Bildirimi Gönder</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.testAlertStats}>
              <View style={styles.testAlertStat}>
                <Text style={styles.testAlertStatValue}>{alertCount}</Text>
                <Text style={styles.testAlertStatLabel}>Toplam Uyarı</Text>
              </View>
              <View style={styles.testAlertStatDivider} />
              <View style={styles.testAlertStat}>
                <View style={[styles.monitoringDot, isMonitoring && styles.monitoringDotActive]} />
                <Text style={styles.testAlertStatLabel}>{isMonitoring ? 'İzleniyor' : 'Pasif'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bilgi Kartı */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.status.info} />
          <Text style={styles.infoText}>
            Bu ayarlar bildirimlerinizi tamamen özelleştirmenizi sağlar.
            Ses tonları, bildirim modları ve zaman bazlı ayarlar ile bildirimlerinizi istediğiniz gibi yapılandırabilirsiniz.
          </Text>
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
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  sectionDescription: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginBottom: 12,
  },
  sectionSubtitle: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionSubtitleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  settingRow: {
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
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  settingRight: {
    marginLeft: 12,
  },
  soundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  soundCard: {
    width: '47%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  soundCardActive: {
    borderColor: colors.brand.primary,
  },
  soundCardGradient: {
    padding: 16,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  soundCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 8,
  },
  soundCardLabelActive: {
    color: colors.brand.primary,
  },
  soundCardDescription: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  modeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: colors.border.light,
    gap: 8,
  },
  modeChipActive: {
    backgroundColor: colors.brand.primary + '20',
    borderColor: colors.brand.primary,
  },
  modeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  modeChipTextActive: {
    color: colors.brand.primary,
  },
  sliderRow: {
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
  sliderContent: {
    flex: 1,
    marginLeft: 12,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  valueInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    paddingHorizontal: 12,
    minWidth: 80,
  },
  valueInput: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    paddingVertical: 6,
    textAlign: 'center',
    minWidth: 50,
  },
  valueSuffix: {
    fontSize: 13,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
  },
  quickButtonActive: {
    backgroundColor: colors.brand.primary + '20',
    borderColor: colors.brand.primary,
  },
  quickButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  quickButtonTextActive: {
    color: colors.brand.primary,
  },
  timeInputContainer: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    paddingHorizontal: 12,
    minWidth: 80,
  },
  timeInput: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    paddingVertical: 8,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: colors.status.info + '20',
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  magnitudeInfo: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  magnitudeInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  magnitudeInfoRow: {
    marginBottom: 8,
  },
  magnitudeInfoText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: colors.status.info + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.status.info + '40',
    marginTop: 8,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  // ELITE: Test Alert Styles
  testAlertCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  testAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  testAlertIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testAlertInfo: {
    flex: 1,
  },
  testAlertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  testAlertSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  testAlertButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  testAlertButtonDisabled: {
    opacity: 0.6,
  },
  testAlertButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
  },
  testAlertButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  testAlertStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  testAlertStat: {
    alignItems: 'center',
    gap: 4,
  },
  testAlertStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  testAlertStatLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  testAlertStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.light,
  },
  monitoringDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text.tertiary,
  },
  monitoringDotActive: {
    backgroundColor: '#22c55e',
  },
});

