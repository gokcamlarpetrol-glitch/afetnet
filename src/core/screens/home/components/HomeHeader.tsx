/**
 * HOME HEADER - Premium 3D Globe Animation
 * 5-layer realistic Earth with lighting, shadows, and detailed continents
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { colors, typography } from '../../../theme';

export default function HomeHeader() {
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetworkStatus();
  const videoRef = useRef<Video>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Load and play video
    if (videoRef.current) {
      videoRef.current.playAsync();
    }

    // Subtle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Badge pulse (only when online)
    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(badgePulse, {
            toValue: 1.08,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(badgePulse, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isOnline]);

  return (
    <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
      <View style={styles.left}>
        {/* 3D Animated Globe Video */}
        <Animated.View
          style={[
            styles.globeContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={styles.videoWrapper}>
            <Video
              ref={videoRef}
              source={require('../../../../../assets/videos/globe.mp4')}
              style={styles.video}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay
              isMuted
              onLoad={() => setVideoLoaded(true)}
              onError={(error) => console.error('Video error:', error)}
            />
          </View>
        </Animated.View>
        
        <View>
          <Text style={styles.title}>AfetNet</Text>
          <Text style={styles.subtitle}>
            🚀 Hayat Kurtaran Teknoloji • Gerçek Zamanlı
          </Text>
        </View>
      </View>
      
      <Animated.View
        style={[
          styles.statusBadge,
          {
            backgroundColor: isOnline
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(100, 116, 139, 0.15)',
            transform: [{ scale: isOnline ? badgePulse : 1 }],
            borderColor: isOnline
              ? colors.status.online
              : colors.status.offline,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: isOnline ? colors.status.online : colors.status.offline,
              transform: [{ scale: isOnline ? badgePulse : 1 }],
            },
          ]}
        />
        <Text
          style={[
            styles.statusText,
            { color: isOnline ? colors.status.online : colors.status.offline },
          ]}
        >
          {isOnline ? 'CANLI' : 'OFFLİNE'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 20,
    paddingHorizontal: 4,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  globeContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden', // Siyah kısımları kes
    backgroundColor: 'transparent',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    position: 'relative', // For absolute positioned video
  },
  video: {
    width: '200%', // Zoom in - sadece dünya görünsün
    height: '200%', // Zoom in - sadece dünya görünsün
    position: 'absolute',
    left: '-50%', // Center the zoomed video
    top: '-50%', // Center the zoomed video
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.status.online,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1.5,
    shadowColor: colors.status.online,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: colors.status.online,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
