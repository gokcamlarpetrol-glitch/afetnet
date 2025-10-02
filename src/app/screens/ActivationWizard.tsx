import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { PreferencesManager } from '../../core/storage/prefs';
import { RemoteConfigManager } from '../../core/remoteconfig/manager';
import { TilesUpdater } from '../../core/offline/tiles-updater';
import { PushNotificationManager } from '../../core/notify/push';
import { EEWFeedManager } from '../../core/eew/feeds';
import { BackendManager } from '../../core/backend/manager';
import { TelemetryManager } from '../../core/telemetry/manager';

interface WizardConfig {
  remoteConfig: {
    url: string;
    lastUpdated?: string;
  };
  tiles: {
    url: string;
    version: string;
    sha256: string;
    downloadProgress?: number;
    isDownloading?: boolean;
  };
  push: {
    fcmSenderId: string;
    fcmAppId: string;
    fcmApiKey: string;
    fcmProjectId: string;
    apnsTeamId: string;
    apnsKeyId: string;
    topics: string[];
  };
  eewFeeds: {
    name: string;
    url: string;
    type: 'json' | 'xml';
    pathMapping: {
      lat: string;
      lon: string;
      mag: string;
      origin: string;
      id: string;
    };
    signature?: {
      header: string;
      publicKeyPem: string;
    };
    etaCutoffSec: number;
  }[];
  backend: {
    apiBaseUrl: string;
    wsUrl: string;
  };
  telemetry: {
    enabled: boolean;
  };
}

const DISTRICTS = [
  'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
  'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
  'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
  'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
  'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
  'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
  'Ümraniye', 'Üsküdar', 'Zeytinburnu'
];

export const ActivationWizard: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<WizardConfig>({
    remoteConfig: { url: '' },
    tiles: { url: '', version: '', sha256: '' },
    push: {
      fcmSenderId: '',
      fcmAppId: '',
      fcmApiKey: '',
      fcmProjectId: '',
      apnsTeamId: '',
      apnsKeyId: '',
      topics: [],
    },
    eewFeeds: [],
    backend: { apiBaseUrl: '', wsUrl: '' },
    telemetry: { enabled: false },
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const prefs = PreferencesManager.getInstance();
  const remoteConfig = RemoteConfigManager.getInstance();
  const tilesUpdater = TilesUpdater.getInstance();
  const pushManager = PushNotificationManager.getInstance();
  const eewFeedManager = EEWFeedManager.getInstance();
  const backendManager = BackendManager.getInstance();
  const telemetryManager = TelemetryManager.getInstance();

  useEffect(() => {
    loadStoredConfig();
  }, []);

  const loadStoredConfig = async () => {
    try {
      const stored = await prefs.get('activationWizardConfig');
      if (stored) {
        setConfig(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load stored config:', error);
    }
  };

  const saveConfig = async (newConfig: Partial<WizardConfig>) => {
    try {
      const updated = { ...config, ...newConfig };
      setConfig(updated);
      await prefs.set('activationWizardConfig', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const setLoadingState = (key: string, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [key]: isLoading }));
  };

  const showSuccess = (message: string) => {
    Toast.show({
      type: 'success',
      text1: t('activation.success'),
      text2: message,
    });
  };

  const showError = (message: string) => {
    Toast.show({
      type: 'error',
      text1: t('activation.error'),
      text2: message,
    });
  };

  // Remote Config Section
  const handleLoadRemoteConfig = async () => {
    if (!config.remoteConfig.url) {
      showError(t('activation.remoteConfig.urlRequired'));
      return;
    }

    setLoadingState('remoteConfig', true);
    try {
      const result = await remoteConfig.fetchRemoteConfig(config.remoteConfig.url);
      if (result.success) {
        await saveConfig({
          remoteConfig: {
            ...config.remoteConfig,
            lastUpdated: new Date().toISOString(),
          },
        });
        showSuccess(t('activation.remoteConfig.loadSuccess'));
      } else {
        showError(result.error || t('activation.remoteConfig.loadError'));
      }
    } catch (error) {
      showError(t('activation.remoteConfig.loadError'));
    } finally {
      setLoadingState('remoteConfig', false);
    }
  };

  // OTA Tiles Section
  const handleDownloadTiles = async () => {
    if (!config.tiles.url || !config.tiles.version || !config.tiles.sha256) {
      showError(t('activation.tiles.missingFields'));
      return;
    }

    setLoadingState('tiles', true);
    try {
      await tilesUpdater.downloadTiles(
        config.tiles.url,
        config.tiles.version,
        config.tiles.sha256,
        (progress) => {
          saveConfig({
            tiles: {
              ...config.tiles,
              downloadProgress: progress,
              isDownloading: true,
            },
          });
        }
      );

      await tilesUpdater.installTiles(config.tiles.version);
      await saveConfig({
        tiles: {
          ...config.tiles,
          downloadProgress: 100,
          isDownloading: false,
        },
      });
      showSuccess(t('activation.tiles.downloadSuccess'));
    } catch (error) {
      showError(t('activation.tiles.downloadError'));
    } finally {
      setLoadingState('tiles', false);
    }
  };

  const handleVerifyTiles = async () => {
    if (!config.tiles.sha256) {
      showError(t('activation.tiles.sha256Required'));
      return;
    }

    setLoadingState('verifyTiles', true);
    try {
      const isValid = await tilesUpdater.verifyFileSHA256(config.tiles.sha256);
      if (isValid) {
        showSuccess(t('activation.tiles.verifySuccess'));
      } else {
        showError(t('activation.tiles.verifyError'));
      }
    } catch (error) {
      showError(t('activation.tiles.verifyError'));
    } finally {
      setLoadingState('verifyTiles', false);
    }
  };

  // Push Notifications Section
  const handleSubscribeTopics = async () => {
    if (config.push.topics.length === 0) {
      showError(t('activation.push.topicsRequired'));
      return;
    }

    setLoadingState('push', true);
    try {
      await pushManager.initPush({
        fcmSenderId: config.push.fcmSenderId,
        fcmAppId: config.push.fcmAppId,
        fcmApiKey: config.push.fcmApiKey,
        fcmProjectId: config.push.fcmProjectId,
        apnsTeamId: config.push.apnsTeamId,
        apnsKeyId: config.push.apnsKeyId,
      });

      await pushManager.subscribeTopics(config.push.topics);
      showSuccess(t('activation.push.subscribeSuccess'));
    } catch (error) {
      showError(t('activation.push.subscribeError'));
    } finally {
      setLoadingState('push', false);
    }
  };

  const handleTestLocalNotification = async () => {
    try {
      await pushManager.showLocalNotification(
        t('activation.push.testTitle'),
        t('activation.push.testBody')
      );
      showSuccess(t('activation.push.testSuccess'));
    } catch (error) {
      showError(t('activation.push.testError'));
    }
  };

  // EEW Feeds Section
  const handleSaveFeedAdapter = async () => {
    const feed = config.eewFeeds[config.eewFeeds.length - 1];
    if (!feed || !feed.name || !feed.url) {
      showError(t('activation.eewFeeds.missingFields'));
      return;
    }

    try {
      await eewFeedManager.registerFeedAdapter(feed);
      showSuccess(t('activation.eewFeeds.saveSuccess'));
    } catch (error) {
      showError(t('activation.eewFeeds.saveError'));
    }
  };

  const handleTestParse = async () => {
    const feed = config.eewFeeds[config.eewFeeds.length - 1];
    if (!feed) {
      showError(t('activation.eewFeeds.noFeed'));
      return;
    }

    setLoadingState('testParse', true);
    try {
      await eewFeedManager.testParse(feed);
      showSuccess(t('activation.eewFeeds.testSuccess'));
    } catch (error) {
      showError(t('activation.eewFeeds.testError'));
    } finally {
      setLoadingState('testParse', false);
    }
  };

  // Backend Section
  const handlePingBackend = async () => {
    if (!config.backend.apiBaseUrl) {
      showError(t('activation.backend.urlRequired'));
      return;
    }

    setLoadingState('backend', true);
    try {
      const isHealthy = await backendManager.ping(config.backend.apiBaseUrl);
      if (isHealthy) {
        showSuccess(t('activation.backend.pingSuccess'));
      } else {
        showError(t('activation.backend.pingError'));
      }
    } catch (error) {
      showError(t('activation.backend.pingError'));
    } finally {
      setLoadingState('backend', false);
    }
  };

  const handleTestWebSocket = async () => {
    if (!config.backend.wsUrl) {
      showError(t('activation.backend.wsUrlRequired'));
      return;
    }

    setLoadingState('websocket', true);
    try {
      const connected = await backendManager.testWebSocket(config.backend.wsUrl);
      if (connected) {
        showSuccess(t('activation.backend.wsTestSuccess'));
      } else {
        showError(t('activation.backend.wsTestError'));
      }
    } catch (error) {
      showError(t('activation.backend.wsTestError'));
    } finally {
      setLoadingState('websocket', false);
    }
  };

  // Telemetry Section
  const handleSendTestPing = async () => {
    try {
      await telemetryManager.sendTestPing();
      showSuccess(t('activation.telemetry.testSuccess'));
    } catch (error) {
      showError(t('activation.telemetry.testError'));
    }
  };

  const addEEWFeed = () => {
    const newFeed = {
      name: '',
      url: '',
      type: 'json' as const,
      pathMapping: {
        lat: 'geometry.coordinates[1]',
        lon: 'geometry.coordinates[0]',
        mag: 'properties.mag',
        origin: 'properties.time',
        id: 'id',
      },
      etaCutoffSec: 25,
    };
    saveConfig({
      eewFeeds: [...config.eewFeeds, newFeed],
    });
  };

  const removeEEWFeed = (index: number) => {
    const updated = config.eewFeeds.filter((_, i) => i !== index);
    saveConfig({ eewFeeds: updated });
  };

  const toggleTopic = (topic: string) => {
    const topics = config.push.topics.includes(topic)
      ? config.push.topics.filter(t => t !== topic)
      : [...config.push.topics, topic];
    saveConfig({ push: { ...config.push, topics } });
  };

  const renderSection = (title: string, key: string, children: React.ReactNode) => (
    <Card style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setActiveSection(activeSection === key ? null : key)}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionToggle}>
          {activeSection === key ? '−' : '+'}
        </Text>
      </TouchableOpacity>
      {activeSection === key && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('activation.title')}</Text>
        <Text style={styles.subtitle}>{t('activation.subtitle')}</Text>

        {renderSection(t('activation.remoteConfig.title'), 'remoteConfig', (
          <View style={styles.sectionContent}>
            <Text style={styles.helpText}>{t('activation.remoteConfig.help')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('activation.remoteConfig.urlPlaceholder')}
              value={config.remoteConfig.url}
              onChangeText={(url) => saveConfig({ remoteConfig: { ...config.remoteConfig, url } })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {config.remoteConfig.lastUpdated && (
              <Text style={styles.lastUpdated}>
                {t('activation.remoteConfig.lastUpdated')}: {new Date(config.remoteConfig.lastUpdated).toLocaleString()}
              </Text>
            )}
            <Button
              title={t('activation.remoteConfig.load')}
              onPress={handleLoadRemoteConfig}
              loading={loading.remoteConfig}
              style={styles.testButton}
            />
          </View>
        ))}

        {renderSection(t('activation.tiles.title'), 'tiles', (
          <View style={styles.sectionContent}>
            <Text style={styles.helpText}>{t('activation.tiles.help')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('activation.tiles.urlPlaceholder')}
              value={config.tiles.url}
              onChangeText={(url) => saveConfig({ tiles: { ...config.tiles, url } })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder={t('activation.tiles.versionPlaceholder')}
              value={config.tiles.version}
              onChangeText={(version) => saveConfig({ tiles: { ...config.tiles, version } })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder={t('activation.tiles.sha256Placeholder')}
              value={config.tiles.sha256}
              onChangeText={(sha256) => saveConfig({ tiles: { ...config.tiles, sha256 } })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {config.tiles.isDownloading && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  {t('activation.tiles.downloading')}: {config.tiles.downloadProgress || 0}%
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${config.tiles.downloadProgress || 0}%` }]} />
                </View>
              </View>
            )}
            <View style={styles.buttonRow}>
              <Button
                title={t('activation.tiles.download')}
                onPress={handleDownloadTiles}
                loading={loading.tiles}
                style={styles.testButton}
              />
              <Button
                title={t('activation.tiles.verify')}
                onPress={handleVerifyTiles}
                loading={loading.verifyTiles}
                variant="secondary"
                style={styles.testButton}
              />
            </View>
          </View>
        ))}

        {renderSection(t('activation.push.title'), 'push', (
          <View style={styles.sectionContent}>
            <Text style={styles.helpText}>{t('activation.push.help')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('activation.push.fcmSenderIdPlaceholder')}
              value={config.push.fcmSenderId}
              onChangeText={(fcmSenderId) => saveConfig({ push: { ...config.push, fcmSenderId } })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder={t('activation.push.fcmAppIdPlaceholder')}
              value={config.push.fcmAppId}
              onChangeText={(fcmAppId) => saveConfig({ push: { ...config.push, fcmAppId } })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder={t('activation.push.fcmApiKeyPlaceholder')}
              value={config.push.fcmApiKey}
              onChangeText={(fcmApiKey) => saveConfig({ push: { ...config.push, fcmApiKey } })}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder={t('activation.push.fcmProjectIdPlaceholder')}
              value={config.push.fcmProjectId}
              onChangeText={(fcmProjectId) => saveConfig({ push: { ...config.push, fcmProjectId } })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {Platform.OS === 'ios' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder={t('activation.push.apnsTeamIdPlaceholder')}
                  value={config.push.apnsTeamId}
                  onChangeText={(apnsTeamId) => saveConfig({ push: { ...config.push, apnsTeamId } })}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('activation.push.apnsKeyIdPlaceholder')}
                  value={config.push.apnsKeyId}
                  onChangeText={(apnsKeyId) => saveConfig({ push: { ...config.push, apnsKeyId } })}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}
            <Text style={styles.subsectionTitle}>{t('activation.push.topicsTitle')}</Text>
            <View style={styles.topicsContainer}>
              {DISTRICTS.map((district) => (
                <TouchableOpacity
                  key={district}
                  style={[
                    styles.topicChip,
                    config.push.topics.includes(district) && styles.topicChipSelected,
                  ]}
                  onPress={() => toggleTopic(district)}
                >
                  <Text
                    style={[
                      styles.topicChipText,
                      config.push.topics.includes(district) && styles.topicChipTextSelected,
                    ]}
                  >
                    {district}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.buttonRow}>
              <Button
                title={t('activation.push.subscribe')}
                onPress={handleSubscribeTopics}
                loading={loading.push}
                style={styles.testButton}
              />
              <Button
                title={t('activation.push.testLocal')}
                onPress={handleTestLocalNotification}
                variant="secondary"
                style={styles.testButton}
              />
            </View>
          </View>
        ))}

        {renderSection(t('activation.eewFeeds.title'), 'eewFeeds', (
          <View style={styles.sectionContent}>
            <Text style={styles.helpText}>{t('activation.eewFeeds.help')}</Text>
            {config.eewFeeds.map((feed, index) => (
              <View key={index} style={styles.feedAdapter}>
                <View style={styles.feedHeader}>
                  <Text style={styles.feedTitle}>{t('activation.eewFeeds.feed')} {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeEEWFeed(index)}>
                    <Text style={styles.removeButton}>×</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={t('activation.eewFeeds.namePlaceholder')}
                  value={feed.name}
                  onChangeText={(name) => {
                    const updated = [...config.eewFeeds];
                    updated[index] = { ...feed, name };
                    saveConfig({ eewFeeds: updated });
                  }}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('activation.eewFeeds.urlPlaceholder')}
                  value={feed.url}
                  onChangeText={(url) => {
                    const updated = [...config.eewFeeds];
                    updated[index] = { ...feed, url };
                    saveConfig({ eewFeeds: updated });
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('activation.eewFeeds.etaCutoffPlaceholder')}
                  value={feed.etaCutoffSec.toString()}
                  onChangeText={(etaCutoffSec) => {
                    const updated = [...config.eewFeeds];
                    updated[index] = { ...feed, etaCutoffSec: parseInt(etaCutoffSec) || 25 };
                    saveConfig({ eewFeeds: updated });
                  }}
                  keyboardType="numeric"
                />
              </View>
            ))}
            <Button
              title={t('activation.eewFeeds.addFeed')}
              onPress={addEEWFeed}
              variant="secondary"
              style={styles.addButton}
            />
            <View style={styles.buttonRow}>
              <Button
                title={t('activation.eewFeeds.saveAdapter')}
                onPress={handleSaveFeedAdapter}
                style={styles.testButton}
              />
              <Button
                title={t('activation.eewFeeds.testParse')}
                onPress={handleTestParse}
                loading={loading.testParse}
                variant="secondary"
                style={styles.testButton}
              />
            </View>
          </View>
        ))}

        {renderSection(t('activation.backend.title'), 'backend', (
          <View style={styles.sectionContent}>
            <Text style={styles.helpText}>{t('activation.backend.help')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('activation.backend.apiUrlPlaceholder')}
              value={config.backend.apiBaseUrl}
              onChangeText={(apiBaseUrl) => saveConfig({ backend: { ...config.backend, apiBaseUrl } })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder={t('activation.backend.wsUrlPlaceholder')}
              value={config.backend.wsUrl}
              onChangeText={(wsUrl) => saveConfig({ backend: { ...config.backend, wsUrl } })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.buttonRow}>
              <Button
                title={t('activation.backend.ping')}
                onPress={handlePingBackend}
                loading={loading.backend}
                style={styles.testButton}
              />
              <Button
                title={t('activation.backend.testWs')}
                onPress={handleTestWebSocket}
                loading={loading.websocket}
                variant="secondary"
                style={styles.testButton}
              />
            </View>
          </View>
        ))}

        {renderSection(t('activation.telemetry.title'), 'telemetry', (
          <View style={styles.sectionContent}>
            <Text style={styles.helpText}>{t('activation.telemetry.help')}</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{t('activation.telemetry.enabled')}</Text>
              <TouchableOpacity
                style={[styles.toggle, config.telemetry.enabled && styles.toggleActive]}
                onPress={() => saveConfig({ telemetry: { enabled: !config.telemetry.enabled } })}
              >
                <View style={[styles.toggleThumb, config.telemetry.enabled && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
            <Button
              title={t('activation.telemetry.testPing')}
              onPress={handleSendTestPing}
              style={styles.testButton}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 32,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  sectionToggle: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  helpText: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderColor: '#444444',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  testButton: {
    flex: 1,
  },
  addButton: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  topicChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#444444',
  },
  topicChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  topicChipText: {
    fontSize: 12,
    color: '#ffffff',
  },
  topicChipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  feedAdapter: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  removeButton: {
    fontSize: 20,
    color: '#ff4444',
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
  },
  toggle: {
    width: 50,
    height: 30,
    backgroundColor: '#333333',
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#007AFF',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    backgroundColor: '#ffffff',
    borderRadius: 13,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
});

export default ActivationWizard;
