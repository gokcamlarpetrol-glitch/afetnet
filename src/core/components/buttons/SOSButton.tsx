/**
 * SOS BUTTON - ELITE V2
 * Premium emergency button with long-press activation
 * 
 * FEATURES:
 * - 3-second long-press activation
 * - Pulse animation (idle)
 * - Fill animation (pressing)
 * - Status indicator (countdown/active)
 * - Haptic feedback
 * - Accessibility support
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  Animated,
  View,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '../../theme';
import * as haptics from '../../utils/haptics';
import { unifiedSOSController, useSOSStore } from '../../services/sos';

// ============================================================================
// CONFIGURATION
// ============================================================================

const LONG_PRESS_DURATION = 3000; // 3 seconds
const PULSE_DURATION = 1000;
const BUTTON_SIZE = 180;

// ============================================================================
// PROPS
// ============================================================================

interface SOSButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  compact?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SOSButton({
  onPress,
  disabled = false,
  compact = false,
}: SOSButtonProps) {
  // State
  const [isPressing, setIsPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);

  // Store
  const { isActive, isCountingDown, countdownSeconds } = useSOSStore();

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Timer refs
  const pressStartTime = useRef<number>(0);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Dynamic sizing
  const buttonSize = compact ? 120 : BUTTON_SIZE;
  const iconSize = compact ? 32 : 48;

  // ============================================================================
  // PULSE ANIMATION (IDLE STATE)
  // ============================================================================

  useEffect(() => {
    if (disabled || isPressing || isActive) return undefined;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: PULSE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: PULSE_DURATION,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => pulse.stop();
  }, [disabled, isPressing, isActive, pulseAnim]);

  // ============================================================================
  // SHAKE ANIMATION (ACTIVE STATE)
  // ============================================================================

  useEffect(() => {
    if (!isActive) return undefined;

    const shake = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
    );

    shake.start();

    return () => shake.stop();
  }, [isActive, shakeAnim]);

  // ============================================================================
  // LONG PRESS HANDLERS
  // ============================================================================

  const handlePressIn = useCallback(() => {
    if (disabled || isActive) return;

    setIsPressing(true);
    pressStartTime.current = Date.now();

    // Start haptic feedback
    haptics.impactLight();

    // Animate fill
    Animated.timing(fillAnim, {
      toValue: 1,
      duration: LONG_PRESS_DURATION,
      useNativeDriver: false,
    }).start();

    // Progress tracking
    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - pressStartTime.current;
      const progress = Math.min(elapsed / LONG_PRESS_DURATION, 1);
      setPressProgress(progress);

      // Haptic feedback at milestones
      if (progress >= 0.33 && progress < 0.34) {
        haptics.impactMedium();
      } else if (progress >= 0.66 && progress < 0.67) {
        haptics.impactHeavy();
      }

      // Trigger SOS when complete
      if (progress >= 1) {
        handleLongPressComplete();
      }
    }, 50);
  }, [disabled, isActive, fillAnim]);

  const handlePressOut = useCallback(() => {
    if (!isPressing) return;

    setIsPressing(false);
    setPressProgress(0);

    // Stop fill animation
    fillAnim.stopAnimation();
    Animated.timing(fillAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();

    // Clear interval
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  }, [isPressing, fillAnim]);

  const handleLongPressComplete = useCallback(() => {
    // Clear interval
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    setIsPressing(false);
    setPressProgress(0);

    // Heavy haptic feedback
    haptics.impactHeavy();
    haptics.notificationError();
    Vibration.vibrate([0, 100, 50, 100, 50, 100]);

    // Trigger SOS
    if (onPress) {
      onPress();
    } else {
      unifiedSOSController.triggerSOS();
    }
  }, [onPress]);

  // ============================================================================
  // TAP HANDLER (When active - to stop)
  // ============================================================================

  const handleTap = useCallback(() => {
    if (isActive) {
      // Show confirmation before stopping
      // For now, just stop directly
      unifiedSOSController.cancelSOS();
    }
  }, [isActive]);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getStatusText = () => {
    if (isCountingDown) {
      return countdownSeconds.toString();
    }
    if (isActive) {
      return 'AKTİF';
    }
    if (isPressing) {
      return `%${Math.round(pressProgress * 100)}`;
    }
    return 'SOS';
  };

  const getSubText = () => {
    if (isCountingDown) {
      return 'YAYIN BAŞLIYOR';
    }
    if (isActive) {
      return 'Durdurmak için tıkla';
    }
    if (isPressing) {
      return 'Basılı tutun';
    }
    return 'ACİL DURUM';
  };

  const gradientColors = isActive
    ? ['#ff0000', '#cc0000', '#990000'] as const
    : ['#ff1744', '#d50000', '#b71c1c'] as const;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Pulse Rings */}
      {!disabled && !isPressing && !isActive && (
        <>
          <Animated.View
            style={[
              styles.pulseRing,
              { width: buttonSize + 20, height: buttonSize + 20, borderRadius: (buttonSize + 20) / 2 },
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
              { width: buttonSize + 40, height: buttonSize + 40, borderRadius: (buttonSize + 40) / 2 },
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

      {/* Main Button */}
      <Animated.View
        style={[
          {
            transform: [
              {
                translateX: shakeAnim.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [-3, 0, 3],
                })
              }
            ]
          },
        ]}
      >
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={isActive ? handleTap : undefined}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Acil Durum SOS Butonu"
          accessibilityHint="Acil durumda 3 saniye basılı tutarak yardım çağrısı gönderin"
          accessibilityState={{ disabled }}
          style={[
            styles.button,
            { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
            disabled && styles.disabled,
          ]}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradient, { borderRadius: buttonSize / 2 }]}
          >
            {/* Fill Progress Overlay */}
            {isPressing && (
              <Animated.View
                style={[
                  styles.fillOverlay,
                  {
                    height: fillAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            )}

            {/* Content */}
            <View style={styles.content}>
              {!isCountingDown && (
                <View style={styles.iconContainer}>
                  <Ionicons
                    name={isActive ? 'radio' : 'alert-circle'}
                    size={iconSize}
                    color={colors.text.primary}
                  />
                </View>
              )}

              <Text style={[
                styles.mainText,
                compact && styles.mainTextCompact,
                isCountingDown && styles.countdownText,
              ]}>
                {getStatusText()}
              </Text>

              <Text style={[styles.subText, compact && styles.subTextCompact]}>
                {getSubText()}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Status Indicator */}
      {isActive && (
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>YAYIN YAPILIYOR</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  containerCompact: {
    marginVertical: 10,
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: '#ff1744',
  },
  button: {
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#ff1744',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
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
  fillOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 8,
  },
  mainText: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '900',
    textAlign: 'center',
  },
  mainTextCompact: {
    fontSize: 24,
  },
  countdownText: {
    fontSize: 64,
    lineHeight: 72,
  },
  subText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.9,
  },
  subTextCompact: {
    fontSize: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 23, 68, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ff1744',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff1744',
    marginRight: 8,
  },
  statusText: {
    ...typography.caption,
    color: '#ff1744',
    fontWeight: '700',
  },
});
