import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Profile data interface
interface ProfileData {
  // Personal Information
  name: string;
  email: string;
  phone: string;
  address: string;
  birthDate: string;
  gender: string;
  occupation: string;
  
  // Health Information
  bloodType: string;
  allergies: string;
  medications: string;
  emergencyContact: string;
  medicalNotes: string;
  insuranceNumber: string;
  
  // Emergency Information
  emergencyContactName: string;
  emergencyContactRelation: string;
  medicalConditions: string;
  doctorName: string;
  doctorPhone: string;
}

const PROFILE_STORAGE_KEY = 'afn/profile/v1';

// Blood type options
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Gender options
const GENDER_OPTIONS = [
  'Erkek',
  'Kadın', 
  'Belirtmek istemiyorum',
  'Diğer'
];

// Emergency contact relation options
const RELATION_OPTIONS = [
  'Eş/Eşi',
  'Anne',
  'Baba',
  'Kardeş',
  'Çocuk',
  'Arkadaş',
  'Diğer'
];

export default function ProfileEditScreen() {
  const [profileData, setProfileData] = useState<ProfileData>({
    // Personal Information
    name: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    gender: 'Belirtmek istemiyorum',
    occupation: '',
    
    // Health Information
    bloodType: 'A+',
    allergies: '',
    medications: '',
    emergencyContact: '',
    medicalNotes: '',
    insuranceNumber: '',
    
    // Emergency Information
    emergencyContactName: '',
    emergencyContactRelation: 'Diğer',
    medicalConditions: '',
    doctorName: '',
    doctorPhone: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'personal' | 'health' | 'emergency'>('personal');

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const savedData = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setProfileData(prev => ({ ...prev, ...parsedData }));
      }
    } catch (error) {
      console.warn('Failed to load profile data:', error);
    }
  };

  const saveProfileData = async () => {
    setIsLoading(true);
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileData));
      Alert.alert('✅ Başarılı', 'Profil bilgileri kaydedildi!');
    } catch (error) {
      Alert.alert('❌ Hata', 'Profil bilgileri kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfileData = (key: keyof ProfileData, value: string) => {
    setProfileData(prev => ({ ...prev, [key]: value }));
  };

  const renderPersonalSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ad Soyad *</Text>
          <TextInput
            style={styles.input}
            value={profileData.name}
            onChangeText={(text) => updateProfileData('name', text)}
            placeholder="Adınızı ve soyadınızı girin"
            placeholderTextColor="#6B7280"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>E-posta</Text>
          <TextInput
            style={styles.input}
            value={profileData.email}
            onChangeText={(text) => updateProfileData('email', text)}
            placeholder="E-posta adresinizi girin"
            placeholderTextColor="#6B7280"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Telefon *</Text>
          <TextInput
            style={styles.input}
            value={profileData.phone}
            onChangeText={(text) => updateProfileData('phone', text)}
            placeholder="Telefon numaranızı girin"
            placeholderTextColor="#6B7280"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Adres</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={profileData.address}
            onChangeText={(text) => updateProfileData('address', text)}
            placeholder="Ev adresinizi girin"
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Doğum Tarihi</Text>
          <TextInput
            style={styles.input}
            value={profileData.birthDate}
            onChangeText={(text) => updateProfileData('birthDate', text)}
            placeholder="GG.AA.YYYY"
            placeholderTextColor="#6B7280"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Cinsiyet</Text>
          <View style={styles.optionsContainer}>
            {GENDER_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.optionButton,
                  profileData.gender === option && styles.selectedOption
                ]}
                onPress={() => updateProfileData('gender', option)}
              >
                <Text style={[
                  styles.optionText,
                  profileData.gender === option && styles.selectedOptionText
                ]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Meslek</Text>
          <TextInput
            style={styles.input}
            value={profileData.occupation}
            onChangeText={(text) => updateProfileData('occupation', text)}
            placeholder="Mesleğinizi girin"
            placeholderTextColor="#6B7280"
          />
        </View>
      </View>
    </ScrollView>
  );

  const renderHealthSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sağlık Bilgileri</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Kan Grubu *</Text>
          <View style={styles.optionsContainer}>
            {BLOOD_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.optionButton,
                  profileData.bloodType === type && styles.selectedOption
                ]}
                onPress={() => updateProfileData('bloodType', type)}
              >
                <Text style={[
                  styles.optionText,
                  profileData.bloodType === type && styles.selectedOptionText
                ]}>
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Alerjiler</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={profileData.allergies}
            onChangeText={(text) => updateProfileData('allergies', text)}
            placeholder="Bilinen alerjilerinizi girin (örn: Polen, Toz, İlaç adı)"
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Kullandığınız İlaçlar</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={profileData.medications}
            onChangeText={(text) => updateProfileData('medications', text)}
            placeholder="Düzenli kullandığınız ilaçları girin"
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Sağlık Durumu</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={profileData.medicalConditions}
            onChangeText={(text) => updateProfileData('medicalConditions', text)}
            placeholder="Kronik hastalıklar veya özel durumlar"
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Sigorta Numarası</Text>
          <TextInput
            style={styles.input}
            value={profileData.insuranceNumber}
            onChangeText={(text) => updateProfileData('insuranceNumber', text)}
            placeholder="Sağlık sigortası numaranız"
            placeholderTextColor="#6B7280"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Doktor Bilgileri</Text>
          <TextInput
            style={styles.input}
            value={profileData.doctorName}
            onChangeText={(text) => updateProfileData('doctorName', text)}
            placeholder="Doktor adı"
            placeholderTextColor="#6B7280"
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={profileData.doctorPhone}
            onChangeText={(text) => updateProfileData('doctorPhone', text)}
            placeholder="Doktor telefonu"
            placeholderTextColor="#6B7280"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ek Sağlık Notları</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={profileData.medicalNotes}
            onChangeText={(text) => updateProfileData('medicalNotes', text)}
            placeholder="Diğer önemli sağlık bilgileri"
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={3}
          />
        </View>
      </View>
    </ScrollView>
  );

  const renderEmergencySection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Acil Durum Bilgileri</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Acil İletişim Kişisi *</Text>
          <TextInput
            style={styles.input}
            value={profileData.emergencyContactName}
            onChangeText={(text) => updateProfileData('emergencyContactName', text)}
            placeholder="Acil durumda aranacak kişinin adı"
            placeholderTextColor="#6B7280"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Yakınlık Derecesi</Text>
          <View style={styles.optionsContainer}>
            {RELATION_OPTIONS.map((relation) => (
              <Pressable
                key={relation}
                style={[
                  styles.optionButton,
                  profileData.emergencyContactRelation === relation && styles.selectedOption
                ]}
                onPress={() => updateProfileData('emergencyContactRelation', relation)}
              >
                <Text style={[
                  styles.optionText,
                  profileData.emergencyContactRelation === relation && styles.selectedOptionText
                ]}>
                  {relation}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Acil İletişim Telefonu *</Text>
          <TextInput
            style={styles.input}
            value={profileData.emergencyContact}
            onChangeText={(text) => updateProfileData('emergencyContact', text)}
            placeholder="Acil durum telefon numarası"
            placeholderTextColor="#6B7280"
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Güvenlik Bilgileri</Text>
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#10B981" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Gizlilik Garantisi</Text>
            <Text style={styles.infoText}>
              • Tüm bilgileriniz cihazınızda güvenle saklanır{'\n'}
              • Bilgileriniz sadece acil durumlarda kullanılır{'\n'}
              • Üçüncü taraflarla paylaşılmaz{'\n'}
              • End-to-end şifreleme ile korunur
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'personal':
        return renderPersonalSection();
      case 'health':
        return renderHealthSection();
      case 'emergency':
        return renderEmergencySection();
      default:
        return renderPersonalSection();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Profil Düzenle</Text>
          <Text style={styles.headerSubtitle}>Kişisel ve sağlık bilgilerinizi güncelleyin</Text>
        </View>
        <TouchableOpacity onPress={saveProfileData} disabled={isLoading}>
          <Text style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}>
            {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Section Navigation */}
      <View style={styles.sectionNav}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionNavContent}>
          <Pressable
            style={[
              styles.sectionButton,
              activeSection === 'personal' && styles.activeSectionButton
            ]}
            onPress={() => setActiveSection('personal')}
          >
            <Ionicons 
              name="person-outline" 
              size={20} 
              color={activeSection === 'personal' ? '#FFFFFF' : '#6B7280'} 
            />
            <Text style={[
              styles.sectionLabel,
              activeSection === 'personal' && styles.activeSectionLabel
            ]}>
              Kişisel
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.sectionButton,
              activeSection === 'health' && styles.activeSectionButton
            ]}
            onPress={() => setActiveSection('health')}
          >
            <Ionicons 
              name="medical-outline" 
              size={20} 
              color={activeSection === 'health' ? '#FFFFFF' : '#6B7280'} 
            />
            <Text style={[
              styles.sectionLabel,
              activeSection === 'health' && styles.activeSectionLabel
            ]}>
              Sağlık
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.sectionButton,
              activeSection === 'emergency' && styles.activeSectionButton
            ]}
            onPress={() => setActiveSection('emergency')}
          >
            <Ionicons 
              name="call-outline" 
              size={20} 
              color={activeSection === 'emergency' ? '#FFFFFF' : '#6B7280'} 
            />
            <Text style={[
              styles.sectionLabel,
              activeSection === 'emergency' && styles.activeSectionLabel
            ]}>
              Acil Durum
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Section Content */}
      {renderSectionContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 12,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  saveButtonDisabled: {
    color: '#6B7280',
  },
  sectionNav: {
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  sectionNavContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionButton: {
    alignItems: 'center',
    marginRight: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  activeSectionButton: {
    backgroundColor: '#374151',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
  },
  activeSectionLabel: {
    color: '#FFFFFF',
  },
  sectionContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  selectedOption: {
    backgroundColor: '#1E40AF',
    borderColor: '#3B82F6',
  },
  optionText: {
    fontSize: 14,
    color: '#E5E7EB',
  },
  selectedOptionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
});

