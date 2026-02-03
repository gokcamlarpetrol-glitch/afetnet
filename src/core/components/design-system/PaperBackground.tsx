/**
 * PAPER BACKGROUND COMPONENT
 * Wraps screens with the premium 'Modern Calm Trust' texture
 * Fallback to pure gradient if image missing
 */

import React from 'react';
import { View, StyleSheet, Image, ViewStyle, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

interface PaperBackgroundProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

export const PaperBackground = ({ children, style }: PaperBackgroundProps) => {
  return (
    <View style={[styles.container, style]}>
      {/* Base Background Color */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.primary }]} />

      {/* Gradient Texture (Paper Feel) */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.4)', // Light top
          'rgba(244, 239, 231, 0.1)', // Middle transparent
          'rgba(31, 78, 121, 0.03)',  // Very subtle cool tint at bottom (Trust Blue)
        ]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Micro-grain Noise (Simulated via image if available, else subtle pattern) */}
      <Image
        source={require('../../../../assets/images/background_paper_gradient.png')}
        style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
        resizeMode="cover"
        // Silent failure if asset missing
        onError={() => { }}
      />

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
  },
});
