/**
 * FAMILY SCREEN - Elite Premium Design
 * Production-grade family safety chain with comprehensive error handling
 * Zero-error guarantee with full type safety
 *
 * REFACTORED: StatusSection -> FamilyStatusSection, IdModal -> IdShareModal, EditModal -> EditMemberModal
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
  StatusBar,
  Linking,
  Platform,
  ImageBackground,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FamilyMember } from '../../types/family';

// Pure-JS / framework imports — no native bridge, safe to import statically.
import GlassButton from '../../components/buttons/GlassButton';
import { useFamilyStore } from '../../stores/familyStore';
import { useMeshStore } from '../../services/mesh/MeshStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { MeshMessageType } from '../../services/mesh/MeshProtocol';
import { getDeviceId as getDeviceIdFromLib } from '../../utils/device';
import { MemberCard } from '../../components/family/MemberCard';
import { colors, typography, spacing } from '../../theme';
import { styles } from './FamilyScreen.styles';
import { createLogger } from '../../utils/logger';
import ErrorBoundary from '../../components/ErrorBoundary';
import { resolveFamilyMemberLocation } from '../../utils/familyLocation';

// Native-bridge dependencies guarded with require/catch. Past production crashes
// originated from native modules failing to initialize on certain device/OS
// combinations (MMKV, expo-haptics, expo-location, react-native-maps, BLE).
// Keeping these defensive maintains screen renderability even when one native
// dep fails. Errors are surfaced via console.error so the issue is never silent.
const IMPORT_ERRORS: string[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Location: any = null;
try { Location = require('expo-location'); } catch (e: any) { IMPORT_ERRORS.push('expo-location: ' + e?.message); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bleMeshService: any = null;
try { bleMeshService = require('../../services/BLEMeshService').bleMeshService; } catch (e: any) { IMPORT_ERRORS.push('BLEMeshService: ' + e?.message); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let meshNetworkService: any = null;
try { meshNetworkService = require('../../services/mesh/MeshNetworkService').meshNetworkService; } catch (e: any) { IMPORT_ERRORS.push('MeshNetworkService: ' + e?.message); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let familyTrackingService: any = null;
try { familyTrackingService = require('../../services/FamilyTrackingService').familyTrackingService; } catch (e: any) { IMPORT_ERRORS.push('FamilyTrackingService: ' + e?.message); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let multiChannelAlertService: any = null;
try { multiChannelAlertService = require('../../services/MultiChannelAlertService').multiChannelAlertService; } catch (e: any) { IMPORT_ERRORS.push('MultiChannelAlertService: ' + e?.message); }

// IdentityService → transitively MMKV + Firebase Auth. Native bridge risk.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let identityService: any = { getUid: () => null, getAfetNetId: () => null };
try { identityService = require('../../services/IdentityService').identityService; } catch (e: any) { IMPORT_ERRORS.push('IdentityService: ' + e?.message); }

// MMKV via DirectStorage — native module
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DirectStorageRef: any = { getString: () => null, setString: () => { } };
try { DirectStorageRef = require('../../utils/storage').DirectStorage; } catch (e: any) { IMPORT_ERRORS.push('DirectStorage: ' + e?.message); }

// expo-haptics native module
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let haptics: any = { impactLight: () => { }, impactMedium: () => { }, impactHeavy: () => { }, notificationSuccess: () => { }, notificationError: () => { }, notificationWarning: () => { }, selectionChanged: () => { } };
try { haptics = require('../../utils/haptics'); } catch (e: any) { IMPORT_ERRORS.push('haptics: ' + e?.message); }

// react-native-maps native module — heaviest crash risk for FamilyMapView
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let FamilyMapView: any = () => null;
try { FamilyMapView = require('../../components/family/FamilyMapView').FamilyMapView; } catch (e: any) { IMPORT_ERRORS.push('FamilyMapView: ' + e?.message); }

// Extracted sub-components
import { FamilyStatusSection } from './FamilyStatusSection';
import { IdShareModal } from './IdShareModal';
import { EditMemberModal } from './EditMemberModal';

// ELITE F3: Contact-request service for inline accept/reject UI.
// Defensive import — ContactRequestService transitively depends on Firebase Auth,
// which can fail to load on cold start before identity is restored. Keep family
// screen renderable even if requests can't be subscribed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let contactRequestService: any = null;
try {
  contactRequestService = require('../../services/ContactRequestService').contactRequestService;
} catch (e: any) {
  IMPORT_ERRORS.push('ContactRequestService: ' + e?.message);
}
import type { ContactRequest } from '../../services/ContactRequestService';

// CRITICAL: Log native-bridge import errors in ALL builds — not just __DEV__.
// Silent import failures cause family safety features to degrade without any indication.
if (IMPORT_ERRORS.length > 0) {
  console.error('[FamilyScreen] IMPORT ERRORS:', JSON.stringify(IMPORT_ERRORS));
}

const logger = createLogger('FamilyScreen');
const FAMILY_TRACKING_CONSUMER_ID = 'family-screen';
/** User-scoped status key to prevent cross-account data leak */
const getMyStatusStorageKey = (): string => {
  const uid = identityService?.getUid?.() || 'anonymous';
  return `@afetnet:my_family_status:${uid}`;
};
type FamilyStatusUpdate = Extract<FamilyMember['status'], 'safe' | 'need-help' | 'critical' | 'unknown'>;
type PendingFamilyUpdate = {
  status?: FamilyStatusUpdate;
  location?: { latitude: number; longitude: number; timestamp?: number; batteryLevel?: number };
};

const VALID_FAMILY_STATUSES: ReadonlySet<FamilyStatusUpdate> = new Set([
  'safe',
  'need-help',
  'critical',
  'unknown',
]);

const parseIncomingFamilyStatus = (value: unknown): FamilyStatusUpdate | null => {
  if (typeof value !== 'string') return null;
  if (!VALID_FAMILY_STATUSES.has(value as FamilyStatusUpdate)) return null;
  return value as FamilyStatusUpdate;
};

const parseIncomingFamilyLocation = (value: unknown): PendingFamilyUpdate['location'] | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { latitude?: unknown; longitude?: unknown; timestamp?: unknown; battery?: unknown; batteryLevel?: unknown };
  const latitude = typeof candidate.latitude === 'number' ? candidate.latitude : NaN;
  const longitude = typeof candidate.longitude === 'number' ? candidate.longitude : NaN;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  const timestamp = normalizeIncomingTimestamp(candidate.timestamp);
  const batteryLevel = normalizeIncomingBattery(candidate.battery ?? candidate.batteryLevel);
  return {
    latitude,
    longitude,
    ...(timestamp > 0 ? { timestamp } : {}),
    ...(batteryLevel !== undefined ? { batteryLevel } : {}),
  };
};

const normalizeIncomingTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 1e11 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber < 1e11 ? Math.round(asNumber * 1000) : Math.round(asNumber);
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeIncomingBattery = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 0 || value > 100) return undefined;
  return Math.round(value);
};

// ELITE: Type-safe navigation props
interface FamilyScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

// SafeFamilyMapView: Wraps FamilyMapView in its own error boundary to prevent
// native module crashes (react-native-maps) from tearing down the entire screen.
const SafeFamilyMapView: React.FC<React.ComponentProps<typeof FamilyMapView>> = (props) => {
  try {
    return (
      <ErrorBoundary
        fallback={
          <View style={{ height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16 }}>
            <Ionicons name="map-outline" size={40} color="#94a3b8" />
            <Text style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>Harita yüklenemedi</Text>
          </View>
        }
      >
        <FamilyMapView {...props} />
      </ErrorBoundary>
    );
  } catch {
    return (
      <View style={{ height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16 }}>
        <Ionicons name="map-outline" size={40} color="#94a3b8" />
        <Text style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>Harita yüklenemedi</Text>
      </View>
    );
  }
};

// Toast notification component
const Toast: React.FC<{ message: string; visible: boolean }> = ({ message, visible }) => {
  if (!visible) return null;
  return (
    <View style={inlineStyles.toast}>
      <Ionicons name="checkmark-circle" size={16} color="#fff" />
      <Text style={inlineStyles.toastText}>{message}</Text>
    </View>
  );
};

const inlineStyles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.88)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 999,
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

// MODULE-LEVEL CONSTANTS: Moved out of component to avoid recreation on every render
const FAMILY_RELATIONSHIPS = new Set(['anne', 'baba', 'es', 'kardes', 'cocuk', 'akraba']);
const STATUS_PRIORITY: Record<string, number> = {
  'critical': 0, 'danger': 1, 'need-help': 2, 'unknown': 3, 'offline': 4, 'safe': 5,
};
const sortByUrgency = (a: FamilyMember, b: FamilyMember) => {
  const pa = STATUS_PRIORITY[a.status] ?? 3;
  const pb = STATUS_PRIORITY[b.status] ?? 3;
  return pa - pb;
};

// Critical services that MUST be loaded for family safety features
const CRITICAL_SERVICES_OK = !!(useFamilyStore && identityService?.getUid !== undefined && familyTrackingService);

function FamilyScreenInner({ navigation }: FamilyScreenProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // Show visible error if critical family services failed to load
  if (IMPORT_ERRORS.length > 0 && !CRITICAL_SERVICES_OK) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Ionicons name="warning" size={48} color="#ef4444" />
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#ef4444', marginTop: 12 }}>Aile Güvenliği Yüklenemedi</Text>
        <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8 }}>
          Kritik servisler başlatılamadı. Lütfen uygulamayı yeniden başlatın.
        </Text>
      </View>
    );
  }

  // Use Zustand hooks - they handle referential equality automatically
  const allMembers = useFamilyStore((state: any) => state.members);

  // Filter out the device owner (self) — only show added family members
  // CRITICAL FIX: Track myUid in state so it updates when identity loads asynchronously
  // on cold start. Previously useMemo([]) captured a stale '' value when identityService
  // hadn't loaded yet, causing the owner to appear in their own family member list.
  const [myUid, setMyUid] = React.useState(() => {
    try { return identityService.getUid() || ''; } catch { return ''; }
  });
  React.useEffect(() => {
    const uid = identityService.getUid();
    if (uid && uid !== myUid) {
      setMyUid(uid);
      return;
    }
    // Retry once after 1s for cold-start race where identity isn't ready yet
    const timer = setTimeout(() => {
      try {
        const resolvedUid = identityService.getUid();
        if (resolvedUid && resolvedUid !== myUid) {
          setMyUid(resolvedUid);
        }
      } catch { /* best effort */ }
    }, 1000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const members = React.useMemo(
    () => myUid ? allMembers.filter((m: FamilyMember) => m.uid !== myUid) : allMembers,
    [allMembers, myUid],
  );

  // CRITICAL FIX: Restore location sharing state from persisted setting.
  // Without this, the toggle always shows "off" even when tracking is actively running
  // (auto-resumed from init.ts), confusing users during emergencies.
  const [isSharingLocation, setIsSharingLocation] = useState(() => {
    try {
      return useSettingsStore.getState().familyLocationSharingEnabled ?? false;
    } catch { return false; }
  });
  const [myStatus, setMyStatus] = useState<'safe' | 'need-help' | 'unknown' | 'critical'>('unknown');
  const [showIdModal, setShowIdModal] = useState(false);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [mySharePayload, setMySharePayload] = useState('');
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  // ELITE V2: Map/List toggle (Life360 pattern)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  // Loading states
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ELITE F3: Pending contact requests (someone wants to add me as family).
  // Subscribed via ContactRequestService listener — also primes from existing pending state.
  const [pendingRequests, setPendingRequests] = useState<ContactRequest[]>(() => {
    try { return contactRequestService?.getPendingRequests?.() || []; } catch { return []; }
  });
  const [requestActionInFlight, setRequestActionInFlight] = useState<Record<string, 'accept' | 'decline' | null>>({});

  // Batch update mechanism to prevent subscription loops
  const pendingUpdatesRef = useRef<Map<string, PendingFamilyUpdate>>(new Map());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 2000);
  }, []);

  const applyPendingFamilyUpdates = useCallback((source: 'debounce' | 'cleanup') => {
    if (pendingUpdatesRef.current.size === 0) {
      return;
    }

    const latestMembers = useFamilyStore.getState().members;
    const pendingEntries = Array.from(pendingUpdatesRef.current.entries());

    for (const [memberId, updateData] of pendingEntries) {
      const member = latestMembers.find((candidate: FamilyMember) => candidate.uid === memberId);
      if (!member) continue;

      if (updateData.status && member.status !== updateData.status) {
        useFamilyStore.getState().updateMemberStatus(member.uid, updateData.status, 'remote').catch((error: unknown) => {
          logger.error(`Failed to update member status (${source}):`, error);
        });
      }

      if (updateData.location) {
        useFamilyStore.getState().updateMemberLocation(
          member.uid,
          updateData.location.latitude,
          updateData.location.longitude,
          'remote',
          updateData.location.timestamp,
          updateData.location.batteryLevel !== undefined
            ? { batteryLevel: updateData.location.batteryLevel }
            : undefined,
        ).catch((error: unknown) => {
          logger.error(`Failed to update member location (${source}):`, error);
        });
      }
    }

    pendingUpdatesRef.current.clear();
  }, []);

  const myStatusSubtitle = useMemo(() => {
    if (myStatus === 'safe') return 'Güvendesiniz';
    if (myStatus === 'need-help') return 'Yardım Bildirildi';
    if (myStatus === 'critical') return 'ACİL Durum Bildirildi';
    return 'Durum Bekleniyor';
  }, [myStatus]);

  // ELITE F3: Subscribe to incoming contact requests (someone added me as family).
  // ContactRequestService.addListener fires immediately with current pending list,
  // then again whenever Firestore listener delivers updates.
  useEffect(() => {
    if (!contactRequestService?.addListener) {
      logger.warn('ContactRequestService unavailable — skip pending request subscription');
      return;
    }
    const unsubscribe = contactRequestService.addListener((requests: ContactRequest[]) => {
      setPendingRequests(requests);
    });
    return () => {
      try { unsubscribe(); } catch (e) { logger.debug('CR listener cleanup error:', e); }
    };
  }, []);

  // ELITE F3: Accept/decline pending request handlers
  const handleAcceptRequest = useCallback(async (request: ContactRequest) => {
    if (!contactRequestService?.acceptRequest) {
      Alert.alert('Hata', 'Kişi servisi yüklenemedi. Uygulamayı yeniden başlatın.');
      return;
    }
    setRequestActionInFlight((prev) => ({ ...prev, [request.id]: 'accept' }));
    try {
      const success = await contactRequestService.acceptRequest(request);
      if (success) {
        haptics.notificationSuccess?.();
        showToast(`${request.fromName} kabul edildi`);
      } else {
        Alert.alert('Hata', 'Kabul başarısız. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      }
    } catch (err) {
      logger.error('Accept request failed:', err);
      Alert.alert('Hata', 'Kabul sırasında bir sorun oluştu.');
    } finally {
      setRequestActionInFlight((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
    }
  }, [showToast]);

  const handleDeclineRequest = useCallback(async (request: ContactRequest) => {
    if (!contactRequestService?.declineRequest) return;
    setRequestActionInFlight((prev) => ({ ...prev, [request.id]: 'decline' }));
    try {
      const success = await contactRequestService.declineRequest(request);
      if (success) {
        haptics.impactLight?.();
        showToast(`${request.fromName} reddedildi`);
      } else {
        Alert.alert('Hata', 'Reddetme başarısız. Tekrar deneyin.');
      }
    } catch (err) {
      logger.error('Decline request failed:', err);
    } finally {
      setRequestActionInFlight((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
    }
  }, [showToast]);

  // Initialize on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // CRITICAL FIX: If familyStore is already initialized (from init.ts Phase C),
        // skip the expensive re-initialization. This prevents a visible loading delay
        // when the user opens the Family screen.
        const storeState = useFamilyStore.getState();
        const alreadyInitialized = storeState.isInitialized;

        // Only show loading spinner if store has no members AND hasn't initialized yet
        if (!alreadyInitialized && storeState.members.length === 0) {
          setIsInitializing(true);
        } else {
          // Store already has data — show it immediately
          setIsInitializing(false);
        }

        // Restore persisted status (fast, from encrypted MMKV)
        try {
          const savedStatus = DirectStorageRef.getString(getMyStatusStorageKey());
          if (savedStatus && ['safe', 'need-help', 'critical', 'unknown'].includes(savedStatus) && mounted) {
            setMyStatus(savedStatus as any);
          }
        } catch { /* non-critical */ }

        // Initialize family store (skips internally if already initialized)
        await useFamilyStore.getState().initialize();

        // ELITE: Ensure BLE Mesh service is started for offline messaging
        if (bleMeshService && typeof bleMeshService.getIsRunning === 'function' && !bleMeshService.getIsRunning()) {
          try {
            await bleMeshService.start();
            if (__DEV__) {
              logger.info('BLE Mesh service started from FamilyScreen');
            }
          } catch (error) {
            logger.warn('BLE Mesh start failed (non-critical):', error);
          }
        }

        // Get device ID
        let deviceId = bleMeshService?.getMyDeviceId?.() ?? null;
        if (!deviceId) {
          deviceId = await getDeviceIdFromLib();
          if (deviceId && mounted) {
            useMeshStore.getState().setMyDeviceId(deviceId);
            setMyDeviceId(deviceId);
          }
        } else if (mounted) {
          setMyDeviceId(deviceId);
        }

        try {
          await identityService.initialize();
          if (mounted) {
            const qrPayload = identityService.getQRPayload();
            if (qrPayload) {
              setMySharePayload(qrPayload);
            }

            // Load persisted status from Firestore (cloud source of truth)
            const uid = identityService.getUid();
            if (uid) {
              try {
                const { getFirestoreInstanceAsync } = await import('../../services/firebase/FirebaseInstanceManager');
                const db = await getFirestoreInstanceAsync();
                if (db) {
                  const { doc, getDoc } = await import('firebase/firestore');
                  const statusDoc = await getDoc(doc(db, 'users', uid, 'status', 'current'));
                  if (statusDoc.exists() && mounted) {
                    const data = statusDoc.data();
                    const cloudStatus = data?.status;
                    if (cloudStatus && ['safe', 'need-help', 'critical', 'unknown'].includes(cloudStatus)) {
                      setMyStatus(cloudStatus as any);
                      try { DirectStorageRef.setString(getMyStatusStorageKey(), cloudStatus); } catch { /* non-critical */ }
                    }
                  }
                }
              } catch { /* offline — use local status */ }
            }
          }
        } catch (identityError) {
          logger.warn('Identity init failed in FamilyScreen (non-critical):', identityError);
        }
      } catch (error) {
        logger.error('Initialization error:', error);
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    init();

    return () => {
      mounted = false;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  // Separate effect for message listener - uses refs so no dependency issues
  useEffect(() => {
    if (!bleMeshService || typeof bleMeshService.onMessage !== 'function') return;

    // Listen for family status and location update messages
    const unsubscribeMessage = bleMeshService.onMessage(async (message: any) => {
      try {
        const content = message.content;
        if (typeof content !== 'string') return;

        // ELITE: Validate content length (prevent DoS)
        if (content.length > 10000) {
          logger.warn('Family message content too large or invalid, skipping');
          return;
        }

        // ELITE: Use safe JSON parsing with validation
        const { sanitizeJSON } = await import('../../utils/inputSanitizer');
        const messageData = sanitizeJSON(content);

        if (!messageData || typeof messageData !== 'object') {
          logger.debug('Family message is not valid JSON, skipping');
          return;
        }

        // Check if this is a family update message
        if (messageData.type === 'family_status_update' || messageData.type === 'family_location_update') {
          const normalizedCandidates = [
            typeof messageData.deviceId === 'string' ? messageData.deviceId.trim() : '',
            typeof messageData.senderUid === 'string' ? messageData.senderUid.trim() : '',
            typeof message.senderId === 'string' ? message.senderId.trim() : '',
          ].filter((value) => value.length > 0);

          if (normalizedCandidates.length === 0) return;

          const storeMembers = useFamilyStore.getState().members;
          const member = storeMembers.find((candidate: FamilyMember) =>
            normalizedCandidates.some((value) =>
              value === candidate.deviceId ||
              value === candidate.uid
            )
          );

          if (member) {
            const existing = pendingUpdatesRef.current.get(member.uid) || {};

            if (messageData.type === 'family_status_update' && messageData.status !== undefined) {
              const parsedStatus = parseIncomingFamilyStatus(messageData.status);
              if (parsedStatus) {
                existing.status = parsedStatus;
                if (__DEV__) {
                  logger.info(`Status update queued from ${member.name}: ${parsedStatus}`);
                }
              } else {
                logger.warn('Invalid status received in message:', messageData.status);
              }
            }

            const locationPayload = messageData.location && typeof messageData.location === 'object'
              ? {
                ...(messageData.location as Record<string, unknown>),
                timestamp: (messageData.location as Record<string, unknown>).timestamp ?? messageData.timestamp,
                battery: (messageData.location as Record<string, unknown>).battery ?? messageData.battery,
                batteryLevel: (messageData.location as Record<string, unknown>).batteryLevel ?? messageData.batteryLevel,
              }
              : messageData.location;
            const parsedLocation = parseIncomingFamilyLocation(locationPayload);
            if (parsedLocation) {
              existing.location = parsedLocation;
              if (__DEV__) {
                logger.info(`Location update queued from ${member.name}`);
              }
            } else if (messageData.location !== undefined && messageData.location !== null) {
              logger.warn('Invalid location data received:', messageData.location);
            }

            pendingUpdatesRef.current.set(member.uid, existing);

            if (updateTimeoutRef.current) {
              clearTimeout(updateTimeoutRef.current);
            }
            updateTimeoutRef.current = setTimeout(() => {
              applyPendingFamilyUpdates('debounce');
              updateTimeoutRef.current = null;
            }, 100);
          } else if (__DEV__) {
            logger.warn(`Received family update from unknown sender aliases: ${normalizedCandidates.join(', ')}`);
          }
        }

        // NOTE: SOS messages received via BLE Mesh are already handled by MeshNetworkService
        // which emits SOS_FULLSCREEN_ALERT_EVENT. Emitting here again causes DUPLICATE alerts.
        // The SOSFullScreenAlert component has a 30s dedup window, but if the signalId
        // differs (e.g., mesh_${Date.now()} vs BLE messageId), both alerts show.
        if (messageData.type === 'FAMILY_SOS' || messageData.type === 'SOS') {
          const senderName = messageData.senderName || 'Aile Üyesi';
          // Just log — MeshNetworkService already triggers the full-screen alert
          logger.warn(`SOS alert received via Mesh from ${senderName} (handled by MeshNetworkService)`);
        }
      } catch (error) {
        logger.error('Error processing family message:', error);
      }
    });

    return () => {
      if (typeof unsubscribeMessage === 'function') unsubscribeMessage();
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      applyPendingFamilyUpdates('cleanup');
    };
  }, [applyPendingFamilyUpdates]);

  // Location sharing effect — ensures tracking is active while screen is open
  // CRITICAL FIX: Previously the `isSharingLocation === true` branch was a no-op.
  // When the user restores from persisted state or re-opens the screen with sharing
  // already enabled, tracking must be started (startTracking is idempotent via consumer set).
  useEffect(() => {
    if (isSharingLocation && familyTrackingService) {
      familyTrackingService.startTracking(FAMILY_TRACKING_CONSUMER_ID).catch((e: unknown) => {
        logger.warn('Family screen: startTracking on mount failed:', e);
      });
    } else if (!isSharingLocation) {
      familyTrackingService?.stopTracking?.(FAMILY_TRACKING_CONSUMER_ID);
    }

    return () => {
      // Only remove the family-screen consumer; other consumers (init-auto-resume) keep tracking alive
      familyTrackingService?.stopTracking?.(FAMILY_TRACKING_CONSUMER_ID);
    };
  }, [isSharingLocation]);

  const getMemberConversationTargetId = useCallback((member: Pick<FamilyMember, 'uid' | 'deviceId'>): string => {
    const selfAliases = new Set<string>(
      [
        identityService.getUid(),
        myDeviceId,
        identityService.getMyId?.(),
        identityService.getIdentity?.()?.uid,
      ].filter((value): value is string => !!value && value.trim().length > 0),
    );

    const uid = member.uid?.trim();
    if (uid && !selfAliases.has(uid)) return uid;

    const deviceId = member.deviceId?.trim();
    if (deviceId && !selfAliases.has(deviceId)) return deviceId;

    return '';
  }, [myDeviceId]);

  const handleAddMember = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation.navigate('AddFamilyMember');
    } catch (error) {
      logger.error('Error navigating to AddFamilyMember:', error);
    }
  }, [navigation]);

  const handleShowMyId = useCallback(async () => {
    haptics.impactLight();

    if (!myDeviceId) {
      try {
        const deviceId = await getDeviceIdFromLib();
        if (deviceId) {
          setMyDeviceId(deviceId);
          useMeshStore.getState().setMyDeviceId(deviceId);
        }
      } catch (error) {
        logger.error('Failed to get device ID for modal:', error);
        Alert.alert('Hata', 'Device ID oluşturulamadı. Lütfen tekrar deneyin.');
        return;
      }
    }

    if (!mySharePayload) {
      try {
        await identityService.initialize();
        const qrPayload = identityService.getQRPayload();
        if (qrPayload) {
          setMySharePayload(qrPayload);
        }
      } catch (error) {
        logger.warn('Failed to refresh share payload (fallback to raw ID):', error);
      }
    }

    setShowIdModal(true);
  }, [myDeviceId, mySharePayload]);

  const getStatusColor = useCallback((status: FamilyMember['status']) => {
    switch (status) {
      case 'safe': return '#10b981';
      case 'need-help': return '#f59e0b';
      case 'critical': return '#ef4444';
      case 'danger': return '#dc2626';
      case 'offline': return '#94a3b8';
      default: return colors.text?.tertiary ?? '#64748b';
    }
  }, []);

  const getStatusText = useCallback((status: FamilyMember['status']) => {
    switch (status) {
      case 'safe': return 'Güvende';
      case 'need-help': return 'Yardım Gerekiyor';
      case 'critical': return 'ACİL DURUM';
      case 'danger': return 'TEHLİKEDE';
      case 'offline': return 'Çevrimdışı';
      default: return 'Bilinmiyor';
    }
  }, []);

  // ELITE: Memoize status counts for summary bar
  const statusCounts = useMemo(() => {
    const counts = { safe: 0, needHelp: 0, critical: 0, unknown: 0 };
    for (const m of members) {
      if (m.status === 'safe') counts.safe++;
      else if (m.status === 'need-help') counts.needHelp++;
      else if (m.status === 'critical' || m.status === 'danger') counts.critical++;
      else counts.unknown++;
    }
    return counts;
  }, [members]);

  const handleEditMember = useCallback((member: FamilyMember) => {
    setEditingMember(member);
    setShowEditModal(true);
  }, []);

  const handleDeleteMember = useCallback(async (memberId: string) => {
    const member = members.find((m: FamilyMember) => m.uid === memberId);
    const memberName = member?.name || 'Üye';

    try {
      await useFamilyStore.getState().removeMember(memberId);
      haptics.notificationSuccess();
      showToast(`${memberName} silindi`);
    } catch (error) {
      logger.error('Failed to delete member:', error);
      Alert.alert('Hata', 'Üye silinemedi. Lütfen tekrar deneyin.');
      haptics.notificationError?.();
    }
  }, [members, showToast]);

  // ELITE: Pull-to-refresh — force=true bypasses isInitialized guard
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await useFamilyStore.getState().initialize(true);
    } catch (error) {
      logger.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const { familyGroup, friendsGroup } = useMemo(() => {
    const family: FamilyMember[] = [];
    const friends: FamilyMember[] = [];
    for (const m of members) {
      if (m.relationship && FAMILY_RELATIONSHIPS.has(m.relationship)) {
        family.push(m);
      } else {
        friends.push(m);
      }
    }
    family.sort(sortByUrgency);
    friends.sort(sortByUrgency);
    return { familyGroup: family, friendsGroup: friends };
  }, [members]);

  const handleGroupChat = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation.navigate('FamilyGroupChat');
    } catch (error) {
      logger.error('Error navigating to FamilyGroupChat:', error);
    }
  }, [navigation]);

  // FlatList render item (memoized)
  const renderMemberItem = useCallback(({ item, index }: { item: FamilyMember; index: number }) => (
    <MemberCard
      member={item}
      index={index}
      onPress={() => {
        haptics.impactLight();
        navigation.navigate('Map', { focusOnMember: item.uid });
      }}
      onEdit={handleEditMember}
      onDelete={(memberId: string) => handleDeleteMember(memberId)}
      onMessage={(m: FamilyMember) => {
        haptics.impactLight();
        const conversationTargetId = getMemberConversationTargetId(m);
        if (conversationTargetId) {
          navigation.navigate('Conversation', {
            userId: conversationTargetId,
            userName: m.name,
          });
        } else {
          Alert.alert('Mesajlaşma Kimliği Yok', 'Bu üye için geçerli UID veya cihaz kimliği bulunamadı.');
        }
      }}
      onLocate={(m: FamilyMember) => {
        const resolvedLocation = resolveFamilyMemberLocation(m);
        if (resolvedLocation) {
          const lat = resolvedLocation.latitude;
          const lng = resolvedLocation.longitude;
          const url = Platform.select({
            ios: `maps:0,0?q=${lat},${lng}(${encodeURIComponent(m.name)})`,
            android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(m.name)})`,
          });
          if (url) {
            Linking.openURL(url).catch((err) => {
              logger.warn('Primary map URL failed in FamilyScreen:', err);
              Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`).catch((fallbackError) => {
                logger.error('Fallback map URL failed in FamilyScreen:', fallbackError);
              });
            });
          }
        } else {
          Alert.alert('Konum Yok', 'Bu üyenin konumu henüz paylaşılmamış.');
        }
      }}
    />
  ), [handleEditMember, handleDeleteMember, getMemberConversationTargetId, navigation]);

  const keyExtractor = useCallback((item: FamilyMember) => item.uid, []);

  // Responsive map height: 45% of screen height
  const mapHeight = Math.round(screenHeight * 0.45);

  return (
    <ImageBackground
      source={require('../../../../assets/images/premium/family_soft_bg.jpg')}
      style={styles.container}
      resizeMode="cover"
      testID="family-screen"
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.4)']}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Ailem</Text>
            <Text style={styles.headerSubtitle}>
              {members.length} Üye • {myStatusSubtitle}
            </Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <Pressable
            style={styles.headerButton}
            onPress={handleShowMyId}
            accessibilityRole="button"
            accessibilityLabel="ID Göster"
          >
            <Ionicons name="qr-code-outline" size={22} color="#334155" />
          </Pressable>
          <Pressable
            style={styles.addButton}
            onPress={handleAddMember}
            accessibilityRole="button"
            accessibilityLabel="Üye Ekle"
          >
            <Ionicons name="add" size={28} color="#334155" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          // Sprint 8: iPad — center content with max width to avoid stretched layout
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../../utils/responsive').getResponsiveInfo().isTablet && {
            alignSelf: 'center',
            width: '85%',
            maxWidth: 900,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#6366f1"
            colors={['#6366f1']}
          />
        }
      >
        {/* Loading skeleton while initializing */}
        {isInitializing ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={{ color: '#64748b', marginTop: 12, fontSize: 14 }}>Yükleniyor...</Text>
          </View>
        ) : (
          <>
            {/* ELITE F3: Pending contact requests (incoming family invites) */}
            {pendingRequests.length > 0 && (
              <View style={{
                marginBottom: 16,
                backgroundColor: '#fef3c7',
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: '#f59e0b',
                padding: 14,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Ionicons name="person-add" size={20} color="#b45309" />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#78350f', flex: 1 }}>
                    Bekleyen Kişi İstekleri ({pendingRequests.length})
                  </Text>
                </View>
                {pendingRequests.map((req) => {
                  const inFlight = requestActionInFlight[req.id];
                  return (
                    <View
                      key={req.id}
                      style={{
                        backgroundColor: '#fff',
                        borderRadius: 12,
                        padding: 12,
                        marginTop: 8,
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}>
                        {req.fromName || 'Bilinmeyen kişi'}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                        {req.message || `${req.fromName} sizi aile listesine eklemek istiyor.`}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${req.fromName} isteğini kabul et`}
                          disabled={!!inFlight}
                          onPress={() => handleAcceptRequest(req)}
                          style={{
                            flex: 1,
                            backgroundColor: inFlight === 'accept' ? '#86efac' : '#22c55e',
                            paddingVertical: 10,
                            borderRadius: 10,
                            alignItems: 'center',
                            opacity: inFlight ? 0.6 : 1,
                          }}
                        >
                          {inFlight === 'accept' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Kabul Et</Text>
                          )}
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${req.fromName} isteğini reddet`}
                          disabled={!!inFlight}
                          onPress={() => handleDeclineRequest(req)}
                          style={{
                            flex: 1,
                            backgroundColor: inFlight === 'decline' ? '#fca5a5' : '#fff',
                            borderWidth: 1.5,
                            borderColor: '#ef4444',
                            paddingVertical: 10,
                            borderRadius: 10,
                            alignItems: 'center',
                            opacity: inFlight ? 0.6 : 1,
                          }}
                        >
                          {inFlight === 'decline' ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                          ) : (
                            <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>Reddet</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Status Section — extracted to FamilyStatusSection */}
            <FamilyStatusSection
              myStatus={myStatus}
              onStatusChange={setMyStatus}
              isSharingLocation={isSharingLocation}
              onSharingLocationChange={setIsSharingLocation}
            />

            {/* Status Summary Bar */}
            {members.length > 0 && (
              <View style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 16,
                backgroundColor: 'rgba(255,255,255,0.6)',
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.8)',
              }}>
                {statusCounts.critical > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#ef4444' }}>{statusCounts.critical} Acil</Text>
                  </View>
                )}
                {statusCounts.needHelp > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#f59e0b' }}>{statusCounts.needHelp} Yardım</Text>
                  </View>
                )}
                {statusCounts.safe > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#22c55e' }}>{statusCounts.safe} Güvende</Text>
                  </View>
                )}
                {statusCounts.unknown > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8' }} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#94a3b8' }}>{statusCounts.unknown} Bilinmiyor</Text>
                  </View>
                )}
              </View>
            )}

            {/* Group Chat Button */}
            {members.length > 0 && (
              <View style={styles.groupChatSection}>
                <Pressable style={styles.groupChatButton} onPress={handleGroupChat}>
                  <LinearGradient
                    colors={[colors.brand?.primary ?? '#6366f1', colors.brand?.secondary ?? '#4f46e5']}
                    style={styles.groupChatGradient}
                  >
                    <Ionicons name="chatbubbles" size={24} color="#fff" />
                    <Text style={styles.groupChatText}>Aile Grubu Sohbeti</Text>
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                  </LinearGradient>
                </Pressable>
              </View>
            )}

            {/* Member List */}
            <View style={styles.membersSection}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.sectionTitle}>Kişiler</Text>
                  <View style={{
                    backgroundColor: '#6366f1',
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{members.length}</Text>
                  </View>
                </View>
                {/* Map/List toggle */}
                <Pressable
                  onPress={() => {
                    haptics.impactLight();
                    setViewMode(prev => prev === 'list' ? 'map' : 'list');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: viewMode === 'map' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.7)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: viewMode === 'map' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.9)',
                  }}
                >
                  <Ionicons
                    name={viewMode === 'map' ? 'list' : 'map'}
                    size={15}
                    color={viewMode === 'map' ? '#6366f1' : '#64748b'}
                  />
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: viewMode === 'map' ? '#6366f1' : '#64748b',
                    letterSpacing: 0.2,
                  }}>
                    {viewMode === 'map' ? 'Liste' : 'Harita'}
                  </Text>
                </Pressable>
              </View>

              {members.length > 0 ? (
                viewMode === 'map' ? (
                  /* ELITE V2: Interactive Family Map — responsive height */
                  <View style={{ height: mapHeight, borderRadius: 16, overflow: 'hidden', marginHorizontal: 4 }}>
                    <SafeFamilyMapView
                      members={members}
                      onMemberPress={(member: FamilyMember) => {
                        haptics.impactLight();
                        const targetId = getMemberConversationTargetId(member);
                        if (targetId) {
                          navigation.navigate('Conversation', { userId: targetId, userName: member.name });
                        } else {
                          Alert.alert('Bilgi', `${member.name} - Durum: ${getStatusText(member.status)}`);
                        }
                      }}
                      onCheckIn={(memberId: string) => {
                        haptics.impactMedium();
                        const member = members.find(
                          (m: FamilyMember) => m.uid === memberId || m.deviceId === memberId,
                        );
                        if (member) {
                          familyTrackingService?.requestCheckIn?.(memberId).catch((error: unknown) => {
                            logger.warn('Family check-in request failed from map card:', error);
                          });

                          const conversationTargetId = getMemberConversationTargetId(member);
                          if (conversationTargetId) {
                            navigation.navigate('Conversation', {
                              userId: conversationTargetId,
                              userName: member.name,
                            });
                          } else {
                            Alert.alert('Mesajlaşma Kimliği Yok', 'Bu üye için geçerli UID veya cihaz kimliği bulunamadı.');
                          }
                        }
                      }}
                    />
                  </View>
                ) : (
                  /* Grouped member list: Aile + Arkadaşlar with urgency sort */
                  <View style={styles.memberList}>
                    {familyGroup.length > 0 && (
                      <>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 8,
                          marginTop: 4,
                        }}>
                          <Ionicons name="people" size={16} color="#6366f1" />
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569', letterSpacing: 0.2 }}>
                            Aile ({familyGroup.length})
                          </Text>
                        </View>
                        {familyGroup.map((item: FamilyMember, index: number) => (
                          <View key={item.uid}>
                            {renderMemberItem({ item, index })}
                          </View>
                        ))}
                      </>
                    )}
                    {friendsGroup.length > 0 && (
                      <>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 8,
                          marginTop: familyGroup.length > 0 ? 16 : 4,
                        }}>
                          <Ionicons name="hand-right" size={16} color="#8b5cf6" />
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569', letterSpacing: 0.2 }}>
                            Arkadaşlar ({friendsGroup.length})
                          </Text>
                        </View>
                        {friendsGroup.map((item: FamilyMember, index: number) => (
                          <View key={item.uid}>
                            {renderMemberItem({ item, index: familyGroup.length + index })}
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Henüz üye eklenmemiş</Text>
                  <Text style={styles.emptySubtext}>
                    Aile üyelerinizi ekleyerek durumlarını takip edebilirsiniz.
                  </Text>
                  <GlassButton
                    title="Üye Ekle"
                    variant="primary"
                    icon="add-circle"
                    onPress={handleAddMember}
                    style={{ marginTop: 16, minWidth: 200 }}
                  />
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Toast notification */}
      <Toast message={toastMessage} visible={toastVisible} />

      {/* ID Share Modal — extracted to IdShareModal */}
      <IdShareModal
        visible={showIdModal}
        onClose={() => setShowIdModal(false)}
        myDeviceId={myDeviceId}
        mySharePayload={mySharePayload}
        onDeviceIdResolved={setMyDeviceId}
        onSharePayloadResolved={setMySharePayload}
        showToast={showToast}
      />

      {/* Edit Member Modal — extracted to EditMemberModal */}
      <EditMemberModal
        visible={showEditModal}
        member={editingMember}
        onClose={() => {
          setShowEditModal(false);
          setEditingMember(null);
        }}
      />

    </ImageBackground>
  );
}

// Diagnostic ErrorBoundary with detailed console logging
class FamilyScreenErrorCatcher extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      // Only log detailed crash info in development builds
      logger.error('FAMILY SCREEN CRASH:', error?.message);
      logger.error('STACK:', error?.stack);
      logger.error('COMPONENT STACK:', info?.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 20 }}>
          <Ionicons name="warning" size={48} color="#ff6b6b" />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 }}>
            Aile Ekranı Hatası
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
            {this.state.errorMsg}
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false, errorMsg: '' })}
            style={{ marginTop: 20, backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Tekrar Dene</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

// Default export wraps the screen in a diagnostic error boundary
export default function FamilyScreen(props: FamilyScreenProps) {
  return (
    <FamilyScreenErrorCatcher>
      <FamilyScreenInner {...props} />
    </FamilyScreenErrorCatcher>
  );
}
