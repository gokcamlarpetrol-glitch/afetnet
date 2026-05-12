/**
 * EMERGENCY BUTTON - APPLE-GRADE SOS COMMAND CENTER
 *
 * Apple "Slide to Power Off" quality slider with integrated emergency tools.
 *
 * Performance Architecture (Zero Jank):
 * - ALL gesture math runs on native UI thread (worklets)
 * - NO runOnJS during gesture — side effects via useAnimatedReaction
 * - NO width/height animation — GPU-composited transform only
 * - Progressive haptics via quantized useAnimatedReaction
 * - Apple WWDC23 spring physics (duration/bounce → stiffness/damping)
 * - Rubber-band physics at boundaries
 * - Dynamic thumb glow intensification
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';
import * as haptics from '../../../utils/haptics';
import { useUserStatusStore } from '../../../stores/userStatusStore';
import { whistleService } from '../../../services/WhistleService';
import { flashlightService } from '../../../services/FlashlightService';
import { batterySaverService } from '../../../services/BatterySaverService';
import { createLogger } from '../../../utils/logger';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  runOnJS,
  interpolate,
  interpolateColor,
  Easing,
  Extrapolation,
  cancelAnimation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const logger = createLogger('EmergencyButton');

// ============================================================================
// GEOMETRY — constants (non-width-dependent)
// Width-dependent values computed in component via useWindowDimensions
// ============================================================================

// HOME_PADDING: HomeScreen.tsx wraps content in paddingHorizontal: 20
const HOME_PADDING = 20;
const CARD_PADDING = 12;
const THUMB_SIZE = 64;
const TRACK_HEIGHT = 72;
const TRACK_INNER_PAD = (TRACK_HEIGHT - THUMB_SIZE) / 2;

// ============================================================================
// APPLE WWDC23 SPRING PHYSICS
// Apple parameterizes: duration + bounce → stiffness/damping
// Formula: stiffness = (2π/duration)², damping = (1-bounce)*4π/duration
// ============================================================================

// Snap-back: Apple .smooth (duration=0.5, bounce=0) — firm, no overshoot
const SPRING_SNAP_BACK = {
  stiffness: 170,
  damping: 26,
  mass: 1,
  overshootClamping: true,
};

// Thumb grab: Apple .interactiveSpring — ultra-responsive
const SPRING_GRAB = {
  stiffness: 400,
  damping: 18,
  mass: 0.6,
};

// Completion: Apple .snappy (duration=0.5, bounce=0.15) — satisfying arrival
const SPRING_COMPLETE = {
  stiffness: 180,
  damping: 22,
  mass: 1,
  overshootClamping: false,
};

// ============================================================================
// PREMIUM COLOR PALETTE
// ============================================================================

const COLORS = {
  cardBg: '#1A1A2E',
  cardBorder: 'rgba(220, 38, 38, 0.20)',
  sosDeep: '#B91C1C',
  sosVibrant: '#DC2626',
  sosGlow: '#EF4444',
  sosTrackBg: 'rgba(185, 28, 28, 0.25)',
  sosTrackFill: 'rgba(220, 38, 38, 0.55)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.85)',
  textMuted: 'rgba(255, 255, 255, 0.50)',
  textDim: 'rgba(255, 255, 255, 0.35)',
  amber: '#F59E0B',
  amberGlow: '#FBBF24',
  amberSurface: 'rgba(245, 158, 11, 0.12)',
  amberActive: 'rgba(245, 158, 11, 0.90)',
  emergency: '#EF4444',
  emergencySurface: 'rgba(239, 68, 68, 0.12)',
  divider: 'rgba(255, 255, 255, 0.06)',
};

// ============================================================================
// COMPONENT
// ============================================================================

interface EmergencyButtonProps {
  onPress: () => void;
}

export default function EmergencyButton({ onPress }: EmergencyButtonProps) {
  const { status } = useUserStatusStore();
  const [whistleActive, setWhistleActive] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [screenFlashlightVisible, setScreenFlashlightVisible] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission] = useCameraPermissions();

  // ELITE: Dynamic geometry for iPad Split View / rotation support
  // The card sits inside HomeScreen's paddingHorizontal: 20 (each side),
  // and the track sits inside the card's CARD_PADDING (each side).
  // Available track width = screenWidth - HOME_PADDING*2 - CARD_PADDING*2.
  // Cap at 420pt for comfortable panic-situation use on large devices (iPad etc.).
  const { width: screenWidth } = useWindowDimensions();
  const { TRACK_WIDTH, MAX_TRANSLATE, TRIGGER_THRESHOLD } = useMemo(() => {
    const availableWidth = screenWidth - HOME_PADDING * 2 - CARD_PADDING * 2;
    const tw = Math.min(availableWidth, 420);
    const mt = tw - THUMB_SIZE - TRACK_INNER_PAD * 2;
    return { TRACK_WIDTH: tw, MAX_TRANSLATE: mt, TRIGGER_THRESHOLD: mt * 0.88 };
  }, [screenWidth]);

  // ── Shared values (native UI thread) ──────────────────────────────────
  const translateX = useSharedValue(0);
  const isTriggered = useSharedValue(0);       // 0 or 1 — number for worklet safety
  const gestureActive = useSharedValue(0);     // 0 or 1
  const thumbScale = useSharedValue(1);
  const shimmerPhase = useSharedValue(-1);
  const pulseScale = useSharedValue(1);

  // ── FIX 15: Track slider progress for VoiceOver accessibilityValue ──
  const [sliderPercent, setSliderPercent] = useState(0);

  useAnimatedReaction(
    () => Math.round((Math.max(0, translateX.value) / Math.max(1, MAX_TRANSLATE)) * 100),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setSliderPercent)(current);
      }
    },
  );

  // ── JS callbacks (called ONLY via useAnimatedReaction, never during gesture) ──
  const fireSOS = useCallback(() => {
    haptics.impactHeavy();
    haptics.notificationSuccess();
    onPress();
  }, [onPress]);

  const hapticGrab = useCallback(() => {
    haptics.impactLight();
  }, []);

  const hapticRelease = useCallback(() => {
    haptics.impactMedium();
  }, []);

  const hapticSelection = useCallback(() => {
    haptics.selectionChanged();
  }, []);

  const hapticMedium = useCallback(() => {
    haptics.impactMedium();
  }, []);

  const hapticHeavy = useCallback(() => {
    haptics.impactHeavy();
  }, []);

  // ── useAnimatedReaction: SOS trigger (no runOnJS during gesture) ───────
  useAnimatedReaction(
    () => isTriggered.value,
    (current, previous) => {
      if (current === 1 && previous !== 1) {
        runOnJS(fireSOS)();
      }
    },
  );

  // ── useAnimatedReaction: gesture start/end haptic ─────────────────────
  useAnimatedReaction(
    () => gestureActive.value,
    (current, previous) => {
      if (current === 1 && previous !== 1) {
        runOnJS(hapticGrab)();
      } else if (current === 0 && previous === 1) {
        if (isTriggered.value === 0) {
          runOnJS(hapticRelease)();
        }
      }
    },
  );

  // ── useAnimatedReaction: progressive haptics every 20% ────────────────
  useAnimatedReaction(
    () => Math.floor((translateX.value / MAX_TRANSLATE) * 5), // 0–5 steps
    (currentStep, previousStep) => {
      if (previousStep === null || currentStep <= (previousStep ?? 0)) return;
      if (gestureActive.value === 0) return; // only during active drag
      if (currentStep >= 4) {
        runOnJS(hapticHeavy)();         // 80–100%: heavy
      } else if (currentStep >= 3) {
        runOnJS(hapticMedium)();        // 60–80%: medium
      } else {
        runOnJS(hapticSelection)();     // 0–60%: light selection
      }
    },
  );

  // ── Gesture: 100% native thread, NO runOnJS ───────────────────────────
  // FIX: activeOffsetX(6) — activate only on 6px rightward drag (was [-8,8]).
  //   - Single positive value = activate when translationX > 6 (rightward only)
  //   - Lower threshold (6px vs 8px) reduces "stuck thumb" feeling
  //   - failOffsetY [-14, 14] gives slightly more vertical tolerance for
  //     angled swipes (common in panic situations on slippery screens)
  // FIX: hitSlop adds 12px touch area around thumb for easier grab.
  // FIX: Move gestureActive/thumbScale to onStart (not onBegin) — onBegin fires
  //   before activation criteria are met, causing false positive visual feedback.
  // FIX: Set initial translateX on onStart to prevent the 6px visual jump
  //   when onChange first fires (onChange deltas are relative to activation point).
  const panGesture = Gesture.Pan()
    .activeOffsetX(6)
    .failOffsetY([-14, 14])
    .hitSlop({ left: 12, right: 12, top: 12, bottom: 12 })
    .onStart((event) => {
      'worklet';
      gestureActive.value = 1;
      thumbScale.value = withSpring(1.08, SPRING_GRAB);
      // Absorb the activation offset so thumb doesn't jump:
      // translationX at this point is the distance moved to activate (~6px).
      // Apply it immediately so the first onChange delta is continuous.
      const initial = Math.max(0, Math.min(event.translationX, MAX_TRANSLATE));
      translateX.value = initial;
    })
    .onChange((event) => {
      'worklet';
      const raw = translateX.value + event.changeX;

      if (raw > MAX_TRANSLATE) {
        // Rubber-band: logarithmic resistance past boundary (Apple-style)
        const overshoot = raw - MAX_TRANSLATE;
        translateX.value = MAX_TRANSLATE + Math.log(1 + overshoot * 0.12) * 6;
      } else if (raw < 0) {
        // Rubber-band at start
        const undershoot = -raw;
        translateX.value = -(Math.log(1 + undershoot * 0.12) * 6);
      } else {
        translateX.value = raw;
      }

      // Trigger detection — no JS bridge here, useAnimatedReaction handles it
      if (translateX.value >= TRIGGER_THRESHOLD && isTriggered.value === 0) {
        isTriggered.value = 1;
      }
    })
    .onFinalize(() => {
      'worklet';
      gestureActive.value = 0;
      thumbScale.value = withSpring(1, SPRING_SNAP_BACK);

      if (isTriggered.value === 1) {
        // ELITE: withSequence ensures snap-to-end plays BEFORE reset
        // Previous code: two separate assignments cancelled the first
        translateX.value = withSequence(
          withSpring(MAX_TRANSLATE, SPRING_COMPLETE),
          withDelay(2000, withSpring(0, SPRING_SNAP_BACK)),
        );
        isTriggered.value = withDelay(2500, withTiming(0, { duration: 0 }));
      } else {
        // Firm snap back — Apple .smooth, no bounce
        translateX.value = withSpring(0, SPRING_SNAP_BACK);
      }
    });

  // ── Animated styles: ALL use transform/opacity (GPU-composited) ───────

  // Thumb: position + scale + dynamic glow shadow
  const thumbAnimStyle = useAnimatedStyle(() => {
    const progress = Math.max(0, translateX.value) / MAX_TRANSLATE;
    return {
      transform: [
        { translateX: translateX.value } as { translateX: number },
        { scale: thumbScale.value } as { scale: number },
      ],
      shadowOpacity: interpolate(progress, [0, 0.5, 1], [0.25, 0.45, 0.70], Extrapolation.CLAMP),
      shadowRadius: interpolate(progress, [0, 1], [8, 22], Extrapolation.CLAMP),
    };
  });

  // Thumb glow blob (behind thumb, intensifies with progress)
  const thumbGlowAnimStyle = useAnimatedStyle(() => {
    const progress = Math.max(0, translateX.value) / MAX_TRANSLATE;
    return {
      transform: [
        { translateX: translateX.value } as { translateX: number },
        { scale: interpolate(progress, [0, 1], [1, 1.6], Extrapolation.CLAMP) } as { scale: number },
      ],
      opacity: interpolate(progress, [0, 0.3, 1], [0, 0.3, 0.7], Extrapolation.CLAMP),
    };
  });

  // Track fill: scaleX instead of width (NO layout recalculation)
  const trackFillAnimStyle = useAnimatedStyle(() => {
    const fillProgress = (Math.max(0, translateX.value) + THUMB_SIZE + TRACK_INNER_PAD) / TRACK_WIDTH;
    return {
      transform: [{ scaleX: Math.max(0.001, fillProgress) } as { scaleX: number }],
      opacity: interpolate(
        translateX.value,
        [0, MAX_TRANSLATE * 0.2],
        [0, 0.45],
        Extrapolation.CLAMP,
      ),
    };
  });

  // Track text: fades + slides left as thumb advances
  const trackTextAnimStyle = useAnimatedStyle(() => {
    const progress = Math.max(0, translateX.value) / MAX_TRANSLATE;
    return {
      opacity: interpolate(progress, [0, 0.2, 0.5], [1, 0.5, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(progress, [0, 0.5], [0, -15], Extrapolation.CLAMP) } as { translateX: number },
      ],
    };
  });

  // Track background: color intensifies during drag
  const trackBgAnimStyle = useAnimatedStyle(() => {
    const progress = Math.max(0, translateX.value) / MAX_TRANSLATE;
    const bgColor = interpolateColor(
      progress,
      [0, 0.5, 1],
      ['rgba(185, 28, 28, 0.25)', 'rgba(185, 28, 28, 0.40)', 'rgba(220, 38, 38, 0.55)'],
    );
    return { backgroundColor: bgColor };
  });

  // ── Ambient animations ────────────────────────────────────────────────
  useEffect(() => {
    // Apple shimmer: 2.2s sweep + 0.8s pause
    shimmerPhase.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withDelay(800, withTiming(-1, { duration: 0 })),
      ),
      -1,
      false,
    );

    // SOS dot pulse
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // ELITE: Cancel infinite animations on unmount to prevent memory leak
    return () => {
      cancelAnimation(shimmerPhase);
      cancelAnimation(pulseScale);
    };
  }, []);

  const shimmerAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      shimmerPhase.value,
      [-1, -0.4, 0, 0.4, 1],
      [0.35, 0.55, 1, 0.55, 0.35],
      Extrapolation.CLAMP,
    ),
    transform: [
      // Subtle horizontal drift for "light sweep" feel
      { translateX: interpolate(shimmerPhase.value, [-1, 1], [-3, 3], Extrapolation.CLAMP) } as { translateX: number },
    ],
  }));

  const pulseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value } as { scale: number }],
    opacity: interpolate(pulseScale.value, [1, 1.6], [0.9, 0], Extrapolation.CLAMP),
  }));

  // ── Service init ──────────────────────────────────────────────────────
  useEffect(() => {
    const initializeServices = async () => {
      try {
        await whistleService.initialize();
        await flashlightService.initialize();
        if (cameraRef.current) {
          flashlightService.setCameraRef(cameraRef.current);
        }
      } catch (error) {
        logger.error('Service initialization failed:', error);
      }
    };
    initializeServices();

    // ELITE: Stop whistle/flashlight on unmount to prevent battery drain
    return () => {
      whistleService.stop().catch(() => {});
      flashlightService.stop().catch(() => {});
      flashlightService.turnOffScreenFlashlight().catch(() => {});
    };
  }, []);

  // Auto-activate if trapped
  useEffect(() => {
    let alertTimeout: NodeJS.Timeout | null = null;
    if (status === 'trapped') {
      try {
        batterySaverService.enable();
      } catch (e) {
        logger.error('Battery saver err', e);
      }
      handleWhistle().catch((e) => logger.error('Auto-whistle err', e));
      handleFlashlight().catch((e) => logger.error('Auto-flash err', e));
      alertTimeout = setTimeout(() => {
        Alert.alert('Enkaz Algılandı', 'Düdük ve fener başlatıldı. Pil tasarrufu aktif.');
      }, 500);
    }
    return () => {
      if (alertTimeout) clearTimeout(alertTimeout);
    };
  }, [status]);

  // ── Hardware toggles ──────────────────────────────────────────────────
  const handleWhistle = useCallback(async () => {
    haptics.impactMedium();
    try {
      if (whistleActive) {
        await whistleService.stop();
        setWhistleActive(false);
      } else {
        await whistleService.initialize();
        await whistleService.playSOSWhistle('morse');
        setWhistleActive(true);
      }
    } catch (e) {
      logger.error('Whistle toggle error', e);
      Alert.alert('Düdük Hatası', 'Düdük çalınamadı. Lütfen tekrar deneyin.');
      setWhistleActive(false);
    }
  }, [whistleActive]);

  const handleFlashlight = useCallback(async () => {
    haptics.impactMedium();
    try {
      await flashlightService.initialize();
      if (flashActive || screenFlashlightVisible) {
        await flashlightService.stop();
        await flashlightService.turnOffScreenFlashlight();
        setScreenFlashlightVisible(false);
        setFlashActive(false);
      } else {
        if (flashlightService.isAvailable()) {
          await flashlightService.flashSOSMorse();
          setFlashActive(true);
        } else {
          await flashlightService.turnOnScreenFlashlight();
          setScreenFlashlightVisible(true);
          setFlashActive(true);
        }
      }
    } catch (e) {
      logger.error('Flash toggle error', e);
      Alert.alert('Fener Hatası', 'Fener açılamadı. Lütfen tekrar deneyin.');
      setFlashActive(false);
      setScreenFlashlightVisible(false);
    }
  }, [flashActive, screenFlashlightVisible]);

  const closeScreenFlashlight = useCallback(async () => {
    haptics.impactMedium();
    try {
      await flashlightService.turnOffScreenFlashlight();
    } catch (e) {
      logger.error('Screen flashlight off error', e);
    }
    setScreenFlashlightVisible(false);
    setFlashActive(false);
  }, []);

  const handle112Call = useCallback(async () => {
    haptics.impactHeavy();
    const url = 'tel:112';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Hata', 'Arama desteklenmiyor.');
    } catch (e) {
      logger.error('Call error', e);
      Alert.alert('Hata', '112 aranamadı.');
    }
  }, []);

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <View style={s.container}>
      {/* Screen Flashlight Modal */}
      <Modal
        visible={screenFlashlightVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeScreenFlashlight}
      >
        <StatusBar hidden />
        <TouchableOpacity
          style={s.screenFlashlight}
          activeOpacity={1}
          onPress={closeScreenFlashlight}
        >
          <View style={s.screenFlashlightContent}>
            <Text style={s.screenFlashlightText}>FENER</Text>
            <Text style={s.screenFlashlightSubtext}>Kapatmak için dokunun</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Hidden Camera for Torch — only mounted when flashlight is active to avoid
          Apple flagging always-on camera access and wasting battery */}
      {Device.isDevice && flashActive && (
        <CameraView
          ref={(ref) => {
            cameraRef.current = ref;
            if (ref) flashlightService.setCameraRef(ref);
          }}
          style={s.hiddenCamera}
          facing="back"
        />
      )}

      {/* ══ PREMIUM SOS COMMAND CENTER ══════════════════════════════════ */}
      <View style={s.card}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.sosDotContainer}>
              <Animated.View style={[s.sosDotPulse, pulseAnimStyle]} />
              <View style={s.sosDot} />
            </View>
            <Text style={s.sosLabel}>SOS</Text>
            <View style={s.headerDivider} />
            <Text style={s.headerSubtitle}>Acil Yardım Araçları</Text>
          </View>
        </View>

        {/* ── Slide Track ─────────────────────────────────────────── */}
        <View style={s.sliderSection}>
          <Animated.View style={[s.sliderTrack, { width: TRACK_WIDTH, alignSelf: 'center' }, trackBgAnimStyle]}>
            {/* Fill: uses scaleX (GPU) instead of width (layout) */}
            <Animated.View style={[s.trackFill, trackFillAnimStyle]} />

            {/* Shimmer text */}
            <Animated.View style={[s.trackTextContainer, trackTextAnimStyle]}>
              <Animated.View style={shimmerAnimStyle}>
                <View style={s.trackTextRow}>
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color="rgba(255,255,255,0.20)"
                  />
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color="rgba(255,255,255,0.40)"
                    style={s.chevronOverlap}
                  />
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color="rgba(255,255,255,0.65)"
                    style={s.chevronOverlap}
                  />
                  <Text style={s.trackText}>Kaydır — SOS Başlat</Text>
                </View>
              </Animated.View>
            </Animated.View>

            {/* Glow blob behind thumb (intensifies with progress) */}
            <Animated.View style={[s.thumbGlow, thumbGlowAnimStyle]} />

            {/* Draggable thumb */}
            <GestureDetector gesture={panGesture}>
              <Animated.View
                style={[s.thumb, thumbAnimStyle]}
                accessible={true}
                accessibilityRole="adjustable"
                accessibilityLabel="SOS Acil Yardım Kaydırıcısı"
                testID="sos-button"
                accessibilityHint="Sağa kaydırarak SOS sinyali gönderin"
                accessibilityValue={{ min: 0, max: 100, now: sliderPercent }}
              >
                <View style={s.thumbInner}>
                  <Ionicons name="warning" size={24} color={COLORS.sosVibrant} />
                </View>
              </Animated.View>
            </GestureDetector>
          </Animated.View>

          {/* Info badges */}
          <View style={s.badgeRow}>
            <View style={s.badge}>
              <Ionicons name="location-sharp" size={9} color={COLORS.textDim} />
              <Text style={s.badgeText}>Konum paylaşılır</Text>
            </View>
            <View style={s.badgeSep} />
            <View style={s.badge}>
              <Ionicons name="radio-sharp" size={9} color={COLORS.textDim} />
              <Text style={s.badgeText}>Yakınlara bildirilir</Text>
            </View>
            <View style={s.badgeSep} />
            <View style={s.badge}>
              <Ionicons name="cellular" size={9} color={COLORS.textDim} />
              <Text style={s.badgeText}>Mesh ağına yayılır</Text>
            </View>
          </View>
        </View>

        {/* ── Divider ─────────────────────────────────────────────── */}
        <View style={s.sectionDivider} />

        {/* ── Emergency Tools ─────────────────────────────────────── */}
        <View style={s.toolsSection}>
          <Text style={s.toolsSectionLabel}>Acil Araçlar</Text>
          <View style={s.toolsRow}>
            {/* Whistle */}
            <TouchableOpacity
              style={s.toolBtn}
              onPress={handleWhistle}
              activeOpacity={0.7}
            >
              <View style={[s.toolCard, whistleActive && s.toolCardActive]}>
                <View style={[s.toolIconWrap, whistleActive && s.toolIconWrapActive]}>
                  <Ionicons
                    name="megaphone"
                    size={20}
                    color={whistleActive ? '#FFF' : COLORS.amber}
                  />
                </View>
                <Text style={[s.toolLabel, whistleActive && s.toolLabelActive]}>
                  {whistleActive ? 'Durdur' : 'Düdük'}
                </Text>
                <Text style={[s.toolSublabel, whistleActive && s.toolSublabelActive]}>
                  {whistleActive ? 'SOS aktif' : 'SOS Morse'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Flashlight */}
            <TouchableOpacity
              style={s.toolBtn}
              onPress={handleFlashlight}
              activeOpacity={0.7}
            >
              <View style={[s.toolCard, flashActive && s.toolCardActive]}>
                <View style={[s.toolIconWrap, flashActive && s.toolIconWrapActive]}>
                  <Ionicons
                    name="flashlight"
                    size={20}
                    color={flashActive ? '#FFF' : COLORS.amber}
                  />
                </View>
                <Text style={[s.toolLabel, flashActive && s.toolLabelActive]}>
                  {flashActive ? 'Durdur' : 'Fener'}
                </Text>
                <Text style={[s.toolSublabel, flashActive && s.toolSublabelActive]}>
                  {flashActive ? 'SOS aktif' : 'SOS Sinyal'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* 112 Emergency */}
            <TouchableOpacity
              style={s.toolBtn}
              onPress={handle112Call}
              activeOpacity={0.7}
            >
              <View style={s.toolCard112}>
                <View style={s.toolIconWrap112}>
                  <Ionicons name="call" size={20} color={COLORS.emergency} />
                </View>
                <Text style={s.toolLabel112}>112</Text>
                <Text style={s.toolSublabel112}>Acil Çağrı</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  hiddenCamera: {
    width: 1,
    height: 1,
    position: 'absolute',
    opacity: 0,
  },

  // ── Premium Card ──────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: COLORS.sosGlow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 30,
    elevation: 12,
  },

  // ── Header ────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sosDotContainer: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.sosVibrant,
    position: 'absolute',
  },
  sosDotPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.sosGlow,
    position: 'absolute',
  },
  sosLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.sosVibrant,
    letterSpacing: 3,
  },
  headerDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
    letterSpacing: 0.2,
  },

  // ── Slider Section ────────────────────────────────────────────────────
  sliderSection: {
    paddingHorizontal: CARD_PADDING,
    paddingTop: 10,
  },
  sliderTrack: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',                     // Full width — scaleX controls visible portion
    transformOrigin: 'left center',    // Scale from left edge
    backgroundColor: COLORS.sosTrackFill,
    borderRadius: TRACK_HEIGHT / 2,
  },
  trackTextContainer: {
    position: 'absolute',
    left: THUMB_SIZE + TRACK_INNER_PAD + 8,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevronOverlap: {
    marginLeft: -5,
  },
  trackText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // ── Thumb ─────────────────────────────────────────────────────────────
  thumbGlow: {
    width: THUMB_SIZE + 16,
    height: THUMB_SIZE + 16,
    borderRadius: (THUMB_SIZE + 16) / 2,
    backgroundColor: COLORS.sosGlow,
    position: 'absolute',
    left: TRACK_INNER_PAD - 8,
    top: TRACK_INNER_PAD - 8,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    position: 'absolute',
    left: TRACK_INNER_PAD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  thumbInner: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Badges ────────────────────────────────────────────────────────────
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeSep: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textDim,
    letterSpacing: 0.2,
  },

  // ── Section Divider ───────────────────────────────────────────────────
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: 16,
    marginTop: 2,
  },

  // ── Tools Section ─────────────────────────────────────────────────────
  toolsSection: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  toolsSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toolBtn: {
    flex: 1,
  },
  toolCard: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  toolCardActive: {
    backgroundColor: COLORS.amberActive,
    borderColor: COLORS.amberGlow,
    shadowColor: COLORS.amberGlow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 6,
  },
  toolIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.amberSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIconWrapActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  toolLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  toolLabelActive: {
    color: '#FFFFFF',
  },
  toolSublabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textDim,
    letterSpacing: 0.2,
  },
  toolSublabelActive: {
    color: 'rgba(255, 255, 255, 0.80)',
  },
  toolCard112: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  toolIconWrap112: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.emergencySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel112: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.emergency,
    letterSpacing: 0.5,
  },
  toolSublabel112: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textDim,
    letterSpacing: 0.2,
  },

  // ── Screen Flashlight ─────────────────────────────────────────────────
  screenFlashlight: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenFlashlightContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenFlashlightText: {
    fontSize: 48,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.08)',
    letterSpacing: 4,
  },
  screenFlashlightSubtext: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.15)',
    marginTop: 8,
  },
});
