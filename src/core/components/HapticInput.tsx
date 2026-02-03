/**
 * HAPTIC INPUT - ELITE COMPONENT
 * A TextInput component with built-in haptic feedback on focus/blur.
 *
 * Usage:
 * <HapticInput
 *   placeholder="Enter text"
 *   value={value}
 *   onChangeText={setValue}
 * />
 */

import React, { memo, useCallback, useState } from 'react';
import { TextInput, TextInputProps, StyleSheet, ViewStyle, NativeSyntheticEvent, TextInputFocusEventData } from 'react-native';
import * as haptics from '../utils/haptics';
import { colors, borderRadius } from '../theme';

interface HapticInputProps extends TextInputProps {
  containerStyle?: ViewStyle;
}

const HapticInput: React.FC<HapticInputProps> = memo(({
  containerStyle,
  onFocus,
  onBlur,
  style,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback((e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    haptics.selectionChanged();
    setIsFocused(true);
    onFocus?.(e);
  }, [onFocus]);

  const handleBlur = useCallback((e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    haptics.impactLight();
    setIsFocused(false);
    onBlur?.(e);
  }, [onBlur]);

  return (
    <TextInput
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={[
        styles.input,
        isFocused && styles.focused,
        style,
      ]}
      placeholderTextColor={colors.text.tertiary}
      {...rest}
    />
  );
});

HapticInput.displayName = 'HapticInput';

const styles = StyleSheet.create({
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  focused: {
    borderColor: colors.brand.primary,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
  },
});

export default HapticInput;
