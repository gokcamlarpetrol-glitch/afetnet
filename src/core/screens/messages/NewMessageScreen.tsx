/**
 * NEW MESSAGE SCREEN - Find and start conversation
 * QR scan, ID input, or BLE discovery
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMessageStore } from '../../stores/messageStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { useMeshStore } from '../../services/mesh/MeshStore';
import { getDeviceId as getDeviceIdFromLib, isValidDeviceId } from '../../../lib/device';
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { contactService } from '../../services/ContactService';
import { identityService } from '../../services/IdentityService';
import { firebaseDataService } from '../../services/FirebaseDataService';
import { useFamilyStore } from '../../stores/familyStore';
import { formatLastSeen } from '../../utils/dateUtils';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';
import { styles } from './NewMessageScreen.styles';

const logger = createLogger('NewMessageScreen');
const UID_REGEX = /^[A-Za-z0-9]{20,40}$/;

const SELF_ACCOUNT_WARNING_TITLE = 'Aynı Hesap Tespit Edildi';
const SELF_ACCOUNT_WARNING_MESSAGE =
  'Bu cihazda zaten aynı Apple/Firebase hesabı açık. Aynı hesapla kendinizle sohbet başlatamazsınız. ' +
  'Mesaj testleri için ikinci telefonda farklı bir hesap kullanın.';
const toNormalizedId = (value?: string | null): string => {
  if (!value) return '';
  return value.trim();
};

// ELITE: Type-safe navigation props
type NewMessageNavigationProp = StackNavigationProp<MainStackParamList, 'NewMessage'>;
interface NewMessageScreenProps {
  navigation: NewMessageNavigationProp;
}

export default function NewMessageScreen({ navigation }: NewMessageScreenProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState<'qr' | 'id' | 'scan' | 'contacts'>('contacts');
  const [contactSearch, setContactSearch] = useState('');
  const familyMembers = useFamilyStore((state) => state.members);
  const [deviceId, setDeviceId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<Array<{ deviceId: string; name?: string; rssi?: number }>>([]);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [qrScanLocked, setQrScanLocked] = useState(false);
  const isScanningRef = useRef(isScanning);
  const scanCountdownStateRef = useRef(0);
  const discoveryUnsubscribeRef = useRef<(() => void) | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scanCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const qrScanCooldownRef = useRef<NodeJS.Timeout | null>(null);
  const scannedDevicesRef = useRef(0);
  const initRequestedRef = useRef(false);
  const [scanCountdown, setScanCountdown] = useState(0);

  const meshStoreDeviceId = useMeshStore((state) => state.myDeviceId);

  const tabOptions = useMemo<
    ReadonlyArray<{ key: 'qr' | 'id' | 'scan' | 'contacts'; label: string; icon: keyof typeof Ionicons.glyphMap }>
  >(
    () => [
      { key: 'contacts', label: 'Kişiler', icon: 'people' },
      { key: 'qr', label: 'QR Kod', icon: 'qr-code' },
      { key: 'id', label: 'ID ile Ekle', icon: 'key-outline' },
      { key: 'scan', label: 'Tarama', icon: 'bluetooth' },
    ],
    [],
  );

  const displayDeviceId = myDeviceId ?? meshStoreDeviceId ?? 'Hazırlanıyor...';

  const handleHelp = useCallback(() => {
    Alert.alert(
      'Mesh Mesajlaşma',
      'AfetNet cihazları Bluetooth mesh ağı üzerinden haberleşir. Bluetooth ve konum izinleri kapalıysa mesajlar iletilmez. Erişim sorununda her iki izni de kontrol edin.',
    );
  }, []);

  const handleShowMyQrInfo = useCallback(() => {
    // Navigate to dedicated MyQR screen
    navigation.navigate('MyQR');
  }, [navigation]);

  const handleCloseQrModal = () => {
    setQrModalVisible(false);
  };

  const getSignalLabel = (rssi?: number) => {
    if (typeof rssi !== 'number') return undefined;
    if (rssi > -70) return 'Sinyal: Güçlü';
    if (rssi > -90) return 'Sinyal: Orta';
    return 'Sinyal: Zayıf';
  };

  const isMeshConnected = useMeshStore((state) => state.isConnected);
  const myDeviceIdRef = useRef<string | null>(null);
  useEffect(() => {
    myDeviceIdRef.current = myDeviceId;
  }, [myDeviceId]);

  const selfIdCandidates = useMemo(() => {
    const ids = new Set<string>();
    const add = (value?: string | null) => {
      const normalized = toNormalizedId(value);
      if (!normalized) return;
      ids.add(normalized);
    };

    add(myDeviceId);
    add(meshStoreDeviceId);
    add(identityService.getUid());

    const identity = identityService.getIdentity();
    add(identity?.uid);

    return ids;
  }, [meshStoreDeviceId, myDeviceId]);

  const getPreferredMemberTargetId = useCallback((member: { uid?: string; deviceId?: string }): string => {
    const uid = toNormalizedId(member.uid);
    if (uid) return uid;

    const device = toNormalizedId(member.deviceId);
    if (device) return device;

    return '';
  }, []);

  const ensureMeshReady = useCallback(async (): Promise<string | null> => {
    const meshStore = useMeshStore.getState();
    let id = bleMeshService.getMyDeviceId() || meshStore.myDeviceId || myDeviceIdRef.current;

    if (!id) {
      try {
        await bleMeshService.start();
      } catch (error) {
        logger.warn('Mesh start attempt failed:', error);
      }
      const refreshedStore = useMeshStore.getState();
      id = bleMeshService.getMyDeviceId() || refreshedStore.myDeviceId || myDeviceIdRef.current;
    }

    if (!id) {
      try {
        const fallback = await getDeviceIdFromLib();
        if (fallback) {
          id = fallback;
          useMeshStore.getState().setMyDeviceId(fallback);
          setMyDeviceId(fallback);
          myDeviceIdRef.current = fallback;
        }
      } catch (error) {
        logger.error('Device ID retrieval failed:', error);
      }
    }

    if (!id) {
      Alert.alert(
        'Mesh Ağı Aktif Değil',
        'Bluetooth açık değil veya gerekli izinler verilmedi. Lütfen Bluetoothu etkinleştirip tekrar deneyin.',
      );
      return null;
    }

    if (!myDeviceIdRef.current && id) {
      setMyDeviceId(id);
      myDeviceIdRef.current = id;
    }

    const latestStore = useMeshStore.getState();
    if (latestStore.myDeviceId !== id) {
      latestStore.setMyDeviceId(id);
    }
    if (!latestStore.isConnected) {
      latestStore.setConnected(true);
    }

    return id;
  }, []);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  useEffect(() => {
    scanCountdownStateRef.current = scanCountdown;
  }, [scanCountdown]);

  const stopBLEScan = useCallback(() => {
    if (
      !isScanningRef.current &&
      scanCountdownStateRef.current === 0 &&
      !scanTimeoutRef.current &&
      !scanCountdownRef.current
    ) {
      return;
    }

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (scanCountdownRef.current) {
      clearInterval(scanCountdownRef.current);
      scanCountdownRef.current = null;
    }
    if (discoveryUnsubscribeRef.current) {
      discoveryUnsubscribeRef.current();
      discoveryUnsubscribeRef.current = null;
    }
    setIsScanning((prev) => (prev ? false : prev));
    setScanCountdown((prev) => (prev !== 0 ? 0 : prev));
    scannedDevicesRef.current = 0;
  }, []);

  const lockQrScanner = useCallback((cooldownMs: number = 1800) => {
    setQrScanLocked(true);
    if (qrScanCooldownRef.current) {
      clearTimeout(qrScanCooldownRef.current);
    }
    qrScanCooldownRef.current = setTimeout(() => {
      setQrScanLocked(false);
      qrScanCooldownRef.current = null;
    }, cooldownMs);
  }, []);

  const startBLEScan = useCallback(async () => {
    const id = await ensureMeshReady();
    if (!id) {
      return;
    }

    setScanError(null);
    setIsScanning(true);
    setScannedDevices([]);
    scannedDevicesRef.current = 0;
    setScanCountdown(10);

    if (discoveryUnsubscribeRef.current) {
      discoveryUnsubscribeRef.current();
      discoveryUnsubscribeRef.current = null;
    }

    discoveryUnsubscribeRef.current = bleMeshService.onMessage(async (message) => {
      try {
        // Check content for discovery info (mesh message content is string)
        const content = message.content;
        if (typeof content === 'string') {
          // ELITE: Validate content length (prevent DoS)
          if (content.length > 10000) {
            logger.warn('Discovery message content too large, skipping');
            return;
          }

          try {
            // ELITE: Use safe JSON parsing
            const { sanitizeJSON } = await import('../../utils/inputSanitizer');
            const { sanitizeDeviceId } = await import('../../utils/validation');
            const { sanitizeString } = await import('../../utils/validation');
            const data = sanitizeJSON(content);

            if (data && typeof data === 'object' && data !== null) {
              // ELITE: Validate data structure
              const messageType = typeof data.type === 'string' ? data.type : null;

              if (messageType === 'discovery' || messageType === 'beacon' || messageType === 'discovery_request') {
                // ELITE: Sanitize device ID
                const discoveredId = sanitizeDeviceId(
                  data.deviceId || data.senderId || message.senderId || '',
                );

                // ELITE: Validate device ID format
                if (discoveredId && discoveredId.length >= 4 && discoveredId !== id) {
                  // ELITE: Sanitize name
                  const deviceName = typeof data.name === 'string'
                    ? sanitizeString(data.name, 50)
                    : undefined;

                  // ELITE: Validate RSSI (must be number)
                  const rssi = typeof data.rssi === 'number' && !isNaN(data.rssi)
                    ? Math.max(-200, Math.min(0, data.rssi))
                    : undefined;

                  setScannedDevices(prev => {
                    const exists = prev.find(d => d.deviceId === discoveredId);
                    if (!exists) {
                      const updated = [
                        ...prev,
                        {
                          deviceId: discoveredId,
                          name: deviceName,
                          rssi: rssi,
                        },
                      ];
                      scannedDevicesRef.current = updated.length;
                      return updated;
                    }
                    scannedDevicesRef.current = prev.length;
                    return prev;
                  });
                }
              }
            }
          } catch (error) {
            // ELITE: Not JSON or parse failed - log and skip
            logger.debug('Discovery message is not valid JSON, skipping:', error);
          }
        }
      } catch (error) {
        logger.error('Error processing discovery message:', error);
      }
    });

    // CRITICAL: Broadcast discovery request via BLE Mesh Service (actual transmission)
    if (id) {
      const discoveryPayload = JSON.stringify({
        type: 'discovery_request',
        deviceId: id,
      });

      // CRITICAL: Send via BLE Mesh Service for actual broadcast
      bleMeshService.broadcastMessage({
        content: discoveryPayload,
        type: 'text',
        priority: 'normal',
        ttl: 3,
      }).catch((error) => {
        logger.error('Failed to broadcast discovery request:', error);
      });
    }

    // Auto-stop after 10 seconds
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    scanTimeoutRef.current = setTimeout(() => {
      stopBLEScan();
      if (scannedDevicesRef.current === 0) {
        setScanError('Yakında cihaz bulunamadı. Bluetooth açık ve diğer cihazlar yakın olmalı.');
      }
    }, 12000);

    if (scanCountdownRef.current) {
      clearInterval(scanCountdownRef.current);
    }
    scanCountdownRef.current = setInterval(() => {
      setScanCountdown((prev) => {
        if (prev <= 1) {
          if (scanCountdownRef.current) {
            clearInterval(scanCountdownRef.current);
            scanCountdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [ensureMeshReady, stopBLEScan]);

  useEffect(() => {
    if (!initRequestedRef.current) {
      initRequestedRef.current = true;

      // ELITE: Initialize message store
      const initStore = async () => {
        try {
          await useMessageStore.getState().initialize();
        } catch (error) {
          logger.error('Failed to initialize message store:', error);
        }
      };
      initStore();

      void ensureMeshReady();
    }

    return () => {
      stopBLEScan();
      if (qrScanCooldownRef.current) {
        clearTimeout(qrScanCooldownRef.current);
        qrScanCooldownRef.current = null;
      }
    };
  }, [ensureMeshReady, stopBLEScan]);

  useEffect(() => {
    if (activeTab === 'scan') {
      startBLEScan();
    } else if (isScanningRef.current || scanCountdownStateRef.current > 0) {
      stopBLEScan();
    }

    return () => {
      stopBLEScan();
    };
  }, [activeTab, startBLEScan, stopBLEScan]);

  const handleQRScan = async ({ data }: { data: string }) => {
    if (qrScanLocked) {
      return;
    }
    lockQrScanner();

    try {
      // ELITE: Use IdentityService to parse QR and ContactService to save
      const rawData = typeof data === 'string' ? data.trim() : '';
      let payload = await identityService.parseQRPayload(rawData);

      if (!payload && rawData) {
        try {
          const decoded = decodeURIComponent(rawData);
          if (decoded !== rawData) {
            payload = await identityService.parseQRPayload(decoded);
          }
        } catch {
          // best effort fallback
        }
      }

      if (payload && payload.uid) {
        const payloadCandidates = [payload.uid]
          .map((value) => toNormalizedId(value))
          .filter((value) => value.length > 0);
        if (payloadCandidates.some((value) => selfIdCandidates.has(value))) {
          Alert.alert(SELF_ACCOUNT_WARNING_TITLE, SELF_ACCOUNT_WARNING_MESSAGE);
          return;
        }

        // CRITICAL FIX: Wrap addContactFromQR in its own try-catch so that
        // a Firebase/network error doesn't prevent starting the conversation.
        try {
          await contactService.addContactFromQR(rawData);
        } catch (contactError) {
          logger.warn('addContactFromQR failed (continuing to conversation):', contactError);
          // Contact save failed but we can still open conversation
        }

        // Use the best available ID for conversation
        const targetId = payload.uid;

        haptics.notificationSuccess();
        await startConversation(targetId);

        Alert.alert(
          'Kişi Eklendi ✅',
          `${payload.name || 'Yeni kişi'} başarıyla kaydedildi.`
        );
      } else {
        // Fallback: try legacy format or raw ID
        try {
          const parsed = JSON.parse(data);
          const scannedId = parsed.deviceId || parsed.id || parsed.uid || rawData;

          if (scannedId && typeof scannedId === 'string' && scannedId.length >= 4) {
            const normalizedScannedId = scannedId.trim();
            if (selfIdCandidates.has(normalizedScannedId)) {
              Alert.alert(SELF_ACCOUNT_WARNING_TITLE, SELF_ACCOUNT_WARNING_MESSAGE);
              return;
            }
            haptics.notificationSuccess();
            await startConversation(normalizedScannedId);
          } else {
            Alert.alert('Geçersiz QR Kod', 'Bu QR kod geçerli bir kullanıcı bilgisi içermiyor.');
          }
        } catch {
          // Not JSON — try as raw ID string
          if (rawData.length >= 4) {
            if (selfIdCandidates.has(rawData)) {
              Alert.alert(SELF_ACCOUNT_WARNING_TITLE, SELF_ACCOUNT_WARNING_MESSAGE);
              return;
            }
            haptics.notificationSuccess();
            await startConversation(rawData);
          } else {
            Alert.alert('Geçersiz QR Kod', 'QR kod okunamadı.');
          }
        }
      }
    } catch (error) {
      logger.error('QR scan error:', error);
      // CRITICAL FIX: Accept any string with length >= 4 as potential ID
      const trimmedData = data?.trim();
      if (trimmedData && trimmedData.length >= 4) {
        if (selfIdCandidates.has(trimmedData)) {
          Alert.alert(SELF_ACCOUNT_WARNING_TITLE, SELF_ACCOUNT_WARNING_MESSAGE);
          return;
        }
        haptics.notificationSuccess();
        await startConversation(trimmedData);
      } else {
        Alert.alert('Geçersiz QR Kod', 'QR kod okunamadı.');
      }
    }
  };

  // CRITICAL FIX: Accept broader ID formats — Firebase UID, publicUserCode, AFN-*
  const isValidContactId = (id: string): boolean => {
    if (!id || typeof id !== 'string') return false;
    const trimmed = id.trim();
    // AFN-XXXXXXXX format
    if (isValidDeviceId(trimmed)) return true;
    // Firebase UID format (alphanumeric, 20-40 chars)
    if (/^[a-zA-Z0-9]{20,40}$/.test(trimmed)) return true;
    // publicUserCode format (alphanumeric with dashes, min 4 chars)
    if (/^[a-zA-Z0-9-]{4,}$/.test(trimmed)) return true;
    return false;
  };

  const handleManualAdd = () => {
    const trimmedDeviceId = deviceId.trim();
    if (!trimmedDeviceId) {
      Alert.alert('Hata', 'Lütfen bir kullanıcı ID girin.');
      return;
    }

    if (!isValidContactId(trimmedDeviceId)) {
      Alert.alert('Geçersiz ID', 'Lütfen geçerli bir kullanıcı ID girin (AFN-XXXXXXXX veya Firebase UID).');
      return;
    }

    if (selfIdCandidates.has(trimmedDeviceId)) {
      Alert.alert(SELF_ACCOUNT_WARNING_TITLE, SELF_ACCOUNT_WARNING_MESSAGE);
      return;
    }

    haptics.impactMedium();
    startConversation(trimmedDeviceId);
  };

  const handleDeviceSelect = (selectedDeviceId: string) => {
    const normalizedTarget = selectedDeviceId.trim();
    if (selfIdCandidates.has(normalizedTarget)) {
      Alert.alert(SELF_ACCOUNT_WARNING_TITLE, SELF_ACCOUNT_WARNING_MESSAGE);
      return;
    }
    haptics.impactMedium();
    startConversation(normalizedTarget);
  };

  const handleCopyId = useCallback(async (explicitId?: string) => {
    const idToCopy = explicitId || myDeviceIdRef.current || useMeshStore.getState().myDeviceId;
    if (!idToCopy) return;

    await Clipboard.setStringAsync(idToCopy);
    haptics.notificationSuccess();
    Alert.alert('Kopyalandı', 'Cihaz ID panoya kaydedildi.');
  }, []);

  const statusItems = useMemo(() => [
    {
      label: 'Cihaz ID',
      value: myDeviceId ?? meshStoreDeviceId ?? 'Hazırlanıyor...',
      icon: 'finger-print' as const,
      action: myDeviceId ? (() => handleCopyId()) : undefined,
    },
    {
      label: 'Mesh Durumu',
      value: isMeshConnected ? 'Aktif' : 'Pasif',
      icon: isMeshConnected ? ('radio' as const) : ('radio-outline' as const),
    },
    {
      label: 'Taranan Cihaz',
      value: `${scannedDevices.length}`,
      icon: 'people-outline' as const,
    },
  ], [handleCopyId, isMeshConnected, meshStoreDeviceId, myDeviceId, scannedDevices.length]);

  const resolveConversationTargetId = useCallback((rawId: string): string => {
    const trimmed = rawId.trim();
    if (!trimmed) return '';
    if (UID_REGEX.test(trimmed)) return trimmed;

    const fromContact = contactService.resolveCloudUid(trimmed);
    if (fromContact && UID_REGEX.test(fromContact)) {
      return fromContact;
    }

    const fromFamily = familyMembers.find((m) =>
      m.uid === trimmed || m.deviceId === trimmed
    );
    if (fromFamily?.uid && UID_REGEX.test(fromFamily.uid)) {
      return fromFamily.uid;
    }
    if (fromFamily?.deviceId) {
      return fromFamily.deviceId;
    }

    return trimmed;
  }, [familyMembers]);

  const resolveExistingConversationId = useCallback((rawId: string, canonicalId: string): string | null => {
    const candidateIds = new Set<string>();
    const add = (value?: string | null) => {
      const normalized = toNormalizedId(value);
      if (!normalized) return;
      candidateIds.add(normalized);
    };

    add(rawId);
    add(canonicalId);

    const contact = contactService.getContactByAnyId(rawId) || contactService.getContactByAnyId(canonicalId);
    if (contact) {
      add(contact.uid);
    }

    const familyMatch = familyMembers.find((member) => {
      const preferredTarget = getPreferredMemberTargetId(member);
      return (
        preferredTarget === rawId ||
        preferredTarget === canonicalId ||
        member.uid === rawId ||
        member.uid === canonicalId ||
        member.deviceId === rawId ||
        member.deviceId === canonicalId
      );
    });
    if (familyMatch) {
      add(getPreferredMemberTargetId(familyMatch));
      add(familyMatch.uid);
      add(familyMatch.deviceId);
    }

    if (candidateIds.size === 0) return null;

    const existing = useMessageStore.getState().conversations.find((conversation) => candidateIds.has(conversation.userId));
    return existing?.userId || null;
  }, [familyMembers, getPreferredMemberTargetId]);

  const resolveCanonicalConversationTargetId = useCallback(async (rawId: string): Promise<string> => {
    const baseTarget = resolveConversationTargetId(rawId);
    if (!baseTarget) return '';
    if (baseTarget === 'broadcast' || UID_REGEX.test(baseTarget)) {
      return baseTarget;
    }

    try {
      await firebaseDataService.initialize();
      const resolvedUid = await firebaseDataService.resolveRecipientUid(baseTarget);
      if (resolvedUid && UID_REGEX.test(resolvedUid)) {
        return resolvedUid;
      }
    } catch (error) {
      logger.debug('Failed to canonicalize recipient to UID in NewMessageScreen', error);
    }

    return baseTarget;
  }, [resolveConversationTargetId]);

  const startConversation = async (targetDeviceId: string) => {
    try {
      const normalizedTarget = toNormalizedId(targetDeviceId);
      const targetId = await resolveCanonicalConversationTargetId(normalizedTarget);
      if (!targetId) {
        Alert.alert('Hata', 'Bu kişi için geçerli bir mesajlaşma kimliği bulunamadı. Kişiyi tekrar ekleyin.');
        return;
      }

      const existingConversationId = resolveExistingConversationId(normalizedTarget, targetId);
      const conversationId = existingConversationId || targetId;

      if (existingConversationId) {
        navigation.navigate('Conversation', { userId: conversationId });
        return;
      }

      const contact = contactService.getContactByAnyId(normalizedTarget) || contactService.getContactByAnyId(targetId);
      const familyMatch = familyMembers.find((member) =>
        member.uid === normalizedTarget ||
        member.uid === targetId ||
        member.deviceId === normalizedTarget ||
        member.deviceId === targetId
      );
      const displayName = familyMatch?.name || contact?.displayName || contact?.nickname || `Kişi ${targetId.slice(0, 8)}...`;

      await useMessageStore.getState().addConversation({
        userId: conversationId,
        userName: displayName,
        lastMessage: 'Yeni konuşma başlatıldı',
        lastMessageTime: Date.now(),
        unreadCount: 0,
      });

      navigation.navigate('Conversation', { userId: conversationId });
    } catch (error) {
      logger.error('Failed to start conversation:', error);
      Alert.alert('Hata', 'Konuşma başlatılamadı. Lütfen tekrar deneyin.');
    }
  };

  // ELITE: Merged contacts list (ContactService + Family Members)
  const mergedContacts = useMemo(() => {
    const searchLower = contactSearch.toLowerCase().trim();
    type MergedContact = {
      id: string;
      conversationId: string;
      deviceId: string;
      cloudUid?: string;
      displayName: string;
      isFavorite: boolean;
      isFamily: boolean;
      status?: string;
      lastSeen?: number;
      avatarInitial: string;
    };

    const contactsMap = new Map<string, MergedContact>();

    // Add contacts from ContactService
    try {
      const allContacts = contactService.getAllContacts();
      for (const c of allContacts) {
        const conversationId = c.uid;
        if (conversationId) {
          contactsMap.set(conversationId, {
            id: c.uid,
            conversationId,
            deviceId: c.uid,
            cloudUid: c.uid,
            displayName: c.displayName || c.nickname || 'Bilinmeyen',
            isFavorite: c.isFavorite,
            isFamily: false,
            status: c.status,
            lastSeen: c.lastSeen,
            avatarInitial: (c.displayName || c.nickname || '?').charAt(0).toUpperCase(),
          });
        }
      }
    } catch { /* ContactService may not be initialized */ }

    // Add family members (override or merge)
    for (const fm of familyMembers) {
      const conversationId = getPreferredMemberTargetId(fm);
      const deviceId = toNormalizedId(fm.deviceId) || conversationId;
      if (!conversationId || !deviceId) continue;

      const existing = contactsMap.get(conversationId);
      contactsMap.set(conversationId, {
        id: fm.uid || conversationId,
        conversationId,
        deviceId,
        cloudUid: fm.uid || existing?.cloudUid,
        displayName: fm.name || existing?.displayName || 'Aile Üyesi',
        isFavorite: existing?.isFavorite ?? true, // Family = always favorited
        isFamily: true,
        status: fm.status,
        lastSeen: fm.lastSeen,
        avatarInitial: (fm.name || '?').charAt(0).toUpperCase(),
      });
    }

    let result = Array.from(contactsMap.values());

    // Apply search filter
    if (searchLower.length > 0) {
      result = result.filter(c =>
        c.displayName.toLowerCase().includes(searchLower) ||
        c.deviceId.toLowerCase().includes(searchLower) ||
        c.conversationId.toLowerCase().includes(searchLower)
      );
    }

    // Sort: favorites first, then alphabetical
    result.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      if (a.isFamily !== b.isFamily) return a.isFamily ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return result;
  }, [contactSearch, familyMembers, getPreferredMemberTargetId]);

  const favoriteContacts = useMemo(() =>
    mergedContacts.filter(c => c.isFavorite),
    [mergedContacts]
  );

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'safe': return '#22c55e';
      case 'need-help': return '#f59e0b';
      case 'critical': case 'danger': return '#ef4444';
      case 'online': return '#22c55e';
      default: return '#94a3b8';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'safe': return 'Güvende';
      case 'need-help': return 'Yardım İstiyor';
      case 'critical': case 'danger': return 'Acil Durum';
      case 'online': return 'Çevrimiçi';
      case 'offline': return 'Çevrimdışı';
      default: return 'Bilinmiyor';
    }
  };

  const handleContactSelect = useCallback((contactId: string, _displayName: string) => {
    const normalizedContactId = toNormalizedId(contactId);
    if (!normalizedContactId) {
      Alert.alert('Hata', 'Geçerli bir kişi kimliği bulunamadı.');
      return;
    }
    haptics.impactMedium();
    void startConversation(normalizedContactId);
  }, [startConversation]);

  const renderContactsCard = () => (
    <View style={styles.card}>
      {/* Search Bar */}
      <View style={styles.contactSearchContainer}>
        <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.contactSearchInput}
          placeholder="Kişi ara..."
          placeholderTextColor="#94a3b8"
          value={contactSearch}
          onChangeText={setContactSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {contactSearch.length > 0 && (
          <Pressable onPress={() => setContactSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      {/* Favorites Horizontal Chips */}
      {favoriteContacts.length > 0 && contactSearch.length === 0 && (
        <View style={styles.favoritesSection}>
          <Text style={styles.contactSectionTitle}>⭐ Favoriler</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.favoritesScroll}>
            {favoriteContacts.map((contact) => (
              <Pressable
                key={`fav-${contact.id}`}
                style={({ pressed }) => [
                  styles.favoriteChip,
                  pressed && styles.favoriteChipPressed,
                ]}
                onPress={() => handleContactSelect(contact.conversationId, contact.displayName)}
              >
                <View style={[styles.favoriteAvatar, { backgroundColor: contact.isFamily ? '#dbeafe' : '#f0fdf4' }]}>
                  <Text style={[styles.favoriteAvatarText, { color: contact.isFamily ? '#3b82f6' : '#22c55e' }]}>
                    {contact.avatarInitial}
                  </Text>
                </View>
                <Text style={styles.favoriteChipName} numberOfLines={1}>{contact.displayName}</Text>
                <View style={[styles.contactStatusDot, { backgroundColor: getStatusColor(contact.status) }]} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Contact List */}
      <View style={styles.contactListSection}>
        {mergedContacts.length > 0 && contactSearch.length === 0 && (
          <Text style={styles.contactSectionTitle}>Tüm Kişiler ({mergedContacts.length})</Text>
        )}
        {mergedContacts.length > 0 && contactSearch.length > 0 && (
          <Text style={styles.contactSectionTitle}>{mergedContacts.length} sonuç bulundu</Text>
        )}

        {mergedContacts.length === 0 && (
          <View style={styles.emptyContactState}>
            <Ionicons name="people-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyContactTitle}>
              {contactSearch.length > 0 ? 'Sonuç bulunamadı' : 'Henüz kişi yok'}
            </Text>
            <Text style={styles.emptyContactSubtitle}>
              {contactSearch.length > 0
                ? 'Farklı bir arama terimi deneyin'
                : 'QR kod veya ID ile kişi ekleyebilirsiniz'}
            </Text>
          </View>
        )}

        {mergedContacts.map((contact, index) => (
          <Pressable
            key={`contact-${contact.id}-${index}`}
            style={({ pressed }) => [
              styles.contactRow,
              pressed && styles.contactRowPressed,
            ]}
            onPress={() => handleContactSelect(contact.conversationId, contact.displayName)}
          >
            <View style={[styles.contactAvatar, { backgroundColor: contact.isFamily ? '#dbeafe' : '#f1f5f9' }]}>
              <Text style={[styles.contactAvatarText, { color: contact.isFamily ? '#3b82f6' : '#475569' }]}>
                {contact.avatarInitial}
              </Text>
            </View>
            <View style={styles.contactInfo}>
              <View style={styles.contactNameRow}>
                <Text style={styles.contactName} numberOfLines={1}>{contact.displayName}</Text>
                {contact.isFamily && (
                  <View style={styles.familyBadge}>
                    <Ionicons name="heart" size={10} color="#3b82f6" />
                    <Text style={styles.familyBadgeText}>Aile</Text>
                  </View>
                )}
              </View>
              <View style={styles.contactStatusRow}>
                <View style={[styles.contactStatusDot, { backgroundColor: getStatusColor(contact.status) }]} />
                <Text style={styles.contactStatusText}>{getStatusLabel(contact.status)}</Text>
                {contact.lastSeen && (
                  <Text style={styles.contactLastSeen}>
                    · {formatLastSeen(contact.lastSeen)}
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chatbubble-outline" size={20} color="#0ea5e9" />
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderQRCard = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>QR Kod ile eşleş</Text>
          <Text style={styles.cardSubtitle}>
            Karşı tarafın QR kodunu tarayarak saniyeler içinde güvenli sohbet başlatabilirsiniz.
          </Text>
        </View>
        <Pressable style={styles.cardHeaderIcon} onPress={handleShowMyQrInfo}>
          <Ionicons name="qr-code-outline" size={22} color={colors.brand.primary} />
        </Pressable>
      </View>
      <View style={styles.cameraWrapper}>
        <CameraView
          style={styles.cameraView}
          facing="back"
          onBarcodeScanned={qrScanLocked ? undefined : handleQRScan}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraFrame} />
        </View>
      </View>
      <Text style={styles.cardHint}>İpucu: Profil › Paylaş menüsünden kendi QR kodunuzu gösterebilirsiniz.</Text>
    </View>
  );

  const renderIDCard = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>Cihaz ID ile ekle</Text>
          <Text style={styles.cardSubtitle}>Bilinen AfetNet ID&apos;lerini girerek kişileri manuel olarak ekleyin.</Text>
        </View>
        <View style={styles.cardHeaderIcon}>
          <Ionicons name="key-outline" size={22} color={colors.brand.primary} />
        </View>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Örn: afn-k1lou0h5"
        placeholderTextColor={colors.text.tertiary}
        value={deviceId}
        onChangeText={setDeviceId}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        style={[styles.primaryButton, !deviceId.trim() && styles.primaryButtonDisabled]}
        onPress={handleManualAdd}
        disabled={!deviceId.trim()}
      >
        <Ionicons name="send" size={16} color="#0f172a" />
        <Text style={styles.primaryButtonText}>Ekle ve Mesaj Gönder</Text>
      </Pressable>
      <Text style={styles.cardHint}>ID “afn-” ile başlar ve en az 8 karakter içerir.</Text>
    </View>
  );

  const renderScanCard = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>Yakındaki cihazlar</Text>
          <Text style={styles.cardSubtitle}>
            Bluetooth açıkken çevrenizdeki AfetNet cihazlarını keşfederek mesh ağı oluşturun.
          </Text>
        </View>
        <View style={styles.cardHeaderIcon}>
          <Ionicons name="scan-outline" size={22} color={colors.brand.primary} />
        </View>
      </View>

      <View style={styles.scanStatusRow}>
        <View style={[styles.scanStatusBadge, isScanning ? styles.scanStatusBadgeActive : styles.scanStatusBadgeInactive]}>
          <Ionicons name={isScanning ? 'pulse' : 'bluetooth'} size={16} color={isScanning ? '#0f172a' : '#0ea5e9'} />
          <Text style={[styles.scanStatusText, isScanning && styles.scanStatusTextActive]}>
            {isScanning ? `Tarama sürüyor (${Math.max(scanCountdown, 0)}s)` : 'Tarama hazır'}
          </Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={startBLEScan}>
          <Ionicons name="refresh" size={16} color={colors.brand.primary} />
          <Text style={styles.secondaryButtonText}>Yeniden Tara</Text>
        </Pressable>
      </View>

      {isScanning && (
        <View style={styles.scanLoading}>
          <ActivityIndicator color={colors.brand.primary} />
          <Text style={styles.scanLoadingText}>Cihazlar aranıyor...</Text>
        </View>
      )}

      {scannedDevices.length > 0 ? (
        scannedDevices.map((device) => (
          <Pressable
            key={device.deviceId}
            style={styles.deviceRow}
            onPress={() => handleDeviceSelect(device.deviceId)}
          >
            <View style={styles.deviceAvatar}>
              <Ionicons name="phone-portrait" size={18} color={colors.brand.primary} />
            </View>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName} numberOfLines={1}>
                {device.name || `Cihaz ${device.deviceId.slice(0, 8)}...`}
              </Text>
              <Text style={styles.deviceIdText} numberOfLines={1}>
                {device.deviceId}
              </Text>
              {getSignalLabel(device.rssi) && (
                <Text style={styles.deviceSignal}>{getSignalLabel(device.rssi)}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748b" />
          </Pressable>
        ))
      ) : (
        !isScanning && (
          <View style={styles.emptyState}>
            <Ionicons name="compass-outline" size={28} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Henüz cihaz bulunamadı</Text>
            <Text style={styles.emptySubtitle}>
              Bluetooth ve konum servislerinin açık olduğundan emin olun. Cihazları yakın konumda tutun.
            </Text>
            <Pressable style={styles.secondaryButtonGhost} onPress={startBLEScan}>
              <Text style={styles.secondaryButtonGhostText}>Tarama Başlat</Text>
            </Pressable>
          </View>
        )
      )}

      {scanError && (
        <View style={styles.warningBox}>
          <Ionicons name="alert" size={16} color="#f97316" />
          <Text style={styles.warningText}>{scanError}</Text>
        </View>
      )}
    </View>
  );

  const renderPermissionFallback = (message: string, actionLabel: string) => (
    <SafeAreaView style={styles.permissionScreen}>
      <StatusBar barStyle="light-content" backgroundColor="#060b1b" />
      <LinearGradient colors={['#060b1b', '#0b1228']} style={styles.gradientOverlay} />
      <View style={[styles.container, styles.permissionContainer, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.permissionText}>{message}</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  if (activeTab === 'qr' && !permission) {
    return renderPermissionFallback('QR kod okumak için kamera izni gereklidir.', 'İzin Ver');
  }

  if (activeTab === 'qr' && !permission?.granted) {
    return renderPermissionFallback('Kamera izni reddedildi.', 'Tekrar Dene');
  }

  return (
    <ImageBackground
      source={require('../../../../assets/images/premium/family_soft_bg.png')}
      style={styles.screen}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.7)']}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 10,
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.navButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#334155" />
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Yeni Mesaj</Text>
            <Text style={styles.headerSubtitle}>Çevrimdışı mesh ağında güvenli bağlantı kur</Text>
          </View>
          <Pressable style={styles.infoButton} onPress={handleHelp}>
            <Ionicons name="information-circle-outline" size={22} color="#475569" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.connectionCard}>
            <View style={styles.connectionHeader}>
              <View>
                <Text style={styles.connectionTitle}>Bağlantı Özeti</Text>
                <Text style={styles.connectionSubtitle}>
                  {isMeshConnected
                    ? 'Mesh ağı hazır. Bluetooth açık.'
                    : 'Mesh ağı kapalı. Bluetooth ve konumu etkinleştirin.'}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.connectionAction,
                  (!myDeviceId && !meshStoreDeviceId) && styles.connectionActionDisabled,
                  pressed && styles.connectionActionPressed,
                ]}
                onPress={() => handleCopyId()}
                disabled={!myDeviceId && !meshStoreDeviceId}
              >
                <Ionicons name="copy-outline" size={16} color="#0ea5e9" />
                <Text style={styles.connectionActionText}>Kimliği Kopyala</Text>
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(14,165,233,0.18)' }]}>
                  <Ionicons name="finger-print" size={16} color="#38bdf8" />
                </View>
                <Text style={styles.statLabel}>Cihaz ID</Text>
                <Text style={styles.statValue} numberOfLines={1}>{displayDeviceId}</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: isMeshConnected ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)' }]}>
                  <Ionicons name={isMeshConnected ? 'radio' : 'radio-outline'} size={16} color={isMeshConnected ? '#4ade80' : '#f87171'} />
                </View>
                <Text style={styles.statLabel}>Mesh Durumu</Text>
                <Text style={styles.statValue}>{isMeshConnected ? 'Aktif' : 'Pasif'}</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(139,92,246,0.18)' }]}>
                  <Ionicons name="people-outline" size={16} color="#8b5cf6" />
                </View>
                <Text style={styles.statLabel}>Taranan Cihaz</Text>
                <Text style={styles.statValue}>{scannedDevices.length}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tipBanner}>
            <Ionicons name="shield-checkmark" size={20} color="#4ade80" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Çevrimdışı güvenli bağlantı</Text>
              <Text style={styles.tipSubtitle}>
                Bluetooth ve konum açık olduğunda mesajlar ağdaki tüm cihazlara ulaştırılır.
              </Text>
            </View>
          </View>

          <View style={styles.segmentContainer}>
            {tabOptions.map((option) => (
              <Pressable
                key={option.key}
                style={[styles.segmentButton, activeTab === option.key && styles.segmentButtonActive]}
                onPress={() => setActiveTab(option.key)}
              >
                <Ionicons
                  name={option.icon}
                  size={16}
                  color={activeTab === option.key ? '#0ea5e9' : '#94a3b8'}
                />
                <Text
                  style={[styles.segmentLabel, activeTab === option.key && styles.segmentLabelActive]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeTab === 'contacts' && renderContactsCard()}
          {activeTab === 'qr' && renderQRCard()}
          {activeTab === 'id' && renderIDCard()}
          {activeTab === 'scan' && renderScanCard()}
        </ScrollView>

        <Modal
          visible={qrModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCloseQrModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Benim AfetNet ID&apos;m</Text>
              {qrValue && (
                <View style={styles.qrWrapper}>
                  <QRCode value={qrValue} size={200} color="#0f172a" backgroundColor="#e2e8f0" />
                  <Text style={styles.modalIdText}>{qrValue}</Text>
                </View>
              )}
              <Text style={styles.modalHint}>
                Bu QR kodu yakınınızdakiler taradığında sizi doğrudan ekleyebilir. Kimliğinizi kopyalayarak da paylaşabilirsiniz.
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalActionSecondary} onPress={handleCloseQrModal}>
                  <Text style={styles.modalActionSecondaryText}>Kapat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalActionPrimary}
                  onPress={async () => {
                    if (qrValue) {
                      await Clipboard.setStringAsync(qrValue);
                      haptics.notificationSuccess();
                    }
                    handleCloseQrModal();
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color="#0f172a" />
                  <Text style={styles.modalActionPrimaryText}>Kimliği Kopyala</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}
