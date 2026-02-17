import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';

import * as haptics from '../../utils/haptics';
import { FamilyMember } from '../../stores/familyStore';
import { formatLastSeen, normalizeTimestampMs } from '../../utils/dateUtils';
import { resolveFamilyMemberLocation } from '../../utils/familyLocation';

interface MemberCardProps {
  member: FamilyMember;
  onPress: () => void;
  index: number;
  onEdit?: (member: FamilyMember) => void;
  onDelete?: (memberId: string) => void;
  onMessage?: (member: FamilyMember) => void;
  onLocate?: (member: FamilyMember) => void;
}

export const MemberCard = React.memo(function MemberCard({
  member, onPress, index, onEdit, onDelete, onMessage, onLocate,
}: MemberCardProps) {
  const scale = useSharedValue(1);
  const { color, text: statusText, icon, bgGradient } = getStatusRenderInfo(member.status);

  // PREMIUM: Pulse animation for critical/need-help status
  const pulseOpacity = useSharedValue(1);
  React.useEffect(() => {
    if (member.status === 'critical' || member.status === 'need-help') {
      pulseOpacity.value = withRepeat(
        withTiming(0.4, { duration: 900 }),
        -1,
        true,
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [member.status, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withSpring(0.97); };
  const handlePressOut = () => { scale.value = withSpring(1); };

  const handlePress = () => {
    haptics.impactLight();
    onPress();
  };

  const handleDelete = () => {
    haptics.notificationError();
    Alert.alert(
      'Üyeyi Sil',
      `${member.name} adlı üyeyi silmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => onDelete?.(member.uid),
        },
      ],
    );
  };

  // Location check (live -> legacy -> lastKnown fallback)
  const resolvedLocation = resolveFamilyMemberLocation(member);
  const hasLocation = !!resolvedLocation;
  const locationLabel = resolvedLocation?.source === 'lastKnown'
    ? 'Son bilinen konum'
    : 'Konum mevcut';
  const lastSeenText = formatLastSeen(member.lastSeen);
  const normalizedLastSeen = normalizeTimestampMs(member.lastSeen);

  // Avatar
  const initial = member.name.charAt(0).toUpperCase();
  const avatarGradient = getAvatarGradient(member.name);
  const relationEmoji = member.relationship ? getRelationshipEmoji(member.relationship) : null;
  const relationLabel = member.relationship ? getRelationshipLabel(member.relationship) : null;

  const isOnline = normalizedLastSeen ? normalizedLastSeen > Date.now() - 600000 : false; // active within 10min

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()} style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardOuter}
      >
        {/* Left accent bar */}
        <LinearGradient
          colors={bgGradient}
          style={styles.accentBar}
        />

        <View style={styles.card}>
          {/* Top section: Avatar + Info */}
          <View style={styles.topRow}>
            {/* Avatar with status indicator */}
            <View style={styles.avatarContainer}>
              <Animated.View style={[styles.avatarRing, { borderColor: color }, pulseStyle]}>
                <LinearGradient
                  colors={avatarGradient}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </LinearGradient>
              </Animated.View>
              {/* Online/status dot */}
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22c55e' : '#94a3b8' }]} />
              {/* Relationship emoji */}
              {relationEmoji && (
                <View style={styles.relationBadge}>
                  <Text style={styles.relationBadgeText}>{relationEmoji}</Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View style={styles.infoSection}>
              <View style={styles.nameRow}>
                <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
                {relationLabel && (
                  <View style={[styles.relationChip, { backgroundColor: color + '14' }]}>
                    <Text style={[styles.relationChipText, { color }]}>{relationLabel}</Text>
                  </View>
                )}
              </View>

              <View style={styles.metaRow}>
                {/* Status badge */}
                <View style={[styles.statusBadge, { backgroundColor: color + '14' }]}>
                  <Ionicons name={icon} size={11} color={color} />
                  <Text style={[styles.statusText, { color }]}>{statusText}</Text>
                </View>
                {/* Time */}
                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={10} color="#94a3b8" />
                  <Text style={styles.timeText}>{lastSeenText}</Text>
                </View>
              </View>

              {/* Location indicator */}
              {hasLocation && (
                <Pressable
                  style={styles.locationChip}
                  onPress={() => {
                    haptics.impactLight();
                    onLocate?.(member);
                  }}
                >
                  <Ionicons name="location" size={11} color="#3b82f6" />
                  <Text style={styles.locationText}>{locationLabel}</Text>
                  <Ionicons name="chevron-forward" size={10} color="#93c5fd" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Bottom: Quick action icons */}
          <View style={styles.actionsRow}>
            {onMessage && (
              <Pressable
                style={styles.actionBtn}
                onPress={() => {
                  haptics.impactLight();
                  onMessage(member);
                }}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#ede9fe' }]}>
                  <Ionicons name="chatbubble" size={15} color="#7c3aed" />
                </View>
                <Text style={[styles.actionLabel, { color: '#7c3aed' }]}>Mesaj</Text>
              </Pressable>
            )}
            {onLocate && (
              <Pressable
                style={styles.actionBtn}
                onPress={() => {
                  haptics.impactLight();
                  onLocate(member);
                }}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#dbeafe' }]}>
                  <Ionicons name="navigate" size={15} color="#2563eb" />
                </View>
                <Text style={[styles.actionLabel, { color: '#2563eb' }]}>Konum</Text>
              </Pressable>
            )}
            {onEdit && (
              <Pressable
                style={styles.actionBtn}
                onPress={() => {
                  haptics.impactLight();
                  onEdit(member);
                }}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="create-outline" size={15} color="#d97706" />
                </View>
                <Text style={[styles.actionLabel, { color: '#d97706' }]}>Düzenle</Text>
              </Pressable>
            )}
            {onDelete && (
              <Pressable
                style={styles.actionBtn}
                onPress={handleDelete}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#fee2e2' }]}>
                  <Ionicons name="trash-outline" size={15} color="#dc2626" />
                </View>
                <Text style={[styles.actionLabel, { color: '#dc2626' }]}>Sil</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

// ============================================================================
// Helper functions
// ============================================================================

function getStatusRenderInfo(status: FamilyMember['status']) {
  switch (status) {
    case 'safe': return {
      color: '#22c55e',
      text: 'Güvende',
      icon: 'checkmark-circle' as const,
      bgGradient: ['#22c55e', '#16a34a'] as [string, string],
    };
    case 'need-help': return {
      color: '#f59e0b',
      text: 'Yardım Lazım',
      icon: 'warning' as const,
      bgGradient: ['#f59e0b', '#d97706'] as [string, string],
    };
    case 'critical': return {
      color: '#ef4444',
      text: 'ACİL DURUM',
      icon: 'alert-circle' as const,
      bgGradient: ['#ef4444', '#dc2626'] as [string, string],
    };
    default: return {
      color: '#94a3b8',
      text: 'Bilinmiyor',
      icon: 'help-circle' as const,
      bgGradient: ['#94a3b8', '#64748b'] as [string, string],
    };
  }
}

function getAvatarGradient(name: string): [string, string] {
  const palettes: [string, string][] = [
    ['#6366f1', '#4f46e5'],
    ['#8b5cf6', '#7c3aed'],
    ['#a855f7', '#9333ea'],
    ['#ec4899', '#db2777'],
    ['#f43f5e', '#e11d48'],
    ['#f59e0b', '#d97706'],
    ['#10b981', '#059669'],
    ['#14b8a6', '#0d9488'],
    ['#3b82f6', '#2563eb'],
    ['#06b6d4', '#0891b2'],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palettes[Math.abs(hash) % palettes.length];
}

function getRelationshipEmoji(relationship: string): string {
  const emojis: Record<string, string> = {
    anne: '👩', baba: '👨', es: '💕', kardes: '👫',
    cocuk: '👶', akraba: '👥', arkadas: '🤝', diger: '👤',
  };
  return emojis[relationship] || '👤';
}

function getRelationshipLabel(relationship: string): string {
  const labels: Record<string, string> = {
    anne: 'Anne', baba: 'Baba', es: 'Eş', kardes: 'Kardeş',
    cocuk: 'Çocuk', akraba: 'Akraba', arkadas: 'Arkadaş', diger: 'Diğer',
  };
  return labels[relationship] || relationship;
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  cardOuter: {
    marginBottom: 10,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    // Premium shadow
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  accentBar: {
    width: 4,
  },
  card: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: '#ffffff',
  },
  relationBadge: {
    position: 'absolute',
    top: -3,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  relationBadgeText: {
    fontSize: 12,
  },
  infoSection: {
    flex: 1,
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  relationChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  relationChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
  },
  locationText: {
    fontSize: 10,
    color: '#3b82f6',
    fontWeight: '600',
  },
  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionBtn: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
  },
  actionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
