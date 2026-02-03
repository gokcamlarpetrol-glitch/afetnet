/**
 * MAIN TABS - Bottom Tab Navigation
 * Header gizli, sadece tab bar
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/home';
import MapScreen from '../screens/map';
import FamilyScreen from '../screens/family';
import MessagesScreen from '../screens/messages';
import SettingsScreen from '../screens/settings';

import EliteTabBar from './components/EliteTabBar';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      id={undefined}
      tabBar={(props) => <EliteTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // Labels handled by custom bar if needed, but we used icons only
        tabBarStyle: {
          position: 'absolute', // Required for transparent background behind it
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Family" component={FamilyScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
