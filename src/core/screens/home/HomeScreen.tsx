/**
 * HOME SCREEN
 * Main screen with earthquake list, SOS button, and mesh status
 * Based on old HomeSimple.tsx design
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../theme';
import { useEarthquakes } from '../../hooks/useEarthquakes';
import { useMesh } from '../../hooks/useMesh';
import EarthquakeCard from '../../components/cards/EarthquakeCard';
import SOSButton from '../../components/buttons/SOSButton';
import StatsCard from '../../components/cards/StatsCard';
import MeshStatusCard from '../../components/cards/MeshStatusCard';
import StatusBadge from '../../components/badges/StatusBadge';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import SOSModal, { SOSData } from '../../components/modals/SOSModal';
import { apiClient } from '../../api/client';

export default function HomeScreen({ navigation }: any) {
  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const { earthquakes, loading, refresh } = useEarthquakes();
  const { peers, messages, isConnected } = useMesh();
  const { isOnline } = useNetworkStatus();

  // Auto-refresh earthquakes every minute
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 60000);

    return () => clearInterval(interval);
  }, [refresh]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleSOSPress = () => {
    setSosModalVisible(true);
  };

  const handleSOSSubmit = async (data: SOSData) => {
    try {
      // Send to backend
      if (isOnline) {
        await apiClient.post('/sos/send', data);
        Alert.alert('SOS Gönderildi', 'Acil yardım çağrınız alındı ve kurtarma ekipleriyle paylaşıldı!');
      } else {
        // Offline - send via BLE mesh
        const { sendMessage } = useMesh();
        await sendMessage(JSON.stringify({
          type: 'sos',
          ...data,
          timestamp: Date.now(),
        }));
        Alert.alert('SOS Gönderildi', 'SOS sinyaliniz Bluetooth mesh ağı üzerinden yakındaki cihazlara gönderildi.');
      }
      
      setSosModalVisible(false);
    } catch (error) {
      console.error('SOS error:', error);
      Alert.alert('Hata', 'SOS gönderilemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleEarthquakePress = (earthquake: any) => {
    // TODO: Navigate to earthquake details
    console.log('Earthquake pressed:', earthquake);
  };

  const handleViewAllEarthquakes = () => {
    navigation.navigate('AllEarthquakes');
  };

  const latestEarthquakes = earthquakes.slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AfetNet</Text>
          <Text style={styles.headerSubtitle}>Hayat Kurtaran Teknoloji</Text>
        </View>
        <StatusBadge status={isOnline ? 'online' : 'offline'} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand.primary}
            colors={[colors.brand.primary]}
          />
        }
      >
        {/* Offline Support Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="shield-checkmark" size={24} color={colors.brand.primary} />
          </View>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>Tam Offline Çalışma Desteği</Text>
            <Text style={styles.bannerText}>
              İnternet olmadan Bluetooth mesh ağı ile iletişim. Deprem erken uyarı, aile takibi, SOS bildirimi ve harita desteği.
            </Text>
          </View>
        </View>

        {/* Mesh Status Card */}
        <MeshStatusCard
          peerCount={peers.length}
          status={isConnected ? 'online' : 'offline'}
          onPress={() => {/* TODO: Navigate to mesh details */}}
        />

        {/* SOS Button */}
        <SOSButton onPress={handleSOSPress} />

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatsCard
            icon="chatbubble-outline"
            value={messages.length}
            label="Mesaj"
            color={colors.status.info}
          />
          <StatsCard
            icon="people-outline"
            value={peers.length}
            label="Kişi"
            color={colors.status.success}
          />
          <StatsCard
            icon="pulse-outline"
            value={earthquakes.length}
            label="Deprem"
            color={colors.status.warning}
          />
        </View>

        {/* Earthquake Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="pulse" size={24} color={colors.status.danger} />
              <Text style={styles.sectionTitle}>Deprem İzleme Sistemi Aktif</Text>
            </View>
            <StatusBadge status="active" text="CANLI" />
          </View>

          <View style={styles.earthquakeInfo}>
            <View style={styles.earthquakeInfoItem}>
              <Text style={styles.earthquakeInfoLabel}>Son 24 Saat</Text>
              <Text style={styles.earthquakeInfoValue}>3</Text>
            </View>
            <View style={styles.earthquakeInfoItem}>
              <Text style={styles.earthquakeInfoLabel}>En Büyük</Text>
              <Text style={styles.earthquakeInfoValue}>4.2 ML</Text>
            </View>
            <View style={styles.earthquakeInfoItem}>
              <Text style={styles.earthquakeInfoLabel}>Toplam</Text>
              <Text style={styles.earthquakeInfoValue}>3</Text>
            </View>
          </View>

          <Text style={styles.earthquakeSource}>AFAD ve Kandilli verilerine bağlı</Text>
        </View>

        {/* Latest Earthquakes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Son Depremler</Text>
            <Pressable onPress={handleViewAllEarthquakes}>
              <View style={styles.viewAllButton}>
                <Ionicons name="refresh-circle" size={20} color={colors.brand.primary} />
              </View>
            </Pressable>
          </View>

          {loading && earthquakes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="hourglass-outline" size={48} color={colors.text.muted} />
              <Text style={styles.emptyText}>Deprem verileri yükleniyor...</Text>
            </View>
          ) : latestEarthquakes.length > 0 ? (
            <>
              {latestEarthquakes.map((earthquake) => (
                <EarthquakeCard
                  key={earthquake.id}
                  earthquake={earthquake}
                  onPress={() => handleEarthquakePress(earthquake)}
                />
              ))}
              <Pressable onPress={handleViewAllEarthquakes} style={styles.viewAllLink}>
                <Text style={styles.viewAllText}>Tüm Depremleri Gör</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.brand.primary} />
              </Pressable>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.status.success} />
              <Text style={styles.emptyText}>Son 24 saatte önemli deprem kaydedilmedi</Text>
            </View>
          )}
        </View>

        {/* Quick Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
          <View style={styles.quickAccessGrid}>
            <Pressable style={styles.quickAccessItem}>
              <Ionicons name="map-outline" size={32} color={colors.brand.primary} />
              <Text style={styles.quickAccessText}>Offline Harita</Text>
            </Pressable>
            <Pressable style={styles.quickAccessItem}>
              <Ionicons name="people-outline" size={32} color={colors.status.success} />
              <Text style={styles.quickAccessText}>Aile Takibi</Text>
            </Pressable>
            <Pressable style={styles.quickAccessItem}>
              <Ionicons name="chatbubbles-outline" size={32} color={colors.status.info} />
              <Text style={styles.quickAccessText}>Mesajlar</Text>
            </Pressable>
            <Pressable style={styles.quickAccessItem}>
              <Ionicons name="settings-outline" size={32} color={colors.text.tertiary} />
              <Text style={styles.quickAccessText}>Ayarlar</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* SOS Modal */}
      <SOSModal
        visible={sosModalVisible}
        onClose={() => setSosModalVisible(false)}
        onSubmit={handleSOSSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: 60,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.text.primary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  bannerText: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  earthquakeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  earthquakeInfoItem: {
    alignItems: 'center',
  },
  earthquakeInfoLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  earthquakeInfoValue: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '700',
  },
  earthquakeSource: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  viewAllButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  viewAllText: {
    ...typography.body,
    color: colors.brand.primary,
    fontWeight: '600',
    marginRight: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.tertiary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickAccessItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  quickAccessText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

