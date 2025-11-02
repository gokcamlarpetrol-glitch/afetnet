import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { colors } from '../../theme';
import { getMagnitudeColor } from '../../utils/mapUtils';

interface EarthquakeMarkerProps {
  magnitude: number;
  selected?: boolean;
}

export function EarthquakeMarker({ magnitude, selected = false }: EarthquakeMarkerProps) {
  const pulse = useSharedValue(1);
  const size = Math.max(24, magnitude * 5);
  // ... Component logic from original file
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* ... Component JSX from original file */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ... Styles for EarthquakeMarker from original file
});
