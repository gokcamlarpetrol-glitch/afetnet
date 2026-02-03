/**
 * SEISMIC ALERT BANNER
 * Bespoke signature component for AfetNet
 * "Modern Calm Trust" Style: Distinct shape, visual severity scale
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, shadow } from '../../theme';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface SeismicAlertBannerProps {
    magnitude: number;
    location: string;
    depth?: number;
    time: string;
    onPress?: () => void;
}

export const SeismicAlertBannerComponent = ({ magnitude, location, depth, time, onPress }: SeismicAlertBannerProps) => {
  // Determine severity color logic
  const isCritical = magnitude >= 6.0;
  const isWarning = magnitude >= 4.0 && magnitude < 6.0;

  const severityColor = isCritical
    ? colors.emergency.critical
    : isWarning
      ? colors.emergency.warning
      : colors.accent.primary;

  const severityGradient = isCritical
    ? colors.emergency.gradient
    : isWarning
      ? [colors.emergency.warning, '#B45309']
      : colors.mesh.gradient;

  return (
    <Pressable onPress={onPress}>
      <Animated.View entering={FadeInDown.springify()} style={styles.container}>
        {/* Main Card with Bespoke Shape */}
        <View style={styles.card}>

          {/* Left Severity Indicator Bar (Gradient) */}
          <LinearGradient
            colors={severityGradient as any}
            style={styles.severityBar}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />

          {/* Content Area */}
          <View style={styles.content}>
            {/* Header Row */}
            <View style={styles.headerRow}>
              <View style={styles.magnitudeBadge}>
                <Text style={[styles.magnitudeText, { color: severityColor }]}>
                  {magnitude.toFixed(1)}
                </Text>
              </View>

              <View style={styles.locationContainer}>
                <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
                <Text style={styles.timeText}>{time} • {depth}km derinlik</Text>
              </View>
            </View>

            {/* Visual Severity Scale (custom graphic) */}
            <View style={styles.scaleContainer}>
              {/* Background Track */}
              <View style={styles.scaleTrack} />

              {/* Active Segment (Width based on magnitude max 10) */}
              <View style={[
                styles.scaleActive,
                {
                  width: `${Math.min((magnitude / 9.0) * 100, 100)}%`,
                  backgroundColor: severityColor,
                },
              ]} />

              {/* Tick marks */}
              {[...Array(9)].map((_, i) => (
                <View key={i} style={[
                  styles.scaleTick,
                  { left: `${(i + 1) * 10}%`, backgroundColor: i < magnitude ? 'rgba(255,255,255,0.5)' : colors.border.light },
                ]} />
              ))}
            </View>
          </View>

          {/* Icon Plate (Right Side) */}
          {/* Distinctive corner cut shape simulated via absolute positioning or just styling */}
          <View style={[styles.iconPlate, { backgroundColor: severityColor + '15' }]}>
            <Ionicons
              name={isCritical ? "warning" : "pulse"}
              size={24}
              color={severityColor}
            />
          </View>

        </View>
      </Animated.View>
    </Pressable>
  );
};

export const SeismicAlertBanner = React.memo(SeismicAlertBannerComponent);

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    ...(shadow as any).medium,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    // Bespoke shape rule: Top-Left is sharp/small radius for "Alert" feel? 
    // Or just clean 16px. Let's stick to clean 16px as per brief "corner radius tokens".
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
    minHeight: 100,
  },
  severityBar: {
    width: 6,
    height: '100%',
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  magnitudeBadge: {
    width: 48,
    height: 48,
    borderRadius: 12, // Consistent token
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
    marginRight: 12,
  },
  magnitudeText: {
    fontSize: 20,
    fontWeight: '800' as any,
    // fontFamily is likely in typography.h1, but if it causes error we can omit or cast
    ...(typography.h1 as any),
  },
  locationContainer: {
    flex: 1,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  scaleContainer: {
    height: 6,
    backgroundColor: colors.background.tertiary,
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
    marginTop: 4,
  },
  scaleTrack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  scaleActive: {
    height: '100%',
    borderRadius: 3,
  },
  scaleTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#fff',
    zIndex: 2,
  },
  iconPlate: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border.light,
  },
});
