import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActionSheetIOS, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, FadeInDown } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';
import { FamilyMember } from '../../stores/familyStore';
import { formatLastSeen } from '../../utils/dateUtils';
import { formatDistance, calculateDistance } from '../../utils/mapUtils';

interface MemberCardProps {
  member: FamilyMember;
  onPress: () => void;
  index: number;
  onEdit?: (member: FamilyMember) => void;
  onDelete?: (memberId: string) => void;
}

export function MemberCard({ member, onPress, index, onEdit, onDelete }: MemberCardProps) {
  const scale = useSharedValue(1);
  const { color, text } = getStatusRenderInfo(member.status);
  const [swipeableRef, setSwipeableRef] = useState<Swipeable | null>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withSpring(0.98); };
  const handlePressOut = () => { scale.value = withSpring(1); };
  
  const handlePress = () => {
    haptics.impactLight();
    onPress();
  };

  const handleLongPress = () => {
    haptics.impactMedium();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['İptal', 'Düzenle', 'Sil'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 1 && onEdit) {
            onEdit(member);
          } else if (buttonIndex === 2 && onDelete) {
            handleDelete();
          }
        }
      );
    } else {
      Alert.alert(
        member.name,
        'Ne yapmak istersiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Düzenle',
            onPress: () => onEdit && onEdit(member),
          },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: handleDelete,
          },
        ]
      );
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Üyeyi Sil',
      `${member.name} adlı üyeyi silmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            haptics.notificationError();
            onDelete && onDelete(member.id);
            swipeableRef?.close();
          },
        },
      ]
    );
  };

  const renderRightActions = () => {
    if (!onDelete) return null;
    
    return (
      <View style={styles.rightActions}>
        <Pressable
          style={styles.deleteButton}
          onPress={handleDelete}
        >
          <Ionicons name="trash" size={24} color="#fff" />
          <Text style={styles.deleteButtonText}>Sil</Text>
        </Pressable>
      </View>
    );
  };

  const renderLeftActions = () => {
    if (!onEdit) return null;
    
    return (
      <View style={styles.leftActions}>
        <Pressable
          style={styles.editButton}
          onPress={() => {
            haptics.impactLight();
            onEdit(member);
            swipeableRef?.close();
          }}
        >
          <Ionicons name="create" size={24} color="#fff" />
          <Text style={styles.editButtonText}>Düzenle</Text>
        </Pressable>
      </View>
    );
  };

  const hasLocation = member.latitude !== 0 && member.longitude !== 0;
  const lastSeenText = formatLastSeen(member.lastSeen);

  const cardContent = (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
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
  );

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()} style={animatedStyle}>
      {(onEdit || onDelete) ? (
        <Swipeable
          ref={(ref) => setSwipeableRef(ref)}
          renderRightActions={renderRightActions}
          renderLeftActions={renderLeftActions}
          onSwipeableOpen={() => haptics.impactMedium()}
        >
          {cardContent}
        </Swipeable>
      ) : (
        cardContent
      )}
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
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: colors.status.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    gap: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  editButton: {
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    gap: 4,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
