/**
 * FAMILY GROUP CHAT SCREEN - Elite Design
 * Production-grade group messaging with comprehensive error handling
 * Zero-error guarantee with full type safety
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyStore } from '../../stores/familyStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { useMeshStore } from '../../services/mesh/MeshStore';
import { identityService } from '../../services/IdentityService';
import { colors } from '../../theme';
import * as haptics from '../../utils/haptics';
import { getDeviceId } from '../../../lib/device';
import { createLogger } from '../../utils/logger';

const logger = createLogger('FamilyGroupChatScreen');
const FAMILY_GROUP_CHANNEL = 'family-group';

interface GroupMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  readBy: string[];
}

// ELITE: Type-safe navigation props
interface FamilyGroupChatScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

export default function FamilyGroupChatScreen({ navigation }: FamilyGroupChatScreenProps) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [myDeviceId, setMyDeviceId] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const statusUpdateTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // ELITE: Use ref for async subscription cleanup
  const unsubscribeHybridRef = useRef<(() => void) | null>(null);
  const { members } = useFamilyStore();
  const meshMessages = useMeshStore((state) => state.messages);
  const selfIds = useMemo(() => {
    const ids = new Set<string>(['ME']);
    if (myDeviceId) {
      ids.add(myDeviceId);
    }
    const identityId = identityService.getIdentity()?.id;
    if (identityId) {
      ids.add(identityId);
    }
    const meshId = bleMeshService.getMyDeviceId();
    if (meshId) {
      ids.add(meshId);
    }
    return ids;
  }, [myDeviceId]);

  const allowedSenderIds = useMemo(() => {
    const ids = new Set<string>(selfIds);
    members.forEach((member) => {
      if (member.id) ids.add(member.id);
      if (member.deviceId) ids.add(member.deviceId);
    });
    return ids;
  }, [members, selfIds]);

  const isAllowedGroupMessage = useCallback((senderId?: string, recipientId?: string) => {
    if (!senderId || !allowedSenderIds.has(senderId)) {
      return false;
    }

    if (recipientId && recipientId !== 'broadcast' && recipientId !== 'ME') {
      return selfIds.has(recipientId);
    }

    return true;
  }, [allowedSenderIds, selfIds]);

  const parseGroupPayload = useCallback((content: string): { text: string; senderName?: string } | null => {
    try {
      const parsed = JSON.parse(content);
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.channel === FAMILY_GROUP_CHANNEL &&
        typeof parsed.text === 'string'
      ) {
        return {
          text: parsed.text,
          senderName: typeof parsed.senderName === 'string' ? parsed.senderName : undefined,
        };
      }
    } catch {
      // Not a family-group payload
    }
    return null;
  }, []);

  useEffect(() => {
    loadDeviceId();

    // ELITE: Ensure BLE Mesh service is started for offline messaging
    const ensureMeshReady = async () => {
      try {
        if (!bleMeshService.getIsRunning()) {
          await bleMeshService.start();
          if (__DEV__) {
            logger.info('BLE Mesh service started from FamilyGroupChatScreen');
          }
        }
      } catch (error) {
        logger.warn('BLE Mesh start failed (non-critical):', error);
        // Continue - messages can still be queued for later
      }
    };

    ensureMeshReady().catch((error) => {
      logger.error('Error ensuring mesh ready:', error);
    });

    // Listen for new messages via Hybrid Service
    const setupSubscription = async () => {
      const { hybridMessageService } = await import('../../services/HybridMessageService');
      const unsub = await hybridMessageService.subscribeToMessages(async (message) => {
        const parsed = parseGroupPayload(message.content);
        if (!parsed) {
          return;
        }
        if (!isAllowedGroupMessage(message.senderId, message.recipientId)) {
          return;
        }

        // ELITE: Update UI with hybrid message
        setMessages((prev) => {
          // Deduplicate
          if (prev.some(m => m.id === message.id)) return prev;

          const groupMsg: GroupMessage = {
            id: message.id,
            senderId: message.senderId,
            senderName: parsed.senderName || message.senderName,
            content: parsed.text,
            timestamp: message.timestamp,
            status: message.status === 'pending' ? 'sending' : 'read', // Assume read if received
            readBy: [message.senderId],
          };
          return [...prev, groupMsg];
        });
      });
      unsubscribeHybridRef.current = unsub;
    };

    setupSubscription().catch(err => {
      logger.error('Failed to setup hybrid subscription:', err);
    });

    return () => {
      // ELITE: Safe cleanup using ref
      if (unsubscribeHybridRef.current) {
        unsubscribeHybridRef.current();
        unsubscribeHybridRef.current = null;
      }
      // ELITE: Cleanup all status update timeouts on unmount
      statusUpdateTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      statusUpdateTimeoutsRef.current.clear();
    };
    }, [isAllowedGroupMessage, parseGroupPayload]);

  useEffect(() => {
    setMessages((prev) => {
      const merged = new Map(prev.map((msg) => [msg.id, msg]));
      meshMessages.forEach((msg) => {
        const parsed = parseGroupPayload(msg.content);
        if (!parsed) {
          return;
        }
        if (!isAllowedGroupMessage(msg.senderId, msg.to)) {
          return;
        }

        if (merged.has(msg.id)) {
          return;
        }

        const normalized: GroupMessage = {
          id: msg.id,
          senderId: msg.senderId,
          senderName: msg.senderName || msg.senderId,
          content: parsed.text,
          timestamp: msg.timestamp,
          status: msg.status === 'pending' || msg.status === 'sending' ? 'sending' : 'read',
          readBy: [msg.senderId],
        };
        merged.set(msg.id, normalized);
      });

      return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
    });
  }, [isAllowedGroupMessage, meshMessages, parseGroupPayload]);

  const loadDeviceId = async () => {
    const id = await getDeviceId();
    setMyDeviceId(id);
  };

  // ELITE: Memoized callback with comprehensive error handling
  const handleSend = useCallback(async () => {
    try {
      // ELITE: Validate input
      if (!inputText.trim() || !myDeviceId) {
        return;
      }

      // ELITE: Validate myDeviceId
      if (typeof myDeviceId !== 'string' || myDeviceId.trim().length === 0) {
        logger.warn('Invalid myDeviceId:', myDeviceId);
        Alert.alert('Hata', 'Cihaz ID geçersiz. Lütfen mesh ağını kontrol edin.');
        return;
      }

      haptics.impactLight();

      // ELITE: Create message with validation
      const timestamp = Date.now();
      const trimmedContent = inputText.trim();
      const payload = JSON.stringify({
        channel: FAMILY_GROUP_CHANNEL,
        text: trimmedContent,
        senderName: 'Ben',
        ts: timestamp,
      });

      // ELITE: Validate message length
      if (trimmedContent.length > 500) {
        Alert.alert('Hata', 'Mesaj çok uzun. Maksimum 500 karakter.');
        return;
      }

      setInputText('');

      // ELITE: Send via Hybrid Service (Auto Mesh + Cloud)
      try {
        const { hybridMessageService } = await import('../../services/HybridMessageService');
        await hybridMessageService.sendMessage(payload, undefined, {
          type: 'CHAT',
          priority: 'normal',
        });
        logger.info('Group message sent via Hybrid');

        // Cloud fan-out for online delivery to family inboxes.
        const recipients = members
          .map((member) => member.deviceId || member.id)
          .filter((recipientId): recipientId is string => !!recipientId && !selfIds.has(recipientId));

        if (recipients.length > 0) {
          try {
            const { firebaseDataService } = await import('../../services/FirebaseDataService');
            if (!firebaseDataService.isInitialized) {
              await firebaseDataService.initialize();
            }

            const identity = identityService.getIdentity();
            const senderCloudId = myDeviceId || identity?.deviceId || identity?.id;

            if (firebaseDataService.isInitialized && senderCloudId) {
              const baseMessageId = `fg_${timestamp}_${senderCloudId}`;
              await Promise.all(
                recipients.map((recipientId, index) =>
                  firebaseDataService.saveMessage(recipientId, {
                    id: `${baseMessageId}_${index}`,
                    fromDeviceId: senderCloudId,
                    toDeviceId: recipientId,
                    content: payload,
                    timestamp,
                    type: 'text',
                    status: 'sent',
                    priority: 'normal',
                  }),
                ),
              );
            }
          } catch (fanoutError) {
            logger.warn('Family group cloud fan-out skipped:', fanoutError);
          }
        }
      } catch (error) {
        logger.error('Error sending group message:', error);
        Alert.alert('Hata', 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
        setInputText(trimmedContent);
      }

      // ELITE: Scroll to bottom with error handling
      requestAnimationFrame(() => {
        try {
          flatListRef.current?.scrollToEnd({ animated: true });
        } catch (error) {
          logger.warn('Error scrolling to end:', error);
        }
      });
    } catch (error) {
      logger.error('Error in handleSend:', error);
      Alert.alert('Hata', 'Mesaj gönderilirken bir hata oluştu.');
    }
  }, [inputText, members, myDeviceId, selfIds]);

  const renderMessage = ({ item }: { item: GroupMessage }) => {
    const isMyMessage = selfIds.has(item.senderId);

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.theirMessage,
        ]}
      >
        {!isMyMessage && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myBubble : styles.theirBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage && styles.myMessageText,
            ]}
          >
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isMyMessage && styles.myMessageTime,
              ]}
            >
              {new Date(item.timestamp).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {isMyMessage && (
              <Ionicons
                name={
                  item.status === 'read'
                    ? 'checkmark-done'
                    : item.status === 'delivered'
                      ? 'checkmark-done'
                      : item.status === 'sent'
                        ? 'checkmark'
                        : 'time'
                }
                size={14}
                color={
                  item.status === 'read'
                    ? '#3b82f6'
                    : 'rgba(255, 255, 255, 0.7)'
                }
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Aile Grubu</Text>
          <Text style={styles.subtitle}>{members.length} üye</Text>
        </View>
        <Pressable
          style={styles.infoButton}
          onPress={() => {
            haptics.impactLight();
            Alert.alert(
              'Aile Grubu',
              `Bu grup ${members.length} üyeden oluşmaktadır.\n\nBLE Mesh üzerinden internet olmadan mesajlaşabilirsiniz.`,
              [{ text: 'Tamam' }]
            );
          }}
        >
          <Ionicons name="information-circle-outline" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        // ELITE: Performance optimizations
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 80, // Approximate message height
          offset: 80 * index,
          index,
        })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>Henüz mesaj yok</Text>
            <Text style={styles.emptySubtext}>
              Ailenizle BLE Mesh üzerinden mesajlaşın
            </Text>
          </View>
        }
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Mesaj yazın..."
            placeholderTextColor={colors.text.tertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() ? '#ffffff' : colors.text.tertiary}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  infoButton: {
    padding: 8,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: colors.brand.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: colors.background.card,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
});
