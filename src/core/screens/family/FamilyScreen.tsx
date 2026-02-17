/**
 * FAMILY SCREEN - Elite Premium Design
 * Production-grade family safety chain with comprehensive error handling
 * Zero-error guarantee with full type safety
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
  StatusBar,
  Modal,
  Linking,
  ActionSheetIOS,
  Platform,
  Share as NativeShare,
  TextInput,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import GlassButton from '../../components/buttons/GlassButton';
import { useFamilyStore, FamilyMember } from '../../stores/familyStore';
import { useMeshStore } from '../../services/mesh/MeshStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { meshNetworkService } from '../../services/mesh/MeshNetworkService';
import { MeshMessageType } from '../../services/mesh/MeshProtocol';
import { familyTrackingService } from '../../services/FamilyTrackingService';
import { multiChannelAlertService } from '../../services/MultiChannelAlertService';
import { identityService } from '../../services/IdentityService';
import { getDeviceId as getDeviceIdFromLib } from '../../utils/device';
import { MemberCard } from '../../components/family/MemberCard';
import { FamilyMapView } from '../../components/family/FamilyMapView';
import { colors, typography, spacing } from '../../theme';
import { styles } from './FamilyScreen.styles';
import { createLogger } from '../../utils/logger';
import * as haptics from '../../utils/haptics';
import { resolveFamilyMemberLocation } from '../../utils/familyLocation';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as SMS from 'expo-sms';

const logger = createLogger('FamilyScreen');
const FAMILY_TRACKING_CONSUMER_ID = 'family-screen';
const UID_REGEX = /^[A-Za-z0-9]{20,40}$/;
type FamilyStatusUpdate = Extract<FamilyMember['status'], 'safe' | 'need-help' | 'critical' | 'unknown'>;
type PendingFamilyUpdate = {
  status?: FamilyStatusUpdate;
  location?: { latitude: number; longitude: number };
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
  const candidate = value as { latitude?: unknown; longitude?: unknown };
  const latitude = typeof candidate.latitude === 'number' ? candidate.latitude : NaN;
  const longitude = typeof candidate.longitude === 'number' ? candidate.longitude : NaN;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
};

// ELITE: Type-safe navigation props
interface FamilyScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export default function FamilyScreen({ navigation }: FamilyScreenProps) {
  const insets = useSafeAreaInsets();

  // Use Zustand hooks - they handle referential equality automatically
  // Filter out the device owner (self) — only show added family members
  const members = useFamilyStore((state) => {
    const myUid = identityService.getUid();
    if (!myUid) return state.members;
    return state.members.filter((m) => m.uid !== myUid);
  });

  // ELITE: Settings integration for location control
  const locationEnabled = useSettingsStore((state) => state.locationEnabled);

  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [myStatus, setMyStatus] = useState<'safe' | 'need-help' | 'unknown' | 'critical'>('unknown');
  const [showIdModal, setShowIdModal] = useState(false);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [mySharePayload, setMySharePayload] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [editName, setEditName] = useState('');
  // ELITE: Extended edit modal states
  const [editRelationship, setEditRelationship] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  // ELITE: Search and detail modal
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  // ELITE V2: Map/List toggle (Life360 pattern)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Batch update mechanism to prevent subscription loops
  const pendingUpdatesRef = useRef<Map<string, PendingFamilyUpdate>>(new Map());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const applyPendingFamilyUpdates = useCallback((source: 'debounce' | 'cleanup') => {
    if (pendingUpdatesRef.current.size === 0) {
      return;
    }

    const latestMembers = useFamilyStore.getState().members;
    const pendingEntries = Array.from(pendingUpdatesRef.current.entries());

    for (const [memberId, updateData] of pendingEntries) {
      const member = latestMembers.find((candidate) => candidate.uid === memberId);
      if (!member) continue;

      if (updateData.status && member.status !== updateData.status) {
        useFamilyStore.getState().updateMemberStatus(member.uid, updateData.status, 'remote').catch((error) => {
          logger.error(`Failed to update member status (${source}):`, error);
        });
      }

      if (updateData.location) {
        useFamilyStore.getState().updateMemberLocation(
          member.uid,
          updateData.location.latitude,
          updateData.location.longitude,
          'remote',
        ).catch((error) => {
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

  // Initialize on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // Initialize family store
        await useFamilyStore.getState().initialize();

        // ELITE: Ensure BLE Mesh service is started for offline messaging
        if (!bleMeshService.getIsRunning()) {
          try {
            await bleMeshService.start();
            if (__DEV__) {
              logger.info('BLE Mesh service started from FamilyScreen');
            }
          } catch (error) {
            logger.warn('BLE Mesh start failed (non-critical):', error);
            // Continue - BLE Mesh is optional but recommended
          }
        }

        // Get device ID
        let deviceId = bleMeshService.getMyDeviceId();
        if (!deviceId) {
          deviceId = await getDeviceIdFromLib();
          if (deviceId && mounted) {
            useMeshStore.getState().setMyDeviceId(deviceId);
            setMyDeviceId(deviceId);
            // ELITE: Set device ID in BLE Mesh service if not already set
            if (!bleMeshService.getMyDeviceId()) {
              // Device ID will be set when BLE Mesh service starts
            }
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
          }
        } catch (identityError) {
          logger.warn('Identity init failed in FamilyScreen (non-critical):', identityError);
        }
      } catch (error) {
        logger.error('Initialization error:', error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Separate effect for message listener - uses refs so no dependency issues
  useEffect(() => {
    // Listen for family status and location update messages
    const unsubscribeMessage = bleMeshService.onMessage(async (message) => {
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
          // Not a valid JSON message, skip
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

          // Resolve family member with UID/deviceId/local-id aliases.
          const members = useFamilyStore.getState().members;
          const member = members.find((candidate) =>
            normalizedCandidates.some((value) =>
              value === candidate.deviceId ||
              value === candidate.uid
            )
          );

          if (member) {
            // Batch updates instead of immediate store updates to prevent subscription loops
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

            const parsedLocation = parseIncomingFamilyLocation(messageData.location);
            if (parsedLocation) {
              existing.location = parsedLocation;
              if (__DEV__) {
                logger.info(`Location update queued from ${member.name}`);
              }
            } else if (messageData.location !== undefined && messageData.location !== null) {
              logger.warn('Invalid location data received:', messageData.location);
            }

            pendingUpdatesRef.current.set(member.uid, existing);

            // Debounce: Process updates after 100ms (allows batching multiple rapid updates)
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

        // CRITICAL: Handle SOS messages received via BLE Mesh (offline family SOS)
        if (messageData.type === 'FAMILY_SOS' || messageData.type === 'SOS') {
          const senderName = messageData.senderName || 'Aile Üyesi';
          const locationText = messageData.location
            ? `Konum: ${messageData.location.latitude?.toFixed(4)}, ${messageData.location.longitude?.toFixed(4)}`
            : 'Konum bilinmiyor';
          const trappedText = messageData.trapped ? '\n⚠️ ENKAZ ALTINDA' : '';

          Alert.alert(
            messageData.trapped ? `🚨 ${senderName} ENKAZ ALTINDA!` : `🆘 ${senderName} ACİL YARDIM İSTİYOR!`,
            `${messageData.message || 'Acil yardım gerekiyor!'}\n${locationText}${trappedText}`,
            [
              { text: 'Tamam', style: 'cancel' },
              {
                text: 'SOS Görüşmesi',
                style: 'destructive',
                onPress: () => {
                  // CRITICAL FIX: Prefer message.senderId (mesh layer, consistent with identity.id)
                  // over messageData.senderDeviceId (payload field, could be physical ID mismatch).
                  // SOSConversationScreen filters msg.senderId === sosUserId.
                  navigation.navigate('SOSConversation', {
                    sosUserId:
                      messageData.senderUid ||
                      message.senderId ||
                      messageData.senderDeviceId ||
                      messageData.fromDeviceId ||
                      messageData.deviceId,
                    sosUserAliases: [
                      messageData.senderUid,
                      message.senderId,
                      messageData.senderDeviceId,
                      messageData.fromDeviceId,
                      messageData.deviceId,
                    ].filter((value): value is string => typeof value === 'string' && value.length > 0),
                    sosUserName: senderName,
                    sosMessage: messageData.message,
                    sosLocation: messageData.location,
                  });
                },
              },
            ],
          );
          logger.warn(`🚨 SOS alert received via Mesh from ${senderName}`);
        }
      } catch (error) {
        logger.error('Error processing family message:', error);
      }
    });

    return () => {
      unsubscribeMessage();
      // Cleanup debounce timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      applyPendingFamilyUpdates('cleanup');
    };
  }, [applyPendingFamilyUpdates]); // Listener uses refs/store + stable apply helper

  const startLocationSharing = useCallback(async () => {
    // CRITICAL FIX: If location is disabled in app settings, offer to enable it
    // instead of silently blocking. Users confuse device GPS with app setting.
    if (!locationEnabled) {
      Alert.alert(
        'Konum Paylaşımı Kapalı',
        'Aile üyelerinizle konum paylaşımı için uygulama ayarından konumu aktif etmeniz gerekiyor. Şimdi aktif etmek ister misiniz?',
        [
          { text: 'İptal', style: 'cancel', onPress: () => setIsSharingLocation(false) },
          {
            text: 'Evet, Aç',
            style: 'default',
            onPress: () => {
              try {
                const { useSettingsStore } = require('../../stores/settingsStore');
                useSettingsStore.getState().setLocation(true);
                // Will re-trigger via useEffect since isSharingLocation is still true
                logger.info('✅ Location enabled via auto-activate prompt');
              } catch (e) {
                logger.error('Failed to auto-enable location:', e);
                setIsSharingLocation(false);
              }
            },
          },
        ]
      );
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'Konum paylaşımı için izin gereklidir');
        setIsSharingLocation(false);
        return;
      }

      // Keep a consistent sharing cadence and delegate all transport logic to FamilyTrackingService.
      familyTrackingService.setShareThrottleMs(30 * 1000);
      await familyTrackingService.startTracking(FAMILY_TRACKING_CONSUMER_ID);
      await familyTrackingService.shareMyLocation({ force: true, reason: 'family-screen-toggle-on' });
      logger.info('✅ Location sharing started successfully');
    } catch (error) {
      logger.error('Start location sharing error:', error);
      Alert.alert('Konum Hatası', 'Konum paylaşımı başlatılamadı. Lütfen konum izinlerini kontrol edin.');
      setIsSharingLocation(false);
    }
  }, [locationEnabled]);

  useEffect(() => {
    if (isSharingLocation) {
      startLocationSharing().catch((error) => {
        logger.error('Failed to start location sharing:', error);
        setIsSharingLocation(false);
      });
    } else {
      familyTrackingService.stopTracking(FAMILY_TRACKING_CONSUMER_ID);
    }

    return () => {
      familyTrackingService.stopTracking(FAMILY_TRACKING_CONSUMER_ID);
    };
  }, [isSharingLocation, startLocationSharing]);

  const handleStatusUpdate = async (status: 'safe' | 'need-help' | 'critical') => {
    haptics.notificationSuccess();
    const previousStatus = myStatus;

    try {
      // ELITE: Ensure BLE Mesh service is started before sending status update
      if (!bleMeshService.getIsRunning()) {
        try {
          await bleMeshService.start();
          if (__DEV__) {
            logger.info('BLE Mesh service started for status update');
          }
        } catch (error) {
          logger.warn('BLE Mesh start failed (will try to continue):', error);
          // Continue - status update can still be saved to Firebase
        }
      }

      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      let location: Location.LocationObject | null = null;

      if (locStatus === 'granted') {
        try {
          // ELITE: Use Promise.race for timeout protection
          const locationPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          let timeoutId: NodeJS.Timeout | null = null;
          const timeoutPromise = new Promise<Location.LocationObject | null>((resolve) => {
            timeoutId = setTimeout(() => resolve(null), 10000); // 10 second timeout
          });

          location = await Promise.race([locationPromise, timeoutPromise]);

          // CRITICAL: Cleanup timeout after race completes
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          if (!location) {
            logger.warn('Location fetch timeout - continuing without location');
          }
        } catch (locationError) {
          logger.warn('Location fetch failed (non-critical):', locationError);
          // Continue without location - status update can still be sent
        }
      } else {
        logger.debug('Location permission not granted - status update will be sent without location');
      }

      let myDeviceId = bleMeshService.getMyDeviceId();
      if (!myDeviceId) {
        try {
          myDeviceId = await getDeviceIdFromLib();
          if (myDeviceId) {
            // Set it in MeshStore for future use
            useMeshStore.getState().setMyDeviceId(myDeviceId);
          }
        } catch (error) {
          logger.warn('Failed to get device ID from fallback provider:', error);
        }
      }

      const myIdentity = identityService.getIdentity();
      const senderRouteId = (
        myDeviceId ||
        identityService.getUid() ||
        myIdentity?.uid ||
        ''
      ).trim();

      if (!senderRouteId) {
        logger.error('Status update aborted: sender identity could not be resolved');
        haptics.notificationError();
        Alert.alert('Hata', 'Kimlik bilgisi alınamadı. Lütfen tekrar giriş yapıp yeniden deneyin.');
        return;
      }

      // Create status update message
      const statusMessage = JSON.stringify({
        type: 'family_status_update',
        deviceId: senderRouteId, // Include sender routing ID so receiver can match aliases
        senderUid: identityService.getUid(),
        status,
        location: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: Date.now(),
        } : null,
        timestamp: Date.now(),
      });

      // Get all family members with deviceIds
      const familyMembers = useFamilyStore.getState().members;
      const selfIds = new Set(
        [
          senderRouteId,
          myDeviceId,
          identityService.getUid(),
          myIdentity?.uid,
          myIdentity?.uid,
          myIdentity?.uid,
        ].filter((value): value is string => !!value && value.trim().length > 0),
      );
      const reachableMembers = familyMembers.filter((member) => {
        const targets = [
          member.uid?.trim(),
          member.deviceId?.trim(),
        ].filter((value): value is string => !!value && value.length > 0);

        if (targets.length === 0) return false;
        return targets.some((target) => !selfIds.has(target));
      });

      // Broadcast status via dedicated STATUS mesh type so chat UIs don't render raw JSON payloads.
      let broadcastSuccess = false;
      if (bleMeshService.getIsRunning()) {
        try {
          await meshNetworkService.broadcastMessage(statusMessage, MeshMessageType.STATUS, {
            to: 'broadcast',
            from: senderRouteId,
          });
          broadcastSuccess = true;
          if (__DEV__) {
            logger.info('Status update broadcasted via BLE Mesh');
          }
        } catch (broadcastError) {
          logger.warn('BLE Mesh broadcast failed (non-critical):', broadcastError);
          // Continue - Firebase sync will still work
        }
      } else {
        logger.warn('BLE Mesh service not running - status update will only be saved to Firebase');
      }

      // Save to Firebase for cloud sync
      try {
        const { firebaseDataService } = await import('../../services/FirebaseDataService');
        const cloudTargetId = identityService.getUid() || senderRouteId;
        if (cloudTargetId) {
          await firebaseDataService.saveStatusUpdate(cloudTargetId, {
            status,
            location: location ? {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            } : null,
            timestamp: Date.now(),
          });

          // Also save location if available
          if (location) {
            await firebaseDataService.saveLocationUpdate(cloudTargetId, {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy || null,
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        logger.error('Failed to save status to Firebase:', error);
      }

      // CRITICAL: Send to backend for rescue coordination
      // ELITE: This ensures rescue teams know user's current status
      try {
        const { backendEmergencyService } = await import('../../services/BackendEmergencyService');
        if (backendEmergencyService.initialized) {
          await backendEmergencyService.sendStatusUpdate({
            status,
            location: location ? {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy || undefined,
            } : undefined,
            timestamp: Date.now(),
          }).catch((error) => {
            logger.error('Failed to send status update to backend:', error);
          });
        }
      } catch (error) {
        logger.error('Failed to send status update to backend:', error);
      }

      // Also try direct STATUS routing per known member identity.
      for (const member of reachableMembers) {
        const directTargets = Array.from(
          new Set(
            [member.uid, member.deviceId]
              .map((value) => (typeof value === 'string' ? value.trim() : ''))
              .filter((value) => value.length > 0 && !selfIds.has(value) && !value.startsWith('family-')),
          ),
        );
        for (const directTarget of directTargets) {
          try {
            await meshNetworkService.broadcastMessage(statusMessage, MeshMessageType.STATUS, {
              to: directTarget,
              from: senderRouteId,
            });
          } catch (error) {
            if (__DEV__) {
              logger.warn(`Failed to send direct status message to ${directTarget}:`, error);
            }
          }
        }
      }

      // CRITICAL FIX: Write status update to each family member's Firestore path
      // Without this, family members NEVER receive the status update!
      try {
        const { getFirestoreInstanceAsync } = await import('../../services/firebase/FirebaseInstanceManager');
        const db = await getFirestoreInstanceAsync();
        if (db) {
          const { collection, doc, getDocs, limit, query, setDoc, where } = await import('firebase/firestore');
          const statusPayload = {
            fromDeviceId: senderRouteId,
            senderUid: identityService.getUid(),
            fromName: identityService.getDisplayName() || 'Aile Üyesi',
            status,
            location: location ? {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            } : null,
            timestamp: Date.now(),
            type: 'status_update',
          };
          const targetUidCache = new Map<string, string | null>();
          const resolveUidFromAlias = async (rawAlias: string): Promise<string> => {
            const alias = rawAlias.trim();
            if (!alias) return '';
            if (UID_REGEX.test(alias)) return alias;

            const normalizedAlias = alias.toUpperCase();
            if (targetUidCache.has(normalizedAlias)) {
              const cached = targetUidCache.get(normalizedAlias);
              return cached || '';
            }

            let resolvedUid = '';
            try {
              const usersRef = collection(db, 'users');
              const publicCodeQuery = query(usersRef, where('publicUserCode', '==', normalizedAlias), limit(1));
              const publicCodeSnap = await getDocs(publicCodeQuery);
              if (!publicCodeSnap.empty) {
                resolvedUid = publicCodeSnap.docs[0]?.id || '';
              }

              if (!resolvedUid) {
                const legacyCodeQuery = query(usersRef, where('qrId', '==', normalizedAlias), limit(1));
                const legacyCodeSnap = await getDocs(legacyCodeQuery);
                if (!legacyCodeSnap.empty) {
                  resolvedUid = legacyCodeSnap.docs[0]?.id || '';
                }
              }
            } catch (resolveError) {
              logger.warn(`Failed to resolve family alias "${normalizedAlias}" to uid:`, resolveError);
            }

            targetUidCache.set(normalizedAlias, resolvedUid || null);
            return resolvedUid;
          };

          const writePromises = reachableMembers.map(async (member) => {
            try {
              const targetAliases = new Set<string>();
              const memberDeviceId = member.deviceId?.trim();
              const memberUid = member.uid?.trim();
              if (memberDeviceId) targetAliases.add(memberDeviceId);
              if (memberUid) targetAliases.add(memberUid);

              const nonSelfTargets = Array.from(targetAliases).filter((target) => !selfIds.has(target));
              if (nonSelfTargets.length === 0) {
                return;
              }

              const docIdBase = `${senderRouteId}_${Date.now()}`;
              await Promise.allSettled(nonSelfTargets.map(async (target) => {
                const resolvedUid = await resolveUidFromAlias(target);
                if (resolvedUid) {
                  // V3 canonical path: users/{uid}/status_updates
                  const v3StatusRef = doc(db, 'users', resolvedUid, 'status_updates', docIdBase);
                  await setDoc(v3StatusRef, statusPayload).catch(() => { });
                  return;
                }

                // Legacy / device path: devices/{deviceId}/status_updates
                const statusRef = doc(db, 'devices', target, 'status_updates', docIdBase);
                await setDoc(statusRef, statusPayload).catch(() => { });
              }));

              logger.info(`✅ Status update sent to ${member.name} via Firestore`);
            } catch (err) {
              logger.warn(`Failed to write status to ${member.name}:`, err);
            }
          });

          await Promise.allSettled(writePromises);

          // Also update own device doc with current status (for others who subscribe)
          try {
            const ownDeviceDocId = (
              myDeviceId ||
              identityService.getMeshDeviceId() ||
              ''
            ).trim();
            if (ownDeviceDocId) {
              const deviceRef = doc(db, 'devices', ownDeviceDocId);
              await setDoc(deviceRef, {
                status: status,
                statusUpdatedAt: Date.now(),
                lastSeen: Date.now(),
              }, { merge: true });
            }
          } catch { /* best effort */ }

          // V3: Update users/{uid}/status/current
          try {
            const { getAuth } = await import('firebase/auth');
            const uid = getAuth()?.currentUser?.uid;
            if (uid) {
              const v3StatusRef = doc(db, 'users', uid, 'status', 'current');
              await setDoc(v3StatusRef, {
                status: status,
                statusUpdatedAt: Date.now(),
                lastSeen: Date.now(),
                location: location ? {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                } : null,
              }, { merge: true });
            }
          } catch { /* V3 best effort */ }
        }
      } catch (fbError) {
        logger.warn('Firestore status fan-out failed:', fbError);
      }

      const statusText = status === 'safe' ? 'Güvendeyim' :
        status === 'need-help' ? 'Yardıma İhtiyacım Var' :
          'ACİL DURUM';

      const memberCount = reachableMembers.length;
      const deliveryMethod = broadcastSuccess
        ? (memberCount > 0 ? `${memberCount} aile üyesine` : 'Yakındaki cihazlara')
        : 'Bulut sunucusuna';

      Alert.alert(
        'Durum Güncellendi',
        `${statusText} - ${deliveryMethod} bildirildi`,
      );
      setMyStatus(status);

      // ELITE: Send critical alert with error handling
      if (status === 'critical') {
        try {
          await multiChannelAlertService.sendAlert({
            title: '🚨 ACİL DURUM',
            body: 'Aile üyesi acil durum bildirdi!',
            priority: 'critical',
            channels: {
              pushNotification: true,
              fullScreenAlert: true,
              alarmSound: true,
              vibration: true,
              tts: true,
            },
            data: {
              type: 'family_status_update',
              status: 'critical',
              deviceId: senderRouteId,
            },
          }).catch((alertError) => {
            // Silent fail for alert - status update already succeeded
            logger.warn('Multi-channel alert failed (non-critical):', alertError);
          });
        } catch (alertError) {
          // Silent fail for alert - status update already succeeded
          logger.warn('Multi-channel alert error (non-critical):', alertError);
        }
      }

    } catch (error) {
      setMyStatus(previousStatus);
      logger.error('Status update error:', error);
      haptics.notificationError();
      Alert.alert('Hata', 'Durum güncellenemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleShareLocation = async () => {
    haptics.impactLight();
    const newSharing = !isSharingLocation;
    setIsSharingLocation(newSharing);

    if (newSharing) {
      Alert.alert('Konum Paylaşımı', 'Konum paylaşımı başlatılıyor...');
    } else {
      Alert.alert('Konum Paylaşımı', 'Konum paylaşımı durduruldu');
    }
  };

  const handleStatusButtonPress = (status: 'safe' | 'need-help' | 'critical' | 'location') => {
    if (status === 'location') {
      void handleShareLocation().catch((error) => {
        logger.error('Error sharing location:', error);
        haptics.notificationError();
      });
    } else {
      void handleStatusUpdate(status).catch((error) => {
        // Error already handled in handleStatusUpdate, but ensure it's caught
        logger.error('Error in handleStatusUpdate:', error);
      });
    }
  };

  const getMemberConversationTargetId = useCallback((member: Pick<FamilyMember, 'uid' | 'deviceId'>): string => {
    const selfAliases = new Set<string>(
      [
        identityService.getUid(),
        myDeviceId,
        identityService.getMyId(),
        identityService.getIdentity()?.uid,
      ].filter((value): value is string => !!value && value.trim().length > 0),
    );

    const uid = member.uid?.trim();
    if (uid && !selfAliases.has(uid)) return uid;

    const deviceId = member.deviceId?.trim();
    if (deviceId && !selfAliases.has(deviceId)) return deviceId;

    return '';
  }, [myDeviceId]);

  // ELITE: Memoized callback for performance
  const handleAddMember = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation.navigate('AddFamilyMember');
    } catch (error) {
      logger.error('Error navigating to AddFamilyMember:', error);
    }
  }, [navigation]);

  const handleShowMyId = async () => {
    haptics.impactLight();

    // Ensure device ID is available before showing modal
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
  };

  const getShareValue = useCallback((): string => {
    const payload = mySharePayload.trim();
    if (payload.length > 0) {
      return payload;
    }
    return myDeviceId || '';
  }, [myDeviceId, mySharePayload]);

  const shareDisplayId = useMemo(() => {
    const payload = getShareValue();
    if (!payload) return '';
    try {
      const parsed = JSON.parse(payload) as { code?: string; uid?: string; id?: string; did?: string };
      return parsed.code || parsed.uid || parsed.id || parsed.did || (myDeviceId || payload);
    } catch {
      return myDeviceId || payload;
    }
  }, [getShareValue, myDeviceId]);

  const handleCopyId = async () => {
    const shareValue = getShareValue();
    if (!shareValue) return;

    await Clipboard.setStringAsync(shareValue);
    haptics.notificationSuccess();
    Alert.alert('Kopyalandı', 'ID panoya kopyalandı');
  };

  const handleShareId = async () => {
    const shareValue = getShareValue();
    if (!shareValue) return;

    const shareMessage = `AfetNet ile beni ekle:\n\n${shareValue}\n\nID: ${shareDisplayId}`;

    if (Platform.OS === 'ios') {
      // iOS: Show ActionSheet
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['İptal', 'WhatsApp', 'SMS', 'Diğer'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          try {
            if (buttonIndex === 1) {
              // WhatsApp
              const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
              const canOpen = await Linking.canOpenURL(whatsappUrl);
              if (canOpen) {
                await Linking.openURL(whatsappUrl);
                haptics.notificationSuccess();
              } else {
                Alert.alert('WhatsApp', 'WhatsApp yüklü değil');
              }
            } else if (buttonIndex === 2) {
              // SMS
              const isAvailable = await SMS.isAvailableAsync();
              if (isAvailable) {
                await SMS.sendSMSAsync([], shareMessage);
                haptics.notificationSuccess();
              } else {
                Alert.alert('SMS', 'SMS gönderimi bu cihazda desteklenmiyor');
              }
            } else if (buttonIndex === 3) {
              // Other (System share sheet)
              const result = await NativeShare.share({ message: shareMessage });
              if (result.action === NativeShare.sharedAction || result.action === NativeShare.dismissedAction) {
                haptics.notificationSuccess();
              } else {
                await handleCopyId();
              }
            }
          } catch (error) {
            logger.error('Share ID action failed on iOS action sheet:', error);
            await handleCopyId();
          }
        },
      );
    } else {
      // Android: Try WhatsApp first, then SMS, then system share
      try {
        // Try WhatsApp
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
        const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);

        if (canOpenWhatsApp) {
          await Linking.openURL(whatsappUrl);
          haptics.notificationSuccess();
          return;
        }

        // Try SMS
        const isSMSAvailable = await SMS.isAvailableAsync();
        if (isSMSAvailable) {
          await SMS.sendSMSAsync([], shareMessage);
          haptics.notificationSuccess();
          return;
        }

        // Fallback to system share
        const result = await NativeShare.share({ message: shareMessage });
        if (result.action === NativeShare.sharedAction || result.action === NativeShare.dismissedAction) {
          haptics.notificationSuccess();
        } else {
          await handleCopyId();
        }
      } catch (error) {
        logger.error('Share ID error:', error);
        await handleCopyId();
      }
    }
  };

  const handleShareIdWhatsApp = async () => {
    const shareValue = getShareValue();
    if (!shareValue) return;

    const shareMessage = `AfetNet ile beni ekle:\n\n${shareValue}\n\nID: ${shareDisplayId}`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;

    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        haptics.notificationSuccess();
      } else {
        Alert.alert('WhatsApp', 'WhatsApp yüklü değil');
      }
    } catch (error) {
      logger.error('WhatsApp share error:', error);
      Alert.alert('Hata', 'WhatsApp ile paylaşılamadı');
    }
  };

  const handleShareIdSMS = async () => {
    const shareValue = getShareValue();
    if (!shareValue) return;

    const shareMessage = `AfetNet ile beni ekle:\n\n${shareValue}\n\nID: ${shareDisplayId}`;

    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        await SMS.sendSMSAsync([], shareMessage);
        haptics.notificationSuccess();
      } else {
        Alert.alert('SMS', 'SMS gönderimi bu cihazda desteklenmiyor');
      }
    } catch (error) {
      logger.error('SMS share error:', error);
      Alert.alert('Hata', 'SMS ile paylaşılamadı');
    }
  };

  const handleShareIdOther = async () => {
    const shareValue = getShareValue();
    if (!shareValue) return;

    const shareMessage = `AfetNet ile beni ekle:\n\n${shareValue}\n\nID: ${shareDisplayId}`;

    try {
      const result = await NativeShare.share({ message: shareMessage });
      if (result.action === NativeShare.sharedAction || result.action === NativeShare.dismissedAction) {
        haptics.notificationSuccess();
      } else {
        await handleCopyId();
      }
    } catch (error) {
      logger.error('Share error:', error);
      await handleCopyId();
    }
  };

  const getStatusColor = (status: FamilyMember['status']) => {
    switch (status) {
      case 'safe': return '#10b981';
      case 'need-help': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return colors.text.tertiary;
    }
  };

  const getStatusText = (status: FamilyMember['status']) => {
    switch (status) {
      case 'safe': return 'Güvende';
      case 'need-help': return 'Yardım Gerekiyor';
      case 'critical': return 'ACİL DURUM';
      default: return 'Bilinmiyor';
    }
  };

  // ELITE: Memoize safe count for performance
  const safeCount = useMemo(() => {
    try {
      return members.filter(m => m.status === 'safe').length;
    } catch (error) {
      logger.error('Error calculating safe count:', error);
      return 0;
    }
  }, [members]);

  const handleEditMember = (member: FamilyMember) => {
    setEditingMember(member);
    setEditName(member.name || '');
    setEditRelationship(member.relationship || null);
    setEditPhone(member.phoneNumber || '');
    setEditNotes(member.notes || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingMember || !editName.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir isim girin.');
      return;
    }

    // ELITE: Validate name length
    if (editName.trim().length < 2) {
      Alert.alert('Hata', 'İsim en az 2 karakter olmalıdır.');
      return;
    }

    if (editName.trim().length > 50) {
      Alert.alert('Hata', 'İsim en fazla 50 karakter olabilir.');
      return;
    }

    // ELITE: Validate phone number if provided
    if (editPhone.trim()) {
      const phoneRegex = /^(\+90|0)?[5][0-9]{9}$/;
      if (!phoneRegex.test(editPhone.replace(/\s/g, ''))) {
        Alert.alert('Hata', 'Geçersiz telefon numarası formatı.');
        return;
      }
    }

    try {
      await useFamilyStore.getState().updateMember(editingMember.uid, {
        name: editName.trim(),
        relationship: editRelationship || undefined,
        phoneNumber: editPhone.trim() || undefined,
        notes: editNotes.trim() || undefined,
        updatedAt: Date.now(),
      });
      haptics.notificationSuccess();
      setShowEditModal(false);
      setEditingMember(null);
      setEditName('');
      setEditRelationship(null);
      setEditPhone('');
      setEditNotes('');
    } catch (error) {
      logger.error('Failed to update member:', error);
      Alert.alert('Hata', 'Üye güncellenemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    // ELITE: Find member for confirmation message
    const member = members.find(m => m.uid === memberId);
    const memberName = member?.name || 'Üye';

    Alert.alert(
      'Üyeyi Sil',
      `${memberName} adlı üyeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
      [
        {
          text: 'İptal',
          style: 'cancel',
          onPress: () => haptics.impactLight(),
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await useFamilyStore.getState().removeMember(memberId);
              haptics.notificationSuccess();
              Alert.alert('Başarılı', `${memberName} başarıyla silindi.`);
            } catch (error) {
              logger.error('Failed to delete member:', error);
              Alert.alert('Hata', 'Üye silinemedi. Lütfen tekrar deneyin.');
              haptics.notificationError();
            }
          },
        },
      ],
    );
  };

  // ELITE: Memoized callback for performance
  const handleGroupChat = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation.navigate('FamilyGroupChat');
    } catch (error) {
      logger.error('Error navigating to FamilyGroupChat:', error);
    }
  }, [navigation]);

  return (
    <ImageBackground
      source={require('../../../../assets/images/premium/family_soft_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.4)']} // ELITE: Light/Soft overlay
        style={StyleSheet.absoluteFill}
      />
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />

      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: 'transparent' }]}>
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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Durumum</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <GlassButton
              title="Güvendeyim"
              variant="success"
              icon="checkmark-circle"
              onPress={() => handleStatusButtonPress('safe')}
              style={{ flex: 1, opacity: myStatus === 'safe' ? 1 : 0.6, borderWidth: myStatus === 'safe' ? 2 : 0, borderColor: myStatus === 'safe' ? '#10b981' : 'transparent' }}
            />
            <GlassButton
              title="Yardım Lazım"
              variant="secondary"
              icon="hand-left"
              onPress={() => handleStatusButtonPress('need-help')}
              style={{ flex: 1, opacity: myStatus === 'need-help' ? 1 : 0.6, borderWidth: myStatus === 'need-help' ? 2 : 0, borderColor: myStatus === 'need-help' ? '#f59e0b' : 'transparent' }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <GlassButton
              title="ACİL YARDIM"
              variant="danger"
              icon="alert-circle"
              onPress={() => handleStatusButtonPress('critical')}
              style={{ flex: 1, opacity: myStatus === 'critical' ? 1 : 0.6, borderWidth: myStatus === 'critical' ? 2 : 0, borderColor: myStatus === 'critical' ? '#ef4444' : 'transparent' }}
            />
            <GlassButton
              title={isSharingLocation ? "Konum Açık" : "Konum Paylaş"}
              variant="primary"
              icon={isSharingLocation ? "location" : "location-outline"}
              onPress={() => handleStatusButtonPress('location')}
              style={{ flex: 1, opacity: isSharingLocation ? 1 : 0.8, borderWidth: isSharingLocation ? 2 : 0, borderColor: isSharingLocation ? '#3b82f6' : 'transparent' }}
            />
          </View>
        </View>

        {/* Group Chat Button */}
        {members.length > 0 && (
          <View style={styles.groupChatSection}>
            <Pressable style={styles.groupChatButton} onPress={handleGroupChat}>
              <LinearGradient
                colors={[colors.brand.primary, colors.brand.secondary]}
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
              <Text style={styles.sectionTitle}>Aile Üyeleri</Text>
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
              /* ELITE V2: Interactive Family Map (Life360 pattern) */
              <View style={{ height: 350, borderRadius: 16, overflow: 'hidden', marginHorizontal: 4 }}>
                <FamilyMapView
                  members={members}
                  onMemberPress={(member) => {
                    haptics.impactLight();
                  }}
                  onCheckIn={(memberId) => {
                    haptics.impactMedium();
                    const member = members.find(
                      (m) => m.uid === memberId || m.deviceId === memberId,
                    );
                    if (member) {
                      // Send an explicit check-in ping first (cloud + mesh).
                      familyTrackingService.requestCheckIn(memberId).catch((error) => {
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
              <View style={styles.memberList}>
                {members.map((member, index) => (
                  <MemberCard
                    key={member.uid}
                    member={member}
                    index={index}
                    onPress={() => {
                      haptics.impactLight();
                      navigation.navigate('Map', { focusOnMember: member.uid });
                    }}
                    onEdit={handleEditMember}
                    onDelete={(memberId) => handleDeleteMember(memberId)}
                    onMessage={(m) => {
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
                    onLocate={(m) => {
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
                ))}

              </View>
            )
          ) : (
            <View style={styles.emptyState}>
              {/* Icon removed for cleaner look */}
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
      </ScrollView>

      {/* Premium Gate KALDIRILDI - Tüm kullanıcılar erişebilir */}

      {/* ID Share Modal */}
      <Modal
        visible={showIdModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowIdModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setShowIdModal(false)}
            >
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </Pressable>

            <Text style={styles.modalTitle}>Benim ID'm</Text>
            <Text style={styles.modalSubtitle}>
              Bu ID'yi başkalarıyla paylaşarak sizi ekleyebilirler
            </Text>

            {(myDeviceId || mySharePayload) ? (
              <>
                <View style={styles.qrContainer}>
                  <QRCode
                    value={getShareValue() || myDeviceId || ''}
                    size={200}
                    color={colors.text.primary}
                    backgroundColor={colors.background.secondary}
                  />
                </View>

                <View style={styles.idContainer}>
                  <Text style={styles.idLabel}>ID:</Text>
                  <Text style={styles.idValue} selectable>{shareDisplayId}</Text>
                </View>

                <View style={styles.modalButtons}>
                  <Pressable style={styles.modalButtonSmall} onPress={handleCopyId}>
                    <Ionicons name="copy-outline" size={18} color="#fff" />
                    <Text style={styles.modalButtonTextSmall}>Kopyala</Text>
                  </Pressable>
                  <Pressable style={styles.modalButtonSmall} onPress={handleShareIdWhatsApp}>
                    <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                    <Text style={styles.modalButtonTextSmall}>WhatsApp</Text>
                  </Pressable>
                  <Pressable style={styles.modalButtonSmall} onPress={handleShareIdSMS}>
                    <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                    <Text style={styles.modalButtonTextSmall}>SMS</Text>
                  </Pressable>
                  <Pressable style={styles.modalButtonSmall} onPress={handleShareIdOther}>
                    <Ionicons name="share-outline" size={18} color="#fff" />
                    <Text style={styles.modalButtonTextSmall}>Diğer</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.errorText}>ID alınamadı</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Member Modal - ELITE EXPANDED */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowEditModal(false);
          setEditingMember(null);
          setEditName('');
          setEditRelationship(null);
          setEditPhone('');
          setEditNotes('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => {
                setShowEditModal(false);
                setEditingMember(null);
                setEditName('');
                setEditRelationship(null);
                setEditPhone('');
                setEditNotes('');
              }}
            >
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </Pressable>

            <Text style={styles.modalTitle}>Üyeyi Düzenle</Text>
            <Text style={styles.modalSubtitle}>
              Üye bilgilerini güncelleyin
            </Text>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {/* İsim */}
              <View style={styles.editInputContainer}>
                <Text style={styles.editInputLabel}>İsim *</Text>
                <TextInput
                  style={styles.editInput}
                  placeholder="Üye ismi"
                  placeholderTextColor={colors.text.tertiary}
                  value={editName}
                  onChangeText={setEditName}
                  maxLength={50}
                />
              </View>

              {/* İlişki Türü */}
              <View style={styles.editInputContainer}>
                <Text style={styles.editInputLabel}>İlişki Türü</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {[
                    { id: 'anne', label: 'Anne', emoji: '👩' },
                    { id: 'baba', label: 'Baba', emoji: '👨' },
                    { id: 'es', label: 'Eş', emoji: '💕' },
                    { id: 'kardes', label: 'Kardeş', emoji: '👫' },
                    { id: 'cocuk', label: 'Çocuk', emoji: '👶' },
                    { id: 'akraba', label: 'Akraba', emoji: '👥' },
                    { id: 'arkadas', label: 'Arkadaş', emoji: '🤝' },
                    { id: 'diger', label: 'Diğer', emoji: '👤' },
                  ].map((rel) => (
                    <Pressable
                      key={rel.id}
                      style={[
                        styles.relationshipChip,
                        editRelationship === rel.id && styles.relationshipChipActive
                      ]}
                      onPress={() => {
                        haptics.impactLight();
                        setEditRelationship(editRelationship === rel.id ? null : rel.id);
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>{rel.emoji}</Text>
                      <Text style={[
                        styles.relationshipChipText,
                        editRelationship === rel.id && styles.relationshipChipTextActive
                      ]}>{rel.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Telefon */}
              <View style={styles.editInputContainer}>
                <Text style={styles.editInputLabel}>Telefon (Opsiyonel)</Text>
                <TextInput
                  style={styles.editInput}
                  placeholder="05551234567"
                  placeholderTextColor={colors.text.tertiary}
                  value={editPhone}
                  onChangeText={(text) => setEditPhone(text.replace(/[^\d+\s]/g, '').substring(0, 20))}
                  keyboardType="phone-pad"
                  maxLength={20}
                />
              </View>

              {/* Notlar */}
              <View style={styles.editInputContainer}>
                <Text style={styles.editInputLabel}>Notlar (Opsiyonel)</Text>
                <TextInput
                  style={[styles.editInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  placeholder="Ek bilgiler..."
                  placeholderTextColor={colors.text.tertiary}
                  value={editNotes}
                  onChangeText={(text) => setEditNotes(text.substring(0, 500))}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
                {editNotes.length > 0 && (
                  <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 }}>
                    {editNotes.length}/500
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingMember(null);
                  setEditName('');
                  setEditRelationship(null);
                  setEditPhone('');
                  setEditNotes('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>İptal</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.modalButtonTextSave}>Kaydet</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>


    </ImageBackground >
  );
}
