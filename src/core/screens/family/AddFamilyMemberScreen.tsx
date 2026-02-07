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
import GlassButton from '../../components/buttons/GlassButton';

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

const isValidDeviceId = (id: string) => /^afn-[a-zA-Z0-9]{4,}$/i.test(id);

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
  const [memberName, setMemberName] = useState('');
  const [selectedRelationship, setSelectedRelationship] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [addMethod, setAddMethod] = useState<'qr' | 'manual'>('qr');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const members = useFamilyStore((state) => state.members);

  // Initialize service
  useEffect(() => {
    identityService.initialize();
  }, []);

  // ELITE: Check for duplicate IDs or Device IDs
  const checkDuplicate = useCallback((id: string): boolean => {
    return members.some(m => m.id === id || m.deviceId === id);
  }, [members]);

  // ELITE: Validate phone number format (optional)
  const validatePhoneNumber = useCallback((phone: string): boolean => {
    if (!phone || phone.trim().length === 0) return true; // Optional
    // Turkish phone number format: +90XXXXXXXXXX or 0XXXXXXXXXX
    const phoneRegex = /^(\+90|0)?[5][0-9]{9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }, []);

  // ELITE: Memoized callback with comprehensive error handling
  const handleBarCodeScanned = useCallback(({ type, data }: { type: string; data: string }) => {
    try {
      if (scanned || isSubmitting) return;

      const parsedData = identityService.parseQRPayload(data);

      if (!parsedData) {
        logger.warn('Invalid QR code data:', data);
        Alert.alert('Hata', 'Geçersiz AfetNet QR Kodu.');
        // Don't set scanned=true so user can try again immediately? 
        // Better to wait a bit
        setScanned(true);
        setTimeout(() => setScanned(false), 2000);
        return;
      }

      setScanned(true);
      haptics.notificationSuccess();

      const { id, did, name } = parsedData;

      // ELITE: Check for duplicates
      if (checkDuplicate(id) || (did && checkDuplicate(did))) {
        Alert.alert('Üye Zaten Mevcut', 'Bu kişi zaten listenizde bulunuyor.');
        return; // Stay on screen
      }

      // Auto-fill data from QR
      setManualId(id);
      if (did) setTargetDeviceId(did);
      else setTargetDeviceId(id); // Fallback

      if (name && name !== 'Unknown User') {
        setMemberName(name);
      }

      setAddMethod('manual'); // Switch to confirm details
      haptics.impactMedium();

      Alert.alert('Kişi Bulundu', `"${name || id}" bulundu. Lütfen bilgileri onaylayın.`);

    } catch (error) {
      logger.error('Error in handleBarCodeScanned:', error);
      Alert.alert('Hata', 'QR kod işlenirken bir hata oluştu.');
      setScanned(false);
    }
  }, [scanned, isSubmitting, checkDuplicate]);

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

  // ELITE: Handle manual ID validation
  const handleManualIdChange = useCallback((text: string) => {
    // Elite Security: Sanitize input - only allow alphanumeric and dash
    const sanitized = text.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 30);
    setManualId(sanitized);

    // Auto-check for duplicates as user types
    if (sanitized.length > 0 && isValidDeviceId(sanitized)) {
      if (checkDuplicate(sanitized)) {
        // Show warning but don't block - user can still proceed
        logger.warn('Duplicate device ID detected:', sanitized);
      }
    }
  }, [checkDuplicate]);

  // ELITE: Comprehensive validation before adding member
  const validateMemberData = useCallback((): { valid: boolean; error?: string } => {
    // Validate device ID
    if (!manualId || manualId.trim().length === 0) {
      return { valid: false, error: 'Lütfen geçerli bir üye ID girin veya QR kod tarayın.' };
    }

    if (!isValidDeviceId(manualId.trim())) {
      return { valid: false, error: 'Geçersiz ID formatı. ID "AFN-" ile başlamalı ve geçerli formatta olmalıdır.' };
    }

    // Check for duplicates
    if (checkDuplicate(manualId.trim())) {
      return { valid: false, error: 'Bu ID\'ye sahip bir üye zaten listenizde bulunuyor.' };
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
  }, [manualId, memberName, phoneNumber, notes, checkDuplicate, validatePhoneNumber]);

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
      const idToSave = manualId.trim();
      // Use targetDeviceId if available (from QR), otherwise fallback to manual ID as device ID
      const deviceIdToSave = targetDeviceId || idToSave;

      const trimmedName = memberName.trim();
      const trimmedPhone = phoneNumber.trim();
      const trimmedNotes = notes.trim();

      // ELITE: Add member with comprehensive data
      // Do NOT seed new member location with inviter's GPS. Member will publish own location.
      await useFamilyStore.getState().addMember({
        id: idToSave, // Use Identity ID
        name: trimmedName,
        status: 'unknown',
        lastSeen: Date.now(),
        latitude: 0,
        longitude: 0,
        location: undefined,
        deviceId: deviceIdToSave, // Use Physical ID for Mesh routing
        relationship: selectedRelationship || undefined,
        phoneNumber: trimmedPhone || undefined,
        notes: trimmedNotes || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      haptics.notificationSuccess();
      logger.info('Family member added successfully:', { deviceId: deviceIdToSave, name: trimmedName });

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
  }, [isSubmitting, manualId, memberName, phoneNumber, notes, validateMemberData, navigation]);

  // ELITE: Handle manual add button
  const handleManualAddClick = useCallback(() => {
    if (!manualId || manualId.trim().length === 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir üye ID girin.');
      return;
    }

    if (!isValidDeviceId(manualId.trim())) {
      Alert.alert('Hata', 'Geçersiz ID formatı. ID "AFN-" ile başlamalı ve geçerli formatta olmalıdır.');
      return;
    }

    if (checkDuplicate(manualId.trim())) {
      Alert.alert('Üye Zaten Mevcut', 'Bu ID\'ye sahip bir üye zaten listenizde bulunuyor.');
      return;
    }

    // Switch to manual mode for name entry
    setAddMethod('manual');
    haptics.impactMedium();
  }, [manualId, checkDuplicate]);

  // ELITE: Reset form
  const handleReset = useCallback(() => {
    setScanned(false);
    setManualId('');
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
                Üyenin AfetNet ID'sini girin
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="afn-xxxxxxxx"
                  placeholderTextColor="#94a3b8"
                  value={manualId}
                  onChangeText={handleManualIdChange}
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
                {manualId.length > 0 && isValidDeviceId(manualId) && (
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
