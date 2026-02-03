import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { BlurViewProps } from 'expo-blur';

/**
 * SafeBlurView
 * 
 * FORCE FALLBACK MODE
 * The native module is missing. We render a semi-transparent View to simulate glass.
 */
export const BlurView: React.FC<BlurViewProps> = ({
  style,
  children,
  intensity,
  tint = 'default',
  ...props
}) => {
  // Calculate opacity based on intensity (approximate)
  // Max opacity 0.95 to keep it slightly transparent
  const opacity = Math.min(0.5 + ((intensity || 0) / 200), 0.95);

  let backgroundColor = 'rgba(255, 255, 255, 0.8)'; // light default

  if (tint === 'dark') {
    backgroundColor = `rgba(15, 23, 42, ${opacity})`; // Deep Slate with opacity
  } else if (tint === 'light') {
    backgroundColor = `rgba(255, 255, 255, ${opacity})`;
  } else {
    // default/regular
    backgroundColor = `rgba(255, 255, 255, ${opacity})`;
  }

  // Override for our specific dark theme look if needed
  if (tint === 'dark') {
    backgroundColor = 'rgba(15, 23, 42, 0.85)';
  }

  return (
    <View style={[style, { backgroundColor }]}>
      {children}
    </View>
  );
};
