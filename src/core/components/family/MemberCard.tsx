import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, FadeInDown } from 'react-native-reanimated';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';
import { FamilyMember } from '../../stores/familyStore';
import { formatLastSeen } from '../../utils/dateUtils';

interface MemberCardProps {
  member: FamilyMember;
  onPress: () => void;
  index: number;
}

export function MemberCard({ member, onPress, index }: MemberCardProps) {
  const scale = useSharedValue(1);
  const { color, text } = getStatusRenderInfo(member.status);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withSpring(0.98); };
  const handlePressOut = () => { scale.value = withSpring(1); };
  const handlePress = () => {
    haptics.impactLight();
    onPress();
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()} style={animatedStyle}>
      <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <LinearGradient colors={[colors.background.secondary, '#1a2436']} style={styles.memberCardGradient}>
          {/* ... Card content ... */}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function getStatusRenderInfo(status: FamilyMember['status']) {
  switch (status) {
    case 'safe': return { color: colors.status.success, text: 'Güvende' };
    case 'need-help': return { color: colors.status.warning, text: 'Yardım Gerekiyor' };
    case 'critical': return { color: colors.status.danger, text: 'ACİL DURUM' };
    default: return { color: colors.text.tertiary, text: 'Bilinmiyor' };
  }
}

const styles = StyleSheet.create({
    memberCardGradient: {
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border.primary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
      },
      //... other styles
});
