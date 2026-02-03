/**
 * EARTHQUAKE MONITOR CARD - ELITE EDITION
 * Powered by React Native Reanimated for 60FPS pulse effects.
 */

import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ImageBackground } from 'react-native';
import { LinearGradient } from '../../../components/SafeLinearGradient';
import { Ionicons } from '@expo/vector-icons';
import { useEarthquakes } from '../../../hooks/useEarthquakes';
import * as haptics from '../../../utils/haptics';
import { calculateDistance } from '../../../utils/locationUtils';
import { formatToTurkishTimeOnly, formatToTurkishDateTime } from '../../../utils/timeUtils';
import { PremiumMaterialSurface } from '../../../components/PremiumMaterialSurface';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { colors } from '../../../theme';
import { SeismicWaveView } from '../../../components/SeismicWaveView';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';

// ELITE: Type-safe Earthquake interface
interface Earthquake {
  id: string;
  magnitude: number;
  location: string;
  time: number;
  depth: number;
  latitude: number;
  longitude: number;
}

// ELITE: Type-safe navigation prop
type EarthquakeMonitorNavigationProp = StackNavigationProp<ParamListBase>;

interface Props {
  onViewAll: () => void;
  navigation?: EarthquakeMonitorNavigationProp;
}

const ISTANBUL_LAT = 41.0082;
const ISTANBUL_LON = 28.9784;
const NEARBY_RADIUS_KM = 500;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function EarthquakeMonitorCard({ onViewAll, navigation }: Props) {
  const { earthquakes, loading } = useEarthquakes();

  // Reanimated Shared Values
  const pulseOpacity = useSharedValue(0.4);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Pulse Animation for LIVE badge
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 }),
      ),
      -1,
      true,
    );
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const sortedEarthquakes = useMemo(() => {
    return [...earthquakes].sort((a, b) => b.time - a.time);
  }, [earthquakes]);

  const nearbyEarthquakes = useMemo(() => {
    return sortedEarthquakes.filter((eq) => {
      const distance = calculateDistance(ISTANBUL_LAT, ISTANBUL_LON, eq.latitude, eq.longitude);
      return distance <= NEARBY_RADIUS_KM;
    });
  }, [sortedEarthquakes]);

  const last24Hours = sortedEarthquakes.filter((eq) => Date.now() - eq.time < 24 * 60 * 60 * 1000);
  const maxMagnitude = sortedEarthquakes.length > 0 ? Math.max(...sortedEarthquakes.map(eq => eq.magnitude)) : 0;
  const latestEarthquake = sortedEarthquakes[0];
  const nextTwoEarthquakes = sortedEarthquakes.slice(1, 3);

  const getMagnitudeColor = (mag: number) => {
    if (mag >= 5.0) return '#0f172a'; // Slate 900 (Darkest Navy/Black)
    if (mag >= 4.0) return '#172554'; // Blue 950 (Dark Navy)
    return '#1e3a8a'; // Blue 800 (Standard Navy)
  };

  const formatTimestamp = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    return diffMs <= 48 * 60 * 60 * 1000
      ? formatToTurkishTimeOnly(timestamp)
      : formatToTurkishDateTime(timestamp);
  };

  const getDistance = (eq: Earthquake) => {
    const distance = calculateDistance(ISTANBUL_LAT, ISTANBUL_LON, eq.latitude, eq.longitude);
    return `${Math.round(distance)} km uzakta`;
  };

  const handleNavigation = (earthquake: Earthquake) => {
    haptics.impactLight();
    if (navigation?.navigate) {
      navigation.navigate('EarthquakeDetail', { earthquake });
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(600).springify()} style={[styles.container]}>
      {/* Universal Glass Frame */}
      <PremiumMaterialSurface style={styles.shadowContainer} borderRadius={28}>
        {/* Standard Ceramic Background from Surface Component */}

        <View style={styles.cardContent}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="pulse" size={24} color="#0369A1" />
              </View>
              <View>
                <Text style={styles.title}>Deprem Monitörü</Text>
                <Text style={styles.subtitle}>AFAD Canlı Akışı</Text>
              </View>
            </View>
            <View style={styles.liveBadge}>
              <Animated.View style={[styles.liveDot, animatedPulseStyle]} />
              <Text style={styles.liveText}>CANLI</Text>
            </View>
          </View>

          {/* ELITE: Seismic Wave Visualization - Sky Blue Theme */}
          <View style={{ height: 60, marginTop: -10, marginBottom: 10, overflow: 'hidden' }}>
            <SeismicWaveView
              data={Array.from({ length: 40 }, () => Math.random() * 0.5)}
              speed={2}
              amplitude={30}
              color="#0EA5E9" // Sky Blue 500
              style={{ height: 60, width: '100%' }}
            />
          </View>

          {/* Stats Grid */}
          <View style={styles.statsRow}>
            {[
              { label: 'Son 24 Saat', value: last24Hours.length },
              { label: 'En Büyük', value: maxMagnitude > 0 ? maxMagnitude.toFixed(1) : '--' },
              { label: 'Toplam', value: sortedEarthquakes.length },
            ].map((stat, idx) => (
              <View key={idx} style={styles.stat}>
                <Text style={styles.statTitle}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Featured Earthquake */}
          {latestEarthquake ? (
            <>
              <View style={styles.sectionHeader}>
                <Ionicons name="flash" size={16} color="#0369A1" />
                <Text style={styles.sectionTitle}>SON DEPREMLER</Text>
              </View>

              <AnimatedTouchableOpacity
                style={[styles.featuredCard]}
                activeOpacity={0.9}
                onPress={() => handleNavigation(latestEarthquake)}
              >
                <View style={styles.featuredContent}>
                  <View style={[styles.magBadge, { backgroundColor: getMagnitudeColor(latestEarthquake.magnitude) }]}>
                    <Text style={styles.magValue}>{latestEarthquake.magnitude.toFixed(1)}</Text>
                    <Text style={styles.magLabel}>ML</Text>
                  </View>
                  <View style={styles.featuredInfo}>
                    <Text style={styles.featuredLocation} numberOfLines={2}>{latestEarthquake.location}</Text>
                    <View style={styles.featuredMetaRow}>
                      <Ionicons name="time-outline" size={14} color="#64748B" />
                      <Text style={styles.featuredMeta}>{formatTimestamp(latestEarthquake.time)}</Text>
                      <Text style={styles.dot}>•</Text>
                      <Text style={styles.featuredMeta}>{getDistance(latestEarthquake)}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#94A3B8" />
                </View>
              </AnimatedTouchableOpacity>

              {/* List Items */}
              <View style={styles.listContainer}>
                {nextTwoEarthquakes.map((eq, index) => (
                  <AnimatedTouchableOpacity
                    key={eq.id}
                    entering={FadeInDown.delay(index * 100 + 200).duration(500)}
                    style={styles.listItem}
                    onPress={() => handleNavigation(eq)}
                  >
                    <View style={[styles.smallMagBadge, { backgroundColor: getMagnitudeColor(eq.magnitude) }]}>
                      <Text style={styles.smallMagText}>{eq.magnitude.toFixed(1)}</Text>
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listLocation} numberOfLines={1}>{eq.location}</Text>
                      <Text style={styles.listMeta}>{formatTimestamp(eq.time)} • {getDistance(eq)}</Text>
                    </View>
                  </AnimatedTouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={32} color="rgba(3, 105, 161, 0.5)" />
              <Text style={styles.emptyText}>{loading ? 'Veriler Yükleniyor...' : 'Kayıt Bulunamadı'}</Text>
            </View>
          )}

          {/* Footer Action */}
          <TouchableOpacity style={styles.footerButton} onPress={onViewAll}>
            <Text style={styles.footerButtonText}>Tüm Depremleri İncele</Text>
            <Ionicons name="arrow-forward" size={16} color="#0EA5E9" />
          </TouchableOpacity>

        </View>
      </PremiumMaterialSurface>
    </Animated.View >
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    // Removed specific padding horizontal to align with upper cards
    paddingHorizontal: 0,
  },
  shadowContainer: {
    // Shadow is handled by PremiumMaterialSurface, this just ensures size
    flex: 1,
  },
  backgroundImage: {
    // Legacy removed
  },
  backgroundImageStyle: {
    // Legacy removed
  },
  cardContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)', // Glassy
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a', // Slate 900 - Sharp contrast
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#334155', // Slate 700
    marginTop: 2,
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.35)', // Glassy badge
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626', // Red pulse for "LIVE" urgency
  },
  liveText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff', // White text
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)', // Ultra glassy
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  statTitle: {
    fontSize: 10,
    color: '#1e293b', // Slate 800
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#172554', // Blue 950 - Deep Navy
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  featuredCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)', // Floating glass
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 14,
  },
  featuredContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  magBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  magValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff', // White
  },
  magLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)', // White Low Opacity
    marginTop: -2,
  },
  featuredInfo: {
    flex: 1,
  },
  featuredLocation: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    lineHeight: 22,
  },
  featuredMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featuredMeta: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  dot: {
    color: '#94a3b8',
  },
  listContainer: {
    gap: 10,
    marginBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // Subtle glass
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  smallMagBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  smallMagText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff', // White
  },
  listInfo: {
    flex: 1,
  },
  listLocation: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  listMeta: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    color: '#334155',
    marginTop: 10,
    fontWeight: '600',
  },
  footerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369a1', // Sky 700
    letterSpacing: 0.5,
  },
});
