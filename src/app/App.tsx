import React, { useEffect, useState } from 'react';
import { Platform, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { database } from '../core/data/db';
import { initializeApp } from '../core/utils/init';
import { usePermissions } from '../hooks/usePermissions';
import { useI18n } from '../hooks/useI18n';
import { HomeScreen } from './screens/HomeScreen';
import { MapScreen } from './screens/MapScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { FamilyScreen } from './screens/FamilyScreen';
import { GuideScreen } from './screens/GuideScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { HelpModal } from './components/HelpModal';
import { FirstLaunchModal } from './components/FirstLaunchModal';
import { Preferences } from '../core/storage/prefs';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = () => {
  const { t } = useI18n();
  
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#666',
        headerStyle: {
          backgroundColor: '#1a1a1a',
        },
        headerTintColor: '#fff',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: t('home.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: t('map.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="map" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          title: t('community.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="users" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Family"
        component={FamilyScreen}
        options={{
          title: t('family.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="heart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Guide"
        component={GuideScreen}
        options={{
          title: t('guide.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="book" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('settings.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showFirstLaunch, setShowFirstLaunch] = useState(false);
  const { requestPermissions } = usePermissions();

  useEffect(() => {
    initializeApp()
      .then(async () => {
        setIsReady(true);
        
        // Check if this is the first launch
        const firstLaunchCompleted = await Preferences.get('firstLaunchCompleted');
        if (!firstLaunchCompleted) {
          setShowFirstLaunch(true);
        }
        
        return requestPermissions();
      })
      .catch(error => {
        console.error('App initialization failed:', error);
        setIsReady(true);
      });
  }, [requestPermissions]);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={TabNavigator} />
        </Stack.Navigator>
        <HelpModal
          visible={showHelpModal}
          onClose={() => setShowHelpModal(false)}
        />
        <FirstLaunchModal
          visible={showFirstLaunch}
          onComplete={() => setShowFirstLaunch(false)}
        />
        <Toast />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}