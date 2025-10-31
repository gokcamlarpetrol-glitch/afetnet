import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Text, View } from 'react-native';

interface StatusIndicatorProps {
  status: 'active' | 'inactive' | 'warning' | 'critical';
  label: string;
  value?: string | number;
  animated?: boolean;
}

export default function StatusIndicator({ status, label, value, animated = true }: StatusIndicatorProps) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (animated && status === 'active') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [animated, status, pulseAnim]);

  const getStatusConfig = () => {
    switch (status) {
    case 'active':
      return { color: '#10b981', icon: 'checkmark-circle', bg: '#064e3b' };
    case 'inactive':
      return { color: '#6b7280', icon: 'close-circle', bg: '#374151' };
    case 'warning':
      return { color: '#f59e0b', icon: 'warning', bg: '#78350f' };
    case 'critical':
      return { color: '#ef4444', icon: 'alert-circle', bg: '#7f1d1d' };
    }
  };

  const config = getStatusConfig();

  return (
    <Animated.View
      style={{
        backgroundColor: config.bg,
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
        transform: [{ scale: pulseAnim }],
      }}
    >
      <Ionicons name={config.icon as any} size={20} color={config.color} style={{ marginRight: 8 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
          {label}
        </Text>
        {value && (
          <Text style={{ color: config.color, fontSize: 12, fontWeight: '500' }}>
            {value}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}































