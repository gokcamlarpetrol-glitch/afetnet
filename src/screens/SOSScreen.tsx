import * as Battery from 'expo-battery';
import { logger } from '../utils/productionLogger';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { meshRelay } from '../services/mesh/relay';
import { logEvent } from '../store/devlog';
import { useEmergency } from '../store/emergency';
import { useIncidents } from '../store/incidents';

export default function SOSScreen() {
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  
  const { ultra, pulseMs } = useEmergency();
  const { upsertFromSOS } = useIncidents();

  const statusOptions = [
    '2 Kişiyiz',
    'Yaralı Var',
    'Kat: -1',
    'Acil Nefes Darlığı',
    'Sesimi Duyuyorsanız',
  ];

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status],
    );
  };

  const startSOS = async () => {
    try {
      setIsBroadcasting(true);

      // Get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Hata', 'Konum izni gerekli');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = location.coords.latitude;
      const lon = location.coords.longitude;

      // Check for critical low battery
      const batteryLevel = await Battery.getBatteryLevelAsync();
      if (ultra && batteryLevel < 0.03 && !selectedStatuses.includes('crit-low-power')) {
        selectedStatuses.push('crit-low-power');
      }

      // Send SOS via mesh relay
      const msgId = await meshRelay.sendSOS(lat, lon, selectedStatuses);
      
      // Add to incidents store
      const sosMsg = {
        id: msgId,
        lat,
        lon,
        statuses: selectedStatuses,
        ts: Date.now(),
      };
      upsertFromSOS(sosMsg);
      
      // Log the event
      logEvent('SOS_START', { msgId, lat, lon, statuses: selectedStatuses, ultra });
      
      Alert.alert(
        'SOS Gönderildi',
        `SOS mesajı gönderildi (ID: ${msgId.slice(-6)}). Yakın cihazlara yayınlanıyor.`,
        [{ text: 'Tamam' }],
      );

    } catch (error) {
      logger.error('SOS send error:', error);
      Alert.alert('Hata', 'SOS gönderilemedi');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SOS Yardım Talebi</Text>
      
      <Pressable accessible={true}
        accessibilityRole="button"
        onPress={startSOS}
        disabled={isBroadcasting}
        style={[styles.sosButton, isBroadcasting && styles.sosButtonDisabled]}
      >
        <Text style={styles.sosButtonText}>
          🔴 YARDIM İSTE (SOS)
        </Text>
      </Pressable>

      {isBroadcasting && (
        <View style={styles.broadcastBanner}>
          <Text style={styles.broadcastText}>📡 Yayın aktif</Text>
          {ultra && (
            <Text style={styles.batteryTip}>
              🔋 Aşırı Pil Modu aktif — yayın nabız modunda ({pulseMs/1000}s)
            </Text>
          )}
          {!ultra && (
            <Text style={styles.batteryTip}>
              💡 Pil tasarrufu için gereksiz uygulamaları kapatın
            </Text>
          )}
        </View>
      )}

      <Text style={styles.statusLabel}>Durumunu Belirt:</Text>
      <View style={styles.statusContainer}>
        {statusOptions.map((status) => (
          <Pressable accessible={true}
            accessibilityRole="button"
            key={status}
            onPress={() => toggleStatus(status)}
            style={[
              styles.statusButton,
              selectedStatuses.includes(status) && styles.statusButtonSelected,
            ]}
          >
            <Text style={[
              styles.statusButtonText,
              selectedStatuses.includes(status) && styles.statusButtonTextSelected,
            ]}>
              {status}
            </Text>
          </Pressable>
        ))}
      </View>

      {selectedStatuses.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>Seçilen durumlar:</Text>
          {selectedStatuses.map((status, index) => (
            <Text key={index} style={styles.selectedStatus}>
              • {status}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
  },
  sosButton: {
    backgroundColor: '#ef4444',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sosButtonDisabled: {
    backgroundColor: '#7f1d1d',
    opacity: 0.7,
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  broadcastBanner: {
    backgroundColor: '#1e40af',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  broadcastText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  batteryTip: {
    color: '#e0e7ff',
    fontSize: 12,
    textAlign: 'center',
  },
  statusLabel: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statusButton: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statusButtonSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  statusButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  statusButtonTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  selectedContainer: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  selectedLabel: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectedStatus: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 2,
  },
});
