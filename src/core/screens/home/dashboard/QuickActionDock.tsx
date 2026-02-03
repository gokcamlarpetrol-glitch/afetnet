/**
 * QUICK ACTION DOCK - ELITE EDITION
 * "Living" SOS Button with Heartbeat Animation via Reanimated
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShinyButton } from '../../../components/21st/ShinyButton';
import { BlurView } from '../../../components/SafeBlurView';
import * as haptics from '../../../utils/haptics';
import { shadows } from '../../../theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  ZoomIn,
} from 'react-native-reanimated';

interface QuickActionDockProps {
    onSOSPress: () => void;
    onWhistlePress: () => void;
    onFlashlightPress: () => void;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const QuickActionDock: React.FC<QuickActionDockProps> = ({
  onSOSPress,
  onWhistlePress,
  onFlashlightPress,
}) => {
  // SOS Heartbeat Animation
  const scale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    shadowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 800 }),
        withTiming(0.3, { duration: 800 }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedSOSStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedShadowStyle = useAnimatedStyle(() => ({
    shadowOpacity: shadowOpacity.value,
  }));

  return (
    <Animated.View entering={ZoomIn.delay(500).springify()} style={styles.container}>
      <BlurView intensity={60} tint="light" style={styles.dock}>
        <ShinyButton
          onPress={() => {
            haptics.impactMedium();
            onWhistlePress();
          }}
          style={styles.actionButtonContainer}
          color="#F59E0B"
          icon={<Ionicons name="megaphone" size={24} color="#FFF" />}
        >
                    Düdük
        </ShinyButton>

        <AnimatedTouchableOpacity
          style={[styles.sosButton, animatedSOSStyle, animatedShadowStyle]}
          onPress={() => {
            haptics.impactHeavy();
            onSOSPress();
          }}
          activeOpacity={0.9}
        >
          <View style={styles.sosInner}>
            <Text style={styles.sosText}>SOS</Text>
          </View>
        </AnimatedTouchableOpacity>

        <ShinyButton
          onPress={() => {
            haptics.impactMedium();
            onFlashlightPress();
          }}
          style={styles.actionButtonContainer}
          color="#3B82F6"
          icon={<Ionicons name="flashlight" size={24} color="#FFF" />}
        >
                    Fener
        </ShinyButton>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 35,
    overflow: 'hidden',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.85)', // White glass
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.05)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  actionButton: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  actionButtonContainer: {
    marginBottom: 10,
    transform: [{ scale: 0.9 }],
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  label: {
    color: '#0F172A', // Navy
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.9,
  },
  sosButton: {
    marginBottom: 10,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 15,
    elevation: 15,
  },
  sosInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sosText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
