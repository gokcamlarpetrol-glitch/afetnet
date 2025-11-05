/**
 * FEATURE GRID - 2x3 Big Grid (6 Cards)
 * Bigger cards, vibrant colors, no scroll
 * Removed: Settings, Whistle, Flashlight
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as haptics from '../../../utils/haptics';
import { colors } from '../../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 52) / 2; // 2 columns, 20px padding + 12px gap
const CARD_HEIGHT = 120;

interface Feature {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  gradient: [string, string];
  screen: string;
}

const FEATURES: Feature[] = [
  // Row 1
  {
    id: 'map',
    icon: 'map',
    title: 'Harita',
    gradient: ['#0c4a6e', '#0ea5e9'], // Parlak mavi
    screen: 'Map', // MainTabs içinde
  },
  {
    id: 'family',
    icon: 'people',
    title: 'Aile',
    gradient: ['#047857', '#34d399'], // Parlak yeşil
    screen: 'Family', // MainTabs içinde
  },
  // Row 2
  {
    id: 'messages',
    icon: 'chatbubbles',
    title: 'Mesajlar',
    gradient: ['#7c3aed', '#c084fc'], // Parlak mor
    screen: 'Messages', // MainTabs içinde
  },
  {
    id: 'earthquakes',
    icon: 'pulse',
    title: 'Deprem',
    gradient: ['#b91c1c', '#f59e0b'], // Canlı kırmızı-turuncu
    screen: 'AllEarthquakes', // Stack'te
  },
  // Row 3
  {
    id: 'assembly',
    icon: 'location',
    title: 'Toplanma',
    gradient: ['#c2410c', '#fb923c'], // Parlak turuncu
    screen: 'AssemblyPoints', // Stack'te
  },
  {
    id: 'health',
    icon: 'medkit',
    title: 'Sağlık',
    gradient: ['#9f1239', '#fb7185'], // Parlak pembe-kırmızı
    screen: 'HealthProfile', // Stack'te
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
        {
          transform: [{ scale: scaleAnim }],
        },
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
          {/* Glassmorphism overlay */}
          <View style={styles.glassOverlay} />
          
          {/* Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [{ rotate: iconRotate }],
              },
            ]}
          >
            <Ionicons name={feature.icon} size={40} color="#ffffff" />
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

interface FeatureGridProps {
  navigation: any;
}

export default function FeatureGrid({ navigation }: FeatureGridProps) {
  const handlePress = (feature: Feature) => {
    haptics.impactMedium();
    
    try {
      // Direct navigation - works for both tab screens and stack screens
      // Since HomeScreen is inside MainTabs, we can navigate to tabs directly
      // For stack screens, we need to go up to parent navigator
      if (['Map', 'Family', 'Messages'].includes(feature.screen)) {
        // Tab screens - navigate within MainTabs
        navigation.navigate(feature.screen);
      } else {
        // Stack screens - navigate to parent Stack Navigator
        // Get parent navigator if available
        const parentNavigator = navigation.getParent?.() || navigation;
        parentNavigator.navigate(feature.screen);
      }
    } catch (error) {
      if (__DEV__) {
        console.error(`Navigasyon hatası (${feature.screen}):`, error);
      }
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
  container: {
    marginBottom: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 16,
    letterSpacing: -0.5,
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
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
});
