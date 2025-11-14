/**
 * ELITE: Memoized Earthquake List Item Component
 * Prevents unnecessary re-renders for better performance
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { Earthquake } from '../../../stores/earthquakeStore';
import { i18nService } from '../../../services/I18nService';

interface EarthquakeListItemProps {
  item: Earthquake;
  distance: number;
  magnitudeColor: string;
  formattedTime: string;
  onPress: () => void;
  onMapPress: () => void;
}

const EarthquakeListItem = memo<EarthquakeListItemProps>(({
  item,
  distance,
  magnitudeColor,
  formattedTime,
  onPress,
  onMapPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.earthquakeItem}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Magnitude Badge */}
      <View style={[styles.magnitudeBadge, { backgroundColor: magnitudeColor }]}>
        <Text style={styles.magnitudeText}>{item.magnitude.toFixed(1)}</Text>
        <Text style={styles.magnitudeLabel}>{i18nService.t('earthquake.ml')}</Text>
      </View>

      {/* Info */}
      <View style={styles.itemInfo}>
        <Text style={styles.itemLocation} numberOfLines={2}>
          {item.location}
        </Text>
        <View style={styles.itemMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={colors.text.secondary} />
            <Text style={styles.metaText}>{formattedTime}</Text>
          </View>
          <View style={styles.metaDot} />
          <View style={styles.metaItem}>
            <Ionicons name="arrow-down-outline" size={13} color={colors.text.secondary} />
            <Text style={styles.metaText}>{item.depth.toFixed(1)} {i18nService.t('earthquake.km')}</Text>
          </View>
          <View style={styles.metaDot} />
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={13} color={colors.text.secondary} />
            <Text style={styles.metaText}>{distance} {i18nService.t('earthquake.km')}</Text>
          </View>
        </View>
      </View>

      {/* Map Button */}
      <TouchableOpacity
        style={styles.mapButton}
        onPress={onMapPress}
      >
        <Ionicons name="map" size={20} color="#8b5cf6" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // ELITE: Custom comparison function for better memoization
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.magnitude === nextProps.item.magnitude &&
    prevProps.item.time === nextProps.item.time &&
    prevProps.distance === nextProps.distance &&
    prevProps.magnitudeColor === nextProps.magnitudeColor &&
    prevProps.formattedTime === nextProps.formattedTime
  );
});

EarthquakeListItem.displayName = 'EarthquakeListItem';

const styles = StyleSheet.create({
  earthquakeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  magnitudeBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  magnitudeText: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text.primary,
  },
  magnitudeLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  itemInfo: {
    flex: 1,
  },
  itemLocation: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.muted,
  },
  mapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});

export default EarthquakeListItem;

