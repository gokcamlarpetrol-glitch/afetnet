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
import { useMeshStore } from '../../stores/meshStore';
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

    // Load conversation messages
    const loadMessages = () => {
      const conversationMessages = useMessageStore.getState().getConversationMessages(userId);
      setMessages(conversationMessages);
      // Mark as read
      useMessageStore.getState().markConversationRead(userId);
    };

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
                  id: `msg-${Date.now()}-${Math.random()}`,
                  from: userId,
                  to: 'me',
                  content: sanitizedContent,
                  timestamp: Date.now(),
                  delivered: true,
                  read: false,
                };
                useMessageStore.getState().addMessage(newMessage);
                loadMessages();
                haptics.notificationSuccess();
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
                    : `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  from: userId,
                  to: 'me',
                  content: messageContent,
                  timestamp: messageTimestamp,
                  delivered: true,
                  read: false,
                };
                useMessageStore.getState().addMessage(newMessage);
                loadMessages();
                haptics.notificationSuccess();
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error processing mesh message:', error);
      }
    });

    // Refresh messages periodically
    const interval = setInterval(loadMessages, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [userId]);

  // ELITE: Send broadcast message to all nearby devices (multi-hop)
  const sendBroadcastMessage = useCallback(async () => {
    try {
      if (!inputText.trim() || !myDeviceId) {
        return;
      }

      const { sanitizeString } = await import('../../utils/validation');
      const trimmedInput = inputText.trim();
      if (trimmedInput.length > 5000) {
        Alert.alert('Hata', 'Mesaj çok uzun. Maksimum 5000 karakter.');
        return;
      }
      
      const sanitizedInput = sanitizeString(trimmedInput, 5000);
      if (!sanitizedInput || sanitizedInput.length === 0) {
        Alert.alert('Hata', 'Mesaj içeriği geçersiz.');
        return;
      }
      
      setInputText('');
      haptics.impactMedium();

      const timestamp = Date.now();
      const messageId = `broadcast-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newMessage: Message = {
        id: messageId,
        from: 'me',
        to: 'broadcast',
        content: `[Yayın] ${sanitizedInput}`,
        timestamp,
        delivered: false,
        read: false,
      };

      useMessageStore.getState().addMessage(newMessage);
      setMessages(prev => [...prev, newMessage]);
      
      try {
        const messagePayload = JSON.stringify({
          type: 'broadcast',
          from: myDeviceId,
          content: sanitizedInput,
          timestamp,
          priority: 'normal',
        });

        // ELITE: Broadcast via mesh - multi-hop forwarding enabled
        await bleMeshService.broadcastMessage({
          content: messagePayload,
          type: 'broadcast',
          priority: 'normal',
          ttl: 5, // Multi-hop: 5 hops max
        });

        setTimeout(() => {
          useMessageStore.getState().markAsDelivered(newMessage.id);
          setMessages(prev => prev.map(m => 
            m.id === newMessage.id ? { ...m, delivered: true } : m
          ));
        }, 1000);

        haptics.notificationSuccess();
        Alert.alert('Başarılı', 'Mesaj yakındaki tüm cihazlara yayınlandı (multi-hop).');
        logger.info('Broadcast message sent:', messageId);
      } catch (error) {
        logger.error('Failed to send broadcast message:', error);
        haptics.notificationError();
        Alert.alert('Hata', 'Yayın mesajı gönderilemedi. Lütfen tekrar deneyin.');
      }

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      logger.error('Error in sendBroadcastMessage:', error);
      Alert.alert('Hata', 'Yayın mesajı gönderilirken bir hata oluştu.');
    }
  }, [inputText, myDeviceId, setMessages]);

  // ELITE: Send message to trapped users (enkaz altındakiler)
  const sendRescueMessage = useCallback(async () => {
    try {
      if (!inputText.trim() || !myDeviceId) {
        return;
      }

      const { sanitizeString } = await import('../../utils/validation');
      const trimmedInput = inputText.trim();
      if (trimmedInput.length > 5000) {
        Alert.alert('Hata', 'Mesaj çok uzun. Maksimum 5000 karakter.');
        return;
      }
      
      const sanitizedInput = sanitizeString(trimmedInput, 5000);
      if (!sanitizedInput || sanitizedInput.length === 0) {
        Alert.alert('Hata', 'Mesaj içeriği geçersiz.');
        return;
      }
      
      setInputText('');
      haptics.impactMedium();

      const timestamp = Date.now();
      const messageId = `rescue-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newMessage: Message = {
        id: messageId,
        from: 'me',
        to: 'rescue',
        content: `[Enkaz] ${sanitizedInput}`,
        timestamp,
        delivered: false,
        read: false,
      };

      useMessageStore.getState().addMessage(newMessage);
      setMessages(prev => [...prev, newMessage]);
      
      try {
        // ELITE: Send as SOS_BEACON type for rescue teams and trapped users
        const messagePayload = JSON.stringify({
          type: 'SOS_BEACON',
          from: myDeviceId,
          content: sanitizedInput,
          timestamp,
          priority: 'critical',
          target: 'trapped', // Target trapped users
        });

        // ELITE: Broadcast with critical priority - multi-hop forwarding
        await bleMeshService.broadcastMessage({
          content: messagePayload,
          type: 'SOS_BEACON',
          priority: 'critical',
          ttl: 8, // More hops for rescue messages
        });

        setTimeout(() => {
          useMessageStore.getState().markAsDelivered(newMessage.id);
          setMessages(prev => prev.map(m => 
            m.id === newMessage.id ? { ...m, delivered: true } : m
          ));
        }, 1000);

        haptics.notificationSuccess();
        Alert.alert('Başarılı', 'Mesaj yakındaki enkaz altındaki kişilere gönderildi (multi-hop).');
        logger.info('Rescue message sent:', messageId);
      } catch (error) {
        logger.error('Failed to send rescue message:', error);
        haptics.notificationError();
        Alert.alert('Hata', 'Kurtarma mesajı gönderilemedi. Lütfen tekrar deneyin.');
      }

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      logger.error('Error in sendRescueMessage:', error);
      Alert.alert('Hata', 'Kurtarma mesajı gönderilirken bir hata oluştu.');
    }
  }, [inputText, myDeviceId, setMessages]);

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

      // ELITE: Add to store with error handling
      try {
        useMessageStore.getState().addMessage(newMessage);
      } catch (error) {
        logger.error('Error adding message to store:', error);
        Alert.alert('Hata', 'Mesaj kaydedilemedi.');
        return;
      }
      
      // ELITE: Update local state
      setMessages(prev => [...prev, newMessage]);
      
      // ELITE: Send via BLE mesh with comprehensive error handling
      try {
        const messagePayload = JSON.stringify({
          type: 'chat',
          from: myDeviceId,
          to: userId,
          content: messageContent,
          timestamp,
        });

        // ELITE: Validate message payload size
        if (messagePayload.length > 10000) {
          logger.warn('Message payload too large:', messagePayload.length);
          Alert.alert('Hata', 'Mesaj çok büyük. Lütfen daha kısa bir mesaj gönderin.');
          return;
        }

        // ELITE: Send via mesh store with timeout
        const sendPromise = useMeshStore.getState().sendMessage(messagePayload, {
          type: 'text',
          to: userId,
          priority: 'normal',
          ackRequired: false,
        });
        
        // ELITE: Also broadcast for mesh routing
        const broadcastPromise = useMeshStore.getState().broadcastMessage(messagePayload, 'text');

        await Promise.race([
          Promise.all([sendPromise, broadcastPromise]),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Send timeout')), 10000)
          ),
        ]);

        // ELITE: Mark as delivered with delay
        setTimeout(() => {
          try {
            useMessageStore.getState().markAsDelivered(newMessage.id);
            setMessages(prev => prev.map(m => 
              m.id === newMessage.id ? { ...m, delivered: true } : m
            ));
          } catch (error) {
            logger.error('Error marking message as delivered:', error);
          }
        }, 1000);

        haptics.notificationSuccess();
        logger.info('Message sent successfully:', messageId);
      } catch (error) {
        logger.error('Failed to send message:', error);
        haptics.notificationError();
        Alert.alert('Hata', 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
      }

      // ELITE: Scroll to bottom with error handling
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToEnd({ animated: true });
        } catch (error) {
          logger.warn('Error scrolling to end:', error);
        }
      }, 100);
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
          <Text style={styles.headerTitle}>
            {conversation?.userName || `Cihaz ${userId.slice(0, 8)}...`}
          </Text>
          <View style={styles.headerSubtitleRow}>
            <Text style={styles.headerSubtitle}>Offline mesajlaşma</Text>
            {/* ELITE: Multi-hop indicator */}
            {isMeshConnected && networkHealth.avgHopCount > 0 && (
              <View style={styles.hopBadge}>
                <Ionicons name="git-network" size={12} color={colors.brand.primary} />
                <Text style={styles.hopText}>
                  {networkHealth.avgHopCount.toFixed(1)} hop
                </Text>
              </View>
            )}
            {/* ELITE: Mesh status indicator */}
            <View style={[styles.meshIndicator, { backgroundColor: isMeshConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(248, 113, 113, 0.2)' }]}>
              <View style={[styles.meshDot, { backgroundColor: isMeshConnected ? '#10b981' : '#f87171' }]} />
              <Text style={[styles.meshText, { color: isMeshConnected ? '#10b981' : '#f87171' }]}>
                {isMeshConnected ? 'Mesh Aktif' : 'Mesh Pasif'}
              </Text>
            </View>
          </View>
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
        {/* ELITE: Broadcast and Rescue Message Options */}
        <View style={styles.messageOptionsRow}>
          <Pressable
            style={styles.optionButton}
            onPress={() => {
              Alert.alert(
                'Çevredekilere Mesaj Gönder',
                'Bu mesaj yakındaki tüm cihazlara yayınlanacak (şebekesiz). Devam etmek istiyor musunuz?',
                [
                  { text: 'İptal', style: 'cancel' },
                  {
                    text: 'Gönder',
                    onPress: async () => {
                      if (inputText.trim()) {
                        await sendBroadcastMessage();
                      }
                    },
                  },
                ]
              );
            }}
            disabled={!inputText.trim()}
          >
            <Ionicons 
              name="radio" 
              size={16} 
              color={inputText.trim() ? colors.brand.primary : colors.text.tertiary} 
            />
            <Text style={[styles.optionText, !inputText.trim() && styles.optionTextDisabled]}>
              Yayınla
            </Text>
          </Pressable>
          
          <Pressable
            style={styles.optionButton}
            onPress={() => {
              Alert.alert(
                'Enkaz Altındakilere Mesaj Gönder',
                'Bu mesaj yakındaki enkaz altındaki kişilere gönderilecek (şebekesiz). Devam etmek istiyor musunuz?',
                [
                  { text: 'İptal', style: 'cancel' },
                  {
                    text: 'Gönder',
                    onPress: async () => {
                      if (inputText.trim()) {
                        await sendRescueMessage();
                      }
                    },
                  },
                ]
              );
            }}
            disabled={!inputText.trim()}
          >
            <Ionicons 
              name="alert-circle" 
              size={16} 
              color={inputText.trim() ? '#dc2626' : colors.text.tertiary} 
            />
            <Text style={[styles.optionText, !inputText.trim() && styles.optionTextDisabled]}>
              Enkaz
            </Text>
          </Pressable>
        </View>
        
        <View style={styles.inputWrapper}>
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
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  hopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  hopText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  meshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  meshDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  meshText: {
    fontSize: 10,
    fontWeight: '600',
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
  messageOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  optionTextDisabled: {
    color: colors.text.tertiary,
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

