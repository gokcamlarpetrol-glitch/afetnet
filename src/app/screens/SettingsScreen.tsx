import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Slider,
  Platform,
  Linking,
} from 'react-native';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useI18n } from '../../hooks/useI18n';
import { EEWManager } from '../../core/logic/eew';
import { EEWFilter } from '../../core/eew/filter';
import { EEWAlarmManager } from '../../core/audio/alarm';
import { AlertSheet } from '../components/eew/AlertSheet';
import { EEWClusterAlertEvent, EEWOfficialAlertEvent } from '../../core/utils/events';
import { DataDeletionManager } from '../../core/data/deletion';
import { SupportScreen } from './SupportScreen';

export const SettingsScreen: React.FC = () => {
  const { t } = useI18n();
  const [eewConfig, setEewConfig] = useState<any>({});
  const [filterConfig, setFilterConfig] = useState<any>({});
  const [alarmConfig, setAlarmConfig] = useState<any>({});
  const [showTestAlert, setShowTestAlert] = useState(false);
  const [testAlertData, setTestAlertData] = useState<EEWClusterAlertEvent | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const [dataSummary, setDataSummary] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const eewManager = EEWManager.getInstance();
  const eewFilter = EEWFilter.getInstance();
  const alarmManager = EEWAlarmManager.getInstance();
  const dataDeletionManager = DataDeletionManager.getInstance();

  useEffect(() => {
    loadConfigs();
    loadDataSummary();
  }, []);

  const loadConfigs = async () => {
    try {
      const eew = eewManager.getConfig();
      const filter = eewFilter.getConfig();
      const alarm = alarmManager.getConfig();
      
      setEewConfig(eew);
      setFilterConfig(filter);
      setAlarmConfig(alarm);
    } catch (error) {
      console.error('Failed to load EEW configs:', error);
    }
  };

  const updateEewConfig = async (updates: any) => {
    try {
      await eewManager.updateConfig(updates);
      setEewConfig({ ...eewConfig, ...updates });
    } catch (error) {
      console.error('Failed to update EEW config:', error);
    }
  };

  const updateFilterConfig = async (updates: any) => {
    try {
      await eewFilter.updateConfig(updates);
      setFilterConfig({ ...filterConfig, ...updates });
    } catch (error) {
      console.error('Failed to update filter config:', error);
    }
  };

  const updateAlarmConfig = (updates: any) => {
    alarmManager.updateConfig(updates);
    setAlarmConfig({ ...alarmConfig, ...updates });
  };

  const handleTestAlarm = async () => {
    try {
      await alarmManager.testAlarm();
      Alert.alert(
        t('eew.test_alarm'),
        t('eew.test_alarm_description'),
        [{ text: t('common.ok') }]
      );
    } catch (error) {
      console.error('Failed to test alarm:', error);
      Alert.alert(t('error.title'), t('eew.test_alarm_error'));
    }
  };

  const handleTestAlert = () => {
    const testAlert: EEWClusterAlertEvent = {
      timestamp: Date.now(),
      deviceCount: 6,
      avgStrength: 4.2,
      centerLat: 41.0082,
      centerLon: 28.9784,
      radius: 5.0,
      etaSeconds: 15,
      confidence: 'high',
    };
    
    setTestAlertData(testAlert);
    setShowTestAlert(true);
  };

  const loadDataSummary = async () => {
    try {
      const summary = await dataDeletionManager.getDataSummary();
      setDataSummary(summary);
    } catch (error) {
      console.error('Failed to load data summary:', error);
    }
  };

  const handleDeleteAllData = () => {
    DataDeletionManager.showDeletionConfirmation(
      async () => {
        setIsDeleting(true);
        try {
          const success = await dataDeletionManager.deleteAllData();
          if (success) {
            DataDeletionManager.showDeletionSuccess();
            await loadDataSummary(); // Refresh summary
          } else {
            DataDeletionManager.showDeletionError();
          }
        } catch (error) {
          console.error('Data deletion error:', error);
          DataDeletionManager.showDeletionError();
        } finally {
          setIsDeleting(false);
        }
      }
    );
  };

  const renderEEWSettings = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{t('eew.settings_title')}</Text>
      
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.enable_eew')}</Text>
        <Switch
          value={eewConfig.enabled}
          onValueChange={(value) => updateEewConfig({ enabled: value })}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={eewConfig.enabled ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.minimum_devices')}</Text>
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={2}
            maximumValue={10}
            value={eewConfig.k || 5}
            onValueChange={(value) => updateEewConfig({ k: Math.round(value) })}
            step={1}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#767577"
            thumbStyle={styles.sliderThumb}
          />
          <Text style={styles.sliderValue}>{eewConfig.k || 5}</Text>
        </View>
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.radius_km')}</Text>
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={20}
            value={eewConfig.radiusKm || 8}
            onValueChange={(value) => updateEewConfig({ radiusKm: Math.round(value) })}
            step={1}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#767577"
            thumbStyle={styles.sliderThumb}
          />
          <Text style={styles.sliderValue}>{eewConfig.radiusKm || 8} km</Text>
        </View>
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.time_window_sec')}</Text>
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={2}
            maximumValue={10}
            value={eewConfig.windowSec || 5}
            onValueChange={(value) => updateEewConfig({ windowSec: Math.round(value) })}
            step={1}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#767577"
            thumbStyle={styles.sliderThumb}
          />
          <Text style={styles.sliderValue}>{eewConfig.windowSec || 5} sec</Text>
        </View>
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.threshold')}</Text>
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={2.0}
            maximumValue={5.0}
            value={eewConfig.pThreshold || 3.0}
            onValueChange={(value) => updateEewConfig({ pThreshold: Math.round(value * 10) / 10 })}
            step={0.1}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#767577"
            thumbStyle={styles.sliderThumb}
          />
          <Text style={styles.sliderValue}>{eewConfig.pThreshold || 3.0}</Text>
        </View>
      </View>

      <Button
        title={t('eew.test_alarm')}
        onPress={handleTestAlarm}
        variant="secondary"
        style={styles.testButton}
      />

      <Button
        title={t('eew.test_alert')}
        onPress={handleTestAlert}
        variant="secondary"
        style={styles.testButton}
      />
    </Card>
  );

  const renderFilterSettings = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{t('eew.filter_settings')}</Text>
      
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.require_quorum')}</Text>
        <Switch
          value={filterConfig.requireQuorum}
          onValueChange={(value) => updateFilterConfig({ requireQuorum: value })}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={filterConfig.requireQuorum ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.require_official')}</Text>
        <Switch
          value={filterConfig.requireOfficial}
          onValueChange={(value) => updateFilterConfig({ requireOfficial: value })}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={filterConfig.requireOfficial ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.silent_prep')}</Text>
        <Switch
          value={filterConfig.silentPrepEnabled}
          onValueChange={(value) => updateFilterConfig({ silentPrepEnabled: value })}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={filterConfig.silentPrepEnabled ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.device_cooldown_min')}</Text>
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={30}
            maximumValue={300}
            value={(filterConfig.deviceCooldownMs || 60000) / 1000}
            onValueChange={(value) => updateFilterConfig({ deviceCooldownMs: Math.round(value) * 1000 })}
            step={30}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#767577"
            thumbStyle={styles.sliderThumb}
          />
          <Text style={styles.sliderValue}>{Math.round((filterConfig.deviceCooldownMs || 60000) / 1000)} min</Text>
        </View>
      </View>
    </Card>
  );

  const renderAlarmSettings = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{t('eew.alarm_settings')}</Text>
      
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.alarm_enabled')}</Text>
        <Switch
          value={alarmConfig.enabled}
          onValueChange={(value) => updateAlarmConfig({ enabled: value })}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={alarmConfig.enabled ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.alarm_volume')}</Text>
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={alarmConfig.volume || 1.0}
            onValueChange={(value) => updateAlarmConfig({ volume: Math.round(value * 10) / 10 })}
            step={0.1}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#767577"
            thumbStyle={styles.sliderThumb}
          />
          <Text style={styles.sliderValue}>{Math.round((alarmConfig.volume || 1.0) * 100)}%</Text>
        </View>
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.alarm_duration_sec')}</Text>
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={5}
            maximumValue={30}
            value={alarmConfig.duration || 10}
            onValueChange={(value) => updateAlarmConfig({ duration: Math.round(value) })}
            step={1}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#767577"
            thumbStyle={styles.sliderThumb}
          />
          <Text style={styles.sliderValue}>{alarmConfig.duration || 10} sec</Text>
        </View>
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{t('eew.alarm_repeat')}</Text>
        <Switch
          value={alarmConfig.repeat}
          onValueChange={(value) => updateAlarmConfig({ repeat: value })}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={alarmConfig.repeat ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>
    </Card>
  );

  const renderLegalNotice = () => (
    <Card style={styles.section}>
      <Text style={styles.legalTitle}>{t('eew.legal_notice')}</Text>
      <Text style={styles.legalText}>{t('eew.legal_disclaimer')}</Text>
      <Text style={styles.legalText}>{t('eew.experimental_warning')}</Text>
    </Card>
  );

  const renderDataManagement = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.data_management')}</Text>
      
      {dataSummary && (
        <View style={styles.dataSummary}>
          <Text style={styles.dataSummaryTitle}>{t('settings.data_summary')}</Text>
          <Text style={styles.dataSummaryText}>
            {t('settings.help_requests')}: {dataSummary.helpRequests}{'\n'}
            {t('settings.resource_posts')}: {dataSummary.resourcePosts}{'\n'}
            {t('settings.damage_reports')}: {dataSummary.damageReports}{'\n'}
            {t('settings.family_members')}: {dataSummary.familyMembers}{'\n'}
            {t('settings.total_size')}: {dataSummary.totalSize}
          </Text>
        </View>
      )}

      <Button
        title={t('settings.delete_all_data')}
        onPress={handleDeleteAllData}
        loading={isDeleting}
        variant="destructive"
        style={styles.deleteButton}
      />
    </Card>
  );

  const renderAboutSection = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
      
      <TouchableOpacity
        style={styles.aboutLink}
        onPress={() => setShowSupport(true)}
      >
        <Text style={styles.aboutLinkText}>{t('settings.support')}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.aboutLink}
        onPress={() => Linking.openURL('https://example.com/afetnet/privacy.en.html')}
      >
        <Text style={styles.aboutLinkText}>{t('settings.privacy_policy')}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.aboutLink}
        onPress={() => Linking.openURL('https://example.com/afetnet/terms.en.html')}
      >
        <Text style={styles.aboutLinkText}>{t('settings.terms_of_use')}</Text>
      </TouchableOpacity>
      
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>
          {t('settings.app_version')}: 1.0.0{'\n'}
          {t('settings.build_number')}: 1{'\n'}
          {t('settings.platform')}: {Platform.OS} {Platform.Version}
        </Text>
      </View>
    </Card>
  );

  if (showSupport) {
    return <SupportScreen onClose={() => setShowSupport(false)} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('settings.title')}</Text>
      
      {renderEEWSettings()}
      {renderFilterSettings()}
      {renderAlarmSettings()}
      {renderDataManagement()}
      {renderAboutSection()}
      {renderLegalNotice()}

      <AlertSheet
        visible={showTestAlert}
        onClose={() => setShowTestAlert(false)}
        alertData={testAlertData}
        isTestMode={true}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  sliderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    backgroundColor: '#007AFF',
  },
  sliderValue: {
    fontSize: 14,
    color: '#666',
    minWidth: 50,
    textAlign: 'right',
    marginLeft: 8,
  },
  testButton: {
    marginTop: 12,
  },
  legalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  legalText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  dataSummary: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  dataSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  dataSummaryText: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 20,
  },
  deleteButton: {
    marginTop: 8,
    backgroundColor: '#e74c3c',
  },
  aboutLink: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
  },
  aboutLinkText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  appInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
  },
  appInfoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
});