import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { DamageType, DamageSeverity } from '../../../core/data/models';
import { DamageReportRepository } from '../../../core/data/repositories';
import { useToast } from '../../hooks/useToast';

interface DamageReportFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const DamageReportForm: React.FC<DamageReportFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    type: 'building' as DamageType,
    severity: 1 as DamageSeverity,
    description: '',
    reporterName: '',
    reporterPhone: '',
    photoPath: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const { showToast } = useToast();

  const damageTypes = [
    { label: 'Bina', value: 'building' },
    { label: 'Altyapı', value: 'infrastructure' },
    { label: 'Araç', value: 'vehicle' },
    { label: 'Diğer', value: 'other' },
  ];

  const severityLevels = [
    { label: 'Hafif', value: 0 },
    { label: 'Orta', value: 1 },
    { label: 'Ağır', value: 2 },
    { label: 'Kritik', value: 3 },
  ];

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Konum erişimi için izin verilmelidir.');
        return;
      }

      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
        accuracy: locationResult.coords.accuracy || 10,
      });

      showToast('Konum alındı', 'success');
    } catch (error) {
      console.error('Location error:', error);
      showToast('Konum alınamadı', 'error');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Kamera erişimi için izin verilmelidir.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setFormData(prev => ({
          ...prev,
          photoPath: result.assets[0].uri,
        }));
        showToast('Fotoğraf alındı', 'success');
      }
    } catch (error) {
      console.error('Camera error:', error);
      showToast('Fotoğraf alınamadı', 'error');
    }
  };

  const submitForm = async () => {
    if (!location) {
      Alert.alert('Hata', 'Lütfen konumunuzu alın.');
      return;
    }

    if (!formData.description.trim()) {
      Alert.alert('Hata', 'Lütfen hasar açıklaması girin.');
      return;
    }

    setIsSubmitting(true);

    try {
      await DamageReportRepository.create({
        ts: Date.now(),
        lat: location.latitude,
        lon: location.longitude,
        accuracy: location.accuracy,
        type: formData.type,
        severity: formData.severity,
        description: formData.description,
        photoPath: formData.photoPath || undefined,
        reporterName: formData.reporterName || undefined,
        reporterPhone: formData.reporterPhone || undefined,
        confirmed: false,
        delivered: false,
        source: 'self',
      });

      showToast('Hasar raporu gönderildi', 'success');
      onSuccess?.();
    } catch (error) {
      console.error('Submit error:', error);
      showToast('Rapor gönderilemedi', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Hasar Raporu</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Hasar Türü</Text>
        <Picker
          selectedValue={formData.type}
          onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
          style={styles.picker}
        >
          {damageTypes.map((type) => (
            <Picker.Item key={type.value} label={type.label} value={type.value} />
          ))}
        </Picker>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Şiddet Derecesi</Text>
        <Picker
          selectedValue={formData.severity}
          onValueChange={(value) => setFormData(prev => ({ ...prev, severity: value }))}
          style={styles.picker}
        >
          {severityLevels.map((level) => (
            <Picker.Item key={level.value} label={level.label} value={level.value} />
          ))}
        </Picker>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Açıklama *</Text>
        <TextInput
          style={styles.textArea}
          value={formData.description}
          onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
          placeholder="Hasarı detaylı olarak açıklayın..."
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Konum</Text>
        <TouchableOpacity style={styles.button} onPress={getCurrentLocation}>
          <Text style={styles.buttonText}>
            {location ? 'Konum Güncellendi' : 'Konum Al'}
          </Text>
        </TouchableOpacity>
        {location && (
          <Text style={styles.locationText}>
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Fotoğraf</Text>
        <TouchableOpacity style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>
            {formData.photoPath ? 'Fotoğraf Değiştir' : 'Fotoğraf Çek'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Adınız (Opsiyonel)</Text>
        <TextInput
          style={styles.input}
          value={formData.reporterName}
          onChangeText={(text) => setFormData(prev => ({ ...prev, reporterName: text }))}
          placeholder="Adınızı girin"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Telefon (Opsiyonel)</Text>
        <TextInput
          style={styles.input}
          value={formData.reporterPhone}
          onChangeText={(text) => setFormData(prev => ({ ...prev, reporterPhone: text }))}
          placeholder="Telefon numaranızı girin"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>İptal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.submitButton, isSubmitting && styles.disabledButton]}
          onPress={submitForm}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Gönderiliyor...' : 'Raporu Gönder'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  picker: {
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  textArea: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  locationText: {
    color: '#888888',
    fontSize: 12,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    flex: 0.45,
  },
  submitButton: {
    backgroundColor: '#dc3545',
    flex: 0.45,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
