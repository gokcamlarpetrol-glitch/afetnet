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
import { createLogger } from '../../../utils/logger';

const logger = createLogger('FeatureGrid');

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

/**
 * ELITE: Premium Luxury Color Palette
 * 6 distinct, elegant, and sophisticated color gradients
 * Inspired by luxury brands and premium design systems
 */
const FEATURES: Feature[] = [
  // Row 1
  {
    id: 'map',
    icon: 'map',
    title: 'Harita',
    // ELITE: Deep Ocean Blue - Premium navy to cyan gradient
    gradient: ['#1e3a5f', '#4a90e2'], // Zarif derin mavi tonları
    screen: 'Map', // MainTabs içinde
  },
  {
    id: 'waves',
    icon: 'radio', // ELITE: Changed from 'pulse' to 'radio' for P/S waves (radio waves)
    title: 'P/S Dalga',
    // ELITE: Elegant Amber Gold - Sophisticated amber to gold gradient
    gradient: ['#8b6914', '#d4af37'], // Lüks altın tonları
    screen: 'WaveVisualization', // Stack'te
  },
  // Row 2
  {
    id: 'messages',
    icon: 'chatbubbles',
    title: 'Mesajlar',
    // ELITE: Royal Purple - Deep purple to violet gradient
    gradient: ['#5b2c6f', '#9b59b6'], // Zarif mor tonları
    screen: 'Messages', // MainTabs içinde
  },
  {
    id: 'earthquakes',
    icon: 'warning', // ELITE: Changed from 'pulse' to 'warning' for earthquakes (distinct from waves)
    title: 'Deprem',
    // ELITE: Crimson Red - Rich red to deep crimson gradient
    gradient: ['#8b1538', '#c41e3a'], // Lüks kırmızı tonları
    screen: 'AllEarthquakes', // Stack'te
  },
  // Row 3
  {
    id: 'assembly',
    icon: 'location',
    title: 'Toplanma',
    // ELITE: Burnt Orange - Elegant orange to terracotta gradient
    gradient: ['#a0522d', '#cd853f'], // Zarif turuncu-kahverengi tonları
    screen: 'AssemblyPoints', // Stack'te
  },
  {
    id: 'health',
    icon: 'medkit',
    title: 'Sağlık',
    // ELITE: Rose Quartz - Soft rose to pink gradient
    gradient: ['#b76e79', '#e8b4b8'], // Zarif pembe tonları
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
          
          {/* ELITE: Premium Icon with Enhanced Styling */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [{ rotate: iconRotate }],
              },
            ]}
          >
            <Ionicons name={feature.icon} size={42} color="#ffffff" style={styles.iconShadow} />
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
    
    // ELITE: Navigation with comprehensive error handling and retry
    const attemptNavigation = () => {
      try {
          // Direct navigation - works for both tab screens and stack screens
          // Since HomeScreen is inside MainTabs, we can navigate to tabs directly
          // For stack screens, we need to go up to parent navigator
          if (['Map', 'Messages'].includes(feature.screen)) {
          // Tab screens - navigate within MainTabs
          if (navigation && typeof navigation.navigate === 'function') {
            navigation.navigate(feature.screen);
            logger.info(`✅ Navigated to tab: ${feature.screen}`);
            return;
          } else {
            throw new Error('Tab navigation not available');
          }
        } else {
          // Stack screens - navigate to parent Stack Navigator
          // ELITE: Try multiple navigation methods for reliability
          let navigator = navigation;
          
          // Try to get parent navigator
          try {
            if (navigation?.getParent && typeof navigation.getParent === 'function') {
              const parent = navigation.getParent();
              if (parent && typeof parent.navigate === 'function') {
                navigator = parent;
              }
            }
          } catch (parentError) {
            logger.debug('getParent failed, using current navigation:', parentError);
          }
          
          // Try navigation
          if (navigator && typeof navigator.navigate === 'function') {
            navigator.navigate(feature.screen);
            logger.info(`✅ Navigated to stack screen: ${feature.screen}`);
            return;
          } else {
            throw new Error('Stack navigation not available');
          }
        }
      } catch (error: any) {
        // CRITICAL: Retry once if navigation fails
        logger.error(`Navigation error (${feature.screen}):`, error);
        
        // Retry after short delay
        setTimeout(() => {
          try {
            if (['Map', 'Messages'].includes(feature.screen)) {
              if (navigation?.navigate) {
                navigation.navigate(feature.screen);
                logger.info(`✅ Retry navigation successful: ${feature.screen}`);
                return;
              }
            } else {
              let navigator = navigation;
              try {
                if (navigation?.getParent) {
                  const parent = navigation.getParent();
                  if (parent && typeof parent.navigate === 'function') {
                    navigator = parent;
                  }
                }
              } catch (parentError) {
                // Ignore
              }
              
              if (navigator?.navigate) {
                navigator.navigate(feature.screen);
                logger.info(`✅ Retry navigation successful: ${feature.screen}`);
                return;
              }
            }
            throw new Error('Retry navigation failed');
          } catch (retryError) {
            logger.error(`Navigation retry failed (${feature.screen}):`, retryError);
            // Last resort: Show error to user
            const Alert = require('react-native').Alert;
            Alert.alert(
              'Navigasyon Hatası',
              `${feature.title} ekranına geçiş yapılamadı. Lütfen tekrar deneyin.`,
              [{ text: 'Tamam', style: 'default' }]
            );
          }
        }, 100);
      }
    };
    
    attemptNavigation();
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
    borderRadius: 24, // ELITE: Increased border radius for premium feel
    padding: 18, // ELITE: Increased padding for luxury spacing
    justifyContent: 'space-between',
    borderWidth: 1.5, // ELITE: Slightly thicker border for premium look
    borderColor: 'rgba(255, 255, 255, 0.2)', // ELITE: More visible border
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 }, // ELITE: Deeper shadow
    shadowOpacity: 0.4, // ELITE: More pronounced shadow
    shadowRadius: 16, // ELITE: Softer shadow spread
    elevation: 12, // ELITE: Higher elevation
    overflow: 'hidden',
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // ELITE: More visible glass effect
    borderRadius: 24,
  },
  iconContainer: {
    width: 60, // ELITE: Slightly larger icon container
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // ELITE: More visible background
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)', // ELITE: Subtle border for premium look
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)', // ELITE: Text shadow for premium look
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  iconShadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.4)', // ELITE: Icon shadow for depth
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
