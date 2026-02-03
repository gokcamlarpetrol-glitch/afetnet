import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

interface FamilyMarkerProps {
  name: string;
  avatarUrl?: string;
  status: 'safe' | 'need-help' | 'critical' | 'unknown';
  lastSeen?: number; // ELITE: Persistence support
}

export function FamilyMarker({ name, avatarUrl, status, lastSeen }: FamilyMarkerProps) {
  const pulse = useSharedValue(1);

  // ELITE: Visual Aging Logic
  const isStale = lastSeen ? (Date.now() - lastSeen) > (60 * 60 * 1000) : false; // Older than 1h
  const displayStatus = isStale ? 'unknown' : status;

  const getStatusColor = () => {
    if (isStale) return ['#94a3b8', '#64748b']; // Slate/Grey for stale

    switch (status) {
    case 'safe':
      return ['#10b981', '#059669'];
    case 'need-help':
      return ['#f59e0b', '#d97706'];
    case 'critical':
      return ['#dc2626', '#991b1b'];
    default:
      return ['#6b7280', '#4b5563'];
    }
  };

  const getStatusIcon = () => {
    if (isStale) return 'time'; // Clock icon for stale data

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
    if (status === 'critical' || status === 'need-help') {
      pulse.value = withRepeat(
        withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    }
  }, [status]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const statusColors = getStatusColor();
  const icon = getStatusIcon();
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const pulseRingStyle = useAnimatedStyle(() => ({
    opacity: 0.3,
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Pulse ring for critical status */}
      {(status === 'critical' || status === 'need-help') && (
        <Animated.View
          style={[
            styles.pulseRing,
            { backgroundColor: statusColors[0] },
            pulseRingStyle,
          ]}
        />
      )}

      {/* Main marker */}
      <LinearGradient
        colors={statusColors as [string, string]}
        style={styles.marker}
      >
        {avatarUrl ? (
          <View style={styles.avatarContainer}>
            {/* Avatar would be loaded here if URL provided */}
            <Ionicons name={icon} size={16} color="#ffffff" />
          </View>
        ) : (
          <View style={styles.initialsContainer}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Status indicator */}
      <View style={[styles.statusBadge, { backgroundColor: statusColors[0] }]}>
        <Ionicons name={icon} size={10} color="#ffffff" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  avatarContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
