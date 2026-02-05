/**
 * SOS CONVERSATION SCREEN
 * CRITICAL: Mesajlaşma ekranı for enkaz altındaki kişilerle
 * ELITE: Şebeke olmadan BLE Mesh ile mesajlaşma
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { bleMeshService } from '../../services/BLEMeshService';
import { useMeshStore, MeshMessage } from '../../stores/meshStore';
import { useMessageStore } from '../../stores/messageStore';
import { getDeviceId } from '../../utils/device';
import { createLogger } from '../../utils/logger';
import * as haptics from '../../utils/haptics';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';

const logger = createLogger('SOSConversationScreen');

// ELITE: Type-safe navigation prop
type SOSConversationNavigationProp = StackNavigationProp<ParamListBase>;

// ELITE: Message type for SOS conversation
interface SOSMessageType {
  id: string;
  from: string;
  content: string;
  timestamp: number;
  isFromMe: boolean;
}

// ELITE: Props made compatible with react-navigation type system
// ELITE: Parsed message data payload type
interface MessageDataPayload {
  from?: string;
  message?: string;
  text?: string;
  content?: string;
}

interface SOSConversationScreenProps {
  route?: {
    params: {
      sosUserId: string;
      sosLocation?: {
        latitude: number;
        longitude: number;
        accuracy?: number;
      };
      sosMessage?: string;
      sosBatteryLevel?: number;
      sosNetworkStatus?: string;
      sosTrapped?: boolean;
    };
  };
  navigation?: SOSConversationNavigationProp;
}

export default function SOSConversationScreen({ route, navigation }: SOSConversationScreenProps) {
  // ELITE: Safe param access with defaults
  const params = route?.params ?? { sosUserId: '' };
  const { sosUserId, sosLocation, sosMessage, sosBatteryLevel, sosNetworkStatus, sosTrapped } = params;
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<SOSMessageType[]>([]);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Load device ID
  useEffect(() => {
    (async () => {
      try {
        const deviceId = await getDeviceId();
        setMyDeviceId(deviceId);
      } catch (error) {
        logger.error('Failed to get device ID:', error);
      }
    })();
  }, []);

  // CRITICAL: Ensure BLE Mesh service is running
  useEffect(() => {
    (async () => {
      try {
        if (!bleMeshService.getIsRunning()) {
          await bleMeshService.start();
          logger.info('✅ BLE Mesh service started for SOS conversation');
        }
      } catch (error) {
        logger.error('Failed to start BLE Mesh service:', error);
      }
    })();
  }, []);

  // CRITICAL: Listen for messages from SOS user
  useEffect(() => {
    const unsubscribe = bleMeshService.onMessage(async (meshMessage: MeshMessage) => {
      try {
        // Parse message content
        let messageData: MessageDataPayload | null = null;
        try {
          if (typeof meshMessage.content === 'string') {
            messageData = JSON.parse(meshMessage.content);
          } else {
            messageData = meshMessage.content;
          }
        } catch (parseError) {
          // Check if it's a direct text message
          if (meshMessage.from === sosUserId && meshMessage.type === 'text') {
            const newMessage = {
              id: meshMessage.id,
              from: meshMessage.from,
              content: meshMessage.content,
              timestamp: meshMessage.timestamp,
              isFromMe: false,
            };
            setMessages((prev) => [...prev, newMessage]);
            haptics.notificationSuccess();
            return;
          }
          return;
        }

        // Check if message is from SOS user
        if (messageData?.from === sosUserId || meshMessage.from === sosUserId) {
          const newMessage = {
            id: meshMessage.id,
            from: sosUserId,
            content: typeof messageData === 'string' ? messageData : messageData?.message || messageData?.content || '',
            timestamp: meshMessage.timestamp || Date.now(),
            isFromMe: false,
          };
          setMessages((prev) => [...prev, newMessage]);
          haptics.notificationSuccess();
        }
      } catch (error) {
        logger.error('Error processing SOS message:', error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sosUserId]);

  // Load existing messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const conversationMessages = useMessageStore.getState().getConversationMessages(sosUserId);
        const meshMessages = useMeshStore.getState().messages.filter(
          (msg) => msg.from === sosUserId || msg.to === sosUserId,
        );

        const allMessages = [
          ...conversationMessages.map((msg) => ({
            id: msg.id,
            from: msg.from,
            content: msg.content,
            timestamp: msg.timestamp,
            isFromMe: msg.from === myDeviceId,
          })),
          ...meshMessages.map((msg) => ({
            id: msg.id,
            from: msg.from,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            timestamp: msg.timestamp,
            isFromMe: msg.from === myDeviceId,
          })),
        ];

        // Sort by timestamp
        allMessages.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(allMessages);
      } catch (error) {
        logger.error('Failed to load messages:', error);
      }
    };

    if (myDeviceId) {
      loadMessages();
    }
  }, [myDeviceId, sosUserId]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !myDeviceId || isSending) {
      return;
    }

    const messageContent = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Create message ID before try block for error handling
    const messageId = `msg_${Date.now()}_${myDeviceId}`;
    const messageTimestamp = Date.now();

    try {
      // CRITICAL: Ensure BLE Mesh service is running
      if (!bleMeshService.getIsRunning()) {
        await bleMeshService.start();
      }

      // Create message
      const message = {
        id: messageId,
        from: myDeviceId,
        to: sosUserId,
        content: messageContent,
        timestamp: messageTimestamp,
        isFromMe: true,
      };

      // Add to local state immediately
      setMessages((prev) => [...prev, message]);

      // CRITICAL: Send via BLE Mesh
      await bleMeshService.sendMessage(
        JSON.stringify({
          type: 'chat',
          from: myDeviceId,
          to: sosUserId,
          content: messageContent,
          timestamp: messageTimestamp,
        }),
        sosUserId,
      );

      // Also add to message store
      useMessageStore.getState().addMessage({
        id: messageId,
        from: myDeviceId,
        to: sosUserId,
        content: messageContent,
        timestamp: messageTimestamp,
        type: 'CHAT',
        delivered: false,
        read: false,
      });

      haptics.notificationSuccess();
    } catch (error) {
      logger.error('Failed to send message:', error);
      Alert.alert('Hata', 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
      // Remove message from local state on error
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } finally {
      setIsSending(false);
    }
  }, [inputText, myDeviceId, sosUserId, isSending]);

  // Share location
  const shareLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'Konum paylaşımı için izin gereklidir');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationMessage = `Konumum: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;
      setInputText(locationMessage);
    } catch (error) {
      logger.error('Failed to get location:', error);
      Alert.alert('Hata', 'Konum alınamadı');
    }
  }, []);

  // Open location in maps
  const openLocationInMaps = useCallback(() => {
    if (!sosLocation) {
      Alert.alert('Konum Bilgisi Yok', 'Bu kişinin konum bilgisi bulunmuyor');
      return;
    }

    const url = Platform.select({
      ios: `maps://maps.apple.com/?q=${sosLocation.latitude},${sosLocation.longitude}`,
      android: `geo:${sosLocation.latitude},${sosLocation.longitude}?q=${sosLocation.latitude},${sosLocation.longitude}`,
    });

    if (url) {
      Linking.openURL(url).catch((error) => {
        logger.error('Failed to open maps:', error);
        Alert.alert('Hata', 'Harita açılamadı');
      });
    }
  }, [sosLocation]);

  // Call emergency services
  const callEmergency = useCallback(() => {
    Alert.alert(
      'Acil Servisleri Ara',
      '112 acil servisleri aramak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ara',
          onPress: () => {
            Linking.openURL('tel:112').catch((error) => {
              logger.error('Failed to call 112:', error);
              Alert.alert('Hata', '112 aranamadı');
            });
          },
          style: 'destructive',
        },
      ],
    );
  }, []);

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
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <LinearGradient
          colors={['rgba(239, 68, 68, 0.85)', 'rgba(220, 38, 38, 0.95)']}
          style={styles.header}
        >
          <Pressable onPress={() => navigation?.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>
              {sosTrapped ? '🚨 ENKAZ ALTINDA' : '🆘 ACİL YARDIM'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {sosTrapped ? 'Enkaz Altında - Yardım Gerekiyor' : 'Acil Yardım Çağrısı'}
              {sosBatteryLevel !== undefined && ` • Pil: ${sosBatteryLevel}%`}
              {sosNetworkStatus === 'disconnected' && ' • Şebeke Yok'}
            </Text>
          </View>
          <Pressable onPress={callEmergency} style={styles.emergencyButton}>
            <Ionicons name="call" size={24} color="#fff" />
          </Pressable>
        </LinearGradient>

        {/* ELITE: Enhanced Info Cards */}
        <View style={styles.infoCardsContainer}>
          {/* Location Card */}
          {sosLocation && (
            <Pressable onPress={openLocationInMaps} style={styles.locationCard}>
              <Ionicons name="location" size={20} color={colors.status.danger} />
              <View style={styles.locationContent}>
                <Text style={styles.locationLabel}>Konum</Text>
                <Text style={styles.locationText}>
                  {sosLocation.latitude.toFixed(6)}, {sosLocation.longitude.toFixed(6)}
                </Text>
                {sosLocation.accuracy && (
                  <Text style={styles.locationAccuracy}>
                    Doğruluk: ±{Math.round(sosLocation.accuracy)}m
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </Pressable>
          )}

          {/* Battery & Network Status Card */}
          {(sosBatteryLevel !== undefined || sosNetworkStatus) && (
            <View style={styles.statusCard}>
              {sosBatteryLevel !== undefined && (
                <View style={styles.statusItem}>
                  <Ionicons
                    name={sosBatteryLevel <= 10 ? "battery-dead" : sosBatteryLevel <= 20 ? "battery-half" : "battery-full"}
                    size={18}
                    color={sosBatteryLevel <= 10 ? colors.status.danger : sosBatteryLevel <= 20 ? colors.status.warning : colors.status.success}
                  />
                  <Text style={styles.statusText}>Pil: {sosBatteryLevel}%</Text>
                </View>
              )}
              {sosNetworkStatus && (
                <View style={styles.statusItem}>
                  <Ionicons
                    name={sosNetworkStatus === 'disconnected' ? "cloud-offline" : "cloud"}
                    size={18}
                    color={sosNetworkStatus === 'disconnected' ? colors.status.danger : colors.status.success}
                  />
                  <Text style={styles.statusText}>
                    {sosNetworkStatus === 'disconnected' ? 'Şebeke Yok' : 'Şebeke Var'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Initial SOS Message */}
        {sosMessage && (
          <View style={styles.sosMessageCard}>
            <Text style={styles.sosMessageText}>{sosMessage}</Text>
          </View>
        )}

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[styles.messageBubble, message.isFromMe ? styles.myMessage : styles.theirMessage]}
            >
              <Text style={styles.messageText}>{message.content}</Text>
              <Text style={styles.messageTime}>
                {new Date(message.timestamp).toLocaleTimeString('tr-TR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Input Area */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputContainer}
        >
          <Pressable onPress={shareLocation} style={styles.locationButton}>
            <Ionicons name="location" size={20} color={colors.text.secondary} />
          </Pressable>
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
            onPress={sendMessage}
            style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 20,
    marginTop: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    fontWeight: '500',
  },
  emergencyButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  infoCardsContainer: {
    marginTop: 12,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    gap: 16,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  locationContent: {
    flex: 1,
    marginLeft: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '600',
  },
  locationText: {
    fontSize: 14,
    color: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  locationAccuracy: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  sosMessageCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  sosMessageText: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 22,
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#dbeafe', // Soft Blue
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#334155',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 10,
    color: '#94a3b8',
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
  },
  locationButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#334155',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
  },
});

