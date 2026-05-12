/**
 * CHAT HEADER - Extracted from ConversationScreen
 * Header section with user info, call button, back navigation, and options menu.
 * Includes real report/block functionality (Apple Guideline 1.2 compliance).
 */

import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { styles } from './ConversationScreen.styles';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from '../../components/SafeBlurView';
import { EdgeInsets } from 'react-native-safe-area-context';
import { NetworkBanner } from '../../components/messaging/NetworkBanner';
import { ReportModal } from '../../components/ReportModal';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMessageStore } from '../../stores/messageStore';
import * as haptics from '../../utils/haptics';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';

type ConversationNavigationProp = StackNavigationProp<MainStackParamList, 'Conversation'>;

interface ChatHeaderProps {
  navigation: ConversationNavigationProp;
  insets: EdgeInsets;
  conversationTitle: string;
  isTyping: boolean;
  peerLastSeen: number | null;
  connectionState: 'online' | 'mesh' | 'offline';
  activeRecipientId: string;
  userId: string;
  peerIdCandidates: Set<string>;
  conversationId?: string;
}

function ChatHeaderInner({
  navigation,
  insets,
  conversationTitle,
  isTyping,
  peerLastSeen,
  connectionState,
  activeRecipientId,
  userId,
  peerIdCandidates,
  conversationId,
}: ChatHeaderProps) {
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const handleCallPress = useCallback(() => {
    if (!activeRecipientId) {
      Alert.alert('Hata', 'Arama yapılacak kişi bulunamadı.');
      return;
    }
    haptics.impactMedium();
    navigation.navigate('VoiceCall', {
      recipientUid: activeRecipientId,
      recipientName: conversationTitle,
    });
  }, [activeRecipientId, conversationTitle, navigation]);

  const handleOptionsPress = useCallback(() => {
    Alert.alert(
      'Kişi Seçenekleri',
      'Bu kullanıcı ile ilgili ne yapmak istersiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Şikayet Et',
          onPress: () => {
            setReportModalVisible(true);
          },
        },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Engellensin mi?',
              'Bu kullanıcıdan artık mesaj almayacaksınız.',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Engelle',
                  style: 'destructive',
                  onPress: () => {
                    const settingsState = useSettingsStore.getState();
                    const deleteTarget = activeRecipientId || userId;

                    if (peerIdCandidates.size > 0) {
                      peerIdCandidates.forEach((aliasId) => settingsState.blockUser(aliasId));
                    } else if (deleteTarget) {
                      settingsState.blockUser(deleteTarget);
                    }

                    if (!deleteTarget) {
                      Alert.alert('Hata', 'Bu kişi için geçerli kimlik bulunamadı.');
                      return;
                    }

                    useMessageStore.getState().deleteConversation(deleteTarget);
                    navigation.goBack();
                    haptics.notificationSuccess();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [activeRecipientId, userId, peerIdCandidates, navigation]);

  return (
    <>
      <BlurView intensity={20} tint="light" style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Geri">
            <Ionicons name="chevron-back" size={24} color="#334155" />
          </Pressable>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{conversationTitle}</Text>
            <View style={styles.statusBadge}>
              {isTyping ? (
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#22c55e' }}>yazıyor...</Text>
              ) : peerLastSeen ? (
                <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                  {(() => {
                    const diff = Date.now() - peerLastSeen;
                    if (diff < 60_000) return 'şimdi aktif';
                    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} dk önce`;
                    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} saat önce`;
                    return `${Math.floor(diff / 86400_000)} gün önce`;
                  })()}
                </Text>
              ) : (
                <NetworkBanner status={connectionState} />
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={styles.callBtn} onPress={handleCallPress} accessibilityRole="button" accessibilityLabel="Sesli arama">
              <Ionicons name="call" size={20} color="#334155" />
            </Pressable>

            <Pressable
              style={[styles.callBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
              onPress={handleOptionsPress}
              accessibilityRole="button"
              accessibilityLabel="Seçenekler"
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#ef4444" />
            </Pressable>
          </View>
        </View>
      </BlurView>

      {/* Report Modal */}
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        reportType="chat_message"
        reportedUserId={activeRecipientId}
        conversationId={conversationId}
      />
    </>
  );
}

function areEqual(prev: ChatHeaderProps, next: ChatHeaderProps): boolean {
  return (
    prev.conversationTitle === next.conversationTitle &&
    prev.isTyping === next.isTyping &&
    prev.peerLastSeen === next.peerLastSeen &&
    prev.connectionState === next.connectionState &&
    prev.activeRecipientId === next.activeRecipientId &&
    prev.userId === next.userId &&
    prev.insets.top === next.insets.top &&
    prev.peerIdCandidates === next.peerIdCandidates &&
    prev.conversationId === next.conversationId
  );
}

export const ChatHeader = React.memo(ChatHeaderInner, areEqual);
