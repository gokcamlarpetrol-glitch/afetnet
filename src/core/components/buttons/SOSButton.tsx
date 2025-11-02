/**
 * SOS BUTTON
 * Large, animated SOS button with pulse effect
 */

import React, { useEffect, useRef } from 'react';
import { Pressable, Text, StyleSheet, Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '../../theme';

interface SOSButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export default function SOSButton({ onPress, disabled = false }: SOSButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (disabled) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    return () => pulse.stop();
  }, [disabled, pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Pulse rings */}
      {!disabled && (
        <>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.1],
                  outputRange: [0.3, 0],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRing2,
              {
                transform: [
                  {
                    scale: pulseAnim.interpolate({
                      inputRange: [1, 1.1],
                      outputRange: [1, 1.2],
                    }),
                  },
                ],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.1],
                  outputRange: [0.2, 0],
                }),
              },
            ]}
          />
        </>
      )}

      {/* Button */}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <LinearGradient
          colors={['#ff1744', '#d50000', '#b71c1c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="alert-circle" size={48} color={colors.text.primary} />
          </View>
          <Text style={styles.text}>ACİL DURUM</Text>
          <Text style={styles.subtext}>SOS</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#ff1744',
  },
  pulseRing2: {
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  button: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#ff1744',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    opacity: 0.5,
  },
  gradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    marginBottom: 8,
  },
  text: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtext: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 4,
  },
});

