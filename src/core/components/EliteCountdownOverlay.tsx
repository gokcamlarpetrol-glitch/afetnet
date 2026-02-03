/**
 * ELITE COUNTDOWN OVERLAY
 * Full-screen overlay that displays even when screen is locked
 * Premium design with smooth animations and haptic feedback
 * Works on lock screen via React Native Modal with presentationStyle
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
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { BlurView } from 'expo-blur';
import * as haptics from '../utils/haptics';
import { useEEWStore } from '../../eew/store';
import { createLogger } from '../utils/logger';

const logger = createLogger('EliteCountdownOverlay');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function EliteCountdownOverlay() {
  const activeAlert = useEEWStore((state) => state.activeAlert);
  const active = !!activeAlert;
  const [countdown, setCountdown] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<Video>(null);

  // ELITE: Premium animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const numberScale = useRef(new Animated.Value(1)).current;
  const videoOpacityAnim = useRef(new Animated.Value(1)).current; // Video hemen görünsün

  // Haptic feedback interval
  const hapticIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (active && activeAlert) {
      // Calculate remaining time
      const now = Date.now();
      const arrivalTime = activeAlert.estimatedArrivalTime || (activeAlert.timestamp + 30000); // Default 30s if missing
      const remaining = Math.max(0, Math.ceil((arrivalTime - now) / 1000));

      setIsVisible(true);
      setCountdown(remaining);

      // ELITE: Video hemen görünsün - animasyon kaldırıldı
      videoOpacityAnim.setValue(1);

      // ELITE: Play video when overlay opens
      if (videoRef.current) {
        videoRef.current.playAsync().catch(() => { });
      }

      // ELITE: Entrance animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // ELITE: Pulse animation
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

      // ELITE: Glow animation
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

      // ELITE: Rotate animation removed - cleaner design

      // Start countdown
      const interval = setInterval(() => {
        setCountdown((prev) => {
          const next = Math.max(0, prev - 1);

          // ELITE: Haptic feedback on countdown change
          if (next !== prev && next > 0) {
            if (next <= 5) {
              haptics.impactHeavy().catch(() => { });
            } else if (next <= 10) {
              haptics.impactMedium().catch(() => { });
            } else {
              haptics.impactLight().catch(() => { });
            }

            // ELITE: Number scale animation on change
            Animated.sequence([
              Animated.timing(numberScale, {
                toValue: 1.2,
                duration: 100,
                useNativeDriver: true,
              }),
              Animated.timing(numberScale, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start();
          }

          return next;
        });
      }, 1000);

      return () => {
        clearInterval(interval);
        if (hapticIntervalRef.current) {
          clearInterval(hapticIntervalRef.current);
          hapticIntervalRef.current = null;
        }
      };
    } else {
      setIsVisible(false);
      // Video opacity'yi sıfırlamıyoruz - video görünür kalmalı
      setVideoLoaded(false);
      // Stop video when overlay closes
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => { });
      }
      // Exit animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [active, activeAlert]);

  if (!isVisible || !active) {
    return null;
  }

  const magnitude = activeAlert?.magnitude || 0;
  const region = activeAlert?.location || 'Bilinmeyen bölge';
  const source = activeAlert?.source || 'AFAD';

  // Determine alert level
  const alertLevel = countdown <= 5 ? 'imminent' : countdown <= 15 ? 'action' : 'caution';

  // Colors based on alert level
  const colors = {
    imminent: ['#ef4444', '#dc2626', '#991b1b'],
    action: ['#f59e0b', '#d97706', '#92400e'],
    caution: ['#3b82f6', '#2563eb', '#1e40af'],
  };

  const currentColors = colors[alertLevel];

  // Pulse opacity for urgent alerts
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  // Glow opacity
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // Number scale transform
  const numberScaleTransform = {
    transform: [{ scale: numberScale }],
  };

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      transparent={false}
      presentationStyle="overFullScreen" // CRITICAL: Shows even on lock screen
      statusBarTranslucent={true}
      hardwareAccelerated={true}
      onRequestClose={() => {
        // Don't allow dismiss on critical alerts
        if (alertLevel !== 'imminent') {
          useEEWStore.getState().clearActiveAlert();
        }
      }}
    >
      <StatusBar hidden={false} barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ELITE: World video background */}
      <View style={styles.videoContainer}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: videoOpacityAnim },
          ]}
        >
          <Video
            ref={videoRef}
            source={require('../../../assets/videos/globe.mp4')}
            style={styles.videoBackground}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted
            onLoadStart={() => {
              setVideoLoaded(false);
            }}
            onLoad={() => {
              setVideoLoaded(true);
              logger.info('World video loaded in EliteCountdownOverlay');
              if (videoRef.current) {
                videoRef.current.playAsync().catch(() => { });
              }
            }}
            onError={(error) => {
              logger.warn('Video load error:', error);
              setVideoLoaded(false);
            }}
          />
        </Animated.View>

        {/* ELITE: Minimal overlay - dünya videosu tamamen görünsün */}
        <Animated.View
          style={[
            styles.videoOverlay,
            {
              opacity: videoOpacityAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.2], // Minimal overlay - dünya videosu tamamen görünsün
              }),
            },
          ]}
        >
          <LinearGradient
            colors={
              alertLevel === 'imminent'
                ? ['rgba(0, 0, 0, 0.30)', 'rgba(26, 0, 0, 0.25)', 'rgba(0, 0, 0, 0.30)']
                : alertLevel === 'action'
                  ? ['rgba(15, 10, 0, 0.25)', 'rgba(26, 15, 0, 0.20)', 'rgba(15, 10, 0, 0.25)']
                  : ['rgba(5, 8, 18, 0.20)', 'rgba(10, 14, 26, 0.15)', 'rgba(5, 8, 18, 0.20)']
            }
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* ELITE: Fallback gradient if video fails */}
        {!videoLoaded && (
          <LinearGradient
            colors={['#000000', '#1a0000', '#000000']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>

      {/* ELITE: Animated glow overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: glowOpacity,
            zIndex: 2,
          },
        ]}
      >
        <LinearGradient
          colors={[`${currentColors[0]}40`, 'transparent', `${currentColors[0]}40`]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.container}>
        {/* ELITE: Main content with slide animation */}
        <Animated.View
          style={[
            styles.content,
            {
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
              zIndex: 10,
            },
          ]}
        >
          {/* ELITE: Alert level badge with enhanced glow */}
          <View style={styles.badgeContainer}>
            <LinearGradient
              colors={currentColors as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              {/* ELITE: Badge glow */}
              <View style={[styles.badgeGlow, { backgroundColor: `${currentColors[0]}30` }]} />
              <Text style={[
                styles.badgeText,
                {
                  textShadowColor: `${currentColors[0]}90`,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 15,
                },
              ]}>
                {alertLevel === 'imminent' ? '🚨 ÇOK YAKIN!' :
                  alertLevel === 'action' ? '⚠️ HAREKETE GEÇ!' :
                    '⚠️ HAZIRLAN!'}
              </Text>
            </LinearGradient>
          </View>

          {/* ELITE: Countdown number with pulse */}
          <Animated.View
            style={[
              styles.countdownContainer,
              {
                opacity: pulseOpacity,
              },
            ]}
          >
            <LinearGradient
              colors={currentColors as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.countdownGradient}
            >
              {/* ELITE: Countdown number */}
              <Animated.View style={numberScaleTransform}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
              </Animated.View>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.countdownLabel}>SANİYE</Text>

          {/* ELITE: Event information */}
          <View style={styles.infoContainer}>
            <Text style={styles.magnitudeText}>
              M{magnitude.toFixed(1)}
            </Text>
            <Text style={styles.regionText}>{region}</Text>
            <Text style={styles.sourceText}>Kaynak: {source}</Text>
          </View>

          {/* ELITE: Action instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionText}>
              {countdown <= 5
                ? '🚨 HEMEN GÜVENLİ YERE GEÇİN!'
                : countdown <= 15
                  ? '⚠️ Güvenli yere geçin ve çök-kapan-tutun pozisyonu alın'
                  : '⚠️ Güvenli yere geçmeye hazırlanın'}
            </Text>
          </View>

          {/* ELITE: Dismiss button (only for non-critical) */}
          {alertLevel !== 'imminent' && (
            <TouchableOpacity
              style={styles.dismissButton}
              activeOpacity={0.7}
              onPress={() => {
                haptics.impactLight();
                logger.info('Kapat butonu tıklandı');
                useEEWStore.getState().clearActiveAlert();
                setIsVisible(false);
              }}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.dismissButtonGradient}
              >
                <Text style={styles.dismissButtonText}>Kapat</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: 'transparent', // Video görünsün diye transparent
  },
  videoBackground: {
    width: SCREEN_WIDTH * 2, // Ana ekrandaki gibi zoom - dünya tamamen görünsün
    height: SCREEN_HEIGHT * 2, // Ana ekrandaki gibi zoom - dünya tamamen görünsün
    position: 'absolute',
    left: -SCREEN_WIDTH * 0.5, // Center the zoomed video
    top: -SCREEN_HEIGHT * 0.5, // Center the zoomed video
    opacity: 1, // Video tamamen görünür
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  content: {
    alignItems: 'center',
    padding: 32,
    width: '100%',
    zIndex: 10, // Content video'nun üstünde olmalı
    backgroundColor: 'transparent', // Video görünsün diye transparent
  },
  badgeContainer: {
    marginBottom: 32,
  },
  badge: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  badgeGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 28,
    opacity: 0.6,
  },
  badgeText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    zIndex: 1,
  },
  countdownContainer: {
    width: 220,
    height: 220,
    borderRadius: 110,
    marginBottom: 24,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 28,
  },
  countdownGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 110,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  countdownInnerGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: 20,
    left: 20,
  },
  // ELITE: Rotating ring styles removed - cleaner design without spinning circles
  countdownNumber: {
    fontSize: 130,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -6,
    zIndex: 10,
  },
  countdownLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 32,
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  infoCard: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  infoCardGradient: {
    padding: 24,
    alignItems: 'center',
    position: 'relative',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
  },
  magnitudeText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: -1,
    zIndex: 1,
  },
  regionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    zIndex: 1,
  },
  sourceText: {
    fontSize: 14,
    color: '#aaaaaa',
    textAlign: 'center',
    fontWeight: '600',
    zIndex: 1,
  },
  instructionsContainer: {
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    maxWidth: SCREEN_WIDTH - 64,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  instructionsGradient: {
    padding: 22,
    position: 'relative',
  },
  instructionsGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  instructionText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: 0.5,
    zIndex: 1,
  },
  dismissButton: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 16,
    zIndex: 100, // Buton en üstte olmalı - tıklanabilir olsun
  },
  dismissButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});

