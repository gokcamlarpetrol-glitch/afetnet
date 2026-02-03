/**
 * STATUS CARD - ELITE EDITION
 * Detailed offline features with Reanimated 3 layout transitions.
 * Premium indigo glassmorphism.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as haptics from '../../../utils/haptics';
import { colors, spacing } from '../../../theme';
import Animated, {
  useAnimatedStyle,
  withSpring,
  Layout,
  FadeInUp,
  FadeOutUp,
  useSharedValue,
} from 'react-native-reanimated';
import { PremiumMaterialSurface } from '../../../components/PremiumMaterialSurface';

const FEATURES = [
  { id: 1, text: 'Bluetooth Mesh Ağı (Aktif)', icon: 'logo-bluetooth' },
  { id: 2, text: 'Offline Mesajlaşma', icon: 'chatbubbles' },
  { id: 3, text: 'Enkaz Algılama Sistemi', icon: 'body' },
  { id: 4, text: 'Acil Durum Sinyalleri', icon: 'radio' },
  { id: 5, text: 'Konum Paylaşımı', icon: 'navigate' },
];

export default function StatusCard() {
  const [expanded, setExpanded] = useState(false);
  const rotateValue = useSharedValue(0);

  const toggleExpanded = () => {
    haptics.impactLight();
    setExpanded(!expanded);
    rotateValue.value = withSpring(expanded ? 0 : 180);
  };

  const animatedArrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateValue.value}deg` }],
  }));

  return (
    <Animated.View layout={Layout.springify()} style={styles.container}>
      <PremiumMaterialSurface variant="B" style={styles.surface}>
        <TouchableOpacity
          onPress={toggleExpanded}
          activeOpacity={0.7}
          style={styles.touchable}
        >
          <View style={styles.header}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
            </View>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Offline Mod: HAZIR</Text>
              <Text style={styles.subtitle}>İnternetsiz İletişim Aktif</Text>
            </View>
            <Animated.View style={[styles.iconContainer, animatedArrowStyle]}>
              <Ionicons name="chevron-down" size={20} color={colors.text.secondary} />
            </Animated.View>
          </View>
        </TouchableOpacity>

        {/* Features List - Collapsible */}
        {expanded && (
          <View style={styles.featuresList}>
            <View style={styles.divider} />
            {FEATURES.map((feature, index) => (
              <Animated.View
                key={feature.id}
                entering={FadeInUp.delay(index * 50).springify()}
                exiting={FadeOutUp}
                style={styles.featureItem}
              >
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon as any} size={14} color={colors.status.mesh} />
                </View>
                <Text style={styles.featureText}>{feature.text}</Text>
                <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
              </Animated.View>
            ))}
          </View>
        )}
      </PremiumMaterialSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
    marginHorizontal: 4,
  },
  surface: {
    padding: 0,
  },
  touchable: {
    padding: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A', // Navy for better readability
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B', // Slate
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuresList: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    marginBottom: 12,
    marginTop: -4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
});
