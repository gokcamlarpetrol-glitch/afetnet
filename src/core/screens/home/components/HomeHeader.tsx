/**
 * HOME HEADER - ULTRA PREMIUM ELITE DESIGN V2
 * Single row layout with perfect alignment
 * Every pixel crafted for maximum impact
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeInDown,
  interpolate,
} from 'react-native-reanimated';

export default function HomeHeader() {
  const insets = useSafeAreaInsets();

  // Greeting Logic
  const hour = new Date().getHours();
  let greetingText = 'İyi Günler';
  let greetingIcon = 'sunny';
  if (hour < 6) {
    greetingText = 'İyi Geceler';
    greetingIcon = 'moon';
  } else if (hour < 12) {
    greetingText = 'Günaydın';
    greetingIcon = 'sunny';
  } else if (hour > 18) {
    greetingText = 'İyi Akşamlar';
    greetingIcon = 'moon-outline';
  }

  // Shimmer animation
  const shimmer = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.5);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 3000 }),
      -1,
      true,
    );

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0.5, { duration: 1500 }),
      ),
      -1,
      true,
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.85, 1, 0.85]),
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(600).springify()}
      style={[styles.container, { paddingTop: insets.top + 8 }]}
    >
      {/* ROW 1: Logo + User Name */}
      <View style={styles.topRow}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoLetter}>A</Text>
            <Text style={styles.logoLetter}>F</Text>
            <Text style={styles.logoLetter}>E</Text>
            <Text style={styles.logoLetter}>T</Text>
            <Animated.View style={shimmerStyle}>
              <LinearGradient
                colors={['#10B981', '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.highlightGradient}
              >
                <Text style={styles.logoLetterHighlight}>N</Text>
                <Text style={styles.logoLetterHighlight}>E</Text>
                <Text style={styles.logoLetterHighlight}>T</Text>
              </LinearGradient>
            </Animated.View>
          </View>

          {/* Accent Line */}
          <LinearGradient
            colors={['#10B981', '#3B82F6', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentLine}
          />
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.greetingRow}>
            <Ionicons name={greetingIcon as any} size={12} color="#F59E0B" />
            <Text style={styles.greetingText}>{greetingText}</Text>
          </View>
          <Text style={styles.userName}>Gökhan</Text>
        </View>
      </View>

      {/* ROW 2: Tagline + Location/Status (SAME LINE) */}
      <View style={styles.bottomRow}>
        {/* Left: Tagline */}
        <View style={styles.taglineContainer}>
          <View style={styles.taglineIcon}>
            <Ionicons name="shield-checkmark" size={9} color="#10B981" />
          </View>
          <Text style={styles.taglineText}>Hayat Kurtaran Teknoloji</Text>
        </View>

        {/* Right: Location + Status */}
        <View style={styles.statusContainer}>
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={9} color="#64748B" />
            <Text style={styles.locationText}>İstanbul</Text>
          </View>
          <View style={styles.dividerDot} />
          <View style={styles.statusBadge}>
            <Animated.View style={[styles.statusDot, pulseStyle]} />
            <Text style={styles.statusText}>Güvenli</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoContainer: {
    alignItems: 'flex-start',
  },
  logoTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoLetter: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  highlightGradient: {
    flexDirection: 'row',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  logoLetterHighlight: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  accentLine: {
    height: 2.5,
    width: 50,
    borderRadius: 1.25,
    marginTop: 4,
  },
  userInfo: {
    alignItems: 'flex-end',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greetingText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
    letterSpacing: -0.3,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  taglineIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  dividerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
});
