import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/app/theme/colors';

import { HomeScreen } from '@/app/screens/HomeScreen';
import { MapScreen } from '@/app/screens/MapScreen';
import { CommunityScreen } from '@/app/screens/CommunityScreen';
import { FamilyScreen } from '@/app/screens/FamilyScreen';
import { GuideScreen } from '@/app/screens/GuideScreen';
import { SettingsScreen } from '@/app/screens/SettingsScreen';

export type TabParamList = {
  Home: undefined;
  Map: undefined;
  Community: undefined;
  Family: undefined;
  Guide: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Map':
              iconName = focused ? 'map' : 'map-outline';
              break;
            case 'Community':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Family':
              iconName = focused ? 'heart' : 'heart-outline';
              break;
            case 'Guide':
              iconName = focused ? 'book' : 'book-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.interactive.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: colors.background.secondary,
          borderTopColor: colors.border.primary,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: colors.background.secondary,
          borderBottomColor: colors.border.primary,
          borderBottomWidth: 1,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'Ana Sayfa' }}
      />
      <Tab.Screen 
        name="Map" 
        component={MapScreen}
        options={{ title: 'Harita' }}
      />
      <Tab.Screen 
        name="Community" 
        component={CommunityScreen}
        options={{ title: 'Topluluk' }}
      />
      <Tab.Screen 
        name="Family" 
        component={FamilyScreen}
        options={{ title: 'Aile' }}
      />
      <Tab.Screen 
        name="Guide" 
        component={GuideScreen}
        options={{ title: 'Rehber' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'Ayarlar' }}
      />
    </Tab.Navigator>
  );
}