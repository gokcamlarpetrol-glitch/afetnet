/**
 * STATUS CARD - Detailed Offline Features
 * 5-6 features with checkmarks, detailed descriptions
 * Premium indigo gradient, 80-100px height
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as haptics from '../../../utils/haptics';
import { colors } from '../../../theme';

const FEATURES = [
  { id: 1, text: 'Bluetooth Mesh Ağı (Aktif)', delay: 0 },
  { id: 2, text: 'Offline Mesajlaşma', delay: 100 },
  { id: 3, text: 'Enkaz Algılama Sistemi', delay: 200 },
  { id: 4, text: 'Acil Durum Sinyalleri', delay: 300 },
  { id: 5, text: 'Konum Paylaşımı (GPS)', delay: 400 },
];

export default function StatusCard() {
  const [expanded, setExpanded] = useState(false);
  const fadeAnims = useRef(FEATURES.map(() => new Animated.Value(0))).current;
  const heightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered fade-in animation (only when expanded)
    if (expanded) {
      const animations = fadeAnims.map((anim, index) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: FEATURES[index].delay,
          useNativeDriver: true,
        })
      );

      Animated.parallel(animations).start();
    }
  }, [expanded]);

  const toggleExpanded = () => {
    haptics.impactLight();
    setExpanded(!expanded);
    
    Animated.timing(heightAnim, {
      toValue: expanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(99, 102, 241, 0.12)', 'rgba(79, 70, 229, 0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header - Tıklanabilir */}
        <TouchableOpacity onPress={toggleExpanded} activeOpacity={0.7}>
          <View style={styles.header}>
            <View style={styles.statusDot} />
            <Text style={styles.title}>Tam Offline Çalışma Desteği</Text>
            <Ionicons 
              name={expanded ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={colors.text.primary} 
            />
          </View>
        </TouchableOpacity>

        {/* Features List - Sadece expanded ise göster */}
        {expanded && (
          <Animated.View 
            style={[
              styles.featuresList,
              {
                opacity: heightAnim,
                maxHeight: heightAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 200],
                }),
              },
            ]}
          >
            {FEATURES.map((feature, index) => (
              <Animated.View
                key={feature.id}
                style={[
                  styles.featureItem,
                  {
                    opacity: fadeAnims[index],
                    transform: [
                      {
                        translateX: fadeAnims[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [-20, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
                <Text style={styles.featureText}>{feature.text}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  gradient: {
    padding: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 16,
    minHeight: 50,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 0,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
    flex: 1,
  },
  featuresList: {
    gap: 6,
    marginTop: 10,
    overflow: 'hidden',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 1,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.primary,
    letterSpacing: -0.1,
    flex: 1,
    opacity: 0.9,
  },
});
