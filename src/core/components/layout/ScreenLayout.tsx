import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { palette, spacing } from '../../theme/designSystem';

interface ScreenLayoutProps {
  children: React.ReactNode;
  style?: ViewStyle;
  footer?: React.ReactNode;
}

export default function ScreenLayout({ children, style, footer }: ScreenLayoutProps) {
  return (
    <ScrollView
      contentContainerStyle={[styles.container, style]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>{children}</View>
      {footer && <View style={styles.footer}>{footer}</View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: palette.background.page,
  },
  inner: {
    padding: spacing.lg,
  },
  footer: {
    paddingTop: spacing.md,
  },
});
