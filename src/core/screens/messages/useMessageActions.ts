/**
 * useMessageActions - Extracted from ConversationScreen
 * Consolidates message options modal state and handlers:
 * edit, delete, forward, reply, reaction, and modal visibility.
 */

import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { MeshMessage, MessageReaction } from '../../services/mesh/MeshStore';
import { useMeshStore } from '../../services/mesh/MeshStore';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useMessageActions');
import { Message, useMessageStore } from '../../stores/messageStore';
import { hybridMessageService } from '../../services/HybridMessageService';
import { identityService } from '../../services/IdentityService';
import { validateMessage, sanitizeForDisplay } from '../../utils/messageSanitizer';
import * as haptics from '../../utils/haptics';

interface UseMessageActionsParams {
  selfIds: Set<string>;
  messages: MeshMessage[];
  peerIdCandidates: Set<string>;
  activeConversationId: string | null;
  userId: string;
}

export function useMessageActions({
  selfIds,
  messages,
  peerIdCandidates,
  activeConversationId,
  userId,
}: UseMessageActionsParams) {
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MeshMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<MeshMessage | null>(null);

  const updateMeshMessage = useMeshStore(state => state.updateMessage);
  const addMeshReaction = useMeshStore(state => state.addReaction);

  // Handle message long press to show options
  const handleMessageLongPress = useCallback((message: MeshMessage) => {
    haptics.impactLight();
    setSelectedMessage(message);
    setOptionsModalVisible(true);
  }, []);

  // Handle edit message
  const handleEditMessage = useCallback(async (messageId: string) => {
    const message = selectedMessage;
    if (!message) return;

    setEditingMessageId(messageId);
    setEditText(message.content);
    setOptionsModalVisible(false);
  }, [selectedMessage]);

  // Save edited message
  const saveEditedMessage = useCallback(async () => {
    if (!editingMessageId || !editText.trim()) return;

    const validation = validateMessage(editText);
    if (!validation.valid) {
      Alert.alert('Hata', validation.error || 'Gecersiz mesaj');
      return;
    }

    // 1. Instant local feedback in MeshStore (UI re-renders immediately)
    updateMeshMessage(editingMessageId, { content: validation.sanitized });

    // 2. messageStore.editMessage handles persistent local save + Firestore cloud sync
    const success = await useMessageStore.getState().editMessage(editingMessageId, validation.sanitized);
    if (!success) {
      // Fallback: if editMessage returned false (e.g. message not in messageStore yet),
      // also try the Firestore path directly via conversationId
      if (activeConversationId) {
        try {
          const { updateMessageContent } = await import('../../services/firebase/FirebaseMessageOperations');
          await updateMessageContent(activeConversationId, editingMessageId, validation.sanitized);
        } catch (cloudErr) {
          logger.debug('Firestore edit fallback failed:', cloudErr);
        }
      }
    }

    haptics.notificationSuccess();
    setEditingMessageId(null);
    setEditText('');
  }, [editingMessageId, editText, updateMeshMessage, activeConversationId]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingMessageId(null);
    setEditText('');
  }, []);

  // Handle delete message — local + cloud sync
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    const isDeleteForEveryone = messageId.startsWith('EVERYONE:');
    const actualMessageId = isDeleteForEveryone ? messageId.slice(9) : messageId;

    if (isDeleteForEveryone && activeConversationId) {
      try {
        const { deleteMessageForEveryone } = await import('../../services/firebase/FirebaseMessageOperations');
        await deleteMessageForEveryone(activeConversationId, actualMessageId);
      } catch {
        // Fall back to local-only deletion
      }
    }

    updateMeshMessage(actualMessageId, { content: 'Bu mesaj silindi' });
    useMessageStore.getState().deleteMessage(actualMessageId).catch(e => { if (__DEV__) logger.debug('deleteMessage failed:', e); });

    haptics.notificationWarning();
    setOptionsModalVisible(false);
  }, [updateMeshMessage, activeConversationId]);

  // Handle forward message
  const handleForwardMessage = useCallback(async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) {
      setOptionsModalVisible(false);
      return;
    }
    setOptionsModalVisible(false);

    const conversations = useMessageStore.getState().conversations;
    const targets = conversations
      .filter(c => c.userId && !peerIdCandidates.has(c.userId))
      .slice(0, 5);

    if (targets.length === 0) {
      Alert.alert('Bilgi', 'Iletilecek kisi bulunamadi. Once yeni bir sohbet baslatin.');
      return;
    }

    const buttons = targets.map(conv => ({
      text: conv.userName || `Kullanici ${conv.userId.slice(0, 6)}`,
      onPress: async () => {
        try {
          if (msg.mediaType && (msg.mediaType === 'image' || msg.mediaType === 'voice' || msg.mediaType === 'location')) {
            await hybridMessageService.sendMediaMessage(msg.mediaType, conv.userId, {
              mediaUrl: msg.mediaUrl,
              mediaDuration: typeof msg.mediaDuration === 'number' ? msg.mediaDuration : undefined,
              mediaThumbnail: msg.mediaThumbnail,
              location: msg.location,
              caption: msg.content || undefined,
              conversationId: conv.conversationId,
            });
          } else {
            const forwardContent = `Iletilen mesaj:\n${msg.content}`;
            await hybridMessageService.sendMessage(forwardContent, conv.userId, {
              location: msg.location,
              conversationId: conv.conversationId,
            });
          }
          haptics.notificationSuccess();
          Alert.alert('Basarili', 'Mesaj iletildi.');
        } catch {
          Alert.alert('Hata', 'Mesaj iletilemedi.');
        }
      },
    }));

    Alert.alert('Mesaji Ilet', 'Kime iletmek istiyorsunuz?', [
      ...buttons,
      { text: 'Iptal', style: 'cancel' as const },
    ]);
  }, [messages, peerIdCandidates]);

  // Handle reply to message
  const handleReplyToMessage = useCallback((_messageId: string) => {
    const message = selectedMessage;
    if (message) {
      setReplyToMessage(message);
    }
    setOptionsModalVisible(false);
  }, [selectedMessage]);

  // Wire reaction
  const handleReaction = useCallback((messageId: string, emoji: string) => {
    const myUid = identityService.getUid() || 'me';
    addMeshReaction(messageId, emoji as MessageReaction, myUid);
    haptics.impactLight();
    setOptionsModalVisible(false);
  }, [addMeshReaction]);

  // Close options modal
  const closeOptionsModal = useCallback(() => {
    setOptionsModalVisible(false);
    setSelectedMessage(null);
  }, []);

  // Convert selectedMessage to Message format for MessageOptionsModal
  const selectedMessageForModal: Message | null = useMemo(() => {
    if (!selectedMessage) return null;
    const isMe = selfIds.has(selectedMessage.senderId);
    const selectedWithMeta = selectedMessage as MeshMessage & {
      isEdited?: boolean;
      isDeleted?: boolean;
    };
    return {
      id: selectedMessage.id,
      from: isMe ? 'me' : selectedMessage.senderId,
      to: selectedMessage.to || userId || 'broadcast',
      content: selectedMessage.content,
      timestamp: selectedMessage.timestamp,
      delivered: selectedMessage.status === 'delivered' || selectedMessage.status === 'read',
      read: selectedMessage.status === 'read',
      status: selectedMessage.status,
      isEdited: selectedWithMeta.isEdited,
      isDeleted: selectedWithMeta.isDeleted,
    };
  }, [selectedMessage, selfIds, userId]);

  const clearReply = useCallback(() => setReplyToMessage(null), []);

  return {
    // Modal state
    optionsModalVisible,
    selectedMessage,
    selectedMessageForModal,
    // Edit state
    editingMessageId,
    editText,
    setEditText,
    // Reply state
    replyToMessage,
    clearReply,
    // Handlers
    handleMessageLongPress,
    handleEditMessage,
    saveEditedMessage,
    cancelEditing,
    handleDeleteMessage,
    handleForwardMessage,
    handleReplyToMessage,
    handleReaction,
    closeOptionsModal,
  };
}
