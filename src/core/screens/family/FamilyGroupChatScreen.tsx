/**
 * FAMILY GROUP CHAT SCREEN - Elite Design
 * Production-grade group messaging with comprehensive error handling
 * Zero-error guarantee with full type safety
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyStore } from '../../stores/familyStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { useMeshStore } from '../../services/mesh/MeshStore';
import { meshNetworkService } from '../../services/mesh/MeshNetworkService';
import { MeshMessageType } from '../../services/mesh/MeshProtocol';
import { meshMediaService } from '../../services/mesh/MeshMediaService';
import { identityService } from '../../services/IdentityService';
import { colors } from '../../theme';
import { styles } from './FamilyGroupChatScreen.styles';
import * as haptics from '../../utils/haptics';
import { getDeviceId } from '../../../lib/device';
import { createLogger } from '../../utils/logger';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { voiceMessageService } from '../../services/VoiceMessageService';
import { AttachmentsModal } from '../../components/messages/AttachmentsModal';
import { VoiceRecorderUI } from '../../components/messages/VoiceRecorderUI';
import { groupChatService, type GroupConversation } from '../../services/GroupChatService';
import { contactService } from '../../services/ContactService';
import { getAuth } from 'firebase/auth';

const logger = createLogger('FamilyGroupChatScreen');

const MAX_VOICE_DURATION = 60;

// ELITE: Family group conversation ID — stable per-family group
const FAMILY_GROUP_PREFIX = 'family_group_';
const UID_REGEX = /^[A-Za-z0-9]{20,40}$/;
const trimIdentity = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '');

const resolveFamilyMemberUid = (member: { uid?: string; deviceId?: string }): string => {
  const candidates = [member.uid, member.deviceId]
    .map(trimIdentity)
    .filter((value) => value.length > 0);

  const directUid = candidates.find((value) => UID_REGEX.test(value));
  if (directUid) {
    return directUid;
  }

  for (const candidate of candidates) {
    const resolved = trimIdentity(contactService.resolveCloudUid(candidate));
    if (UID_REGEX.test(resolved)) {
      return resolved;
    }
  }

  return '';
};

const getCurrentAuthUserSafe = () => {
  try {
    const user = getAuth().currentUser;
    if (user) return user;
    // CRITICAL FIX: getAuth().currentUser can be null during cold start / token refresh.
    // Return a minimal user-like object from identityService MMKV cache so group chat
    // doesn't silently fail when auth state is transiently unavailable.
    const cachedUid = identityService.getUid?.();
    if (cachedUid) {
      const identity = identityService.getIdentity?.();
      return {
        uid: cachedUid,
        displayName: identity?.displayName || null,
        email: null,
        photoURL: null,
      } as unknown as ReturnType<typeof getAuth>['currentUser'];
    }
    return null;
  } catch {
    return null;
  }
};

// CRITICAL FIX: Shared family group channel for ALL family members.
// Previously used per-user channel (family-group-{userId}) which caused
// receivers to reject ALL incoming messages — channel names never matched.
// Security is handled by alias-aware sender validation in isAllowedGroupMessageWithAliases().
const FAMILY_GROUP_CHANNEL = 'family-group';

interface GroupMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  readBy: string[];
  // ELITE: Media support
  mediaType?: 'image' | 'voice' | 'location';
  mediaUrl?: string;
  mediaDuration?: number;
  location?: { lat: number; lng: number; address?: string };
}

// ELITE: Type-safe navigation props
interface FamilyGroupChatScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
  route?: {
    params?: {
      groupId?: string;
    };
  };
}

export default function FamilyGroupChatScreen({ navigation, route }: FamilyGroupChatScreenProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [myDeviceId, setMyDeviceId] = useState('');
  const preferredGroupId = trimIdentity(route?.params?.groupId);
  const flatListRef = useRef<FlatList>(null);
  const activeGroupIdRef = useRef<string | null>(null);
  const creatingGroupPromiseRef = useRef<Promise<string | null> | null>(null);
  const hasGroupSnapshotRef = useRef(false);
  // ELITE: Media messaging state
  const [attachmentsModalVisible, setAttachmentsModalVisible] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const voiceRecordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const handleVoiceRecordSendRef = useRef<() => void>(() => {});

  // ELITE: InViewPort auto-read — mark group messages read when scrolled into view
  const selfIdsRef = useRef<Set<string>>(new Set());
  const firestoreGroupIdRef = useRef<string | null>(null);
  const groupViewabilityConfig = useRef({ itemVisiblePercentThreshold: 50, minimumViewTime: 300 }).current;
  const onGroupViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: GroupMessage; isViewable: boolean }> }) => {
    const currentSelfIds = selfIdsRef.current;
    const gId = firestoreGroupIdRef.current;
    if (!gId) return;
    const unread = viewableItems
      .filter(({ item, isViewable }) => isViewable && !currentSelfIds.has(item.senderId) && !item.readBy.some(id => currentSelfIds.has(id)))
      .map(({ item }) => item.id);
    if (unread.length > 0) {
      groupChatService.markAllRead(gId, unread).catch(() => {});
    }
  }).current;

  const [firestoreGroupId, setFirestoreGroupId] = useState<string | null>(null);
  const [firestoreMessages, setFirestoreMessages] = useState<GroupMessage[]>([]);
  const { members } = useFamilyStore();
  const meshMessages = useMeshStore((state) => state.messages);
  const selfIds = useMemo(() => {
    const ids = new Set<string>(['ME', 'me']);
    if (myDeviceId) {
      ids.add(myDeviceId);
    }
    // V3: Add UID as primary self-ID
    const uid = identityService.getUid();
    if (uid) {
      ids.add(uid);
    }
    const identityId = identityService.getMyId();
    if (identityId) {
      ids.add(identityId);
    }
    const meshId = bleMeshService.getMyDeviceId();
    if (meshId) {
      ids.add(meshId);
    }
    selfIdsRef.current = ids;
    return ids;
  }, [myDeviceId]);

  const allowedSenderIds = useMemo(() => {
    const ids = new Set<string>(selfIds);
    const addAlias = (value?: string | null) => {
      const normalized = typeof value === 'string' ? value.trim() : '';
      if (!normalized) return;
      ids.add(normalized);

      if (UID_REGEX.test(normalized)) return;
      const resolvedUid = contactService.resolveCloudUid?.(normalized);
      if (resolvedUid && UID_REGEX.test(resolvedUid)) {
        ids.add(resolvedUid);
      }
    };

    members.forEach((member) => {
      addAlias(member.uid);
      addAlias(member.deviceId);
    });

    return ids;
  }, [members, selfIds]);

  const isSelfFamilyMember = useCallback((member: { uid?: string; deviceId?: string }): boolean => {
    const candidates = [member.uid, member.deviceId]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);

    return candidates.some((value) => selfIds.has(value));
  }, [selfIds]);

  type FamilyGroupParticipantModel = {
    myUid: string;
    memberUids: string[];
    memberNames: Record<string, string>;
    memberDeviceIds: Record<string, string>;
    peerCount: number;
    unresolvedPeerCount: number;
  };

  const buildParticipantModel = useCallback((): FamilyGroupParticipantModel | null => {
    const user = getCurrentAuthUserSafe();
    if (!user) return null;

    const identity = identityService.getIdentity();
    const memberUids = new Set<string>();
    const memberNames: Record<string, string> = {
      [user.uid]: user.displayName || identity?.displayName || 'Ben',
    };
    const memberDeviceIds: Record<string, string> = {
      [user.uid]: identityService.getMeshDeviceId() || myDeviceId || identityService.getMyId() || user.uid,
    };

    let peerCount = 0;
    let unresolvedPeerCount = 0;

    members.forEach((member) => {
      const rawUid = typeof member.uid === 'string' ? member.uid.trim() : '';
      const rawDeviceId = typeof member.deviceId === 'string' ? member.deviceId.trim() : '';

      if (
        rawUid === user.uid ||
        rawDeviceId === user.uid ||
        isSelfFamilyMember(member)
      ) {
        return;
      }

      peerCount += 1;
      const resolvedUid = resolveFamilyMemberUid(member);

      if (!resolvedUid) {
        unresolvedPeerCount += 1;
        return;
      }

      memberUids.add(resolvedUid);
      memberNames[resolvedUid] = member.name || rawUid || resolvedUid;
      memberDeviceIds[resolvedUid] = rawDeviceId || rawUid || resolvedUid;
    });

    return {
      myUid: user.uid,
      memberUids: Array.from(memberUids),
      memberNames,
      memberDeviceIds,
      peerCount,
      unresolvedPeerCount,
    };
  }, [isSelfFamilyMember, members, myDeviceId]);

  const selectBestFamilyGroup = useCallback((
    groups: GroupConversation[],
    requiredParticipants: Set<string>,
    myUid: string,
  ): GroupConversation | null => {
    const required = Array.from(requiredParticipants);
    const candidates = groups.filter((group) => {
      if (group.type !== 'group') return false;
      if (group.name !== 'Ailem' && !group.id.startsWith(FAMILY_GROUP_PREFIX)) return false;
      return Array.isArray(group.participants) && group.participants.includes(myUid);
    });

    if (candidates.length === 0) {
      return null;
    }

    const ranked = candidates
      .map((group) => {
        const participantSet = new Set(group.participants);
        const missingRequired = required.filter((uid) => !participantSet.has(uid)).length;
        const overlap = required.length - missingRequired;
        const extraParticipants = Math.max(0, participantSet.size - overlap);
        const createdAt = Number.isFinite(group.createdAt) ? group.createdAt : Number.MAX_SAFE_INTEGER;

        return { group, missingRequired, overlap, extraParticipants, createdAt };
      })
      .sort((a, b) => {
        if (a.missingRequired !== b.missingRequired) {
          return a.missingRequired - b.missingRequired;
        }
        if (a.overlap !== b.overlap) {
          return b.overlap - a.overlap;
        }
        if (a.extraParticipants !== b.extraParticipants) {
          return a.extraParticipants - b.extraParticipants;
        }
        if (a.createdAt !== b.createdAt) {
          return a.createdAt - b.createdAt;
        }
        return a.group.id.localeCompare(b.group.id);
      });

    return ranked[0]?.group ?? null;
  }, []);

  const isAllowedGroupMessageWithAliases = useCallback((
    senderId?: string,
    recipientId?: string,
    senderAliases: Array<string | undefined> = [],
    payloadGroupId?: string,
  ) => {
    const normalizedAliases = Array.from(
      new Set(
        [senderId, ...senderAliases]
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0),
      ),
    );
    if (normalizedAliases.length === 0) {
      return false;
    }

    if (normalizedAliases.some((value) => selfIds.has(value))) {
      return true;
    }

    const isKnownFamilyAlias = normalizedAliases.some((value) => allowedSenderIds.has(value));
    if (!isKnownFamilyAlias) {
      // Allow mesh packets that explicitly target the active cloud group from known participants.
      if (payloadGroupId && firestoreGroupId && payloadGroupId === firestoreGroupId) {
        const activeGroup = groupChatService.getGroup(firestoreGroupId);
        const participantSet = new Set(activeGroup?.participants || []);
        const hasParticipantAlias = normalizedAliases.some((value) => participantSet.has(value));
        if (!hasParticipantAlias) {
          return false;
        }
      } else {
        return false;
      }
    }

    if (recipientId && recipientId !== 'broadcast' && recipientId !== 'ME') {
      if (recipientId.startsWith('group:')) {
        if (!firestoreGroupId) return true;
        return recipientId === `group:${firestoreGroupId}`;
      }
      return selfIds.has(recipientId);
    }

    return true;
  }, [allowedSenderIds, firestoreGroupId, selfIds]);

  const parseGroupPayload = useCallback((
    content: string,
  ): {
    text: string;
    senderName?: string;
    senderUid?: string;
    senderPublicCode?: string;
    senderDeviceId?: string;
    groupId?: string;
    mediaType?: GroupMessage['mediaType'];
    mediaUrl?: string;
    mediaDuration?: number;
    location?: GroupMessage['location'];
  } | null => {
    const normalizeMediaType = (value: unknown): GroupMessage['mediaType'] | undefined => {
      if (value === 'image' || value === 'voice' || value === 'location') {
        return value;
      }
      if (typeof value !== 'string') return undefined;
      const lowered = value.toLowerCase();
      if (lowered === 'image' || lowered === 'voice' || lowered === 'location') {
        return lowered as GroupMessage['mediaType'];
      }
      return undefined;
    };

    const normalizeLocation = (value: unknown): GroupMessage['location'] | undefined => {
      if (!value || typeof value !== 'object') return undefined;
      const location = value as Record<string, unknown>;
      const lat = typeof location.lat === 'number' ? location.lat : undefined;
      const lng = typeof location.lng === 'number' ? location.lng : undefined;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

      const normalized: GroupMessage['location'] = { lat, lng };
      if (typeof location.address === 'string' && location.address.trim().length > 0) {
        normalized.address = location.address.trim();
      }
      return normalized;
    };

    const resolvePayloadMediaType = (parsed: Record<string, unknown>): GroupMessage['mediaType'] | undefined => {
      const direct = normalizeMediaType(parsed.mediaType);
      if (direct) return direct;
      if (typeof parsed.type !== 'string') return undefined;
      switch (parsed.type.toUpperCase()) {
        case 'IMAGE':
          return 'image';
        case 'VOICE':
          return 'voice';
        case 'LOCATION':
          return 'location';
        default:
          return undefined;
      }
    };

    try {
      const parsed = JSON.parse(content);
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.channel === 'string' && parsed.channel.startsWith('family-group') &&
        typeof parsed.text === 'string'
      ) {
        const parsedRecord = parsed as Record<string, unknown>;
        return {
          text: parsed.text,
          senderName: typeof parsed.senderName === 'string' ? parsed.senderName : undefined,
          senderUid:
            trimIdentity(
              typeof parsed.senderUid === 'string'
                ? parsed.senderUid
                : typeof parsed.uid === 'string'
                  ? parsed.uid
                  : '',
            ) || undefined,
          senderPublicCode:
            trimIdentity(
              typeof parsed.senderPublicCode === 'string'
                ? parsed.senderPublicCode
                : typeof parsed.senderCode === 'string'
                  ? parsed.senderCode
                  : typeof parsed.code === 'string'
                    ? parsed.code
                    : '',
            ) || undefined,
          senderDeviceId:
            trimIdentity(
              typeof parsed.fromDeviceId === 'string'
                ? parsed.fromDeviceId
                : typeof parsed.did === 'string'
                  ? parsed.did
                  : typeof parsed.from === 'string'
                    ? parsed.from
                    : '',
            ) || undefined,
          groupId: trimIdentity(typeof parsed.groupId === 'string' ? parsed.groupId : '') || undefined,
          mediaType: resolvePayloadMediaType(parsedRecord),
          mediaUrl: typeof parsed.mediaUrl === 'string' ? parsed.mediaUrl : undefined,
          mediaDuration: typeof parsed.mediaDuration === 'number' ? parsed.mediaDuration : undefined,
          location: normalizeLocation(parsed.location),
        };
      }

      // GroupChatService mesh payload compatibility:
      // { groupId, content, senderName, to: "group:<id>" }
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.groupId === 'string' &&
        typeof parsed.content === 'string'
      ) {
        if (firestoreGroupId && parsed.groupId !== firestoreGroupId) {
          return null;
        }
        const parsedRecord = parsed as Record<string, unknown>;
        return {
          text: parsed.content,
          senderName: typeof parsed.senderName === 'string' ? parsed.senderName : undefined,
          senderUid:
            trimIdentity(
              typeof parsed.senderUid === 'string'
                ? parsed.senderUid
                : typeof parsed.uid === 'string'
                  ? parsed.uid
                  : '',
            ) || undefined,
          senderPublicCode:
            trimIdentity(
              typeof parsed.senderPublicCode === 'string'
                ? parsed.senderPublicCode
                : typeof parsed.senderCode === 'string'
                  ? parsed.senderCode
                  : typeof parsed.code === 'string'
                    ? parsed.code
                    : '',
            ) || undefined,
          senderDeviceId:
            trimIdentity(
              typeof parsed.fromDeviceId === 'string'
                ? parsed.fromDeviceId
                : typeof parsed.did === 'string'
                  ? parsed.did
                  : typeof parsed.from === 'string'
                    ? parsed.from
                    : '',
            ) || undefined,
          groupId: trimIdentity(typeof parsed.groupId === 'string' ? parsed.groupId : '') || undefined,
          mediaType: resolvePayloadMediaType(parsedRecord),
          mediaUrl: typeof parsed.mediaUrl === 'string' ? parsed.mediaUrl : undefined,
          mediaDuration: typeof parsed.mediaDuration === 'number' ? parsed.mediaDuration : undefined,
          location: normalizeLocation(parsed.location),
        };
      }
    } catch {
      // Not a family-group payload
    }
    return null;
  }, [firestoreGroupId]);

  const appendLocalGroupMessage = useCallback((message: GroupMessage) => {
    setMessages((prev) => {
      const merged = new Map<string, GroupMessage>();
      prev.forEach((entry) => merged.set(entry.id, entry));
      merged.set(message.id, message);
      return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
    });
  }, []);

  const ensureActiveGroupId = useCallback(async (): Promise<string | null> => {
    if (creatingGroupPromiseRef.current) {
      return creatingGroupPromiseRef.current;
    }

    const resolveOrCreatePromise = (async (): Promise<string | null> => {
      try {
        const participantModel = buildParticipantModel();
        if (!participantModel) {
          return null;
        }

        groupChatService.initialize();

        const requiredParticipants = new Set<string>([
          participantModel.myUid,
          ...participantModel.memberUids,
        ]);
        const existingGroup = selectBestFamilyGroup(
          groupChatService.getGroups(),
          requiredParticipants,
          participantModel.myUid,
        );

        if (existingGroup) {
          const missingParticipants = participantModel.memberUids.filter(
            (uid) => !existingGroup.participants.includes(uid),
          );

          if (missingParticipants.length > 0) {
            await Promise.allSettled(
              missingParticipants.map((uid) =>
                groupChatService.addMemberToGroup(
                  existingGroup.id,
                  uid,
                  participantModel.memberNames[uid] || uid,
                  participantModel.memberDeviceIds[uid] || uid,
                )
              ),
            );
          }

          if (activeGroupIdRef.current !== existingGroup.id) {
            logger.info(`Family group converged to: ${existingGroup.id}`);
          }
          activeGroupIdRef.current = existingGroup.id;
          setFirestoreGroupId(existingGroup.id);
          return existingGroup.id;
        }

        if (hasGroupSnapshotRef.current && activeGroupIdRef.current) {
          const activeVisible = groupChatService
            .getGroups()
            .some((group) => group.id === activeGroupIdRef.current);
          if (!activeVisible) {
            logger.warn(`Active family group became stale: ${activeGroupIdRef.current}`);
            activeGroupIdRef.current = null;
            setFirestoreGroupId(null);
          }
        }

        if (activeGroupIdRef.current && !hasGroupSnapshotRef.current) {
          return activeGroupIdRef.current;
        }

        // Wait for first live snapshot before creating a new cloud group.
        // This prevents duplicate parallel group creation when groups are still loading.
        if (!hasGroupSnapshotRef.current) {
          logger.info('Cloud group creation deferred: waiting for first group snapshot');
          return null;
        }

        // Do not create self-only cloud groups when family peers exist but do not have UIDs yet.
        // In that state, mesh fallback remains the authoritative channel.
        if (participantModel.memberUids.length === 0) {
          if (participantModel.peerCount > 0) {
            logger.warn(
              `Cloud family group skipped: ${participantModel.unresolvedPeerCount}/${participantModel.peerCount} peer(s) missing UID; fallback mesh mode active.`,
            );
          }
          return null;
        }

        const newGroupId = await groupChatService.createGroup(
          'Ailem',
          participantModel.memberUids,
          participantModel.memberNames,
          participantModel.memberDeviceIds,
        );
        if (newGroupId) {
          activeGroupIdRef.current = newGroupId;
          setFirestoreGroupId(newGroupId);
          logger.info(`✅ On-demand family group created: ${newGroupId}`);
          return newGroupId;
        }
      } catch (createErr) {
        logger.warn('On-demand group creation failed:', createErr);
      }

      return activeGroupIdRef.current;
    })();

    creatingGroupPromiseRef.current = resolveOrCreatePromise;
    try {
      return await resolveOrCreatePromise;
    } finally {
      creatingGroupPromiseRef.current = null;
    }
  }, [buildParticipantModel, selectBestFamilyGroup]);

  // ELITE: Find or create Firestore group for this family
  useEffect(() => {
    groupChatService.initialize();

    const unsubscribeGroups = groupChatService.onGroupsChanged(() => {
      hasGroupSnapshotRef.current = true;
      ensureActiveGroupId().catch((error) => {
        logger.warn('Family group sync from group snapshot failed:', error);
      });
    });

    const setupFirestoreGroup = async () => {
      try {
        await ensureActiveGroupId();
      } catch (error) {
        logger.warn('Firestore group setup failed (non-critical):', error);
      }
    };

    setupFirestoreGroup();

    return () => {
      unsubscribeGroups();
    };
  }, [ensureActiveGroupId]);

  useEffect(() => {
    if (!preferredGroupId) return;

    activeGroupIdRef.current = preferredGroupId;
    setFirestoreGroupId((previous) => (
      previous === preferredGroupId ? previous : preferredGroupId
    ));
  }, [preferredGroupId]);

  useEffect(() => {
    activeGroupIdRef.current = firestoreGroupId;
    firestoreGroupIdRef.current = firestoreGroupId;
  }, [firestoreGroupId]);

  // ELITE: Subscribe to Firestore group messages when group is ready
  useEffect(() => {
    if (!firestoreGroupId) return;

    const unsub = groupChatService.subscribeToMessages(firestoreGroupId, (msgs) => {
      const user = getCurrentAuthUserSafe();
      const myUid = user?.uid || '';

      const normalized: GroupMessage[] = msgs
        .filter((m) => m.type !== 'SYSTEM')
        .map((m) => ({
          id: m.id,
          senderId: m.from,
          senderName: m.fromName || m.from,
          content: m.content,
          timestamp: m.timestamp,
          status: m.readBy && Object.keys(m.readBy).length > 1 ? 'read' as const : 'sent' as const,
          readBy: Object.keys(m.readBy || {}),
          ...(m.mediaType ? { mediaType: m.mediaType } : {}),
          ...(m.mediaUrl ? { mediaUrl: m.mediaUrl } : {}),
          ...(typeof m.mediaDuration === 'number' ? { mediaDuration: m.mediaDuration } : {}),
          ...(m.location ? { location: m.location } : {}),
        }));

      setFirestoreMessages(normalized);
      // Read receipts are handled by onGroupViewableItemsChanged (InViewPort),
      // so we do NOT auto-mark all messages as read here on mount/subscription fire.
    });

    return unsub;
  }, [firestoreGroupId]);

  useEffect(() => {
    let disposed = false;

    // Load device ID with unmount guard
    (async () => {
      try {
        const id = await getDeviceId();
        if (!disposed) setMyDeviceId(id);
      } catch (error) {
        logger.warn('Failed to load device ID in family group chat:', error);
      }
    })();

    // ELITE: Ensure BLE Mesh service is started for offline messaging
    (async () => {
      try {
        if (!bleMeshService.getIsRunning()) {
          await bleMeshService.start();
          if (__DEV__) {
            logger.info('BLE Mesh service started from FamilyGroupChatScreen');
          }
        }
      } catch (error) {
        logger.warn('BLE Mesh start failed (non-critical):', error);
      }
    })();

    return () => {
      disposed = true;
      if (voiceRecordingIntervalRef.current) {
        clearInterval(voiceRecordingIntervalRef.current);
        voiceRecordingIntervalRef.current = null;
      }
      voiceMessageService.cancelRecording().catch(() => { /* no-op */ });
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Scroll to bottom when keyboard appears
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => sub.remove();
  }, []);

  // ELITE: Merge mesh messages + Firestore messages (dedup by ID)
  useEffect(() => {
    setMessages((_prev) => {
      const merged = new Map<string, GroupMessage>();

      // 1. Firestore group messages (highest priority — authoritative source)
      firestoreMessages.forEach((msg) => {
        merged.set(msg.id, msg);
      });

      // 2. Mesh messages (offline/BLE — may overlap with Firestore)
      meshMessages.forEach((msg) => {
        if (merged.has(msg.id)) return; // Skip dupes

        const parsed = parseGroupPayload(msg.content);
        const inferredMediaType = (
          msg.mediaType === 'image' || msg.mediaType === 'voice' || msg.mediaType === 'location'
            ? msg.mediaType
            : msg.type === 'IMAGE'
              ? 'image'
              : msg.type === 'VOICE'
                ? 'voice'
                : msg.type === 'LOCATION'
                  ? 'location'
                  : undefined
        ) as GroupMessage['mediaType'] | undefined;
        const targetGroupId = typeof msg.to === 'string' && msg.to.startsWith('group:')
          ? msg.to.slice('group:'.length).trim()
          : undefined;

        if (!parsed) {
          if (!inferredMediaType) return;
          if (!targetGroupId) return;
          if (firestoreGroupId && targetGroupId !== firestoreGroupId) return;
          if (!isAllowedGroupMessageWithAliases(msg.senderId, msg.to, [], targetGroupId)) return;

          const defaultContent =
            inferredMediaType === 'image'
              ? '📷 Fotoğraf'
              : inferredMediaType === 'voice'
                ? '🎤 Sesli Mesaj'
                : '📍 Konum';
          const normalized: GroupMessage = {
            id: msg.id,
            senderId: msg.senderId,
            senderName: msg.senderName || msg.senderId,
            content: msg.content || defaultContent,
            timestamp: msg.timestamp,
            status: msg.status === 'pending' || msg.status === 'sending' ? 'sending' : 'read',
            readBy: [msg.senderId],
            mediaType: inferredMediaType,
            ...(msg.mediaUrl ? { mediaUrl: msg.mediaUrl } : {}),
            ...(typeof msg.mediaDuration === 'number' ? { mediaDuration: msg.mediaDuration } : {}),
            ...(msg.location ? { location: msg.location } : {}),
          };
          merged.set(msg.id, normalized);
          return;
        }

        const senderAliases = [parsed.senderUid, parsed.senderPublicCode, parsed.senderDeviceId];
        if (!isAllowedGroupMessageWithAliases(msg.senderId, msg.to, senderAliases, parsed.groupId)) return;

        const normalizedSenderCandidates = Array.from(
          new Set(
            [parsed.senderUid, msg.senderId, parsed.senderPublicCode, parsed.senderDeviceId]
              .map((value) => (typeof value === 'string' ? value.trim() : ''))
              .filter((value) => value.length > 0),
          ),
        );
        const normalizedSenderId =
          normalizedSenderCandidates.find((value) => selfIds.has(value)) ||
          normalizedSenderCandidates[0] ||
          msg.senderId;

        const resolvedMediaType = parsed.mediaType || inferredMediaType;
        const resolvedMediaUrl = parsed.mediaUrl || msg.mediaUrl;
        const resolvedMediaDuration = typeof parsed.mediaDuration === 'number'
          ? parsed.mediaDuration
          : msg.mediaDuration;
        const resolvedLocation = parsed.location || msg.location;

        const normalized: GroupMessage = {
          id: msg.id,
          senderId: normalizedSenderId,
          senderName: parsed.senderName || msg.senderName || normalizedSenderId,
          content: parsed.text,
          timestamp: msg.timestamp,
          status: msg.status === 'pending' || msg.status === 'sending' ? 'sending' : 'read',
          readBy: [normalizedSenderId],
          ...(resolvedMediaType ? { mediaType: resolvedMediaType } : {}),
          ...(resolvedMediaUrl ? { mediaUrl: resolvedMediaUrl } : {}),
          ...(typeof resolvedMediaDuration === 'number' ? { mediaDuration: resolvedMediaDuration } : {}),
          ...(resolvedLocation ? { location: resolvedLocation } : {}),
        };
        merged.set(msg.id, normalized);
      });

      return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
    });
  }, [isAllowedGroupMessageWithAliases, meshMessages, parseGroupPayload, firestoreMessages, selfIds]);

  // ELITE: Memoized callback with comprehensive error handling
  const handleSend = useCallback(async () => {
    try {
      // ELITE: Validate input
      if (!inputText.trim()) {
        return;
      }

      haptics.impactLight();

      // ELITE: Create message with validation
      const timestamp = Date.now();
      const trimmedContent = inputText.trim();
      const identity = identityService.getIdentity();
      const realName = identity?.displayName || 'Aile Üyesi';

      // ELITE: Validate message length
      if (trimmedContent.length > 500) {
        Alert.alert('Hata', 'Mesaj çok uzun. Maksimum 500 karakter.');
        return;
      }

      setInputText('');

      // ELITE V2: Dual-channel group send strategy:
      // 1. Try GroupChatService first (Firestore + its own mesh group payload)
      // 2. Fallback to direct mesh family-group broadcast only if group send fails
      try {
        let groupSendSucceeded = false;
        const activeGroupId = await ensureActiveGroupId();

        if (activeGroupId) {
          try {
            const groupMessage = await groupChatService.sendMessage(activeGroupId, trimmedContent, {
              type: 'CHAT',
            });
            groupSendSucceeded = !!groupMessage;
            if (groupMessage) {
              logger.info(`Group message sent to Firestore: ${groupMessage.id}`);
            } else {
              logger.warn('Group send returned null, falling back to mesh broadcast');
            }
          } catch (err) {
            logger.warn('Firestore group send failed (fallback to mesh):', err);
          }
        }

        // Fallback channel: direct family-group mesh broadcast
        if (!groupSendSucceeded) {
          const fallbackMessageId = `fg_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
          const fallbackSenderUid = identityService.getUid() || '';
          const fallbackSenderPublicCode = identityService.getMyId() || '';
          const fallbackSenderId =
            fallbackSenderUid ||
            myDeviceId ||
            identityService.getMyId() ||
            'ME';
          const meshPayload = JSON.stringify({
            channel: FAMILY_GROUP_CHANNEL,
            text: trimmedContent,
            senderName: realName,
            ...(fallbackSenderUid ? { senderUid: fallbackSenderUid } : {}),
            ...(fallbackSenderPublicCode ? { senderPublicCode: fallbackSenderPublicCode } : {}),
            ...(myDeviceId ? { fromDeviceId: myDeviceId } : {}),
            ts: timestamp,
            groupId: activeGroupId || undefined,
          });

          await meshNetworkService.broadcastMessage(meshPayload, MeshMessageType.TEXT, {
            to: activeGroupId ? `group:${activeGroupId}` : 'broadcast',
            from: fallbackSenderId,
            messageId: fallbackMessageId,
          });

          appendLocalGroupMessage({
            id: fallbackMessageId,
            senderId: fallbackSenderId,
            senderName: realName,
            content: trimmedContent,
            timestamp,
            status: 'sent',
            readBy: [fallbackSenderId],
          });
          logger.info('Group message sent via direct mesh fallback');
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
  }, [appendLocalGroupMessage, ensureActiveGroupId, inputText, myDeviceId]);

  // ============================================================================
  // ELITE: Media Message Handlers
  // ============================================================================

  const sendMediaToGroup = useCallback(async (
    mediaType: 'image' | 'voice' | 'location',
    options: {
      mediaLocalUri?: string;
      mediaDuration?: number;
      location?: { lat: number; lng: number; address?: string };
    }
  ) => {
    try {
      const identity = identityService.getIdentity();
      const mediaLabel =
        mediaType === 'image' ? '📷 Fotoğraf'
          : mediaType === 'voice' ? '🎤 Sesli Mesaj'
            : '📍 Konum';
      const senderName = identity?.displayName || 'Aile Üyesi';

      let groupSendSucceeded = false;
      let uploadedMediaUrl: string | undefined;
      let outboundMessageId: string | null = null;
      let outboundTimestamp = Date.now();

      const activeGroupId = await ensureActiveGroupId();
      const fallbackSenderUid = identityService.getUid() || '';
      const fallbackSenderPublicCode = identityService.getMyId() || '';
      const fallbackSenderId =
        fallbackSenderUid ||
        myDeviceId ||
        identityService.getMyId() ||
        'ME';
      const fallbackRecipient = activeGroupId ? `group:${activeGroupId}` : 'broadcast';

      if (activeGroupId) {
        try {
          if ((mediaType === 'image' || mediaType === 'voice') && options.mediaLocalUri) {
            try {
              const { firebaseStorageService } = await import('../../services/FirebaseStorageService');
              await firebaseStorageService.initialize();

              const ownerUid = getCurrentAuthUserSafe()?.uid || identityService.getUid();
              if (!ownerUid) {
                throw new Error('cloud-identity-unavailable');
              }

              const extension = mediaType === 'image' ? 'jpg' : 'm4a';
              const storagePath = `group-chat/${activeGroupId}/${ownerUid}/${Date.now()}.${extension}`;

              const FileSystem = require('expo-file-system');
              const base64Data = await FileSystem.readAsStringAsync(options.mediaLocalUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              const { Buffer } = await import('buffer');
              const bytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));

              uploadedMediaUrl = await firebaseStorageService.uploadFile(storagePath, bytes, {
                contentType: mediaType === 'image' ? 'image/jpeg' : 'audio/mp4',
                customMetadata: {
                  userId: ownerUid,
                  groupId: activeGroupId,
                },
              }) ?? undefined;
            } catch (uploadError) {
              logger.warn(`Group ${mediaType} upload failed; continuing with mesh binary fallback:`, uploadError);
            }
          }

          const groupMessage = await groupChatService.sendMessage(activeGroupId, mediaLabel, {
            type: mediaType === 'image' ? 'IMAGE' : mediaType === 'voice' ? 'VOICE' : 'LOCATION',
            ...(mediaType === 'location' && options.location ? { location: options.location } : {}),
            ...(uploadedMediaUrl ? { mediaUrl: uploadedMediaUrl } : {}),
            ...(mediaType ? { mediaType } : {}),
            ...(typeof options.mediaDuration === 'number' ? { mediaDuration: options.mediaDuration } : {}),
          });

          groupSendSucceeded = !!groupMessage;
          if (groupMessage?.id) {
            outboundMessageId = groupMessage.id;
            outboundTimestamp = typeof groupMessage.timestamp === 'number' ? groupMessage.timestamp : outboundTimestamp;
          }
          if (groupSendSucceeded) {
            logger.info(`Group ${mediaType} message sent via Firestore group`);
          }
        } catch (groupError) {
          logger.warn(`Group ${mediaType} send failed (fallback to mesh):`, groupError);
        }
      }

      if (!groupSendSucceeded) {
        const fallbackTimestamp = Date.now();
        const fallbackMessageId = `fgm_${fallbackTimestamp}_${Math.random().toString(36).slice(2, 8)}`;
        outboundMessageId = fallbackMessageId;
        outboundTimestamp = fallbackTimestamp;

        const fallbackPayload = JSON.stringify({
          channel: FAMILY_GROUP_CHANNEL,
          text: mediaLabel,
          senderName,
          ...(fallbackSenderUid ? { senderUid: fallbackSenderUid } : {}),
          ...(fallbackSenderPublicCode ? { senderPublicCode: fallbackSenderPublicCode } : {}),
          ...(myDeviceId ? { fromDeviceId: myDeviceId } : {}),
          ts: fallbackTimestamp,
          type: mediaType.toUpperCase(),
          mediaType,
          ...(typeof options.mediaDuration === 'number' ? { mediaDuration: options.mediaDuration } : {}),
          ...(mediaType === 'location' && options.location ? { location: options.location } : {}),
        });

        await meshNetworkService.broadcastMessage(fallbackPayload, MeshMessageType.TEXT, {
          to: fallbackRecipient,
          from: fallbackSenderId,
          messageId: fallbackMessageId,
        });

        appendLocalGroupMessage({
          id: fallbackMessageId,
          senderId: fallbackSenderId,
          senderName,
          content: mediaLabel,
          timestamp: fallbackTimestamp,
          status: 'sent',
          readBy: [fallbackSenderId],
          mediaType,
          ...(typeof options.mediaDuration === 'number' ? { mediaDuration: options.mediaDuration } : {}),
          ...(mediaType === 'location' && options.location ? { location: options.location } : {}),
        });
        logger.info(`Group ${mediaType} message sent via direct mesh fallback`);
      }

      const needsBinaryFallback =
        (mediaType === 'image' || mediaType === 'voice') &&
        !!options.mediaLocalUri &&
        !uploadedMediaUrl &&
        !!outboundMessageId;
      if (needsBinaryFallback && options.mediaLocalUri && outboundMessageId) {
        try {
          await meshMediaService.initialize();
          if (mediaType === 'image') {
            await meshMediaService.sendImage(fallbackRecipient, options.mediaLocalUri, {
              transferId: outboundMessageId,
              caption: mediaLabel,
              timestamp: outboundTimestamp,
              senderName,
              senderId: fallbackSenderUid || fallbackSenderId,
            });
          } else {
            await meshMediaService.sendVoice(
              fallbackRecipient,
              options.mediaLocalUri,
              typeof options.mediaDuration === 'number' ? options.mediaDuration : 0,
              {
                transferId: outboundMessageId,
                timestamp: outboundTimestamp,
                senderName,
                senderId: fallbackSenderUid || fallbackSenderId,
              },
            );
          }

          if (!groupSendSucceeded) {
            appendLocalGroupMessage({
              id: outboundMessageId,
              senderId: fallbackSenderId,
              senderName,
              content: mediaLabel,
              timestamp: outboundTimestamp,
              status: 'sent',
              readBy: [fallbackSenderId],
              mediaType,
              mediaUrl: options.mediaLocalUri,
              ...(typeof options.mediaDuration === 'number' ? { mediaDuration: options.mediaDuration } : {}),
            });
          }
        } catch (meshFallbackError) {
          logger.warn(`Group ${mediaType} binary mesh fallback failed:`, meshFallbackError);
        }
      }

      haptics.notificationSuccess();
    } catch (error) {
      logger.error(`Error sending group ${mediaType}:`, error);
      Alert.alert('Hata', 'Medya gönderilemedi.');
    }
  }, [appendLocalGroupMessage, ensureActiveGroupId, myDeviceId]);

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
        await sendMediaToGroup('image', { mediaLocalUri: result.assets[0].uri });
      }
    } catch (error) {
      logger.error('Camera error:', error);
      Alert.alert('Hata', 'Fotoğraf çekilemedi.');
    }
  }, [sendMediaToGroup]);

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
        await sendMediaToGroup('image', { mediaLocalUri: result.assets[0].uri });
      }
    } catch (error) {
      logger.error('Gallery error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilemedi.');
    }
  }, [sendMediaToGroup]);

  const handleVoiceRecordStart = useCallback(async () => {
    try {
      if (isRecordingVoice) {
        return;
      }

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
        if (voiceRecordingIntervalRef.current) {
          clearInterval(voiceRecordingIntervalRef.current);
        }
        voiceRecordingIntervalRef.current = setInterval(() => {
          setVoiceRecordingDuration(prev => {
            if (prev >= MAX_VOICE_DURATION - 1) {
              // Auto-stop at max duration
              handleVoiceRecordSendRef.current();
              return 0;
            }
            return prev + 1;
          });
        }, 1000);
      }
    } catch (error) {
      logger.error('Voice recording error:', error);
      Alert.alert('Hata', 'Ses kaydı başlatılamadı.');
    }
  }, [isRecordingVoice]);

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
        await sendMediaToGroup('voice', {
          mediaLocalUri: voiceMessage.uri,
          mediaDuration: Math.floor(voiceMessage.durationMs / 1000),
        });
        voiceMessageService.backupToFirebase(voiceMessage).catch((backupError) => {
          logger.warn('Voice backup failed in family group chat:', backupError);
        });
      }
    } catch (error) {
      logger.error('Voice send error:', error);
      Alert.alert('Hata', 'Ses mesajı gönderilemedi.');
    }
  }, [sendMediaToGroup]);

  // Keep ref in sync so the interval timer in handleVoiceRecordStart can call it
  useEffect(() => {
    handleVoiceRecordSendRef.current = handleVoiceRecordSend;
  }, [handleVoiceRecordSend]);

  const handleVoiceRecordCancel = useCallback(async () => {
    try {
      if (voiceRecordingIntervalRef.current) {
        clearInterval(voiceRecordingIntervalRef.current);
        voiceRecordingIntervalRef.current = null;
      }
      await voiceMessageService.cancelRecording();
      haptics.notificationWarning();
    } catch (error) {
      logger.warn('Voice cancel error:', error);
      Alert.alert('Hata', 'Ses kaydı iptal edilirken bir hata oluştu.');
    } finally {
      setIsRecordingVoice(false);
      setVoiceRecordingDuration(0);
    }
  }, []);

  const handleShareLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Konum paylaşımı için izin vermeniz gerekmektedir.');
        return;
      }
      haptics.impactLight();
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let address: string | undefined;
      try {
        const [reverseGeocode] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (reverseGeocode) {
          address = [reverseGeocode.street, reverseGeocode.city, reverseGeocode.region]
            .filter(Boolean)
            .join(', ');
        }
      } catch { /* Ignore geocode errors */ }
      await sendMediaToGroup('location', {
        location: { lat: loc.coords.latitude, lng: loc.coords.longitude, address },
      });
    } catch (error) {
      logger.error('Location share error:', error);
      Alert.alert('Hata', 'Konum paylaşılamadı.');
    }
  }, [sendMediaToGroup]);

  const renderMessage = ({ item }: { item: GroupMessage }) => {
    const isMyMessage = selfIds.has(item.senderId);

    // ELITE: Render media content
    const renderMediaContent = () => {
      if (item.mediaType === 'image' && item.mediaUrl) {
        return (
          <View>
            <Image source={{ uri: item.mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
            {item.content && item.content !== '📷 Fotoğraf' && (
              <Text style={[styles.messageText, isMyMessage && styles.myMessageText, { marginTop: 6 }]}>
                {item.content}
              </Text>
            )}
          </View>
        );
      }
      if (item.mediaType === 'image') {
        return (
          <View style={styles.mediaPlaceholder}>
            <Ionicons name="image-outline" size={28} color={isMyMessage ? '#fff' : '#64748b'} />
            <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>📷 Fotoğraf</Text>
          </View>
        );
      }
      if (item.mediaType === 'voice') {
        return (
          <View style={styles.mediaPlaceholder}>
            <Ionicons name="mic-outline" size={22} color={isMyMessage ? '#fff' : '#64748b'} />
            <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>
              🎤 Sesli Mesaj {item.mediaDuration ? `(${item.mediaDuration}s)` : ''}
            </Text>
          </View>
        );
      }
      if (item.mediaType === 'location' && item.location) {
        return (
          <Pressable
            onPress={() => {
              const lat = item.location?.lat;
              const lng = item.location?.lng;
              if (typeof lat !== 'number' || typeof lng !== 'number') return;
              const url = Platform.select({
                ios: `maps:0,0?q=${lat},${lng}`,
                default: `https://maps.google.com/?q=${lat},${lng}`,
              });
              Linking.openURL(url).catch(() => {
                Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`).catch((error) => {
                  logger.warn('Failed to open location URL in FamilyGroupChatScreen:', error);
                });
              });
            }}
            style={styles.locationCard}
          >
            <Ionicons name="location" size={18} color="#ef4444" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>📍 Konum</Text>
              <Text style={[styles.locationAddress, isMyMessage && { color: 'rgba(255,255,255,0.7)' }]}>
                {item.location.address || `${item.location.lat.toFixed(4)}, ${item.location.lng.toFixed(4)}`}
              </Text>
            </View>
          </Pressable>
        );
      }
      return (
        <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>
          {item.content}
        </Text>
      );
    };

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
            item.mediaType === 'image' && item.mediaUrl && styles.bubbleImage,
          ]}
        >
          {renderMediaContent()}
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
            {isMyMessage && item.readBy.length > 1 && (() => {
              const group = firestoreGroupId ? groupChatService.getGroup(firestoreGroupId) : null;
              const totalMembers = group?.participants?.length || members.length;
              const readCount = item.readBy.length;
              return (
                <Text style={[styles.messageTime, { fontSize: 10, marginLeft: 4 }, isMyMessage && styles.myMessageTime]}>
                  {readCount}/{totalMembers}
                </Text>
              );
            })()}
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
          <Text style={styles.title}>
            {firestoreGroupId
              ? (groupChatService.getGroup(firestoreGroupId)?.name || 'Aile Grubu')
              : 'Aile Grubu'}
          </Text>
          <Text style={styles.subtitle}>
            {firestoreGroupId
              ? `${groupChatService.getGroup(firestoreGroupId)?.participants?.length || members.length} üye`
              : `${members.length} üye`}
          </Text>
        </View>
        <Pressable
          style={styles.infoButton}
          onPress={() => {
            haptics.impactLight();
            const group = firestoreGroupId ? groupChatService.getGroup(firestoreGroupId) : null;
            const title = group?.name || 'Aile Grubu';
            const count = group?.participants?.length || members.length;
            Alert.alert(
              title,
              `Bu grup ${count} üyeden oluşmaktadır.\n\nBLE Mesh üzerinden internet olmadan mesajlaşabilirsiniz.`,
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        viewabilityConfig={groupViewabilityConfig}
        onViewableItemsChanged={onGroupViewableItemsChanged}
        // ELITE: Performance optimizations
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.inputContainer,
            { paddingBottom: Platform.OS === 'ios' && keyboardVisible ? 12 : insets.bottom + 12 },
          ]}
        >
          <Pressable
            style={styles.attachBtn}
            onPress={() => setAttachmentsModalVisible(true)}
          >
            <Ionicons name="add" size={24} color={colors.text.secondary} />
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
          {inputText.trim() ? (
            <Pressable
              style={styles.sendButton}
              onPress={handleSend}
            >
              <Ionicons name="send" size={20} color="#ffffff" />
            </Pressable>
          ) : (
            <Pressable
              style={styles.micButton}
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
      </KeyboardAvoidingView>

      {/* ELITE: Attachments Modal */}
      <AttachmentsModal
        visible={attachmentsModalVisible}
        onClose={() => setAttachmentsModalVisible(false)}
        onSelectCamera={handleCameraCapture}
        onSelectGallery={handleGallerySelect}
        onSelectVoice={handleVoiceRecordStart}
        onSelectLocation={handleShareLocation}
      />
    </SafeAreaView>
  );
}
