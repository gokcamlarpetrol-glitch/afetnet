import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Share } from 'react-native';
import { useOffMesh } from '../features/offmesh/useOffMesh';
import { PeerInfo, JournalEvent } from '../offmesh/types';

export default function OffMeshDiagnosticsScreen() {
  const {
    isRunning,
    stats,
    peers,
    recentEvents,
    exportJournal,
    clearData,
    getQosStatus,
    updateStats,
  } = useOffMesh();

  const [qosStatus, setQosStatus] = useState(getQosStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setQosStatus(getQosStatus());
      updateStats();
    }, 2000);

    return () => clearInterval(interval);
  }, [getQosStatus, updateStats]);

  const handleExportLog = async () => {
    try {
      const logData = await exportJournal();
      await Share.share({
        message: logData,
        title: 'AfetNet Mesh Diagnostics',
      });
    } catch (error) {
      Alert.alert('Hata', 'Log export edilemedi');
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Verileri Temizle',
      'Tüm mesh verileri silinecek. Devam etmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearData();
              Alert.alert('Başarılı', 'Veriler temizlendi');
            } catch (error) {
              Alert.alert('Hata', 'Veriler temizlenemedi');
            }
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>OffMesh Diagnostics</Text>

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Running</Text>
            <Text style={[styles.statusValue, { color: isRunning ? '#22c55e' : '#ef4444' }]}>
              {isRunning ? 'YES' : 'NO'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Peers</Text>
            <Text style={styles.statusValue}>{stats.peers}</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Queued</Text>
            <Text style={styles.statusValue}>{stats.queued}</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Dedup</Text>
            <Text style={styles.statusValue}>{stats.dedup}</Text>
          </View>
        </View>
      </View>

      {/* Battery & QoS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Battery & QoS</Text>
        <View style={styles.qosGrid}>
          <View style={styles.qosItem}>
            <Text style={styles.qosLabel}>Battery</Text>
            <Text style={[styles.qosValue, { color: qosStatus.batteryLevel > 20 ? '#22c55e' : '#ef4444' }]}>
              {qosStatus.batteryLevel}%
            </Text>
          </View>
          <View style={styles.qosItem}>
            <Text style={styles.qosLabel}>High Temp</Text>
            <Text style={[styles.qosValue, { color: qosStatus.isHighTemp ? '#ef4444' : '#22c55e' }]}>
              {qosStatus.isHighTemp ? 'YES' : 'NO'}
            </Text>
          </View>
          <View style={styles.qosItem}>
            <Text style={styles.qosLabel}>Mesh Active</Text>
            <Text style={[styles.qosValue, { color: qosStatus.canActivateMesh ? '#22c55e' : '#ef4444' }]}>
              {qosStatus.canActivateMesh ? 'YES' : 'NO'}
            </Text>
          </View>
        </View>
      </View>

      {/* Rate Limits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rate Limits</Text>
        {Object.entries(qosStatus.rateLimits).map(([type, limit]) => (
          <View key={type} style={styles.rateLimitItem}>
            <Text style={styles.rateLimitLabel}>{type.toUpperCase()}</Text>
            <Text style={styles.rateLimitValue}>
              {limit.tokens}/{limit.capacity} tokens
            </Text>
            {limit.timeUntilNext > 0 && (
              <Text style={styles.rateLimitTime}>
                Next in {Math.ceil(limit.timeUntilNext / 1000)}s
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Peers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Peers ({peers.length})</Text>
        {peers.length === 0 ? (
          <Text style={styles.emptyText}>No peers connected</Text>
        ) : (
          peers.map((peer) => (
            <View key={peer.id} style={styles.peerItem}>
              <View style={styles.peerHeader}>
                <Text style={styles.peerName}>{peer.name}</Text>
                <Text style={styles.peerTransport}>{peer.transport}</Text>
              </View>
              <View style={styles.peerDetails}>
                <Text style={styles.peerDetail}>ID: {peer.id.slice(0, 8)}...</Text>
                <Text style={styles.peerDetail}>
                  Last seen: {formatTime(peer.lastSeen)}
                </Text>
                {peer.rtt && (
                  <Text style={styles.peerDetail}>RTT: {peer.rtt}ms</Text>
                )}
                <Text style={[styles.peerStatus, { color: peer.connected ? '#22c55e' : '#ef4444' }]}>
                  {peer.connected ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Recent Events */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Events ({recentEvents.length})</Text>
        {recentEvents.length === 0 ? (
          <Text style={styles.emptyText}>No recent events</Text>
        ) : (
          recentEvents.slice(0, 20).map((event) => (
            <View key={event.id} style={styles.eventItem}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventType}>{event.type.toUpperCase()}</Text>
                <Text style={styles.eventTime}>{formatTime(event.ts)}</Text>
              </View>
              <View style={styles.eventDetails}>
                <Text style={styles.eventDetail}>
                  {event.msgType} • {event.size}B • hop:{event.hop}
                </Text>
                {event.transport && (
                  <Text style={styles.eventDetail}>via {event.transport}</Text>
                )}
                {event.error && (
                  <Text style={[styles.eventDetail, { color: '#ef4444' }]}>
                    Error: {event.error}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionButtons}>
          <Pressable style={styles.actionButton} onPress={handleExportLog}>
            <Text style={styles.actionButtonText}>Export Log</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.dangerButton]} onPress={handleClearData}>
            <Text style={styles.actionButtonText}>Clear Data</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusItem: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  statusLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 4,
  },
  statusValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  qosGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  qosItem: {
    alignItems: 'center',
  },
  qosLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 4,
  },
  qosValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  rateLimitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  rateLimitLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 60,
  },
  rateLimitValue: {
    color: '#d1d5db',
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  rateLimitTime: {
    color: '#f59e0b',
    fontSize: 12,
    minWidth: 80,
    textAlign: 'right',
  },
  peerItem: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  peerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  peerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  peerTransport: {
    color: '#9ca3af',
    fontSize: 12,
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  peerDetails: {
    gap: 4,
  },
  peerDetail: {
    color: '#d1d5db',
    fontSize: 12,
  },
  peerStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventItem: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventType: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  eventTime: {
    color: '#9ca3af',
    fontSize: 12,
  },
  eventDetails: {
    gap: 4,
  },
  eventDetail: {
    color: '#d1d5db',
    fontSize: 12,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});



