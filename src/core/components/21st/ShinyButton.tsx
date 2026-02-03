import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable, Text, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  withSequence,
  withDelay,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as haptics from '../../utils/haptics';

interface ShinyButtonProps {
    onPress?: () => void;
    children: React.ReactNode;
    style?: ViewStyle;
    buttonStyle?: ViewStyle;
    textStyle?: TextStyle;
    color?: string;
    icon?: React.ReactNode;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export const ShinyButton: React.FC<ShinyButtonProps> = ({
  onPress,
  children,
  style,
  buttonStyle,
  textStyle,
  color = '#F59E0B',
  icon,
}) => {
  const shineProgress = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    shineProgress.value = withRepeat(
      withDelay(2000,
        withTiming(1, {
          duration: 1500,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
        }),
      ),
      -1,
      false,
    );
  }, []);

  const animatedGradientStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: interpolate(shineProgress.value, [0, 1], [-100, 100]) as unknown as number },
      ],
    };
  });

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 100 });
    haptics.impactLight();
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  return (
    <Animated.View style={[styles.container, style, animatedButtonStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.button, buttonStyle]}
      >
        <AnimatedLinearGradient
          colors={[color, color + 'CC']} // Slight gradient for depth
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          {typeof children === 'string' ? (
            <Text style={[styles.text, textStyle]}>{children}</Text>
          ) : (
            children
          )}
        </View>

        {/* Shine Effect Overlay */}
        <View style={[StyleSheet.absoluteFill, styles.overflowHidden]}>
          <AnimatedLinearGradient
            colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFill, { width: '150%' }, animatedGradientStyle]}
          />
        </View>

        {/* Glass Border */}
        <View style={styles.glassBorder} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  overflowHidden: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 20,
  },
});
