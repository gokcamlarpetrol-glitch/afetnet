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

import { getErrorMessage } from '../../utils/errorUtils';
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
  { id: 'firstaid', title: 'İlk Yardım Rehberi', icon: 'fitness', color: '#ec4899' },
  { id: 'emergencycard', title: 'Acil Durum Kartı', icon: 'card', color: '#8b5cf6' },
] as const;

import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';

// ELITE: Type-safe navigation prop
type HealthProfileNavigationProp = StackNavigationProp<ParamListBase>;

interface HealthProfileScreenProps {
  navigation: HealthProfileNavigationProp;
}

export default function HealthProfileScreen({ navigation }: HealthProfileScreenProps) {
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

  // BMI Calculation Helper
  const calculateBMI = useCallback((height: string, weight: string) => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const bmi = w / Math.pow(h / 100, 2);
    let category = '';
    let color = '#5A9F68';
    if (bmi < 18.5) {
      category = 'Zayıf';
      color = '#F59E0B';
    } else if (bmi < 25) {
      category = 'Normal';
      color = '#5A9F68';
    } else if (bmi < 30) {
      category = 'Fazla Kilolu';
      color = '#F59E0B';
    } else {
      category = 'Obez';
      color = '#B53A3A';
    }
    return { value: bmi.toFixed(1), category, color };
  }, []);

  const bmiData = calculateBMI(formData.height, formData.weight);

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
              ('id' in c || 'name' in c || 'phone' in c),
            ) as EmergencyContact[];
          }
        } catch (parseError: unknown) {
          logger.debug('Profile array parsing error (non-critical):', getErrorMessage(parseError));
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
      } catch (error: unknown) {
        logger.debug('Profile data parsing error (non-critical):', getErrorMessage(error));
      }
    }
  }, [profile, isLoaded]);

  const validatePhoneNumber = useCallback((phone: string): boolean => {
    if (!phone || phone.trim().length === 0) return false;
    const cleaned = phone.replace(/[\s\-()]/g, '');
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
      ],
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
        [{ text: 'Tamam' }],
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
    } catch (error: unknown) {
      logger.error('Failed to save health profile:', error);
      Alert.alert(
        'Kayıt Hatası',
        'Sağlık profiliniz kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.',
        [
          { text: 'Tekrar Dene', onPress: handleSave },
          { text: 'Tamam', style: 'cancel' },
        ],
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
                        <Ionicons name="trash-outline" size={20} color={((colors as any).danger?.main) || ((colors as any).emergency?.critical) || '#ef4444'} />
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


      case 'firstaid':
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
              {/* CPR Adımları */}
              <Pressable
                style={styles.firstAidCard}
                onPress={() => {
                  haptics.impactLight();
                  Alert.alert(
                    '❤️ CPR (Kalp Masajı)',
                    '1. Bilinci kontrol edin\n2. 112\'yi arayın\n3. Göğüs kemiğinin ortasına yerleşin\n4. Dakikada 100-120 baskı yapın\n5. 5cm derinliğinde bastırın\n6. 30 baskı, 2 nefes döngüsü',
                    [{ text: 'Anladım' }]
                  );
                }}
              >
                <View style={[styles.firstAidIcon, { backgroundColor: '#fee2e2' }]}>
                  <Ionicons name="heart" size={24} color="#ef4444" />
                </View>
                <View style={styles.firstAidInfo}>
                  <Text style={styles.firstAidTitle}>CPR (Kalp Masajı)</Text>
                  <Text style={styles.firstAidDesc}>Kalp durması durumunda</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </Pressable>

              {/* Kanama Kontrolü */}
              <Pressable
                style={styles.firstAidCard}
                onPress={() => {
                  haptics.impactLight();
                  Alert.alert(
                    '🩸 Kanama Kontrolü',
                    '1. Temiz bez ile yarayı kapatın\n2. Sabit basınç uygulayın\n3. Yaralı bölgeyi yukarı kaldırın\n4. 15-20 dakika basınca devam edin\n5. Bez kanla dolarsa üzerine yeni bez koyun\n6. Durmazsa 112\'yi arayın',
                    [{ text: 'Anladım' }]
                  );
                }}
              >
                <View style={[styles.firstAidIcon, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="bandage" size={24} color="#f59e0b" />
                </View>
                <View style={styles.firstAidInfo}>
                  <Text style={styles.firstAidTitle}>Kanama Kontrolü</Text>
                  <Text style={styles.firstAidDesc}>Yaralanma ve kesiklerde</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </Pressable>

              {/* Kırık Müdahale */}
              <Pressable
                style={styles.firstAidCard}
                onPress={() => {
                  haptics.impactLight();
                  Alert.alert(
                    '🦴 Kırık Müdahalesi',
                    '1. Yaralıyı hareket ettirmeyin\n2. Kırık bölgeyi sabitleyin\n3. Buz uygulayın (bez ile)\n4. Şok belirtilerini izleyin\n5. 112\'yi hemen arayın\n\n⚠️ Omurga yaralanması şüphesi varsa KESİNLİKLE hareket ettirmeyin!',
                    [{ text: 'Anladım' }]
                  );
                }}
              >
                <View style={[styles.firstAidIcon, { backgroundColor: '#dbeafe' }]}>
                  <Ionicons name="body" size={24} color="#3b82f6" />
                </View>
                <View style={styles.firstAidInfo}>
                  <Text style={styles.firstAidTitle}>Kırık Müdahalesi</Text>
                  <Text style={styles.firstAidDesc}>Kemik kırıklarında</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </Pressable>

              {/* Yanık Müdahale */}
              <Pressable
                style={styles.firstAidCard}
                onPress={() => {
                  haptics.impactLight();
                  Alert.alert(
                    '🔥 Yanık Müdahalesi',
                    '1. Akan soğuk suyla 10-20 dk soğutun\n2. Buz KULLANMAYIN!\n3. Yanık üzerindeki giysiye dokunmayın\n4. Steril gazlı bez ile örtün\n5. Yüz, el, genital yanıklarda 112\'yi arayın\n6. Kabarcık patlatmayın',
                    [{ text: 'Anladım' }]
                  );
                }}
              >
                <View style={[styles.firstAidIcon, { backgroundColor: '#ffedd5' }]}>
                  <Ionicons name="flame" size={24} color="#ea580c" />
                </View>
                <View style={styles.firstAidInfo}>
                  <Text style={styles.firstAidTitle}>Yanık Müdahalesi</Text>
                  <Text style={styles.firstAidDesc}>Termal yanıklarda</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </Pressable>

              {/* Bilinç Kaybı */}
              <Pressable
                style={styles.firstAidCard}
                onPress={() => {
                  haptics.impactLight();
                  Alert.alert(
                    '💫 Bilinç Kaybı (Koma Pozisyonu)',
                    '1. Nefes alıp almadığını kontrol edin\n2. Yan yatırın (koma pozisyonu)\n3. Başı hafif geriye eğin\n4. Hava yolunu açık tutun\n5. Kusma tehlikesine karşı yan pozisyon\n6. 112\'yi arayın ve yanında kalın',
                    [{ text: 'Anladım' }]
                  );
                }}
              >
                <View style={[styles.firstAidIcon, { backgroundColor: '#f3e8ff' }]}>
                  <Ionicons name="eye-off" size={24} color="#9333ea" />
                </View>
                <View style={styles.firstAidInfo}>
                  <Text style={styles.firstAidTitle}>Bilinç Kaybı</Text>
                  <Text style={styles.firstAidDesc}>Koma pozisyonu</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </Pressable>
            </View>
          </Animated.View>
        );

      case 'emergencycard':
        const emergencyCardData = `
🆘 ACİL DURUM KARTI
━━━━━━━━━━━━━━━━
👤 ${formData.firstName} ${formData.lastName}
🩸 Kan Grubu: ${formData.bloodType || 'Belirtilmedi'}
📅 Doğum: ${formData.dateOfBirth || 'Belirtilmedi'}

⚠️ ALERJİLER:
${formData.allergies.length > 0 ? formData.allergies.join(', ') : 'Yok'}

💊 İLAÇLAR:
${formData.medications.length > 0 ? formData.medications.join(', ') : 'Yok'}

🏥 KRONİK HASTALIKLAR:
${formData.chronicConditions.length > 0 ? formData.chronicConditions.join(', ') : 'Yok'}

📞 ACİL KİŞİLER:
${formData.emergencyContacts.length > 0
            ? formData.emergencyContacts.map(c => `${c.name} (${c.relationship}): ${c.phone}`).join('\n')
            : 'Belirtilmedi'}

🏥 Organ Bağışı: ${formData.organDonorStatus || 'Belirtilmedi'}
━━━━━━━━━━━━━━━━
AfetNet - Hayat Kurtaran Teknoloji
        `.trim();

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
              <View style={styles.emergencyCardPreview}>
                <View style={styles.emergencyCardHeader}>
                  <Ionicons name="medical" size={32} color="#ef4444" />
                  <Text style={styles.emergencyCardTitle}>ACİL DURUM KARTI</Text>
                </View>

                <View style={styles.emergencyCardRow}>
                  <Text style={styles.emergencyCardLabel}>Kan Grubu:</Text>
                  <Text style={styles.emergencyCardValue}>{formData.bloodType || '—'}</Text>
                </View>

                <View style={styles.emergencyCardRow}>
                  <Text style={styles.emergencyCardLabel}>Alerjiler:</Text>
                  <Text style={styles.emergencyCardValue}>
                    {formData.allergies.length > 0 ? formData.allergies.slice(0, 2).join(', ') + (formData.allergies.length > 2 ? '...' : '') : '—'}
                  </Text>
                </View>

                <View style={styles.emergencyCardRow}>
                  <Text style={styles.emergencyCardLabel}>İlaçlar:</Text>
                  <Text style={styles.emergencyCardValue}>
                    {formData.medications.length > 0 ? formData.medications.slice(0, 2).join(', ') + (formData.medications.length > 2 ? '...' : '') : '—'}
                  </Text>
                </View>

                <View style={styles.emergencyCardRow}>
                  <Text style={styles.emergencyCardLabel}>Acil Kişi:</Text>
                  <Text style={styles.emergencyCardValue}>
                    {formData.emergencyContacts.length > 0 ? `${formData.emergencyContacts[0].name} (${formData.emergencyContacts[0].phone})` : '—'}
                  </Text>
                </View>
              </View>

              {/* Share Buttons */}
              <View style={styles.shareButtonsRow}>
                <Pressable
                  style={styles.shareButton}
                  onPress={() => {
                    haptics.impactMedium();
                    import('react-native').then(({ Share }) => {
                      Share.share({
                        message: emergencyCardData,
                        title: 'Acil Durum Kartım',
                      });
                    });
                  }}
                >
                  <LinearGradient
                    colors={['#22c55e', '#16a34a']}
                    style={styles.shareButtonGradient}
                  >
                    <Ionicons name="share-social" size={20} color="#ffffff" />
                    <Text style={styles.shareButtonText}>Paylaş</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  style={styles.shareButton}
                  onPress={() => {
                    haptics.impactMedium();
                    import('react-native').then(({ Clipboard }) => {
                      if (Clipboard && Clipboard.setString) {
                        Clipboard.setString(emergencyCardData);
                        Alert.alert('Kopyalandı', 'Acil durum kartı panoya kopyalandı.');
                      } else {
                        Alert.alert('Uyarı', 'Kopyalama özelliği bu cihazda desteklenmiyor.');
                      }
                    });
                  }}
                >
                  <LinearGradient
                    colors={['#3b82f6', '#2563eb']}
                    style={styles.shareButtonGradient}
                  >
                    <Ionicons name="copy" size={20} color="#ffffff" />
                    <Text style={styles.shareButtonText}>Kopyala</Text>
                  </LinearGradient>
                </Pressable>
              </View>

              <Text style={styles.emergencyCardHint}>
                💡 Bu kartı aileniz ve yakınlarınızla paylaşın. Acil durumda kurtarma ekiplerine bu bilgiler hayat kurtarabilir.
              </Text>
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
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Modern Calm Trust: Cream gradient background */}
      <LinearGradient
        colors={['#F5F1EB', '#EDE8E1', '#E8E3DC']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Modern Calm Trust: Premium Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
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
          <View style={styles.backButtonInner}>
            <Ionicons name="arrow-back" size={22} color="#1E3A5F" />
          </View>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Sağlık Profilim</Text>
          <Text style={styles.headerSubtitle}>Acil durumlar için kritik bilgiler</Text>
        </View>

        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[6] * 2 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Health Summary Card */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="pulse" size={20} color="#5A9F68" />
            <Text style={styles.summaryTitle}>Sağlık Özeti</Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Kan Grubu</Text>
              <Text style={[styles.summaryValue, { color: '#B53A3A' }]}>
                {formData.bloodType || '—'}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Alerji</Text>
              <Text style={styles.summaryValue}>{formData.allergies.length}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>İlaç</Text>
              <Text style={styles.summaryValue}>{formData.medications.length}</Text>
            </View>
            {bmiData && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>BMI</Text>
                  <Text style={[styles.summaryValue, { color: bmiData.color }]}>
                    {bmiData.value}
                  </Text>
                </View>
              </>
            )}
          </View>
          {bmiData && (
            <View style={[styles.bmiIndicator, { backgroundColor: `${bmiData.color}15`, borderColor: `${bmiData.color}30` }]}>
              <Ionicons name="fitness" size={16} color={bmiData.color} />
              <Text style={[styles.bmiText, { color: bmiData.color }]}>
                BMI: {bmiData.value} - {bmiData.category}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Render all categories */}
        {CATEGORIES.map((category, index) => renderCategory(category, index))}

        {/* ELITE: Premium Save Button */}
        <Animated.View entering={FadeInDown.delay(500)} style={styles.saveContainer}>
          <Pressable
            style={styles.saveButton}
            onPress={handleSave}
            disabled={isSaving}
          >
            <LinearGradient
              colors={['#5A9F68', '#4A8F58', '#3D7D4A']}
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
    backgroundColor: '#F5F1EB', // Cream background
  },
  // Summary Card Styles
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing[4],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.08)',
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A5F',
    letterSpacing: 0.2,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8FA8BE',
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E3A5F',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(30, 58, 95, 0.1)',
  },
  bmiIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 10,
    borderWidth: 1,
  },
  bmiText: {
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: spacing[3],
    zIndex: 100,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
  },
  backButtonInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 58, 95, 0.08)',
    borderRadius: 14,
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
    gap: 2,
  },
  headerTitle: {
    ...typography.h2,
    color: '#1E3A5F', // Navy
    fontWeight: '700',
    fontSize: 22,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    ...typography.caption,
    color: '#5A7894', // Muted navy
    fontSize: 13,
    fontWeight: '500',
  },
  headerRight: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: spacing[3],
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  categoryTitle: {
    ...typography.h3,
    color: '#1E3A5F', // Navy
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.2,
    flex: 1,
  },
  addContactButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addContactButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContent: {
    backgroundColor: '#FFFFFF', // White card
    borderRadius: 20,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.08)',
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginHorizontal: 0,
  },
  formRow: {
    marginBottom: spacing[4],
  },
  label: {
    ...typography.body,
    color: '#1E3A5F', // Navy
    marginBottom: spacing[2],
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.1,
  },
  input: {
    backgroundColor: '#F8F6F2', // Light cream
    borderRadius: 14,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
    color: '#1E3A5F', // Navy text
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.1)',
    minHeight: 52,
    marginHorizontal: 0,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: spacing[3],
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
    paddingHorizontal: 0,
  },
  button: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: 12,
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.1)',
    minHeight: 46,
    overflow: 'hidden',
  },
  buttonActive: {
    borderColor: '#5A9F68',
  },
  buttonText: {
    ...typography.body,
    color: '#5A7894',
    fontWeight: '600',
    fontSize: 14,
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
    paddingHorizontal: 0,
  },
  bloodTypeButton: {
    width: '11.8%',
    minWidth: 70,
    maxWidth: 80,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bloodTypeButtonActive: {
    borderColor: '#B53A3A',
  },
  bloodTypeText: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 17,
    color: '#5A7894',
    zIndex: 1,
  },
  bloodTypeTextActive: {
    color: '#ffffff',
    fontSize: 18,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[2],
    paddingHorizontal: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(90, 159, 104, 0.12)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(90, 159, 104, 0.25)',
    gap: spacing[1],
    minHeight: 38,
  },
  chipText: {
    ...typography.body,
    color: '#1E3A5F',
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
    paddingHorizontal: 0,
  },
  addInput: {
    flex: 1,
    backgroundColor: '#F8F6F2',
    borderRadius: 14,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: '#1E3A5F',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.1)',
    minHeight: 50,
    marginHorizontal: 0,
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
  },
  addButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: spacing[4],
    marginBottom: spacing[3],
    marginHorizontal: 0,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.08)',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  contactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  contactIconGradient: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTitle: {
    ...typography.h4,
    color: '#1E3A5F',
    fontWeight: '700',
    fontSize: 16,
  },
  removeButton: {
    padding: spacing[1],
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[6] * 2,
  },
  emptyStateText: {
    ...typography.h4,
    color: '#5A7894',
    textAlign: 'center',
    marginTop: spacing[3],
    fontWeight: '600',
    fontSize: 16,
  },
  emptyStateSubtext: {
    ...typography.body,
    color: '#8FA8BE',
    textAlign: 'center',
    marginTop: spacing[2],
    fontSize: 13,
  },
  saveContainer: {
    marginTop: spacing[6],
    marginBottom: spacing[4],
  },
  saveButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#5A9F68',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[5],
    gap: spacing[3],
  },
  saveButtonText: {
    ...typography.button,
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  // First Aid Styles
  firstAidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.06)',
  },
  firstAidIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  firstAidInfo: {
    flex: 1,
  },
  firstAidTitle: {
    ...typography.body,
    color: '#1E3A5F',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 3,
  },
  firstAidDesc: {
    ...typography.caption,
    color: '#5A7894',
    fontSize: 12,
  },
  // Emergency Card Styles
  emergencyCardPreview: {
    backgroundColor: 'rgba(181, 58, 58, 0.06)',
    borderRadius: 18,
    padding: spacing[5],
    borderWidth: 2,
    borderColor: 'rgba(181, 58, 58, 0.2)',
    marginBottom: spacing[4],
  },
  emergencyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(181, 58, 58, 0.15)',
    paddingBottom: spacing[3],
  },
  emergencyCardTitle: {
    ...typography.h3,
    color: '#B53A3A',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.8,
  },
  emergencyCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(181, 58, 58, 0.08)',
  },
  emergencyCardLabel: {
    ...typography.body,
    color: '#5A7894',
    fontWeight: '600',
    fontSize: 13,
    flex: 0.4,
  },
  emergencyCardValue: {
    ...typography.body,
    color: '#1E3A5F',
    fontWeight: '700',
    fontSize: 13,
    flex: 0.6,
    textAlign: 'right',
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  shareButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  shareButtonText: {
    ...typography.button,
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  emergencyCardHint: {
    ...typography.caption,
    color: '#8FA8BE',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: spacing[2],
  },
});
