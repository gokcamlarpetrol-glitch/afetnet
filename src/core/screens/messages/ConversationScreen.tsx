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
 *
 * REFACTORED: Header -> ChatHeader, Input -> ChatInput
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  KeyboardAvoidingView, Platform, StatusBar, ImageBackground, Alert,
  AppState, Keyboard,
} from 'react-native';
import { styles } from './ConversationScreen.styles';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '../../components/SafeLinearGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeshStore, MeshMessage } from '../../services/mesh/MeshStore';
import { hybridMessageService } from '../../services/HybridMessageService';
import { meshNetworkService } from '../../services/mesh/MeshNetworkService';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as haptics from '../../utils/haptics';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMessageStore } from '../../stores/messageStore';
import { useFamilyStore } from '../../stores/familyStore';
import { validateMessage, sanitizeForDisplay } from '../../utils/messageSanitizer';
import MessageOptionsModal from '../../components/messages/MessageOptionsModal';
import { getDeviceId as getDeviceIdFromLib } from '../../../lib/device';
import { identityService } from '../../services/IdentityService';
import { contactService } from '../../services/ContactService';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { createLogger } from '../../utils/logger';
import type { MainStackParamList } from '../../types/navigation';

const logger = createLogger('ConversationScreen');
import { isSystemPayloadMessage } from '../../utils/messaging/filters';
import { isLikelyFirebaseUid, normalizeIdentityValue } from '../../utils/messaging/identityUtils';
import { MessageBubble } from '../../components/messaging/MessageBubble';
import { TypingIndicatorDots } from '../../components/messaging/TypingIndicator';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { useMessageActions } from './useMessageActions';


// ELITE: Type-safe navigation and route props
type ConversationNavigationProp = StackNavigationProp<MainStackParamList, 'Conversation'>;
type ConversationRouteProp = RouteProp<MainStackParamList, 'Conversation'>;

interface ConversationScreenProps {
  navigation: ConversationNavigationProp;
  route: ConversationRouteProp;
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
  return msgDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
};

const DELIVERY_STATUS_VALUES = new Set(['pending', 'sending', 'sent', 'delivered', 'read', 'failed']);

const normalizeReceiptId = (value: unknown): string => {
  return typeof value === 'string' ? normalizeIdentityValue(value) : '';
};

const extractReceiptIds = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === 'string') {
    const normalized = normalizeReceiptId(value);
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeReceiptId(item))
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .map((key) => normalizeReceiptId(key))
      .filter((key) => key.length > 0);
  }
  return [];
};

const deriveReceiptState = (
  rawMsg: Record<string, any>,
  options: { isFromMe: boolean; selfIds: Set<string> },
): {
  status: 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  delivered: boolean;
  read: boolean;
} => {
  const rawStatus = DELIVERY_STATUS_VALUES.has(rawMsg.status)
    ? rawMsg.status
    : 'sent';
  const readByIds = extractReceiptIds(rawMsg.readBy);
  const deliveredToIds = extractReceiptIds(rawMsg.deliveredTo);
  const hasSelfRead = readByIds.some((id) => options.selfIds.has(id));
  const hasPeerRead = readByIds.some((id) => !options.selfIds.has(id));
  const hasSelfDelivered = deliveredToIds.some((id) => options.selfIds.has(id));
  const hasPeerDelivered = deliveredToIds.some((id) => !options.selfIds.has(id));

  const read = rawStatus === 'read'
    || rawMsg.read === true
    || (options.isFromMe ? hasPeerRead : hasSelfRead);

  const delivered = read
    || rawStatus === 'delivered'
    || rawMsg.delivered === true
    || (options.isFromMe ? hasPeerDelivered : hasSelfDelivered)
    || !options.isFromMe;

  let status = rawStatus as 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  if (read) {
    status = 'read';
  } else if (delivered) {
    status = 'delivered';
  } else if (!options.isFromMe && (status === 'pending' || status === 'sending' || status === 'sent')) {
    status = 'delivered';
  }

  return { status, delivered, read };
};

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

  // FIX: Ref for identityId so subscription effect can read it without re-triggering
  const identityIdRef = useRef(identityId);
  identityIdRef.current = identityId;

  // ELITE V3: WhatsApp-Style Pagination States
  const [messageLimit, setMessageLimit] = useState(30);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // CRITICAL FIX: Ref for direct per-conversation Firestore subscription
  const directConvUnsubRef = useRef<(() => void) | null>(null);
  const lastTypingBroadcastRef = useRef<number>(0);

  // Scroll-to-bottom FAB state
  const [showScrollFab, setShowScrollFab] = useState(false);
  const hasInitialAutoScrollDoneRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const deliveredReceiptSentRef = useRef<Set<string>>(new Set());
  // CRITICAL FIX: Shared dedup Set for read receipts — prevents duplicate Firestore writes
  // from onViewableItemsChanged AND the batch markAsRead effect firing for the same message.
  const readReceiptSentRef = useRef<Set<string>>(new Set());

  // Retry timer ref for direct subscription retry cleanup on unmount
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ELITE: InViewPort auto-read receipts — marks messages as read when scrolled into view
  const selfIdsRef = useRef<Set<string>>(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50, minimumViewTime: 1000 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: ListItem; isViewable: boolean }> }) => {
    const myUid = identityService.getUid();
    if (!myUid) return;
    const currentSelfIds = selfIdsRef.current;
    for (const { item, isViewable } of viewableItems) {
      if (!isViewable) continue;
      if (item.kind !== 'message') continue;
      const msg = item.data;
      // Only mark INCOMING messages (not our own)
      if (currentSelfIds.has(msg.senderId)) continue;
      if (msg.status === 'read') continue;
      // Dedup: skip if already sent via batch effect or previous viewability callback
      if (readReceiptSentRef.current.has(msg.id)) continue;
      readReceiptSentRef.current.add(msg.id);
      // TRIPLE-TICK: Mark as read in messageStore → writes to Firestore
      // Sender's onSnapshot picks up status='read' → their UI shows blue ticks ✓✓🔵
      useMessageStore.getState().markAsRead(msg.id).catch(e => { if (__DEV__) logger.debug('markAsRead (viewable) failed:', e); });
      useMeshStore.getState().updateMessage(msg.id, { status: 'read' });
    }
  }).current;

  // ELITE V2: DUAL-SOURCE READ — merge MeshStore (rich media) + messageStore (Firebase inbox)
  const meshMessages = useMeshStore(state => state.messages);
  const familyMembers = useFamilyStore((state) => state.members);
  const blockedUsers = useSettingsStore((state) => state.blockedUsers);
  // ELITE FIX: Robust missing userId recovery from conversationId (push notification fallback)
  const validUserId = useMemo(() => {
    let uid = (userId && typeof userId === 'string') ? userId.trim() : '';
    if (!uid && paramConversationId) {
      const conv = useMessageStore.getState().conversations.find(
        (c: any) => c.conversationId === paramConversationId
      );
      if (conv && conv.userId) {
        uid = conv.userId;
      }
    }
    return uid;
  }, [userId, paramConversationId]);

  const allStoreMessages = useMessageStore(state => state.messages);

  // CRITICAL FIX: Ensure identity is captured after async load.
  // Uses escalating retries to handle cold-start race conditions where identity
  // isn't available immediately (e.g., notification tap during app startup).
  // Without this, selfIds lacks the UID → MeshStore messages filtered out.
  useEffect(() => {
    const identity = identityService.getIdentity();
    if (identity?.uid && identity.uid !== identityId) {
      setIdentityId(identity.uid);
    }
    // Escalating retries: 500ms, 1s, 2s, 4s — covers cold-start scenarios
    const retryDelays = [500, 1000, 2000, 4000];
    const timers: NodeJS.Timeout[] = [];
    let resolved = !!identity?.uid;
    for (const delay of retryDelays) {
      if (resolved) break;
      const timer = setTimeout(() => {
        const id = identityService.getIdentity();
        if (id?.uid) {
          resolved = true;
          setIdentityId(id.uid);
        }
      }, delay);
      timers.push(timer);
    }
    return () => timers.forEach(t => clearTimeout(t));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selfIds = useMemo(() => {
    const ids = new Set<string>(['ME', 'me']);
    const uid = identityService.getUid();
    if (uid) ids.add(uid);
    // CRITICAL FIX: Also add identityId from state as belt-and-suspenders.
    // identityService.getUid() might return null even after the retry effect
    // resolved the identity (if the identity service's internal cache was cleared).
    if (identityId) ids.add(identityId);

    // Include all known identity aliases (uid/publicUserCode/qrId) for robust
    // mesh + cloud message classification in direct conversation filters.
    try {
      const aliases = (identityService as any)?.getAliases?.();
      if (Array.isArray(aliases)) {
        for (const alias of aliases) {
          const normalized = typeof alias === 'string' ? alias.trim() : '';
          if (normalized) ids.add(normalized);
        }
      }
    } catch {
      // best effort
    }

    selfIdsRef.current = ids;
    return ids;
  }, [identityId]);

  const [asyncResolvedUid, setAsyncResolvedUid] = useState('');
  const resolvedRecipientId = useMemo(() => {
    // CRITICAL FIX: Notification-open flows may have empty userId but resolve
    // recipient asynchronously from conversation participants (setAsyncResolvedUid).
    // Do NOT early-return before honoring asyncResolvedUid.
    if (asyncResolvedUid) return asyncResolvedUid;
    const normalizedUserId = validUserId.trim();
    if (!normalizedUserId) return '';
    // Kaldırılan daraltıcı kısıt: UID_REGEX kontrolü. Cihaz ID'leri de geçerli olmalı.

    const familyMember = familyMembers.find((m) => m.uid === normalizedUserId || m.deviceId === normalizedUserId);
    if (familyMember?.uid) return familyMember.uid; // Varsa UID döndür
    if (familyMember?.deviceId) return familyMember.deviceId;

    return normalizedUserId; // Fallback to whatever was provided
  }, [familyMembers, validUserId, asyncResolvedUid]);

  // Async UID resolution for non-UID identifiers (AFN codes, device IDs)
  useEffect(() => {
    const normalizedUserId = validUserId.trim();
    // Only resolve aliases (AFN/device IDs). Real UIDs should skip lookup.
    if (!normalizedUserId || isLikelyFirebaseUid(normalizedUserId)) return;
    let cancelled = false;
    (async () => {
      try {
        const { firebaseDataService } = await import('../../services/FirebaseDataService');
        await firebaseDataService.initialize();
        const uid = await firebaseDataService.resolveRecipientUid(normalizedUserId);
        if (!cancelled && uid) { // Remove strict UID_REGEX here too to allow other ID formats if resolved
          setAsyncResolvedUid(uid);
        }
      } catch { /* best effort */ }
    })();
    return () => { cancelled = true; };
  }, [validUserId]);

  const peerIdCandidates = useMemo(() => {
    const ids = new Set<string>();
    const addCandidate = (value?: string | null) => {
      const normalized = typeof value === 'string' ? value.trim() : '';
      if (!normalized || normalized === 'broadcast') return;
      ids.add(normalized);
    };

    addCandidate(validUserId);
    addCandidate(resolvedRecipientId);
    addCandidate(asyncResolvedUid);

    // Contact aliases (currently UID-centric, but keep generic for forward compatibility)
    try {
      const contact =
        contactService.getContactByAnyId(validUserId)
        || contactService.getContactByAnyId(resolvedRecipientId)
        || contactService.getContactByAnyId(asyncResolvedUid);
      if (contact) {
        addCandidate((contact as any).uid);
      }
    } catch {
      // best effort
    }

    // Family aliases (uid + deviceId) for offline mesh routing compatibility
    const familyMatch = familyMembers.find((member) =>
      member.uid === validUserId
      || member.uid === resolvedRecipientId
      || member.uid === asyncResolvedUid
      || member.deviceId === validUserId
      || member.deviceId === resolvedRecipientId
      || member.deviceId === asyncResolvedUid,
    );
    if (familyMatch) {
      addCandidate(familyMatch.uid);
      addCandidate(familyMatch.deviceId);
    }

    if (activeConversationId) {
      const conv = useMessageStore.getState().conversations.find((c) => c.conversationId === activeConversationId);
      if (conv?.userId) {
        addCandidate(conv.userId);
      }
    }

    // Peer candidate set should not contain our own aliases.
    for (const selfId of selfIds) {
      ids.delete(selfId);
    }

    return ids;
  }, [activeConversationId, asyncResolvedUid, familyMembers, resolvedRecipientId, selfIds, validUserId]);

  const activeRecipientId = useMemo(() => {
    const candidate = (resolvedRecipientId || validUserId || '').trim();
    if (!candidate || candidate === 'broadcast') return '';
    // CRITICAL FIX: Removed destructive UID_REGEX check here.
    // Devices without an exact 28-char Firebase Auth UID (e.g. Device IDs during mesh/offline mode,
    // or older migrated accounts) were failing this regex. This caused activeRecipientId to be '',
    // making all outgoing messages fallback to 'broadcast', which completely broke cloud delivery AND
    // hid the message from the sender's own screen because 'broadcast' didn't match the peer ID.
    return candidate;
  }, [resolvedRecipientId, validUserId]);

  // Keep a stable alias list so outgoing direct messages can target UID + mesh aliases together.
  const recipientAliasList = useMemo(() => Array.from(peerIdCandidates), [peerIdCandidates]);

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
    // Don't bail early if activeConversationId is available.
    if (peerIdCandidates.size === 0 && !activeConversationId && !activeRecipientId) return [];

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

      // TIER 1: Match by conversationId — most reliable
      if (activeConversationId && msg.conversationId === activeConversationId) {
        return true;
      }

      // TIER 2: Match by sender/recipient identity (broad peerIdCandidates set)
      if (peerIdCandidates.size > 0) {
        if (selfIds.has(msg.from)) {
          if (peerIdCandidates.has(msg.to)) return true;
        } else if (peerIdCandidates.has(msg.from)) {
          return true;
        }
      }

      // TIER 3: Fallback for own messages — match msg.to against activeRecipientId directly.
      // This catches the case where peerIdCandidates has the raw AFN code / route param
      // but msg.to has the resolved Firebase UID (or vice versa).
      if (activeRecipientId && selfIds.has(msg.from) && msg.to === activeRecipientId) {
        return true;
      }

      return false;
    });
  }, [allStoreMessages, activeConversationId, activeRecipientId, isBlockedIdentity, peerIdCandidates, selfIds]);

  // PRODUCTION LOGGING: Help diagnose message display issues
  useEffect(() => {
    logger.info(`📊 ConversationScreen state: userId="${validUserId}", activeConvId="${activeConversationId || 'null'}", peerIds=[${Array.from(peerIdCandidates).join(',')}], selfIds=[${Array.from(selfIds).join(',')}], identityId="${identityId}", storeMsg=${storeMessages.length}, allMsg=${allStoreMessages.length}, meshMsg=${meshMessages.length}`);
  }, [validUserId, activeConversationId, peerIdCandidates, selfIds, identityId, storeMessages.length, allStoreMessages.length, meshMessages.length]);

  // ELITE V2: Merge both sources — MeshStore provides rich media, messageStore provides cloud messages
  const messages = useMemo(() => {
    // CRITICAL FIX: Don't bail on empty validUserId when activeConversationId is available.
    // Notification taps may have conversationId but empty userId. The conversationId-based
    // filter in storeMessages catches these messages, so we must not short-circuit here.
    if (!validUserId && !activeConversationId) return [];

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
        // TRIPLE-TICK: Sync status from messageStore (authoritative) when it has higher priority
        // Uses shared state machine guard for consistency across all status transitions
        const { MESSAGE_STATUS_PRIORITY } = require('../../services/messaging/constants');
        const existingLevel = MESSAGE_STATUS_PRIORITY[existing.status || ''] ?? 0;
        const storeMsgStatus = storeMsg.status || (storeMsg.read ? 'read' : storeMsg.delivered ? 'delivered' : 'sent');
        const storeLevel = MESSAGE_STATUS_PRIORITY[storeMsgStatus] ?? 0;
        if (storeLevel > existingLevel) {
          updates.status = storeMsgStatus as MeshMessage['status'];
        }
        const hasStoreMediaUrl = typeof storeMsg.mediaUrl === 'string' && storeMsg.mediaUrl.length > 0;
        const hasExistingMediaUrl = typeof existing.mediaUrl === 'string' && existing.mediaUrl.length > 0;
        const storeUrlIsRemote = hasStoreMediaUrl && /^https?:\/\//.test(storeMsg.mediaUrl);
        const existingUrlIsLocal = hasExistingMediaUrl && existing.mediaUrl.startsWith('file:');
        if (hasStoreMediaUrl && (!hasExistingMediaUrl || (storeUrlIsRemote && existingUrlIsLocal))) {
          updates.mediaUrl = storeMsg.mediaUrl;
        }
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
          status: storeMsg.status || (storeMsg.read ? 'read' : storeMsg.delivered ? 'delivered' : 'sent'),
          acks: [],
          retryCount: storeMsg.retryCount || 0,
          hops: 0,
          replyTo: storeMsg.replyTo,
          replyPreview: storeMsg.replyPreview,
          // CRITICAL FIX: Propagate media fields from messageStore
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
        if (isSystemPayloadMessage(m)) return false;
        return true;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [isBlockedIdentity, meshMessages, storeMessages, selfIds, validUserId, activeConversationId, peerIdCandidates]);

  // ELITE V3: Load More functionality for Pagination
  const loadMoreMessages = useCallback(() => {
    if (isLoadingMore || messageLimit >= messages.length) return;

    setIsLoadingMore(true);
    // Simulate slight delay for smooth visual transition and batching
    if (loadMoreTimerRef.current) clearTimeout(loadMoreTimerRef.current);
    loadMoreTimerRef.current = setTimeout(() => {
      setMessageLimit(prev => Math.min(prev + 30, messages.length));
      setIsLoadingMore(false);
    }, 200);
  }, [isLoadingMore, messageLimit, messages.length]);

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

  // ELITE: Message actions — extracted to useMessageActions hook
  const {
    optionsModalVisible,
    selectedMessage,
    selectedMessageForModal,
    editingMessageId,
    editText,
    setEditText,
    replyToMessage,
    clearReply,
    handleMessageLongPress,
    handleEditMessage,
    saveEditedMessage,
    cancelEditing,
    handleDeleteMessage,
    handleForwardMessage,
    handleReplyToMessage,
    handleReaction,
    closeOptionsModal,
  } = useMessageActions({
    selfIds,
    messages,
    peerIdCandidates,
    activeConversationId,
    userId: validUserId || userId || '',
  });

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
  const hasMarkedReadRef = useRef(false);
  useEffect(() => {
    if (peerIdCandidates.size === 0 || hasMarkedReadRef.current) return;
    hasMarkedReadRef.current = true;
    peerIdCandidates.forEach((peerId) => {
      useMessageStore.getState().markConversationRead(peerId);
    });
  }, [peerIdCandidates]);

  // CRITICAL FIX: Ensure cloud subscriptions are alive when conversation opens.
  // Previously called subscribeToMessages() which created DUPLICATE Firestore
  // subscriptions (init.ts already has one). When this screen unmounted, cleanup
  // set cloudEnsureRefresher = null — killing foreground resume for ALL subscriptions.
  // Now we just ensure init.ts's subscription is alive without creating new closures.
  useEffect(() => {
    let disposed = false;

    const ensureSubscriptions = async () => {
      try {
        await hybridMessageService.initialize();
        if (disposed) return;
        // Lightweight: re-ensures existing subscriptions are active
        // without creating new closures or duplicate Firestore listeners
        await hybridMessageService.refreshCloudSubscriptions();
      } catch (error) {
        logger.warn('Failed to ensure cloud subscriptions in ConversationScreen:', error);
      }
    };

    ensureSubscriptions().catch((error) => {
      logger.warn('Cloud subscription ensure error in ConversationScreen:', error);
    });

    return () => {
      disposed = true;
      // CRITICAL: NO cleanup of subscriptions here — init.ts owns them
    };
  }, []);

  // CRITICAL FIX: Direct V3 conversation ID resolution (Routing only, no message fetching)
  useEffect(() => {
    if (!activeRecipientId && !paramConversationId) return;
    let disposed = false;

    const resolveConversationId = async () => {
      try {
        // CRITICAL FIX: Use identityId (from state, set by retry effect) as fallback.
        // On cold start, identityService.getUid() may return null even though
        // the retry effect at lines 152-173 has already resolved the UID and
        // set identityId state. Without this fallback, the subscription is
        // never established on cold start notification taps.
        // FIX: Read identityId from identityIdRef to avoid subscription churn.
        // Previously identityId in deps caused up to 4 teardown/recreate cycles
        // within 4 seconds on cold start as identity resolved through retries.
        let uid = identityService.getUid() || identityIdRef.current;
        // If UID is not yet available (cold start), poll with backoff instead of
        // depending on identityId state which causes full subscription churn
        if (!uid) {
          const retryDelays = [500, 1000, 2000, 4000];
          for (const delay of retryDelays) {
            if (disposed) return;
            await new Promise(r => setTimeout(r, delay));
            uid = identityService.getUid() || identityIdRef.current;
            if (uid) break;
          }
        }
        if (!uid || disposed) return;

        const { firebaseDataService } = await import('../../services/FirebaseDataService');
        try { await firebaseDataService.initialize(); } catch { /* best effort */ }
        if (disposed) return;

        // Resolve peer UID for V3 conversation lookup
        let peerUid: string | null = null;
        if (activeRecipientId) {
          peerUid = await firebaseDataService.resolveRecipientUid(activeRecipientId);
        }

        if (disposed) return;

        let conversationId: string | null = null;
        let inferredPeerUid: string | null = null;
        if (paramConversationId && paramConversationId.length > 0) {
          conversationId = paramConversationId;
          logger.info(`Using conversationId from notification params: ${conversationId}`);

          // If notification payload does not include sender/user identity, infer it from participants.
          // This is required so sendMessage() can route replies correctly instead of blocking with
          // "no activeRecipientId".
          if (!peerUid) {
            try {
              const { getFirestoreInstanceAsync } = await import('../../services/firebase/FirebaseInstanceManager');
              const { doc, getDoc } = await import('firebase/firestore');
              const db = await getFirestoreInstanceAsync();
              if (db) {
                const convDoc = await getDoc(doc(db, 'conversations', conversationId));
                if (convDoc.exists()) {
                  const convData = convDoc.data() as { participants?: unknown };
                  const participants = Array.isArray(convData?.participants)
                    ? (convData.participants as string[])
                    : [];
                  const otherUid = participants.find((p) => typeof p === 'string' && p !== uid);
                  if (otherUid) {
                    inferredPeerUid = otherUid;
                    setAsyncResolvedUid(otherUid);
                    logger.info(`Resolved missing recipient from conversation participants: ${otherUid}`);
                  }
                }
              }
            } catch (participantLookupErr) {
              logger.warn('Participant lookup from conversationId failed (non-critical):', participantLookupErr);
            }
          }
        } else if (peerUid) {
          const { findOrCreateDMConversation } = await import('../../services/firebase/FirebaseMessageOperations');
          const conv = await findOrCreateDMConversation(uid, peerUid);
          conversationId = conv?.id || null;
        } else {
          logger.warn('Cannot resolve conversation: no paramConversationId and peerUid is null');
          return;
        }

        if (conversationId && !disposed) {
          setActiveConversationId(conversationId);
          logger.info(`Resolved activeConversationId to: ${conversationId}`);

          // ─── CRITICAL FIX: One-time message load for existing messages ───
          // The real-time subscription (below) may take time to set up.
          // Meanwhile, existing messages in Firestore are invisible to the user.
          // Load them immediately so the conversation isn't empty on open.
          try {
            const { loadMessages } = await import('../../services/firebase/FirebaseMessageOperations');
            if (disposed) return;
            const existingMsgs = await loadMessages(conversationId);
            if (!disposed && existingMsgs.length > 0) {
              const myUid = identityService.getUid();
              for (const msg of existingMsgs) {
                const rawMsg = msg as Record<string, any>;
                const senderUid = (rawMsg.senderUid || rawMsg.senderId || '').toString().trim();
                if (!senderUid) continue;
                const isFromMe = !!myUid && senderUid === myUid;
                const receiptState = deriveReceiptState(rawMsg, {
                  isFromMe,
                  selfIds,
                });
                const metadata = rawMsg.metadata && typeof rawMsg.metadata === 'object' ? rawMsg.metadata : {};
                useMessageStore.getState().addMessage({
                  id: rawMsg.id,
                  from: isFromMe ? 'me' : senderUid,
                  fromName: rawMsg.fromName || rawMsg.senderName || metadata.senderName || '',
                  to: isFromMe
                    ? (rawMsg.toDeviceId || peerUid || inferredPeerUid || activeRecipientId || '')
                    : (myUid || 'me'),
                  content: rawMsg.content || '',
                  timestamp: typeof rawMsg.timestamp === 'number' ? rawMsg.timestamp : Date.now(),
                  delivered: receiptState.delivered,
                  read: receiptState.read,
                  type: (() => {
                    const mt = rawMsg.mediaType ?? metadata.mediaType;
                    switch (rawMsg.type) {
                      case 'sos': case 'emergency': return 'SOS' as const;
                      case 'voice': return 'VOICE' as const;
                      case 'location': return 'LOCATION' as const;
                      case 'status': return 'STATUS' as const;
                      default:
                        if (mt === 'voice') return 'VOICE' as const;
                        if (mt === 'location') return 'LOCATION' as const;
                        return 'CHAT' as const;
                    }
                  })(),
                  status: receiptState.status,
                  conversationId,
                  ...(rawMsg.mediaUrl ?? metadata.mediaUrl ? { mediaUrl: rawMsg.mediaUrl ?? metadata.mediaUrl } : {}),
                  ...(rawMsg.mediaType ?? metadata.mediaType ? { mediaType: (rawMsg.mediaType ?? metadata.mediaType) as 'image' | 'voice' | 'location' } : {}),
                  ...(typeof (rawMsg.mediaDuration ?? metadata.mediaDuration) === 'number' ? { mediaDuration: rawMsg.mediaDuration ?? metadata.mediaDuration } : {}),
                  ...(rawMsg.mediaThumbnail ?? metadata.mediaThumbnail ? { mediaThumbnail: rawMsg.mediaThumbnail ?? metadata.mediaThumbnail } : {}),
                  ...(rawMsg.location ?? metadata.location ? { location: rawMsg.location ?? metadata.location } : {}),
                });
              }
              logger.info(`📨 Loaded ${existingMsgs.length} existing messages for conversation ${conversationId}`);
            }
          } catch (loadError) {
            logger.debug('One-time message load failed (non-critical, subscription will handle):', loadError);
          }

          // ─── CRITICAL FIX: Direct per-conversation message subscription ───
          // The global ensureCloudSubscriptions from init.ts may fail silently
          // (auth race, UID not ready, Firestore timeout). When this happens,
          // messages are saved to Firestore (Cloud Function sends push) but the
          // in-app onSnapshot never fires → ConversationScreen shows empty.
          //
          // Fix: Set up a DIRECT subscription to this conversation's messages.
          // The messageStore dedup (_messageIdSet) prevents double-processing
          // if the global subscription is also active.
          let subRetryCount = 0;
          const MAX_SUB_RETRIES = 3;

          const setupDirectSubscription = async (): Promise<void> => {
            try {
              const { subscribeToMessages: subscribeToConvMessages } = await import('../../services/firebase/FirebaseMessageOperations');
              if (disposed) return;
              const directUnsub = await subscribeToConvMessages(conversationId, (firestoreMessages) => {
                if (disposed) return;
                const myUid = identityService.getUid();
                for (const msg of firestoreMessages) {
                  const rawMsg = msg as Record<string, any>;
                  const senderUid = (rawMsg.senderUid || rawMsg.senderId || '').toString().trim();
                  if (!senderUid) continue;
                  const isFromMe = !!myUid && senderUid === myUid;
                  // FIX: Use selfIdsRef.current instead of closure-captured selfIds
                  // to avoid stale closure when identityId changes before subscription re-runs
                  const receiptState = deriveReceiptState(rawMsg, {
                    isFromMe,
                    selfIds: selfIdsRef.current,
                  });

                  // Resolve media fields (dual-location pattern)
                  const metadata = rawMsg.metadata && typeof rawMsg.metadata === 'object' ? rawMsg.metadata : {};
                  const mediaUrl = rawMsg.mediaUrl ?? metadata.mediaUrl;
                  const mediaType = rawMsg.mediaType ?? metadata.mediaType;
                  const mediaDuration = rawMsg.mediaDuration ?? metadata.mediaDuration;
                  const mediaThumbnail = rawMsg.mediaThumbnail ?? metadata.mediaThumbnail;
                  const location = rawMsg.location ?? metadata.location;

                  // Map Firestore type ('text'|'sos'|'image'|'voice'|'location') to store type
                  const storeType = (() => {
                    switch (rawMsg.type) {
                      case 'sos': case 'emergency': return 'SOS';
                      case 'image': return 'CHAT'; // Image uses CHAT type + mediaType field
                      case 'voice': return 'VOICE';
                      case 'location': return 'LOCATION';
                      case 'status': return 'STATUS';
                      default:
                        // CRITICAL FIX: Derive type from mediaType if present.
                        // Without this, image/voice messages from Firestore are
                        // always mapped to 'CHAT' and media content is not rendered.
                        if (mediaType === 'voice') return 'VOICE';
                        if (mediaType === 'location') return 'LOCATION';
                        return 'CHAT';
                    }
                  })() as 'CHAT' | 'SOS' | 'STATUS' | 'LOCATION' | 'VOICE';

                  useMessageStore.getState().addMessage({
                    id: rawMsg.id,
                    from: isFromMe ? 'me' : senderUid,
                    // CRITICAL: Check both fromName and senderName — some clients write fromName
                    fromName: rawMsg.fromName || rawMsg.senderName || metadata.senderName || '',
                    to: isFromMe
                      ? (rawMsg.toDeviceId || peerUid || inferredPeerUid || activeRecipientId || '')
                      : (myUid || 'me'),
                    content: rawMsg.content || '',
                    timestamp: typeof rawMsg.timestamp === 'number' ? rawMsg.timestamp : Date.now(),
                    delivered: receiptState.delivered,
                    read: receiptState.read,
                    type: storeType,
                    status: receiptState.status,
                    conversationId,
                    ...(rawMsg.replyTo ? { replyTo: rawMsg.replyTo } : {}),
                    ...(rawMsg.replyPreview ? { replyPreview: rawMsg.replyPreview } : {}),
                    ...(typeof mediaUrl === 'string' && mediaUrl ? { mediaUrl } : {}),
                    ...(typeof mediaType === 'string' && mediaType ? { mediaType: mediaType as 'image' | 'voice' | 'location' } : {}),
                    ...(typeof mediaDuration === 'number' ? { mediaDuration } : {}),
                    ...(typeof mediaThumbnail === 'string' && mediaThumbnail ? { mediaThumbnail } : {}),
                    ...(location && typeof location === 'object' ? { location } : {}),
                  });
                }
              });
              if (directUnsub) {
                if (disposed) {
                  // RACE FIX: effect cleanup ran before subscription was stored —
                  // clean up the listener immediately to prevent leak
                  try { directUnsub(); } catch { /* no-op */ }
                } else {
                  directConvUnsubRef.current = directUnsub;
                  logger.info(`✅ Direct conversation subscription active: ${conversationId}`);
                }
              }
            } catch (subError) {
              subRetryCount++;
              if (subRetryCount <= MAX_SUB_RETRIES && !disposed) {
                const delay = Math.min(2000 * Math.pow(2, subRetryCount - 1), 10000);
                logger.warn(`Direct subscription failed (attempt ${subRetryCount}/${MAX_SUB_RETRIES}), retrying in ${delay}ms`);
                const retryId = setTimeout(() => { if (!disposed) setupDirectSubscription(); }, delay);
                retryTimerRef.current = retryId;
              } else {
                logger.error('Direct conversation subscription EXHAUSTED retries:', subError);
              }
            }
          };

          await setupDirectSubscription();
        }
      } catch (error) {
        logger.warn('Direct conversation ID resolution failed:', error);
      }
    };

    resolveConversationId();

    return () => {
      disposed = true;
      if (directConvUnsubRef.current) {
        try { directConvUnsubRef.current(); } catch { /* no-op */ }
        directConvUnsubRef.current = null;
      }
      // Clean up loadMore timer to prevent state updates on unmounted component
      if (loadMoreTimerRef.current) {
        clearTimeout(loadMoreTimerRef.current);
        loadMoreTimerRef.current = null;
      }
      // Clean up retry timer for direct subscription to prevent leak
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      // FIX: Clear receipt dedup sets on conversation change or unmount.
      // Without this, navigating to a different conversation keeps old IDs in the set,
      // which could skip read/delivered receipts for messages with matching IDs.
      readReceiptSentRef.current.clear();
      deliveredReceiptSentRef.current.clear();
    };
  }, [activeRecipientId, paramConversationId]);

  // ELITE: Typing indicator subscription — Firestore-based for remote users
  useEffect(() => {
    if (!activeConversationId) return;
    const myUid = identityService.getUid();
    if (!myUid) return;

    let unsubTyping: (() => void) | null = null;
    let typingClearTimer: NodeJS.Timeout | null = null;
    // FIX: disposed flag prevents leak when cleanup runs before async import resolves.
    // Without this, the import resolves AFTER cleanup, creating an orphaned Firestore listener.
    let disposed = false;

    (async () => {
      try {
        const { subscribeToTyping } = await import('../../services/firebase/FirebaseMessageOperations');
        if (disposed) return; // Cleanup already ran — don't subscribe
        unsubTyping = subscribeToTyping(activeConversationId, myUid, (typingUsers) => {
          if (disposed) return;
          const peerIsTyping = typingUsers.size > 0;
          setIsTyping(peerIsTyping);

          if (peerIsTyping) {
            if (typingClearTimer) clearTimeout(typingClearTimer);
            typingClearTimer = setTimeout(() => setIsTyping(false), 6000);
          }
        });
      } catch { /* non-critical */ }
    })();

    return () => {
      disposed = true;
      unsubTyping?.();
      if (typingClearTimer) clearTimeout(typingClearTimer);
    };
  }, [activeConversationId]);

  // ELITE: Last seen subscription
  useEffect(() => {
    const peerId = activeRecipientId;
    if (!peerId) return;

    let unsubLastSeen: (() => void) | null = null;
    // FIX: disposed flag prevents leak when cleanup runs before async import resolves.
    let disposed = false;

    (async () => {
      try {
        const { subscribeToLastSeen } = await import('../../services/firebase/FirebaseMessageOperations');
        if (disposed) return;
        unsubLastSeen = subscribeToLastSeen(peerId, (lastSeen) => {
          if (disposed) return;
          setPeerLastSeen(lastSeen);
        });
      } catch { /* non-critical */ }
    })();

    return () => {
      disposed = true;
      unsubLastSeen?.();
    };
  }, [activeRecipientId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, []);

  // NOTE: Typing indicator is handled by the Firebase Firestore subscription above (lines ~774-801).
  // The HybridMessageService-based subscription was removed to prevent duplicate state updates
  // and conflicting setIsTyping() calls that caused "yazıyor..." to flicker or get stuck.

  // Ensure BLE mesh is active while direct conversation is open (offline receive reliability).
  useEffect(() => {
    let cancelled = false;
    const ensureMeshRunning = async () => {
      try {
        if (meshNetworkService.getIsRunning()) return;
        await meshNetworkService.start();
        if (!cancelled) {
          logger.info('ConversationScreen: BLE mesh started for offline direct messaging');
        }
      } catch (error) {
        logger.debug('ConversationScreen: BLE mesh start skipped', error);
      }
    };

    ensureMeshRunning();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    hasInitialAutoScrollDoneRef.current = false;
    isNearBottomRef.current = true;
    deliveredReceiptSentRef.current.clear();
    readReceiptSentRef.current.clear();
    setShowScrollFab(false);
  }, [activeConversationId, validUserId]);

  // FIX: Suppress OS notification banner when viewing this conversation (WhatsApp behavior).
  useEffect(() => {
    try {
      const { notificationCenter } = require('../../services/notifications/NotificationCenter');
      const viewId = activeConversationId || activeRecipientId || null;
      notificationCenter.currentlyViewingConversationId = viewId;
      return () => { notificationCenter.currentlyViewingConversationId = null; };
    } catch { return undefined; }
  }, [activeConversationId, activeRecipientId]);

  // Ensure incoming messages move to delivered state even if no explicit ACK path fired.
  useEffect(() => {
    for (const msg of messages) {
      const isIncoming = !selfIds.has(msg.senderId);
      if (!isIncoming) continue;
      if (msg.status === 'delivered' || msg.status === 'read') continue;
      if (deliveredReceiptSentRef.current.has(msg.id)) continue;

      deliveredReceiptSentRef.current.add(msg.id);
      // FIX: Don't remove from dedup set on failure — otherwise each render retries
      // indefinitely, creating infinite Firestore write loop on persistent errors.
      useMessageStore.getState().markAsDelivered(msg.id).catch(e => {
        if (__DEV__) logger.debug('markAsDelivered failed:', e);
      });
      useMeshStore.getState().updateMessage(msg.id, { status: 'delivered' });
    }
  }, [messages, selfIds]);

  // CRITICAL FIX: Mark incoming messages as "read" when conversation is opened.
  // Without this, the sender never sees the blue double-tick (read receipt).
  // O1 FIX: Debounced batch processing — previously each message triggered an individual
  // Firestore write. With 50 unread messages, that's 50 RPCs on open. Now we collect
  // all unread IDs and process them in a single debounced batch (500ms).
  const markAsReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeConversationId) return;

    // Collect unread incoming message IDs (dedup with shared readReceiptSentRef)
    const unreadIds: string[] = [];
    for (const msg of messages) {
      if (selfIds.has(msg.senderId)) continue;
      if (msg.status === 'read') continue;
      if (readReceiptSentRef.current.has(msg.id)) continue;
      unreadIds.push(msg.id);
    }
    if (unreadIds.length === 0) return;

    // Register IDs in dedup set immediately to prevent double-collection on re-render.
    for (const id of unreadIds) {
      readReceiptSentRef.current.add(id);
    }

    // Clear previous timer to debounce
    if (markAsReadTimerRef.current) clearTimeout(markAsReadTimerRef.current);

    markAsReadTimerRef.current = setTimeout(() => {
      const store = useMessageStore.getState();
      const meshStore = useMeshStore.getState();
      for (const id of unreadIds) {
        store.markAsRead(id).catch(e => { if (__DEV__) logger.debug('markAsRead (open) failed:', e); });
        meshStore.updateMessage(id, { status: 'read' });
      }
    }, 500);

    return () => {
      if (markAsReadTimerRef.current) {
        clearTimeout(markAsReadTimerRef.current);
        markAsReadTimerRef.current = null;
        // CRITICAL FIX: If the timer was cancelled before firing (e.g., messages array
        // changed during the 500ms debounce window), remove the IDs from the dedup set.
        // Otherwise, these IDs are permanently marked as "sent" in the dedup set but
        // markAsRead was never actually called — sender never sees blue ticks for them.
        for (const id of unreadIds) {
          readReceiptSentRef.current.delete(id);
        }
      }
    };
  }, [activeConversationId, messages, selfIds]);

  // INVERTED: Auto-scroll to bottom (offset 0) when new messages arrive while near bottom.
  // With inverted FlatList, the list naturally starts at data[0] (newest), so initial scroll
  // is handled automatically. We only need to scroll when new messages arrive and user is near bottom.
  useEffect(() => {
    if (messages.length === 0) return;

    if (!hasInitialAutoScrollDoneRef.current) {
      // Inverted FlatList starts at data[0] (bottom) naturally — no manual scroll needed
      hasInitialAutoScrollDoneRef.current = true;
      return;
    }

    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    }
  }, [messages.length]);

  // Handle text change with typing indicator (throttled to max once per 3 seconds)
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);

    if (newText.length > 0) {
      const now = Date.now();
      // Typing broadcast throttle: 1000ms matches WhatsApp responsiveness.
      if (now - lastTypingBroadcastRef.current >= 1000) {
        const typingConversationId = activeConversationId || activeRecipientId;
        if (typingConversationId) {
          hybridMessageService.broadcastTyping(typingConversationId);
          lastTypingBroadcastRef.current = now;
        }
      }
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 1200);
  }, [activeRecipientId, activeConversationId]);

  // Send message using HybridMessageService
  const sendMessage = useCallback(async () => {
    if (!text.trim()) return;
    // CRITICAL FIX: Fall back to validUserId when activeRecipientId is empty.
    // On cold start (notification tap), async UID resolution can take up to 4s.
    // During this time, activeRecipientId is '' because resolvedRecipientId hasn't
    // resolved yet. But validUserId (from route params) IS available immediately.
    // Without this fallback, users see messages but can't reply for several seconds
    // after opening a conversation from a notification.
    const effectiveRecipientId = activeRecipientId || validUserId;
    if (!effectiveRecipientId) {
      logger.error(`sendMessage BLOCKED: no activeRecipientId or validUserId. userId="${userId}", validUserId="${validUserId}", resolvedRecipientId="${resolvedRecipientId}"`);
      Alert.alert('Hata', 'Bu kişi için geçerli bir mesajlaşma kimliği bulunamadı. Kişiyi tekrar ekleyin.');
      return;
    }

    const validation = validateMessage(text);
    if (!validation.valid) {
      Alert.alert('Hata', validation.error || 'Geçersiz mesaj');
      return;
    }

    haptics.impactLight();
    Keyboard.dismiss();

    // OPTIMISTIC UI: Clear input IMMEDIATELY before the async send.
    // WhatsApp/Telegram behavior: user sees the message bubble appear instantly
    // while the send happens in the background. Previously, text stayed in the
    // input field for 100ms-2s while identity resolution and queue mutex ran.
    const messageText = validation.sanitized;
    const currentReply = replyToMessage;
    setText('');
    clearReply();

    logger.info(`sendMessage: to="${effectiveRecipientId}", text="${messageText.slice(0, 30)}...", myUid="${identityService.getUid()}"`);

    try {
      const replyPayload = currentReply
        ? {
          replyTo: currentReply.id,
          replyPreview: sanitizeForDisplay(currentReply.content).slice(0, 140),
        }
        : {};

      await hybridMessageService.sendMessage(messageText, effectiveRecipientId, {
        priority: 'normal',
        type: 'CHAT',
        conversationId: activeConversationId || undefined,
        recipientAliases: recipientAliasList,
        ...replyPayload,
      });
      // O2 FIX: Removed redundant backfill addMessage — HybridMessageService.sendMessage()
      // already calls pushCloudMessageToMeshStore() which adds the message to stores,
      // and FirebaseDataService.saveMessage() facade backfills conversationId automatically.
      // The old backfill re-added with incomplete fields (missing fromName, type, replyTo).
    } catch (error) {
      logger.error('Send failed:', error);
      // Restore text on failure so user doesn't lose their message
      setText(messageText);
      Alert.alert('Hata', 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    }
  }, [activeRecipientId, activeConversationId, replyToMessage, text, userId, validUserId, resolvedRecipientId, clearReply, recipientAliasList]);

  // Retry failed message
  // CRITICAL FIX: Previous implementation created a NEW message (new ID) and tried to delete
  // the old one. If deleteMessage failed → 2 identical messages visible. Also, the old message
  // stayed in HybridMessageService's queue → potential double-send.
  // New approach: Reset status to 'pending' and let HybridMessageService's processQueue retry it.
  const retryMessage = useCallback(async (messageId: string) => {
    haptics.impactMedium();
    const msg = useMessageStore.getState().messages.find(m => m.id === messageId);
    if (msg) {
      try {
        // Reset status to pending so processQueue picks it up
        useMessageStore.getState().updateMessageStatus(messageId, 'pending');
        useMeshStore.getState().updateMessage(messageId, { status: 'pending' });
        // Trigger queue processing immediately
        await hybridMessageService.retryAllFailed();
      } catch (e) {
        if (__DEV__) logger.debug('retryMessage failed:', e);
      }
    }
  }, []);

  // Build flat list data with date separator items inserted between days.
  // CRITICAL FIX: Reversed for inverted FlatList pattern (WhatsApp/Telegram standard).
  // data[0] = newest message → appears at bottom of screen.
  // This guarantees the chat starts at the latest messages on first render.
  const listData = useMemo((): ListItem[] => {
    const result: ListItem[] = [];
    let lastDay = '';

    // START ELITE V3 PAGINATION SLICE
    // Instead of rendering all messages, slice the last `messageLimit` amount
    const startIndex = Math.max(0, messages.length - messageLimit);
    const paginatedMessages = messages.slice(startIndex);

    for (const msg of paginatedMessages) {
      const day = new Date(msg.timestamp).toDateString();
      if (day !== lastDay) {
        lastDay = day;
        result.push({ kind: 'separator', date: formatDateSeparator(msg.timestamp), id: `sep-${day}` });
      }
      result.push({ kind: 'message', data: msg });
    }
    // Reverse for inverted FlatList: newest at index 0 (bottom of screen)
    return result.reverse();
  }, [messages, messageLimit]);

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

  // INVERTED FlatList scroll handler:
  // In inverted mode, contentOffset.y = 0 means "at bottom" (newest messages).
  // Scrolling up (seeing older messages) increases contentOffset.y.
  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    // In inverted FlatList: contentOffset.y near 0 = at bottom (newest)
    const awayFromBottom = contentOffset.y > 120;
    isNearBottomRef.current = !awayFromBottom;
    setShowScrollFab(awayFromBottom);

    // Load older messages when scrolling near the TOP of inverted list
    // (high contentOffset = old messages). Content at end of array = top of screen.
    const distanceFromTop = contentSize.height - contentOffset.y - layoutMeasurement.height;
    if (distanceFromTop < 100) {
      loadMoreMessages();
    }
  }, [loadMoreMessages]);

  // INVERTED: scrollToOffset(0) = bottom (newest messages)
  const scrollToBottom = useCallback(() => {
    isNearBottomRef.current = true;
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowScrollFab(false);
  }, []);

  const handleScrollToEnd = useCallback(() => {
    isNearBottomRef.current = true;
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // INVERTED: No need for manual scroll-to-bottom on content size change.
  // Inverted FlatList naturally starts at data[0] which is the newest message.
  // Only auto-scroll if user is near bottom and new messages arrive.
  const handleContentSizeChange = useCallback(() => {
    if (listData.length === 0) return;
    if (isNearBottomRef.current) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
    hasInitialAutoScrollDoneRef.current = true;
  }, [listData.length]);

  // DEFENSIVE: If no valid user ID available, prevent crash (MUST be AFTER all hooks)
  // CRITICAL FIX: Check validUserId (which can recover from paramConversationId)
  // instead of raw userId. Previously, notification taps that had conversationId
  // but empty userId would hit this early return — showing "Konuşma bulunamadı"
  // even though the conversation was fully recoverable.
  if (!validUserId && !paramConversationId) {
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

      {/* Elite Header — extracted to ChatHeader */}
      <ChatHeader
        navigation={navigation}
        insets={insets}
        conversationTitle={conversationTitle}
        isTyping={isTyping}
        peerLastSeen={peerLastSeen}
        connectionState={connectionState}
        activeRecipientId={activeRecipientId}
        userId={userId}
        peerIdCandidates={peerIdCandidates}
        conversationId={activeConversationId || undefined}
      />

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
          inverted={true}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.top + 68, paddingTop: 20 }}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
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
          ListHeaderComponent={isTyping ? <TypingIndicatorDots /> : null}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: '#64748b', fontSize: 13 }}>Önceki mesajlar yükleniyor...</Text>
              </View>
            ) : null
          }
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

        {/* Input Area — extracted to ChatInput */}
        <ChatInput
          insets={insets}
          activeRecipientId={activeRecipientId}
          recipientAliases={recipientAliasList}
          activeConversationId={activeConversationId}
          userId={userId}
          text={text}
          onTextChange={handleTextChange}
          onSendMessage={sendMessage}
          replyToMessage={replyToMessage}
          onClearReply={clearReply}
          editingMessageId={editingMessageId}
          editText={editText}
          onEditTextChange={setEditText}
          onSaveEdit={saveEditedMessage}
          onCancelEdit={cancelEditing}
          onScrollToEnd={handleScrollToEnd}
        />
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
