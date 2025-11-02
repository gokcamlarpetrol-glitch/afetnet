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

  return (
    <Swipeable renderRightActions={renderRightActions} onSwipeableOpen={() => haptics.impactMedium()}>
      <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.conversationCard, pressed && { opacity: 0.8 }]}
        >
          {/* ... Full card content from the original file ... */}
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
  // ... All styles from MessagesScreenComponents.tsx
});
