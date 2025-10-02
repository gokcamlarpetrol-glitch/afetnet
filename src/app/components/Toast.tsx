import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/app/theme/colors';
import { spacing } from '@/app/theme/spacing';
import { textStyles } from '@/app/theme/typography';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onHide: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export function Toast({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onHide,
}: ToastProps) {
  const translateY = React.useRef(new Animated.Value(-100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: colors.interactive.success,
          icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
        };
      case 'error':
        return {
          backgroundColor: colors.interactive.destructive,
          icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
        };
      case 'warning':
        return {
          backgroundColor: colors.interactive.warning,
          icon: 'warning' as keyof typeof Ionicons.glyphMap,
        };
      case 'info':
      default:
        return {
          backgroundColor: colors.interactive.primary,
          icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
        };
    }
  };

  const toastStyle = getToastStyle();

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: toastStyle.backgroundColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={toastStyle.icon}
          size={20}
          color={colors.text.primary}
        />
        <Text style={[textStyles.body, styles.message]}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: spacing.md,
    right: spacing.md,
    borderRadius: 8,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  message: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
  },
});
