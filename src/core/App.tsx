/**
 * CORE APP - Clean Entry Point
 * Simple, no infinite loops, no complex initialization
 */

import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { initializeApp, shutdownApp } from './init';
import ErrorBoundary from '../../src/ui/ErrorBoundary';

// Screens
import HomeScreen from './screens/home';
import MapScreen from './screens/map';
import FamilyScreen from './screens/family';
import MessagesScreen from './screens/messages';
import SettingsScreen from './screens/settings';
import PaywallScreen from './screens/paywall';

// Navigation
import MainTabs from './navigation/MainTabs';

const Stack = createStackNavigator();

export default function CoreApp() {
  useEffect(() => {
    // Initialize app
    initializeApp();

    // Cleanup on unmount
    return () => {
      shutdownApp();
    };
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen 
                name="Paywall" 
                component={PaywallScreen}
                options={{ presentation: 'modal' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

