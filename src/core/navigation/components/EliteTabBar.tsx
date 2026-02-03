/**
 * ELITE TAB BAR
 * Floating glassmorphic navigation bar with Reanimated 3 interactions.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from '../../components/SafeBlurView';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import * as haptics from '../../utils/haptics';
import { colors, shadows } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Tab Icon Mapping
const getIconName = (routeName: string, isFocused: boolean) => {
  switch (routeName) {
  case 'Home': return isFocused ? 'home' : 'home-outline';
  case 'Map': return isFocused ? 'map' : 'map-outline';
  case 'Family': return isFocused ? 'people' : 'people-outline';
  case 'Messages': return isFocused ? 'chatbubbles' : 'chatbubbles-outline';
  case 'Settings': return isFocused ? 'settings' : 'settings-outline';
  default: return 'help-circle';
  }
};

const TabItem = ({
  routeName,
  isFocused,
  onPress,
  onLongPress,
}: {
    routeName: string,
    isFocused: boolean,
    onPress: () => void,
    onLongPress: () => void
}) => {
  // Reanimated values for micro-interactions
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    if (isFocused) {
      scale.value = withSpring(1.2, { damping: 10, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withSpring(1, { damping: 10, stiffness: 200 });
      opacity.value = withTiming(0.6, { duration: 200 });
    }
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const iconName = getIconName(routeName, isFocused);

  // Special Active Indicator Dot
  const dotScale = useSharedValue(0);

  React.useEffect(() => {
    dotScale.value = withSpring(isFocused ? 1 : 0);
  }, [isFocused]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <TouchableOpacity
      onPress={() => {
        haptics.impactLight(); // Haptic feedback on press
        onPress();
      }}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.8}
    >
      <Animated.View style={[styles.iconContainer, animatedStyle]}>
        <Ionicons
          name={iconName as any}
          size={24}
          color={isFocused ? '#0ea5e9' : '#94a3b8'} // Soft Sky Blue vs Slate
        />
      </Animated.View>

      {/* Active Dot Indicator */}
      <Animated.View style={[styles.activeDot, dotStyle]} />
    </TouchableOpacity>
  );
};

export default function EliteTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 10 }]}>
      <Animated.View entering={ZoomIn.duration(500).delay(200)}>
        <BlurView intensity={30} tint="light" style={styles.blurContainer}>
          <View style={styles.tabRow}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              };

              return (
                <TabItem
                  key={route.key}
                  routeName={route.name}
                  isFocused={isFocused}
                  onPress={onPress}
                  onLongPress={onLongPress}
                />
              );
            })}
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    // Ensure touches pass through outside the bar
    pointerEvents: 'box-none',
  },
  blurContainer: {
    width: SCREEN_WIDTH - 40, // Floating width
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.85)', // Light Glass
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    ...shadows.medium,
    // Higher elevation to float above map/content
    elevation: 8,
    shadowColor: '#64748b', // Softer shadow color
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12, // Taller touch area
    paddingHorizontal: 20,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    width: 44,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    bottom: -6,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0ea5e9', // Soft Sky Blue
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
});
