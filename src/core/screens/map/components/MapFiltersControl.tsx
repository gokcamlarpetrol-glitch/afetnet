import React from 'react';
import { View, StyleSheet, ScrollView, Text, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useMapStore, MapFilters } from '../../../stores/mapStore';
import { colors } from '../../../theme';
import * as haptics from '../../../utils/haptics';

export const MapFiltersControl = () => {
  const filters = useMapStore((state) => state.filters);
  const setFilters = useMapStore((state) => state.setFilters);

  const handleTimeRangeSelect = (range: MapFilters['timeRange']) => {
    haptics.impactLight();
    setFilters({ timeRange: range });
  };

  const handleMagToggle = (min: number) => {
    haptics.impactLight();
    // Toggle logic: if already selected, go back to 0, else select new min
    setFilters({ minMagnitude: filters.minMagnitude === min ? 0 : min });
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint="dark" style={styles.blur}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Time Range Chips */}
          <View style={styles.group}>
            <Text style={styles.label}>Zaman:</Text>
            {['24h', '7d', 'all'].map((range) => (
              <Pressable
                key={range}
                style={[styles.chip, filters.timeRange === range && styles.chipActive]}
                onPress={() => handleTimeRangeSelect(range as any)}
              >
                <Text style={[styles.chipText, filters.timeRange === range && styles.chipTextActive]}>
                  {range === '24h' ? '24s' : range === '7d' ? '7 Gün' : 'Tümü'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Magnitude Chips */}
          <View style={styles.group}>
            <Text style={styles.label}>Büyüklük:</Text>
            {[3, 4, 5].map((mag) => (
              <Pressable
                key={mag}
                style={[styles.chip, filters.minMagnitude === mag && styles.chipActiveMag]}
                onPress={() => handleMagToggle(mag)}
              >
                <Text style={[styles.chipText, filters.minMagnitude === mag && styles.chipTextActive]}>
                  {mag}+
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60, // Adjust based on header height
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 20,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  blur: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  scrollContent: {
    alignItems: 'center',
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginRight: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  chipActiveMag: {
    backgroundColor: colors.status.danger,
    borderColor: colors.status.danger,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 12,
  },
});
