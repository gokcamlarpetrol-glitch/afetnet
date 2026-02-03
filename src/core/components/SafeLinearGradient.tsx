import React from 'react';
import { View, ViewStyle, StyleProp, LayoutChangeEvent } from 'react-native';
// import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

// Define the props to match ExpoLinearGradient
interface LinearGradientProps {
  colors: string[] | readonly string[];
  locations?: number[] | null;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * SafeLinearGradient
 * 
 * FORCE FALLBACK MODE
 * The native module is missing in the current client.
 * We are forcing the fallback to a simple View to prevent "Unimplemented component" errors.
 */
export const LinearGradient: React.FC<LinearGradientProps> = ({
  colors,
  style,
  children,
  ...props
}) => {
  // Extract the first color for the background
  const fallbackColor = colors && colors.length > 0 ? colors[0] : 'transparent';

  // If it's an array of colors, we can try to be smart, but for now simple is safe.
  // We use the first color as the background.

  return (
    <View style={[{ backgroundColor: fallbackColor }, style]}>
      {children}
    </View>
  );
};
