/**
 * PREPAREDNESS CHECKLIST
 * Signature component for AfetNet
 * "Modern Calm Trust" Style: Stamp effect, paper texture list
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, shadow } from '../../theme';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

interface ChecklistItemProps {
    label: string;
    isCompleted: boolean;
    onToggle: () => void;
}

const ChecklistItem = ({ label, isCompleted, onToggle }: ChecklistItemProps) => {
  const scale = useSharedValue(isCompleted ? 1 : 0);
  const opacity = useSharedValue(isCompleted ? 1 : 0);

  React.useEffect(() => {
    if (isCompleted) {
      scale.value = withSpring(1, { damping: 12 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [isCompleted]);

  const animatedStampStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { rotate: '-5deg' },
      ] as any, // Cast complex transform to any to fix reanimated type mismatch
      opacity: opacity.value,
    };
  });

  return (
    <Pressable onPress={onToggle} style={styles.itemContainer}>
      {/* Checkbox Area */}
      <View style={[styles.checkbox, isCompleted && styles.checkboxActive]}>
        {isCompleted && (
          <Ionicons name="checkmark" size={16} color={(colors.text as any).inverse || '#FFFFFF'} />
        )}
      </View>

      {/* Text */}
      <Text style={[styles.itemText, isCompleted && styles.itemTextCompleted]}>
        {label}
      </Text>

      {/* Stamp Effect Absolute Overlay */}
      {isCompleted && (
        <Animated.View style={[styles.stampContainer, animatedStampStyle]}>
          <Text style={styles.stampText}>TAMAM</Text>
        </Animated.View>
      )}
    </Pressable>
  );
};

interface PreparednessChecklistProps {
    title: string;
    progress: number; // 0-100
    items: { id: string; label: string; completed: boolean }[];
    onToggleItem: (id: string) => void;
}

export const PreparednessChecklist = ({ title, progress, items, onToggleItem }: PreparednessChecklistProps) => {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{items.filter(i => i.completed).length} / {items.length} tamamlandı</Text>
        </View>

        {/* Progress Circle (Stamp style) */}
        <View style={styles.progressCircle}>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* List */}
      <View style={styles.list}>
        {items.map((item) => (
          <ChecklistItem
            key={item.id}
            label={item.label}
            isCompleted={item.completed}
            onToggle={() => onToggleItem(item.id)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFCF7', // Specific Ivory for "Paper" lists
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...(shadow as any).soft,
    overflow: 'hidden',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background.secondary, // Slightly darker top
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  progressCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed', // "Stamp" feel
  },
  progressText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
  },
  list: {
    padding: 8,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)', // Very subtle separator
    position: 'relative',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border.medium,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  checkboxActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  itemText: {
    fontSize: 14,
    color: colors.text.primary,
    flex: 1,
  },
  itemTextCompleted: {
    color: colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  stampContainer: {
    position: 'absolute',
    right: 40,
    borderWidth: 2,
    borderColor: colors.status.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    opacity: 0.8,
  },
  stampText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.status.success,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
