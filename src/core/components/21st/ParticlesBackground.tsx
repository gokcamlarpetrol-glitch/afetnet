import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming, Easing, useDerivedValue, SharedValue } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const PARTICLE_COUNT = 30;

interface Particle {
  x: number;
  y: number;
  r: number;
  opacity: number;
}

const createParticles = (): Particle[] => {
  return Array.from({ length: PARTICLE_COUNT }).map(() => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 3 + 1,
    opacity: Math.random() * 0.4 + 0.1,
  }));
};

const particlesData = createParticles();

export const ParticlesBackground: React.FC = () => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 10000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        <Group>
          {particlesData.map((p, i) => (
            <ParticleItem key={i} particle={p} progress={progress} index={i} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
};

const ParticleItem = ({ particle, progress, index }: { particle: Particle, progress: SharedValue<number>, index: number }) => {
  // Computed position based on progress
  const r = useDerivedValue(() => {
    // Simple breathing effect
    return particle.r + Math.sin(progress.value * Math.PI * 2 + index) * 1;
  });

  const cy = useDerivedValue(() => {
    // Slow drift upwards
    const drift = progress.value * 50;
    return (particle.y - drift + height) % height;
  });

  return (
    <Circle
      cx={particle.x}
      cy={cy}
      r={r}
      color={`rgba(56, 189, 248, ${particle.opacity})`}
    />
  );
};
