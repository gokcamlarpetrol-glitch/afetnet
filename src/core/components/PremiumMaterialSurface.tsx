import React from 'react';
import { View, StyleSheet, Image, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from './SafeLinearGradient';

export type MaterialVariant = 'A' | 'B'; // A: Aurora Silk (Lux), B: Topographic Porcelain (Technical)

interface Props {
    variant?: MaterialVariant;
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    borderRadius?: number;
}

export const PremiumMaterialSurface: React.FC<Props> = ({
  variant = 'A',
  style,
  children,
  borderRadius = 24,
}) => {
  return (
    <View style={[styles.container, { borderRadius }, style]}>
      {/* 1. Base Gradient & Surface Layer */}
      <View style={[StyleSheet.absoluteFill, styles.baseLayer, { borderRadius }]} />

      {/* 2. Variant-Specific Layers */}
      {/* 2. Variant-Specific Layers - UNIFIED CERAMIC THEME (Deep Ocean Comp) */}
      {(variant === 'A' || variant === 'B') && (
        <>
          {/* Unified Ceramic White Gradient (High Contrast) */}
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.90)']}
            locations={[0, 0.7, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius }]}
          />

          {/* Subtle Topographic Pattern (Darker now to show on white) */}
          <Image
            source={require('../../../assets/images/premium/topo_pattern.png')}
            style={[StyleSheet.absoluteFill, styles.overlayImage, { opacity: 0.05, tintColor: '#334155' }]}
            resizeMode="repeat"
          />
        </>
      )}

      {/* 3. Common Specular Sheen (6-10%) */}
      <Image
        source={require('../../../assets/images/premium/sheen_overlay.png')}
        style={[StyleSheet.absoluteFill, styles.overlayImage, { opacity: 0.08 }]}
        resizeMode="cover"
      />

      {/* 4. Borders & Inner Highlights (Simulated via nested views) */}
      <View style={[StyleSheet.absoluteFill, styles.borderLayer, { borderRadius }]} pointerEvents="none" />

      {/* 5. Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.18)', // Fallback / Base
    // Global Shadow for the "Art Piece" feel
    shadowColor: 'rgba(15, 23, 42, 0.18)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1, // Color itself has alpha
    shadowRadius: 32,
    elevation: 10,
  },
  baseLayer: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  overlayImage: {
    width: '100%',
    height: '100%',
  },
  borderLayer: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.10)', // Outer stroke
    // Inner lighting simulation
    borderTopWidth: 1, // Edge highlight
    borderTopColor: 'rgba(255,255,255,0.20)', // Top edge light
  },
  content: {
    // Content sits on top of all layers
    zIndex: 10,
  },
});
