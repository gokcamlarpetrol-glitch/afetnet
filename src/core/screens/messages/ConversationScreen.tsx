/**
 * CONVERSATION SCREEN - Chat interface with offline messaging
 * BLE mesh messaging with real-time updates
 */

import React, { useState, useEffect, useRef } from 'react';
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

const logger = createLogger('ConversationScreen');

export default function ConversationScreen({ navigation, route }: any) {
  const { userId } = route.params;
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
    const unsubscribe = bleMeshService.onMessage((meshMessage) => {
      try {
        const content = meshMessage.content;
        if (typeof content !== 'string') return;

        let messageData;
        try {
          messageData = JSON.parse(content);
        } catch {
          // Not JSON, might be plain text - check if mesh message is text type
          if (meshMessage.type === 'text') {
            const senderId = meshMessage.from;
            if (senderId === userId) {
              const newMessage: Message = {
                id: `msg-${Date.now()}-${Math.random()}`,
                from: userId,
                to: 'me',
                content: content,
                timestamp: Date.now(),
                delivered: true,
                read: false,
              };
              useMessageStore.getState().addMessage(newMessage);
              loadMessages();
              haptics.notificationSuccess();
            }
          }
          return;
        }

        // Check if this is a chat message (parse from content)
        // messageData.type can be 'chat', 'message', or 'text' from the parsed JSON
        if (messageData && (messageData.type === 'chat' || messageData.type === 'message' || messageData.type === 'text' || meshMessage.type === 'text')) {
          const senderId = messageData.from || messageData.senderId || messageData.deviceId;
          if (senderId === userId) {
            const newMessage: Message = {
              id: messageData.id || `msg-${Date.now()}-${Math.random()}`,
              from: userId,
              to: 'me',
              content: messageData.content || messageData.message || content,
              timestamp: messageData.timestamp || Date.now(),
              delivered: true,
              read: false,
            };
            useMessageStore.getState().addMessage(newMessage);
            loadMessages();
            haptics.notificationSuccess();
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

  const sendMessage = async () => {
    if (!inputText.trim() || !myDeviceId) return;

    const messageContent = inputText.trim();
    setInputText('');
    haptics.impactMedium();

    // Create message object
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      from: 'me',
      to: userId,
      content: messageContent,
      timestamp: Date.now(),
      delivered: false,
      read: false,
    };

    // Add to store
    useMessageStore.getState().addMessage(newMessage);
    
    // Update local state
    setMessages(prev => [...prev, newMessage]);
    
    // Send via BLE mesh
    try {
      const messagePayload = JSON.stringify({
        type: 'chat',
        from: myDeviceId,
        to: userId,
        content: messageContent,
        timestamp: Date.now(),
      });

      // Send via mesh store
      await useMeshStore.getState().sendMessage(messagePayload, 'text', userId);
      
      // Also broadcast for mesh routing
      await useMeshStore.getState().broadcastMessage(messagePayload, 'text');

      // Mark as delivered
      setTimeout(() => {
        useMessageStore.getState().markAsDelivered(newMessage.id);
        setMessages(prev => prev.map(m => 
          m.id === newMessage.id ? { ...m, delivered: true } : m
        ));
      }, 1000);

      haptics.notificationSuccess();
    } catch (error) {
      logger.error('Failed to send message:', error);
      haptics.notificationError();
    }

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

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
});

