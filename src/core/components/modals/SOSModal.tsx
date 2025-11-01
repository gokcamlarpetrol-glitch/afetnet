/**
 * SOS MODAL
 * Emergency SOS submission modal
 */

import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, typography, spacing, borderRadius } from '../../theme';
import Button from '../Button';

interface SOSModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: SOSData) => void;
}

export interface SOSData {
  note?: string;
  people?: number;
  priority?: 'low' | 'med' | 'high';
  latitude?: number;
  longitude?: number;
}

export default function SOSModal({ visible, onClose, onSubmit }: SOSModalProps) {
  const [note, setNote] = useState('');
  const [people, setPeople] = useState('1');
  const [priority, setPriority] = useState<'low' | 'med' | 'high'>('high');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    setSending(true);

    try {
      // Get location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'SOS göndermek için konum izni gereklidir!');
        setSending(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const data: SOSData = {
        note: note || 'Acil yardım gerekiyor',
        people: parseInt(people) || 1,
        priority,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      onSubmit(data);
      
      // Reset form
      setNote('');
      setPeople('1');
      setPriority('high');
    } catch (error) {
      console.error('SOS error:', error);
      Alert.alert('Hata', 'SOS gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="alert-circle" size={32} color={colors.status.danger} />
            </View>
            <Text style={styles.title}>ACİL DURUM / SOS</Text>
            <Text style={styles.subtitle}>Konumunuz otomatik gönderilir</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Not (Opsiyonel)</Text>
            <TextInput
              style={styles.input}
              placeholder="Durum açıklaması..."
              placeholderTextColor={colors.text.muted}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Kişi Sayısı</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor={colors.text.muted}
              value={people}
              onChangeText={setPeople}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Öncelik</Text>
            <View style={styles.priorityButtons}>
              <Pressable
                onPress={() => setPriority('low')}
                style={[
                  styles.priorityButton,
                  priority === 'low' && styles.priorityButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.priorityText,
                    priority === 'low' && styles.priorityTextActive,
                  ]}
                >
                  Düşük
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPriority('med')}
                style={[
                  styles.priorityButton,
                  priority === 'med' && styles.priorityButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.priorityText,
                    priority === 'med' && styles.priorityTextActive,
                  ]}
                >
                  Orta
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPriority('high')}
                style={[
                  styles.priorityButton,
                  priority === 'high' && styles.priorityButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.priorityText,
                    priority === 'high' && styles.priorityTextActive,
                  ]}
                >
                  Yüksek
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              onPress={onClose}
              variant="secondary"
              style={styles.button}
              disabled={sending}
            >
              İptal
            </Button>
            <Button
              onPress={handleSubmit}
              variant="danger"
              style={styles.button}
              loading={sending}
              disabled={sending}
            >
              SOS GÖNDER
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.status.danger + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  form: {
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    color: colors.text.primary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.primary,
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: colors.status.danger,
    borderColor: colors.status.danger,
  },
  priorityText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  priorityTextActive: {
    color: colors.text.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
  },
});

