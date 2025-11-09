/**
 * HEALTH PROFILE SCREEN - Elite Luxury Design
 * Completely redesigned with categories, luxury aesthetics, and premium effects
 * 
 * DESIGN PHILOSOPHY:
 * - Category-based organization
 * - Luxury, eye-catching design
 * - Elite designer quality
 * - Premium spacing and margins
 * - Sophisticated animations
 * - Unique, special appearance
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn, SlideInRight } from 'react-native-reanimated';
import { useHealthProfileStore, type HealthProfile, type EmergencyContact } from '../../stores/healthProfileStore';
import * as haptics from '../../utils/haptics';
import { colors, typography, spacing } from '../../theme';
import { borderRadius } from '../../theme/spacing';
import { createLogger } from '../../utils/logger';
import { sanitizeString } from '../../utils/validation';

const logger = createLogger('HealthProfileScreen');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
type BloodType = typeof BLOOD_TYPES[number];

const GENDERS = ['Erkek', 'Kadın', 'Diğer'] as const;
type Gender = typeof GENDERS[number];

const RELATIONSHIPS = ['Eş', 'Anne', 'Baba', 'Kardeş', 'Çocuk', 'Dost', 'Doktor', 'Diğer'] as const;
type Relationship = typeof RELATIONSHIPS[number];

const ORGAN_DONOR_STATUS = ['Evet', 'Hayır', 'Belirtmek istemiyorum'] as const;
type OrganDonorStatus = typeof ORGAN_DONOR_STATUS[number];

interface HealthProfileFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender | '';
  height: string;
  weight: string;
  bloodType: BloodType | '';
  allergies: string[];
  chronicConditions: string[];
  medications: string[];
  medicalHistory: string;
  insuranceProvider: string;
  insuranceNumber: string;
  organDonorStatus: OrganDonorStatus | '';
  emergencyContacts: EmergencyContact[];
  notes: string;
}

const CATEGORIES = [
  { id: 'personal', title: 'Kişisel Bilgiler', icon: 'person', color: '#3b82f6' },
  { id: 'medical', title: 'Tıbbi Bilgiler', icon: 'medical', color: '#10b981' },
  { id: 'contacts', title: 'Acil Durum Yakınları', icon: 'call', color: '#ef4444' },
  { id: 'emergency', title: 'Acil Durum Notları', icon: 'alert-circle', color: '#f59e0b' },
] as const;

export default function HealthProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, loadProfile, isLoaded } = useHealthProfileStore();
  
  const [formData, setFormData] = useState<HealthProfileFormData>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    height: '',
    weight: '',
    bloodType: '',
    allergies: [],
    chronicConditions: [],
    medications: [],
    medicalHistory: '',
    insuranceProvider: '',
    insuranceNumber: '',
    organDonorStatus: '',
    emergencyContacts: [],
    notes: '',
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [medicationInput, setMedicationInput] = useState('');

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        await loadProfile();
        logger.info('Health profile loaded successfully');
      } catch (error) {
        logger.debug('Failed to load health profile:', error);
      }
    };
    
    if (!isLoaded) {
    loadProfileData();
    }
  }, [loadProfile, isLoaded]);

  useEffect(() => {
    if (profile && isLoaded) {
      try {
        let allergies: string[] = [];
        let chronicConditions: string[] = [];
        let medications: string[] = [];
        let emergencyContacts: EmergencyContact[] = [];

        try {
          if (Array.isArray(profile.allergies)) {
            allergies = profile.allergies;
          } else if (profile.allergies && typeof profile.allergies === 'object') {
            allergies = Object.values(profile.allergies).filter(v => typeof v === 'string') as string[];
          }

          if (Array.isArray(profile.chronicConditions)) {
            chronicConditions = profile.chronicConditions;
          } else if (Array.isArray(profile.chronicDiseases)) {
            chronicConditions = profile.chronicDiseases;
          } else if (profile.chronicConditions && typeof profile.chronicConditions === 'object') {
            chronicConditions = Object.values(profile.chronicConditions).filter(v => typeof v === 'string') as string[];
          }

          if (Array.isArray(profile.medications)) {
            medications = profile.medications;
          } else if (Array.isArray(profile.emergencyMedications)) {
            medications = profile.emergencyMedications;
          } else if (profile.medications && typeof profile.medications === 'object') {
            medications = Object.values(profile.medications).filter(v => typeof v === 'string') as string[];
          }

          if (Array.isArray(profile.emergencyContacts)) {
            emergencyContacts = profile.emergencyContacts;
          } else if (profile.emergencyContacts && typeof profile.emergencyContacts === 'object') {
            const contactsArray = Object.values(profile.emergencyContacts);
            emergencyContacts = contactsArray.filter(c => 
              c && typeof c === 'object' && 
              ('id' in c || 'name' in c || 'phone' in c)
            ) as EmergencyContact[];
          }
        } catch (parseError: any) {
          logger.debug('Profile array parsing error (non-critical):', parseError?.message);
        }

        setFormData({
          firstName: profile.firstName ? sanitizeString(String(profile.firstName)) : '',
          lastName: profile.lastName ? sanitizeString(String(profile.lastName)) : '',
          dateOfBirth: profile.dateOfBirth ? sanitizeString(String(profile.dateOfBirth)) : '',
          gender: (profile.gender && GENDERS.includes(profile.gender as Gender)) ? (profile.gender as Gender) : '',
          height: profile.height ? sanitizeString(String(profile.height)) : '',
          weight: profile.weight ? sanitizeString(String(profile.weight)) : '',
          bloodType: (profile.bloodType && BLOOD_TYPES.includes(profile.bloodType as BloodType)) ? (profile.bloodType as BloodType) : '',
          allergies: allergies.map(a => sanitizeString(String(a))).filter(a => a.length > 0),
          chronicConditions: chronicConditions.map(c => sanitizeString(String(c))).filter(c => c.length > 0),
          medications: medications.map(m => sanitizeString(String(m))).filter(m => m.length > 0),
          medicalHistory: profile.medicalHistory ? sanitizeString(String(profile.medicalHistory)) : '',
          insuranceProvider: profile.insuranceProvider ? sanitizeString(String(profile.insuranceProvider)) : '',
          insuranceNumber: profile.insuranceNumber ? sanitizeString(String(profile.insuranceNumber)) : '',
          organDonorStatus: (profile.organDonorStatus && ORGAN_DONOR_STATUS.includes(profile.organDonorStatus as OrganDonorStatus)) ? (profile.organDonorStatus as OrganDonorStatus) : '',
          emergencyContacts: emergencyContacts.map(c => ({
            id: c.id ? sanitizeString(String(c.id)) : Date.now().toString(),
            name: c.name ? sanitizeString(String(c.name)) : '',
            relationship: c.relationship ? sanitizeString(String(c.relationship)) : 'Diğer',
            phone: c.phone ? sanitizeString(String(c.phone)) : '',
          })),
          notes: profile.notes ? sanitizeString(String(profile.notes)) : '',
        });
      } catch (error: any) {
        logger.debug('Profile data parsing error (non-critical):', error?.message || String(error));
      }
    }
  }, [profile, isLoaded]);

  const validatePhoneNumber = useCallback((phone: string): boolean => {
    if (!phone || phone.trim().length === 0) return false;
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^(\+90|0)?5\d{9}$/.test(cleaned) || /^\+\d{10,15}$/.test(cleaned);
  }, []);

  const formatPhoneNumber = useCallback((text: string): string => {
    const cleaned = text.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+90')) {
      return cleaned.substring(0, 13);
    } else if (cleaned.startsWith('0')) {
      return cleaned.substring(0, 11);
    } else if (cleaned.startsWith('5')) {
      return '0' + cleaned.substring(0, 10);
    }
    return cleaned.substring(0, 15);
  }, []);

  const handleAddAllergy = useCallback(() => {
    const trimmed = allergyInput.trim();
    if (!trimmed) return;
    const sanitized = sanitizeString(trimmed);
    if (sanitized.length > 100) {
      Alert.alert('Uyarı', 'Alerji adı çok uzun (maksimum 100 karakter)');
      return;
    }
    if (formData.allergies.includes(sanitized)) {
      Alert.alert('Bilgi', 'Bu alerji zaten eklenmiş');
      return;
    }
    setFormData(prev => ({ ...prev, allergies: [...prev.allergies, sanitized] }));
    setAllergyInput('');
    haptics.impactLight();
  }, [allergyInput, formData.allergies]);

  const handleRemoveAllergy = useCallback((allergy: string) => {
    setFormData(prev => ({ ...prev, allergies: prev.allergies.filter(a => a !== allergy) }));
    haptics.impactLight();
  }, []);

  const handleAddCondition = useCallback(() => {
    const trimmed = conditionInput.trim();
    if (!trimmed) return;
    const sanitized = sanitizeString(trimmed);
    if (sanitized.length > 100) {
      Alert.alert('Uyarı', 'Hastalık adı çok uzun (maksimum 100 karakter)');
      return;
    }
    if (formData.chronicConditions.includes(sanitized)) {
      Alert.alert('Bilgi', 'Bu hastalık zaten eklenmiş');
      return;
    }
    setFormData(prev => ({ ...prev, chronicConditions: [...prev.chronicConditions, sanitized] }));
    setConditionInput('');
    haptics.impactLight();
  }, [conditionInput, formData.chronicConditions]);

  const handleRemoveCondition = useCallback((condition: string) => {
    setFormData(prev => ({ ...prev, chronicConditions: prev.chronicConditions.filter(c => c !== condition) }));
    haptics.impactLight();
  }, []);

  const handleAddMedication = useCallback(() => {
    const trimmed = medicationInput.trim();
    if (!trimmed) return;
    const sanitized = sanitizeString(trimmed);
    if (sanitized.length > 100) {
      Alert.alert('Uyarı', 'İlaç adı çok uzun (maksimum 100 karakter)');
      return;
    }
    if (formData.medications.includes(sanitized)) {
      Alert.alert('Bilgi', 'Bu ilaç zaten eklenmiş');
      return;
    }
    setFormData(prev => ({ ...prev, medications: [...prev.medications, sanitized] }));
    setMedicationInput('');
    haptics.impactLight();
  }, [medicationInput, formData.medications]);

  const handleRemoveMedication = useCallback((medication: string) => {
    setFormData(prev => ({ ...prev, medications: prev.medications.filter(m => m !== medication) }));
    haptics.impactLight();
  }, []);

  const handleAddEmergencyContact = useCallback(() => {
    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: '',
      relationship: 'Diğer',
      phone: '',
    };
    setFormData(prev => ({ ...prev, emergencyContacts: [...prev.emergencyContacts, newContact] }));
    haptics.impactLight();
  }, []);

  const handleUpdateEmergencyContact = useCallback((id: string, updates: Partial<EmergencyContact>) => {
    setFormData(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
  }, []);

  const handleRemoveEmergencyContact = useCallback((id: string) => {
    Alert.alert(
      'Kişiyi Kaldır',
      'Bu acil kişiyi kaldırmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: () => {
            setFormData(prev => ({ ...prev, emergencyContacts: prev.emergencyContacts.filter(c => c.id !== id) }));
            haptics.impactLight();
          },
        },
      ]
    );
  }, []);

  const handleSave = useCallback(async () => {
    haptics.impactMedium();

    const validContacts = formData.emergencyContacts.filter(c => {
      if (!c.name || !c.phone) return false;
      return validatePhoneNumber(c.phone);
    });
    
    const invalidContacts = formData.emergencyContacts.filter(c => {
      if (!c.name || !c.phone) return true;
      return !validatePhoneNumber(c.phone);
    });
    
    if (invalidContacts.length > 0) {
      Alert.alert(
        'Geçersiz Bilgiler',
        `Lütfen geçerli telefon numaraları girin:\n${invalidContacts.map(c => c.name || 'İsimsiz').join(', ')}`,
        [{ text: 'Tamam' }]
      );
      return;
    }

    setIsSaving(true);
    
    try {
      const profileUpdate: Partial<HealthProfile> = {
        firstName: sanitizeString(formData.firstName),
        lastName: sanitizeString(formData.lastName),
        dateOfBirth: sanitizeString(formData.dateOfBirth),
        gender: formData.gender as any,
        height: sanitizeString(formData.height),
        weight: sanitizeString(formData.weight),
        bloodType: formData.bloodType,
        allergies: formData.allergies.map(a => sanitizeString(a)),
        chronicConditions: formData.chronicConditions.map(c => sanitizeString(c)),
        chronicDiseases: formData.chronicConditions.map(c => sanitizeString(c)),
        medications: formData.medications.map(m => sanitizeString(m)),
        emergencyMedications: formData.medications.map(m => sanitizeString(m)),
        medicalHistory: sanitizeString(formData.medicalHistory),
        insuranceProvider: sanitizeString(formData.insuranceProvider),
        insuranceNumber: sanitizeString(formData.insuranceNumber),
        organDonorStatus: formData.organDonorStatus as any,
        emergencyContacts: validContacts.map(c => ({
          id: sanitizeString(c.id),
          name: sanitizeString(c.name),
          relationship: sanitizeString(c.relationship),
          phone: sanitizeString(c.phone),
        })),
        notes: sanitizeString(formData.notes),
        lastUpdated: Date.now(),
      };
      
      await updateProfile(profileUpdate);
      Alert.alert('Başarılı', 'Sağlık profiliniz kaydedildi.', [{ text: 'Tamam' }]);
      logger.info('Health profile saved successfully');
    } catch (error: any) {
      logger.error('Failed to save health profile:', error);
      Alert.alert(
        'Kayıt Hatası',
        'Sağlık profiliniz kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.',
        [
          { text: 'Tekrar Dene', onPress: handleSave },
          { text: 'Tamam', style: 'cancel' },
        ]
      );
    } finally {
      setIsSaving(false);
    }
  }, [formData, validatePhoneNumber, updateProfile]);

  const renderCategory = useCallback((category: typeof CATEGORIES[number], index: number) => {
    const delay = index * 100;

    switch (category.id) {
      case 'personal':
  return (
          <Animated.View key={category.id} entering={FadeInDown.delay(delay)} style={styles.categoryContainer}>
            <View style={styles.categoryHeader}>
      <LinearGradient
                colors={[category.color, `${category.color}80`]}
                style={styles.categoryIconGradient}
              >
                <Ionicons name={category.icon as any} size={24} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.categoryTitle}>{category.title}</Text>
            </View>
            
            <View style={styles.categoryContent}>
              <View style={styles.formRow}>
                <Text style={styles.label}>Ad</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Adınız"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.firstName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, firstName: text }))}
                  maxLength={50}
                />
              </View>
              
              <View style={styles.formRow}>
                <Text style={styles.label}>Soyad</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Soyadınız"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.lastName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, lastName: text }))}
                  maxLength={50}
                />
              </View>
              
              <View style={styles.formRow}>
                <Text style={styles.label}>Doğum Tarihi</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.dateOfBirth}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, dateOfBirth: text }))}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              
              <View style={styles.formRow}>
                <Text style={styles.label}>Cinsiyet</Text>
                <View style={styles.buttonGroup}>
                  {GENDERS.map((gender) => (
                    <Pressable
                      key={gender}
                      style={[
                        styles.button,
                        formData.gender === gender && styles.buttonActive,
                      ]}
          onPress={() => {
                        setFormData(prev => ({ ...prev, gender }));
            haptics.impactLight();
                      }}
                    >
                      {formData.gender === gender && (
                        <LinearGradient
                          colors={[category.color, `${category.color}CC`]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.lg }]}
                        />
                      )}
                      <Text
                        style={[
                          styles.buttonText,
                          formData.gender === gender && styles.buttonTextActive,
                        ]}
                      >
                        {gender}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              
              <View style={styles.formRow}>
                <Text style={styles.label}>Boy ve Kilo</Text>
                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <TextInput
                      style={styles.input}
                      placeholder="Boy (cm)"
                      placeholderTextColor={colors.text.tertiary}
                      value={formData.height}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, height: text.replace(/[^\d]/g, '') }))}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <TextInput
                      style={styles.input}
                      placeholder="Kilo (kg)"
                      placeholderTextColor={colors.text.tertiary}
                      value={formData.weight}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, weight: text.replace(/[^\d]/g, '') }))}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        );

      case 'medical':
        return (
          <Animated.View key={category.id} entering={FadeInDown.delay(delay)} style={styles.categoryContainer}>
            <View style={styles.categoryHeader}>
              <LinearGradient
                colors={[category.color, `${category.color}80`]}
                style={styles.categoryIconGradient}
              >
                <Ionicons name={category.icon as any} size={24} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.categoryTitle}>{category.title}</Text>
            </View>
            
            <View style={styles.categoryContent}>
              <View style={styles.formRow}>
                <Text style={styles.label}>Kan Grubu</Text>
          <View style={styles.bloodTypeGrid}>
                  {BLOOD_TYPES.map((type) => (
                    <Pressable
                key={type}
                style={[
                  styles.bloodTypeButton,
                        formData.bloodType === type && styles.bloodTypeButtonActive,
                ]}
                onPress={() => {
                        setFormData(prev => ({ ...prev, bloodType: type }));
                  haptics.impactLight();
                      }}
                    >
                      {formData.bloodType === type && (
                        <LinearGradient
                          colors={[category.color, `${category.color}CC`]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.lg }]}
                        />
                      )}
                <Text
                  style={[
                    styles.bloodTypeText,
                          formData.bloodType === type && styles.bloodTypeTextActive,
                  ]}
                >
                  {type}
                </Text>
                    </Pressable>
            ))}
          </View>
        </View>

              <View style={styles.formRow}>
                <Text style={styles.label}>Alerjiler</Text>
                {formData.allergies.length > 0 && (
                  <View style={styles.chipsContainer}>
                    {formData.allergies.map((allergy, index) => (
                      <Animated.View key={index} entering={FadeIn.delay(index * 30)} style={styles.chip}>
                        <Text style={styles.chipText}>{allergy}</Text>
                        <Pressable
                          onPress={() => handleRemoveAllergy(allergy)}
                          style={styles.chipRemove}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.text.secondary} />
                        </Pressable>
                      </Animated.View>
                    ))}
                  </View>
                )}
                <View style={styles.addRow}>
          <TextInput
                    style={styles.addInput}
            placeholder="Örn: Polen, Fıstık, Penisilin"
            placeholderTextColor={colors.text.tertiary}
                    value={allergyInput}
                    onChangeText={setAllergyInput}
                    onSubmitEditing={handleAddAllergy}
                    returnKeyType="done"
                  />
                  <Pressable onPress={handleAddAllergy} style={styles.addButton}>
                    <LinearGradient
                      colors={[category.color, `${category.color}CC`]}
                      style={styles.addButtonGradient}
                    >
                      <Ionicons name="add" size={24} color="#ffffff" />
                    </LinearGradient>
                  </Pressable>
                </View>
        </View>

              <View style={styles.formRow}>
                <Text style={styles.label}>Kronik Hastalıklar</Text>
                {formData.chronicConditions.length > 0 && (
                  <View style={styles.chipsContainer}>
                    {formData.chronicConditions.map((condition, index) => (
                      <Animated.View key={index} entering={FadeIn.delay(index * 30)} style={styles.chip}>
                        <Text style={styles.chipText}>{condition}</Text>
                        <Pressable
                          onPress={() => handleRemoveCondition(condition)}
                          style={styles.chipRemove}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.text.secondary} />
                        </Pressable>
                      </Animated.View>
                    ))}
                  </View>
                )}
                <View style={styles.addRow}>
          <TextInput
                    style={styles.addInput}
            placeholder="Örn: Diyabet, Astım, Hipertansiyon"
            placeholderTextColor={colors.text.tertiary}
                    value={conditionInput}
                    onChangeText={setConditionInput}
                    onSubmitEditing={handleAddCondition}
                    returnKeyType="done"
                  />
                  <Pressable onPress={handleAddCondition} style={styles.addButton}>
                    <LinearGradient
                      colors={[category.color, `${category.color}CC`]}
                      style={styles.addButtonGradient}
                    >
                      <Ionicons name="add" size={24} color="#ffffff" />
                    </LinearGradient>
                  </Pressable>
                </View>
        </View>

              <View style={styles.formRow}>
                <Text style={styles.label}>Acil İlaçlar</Text>
                {formData.medications.length > 0 && (
                  <View style={styles.chipsContainer}>
                    {formData.medications.map((medication, index) => (
                      <Animated.View key={index} entering={FadeIn.delay(index * 30)} style={styles.chip}>
                        <Text style={styles.chipText}>{medication}</Text>
                        <Pressable
                          onPress={() => handleRemoveMedication(medication)}
                          style={styles.chipRemove}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.text.secondary} />
                        </Pressable>
                      </Animated.View>
                    ))}
                  </View>
                )}
                <View style={styles.addRow}>
          <TextInput
                    style={styles.addInput}
            placeholder="Örn: İnsülin, Ventolin, Aspirin"
            placeholderTextColor={colors.text.tertiary}
                    value={medicationInput}
                    onChangeText={setMedicationInput}
                    onSubmitEditing={handleAddMedication}
                    returnKeyType="done"
                  />
                  <Pressable onPress={handleAddMedication} style={styles.addButton}>
                    <LinearGradient
                      colors={[category.color, `${category.color}CC`]}
                      style={styles.addButtonGradient}
                    >
                      <Ionicons name="add" size={24} color="#ffffff" />
                    </LinearGradient>
                  </Pressable>
                </View>
        </View>

              <View style={styles.formRow}>
                <Text style={styles.label}>Tıbbi Geçmiş</Text>
            <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ameliyatlar, kazalar, önemli tıbbi olaylar..."
              placeholderTextColor={colors.text.tertiary}
                  value={formData.medicalHistory}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, medicalHistory: text }))}
                  multiline
                  numberOfLines={4}
                  maxLength={1000}
                />
              </View>
            </View>
          </Animated.View>
        );

      case 'emergency':
        return (
          <Animated.View key={category.id} entering={FadeInDown.delay(delay)} style={styles.categoryContainer}>
            <View style={styles.categoryHeader}>
              <LinearGradient
                colors={[category.color, `${category.color}80`]}
                style={styles.categoryIconGradient}
              >
                <Ionicons name={category.icon as any} size={24} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.categoryTitle}>{category.title}</Text>
            </View>
            
            <View style={styles.categoryContent}>
              <View style={styles.formRow}>
                <Text style={styles.label}>Acil Durumda Yapılacaklar</Text>
            <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Acil durumda yapılması gerekenler, özel talimatlar..."
              placeholderTextColor={colors.text.tertiary}
                  value={formData.notes}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                  multiline
                  numberOfLines={5}
                  maxLength={1000}
                />
              </View>
              
              <View style={styles.formRow}>
                <Text style={styles.label}>Organ Bağışı Durumu</Text>
                <View style={styles.buttonGroup}>
                  {ORGAN_DONOR_STATUS.map((status) => (
                    <Pressable
                      key={status}
                      style={[
                        styles.button,
                        formData.organDonorStatus === status && styles.buttonActive,
                      ]}
                      onPress={() => {
                        setFormData(prev => ({ ...prev, organDonorStatus: status }));
                        haptics.impactLight();
                      }}
                    >
                      {formData.organDonorStatus === status && (
                        <LinearGradient
                          colors={[category.color, `${category.color}CC`]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.lg }]}
                        />
                      )}
                      <Text
                        style={[
                          styles.buttonText,
                          formData.organDonorStatus === status && styles.buttonTextActive,
                        ]}
                      >
                        {status}
                      </Text>
                    </Pressable>
                  ))}
          </View>
              </View>
            </View>
          </Animated.View>
        );

      case 'contacts':
        return (
          <Animated.View key={category.id} entering={FadeInDown.delay(delay)} style={styles.categoryContainer}>
            <View style={styles.categoryHeader}>
              <LinearGradient
                colors={[category.color, `${category.color}80`]}
                style={styles.categoryIconGradient}
              >
                <Ionicons name={category.icon as any} size={24} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <Pressable onPress={handleAddEmergencyContact} style={styles.addContactButton}>
                <LinearGradient
                  colors={[category.color, `${category.color}CC`]}
                  style={styles.addContactButtonGradient}
                >
                  <Ionicons name="add" size={20} color="#ffffff" />
                </LinearGradient>
              </Pressable>
            </View>
            
            <View style={styles.categoryContent}>
              {formData.emergencyContacts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
                  <Text style={styles.emptyStateText}>Henüz acil durum yakını eklenmedi</Text>
                  <Text style={styles.emptyStateSubtext}>Acil durumlarda aranacak kişileri ekleyin</Text>
                </View>
              ) : (
                formData.emergencyContacts.map((contact, contactIndex) => (
                  <Animated.View
                    key={contact.id}
                    entering={SlideInRight.delay(contactIndex * 50)}
                    style={styles.contactCard}
                  >
                    <View style={styles.contactHeader}>
                      <View style={styles.contactHeaderLeft}>
                        <LinearGradient
                          colors={[category.color, `${category.color}CC`]}
                          style={styles.contactIconGradient}
                        >
                          <Ionicons name="person" size={20} color="#ffffff" />
                        </LinearGradient>
                        <Text style={styles.contactTitle}>Yakın {contactIndex + 1}</Text>
                      </View>
                      <Pressable
                        onPress={() => handleRemoveEmergencyContact(contact.id)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.danger.main} />
                      </Pressable>
                    </View>
                    
                    <View style={styles.formRow}>
                      <Text style={styles.label}>İsim Soyisim</Text>
            <TextInput
              style={styles.input}
                        placeholder="Yakınının adı ve soyadı"
              placeholderTextColor={colors.text.tertiary}
                        value={contact.name}
                        onChangeText={(text) => handleUpdateEmergencyContact(contact.id, { name: text })}
                        maxLength={50}
                      />
                    </View>
                    
                    <View style={styles.formRow}>
                      <Text style={styles.label}>Yakınlık Derecesi</Text>
                      <View style={styles.buttonGroup}>
                        {RELATIONSHIPS.map((rel) => (
                          <Pressable
                            key={rel}
                            style={[
                              styles.button,
                              contact.relationship === rel && styles.buttonActive,
                            ]}
                            onPress={() => {
                              handleUpdateEmergencyContact(contact.id, { relationship: rel });
                              haptics.impactLight();
                            }}
                          >
                            {contact.relationship === rel && (
                              <LinearGradient
                                colors={[category.color, `${category.color}CC`]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.lg }]}
                              />
                            )}
                            <Text
                              style={[
                                styles.buttonText,
                                contact.relationship === rel && styles.buttonTextActive,
                              ]}
                            >
                              {rel}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
          </View>

                    <View style={styles.formRow}>
                      <Text style={styles.label}>Telefon Numarası</Text>
            <TextInput
              style={styles.input}
                        placeholder="05XX XXX XX XX"
              placeholderTextColor={colors.text.tertiary}
                        value={contact.phone}
              onChangeText={(text) => {
                          const formatted = formatPhoneNumber(text);
                          handleUpdateEmergencyContact(contact.id, { phone: formatted });
              }}
                        keyboardType="phone-pad"
              maxLength={15}
            />
          </View>
                  </Animated.View>
                ))
              )}
        </View>
          </Animated.View>
        );


      default:
        return null;
    }
  }, [formData, allergyInput, conditionInput, medicationInput, handleAddAllergy, handleRemoveAllergy, handleAddCondition, handleRemoveCondition, handleAddMedication, handleRemoveMedication, handleAddEmergencyContact, handleUpdateEmergencyContact, handleRemoveEmergencyContact, formatPhoneNumber]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* ELITE: Premium gradient background */}
      <LinearGradient
        colors={['#000000', '#0a0e1a', '#0f172a', '#1a1f2e']}
        locations={[0, 0.25, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ELITE: Luxury Header */}
      <LinearGradient
        colors={['rgba(26, 31, 46, 0.98)', 'rgba(10, 14, 26, 0.9)', 'transparent']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => {
            haptics.impactLight();
            try {
              if (navigation?.goBack) {
                navigation.goBack();
              }
            } catch (error) {
              logger.error('Navigation error:', error);
            }
          }}
        >
          <LinearGradient
            colors={['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.1)']}
            style={styles.backButtonGradient}
          >
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </LinearGradient>
        </Pressable>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerSubtitle}>Acil durumlar için kritik bilgiler</Text>
        </View>
        
        <View style={styles.headerRight} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[6] * 2 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ELITE: Render all categories */}
        {CATEGORIES.map((category, index) => renderCategory(category, index))}

        {/* ELITE: Premium Save Button */}
        <Animated.View entering={FadeInDown.delay(500)} style={styles.saveContainer}>
          <Pressable
          style={styles.saveButton}
          onPress={handleSave}
            disabled={isSaving}
        >
          <LinearGradient
              colors={['#3b82f6', '#60a5fa', '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            style={styles.saveButtonGradient}
          >
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
            <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
            <Text style={styles.saveButtonText}>Kaydet</Text>
                </>
              )}
          </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: spacing[4],
    zIndex: 100,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    ...typography.h2,
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 26,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  headerRight: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: spacing[4],
  },
  categoryContainer: {
    marginBottom: spacing[6],
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
    paddingHorizontal: spacing[2],
  },
  categoryIconGradient: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  categoryTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: 0.3,
    flex: 1,
  },
  addContactButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  addContactButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContent: {
    backgroundColor: 'rgba(20, 24, 36, 0.7)',
    borderRadius: borderRadius.xl + 4,
    padding: spacing[4],
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginHorizontal: 2,
  },
  formRow: {
    marginBottom: spacing[4],
  },
  label: {
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing[3],
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: 'rgba(26, 31, 46, 0.9)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
    color: colors.text.primary,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    minHeight: 52,
    marginHorizontal: 2,
  },
  textArea: {
    minHeight: 150,
    textAlignVertical: 'top',
    paddingTop: spacing[4],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  halfInput: {
    flex: 1,
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    paddingHorizontal: 2,
  },
  button: {
    paddingHorizontal: spacing[4] + 4,
    paddingVertical: spacing[3] + 2,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(26, 31, 46, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    minHeight: 50,
    overflow: 'hidden',
  },
  buttonActive: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  buttonText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 15,
    zIndex: 1,
  },
  buttonTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  bloodTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    paddingHorizontal: 2,
  },
  bloodTypeButton: {
    width: '11.8%',
    minWidth: 78,
    maxWidth: 86,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(26, 31, 46, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bloodTypeButtonActive: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  bloodTypeText: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 19,
    color: colors.text.secondary,
    zIndex: 1,
  },
  bloodTypeTextActive: {
    color: '#ffffff',
    fontSize: 20,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[2],
    paddingHorizontal: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: spacing[3] + 2,
    paddingVertical: spacing[2] + 4,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    gap: spacing[1],
    minHeight: 42,
  },
  chipText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  chipRemove: {
    padding: 2,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: 2,
  },
  addInput: {
    flex: 1,
    backgroundColor: 'rgba(26, 31, 46, 0.9)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
    color: colors.text.primary,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    minHeight: 52,
    marginHorizontal: 2,
  },
  addButton: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  addButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCard: {
    backgroundColor: 'rgba(26, 31, 46, 0.6)',
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    marginHorizontal: 2,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[6],
  },
  contactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  contactIconGradient: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 18,
  },
  removeButton: {
    padding: spacing[1],
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[6] * 2.5,
  },
  emptyStateText: {
    ...typography.h4,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing[3],
    fontWeight: '600',
    fontSize: 17,
  },
  emptyStateSubtext: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing[2],
    fontSize: 14,
  },
  saveContainer: {
    marginTop: spacing[6] * 2,
    marginBottom: spacing[6],
  },
  saveButton: {
    borderRadius: borderRadius.xl + 4,
    overflow: 'hidden',
    shadowColor: colors.accent.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[6],
    gap: spacing[3],
  },
  saveButtonText: {
    ...typography.button,
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: 0.8,
  },
});
