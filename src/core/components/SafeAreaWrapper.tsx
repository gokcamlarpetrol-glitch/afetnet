/**
 * SAFE AREA WRAPPER
 * Ensures content fits within safe area (no white bar at top)
 */

import React from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  style?: any;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export default function SafeAreaWrapper({ 
  children, 
  style,
  edges = ['top', 'left', 'right']
}: SafeAreaWrapperProps) {
  return (
    <>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={colors.background.primary}
        translucent={false}
      />
      <SafeAreaView 
        style={[styles.container, style]}
        edges={edges}
      >
        {children}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
});


