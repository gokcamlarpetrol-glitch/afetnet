import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/app/theme/colors';
import { spacing } from '@/app/theme/spacing';
import { textStyles } from '@/app/theme/typography';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';

interface ResourceFormProps {
  onSubmit: (data: {
    type: 'water' | 'food' | 'blanket' | 'powerbank' | 'med';
    quantity?: string;
    description?: string;
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const resourceTypes = [
  { key: 'water', label: 'Su', icon: 'water', color: colors.resources.water },
  { key: 'food', label: 'Yemek', icon: 'restaurant', color: colors.resources.food },
  { key: 'blanket', label: 'Battaniye', icon: 'bed', color: colors.resources.blanket },
  { key: 'powerbank', label: 'Powerbank', icon: 'battery-charging', color: colors.resources.powerbank },
  { key: 'med', label: 'İlaç', icon: 'medical', color: colors.resources.med },
] as const;

export function ResourceForm({ onSubmit, onCancel, isLoading = false }: ResourceFormProps) {
  const [selectedType, setSelectedType] = useState<typeof resourceTypes[number]['key'] | null>(null);
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!selectedType) {
      return;
    }

    // Mock location - in real app, this would come from location service
    const location = {
      latitude: 41.0082,
      longitude: 28.9784,
      accuracy: 10,
    };

    onSubmit({
      type: selectedType,
      quantity: quantity.trim() || undefined,
      description: description.trim() || undefined,
      location,
    });
  };

  const isFormValid = selectedType !== null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Kaynak Türü</Text>
        <View style={styles.typeGrid}>
          {resourceTypes.map((type) => (
            <TouchableOpacity
              key={type.key}
              style={[
                styles.typeButton,
                selectedType === type.key && styles.typeButtonSelected,
                { borderColor: selectedType === type.key ? type.color : colors.border.primary },
              ]}
              onPress={() => setSelectedType(type.key)}
            >
              <Ionicons
                name={type.icon}
                size={24}
                color={selectedType === type.key ? type.color : colors.text.secondary}
              />
              <Text
                style={[
                  styles.typeLabel,
                  { color: selectedType === type.key ? type.color : colors.text.secondary },
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Miktar (İsteğe Bağlı)</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="Örn: 5 litre, 10 adet, 2 kg"
          placeholderTextColor={colors.text.quaternary}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Açıklama (İsteğe Bağlı)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Ek bilgiler, koşullar, iletişim bilgileri..."
          placeholderTextColor={colors.text.quaternary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={200}
        />
        <Text style={styles.characterCount}>
          {description.length}/200
        </Text>
      </Card>

      <View style={styles.buttonRow}>
        <Button
          title="İptal"
          onPress={onCancel}
          variant="secondary"
          style={[styles.button, { flex: 1, marginRight: spacing.xs }]}
        />
        <Button
          title="Paylaş"
          onPress={handleSubmit}
          loading={isLoading}
          disabled={!isFormValid}
          style={[styles.button, { flex: 1, marginLeft: spacing.xs }]}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...textStyles.labelLarge,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
  },
  typeButtonSelected: {
    backgroundColor: colors.background.secondary,
  },
  typeLabel: {
    ...textStyles.label,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  input: {
    ...textStyles.body,
    color: colors.text.primary,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    ...textStyles.caption,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  button: {
    marginBottom: spacing.sm,
  },
});
