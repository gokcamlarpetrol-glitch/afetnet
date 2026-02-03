import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Easing, View, ImageBackground, Image } from 'react-native';
import { LinearGradient } from './SafeLinearGradient';

interface BreathingBackgroundProps {
    children?: React.ReactNode;
}

/**
 * BreathingBackground - ELITE EDITION
 * 
 * Uses the "Atmosphere Safety" (Sky) theme with a subtle breathing overlay.
 * The static image provides the texture, while the overlay provides the "life".
 */
export const BreathingBackground: React.FC<BreathingBackgroundProps> = ({ children }) => {
  const breathAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 12000, // Even slower, calmer breath
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 0,
          duration: 12000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Base Layer - Nature (Fresh Organic) */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F2F8F4' }]}>
        {/* Forest Mist Gradient - Global */}
        <LinearGradient
          colors={['#DCFCE7', '#F0FDF4', '#F2F8F4']}
          locations={[0, 0.4, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Micrograin Texture (3% Opacity) */}
        <ImageBackground
          source={require('../../../assets/images/texture_cream_paper.png')}
          style={[StyleSheet.absoluteFill, { opacity: 0.03 }]}
          resizeMode="repeat"
        />

        {/* Accent - Nature Abstract (Full Cover Green Vein) */}
        <Image
          source={require('../../../assets/images/accent_leaf_abstract.png')}
          style={[StyleSheet.absoluteFill, { opacity: 0.12 }]}
          resizeMode="cover"
        />
      </View>

      {/* Breathing Layer - Subtle Life Pulse (Spring Green) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: breathAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.2],
            }),
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(74, 222, 128, 0.20)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Content Container */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F8F4', // Nature Base
  },
});
