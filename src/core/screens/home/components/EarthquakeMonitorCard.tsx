/**
 * EARTHQUAKE MONITOR CARD - Exact Design
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useEarthquakes } from '../../../hooks/useEarthquakes';
import * as haptics from '../../../utils/haptics';
import { calculateDistance } from '../../../utils/locationUtils';

interface Props {
  onViewAll: () => void;
  navigation?: any;
}

// Istanbul center coordinates
const ISTANBUL_LAT = 41.0082;
const ISTANBUL_LON = 28.9784;
const NEARBY_RADIUS_KM = 500; // 500km radius for "nearby"

export default function EarthquakeMonitorCard({ onViewAll, navigation }: Props) {
  const { earthquakes, loading } = useEarthquakes();

  // Filter earthquakes within 500km of Istanbul
  const nearbyEarthquakes = useMemo(() => {
    return earthquakes
      .filter((eq) => {
        const distance = calculateDistance(
          ISTANBUL_LAT,
          ISTANBUL_LON,
          eq.latitude,
          eq.longitude
        );
        return distance <= NEARBY_RADIUS_KM;
      })
      .sort((a, b) => b.time - a.time); // Newest first
  }, [earthquakes]);

  const last24Hours = nearbyEarthquakes.filter((eq) => {
    const now = Date.now();
    return now - eq.time < 24 * 60 * 60 * 1000;
  });

  const maxMagnitude = nearbyEarthquakes.length > 0
    ? Math.max(...nearbyEarthquakes.map((eq) => eq.magnitude))
    : 0;

  // Son 3 deprem: 1 üstte (featured) + 2 altta (list)
  const latestEarthquake = nearbyEarthquakes[0]; // En son deprem
  const nextTwoEarthquakes = nearbyEarthquakes.slice(1, 3); // Sonraki 2 deprem

  const getMagnitudeColor = (mag: number) => {
    if (mag >= 5.0) return '#ef4444';
    if (mag >= 4.0) return '#f97316';
    return '#eab308';
  };

  const getTimeAgo = (timestamp: number): string => {
    const diffMs = Date.now() - timestamp;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMinutes < 1) return 'Az önce';
    if (diffMinutes < 60) return `${diffMinutes} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} gün önce`;
  };

  const getDistance = (eq: any): string => {
    const distance = calculateDistance(
      ISTANBUL_LAT,
      ISTANBUL_LON,
      eq.latitude,
      eq.longitude
    );
    return `${Math.round(distance)} km uzakta`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e3a8a', '#3b82f6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconCircle}>
              <Ionicons name="pulse" size={24} color="#fff" />
            </View>
            <View>
              <Text style={styles.title}>Deprem İzleme Sistemi</Text>
              <Text style={styles.subtitle}>İstanbul Bölgesi (500km)</Text>
            </View>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>CANLI</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statTitle}>Son 24 Saat</Text>
            <Text style={styles.statValue}>{last24Hours.length}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statTitle}>En Büyük</Text>
            <Text style={styles.statValue}>{maxMagnitude > 0 ? `${maxMagnitude.toFixed(1)}` : '--'}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statTitle}>Toplam</Text>
            <Text style={styles.statValue}>{nearbyEarthquakes.length}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Ionicons name="location" size={20} color="#fff" />
            <Text style={styles.recentTitle}>Son Depremler</Text>
          </View>

          {latestEarthquake ? (
            <>
              {/* EN SON DEPREM (Featured - Büyük) */}
                <TouchableOpacity 
                  style={styles.featuredEqItem}
                  activeOpacity={0.7}
                  onPress={() => { 
                    haptics.impactLight(); 
                    navigation?.navigate?.('EarthquakeDetail', { earthquake: latestEarthquake });
                  }}
                >
                <View style={styles.featuredHeader}>
                  <View style={[styles.featuredMagBadge, { backgroundColor: getMagnitudeColor(latestEarthquake.magnitude) }]}>
                    <Text style={styles.featuredMagText}>{latestEarthquake.magnitude.toFixed(1)}</Text>
                    <Text style={styles.featuredMagLabel}>ML</Text>
                  </View>
                  <View style={styles.featuredInfo}>
                    <Text style={styles.featuredLocation} numberOfLines={2}>
                      {latestEarthquake.location}
                    </Text>
                    <Text style={styles.featuredTime}>
                      {getTimeAgo(latestEarthquake.time)}
                    </Text>
                  </View>
                </View>
                <View style={styles.featuredMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="navigate-outline" size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.metaText}>{getDistance(latestEarthquake)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="resize-outline" size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.metaText}>{latestEarthquake.depth} km derinlik</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* SONRAKI 2 DEPREM (List - Küçük) */}
              {nextTwoEarthquakes.length > 0 && (
                <View style={styles.smallEqList}>
                  {nextTwoEarthquakes.map((eq) => (
                    <TouchableOpacity 
                      key={eq.id} 
                      style={styles.smallEqItem}
                      activeOpacity={0.7}
                      onPress={() => { 
                        haptics.impactLight(); 
                        navigation?.navigate?.('EarthquakeDetail', { earthquake: eq });
                      }}
                    >
                      <View style={[styles.smallMagBadge, { backgroundColor: getMagnitudeColor(eq.magnitude) }]}>
                        <Text style={styles.smallMagText}>{eq.magnitude.toFixed(1)}</Text>
                      </View>
                      <View style={styles.smallEqInfo}>
                        <Text style={styles.smallEqLocation} numberOfLines={1}>
                          {eq.location}
                        </Text>
                        <Text style={styles.smallEqMeta}>
                          {getTimeAgo(eq.time)} • {getDistance(eq)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>
                {loading ? 'Veriler yükleniyor...' : 'Yakın bölgede deprem kaydı yok'}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.viewAllBtn} onPress={() => { haptics.impactLight(); onViewAll(); }}>
            <Text style={styles.viewAllText}>Tüm Depremleri Gör</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  gradient: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 90,
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  recentSection: {
    gap: 10,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recentTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  // Featured (En Son Deprem - Büyük)
  featuredEqItem: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 14,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  featuredMagBadge: {
    width: 68,
    height: 68,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  featuredMagText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 24,
  },
  featuredMagLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    marginTop: -2,
  },
  featuredInfo: {
    flex: 1,
  },
  featuredLocation: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  featuredTime: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  featuredMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  
  // Small List (Sonraki 2 Deprem - Küçük)
  smallEqList: {
    gap: 10,
    marginBottom: 14,
  },
  smallEqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  smallMagBadge: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallMagText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },
  smallEqInfo: {
    flex: 1,
  },
  smallEqLocation: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  smallEqMeta: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  noDataContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
  },
  noDataText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
});
