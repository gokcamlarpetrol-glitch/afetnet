import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, StatusBar, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useFamilyStore } from '../../stores/familyStore';
import { createLogger } from '../../utils/logger';
import * as haptics from '../../utils/haptics';
import { colors, typography } from '../../theme';
import { identityService } from '../../services/IdentityService';
import { firebaseDataService } from '../../services/FirebaseDataService';
import GlassButton from '../../components/buttons/GlassButton';
import { getAuth } from 'firebase/auth';
import { initializeFirebase } from '../../../lib/firebase';

const logger = createLogger('AddFamilyMemberScreen');

// Relationship Types Constants
const RELATIONSHIP_TYPES = [
  { id: 'anne', label: 'Anne', icon: 'woman' as const },
  { id: 'baba', label: 'Baba', icon: 'man' as const },
  { id: 'es', label: 'Eş', icon: 'heart' as const },
  { id: 'kardes', label: 'Kardeş', icon: 'people' as const },
  { id: 'cocuk', label: 'Çocuk', icon: 'happy' as const },
  { id: 'akraba', label: 'Akraba', icon: 'nutrition' as const }, // generic icon
  { id: 'arkadas', label: 'Arkadaş', icon: 'person' as const },
  { id: 'diger', label: 'Diğer', icon: 'help-circle' as const },
];

const isValidAfnCode = (id: string) => /^afn-[a-zA-Z0-9]{4,}$/i.test(id);
const isLikelyUid = (id: string) => /^[A-Za-z0-9]{20,40}$/.test(id);
const isValidPublicCode = (id: string) => /^[A-Za-z0-9-]{4,64}$/.test(id);
const isValidMemberIdentifier = (id: string) =>
  isValidAfnCode(id) || isLikelyUid(id) || isValidPublicCode(id);
const SELF_MEMBER_WARNING =
  'Aynı Apple/Firebase hesabı ile kendi profilinizi aile üyesi olarak ekleyemezsiniz. ' +
  'Aile testi için ikinci telefonda farklı bir hesap kullanın.';
const normalizeId = (value?: string | null): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (isValidAfnCode(trimmed)) {
    return trimmed.toUpperCase();
  }
  return trimmed;
};

interface AddFamilyMemberScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

export default function AddFamilyMemberScreen({ navigation }: AddFamilyMemberScreenProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualId, setManualId] = useState('');
  const [targetDeviceId, setTargetDeviceId] = useState(''); // Store actual device ID separate from ID
  const [targetUid, setTargetUid] = useState(''); // Store canonical Firebase UID when available
  const [memberName, setMemberName] = useState('');
  const [selectedRelationship, setSelectedRelationship] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [addMethod, setAddMethod] = useState<'qr' | 'manual'>('qr');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scannerResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const members = useFamilyStore((state) => state.members);

  // Initialize service
  useEffect(() => {
    identityService.initialize();

    return () => {
      if (scannerResetTimeoutRef.current) {
        clearTimeout(scannerResetTimeoutRef.current);
        scannerResetTimeoutRef.current = null;
      }
    };
  }, []);

  const scheduleScannerReset = useCallback((delayMs: number = 1200) => {
    if (scannerResetTimeoutRef.current) {
      clearTimeout(scannerResetTimeoutRef.current);
    }
    scannerResetTimeoutRef.current = setTimeout(() => {
      setScanned(false);
      scannerResetTimeoutRef.current = null;
    }, delayMs);
  }, []);

  // ELITE: Check for duplicate IDs or Device IDs
  const checkDuplicate = useCallback((id: string): boolean => {
    const normalizedCandidate = normalizeId(id);
    if (!normalizedCandidate) return false;

    return members.some((member) => {
      const aliases = [
        normalizeId(member.uid),
      ].filter((alias) => alias.length > 0);

      return aliases.includes(normalizedCandidate);
    });
  }, [members]);

  const getSelfIdentityCandidates = useCallback((): Set<string> => {
    const ids = new Set<string>();
    const add = (value?: string | null) => {
      const normalized = normalizeId(value);
      if (!normalized || normalized === 'unknown') return;
      ids.add(normalized);
    };

    add(identityService.getUid());

    const identity = identityService.getIdentity();
    add(identity?.uid);

    try {
      const app = initializeFirebase();
      if (app) {
        add(getAuth(app).currentUser?.uid || '');
      }
    } catch {
      // best effort
    }

    return ids;
  }, []);

  const isSelfIdentifier = useCallback((id: string): boolean => {
    const normalized = normalizeId(id);
    if (!normalized) return false;
    return getSelfIdentityCandidates().has(normalized);
  }, [getSelfIdentityCandidates]);

  // ELITE: Validate phone number format (optional)
  const validatePhoneNumber = useCallback((phone: string): boolean => {
    if (!phone || phone.trim().length === 0) return true; // Optional
    // Turkish phone number format: +90XXXXXXXXXX or 0XXXXXXXXXX
    const phoneRegex = /^(\+90|0)?[5][0-9]{9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }, []);

  // ELITE: Memoized callback with comprehensive error handling
  const handleBarCodeScanned = useCallback(async ({ type, data }: { type: string; data: string }) => {
    try {
      if (scanned || isSubmitting) return;

      const rawData = (data || '').trim();
      const normalizedRawData = normalizeId(rawData);
      let parsedData = await identityService.parseQRPayload(rawData);

      // Fallback 1: some scanners return URI-encoded payloads
      if (!parsedData) {
        try {
          const decoded = decodeURIComponent(rawData);
          if (decoded !== rawData) {
            parsedData = await identityService.parseQRPayload(decoded);
          }
        } catch {
          // decode fallback is best effort
        }
      }

      // Fallback 2: accept plain ID/UID/public code QR values
      if (!parsedData && isValidMemberIdentifier(normalizedRawData)) {
        parsedData = {
          v: 0,
          uid: isLikelyUid(normalizedRawData) ? normalizedRawData : '',
          name: 'Bilinmeyen Kullanıcı',
        };
      }

      // Fallback 3: best-effort raw JSON payload parsing (legacy/debug QR dumps)
      if (!parsedData && rawData.startsWith('{') && rawData.endsWith('}')) {
        try {
          const rawPayload = JSON.parse(rawData) as Record<string, unknown>;
          const uidCandidate = normalizeId(
            (typeof rawPayload.uid === 'string' ? rawPayload.uid : '') ||
            (typeof rawPayload.cloudUid === 'string' ? rawPayload.cloudUid : '') ||
            (typeof rawPayload.userUid === 'string' ? rawPayload.userUid : '') ||
            (typeof rawPayload.id === 'string' ? rawPayload.id : '') ||
            (typeof rawPayload.code === 'string' ? rawPayload.code : ''),
          );
          if (uidCandidate) {
            parsedData = {
              v: 0,
              uid: uidCandidate,
              name: typeof rawPayload.name === 'string' ? rawPayload.name : 'Bilinmeyen Kullanıcı',
            };
          }
        } catch {
          // best effort JSON fallback
        }
      }

      if (!parsedData) {
        logger.warn('Invalid QR code data:', data);
        Alert.alert('Hata', 'Geçersiz AfetNet QR Kodu.');
        setScanned(true);
        scheduleScannerReset(2000);
        return;
      }

      setScanned(true);
      haptics.notificationSuccess();

      const { name } = parsedData;
      const memberCode = normalizeId(parsedData.uid || normalizedRawData);
      const parsedUid = normalizeId(parsedData.uid);
      const memberUid = parsedUid || (memberCode && isLikelyUid(memberCode) ? memberCode : '');
      const memberDeviceId = memberCode || '';

      if (!memberCode) {
        Alert.alert('Hata', 'QR kodunda geçerli kullanıcı bilgisi bulunamadı.');
        scheduleScannerReset(400);
        return;
      }

      const isSelfScan = [memberCode, memberUid, memberDeviceId]
        .some((candidate) => !!candidate && isSelfIdentifier(candidate));
      if (isSelfScan) {
        Alert.alert('Aynı Hesap Tespit Edildi', SELF_MEMBER_WARNING);
        scheduleScannerReset(800);
        return;
      }

      // ELITE: Check for duplicates
      if (
        checkDuplicate(memberCode) ||
        (memberUid && checkDuplicate(memberUid)) ||
        (memberDeviceId && checkDuplicate(memberDeviceId))
      ) {
        Alert.alert('Üye Zaten Mevcut', 'Bu kişi zaten listenizde bulunuyor.');
        scheduleScannerReset(1000);
        return; // Stay on screen
      }

      // Auto-fill data from QR
      setManualId(memberCode);
      setTargetUid(memberUid);
      setTargetDeviceId(memberDeviceId);

      if (name && name !== 'Unknown User') {
        setMemberName(name);
      }

      setAddMethod('manual'); // Switch to confirm details
      haptics.impactMedium();

      Alert.alert('Kişi Bulundu', `"${name || memberCode}" bulundu. Lütfen bilgileri onaylayın.`);

    } catch (error) {
      logger.error('Error in handleBarCodeScanned:', error);
      Alert.alert('Hata', 'QR kod işlenirken bir hata oluştu.');
      scheduleScannerReset(600);
    }
  }, [scanned, isSubmitting, checkDuplicate, isSelfIdentifier, scheduleScannerReset]);

  // ELITE: Handle relationship type selection
  const handleRelationshipSelect = useCallback((relationshipId: string) => {
    haptics.impactLight();
    if (selectedRelationship === relationshipId) {
      setSelectedRelationship(null);
      setMemberName('');
    } else {
      setSelectedRelationship(relationshipId);
      const relationship = RELATIONSHIP_TYPES.find(r => r.id === relationshipId);
      if (relationship) {
        setMemberName(relationship.label);
      }
    }
  }, [selectedRelationship]);

  // ELITE: Handle manual ID validation — also accepts pasted JSON QR payloads
  const handleManualIdChange = useCallback(async (text: string) => {
    const trimmed = text.trim();

    // Detect pasted JSON QR payload (e.g. {"v":4,"uid":"...","name":"..."})
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = await identityService.parseQRPayload(trimmed);
        if (parsed?.uid) {
          const normalizedUid = normalizeId(parsed.uid);
          setManualId(normalizedUid);
          setTargetUid(normalizedUid);
          setTargetDeviceId('');
          if (parsed.name && parsed.name !== 'Bilinmeyen Kullanıcı') {
            setMemberName(parsed.name);
          }
          haptics.notificationSuccess();
          Alert.alert('Kişi Bulundu', `"${parsed.name}" bilgileri otomatik dolduruldu.`);
          return;
        }
      } catch {
        // Not valid JSON QR — fall through to normal handling
      }
    }

    // Normal input: Sanitize — only allow alphanumeric and dash
    const sanitized = trimmed.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 64);
    const normalizedId = normalizeId(sanitized);
    setManualId(normalizedId);
    if (!normalizedId) {
      setTargetUid('');
      setTargetDeviceId('');
    } else if (isLikelyUid(normalizedId)) {
      setTargetUid(normalizedId);
      setTargetDeviceId('');
    } else {
      setTargetUid('');
      setTargetDeviceId(normalizedId);
    }

    // Auto-check for duplicates as user types
    if (normalizedId.length > 0 && isValidMemberIdentifier(normalizedId)) {
      if (checkDuplicate(normalizedId)) {
        // Show warning but don't block - user can still proceed
        logger.warn('Duplicate device ID detected:', normalizedId);
      }
    }
  }, [checkDuplicate]);

  // ELITE: Comprehensive validation before adding member
  const validateMemberData = useCallback((): { valid: boolean; error?: string } => {
    // Validate device ID
    const normalizedManualId = normalizeId(manualId);
    const normalizedTargetUid = normalizeId(targetUid);
    const normalizedTargetDeviceId = normalizeId(targetDeviceId);

    if (!normalizedManualId) {
      return { valid: false, error: 'Lütfen geçerli bir üye ID girin veya QR kod tarayın.' };
    }

    if (!isValidMemberIdentifier(normalizedManualId)) {
      return { valid: false, error: 'Geçersiz ID formatı. AFN kodu, kullanıcı kodu veya UID girin.' };
    }

    // Check for duplicates
    if (checkDuplicate(normalizedManualId)) {
      return { valid: false, error: 'Bu ID\'ye sahip bir üye zaten listenizde bulunuyor.' };
    }
    if (normalizedTargetUid && checkDuplicate(normalizedTargetUid)) {
      return { valid: false, error: 'Bu kullanıcı zaten aile listenizde bulunuyor.' };
    }
    if (
      isSelfIdentifier(normalizedManualId) ||
      (normalizedTargetUid && isSelfIdentifier(normalizedTargetUid)) ||
      (normalizedTargetDeviceId && isSelfIdentifier(normalizedTargetDeviceId))
    ) {
      return { valid: false, error: SELF_MEMBER_WARNING };
    }

    // Validate name
    if (!memberName || memberName.trim().length === 0) {
      return { valid: false, error: 'Lütfen üye ismini girin.' };
    }

    if (memberName.trim().length < 2) {
      return { valid: false, error: 'İsim en az 2 karakter olmalıdır.' };
    }

    if (memberName.trim().length > 50) {
      return { valid: false, error: 'İsim en fazla 50 karakter olabilir.' };
    }

    // Validate phone number (optional)
    if (phoneNumber && phoneNumber.trim().length > 0) {
      if (!validatePhoneNumber(phoneNumber.trim())) {
        return { valid: false, error: 'Geçersiz telefon numarası formatı. Örnek: 05551234567 veya +905551234567' };
      }
    }

    // Validate notes (optional)
    if (notes && notes.trim().length > 500) {
      return { valid: false, error: 'Notlar en fazla 500 karakter olabilir.' };
    }

    return { valid: true };
  }, [manualId, memberName, phoneNumber, notes, checkDuplicate, targetUid, targetDeviceId, validatePhoneNumber, isSelfIdentifier]);

  // ELITE: Handle member addition with comprehensive error handling
  const handleAddMember = useCallback(async () => {
    if (isSubmitting) return;

    try {
      // Validate data
      const validation = validateMemberData();
      if (!validation.valid) {
        Alert.alert('Hata', validation.error || 'Geçersiz veri');
        haptics.notificationError();
        return;
      }

      setIsSubmitting(true);
      haptics.impactMedium();

      // ELITE: Prepare member data
      const idToSave = normalizeId(manualId);
      const normalizedTargetUid = normalizeId(targetUid);
      let uidToSave = normalizedTargetUid || (isLikelyUid(idToSave) ? idToSave : undefined);

      // Canonicalize AFN/public-code inputs to real Firebase UID when possible.
      if (!uidToSave && idToSave) {
        try {
          await firebaseDataService.initialize();
          const resolvedUid = await firebaseDataService.resolveRecipientUid(idToSave);
          if (resolvedUid && isLikelyUid(resolvedUid)) {
            uidToSave = resolvedUid;
            setTargetUid(resolvedUid);
          }
        } catch (resolveError) {
          logger.debug('Family member UID could not be resolved from manual identifier', resolveError);
        }
      }
      // Keep UID and mesh device ID separated to avoid invalid devices/{uid} routing.
      const resolvedDeviceId = (() => {
        const normalizedTargetDeviceId = normalizeId(targetDeviceId);
        if (normalizedTargetDeviceId && !isLikelyUid(normalizedTargetDeviceId)) {
          return normalizedTargetDeviceId;
        }
        if (!isLikelyUid(idToSave)) {
          return idToSave;
        }
        return undefined;
      })();

      const trimmedName = memberName.trim();
      const trimmedPhone = phoneNumber.trim();
      const trimmedNotes = notes.trim();

      // Require a canonical Firebase UID so membership can sync to all devices/accounts.
      // Without UID, member remains local-only and messaging/group features break across devices.
      if (!uidToSave || !isLikelyUid(uidToSave)) {
        Alert.alert(
          'Kullanıcı Kimliği Doğrulanamadı',
          'Bu kişi için Firebase UID çözümlenemedi. Lütfen kişinin güncel AfetNet QR kodunu tekrar tarayın.',
        );
        haptics.notificationError();
        setIsSubmitting(false);
        return;
      }

      // Verify the UID actually exists as a user in Firebase (prevent ghost members)
      try {
        const { getFirestoreInstanceAsync } = await import('../../services/firebase/FirebaseInstanceManager');
        const db = await getFirestoreInstanceAsync();
        if (db) {
          const { doc, getDoc } = await import('firebase/firestore');
          const userDoc = await Promise.race([
            getDoc(doc(db, 'users', uidToSave)),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);
          if (userDoc && typeof userDoc === 'object' && 'exists' in userDoc && !userDoc.exists()) {
            Alert.alert(
              'Kullanıcı Bulunamadı',
              'Bu ID ile kayıtlı bir AfetNet kullanıcısı bulunamadı. Lütfen kodu kontrol edip tekrar deneyin.',
            );
            haptics.notificationError();
            setIsSubmitting(false);
            return;
          }
          // If userDoc has a displayName, use it as fallback name
          if (userDoc && typeof userDoc === 'object' && 'exists' in userDoc && userDoc.exists()) {
            const userData = (userDoc as any).data();
            if (userData?.displayName && !memberName.trim()) {
              setMemberName(userData.displayName);
            }
          }
        }
        // If db is null (offline), skip verification — offline-first is important
      } catch (verifyError) {
        // Offline or permission error — allow adding (will sync later)
        logger.debug('UID existence check skipped (offline/error):', verifyError);
      }

      // ELITE: Add member with comprehensive data
      // Do NOT seed new member location with inviter's GPS. Member will publish own location.
      await useFamilyStore.getState().addMember({
        uid: uidToSave,
        name: trimmedName,
        status: 'unknown',
        // New member has no confirmed activity yet; avoid false "just now" freshness.
        lastSeen: 0,
        latitude: 0,
        longitude: 0,
        location: undefined,
        ...(resolvedDeviceId ? { deviceId: resolvedDeviceId } : {}),
        relationship: selectedRelationship || undefined,
        phoneNumber: trimmedPhone || undefined,
        notes: trimmedNotes || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      haptics.notificationSuccess();
      logger.info('Family member added successfully:', { uid: uidToSave, deviceId: resolvedDeviceId, name: trimmedName });

      // ELITE: Show success message
      Alert.alert(
        'Başarılı',
        `${trimmedName} başarıyla eklendi!`,
        [
          {
            text: 'Tamam',
            onPress: () => {
              navigation.goBack();
            },
          },
        ],
      );
    } catch (error) {
      logger.error('Error adding family member:', error);
      Alert.alert('Hata', 'Üye eklenirken bir hata oluştu. Lütfen tekrar deneyin.');
      haptics.notificationError();
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    manualId,
    targetUid,
    targetDeviceId,
    memberName,
    selectedRelationship,
    phoneNumber,
    notes,
    validateMemberData,
    navigation,
  ]);

  // ELITE: Reset form
  const handleReset = useCallback(() => {
    if (scannerResetTimeoutRef.current) {
      clearTimeout(scannerResetTimeoutRef.current);
      scannerResetTimeoutRef.current = null;
    }
    setScanned(false);
    setManualId('');
    setTargetUid('');
    setTargetDeviceId('');
    setMemberName('');
    setSelectedRelationship(null);
    setPhoneNumber('');
    setNotes('');
    setAddMethod('qr');
    setIsSubmitting(false);
    haptics.impactLight();
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
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#334155" />
        </Pressable>
        <Text style={styles.headerTitle}>Aile Üyesi Ekle</Text>
        <Pressable onPress={handleReset} style={styles.resetButton}>
          <Ionicons name="refresh" size={24} color="#64748b" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Method Selection */}
          <View style={styles.methodSelector}>
            <Pressable
              style={[styles.methodButton, addMethod === 'qr' && styles.methodButtonActive]}
              onPress={() => {
                if (scannerResetTimeoutRef.current) {
                  clearTimeout(scannerResetTimeoutRef.current);
                  scannerResetTimeoutRef.current = null;
                }
                setScanned(false);
                setAddMethod('qr');
                haptics.impactLight();
              }}
            >
              <Ionicons
                name="qr-code-outline"
                size={20}
                color={addMethod === 'qr' ? '#0ea5e9' : '#64748b'}
              />
              <Text style={[styles.methodButtonText, addMethod === 'qr' && styles.methodButtonTextActive]}>
                QR Kod
              </Text>
            </Pressable>
            <Pressable
              style={[styles.methodButton, addMethod === 'manual' && styles.methodButtonActive]}
              onPress={() => {
                setAddMethod('manual');
                haptics.impactLight();
              }}
            >
              <Ionicons
                name="keypad-outline"
                size={20}
                color={addMethod === 'manual' ? '#0ea5e9' : '#64748b'}
              />
              <Text style={[styles.methodButtonText, addMethod === 'manual' && styles.methodButtonTextActive]}>
                Manuel
              </Text>
            </Pressable>
          </View>

          {/* QR Code Scanner */}
          {addMethod === 'qr' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>QR Kod Tarayın</Text>
              <Text style={styles.sectionSubtitle}>
                Üyenin QR kodunu kameraya gösterin
              </Text>
              <View style={styles.scannerContainer}>
                {!permission && (
                  <Pressable style={styles.permissionButton} onPress={requestPermission}>
                    <Ionicons name="camera" size={32} color="#fff" />
                    <Text style={styles.permissionButtonText}>Kamera İzni İste</Text>
                  </Pressable>
                )}
                {permission && !permission.granted && (
                  <View style={styles.permissionContainer}>
                    <Ionicons name="camera-outline" size={64} color="#64748b" />
                    <Text style={styles.permissionDeniedText}>
                      Kamera izni gereklidir. Lütfen ayarlardan izin verin.
                    </Text>
                    <Pressable style={styles.permissionButton} onPress={requestPermission}>
                      <Ionicons name="camera" size={24} color="#fff" />
                      <Text style={styles.permissionButtonText}>Tekrar İzni İste</Text>
                    </Pressable>
                  </View>
                )}
                {permission?.granted && (
                  <>
                    <CameraView
                      style={StyleSheet.absoluteFillObject}
                      barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                      }}
                      onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    />
                    <View style={styles.scannerOverlay}>
                      <View style={styles.scannerFrame} />
                      <Text style={styles.scannerHint}>
                        QR kodu çerçeve içine alın
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Manual ID Entry */}
          {addMethod === 'manual' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Üye ID'si</Text>
              <Text style={styles.sectionSubtitle}>
                Üyenin AFN kodunu, UID'sini veya kullanıcı kodunu girin
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="AFN-XXXXXXXX veya UID"
                  placeholderTextColor="#94a3b8"
                  value={manualId}
                  onChangeText={handleManualIdChange}
                  maxLength={64}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
                {manualId.length > 0 && isValidMemberIdentifier(manualId) && (
                  <View style={styles.validIndicator}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
                  </View>
                )}
                {manualId.length > 0 && checkDuplicate(manualId) && (
                  <View style={styles.warningIndicator}>
                    <Ionicons name="warning" size={20} color={colors.status.warning} />
                  </View>
                )}
              </View>
              {manualId.length > 0 && checkDuplicate(manualId) && (
                <Text style={styles.warningText}>
                  Bu ID'ye sahip bir üye zaten mevcut
                </Text>
              )}
            </View>
          )}

          {/* Member Name */}
          {(addMethod === 'manual' || scanned) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>İsim</Text>
              <Text style={styles.sectionSubtitle}>
                Üyenin ismini veya ilişki türünü seçin
              </Text>

              {/* Quick Relationship Selection */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.relationshipScroll}
                contentContainerStyle={styles.relationshipContainer}
              >
                {RELATIONSHIP_TYPES.map((relationship) => (
                  <Pressable
                    key={relationship.id}
                    style={[
                      styles.relationshipButton,
                      selectedRelationship === relationship.id && styles.relationshipButtonActive,
                    ]}
                    onPress={() => handleRelationshipSelect(relationship.id)}
                  >
                    <Ionicons
                      name={relationship.icon}
                      size={20}
                      color={selectedRelationship === relationship.id ? '#0ea5e9' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.relationshipButtonText,
                        selectedRelationship === relationship.id && styles.relationshipButtonTextActive,
                      ]}
                    >
                      {relationship.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Custom Name Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="İsim girin (örn: Ahmet, Ayşe)"
                  placeholderTextColor="#94a3b8"
                  value={memberName}
                  onChangeText={(text) => {
                    const sanitized = text.substring(0, 50);
                    setMemberName(sanitized);
                    // Clear relationship selection if user types custom name
                    if (sanitized.length > 0 && selectedRelationship) {
                      const relationship = RELATIONSHIP_TYPES.find(r => r.id === selectedRelationship);
                      if (relationship && sanitized !== relationship.label) {
                        setSelectedRelationship(null);
                      }
                    }
                  }}
                  maxLength={50}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
                {memberName.length > 0 && (
                  <Text style={styles.charCount}>{memberName.length}/50</Text>
                )}
              </View>
            </View>
          )}

          {/* Phone Number (Optional) */}
          {(addMethod === 'manual' || scanned) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Telefon Numarası <Text style={styles.optionalText}>(Opsiyonel)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="05551234567 veya +905551234567"
                placeholderTextColor="#94a3b8"
                value={phoneNumber}
                onChangeText={(text) => {
                  // Allow only digits, +, spaces
                  const sanitized = text.replace(/[^\d+\s]/g, '').substring(0, 20);
                  setPhoneNumber(sanitized);
                }}
                keyboardType="phone-pad"
                maxLength={20}
                editable={!isSubmitting}
              />
              {phoneNumber.length > 0 && !validatePhoneNumber(phoneNumber) && (
                <Text style={styles.errorText}>
                  Geçersiz telefon numarası formatı
                </Text>
              )}
            </View>
          )}

          {/* Notes (Optional) */}
          {(addMethod === 'manual' || scanned) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Notlar <Text style={styles.optionalText}>(Opsiyonel)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Ek bilgiler, özel notlar..."
                placeholderTextColor="#94a3b8"
                value={notes}
                onChangeText={(text) => setNotes(text.substring(0, 500))}
                maxLength={500}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isSubmitting}
              />
              {notes.length > 0 && (
                <Text style={styles.charCount}>{notes.length}/500</Text>
              )}
            </View>
          )}

          {/* Add Button */}
          {(addMethod === 'manual' || scanned) && (
            <View style={styles.section}>
              <GlassButton
                title={isSubmitting ? "Ekleniyor..." : "Üyeyi Ekle"}
                onPress={handleAddMember}
                variant="success"
                icon={isSubmitting ? undefined : "checkmark-circle"}
                loading={isSubmitting}
                disabled={!manualId || !memberName || isSubmitting}
                fullWidth
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155', // Dark Slate
    flex: 1,
    textAlign: 'center',
  },
  resetButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  methodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 16,
    padding: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  methodButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  methodButtonText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '600',
  },
  methodButtonTextActive: {
    color: '#0ea5e9', // Sky Blue
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  optionalText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '400',
  },
  scannerContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionDeniedText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: '70%',
    aspectRatio: 1,
    borderWidth: 3,
    borderColor: '#0ea5e9',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scannerHint: {
    position: 'absolute',
    bottom: 40,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
  validIndicator: {
    position: 'absolute',
    right: 12,
    top: 16,
  },
  warningIndicator: {
    position: 'absolute',
    right: 12,
    top: 16,
  },
  warningText: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  charCount: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 4,
  },
  relationshipScroll: {
    marginBottom: 12,
  },
  relationshipContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  relationshipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    gap: 6,
  },
  relationshipButtonActive: {
    backgroundColor: '#eff6ff', // Light Blue bg
    borderColor: '#0ea5e9',
    borderWidth: 1,
  },
  relationshipButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  relationshipButtonTextActive: {
    color: '#0ea5e9',
    fontWeight: '600',
  },
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  addButtonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  addButtonTextDisabled: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '700',
    fontSize: 16,
  },
});
