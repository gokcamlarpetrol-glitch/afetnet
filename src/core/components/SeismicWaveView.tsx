import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// CRITICAL FIX: Lazy import to prevent TurboModule crash when Skia native module not linked
let SkiaModule: any = null;
try {
  SkiaModule = require('@shopify/react-native-skia');
} catch (e) {
  console.warn('[SeismicWaveView] Skia native module not available, using fallback view');
}

interface SeismicWaveViewProps {
  style?: ViewStyle;
  data: number[]; // Normalized -1 to 1
  color?: string;
  speed?: number;
  amplitude?: number;
}

// Fallback component when Skia is not available
const FallbackWaveView = ({ style, color = '#ef4444' }: { style?: ViewStyle; color?: string }) => (
  <View style={[styles.canvas, style, { backgroundColor: color + '10', borderRadius: 8 }]} />
);

export const SeismicWaveView = ({
  style,
  data,
  color = '#ef4444',
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

  // If Skia is not available, render fallback
  if (!SkiaModule) {
    return <FallbackWaveView style={style} color={color} />;
  }

  const { Canvas, Path, Skia, LinearGradient, vec, BlurMask } = SkiaModule;

  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    if (data.length === 0) return p;

    const step = width / (data.length - 1);
    const centerY = height / 2;
    const phase = progress.value * Math.PI * 2;

    p.moveTo(0, centerY);

    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const liveOffset = Math.sin(x * 0.05 + phase) * (amplitude * 0.2);
      const y = centerY + (data[i] * amplitude) + liveOffset;
      p.lineTo(x, y);
    }

    return p;
  }, [data, width, height, amplitude]);

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
