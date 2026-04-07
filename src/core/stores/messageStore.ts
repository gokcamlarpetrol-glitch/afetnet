/**
 * MESSAGE STORE - Offline Messaging
 * Messages sent via BLE mesh network
 * Persistent storage with encrypted MMKV (DirectStorage) + Firebase Firestore sync
 */

import { create } from 'zustand';
import { AppState } from 'react-native';
import { DirectStorage } from '../utils/storage';
import { createLogger } from '../utils/logger';
import { safeLowerCase, safeIncludes } from '../utils/safeString';
import { getFirebaseAuth } from '../../lib/firebase';
import { identityService } from '../services/IdentityService';
import { readCachedAuthUid } from '../utils/authSessionCache';
import { retryWithBackoffSafe } from '../utils/retry';

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
  // ELITE: Double-tick and read receipts Firestore sync
  markMessageAsDelivered?: (conversationId: string, messageId: string) => Promise<boolean>;
  markMessageAsRead?: (conversationId: string, messageId: string) => Promise<boolean>;
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
  // CRITICAL: Used for syncing statuses and navigation routing
  conversationId?: string;
  // ELITE: Enhanced delivery tracking (WhatsApp triple-tick)
  status?: 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  deliveredAt?: number;  // Timestamp when message was delivered to recipient device
  readAt?: number;       // Timestamp when message was read by recipient
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
  // CRITICAL: Firestore V3 conversation ID — allows direct subscription without pairKey lookup
  conversationId?: string;
  // ELITE: Enhanced conversation metadata
  isTyping?: boolean;
  lastSeen?: number;
  isPinned?: boolean;
  isMuted?: boolean;
  status?: 'online' | 'offline' | 'mesh'; // Connection status
  // WhatsApp-level preview fields
  lastMessageFrom?: string; // userId of the last message sender
  lastMessageStatus?: 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
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
  // Loading state during initialization
  isInitializing: boolean;
}

export interface MessageActions {
  initialize: () => Promise<void>;
  syncFromStorageIncremental: () => Promise<void>;
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
  syncReadReceipt: (messageId: string, senderId: string, conversationId?: string) => Promise<void>;
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
// Message cap — MMKV handles large payloads efficiently.
// Set high to preserve message history (user expects messages to persist until deleted).
const MAX_MESSAGES = 50000;
const SELF_ID_LITERALS = new Set(['me', 'ME']);
import { UID_REGEX, normalizeIdentityValue } from '../utils/messaging/identityUtils';
import { NON_CHAT_SYSTEM_TYPES, getEnvelopeTypeFromContent } from '../utils/messaging/filters';

const isNonRoutableConversationId = (value: string): boolean =>
  value === 'broadcast' || value.startsWith('group:');

/** Alias for shared normalizeIdentityValue — used extensively throughout this store */
const normalizeId = normalizeIdentityValue;

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


const getStorageScope = (): string => {
  // Primary: Firebase Auth currentUser
  try {
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (uid) return `user:${uid}`;
  } catch { /* fallback below */ }

  // Fallback: MMKV-cached UID (survives auth token refresh)
  try {
    const cachedUid = identityService?.getUid?.();
    if (cachedUid && cachedUid !== 'unknown') return `user:${cachedUid}`;
  } catch { /* fallback below */ }

  const persistedUid = readCachedAuthUid();
  if (persistedUid) return `user:${persistedUid}`;

  return STORAGE_GUEST_SCOPE;
};

const getScopedStorageKey = (baseKey: string): string => `${baseKey}:${getStorageScope()}`;

const getSelfIdentityCandidates = (): Set<string> => {
  const ids = new Set<string>(SELF_ID_LITERALS);

  try {
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (uid) ids.add(uid);
  } catch {
    // best effort
  }

  try {
    const uid = identityService?.getUid?.();
    if (uid) ids.add(uid);
    const persistedUid = readCachedAuthUid();
    if (persistedUid) ids.add(persistedUid);
    const aliases = (identityService as any)?.getAliases?.();
    if (Array.isArray(aliases)) {
      aliases.forEach((a: string) => ids.add(a));
    }
  } catch (err) {
    if (__DEV__) logger.error('getSelfIdentityCandidates Error:', err);
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
  // Prefer strict UID when available
  if (UID_REGEX.test(normalized)) return normalized;
  // Fallback: accept normalized alias/deviceId so non-UID identities are still routable
  return normalized;
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

  // CRITICAL FIX: Do NOT migrate legacy global keys — they may belong to a
  // different user account, causing cross-account data bleed (privacy breach).
  // Legacy data is orphaned; each account starts fresh with scoped storage.
  return null;
};

const initialState: MessageState = {
  messages: [],
  conversations: [],
  conversationIndex: new Map(),
  typingUsers: {},
  firebaseUnsubscribe: null,
  isInitializing: false,
};

// ELITE V2: Build conversation-indexed Map from flat message array
const buildConversationIndex = (messages: Message[]): Map<string, Message[]> => {
  const index = new Map<string, Message[]>();
  const selfIds = getSelfIdentityCandidates();
  for (const msg of messages) {
    if (isSystemConversationMessage(msg)) continue;

    // CRITICAL FIX: Prevent Family Group messages (Phantom Groups) from entering the DM pipeline.
    if (msg.to?.startsWith('grp_') || msg.conversationId?.startsWith('grp_')) continue;

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
    msgs.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  }
  return index;
};

// ELITE V2: Debounced conversation update to prevent O(n²) rebuild on rapid message additions
let _conversationUpdateTimer: ReturnType<typeof setTimeout> | null = null;
const CONVERSATION_UPDATE_DEBOUNCE_MS = 100;

const debouncedConversationUpdate = (updateFn: () => void) => {
  if (process.env.NODE_ENV === 'test') {
    updateFn();
    return;
  }
  if (_conversationUpdateTimer) clearTimeout(_conversationUpdateTimer);
  _conversationUpdateTimer = setTimeout(updateFn, CONVERSATION_UPDATE_DEBOUNCE_MS);
};

// ELITE: Load messages from MMKV (Sync & Fast)
const loadMessages = (): Message[] => {
  const data = readScopedStorage(STORAGE_KEY_MESSAGES_BASE);
  if (!data) return [];
  let parsed: Message[];
  try {
    parsed = JSON.parse(data);
  } catch (e) {
    logger.warn('Failed to parse messages JSON:', e);
    return [];
  }
  if (!Array.isArray(parsed)) {
    logger.warn('messageStore: corrupt messages data, resetting');
    return [];
  }
  return parsed;
};

// ELITE: Save messages to MMKV — debounced to avoid 50k JSON.stringify on every message
let _saveMessagesTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingSaveMessages: Message[] | null = null;

const saveMessages = (messages: Message[]) => {
  _pendingSaveMessages = messages;
  if (_saveMessagesTimer) return; // already scheduled
  _saveMessagesTimer = setTimeout(() => {
    _saveMessagesTimer = null;
    if (_pendingSaveMessages) {
      try {
        DirectStorage.setString(getScopedStorageKey(STORAGE_KEY_MESSAGES_BASE), JSON.stringify(_pendingSaveMessages));
      } catch (error) {
        logger.error('Failed to save messages:', error);
      }
      _pendingSaveMessages = null;
    }
  }, 500);
};

// Flush pending messages immediately (for shutdown/logout)
export const flushPendingMessages = () => {
  if (_saveMessagesTimer) {
    clearTimeout(_saveMessagesTimer);
    _saveMessagesTimer = null;
  }
  if (_pendingSaveMessages) {
    try {
      DirectStorage.setString(getScopedStorageKey(STORAGE_KEY_MESSAGES_BASE), JSON.stringify(_pendingSaveMessages));
    } catch (error) {
      logger.error('Failed to flush messages:', error);
    }
    _pendingSaveMessages = null;
  }
};

// CRITICAL: Flush pending messages when app goes to background/inactive
// Prevents data loss if app is killed by OS while debounced saves are pending
AppState?.addEventListener?.('change', (nextState) => {
  if (nextState === 'background' || nextState === 'inactive') {
    flushPendingMessages();
    flushPendingConversations();
  }
});

// ELITE: Load conversations from MMKV
const loadConversations = (): Conversation[] => {
  const data = readScopedStorage(STORAGE_KEY_CONVERSATIONS_BASE);
  if (!data) return [];
  let parsed: Conversation[];
  try {
    parsed = JSON.parse(data);
  } catch (e) {
    logger.warn('Failed to parse conversations JSON:', e);
    return [];
  }
  if (!Array.isArray(parsed)) {
    logger.warn('messageStore: corrupt conversations data, resetting');
    return [];
  }
  return parsed;
};

// ELITE: Save conversations to MMKV — debounced
let _saveConversationsTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingSaveConversations: Conversation[] | null = null;

const saveConversations = (conversations: Conversation[]) => {
  _pendingSaveConversations = conversations;
  if (_saveConversationsTimer) return;
  _saveConversationsTimer = setTimeout(() => {
    _saveConversationsTimer = null;
    if (_pendingSaveConversations) {
      try {
        DirectStorage.setString(getScopedStorageKey(STORAGE_KEY_CONVERSATIONS_BASE), JSON.stringify(_pendingSaveConversations));
      } catch (error) {
        logger.error('Failed to save conversations:', error);
      }
      _pendingSaveConversations = null;
    }
  }, 500);
};

export const flushPendingConversations = () => {
  if (_saveConversationsTimer) {
    clearTimeout(_saveConversationsTimer);
    _saveConversationsTimer = null;
  }
  if (_pendingSaveConversations) {
    try {
      DirectStorage.setString(getScopedStorageKey(STORAGE_KEY_CONVERSATIONS_BASE), JSON.stringify(_pendingSaveConversations));
    } catch (error) {
      logger.error('Failed to flush conversations:', error);
    }
    _pendingSaveConversations = null;
  }
};

const getBootstrappedMessageState = (): Pick<MessageState, 'messages' | 'conversations' | 'conversationIndex'> => {
  try {
    const selfIds = getSelfIdentityCandidates();
    const messages = loadMessages()
      .map((message) => normalizeMessageSelfFields(message, selfIds))
      .filter((message) => !isSystemConversationMessage(message));
    const conversations = loadConversations();

    return {
      messages,
      conversations,
      conversationIndex: buildConversationIndex(messages),
    };
  } catch (error) {
    logger.warn('messageStore bootstrap from MMKV failed:', error);
    return {
      messages: [],
      conversations: [],
      conversationIndex: new Map(),
    };
  }
};

const bootstrappedState = getBootstrappedMessageState();

// PERF: Typing indicator timers — prevents unbounded setTimeout accumulation
const _typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

// PERF Y1: O(1) message deduplication Set — avoids O(n) .some() scans on 50k messages
let _messageIdSet = new Set<string>(bootstrappedState.messages.map((message) => message.id));

// ELITE: Guard flag to prevent concurrent initialize() race conditions
let _initializePromise: Promise<void> | null = null;

export const useMessageStore = create<MessageState & MessageActions>((set, get) => ({
  ...initialState,
  ...bootstrappedState,

  // ELITE: Initialize by loading from storage and Firebase
  initialize: async () => {
    if (_initializePromise) return _initializePromise;
    _initializePromise = (async () => {
      set({ isInitializing: true });
      try {
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
        // PERF Y1: Rebuild dedup Set for this user scope
        _messageIdSet = new Set(localMessages.map(m => m.id));
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
      } finally {
        set({ isInitializing: false });
        _initializePromise = null;
      }
    })();
    return _initializePromise;
  },

  /**
   * Lightweight foreground refresh:
   * - Merges any MMKV-persisted messages that are missing in-memory
   * - Preserves active realtime subscriptions (no full initialize())
   */
  syncFromStorageIncremental: async () => {
    try {
      const selfIds = getSelfIdentityCandidates();
      const localMessages = loadMessages()
        .map((message) => normalizeMessageSelfFields(message, selfIds))
        .filter((message) => !isSystemConversationMessage(message));

      if (localMessages.length === 0) return;

      // Use shared status priority from constants for consistency
      const { MESSAGE_STATUS_PRIORITY } = require('../services/messaging/constants');

      let changed = false;
      set((state) => {
        const indexById = new Map<string, number>();
        const merged = [...state.messages];

        merged.forEach((message, idx) => {
          indexById.set(message.id, idx);
        });

        for (const localMessage of localMessages) {
          const existingIndex = indexById.get(localMessage.id);
          if (existingIndex === undefined) {
            indexById.set(localMessage.id, merged.length);
            merged.push(localMessage);
            changed = true;
            continue;
          }

          const existing = merged[existingIndex];
          const existingPriority = MESSAGE_STATUS_PRIORITY[existing.status || ''] ?? 0;
          const localPriority = MESSAGE_STATUS_PRIORITY[localMessage.status || ''] ?? 0;

          const shouldUpgrade =
            localPriority > existingPriority
            || (!existing.conversationId && !!localMessage.conversationId)
            || (!existing.mediaUrl && !!localMessage.mediaUrl)
            || (!!existing.mediaUrl && existing.mediaUrl.startsWith('file:') && !!localMessage.mediaUrl && /^https?:\/\//.test(localMessage.mediaUrl))
            || (!existing.mediaType && !!localMessage.mediaType)
            || (existing.mediaDuration == null && typeof localMessage.mediaDuration === 'number')
            || (!existing.mediaThumbnail && !!localMessage.mediaThumbnail)
            || (!existing.location && !!localMessage.location)
            || (!!localMessage.read && !existing.read)
            || (!!localMessage.delivered && !existing.delivered);

          if (shouldUpgrade) {
            merged[existingIndex] = { ...existing, ...localMessage };
            changed = true;
          }
        }

        if (!changed) return state;

        merged.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
        const capped = merged.length > MAX_MESSAGES
          ? merged.slice(merged.length - MAX_MESSAGES)
          : merged;

        _messageIdSet = new Set(capped.map((message) => message.id));

        return {
          messages: capped,
          conversationIndex: buildConversationIndex(capped),
        };
      });

      if (!changed) return;

      get().updateConversations();
      saveMessages(get().messages);
    } catch (error) {
      logger.warn('syncFromStorageIncremental failed:', error);
    }
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

    // PERF Y1: O(1) dedup check via Set instead of O(n) .some()
    if (_messageIdSet.has(normalizedMessage.id)) {
      // CRITICAL FIX: Even if message exists, update status if new status is higher priority.
      // This ensures delivery receipts (sent→delivered→read) are picked up from Firestore
      // snapshots that call addMessage with updated message data.
      // Uses shared delivery state machine from constants for consistency.
      const { isStatusTransitionAllowed } = require('../services/messaging/constants');
      // FIX: Always check for media/conversationId sync, even when status is unchanged.
      // Without this, a message arriving with status='pending' + mediaUrl='https://...' would be
      // skipped entirely — breaking voice/image message display.
      set((state) => {
        const existing = state.messages.find(m => m.id === normalizedMessage.id);
        if (!existing) return state;
        const statusChanged = isStatusTransitionAllowed(existing.status, normalizedMessage.status || 'pending')
          && normalizedMessage.status !== existing.status;
        const needsConversationIdSync = !existing.conversationId && !!normalizedMessage.conversationId;
        const hasExistingMediaUrl = typeof existing.mediaUrl === 'string' && existing.mediaUrl.length > 0;
        const hasNewMediaUrl = typeof normalizedMessage.mediaUrl === 'string' && normalizedMessage.mediaUrl.length > 0;
        const shouldUpgradeMediaUrl = hasNewMediaUrl
          && (
            !hasExistingMediaUrl
            || (existing.mediaUrl!.startsWith('file:') && /^https?:\/\//.test(normalizedMessage.mediaUrl!))
          );
        const needsMediaSync = shouldUpgradeMediaUrl
          || (!existing.mediaType && !!normalizedMessage.mediaType)
          || (existing.mediaDuration == null && typeof normalizedMessage.mediaDuration === 'number')
          || (!existing.mediaThumbnail && !!normalizedMessage.mediaThumbnail)
          || (!existing.location && !!normalizedMessage.location);

        if (statusChanged || needsConversationIdSync || needsMediaSync) {
          const newStatus = normalizedMessage.status || 'pending';
          const isDeliveredOrHigher = newStatus === 'delivered' || newStatus === 'read';
          const isRead = newStatus === 'read';
          const updatedMessage = {
            ...existing,
            ...(statusChanged ? { status: normalizedMessage.status, delivered: isDeliveredOrHigher, read: isRead } : {}),
            ...(needsConversationIdSync ? { conversationId: normalizedMessage.conversationId } : {}),
            ...(needsMediaSync ? {
              mediaUrl: shouldUpgradeMediaUrl ? normalizedMessage.mediaUrl : existing.mediaUrl,
              mediaType: normalizedMessage.mediaType || existing.mediaType,
              mediaDuration: normalizedMessage.mediaDuration ?? existing.mediaDuration,
              mediaThumbnail: normalizedMessage.mediaThumbnail || existing.mediaThumbnail,
              location: normalizedMessage.location || existing.location
            } : {})
          };

          const updatedMessages = state.messages.map(m => m.id === normalizedMessage.id ? updatedMessage : m);

          // CRITICAL FIX: Update conversationIndex so ConversationScreen UI re-renders with the new status
          const newIndex = new Map(state.conversationIndex);
          const selfIds = getSelfIdentityCandidates();
          const otherUserId = getOtherUserIdForMessage(updatedMessage, selfIds);

          if (otherUserId) {
            const existingIndexMessages = newIndex.get(otherUserId);
            if (existingIndexMessages) {
              newIndex.set(
                otherUserId,
                existingIndexMessages.map(m => m.id === updatedMessage.id ? updatedMessage : m)
              );
            }
          }

          return {
            messages: updatedMessages,
            conversationIndex: newIndex
          };
        }
        return state;
      });
      // CRITICAL FIX: Persist status/media upgrades and update conversations.
      // Previously the dedup-update path only changed in-memory state but never
      // called saveMessages/debouncedConversationUpdate — status upgrades
      // (sent→delivered→read) and media URL patches were lost on app restart.
      debouncedConversationUpdate(() => get().updateConversations());
      saveMessages(get().messages);
      return;
    }

    set((state) => {
      // Double-check inside set() to handle race conditions (O(1) via Set)
      if (_messageIdSet.has(normalizedMessage.id)) return state;
      _messageIdSet.add(normalizedMessage.id);

      let newMessages = [...state.messages, normalizedMessage];
      // CRITICAL FIX: Cap message count to prevent unbounded memory growth
      if (newMessages.length > MAX_MESSAGES) {
        const removed = newMessages.slice(0, newMessages.length - MAX_MESSAGES);
        removed.forEach(m => _messageIdSet.delete(m.id));
        newMessages = newMessages.slice(newMessages.length - MAX_MESSAGES);
      }
      // ELITE V2: Update conversation index incrementally
      const newIndex = new Map(state.conversationIndex);
      const otherUserId = getOtherUserIdForMessage(normalizedMessage, selfIds);
      if (otherUserId) {
        const existing = newIndex.get(otherUserId);
        if (existing) {
          const updated = [...existing, normalizedMessage].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
          newIndex.set(otherUserId, updated);
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
      .filter(m => !isSystemConversationMessage(m))
      .map((m) => {
        // CRITICAL: backfill conversationId so ConversationScreen can filter correctly
        if (!m.conversationId) {
          const otherId = getOtherUserIdForMessage(m, selfIds);
          if (otherId) {
            const selfId = Array.from(selfIds)[0] || 'me';
            const [a, b] = [otherId, selfId].sort();
            const pair = `pair_${a}_${b}`;
            return { ...m, conversationId: pair };
          }
        }
        return m;
      });

    if (normalizedImports.length === 0) return;

    set((state) => {
      // PERF Y1: Use module-level Set for O(1) dedup instead of rebuilding a new Set each time
      const newMessages = normalizedImports.filter(m => !_messageIdSet.has(m.id));

      if (newMessages.length === 0) return state;

      // Add all new IDs to the dedup Set
      newMessages.forEach(m => _messageIdSet.add(m.id));

      let updatedMessages = [...state.messages, ...newMessages];

      // CRITICAL FIX: Enforce MAX_MESSAGES cap (was only enforced in addMessage, not importMessages)
      if (updatedMessages.length > MAX_MESSAGES) {
        const removed = updatedMessages.slice(0, updatedMessages.length - MAX_MESSAGES);
        removed.forEach(m => _messageIdSet.delete(m.id));
        updatedMessages = updatedMessages.slice(updatedMessages.length - MAX_MESSAGES);
      }

      // ELITE V2: Rebuild index smartly
      const newIndex = new Map(state.conversationIndex);

      newMessages.forEach(msg => {
        const otherUserId = getOtherUserIdForMessage(msg, selfIds);
        if (otherUserId) {
          const existing = newIndex.get(otherUserId);
          if (existing) {
            // Clone array to avoid mutating state — Zustand immutability
            newIndex.set(otherUserId, [...existing, msg]);
          } else {
            newIndex.set(otherUserId, [msg]);
          }
        }
      });

      // Sort updated conversations
      for (const [, msgs] of newIndex) {
        msgs.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
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
        // CRITICAL FIX: Explicitly preserve conversationId during merge.
        // Without this, when an incoming conversation object (e.g., from mesh)
        // doesn't carry conversationId, the spread sets it to undefined,
        // overwriting the existing Firestore V3 conversation ID. This caused
        // MessagesScreen to navigate without conversationId, forcing a pairKey
        // lookup that may fail (missing composite index or timing issues).
        // Use nullish coalescing: undefined conversationId must NOT overwrite existing one.
        // || would treat '' as falsy too, but conversationId should never be empty string.
        conversationId: (conversation.conversationId != null ? conversation.conversationId : undefined) || existing?.conversationId,
        userName: conversation.userName || existing?.userName || resolvedConversationId,
        lastMessage: conversation.lastMessage || existing?.lastMessage || '',
        lastMessageTime: resolvedLastMessageTime,
        // FIX: Prefer incoming unreadCount when provided (non-null/non-undefined).
        // The caller (pushCloudMessageToMeshStore) passes the incremented count.
        // Previously, existing?.unreadCount ?? conversation.unreadCount always picked
        // the existing value (even 0), ignoring the incoming +1 increment.
        unreadCount: conversation.unreadCount ?? existing?.unreadCount ?? 0,
        isPinned: existing?.isPinned ?? conversation.isPinned,
        isMuted: existing?.isMuted ?? conversation.isMuted,
        // Preserve optional metadata from existing conversation when not provided
        lastMessageFrom: conversation.lastMessageFrom || existing?.lastMessageFrom,
        lastMessageStatus: conversation.lastMessageStatus || existing?.lastMessageStatus,
        status: conversation.status || existing?.status,
        lastSeen: conversation.lastSeen ?? existing?.lastSeen,
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
    // IDEMPOTENCY GUARD: Skip if message is already delivered or read.
    // Without this, concurrent calls from multiple code paths (ConversationScreen useEffect,
    // notification handler, etc.) cause redundant Firestore writes + store re-renders.
    const existing = get().messages.find(m => m.id === messageId);
    if (existing && (existing.status === 'delivered' || existing.status === 'read' || existing.delivered || existing.status === 'failed')) {
      return;
    }

    let conversationId: string | undefined;
    set((state) => {
      const selfIds = getSelfIdentityCandidates();
      const message = state.messages.find(m => m.id === messageId);
      let updatedMessageRef: Message | null = null;

      if (message && message.conversationId) {
        conversationId = message.conversationId;
      } else if (message) {
        const peerId = getOtherUserIdForMessage(message, selfIds);
        if (peerId) {
          const conv = state.conversations.find(c => c.userId === peerId);
          conversationId = conv?.conversationId;
        }
      }

      const updatedMessages = state.messages.map(m => {
        if (m.id === messageId) {
          updatedMessageRef = { ...m, delivered: true, status: 'delivered' as const, deliveredAt: m.deliveredAt || Date.now() };
          return updatedMessageRef;
        }
        return m;
      });

      // CRITICAL FIX: Update conversationIndex so UI re-renders delivery tick
      const newIndex = new Map(state.conversationIndex);
      if (updatedMessageRef) {
        const otherUserId = getOtherUserIdForMessage(updatedMessageRef as Message, selfIds);
        if (otherUserId && newIndex.has(otherUserId)) {
          newIndex.set(
            otherUserId,
            newIndex.get(otherUserId)!.map(m => m.id === messageId ? (updatedMessageRef as Message) : m)
          );
        }
      }

      return { messages: updatedMessages, conversationIndex: newIndex };
    });

    // Save to MMKV
    const { messages } = get();
    await saveMessages(messages);

    // Sync "delivered" status to Firestore (Double-tick ✓✓)
    // CRITICAL FIX: Skip synthetic pair_ conversationIds — they're not valid Firestore paths
    // FIX: Retry with backoff — fire-and-forget .catch() silently loses receipts on network blips
    if (conversationId && !conversationId.startsWith('pair_')) {
      const svc = getFirebaseDataService();
      if (svc?.markMessageAsDelivered) {
        retryWithBackoffSafe(
          () => svc.markMessageAsDelivered!(conversationId!, messageId).then(() => undefined),
          // FIX: 4 retries (~30s) too low for mobile networks with 30s+ blips.
          // 8 retries with 30s cap gives ~2 minutes coverage for delivery receipts.
          { maxRetries: 8, baseDelayMs: 2000, maxDelayMs: 30000 },
        ).catch(err => {
          logger.warn('Failed to sync delivered status to Firestore after retries', err);
        });
      }
    }
  },
  markAsRead: async (messageId: string) => {
    // IDEMPOTENCY GUARD: Skip if message is already read or failed (failed is terminal)
    const existingMsg = get().messages.find(m => m.id === messageId);
    if (existingMsg && (existingMsg.status === 'read' || existingMsg.read || existingMsg.status === 'failed')) {
      return;
    }

    let affectedUserId: string | null = null;
    let wasUnread = false;
    let targetConversationId: string | undefined;

    set((state) => {
      const selfIds = getSelfIdentityCandidates();
      let updatedMessageRef: Message | null = null;

      const updatedMessages = state.messages.map(m => {
        if (m.id === messageId && !m.read) {
          wasUnread = true;
          affectedUserId = isSelfId(m.from, selfIds) ? m.to : m.from;
          // Use conversationId from message, or look it up from conversations list
          targetConversationId = m.conversationId;
          if (!targetConversationId && affectedUserId) {
            const peerId = resolveCanonicalPeerId(affectedUserId) || normalizeId(affectedUserId);
            const conv = state.conversations.find(c =>
              resolveCanonicalPeerId(c.userId) === peerId || c.userId === peerId
            );
            targetConversationId = conv?.conversationId;
          }
          updatedMessageRef = { ...m, read: true, status: 'read', readAt: m.readAt || Date.now() };
          return updatedMessageRef;
        }
        return m;
      });

      if (!wasUnread || !affectedUserId) return { messages: updatedMessages };

      const resolvedId = resolveCanonicalPeerId(affectedUserId) || normalizeId(affectedUserId);
      const updatedConversations = state.conversations.map(c => {
        if (resolveCanonicalPeerId(c.userId) === resolvedId || c.userId === resolvedId) {
          return { ...c, unreadCount: Math.max(0, c.unreadCount - 1) };
        }
        return c;
      });

      // CRITICAL FIX: Push updated message reference to conversationIndex so UI re-renders
      const newIndex = new Map(state.conversationIndex);
      if (updatedMessageRef) {
        const otherUserId = getOtherUserIdForMessage(updatedMessageRef as Message, selfIds);
        if (otherUserId && newIndex.has(otherUserId)) {
          newIndex.set(
            otherUserId,
            newIndex.get(otherUserId)!.map(m => m.id === messageId ? (updatedMessageRef as Message) : m)
          );
        }
      }

      return { messages: updatedMessages, conversations: updatedConversations, conversationIndex: newIndex };
    });

    // ELITE: Save to AsyncStorage
    const { messages, conversations } = get();
    await saveMessages(messages);
    saveConversations(conversations);

    // CRITICAL FIX: Sync "read" status to Firestore (Blue Double-tick ✓✓🔵)
    // Skip synthetic pair_ conversationIds — they're not valid Firestore paths
    // FIX: Retry with backoff — fire-and-forget .catch() silently loses receipts on network blips
    if (wasUnread && targetConversationId && !targetConversationId.startsWith('pair_')) {
      const svc = getFirebaseDataService();
      if (svc?.markMessageAsRead) {
        retryWithBackoffSafe(
          () => svc.markMessageAsRead!(targetConversationId!, messageId).then(() => undefined),
          // FIX: 4 retries (~30s) too low for mobile networks with 30s+ blips.
          // 8 retries with 30s cap gives ~2 minutes coverage for read receipts.
          { maxRetries: 8, baseDelayMs: 2000, maxDelayMs: 30000 },
        ).catch(err => {
          logger.warn('Failed to sync read status to Firestore after retries', err);
        });
      }
    }
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

    set((state) => {
      const updatedMessages = state.messages.map((m) =>
        isIdentityInAliasSet(m.from, aliasIds) && !m.read && m.status !== 'failed'
          ? { ...m, read: true, status: 'read' as const }
          : m,
      );

      const newIndex = new Map(state.conversationIndex);
      const keysToUpdate = Array.from(aliasIds);

      for (const key of keysToUpdate) {
        if (newIndex.has(key)) {
          newIndex.set(
            key,
            newIndex.get(key)!.map(m =>
              isIdentityInAliasSet(m.from, aliasIds) && !m.read && m.status !== 'failed'
                ? { ...m, read: true, status: 'read' as const }
                : m
            )
          );
        }
      }

      return {
        messages: updatedMessages,
        conversationIndex: newIndex
      };
    });
    get().updateConversations();

    // Save to AsyncStorage (local persistence)
    const { messages } = get();
    await saveMessages(messages);

    // CRITICAL FIX: Sync read receipts per conversation.
    // A single peer can have legacy duplicate conversationIds in production data.
    // Syncing only the latest unread message can leave other conversation threads unread.
    if (unreadMessages.length > 0) {
      const latestByConversation = new Map<string, Message>();
      unreadMessages.forEach((msg) => {
        const key = msg.conversationId
          ? `conv:${msg.conversationId}`
          : `sender:${normalizeId(msg.from)}`;
        const existing = latestByConversation.get(key);
        if (!existing || msg.timestamp > existing.timestamp) {
          latestByConversation.set(key, msg);
        }
      });

      await Promise.all(
        Array.from(latestByConversation.values()).map((msg) =>
          get().syncReadReceipt(msg.id, msg.from, msg.conversationId).catch(e => { if (__DEV__) logger.debug('Read receipt sync failed:', e); }),
        ),
      );
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
        .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
    }

    const selfIds = getSelfIdentityCandidates();
    return get().messages
      .filter((message) => !isSystemConversationMessage(message))
      .filter((message) => !(message.to?.startsWith('grp_') || message.conversationId?.startsWith('grp_')))
      .filter((message) => {
        if (isSelfId(message.from, selfIds)) {
          return isIdentityInAliasSet(message.to, aliasIds);
        }
        return isIdentityInAliasSet(message.from, aliasIds);
      })
      .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
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
    const settingsState = require('./settingsStore').useSettingsStore.getState();
    const blockedUsers = Array.isArray(settingsState?.blockedUsers) ? settingsState.blockedUsers : [];
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
    // Preserve existing conversationId so pairKey lookups are not repeated
    const conversationIdMap = new Map<string, string>();
    existingConversations.forEach(c => {
      const metadataKey = resolveCanonicalPeerId(c.userId) || normalizeId(c.userId);
      if (!metadataKey) return;
      const existingMeta = metadataMap.get(metadataKey);
      metadataMap.set(metadataKey, {
        isPinned: (existingMeta?.isPinned ?? false) || (c.isPinned ?? false),
        isMuted: (existingMeta?.isMuted ?? false) || (c.isMuted ?? false),
        userName: existingMeta?.userName || c.userName,
      });
      // Keep the first non-null conversationId found for each user
      if (c.conversationId && !conversationIdMap.has(metadataKey)) {
        conversationIdMap.set(metadataKey, c.conversationId);
      }
    });

    // O(n) single-pass: compute unread counts and latest message per user
    const unreadCounts = new Map<string, number>();
    const latestMessages = new Map<string, { content: string; timestamp: number; fromName?: string; from: string; status?: Message['status'] }>();

    for (const msg of messages) {
      if (isBlockedIdentity(msg.from) || isBlockedIdentity(msg.to)) continue;
      if (isSystemConversationMessage(msg)) continue;

      // CRITICAL FIX: Prevent Family Group messages from splitting into DM conversations
      if (msg.to?.startsWith('grp_') || msg.conversationId?.startsWith('grp_')) continue;

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
          from: msg.from,
          status: msg.status,
        });
      }
    }

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
        lastMessageFrom: latest.from,
        lastMessageStatus: latest.status,
        conversationId: conversationIdMap.get(userId),
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
      // PERF Y1: Rebuild dedup Set after filtering to stay in sync
      _messageIdSet = new Set(updatedMessages.map(m => m.id));
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

    // CRITICAL FIX: Cancel all pending debounced timers BEFORE clearing state.
    // Without this, a pending _conversationUpdateTimer fires after clear() and
    // calls updateConversations() on the now-empty messages array, or a pending
    // _saveMessagesTimer writes stale data back to MMKV.
    if (_conversationUpdateTimer) {
      clearTimeout(_conversationUpdateTimer);
      _conversationUpdateTimer = null;
    }
    if (_saveMessagesTimer) {
      clearTimeout(_saveMessagesTimer);
      _saveMessagesTimer = null;
      _pendingSaveMessages = null;
    }
    if (_saveConversationsTimer) {
      clearTimeout(_saveConversationsTimer);
      _saveConversationsTimer = null;
      _pendingSaveConversations = null;
    }
    // Clear typing indicator timers
    for (const [, timer] of _typingTimers) {
      clearTimeout(timer);
    }
    _typingTimers.clear();

    // PERF Y1: Clear dedup Set on store clear
    _messageIdSet = new Set();
    set({ ...initialState, firebaseUnsubscribe: null });
    saveMessages([]);
    saveConversations([]);
    DirectStorage.delete(getScopedStorageKey(STORAGE_KEY_MESSAGES_BASE));
    DirectStorage.delete(getScopedStorageKey(STORAGE_KEY_CONVERSATIONS_BASE));
    // Cleanup legacy unscoped keys to prevent cross-account bleed
    DirectStorage.delete(STORAGE_KEY_MESSAGES_BASE);
    DirectStorage.delete(STORAGE_KEY_CONVERSATIONS_BASE);
  },

  // ELITE: Update message status — uses shared delivery state machine guard
  updateMessageStatus: async (messageId: string, status: Message['status']) => {
    // Import shared state machine guard — single source of truth for status transitions
    const { isStatusTransitionAllowed } = require('../services/messaging/constants');
    set((state) => {
      let updatedMessageRef: Message | null = null;
      const updatedMessages = state.messages.map(m => {
        if (m.id === messageId) {
          // Enforce delivery state machine: only allowed transitions proceed
          if (!isStatusTransitionAllowed(m.status, status || 'pending')) {
            return m; // Block illegal transition
          }
          const now = Date.now();
          const isDelivered = status === 'delivered' || status === 'read';
          const isRead = status === 'read';
          updatedMessageRef = {
            ...m,
            status,
            // FIX: Preserve delivered/read booleans when downgrading to pending (retry)
            delivered: isDelivered ? true : (status === 'pending' ? m.delivered : false),
            read: isRead ? true : m.read,
            deliveredAt: isDelivered ? (m.deliveredAt || now) : m.deliveredAt,
            readAt: isRead ? (m.readAt || now) : m.readAt,
          };
          return updatedMessageRef;
        }
        return m;
      });

      const newIndex = new Map(state.conversationIndex);
      if (updatedMessageRef) {
        const selfIds = getSelfIdentityCandidates();
        const otherUserId = getOtherUserIdForMessage(updatedMessageRef as Message, selfIds);
        if (otherUserId && newIndex.has(otherUserId)) {
          newIndex.set(
            otherUserId,
            newIndex.get(otherUserId)!.map(m => m.id === messageId ? (updatedMessageRef as Message) : m)
          );
        }
      }

      return {
        messages: updatedMessages,
        conversationIndex: newIndex
      };
    });
    const { messages } = get();
    saveMessages(messages);
    // CRITICAL FIX: Update conversation list so MessagesScreen shows fresh status.
    // Without this, processQueue 'sent' status change never propagates to the
    // conversation list — users see stale "Gönderiliyor..." in MessagesScreen.
    get().updateConversations();
  },



  // ELITE: Set typing indicator
  setTyping: (conversationId: string, userId: string, userName?: string) => {
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: { userId, userName, conversationId, timestamp: Date.now() },
      },
    }));

    // PERF: Clear old timer for this conversation before creating new one
    const existingTimer = _typingTimers.get(conversationId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      _typingTimers.delete(conversationId);
      get().clearTyping(conversationId);
    }, 5000);
    _typingTimers.set(conversationId, timer);
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

    set((state) => {
      let updatedMessageRef: Message | null = null;
      const updatedMessages = state.messages.map(m => {
        if (m.id === messageId) {
          updatedMessageRef = {
            ...m,
            content: newContent,
            isEdited: true,
            editedAt: now,
            originalContent: m.originalContent || m.content,
            editHistory: [...(m.editHistory || []).slice(-4), editEntry],
          };
          return updatedMessageRef;
        }
        return m;
      });

      const newIndex = new Map(state.conversationIndex);
      if (updatedMessageRef) {
        const selfIds = getSelfIdentityCandidates();
        const otherUserId = getOtherUserIdForMessage(updatedMessageRef as Message, selfIds);
        if (otherUserId && newIndex.has(otherUserId)) {
          newIndex.set(
            otherUserId,
            newIndex.get(otherUserId)!.map(m => m.id === messageId ? (updatedMessageRef as Message) : m)
          );
        }
      }

      return {
        messages: updatedMessages,
        conversationIndex: newIndex
      };
    });

    saveMessages(get().messages);
    get().updateConversations();

    // FIX: Sync edit to Firestore using correct conversation path
    // CRITICAL FIX: Skip synthetic pair_ conversationIds — they're not valid Firestore paths
    if (message.conversationId && !message.conversationId.startsWith('pair_')) {
      try {
        const { updateMessageContent } = await import('../services/firebase/FirebaseMessageOperations');
        await updateMessageContent(message.conversationId, messageId, newContent);
      } catch (fbError) {
        logger.warn('Firebase edit sync failed:', fbError);
      }
    } else {
      logger.debug('editMessage: no valid conversationId, skipping Firebase sync');
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

    set((state) => {
      let updatedMessageRef: Message | null = null;
      const updatedMessages = state.messages.map(m => {
        if (m.id === messageId) {
          updatedMessageRef = {
            ...m,
            isDeleted: true,
            deletedAt: now,
            content: 'Bu mesaj silindi',
          };
          return updatedMessageRef;
        }
        return m;
      });

      const newIndex = new Map(state.conversationIndex);
      if (updatedMessageRef) {
        const selfIds = getSelfIdentityCandidates();
        const otherUserId = getOtherUserIdForMessage(updatedMessageRef as Message, selfIds);
        if (otherUserId && newIndex.has(otherUserId)) {
          newIndex.set(
            otherUserId,
            newIndex.get(otherUserId)!.map(m => m.id === messageId ? (updatedMessageRef as Message) : m)
          );
        }
      }

      return {
        messages: updatedMessages,
        conversationIndex: newIndex
      };
    });

    saveMessages(get().messages);
    get().updateConversations();

    // FIX: Sync deletion to Firestore using correct conversation path
    // CRITICAL FIX: Skip synthetic pair_ conversationIds — they're not valid Firestore paths
    if (message.conversationId && !message.conversationId.startsWith('pair_')) {
      try {
        const { deleteMessageForEveryone } = await import('../services/firebase/FirebaseMessageOperations');
        await deleteMessageForEveryone(message.conversationId, messageId);
      } catch (fbError) {
        logger.warn('Firebase delete sync failed:', fbError);
      }
    } else {
      logger.debug('deleteMessage: no valid conversationId, skipping Firebase sync');
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

    // CRITICAL FIX: Do NOT call addMessage() before sendMessage().
    // sendMessage() generates its own message ID and calls pushCloudMessageToMeshStore()
    // which adds the message to BOTH MeshStore and messageStore. The previous code called
    // addMessage() with a fwd-... ID, then sendMessage() created a SECOND message with a
    // different ID — resulting in TWO visible messages in the conversation UI.
    // Let sendMessage() handle everything and return its message as a Message type.
    try {
      const { hybridMessageService } = await import('../services/HybridMessageService');
      const sentMsg = await hybridMessageService.sendMessage(originalMessage.content, canonicalRecipient, {
        type: originalMessage.type || 'CHAT',
      });

      logger.info(`Forwarded message ${messageId} to ${canonicalRecipient} (new id: ${sentMsg.id})`);

      // Return a Message-shaped object from the HybridMessage
      const forwardedMessage: Message = {
        id: sentMsg.id,
        localId: sentMsg.localId,
        from: 'me',
        to: canonicalRecipient,
        content: originalMessage.content,
        timestamp: sentMsg.timestamp,
        delivered: false,
        read: false,
        type: originalMessage.type || 'CHAT',
        status: sentMsg.status || 'pending',
      };
      return forwardedMessage;
    } catch (e) {
      logger.error('Forward send failed:', e);
      return null;
    }
  },

  // ELITE: Get single message by ID
  getMessage: (messageId: string) => {
    return get().messages.find(m => m.id === messageId);
  },

  // ELITE V2: Sync read receipt to Firebase (WhatsApp 3-tick pattern)
  // When recipient reads a message → update readBy field on the actual message doc
  syncReadReceipt: async (_messageId: string, senderId: string, conversationIdHint?: string) => {
    try {
      const { identityService } = require('../services/IdentityService');
      const myUid = identityService.getUid();
      if (!myUid || myUid === 'unknown') return;

      // FIX: Use V3 conversation model — mark the exact conversation as read when known.
      // Fallback to findOrCreate only if conversationId is unavailable.
      const { findOrCreateDMConversation, markConversationRead: markConvRead } = require('../services/firebase/FirebaseMessageOperations');
      const hintedConversationId = typeof conversationIdHint === 'string' ? conversationIdHint.trim() : '';
      const localMessageConversationId = get().messages.find((message) => message.id === _messageId)?.conversationId;

      let conversationId = hintedConversationId
        || (typeof localMessageConversationId === 'string' ? localMessageConversationId.trim() : '');

      // Synthetic pair ids are local-only routing helpers, not Firestore document IDs.
      if (conversationId.startsWith('pair_')) {
        conversationId = '';
      }

      if (!conversationId) {
        const conversation = await findOrCreateDMConversation(myUid, senderId);
        conversationId = conversation?.id || '';
      }

      if (!conversationId) {
        logger.warn(`syncReadReceipt: unable to resolve conversationId for message ${_messageId}`);
        return;
      }

      await markConvRead(myUid, conversationId);

      // Also update the readBy field on recent messages in the conversation
      try {
        const { getFirestoreInstanceAsync } = require('../services/firebase/FirebaseInstanceManager');
        const { doc, updateDoc, serverTimestamp } = require('firebase/firestore');
        const db = await getFirestoreInstanceAsync();
        if (db) {
          // FIX: Use serverTimestamp() instead of Date.now() — client clocks can be
          // skewed by minutes/hours on mobile, corrupting read receipt timing data.
          await updateDoc(
            doc(db, 'conversations', conversationId, 'messages', _messageId),
            { [`readBy.${myUid}`]: serverTimestamp() }
          ).catch(e => { if (__DEV__) logger.debug('readBy update failed (msg may not exist):', e); });
        }
      } catch {
        // readBy update is best-effort
      }

      logger.debug(`Read receipt synced for conversation ${conversationId} with ${senderId}`);
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

// PERF Y1: Keep _messageIdSet in sync when messages are externally set (e.g. tests, setState)
useMessageStore.subscribe((state, prevState) => {
  if (state.messages !== prevState.messages && state.messages.length === 0 && prevState.messages.length > 0) {
    _messageIdSet = new Set();
  }
});
