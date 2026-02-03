import React from 'react';
import { View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  type?: 'switch' | 'arrow' | 'text';
  value?: string | boolean;
  onPress?: (value?: string | boolean) => void;
  index: number;
  isLast?: boolean; // New prop to hide border for last item
}

export function SettingItem({ icon, title, subtitle, type = 'arrow', value, onPress, index, isLast }: SettingItemProps) {
  const handlePress = () => {
    haptics.impactLight();
    if (onPress) {
      if (type === 'switch') {
        onPress(!value);
      } else {
        onPress();
      }
    }
  };

  const renderRightComponent = () => {
    if (type === 'switch') {
      return (
        <Switch
          value={typeof value === 'boolean' ? value : false}
          onValueChange={(val) => onPress && onPress(val)}
          trackColor={{ false: '#334155', true: colors.brand.primary }}
          thumbColor="#fff"
          ios_backgroundColor="#334155"
        />
      );
    }

    if (type === 'text' && typeof value === 'string') {
      return <Text style={styles.settingValue}>{value}</Text>;
    }

    return <Ionicons name="chevron-forward" size={20} color="#64748b" />;
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
      <Pressable
        onPress={type !== 'switch' ? handlePress : undefined}
        style={({ pressed }) => [
          styles.container,
          pressed && styles.pressed,
          isLast && styles.noBorder,
        ]}
      >
        <LinearGradient
          colors={[colors.brand.primary + '20', colors.brand.primary + '10']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <Ionicons name={icon} size={22} color={colors.brand.primary} />
        </LinearGradient>

        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {renderRightComponent()}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)', // Soft border
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // Light glass
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  pressed: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)', // Soft blue press
  },
  iconGradient: {
    width: 44,
    height: 44,
    borderRadius: 14, // Softer radius
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155', // Dark Slate
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b', // Slate
    lineHeight: 18,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand.primary,
    marginRight: 8,
  },
});
