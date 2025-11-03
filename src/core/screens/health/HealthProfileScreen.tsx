/**
 * HEALTH PROFILE SCREEN
 * User's medical information for emergency situations
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHealthProfileStore } from '../../stores/healthProfileStore';
import * as haptics from '../../utils/haptics';
import { colors, typography, spacing } from '../../theme';

export default function HealthProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useHealthProfileStore();

  const [bloodType, setBloodType] = useState(profile.bloodType || '');
  const [allergies, setAllergies] = useState(Array.isArray(profile.allergies) ? profile.allergies.join(', ') : '');
  const [chronicDiseases, setChronicDiseases] = useState(Array.isArray(profile.chronicDiseases) ? profile.chronicDiseases.join(', ') : '');
  const [medications, setMedications] = useState(Array.isArray(profile.emergencyMedications) ? profile.emergencyMedications.join(', ') : '');
  const [contact1Name, setContact1Name] = useState(profile.emergencyContacts?.[0]?.name || '');
  const [contact1Phone, setContact1Phone] = useState(profile.emergencyContacts?.[0]?.phone || '');
  const [contact2Name, setContact2Name] = useState(profile.emergencyContacts?.[1]?.name || '');
  const [contact2Phone, setContact2Phone] = useState(profile.emergencyContacts?.[1]?.phone || '');
  const [contact3Name, setContact3Name] = useState(profile.emergencyContacts?.[2]?.name || '');
  const [contact3Phone, setContact3Phone] = useState(profile.emergencyContacts?.[2]?.phone || '');

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];

  const handleSave = async () => {
    haptics.impactMedium();

    const emergencyContacts = [
      { id: '1', name: contact1Name, phone: contact1Phone, relationship: 'Acil Kişi 1' },
      { id: '2', name: contact2Name, phone: contact2Phone, relationship: 'Acil Kişi 2' },
      { id: '3', name: contact3Name, phone: contact3Phone, relationship: 'Acil Kişi 3' },
    ].filter((c) => c.name && c.phone);

    await updateProfile({
      bloodType,
      allergies: allergies.split(',').map((a) => a.trim()).filter(Boolean),
      chronicDiseases: chronicDiseases.split(',').map((d) => d.trim()).filter(Boolean),
      emergencyMedications: medications.split(',').map((m) => m.trim()).filter(Boolean),
      emergencyContacts,
    });

    Alert.alert('Başarılı', 'Sağlık profiliniz kaydedildi.', [{ text: 'Tamam' }]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.gradients.header[0], colors.gradients.header[1]]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            haptics.impactLight();
            navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sağlık Profili</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Blood Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kan Grubu</Text>
          <View style={styles.bloodTypeGrid}>
            {bloodTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.bloodTypeButton,
                  bloodType === type && styles.bloodTypeButtonActive,
                ]}
                onPress={() => {
                  haptics.impactLight();
                  setBloodType(type);
                }}
              >
                <Text
                  style={[
                    styles.bloodTypeText,
                    bloodType === type && styles.bloodTypeTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Allergies */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alerjiler</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn: Polen, Fıstık, Penisilin"
            placeholderTextColor={colors.text.tertiary}
            value={allergies}
            onChangeText={setAllergies}
          />
        </View>

        {/* Chronic Diseases */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kronik Hastalıklar</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn: Diyabet, Astım, Hipertansiyon"
            placeholderTextColor={colors.text.tertiary}
            value={chronicDiseases}
            onChangeText={setChronicDiseases}
          />
        </View>

        {/* Medications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acil İlaçlar</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn: İnsülin, Ventolin, Aspirin"
            placeholderTextColor={colors.text.tertiary}
            value={medications}
            onChangeText={setMedications}
          />
        </View>

        {/* Emergency Contacts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acil Kişiler</Text>
          
          {/* Contact 1 */}
          <View style={styles.contactGroup}>
            <TextInput
              style={styles.input}
              placeholder="İsim"
              placeholderTextColor={colors.text.tertiary}
              value={contact1Name}
              onChangeText={setContact1Name}
            />
            <TextInput
              style={styles.input}
              placeholder="Telefon"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="phone-pad"
              value={contact1Phone}
              onChangeText={setContact1Phone}
            />
          </View>

          {/* Contact 2 */}
          <View style={styles.contactGroup}>
            <TextInput
              style={styles.input}
              placeholder="İsim"
              placeholderTextColor={colors.text.tertiary}
              value={contact2Name}
              onChangeText={setContact2Name}
            />
            <TextInput
              style={styles.input}
              placeholder="Telefon"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="phone-pad"
              value={contact2Phone}
              onChangeText={setContact2Phone}
            />
          </View>

          {/* Contact 3 */}
          <View style={styles.contactGroup}>
            <TextInput
              style={styles.input}
              placeholder="İsim"
              placeholderTextColor={colors.text.tertiary}
              value={contact3Name}
              onChangeText={setContact3Name}
            />
            <TextInput
              style={styles.input}
              placeholder="Telefon"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="phone-pad"
              value={contact3Phone}
              onChangeText={setContact3Phone}
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#10b981', '#059669']}
            style={styles.saveButtonGradient}
          >
            <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
            <Text style={styles.saveButtonText}>Kaydet</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: 12,
  },
  bloodTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bloodTypeButton: {
    width: 70,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodTypeButtonActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  bloodTypeText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  bloodTypeTextActive: {
    color: '#ffffff',
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    color: colors.text.primary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: 12,
  },
  contactGroup: {
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  saveButtonText: {
    ...typography.button,
    color: '#ffffff',
  },
});

