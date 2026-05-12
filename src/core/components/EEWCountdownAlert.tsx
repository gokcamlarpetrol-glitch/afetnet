/**
 * EEW COUNTDOWN ALERT — Global Life-Safety Overlay
 *
 * Bu component App.tsx'in en üstünde mount edilir ve EEW countdown engine'in
 * isActive olduğu her an FULLSCREEN olarak ekrana basar. Kullanıcı hangi ekranda
 * olursa olsun deprem uyarısı anında görünür.
 *
 * UX Pattern:
 *   - Faz 1 (warning, >10s): Sarı arka plan, geri sayım, "Hazırlanın"
 *   - Faz 2 (imminent, 5-10s): Turuncu arka plan, daha büyük sayı
 *   - Faz 3 (impact, <5s): Kırmızı yanıp sönen, "EĞİL — KAPAN — TUTUN"
 *   - Faz 4 (ended): Otomatik kaybolur 3sn sonra
 *
 * Pasif (isActive=false) durumda hiçbir şey render etmez (zero cost).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Modal,
  Pressable,
  Platform,
  AccessibilityInfo,
  Vibration,
  Animated as RNAnimated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useEEWCountdown, eewCountdownEngine } from '../services/EEWCountdownEngine';
import { createLogger } from '../utils/logger';

const logger = createLogger('EEWCountdownAlert');

export function EEWCountdownAlert() {
  const insets = useSafeAreaInsets();
  const {
    isActive,
    secondsRemaining,
    phase,
    urgencyLevel,
    magnitude,
    location,
    epicentralDistance,
    estimatedIntensity,
  } = useEEWCountdown();

  // Local visibility state — keeps overlay on screen briefly during 'ended' phase
  // so user sees "Sallantı bitiyor" feedback instead of abrupt disappear.
  const [visible, setVisible] = useState(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const announcedRef = useRef(false);
  // CRITICAL FIX (EEW-C4): isMountedRef prevents setState after unmount during 3s linger.
  // User can navigate away DURING the linger window; component unmounts but timer fires
  // setVisible(false) on dead component → RN warning + potential crash.
  const isMountedRef = useRef(true);

  // Track mount lifecycle separately from per-render effect
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      setVisible(true);
      announcedRef.current = false;
      logger.info('EEW countdown UI activated', { magnitude, location, secondsRemaining });
    } else if (visible) {
      // Linger 3s after countdown ends, then hide
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return; // CRITICAL: guard against setState after unmount
        setVisible(false);
        announcedRef.current = false;
      }, 3000);
    }
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [isActive, visible, magnitude, location, secondsRemaining]);

  // Accessibility: announce once when countdown starts (screen reader)
  useEffect(() => {
    if (isActive && !announcedRef.current && magnitude && location) {
      announcedRef.current = true;
      const msg = `Deprem yaklaşıyor. ${location} merkezli, büyüklük ${magnitude.toFixed(1)}. ${secondsRemaining} saniye sonra yer sallanması başlayacak. Eğil, kapan, tutun.`;
      AccessibilityInfo.announceForAccessibility(msg);
    }
  }, [isActive, magnitude, location, secondsRemaining]);

  // Pulsing animation for the countdown number
  const pulseScale = useSharedValue(1);
  useEffect(() => {
    if (phase === 'impact' || phase === 'imminent') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 300, easing: Easing.out(Easing.cubic) }),
          withTiming(1.0, { duration: 300, easing: Easing.in(Easing.cubic) }),
        ),
        -1,
        false,
      );
    } else {
      pulseScale.value = withTiming(1.0, { duration: 200 });
    }
  }, [phase, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Strobe background for IMPACT phase
  const strobeOpacity = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    if (phase === 'impact') {
      const strobe = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(strobeOpacity, { toValue: 0.6, duration: 200, useNativeDriver: true }),
          RNAnimated.timing(strobeOpacity, { toValue: 1.0, duration: 200, useNativeDriver: true }),
        ]),
      );
      strobe.start();
      return () => strobe.stop();
    } else {
      strobeOpacity.setValue(1);
    }
    return undefined;
  }, [phase, strobeOpacity]);

  // Vibration on impact entry (one-shot heavy)
  useEffect(() => {
    if (phase === 'impact') {
      try {
        Vibration.vibrate([0, 200, 100, 200, 100, 200]);
      } catch {
        /* no-op */
      }
    }
  }, [phase]);

  if (!visible) return null;

  const backgroundColor = phaseBackgroundColor(phase, urgencyLevel);
  const isEnded = phase === 'ended';
  const instructionText = phaseInstruction(phase);
  const subInstructionText = phaseSubInstruction(phase);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      // Critical: do NOT allow back-button dismiss during active countdown
      onRequestClose={() => {
        // Only allow dismiss when countdown ended
        if (isEnded) setVisible(false);
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      <RNAnimated.View style={[styles.fullscreen, { backgroundColor, opacity: strobeOpacity }]}>
        <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
          {/* Top header */}
          <View style={styles.header}>
            <Ionicons name="warning" size={36} color="#FFFFFF" />
            <Text style={styles.headerTitle} accessibilityRole="header">
              DEPREM YAKLAŞIYOR
            </Text>
            <Text style={styles.headerBeta}>ERKEN UYARI SİSTEMİ</Text>
          </View>

          {/* Countdown */}
          <View style={styles.countdownWrap}>
            {!isEnded ? (
              <>
                <Text style={styles.countdownLabel}>SANİYE</Text>
                <Animated.View style={pulseStyle}>
                  <Text style={styles.countdownNumber} accessibilityLabel={`${secondsRemaining} saniye kaldı`}>
                    {secondsRemaining}
                  </Text>
                </Animated.View>
              </>
            ) : (
              <View style={styles.endedBox}>
                <Ionicons name="checkmark-circle" size={56} color="#FFFFFF" />
                <Text style={styles.endedText}>UYARI SONA ERDİ</Text>
                <Text style={styles.endedSubtext}>Çevrenizi kontrol edin. Yaralı varsa 112'yi arayın.</Text>
              </View>
            )}
          </View>

          {/* Instruction (the action) */}
          {!isEnded && (
            <View style={styles.instructionBox} accessibilityLiveRegion="assertive">
              <Text style={styles.instructionText}>{instructionText}</Text>
              <Text style={styles.subInstructionText}>{subInstructionText}</Text>
            </View>
          )}

          {/* Event details (bottom) */}
          <View style={styles.detailsBox}>
            {magnitude !== null && (
              <DetailRow icon="pulse" label="Büyüklük" value={`${magnitude.toFixed(1)}`} />
            )}
            {location && <DetailRow icon="location" label="Merkez" value={location} />}
            {epicentralDistance !== null && (
              <DetailRow
                icon="navigate"
                label="Mesafe"
                value={`${Math.round(epicentralDistance)} km`}
              />
            )}
            {estimatedIntensity !== null && (
              <DetailRow icon="speedometer" label="Şiddet (MMI)" value={`${estimatedIntensity.toFixed(0)}`} />
            )}
          </View>

          {/* Manual dismiss only after end */}
          {isEnded && (
            <Pressable
              style={styles.dismissBtn}
              onPress={() => {
                setVisible(false);
                eewCountdownEngine.stopCountdown();
              }}
              accessibilityRole="button"
              accessibilityLabel="Uyarıyı kapat"
            >
              <Text style={styles.dismissBtnText}>Tamam</Text>
            </Pressable>
          )}
        </View>
      </RNAnimated.View>
    </Modal>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color="rgba(255,255,255,0.85)" />
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function phaseBackgroundColor(phase: string, urgency: string): string {
  if (phase === 'impact') return '#B91C1C';      // Strong red
  if (phase === 'imminent') return '#EA580C';    // Deep orange
  if (phase === 'ended') return '#16A34A';       // Green (passed)
  // warning phase — color by urgency
  if (urgency === 'critical') return '#DC2626';
  if (urgency === 'high') return '#F97316';
  if (urgency === 'medium') return '#D97706';
  return '#CA8A04';                              // Yellow (low urgency warning)
}

function phaseInstruction(phase: string): string {
  if (phase === 'impact') return 'EĞİL — KAPAN — TUTUN';
  if (phase === 'imminent') return 'HEMEN GÜVENLİ YERE GİT';
  if (phase === 'warning') return 'HAZIRLAN — GÜVENLİ YER BUL';
  return '';
}

function phaseSubInstruction(phase: string): string {
  if (phase === 'impact') return 'Masa altı — dizler üzerine — başı koru';
  if (phase === 'imminent') return 'Pencerelerden uzak dur, masa altı en güvenli';
  if (phase === 'warning') return 'Çıkışları kontrol et, asansör KULLANMA';
  return '';
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  headerBeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
  },
  countdownWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 8,
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontSize: 220,
    fontWeight: '900',
    lineHeight: 240,
    textAlign: 'center',
    ...Platform.select({
      ios: { fontVariant: ['tabular-nums'] },
      android: {},
    }),
  },
  instructionBox: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    marginBottom: 16,
    width: '100%',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  subInstructionText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  detailsBox: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  endedBox: {
    alignItems: 'center',
    gap: 12,
  },
  endedText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  endedSubtext: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  dismissBtn: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 24,
  },
  dismissBtnText: {
    color: '#16A34A',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
});

export default EEWCountdownAlert;
