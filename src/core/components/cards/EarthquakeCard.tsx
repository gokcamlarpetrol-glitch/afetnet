/**
 * EARTHQUAKE CARD
 * Premium gradient card for earthquake display
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { Earthquake } from '../../stores/earthquakeStore';

interface EarthquakeCardProps {
  earthquake: Earthquake;
  onPress?: () => void;
}

function getMagnitudeColor(magnitude: number): string[] {
  if (magnitude >= 5.0) return ['#d32f2f', '#b71c1c']; // Strong - Red
  if (magnitude >= 4.0) return ['#ff6f00', '#e65100']; // Moderate - Orange
  return ['#fbc02d', '#f9a825']; // Minor - Yellow
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Az önce';
  if (minutes < 60) return `${minutes} dakika önce`;
  if (hours < 24) return `${hours} saat önce`;
  return `${days} gün önce`;
}

export default function EarthquakeCard({ earthquake, onPress }: EarthquakeCardProps) {
  const gradientColors = getMagnitudeColor(earthquake.magnitude);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={[gradientColors[0], gradientColors[1], gradientColors[1] + '90']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Magnitude Badge */}
        <View style={styles.magnitudeBadge}>
          <Text style={styles.magnitudeText}>{earthquake.magnitude.toFixed(1)}</Text>
          <Text style={styles.magnitudeLabel}>ML</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons name="pulse" size={20} color={colors.text.primary} />
            <Text style={styles.location} numberOfLines={1}>
              {earthquake.location}
            </Text>
          </View>

          <View style={styles.details}>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.detailText}>{formatTime(earthquake.time)}</Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="arrow-down-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.detailText}>{earthquake.depth.toFixed(1)} km</Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="information-circle-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.detailText}>{earthquake.source}</Text>
            </View>
          </View>
        </View>

        {/* Arrow */}
        <Ionicons name="chevron-forward" size={24} color={colors.text.primary} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.8,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    minHeight: 100,
  },
  magnitudeBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  magnitudeText: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '800',
  },
  magnitudeLabel: {
    ...typography.small,
    color: colors.text.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  location: {
    ...typography.h4,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
});

