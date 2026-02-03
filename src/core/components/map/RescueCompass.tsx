import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../theme';
import { useCompass } from '../../hooks/useCompass';
import { calculateBearing, formatDistance } from '../../utils/mapUtils';

interface RescueCompassProps {
    userLocation: { latitude: number; longitude: number } | null;
    targetLocation: { latitude: number; longitude: number } | null;
    targetName: string;
    visible: boolean;
}

const { width } = Dimensions.get('window');

/**
 * RESCUE COMPASS - Elite Guidance System
 * 
 * Provides a tactical HUD for navigating to a target.
 * Uses real-time compass data to point an arrow towards the target.
 * Shows distance and cardinal direction.
 */
export function RescueCompass({ userLocation, targetLocation, targetName, visible }: RescueCompassProps) {
  const { heading } = useCompass(); // Real-time magnetic heading (0-360)
  const [targetBearing, setTargetBearing] = useState(0);
  const [distance, setDistance] = useState(0);

  const arrowRotation = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Calculate Bearing & Distance when locations change
  useEffect(() => {
    if (userLocation && targetLocation) {
      const bearing = calculateBearing(
        userLocation.latitude,
        userLocation.longitude,
        targetLocation.latitude,
        targetLocation.longitude,
      );
      setTargetBearing(bearing);

      // Assuming calculateDistance exists in utils, otherwise we'd import/implement it
      // For now, simple haversine or imported function
      const dist = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        targetLocation.latitude,
        targetLocation.longitude,
      );
      setDistance(dist);
    }
  }, [userLocation, targetLocation]);

  // Update Arrow Rotation based on Heading
  useEffect(() => {
    if (!visible) return;

    // The arrow should point to (Target Bearing - User Heading)
    // ex: Target is 90 (East), User faces 0 (North) -> Arrow points 90 (Right)
    // ex: Target is 90 (East), User faces 90 (East) -> Arrow points 0 (Up/Forward)

    let diff = targetBearing - heading;

    // Normalize to -180 to 180 for shortest rotation
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    arrowRotation.value = withSpring(diff, { damping: 20, stiffness: 100 });
  }, [heading, targetBearing, visible]);

  // Visibility Animation
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: withTiming(visible ? 0 : 20) }],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${arrowRotation.value}deg` }],
  }));

  if (!userLocation || !targetLocation) return null;

  // Determine color based on distance
  const getDistanceColor = (d: number) => {
    if (d < 100) return colors.status.success; // Very close
    if (d < 500) return colors.status.warning; // Nearby
    return colors.brand.primary; // Far
  };

  const distColor = getDistanceColor(distance);

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Glass Background */}
      <View style={styles.glassPanel}>
        <View style={styles.header}>
          <Text style={styles.targetLabel}>HEDEF</Text>
          <Text style={styles.targetName} numberOfLines={1}>{targetName}</Text>
        </View>

        <View style={styles.compassRow}>
          {/* Rotating Arrow */}
          <View style={styles.arrowContainer}>
            <Animated.View style={[styles.compassRing, arrowStyle]}>
              <Ionicons name="navigate" size={48} color={distColor} />
            </Animated.View>
            {/* Static North Indicator (Small) */}
            <View style={[styles.northIndicator, { transform: [{ rotate: `-${heading}deg` }] }]}>
              <Text style={styles.northText}>N</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatDistance(distance)}</Text>
              <Text style={styles.statLabel}>MESAFE</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{Math.round(targetBearing)}°</Text>
              <Text style={styles.statLabel}>YÖN</Text>
            </View>
          </View>
        </View>

        {/* Accuracy Warning if GPS is poor */}
        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={14} color={colors.text.tertiary} />
          <Text style={styles.footerText}>
                        Telefonu yatay tutarak kalibre edin
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// Helper for distance calc if not imported (keeping it self-contained for now)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120, // Sit above bottom sheet
    alignSelf: 'center',
    width: width * 0.9,
    maxWidth: 400,
    zIndex: 50,
    pointerEvents: 'none', // Allow touches to pass through to map if needed, but buttons need touch
    // Actually we want touches on this panel to be blocked/handled? 
    // pointerEvents: 'box-none' usually better for overlays.
  },
  glassPanel: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)', // Dark Slate Glass
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  targetLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.status.warning, // ORANGE for attention
    letterSpacing: 1,
    marginBottom: 2,
  },
  targetName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  compassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  arrowContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassRing: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    // Creating a glow effect
    shadowColor: colors.brand.primary,
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  northIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  northText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginLeft: 20,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold', // Mono usually better for numbers but system font fine
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    height: '80%',
    alignSelf: 'center',
  },
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
});
