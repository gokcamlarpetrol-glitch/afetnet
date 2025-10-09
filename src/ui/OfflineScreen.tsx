import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { brandPalette, spacing, typography } from './brand';

interface OfflineScreenProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  showOfflineIndicator?: boolean;
}

export default function OfflineScreen({
  children,
  style,
  showOfflineIndicator = true,
}: OfflineScreenProps) {
  return (
    <View style={[styles.container, style]}>
      {showOfflineIndicator && (
        <View style={styles.offlineIndicator}>
          <Ionicons
            name="wifi-off"
            size={24}
            color={brandPalette.accent.main}
            style={styles.offlineIcon}
          />
          <Text style={styles.offlineText}>Çevrimdışı Mod</Text>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandPalette.background.dark,
  },
  
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandPalette.background.dark,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: brandPalette.accent.main,
  },
  
  offlineIcon: {
    marginRight: spacing.sm,
  },
  
  offlineText: {
    color: brandPalette.text.onDark,
    fontFamily: typography.fontFamily.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: 0.5,
  },
});
