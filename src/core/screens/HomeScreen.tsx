/**
 * HOME SCREEN - Earthquake List (FREE)
 * Main screen showing recent earthquakes
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEarthquakeStore, Earthquake } from '../stores/earthquakeStore';
import { earthquakeService } from '../services/EarthquakeService';
import { bleMeshService } from '../services/BLEMeshService';

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to store updates
    const interval = setInterval(() => {
      const state = useEarthquakeStore.getState();
      setEarthquakes(state.items);
      setLoading(state.loading);
      setError(state.error);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await earthquakeService.fetchEarthquakes();
    setRefreshing(false);
  };

  const handleSOS = () => {
    Alert.alert(
      'Acil Durum',
      'SOS sinyali göndermek istediğinizden emin misiniz? Bu sinyal yakındaki tüm cihazlara iletilecektir.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Gönder',
          style: 'destructive',
          onPress: async () => {
            await bleMeshService.sendSOS();
            Alert.alert('SOS Gönderildi', 'Acil durum sinyaliniz yakındaki cihazlara iletiliyor.');
          },
        },
      ]
    );
  };

  const renderEarthquake = ({ item }: { item: Earthquake }) => {
    const magnitude = item.magnitude.toFixed(1);
    const magnitudeColor = 
      item.magnitude >= 5 ? '#ef4444' :
      item.magnitude >= 4 ? '#f97316' :
      '#eab308';

    const date = new Date(item.time);
    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });

    return (
      <Pressable style={styles.earthquakeCard}>
        <View style={styles.earthquakeHeader}>
          <View style={[styles.magnitudeBadge, { backgroundColor: magnitudeColor }]}>
            <Text style={styles.magnitudeText}>{magnitude}</Text>
          </View>
          <View style={styles.earthquakeInfo}>
            <Text style={styles.locationText} numberOfLines={2}>
              {item.location}
            </Text>
            <Text style={styles.detailsText}>
              Derinlik: {item.depth.toFixed(0)} km • {item.source}
            </Text>
          </View>
        </View>
        <Text style={styles.timeText}>
          {timeStr} • {dateStr}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Depremler</Text>
          <Text style={styles.headerSubtitle}>
            Son 7 gün • {earthquakes.length} deprem
          </Text>
        </View>
        <Pressable style={styles.sosButton} onPress={handleSOS}>
          <Ionicons name="alert-circle" size={24} color="#fff" />
          <Text style={styles.sosText}>SOS</Text>
        </Pressable>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={16} color="#f97316" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Earthquake List */}
      <FlatList
        data={earthquakes}
        renderItem={renderEarthquake}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="earth" size={64} color="#475569" />
            <Text style={styles.emptyText}>
              {loading ? 'Depremler yükleniyor...' : 'Henüz deprem verisi yok'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  sosButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sosText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#422006',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#78350f',
  },
  errorText: {
    flex: 1,
    color: '#fbbf24',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
  },
  earthquakeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  earthquakeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  magnitudeBadge: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  magnitudeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  earthquakeInfo: {
    flex: 1,
  },
  locationText: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailsText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  timeText: {
    color: '#64748b',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    marginTop: 16,
  },
});

