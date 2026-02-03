import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from '../../../components/SafeLinearGradient';
import { Ionicons } from '@expo/vector-icons';
import { useEarthquakes } from '../../../hooks/useEarthquakes';
import { calculateDistance } from '../../../utils/locationUtils';
import { formatToTurkishTimeOnly, formatToTurkishDateTime } from '../../../utils/timeUtils';
import { colors, shadows } from '../../../theme';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';

// ELITE: Type-safe navigation prop
type SeismicWidgetNavigationProp = StackNavigationProp<ParamListBase>;

interface Props {
  onViewAll: () => void;
  navigation?: SeismicWidgetNavigationProp;
}

const ISTANBUL_LAT = 41.0082;
const ISTANBUL_LON = 28.9784;

export const SeismicActivityWidget: React.FC<Props> = ({ onViewAll, navigation }) => {
  const { earthquakes, loading } = useEarthquakes();

  const sortedEarthquakes = useMemo(() => {
    return [...earthquakes].sort((a, b) => b.time - a.time);
  }, [earthquakes]);

  const latestEarthquake = sortedEarthquakes[0];
  const nextEarthquakes = sortedEarthquakes.slice(1, 4); // Show 3 more

  const getMagnitudeColor = (mag: number) => {
    if (mag >= 5.0) return '#EF4444';
    if (mag >= 4.0) return '#F59E0B';
    return '#10B981'; // Green for low
  };

  const formatTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    if (diffMs < 24 * 60 * 60 * 1000) {
      return formatToTurkishTimeOnly(timestamp);
    }
    return formatToTurkishDateTime(timestamp).split(' ')[0]; // Just date
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="pulse" size={16} color="#F59E0B" />
          <Text style={styles.headerTitle}>SEISMIC MONITOR</Text>
        </View>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAllText}>VIEW ALL</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <LinearGradient
        colors={['rgba(30, 41, 59, 0.5)', 'rgba(15, 23, 42, 0.8)']}
        style={styles.content}
      >
        {latestEarthquake ? (
          <View style={styles.mainRow}>
            <View style={[styles.magBadge, { borderColor: getMagnitudeColor(latestEarthquake.magnitude) }]}>
              <Text style={[styles.magValue, { color: getMagnitudeColor(latestEarthquake.magnitude) }]}>
                {latestEarthquake.magnitude.toFixed(1)}
              </Text>
              <Text style={styles.magLabel}>MAG</Text>
            </View>

            <View style={styles.mainInfo}>
              <Text style={styles.location} numberOfLines={1}>{latestEarthquake.location}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.time}>{formatToTurkishTimeOnly(latestEarthquake.time)}</Text>
                <View style={styles.dot} />
                <Text style={styles.depth}>{latestEarthquake.depth}km Depth</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{loading ? 'SCANNING...' : 'NO DATA'}</Text>
          </View>
        )}

        {/* List of recent small quakes */}
        <View style={styles.listContainer}>
          {nextEarthquakes.map((eq) => (
            <TouchableOpacity
              key={eq.id}
              style={styles.listItem}
              onPress={() => navigation?.navigate('EarthquakeDetail', { earthquake: eq })}
            >
              <View style={[styles.smallMag, { backgroundColor: getMagnitudeColor(eq.magnitude) }]}>
                <Text style={styles.smallMagText}>{eq.magnitude.toFixed(1)}</Text>
              </View>
              <Text style={styles.listLocation} numberOfLines={1}>{eq.location}</Text>
              <Text style={styles.listTime}>{formatTime(eq.time)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  viewAllText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  content: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  magBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  magValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  magLabel: {
    fontSize: 8,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: -2,
  },
  mainInfo: {
    flex: 1,
  },
  location: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  time: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#475569',
  },
  depth: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#64748B',
    fontSize: 12,
    letterSpacing: 1,
  },
  listContainer: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallMag: {
    width: 24,
    height: 24,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallMagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
  },
  listLocation: {
    flex: 1,
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  listTime: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
});
