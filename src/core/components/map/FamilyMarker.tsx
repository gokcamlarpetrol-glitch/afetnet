/**
 * FAMILY MARKER - FIND MY GRADE
 * Apple Find My style marker with battery, time-ago, and status visualization
 * 
 * Features:
 * - Real-time battery indicator
 * - Time-ago display (3dk önce, 2s önce)
 * - Stale/last-known indicator when battery died
 * - Pulse animation for urgent status
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeIn
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface FamilyMarkerProps {
  name: string;
  avatarUrl?: string;
  status: 'safe' | 'need-help' | 'critical' | 'unknown';
  lastSeen?: number;
  batteryLevel?: number; // 0-100
  isOnline?: boolean;
  isLastKnownLocation?: boolean; // True if showing cached location after battery died
}

// ELITE: Time-ago helper (Turkish)
function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'şimdi';
  if (minutes < 60) return `${minutes}dk`;
  if (hours < 24) return `${hours}s`;
  if (days < 7) return `${days}g`;
  return 'eski';
}

// ELITE: Battery icon based on level
function getBatteryIcon(level: number): string {
  if (level <= 10) return 'battery-dead';
  if (level <= 25) return 'battery-half'; // Actually shows as low
  if (level <= 50) return 'battery-half';
  if (level <= 75) return 'battery-half';
  return 'battery-full';
}

function getBatteryColor(level: number): string {
  if (level <= 10) return '#ef4444'; // Red
  if (level <= 20) return '#f97316'; // Orange
  return '#10b981'; // Green
}

export function FamilyMarker({
  name,
  avatarUrl,
  status,
  lastSeen,
  batteryLevel,
  isOnline = true,
  isLastKnownLocation = false,
}: FamilyMarkerProps) {
  const pulse = useSharedValue(1);

  // ELITE: Visual age detection
  const isStale = lastSeen ? (Date.now() - lastSeen) > (30 * 60 * 1000) : false; // 30 min
  const isVeryOld = lastSeen ? (Date.now() - lastSeen) > (60 * 60 * 1000) : false; // 1 hour

  // Time-ago display
  const timeAgoText = useMemo(() => {
    if (!lastSeen) return null;
    return getTimeAgo(lastSeen);
  }, [lastSeen]);

  const getStatusColor = (): [string, string] => {
    // Last known location (battery died) - show grey with special treatment
    if (isLastKnownLocation || isVeryOld) {
      return ['#6b7280', '#4b5563']; // Grey
    }

    if (!isOnline || isStale) {
      return ['#94a3b8', '#64748b']; // Slate grey for offline/stale
    }

    switch (status) {
      case 'safe':
        return ['#10b981', '#059669']; // Green
      case 'need-help':
        return ['#f59e0b', '#d97706']; // Orange
      case 'critical':
        return ['#ef4444', '#dc2626']; // Red
      default:
        return ['#6b7280', '#4b5563']; // Grey
    }
  };

  const getStatusIcon = (): string => {
    if (isLastKnownLocation) return 'location'; // Pin for last known
    if (!isOnline || isVeryOld) return 'cloud-offline'; // Offline icon

    switch (status) {
      case 'safe':
        return 'checkmark-circle';
      case 'need-help':
        return 'alert-circle';
      case 'critical':
        return 'warning';
      default:
        return 'person';
    }
  };

  useEffect(() => {
    // Pulse animation for critical/need-help status
    if ((status === 'critical' || status === 'need-help') && isOnline && !isStale) {
      pulse.value = withRepeat(
        withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 300 });
    }
  }, [status, isOnline, isStale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const pulseRingStyle = useAnimatedStyle(() => ({
    opacity: 0.4,
    transform: [{ scale: pulse.value * 1.2 }],
  }));

  const statusColors = getStatusColor();
  const icon = getStatusIcon();
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <View style={styles.container}>
      {/* Outer animated ring for pulse effect */}
      {(status === 'critical' || status === 'need-help') && isOnline && !isStale && (
        <Animated.View
          style={[
            styles.pulseRing,
            { backgroundColor: statusColors[0] },
            pulseRingStyle,
          ]}
        />
      )}

      {/* Main marker */}
      <Animated.View style={animatedStyle}>
        <LinearGradient
          colors={statusColors}
          style={[
            styles.marker,
            isLastKnownLocation && styles.markerLastKnown,
          ]}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <Text style={styles.initialsText}>{initials}</Text>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Status badge (bottom-right) */}
      <View style={[styles.statusBadge, { backgroundColor: statusColors[0] }]}>
        <Ionicons name={icon as any} size={10} color="#fff" />
      </View>

      {/* Battery indicator (bottom-left) - FIND MY STYLE */}
      {typeof batteryLevel === 'number' && (
        <View style={[styles.batteryBadge, { backgroundColor: getBatteryColor(batteryLevel) }]}>
          <Ionicons
            name={getBatteryIcon(batteryLevel) as any}
            size={8}
            color="#fff"
          />
          <Text style={styles.batteryText}>{batteryLevel}</Text>
        </View>
      )}

      {/* Time-ago label (below marker) - FIND MY STYLE */}
      {timeAgoText && (
        <View style={styles.timeContainer}>
          <Text style={[
            styles.timeText,
            isStale && styles.timeTextStale,
            isLastKnownLocation && styles.timeTextLastKnown,
          ]}>
            {isLastKnownLocation ? '⚡ Son Konum' : timeAgoText}
          </Text>
        </View>
      )}

      {/* Name label */}
      <View style={styles.nameContainer}>
        <Text style={styles.nameText} numberOfLines={1}>{name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  marker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  markerLastKnown: {
    borderStyle: 'dashed' as any, // Dashed border for last known
    opacity: 0.85,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  initialsText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 20, // Adjusted for name label
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  batteryBadge: {
    position: 'absolute',
    bottom: 20,
    left: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  batteryText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#ffffff',
  },
  timeContainer: {
    position: 'absolute',
    bottom: -2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
  },
  timeTextStale: {
    color: '#fbbf24', // Yellow for stale
  },
  timeTextLastKnown: {
    color: '#f87171', // Red for last known
  },
  nameContainer: {
    position: 'absolute',
    top: 48, // Below marker
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    maxWidth: 100,
  },
  nameText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
});
