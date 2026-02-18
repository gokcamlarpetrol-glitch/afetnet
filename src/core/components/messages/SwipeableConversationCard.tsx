import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActionSheetIOS, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { colors } from '../../theme';
import { Conversation } from '../../stores/messageStore';
import { useMessageStore } from '../../stores/messageStore';
import * as haptics from '../../utils/haptics';

interface SwipeableConversationCardProps {
  item: Conversation;
  index: number;
  isGroup?: boolean;
  myUserId?: string;
  typingActive?: boolean;
  onPress: () => void;
  onDelete: () => void;
}

// ─── Relative timestamp helper ───────────────────────────────────────────────
function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return 'şimdi';
  if (diffMin < 60) return `${diffMin} dk`;

  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  if (isSameDay(date, yesterday)) return 'Dün';

  // Within this week (within last 6 days)
  if (diffHrs < 7 * 24) {
    const weekdays = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return weekdays[date.getDay()];
  }

  // Older: dd MMM
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// ─── Delivery status tick helper ─────────────────────────────────────────────
type TickStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | undefined;
function DeliveryTick({ status }: { status: TickStatus }) {
  if (!status || status === 'pending' || status === 'sending' || status === 'failed') {
    return <Ionicons name="checkmark-outline" size={14} color="#94a3b8" />;
  }
  if (status === 'sent') {
    return <Ionicons name="checkmark-outline" size={14} color="#94a3b8" />;
  }
  if (status === 'delivered') {
    return <Ionicons name="checkmark-done-outline" size={14} color="#94a3b8" />;
  }
  // read
  return <Ionicons name="checkmark-done" size={14} color="#3b82f6" />;
}

// ─── Component ────────────────────────────────────────────────────────────────
function SwipeableConversationCardInner({
  item,
  index,
  isGroup,
  myUserId,
  typingActive,
  onPress,
  onDelete,
}: SwipeableConversationCardProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const pinConversation = useMessageStore((state) => state.pinConversation);
  const muteConversation = useMessageStore((state) => state.muteConversation);
  const markConversationRead = useMessageStore((state) => state.markConversationRead);

  const isOutgoing = Boolean(myUserId && item.lastMessageFrom === myUserId);
  const hasUnread = (item.unreadCount ?? 0) > 0;
  const displayTime = formatRelativeTime(item.lastMessageTime);

  // Avatar color palette (pastel)
  const avatarColors: [string, string][] = [
    ['#bfdbfe', '#93c5fd'],
    ['#ddd6fe', '#c4b5fd'],
    ['#fbcfe8', '#f9a8d4'],
    ['#fef3c7', '#fde68a'],
    ['#d1fae5', '#a7f3d0'],
  ];
  const colorIndex = item.userId.charCodeAt(0) % avatarColors.length;
  const [avatarColor1, avatarColor2] = avatarColors[colorIndex];

  // ── Long-press context menu ──────────────────────────────────────────────
  const handleLongPress = useCallback(() => {
    haptics.impactMedium();
    const isPinned = item.isPinned ?? false;
    const isMuted = item.isMuted ?? false;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            'İptal',
            isPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle',
            isMuted ? 'Sesi Aç' : 'Sessize Al',
            'Okundu İşaretle',
            'Sil',
          ],
          destructiveButtonIndex: 4,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pinConversation(item.userId, !isPinned);
          } else if (buttonIndex === 2) {
            muteConversation(item.userId, !isMuted);
          } else if (buttonIndex === 3) {
            markConversationRead(item.userId);
          } else if (buttonIndex === 4) {
            onDelete();
          }
        },
      );
    } else {
      // Android: use Alert with buttons (no ActionSheet built-in)
      Alert.alert(
        item.userName || 'Konuşma',
        undefined,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: isPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle',
            onPress: () => pinConversation(item.userId, !isPinned),
          },
          {
            text: isMuted ? 'Sesi Aç' : 'Sessize Al',
            onPress: () => muteConversation(item.userId, !isMuted),
          },
          {
            text: 'Okundu İşaretle',
            onPress: () => markConversationRead(item.userId),
          },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: onDelete,
          },
        ],
      );
    }
  }, [item, pinConversation, muteConversation, markConversationRead, onDelete]);

  // ── Swipe actions ────────────────────────────────────────────────────────
  const renderRightActions = useCallback(
    () => (
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
        style={styles.deleteButton}
      >
        <Ionicons name={isGroup ? 'exit-outline' : 'trash'} size={24} color="#fff" />
      </Pressable>
    ),
    [isGroup, onDelete],
  );

  const renderLeftActions = useCallback(
    () => (
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          if (item.unreadCount > 0) {
            markConversationRead(item.userId);
          } else {
            pinConversation(item.userId, !(item.isPinned ?? false));
          }
        }}
        style={styles.leftActionButton}
      >
        <Ionicons
          name={item.unreadCount > 0 ? 'checkmark-done' : (item.isPinned ? 'pin' : 'pin-outline')}
          size={22}
          color="#fff"
        />
        <Text style={styles.leftActionText}>
          {item.unreadCount > 0 ? 'Okundu' : (item.isPinned ? 'Çıkar' : 'Sabitle')}
        </Text>
      </Pressable>
    ),
    [item, markConversationRead, pinConversation],
  );

  // ── Preview text ─────────────────────────────────────────────────────────
  const previewText = typingActive
    ? 'yazıyor...'
    : isOutgoing
    ? `Sen: ${item.lastMessage || ''}`
    : item.lastMessage || 'Mesaj yok';

  const unreadCapped = Math.min(item.unreadCount ?? 0, 99);
  const unreadLabel = item.unreadCount > 99 ? '99+' : String(unreadCapped);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={() => haptics.impactMedium()}
    >
      <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
        <Pressable
          onPress={onPress}
          onLongPress={handleLongPress}
          delayLongPress={400}
          style={({ pressed }) => [styles.conversationCard, pressed && { opacity: 0.8 }]}
        >
          {/* Avatar container with online dot */}
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={isGroup ? ['#c7d2fe', '#a5b4fc'] : [avatarColor1, avatarColor2]}
              style={styles.avatarGradient}
            >
              {isGroup ? (
                <Ionicons name="people" size={22} color="#4338ca" />
              ) : (
                <Text style={styles.avatarText}>
                  {item.userName?.charAt(0)?.toUpperCase() || item.userId.charAt(0).toUpperCase()}
                </Text>
              )}
            </LinearGradient>
            {/* Online status dot */}
            {item.status === 'online' && <View style={styles.onlineDot} />}
            {item.status === 'offline' && <View style={[styles.onlineDot, styles.offlineDot]} />}
          </View>

          {/* Conversation Info */}
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <View style={styles.nameRow}>
                {item.isPinned && (
                  <Ionicons name="pin" size={12} color="#64748b" style={styles.pinIcon} />
                )}
                <Text
                  style={[styles.userName, hasUnread && styles.userNameUnread]}
                  numberOfLines={1}
                >
                  {item.userName || (isGroup ? 'Grup' : `Cihaz ${item.userId.slice(0, 8)}...`)}
                </Text>
              </View>
              <View style={styles.timeRow}>
                {item.isMuted && (
                  <Ionicons name="volume-mute" size={12} color="#94a3b8" style={styles.muteIcon} />
                )}
                <Text style={[styles.time, hasUnread && styles.timeUnread]}>{displayTime}</Text>
              </View>
            </View>

            <View style={styles.messagePreview}>
              {/* Delivery tick for outgoing messages */}
              {isOutgoing && !typingActive && (
                <DeliveryTick status={item.lastMessageStatus} />
              )}
              <Text
                style={[
                  styles.lastMessage,
                  hasUnread && styles.lastMessageUnread,
                  typingActive && styles.typingText,
                ]}
                numberOfLines={1}
              >
                {previewText}
              </Text>

              {hasUnread && (
                <LinearGradient
                  colors={
                    item.isMuted
                      ? ['#94a3b8', '#64748b']
                      : [colors.brand.primary, colors.brand.secondary]
                  }
                  style={styles.unreadBadge}
                >
                  <Text style={styles.unreadText}>{unreadLabel}</Text>
                </LinearGradient>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Swipeable>
  );
}

export const SwipeableConversationCard = React.memo(
  SwipeableConversationCardInner,
  (prev, next) =>
    prev.item.userId === next.item.userId &&
    prev.item.lastMessage === next.item.lastMessage &&
    prev.item.lastMessageTime === next.item.lastMessageTime &&
    prev.item.unreadCount === next.item.unreadCount &&
    prev.item.isPinned === next.item.isPinned &&
    prev.item.isMuted === next.item.isMuted &&
    prev.item.status === next.item.status &&
    prev.item.lastMessageStatus === next.item.lastMessageStatus &&
    prev.item.lastMessageFrom === next.item.lastMessageFrom &&
    prev.typingActive === next.typingActive &&
    prev.index === next.index,
);

const styles = StyleSheet.create({
  avatarContainer: {
    position: 'relative',
  },
  deleteButton: {
    backgroundColor: colors.status.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 20,
    marginLeft: 12,
  },
  leftActionButton: {
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    borderRadius: 20,
    marginRight: 12,
    gap: 4,
  },
  leftActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
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
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  offlineDot: {
    backgroundColor: '#94a3b8',
  },
  conversationInfo: {
    flex: 1,
    minWidth: 0,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  pinIcon: {
    marginRight: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    flexShrink: 0,
  },
  muteIcon: {
    marginRight: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    flexShrink: 1,
  },
  userNameUnread: {
    fontWeight: '800',
    color: '#1e293b',
  },
  time: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  timeUnread: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '400',
  },
  lastMessageUnread: {
    color: '#334155',
    fontWeight: '600',
  },
  typingText: {
    fontStyle: 'italic',
    color: '#3b82f6',
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
