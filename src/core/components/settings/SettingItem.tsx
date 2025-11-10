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
  onPress?: (value?: any) => void;
  index: number;
}

export function SettingItem({ icon, title, subtitle, type = 'arrow', value, onPress, index }: SettingItemProps) {
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
    borderBottomColor: '#334155',
  },
  pressed: {
    backgroundColor: colors.brand.primary + '10',
  },
  iconGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.brand.primary + '30',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand.primary,
    marginRight: 8,
  },
});
