import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

interface MeshPeerMarkerProps {
    name: string;
    rssi: number;
    status: 'safe' | 'danger' | 'unknown';
    isSelected?: boolean;
}

export const MeshPeerMarker = React.memo(({ name, rssi, status, isSelected }: MeshPeerMarkerProps) => {
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: 1.5 - pulseAnim.value * 0.5, // Fade out as it expands
  }));

  const getColor = () => {
    if (status === 'danger') return colors.status.danger;
    if (status === 'safe') return colors.status.success;
    return colors.status.info;
  };

  const color = getColor();

  return (
    <View style={styles.container}>
      {/* Pulse Ring */}
      <Animated.View style={[styles.pulse, animatedStyle, { borderColor: color, backgroundColor: color }]} />

      {/* Core Node */}
      <View style={[styles.core, { backgroundColor: color, transform: [{ scale: isSelected ? 1.2 : 1 }] }]}>
        <Ionicons name="radio-outline" size={14} color="#fff" />
      </View>

      {/* Label (Only if selected or very close) */}
      {(isSelected || rssi > -60) && (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>{name}</Text>
          <Text style={styles.rssiText}>{rssi}dBm</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  pulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    opacity: 0.3,
  },
  core: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  labelContainer: {
    position: 'absolute',
    top: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  labelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  rssiText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
  },
});
