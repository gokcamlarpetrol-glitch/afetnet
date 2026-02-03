/**
 * PREMIUM COUNTDOWN MODAL
 * 
 * ELITE: Lüks ve zarif tasarımla premium erken deprem uyarı sistemi
 * Modern animasyonlar, premium görsel efektler, gerçek zamanlı geri sayım
 * Kullanıcılara premium bir uygulama kullandıklarını hissettirir
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, interpolate, Easing } from 'react-native-reanimated';
import { createLogger } from '../utils/logger';

const logger = createLogger('PremiumCountdownModal');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface PremiumCountdownData {
  eventId: string;
  magnitude: number;
  location: string;
  region?: string;
  source: string;
  secondsRemaining: number;
  pWaveETA?: number;
  sWaveETA?: number;
  distance?: number;
  alertLevel?: 'caution' | 'action' | 'imminent';
  recommendedAction?: string;
}

interface PremiumCountdownModalProps {
  visible: boolean;
  data: PremiumCountdownData | null;
  onDismiss: () => void;
}

const ReanimatedView = Animated.createAnimatedComponent(View);
const ReanimatedText = Animated.createAnimatedComponent(Text);

// ELITE: Forward ref for external control
const PremiumCountdownModal = React.forwardRef<any, PremiumCountdownModalProps>(
  ({ visible, data, onDismiss }, ref) => {
    const [countdown, setCountdown] = useState(0);
    const [isDismissed, setIsDismissed] = useState(false);
    const [internalData, setInternalData] = useState<PremiumCountdownData | null>(null);

    // Use internal data or prop data
    const displayData = internalData || data;

    // ELITE: Premium animasyonlar
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Reanimated values for smooth animations
    const progress = useSharedValue(0);
    const numberScale = useSharedValue(1);
    const numberRotation = useSharedValue(0);

    // ELITE: Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      show: (newData: PremiumCountdownData) => {
        setInternalData(newData);
        setCountdown(newData.secondsRemaining);
      },
      dismiss: () => {
        setIsDismissed(true);
        setTimeout(onDismiss, 300);
      },
    }));

    // Geri sayım efekti
    useEffect(() => {
      if (!visible || !displayData) {
        setCountdown(0);
        setIsDismissed(false);
        return undefined;
      }

      setCountdown(Math.max(0, Math.floor(displayData.secondsRemaining)));

      const interval = setInterval(() => {
        setCountdown((prev) => {
          const next = Math.max(0, prev - 1);

          // ELITE: Haptic feedback at critical moments
          if (next <= 10 && next > 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
          }
          if (next === 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
          }

          return next;
        });
      }, 1000);

      return () => clearInterval(interval);
    }, [visible, displayData]);

    // ELITE: Premium animasyonlar başlat
    useEffect(() => {
      if (!visible) {
        // Reset animations
        pulseAnim.setValue(1);
        scaleAnim.setValue(0.8);
        rotateAnim.setValue(0);
        glowAnim.setValue(0);
        slideAnim.setValue(SCREEN_HEIGHT);
        progress.value = 0;
        numberScale.value = 1;
        numberRotation.value = 0;
        return;
      }

      // Slide in animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Pulse animation (continuous)
      Animated.loop(
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
        ]),
      ).start();

      // Scale animation
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      // Rotate animation (subtle)
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 20000,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
      ).start();

      // Glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      // Progress animation
      if (displayData) {
        const totalSeconds = displayData.secondsRemaining;
        progress.value = withTiming(1, {
          duration: totalSeconds * 1000,
          easing: Easing.linear,
        });
      }
    }, [visible, displayData]);

    // Number animation on countdown change
    useEffect(() => {
      if (countdown > 0) {
        // Scale animation
        numberScale.value = withSequence(
          withTiming(1.3, { duration: 150, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 150, easing: Easing.in(Easing.cubic) }),
        );

        // Rotation animation
        numberRotation.value = withSequence(
          withTiming(5, { duration: 150 }),
          withTiming(-5, { duration: 150 }),
          withTiming(0, { duration: 150 }),
        );
      }
    }, [countdown]);

    // Animated styles
    const pulseStyle = {
      transform: [{ scale: pulseAnim }],
    };

    const scaleStyle = {
      transform: [{ scale: scaleAnim }],
    };

    const rotateStyle = {
      transform: [
        {
          rotate: rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }),
        },
      ],
    };

    const glowOpacity = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.8],
    });

    const slideStyle = {
      transform: [{ translateY: slideAnim }],
    };

    const numberAnimatedStyle = useAnimatedStyle(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transforms: any[] = [
        { scale: numberScale.value },
      ];
      if (numberRotation.value !== 0) {
        transforms.push({ rotateZ: `${numberRotation.value}deg` });
      }
      return {
        transform: transforms,
      };
    });

    const progressAnimatedStyle = useAnimatedStyle(() => {
      return {
        width: `${(1 - progress.value) * 100}%`,
      };
    });

    // Alert level colors
    const getAlertColors = () => {
      if (!displayData?.alertLevel) {
        return {
          primary: '#FF6B6B',
          secondary: '#FF8E8E',
          accent: '#FFB3B3',
          text: '#FFFFFF',
        };
      }

      switch (displayData.alertLevel) {
        case 'imminent':
          return {
            primary: '#FF0000',
            secondary: '#FF3333',
            accent: '#FF6666',
            text: '#FFFFFF',
          };
        case 'action':
          return {
            primary: '#FF6B00',
            secondary: '#FF8E33',
            accent: '#FFB366',
            text: '#FFFFFF',
          };
        case 'caution':
          return {
            primary: '#FFB800',
            secondary: '#FFCC33',
            accent: '#FFE066',
            text: '#000000',
          };
        default:
          return {
            primary: '#FF6B6B',
            secondary: '#FF8E8E',
            accent: '#FFB3B3',
            text: '#FFFFFF',
          };
      }
    };

    const colors = getAlertColors();

    // Get urgency text
    const getUrgencyText = () => {
      if (countdown <= 5) return 'ÇOK YAKIN!';
      if (countdown <= 10) return 'HAREKETE GEÇ!';
      if (countdown <= 20) return 'HAZIRLAN!';
      return 'DİKKATLİ OL';
    };


    if (!visible || !displayData) return null;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={onDismiss}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* ELITE: Premium blur background */}
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

        {/* ELITE: Animated gradient overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.95)', 'rgba(0,0,0,0.9)']}
          style={StyleSheet.absoluteFill}
        />

        {/* ELITE: Animated content */}
        <ReanimatedView style={[styles.container, slideStyle]}>
          {/* ELITE: Premium header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>ERKEN UYARI SİSTEMİ</Text>
            <Text style={styles.headerSubtitle}>AfetNet Premium</Text>
          </View>

          {/* ELITE: Urgency indicator */}
          <ReanimatedView style={[styles.urgencyContainer, pulseStyle]}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.urgencyGradient}
            >
              <ReanimatedView style={[styles.glowEffect, { opacity: glowOpacity }]} />
              <Text style={[styles.urgencyText, { color: colors.text }]}>
                {getUrgencyText()}
              </Text>
            </LinearGradient>
          </ReanimatedView>

          {/* ELITE: Premium countdown display */}
          <ReanimatedView style={[styles.countdownContainer, scaleStyle]}>
            <LinearGradient
              colors={[colors.primary, colors.secondary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.countdownGradient}
            >
              {/* ELITE: Rotating ring */}
              <ReanimatedView style={[styles.rotatingRing, rotateStyle]}>
                <View style={styles.ringInner} />
              </ReanimatedView>

              {/* ELITE: Countdown number */}
              <Animated.View style={numberAnimatedStyle}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
              </Animated.View>

              <Text style={styles.countdownLabel}>SANİYE</Text>
            </LinearGradient>
          </ReanimatedView>

          {/* ELITE: Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View style={[styles.progressBarFill, progressAnimatedStyle, { backgroundColor: colors.primary }]} />
            </View>
          </View>

          {/* ELITE: Earthquake info */}
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>BÜYÜKLÜK</Text>
              <Text style={styles.infoValue}>M{displayData.magnitude.toFixed(1)}</Text>
            </View>

            {displayData.distance && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>MESAFE</Text>
                <Text style={styles.infoValue}>{Math.round(displayData.distance)} km</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>KONUM</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {displayData.region || displayData.location}
              </Text>
            </View>

            {displayData.recommendedAction && (
              <View style={styles.actionContainer}>
                <Text style={styles.actionLabel}>ÖNERİLEN AKSİYON</Text>
                <Text style={styles.actionText}>{displayData.recommendedAction}</Text>
              </View>
            )}
          </View>

          {/* ELITE: Premium dismiss button */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => {
              setIsDismissed(true);
              setTimeout(onDismiss, 300);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              style={styles.dismissButtonGradient}
            >
              <Text style={styles.dismissButtonText}>Kapat</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ReanimatedView>
      </Modal>
    );
  });

PremiumCountdownModal.displayName = 'PremiumCountdownModal';

export default PremiumCountdownModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2,
    color: '#FFFFFF',
    opacity: 0.6,
  },
  urgencyContainer: {
    marginBottom: 32,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  urgencyGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  glowEffect: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  urgencyText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  countdownContainer: {
    width: 280,
    height: 280,
    borderRadius: 140,
    marginBottom: 32,
    overflow: 'hidden',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 15,
  },
  countdownGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  rotatingRing: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringInner: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  countdownNumber: {
    fontSize: 120,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    letterSpacing: -4,
  },
  countdownLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: -8,
  },
  progressContainer: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 32,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  infoContainer: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#FFFFFF',
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#FFFFFF',
    opacity: 0.7,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  dismissButton: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dismissButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

