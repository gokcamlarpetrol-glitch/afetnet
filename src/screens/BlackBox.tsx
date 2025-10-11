import React, { useState, useEffect } from 'react';
import { logger } from '../utils/productionLogger';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { useDevLog } from '../store/devlog';
import { encryptAndExportLogs, getExportableLogs } from '../blackbox/crypto';
import { LogEvent } from '../store/devlog';

export default function BlackBox() {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  
  const { getEvents, exportEvents } = useDevLog();

  useEffect(() => {
    loadEvents();
  }, [filter]);

  const loadEvents = () => {
    const filteredEvents = getEvents(filter);
    setEvents(filteredEvents.slice(-100)); // Show last 100 events
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const allEvents = exportEvents();
      if (allEvents.length === 0) {
        Alert.alert('Uyarı', 'Dışa aktarılacak günlük bulunamadı');
        return;
      }

      const exportResult = await encryptAndExportLogs(allEvents);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(exportResult.filePath, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'Kara Kutu Günlükleri Dışa Aktar',
          UTI: 'com.afetnet.blackbox'
        });
        
        Alert.alert(
          'Dışa Aktarım Tamamlandı',
          `Günlükler şifrelenerek dışa aktarıldı.\n\nDosya: ${exportResult.fileName}\nOturum Anahtarı: ${exportResult.sessionKey.slice(0, 16)}...`,
          [{ text: 'Tamam' }]
        );
      } else {
        Alert.alert('Hata', 'Paylaşım özelliği kullanılamıyor');
      }

    } catch (error) {
      logger.error('Export failed:', error);
      Alert.alert('Hata', 'Dışa aktarım başarısız');
    } finally {
      setIsExporting(false);
    }
  };

  const getFilterButtons = () => [
    { key: '', label: 'Tümü' },
    { key: 'SOS', label: 'SOS' },
    { key: 'RELAY', label: 'Relay' },
    { key: 'MISSION', label: 'Görev' },
    { key: 'ERROR', label: 'Hata' }
  ];

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getEventColor = (tag: string) => {
    if (tag.includes('SOS')) return '#ef4444';
    if (tag.includes('ERROR')) return '#f59e0b';
    if (tag.includes('RELAY')) return '#3b82f6';
    if (tag.includes('MISSION')) return '#10b981';
    return '#6b7280';
  };

  const renderEvent = ({ item }: { item: LogEvent }) => (
    <View style={styles.eventItem}>
      <View style={styles.eventHeader}>
        <View style={[styles.tagBadge, { backgroundColor: getEventColor(item.tag) }]}>
          <Text style={styles.tagText}>{item.tag}</Text>
        </View>
        <Text style={styles.timestamp}>{formatTimestamp(item.ts)}</Text>
      </View>
      
      {item.data && (
        <Text style={styles.eventData}>
          {typeof item.data === 'string' ? item.data : JSON.stringify(item.data, null, 2)}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kara Kutu Günlükleri</Text>
      
      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {getFilterButtons().map((button) => (
          <Pressable accessible={true}
          accessibilityRole="button"
            key={button.key}
            onPress={() => setFilter(button.key)}
            style={[
              styles.filterButton,
              filter === button.key && styles.filterButtonActive
            ]}
          >
            <Text style={[
              styles.filterButtonText,
              filter === button.key && styles.filterButtonTextActive
            ]}>
              {button.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Event Count */}
      <Text style={styles.eventCount}>
        {events.length} günlük gösteriliyor
      </Text>

      {/* Events List */}
      <FlatList
        data={events}
        renderItem={renderEvent}
        keyExtractor={(item, index) => `${item.ts}-${index}`}
        style={styles.eventsList}
        inverted
        showsVerticalScrollIndicator={false}
      />

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Pressable accessible={true}
          accessibilityRole="button"
          onPress={handleExport}
          disabled={isExporting || events.length === 0}
          style={[
            styles.exportButton,
            (isExporting || events.length === 0) && styles.exportButtonDisabled
          ]}
        >
          <Text style={styles.exportButtonText}>
            {isExporting ? 'Dışa Aktarılıyor...' : 'Dışa Aktar (Şifreli)'}
          </Text>
        </Pressable>

        <Pressable accessible={true}
          accessibilityRole="button"
          onPress={() => Alert.alert('Yakında', 'QR ile paylaşım özelliği yakında eklenecek')}
          style={styles.qrButton}
        >
          <Text style={styles.qrButtonText}>QR ile Paylaş (yakında)</Text>
        </Pressable>
      </View>

      {/* Info Text */}
      <Text style={styles.infoText}>
        • Günlükler yerel olarak şifrelenir{'\n'}
        • Son 1000 olay saklanır{'\n'}
        • Dışa aktarım oturum anahtarı ile şifrelenir
      </Text>
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
    marginBottom: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  eventCount: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12,
  },
  eventsList: {
    flex: 1,
    marginBottom: 16,
  },
  eventItem: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#374151',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  timestamp: {
    color: '#94a3b8',
    fontSize: 12,
  },
  eventData: {
    color: '#e5e7eb',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  actionContainer: {
    gap: 12,
    marginBottom: 16,
  },
  exportButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportButtonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  qrButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
