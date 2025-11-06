import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';

// --- StatusButton Component ---
interface StatusButtonProps {
  status: 'safe' | 'need-help' | 'critical' | 'location';
  onPress: (status: StatusButtonProps['status']) => void;
  active?: boolean;
}

export function StatusButton({ status, onPress, active = false }: StatusButtonProps) {
  const { icon, text, gradientColors } = getStatusInfo(status, active);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    haptics.impactMedium();
    onPress(status);
  };

  const handlePressIn = () => { scale.value = withSpring(0.95); };
  const handlePressOut = () => { scale.value = withSpring(1); };

  return (
    <Animated.View style={[styles.statusButtonContainer, animatedStyle]}>
      <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <LinearGradient colors={gradientColors as any} style={styles.statusButtonGradient}>
          <Ionicons name={icon as any} size={24} color="#fff" />
          <Text style={styles.statusButtonText}>{text}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function getStatusInfo(status: StatusButtonProps['status'], active: boolean) {
  switch (status) {
    case 'safe':
      return { icon: 'shield-checkmark', text: 'Güvendeyim', gradientColors: ['#10b981', '#059669'] };
    case 'need-help':
      return { icon: 'help-buoy', text: 'Yardıma İhtiyacım Var', gradientColors: ['#f59e0b', '#d97706'] };
    case 'critical':
      return { icon: 'alert-circle', text: 'Acil Durum (SOS)', gradientColors: ['#ef4444', '#dc2626'] };
    case 'location':
      return active
        ? { icon: 'location', text: 'Konum Paylaşılıyor', gradientColors: ['#3b82f6', '#2563eb'] }
        : { icon: 'location-outline', text: 'Konumumu Paylaş', gradientColors: ['#1e3a8a', '#1e40af'] };
  }
}

const styles = StyleSheet.create({
    statusButtonContainer: {
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
      },
      statusButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        gap: 12,
      },
      statusButtonText: {
        ...typography.body,
        color: '#fff',
        fontWeight: 'bold',
      },
});
