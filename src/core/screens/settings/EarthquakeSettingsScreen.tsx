/**
 * EARTHQUAKE SETTINGS SCREEN
 * 
 * ELITE: Kapsamlı ve detaylı deprem ayarları
 * Kullanıcılar istedikleri gibi değişiklik yapabilir
 * Tüm ayarlar gerçek ve aktif
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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../theme';
import * as haptics from '../../utils/haptics';
import { useSettingsStore } from '../../stores/settingsStore';

export default function EarthquakeSettingsScreen({ navigation }: any) {
  // Get all earthquake settings from store
  const {
    minMagnitudeForNotification,
    maxDistanceForNotification,
    criticalMagnitudeThreshold,
    criticalDistanceThreshold,
    eewEnabled,
    eewMinMagnitude,
    eewWarningTime,
    seismicSensorEnabled,
    sensorSensitivity,
    sensorFalsePositiveFilter,
    sourceAFAD,
    sourceUSGS,
    sourceEMSC,
    sourceKOERI,
    sourceCommunity,
    notificationPush,
    notificationFullScreen,
    notificationSound,
    notificationVibration,
    notificationTTS,
    priorityCritical,
    priorityHigh,
    priorityMedium,
    priorityLow,
    // Actions
    setMinMagnitudeForNotification,
    setMaxDistanceForNotification,
    setCriticalMagnitudeThreshold,
    setCriticalDistanceThreshold,
    setEew,
    setEewMinMagnitude,
    setEewWarningTime,
    setSeismicSensor,
    setSensorSensitivity,
    setSensorFalsePositiveFilter,
    setSourceAFAD,
    setSourceUSGS,
    setSourceEMSC,
    setSourceKOERI,
    setSourceCommunity,
    setNotificationPush,
    setNotificationFullScreen,
    setNotificationSound,
    setNotificationVibration,
    setNotificationTTS,
    setPriorityCritical,
    setPriorityHigh,
    setPriorityMedium,
    setPriorityLow,
  } = useSettingsStore();

  // Local state for text inputs
  const [magnitudeInput, setMagnitudeInput] = useState(minMagnitudeForNotification.toFixed(1));
  const [distanceInput, setDistanceInput] = useState(maxDistanceForNotification === 0 ? '' : maxDistanceForNotification.toString());
  const [criticalMagnitudeInput, setCriticalMagnitudeInput] = useState(criticalMagnitudeThreshold.toFixed(1));
  const [criticalDistanceInput, setCriticalDistanceInput] = useState(criticalDistanceThreshold.toString());
  const [eewMagnitudeInput, setEewMagnitudeInput] = useState(eewMinMagnitude.toFixed(1));
  const [eewTimeInput, setEewTimeInput] = useState(eewWarningTime.toString());

  const handleMagnitudeChange = (value: string) => {
    setMagnitudeInput(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      setMinMagnitudeForNotification(num);
    }
  };

  const handleDistanceChange = (value: string) => {
    setDistanceInput(value);
    const num = parseInt(value, 10);
    if (value === '' || value === '0') {
      setMaxDistanceForNotification(0);
    } else if (!isNaN(num) && num > 0) {
      setMaxDistanceForNotification(num);
    }
  };

  const handleCriticalMagnitudeChange = (value: string) => {
    setCriticalMagnitudeInput(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      setCriticalMagnitudeThreshold(num);
    }
  };

  const handleCriticalDistanceChange = (value: string) => {
    setCriticalDistanceInput(value);
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setCriticalDistanceThreshold(num);
    }
  };

  const handleEewMagnitudeChange = (value: string) => {
    setEewMagnitudeInput(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      setEewMinMagnitude(num);
    }
  };

  const handleEewTimeChange = (value: string) => {
    setEewTimeInput(value);
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0 && num <= 60) {
      setEewWarningTime(num);
    }
  };

  const handleEewToggle = async (enabled: boolean) => {
    haptics.impactLight();
    setEew(enabled);
    
    // Start/stop EEW service
    const { eewService } = await import('../../services/EEWService');
    if (enabled) {
      await eewService.start();
    } else {
      eewService.stop();
    }
  };

  const handleSensorToggle = (enabled: boolean) => {
    haptics.impactLight();
    setSeismicSensor(enabled);
  };

  const handlePriorityChange = (
    type: 'critical' | 'high' | 'medium' | 'low',
    priority: string
  ) => {
    haptics.impactLight();
    switch (type) {
      case 'critical':
        setPriorityCritical(priority as 'critical' | 'high' | 'normal');
        break;
      case 'high':
        setPriorityHigh(priority as 'critical' | 'high' | 'normal');
        break;
      case 'medium':
        setPriorityMedium(priority as 'high' | 'normal' | 'low');
        break;
      case 'low':
        setPriorityLow(priority as 'normal' | 'low');
        break;
    }
  };

  const renderSettingRow = (
    icon: string,
    title: string,
    subtitle: string,
    rightComponent: React.ReactNode
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

  const renderInputRow = (
    icon: string,
    title: string,
    subtitle: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    keyboardType: 'numeric' | 'default' = 'numeric',
    suffix?: string
  ) => (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon as any} size={24} color={colors.brand.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          placeholderTextColor={colors.text.tertiary}
        />
        {suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
      </View>
    </View>
  );

  const renderPrioritySelector = (
    type: 'critical' | 'high' | 'medium' | 'low',
    currentPriority: string,
    options: string[]
  ) => {
    return (
      <View style={styles.priorityContainer}>
        {options.map((option) => (
          <Pressable
            key={option}
            style={[
              styles.priorityChip,
              currentPriority === option && styles.priorityChipActive,
            ]}
            onPress={() => handlePriorityChange(type, option)}
          >
            <Text
              style={[
                styles.priorityChipText,
                currentPriority === option && styles.priorityChipTextActive,
              ]}
            >
              {option === 'critical' ? 'Kritik' :
               option === 'high' ? 'Yüksek' :
               option === 'normal' ? 'Normal' :
               option === 'low' ? 'Düşük' : option}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Deprem Ayarları</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Bildirim Eşikleri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirim Eşikleri</Text>
          
          {renderInputRow(
            'notifications',
            'Minimum Büyüklük',
            'Bu büyüklüğün altındaki depremler için bildirim gönderilmez',
            magnitudeInput,
            handleMagnitudeChange,
            '3.0',
            'numeric',
            'M'
          )}

          {renderInputRow(
            'location',
            'Maksimum Mesafe',
            'Bu mesafenin dışındaki depremler için bildirim gönderilmez (0 = sınırsız)',
            distanceInput,
            handleDistanceChange,
            '0',
            'numeric',
            'km'
          )}

          {renderInputRow(
            'warning',
            'Kritik Büyüklük Eşiği',
            'Bu büyüklüğün üstündeki depremler kritik olarak işaretlenir',
            criticalMagnitudeInput,
            handleCriticalMagnitudeChange,
            '6.0',
            'numeric',
            'M'
          )}

          {renderInputRow(
            'radio',
            'Kritik Mesafe Eşiği',
            'Bu mesafenin içindeki kritik depremler için özel uyarılar gönderilir',
            criticalDistanceInput,
            handleCriticalDistanceChange,
            '100',
            'numeric',
            'km'
          )}
        </View>

        {/* Erken Uyarı Ayarları */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Erken Uyarı Sistemi</Text>
          
          {renderSettingRow(
            'warning',
            'Erken Uyarı',
            'Deprem erken uyarı bildirimleri',
            <Switch
              value={eewEnabled}
              onValueChange={handleEewToggle}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />
          )}

          {eewEnabled && (
            <>
              {renderInputRow(
                'pulse',
                'EEW Minimum Büyüklük',
                'Erken uyarı için minimum deprem büyüklüğü',
                eewMagnitudeInput,
                handleEewMagnitudeChange,
                '3.5',
                'numeric',
                'M'
              )}

              {renderInputRow(
                'time',
                'Uyarı Süresi',
                'Depremden kaç saniye önce uyarı verilecek',
                eewTimeInput,
                handleEewTimeChange,
                '10',
                'numeric',
                'sn'
              )}
            </>
          )}
        </View>

        {/* Sensör Ayarları */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sensör Tabanlı Algılama</Text>
          
          {renderSettingRow(
            'phone-portrait',
            'Sensör Algılama',
            'Telefon sensörleri ile deprem algılama',
            <Switch
              value={seismicSensorEnabled}
              onValueChange={handleSensorToggle}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />
          )}

          {seismicSensorEnabled && (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name="settings" size={24} color={colors.brand.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Hassasiyet Seviyesi</Text>
                  <Text style={styles.settingSubtitle}>Sensör hassasiyeti ayarı</Text>
                </View>
                <View style={styles.priorityContainer}>
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <Pressable
                      key={level}
                      style={[
                        styles.priorityChip,
                        sensorSensitivity === level && styles.priorityChipActive,
                      ]}
                      onPress={() => {
                        haptics.impactLight();
                        setSensorSensitivity(level);
                      }}
                    >
                      <Text
                        style={[
                          styles.priorityChipText,
                          sensorSensitivity === level && styles.priorityChipTextActive,
                        ]}
                      >
                        {level === 'low' ? 'Düşük' :
                         level === 'medium' ? 'Orta' :
                         level === 'high' ? 'Yüksek' : level}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {renderSettingRow(
                'filter',
                'False Positive Filtreleme',
                'Yanlış pozitif algılamaları filtrele',
                <Switch
                  value={sensorFalsePositiveFilter}
                  onValueChange={(value) => {
                    haptics.impactLight();
                    setSensorFalsePositiveFilter(value);
                  }}
                  trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
                />
              )}
            </>
          )}
        </View>

        {/* Kaynak Seçimi */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Veri Kaynakları</Text>
          
          {renderSettingRow(
            'globe',
            'AFAD',
            'Türkiye deprem verileri',
            <Switch
              value={sourceAFAD}
              onValueChange={(value) => {
                haptics.impactLight();
                setSourceAFAD(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />
          )}

          {renderSettingRow(
            'globe-outline',
            'USGS',
            'Global deprem verileri',
            <Switch
              value={sourceUSGS}
              onValueChange={(value) => {
                haptics.impactLight();
                setSourceUSGS(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />
          )}

          {renderSettingRow(
            'globe-outline',
            'EMSC',
            'Avrupa deprem verileri',
            <Switch
              value={sourceEMSC}
              onValueChange={(value) => {
                haptics.impactLight();
                setSourceEMSC(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />
          )}

          {renderSettingRow(
            'globe-outline',
            'KOERI',
            'Kandilli deprem verileri',
            <Switch
              value={sourceKOERI}
              onValueChange={(value) => {
                haptics.impactLight();
                setSourceKOERI(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />
          )}

          {renderSettingRow(
            'people',
            'Community/Sensor',
            'Topluluk ve sensör algılamaları',
            <Switch
              value={sourceCommunity}
              onValueChange={(value) => {
                haptics.impactLight();
                setSourceCommunity(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />
          )}
        </View>

        {/* Bildirim Türleri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirim Türleri</Text>
          
          {renderSettingRow(
            'notifications',
            'Push Bildirim',
            'Standart push bildirimleri',
            <Switch
              value={notificationPush}
              onValueChange={(value) => {
                haptics.impactLight();
                setNotificationPush(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />
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
            />
          )}

          {renderSettingRow(
            'volume-high',
            'Alarm Sesi',
            'Sesli uyarılar',
            <Switch
              value={notificationSound}
              onValueChange={(value) => {
                haptics.impactLight();
                setNotificationSound(value);
              }}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
            />
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
            />
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
            />
          )}
        </View>

        {/* Öncelik Ayarları */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirim Öncelikleri</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="alert-circle" size={24} color={colors.status.danger} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Kritik Depremler ({criticalMagnitudeThreshold.toFixed(1)}+ M)</Text>
              <Text style={styles.settingSubtitle}>Kritik büyüklükteki depremler için öncelik</Text>
            </View>
          </View>
          {renderPrioritySelector('critical', priorityCritical, ['critical', 'high', 'normal'])}

          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="warning" size={24} color={colors.status.warning} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Büyük Depremler (5.0-6.0 M)</Text>
              <Text style={styles.settingSubtitle}>Büyük depremler için öncelik</Text>
            </View>
          </View>
          {renderPrioritySelector('high', priorityHigh, ['critical', 'high', 'normal'])}

          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="information-circle" size={24} color={colors.status.info} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Orta Depremler (4.0-5.0 M)</Text>
              <Text style={styles.settingSubtitle}>Orta büyüklükteki depremler için öncelik</Text>
            </View>
          </View>
          {renderPrioritySelector('medium', priorityMedium, ['high', 'normal', 'low'])}

          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Küçük Depremler (3.0-4.0 M)</Text>
              <Text style={styles.settingSubtitle}>Küçük depremler için öncelik</Text>
            </View>
          </View>
          {renderPrioritySelector('low', priorityLow, ['normal', 'low'])}
        </View>

        {/* Bilgi Kartı */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.status.info} />
          <Text style={styles.infoText}>
            Bu ayarlar deprem bildirimlerinizi özelleştirmenizi sağlar. 
            Minimum büyüklük ve mesafe filtreleri ile sadece ilgilendiğiniz depremler için bildirim alabilirsiniz.
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    paddingHorizontal: 12,
    minWidth: 100,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    paddingVertical: 8,
    textAlign: 'right',
  },
  inputSuffix: {
    fontSize: 13,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  priorityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  priorityChipActive: {
    backgroundColor: colors.brand.primary + '20',
    borderColor: colors.brand.primary,
  },
  priorityChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  priorityChipTextActive: {
    color: colors.brand.primary,
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
});

