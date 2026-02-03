import React, { useEffect } from 'react';
import { StyleSheet, ViewStyle, useWindowDimensions } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  LinearGradient,
  vec,
  BlurMask,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

interface SeismicWaveViewProps {
    style?: ViewStyle;
    data: number[]; // Normalized -1 to 1
    color?: string;
    speed?: number;
    amplitude?: number;
}

export const SeismicWaveView = ({
  style,
  data,
  color = '#ef4444', // Default red
  speed = 1,
  amplitude = 50,
}: SeismicWaveViewProps) => {
  const { width } = useWindowDimensions();
  const height = 150;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 2000 / speed, easing: Easing.linear }),
      -1,
      false,
    );
  }, [speed]);

  // Derived path for animation effect
  // Note: For true 60fps data visualization, we would normally use a FrameCallback
  // But for this UI effect, we'll render the static data with a shifting phase
  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    if (data.length === 0) return p;

    const step = width / (data.length - 1);
    const centerY = height / 2;
    const phase = progress.value * Math.PI * 2;

    p.moveTo(0, centerY);

    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      // Add a sine wave component for "aliveness"
      const liveOffset = Math.sin(x * 0.05 + phase) * (amplitude * 0.2);
      const y = centerY + (data[i] * amplitude) + liveOffset;
      p.lineTo(x, y);
    }

    return p;
  }, [data, width, height, amplitude]);

  // Gradient colors
  const gradientColors = [
    color + '00',
    color + 'FF',
    color + '00',
  ];

  return (
    <Canvas style={[styles.canvas, style]}>
      <Path
        path={path}
        color={color}
        style="stroke"
        strokeWidth={3}
      >
        <BlurMask blur={4} style="normal" />
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, 0)}
          colors={gradientColors}
        />
      </Path>
    </Canvas>
  );
};

const styles = StyleSheet.create({
  canvas: {
    height: 150,
    width: '100%',
  },
});
