import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, FadeInDown } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';
import { FamilyMember } from '../../stores/familyStore';
import { formatLastSeen } from '../../utils/dateUtils';
import { formatDistance, calculateDistance } from '../../utils/mapUtils';

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

  const hasLocation = member.latitude !== 0 && member.longitude !== 0;
  const lastSeenText = formatLastSeen(member.lastSeen);

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()} style={animatedStyle}>
      <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <LinearGradient colors={[colors.background.secondary, '#1a2436']} style={styles.memberCardGradient}>
          {/* Header: Name and Status */}
          <View style={styles.memberHeader}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberTime}>{lastSeenText}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: color }]} />
              <Text style={[styles.statusText, { color }]}>{text}</Text>
            </View>
          </View>

          {/* Location Info */}
          {hasLocation && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color={colors.text.tertiary} />
              <Text style={styles.locationText}>
                Konum: {member.latitude.toFixed(4)}, {member.longitude.toFixed(4)}
              </Text>
            </View>
          )}

          {/* View on Map Button */}
          <Pressable style={styles.viewMapButton} onPress={handlePress}>
            <Ionicons name="map-outline" size={16} color={colors.brand.primary} />
            <Text style={styles.viewMapText}>Haritada Göster</Text>
          </Pressable>
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
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  memberTime: {
    ...typography.small,
    color: colors.text.secondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.small,
    fontWeight: '700',
    fontSize: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  locationText: {
    ...typography.small,
    color: colors.text.tertiary,
    flex: 1,
  },
  viewMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  viewMapText: {
    ...typography.body,
    color: colors.brand.primary,
    fontWeight: '600',
  },
});
