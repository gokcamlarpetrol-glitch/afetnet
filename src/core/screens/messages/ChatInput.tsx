/**
 * CHAT INPUT - Extracted from ConversationScreen
 * Message input area with text input, send button, attachment buttons,
 * voice recording, and edit/reply banners.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, Alert, Keyboard, Platform, ActivityIndicator,
} from 'react-native';
import { styles } from './ConversationScreen.styles';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from '../../components/SafeBlurView';
import { EdgeInsets } from 'react-native-safe-area-context';
import { MeshMessage } from '../../services/mesh/MeshStore';
import { AttachmentsModal } from '../../components/messages/AttachmentsModal';
import { VoiceRecorderUI } from '../../components/messages/VoiceRecorderUI';
import { voiceMessageService } from '../../services/VoiceMessageService';
import { hybridMessageService } from '../../services/HybridMessageService';
import { validateMessage, sanitizeForDisplay } from '../../utils/messageSanitizer';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ChatInput');
const MAX_VOICE_DURATION = 60;

interface ChatInputProps {
  insets: EdgeInsets;
  activeRecipientId: string;
  recipientAliases?: string[];
  activeConversationId: string | null;
  userId: string;
  /** Current text value */
  text: string;
  onTextChange: (text: string) => void;
  /** Send the current text message */
  onSendMessage: () => void;
  /** Reply context */
  replyToMessage: MeshMessage | null;
  onClearReply: () => void;
  /** Edit context */
  editingMessageId: string | null;
  editText: string;
  onEditTextChange: (text: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  /** Scroll to end when keyboard shows */
  onScrollToEnd: () => void;
}

function ChatInputInner({
  insets,
  activeRecipientId,
  recipientAliases,
  activeConversationId,
  userId,
  text,
  onTextChange,
  onSendMessage,
  replyToMessage,
  onClearReply,
  editingMessageId,
  editText,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
  onScrollToEnd,
}: ChatInputProps) {
  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  // Keyboard visibility state (managed internally)
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);
  const voiceRecordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Media sending loading state
  const [isSendingMedia, setIsSendingMedia] = useState(false);

  // CRITICAL FIX: Double-tap send guard. Without this, tapping "send" rapidly
  // creates 2+ messages with the same content (each gets a unique ID).
  const [isSendingText, setIsSendingText] = useState(false);

  // Attachments modal state
  const [attachmentsModalVisible, setAttachmentsModalVisible] = useState(false);

  // Keyboard listener
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        onScrollToEnd();
      }, 100);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [onScrollToEnd]);

  // Cleanup voice recording on unmount
  useEffect(() => {
    return () => {
      if (voiceRecordingIntervalRef.current) {
        clearInterval(voiceRecordingIntervalRef.current);
        voiceRecordingIntervalRef.current = null;
      }
      voiceMessageService.cancelRecording().catch(e => { if (__DEV__) logger.debug('cancelRecording cleanup failed:', e); });
    };
  }, []);

  // Send image message
  const sendImageMessage = useCallback(async (imageUri: string) => {
    if (!activeRecipientId) {
      Alert.alert('Hata', 'Bu kişi için geçerli bir mesajlaşma kimliği bulunamadı. Kişiyi tekrar ekleyin.');
      return;
    }

    haptics.impactMedium();
    setIsSendingMedia(true);
    try {
      await hybridMessageService.sendMediaMessage('image', activeRecipientId, {
        mediaLocalUri: imageUri,
        caption: '',
        conversationId: activeConversationId || undefined,
        recipientAliases,
      });
      haptics.notificationSuccess();
    } catch (error) {
      logger.error('Send image error:', error);
      Alert.alert('Hata', 'Fotograf gonderilemedi.');
    } finally {
      setIsSendingMedia(false);
    }
  }, [activeConversationId, activeRecipientId, recipientAliases]);

  // Open camera
  const handleCameraCapture = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Kameraya erişim için izin vermeniz gerekmektedir.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        // FIX: Use full quality here — HybridMessageService.sendMediaMessage handles
        // compression via ImageManipulator (resize + compress 0.7). Double compression
        // (0.6 × 0.7 = 0.42 effective quality) caused visible artifacts.
        quality: 1.0,
      });

      if (!result.canceled && result.assets?.[0]) {
        const imageUri = result.assets[0].uri;
        await sendImageMessage(imageUri);
      }
    } catch (error) {
      // CRITICAL FIX: Reset isSendingMedia on camera error.
      // Without this, if camera throws after sendImageMessage started,
      // isSendingMedia can stay true forever, blocking all future sends.
      setIsSendingMedia(false);
      logger.error('Camera error:', error);
      Alert.alert('Hata', 'Fotograf cekilemedi.');
    }
  }, [sendImageMessage]);

  // Open gallery
  const handleGallerySelect = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Galeriye erişim için izin vermeniz gerekmektedir.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        // FIX: Use full quality here — HybridMessageService.sendMediaMessage handles
        // compression via ImageManipulator (resize + compress 0.7). Double compression
        // (0.6 × 0.7 = 0.42 effective quality) caused visible artifacts.
        quality: 1.0,
      });

      if (!result.canceled && result.assets?.[0]) {
        const imageUri = result.assets[0].uri;
        await sendImageMessage(imageUri);
      }
    } catch (error) {
      // CRITICAL FIX: Reset isSendingMedia on gallery error.
      // Without this, if gallery selection throws (e.g., permission revoked mid-flow),
      // isSendingMedia stays true forever and blocks all future sends.
      setIsSendingMedia(false);
      logger.error('Gallery error:', error);
      Alert.alert('Hata', 'Fotograf secilemedi.');
    }
  }, [sendImageMessage]);

  // CRITICAL FIX: Handle VoiceMessageService auto-stop callback.
  // Previously ChatInput had its own 60s timer that raced with VoiceMessageService's
  // internal auto-stop timer — both called stopRecording() at ~60s, second one got null.
  // Now only VoiceMessageService manages the auto-stop; ChatInput just keeps a display timer.
  const activeRecipientIdRef = useRef(activeRecipientId);
  activeRecipientIdRef.current = activeRecipientId;
  const activeConversationIdRef = useRef(activeConversationId);
  activeConversationIdRef.current = activeConversationId;
  const recipientAliasesRef = useRef(recipientAliases);
  recipientAliasesRef.current = recipientAliases;

  useEffect(() => {
    voiceMessageService.setOnAutoStop((voiceMessage) => {
      // Clear display timer
      if (voiceRecordingIntervalRef.current) {
        clearInterval(voiceRecordingIntervalRef.current);
        voiceRecordingIntervalRef.current = null;
      }
      setIsRecordingVoice(false);
      setVoiceRecordingDuration(0);

      if (voiceMessage) {
        const recipientId = activeRecipientIdRef.current;
        if (!recipientId) {
          Alert.alert('Hata', 'Bu kişi için geçerli bir mesajlaşma kimliği bulunamadı. Kişiyi tekrar ekleyin.');
          return;
        }

        Alert.alert(
          'Ses Kaydi Hazir',
          '60 saniye doldu. Ses mesajini gondermek ister misiniz?',
          [
            {
              text: 'Iptal',
              style: 'cancel',
              onPress: () => { haptics.notificationWarning(); },
            },
            {
              text: 'Gonder',
              onPress: () => {
                hybridMessageService.sendMediaMessage('voice', recipientId, {
                  mediaLocalUri: voiceMessage.uri,
                  mediaDuration: Math.floor(voiceMessage.durationMs / 1000),
                  conversationId: activeConversationIdRef.current || undefined,
                  recipientAliases: recipientAliasesRef.current,
                }).then(() => {
                  haptics.notificationSuccess();
                }).catch((err) => {
                  logger.error('Auto-stop voice send error:', err);
                  Alert.alert('Hata', 'Ses mesaji gonderilemedi.');
                });
                voiceMessageService.backupToFirebase(voiceMessage).catch(e => { if (__DEV__) logger.debug('Voice backup failed:', e); });
              },
            },
          ],
        );
      }
    });
    return () => { voiceMessageService.setOnAutoStop(null); };
  }, []);

  // Start voice recording
  const handleVoiceRecordStart = useCallback(async () => {
    try {
      if (isRecordingVoice) {
        return;
      }
      const initialized = await voiceMessageService.initialize();
      if (!initialized) {
        Alert.alert('İzin Gerekli', 'Ses kaydı için mikrofon izni vermeniz gerekmektedir.');
        return;
      }
      const success = await voiceMessageService.startRecording();
      if (success) {
        setIsRecordingVoice(true);
        setVoiceRecordingDuration(0);
        haptics.impactMedium();

        if (voiceRecordingIntervalRef.current) {
          clearInterval(voiceRecordingIntervalRef.current);
        }
        // Display-only timer — auto-stop is handled by VoiceMessageService callback
        voiceRecordingIntervalRef.current = setInterval(() => {
          setVoiceRecordingDuration(prev => prev + 1);
        }, 1000);
      } else {
        Alert.alert('Hata', 'Ses kaydı başlatılamadı. Lütfen mikrofon izinlerini kontrol edin.');
      }
    } catch (error) {
      logger.error('Voice recording error:', error);
      Alert.alert('Hata', 'Ses kaydı başlatılamadı.');
    }
  }, [isRecordingVoice]);

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
        if (!activeRecipientId) {
          Alert.alert('Hata', 'Bu kişi için geçerli bir mesajlaşma kimliği bulunamadı. Kişiyi tekrar ekleyin.');
          return;
        }

        await hybridMessageService.sendMediaMessage('voice', activeRecipientId, {
          mediaLocalUri: voiceMessage.uri,
          mediaDuration: Math.floor(voiceMessage.durationMs / 1000),
          conversationId: activeConversationId || undefined,
          recipientAliases,
        });
        haptics.notificationSuccess();

        voiceMessageService.backupToFirebase(voiceMessage).catch((backupError) => {
          logger.warn('Voice backup failed in direct conversation:', backupError);
        });
      }
    } catch (error) {
      logger.error('Voice send error:', error);
      Alert.alert('Hata', 'Ses mesaji gonderilemedi.');
    }
  }, [activeConversationId, activeRecipientId, recipientAliases]);

  // Cancel voice recording
  const handleVoiceRecordCancel = useCallback(async () => {
    try {
      if (voiceRecordingIntervalRef.current) {
        clearInterval(voiceRecordingIntervalRef.current);
        voiceRecordingIntervalRef.current = null;
      }
      await voiceMessageService.cancelRecording();
      haptics.notificationWarning();
    } catch (error) {
      logger.warn('Voice cancel error in conversation:', error);
      Alert.alert('Hata', 'Ses kaydı iptal edilirken bir hata oluştu.');
    } finally {
      setIsRecordingVoice(false);
      setVoiceRecordingDuration(0);
    }
  }, []);

  // Share current location
  const handleShareLocation = useCallback(async () => {
    if (!activeRecipientId) {
      Alert.alert('Hata', 'Bu kişi için geçerli bir mesajlaşma kimliği bulunamadı. Kişiyi tekrar ekleyin.');
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Konum paylaşımı için izin vermeniz gerekmektedir.');
        return;
      }

      haptics.impactLight();
      let timeoutId: NodeJS.Timeout | null = null;
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const timeoutPromise = new Promise<Location.LocationObject | null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), 12000);
      });
      const location = await Promise.race([locationPromise, timeoutPromise]);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (
        !location?.coords ||
        !Number.isFinite(location.coords.latitude) ||
        !Number.isFinite(location.coords.longitude)
      ) {
        Alert.alert('Konum Alınamadı', 'Cihaz konumu zamanında alınamadı. Lütfen tekrar deneyin.');
        return;
      }

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

      await hybridMessageService.sendMediaMessage('location', activeRecipientId, {
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          address,
        },
        conversationId: activeConversationId || undefined,
        recipientAliases,
      });

      haptics.notificationSuccess();
    } catch (error) {
      logger.error('Location share error:', error);
      Alert.alert('Hata', 'Konum paylasilamadi.');
    }
  }, [activeConversationId, activeRecipientId, recipientAliases]);

  return (
    <>
      <BlurView
        intensity={50}
        tint="light"
        style={[
          styles.inputContainer,
          { paddingBottom: keyboardVisible ? 4 : Math.max(insets.bottom, 8) },
        ]}
      >
        {/* Reply Preview Banner */}
        {replyToMessage && (
          <View style={styles.replyBanner}>
            <View style={styles.replyContent}>
              <Ionicons name="arrow-undo" size={16} color="#64748b" />
              <Text style={styles.replyLabel}>Yanitlaniyor:</Text>
              <Text style={styles.replyPreview} numberOfLines={1}>
                {replyToMessage.content}
              </Text>
            </View>
            <Pressable onPress={onClearReply} style={styles.replyClose}>
              <Ionicons name="close" size={20} color="#64748b" />
            </Pressable>
          </View>
        )}

        {/* Edit Mode Banner */}
        {editingMessageId && (
          <View style={styles.editBanner}>
            <View style={styles.editContent}>
              <Ionicons name="create" size={16} color="#0ea5e9" />
              <Text style={styles.editLabel}>Mesaji Duzenleniyor</Text>
            </View>
            <Pressable onPress={onCancelEdit} style={styles.editClose}>
              <Ionicons name="close" size={20} color="#64748b" />
            </Pressable>
          </View>
        )}

        <View style={styles.inputRow}>
          <Pressable
            style={[styles.attachBtn, isSendingMedia && { opacity: 0.5 }]}
            onPress={() => setAttachmentsModalVisible(true)}
            disabled={isSendingMedia}
          >
            {isSendingMedia ? (
              <ActivityIndicator size="small" color="#0ea5e9" />
            ) : (
              <Ionicons name="add" size={24} color="#334155" />
            )}
          </Pressable>

          <TextInput
            style={styles.input}
            placeholder={editingMessageId ? "Duzenlenen mesaj..." : "Mesaj yaz..."}
            placeholderTextColor="#94a3b8"
            value={editingMessageId ? editText : text}
            onChangeText={editingMessageId ? onEditTextChange : onTextChange}
            multiline
            maxLength={10000}
            accessibilityLabel="Mesaj yaz"
          />

          {editingMessageId ? (
            <Pressable
              style={[styles.sendBtn, !editText.trim() && styles.sendBtnDisabled]}
              onPress={onSaveEdit}
              disabled={!editText.trim()}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
            </Pressable>
          ) : text.trim() ? (
            <Pressable
              style={[styles.sendBtn, (isSendingText || isSendingMedia) && styles.sendBtnDisabled]}
              onPress={() => {
                if (isSendingText || isSendingMedia) return;
                setIsSendingText(true);
                // Use microtask to let React batch the state update before firing send
                Promise.resolve().then(() => onSendMessage()).catch(() => { /* send errors handled by caller */ }).finally(() => setIsSendingText(false));
              }}
              disabled={isSendingText || isSendingMedia}
              accessibilityRole="button"
              accessibilityLabel="Mesaj gönder"
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              style={styles.micBtn}
              onPress={handleVoiceRecordStart}
              accessibilityRole="button"
              accessibilityLabel="Sesli mesaj kaydet"
            >
              <Ionicons name="mic" size={22} color="#22c55e" />
            </Pressable>
          )}
        </View>

        {/* Voice Recording UI */}
        {isRecordingVoice && (
          <VoiceRecorderUI
            isRecording={isRecordingVoice}
            duration={voiceRecordingDuration}
            onCancel={handleVoiceRecordCancel}
            onSend={handleVoiceRecordSend}
          />
        )}
      </BlurView>

      {/* Attachments Modal */}
      <AttachmentsModal
        visible={attachmentsModalVisible}
        onClose={() => setAttachmentsModalVisible(false)}
        onSelectCamera={handleCameraCapture}
        onSelectGallery={handleGallerySelect}
        onSelectVoice={handleVoiceRecordStart}
        onSelectLocation={handleShareLocation}
      />
    </>
  );
}

function areEqual(prev: ChatInputProps, next: ChatInputProps): boolean {
  return (
    prev.text === next.text &&
    prev.editText === next.editText &&
    prev.editingMessageId === next.editingMessageId &&
    prev.replyToMessage === next.replyToMessage &&
    prev.activeRecipientId === next.activeRecipientId &&
    prev.activeConversationId === next.activeConversationId &&
    (prev.recipientAliases?.join('|') || '') === (next.recipientAliases?.join('|') || '') &&
    prev.insets.bottom === next.insets.bottom
  );
}

export const ChatInput = React.memo(ChatInputInner, areEqual);
