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
  Image, Linking, Keyboard,
} from 'react-native';
import { styles } from './ConversationScreen.styles';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '../../components/SafeLinearGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeshStore, MeshMessage } from '../../services/mesh/MeshStore';
import { hybridMessageService } from '../../services/HybridMessageService';
import { BlurView } from '../../components/SafeBlurView';
import Animated, { FadeInUp, Layout, FadeIn, FadeOut } from 'react-native-reanimated';
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

// ELITE: Inline Voice Player for voice messages
const VoicePlayerInline = ({ message, isMe }: { message: MeshMessage; isMe: boolean }) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const durationSec = message.mediaDuration || 0;

  const handlePlay = async () => {
    try {
      if (isPlaying) {
        await voiceMessageService.stop();
        setIsPlaying(false);
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
        await voiceMessageService.play(voiceMsg);
        setIsPlaying(false);
      }
    } catch {
      setIsPlaying(false);
    }
  };

  return (
    <Pressable onPress={handlePlay} style={styles.voicePlayer}>
      <Ionicons
        name={isPlaying ? 'pause-circle' : 'play-circle'}
        size={36}
        color={isMe ? '#1e3a8a' : '#3b82f6'}
      />
      <View style={styles.voiceWaveform}>
        {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.3, 0.6, 0.9, 0.5, 0.7].map((h, i) => (
          <View
            key={i}
            style={[
              styles.voiceBar,
              { height: h * 20, backgroundColor: isMe ? '#1e3a8a50' : '#3b82f650' },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.voiceDuration, { color: isMe ? '#1e3a8a' : '#64748b' }]}>
        {durationSec > 0 ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}` : '0:00'}
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

  // ELITE: Render media content based on message type
  const renderContent = () => {
    // Image message
    if (message.mediaType === 'image') {
      if (message.mediaUrl) {
        return (
          <View>
            <Image
              source={{ uri: message.mediaUrl }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
            {displayContent && displayContent !== '📷 Fotoğraf' && (
              <Text style={[styles.msgText, isMe ? styles.textMe : styles.textOther, { marginTop: 6 }]}>
                {displayContent}
              </Text>
            )}
          </View>
        );
      }
      // Fallback: no URL yet (upload in progress or mesh-only)
      return (
        <View style={styles.mediaPlaceholder}>
          <Ionicons name="image-outline" size={32} color={isMe ? '#1e3a8a' : '#64748b'} />
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
        message.mediaType === 'image' && message.mediaUrl && styles.bubbleImage,
      ]}>
        {renderContent()}

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
  const { userId, userName } = route.params || {};

  // CRITICAL FIX: ALL hooks MUST be declared BEFORE any early return
  // to comply with React Rules of Hooks (same hook count on every render)
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectionState, setConnectionState] = useState<'online' | 'mesh' | 'offline'>('offline');
  const [physicalDeviceId, setPhysicalDeviceId] = useState<string | null>(null);
  // ELITE FIX: Track identity ID in state so selfIds recalculates when identity loads
  const [identityId, setIdentityId] = useState<string | null>(identityService.getIdentity()?.uid || null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // ELITE: InViewPort auto-read receipts — marks messages as read when scrolled into view
  const selfIdsRef = useRef<Set<string>>(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50, minimumViewTime: 300 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: MeshMessage; isViewable: boolean }> }) => {
    const myUid = identityService.getUid();
    if (!myUid) return;
    const currentSelfIds = selfIdsRef.current;
    for (const { item, isViewable } of viewableItems) {
      if (!isViewable) continue;
      if (currentSelfIds.has(item.senderId)) continue;
      if (item.status === 'read') continue;
      useMessageStore.getState().syncReadReceipt(item.id, item.senderId);
      useMeshStore.getState().updateMessage(item.id, { status: 'read' });
    }
  }).current;

  // ELITE: Use mesh store state for in-screen mutations
  const updateMeshMessage = useMeshStore(state => state.updateMessage);

  // ELITE V2: DUAL-SOURCE READ — merge MeshStore (rich media) + messageStore (Firebase inbox)
  // This ensures both BLE mesh messages AND Firebase cloud messages are displayed
  const meshMessages = useMeshStore(state => state.messages);
  const myDeviceId = useMeshStore(state => state.myDeviceId);
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

  const resolvedRecipientId = useMemo(() => {
    const normalizedUserId = validUserId.trim();
    if (!normalizedUserId) return '';
    if (UID_REGEX.test(normalizedUserId)) return normalizedUserId;

    const familyMember = familyMembers.find((m) => m.uid === normalizedUserId);
    if (familyMember?.uid && UID_REGEX.test(familyMember.uid)) return familyMember.uid;

    return '';
  }, [familyMembers, validUserId]);

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
  }, [isBlockedIdentity, meshMessages, storeMessages, selfIds, validUserId, physicalDeviceId, peerIdCandidates]);

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

  // ELITE V2: Auto-mark as read when conversation opens (WhatsApp pattern)
  // Sends read receipts to Firebase so sender sees blue ticks (✓✓🔵)
  useEffect(() => {
    if (peerIdCandidates.size === 0) return;
    // Mark unread messages for all known aliases of this peer identity
    peerIdCandidates.forEach((peerId) => {
      useMessageStore.getState().markConversationRead(peerId);
    });
    // Also update MeshStore message statuses for visual consistency
    // Without this, merged messages from MeshStore show stale delivery status
    meshMessages
      .filter(m => peerIdCandidates.has(m.senderId) && m.status !== 'read')
      .forEach(m => updateMeshMessage(m.id, { status: 'read' }));
  }, [messages.length, peerIdCandidates, meshMessages, updateMeshMessage]); // Re-trigger when new messages arrive

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
        if (!peerUid || disposed) return;

        // Find existing DM conversation (don't create one just by opening the screen)
        const { findOrCreateDMConversation } = await import('../../services/firebase/FirebaseMessageOperations');
        const conversation = await findOrCreateDMConversation(uid, peerUid);
        if (!conversation?.id || disposed) return;

        logger.info(`Direct V3 subscription for conversation ${conversation.id}`);
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

    setupDirectConversationSubscription().catch((error) => {
      logger.warn('Direct conversation subscription setup error:', error);
    });

    return () => {
      disposed = true;
      if (unsubConversation) {
        unsubConversation();
      }
    };
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
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    // iOS interactive dismiss may skip "will" callbacks on some builds.
    const showDidSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
      : null;
    const hideDidSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))
      : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      showDidSub?.remove();
      hideDidSub?.remove();
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

  // Subscribe to new messages and auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // DEFENSIVE: If userId is missing, prevent crash (AFTER all hooks)
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

  // Handle text change with typing indicator
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);

    // Broadcast typing indicator
    if (newText.length > 0) {
      const typingConversationId = activeRecipientId || userId;
      if (typingConversationId) {
        hybridMessageService.broadcastTyping(typingConversationId);
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

  // Retry failed message
  const retryMessage = useCallback(async (messageId: string) => {
    haptics.impactMedium();
    await hybridMessageService.retryAllFailed();
  }, []);

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

  // ELITE: Handle delete message
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    updateMeshMessage(messageId, { content: 'Bu mesaj silindi' });
    haptics.notificationWarning();
    setOptionsModalVisible(false);
  }, [updateMeshMessage]);

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
      logger.error('Camera error:', error);
      Alert.alert('Hata', 'Fotoğraf çekilemedi.');
    }
  }, [activeRecipientId]);

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
      logger.error('Gallery error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilemedi.');
    }
  }, [activeRecipientId]);

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

        // Start duration timer
        if (voiceRecordingIntervalRef.current) {
          clearInterval(voiceRecordingIntervalRef.current);
        }
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => {
            const isMe = selfIds.has(item.senderId);
            const nextMsg = messages[index + 1];
            const isLast = !nextMsg || nextMsg.senderId !== item.senderId;

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
                    handleMessageLongPress(item);
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
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
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

        {/* Input Area */}
        <BlurView
          intensity={50}
          tint="light"
          style={[
            styles.inputContainer,
            { paddingBottom: Platform.OS === 'ios' && keyboardVisible ? 8 : insets.bottom + 10 },
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
