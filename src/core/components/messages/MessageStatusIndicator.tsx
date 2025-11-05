/**
 * MESSAGE STATUS INDICATOR
 * Shows message delivery and read status
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface Props {
  status: MessageStatus;
  color?: string;
  size?: number;
}

export default function MessageStatusIndicator({
  status,
  color = '#ffffff',
  size = 14,
}: Props) {
  const getIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'sending':
        return 'time';
      case 'sent':
        return 'checkmark';
      case 'delivered':
        return 'checkmark-done';
      case 'read':
        return 'checkmark-done';
      case 'failed':
        return 'alert-circle';
      default:
        return 'time';
    }
  };

  const getColor = (): string => {
    switch (status) {
      case 'read':
        return '#3b82f6';
      case 'failed':
        return '#ef4444';
      default:
        return color;
    }
  };

  return (
    <View style={styles.container}>
      <Ionicons name={getIcon()} size={size} color={getColor()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
  },
});


