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

  // Generate avatar color based on userId - Using pastel versions
  const avatarColors = [
    ['#bfdbfe', '#93c5fd'], // Pastel Blue
    ['#ddd6fe', '#c4b5fd'], // Pastel Violet
    ['#fbcfe8', '#f9a8d4'], // Pastel Pink
    ['#fef3c7', '#fde68a'], // Pastel Amber
    ['#d1fae5', '#a7f3d0'], // Pastel Emerald
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
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    gap: 12,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#334155',
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
    fontWeight: '700',
    color: '#334155',
  },
  time: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '400',
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});
