import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { Conversation } from '../../stores/messageStore';
import * as haptics from '../../utils/haptics';

interface SwipeableConversationCardProps {
  item: Conversation;
  index: number;
  onPress: () => void;
  onDelete: () => void;
}

export function SwipeableConversationCard({ item, index, onPress, onDelete }: SwipeableConversationCardProps) {
  const renderRightActions = () => (
    <Pressable onPress={onDelete} style={styles.deleteButton}>
      <Ionicons name="trash" size={24} color="#fff" />
    </Pressable>
  );

  const date = new Date(item.lastMessageTime);
  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const isToday = date.toDateString() === new Date().toDateString();
  const displayTime = isToday ? timeStr : date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

  // Generate avatar color based on userId
  const avatarColors = [
    ['#3b82f6', '#2563eb'],
    ['#8b5cf6', '#7c3aed'],
    ['#ec4899', '#db2777'],
    ['#f59e0b', '#d97706'],
    ['#10b981', '#059669'],
  ];
  const colorIndex = item.userId.charCodeAt(0) % avatarColors.length;
  const [avatarColor1, avatarColor2] = avatarColors[colorIndex];

  return (
    <Swipeable renderRightActions={renderRightActions} onSwipeableOpen={() => haptics.impactMedium()}>
      <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.conversationCard, pressed && { opacity: 0.8 }]}
        >
          {/* Avatar */}
          <LinearGradient
            colors={[avatarColor1, avatarColor2]}
            style={styles.avatarGradient}
          >
            <Text style={styles.avatarText}>
              {item.userName?.charAt(0)?.toUpperCase() || item.userId.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>

          {/* Conversation Info */}
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.userName || `Cihaz ${item.userId.slice(0, 8)}...`}
              </Text>
              <Text style={styles.time}>{displayTime}</Text>
            </View>
            <View style={styles.messagePreview}>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage || 'Mesaj yok'}
              </Text>
              {item.unreadCount > 0 && (
                <LinearGradient
                  colors={[colors.brand.primary, colors.brand.secondary]}
                  style={styles.unreadBadge}
                >
                  <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </LinearGradient>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteButton: {
    backgroundColor: colors.status.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 20,
    marginLeft: 12,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.brand.primary + '30',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  time: {
    fontSize: 13,
    color: '#94a3b8',
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#94a3b8',
  },
  unreadBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
