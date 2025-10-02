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

interface HelpFormProps {
  onSubmit: (data: {
    priority: 0 | 1 | 2;
    underRubble: boolean;
    injured: boolean;
    peopleCount: number;
    note: string;
    anonymity: boolean;
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function HelpForm({ onSubmit, onCancel, isLoading = false }: HelpFormProps) {
  const [underRubble, setUnderRubble] = useState(false);
  const [injured, setInjured] = useState(false);
  const [peopleCount, setPeopleCount] = useState(1);
  const [note, setNote] = useState('');
  const [anonymity, setAnonymity] = useState(false);

  const calculatePriority = (): 0 | 1 | 2 => {
    if (injured && underRubble) return 0; // Critical
    if (injured || underRubble) return 1; // High
    return 2; // Normal
  };

  const handleSubmit = () => {
    // Mock location - in real app, this would come from location service
    const location = {
      latitude: 41.0082,
      longitude: 28.9784,
      accuracy: 10,
    };

    onSubmit({
      priority: calculatePriority(),
      underRubble,
      injured,
      peopleCount,
      note: note.trim(),
      anonymity,
      location,
    });
  };

  const priority = calculatePriority();
  const priorityColor = priority === 0 ? colors.status.critical : 
                       priority === 1 ? colors.status.high : colors.status.normal;
  const priorityLabel = priority === 0 ? 'Kritik' : 
                       priority === 1 ? 'Yüksek' : 'Normal';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Durum Bilgileri</Text>
        
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Ionicons name="home" size={20} color={colors.status.critical} />
            <Text style={styles.switchLabel}>Enkaz Altındayım</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.switch,
              underRubble && styles.switchActive,
              { backgroundColor: underRubble ? colors.status.critical : colors.background.tertiary },
            ]}
            onPress={() => setUnderRubble(!underRubble)}
          >
            <View
              style={[
                styles.switchThumb,
                underRubble && styles.switchThumbActive,
              ]}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Ionicons name="medical" size={20} color={colors.status.critical} />
            <Text style={styles.switchLabel}>Yaralıyım</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.switch,
              injured && styles.switchActive,
              { backgroundColor: injured ? colors.status.critical : colors.background.tertiary },
            ]}
            onPress={() => setInjured(!injured)}
          >
            <View
              style={[
                styles.switchThumb,
                injured && styles.switchThumbActive,
              ]}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputInfo}>
            <Ionicons name="people" size={20} color={colors.interactive.primary} />
            <Text style={styles.inputLabel}>Kişi Sayısı</Text>
          </View>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setPeopleCount(Math.max(1, peopleCount - 1))}
            >
              <Ionicons name="remove" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.counterValue}>{peopleCount}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setPeopleCount(Math.min(20, peopleCount + 1))}
            >
              <Ionicons name="add" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputInfo}>
            <Ionicons name="document-text" size={20} color={colors.interactive.primary} />
            <Text style={styles.inputLabel}>Kısa Not</Text>
          </View>
          <TextInput
            style={styles.textInput}
            value={note}
            onChangeText={setNote}
            placeholder="Durumunuz hakkında kısa bilgi..."
            placeholderTextColor={colors.text.quaternary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={200}
          />
          <Text style={styles.characterCount}>
            {note.length}/200
          </Text>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Ionicons name="eye-off" size={20} color={colors.interactive.primary} />
            <Text style={styles.switchLabel}>Anonim Paylaş</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.switch,
              anonymity && styles.switchActive,
              { backgroundColor: anonymity ? colors.interactive.primary : colors.background.tertiary },
            ]}
            onPress={() => setAnonymity(!anonymity)}
          >
            <View
              style={[
                styles.switchThumb,
                anonymity && styles.switchThumbActive,
              ]}
            />
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Tahmini Öncelik</Text>
        <View style={styles.priorityContainer}>
          <View style={styles.priorityIndicator}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.priorityLabel, { color: priorityColor }]}>
              {priorityLabel}
            </Text>
          </View>
          <Text style={styles.priorityDescription}>
            {priority === 0 && 'Kritik durum - acil müdahale gerekli'}
            {priority === 1 && 'Yüksek öncelik - hızlı müdahale gerekli'}
            {priority === 2 && 'Normal öncelik - standart müdahale'}
          </Text>
        </View>
      </Card>

      <View style={styles.buttonRow}>
        <Button
          title="İptal"
          onPress={onCancel}
          variant="secondary"
          style={[styles.button, { flex: 1, marginRight: spacing.xs }]}
        />
        <Button
          title="Yardım İste"
          onPress={handleSubmit}
          loading={isLoading}
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchLabel: {
    ...textStyles.body,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchActive: {
    // Active state handled by backgroundColor
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.text.primary,
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  inputRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  inputInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  inputLabel: {
    ...textStyles.label,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginHorizontal: spacing.md,
    minWidth: 30,
    textAlign: 'center',
  },
  textInput: {
    ...textStyles.body,
    color: colors.text.primary,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  characterCount: {
    ...textStyles.caption,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  priorityContainer: {
    alignItems: 'center',
  },
  priorityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  priorityLabel: {
    ...textStyles.h4,
    fontWeight: '600',
  },
  priorityDescription: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  button: {
    marginBottom: spacing.sm,
  },
});
