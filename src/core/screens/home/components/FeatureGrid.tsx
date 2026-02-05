/**
 * FEATURE GRID - 2x3 Big Grid (6 Cards)
 * "Elite Color Edition" - Vibrant yet Elegant Gradients
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { LinearGradient } from '../../../components/SafeLinearGradient';
import { Ionicons } from '@expo/vector-icons';
import * as haptics from '../../../utils/haptics';
import { createLogger } from '../../../utils/logger';
import { colors } from '../../../theme';

const logger = createLogger('FeatureGrid');

const SCREEN_WIDTH = Dimensions.get('window').width;
// ELITE: iPad-aware card sizing - max 180px per card prevents overly wide cards on iPad
const CARD_WIDTH = Math.min((SCREEN_WIDTH - 52) / 2, 180); // 2 columns, capped for iPad
const CARD_HEIGHT = 120;

interface Feature {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  gradient: [string, string];
  iconColor: string;
  screen: string;
}

/**
 * ELITE: Premium Luxury Color Palette
 * Distinct, recognizable, but soft and high-end.
 */
const FEATURES: Feature[] = [
  // Row 1
  {
    id: 'protection',
    icon: 'shield-checkmark',
    title: 'Koruma',
    // Security Navy
    gradient: ['#1e40af', '#1e3a8a'],
    iconColor: '#dbeafe',
    screen: 'EEWSettings',
  },
  {
    id: 'waves',
    icon: 'radio',
    title: 'P/S Dalga',
    // Warm Amber
    gradient: ['#fbbf24', '#f59e0b'],
    iconColor: '#fffbeb',
    screen: 'WaveVisualization',
  },
  // Row 2
  {
    id: 'messages',
    icon: 'chatbubbles',
    title: 'Mesajlar',
    // Royal Indigo
    gradient: ['#818cf8', '#6366f1'],
    iconColor: '#eef2ff',
    screen: 'Messages',
  },
  {
    id: 'earthquakes',
    icon: 'warning',
    title: 'Deprem',
    // Urgent Rose
    gradient: ['#f87171', '#ef4444'],
    iconColor: '#fef2f2',
    screen: 'AllEarthquakes',
  },
  // Row 3
  {
    id: 'assembly',
    icon: 'location',
    title: 'Toplanma',
    // Safety Emerald
    gradient: ['#34d399', '#10b981'],
    iconColor: '#ecfdf5',
    screen: 'AssemblyPoints',
  },
  {
    id: 'health',
    icon: 'medkit',
    title: 'Sağlık',
    // Medical Teal
    gradient: ['#2dd4bf', '#14b8a6'],
    iconColor: '#f0fdfa',
    screen: 'HealthProfile',
  },
];

interface FeatureCardProps {
  feature: Feature;
  onPress: () => void;
}

function FeatureCard({ feature, onPress }: FeatureCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    haptics.impactLight();
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
      }),
      Animated.spring(rotateAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(rotateAnim, {
        toValue: 0,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const iconRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '5deg'],
  });

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <LinearGradient
          colors={feature.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Glass Specular Highlight */}
          <View style={styles.glassHighlight} />

          {/* Icon Circle */}
          <Animated.View
            style={[
              styles.iconContainer,
              { transform: [{ rotate: iconRotate }] },
            ]}
          >
            <Ionicons
              name={feature.icon}
              size={28}
              color={feature.gradient[1]} // Icon takes darker tone of bg
            />
          </Animated.View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={1}>
            {feature.title}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';

// ELITE: Properly typed navigation prop
type FeatureGridNavigationProp = StackNavigationProp<ParamListBase>;

interface FeatureGridProps {
  navigation: FeatureGridNavigationProp;
}

export default function FeatureGrid({ navigation }: FeatureGridProps) {
  const handlePress = (feature: Feature) => {
    haptics.impactMedium();
    // Simple robust navigation
    try {
      if (['Map', 'Messages'].includes(feature.screen)) {
        navigation.navigate(feature.screen);
      } else {
        const parent = navigation.getParent();
        if (parent) parent.navigate(feature.screen);
        else navigation.navigate(feature.screen);
      }
    } catch (e) {
      logger.error('Nav Error', e);
      // Retry
      setTimeout(() => {
        try {
          navigation.navigate(feature.screen);
        } catch (retryError) {
          // ELITE: Final navigation attempt failed - user should manually navigate
          logger.debug('Navigation retry failed for screen:', feature.screen);
        }
      }, 100);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Hızlı Erişim</Text>
      <View style={styles.grid}>
        {FEATURES.map((feature) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            onPress={() => handlePress(feature)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  header: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  glassHighlight: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff', // White Circle
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff', // White Text on Color Card
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
