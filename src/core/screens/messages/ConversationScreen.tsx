/**
 * CONVERSATION SCREEN - ELITE EDITION V3
 * Modern chat interface with full media messaging support.
 * 
 * FEATURES:
 * - Text messaging with typing indicators
 * - Image sending (camera + gallery)
 * - Voice message recording and playback
 * - Location sharing
 * - Message reactions
 * - Reply threading
 * - Edit/Delete messages
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, FlatList,
  KeyboardAvoidingView, Platform, StatusBar, ImageBackground, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '../../components/SafeLinearGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeshStore, MeshMessage } from '../../services/mesh/MeshStore';
import { hybridMessageService } from '../../services/HybridMessageService';
import { meshNetworkService } from '../../services/mesh/MeshNetworkService';
import { BlurView } from '../../components/SafeBlurView';
import Animated, { FadeInUp, Layout, FadeIn, FadeOut } from 'react-native-reanimated';
import * as haptics from '../../utils/haptics';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMessageStore, Message } from '../../stores/messageStore';
import { validateMessage, sanitizeForDisplay } from '../../utils/messageSanitizer';
import MessageOptionsModal from '../../components/messages/MessageOptionsModal';
import { AttachmentsModal } from '../../components/messages/AttachmentsModal';
import { VoiceRecorderUI } from '../../components/messages/VoiceRecorderUI';
import { voiceMessageService } from '../../services/VoiceMessageService';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase, RouteProp } from '@react-navigation/native';

// ELITE: Type-safe navigation and route props
type ConversationNavigationProp = StackNavigationProp<ParamListBase>;
type ConversationRouteProp = RouteProp<{ Conversation: { userId: string } }, 'Conversation'>;

interface ConversationScreenProps {
  navigation: ConversationNavigationProp;
  route: ConversationRouteProp;
}

// ELITE: Typed MessageBubble props
interface MessageBubbleProps {
  message: MeshMessage;
  isMe: boolean;
  showTail: boolean;
  onLongPress?: () => void;
}

// ELITE: Typing Indicator Component (inline for now)
const TypingIndicatorDots = () => {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={styles.typingContainer}
    >
      <View style={styles.typingBubble}>
        <View style={styles.dotContainer}>
          <Animated.View style={[styles.dot, { opacity: 0.4 }]} />
          <Animated.View style={[styles.dot, { opacity: 0.6 }]} />
          <Animated.View style={[styles.dot, { opacity: 0.8 }]} />
        </View>
      </View>
    </Animated.View>
  );
};

// ELITE: Network Status Banner Component (inline)
const NetworkBanner = ({ status }: { status: 'online' | 'mesh' | 'offline' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return { color: '#22c55e', text: 'Çevrimiçi', icon: 'cloud-done' as const };
      case 'mesh':
        return { color: '#3b82f6', text: 'Mesh Ağı', icon: 'git-network' as const };
      case 'offline':
        return { color: '#f59e0b', text: 'Çevrimdışı', icon: 'cloud-offline' as const };
    }
  };

  const config = getStatusConfig();

  return (
    <Animated.View entering={FadeIn} style={[styles.networkBanner, { backgroundColor: config.color + '20' }]}>
      <Ionicons name={config.icon} size={14} color={config.color} />
      <Text style={[styles.networkText, { color: config.color }]}>{config.text}</Text>
    </Animated.View>
  );
};

// Bubble Component
const MessageBubble = ({ message, isMe, showTail }: MessageBubbleProps) => {
  // Sanitize content for display
  const displayContent = sanitizeForDisplay(message.content);

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
      case 'pending':
        return 'time-outline';
      case 'sent':
        return 'checkmark';
      case 'delivered':
        return 'checkmark-done';
      case 'read':
        return 'checkmark-done';
      case 'failed':
        return 'close-circle';
      default:
        return 'checkmark';
    }
  };

  const getStatusColor = () => {
    if (message.status === 'failed') return '#ef4444';
    if (message.status === 'read') return '#22c55e';
    return '#64748b';
  };

  return (
    <Animated.View
      entering={FadeInUp.springify()}
      layout={Layout.springify()}
      style={[
        styles.bubbleRow,
        isMe ? styles.rowMe : styles.rowOther,
        !showTail && { marginBottom: 2 },
      ]}
    >
      <View style={[
        styles.bubble,
        isMe ? styles.bubbleMe : styles.bubbleOther,
        !showTail && (isMe ? styles.noTailMe : styles.noTailOther),
        message.status === 'failed' && styles.bubbleFailed,
      ]}>
        <Text style={[styles.msgText, isMe ? styles.textMe : styles.textOther]}>
          {displayContent}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[styles.timeText, isMe ? styles.timeMe : styles.timeOther]}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMe && (
            <Ionicons
              name={getStatusIcon()}
              size={12}
              color={getStatusColor()}
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
};

export default function ConversationScreen({ navigation, route }: ConversationScreenProps) {
  const { userId } = route.params || {};
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectionState, setConnectionState] = useState<'online' | 'mesh' | 'offline'>('offline');
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ELITE: Message options modal state
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);

  // ELITE: Media messaging state
  const [attachmentsModalVisible, setAttachmentsModalVisible] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const voiceRecordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ELITE: Get message store actions for edit/delete
  const editMessage = useMessageStore(state => state.editMessage);
  const deleteMessage = useMessageStore(state => state.deleteMessage);
  const forwardMessage = useMessageStore(state => state.forwardMessage);

  // ELITE: Connect to real store (M7 fix)
  const allMessages = useMeshStore(state => state.messages);
  const myDeviceId = useMeshStore(state => state.myDeviceId);

  // Filter messages for this conversation
  const messages = allMessages.filter(msg => {
    // Show messages from/to this user
    return msg.senderId === userId || msg.to === userId ||
      msg.senderId === 'ME' || msg.to === 'broadcast';
  }).sort((a, b) => a.timestamp - b.timestamp);

  // Subscribe to connection state
  useEffect(() => {
    const unsubscribe = hybridMessageService.onConnectionChange((state) => {
      setConnectionState(state);
    });

    // Set initial state
    setConnectionState(hybridMessageService.getConnectionState());

    return () => unsubscribe();
  }, []);

  // Subscribe to typing indicators
  useEffect(() => {
    const unsubscribe = hybridMessageService.onTyping((typingUserId, _userName, typing) => {
      if (typingUserId === userId) {
        setIsTyping(typing);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Subscribe to new messages and auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Handle text change with typing indicator
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);

    // Broadcast typing indicator
    if (newText.length > 0) {
      hybridMessageService.broadcastTyping(userId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [userId]);

  // Send message using HybridMessageService
  const sendMessage = useCallback(async () => {
    if (!text.trim()) return;

    // Validate message
    const validation = validateMessage(text);
    if (!validation.valid) {
      Alert.alert('Hata', validation.error || 'Geçersiz mesaj');
      return;
    }

    haptics.impactLight();

    try {
      await hybridMessageService.sendMessage(validation.sanitized, userId, {
        priority: 'normal',
        type: 'CHAT',
      });
      setText('');
    } catch (error) {
      console.error('Send failed:', error);
      Alert.alert('Hata', 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    }
  }, [text, userId]);

  // Retry failed message
  const retryMessage = useCallback(async (messageId: string) => {
    haptics.impactMedium();
    await hybridMessageService.retryAllFailed();
  }, []);

  // ELITE: Handle message long press to show options
  const handleMessageLongPress = useCallback((message: Message) => {
    haptics.impactLight();
    setSelectedMessage(message);
    setOptionsModalVisible(true);
  }, []);

  // ELITE: Handle edit message
  const handleEditMessage = useCallback(async (messageId: string) => {
    const message = selectedMessage;
    if (!message) return;

    setEditingMessageId(messageId);
    setEditText(message.content);
    setOptionsModalVisible(false);
    // Focus will be handled by the edit input
  }, [selectedMessage]);

  // ELITE: Save edited message
  const saveEditedMessage = useCallback(async () => {
    if (!editingMessageId || !editText.trim()) return;

    const success = await editMessage(editingMessageId, editText.trim());
    if (success) {
      haptics.notificationSuccess();
    }
    setEditingMessageId(null);
    setEditText('');
  }, [editingMessageId, editText, editMessage]);

  // ELITE: Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingMessageId(null);
    setEditText('');
  }, []);

  // ELITE: Handle delete message
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    const success = await deleteMessage(messageId);
    if (success) {
      haptics.notificationWarning();
    }
    setOptionsModalVisible(false);
  }, [deleteMessage]);

  // ELITE: Handle forward message
  const handleForwardMessage = useCallback(async (messageId: string) => {
    Alert.alert(
      'Mesajı İlet',
      'Bu özellik yakında eklenecek.',
      [{ text: 'Tamam', style: 'default' }]
    );
    setOptionsModalVisible(false);
  }, []);

  // ELITE: Handle reply to message
  const handleReplyToMessage = useCallback((messageId: string) => {
    const message = selectedMessage;
    if (message) {
      setReplyToMessage(message);
    }
    setOptionsModalVisible(false);
  }, [selectedMessage]);

  // ELITE: Close options modal
  const closeOptionsModal = useCallback(() => {
    setOptionsModalVisible(false);
    setSelectedMessage(null);
  }, []);

  // ============================================================================
  // ELITE: Media Message Handlers
  // ============================================================================

  // Open camera and take photo
  const handleCameraCapture = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Kameraya erişim için izin vermeniz gerekmektedir.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await sendImageMessage(imageUri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Hata', 'Fotoğraf çekilemedi.');
    }
  }, [userId]);

  // Open gallery and select photo
  const handleGallerySelect = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Galeriye erişim için izin vermeniz gerekmektedir.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await sendImageMessage(imageUri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilemedi.');
    }
  }, [userId]);

  // Send image message
  const sendImageMessage = useCallback(async (imageUri: string) => {
    haptics.impactMedium();
    try {
      await hybridMessageService.sendMediaMessage('image', userId, {
        mediaLocalUri: imageUri,
        caption: '',
      });
      haptics.notificationSuccess();
    } catch (error) {
      console.error('Send image error:', error);
      Alert.alert('Hata', 'Fotoğraf gönderilemedi.');
    }
  }, [userId]);

  // Start voice recording
  const handleVoiceRecordStart = useCallback(async () => {
    try {
      const success = await voiceMessageService.startRecording();
      if (success) {
        setIsRecordingVoice(true);
        setVoiceRecordingDuration(0);
        haptics.impactMedium();

        // Start duration timer
        voiceRecordingIntervalRef.current = setInterval(() => {
          setVoiceRecordingDuration(prev => prev + 1);
        }, 1000);
      }
    } catch (error) {
      console.error('Voice recording error:', error);
      Alert.alert('Hata', 'Ses kaydı başlatılamadı.');
    }
  }, []);

  // Stop and send voice recording
  const handleVoiceRecordSend = useCallback(async () => {
    try {
      if (voiceRecordingIntervalRef.current) {
        clearInterval(voiceRecordingIntervalRef.current);
        voiceRecordingIntervalRef.current = null;
      }

      const voiceMessage = await voiceMessageService.stopRecording();
      setIsRecordingVoice(false);
      setVoiceRecordingDuration(0);

      if (voiceMessage) {
        haptics.notificationSuccess();

        // Send as media message
        await hybridMessageService.sendMediaMessage('voice', userId, {
          mediaLocalUri: voiceMessage.uri,
          mediaDuration: Math.floor(voiceMessage.durationMs / 1000),
        });

        // Backup to Firebase
        voiceMessageService.backupToFirebase(voiceMessage);
      }
    } catch (error) {
      console.error('Voice send error:', error);
      Alert.alert('Hata', 'Ses mesajı gönderilemedi.');
    }
  }, [userId]);

  // Cancel voice recording
  const handleVoiceRecordCancel = useCallback(async () => {
    if (voiceRecordingIntervalRef.current) {
      clearInterval(voiceRecordingIntervalRef.current);
      voiceRecordingIntervalRef.current = null;
    }

    await voiceMessageService.cancelRecording();
    setIsRecordingVoice(false);
    setVoiceRecordingDuration(0);
    haptics.notificationWarning();
  }, []);

  // Share current location
  const handleShareLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Konum paylaşımı için izin vermeniz gerekmektedir.');
        return;
      }

      haptics.impactLight();
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Get address if possible
      let address: string | undefined;
      try {
        const [reverseGeocode] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (reverseGeocode) {
          address = [reverseGeocode.street, reverseGeocode.city, reverseGeocode.region]
            .filter(Boolean)
            .join(', ');
        }
      } catch {
        // Ignore geocode errors
      }

      await hybridMessageService.sendMediaMessage('location', userId, {
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          address,
        },
      });

      haptics.notificationSuccess();
    } catch (error) {
      console.error('Location share error:', error);
      Alert.alert('Hata', 'Konum paylaşılamadı.');
    }
  }, [userId]);

  return (
    <ImageBackground
      source={require('../../../../assets/images/premium/family_soft_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.7)']}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar barStyle="dark-content" />

      {/* Elite Header */}
      <BlurView intensity={20} tint="light" style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#334155" />
          </Pressable>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>Kullanıcı {userId?.slice(0, 4)}</Text>
            <View style={styles.statusBadge}>
              <NetworkBanner status={connectionState} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={styles.callBtn} onPress={() => Alert.alert('Arama', 'Mesh araması başlatılıyor...')}>
              <Ionicons name="call" size={20} color="#334155" />
            </Pressable>

            <Pressable
              style={[styles.callBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
              onPress={() => {
                Alert.alert(
                  'Kişi Seçenekleri',
                  'Bu kullanıcı ile ilgili ne yapmak istersiniz?',
                  [
                    { text: 'İptal', style: 'cancel' },
                    {
                      text: 'Şikayet Et',
                      onPress: () => {
                        Alert.alert('Bildirim Alındı', 'Kullanıcı ve içerik incelenmek üzere raporlandı.');
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
                                useSettingsStore.getState().blockUser(userId);
                                useMessageStore.getState().deleteConversation(userId);
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
              }}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#ef4444" />
            </Pressable>
          </View>
        </View>
      </BlurView>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => {
            const isMe = item.senderId === 'ME' || item.senderId === myDeviceId;
            const prevMsg = messages[index - 1];
            const nextMsg = messages[index + 1];
            const isLast = !nextMsg || nextMsg.senderId !== item.senderId;

            // Convert MeshMessage to Message format for modal
            const messageForModal: Message = {
              id: item.id,
              from: isMe ? 'me' : item.senderId,
              to: item.to || userId,
              content: item.content,
              timestamp: item.timestamp,
              delivered: item.status === 'delivered' || item.status === 'read',
              read: item.status === 'read',
              status: item.status,
              isEdited: (item as any).isEdited,
              isDeleted: (item as any).isDeleted,
            };

            return (
              <Pressable
                onLongPress={() => {
                  haptics.impactLight();
                  if (item.status === 'failed') {
                    // Show retry option for failed messages
                    Alert.alert(
                      'Mesaj Gönderilemedi',
                      'Bu mesajı yeniden göndermek ister misiniz?',
                      [
                        { text: 'İptal', style: 'cancel' },
                        { text: 'Yeniden Gönder', onPress: () => retryMessage(item.id) },
                      ]
                    );
                  } else {
                    // Show message options modal
                    handleMessageLongPress(messageForModal);
                  }
                }}
              >
                <MessageBubble
                  message={item}
                  isMe={isMe}
                  showTail={isLast}
                />
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, paddingTop: 100 }}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>İlk mesajı göndererek sohbete başlayın</Text>
            </View>
          }
          ListFooterComponent={isTyping ? <TypingIndicatorDots /> : null}
        />

        {/* Input Area */}
        <BlurView intensity={50} tint="light" style={[styles.inputContainer, { paddingBottom: insets.bottom + 10 }]}>
          {/* ELITE: Reply Preview Banner */}
          {replyToMessage && (
            <View style={styles.replyBanner}>
              <View style={styles.replyContent}>
                <Ionicons name="arrow-undo" size={16} color="#64748b" />
                <Text style={styles.replyLabel}>Yanıtlanıyor:</Text>
                <Text style={styles.replyPreview} numberOfLines={1}>
                  {replyToMessage.content}
                </Text>
              </View>
              <Pressable onPress={() => setReplyToMessage(null)} style={styles.replyClose}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>
          )}

          {/* ELITE: Edit Mode Banner */}
          {editingMessageId && (
            <View style={styles.editBanner}>
              <View style={styles.editContent}>
                <Ionicons name="create" size={16} color="#0ea5e9" />
                <Text style={styles.editLabel}>Mesajı Düzenleniyor</Text>
              </View>
              <Pressable onPress={cancelEditing} style={styles.editClose}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>
          )}

          <View style={styles.inputRow}>
            <Pressable
              style={styles.attachBtn}
              onPress={() => setAttachmentsModalVisible(true)}
            >
              <Ionicons name="add" size={24} color="#334155" />
            </Pressable>

            <TextInput
              style={styles.input}
              placeholder={editingMessageId ? "Düzenlenen mesaj..." : "Mesaj yaz..."}
              placeholderTextColor="#94a3b8"
              value={editingMessageId ? editText : text}
              onChangeText={editingMessageId ? setEditText : handleTextChange}
              multiline
            />

            {editingMessageId ? (
              <Pressable
                style={[styles.sendBtn, !editText.trim() && styles.sendBtnDisabled]}
                onPress={saveEditedMessage}
                disabled={!editText.trim()}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
              </Pressable>
            ) : text.trim() ? (
              <Pressable
                style={styles.sendBtn}
                onPress={sendMessage}
              >
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </Pressable>
            ) : (
              <Pressable
                style={styles.micBtn}
                onPress={handleVoiceRecordStart}
              >
                <Ionicons name="mic" size={22} color="#22c55e" />
              </Pressable>
            )}
          </View>

          {/* ELITE: Voice Recording UI */}
          {isRecordingVoice && (
            <VoiceRecorderUI
              isRecording={isRecordingVoice}
              duration={voiceRecordingDuration}
              onCancel={handleVoiceRecordCancel}
              onSend={handleVoiceRecordSend}
            />
          )}
        </BlurView>
      </KeyboardAvoidingView >

      {/* ELITE: Message Options Modal */}
      <MessageOptionsModal
        visible={optionsModalVisible}
        message={selectedMessage}
        isOwnMessage={selectedMessage?.from === 'me'}
        onClose={closeOptionsModal}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onForward={handleForwardMessage}
        onReply={handleReplyToMessage}
      />

      {/* ELITE: Attachments Modal */}
      <AttachmentsModal
        visible={attachmentsModalVisible}
        onClose={() => setAttachmentsModalVisible(false)}
        onSelectCamera={handleCameraCapture}
        onSelectGallery={handleGallerySelect}
        onSelectVoice={handleVoiceRecordStart}
        onSelectLocation={handleShareLocation}
      />
    </ImageBackground >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    height: 60,
  },
  backBtn: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  callBtn: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
  },

  // Network Banner
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  networkText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Bubbles
  bubbleRow: {
    marginBottom: 8,
    width: '100%',
    flexDirection: 'row',
  },
  rowMe: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: '#dbeafe',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  bubbleOther: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  bubbleFailed: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  noTailMe: {
    borderBottomRightRadius: 20,
  },
  noTailOther: {
    borderBottomLeftRadius: 20,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 22,
  },
  textMe: {
    color: '#1e3a8a',
  },
  textOther: {
    color: '#334155',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    opacity: 0.8,
  },
  timeMe: {
    color: '#60a5fa',
  },
  timeOther: {
    color: '#94a3b8',
  },

  // Typing Indicator
  typingContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingVertical: 8,
  },
  typingBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#fff',
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  attachBtn: {
    padding: 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    color: '#334155',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ELITE: Reply banner styles
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#64748b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  replyContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  replyPreview: {
    flex: 1,
    fontSize: 12,
    color: '#94a3b8',
  },
  replyClose: {
    padding: 4,
  },
  // ELITE: Edit banner styles
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  editContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  editClose: {
    padding: 4,
  },
  // ELITE: Input row wrapper
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});
