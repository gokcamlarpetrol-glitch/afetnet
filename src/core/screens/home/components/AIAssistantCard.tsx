/**
 * AI ASSISTANT CARD - Home Screen Component
 * Provides access to AI features: Risk Score, Preparedness Plan, Panic Assistant
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../theme';
import * as haptics from '../../../utils/haptics';

interface Props {
  navigation: any;
}

export default function AIAssistantCard({ navigation }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = (screen: string) => {
    haptics.impactLight();
    
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    navigation.navigate(screen);
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient
        colors={['#1a1f2e', '#141824']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <Ionicons name="sparkles" size={20} color={colors.accent.primary} />
            </View>
            <Text style={styles.title}>AI Asistan</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>BETA</Text>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handlePress('RiskScore')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="analytics" size={24} color="#fff" />
              <Text style={styles.buttonText}>Risk Skorum</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => handlePress('PreparednessPlan')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="list" size={24} color="#fff" />
              <Text style={styles.buttonText}>Hazirlik Plani</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => handlePress('PanicAssistant')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#ef4444', '#dc2626']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="shield-checkmark" size={24} color="#fff" />
              <Text style={styles.buttonText}>Afet Ani Rehberi</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={14} color={colors.text.tertiary} />
          <Text style={styles.disclaimerText}>
            Bu icerik bilgilendirme amaclidir. AFAD ve resmi kurumlarin uyarilari onceliklidir.
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  gradient: {
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  button: {
    flex: 1,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 6,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: colors.text.tertiary,
    lineHeight: 16,
  },
});

