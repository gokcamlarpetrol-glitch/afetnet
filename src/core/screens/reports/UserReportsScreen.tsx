/**
 * USER REPORTS SCREEN
 * Community reporting system - "I felt a tremor" button, photo upload, citizen science
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { usePremiumStore } from '../../stores/premiumStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { seismicSensorService } from '../../services/SeismicSensorService';
import PremiumGate from '../../components/PremiumGate';
import { createLogger } from '../../utils/logger';

const logger = createLogger('UserReportsScreen');

interface UserReport {
  id: string;
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
  };
  intensity: number; // 1-10 (Modified Mercalli Intensity)
  type: 'earthquake' | 'tremor' | 'unknown';
  description?: string;
  photoUri?: string;
  deviceId: string;
}

const INTENSITY_DESCRIPTIONS = [
  { value: 1, label: 'I - Hissedilmedi', description: 'Çok hafif, sadece cihazlar algıladı' },
  { value: 2, label: 'II - Çok Hafif', description: 'Sadece durağan insanlar hissedebilir' },
  { value: 3, label: 'III - Hafif', description: 'Kapalı alanlarda hissedilir, titreşim gibi' },
  { value: 4, label: 'IV - Orta', description: 'Çanlar çalabilir, pencereler titrer' },
  { value: 5, label: 'V - Oldukça Güçlü', description: 'Herkes hisseder, bazı eşyalar devrilebilir' },
  { value: 6, label: 'VI - Güçlü', description: 'Herkes hisseder, ağır mobilyalar hareket eder' },
  { value: 7, label: 'VII - Çok Güçlü', description: 'Binalarda hasar başlar, duvarlar çatlar' },
  { value: 8, label: 'VIII - Yıkıcı', description: 'Binalarda ağır hasar, bacalar yıkılır' },
  { value: 9, label: 'IX - Çok Yıkıcı', description: 'Binalarda çökme, zemin çatlar' },
  { value: 10, label: 'X - Şiddetli', description: 'Çoğu bina yıkılır, köprüler çöker' },
];

export default function UserReportsScreen({ navigation }: any) {
  // CRITICAL: Read premium status from store (includes trial check)
  // Trial aktifken isPremium otomatik olarak true olur (syncPremiumAccess tarafından)
  const isPremium = usePremiumStore((state) => state.isPremium);
  const [selectedIntensity, setSelectedIntensity] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  React.useEffect(() => {
    getUserLocation();
  }, []);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'Rapor göndermek için konum izni gereklidir');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      logger.error('Location error:', error);
    }
  };

  const handlePickPhoto = async () => {
    Alert.alert('Yakında', 'Fotoğraf özelliği yakında eklenecek');
  };

  const handleTakePhoto = async () => {
    Alert.alert('Yakında', 'Fotoğraf özelliği yakında eklenecek');
  };

  const handleSubmitReport = async () => {
    if (!selectedIntensity) {
      Alert.alert('Eksik Bilgi', 'Lütfen şiddet seviyesini seçin');
      return;
    }

    if (!userLocation) {
      Alert.alert('Konum Gerekli', 'Rapor göndermek için konum bilgisi gereklidir');
      await getUserLocation();
      return;
    }

    setIsSubmitting(true);

    try {
      const deviceId = bleMeshService.getMyDeviceId() || 'unknown';
      
      const report: UserReport = {
        id: `report_${Date.now()}_${deviceId}`,
        timestamp: Date.now(),
        location: userLocation,
        intensity: selectedIntensity,
        type: selectedIntensity >= 5 ? 'earthquake' : 'tremor',
        description: description.trim() || undefined,
        photoUri: photoUri || undefined,
        deviceId,
      };

      // Broadcast via BLE mesh
      await bleMeshService.sendMessage(JSON.stringify({
        type: 'user_report',
        ...report,
      }));

      // Also send to seismic sensor service for community fusion
      // This would integrate with SeismicSensorService for community detection

      Alert.alert(
        'Rapor Gönderildi',
        'Raporunuz topluluk verisine katıldı. Teşekkürler!',
        [
          {
            text: 'Tamam',
            onPress: () => {
              setSelectedIntensity(null);
              setDescription('');
              setPhotoUri(null);
            },
          },
        ]
      );

      logger.info('User report submitted:', report);
    } catch (error) {
      logger.error('Report submission error:', error);
      Alert.alert('Hata', 'Rapor gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isPremium) {
    return (
      <PremiumGate
        featureName="Kullanıcı Raporları"
        onUpgradePress={() => navigation?.navigate?.('Paywall')}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Banner */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.infoBanner}>
          <Ionicons name="information-circle" size={24} color={colors.brand.primary} />
          <Text style={styles.infoText}>
            Hissettiğiniz sarsıntıyı bildirin. Topluluk verileri hayat kurtarır!
          </Text>
        </Animated.View>

        {/* Intensity Selection */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>Şiddet Seviyesi</Text>
          <Text style={styles.sectionSubtitle}>
            Hissettiğiniz sarsıntının şiddetini seçin (I-X)
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.intensityScroll}>
            {INTENSITY_DESCRIPTIONS.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.intensityCard,
                  selectedIntensity === item.value && styles.intensityCardSelected,
                ]}
                onPress={() => setSelectedIntensity(item.value)}
              >
                <Text style={[
                  styles.intensityValue,
                  selectedIntensity === item.value && styles.intensityValueSelected,
                ]}>
                  {item.value}
                </Text>
                <Text style={[
                  styles.intensityLabel,
                  selectedIntensity === item.value && styles.intensityLabelSelected,
                ]}>
                  {item.label.split(' - ')[0]}
                </Text>
                <Text style={[
                  styles.intensityDescription,
                  selectedIntensity === item.value && styles.intensityDescriptionSelected,
                ]}>
                  {item.label.split(' - ')[1]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {selectedIntensity && (
            <View style={styles.intensityDetailCard}>
              <Text style={styles.intensityDetailTitle}>
                {INTENSITY_DESCRIPTIONS[selectedIntensity - 1].label}
              </Text>
              <Text style={styles.intensityDetailText}>
                {INTENSITY_DESCRIPTIONS[selectedIntensity - 1].description}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Description */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>Açıklama (Opsiyonel)</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Ne gördünüz, ne hissettiniz? (opsiyonel)"
            placeholderTextColor={colors.text.tertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Animated.View>

        {/* Photo */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Fotoğraf Ekle (Opsiyonel)</Text>
          <View style={styles.photoContainer}>
            {photoUri ? (
              <View style={styles.photoPreview}>
                {/* In production, use Image component */}
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image" size={48} color={colors.text.tertiary} />
                  <Text style={styles.photoPlaceholderText}>Fotoğraf seçildi</Text>
                </View>
                <Pressable
                  style={styles.removePhotoButton}
                  onPress={() => setPhotoUri(null)}
                >
                  <Ionicons name="close-circle" size={24} color={colors.status.danger} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.photoButtons}>
                <Pressable style={styles.photoButton} onPress={handlePickPhoto}>
                  <Ionicons name="image-outline" size={24} color={colors.brand.primary} />
                  <Text style={styles.photoButtonText}>Galeriden Seç</Text>
                </Pressable>
                <Pressable style={styles.photoButton} onPress={handleTakePhoto}>
                  <Ionicons name="camera-outline" size={24} color={colors.brand.primary} />
                  <Text style={styles.photoButtonText}>Fotoğraf Çek</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Submit Button */}
        <Animated.View entering={FadeInDown.delay(500)}>
          <Pressable
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmitReport}
            disabled={isSubmitting || !selectedIntensity}
          >
            <LinearGradient
              colors={[colors.brand.primary, colors.brand.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitButtonGradient}
            >
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Gönderiliyor...' : 'Raporu Gönder'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Community Info */}
        <Animated.View entering={FadeInDown.delay(600)} style={styles.communityInfo}>
          <Ionicons name="people" size={20} color={colors.text.secondary} />
          <Text style={styles.communityInfoText}>
            Raporunuz topluluk verisine katılacak ve diğer kullanıcılarla paylaşılacaktır.
            Bu veriler erken uyarı sistemlerini geliştirmeye yardımcı olur.
          </Text>
        </Animated.View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: colors.brand.primary + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brand.primary + '40',
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 22,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  intensityScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  intensityCard: {
    width: 120,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.primary,
    marginRight: 8,
    alignItems: 'center',
  },
  intensityCardSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary + '20',
  },
  intensityValue: {
    ...typography.h1,
    color: colors.text.primary,
    fontWeight: '900',
    fontSize: 32,
  },
  intensityValueSelected: {
    color: colors.brand.primary,
  },
  intensityLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  intensityLabelSelected: {
    color: colors.brand.primary,
  },
  intensityDescription: {
    ...typography.small,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  intensityDescriptionSelected: {
    color: colors.text.secondary,
  },
  intensityDetailCard: {
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
    marginTop: 8,
  },
  intensityDetailTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  intensityDetailText: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  descriptionInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
    minHeight: 100,
  },
  photoContainer: {
    gap: 12,
  },
  photoPreview: {
    position: 'relative',
  },
  photoPlaceholder: {
    height: 200,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  photoButtonText: {
    ...typography.body,
    color: colors.brand.primary,
    fontWeight: '600',
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  submitButtonText: {
    ...typography.h4,
    color: '#fff',
    fontWeight: '700',
  },
  communityInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  communityInfoText: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
});

