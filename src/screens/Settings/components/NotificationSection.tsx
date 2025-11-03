import { Ionicons } from '@expo/vector-icons';
import { Text, View, StyleSheet, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'afetnet/settings';

export const NotificationSection = () => {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [quakeAlertsEnabled, setQuakeAlertsEnabled] = useState(true);
  const [locationAlertsEnabled, setLocationAlertsEnabled] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      const settingsStr = await AsyncStorage.getItem(SETTINGS_KEY);
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        setPushEnabled(settings.pushEnabled ?? true);
        setSoundEnabled(settings.soundEnabled ?? true);
        setQuakeAlertsEnabled(settings.quakeAlertsEnabled ?? true);
        setLocationAlertsEnabled(settings.locationAlertsEnabled ?? true);
      }
    }
    loadSettings();
  }, []);

  async function updateSetting(key: string, value: boolean) {
    const settingsStr = await AsyncStorage.getItem(SETTINGS_KEY);
    const settings = settingsStr ? JSON.parse(settingsStr) : {};
    settings[key] = value;
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  return (
    <View style={styles.sectionContent}>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 16,
          }}>
            <Ionicons name="notifications" size={24} color="#ef4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Bildirim Ayarları</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
              Bildirim tercihlerinizi yönetin
            </Text>
          </View>
        </View>

        <View style={styles.settingButton}>
          <Ionicons name="notifications-outline" size={20} color="#ef4444" />
          <Text style={styles.settingButtonText}>Push Bildirimleri</Text>
          <Switch value={pushEnabled} onValueChange={v => { setPushEnabled(v); updateSetting('pushEnabled', v); }} />
        </View>

        <View style={styles.settingButton}>
          <Ionicons name="volume-high" size={20} color="#f59e0b" />
          <Text style={styles.settingButtonText}>Ses ve Titreşim</Text>
          <Switch value={soundEnabled} onValueChange={v => { setSoundEnabled(v); updateSetting('soundEnabled', v); }} />
        </View>

        <View style={styles.settingButton}>
          <Ionicons name="earth" size={20} color="#8b5cf6" />
          <Text style={styles.settingButtonText}>Deprem Uyarıları</Text>
          <Switch value={quakeAlertsEnabled} onValueChange={v => { setQuakeAlertsEnabled(v); updateSetting('quakeAlertsEnabled', v); }} />
        </View>

        <View style={styles.settingButton}>
          <Ionicons name="location" size={20} color="#10b981" />
          <Text style={styles.settingButtonText}>Konum Bildirimleri</Text>
          <Switch value={locationAlertsEnabled} onValueChange={v => { setLocationAlertsEnabled(v); updateSetting('locationAlertsEnabled', v); }} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContent: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    marginBottom: 12,
  },
  settingButtonText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 16,
    marginLeft: 12,
  },
});
