/**
 * MESSAGE STORE - Offline Messaging
 * Messages sent via BLE mesh network
 * Persistent storage with AsyncStorage + Firebase Firestore sync
 */

import { create } from 'zustand';
import { getAuth } from 'firebase/auth';
import { DirectStorage } from '../utils/storage';
import { createLogger } from '../utils/logger';
import { safeLowerCase, safeIncludes } from '../utils/safeString';
import { initializeFirebase } from '../../lib/firebase';

const logger = createLogger('MessageStore');

// ELITE: Type definition for lazy imported FirebaseDataService
interface FirebaseDataServiceType {
  isInitialized: boolean;
  loadMessages?: (deviceId: string) => Promise<Message[]>;
  loadConversations?: (deviceId: string) => Promise<Conversation[]>;
  subscribeToMessages?: (
    deviceId: string,
    callback: (messages: Message[]) => void,
    onError?: (error: Error) => void
  ) => Promise<(() => void) | null>;
  saveMessage: (deviceId: string, message: Record<string, unknown>) => Promise<boolean>;
  saveConversation?: (deviceId: string, conversation: Conversation) => Promise<boolean>;
  deleteConversation?: (deviceId: string, userId: string) => Promise<boolean>;
}

// ELITE: Lazy import to break circular dependency
let firebaseDataService: FirebaseDataServiceType | null = null;
const getFirebaseDataService = (): FirebaseDataServiceType | null => {
  if (!firebaseDataService) {
    try {
      firebaseDataService = require('../services/FirebaseDataService').firebaseDataService;
    } catch {
      return null;
    }
  }
  return firebaseDataService;
};

export interface Message {
  id: string;
  localId?: string; // ELITE: Client-side ID for optimistic UI
  from: string;
  fromName?: string; // ELITE: Display name
  to: string;
  content: string;
  timestamp: number;
  delivered: boolean;
  read: boolean;
  type?: 'CHAT' | 'SOS' | 'STATUS' | 'LOCATION' | 'VOICE';
  priority?: 'critical' | 'high' | 'normal';
  // ELITE: Enhanced delivery tracking
  status?: 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  retryCount?: number;
  lastRetryAt?: number;
  // ELITE: Threading
  replyTo?: string;
  replyPreview?: string;
  // ELITE: Message editing
  isEdited?: boolean;
  editedAt?: number;
  originalContent?: string;
  editHistory?: { content: string; editedAt: number }[];
  // ELITE: Message deletion
  isDeleted?: boolean;
  deletedAt?: number;
  // ELITE: Media messaging
  mediaUrl?: string;
  mediaType?: 'image' | 'voice' | 'location';
  mediaDuration?: number;
  mediaThumbnail?: string;
  location?: { lat: number; lng: number; address?: string };
}

export interface Conversation {
  userId: string;
  userName: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  // ELITE: Enhanced conversation metadata
  isTyping?: boolean;
  lastSeen?: number;
  isPinned?: boolean;
  isMuted?: boolean;
  status?: 'online' | 'offline' | 'mesh'; // Connection status
}

// ELITE: Typing indicator state
export interface TypingIndicator {
  userId: string;
  userName?: string;
  conversationId: string;
  timestamp: number;
}

interface MessageState {
  messages: Message[];
  conversations: Conversation[];
  // ELITE V2: Conversation-indexed Map for O(1) lookups (WhatsApp pattern)
  conversationIndex: Map<string, Message[]>;
  // Typing indicators by conversation
  typingUsers: Record<string, TypingIndicator>;
  // Store Firebase unsubscribe function for cleanup
  firebaseUnsubscribe: (() => void) | null;
}

export interface MessageActions {
  initialize: () => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  addConversation: (conversation: Conversation) => Promise<void>;
  markAsDelivered: (messageId: string) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  markConversationRead: (userId: string) => Promise<void>;
  getConversationMessages: (userId: string) => Message[];
  // ELITE V2: Cursor-based pagination (WhatsApp pattern)
  getPagedMessages: (userId: string, cursor?: number, limit?: number) => { messages: Message[]; nextCursor: number | null };
  updateConversations: () => void;
  deleteConversation: (userId: string) => Promise<void>;
  clear: () => Promise<void>;
  // Enhanced actions
  updateMessageStatus: (messageId: string, status: Message['status']) => Promise<void>;
  // ELITE V2: Sync read receipt to Firebase (WhatsApp 3-tick pattern)
  syncReadReceipt: (messageId: string, senderId: string) => Promise<void>;
  setTyping: (conversationId: string, userId: string, userName?: string) => void;
  clearTyping: (conversationId: string) => void;
  getUnreadCount: () => number;
  pinConversation: (userId: string, isPinned: boolean) => Promise<void>;
  muteConversation: (userId: string, isMuted: boolean) => Promise<void>;
  // ELITE V2: Search messages (WhatsApp pattern)
  searchMessages: (query: string, conversationId?: string) => Message[];
  // ELITE: Message edit/delete/forward
  editMessage: (messageId: string, newContent: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  forwardMessage: (messageId: string, toUserId: string) => Promise<Message | null>;
  getMessage: (messageId: string) => Message | undefined;
  // ELITE V2: Rebuild conversation index after bulk operations
  rebuildIndex: () => void;
  // ELITE: Import messages (Silent Hydration)
  importMessages: (messages: Message[]) => Promise<void>;
}

const STORAGE_KEY_MESSAGES_BASE = '@afetnet:messages';
const STORAGE_KEY_CONVERSATIONS_BASE = '@afetnet:conversations';
const STORAGE_GUEST_SCOPE = 'guest';
const SELF_ID_LITERALS = new Set(['me', 'ME']);
const UID_REGEX = /^[A-Za-z0-9]{20,40}$/;
const isNonRoutableConversationId = (value: string): boolean =>
  value === 'broadcast' || value.startsWith('group:');
const NON_CHAT_SYSTEM_TYPES = new Set([
  'family_status_update',
  'family_location_update',
  'family_location',
  'status_update',
  'device_status',
  'presence_update',
  'typing',
  'ack',
  'reaction',
]);


const normalizeId = (value: string | null | undefined): string => {
  if (!value || typeof value !== 'string') return '';
  return value.trim();
};

const getEnvelopeTypeFromContent = (content: string): string => {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return '';
  }
  try {
    const parsed = JSON.parse(trimmed) as { type?: unknown };
    if (typeof parsed.type !== 'string') {
      return '';
    }
    return parsed.type.trim().toLowerCase();
  } catch {
    return '';
  }
};

const isSystemConversationMessage = (message: Message): boolean => {
  if (message.type === 'STATUS') {
    return true;
  }
  const content = typeof message.content === 'string' ? message.content : '';
  if (!content) return false;
  const envelopeType = getEnvelopeTypeFromContent(content);
  if (!envelopeType) return false;
  return NON_CHAT_SYSTEM_TYPES.has(envelopeType);
};

const findFamilyMemberByUid = (uid: string): { uid: string; name?: string } | undefined => {
  if (!uid) return undefined;
  try {
    const { useFamilyStore } = require('./familyStore');
    return useFamilyStore.getState().members.find((m: { uid: string }) => m.uid === uid);
  } catch {
    return undefined;
  }
};

const getStorageScope = (): string => {
  try {
    const app = initializeFirebase();
    if (!app) return STORAGE_GUEST_SCOPE;
    const uid = getAuth(app).currentUser?.uid;
    return uid ? `user:${uid}` : STORAGE_GUEST_SCOPE;
  } catch {
    return STORAGE_GUEST_SCOPE;
  }
};

const getScopedStorageKey = (baseKey: string): string => `${baseKey}:${getStorageScope()}`;

const getSelfIdentityCandidates = (): Set<string> => {
  const ids = new Set<string>(SELF_ID_LITERALS);

  try {
    const app = initializeFirebase();
    if (app) {
      const uid = getAuth(app).currentUser?.uid;
      if (uid) ids.add(uid);
    }
  } catch {
    // best effort
  }

  try {
    const { identityService } = require('../services/IdentityService');
    const uid = identityService.getUid?.();
    if (uid) ids.add(uid);
  } catch {
    // best effort
  }

  return ids;
};

const isSelfId = (value: string | null | undefined, selfIds: Set<string>): boolean => {
  const normalized = normalizeId(value);
  return normalized.length > 0 && selfIds.has(normalized);
};

const resolveCanonicalPeerId = (value: string | null | undefined): string => {
  const normalized = normalizeId(value);
  if (!normalized) return '';
  if (isNonRoutableConversationId(normalized)) return '';
  if (UID_REGEX.test(normalized)) return normalized;
  return '';
};

const getPeerAliasCandidates = (value: string | null | undefined): Set<string> => {
  const aliases = new Set<string>();
  const normalized = normalizeId(value);
  if (normalized) aliases.add(normalized);
  return aliases;
};

const isIdentityInAliasSet = (
  value: string | null | undefined,
  aliasIds: Set<string>,
): boolean => {
  const normalized = normalizeId(value);
  if (!normalized) return false;
  if (aliasIds.has(normalized)) return true;

  const canonical = resolveCanonicalPeerId(normalized);
  if (canonical && aliasIds.has(canonical)) return true;

  return false;
};

const areConversationTargetsEquivalent = (left: string, right: string): boolean => {
  const leftAliases = getPeerAliasCandidates(left);
  const rightAliases = getPeerAliasCandidates(right);
  const leftCanonical = resolveCanonicalPeerId(left);
  const rightCanonical = resolveCanonicalPeerId(right);

  if (leftCanonical) leftAliases.add(leftCanonical);
  if (rightCanonical) rightAliases.add(rightCanonical);
  if (leftAliases.size === 0 || rightAliases.size === 0) return false;

  for (const alias of leftAliases) {
    if (rightAliases.has(alias)) {
      return true;
    }
  }
  return false;
};

const resolvePeerDisplayName = (
  userId: string,
  preferred?: string,
): string => {
  const normalizedUserId = normalizeId(userId);
  const preferredName = typeof preferred === 'string' ? preferred.trim() : '';

  const isGenericPreferred =
    preferredName.length === 0 ||
    preferredName === normalizedUserId ||
    preferredName.toLowerCase().startsWith('kullanıcı ');

  try {
    const { contactService } = require('../services/ContactService');
    const aliases = getPeerAliasCandidates(normalizedUserId);
    for (const alias of aliases) {
      const contact = contactService.getContactByAnyId?.(alias);
      const contactName = normalizeId(contact?.displayName || contact?.nickname);
      if (contactName) return contactName;
    }
  } catch {
    // best effort
  }

  try {
    const { useFamilyStore } = require('./familyStore');
    const members = useFamilyStore.getState().members as Array<{ uid: string; name?: string }>;
    const familyMatch = members.find((member) => member.uid === normalizedUserId);
    if (familyMatch?.name) return familyMatch.name;
  } catch {
    // best effort
  }

  if (!isGenericPreferred && preferredName) {
    return preferredName;
  }

  return preferredName || normalizedUserId;
};

const getOtherUserIdForMessage = (message: Message, selfIds: Set<string>): string => {
  const from = normalizeId(message.from);
  const to = normalizeId(message.to);
  const rawOther = isSelfId(from, selfIds) ? to : from;
  return resolveCanonicalPeerId(rawOther);
};

const normalizeMessageSelfFields = (message: Message, selfIds: Set<string>): Message => {
  if (isSelfId(message.from, selfIds) && message.from !== 'me') {
    return { ...message, from: 'me' };
  }
  return message;
};

const readScopedStorage = (baseKey: string): string | null => {
  const scopedKey = getScopedStorageKey(baseKey);
  const scopedData = DirectStorage.getString(scopedKey);
  if (scopedData) {
    return scopedData;
  }

  // Migration path for legacy global keys
  const legacyData = DirectStorage.getString(baseKey);
  if (legacyData) {
    DirectStorage.setString(scopedKey, legacyData);
    return legacyData;
  }

  return null;
};

const initialState: MessageState = {
  messages: [],
  conversations: [],
  conversationIndex: new Map(),
  typingUsers: {},
  firebaseUnsubscribe: null,
};

// ELITE V2: Build conversation-indexed Map from flat message array
const buildConversationIndex = (messages: Message[]): Map<string, Message[]> => {
  const index = new Map<string, Message[]>();
  const selfIds = getSelfIdentityCandidates();
  for (const msg of messages) {
    if (isSystemConversationMessage(msg)) continue;
    const otherUserId = getOtherUserIdForMessage(msg, selfIds);
    if (!otherUserId) continue;
    const existing = index.get(otherUserId);
    if (existing) {
      existing.push(msg);
    } else {
      index.set(otherUserId, [msg]);
    }
  }
  // Sort each conversation by timestamp
  for (const [, msgs] of index) {
    msgs.sort((a, b) => a.timestamp - b.timestamp);
  }
  return index;
};

// ELITE V2: Debounced conversation update to prevent O(n²) rebuild on rapid message additions
let _conversationUpdateTimer: ReturnType<typeof setTimeout> | null = null;
const CONVERSATION_UPDATE_DEBOUNCE_MS = 100;

const debouncedConversationUpdate = (updateFn: () => void) => {
  if (_conversationUpdateTimer) clearTimeout(_conversationUpdateTimer);
  _conversationUpdateTimer = setTimeout(updateFn, CONVERSATION_UPDATE_DEBOUNCE_MS);
};

// ELITE: Load messages from MMKV (Sync & Fast)
const loadMessages = (): Message[] => {
  try {
    const data = readScopedStorage(STORAGE_KEY_MESSAGES_BASE);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
      logger.warn('messageStore: corrupt messages data, resetting');
    }
  } catch (error) {
    logger.error('Failed to load messages:', error);
  }
  return [];
};

// ELITE: Save messages to MMKV (Sync & Fast)
const saveMessages = (messages: Message[]) => {
  try {
    DirectStorage.setString(getScopedStorageKey(STORAGE_KEY_MESSAGES_BASE), JSON.stringify(messages));
  } catch (error) {
    logger.error('Failed to save messages:', error);
  }
};

// ELITE: Load conversations from MMKV
const loadConversations = (): Conversation[] => {
  try {
    const data = readScopedStorage(STORAGE_KEY_CONVERSATIONS_BASE);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
      logger.warn('messageStore: corrupt conversations data, resetting');
    }
  } catch (error) {
    logger.error('Failed to load conversations:', error);
  }
  return [];
};

// ELITE: Save conversations to MMKV
const saveConversations = (conversations: Conversation[]) => {
  try {
    DirectStorage.setString(getScopedStorageKey(STORAGE_KEY_CONVERSATIONS_BASE), JSON.stringify(conversations));
  } catch (error) {
    logger.error('Failed to save conversations:', error);
  }
};

export const useMessageStore = create<MessageState & MessageActions>((set, get) => ({
  ...initialState,

  // ELITE: Initialize by loading from storage and Firebase
  initialize: async () => {
    // ELITE: Cleanup existing Firebase subscription before re-initializing
    const { firebaseUnsubscribe } = get();
    if (firebaseUnsubscribe && typeof firebaseUnsubscribe === 'function') {
      try {
        firebaseUnsubscribe();
      } catch (error) {
        if (__DEV__) {
          logger.debug('Error unsubscribing from old Firebase message subscription:', error);
        }
      }
      set({ firebaseUnsubscribe: null });
    }

    // First load from MMKV (Instant)
    const localMessagesRaw = loadMessages();
    const selfIds = getSelfIdentityCandidates();
    const localMessages = localMessagesRaw
      .map((message) => normalizeMessageSelfFields(message, selfIds))
      .filter((message) => !isSystemConversationMessage(message));
    const didNormalize =
      localMessages.length !== localMessagesRaw.length
      || localMessages.some((message, index) => message.from !== localMessagesRaw[index]?.from);
    if (didNormalize) {
      saveMessages(localMessages);
    }
    const localIndex = buildConversationIndex(localMessages);
    set({ messages: localMessages, conversations: loadConversations(), conversationIndex: localIndex });

    // Rebuild from messages to purge stale previews (e.g. old system JSON payloads)
    // and keep startup state consistent with current filtering rules.
    get().updateConversations();

    // ARCHITECTURE: messageStore is LOCAL-ONLY (AsyncStorage/MMKV).
    // All Firebase operations are handled by HybridMessageService using
    // identityService.getMyId() — the single account-based ID.
    // Previously, messageStore wrote to Firestore with getDeviceId() (random
    // hardware ID), which was DIFFERENT from the identity ID, causing messages
    // to be written to wrong paths and invisible to recipients.
  },

  addMessage: async (message: Message) => {
    const selfIds = getSelfIdentityCandidates();
    const normalizedMessage = normalizeMessageSelfFields(message, selfIds);

    if (isSystemConversationMessage(normalizedMessage)) {
      if (__DEV__) logger.debug('Skipping system payload in messageStore.addMessage', normalizedMessage.id);
      return;
    }

    // ELITE: Compliance - Blocked User Check
    const { blockedUsers } = require('./settingsStore').useSettingsStore.getState();
    if (Array.isArray(blockedUsers) && blockedUsers.length > 0) {
      const blockedAliasSet = new Set<string>();
      blockedUsers.forEach((blockedUserId: string) => {
        const aliases = getPeerAliasCandidates(blockedUserId);
        aliases.forEach((alias) => blockedAliasSet.add(alias));
        const canonical = resolveCanonicalPeerId(blockedUserId);
        if (canonical) blockedAliasSet.add(canonical);
      });

      if (isIdentityInAliasSet(normalizedMessage.from, blockedAliasSet)) {
        if (__DEV__) logger.debug('Message blocked from:', normalizedMessage.from);
        return;
      }
    }

    // CRITICAL FIX: Deduplicate by message ID.
    const { messages: existingMessages } = get();
    if (existingMessages.some(m => m.id === normalizedMessage.id)) {
      if (__DEV__) logger.debug(`Message ${normalizedMessage.id} already in store, skipping duplicate`);
      return;
    }

    set((state) => {
      // Double-check inside set() to handle race conditions
      if (state.messages.some(m => m.id === normalizedMessage.id)) return state;

      const newMessages = [...state.messages, normalizedMessage];
      // ELITE V2: Update conversation index incrementally
      const newIndex = new Map(state.conversationIndex);
      const otherUserId = getOtherUserIdForMessage(normalizedMessage, selfIds);
      if (otherUserId) {
        const existing = newIndex.get(otherUserId);
        if (existing) {
          existing.push(normalizedMessage);
          existing.sort((a, b) => a.timestamp - b.timestamp);
        } else {
          newIndex.set(otherUserId, [normalizedMessage]);
        }
      }
      return { messages: newMessages, conversationIndex: newIndex };
    });
    // ELITE V2: Debounced conversation rebuild
    debouncedConversationUpdate(() => get().updateConversations());

    // ELITE: Save to AsyncStorage
    const { messages } = get();
    await saveMessages(messages);

    // MESSAGE SOUND & NOTIFICATION: Handled by NotificationCenter via HybridMessageService
    // Only send SOS/emergency messages to backend for rescue coordination
    const content = normalizedMessage.content || '';
    const isEmergency = normalizedMessage.type === 'SOS' || normalizedMessage.priority === 'critical' ||
      safeIncludes(content, 'sos') || safeIncludes(content, 'acil') ||
      safeIncludes(content, 'yardım') || safeIncludes(content, 'kurtar');

    if (isEmergency) {
      try {
        const { backendEmergencyService } = await import('../services/BackendEmergencyService');
        if (backendEmergencyService.initialized) {
          await backendEmergencyService.sendEmergencyMessage({
            messageId: normalizedMessage.id,
            content: normalizedMessage.content,
            timestamp: normalizedMessage.timestamp,
            type: 'text',
            priority: 'critical',
            recipientDeviceId: normalizedMessage.to !== 'me' ? normalizedMessage.to : undefined,
          }).catch((error) => {
            logger.error('Failed to send emergency message to backend:', error);
          });
        }
      } catch (error) {
        logger.error('Failed to send emergency message to backend:', error);
      }
    }
  },

  // ELITE: Silent Bulk Import for Cloud Hydration
  // Adds messages without triggering sounds, notifications, or backend emergency calls.
  // Use this when restoring history from cloud.
  importMessages: async (importedMessages: Message[]) => {
    if (!importedMessages || importedMessages.length === 0) return;

    const selfIds = getSelfIdentityCandidates();
    const normalizedImports = importedMessages
      .map(m => normalizeMessageSelfFields(m, selfIds))
      .filter(m => !isSystemConversationMessage(m));

    if (normalizedImports.length === 0) return;

    set((state) => {
      const existingIds = new Set(state.messages.map(m => m.id));
      const newMessages = normalizedImports.filter(m => !existingIds.has(m.id));

      if (newMessages.length === 0) return state;

      const updatedMessages = [...state.messages, ...newMessages];

      // ELITE V2: Rebuild index smartly
      const newIndex = new Map(state.conversationIndex);

      newMessages.forEach(msg => {
        const otherUserId = getOtherUserIdForMessage(msg, selfIds);
        if (otherUserId) {
          const existing = newIndex.get(otherUserId);
          if (existing) {
            existing.push(msg);
          } else {
            newIndex.set(otherUserId, [msg]);
          }
        }
      });

      // Sort updated conversations
      for (const [, msgs] of newIndex) {
        msgs.sort((a, b) => a.timestamp - b.timestamp);
      }

      return { messages: updatedMessages, conversationIndex: newIndex };
    });

    // Update conversations and save
    get().updateConversations();
    const { messages } = get();
    await saveMessages(messages);
    logger.info(`Hydrated ${normalizedImports.length} messages from cloud.`);
  },
  addConversation: async (conversation: Conversation) => {
    const resolvedConversationId = resolveCanonicalPeerId(conversation.userId);
    if (!resolvedConversationId) {
      logger.warn('Skipping conversation add: non-routable userId', conversation.userId);
      return;
    }

    set((state) => {
      const existingIndex = state.conversations.findIndex((candidate) =>
        areConversationTargetsEquivalent(candidate.userId, resolvedConversationId),
      );
      const existing = existingIndex >= 0 ? state.conversations[existingIndex] : null;
      const hasIncomingTimestamp = typeof conversation.lastMessageTime === 'number' && conversation.lastMessageTime > 0;
      const resolvedLastMessageTime = existing
        ? (hasIncomingTimestamp ? Math.max(existing.lastMessageTime || 0, conversation.lastMessageTime) : existing.lastMessageTime)
        : (hasIncomingTimestamp ? conversation.lastMessageTime : Date.now());

      const normalizedConversation: Conversation = {
        ...conversation,
        userId: existing?.userId || resolvedConversationId,
        userName: conversation.userName || existing?.userName || resolvedConversationId,
        lastMessage: conversation.lastMessage || existing?.lastMessage || '',
        lastMessageTime: resolvedLastMessageTime,
        unreadCount: existing?.unreadCount ?? conversation.unreadCount ?? 0,
        isPinned: existing?.isPinned ?? conversation.isPinned,
        isMuted: existing?.isMuted ?? conversation.isMuted,
      };

      if (existingIndex >= 0 && existing) {
        const updated = [...state.conversations];
        updated[existingIndex] = normalizedConversation;
        return { conversations: updated };
      }

      return {
        conversations: [...state.conversations, normalizedConversation],
      };
    });

    // ELITE: Save to MMKV
    const { conversations } = get();
    saveConversations(conversations);

    // NOTE: Firebase conversation sync not done here — HybridMessageService
    // handles all Firebase operations with the correct identity-based ID.
  },
  markAsDelivered: async (messageId: string) => {
    set((state) => ({
      messages: state.messages.map(m => m.id === messageId ? { ...m, delivered: true } : m),
    }));

    // ELITE: Save to AsyncStorage
    const { messages } = get();
    await saveMessages(messages);
  },
  markAsRead: async (messageId: string) => {
    set((state) => ({
      messages: state.messages.map(m => m.id === messageId ? { ...m, read: true } : m),
    }));
    get().updateConversations();

    // ELITE: Save to AsyncStorage
    const { messages } = get();
    await saveMessages(messages);
  },
  markConversationRead: async (userId: string) => {
    const aliasIds = getPeerAliasCandidates(userId);
    const canonicalUserId = resolveCanonicalPeerId(userId);
    if (canonicalUserId) {
      aliasIds.add(canonicalUserId);
    }

    // Capture unread messages BEFORE updating state
    const unreadMessages = get().messages.filter(
      (m) => isIdentityInAliasSet(m.from, aliasIds) && !m.read,
    );

    set((state) => ({
      messages: state.messages.map((m) =>
        isIdentityInAliasSet(m.from, aliasIds) ? { ...m, read: true, status: 'read' } : m,
      ),
    }));
    get().updateConversations();

    // Save to AsyncStorage (local persistence)
    const { messages } = get();
    await saveMessages(messages);

    // CRITICAL FIX: Sync read receipts to sender's Firestore inbox
    // Without this, sender never sees blue double-check (✓✓🔵)
    if (unreadMessages.length > 0) {
      for (const msg of unreadMessages) {
        get().syncReadReceipt(msg.id, msg.from).catch(() => { });
      }
    }
  },
  getConversationMessages: (userId: string) => {
    // ELITE V2: O(1) lookup from conversation index instead of O(n) full scan
    const { conversationIndex } = get();
    const canonicalUserId = resolveCanonicalPeerId(userId);
    if (canonicalUserId && conversationIndex.has(canonicalUserId)) {
      return (conversationIndex.get(canonicalUserId) || []).filter((message) => !isSystemConversationMessage(message));
    }
    if (conversationIndex.has(userId)) {
      return (conversationIndex.get(userId) || []).filter((message) => !isSystemConversationMessage(message));
    }

    const aliasIds = getPeerAliasCandidates(userId);
    if (canonicalUserId) {
      aliasIds.add(canonicalUserId);
    }

    if (aliasIds.size === 0) return [];

    const merged = new Map<string, Message>();
    aliasIds.forEach((alias) => {
      const messagesForAlias = conversationIndex.get(alias);
      if (!messagesForAlias) return;
      messagesForAlias.forEach((message) => {
        merged.set(message.id, message);
      });
    });

    if (merged.size > 0) {
      return Array.from(merged.values())
        .filter((message) => !isSystemConversationMessage(message))
        .sort((a, b) => a.timestamp - b.timestamp);
    }

    const selfIds = getSelfIdentityCandidates();
    return get().messages
      .filter((message) => !isSystemConversationMessage(message))
      .filter((message) => {
        if (isSelfId(message.from, selfIds)) {
          return isIdentityInAliasSet(message.to, aliasIds);
        }
        return isIdentityInAliasSet(message.from, aliasIds);
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  },

  // ELITE V2: Cursor-based pagination for large conversations (WhatsApp pattern)
  getPagedMessages: (userId: string, cursor?: number, limit: number = 50) => {
    const allMessages = get().getConversationMessages(userId);
    // Messages are sorted ascending by timestamp
    // Cursor is a timestamp — return messages BEFORE the cursor (older messages)
    let filtered = allMessages;
    if (cursor !== undefined) {
      filtered = allMessages.filter(m => m.timestamp < cursor);
    }
    // Take last N messages (most recent)
    const start = Math.max(0, filtered.length - limit);
    const page = filtered.slice(start);
    const nextCursor = start > 0 ? filtered[start - 1]?.timestamp ?? null : null;
    return { messages: page, nextCursor };
  },
  updateConversations: () => {
    const { messages, conversations: existingConversations } = get();
    const { blockedUsers } = require('./settingsStore').useSettingsStore.getState();
    const blockedAliasSet = new Set<string>();
    blockedUsers.forEach((blockedUserId: string) => {
      const aliases = getPeerAliasCandidates(blockedUserId);
      aliases.forEach((alias) => blockedAliasSet.add(alias));
      const canonical = resolveCanonicalPeerId(blockedUserId);
      if (canonical) blockedAliasSet.add(canonical);
    });

    const isBlockedIdentity = (value: string | null | undefined): boolean => {
      if (!value) return false;
      return isIdentityInAliasSet(value, blockedAliasSet);
    };

    const selfIds = getSelfIdentityCandidates();

    // Preserve existing metadata (isPinned, isMuted, userName) in a lookup map
    const metadataMap = new Map<string, Pick<Conversation, 'isPinned' | 'isMuted' | 'userName'>>();
    existingConversations.forEach(c => {
      const metadataKey = resolveCanonicalPeerId(c.userId) || normalizeId(c.userId);
      if (!metadataKey) return;
      const existingMeta = metadataMap.get(metadataKey);
      metadataMap.set(metadataKey, {
        isPinned: (existingMeta?.isPinned ?? false) || (c.isPinned ?? false),
        isMuted: (existingMeta?.isMuted ?? false) || (c.isMuted ?? false),
        userName: existingMeta?.userName || c.userName,
      });
    });

    // O(n) single-pass: compute unread counts and latest message per user
    const unreadCounts = new Map<string, number>();
    const latestMessages = new Map<string, { content: string; timestamp: number; fromName?: string }>();

    for (const msg of messages) {
      if (isBlockedIdentity(msg.from) || isBlockedIdentity(msg.to)) continue;
      if (isSystemConversationMessage(msg)) continue;

      const otherUserId = getOtherUserIdForMessage(msg, selfIds);
      if (!otherUserId) continue;

      // Track unread count
      if (!isSelfId(msg.from, selfIds) && !msg.read) {
        unreadCounts.set(otherUserId, (unreadCounts.get(otherUserId) || 0) + 1);
      }

      // Track latest message
      const existing = latestMessages.get(otherUserId);
      if (!existing || msg.timestamp > existing.timestamp) {
        latestMessages.set(otherUserId, {
          content: (msg.content || '').substring(0, 100),
          timestamp: msg.timestamp,
          fromName: msg.fromName,
        });
      }
    }

    // Build conversations from latest messages
    const conversations: Conversation[] = [];
    for (const [userId, latest] of latestMessages) {
      const meta = metadataMap.get(userId);
      const resolvedUserName = resolvePeerDisplayName(userId, meta?.userName || latest.fromName || userId);
      conversations.push({
        userId,
        userName: resolvedUserName,
        lastMessage: latest.content,
        lastMessageTime: latest.timestamp,
        unreadCount: unreadCounts.get(userId) || 0,
        isPinned: meta?.isPinned,
        isMuted: meta?.isMuted,
      });
    }

    // Sort: pinned first, then by time
    conversations.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.lastMessageTime - a.lastMessageTime;
    });

    set({ conversations });
    saveConversations(conversations);
  },
  deleteConversation: async (userId: string) => {
    const aliasIds = getPeerAliasCandidates(userId);
    const canonicalUserId = resolveCanonicalPeerId(userId);
    if (canonicalUserId) {
      aliasIds.add(canonicalUserId);
    }

    set((state) => {
      const updatedMessages = state.messages.filter((m) => {
        const from = normalizeId(m.from);
        const to = normalizeId(m.to);
        return !isIdentityInAliasSet(from, aliasIds) && !isIdentityInAliasSet(to, aliasIds);
      });
      return {
        conversations: state.conversations.filter((c) => !isIdentityInAliasSet(c.userId, aliasIds)),
        messages: updatedMessages,
        // BUG FIX: Rebuild conversationIndex after deleting messages.
        // Without this, stale entries remain in the index causing ghost
        // conversations in search/lookups.
        conversationIndex: buildConversationIndex(updatedMessages),
      };
    });

    // ELITE: Save to MMKV
    const { messages, conversations } = get();
    saveMessages(messages);
    saveConversations(conversations);

    // Delete from Firebase using correct identity-based ID
    try {
      const { identityService } = require('../services/IdentityService');
      const deviceId = identityService.getUid() || identityService.getMyId();
      if (deviceId && deviceId !== 'unknown') {
        const firebaseService = getFirebaseDataService();
        if (firebaseService?.isInitialized) {
          const remoteTargets = Array.from(aliasIds);
          if (remoteTargets.length === 0) {
            remoteTargets.push(userId);
          }

          await Promise.allSettled(
            remoteTargets.map((target) =>
              firebaseService.deleteConversation?.(deviceId, target),
            ),
          );
        }
      }
    } catch (error) {
      logger.error('Failed to delete conversation:', error);
    }
  },
  clear: async () => {
    // ELITE: Cleanup Firebase subscription before clearing
    const { firebaseUnsubscribe } = get();
    if (firebaseUnsubscribe && typeof firebaseUnsubscribe === 'function') {
      try {
        firebaseUnsubscribe();
      } catch (error) {
        logger.error('Error unsubscribing from Firebase messages:', error);
      }
    }

    set({ ...initialState, firebaseUnsubscribe: null });
    saveMessages([]);
    saveConversations([]);
    DirectStorage.delete(getScopedStorageKey(STORAGE_KEY_MESSAGES_BASE));
    DirectStorage.delete(getScopedStorageKey(STORAGE_KEY_CONVERSATIONS_BASE));
    // Cleanup legacy unscoped keys to prevent cross-account bleed
    DirectStorage.delete(STORAGE_KEY_MESSAGES_BASE);
    DirectStorage.delete(STORAGE_KEY_CONVERSATIONS_BASE);
  },

  // ELITE: Update message status
  updateMessageStatus: async (messageId: string, status: Message['status']) => {
    set((state) => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, status, delivered: status === 'delivered' || status === 'read' } : m
      ),
    }));
    const { messages } = get();
    saveMessages(messages);
  },



  // ELITE: Set typing indicator
  setTyping: (conversationId: string, userId: string, userName?: string) => {
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: { userId, userName, conversationId, timestamp: Date.now() },
      },
    }));

    // Auto-clear typing after 5 seconds
    setTimeout(() => {
      const { typingUsers } = get();
      if (typingUsers[conversationId]?.timestamp && Date.now() - typingUsers[conversationId].timestamp >= 5000) {
        get().clearTyping(conversationId);
      }
    }, 5000);
  },

  // ELITE: Clear typing indicator
  clearTyping: (conversationId: string) => {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.typingUsers;
      return { typingUsers: rest };
    });
  },

  // ELITE: Get total unread count across all conversations
  getUnreadCount: () => {
    const { conversations } = get();
    return conversations.reduce((total, conv) => total + conv.unreadCount, 0);
  },

  // ELITE: Pin/Unpin conversation
  pinConversation: async (userId: string, isPinned: boolean) => {
    const aliasIds = getPeerAliasCandidates(userId);
    const canonicalUserId = resolveCanonicalPeerId(userId);
    if (canonicalUserId) aliasIds.add(canonicalUserId);

    set((state) => ({
      conversations: state.conversations.map(c =>
        isIdentityInAliasSet(c.userId, aliasIds) ? { ...c, isPinned } : c
      ).sort((a, b) => {
        // Pinned conversations first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.lastMessageTime - a.lastMessageTime;
      }),
    }));
    saveConversations(get().conversations);
  },

  // ELITE: Mute/Unmute conversation
  muteConversation: async (userId: string, isMuted: boolean) => {
    const aliasIds = getPeerAliasCandidates(userId);
    const canonicalUserId = resolveCanonicalPeerId(userId);
    if (canonicalUserId) aliasIds.add(canonicalUserId);

    set((state) => ({
      conversations: state.conversations.map(c =>
        isIdentityInAliasSet(c.userId, aliasIds) ? { ...c, isMuted } : c
      ),
    }));
    saveConversations(get().conversations);
  },

  // ELITE: Edit message
  editMessage: async (messageId: string, newContent: string) => {
    const { messages } = get();
    const message = messages.find(m => m.id === messageId);

    if (!message) {
      logger.warn(`Message ${messageId} not found for editing`);
      return false;
    }

    // Only allow editing own messages
    if (!isSelfId(message.from, getSelfIdentityCandidates())) {
      logger.warn('Cannot edit messages from other users');
      return false;
    }

    // Don't edit deleted messages
    if (message.isDeleted) {
      logger.warn('Cannot edit deleted messages');
      return false;
    }

    const now = Date.now();
    const editEntry = { content: message.content, editedAt: now };

    set((state) => ({
      messages: state.messages.map(m =>
        m.id === messageId
          ? {
            ...m,
            content: newContent,
            isEdited: true,
            editedAt: now,
            originalContent: m.originalContent || m.content,
            editHistory: [...(m.editHistory || []), editEntry],
          }
          : m
      ),
    }));

    saveMessages(get().messages);
    get().updateConversations();

    // FIX: Sync edit to Firestore so other participants see the change
    try {
      const { identityService } = require('../services/IdentityService');
      const uid = identityService.getUid();
      if (uid) {
        const { firebaseDataService } = require('../services/FirebaseDataService');
        if (firebaseDataService?.isInitialized) {
          const peerUid = getOtherUserIdForMessage(message, getSelfIdentityCandidates());
          if (peerUid) {
            await firebaseDataService.saveMessage(peerUid, {
              id: messageId,
              content: newContent,
              isEdited: true,
              editedAt: now,
              type: 'text',
              timestamp: message.timestamp,
              senderUid: uid,
              fromDeviceId: uid,
              toDeviceId: peerUid,
              status: 'sent',
            });
          }
        }
      }
    } catch (syncError) {
      logger.warn('Failed to sync edited message to cloud:', syncError);
    }

    logger.info(`Edited message ${messageId}`);
    return true;
  },

  // ELITE: Delete message (soft delete)
  deleteMessage: async (messageId: string) => {
    const { messages } = get();
    const message = messages.find(m => m.id === messageId);

    if (!message) {
      logger.warn(`Message ${messageId} not found for deletion`);
      return false;
    }

    // Only allow deleting own messages
    if (!isSelfId(message.from, getSelfIdentityCandidates())) {
      logger.warn('Cannot delete messages from other users');
      return false;
    }

    const now = Date.now();

    set((state) => ({
      messages: state.messages.map(m =>
        m.id === messageId
          ? {
            ...m,
            isDeleted: true,
            deletedAt: now,
            content: 'Bu mesaj silindi', // Replace content for privacy
          }
          : m
      ),
    }));

    saveMessages(get().messages);
    get().updateConversations();

    // FIX: Sync deletion to Firestore so other participants see the change
    try {
      const { identityService } = require('../services/IdentityService');
      const uid = identityService.getUid();
      if (uid) {
        const { firebaseDataService } = require('../services/FirebaseDataService');
        if (firebaseDataService?.isInitialized) {
          const peerUid = getOtherUserIdForMessage(message, getSelfIdentityCandidates());
          if (peerUid) {
            await firebaseDataService.saveMessage(peerUid, {
              id: messageId,
              content: 'Bu mesaj silindi',
              isDeleted: true,
              deletedAt: now,
              type: 'text',
              timestamp: message.timestamp,
              senderUid: uid,
              fromDeviceId: uid,
              toDeviceId: peerUid,
              status: 'sent',
            });
          }
        }
      }
    } catch (syncError) {
      logger.warn('Failed to sync deleted message to cloud:', syncError);
    }

    logger.info(`Deleted message ${messageId}`);
    return true;
  },

  // ELITE: Forward message to another user
  forwardMessage: async (messageId: string, toUserId: string) => {
    const canonicalRecipient = resolveCanonicalPeerId(toUserId);
    if (!canonicalRecipient) {
      logger.warn(`Cannot forward message ${messageId}: invalid recipient ${toUserId}`);
      return null;
    }

    const { messages } = get();
    const originalMessage = messages.find(m => m.id === messageId);

    if (!originalMessage) {
      logger.warn(`Message ${messageId} not found for forwarding`);
      return null;
    }

    if (originalMessage.isDeleted) {
      logger.warn('Cannot forward deleted messages');
      return null;
    }

    // Create forwarded message
    const forwardedMessage: Message = {
      id: `fwd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      localId: `local-${Date.now()}`,
      from: 'me',
      to: canonicalRecipient,
      content: originalMessage.content,
      timestamp: Date.now(),
      delivered: false,
      read: false,
      type: originalMessage.type || 'CHAT',
      status: 'pending',
      // Note: We could add a 'forwarded' flag here if needed
    };

    await get().addMessage(forwardedMessage);

    logger.info(`Forwarded message ${messageId} to ${canonicalRecipient}`);
    return forwardedMessage;
  },

  // ELITE: Get single message by ID
  getMessage: (messageId: string) => {
    return get().messages.find(m => m.id === messageId);
  },

  // ELITE V2: Sync read receipt to Firebase (WhatsApp 3-tick pattern)
  // When recipient reads a message → update readBy field on the actual message doc
  syncReadReceipt: async (_messageId: string, senderId: string) => {
    try {
      const { identityService } = require('../services/IdentityService');
      const myUid = identityService.getUid();
      if (!myUid || myUid === 'unknown') return;

      // FIX: Use V3 conversation model — mark the conversation as read in inbox
      // instead of creating fake "receipt" messages that pollute the conversation
      const { findOrCreateDMConversation, markConversationRead: markConvRead } = require('../services/firebase/FirebaseMessageOperations');
      const conversation = await findOrCreateDMConversation(myUid, senderId);
      const conversationId = conversation?.id;
      if (conversationId) {
        await markConvRead(myUid, conversationId);

        // Also update the readBy field on recent messages in the conversation
        try {
          const { getFirestoreInstanceAsync } = require('../services/firebase/FirebaseInstanceManager');
          const { doc, updateDoc } = require('firebase/firestore');
          const db = await getFirestoreInstanceAsync();
          if (db) {
            await updateDoc(
              doc(db, 'conversations', conversationId, 'messages', _messageId),
              { [`readBy.${myUid}`]: Date.now() }
            ).catch(() => { /* message may not exist in this conversation */ });
          }
        } catch {
          // readBy update is best-effort
        }
      }

      logger.debug(`Read receipt synced for conversation with ${senderId}`);
    } catch (error) {
      // Read receipt sync is best-effort, don't block
      logger.warn('Failed to sync read receipt:', error);
    }
  },

  // ELITE V2: Search messages (WhatsApp pattern)
  searchMessages: (query: string, conversationId?: string) => {
    if (!query || query.length < 2) return [];

    const lowerQuery = safeLowerCase(query);
    const { messages } = get();

    // Search within a specific conversation (O(m) where m = conversation size)
    if (conversationId) {
      const convMessages = get().getConversationMessages(conversationId);
      return convMessages.filter(m =>
        !m.isDeleted && safeIncludes(safeLowerCase(m.content), lowerQuery)
      );
    }

    // Global search (O(n) — but unavoidable for full-text)
    return messages.filter(m =>
      !m.isDeleted && safeIncludes(safeLowerCase(m.content), lowerQuery)
    );
  },

  // ELITE V2: Force rebuild conversation index after bulk operations
  rebuildIndex: () => {
    const { messages } = get();
    const newIndex = buildConversationIndex(messages);
    set({ conversationIndex: newIndex });
    logger.debug(`Conversation index rebuilt: ${newIndex.size} conversations`);
  },
}));
