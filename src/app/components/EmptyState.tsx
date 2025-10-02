import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/app/theme/colors';
import { spacing } from '@/app/theme/spacing';
import { textStyles } from '@/app/theme/typography';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionTitle?: string;
  onActionPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export function EmptyState({
  icon = 'help-circle-outline',
  title,
  description,
  actionTitle,
  onActionPress,
  size = 'medium',
}: EmptyStateProps) {
  const iconSize = size === 'small' ? 48 : size === 'large' ? 80 : 64;
  const titleStyle = size === 'small' ? textStyles.h4 : size === 'large' ? textStyles.h2 : textStyles.h3;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={icon}
          size={iconSize}
          color={colors.text.tertiary}
        />
      </View>
      
      <Text style={[titleStyle, styles.title]}>
        {title}
      </Text>
      
      {description && (
        <Text style={[textStyles.body, styles.description]}>
          {description}
        </Text>
      )}
      
      {actionTitle && onActionPress && (
        <Button
          title={actionTitle}
          onPress={onActionPress}
          style={styles.actionButton}
          size={size === 'small' ? 'medium' : 'large'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  actionButton: {
    marginTop: spacing.md,
  },
});
