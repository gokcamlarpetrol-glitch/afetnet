import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { DamageReportRepository } from '../../core/data/repositories';
import { DamageReport, DamageType, DamageSeverity } from '../../core/data/models';
import { MediaCompressor } from '../../core/offline/media';
import { P2PManager } from '../../core/p2p';
import { useToast } from '../hooks/useToast';
import { useI18n } from '../hooks/useI18n';

interface DamageReportFormProps {
  onClose: () => void;
  initialLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

export const DamageReportForm: React.FC<DamageReportFormProps> = ({
  onClose,
  initialLocation,
}) => {
  const [damageType, setDamageType] = useState<DamageType>(DamageType.Building);
  const [severity, setSeverity] = useState<DamageSeverity>(DamageSeverity.Minor);
  const [description, setDescription] = useState('');
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState(initialLocation);

  const { t } = useI18n();
  const { showToast } = useToast();

  const damageReportRepository = DamageReportRepository.getInstance();
  const mediaCompressor = MediaCompressor.getInstance();
  const p2pManager = P2PManager.getInstance();

  const damageTypes = [
    { type: DamageType.Building, label: t('damage.building') },
    { type: DamageType.Road, label: t('damage.road') },
    { type: DamageType.Bridge, label: t('damage.bridge') },
    { type: DamageType.Utility, label: t('damage.utility') },
    { type: DamageType.Vehicle, label: t('damage.vehicle') },
    { type: DamageType.Other, label: t('damage.other') },
  ];

  const severityLevels = [
    { level: DamageSeverity.Minor, label: t('damage.severity.minor'), color: '#4CAF50' },
    { level: DamageSeverity.Moderate, label: t('damage.severity.moderate'), color: '#FF9800' },
    { level: DamageSeverity.Severe, label: t('damage.severity.severe'), color: '#F44336' },
    { level: DamageSeverity.Critical, label: t('damage.severity.critical'), color: '#9C27B0' },
  ];

  const handleAddMedia = async () => {
    try {
      const imageUri = await mediaCompressor.showImagePicker();
      if (imageUri) {
        const compressedUri = await mediaCompressor.compressImageForDamageReport(imageUri);
        setMediaUris(prev => [...prev, compressedUri]);
        showToast('Fotoğraf eklendi', 'success');
      }
    } catch (error) {
      console.error('Failed to add media:', error);
      showToast('Fotoğraf eklenirken hata oluştu', 'error');
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaUris(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      showToast('Açıklama alanı zorunludur', 'error');
      return;
    }

    if (!location) {
      showToast('Konum bilgisi gerekli', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const newDamageReport: Partial<DamageReport> = {
        ts: Date.now(),
        lat: location.latitude,
        lon: location.longitude,
        accuracy: location.accuracy || 0,
        type: damageType,
        severity: severity,
        description: description.trim(),
        mediaUris: mediaUris,
        verified: false,
        reporterId: 'self', // In a real app, this would be the user's ID
        reportedAt: Date.now(),
      };

      const savedReport = await damageReportRepository.create(newDamageReport);

      // Enqueue as a resource message for P2P distribution
      await p2pManager.enqueueMessage({
        id: savedReport.id,
        type: 'RESOURCE',
        payload: {
          ...savedReport,
          subtype: 'DAMAGE_REPORT',
        },
        ttl: 6,
        hops: 0,
        timestamp: savedReport.ts,
        signature: '', // Will be signed by P2PManager
        source: 'self',
      });

      showToast('Hasar raporu başarıyla gönderildi', 'success');
      onClose();
    } catch (error) {
      console.error('Failed to submit damage report:', error);
      showToast('Hasar raporu gönderilirken hata oluştu', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.title}>Hasar Raporu</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hasar Türü</Text>
          <View style={styles.chipContainer}>
            {damageTypes.map(({ type, label }) => (
              <Chip
                key={type}
                label={label}
                selected={damageType === type}
                onPress={() => setDamageType(type)}
                style={styles.chip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Şiddet Seviyesi</Text>
          <View style={styles.chipContainer}>
            {severityLevels.map(({ level, label, color }) => (
              <Chip
                key={level}
                label={label}
                selected={severity === level}
                onPress={() => setSeverity(level)}
                style={[styles.chip, { borderColor: color }]}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Açıklama</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Hasar hakkında detaylı açıklama yazın..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fotoğraf</Text>
          <View style={styles.mediaContainer}>
            {mediaUris.map((uri, index) => (
              <View key={index} style={styles.mediaItem}>
                <Text style={styles.mediaText}>Fotoğraf {index + 1}</Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveMedia(index)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {mediaUris.length < 3 && (
              <TouchableOpacity style={styles.addMediaButton} onPress={handleAddMedia}>
                <Text style={styles.addMediaButtonText}>+ Fotoğraf Ekle</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {location && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Konum</Text>
            <Text style={styles.locationText}>
              Enlem: {location.latitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              Boylam: {location.longitude.toFixed(6)}
            </Text>
            {location.accuracy && (
              <Text style={styles.locationText}>
                Doğruluk: ±{location.accuracy.toFixed(0)}m
              </Text>
            )}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <Button
            title="İptal"
            onPress={onClose}
            variant="secondary"
            style={styles.button}
          />
          <Button
            title="Raporu Gönder"
            onPress={handleSubmit}
            loading={isSubmitting}
            style={styles.button}
          />
        </View>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  card: {
    margin: 16,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    borderColor: '#444444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 100,
  },
  mediaContainer: {
    gap: 8,
  },
  mediaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderColor: '#444444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  mediaText: {
    color: '#ffffff',
    fontSize: 16,
  },
  removeButton: {
    backgroundColor: '#f44336',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addMediaButton: {
    backgroundColor: '#444444',
    borderColor: '#666666',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  addMediaButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  locationText: {
    color: '#cccccc',
    fontSize: 14,
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
  },
});
