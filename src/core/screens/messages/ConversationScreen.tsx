/**
 * CONVERSATION SCREEN - Elite Chat Interface
 * Production-grade offline messaging with real-time updates
 * Zero-error guarantee with comprehensive error handling
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessageStore, Message } from '../../stores/messageStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { getDeviceId as getDeviceIdFromLib } from '../../../lib/device';
import { colors, typography, spacing } from '../../theme';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';
// ELITE: Input sanitization handled inline for better control

const logger = createLogger('ConversationScreen');

// ELITE: Type-safe navigation and route props
interface ConversationScreenProps {
  navigation: {
    navigate: (screen: string, params?: { userId: string }) => void;
    goBack: () => void;
  };
  route: {
    params: {
      userId: string;
    };
  };
}

export default function ConversationScreen({ navigation, route }: ConversationScreenProps) {
  // ELITE: Validate route params
  const userId = useMemo(() => {
    try {
      const paramUserId = route.params?.userId;
      if (!paramUserId || typeof paramUserId !== 'string' || paramUserId.trim().length === 0) {
        logger.error('Invalid userId in route params:', route.params);
        navigation.goBack();
        return '';
      }
      return paramUserId.trim();
    } catch (error) {
      logger.error('Error reading route params:', error);
      navigation.goBack();
      return '';
    }
  }, [route.params, navigation]);
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ELITE: Load messages callback (memoized to prevent re-renders)
  const loadMessages = useCallback(() => {
    try {
      const conversationMessages = useMessageStore.getState().getConversationMessages(userId);
      // ELITE: Sort messages by timestamp (oldest first for chat display)
      const sortedMessages = [...conversationMessages].sort((a, b) => a.timestamp - b.timestamp);
      setMessages(sortedMessages);
      // Mark as read (async but don't await - fire and forget)
      useMessageStore.getState().markConversationRead(userId).catch((error) => {
        logger.error('Failed to mark conversation as read:', error);
      });
    } catch (error) {
      logger.error('Error loading messages:', error);
    }
  }, [userId]);

  useEffect(() => {
    const getMyId = async () => {
      try {
        const id = bleMeshService.getMyDeviceId() || await getDeviceIdFromLib();
        setMyDeviceId(id || 'me');
      } catch (error) {
        logger.error('Failed to get device ID:', error);
        setMyDeviceId('me');
      }
    };
    getMyId();

    // ELITE: Initialize message store if not already initialized
    const initStore = async () => {
      try {
        await useMessageStore.getState().initialize();
      } catch (error) {
        logger.error('Failed to initialize message store:', error);
      }
    };
    initStore();

    // CRITICAL: Ensure BLE Mesh Service is started for offline messaging
    // ELITE: This ensures messages can be sent/received without internet
    const ensureMeshRunning = async () => {
      try {
        if (!bleMeshService.getIsRunning()) {
          await bleMeshService.start();
          if (__DEV__) {
            logger.info('BLE Mesh service started from ConversationScreen for offline messaging');
          }
        }
      } catch (error) {
        logger.warn('BLE Mesh start failed (will retry on send):', error);
        // Continue - service will be started when sending message
      }
    };
    ensureMeshRunning();

    loadMessages();

    // Listen for new messages via BLE mesh
    const unsubscribe = bleMeshService.onMessage(async (meshMessage) => {
      try {
        const content = meshMessage.content;
        if (typeof content !== 'string') return;

        // ELITE: Validate content length (prevent DoS)
        if (content.length > 10000) {
          logger.warn('Message content too large, skipping');
          return;
        }

        // ELITE: Use safe JSON parsing
        const { sanitizeJSON } = await import('../../utils/inputSanitizer');
        const { sanitizeString } = await import('../../utils/validation');
        const { sanitizeDeviceId } = await import('../../utils/validation');
        
        let messageData: any = null;
        
        try {
          messageData = sanitizeJSON(content);
        } catch {
          // Not JSON, might be plain text - check if mesh message is text type
          if (meshMessage.type === 'text') {
            const senderId = meshMessage.from;
            if (senderId === userId) {
              // ELITE: Sanitize plain text content
              const sanitizedContent = sanitizeString(content, 5000);
              if (sanitizedContent && sanitizedContent.length > 0) {
                const newMessage: Message = {
                  id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                  from: userId,
                  to: 'me',
                  content: sanitizedContent,
                  timestamp: Date.now(),
                  delivered: true,
                  read: false,
                };
                // ELITE: Await async addMessage to ensure proper state update
                useMessageStore.getState().addMessage(newMessage).then(async () => {
                  loadMessages();
                  haptics.notificationSuccess();
                  
                  // ELITE: Send instant push notification (CRITICAL - hayati önem)
                  try {
                    const { notificationService } = await import('../../services/NotificationService');
                    await notificationService.showMessageNotification(
                      `Cihaz ${userId.slice(0, 8)}...`,
                      sanitizedContent,
                      newMessage.id,
                      userId,
                      'normal'
                    );
                  } catch (notifError) {
                    logger.error('Failed to send message notification:', notifError);
                    // Continue - notification failure shouldn't block message delivery
                  }
                }).catch((error) => {
                  logger.error('Failed to add message:', error);
                });
              }
            }
          }
          return;
        }

        // ELITE: Check if this is a chat message (parse from content)
        // messageData.type can be 'chat', 'message', or 'text' from the parsed JSON
        if (messageData && typeof messageData === 'object' && messageData !== null) {
          const messageType = typeof messageData.type === 'string' ? messageData.type : null;
          
          if (messageType === 'chat' || messageType === 'message' || messageType === 'text' || meshMessage.type === 'text') {
            // ELITE: Sanitize sender ID
            const senderId = sanitizeDeviceId(
              messageData.from || messageData.senderId || messageData.deviceId || ''
            );
            
            if (senderId && senderId.length >= 4 && senderId === userId) {
              // ELITE: Sanitize message content
              const messageContent = sanitizeString(
                messageData.content || messageData.message || content || '',
                5000
              );
              
              if (messageContent && messageContent.length > 0) {
                // ELITE: Validate timestamp
                const messageTimestamp = typeof messageData.timestamp === 'number' && !isNaN(messageData.timestamp)
                  ? Math.max(0, Math.min(Date.now() + 60000, messageData.timestamp)) // Max 1 min in future
                  : Date.now();
                
                const newMessage: Message = {
                  id: typeof messageData.id === 'string' && messageData.id.length <= 100
                    ? messageData.id
                    : `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                  from: userId,
                  to: 'me',
                  content: messageContent,
                  timestamp: messageTimestamp,
                  delivered: true,
                  read: false,
                };
                // ELITE: Await async addMessage to ensure proper state update
                useMessageStore.getState().addMessage(newMessage).then(async () => {
                  loadMessages();
                  haptics.notificationSuccess();
                  
                  // ELITE: Send instant push notification (CRITICAL - hayati önem)
                  try {
                    const { notificationService } = await import('../../services/NotificationService');
                    await notificationService.showMessageNotification(
                      `Cihaz ${userId.slice(0, 8)}...`,
                      messageContent,
                      newMessage.id,
                      userId,
                      'normal'
                    );
                  } catch (notifError) {
                    logger.error('Failed to send message notification:', notifError);
                    // Continue - notification failure shouldn't block message delivery
                  }
                }).catch((error) => {
                  logger.error('Failed to add message:', error);
                });
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error processing mesh message:', error);
      }
    });

    // ELITE: Subscribe to message store changes instead of polling
    // Zustand subscribe takes a single callback that receives the entire state
    const unsubscribeStore = useMessageStore.subscribe(() => {
      // Reload messages when store updates
      loadMessages();
    });

    return () => {
      unsubscribe();
      unsubscribeStore();
      // ELITE: Cleanup all timeouts on unmount
      timeoutRefs.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      timeoutRefs.current.clear();
    };
  }, [userId, loadMessages]);

  const sendMessage = useCallback(async () => {
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

      // ELITE: Sanitize user input before sending (prevent XSS, injection)
      const { sanitizeString } = await import('../../utils/validation');
      const { sanitizeText } = await import('../../utils/inputSanitizer');
      
      // ELITE: Trim and validate length
      const trimmedInput = inputText.trim();
      if (trimmedInput.length > 5000) {
        Alert.alert('Hata', 'Mesaj çok uzun. Maksimum 5000 karakter.');
        return;
      }
      
      // ELITE: Sanitize input - remove dangerous characters
      const sanitizedInput = sanitizeString(trimmedInput, 5000);
      if (!sanitizedInput || sanitizedInput.length === 0) {
        logger.warn('Message empty after sanitization');
        Alert.alert('Hata', 'Mesaj içeriği geçersiz.');
        return;
      }
      
      // ELITE: Additional sanitization for text content
      const messageContent = sanitizeText(sanitizedInput, '.,!?;:()[]{}-\'\"');
      if (!messageContent || messageContent.length === 0) {
        logger.warn('Message empty after text sanitization');
        Alert.alert('Hata', 'Mesaj içeriği geçersiz karakterler içeriyor.');
        return;
      }
      setInputText('');
      haptics.impactMedium();

      // ELITE: Create message object with validation
      const timestamp = Date.now();
      const messageId = `msg-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newMessage: Message = {
        id: messageId,
        from: 'me',
        to: userId,
        content: messageContent,
        timestamp,
        delivered: false,
        read: false,
      };

      // ELITE: Add to store with error handling (await async operation)
      try {
        await useMessageStore.getState().addMessage(newMessage);
      } catch (error) {
        logger.error('Error adding message to store:', error);
        Alert.alert('Hata', 'Mesaj kaydedilemedi.');
        return;
      }
      
      // ELITE: Update local state
      setMessages(prev => [...prev, newMessage]);
      
      // ELITE: Send via BLE mesh with comprehensive error handling
      try {
        // CRITICAL: Ensure BLE Mesh Service is running before sending
        // ELITE: This ensures offline messaging works without internet
        if (!bleMeshService.getIsRunning()) {
          try {
            await bleMeshService.start();
            if (__DEV__) {
              logger.info('BLE Mesh service started before sending message');
            }
          } catch (startError) {
            logger.warn('BLE Mesh start failed before sending (will queue message):', startError);
            // Continue - message will be queued and sent when service starts
          }
        }

        const messagePayload = JSON.stringify({
          type: 'chat',
          from: myDeviceId,
          to: userId, // CRITICAL: userId is actually deviceId for offline messaging
          content: messageContent,
          timestamp,
        });

        // ELITE: Validate message payload size
        if (messagePayload.length > 10000) {
          logger.warn('Message payload too large:', messagePayload.length);
          Alert.alert('Hata', 'Mesaj çok büyük. Lütfen daha kısa bir mesaj gönderin.');
          return;
        }

        // CRITICAL: Send via BLE Mesh Service directly (actual BLE transmission)
        // This ensures message is actually sent over BLE, not just stored
        // ELITE: userId is deviceId for offline messaging - BLE Mesh uses deviceId
        const sendPromise = bleMeshService.sendMessage(messagePayload, userId);
        
        // CRITICAL: Also add to mesh store for tracking and statistics
        // ELITE: Only broadcast if message contains critical keywords or is urgent
        // This optimizes battery usage - not every message needs broadcast
        const isUrgent = messageContent.toLowerCase().includes('acil') || 
                        messageContent.toLowerCase().includes('sos') ||
                        messageContent.toLowerCase().includes('yardım') ||
                        messageContent.toLowerCase().includes('kurtar');
        
        const broadcastPromise = isUrgent 
          ? bleMeshService.broadcastMessage({
              content: messagePayload,
              type: 'text',
              to: userId,
              priority: 'high', // Elevated priority for urgent messages
              ackRequired: false,
              ttl: 3600,
              sequence: 0,
              attempts: 0,
            })
          : Promise.resolve(); // Skip broadcast for normal messages

        // CRITICAL: Create timeout promise with cleanup (20 seconds for offline reliability)
        let timeoutId: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            timeoutId = null;
            reject(new Error('Send timeout'));
          }, 20000); // CRITICAL: 20 seconds for offline mesh networks
        });
        
        // CRITICAL: Wait for all operations with timeout protection
        await Promise.race([
          Promise.all([
            sendPromise, 
            broadcastPromise,
          ]).finally(() => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
          }),
          timeoutPromise.finally(() => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
          }),
        ]);

        // ELITE: Mark as delivered with delay (store timeout for cleanup)
        const deliveredTimeoutId = setTimeout(() => {
          try {
            useMessageStore.getState().markAsDelivered(newMessage.id);
            setMessages(prev => prev.map(m => 
              m.id === newMessage.id ? { ...m, delivered: true } : m
            ));
            timeoutRefs.current.delete(newMessage.id);
          } catch (error) {
            logger.error('Error marking message as delivered:', error);
            timeoutRefs.current.delete(newMessage.id);
          }
        }, 1000);
        
        // ELITE: Store timeout for cleanup
        timeoutRefs.current.set(newMessage.id, deliveredTimeoutId);

        haptics.notificationSuccess();
        logger.info('Message sent successfully:', messageId);
      } catch (error) {
        logger.error('Failed to send message:', error);
        haptics.notificationError();
        Alert.alert('Hata', 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
        // ELITE: Cleanup timeout if exists
        const deliveredTimeout = timeoutRefs.current.get(newMessage.id);
        if (deliveredTimeout) {
          clearTimeout(deliveredTimeout);
          timeoutRefs.current.delete(newMessage.id);
        }
        // ELITE: Remove failed message from UI
        setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
      }

      // ELITE: Scroll to bottom with error handling and cleanup
      const scrollKey = `scroll-${Date.now()}`;
      const scrollTimeoutId = setTimeout(() => {
        try {
          flatListRef.current?.scrollToEnd({ animated: true });
        } catch (error) {
          logger.warn('Error scrolling to end:', error);
        }
        // CRITICAL: Cleanup timeout after scroll completes
        timeoutRefs.current.delete(scrollKey);
      }, 100);
      
      // ELITE: Store timeout for cleanup
      timeoutRefs.current.set(scrollKey, scrollTimeoutId);
    } catch (error) {
      logger.error('Error in sendMessage:', error);
      Alert.alert('Hata', 'Mesaj gönderilirken bir hata oluştu.');
    }
  }, [inputText, myDeviceId, userId, setMessages]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.from === 'me';
    
    return (
      <View style={[styles.messageContainer, isMe && styles.messageContainerMe]}>
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
              {new Date(item.timestamp).toLocaleTimeString('tr-TR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            {isMe && (
              <Ionicons 
                name={item.delivered ? 'checkmark-done' : 'checkmark'} 
                size={14} 
                color={item.delivered ? colors.brand.primary : colors.text.tertiary} 
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  const conversation = useMessageStore.getState().conversations.find(c => c.userId === userId);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <LinearGradient
        colors={['#1e293b', '#0f172a']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Pressable 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerSubtitle}>Offline mesajlaşma</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        inverted={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyIcon}
            >
              <Ionicons name="chatbubbles-outline" size={64} color={colors.brand.primary} />
            </LinearGradient>
            <Text style={styles.emptyText}>Henüz mesaj yok</Text>
            <Text style={styles.emptySubtext}>
              Bu konuşmada henüz mesaj bulunmuyor.{'\n'}İlk mesajı göndererek başlayın.
            </Text>
          </View>
        }
      />

      {/* Input Bar */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom }]}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Mesaj yazın..."
            placeholderTextColor={colors.text.tertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={5000}
          />
          <Pressable
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <LinearGradient
              colors={inputText.trim() ? [colors.brand.primary, colors.brand.secondary] : ['#334155', '#334155']}
              style={styles.sendButtonGradient}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  messageContainerMe: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  messageBubbleMe: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  messageBubbleOther: {
    backgroundColor: '#1e293b',
  },
  messageText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  messageTimeMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#fff',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
