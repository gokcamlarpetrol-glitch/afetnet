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

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, FlatList,
  KeyboardAvoidingView, Platform, StatusBar, ImageBackground, Alert,
  Image, Linking, Keyboard, Modal, ActivityIndicator, AppState,
} from 'react-native';
import { styles } from './ConversationScreen.styles';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '../../components/SafeLinearGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeshStore, MeshMessage, MessageReaction } from '../../services/mesh/MeshStore';
import { hybridMessageService } from '../../services/HybridMessageService';
import { BlurView } from '../../components/SafeBlurView';
import Animated, {
  FadeInUp, Layout, FadeIn, FadeOut,
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import * as haptics from '../../utils/haptics';
import { useSettingsStore } from '../../stores/settingsStore';
import { Message, useMessageStore } from '../../stores/messageStore';
import { useFamilyStore } from '../../stores/familyStore';
import { validateMessage, sanitizeForDisplay } from '../../utils/messageSanitizer';
import MessageOptionsModal from '../../components/messages/MessageOptionsModal';
import { AttachmentsModal } from '../../components/messages/AttachmentsModal';
import { VoiceRecorderUI } from '../../components/messages/VoiceRecorderUI';
import { voiceMessageService } from '../../services/VoiceMessageService';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { getDeviceId as getDeviceIdFromLib } from '../../../lib/device';
import { identityService } from '../../services/IdentityService';
import { contactService } from '../../services/ContactService';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { createLogger } from '../../utils/logger';
import type { MainStackParamList } from '../../types/navigation';

const logger = createLogger('ConversationScreen');
const UID_REGEX = /^[A-Za-z0-9]{20,40}$/;
const MAX_VOICE_DURATION = 60; // seconds — auto-stop voice recording at this limit
const CHAT_RENDERABLE_TYPES = new Set<MeshMessage['type']>(['CHAT', 'SOS', 'IMAGE', 'VOICE', 'LOCATION']);
const NON_CHAT_SYSTEM_TYPES = new Set([
  'family_status_update',
  'family_location_update',
  'family_location',
  'status_update',
  'device_status',
  'presence_update',
  'location',
  'typing',
  'ack',
  'reaction',
]);

const normalizeIdentityValue = (value?: string | null): string => {
  if (!value || typeof value !== 'string') return '';
  return value.trim();
};

const getEnvelopeTypeFromContent = (content: string): string => {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return '';
  try {
    const parsed = JSON.parse(trimmed) as { type?: unknown };
    if (typeof parsed?.type !== 'string') return '';
    return parsed.type.trim().toLowerCase();
  } catch {
    return '';
  }
};

const isSystemPayloadMessage = (message: Pick<MeshMessage, 'type' | 'content'>): boolean => {
  if (!CHAT_RENDERABLE_TYPES.has(message.type)) {
    return true;
  }
  const envelopeType = getEnvelopeTypeFromContent(message.content);
  if (!envelopeType) return false;
  return NON_CHAT_SYSTEM_TYPES.has(envelopeType);
};

// ELITE: Type-safe navigation and route props
type ConversationNavigationProp = StackNavigationProp<MainStackParamList, 'Conversation'>;
type ConversationRouteProp = RouteProp<MainStackParamList, 'Conversation'>;

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
  replyToContent?: string;
}

// List item type — either a message or a date separator
type ListItem =
  | { kind: 'message'; data: MeshMessage }
  | { kind: 'separator'; date: string; id: string };

/** Format a timestamp into a Turkish date label */
const formatDateSeparator = (timestamp: number): string => {
  const msgDate = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(msgDate, today)) return 'Bugün';
  if (isSameDay(msgDate, yesterday)) return 'Dün';
  return msgDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
};

// ELITE: Typing Indicator Component — animated cascade dots
const TypingDot = ({ delay }: { delay: number }) => {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(0, { duration: delay }),
        withTiming(-6, { duration: 300 }),
        withTiming(0, { duration: 300 }),
        withTiming(0, { duration: 600 - delay }),
      ),
      -1,
      false,
    );
  }, [delay, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.dot, animStyle]} />;
};

const TypingIndicatorDots = () => {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={styles.typingContainer}
    >
      <View style={styles.typingBubble}>
        <View style={styles.dotContainer}>
          <TypingDot delay={0} />
          <TypingDot delay={150} />
          <TypingDot delay={300} />
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

/** Generate stable waveform heights from message ID hash — 12 bars, values 0.2–1.0 */
const getWaveformHeights = (id: string): number[] => {
  const bars: number[] = [];
  for (let i = 0; i < 12; i++) {
    let hash = 0;
    for (let j = 0; j < id.length; j++) {
      hash = ((hash << 5) - hash + id.charCodeAt(j) * (i + 1)) | 0;
    }
    bars.push(0.2 + (Math.abs(hash) % 100) / 125); // range 0.2–1.0
  }
  return bars;
};

const formatSeconds = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// ELITE: Inline Voice Player for voice messages
const VoicePlayerInline = ({ message, isMe }: { message: MeshMessage; isMe: boolean }) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const elapsedRef = React.useRef<NodeJS.Timeout | null>(null);
  const durationSec = message.mediaDuration || 0;
  const waveHeights = React.useMemo(() => getWaveformHeights(message.id), [message.id]);

  const stopElapsed = () => {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  };

  const handlePlay = async () => {
    try {
      if (isPlaying) {
        await voiceMessageService.stop();
        setIsPlaying(false);
        stopElapsed();
        setElapsed(0);
      } else {
        const voiceMsg = {
          id: message.id,
          uri: message.mediaUrl || '',
          durationMs: durationSec * 1000,
          timestamp: message.timestamp,
          from: message.senderId,
          to: message.to,
          delivered: true,
          played: false,
        };
        setIsPlaying(true);
        setElapsed(0);
        elapsedRef.current = setInterval(() => {
          setElapsed(prev => {
            const next = prev + 1;
            if (durationSec > 0 && next >= durationSec) {
              stopElapsed();
              setIsPlaying(false);
              return 0;
            }
            return next;
          });
        }, 1000);
        await voiceMessageService.play(voiceMsg);
        setIsPlaying(false);
        stopElapsed();
        setElapsed(0);
      }
    } catch {
      setIsPlaying(false);
      stopElapsed();
      setElapsed(0);
    }
  };

  React.useEffect(() => () => stopElapsed(), []);

  const displayTime = isPlaying && elapsed > 0
    ? formatSeconds(elapsed)
    : (durationSec > 0 ? formatSeconds(durationSec) : '0:00');

  return (
    <Pressable onPress={handlePlay} style={styles.voicePlayer}>
      <Ionicons
        name={isPlaying ? 'pause-circle' : 'play-circle'}
        size={36}
        color={isMe ? '#1e3a8a' : '#3b82f6'}
      />
      <View style={styles.voiceWaveform}>
        {waveHeights.map((h, i) => {
          const playedFraction = durationSec > 0 ? elapsed / durationSec : 0;
          const barFraction = i / waveHeights.length;
          const isPlayed = isPlaying && barFraction < playedFraction;
          return (
            <View
              key={i}
              style={[
                styles.voiceBar,
                {
                  height: h * 20,
                  backgroundColor: isPlayed
                    ? (isMe ? '#1e3a8a' : '#3b82f6')
                    : (isMe ? '#1e3a8a50' : '#3b82f650'),
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.voiceDuration, { color: isMe ? '#1e3a8a' : '#64748b' }]}>
        {displayTime}
      </Text>
    </Pressable>
  );
};

// ELITE: Location Card for location messages
const LocationCard = ({ location, isMe }: { location: { lat: number; lng: number; address?: string }; isMe: boolean }) => {
  // Guard: skip interactive render if location coordinates are invalid
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return (
      <View style={styles.locationCard}>
        <View style={styles.locationIconCircle}>
          <Ionicons name="location-outline" size={20} color="#94a3b8" />
        </View>
        <View style={styles.locationInfo}>
          <Text style={[styles.locationTitle, { color: '#94a3b8' }]}>📍 Konum verisi geçersiz</Text>
        </View>
      </View>
    );
  }

  const handleOpen = () => {
    const url = Platform.select({
      ios: `maps:0,0?q=${location.lat},${location.lng}`,
      android: `geo:${location.lat},${location.lng}?q=${location.lat},${location.lng}`,
      default: `https://maps.google.com/?q=${location.lat},${location.lng}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${location.lat},${location.lng}`).catch((error) => {
        logger.warn('Failed to open location URL in ConversationScreen:', error);
      });
    });
  };

  return (
    <Pressable onPress={handleOpen} style={styles.locationCard}>
      <View style={styles.locationIconCircle}>
        <Ionicons name="location" size={20} color="#ef4444" />
      </View>
      <View style={styles.locationInfo}>
        <Text style={[styles.locationTitle, { color: isMe ? '#1e3a8a' : '#334155' }]}>
          📍 Paylaşılan Konum
        </Text>
        {location.address ? (
          <Text style={[styles.locationAddress, { color: isMe ? '#3b82f6' : '#64748b' }]} numberOfLines={2}>
            {location.address}
          </Text>
        ) : (
          <Text style={[styles.locationAddress, { color: isMe ? '#3b82f6' : '#64748b' }]}>
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </Text>
        )}
        <Text style={styles.locationLink}>Haritada Aç →</Text>
      </View>
    </Pressable>
  );
};

// Bubble Component
const MessageBubble = React.memo(({ message, isMe, showTail, replyToContent }: MessageBubbleProps) => {
  const isDeleted = !!(message as MeshMessage & { isDeleted?: boolean }).isDeleted || message.content === 'Bu mesaj silindi';
  const isEdited = !!(message as MeshMessage & { isEdited?: boolean }).isEdited;
  const [lightboxVisible, setLightboxVisible] = React.useState(false);

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
    if (message.status === 'read') return '#53bdeb'; // WhatsApp blue for read ticks
    return '#64748b';
  };

  // ELITE: Render media content based on message type
  const renderContent = () => {
    // Deleted ghost — no interactions, italic grey
    if (isDeleted) {
      return <Text style={{ fontSize: 14, fontStyle: 'italic', color: '#94a3b8' }}>Bu mesaj silindi</Text>;
    }

    // Image message
    if (message.mediaType === 'image') {
      if (message.mediaUrl) {
        return (
          <View>
            <Pressable onPress={() => setLightboxVisible(true)}>
              <View>
                <Image
                  source={{ uri: message.mediaUrl }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                />
                {/* Upload progress overlay when sending */}
                {message.status === 'sending' && (
                  <View style={styles.mediaUploadOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}
              </View>
            </Pressable>
            {displayContent && displayContent !== '📷 Fotoğraf' && (
              <Text style={[styles.msgText, isMe ? styles.textMe : styles.textOther, { marginTop: 6 }]}>
                {displayContent}
              </Text>
            )}
            {/* Lightbox modal */}
            <Modal
              visible={lightboxVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setLightboxVisible(false)}
            >
              <View style={styles.lightboxContainer}>
                <Pressable style={styles.lightboxClose} onPress={() => setLightboxVisible(false)}>
                  <Ionicons name="close" size={30} color="#fff" />
                </Pressable>
                <Image
                  source={{ uri: message.mediaUrl }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                />
              </View>
            </Modal>
          </View>
        );
      }
      // Fallback: no URL yet (upload in progress or mesh-only)
      return (
        <View style={styles.mediaPlaceholder}>
          {message.status === 'sending' ? (
            <ActivityIndicator size="small" color={isMe ? '#1e3a8a' : '#64748b'} />
          ) : (
            <Ionicons name="image-outline" size={32} color={isMe ? '#1e3a8a' : '#64748b'} />
          )}
          <Text style={[styles.msgText, isMe ? styles.textMe : styles.textOther]}>📷 Fotoğraf</Text>
        </View>
      );
    }

    // Voice message
    if (message.mediaType === 'voice') {
      if (message.mediaUrl) {
        return <VoicePlayerInline message={message} isMe={isMe} />;
      }
      // Fallback: no URL
      return (
        <View style={styles.mediaPlaceholder}>
          <Ionicons name="mic-outline" size={24} color={isMe ? '#1e3a8a' : '#64748b'} />
          <Text style={[styles.msgText, isMe ? styles.textMe : styles.textOther]}>🎤 Sesli Mesaj</Text>
        </View>
      );
    }

    // Location message
    if (message.mediaType === 'location' && message.location) {
      return <LocationCard location={message.location} isMe={isMe} />;
    }

    // Default: text message
    return (
      <Text style={[styles.msgText, isMe ? styles.textMe : styles.textOther]}>
        {displayContent}
      </Text>
    );
  };

  const senderName = message.senderName || '';

  // Group reactions by emoji for chip display
  const reactionGroups = useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];
    const map = new Map<string, number>();
    for (const r of message.reactions) {
      map.set(r.emoji, (map.get(r.emoji) || 0) + 1);
    }
    return Array.from(map.entries()).map(([emoji, count]) => ({ emoji, count }));
  }, [message.reactions]);

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
      <View style={{ flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
        {/* Sender name above incoming bubbles */}
        {!isMe && senderName ? (
          <Text style={styles.senderNameLabel}>{senderName}</Text>
        ) : null}
        <View style={[
          styles.bubble,
          isMe ? styles.bubbleMe : styles.bubbleOther,
          !showTail && (isMe ? styles.noTailMe : styles.noTailOther),
          message.status === 'failed' && styles.bubbleFailed,
          message.mediaType === 'image' && message.mediaUrl && styles.bubbleImage,
          isDeleted && bubbleStyles.bubbleDeleted,
        ]}>
          {/* Reply quote block */}
          {!isDeleted && replyToContent ? (
            <View style={[bubbleStyles.replyQuote, isMe ? bubbleStyles.replyQuoteMe : bubbleStyles.replyQuoteOther]}>
              <Text style={bubbleStyles.replyQuoteText} numberOfLines={2}>{replyToContent}</Text>
            </View>
          ) : null}

          {renderContent()}

          <View style={styles.metaRow}>
            <Text style={[styles.timeText, isMe ? styles.timeMe : styles.timeOther]}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isEdited && !isDeleted ? (
              <Text style={bubbleStyles.editedLabel}>(düzenlendi)</Text>
            ) : null}
            {isMe && (
              <Ionicons
                name={getStatusIcon()}
                size={12}
                color={getStatusColor()}
              />
            )}
          </View>
        </View>

        {/* Reaction chips below bubble */}
        {reactionGroups.length > 0 ? (
          <View style={[bubbleStyles.reactionsRow, isMe ? bubbleStyles.reactionsRowMe : bubbleStyles.reactionsRowOther]}>
            {reactionGroups.map(({ emoji, count }) => (
              <View key={emoji} style={bubbleStyles.reactionChip}>
                <Text style={bubbleStyles.reactionChipText}>{emoji} {count}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}, (prev, next) =>
  prev.message.id === next.message.id &&
  prev.message.status === next.message.status &&
  prev.message.content === next.message.content &&
  prev.message.reactions === next.message.reactions &&
  prev.isMe === next.isMe &&
  prev.showTail === next.showTail &&
  prev.replyToContent === next.replyToContent
);

/** Inline styles for bubble sub-components */
const bubbleStyles = StyleSheet.create({
  deletedText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#94a3b8',
  },
  bubbleDeleted: {
    opacity: 0.7,
  },
  replyQuote: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 4,
  },
  replyQuoteMe: {
    borderLeftColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  replyQuoteOther: {
    borderLeftColor: '#64748b',
    backgroundColor: 'rgba(100, 116, 139, 0.08)',
  },
  replyQuoteText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  editedLabel: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#94a3b8',
    marginRight: 2,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  reactionsRowMe: {
    justifyContent: 'flex-end',
  },
  reactionsRowOther: {
    justifyContent: 'flex-start',
  },
  reactionChip: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reactionChipText: {
    fontSize: 12,
  },
});

export default function ConversationScreen({ navigation, route }: ConversationScreenProps) {
  const { userId, userName, conversationId: paramConversationId } = route.params || {};

  // CRITICAL FIX: ALL hooks MUST be declared BEFORE any early return
  // to comply with React Rules of Hooks (same hook count on every render)
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState<number | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'online' | 'mesh' | 'offline'>('offline');
  const [, setPhysicalDeviceId] = useState<string | null>(null);
  // ELITE FIX: Track identity ID in state so selfIds recalculates when identity loads
  const [identityId, setIdentityId] = useState<string | null>(identityService.getIdentity()?.uid || null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingBroadcastRef = useRef<number>(0);

  // ELITE: Message options modal state
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MeshMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<MeshMessage | null>(null);

  // ELITE: Media messaging state
  const [attachmentsModalVisible, setAttachmentsModalVisible] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const voiceRecordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll-to-bottom FAB state
  const [showScrollFab, setShowScrollFab] = useState(false);

  // ELITE: InViewPort auto-read receipts — marks messages as read when scrolled into view
  const selfIdsRef = useRef<Set<string>>(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50, minimumViewTime: 1000 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: ListItem; isViewable: boolean }> }) => {
    const myUid = identityService.getUid();
    if (!myUid) return;
    const currentSelfIds = selfIdsRef.current;
    for (const { item, isViewable } of viewableItems) {
      if (!isViewable) continue;
      // Skip date separator items — they have no message data
      if (item.kind !== 'message') continue;
      const msg = item.data;
      if (currentSelfIds.has(msg.senderId)) continue;
      if (msg.status === 'read') continue;
      useMessageStore.getState().syncReadReceipt(msg.id, msg.senderId);
      useMeshStore.getState().updateMessage(msg.id, { status: 'read' });
    }
  }).current;

  // ELITE: Use mesh store state for in-screen mutations
  const updateMeshMessage = useMeshStore(state => state.updateMessage);
  const addMeshReaction = useMeshStore(state => state.addReaction);

  // ELITE V2: DUAL-SOURCE READ — merge MeshStore (rich media) + messageStore (Firebase inbox)
  // This ensures both BLE mesh messages AND Firebase cloud messages are displayed
  const meshMessages = useMeshStore(state => state.messages);
  // myDeviceId available via useMeshStore if needed for mesh routing
  const familyMembers = useFamilyStore((state) => state.members);
  const blockedUsers = useSettingsStore((state) => state.blockedUsers);
  const validUserId = (userId && typeof userId === 'string') ? userId : '';
  const allStoreMessages = useMessageStore(state => state.messages);

  // ELITE FIX: Ensure identity is captured after async load
  useEffect(() => {
    const identity = identityService.getIdentity();
    if (identity?.uid && identity.uid !== identityId) {
      setIdentityId(identity.uid);
    }
    const timer = setTimeout(() => {
      const id = identityService.getIdentity();
      if (id?.uid && id.uid !== identityId) {
        setIdentityId(id.uid);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selfIds = useMemo(() => {
    const ids = new Set<string>(['ME', 'me']);
    const uid = identityService.getUid();
    if (uid) ids.add(uid);
    selfIdsRef.current = ids;
    return ids;
  }, [identityId]);

  const [asyncResolvedUid, setAsyncResolvedUid] = useState('');
  const resolvedRecipientId = useMemo(() => {
    const normalizedUserId = validUserId.trim();
    if (!normalizedUserId) return '';
    if (UID_REGEX.test(normalizedUserId)) return normalizedUserId;

    const familyMember = familyMembers.find((m) => m.uid === normalizedUserId || m.deviceId === normalizedUserId);
    if (familyMember?.uid && UID_REGEX.test(familyMember.uid)) return familyMember.uid;

    // Use async-resolved UID if available
    if (asyncResolvedUid && UID_REGEX.test(asyncResolvedUid)) return asyncResolvedUid;

    return '';
  }, [familyMembers, validUserId, asyncResolvedUid]);

  // Async UID resolution for non-UID identifiers (AFN codes, device IDs)
  useEffect(() => {
    const normalizedUserId = validUserId.trim();
    if (!normalizedUserId || UID_REGEX.test(normalizedUserId)) return;
    let cancelled = false;
    (async () => {
      try {
        const { firebaseDataService } = await import('../../services/FirebaseDataService');
        await firebaseDataService.initialize();
        const uid = await firebaseDataService.resolveRecipientUid(normalizedUserId);
        if (!cancelled && uid && UID_REGEX.test(uid)) {
          setAsyncResolvedUid(uid);
        }
      } catch { /* best effort */ }
    })();
    return () => { cancelled = true; };
  }, [validUserId]);

  const peerIdCandidates = useMemo(() => {
    const ids = new Set<string>();
    if (validUserId && UID_REGEX.test(validUserId)) ids.add(validUserId);
    if (resolvedRecipientId) ids.add(resolvedRecipientId);
    ids.delete('');
    return ids;
  }, [resolvedRecipientId, validUserId]);

  const activeRecipientId = useMemo(() => {
    const candidate = (resolvedRecipientId || validUserId || '').trim();
    if (!candidate || candidate === 'broadcast') return '';
    if (!UID_REGEX.test(candidate)) {
      logger.warn(`⚠️ activeRecipientId: "${candidate}" is not a valid UID`);
      return '';
    }
    return candidate;
  }, [resolvedRecipientId, validUserId]);

  const blockedAliasSet = useMemo(() => {
    const aliasSet = new Set<string>();
    if (!Array.isArray(blockedUsers) || blockedUsers.length === 0) {
      return aliasSet;
    }
    blockedUsers.forEach((blockedId) => {
      const normalized = normalizeIdentityValue(blockedId);
      if (normalized) aliasSet.add(normalized);
    });
    return aliasSet;
  }, [blockedUsers]);

  const isBlockedIdentity = useCallback((value?: string | null): boolean => {
    const normalized = normalizeIdentityValue(value);
    if (!normalized || blockedAliasSet.size === 0) return false;
    return blockedAliasSet.has(normalized);
  }, [blockedAliasSet]);

  const storeMessages = useMemo(() => {
    if (peerIdCandidates.size === 0) return [];

    return allStoreMessages.filter((msg) => {
      if (isBlockedIdentity(msg.from) || isBlockedIdentity(msg.to)) {
        return false;
      }
      if (isSystemPayloadMessage({
        type: (msg.type || 'CHAT') as MeshMessage['type'],
        content: msg.content || '',
      })) {
        return false;
      }
      if (selfIds.has(msg.from)) {
        return peerIdCandidates.has(msg.to);
      }
      return peerIdCandidates.has(msg.from);
    });
  }, [allStoreMessages, isBlockedIdentity, peerIdCandidates, selfIds]);

  // ELITE V2: Merge both sources — MeshStore provides rich media, messageStore provides cloud messages
  const messages = useMemo(() => {
    if (!validUserId) return [];

    // 1. Get mesh messages for this conversation
    const meshFiltered = meshMessages.filter((msg) => {
      if (isSystemPayloadMessage(msg)) {
        return false;
      }
      if (isBlockedIdentity(msg.senderId) || isBlockedIdentity(msg.to)) {
        return false;
      }
      const fromMe = selfIds.has(msg.senderId);
      const toPeer = !!msg.to && peerIdCandidates.has(msg.to);
      if (fromMe && toPeer) return true;
      const fromPeer = peerIdCandidates.has(msg.senderId);
      const toMe = !!msg.to && selfIds.has(msg.to);
      return fromPeer && toMe;
    });

    // 2. Build map from meshMessages (keyed by ID)
    const mergedMap = new Map<string, MeshMessage>();
    for (const msg of meshFiltered) {
      mergedMap.set(msg.id, msg);
    }

    // 3. Merge messageStore messages (Firebase cloud) — fill in any missing ones
    // and update delivery status from messageStore (authoritative source)
    for (const storeMsg of storeMessages) {
      const existing = mergedMap.get(storeMsg.id);
      if (existing) {
        // Update delivery status and merge media fields from messageStore (authoritative)
        const updates: Partial<MeshMessage> = {};
        if (storeMsg.status && storeMsg.status !== existing.status) {
          updates.status = storeMsg.status;
        }
        // FIX: Merge media fields from messageStore if MeshStore version is missing them
        if (storeMsg.mediaUrl && !existing.mediaUrl) updates.mediaUrl = storeMsg.mediaUrl;
        if (storeMsg.mediaType && !existing.mediaType) updates.mediaType = storeMsg.mediaType;
        if (typeof storeMsg.mediaDuration === 'number' && !existing.mediaDuration) updates.mediaDuration = storeMsg.mediaDuration;
        if (storeMsg.mediaThumbnail && !existing.mediaThumbnail) updates.mediaThumbnail = storeMsg.mediaThumbnail;
        if (storeMsg.location && !existing.location) updates.location = storeMsg.location;
        if (Object.keys(updates).length > 0) {
          mergedMap.set(storeMsg.id, { ...existing, ...updates });
        }
      } else {
        // Message exists only in messageStore (came from Firebase) — adapt to MeshMessage shape
        mergedMap.set(storeMsg.id, {
          id: storeMsg.id,
          localId: storeMsg.localId,
          senderId: selfIds.has(storeMsg.from)
            ? (identityService.getUid() || 'ME')
            : storeMsg.from,
          senderName: storeMsg.fromName,
          to: storeMsg.to,
          type: (storeMsg.type || 'CHAT') as MeshMessage['type'],
          content: storeMsg.content,
          timestamp: storeMsg.timestamp,
          ttl: 0,
          priority: (storeMsg.priority || 'normal') as MeshMessage['priority'],
          status: storeMsg.status || (storeMsg.delivered ? 'delivered' : storeMsg.read ? 'read' : 'sent'),
          acks: [],
          retryCount: storeMsg.retryCount || 0,
          hops: 0,
          replyTo: storeMsg.replyTo,
          replyPreview: storeMsg.replyPreview,
          // CRITICAL FIX: Propagate media fields from messageStore
          // Without these, media messages from the cloud path display as text-only
          ...(storeMsg.mediaUrl ? { mediaUrl: storeMsg.mediaUrl } : {}),
          ...(storeMsg.mediaType ? { mediaType: storeMsg.mediaType } : {}),
          ...(typeof storeMsg.mediaDuration === 'number' ? { mediaDuration: storeMsg.mediaDuration } : {}),
          ...(storeMsg.mediaThumbnail ? { mediaThumbnail: storeMsg.mediaThumbnail } : {}),
          ...(storeMsg.location ? { location: storeMsg.location } : {}),
        });
      }
    }

    // Final safety net: catch any system payloads that leaked through individual source filters
    return Array.from(mergedMap.values())
      .filter(m => {
        // Check ALL message types — system payloads can arrive with any type
        // due to normalization races or legacy data
        if (isSystemPayloadMessage(m)) return false;
        return true;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [isBlockedIdentity, meshMessages, storeMessages, selfIds, validUserId, peerIdCandidates]);

  const conversationTitle = useMemo(() => {
    const explicitName = typeof userName === 'string' ? userName.trim() : '';
    if (explicitName) return explicitName;

    const contact = contactService.getContactByAnyId(validUserId);
    const contactName = contact?.displayName || contact?.nickname || '';
    if (contactName) return contactName;

    const familyMatch = familyMembers.find((member) => member.uid === validUserId);
    if (familyMatch?.name) return familyMatch.name;

    const conversation = useMessageStore.getState().conversations.find((c) => c.userId === validUserId);
    if (conversation?.userName?.trim()) return conversation.userName.trim();

    const previewId = validUserId || userId || '';
    return previewId ? `Kullanıcı ${previewId.slice(0, 4)}` : 'Kullanıcı';
  }, [familyMembers, userId, userName, validUserId]);

  // Subscribe to connection state
  useEffect(() => {
    const unsubscribe = hybridMessageService.onConnectionChange((state) => {
      setConnectionState(state);
    });

    // Set initial state
    setConnectionState(hybridMessageService.getConnectionState());

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    getDeviceIdFromLib()
      .then((id) => {
        if (id) {
          setPhysicalDeviceId(id);
        }
      })
      .catch((error) => {
        logger.warn('Failed to resolve physical device ID in ConversationScreen:', error);
      });
  }, []);

  // FIX: Auto-mark conversation as read when peerIdCandidates resolve.
  // Per-message read receipts are handled by onViewableItemsChanged (InViewPort mechanism).
  // Runs once when peer IDs are available (may be async due to UID resolution).
  const hasMarkedReadRef = useRef(false);
  useEffect(() => {
    if (peerIdCandidates.size === 0 || hasMarkedReadRef.current) return;
    hasMarkedReadRef.current = true;
    peerIdCandidates.forEach((peerId) => {
      useMessageStore.getState().markConversationRead(peerId);
    });
  }, [peerIdCandidates]);

  // Keep hybrid inbox bridge active while conversation is open (cloud + mesh)
  useEffect(() => {
    let unsubscribeMessages: (() => void) | null = null;
    let disposed = false;

    const setupLiveMessages = async () => {
      try {
        await hybridMessageService.initialize();
        if (disposed) {
          return;
        }
        unsubscribeMessages = await hybridMessageService.subscribeToMessages(() => {
          // Incoming messages are merged into mesh store by the service.
        });
      } catch (error) {
        logger.warn('Failed to activate live message bridge in ConversationScreen:', error);
      }
    };

    setupLiveMessages().catch((error) => {
      logger.warn('Live message setup error in ConversationScreen:', error);
    });

    return () => {
      disposed = true;
      if (unsubscribeMessages) {
        unsubscribeMessages();
      }
    };
  }, []);

  // CRITICAL FIX: Direct V3 conversation subscription for this specific peer.
  // HybridMessageService inbox subscription only fires AFTER a thread appears in the inbox.
  // For new conversations (first message), there's a gap where no subscription is active.
  // This effect proactively finds/creates the DM conversation and subscribes directly.
  useEffect(() => {
    if (!activeRecipientId) return;
    let unsubConversation: (() => void) | null = null;
    let disposed = false;

    const setupDirectConversationSubscription = async () => {
      try {
        const uid = identityService.getUid();
        if (!uid || disposed) return;

        const { firebaseDataService } = await import('../../services/FirebaseDataService');
        try { await firebaseDataService.initialize(); } catch { /* best effort */ }
        if (disposed) return;

        // Resolve peer UID for V3 conversation lookup
        const peerUid = await firebaseDataService.resolveRecipientUid(activeRecipientId);

        // CRITICAL FIX: If conversationId was passed from notification tap, use it directly.
        // This bypasses the pairKey Firestore query (which requires a composite index and can
        // fail) and subscribes to the exact conversation the sender wrote the message to.
        // Without this fix, cold-start taps always opened a NEW empty conversation.
        let conversationId: string | null = null;
        if (paramConversationId && paramConversationId.length > 0) {
          conversationId = paramConversationId;
          logger.info(`Using conversationId from notification params: ${conversationId}`);
        } else if (peerUid) {
          const { findOrCreateDMConversation } = await import('../../services/firebase/FirebaseMessageOperations');
          const conv = await findOrCreateDMConversation(uid, peerUid);
          conversationId = conv?.id || null;
        } else {
          logger.warn('Cannot resolve conversation: no paramConversationId and peerUid is null');
          return;
        }
        const conversation = conversationId ? { id: conversationId } : null;
        if (!conversation?.id || disposed) return;

        logger.info(`Direct V3 subscription for conversation ${conversation.id}`);
        if (!disposed) setActiveConversationId(conversation.id);
        const unsub = await firebaseDataService.subscribeToConversationMessages(
          conversation.id,
          (msgs: any[]) => {
            if (disposed) return;
            // Messages are pushed to stores by HybridMessageService's processCloudMessage.
            // But if HybridMessageService didn't subscribe to this conversation yet,
            // we need to push them to messageStore ourselves.
            const { useMessageStore: getMessageStore } = require('../../stores/messageStore');
            const selfIds = new Set<string>();
            const myUid = identityService.getUid();
            if (myUid) selfIds.add(myUid);

            msgs.forEach((msg: any) => {
              if (!msg?.id) return;
              const senderUid = typeof msg.senderUid === 'string' ? msg.senderUid.trim() : '';
              if (senderUid && selfIds.has(senderUid)) return; // Skip own messages

              // Check if message already exists in store
              const existing = getMessageStore.getState().messages.find((m: any) => m.id === msg.id);
              if (existing) return;

              const fromId = senderUid || msg.fromDeviceId || 'unknown';
              getMessageStore.getState().addMessage({
                id: msg.id,
                from: fromId,
                fromName: msg.senderName || msg.metadata?.senderName || '',
                to: myUid || 'me',
                content: msg.content || '',
                timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
                delivered: true,
                read: false,
                type: msg.type || 'CHAT',
                ...(msg.mediaUrl ? { mediaUrl: msg.mediaUrl } : {}),
                ...(msg.mediaType || msg.metadata?.mediaType ? { mediaType: msg.mediaType || msg.metadata?.mediaType } : {}),
                ...(msg.location ? { location: msg.location } : {}),
              });
            });
          },
        );
        if (unsub && !disposed) {
          unsubConversation = unsub;
        }
      } catch (error) {
        logger.warn('Direct conversation subscription failed:', error);
      }
    };

    // Retry helper — max 3 attempts, 2s delay between each
    const setupWithRetry = async (attempt = 0): Promise<void> => {
      if (disposed) return;
      try {
        await setupDirectConversationSubscription();
      } catch (error) {
        if (!disposed && attempt < 2) {
          logger.warn(`Direct conversation subscription retry ${attempt + 1}/2`);
          await new Promise(r => setTimeout(r, 2000));
          return setupWithRetry(attempt + 1);
        }
        logger.warn('Direct conversation subscription permanently failed:', error);
      }
    };
    setupWithRetry();

    // Re-setup subscription on foreground if screen is open
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !disposed) {
        // HybridMessageService handles resubscription, but also ensure our
        // direct subscription is active (belt-and-suspenders)
        if (!unsubConversation) {
          setupWithRetry().catch(() => {});
        }
      }
    });

    return () => {
      disposed = true;
      appStateSub.remove();
      if (unsubConversation) {
        unsubConversation();
      }
    };
  }, [activeRecipientId]);

  // ELITE: Typing indicator subscription — Firestore-based for remote users
  useEffect(() => {
    if (!activeConversationId) return;
    const myUid = identityService.getUid();
    if (!myUid) return;

    let unsubTyping: (() => void) | null = null;
    let typingClearTimer: NodeJS.Timeout | null = null;

    (async () => {
      try {
        const { subscribeToTyping } = await import('../../services/firebase/FirebaseMessageOperations');
        unsubTyping = subscribeToTyping(activeConversationId, myUid, (typingUsers) => {
          const peerIsTyping = typingUsers.size > 0;
          setIsTyping(peerIsTyping);

          // Auto-clear typing after 6 seconds even if Firestore doesn't update
          if (peerIsTyping) {
            if (typingClearTimer) clearTimeout(typingClearTimer);
            typingClearTimer = setTimeout(() => setIsTyping(false), 6000);
          }
        });
      } catch { /* non-critical */ }
    })();

    return () => {
      unsubTyping?.();
      if (typingClearTimer) clearTimeout(typingClearTimer);
    };
  }, [activeConversationId]);

  // ELITE: Last seen subscription — show "Son görülme: X dk önce" in header
  useEffect(() => {
    const peerId = activeRecipientId;
    if (!peerId) return;

    let unsubLastSeen: (() => void) | null = null;

    (async () => {
      try {
        const { subscribeToLastSeen } = await import('../../services/firebase/FirebaseMessageOperations');
        unsubLastSeen = subscribeToLastSeen(peerId, (lastSeen) => {
          setPeerLastSeen(lastSeen);
        });
      } catch { /* non-critical */ }
    })();

    return () => { unsubLastSeen?.(); };
  }, [activeRecipientId]);

  // ELITE: Cleanup voice recording interval on unmount
  useEffect(() => {
    return () => {
      if (voiceRecordingIntervalRef.current) {
        clearInterval(voiceRecordingIntervalRef.current);
        voiceRecordingIntervalRef.current = null;
      }
      voiceMessageService.cancelRecording().catch(() => { /* no-op */ });
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // iOS: use "will" events for snappy response. "Did" events are redundant and cause
    // double scrollToEnd. Interactive dismiss is handled by KeyboardAvoidingView.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      // Auto-scroll to end so user always sees latest messages when keyboard appears
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Subscribe to typing indicators
  useEffect(() => {
    const unsubscribe = hybridMessageService.onTyping((typingUserId, _userName, typing) => {
      if (peerIdCandidates.has(typingUserId)) {
        setIsTyping(typing);
      }
    });

    return () => unsubscribe();
  }, [peerIdCandidates]);

  // Auto-scroll only when user is near the bottom (don't disrupt history reading)
  useEffect(() => {
    if (messages.length > 0 && !showScrollFab) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, showScrollFab]);

  // Handle text change with typing indicator (throttled to max once per 3 seconds)
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);

    // Broadcast typing indicator — throttle to once per 3 seconds
    if (newText.length > 0) {
      const now = Date.now();
      if (now - lastTypingBroadcastRef.current >= 3000) {
        // Use real Firestore conversationId for cloud delivery, fall back to peer ID for mesh
        const typingConversationId = activeConversationId || activeRecipientId || userId;
        if (typingConversationId) {
          hybridMessageService.broadcastTyping(typingConversationId);
          lastTypingBroadcastRef.current = now;
        }
      }
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 1200);
  }, [activeRecipientId, userId]);

  // Send message using HybridMessageService
  const sendMessage = useCallback(async () => {
    if (!text.trim()) return;
    if (!activeRecipientId) {
      // PRODUCTION LOG: Critical diagnostics for send failure
      logger.error(`🚫 sendMessage BLOCKED: no activeRecipientId. userId="${userId}", validUserId="${validUserId}", resolvedRecipientId="${resolvedRecipientId}"`);
      Alert.alert('Hata', 'Bu kişi için geçerli bir mesajlaşma kimliği bulunamadı. Kişiyi tekrar ekleyin.');
      return;
    }

    // Validate message
    const validation = validateMessage(text);
    if (!validation.valid) {
      Alert.alert('Hata', validation.error || 'Geçersiz mesaj');
      return;
    }

    haptics.impactLight();

    // PRODUCTION LOG: Trace every send attempt for delivery debugging
    logger.info(`📤 sendMessage: to="${activeRecipientId}", text="${validation.sanitized.slice(0, 30)}...", myUid="${identityService.getUid()}"`);

    try {
      const replyPayload = replyToMessage
        ? {
          replyTo: replyToMessage.id,
          replyPreview: sanitizeForDisplay(replyToMessage.content).slice(0, 140),
        }
        : {};

      await hybridMessageService.sendMessage(validation.sanitized, activeRecipientId, {
        priority: 'normal',
        type: 'CHAT',
        ...replyPayload,
      });
      setText('');
      setReplyToMessage(null);
    } catch (error) {
      logger.error('Send failed:', error);
      Alert.alert('Hata', 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    }
  }, [activeRecipientId, replyToMessage, text, userId, validUserId, resolvedRecipientId]);

  // Retry failed message — find the specific message and resend it
  const retryMessage = useCallback(async (messageId: string) => {
    haptics.impactMedium();
    // Try to find the specific message and resend it
    const msg = useMessageStore.getState().messages.find(m => m.id === messageId);
    if (msg && activeRecipientId) {
      try {
        if (msg.mediaType && msg.mediaUrl) {
          await hybridMessageService.sendMediaMessage(msg.mediaType as 'image' | 'voice' | 'location', activeRecipientId, {
            mediaUrl: msg.mediaUrl,
            mediaDuration: typeof msg.mediaDuration === 'number' ? msg.mediaDuration : undefined,
            location: msg.location,
            caption: msg.content || undefined,
          });
        } else {
          await hybridMessageService.sendMessage(msg.content, activeRecipientId, {
            priority: 'normal',
            type: 'CHAT',
          });
        }
        // Remove the failed message from store after successful retry
        useMessageStore.getState().deleteMessage(messageId).catch(() => {});
      } catch {
        // If single-message retry fails, fall back to retrying all failed for this conversation
        await hybridMessageService.retryAllFailed();
      }
    } else {
      // Fallback: retry all failed messages in the queue
      await hybridMessageService.retryAllFailed();
    }
  }, [activeRecipientId]);

  // ELITE: Handle message long press to show options
  const handleMessageLongPress = useCallback((message: MeshMessage) => {
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

    const validation = validateMessage(editText);
    if (!validation.valid) {
      Alert.alert('Hata', validation.error || 'Geçersiz mesaj');
      return;
    }

    updateMeshMessage(editingMessageId, {
      content: validation.sanitized,
    });
    haptics.notificationSuccess();
    setEditingMessageId(null);
    setEditText('');
  }, [editingMessageId, editText, updateMeshMessage]);

  // ELITE: Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingMessageId(null);
    setEditText('');
  }, []);

  // ELITE: Handle delete message — local + cloud sync
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    // Check if "delete for everyone" was requested
    const isDeleteForEveryone = messageId.startsWith('EVERYONE:');
    const actualMessageId = isDeleteForEveryone ? messageId.slice(9) : messageId;

    if (isDeleteForEveryone && activeConversationId) {
      // Cloud delete: mark message as deleted in Firestore for all participants
      try {
        const { deleteMessageForEveryone } = await import('../../services/firebase/FirebaseMessageOperations');
        await deleteMessageForEveryone(activeConversationId, actualMessageId);
      } catch {
        // Fall back to local-only deletion
      }
    }

    // Local: Update MeshStore — mark content as deleted
    updateMeshMessage(actualMessageId, { content: 'Bu mesaj silindi' });

    // Local: Sync to messageStore
    useMessageStore.getState().deleteMessage(actualMessageId).catch(() => {});

    haptics.notificationWarning();
    setOptionsModalVisible(false);
  }, [updateMeshMessage, activeConversationId]);

  // ELITE: Handle forward message — WhatsApp-style contact picker
  const handleForwardMessage = useCallback(async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) {
      setOptionsModalVisible(false);
      return;
    }
    setOptionsModalVisible(false);

    // Build forward targets from recent conversations
    const conversations = useMessageStore.getState().conversations;
    const targets = conversations
      .filter(c => c.userId && !peerIdCandidates.has(c.userId))
      .slice(0, 5);

    if (targets.length === 0) {
      Alert.alert('Bilgi', 'İletilecek kişi bulunamadı. Önce yeni bir sohbet başlatın.');
      return;
    }

    const buttons = targets.map(conv => ({
      text: conv.userName || `Kullanıcı ${conv.userId.slice(0, 6)}`,
      onPress: async () => {
        try {
          if (msg.mediaType && (msg.mediaType === 'image' || msg.mediaType === 'voice' || msg.mediaType === 'location')) {
            await hybridMessageService.sendMediaMessage(msg.mediaType, conv.userId, {
              mediaUrl: msg.mediaUrl,
              mediaDuration: typeof msg.mediaDuration === 'number' ? msg.mediaDuration : undefined,
              mediaThumbnail: msg.mediaThumbnail,
              location: msg.location,
              caption: msg.content || undefined,
            });
          } else {
            const forwardContent = `↩️ İletilen mesaj:\n${msg.content}`;
            await hybridMessageService.sendMessage(forwardContent, conv.userId, {
              location: msg.location,
            });
          }
          haptics.notificationSuccess();
          Alert.alert('Başarılı', 'Mesaj iletildi.');
        } catch {
          Alert.alert('Hata', 'Mesaj iletilemedi.');
        }
      },
    }));

    Alert.alert('Mesajı İlet', 'Kime iletmek istiyorsunuz?', [
      ...buttons,
      { text: 'İptal', style: 'cancel' as const },
    ]);
  }, [messages, peerIdCandidates]);

  // ELITE: Handle reply to message
  const handleReplyToMessage = useCallback((_messageId: string) => {
    const message = selectedMessage;
    if (message) {
      setReplyToMessage(message);
    }
    setOptionsModalVisible(false);
  }, [selectedMessage]);

  // Wire reaction from MessageOptionsModal to MeshStore
  const handleReaction = useCallback((messageId: string, emoji: string) => {
    const myUid = identityService.getUid() || 'me';
    addMeshReaction(messageId, emoji as MessageReaction, myUid);
    haptics.impactLight();
    setOptionsModalVisible(false);
  }, [addMeshReaction]);

  // ELITE: Close options modal
  const closeOptionsModal = useCallback(() => {
    setOptionsModalVisible(false);
    setSelectedMessage(null);
  }, []);

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

  // ============================================================================
  // ELITE: Media Message Handlers
  // ============================================================================

  // Send image message
  const sendImageMessage = useCallback(async (imageUri: string) => {
    if (!activeRecipientId) {
      Alert.alert('Hata', 'Bu kişi için geçerli bir mesajlaşma kimliği bulunamadı. Kişiyi tekrar ekleyin.');
      return;
    }

    haptics.impactMedium();
    try {
      await hybridMessageService.sendMediaMessage('image', activeRecipientId, {
        mediaLocalUri: imageUri,
        caption: '',
      });
      haptics.notificationSuccess();
    } catch (error) {
      logger.error('Send image error:', error);
      Alert.alert('Hata', 'Fotoğraf gönderilemedi.');
    }
  }, [activeRecipientId]);

  // Open camera and take photo
  const handleCameraCapture = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Kameraya erişim için izin vermeniz gerekmektedir.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await sendImageMessage(imageUri);
      }
    } catch (error) {
      logger.error('Camera error:', error);
      Alert.alert('Hata', 'Fotoğraf çekilemedi.');
    }
  }, [sendImageMessage]);

  // Open gallery and select photo
  const handleGallerySelect = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Galeriye erişim için izin vermeniz gerekmektedir.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await sendImageMessage(imageUri);
      }
    } catch (error) {
      logger.error('Gallery error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilemedi.');
    }
  }, [sendImageMessage]);

  // Start voice recording
  const handleVoiceRecordStart = useCallback(async () => {
    try {
      if (isRecordingVoice) {
        return;
      }
      // Ensure audio permissions and mode are configured before recording
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

        // Start duration timer (auto-stop at MAX_VOICE_DURATION)
        if (voiceRecordingIntervalRef.current) {
          clearInterval(voiceRecordingIntervalRef.current);
        }
        voiceRecordingIntervalRef.current = setInterval(() => {
          setVoiceRecordingDuration(prev => {
            const next = prev + 1;
            if (next >= MAX_VOICE_DURATION) {
              // Auto-stop: clear interval immediately, then trigger send
              if (voiceRecordingIntervalRef.current) {
                clearInterval(voiceRecordingIntervalRef.current);
                voiceRecordingIntervalRef.current = null;
              }
              // Schedule send on next tick to avoid state update during interval callback
              setTimeout(() => {
                voiceMessageService.stopRecording().then((voiceMessage) => {
                  if (voiceMessage && activeRecipientId) {
                    hybridMessageService.sendMediaMessage('voice', activeRecipientId, {
                      mediaLocalUri: voiceMessage.uri,
                      mediaDuration: Math.floor(voiceMessage.durationMs / 1000),
                    }).catch((err) => {
                      logger.error('Auto-stop voice send error:', err);
                    });
                    voiceMessageService.backupToFirebase(voiceMessage).catch(() => {});
                    haptics.notificationSuccess();
                  }
                }).catch((err) => {
                  logger.error('Auto-stop voice recording error:', err);
                });
                setIsRecordingVoice(false);
                setVoiceRecordingDuration(0);
              }, 0);
            }
            return next;
          });
        }, 1000);
      } else {
        Alert.alert('Hata', 'Ses kaydı başlatılamadı. Lütfen mikrofon izinlerini kontrol edin.');
      }
    } catch (error) {
      logger.error('Voice recording error:', error);
      Alert.alert('Hata', 'Ses kaydı başlatılamadı.');
    }
  }, [isRecordingVoice, activeRecipientId]);

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

        // Send as media message
        await hybridMessageService.sendMediaMessage('voice', activeRecipientId, {
          mediaLocalUri: voiceMessage.uri,
          mediaDuration: Math.floor(voiceMessage.durationMs / 1000),
        });
        haptics.notificationSuccess();

        // Backup to Firebase
        voiceMessageService.backupToFirebase(voiceMessage).catch((backupError) => {
          logger.warn('Voice backup failed in direct conversation:', backupError);
        });
      }
    } catch (error) {
      logger.error('Voice send error:', error);
      Alert.alert('Hata', 'Ses mesajı gönderilemedi.');
    }
  }, [activeRecipientId]);

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

      await hybridMessageService.sendMediaMessage('location', activeRecipientId, {
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          address,
        },
      });

      haptics.notificationSuccess();
    } catch (error) {
      logger.error('Location share error:', error);
      Alert.alert('Hata', 'Konum paylaşılamadı.');
    }
  }, [activeRecipientId]);

  // Build flat list data with date separator items inserted between days
  const listData = useMemo((): ListItem[] => {
    const result: ListItem[] = [];
    let lastDay = '';
    for (const msg of messages) {
      const day = new Date(msg.timestamp).toDateString();
      if (day !== lastDay) {
        lastDay = day;
        result.push({ kind: 'separator', date: formatDateSeparator(msg.timestamp), id: `sep-${day}` });
      }
      result.push({ kind: 'message', data: msg });
    }
    return result;
  }, [messages]);

  // Build message ID → content map for quick replyTo lookup
  const messageContentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const msg of messages) {
      map.set(msg.id, sanitizeForDisplay(msg.content));
    }
    return map;
  }, [messages]);

  // Pre-built index: message ID → next ListItem in listData (O(1) tail detection)
  const nextItemMap = useMemo(() => {
    const map = new Map<string, ListItem | undefined>();
    for (let i = 0; i < listData.length; i++) {
      const item = listData[i];
      if (item.kind === 'message') {
        map.set(item.data.id, listData[i + 1]);
      }
    }
    return map;
  }, [listData]);

  // Extract renderItem to useCallback for FlatList perf
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'separator') {
      return (
        <View style={fabStyles.dateSeparator}>
          <Text style={fabStyles.dateSeparatorText}>{item.date}</Text>
        </View>
      );
    }
    const msg = item.data;
    const isMe = selfIds.has(msg.senderId);
    // O(1) tail detection via pre-built index map (was O(n) findIndex per item)
    const nextItem = nextItemMap.get(msg.id);
    const nextMsg = nextItem?.kind === 'message' ? nextItem.data : undefined;
    const isLast = !nextMsg || nextMsg.senderId !== msg.senderId;
    const replyToContent = msg.replyTo ? (messageContentMap.get(msg.replyTo) || msg.replyPreview) : undefined;
    const isDeleted = !!(msg as MeshMessage & { isDeleted?: boolean }).isDeleted || msg.content === 'Bu mesaj silindi';

    return (
      <Pressable
        onLongPress={() => {
          haptics.impactLight();
          if (msg.status === 'failed') {
            Alert.alert(
              'Mesaj Gönderilemedi',
              'Bu mesajı yeniden göndermek ister misiniz?',
              [
                { text: 'İptal', style: 'cancel' },
                { text: 'Yeniden Gönder', onPress: () => retryMessage(msg.id) },
              ]
            );
          } else if (!isDeleted) {
            handleMessageLongPress(msg);
          }
        }}
      >
        <MessageBubble
          message={msg}
          isMe={isMe}
          showTail={isLast}
          replyToContent={replyToContent}
        />
      </Pressable>
    );
  }, [nextItemMap, selfIds, messageContentMap, retryMessage, handleMessageLongPress]);

  const keyExtractor = useCallback((item: ListItem) =>
    item.kind === 'separator' ? item.id : item.data.id,
  []);

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollFab(distanceFromBottom > 120);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollFab(false);
  }, []);

  // DEFENSIVE: If userId is missing, prevent crash (MUST be AFTER all hooks)
  if (!userId || typeof userId !== 'string') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <Text style={{ fontSize: 16, color: '#64748b', marginBottom: 16 }}>Konuşma bulunamadı</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#3b82f6', borderRadius: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Geri Dön</Text>
        </Pressable>
      </View>
    );
  }

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
            <Pressable
              style={styles.callBtn}
              onPress={() => {
                if (!activeRecipientId) {
                  Alert.alert('Hata', 'Arama yapılacak kişi bulunamadı.');
                  return;
                }
                haptics.impactMedium();
                navigation.navigate('VoiceCall', {
                  recipientUid: activeRecipientId,
                  recipientName: conversationTitle,
                });
              }}
            >
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
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, paddingTop: insets.top + 68 }}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>İlk mesajı göndererek sohbete başlayın</Text>
            </View>
          }
          ListFooterComponent={isTyping ? <TypingIndicatorDots /> : null}
        />

        {/* Scroll-to-bottom FAB */}
        {showScrollFab ? (
          <Pressable style={fabStyles.fab} onPress={scrollToBottom}>
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </Pressable>
        ) : null}

        {/* Offline Queue Banner */}
        {connectionState === 'offline' && (
          <Animated.View entering={FadeIn} style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color="#b45309" />
            <Text style={styles.offlineBannerText}>Bağlantı bekleniyor... Mesajlar sıraya alındı</Text>
          </Animated.View>
        )}

        {/* Input Area */}
        <BlurView
          intensity={50}
          tint="light"
          style={[
            styles.inputContainer,
            { paddingBottom: keyboardVisible ? 4 : Math.max(insets.bottom, 8) },
          ]}
        >
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
      </KeyboardAvoidingView>

      {/* ELITE: Message Options Modal */}
      <MessageOptionsModal
        visible={optionsModalVisible}
        message={selectedMessageForModal}
        isOwnMessage={selectedMessage ? selfIds.has(selectedMessage.senderId) : false}
        onClose={closeOptionsModal}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onForward={handleForwardMessage}
        onReply={handleReplyToMessage}
        onReaction={handleReaction}
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
    </ImageBackground>
  );
}

/** Styles for scroll FAB and date separator */
const fabStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 10,
  },
  dateSeparatorText: {
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
